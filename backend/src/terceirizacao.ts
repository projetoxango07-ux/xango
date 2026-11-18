import { Router, type Express, type Request, type Response } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";

// A V3 nao depende das permissoes comerciais da V1. A validacao
// autentica/autoriza no mesmo sistema ja usado pelo backend principal.
type PerfilV3 = { id: number; organizacaoId: number };
type RequisicaoV3 = Request & { usuarioAutenticado?: PerfilV3 };
type PodeAcessarV3 = (req: Request, permissao: string) => boolean;
const MODALIDADES = ["ECG", "EEG", "ESPIROMETRIA", "MAPA", "HOLTER"] as const;
type Modalidade = (typeof MODALIDADES)[number];

// Regras de alerta V3. Datas civis AAAA-MM-DD; prazo so corre apos envio.
export type FaixaPrazoV3 = "AGUARDANDO_ENVIO" | "SEM_PREVISAO" | "ATRASADO" | "HOJE" | "PROXIMOS_3_DIAS" | "NO_PRAZO";
export function classificarPrazoLaudoV3(status: string, previsao: string | null, hoje: string):
  { faixa: FaixaPrazoV3; diasRestantes: number | null } {
  if (status === "REALIZADO") return { faixa: "AGUARDANDO_ENVIO", diasRestantes: null };
  // Examens recebidos aguardam a entrega; os enviados aguardam o retorno.
  if (status !== "ENVIADO_LAUDO" && status !== "LAUDO_RECEBIDO") {
    throw new Error("Status nao elegivel para alerta de laudo.");
  }
  if (!previsao) return { faixa: "SEM_PREVISAO", diasRestantes: null };
  const civil = /^\d{4}-\d{2}-\d{2}$/;
  if (!civil.test(previsao) || !civil.test(hoje)) throw new Error("Data de prazo invalida.");
  const diferenca = (Date.parse(`${previsao}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86400000;
  if (!Number.isInteger(diferenca)) throw new Error("Diferenca de datas invalida.");
  return { faixa: diferenca < 0 ? "ATRASADO" : diferenca === 0 ? "HOJE" : diferenca <= 3 ? "PROXIMOS_3_DIAS" : "NO_PRAZO",
    diasRestantes: diferenca };
}

type EntradaExame = { tipoExame?: unknown; equipamentoId?: unknown; repeticao?: unknown };
class ErroV3 extends Error {
  constructor(public readonly status: number, mensagem: string) { super(mensagem); }
}
const invalido = (mensagem: string) => { throw new ErroV3(400, mensagem); };
const numero = (valor: unknown): number | null => {
  const n = Number(valor);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
function dataCivil(valor: unknown): Date {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return invalido("Informe uma data valida no formato AAAA-MM-DD.");
  const data = new Date(`${valor}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor) return invalido("Data de realizacao invalida.");
  return data;
}
function usuarioDaRequisicao(req: Request): PerfilV3 {
  const usuario = (req as RequisicaoV3).usuarioAutenticado;
  if (!usuario?.id || !usuario.organizacaoId) throw new ErroV3(401, "Sessao invalida.");
  return usuario;
}
function responderErro(res: Response, erro: unknown) {
  if (erro instanceof ErroV3) return res.status(erro.status).json({ erro: erro.message });
  console.error("Falha na API da terceirizacao:", erro);
  return res.status(500).json({ erro: "Nao foi possivel concluir a operacao." });
}

// As listas operacionais V3 usam a data civil de realizacao (PostgreSQL @db.Date),
// nao o dia do cadastro, envio ou recebimento. Inicio inclusivo, fim exclusivo em UTC.
function competenciaV3Agora() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const p = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  const ano = Number(p.year), numeroMes = Number(p.month);
  return {
    mes: `${p.year}-${p.month}`,
    hoje: `${p.year}-${p.month}-${p.day}`,
    inicio: new Date(Date.UTC(ano, numeroMes - 1, 1)),
    fim: new Date(Date.UTC(ano, numeroMes, 1)),
  };
}

// Resumo gerencial: competencia da producao, caixa efetivo e carteira aberta sao eixos distintos.
// Somente titulos/parcelas ativos e baixas nao estornadas da organizacao logada.
async function resumoFinanceiroV3(prisma: PrismaClient, organizacaoId: number) {
  const { mes, inicio, fim, hoje } = competenciaV3Agora();
  const hojeCivil = dataCivil(hoje);
  const [resumo] = await prisma.$queryRaw<Array<{
    titulosMes: string; recebidoMes: string; saldoAberto: string;
    saldoVencido: string; parcelasVencidas: number; saldoHoje: string; parcelasHoje: number;
    pendenciasMes: number;
  }>>`
    WITH titulos AS (
      SELECT t."id", t."valorDevido", pr."dataRealizacao"
      FROM "TituloFinanceiroV3" t
      JOIN "TerceirizacaoExame" e ON e."id" = t."exameId"
      JOIN "TerceirizacaoProducao" pr ON pr."id" = e."producaoId"
      WHERE t."organizacaoId" = ${organizacaoId} AND pr."organizacaoId" = ${organizacaoId}
        AND t."natureza" = 'A_RECEBER' AND t."canceladoEm" IS NULL
    ), parcelas AS (
      SELECT p."id", p."vencimento", p."valorPrevisto"
      FROM "ParcelaFinanceiraV3" p JOIN titulos t ON t."id" = p."tituloId"
      WHERE p."canceladaEm" IS NULL
    ), baixas AS (
      SELECT b."parcelaId", SUM(b."valor") AS pago,
        SUM(b."valor") FILTER (WHERE b."dataEfetiva" >= ${inicio}::date AND b."dataEfetiva" < ${fim}::date) AS recebido_mes
      FROM "BaixaFinanceiraV3" b JOIN parcelas p ON p."id" = b."parcelaId"
      WHERE b."estornadoEm" IS NULL GROUP BY b."parcelaId"
    ), saldos AS (
      SELECT p."vencimento", GREATEST(p."valorPrevisto" - COALESCE(b.pago, 0), 0) AS saldo,
        COALESCE(b.recebido_mes, 0) AS recebido_mes
      FROM parcelas p LEFT JOIN baixas b ON b."parcelaId" = p."id"
    )
    SELECT
      COALESCE((SELECT SUM(t."valorDevido") FROM titulos t
        WHERE t."dataRealizacao" >= ${inicio}::date AND t."dataRealizacao" < ${fim}::date), 0)::text AS "titulosMes",
      COALESCE(SUM(s.recebido_mes), 0)::text AS "recebidoMes",
      COALESCE(SUM(s.saldo), 0)::text AS "saldoAberto",
      COALESCE(SUM(s.saldo) FILTER (WHERE s."vencimento" < ${hojeCivil}::date), 0)::text AS "saldoVencido",
      COUNT(*) FILTER (WHERE s.saldo > 0 AND s."vencimento" < ${hojeCivil}::date)::int AS "parcelasVencidas",
      COALESCE(SUM(s.saldo) FILTER (WHERE s."vencimento" = ${hojeCivil}::date), 0)::text AS "saldoHoje",
      COUNT(*) FILTER (WHERE s.saldo > 0 AND s."vencimento" = ${hojeCivil}::date)::int AS "parcelasHoje",
      (SELECT COUNT(*)::int FROM "TerceirizacaoExame" e
        JOIN "TerceirizacaoProducao" pr ON pr."id" = e."producaoId"
        WHERE pr."organizacaoId" = ${organizacaoId}
          AND pr."dataRealizacao" >= ${inicio}::date AND pr."dataRealizacao" < ${fim}::date
          AND e."status" IN ('ENVIADO_LAUDO', 'LAUDO_RECEBIDO', 'ENTREGUE')
          AND NOT EXISTS (SELECT 1 FROM "TituloFinanceiroV3" t
            WHERE t."exameId" = e."id" AND t."organizacaoId" = ${organizacaoId}
              AND t."natureza" = 'A_RECEBER' AND t."canceladoEm" IS NULL)) AS "pendenciasMes"
    FROM saldos s
  `;
  if (!resumo) throw new Error("Resumo financeiro V3 indisponivel.");
  return { competencia: mes, hoje, ...resumo };
}

function intervaloMesV3(mes: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(mes)) {
    throw new ErroV3(400, "Competencia invalida. Use AAAA-MM.");
  }
  const [ano, numeroMes] = mes.split("-").map(Number);
  return {
    inicio: new Date(Date.UTC(ano, numeroMes - 1, 1)),
    fim: new Date(Date.UTC(ano, numeroMes, 1)),
  };
}


// Datas civis guardadas em @db.Date: nunca usar data/hora do envio como competencia.
function somarDiasV3(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * 86400000);
}
// Acrescenta meses civis, mantendo o dia quando possivel (31 -> ultimo dia do mes).
function somarMesesV3(data: Date, meses: number): Date {
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth() + meses;
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(data.getUTCDate(), ultimoDia)));
}
function centavosV3(valor: unknown): bigint | null {
  const s = String(valor ?? "").trim();
  if (!/^\d{1,11}(?:\.\d{1,2})?$/.test(s)) return null;
  const [i, c = ""] = s.split(".");
  const n = BigInt(i) * 100n + BigInt(c.padEnd(2, "0"));
  return n > 0n ? n : null;
}
function dinheiroV3(valor: bigint): string {
  return `${valor / 100n}.${String(valor % 100n).padStart(2, "0")}`;
}
function calcularValorV3(regra: { metodo: string; valorFixo: { toString(): string } | null; percentual: { toString(): string } | null }, valorBaseReal: unknown) {
  const base = valorBaseReal === null || valorBaseReal === undefined || valorBaseReal === "" ? null : centavosV3(valorBaseReal);
  if (regra.metodo === "FIXO") {
    const valor = centavosV3(regra.valorFixo?.toString());
    if (!valor) throw new ErroV3(409, "Valor fixo da regra financeira invalido.");
    return { valorDevido: dinheiroV3(valor), baseReal: null as string | null };
  }
  if (!base) return null;
  const percentual = regra.percentual?.toString() ?? "";
  if (!/^\d{1,3}(?:\.\d{1,4})?$/.test(percentual) || Number(percentual) <= 0 || Number(percentual) > 100) {
    throw new ErroV3(409, "Percentual da regra financeira invalido.");
  }
  const [inteiro, decimal = ""] = percentual.split(".");
  const pontos = BigInt(inteiro) * 10000n + BigInt(decimal.padEnd(4, "0"));
  const total = (base * pontos + 500000n) / 1000000n;
  if (total <= 0n) return null;
  return { valorDevido: dinheiroV3(total), baseReal: dinheiroV3(base) };
}
// Preferencia: regra especifica para convenio/categoria; fallback para regra geral.
// A vigencia ja e filtrada na consulta; titulo preserva snapshot dos valores.
function escolherRegraV3<T extends { convenio: string; categoriaAtendimento: string; inicioVigencia: Date; id: number }>(
  regras: T[], convenio: string, categoria: string,
): T | null {
  const pontuadas = regras.filter((r) => (r.convenio === convenio || r.convenio === "") &&
    (r.categoriaAtendimento === categoria || r.categoriaAtendimento === ""));
  pontuadas.sort((a, b) => {
    const pontos = (r: T) => (r.convenio === convenio && convenio ? 2 : 0) +
      (r.categoriaAtendimento === categoria && categoria ? 1 : 0);
    return pontos(b) - pontos(a) || b.inicioVigencia.getTime() - a.inicioVigencia.getTime() || b.id - a.id;
  });
  return pontuadas[0] ?? null;
}

function textosConfiguradosV3(valor: unknown, descricao: string) {
  if (!Array.isArray(valor) || valor.length > 35) return invalido(`${descricao}: informe uma lista valida.`);
  const itens = valor.map((x) => typeof x === "string" ? x.trim().toUpperCase() : "");
  if (itens.some((x) => x.length < 2 || x.length > 120)) return invalido(`${descricao}: cada opcao deve ter de 2 a 120 caracteres.`);
  return [...new Set(itens)];
}

// V3 bonus: data civil de Sao Paulo, dinheiro em centavos e regras por vigencia.
function bonusDiaV3(data: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(data).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function bonusCentavosV3(valor: unknown): bigint | null {
  const s = String(valor ?? "").trim().replace(",", ".");
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(s)) return null;
  const [i, c = ""] = s.split(".");
  return BigInt(i)*100n + BigInt(c.padEnd(2,"0"));
}
function bonusVencimentoV3(mes: string, feriadosLocais: string[]) {
  const { fim } = intervaloMesV3(mes);
  let d = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), 20));
  const nacionais = new Set(["01-01","04-21","05-01","09-07","10-12","11-02","11-15","11-20","12-25"]);
  // Outros feriados/expediente bancario local podem ser informados no fechamento.
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6 || nacionais.has(d.toISOString().slice(5,10)) || feriadosLocais.includes(d.toISOString().slice(0,10))) d = somarDiasV3(d,-1);
  return d;
}
type BonusRegra = {id:number; funcionarioId:number; tipoExame:string; inicioVigencia:Date; valor:{toString():string}};
type BonusExame = {id:number; executadoPorId:number; tipoExame:string; status:string; classificacaoBonificacaoV3:string; laudoEnviadoEm:Date|null; laudoRecebidoEm:Date|null; laudoEntregueEm:Date|null; producao:{dataRealizacao:Date}};
function bonusConcluidoV3(e: BonusExame) {
  const a=e.laudoEnviadoEm,b=e.laudoRecebidoEm,c=e.laudoEntregueEm;
  return e.status === "ENTREGUE" && a && b && c && a <= b && b <= c && bonusDiaV3(a)>=e.producao.dataRealizacao.toISOString().slice(0,10) ? c : null;
}
function bonusCalcularV3(exames: BonusExame[], regras: BonusRegra[], mes: string) {
  const itens: {exameId:number; funcionarioId:number; tipoExame:Modalidade; regraId:number; valor:string; concluidoEm:Date}[]=[];
  const pendencias: {exameId:number; funcionarioId:number; motivo:string}[]=[];
  for (const e of exames) {
    if (e.status !== "ENTREGUE" || !e.laudoEntregueEm || bonusDiaV3(e.laudoEntregueEm).slice(0,7)!==mes) continue;
    if (e.classificacaoBonificacaoV3 === "REPETICAO") continue;
    const concluidoEm=bonusConcluidoV3(e);
    if (!concluidoEm || e.classificacaoBonificacaoV3!=="ORIGINAL") {
      pendencias.push({exameId:e.id,funcionarioId:e.executadoPorId,motivo:!concluidoEm?"Etapas do laudo incompletas ou inconsistentes":"Classificar original ou repeticao"}); continue;
    }
    const regra=regras.filter(r=>r.funcionarioId===e.executadoPorId && r.tipoExame===e.tipoExame && r.inicioVigencia<=e.producao.dataRealizacao).sort((a,b)=>b.inicioVigencia.getTime()-a.inicioVigencia.getTime()||b.id-a.id)[0];
    const valor=regra?bonusCentavosV3(regra.valor.toString()):null;
    if (!regra || valor===null) {pendencias.push({exameId:e.id,funcionarioId:e.executadoPorId,motivo:"Sem valor vigente na realizacao"});continue;}
    if (valor === 0n) continue; // Sem bonificacao e sem pendencia.
    itens.push({exameId:e.id,funcionarioId:e.executadoPorId,tipoExame:e.tipoExame as Modalidade,regraId:regra.id,valor:dinheiroV3(valor),concluidoEm});
  }
  return {itens,pendencias};
}

export function registrarRotasTerceirizacao(app: Express, prisma: PrismaClient, podeAcessar: PodeAcessarV3) {
  const router = Router();
  function proteger(permissao: string) {
    return (req: Request, res: Response, next: () => void) => {
      try {
        usuarioDaRequisicao(req);
        // A permissao geral e a permissao da operacao devem coexistir.
        if (!podeAcessar(req, "terceirizacao.visualizar") || !podeAcessar(req, permissao)) {
          res.status(403).json({ erro: "Sem permissao para esta operacao da terceirizacao." });
          return;
        }
        next();
      } catch (erro) { responderErro(res, erro); }
    };
  }

  // Opcoes estritamente operacionais; nao expoe faturamento nem guias da V1.
  router.get("/clinicas-parcerias", proteger("terceirizacao.configuracoes.visualizar"), async (_req, res) => {
    try {
      const clinicas = await prisma.clinica.findMany({
        select: { id: true, nome: true, ativo: true, parceriaAgendamentos: true, parceriaTerceirizacao: true },
        orderBy: { nome: "asc" },
      });
      res.json({ clinicas });
    } catch (erro) { responderErro(res, erro); }
  });

  router.post("/clinicas-parcerias", proteger("terceirizacao.configuracoes.editar"), async (req, res) => {
    try {
      const nome = typeof req.body?.nome === "string" ? req.body.nome.trim() : "";
      if (nome.length < 3 || nome.length > 160) return res.status(400).json({ erro: "Informe um nome entre 3 e 160 caracteres." });
      const igual = await prisma.clinica.findFirst({ where: { nome: { equals: nome, mode: "insensitive" } }, select: { id: true } });
      if (igual) return res.status(409).json({ erro: "Clinica ja cadastrada. Habilite sua parceria V3 na lista." });
      const clinica = await prisma.clinica.create({
        data: { nome, parceriaAgendamentos: false, parceriaTerceirizacao: true },
        select: { id: true, nome: true, ativo: true, parceriaAgendamentos: true, parceriaTerceirizacao: true },
      });
      res.status(201).json({ clinica });
    } catch (erro) { responderErro(res, erro); }
  });

  router.patch("/clinicas-parcerias/:id", proteger("terceirizacao.configuracoes.editar"), async (req, res) => {
    try {
      const id = numero(req.params.id);
      if (!id) return res.status(400).json({ erro: "Clinica invalida." });
      const v1=req.body?.parceriaAgendamentos, v3=req.body?.parceriaTerceirizacao;
      if (typeof v1 !== "boolean" || typeof v3 !== "boolean") return res.status(400).json({ erro: "Informe as duas parcerias." });
      if (!v1 && !v3) return res.status(400).json({ erro: "Habilite ao menos uma parceria." });
      const encontrada = await prisma.clinica.findUnique({ where: { id }, select: { id: true } });
      if (!encontrada) return res.status(404).json({ erro: "Clinica nao encontrada." });
      const clinica = await prisma.clinica.update({
        where: { id }, data: { parceriaAgendamentos: v1, parceriaTerceirizacao: v3 },
        select: { id: true, nome: true, ativo: true, parceriaAgendamentos: true, parceriaTerceirizacao: true },
      });
      res.json({ clinica });
    } catch (erro) { responderErro(res, erro); }
  });

  router.get("/base", proteger("terceirizacao.producao.visualizar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const [clinicas, equipamentos, ocupacoes, funcionarios] = await Promise.all([
        prisma.clinica.findMany({ where: { ativo: true, parceriaTerceirizacao: true }, select: { id: true, nome: true, unidades: { where: { ativo: true }, select: { id: true, nome: true } } }, orderBy: { nome: "asc" } }),
        prisma.terceirizacaoEquipamento.findMany({ where: { organizacaoId: u.organizacaoId, ativo: true, tipo: { in: ["MAPA", "HOLTER"] } }, select: { id: true, codigo: true, tipo: true }, orderBy: { codigo: "asc" } }),
        prisma.terceirizacaoUsoEquipamento.findMany({ where: { descarregadoEm: null, equipamento: { organizacaoId: u.organizacaoId } }, select: { equipamentoId: true } }),
        bonusAdmin(req).then(admin => admin ? prisma.usuario.findMany({where:{organizacaoId:u.organizacaoId,ativo:true},select:{id:true,nome:true},orderBy:{nome:"asc"}}) : []),
      ]);
      const ocupados = new Set(ocupacoes.map((item) => item.equipamentoId));
      res.json({ clinicas, funcionarios, equipamentos: equipamentos.map((e) => ({ ...e, disponivel: !ocupados.has(e.id) })), modalidades: MODALIDADES });
    } catch (erro) { responderErro(res, erro); }
  });

  router.get("/pacientes", proteger("terceirizacao.producao.visualizar"), async (req, res) => {
    try {
      const busca = String(req.query.busca ?? "").trim().slice(0, 80);
      if (busca.length < 3) return res.json({ pacientes: [] });
      // Resultado minimo para confirmacao humana de identidade, sem dados de pagamentos/atendimentos da V1.
      const pacientes = await prisma.paciente.findMany({ where: { nome: { contains: busca, mode: "insensitive" } }, select: { id: true, nome: true, dataNascimento: true }, orderBy: { nome: "asc" }, take: 12 });
      res.json({ pacientes });
    } catch (erro) { responderErro(res, erro); }
  });

  router.get("/producoes", proteger("terceirizacao.producao.visualizar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const clinicaId = numero(req.query.clinicaId);
      const { mes, inicio, fim } = competenciaV3Agora();
      const producoes = await prisma.terceirizacaoProducao.findMany({
        where: { organizacaoId: u.organizacaoId, dataRealizacao: { gte: inicio, lt: fim }, ...(clinicaId ? { clinicaId } : {}) },
        orderBy: [{ dataRealizacao: "desc" }, { id: "desc" }], take: 120,
        select: { id: true, nomePacienteDigitado: true, dataRealizacao: true, pacienteId: true,
          clinica: { select: { id: true, nome: true } },
          unidadeClinica: { select: { id: true, nome: true } },
          exames: { select: { id: true, codigoInterno: true, tipoExame: true, status: true, classificacaoBonificacaoV3: true, usoEquipamento: { select: { id: true, equipamento: { select: { id: true, codigo: true } }, retiradaPrevista: true, retiradoEm: true, descarregadoEm: true } } } },
        },
      });
      res.json({ producoes, competencia: mes });
    } catch (erro) { responderErro(res, erro); }
  });

  router.post("/producoes", proteger("terceirizacao.producao.criar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const corpo = req.body ?? {};
      const clinicaId = numero(corpo.clinicaId);
      const unidadeClinicaId = corpo.unidadeClinicaId ? numero(corpo.unidadeClinicaId) : null;
      const pacienteId = corpo.pacienteId ? numero(corpo.pacienteId) : null;
      const nome = String(corpo.nomePacienteDigitado ?? "").trim().replace(/\s+/g, " ");
      if (!clinicaId) return invalido("Selecione a clinica.");
      if (nome.length < 2 || nome.length > 180) return invalido("Informe o nome do paciente (2 a 180 caracteres).");
      const dataRealizacao = dataCivil(corpo.dataRealizacao);
      const executorId=corpo.executadoPorId === undefined || corpo.executadoPorId === null ? u.id : numero(corpo.executadoPorId);
      if(!executorId) return invalido("Executor invalido.");
      if(executorId!==u.id){await bonusAdmin(req,true);if(!await prisma.usuario.findFirst({where:{id:executorId,organizacaoId:u.organizacaoId,ativo:true},select:{id:true}}))return invalido("Executor invalido.");}
      if (!Array.isArray(corpo.exames) || corpo.exames.length < 1 || corpo.exames.length > 12) return invalido("Adicione entre 1 e 12 exames.");
      const exames = (corpo.exames as EntradaExame[]).map((item) => {
        if (!item || !MODALIDADES.includes(item.tipoExame as Modalidade)) return invalido("Tipo de exame invalido.");
        const tipo = item.tipoExame as Modalidade;
        const equipamentoId = item.equipamentoId ? numero(item.equipamentoId) : null;
        if ((tipo === "MAPA" || tipo === "HOLTER") && !equipamentoId) return invalido(`Selecione o aparelho para ${tipo}.`);
        if (tipo !== "MAPA" && tipo !== "HOLTER" && equipamentoId) return invalido("Aparelho nao permitido para esta modalidade.");
        if(item.repeticao!==undefined && typeof item.repeticao!=="boolean")return invalido("Classificacao de repeticao invalida.");
        const classificacao = item.repeticao === true ? "REPETICAO" as const : item.repeticao === false ? "ORIGINAL" as const : "NAO_CONFERIDO" as const;
        return { tipo, equipamentoId, classificacao };
      });
      const ids = exames.map((item) => item.equipamentoId).filter((v): v is number => v !== null);
      if (new Set(ids).size !== ids.length) return invalido("Um aparelho nao pode ser utilizado em dois exames ao mesmo tempo.");
      const clinica = await prisma.clinica.findFirst({ where: { id: clinicaId, ativo: true, parceriaTerceirizacao: true }, select: { id: true } });
      if (!clinica) return invalido("Clinica nao encontrada ou inativa.");
      if (unidadeClinicaId) {
        const unidade = await prisma.unidadeClinica.findFirst({ where: { id: unidadeClinicaId, clinicaId, ativo: true }, select: { id: true } });
        if (!unidade) return invalido("Unidade nao pertence a clinica selecionada.");
      }
      if (pacienteId) {
        const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId }, select: { id: true, nome: true } });
        if (!paciente || paciente.nome.trim().toLocaleLowerCase("pt-BR") !== nome.toLocaleLowerCase("pt-BR")) return invalido("Confira a identidade do paciente selecionado.");
      }
      const novo = await prisma.$transaction(async (tx) => {
        // Bloqueio de linha no PostgreSQL evita duas instalacoes simultaneas do mesmo aparelho.
        for (const equipamentoId of [...ids].sort((a, b) => a - b)) {
          await tx.$queryRaw`SELECT id FROM "TerceirizacaoEquipamento" WHERE id = ${equipamentoId} FOR UPDATE`;
          const equipamento = await tx.terceirizacaoEquipamento.findFirst({ where: { id: equipamentoId, organizacaoId: u.organizacaoId, ativo: true }, select: { id: true, tipo: true } });
          if (!equipamento) throw new ErroV3(400, "Aparelho nao encontrado ou inativo.");
          if (!exames.some((item) => item.equipamentoId === equipamentoId && item.tipo === equipamento.tipo)) throw new ErroV3(400, "O tipo do aparelho nao corresponde ao exame.");
          const emUso = await tx.terceirizacaoUsoEquipamento.findFirst({ where: { equipamentoId, descarregadoEm: null }, select: { id: true } });
          if (emUso) throw new ErroV3(409, `Aparelho ja esta em uso. Atualize a lista antes de continuar.`);
        }
        const producao = await tx.terceirizacaoProducao.create({ data: { organizacaoId: u.organizacaoId, clinicaId,
          unidadeClinicaId, pacienteId, nomePacienteDigitado: nome, dataRealizacao, criadoPorId: u.id }, select: { id: true } });
        for (const exame of exames) {
          const criado = await tx.terceirizacaoExame.create({ data: { producaoId: producao.id, tipoExame: exame.tipo, executadoPorId: executorId, classificacaoBonificacaoV3: exame.classificacao }, select: { id: true } });
          if (exame.equipamentoId) {
            const proximaData = new Date(dataRealizacao.getTime() + 86400000);
            await tx.terceirizacaoUsoEquipamento.create({ data: { exameId: criado.id, equipamentoId: exame.equipamentoId,
              // Horario de instalacao nao foi digitado; guarda a hora do registro do vinculo.
              instaladoEm: new Date(), retiradaPrevista: proximaData } });
          }
        }
        return producao;
      });
      res.status(201).json({ id: novo.id, mensagem: "Producao registrada." });
    } catch (erro) { responderErro(res, erro); }
  });

  router.get("/equipamentos", proteger("terceirizacao.equipamentos.visualizar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const equipamentos = await prisma.terceirizacaoEquipamento.findMany({ where: { organizacaoId: u.organizacaoId },
        orderBy: [{ tipo: "asc" }, { codigo: "asc" }],
        select: { id: true, codigo: true, tipo: true, ativo: true,
          usos: { where: { descarregadoEm: null }, orderBy: { id: "desc" }, take: 1,
            select: { id: true, retiradaPrevista: true, retiradoEm: true, exame: { select: { producao: { select: {
              nomePacienteDigitado: true, dataRealizacao: true, clinica: { select: { nome: true } } } } } } },
          },
        },
      });
      res.json({ equipamentos });
    } catch (erro) { responderErro(res, erro); }
  });

  router.post("/equipamentos", proteger("terceirizacao.equipamentos.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const codigo = String(req.body?.codigo ?? "").trim().toUpperCase();
      const tipo = String(req.body?.tipo ?? "").trim();
      if (!/^[A-Z0-9][A-Z0-9 ._/-]{1,29}$/.test(codigo)) return invalido("Codigo invalido (2 a 30 caracteres).");
      if (tipo !== "MAPA" && tipo !== "HOLTER") return invalido("Nesta etapa cadastre somente MAPA ou HOLTER.");
      const existente = await prisma.terceirizacaoEquipamento.findUnique({ where: { organizacaoId_codigo: { organizacaoId: u.organizacaoId, codigo } }, select: { id: true } });
      if (existente) throw new ErroV3(409, "Ja existe aparelho com esse codigo.");
      const equipamento = await prisma.terceirizacaoEquipamento.create({ data: { organizacaoId: u.organizacaoId, codigo, tipo }, select: { id: true } });
      res.status(201).json({ id: equipamento.id });
    } catch (erro) { responderErro(res, erro); }
  });

  router.patch("/usos/:id/retirada", proteger("terceirizacao.equipamentos.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const id = numero(req.params.id);
      if (!id) return invalido("Identificador invalido.");
      const uso = await prisma.terceirizacaoUsoEquipamento.findFirst({ where: { id, equipamento: { organizacaoId: u.organizacaoId } }, select: { id: true } });
      if (!uso) throw new ErroV3(404, "Utilizacao nao encontrada.");
      const atualizacao = await prisma.terceirizacaoUsoEquipamento.updateMany({ where: { id, retiradoEm: null }, data: { retiradoEm: new Date(), retiradoPorId: u.id } });
      if (atualizacao.count !== 1) throw new ErroV3(409, "Retirada ja registrada.");
      res.json({ mensagem: "Retirada registrada." });
    } catch (erro) { responderErro(res, erro); }
  });

  router.patch("/usos/:id/descarregamento", proteger("terceirizacao.equipamentos.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const id = numero(req.params.id);
      if (!id) return invalido("Identificador invalido.");
      const uso = await prisma.terceirizacaoUsoEquipamento.findFirst({ where: { id, equipamento: { organizacaoId: u.organizacaoId } }, select: { id: true } });
      if (!uso) throw new ErroV3(404, "Utilizacao nao encontrada.");
      const atualizado = await prisma.terceirizacaoUsoEquipamento.updateMany({ where: { id, retiradoEm: { not: null }, descarregadoEm: null }, data: { descarregadoEm: new Date() } });
      if (atualizado.count !== 1) throw new ErroV3(409, "Registre a retirada antes do descarregamento, ou esta etapa ja foi concluida.");
      res.json({ mensagem: "Descarregamento confirmado. Aparelho liberado." });
    } catch (erro) { responderErro(res, erro); }
  });

  // Busca exclusiva da V3. A competencia pesquisada e sempre o mes corrente;
  // historico de outros meses pertence ao modulo de Relatorios.
  router.get("/busca-global", proteger("terceirizacao.visualizar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const termo = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
      if (termo.length < 2) return res.json({ resultados: [] });
      const agora = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
      const partes = Object.fromEntries(agora.map((p) => [p.type, p.value]));
      const ano = Number(partes.year), mes = Number(partes.month);
      const inicio = new Date(Date.UTC(ano, mes - 1, 1));
      const fim = new Date(Date.UTC(ano, mes, 1));
      const buscaNome = { contains: termo, mode: "insensitive" as const };
      const resultados: { tipo: string; id: number; titulo: string; subtitulo: string; href: string }[] = [];
      const podeProducao = podeAcessar(req, "terceirizacao.producao.visualizar");
      const podeLaudos = podeAcessar(req, "terceirizacao.laudos.visualizar");
      const podeEquipamentos = podeAcessar(req, "terceirizacao.equipamentos.visualizar");
      const podeClinicas = podeAcessar(req, "terceirizacao.configuracoes.visualizar");
      const modalidade = MODALIDADES.find((tipo) => tipo === termo.toUpperCase());

      if (podeProducao || podeLaudos) {
        const exames = await prisma.terceirizacaoExame.findMany({
          where: {
            status: { not: "CANCELADO" },
            producao: { organizacaoId: u.organizacaoId, dataRealizacao: { gte: inicio, lt: fim } },
            OR: [
              { codigoInterno: buscaNome },
              { producao: { nomePacienteDigitado: buscaNome } },
              { producao: { clinica: { nome: buscaNome } } },
              ...(modalidade ? [{ tipoExame: modalidade }] : []),
            ],
          },
          take: 10,
          orderBy: [{ producao: { dataRealizacao: "desc" } }, { id: "desc" }],
          select: { id: true, codigoInterno: true, tipoExame: true, status: true,
            producao: { select: { nomePacienteDigitado: true, dataRealizacao: true, clinica: { select: { nome: true } } } } },
        });
        for (const e of exames) {
          const destino = podeLaudos ? "/terceirizacao/laudos" : "/terceirizacao/producao";
          resultados.push({ tipo: "EXAME_V3", id: e.id,
            titulo: `${e.tipoExame} · ${e.producao.nomePacienteDigitado}`,
            subtitulo: `${e.producao.clinica.nome} · ${e.codigoInterno} · ${e.producao.dataRealizacao.toISOString().slice(0, 10)} · ${e.status}`,
            href: `${destino}?busca=${encodeURIComponent(e.codigoInterno)}`,
          });
        }
      }
      if (podeProducao) {
        const producoes = await prisma.terceirizacaoProducao.findMany({
          where: { organizacaoId: u.organizacaoId, dataRealizacao: { gte: inicio, lt: fim }, nomePacienteDigitado: buscaNome },
          take: 6,
          orderBy: [{ dataRealizacao: "desc" }, { id: "desc" }],
          select: { id: true, nomePacienteDigitado: true, dataRealizacao: true, clinica: { select: { nome: true } } },
        });
        for (const p of producoes) resultados.push({ tipo: "PACIENTE_V3", id: p.id,
          titulo: p.nomePacienteDigitado,
          subtitulo: `Producao ${p.dataRealizacao.toISOString().slice(0, 10)} · ${p.clinica.nome}`,
          href: `/terceirizacao/producao?busca=${encodeURIComponent(p.nomePacienteDigitado)}`,
        });
      }
      if (podeEquipamentos) {
        const equipamentos = await prisma.terceirizacaoEquipamento.findMany({
          where: { organizacaoId: u.organizacaoId, codigo: buscaNome },
          take: 6, orderBy: { codigo: "asc" },
          select: { id: true, codigo: true, tipo: true, ativo: true },
        });
        for (const e of equipamentos) resultados.push({ tipo: "APARELHO_V3", id: e.id, titulo: e.codigo,
          subtitulo: `${e.tipo} · ${e.ativo ? "Ativo" : "Inativo"}`,
          href: `/terceirizacao/equipamentos?busca=${encodeURIComponent(e.codigo)}`,
        });
      }
      if (podeClinicas || podeProducao) {
        const clinicas = await prisma.clinica.findMany({
          where: { ativo: true, parceriaTerceirizacao: true, nome: buscaNome },
          take: 6, orderBy: { nome: "asc" }, select: { id: true, nome: true },
        });
        for (const c of clinicas) resultados.push({ tipo: "CLINICA_V3", id: c.id, titulo: c.nome,
          subtitulo: "Clinica parceira de terceirizacao",
          href: podeProducao ? `/terceirizacao/producao?busca=${encodeURIComponent(c.nome)}` : "/terceirizacao/configuracoes/clinicas",
        });
      }
      res.json({ resultados: resultados.slice(0, 24) });
    } catch (erro) { responderErro(res, erro); }
  });

  // Notificacoes V3 nao incluem guias, orcamentos, pagamentos ou pendencias V1.
  // O badge representa pendencias atuais, nao mensagens lidas/nao lidas.
  router.get("/notificacoes", proteger("terceirizacao.visualizar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const notificacoes: { id: string; titulo: string; descricao: string; href: string; prioridade: "ALTA" | "MEDIA" | "BAIXA" }[] = [];
      const agora = new Date();
      const partesData = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(agora);
      const civil = Object.fromEntries(partesData.map((p) => [p.type, p.value]));
      const hoje = `${civil.year}-${civil.month}-${civil.day}`;

      if (podeAcessar(req, "terceirizacao.equipamentos.visualizar")) {
        const usos = await prisma.terceirizacaoUsoEquipamento.findMany({
          where: { descarregadoEm: null, equipamento: { organizacaoId: u.organizacaoId, ativo: true } },
          take: 40, orderBy: [{ retiradaPrevista: "asc" }, { id: "asc" }],
          select: { id: true, retiradaPrevista: true, retiradoEm: true,
            equipamento: { select: { codigo: true, tipo: true } },
            exame: { select: { producao: { select: { nomePacienteDigitado: true } } } },
          },
        });
        for (const uso of usos) {
          const vencida = !uso.retiradoEm && !!uso.retiradaPrevista && uso.retiradaPrevista.toISOString().slice(0, 10) <= hoje;
          if (!uso.retiradoEm && !vencida) continue;
          notificacoes.push({ id: `equip-${uso.id}`,
            titulo: uso.retiradoEm ? "Descarregamento pendente" : "Retirada pendente",
            descricao: `${uso.equipamento.tipo} ${uso.equipamento.codigo} · ${uso.exame.producao.nomePacienteDigitado}`,
            href: `/terceirizacao/equipamentos?busca=${encodeURIComponent(uso.equipamento.codigo)}`,
            prioridade: vencida ? "ALTA" : "MEDIA",
          });
        }
      }
      if (podeAcessar(req, "terceirizacao.laudos.visualizar")) {
        const exames = await prisma.terceirizacaoExame.findMany({
          where: { status: { in: ["REALIZADO", "ENVIADO_LAUDO", "LAUDO_RECEBIDO"] },
            producao: { organizacaoId: u.organizacaoId } },
          take: 20,
          orderBy: [{ producao: { dataRealizacao: "asc" } }, { id: "asc" }],
          select: { id: true, status: true, codigoInterno: true, tipoExame: true,
            producao: { select: { nomePacienteDigitado: true, dataRealizacao: true } } },
        });
        for (const e of exames) {
          const titulo = e.status === "REALIZADO" ? "Exame aguardando envio" :
            e.status === "ENVIADO_LAUDO" ? "Laudo aguardando retorno" : "Laudo aguardando entrega";
          notificacoes.push({ id: `laudo-${e.id}`, titulo,
            descricao: `${e.tipoExame} · ${e.producao.nomePacienteDigitado} · ${e.codigoInterno}`,
            href: `/terceirizacao/laudos?mes=${e.producao.dataRealizacao.toISOString().slice(0,7)}&busca=${encodeURIComponent(e.codigoInterno)}`,
            prioridade: "MEDIA",
          });
        }
      }
      if (podeAcessar(req, "terceirizacao.financeiro.visualizar")) {
        const resumo = await resumoFinanceiroV3(prisma, u.organizacaoId);
        const moeda = (valor: string) => Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        if (resumo.parcelasVencidas > 0) notificacoes.push({ id: "financeiro-v3-vencidas",
          titulo: "Parcelas vencidas", descricao: `${resumo.parcelasVencidas} parcela(s) · ${moeda(resumo.saldoVencido)} em atraso`,
          href: "/terceirizacao/financeiro", prioridade: "ALTA" });
        if (resumo.parcelasHoje > 0) notificacoes.push({ id: "financeiro-v3-hoje",
          titulo: "Parcelas vencem hoje", descricao: `${resumo.parcelasHoje} parcela(s) · ${moeda(resumo.saldoHoje)} a receber`,
          href: "/terceirizacao/financeiro", prioridade: "ALTA" });
        if (resumo.pendenciasMes > 0) notificacoes.push({ id: "financeiro-v3-sem-titulo",
          titulo: "Exames enviados sem título", descricao: `${resumo.pendenciasMes} exame(s) da competência atual aguardam regularização financeira`,
          href: "/terceirizacao/financeiro", prioridade: "ALTA" });
      }
      notificacoes.sort((a, b) => (a.prioridade === "ALTA" ? -1 : 0) - (b.prioridade === "ALTA" ? -1 : 0));
      res.json({ notificacoes: notificacoes.slice(0, 24), totalExibido: Math.min(notificacoes.length, 24) });
    } catch (erro) { responderErro(res, erro); }
  });

  // Painel operacional V3: estatisticas por exame, nao por lancamento.
  // Mantem escopo da organizacao logada e nao consulta o financeiro da V1.
  router.get("/dashboard", proteger("terceirizacao.visualizar"), async (req, res) => {
    try {
      const usuario = usuarioDaRequisicao(req);
      // O Dashboard sempre corresponde a competencia corrente.
      // Consultas a outros meses ficam exclusivamente no modulo Relatorios.
      const { mes, inicio, fim, hoje } = competenciaV3Agora();

      const [exames, usos] = await Promise.all([
        prisma.terceirizacaoExame.findMany({
          where: { producao: { organizacaoId: usuario.organizacaoId, dataRealizacao: { gte: inicio, lt: fim } } },
          select: { tipoExame: true, status: true,
            producao: { select: { clinicaId: true, clinica: { select: { nome: true } } } },
          },
        }),
        prisma.terceirizacaoUsoEquipamento.findMany({
          where: { descarregadoEm: null, equipamento: { organizacaoId: usuario.organizacaoId, ativo: true },
            exame: { producao: { organizacaoId: usuario.organizacaoId, dataRealizacao: { gte: inicio, lt: fim } } } },
          select: { id: true, retiradoEm: true, retiradaPrevista: true,
            equipamento: { select: { codigo: true, tipo: true } },
            exame: { select: { producao: { select: {
              nomePacienteDigitado: true, clinica: { select: { nome: true } },
            } } } },
          },
        }),
      ]);

      const porModalidade = new Map<string, number>();
      const porClinica = new Map<number, { clinica: string; quantidade: number }>();
      let examesRealizados = 0;
      let aguardandoEnvio = 0;
      let aguardandoLaudo = 0;
      for (const exame of exames) {
        if (exame.status === "CANCELADO") continue;
        examesRealizados++;
        if (exame.status === "REALIZADO") aguardandoEnvio++;
        if (exame.status === "ENVIADO_LAUDO") aguardandoLaudo++;
        porModalidade.set(exame.tipoExame, (porModalidade.get(exame.tipoExame) || 0) + 1);
        const clinica = porClinica.get(exame.producao.clinicaId) || {
          clinica: exame.producao.clinica.nome, quantidade: 0,
        };
        clinica.quantidade++;
        porClinica.set(exame.producao.clinicaId, clinica);
      }

      const retiradasPendentes = usos.filter((uso) =>
        !uso.retiradoEm && uso.retiradaPrevista &&
        uso.retiradaPrevista.toISOString().slice(0, 10) <= hoje
      ).length;
      const retiradas = [...usos]
        .sort((a, b) => (a.retiradaPrevista?.getTime() ?? Infinity) - (b.retiradaPrevista?.getTime() ?? Infinity))
        .slice(0, 8)
        .map((uso) => ({
          id: uso.id,
          aparelho: uso.equipamento.codigo,
          tipo: uso.equipamento.tipo,
          paciente: uso.exame.producao.nomePacienteDigitado,
          clinica: uso.exame.producao.clinica.nome,
          retiradaPrevista: uso.retiradaPrevista,
          situacao: uso.retiradoEm ? "AGUARDANDO_DESCARREGAMENTO" :
            uso.retiradaPrevista && uso.retiradaPrevista.toISOString().slice(0, 10) <= hoje
              ? "RETIRADA_PENDENTE" : "EM_USO",
        }));

      res.json({
        competencia: mes,
        indicadores: {
          examesRealizados,
          aguardandoEnvio,
          aguardandoLaudo,
          aparelhosEmUso: usos.filter((uso) => !uso.retiradoEm).length,
          aguardandoDescarregamento: usos.filter((uso) => !!uso.retiradoEm).length,
          retiradasPendentes,
        },
        porModalidade: [...porModalidade.entries()]
          .map(([tipo, quantidade]) => ({ tipo, quantidade }))
          .sort((a, b) => b.quantidade - a.quantidade),
        porClinica: [...porClinica.values()].sort((a, b) => b.quantidade - a.quantidade),
        retiradas,
      });
    } catch (erro) { responderErro(res, erro); }
  });

  // Consulta historica EXCLUSIVA do modulo Relatorios. Nao modifica dados.
  // A competencia sempre e a dataRealizacao original, mesmo com laudo posterior.
  router.get("/relatorios", proteger("terceirizacao.relatorios.visualizar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const mesParametro = req.query.mes;
      const mes = typeof mesParametro === "string" && mesParametro.length ? mesParametro : competenciaV3Agora().mes;
      const { inicio, fim } = intervaloMesV3(mes);
      const paginaValor = Number(req.query.pagina ?? 1);
      if (!Number.isSafeInteger(paginaValor) || paginaValor < 1 || paginaValor > 100000) {
        return res.status(400).json({ erro: "Pagina invalida." });
      }
      const tipo = typeof req.query.tipo === "string" ? req.query.tipo : "";
      if (tipo && !MODALIDADES.includes(tipo as Modalidade)) {
        return res.status(400).json({ erro: "Modalidade invalida." });
      }
      const status = typeof req.query.status === "string" ? req.query.status : "";
      const statuses = ["REALIZADO", "ENVIADO_LAUDO", "LAUDO_RECEBIDO", "ENTREGUE", "CANCELADO"] as const;
      if (status && !statuses.includes(status as (typeof statuses)[number])) {
        return res.status(400).json({ erro: "Situacao invalida." });
      }
      const clinicaTexto = req.query.clinicaId;
      const clinicaId = clinicaTexto == null || clinicaTexto === "" ? null : numero(clinicaTexto);
      if (clinicaTexto != null && clinicaTexto !== "" && !clinicaId) {
        return res.status(400).json({ erro: "Clinica invalida." });
      }
      const periodo = { gte: inicio, lt: fim };
      const where = {
        producao: { organizacaoId: u.organizacaoId, dataRealizacao: periodo,
          ...(clinicaId ? { clinicaId } : {}) },
        ...(tipo ? { tipoExame: tipo as Modalidade } : {}),
        ...(status ? { status: status as (typeof statuses)[number] } : {}),
      };
      const tamanhoPagina = 80;
      const [total, exames, grupos, clinicas] = await Promise.all([
        prisma.terceirizacaoExame.count({ where }),
        prisma.terceirizacaoExame.findMany({
          where,
          orderBy: [{ producao: { dataRealizacao: "desc" } }, { id: "desc" }],
          skip: (paginaValor - 1) * tamanhoPagina, take: tamanhoPagina,
          select: {
            id: true, codigoInterno: true, tipoExame: true, status: true,
            laudoEnviadoEm: true, laudoRecebidoEm: true, laudoEntregueEm: true,
            producao: { select: { id: true, dataRealizacao: true, nomePacienteDigitado: true,
              clinica: { select: { id: true, nome: true } },
              unidadeClinica: { select: { nome: true } } } },
            usoEquipamento: { select: { equipamento: { select: { codigo: true } },
              retiradoEm: true, descarregadoEm: true } },
          },
        }),
        prisma.terceirizacaoExame.groupBy({ by: ["status"], where, _count: { _all: true } }),
        prisma.clinica.findMany({
          where: { terceirizacaoProducoes: { some: { organizacaoId: u.organizacaoId, dataRealizacao: periodo } } },
          select: { id: true, nome: true }, orderBy: { nome: "asc" },
        }),
      ]);
      res.json({ competencia: mes, pagina: paginaValor, tamanhoPagina,
        total, paginas: Math.max(1, Math.ceil(total / tamanhoPagina)),
        porStatus: grupos.map((g) => ({ status: g.status, quantidade: g._count._all })),
        clinicas, exames });
    } catch (erro) { responderErro(res, erro); }
  });



  // Relatorio por clinica: producao da competencia, saldo ATUAL dessa producao
  // e caixa liquido do mes (todas as competencias). Acesso financeiro obrigatorio.
  router.get("/relatorios/financeiro", proteger("terceirizacao.relatorios.visualizar"), async (req, res) => {
    try {
      if (!podeAcessar(req, "terceirizacao.financeiro.visualizar")) {
        throw new ErroV3(403, "Sem permissao para consultar valores financeiros.");
      }
      const u = usuarioDaRequisicao(req);
      const mes = req.query.mes === undefined ? competenciaV3Agora().mes : req.query.mes;
      if (typeof mes !== "string") return invalido("Informe uma competencia unica.");
      const { inicio, fim } = intervaloMesV3(mes);
      const filtro = req.query.clinicaId;
      const clinicaId = filtro === undefined || filtro === "" ? null :
        typeof filtro === "string" ? numero(filtro) : null;
      if (filtro !== undefined && filtro !== "" && clinicaId === null) return invalido("Clinica invalida.");
      const hoje = dataCivil(competenciaV3Agora().hoje);
      type Linha = { clinicaId: number; clinica: string; exames: number; semTitulo: number;
        produzido: string; recebidoProducao: string; saldoProducao: string; vencidoProducao: string; recebidoMes: string };
      const linhas = await prisma.$queryRaw<Linha[]>`
        WITH escopo AS (
          SELECT pr."id", pr."clinicaId", pr."dataRealizacao"
          FROM "TerceirizacaoProducao" pr
          WHERE pr."organizacaoId" = ${u.organizacaoId}
            AND (${clinicaId}::int IS NULL OR pr."clinicaId" = ${clinicaId}::int)
        ), titulos_rel AS (
          SELECT t."id", t."exameId", t."valorDevido", pr."clinicaId", pr."dataRealizacao"
          FROM "TituloFinanceiroV3" t
          JOIN "TerceirizacaoExame" e ON e."id" = t."exameId"
          JOIN escopo pr ON pr."id" = e."producaoId"
          WHERE t."organizacaoId" = ${u.organizacaoId} AND t."natureza" = 'A_RECEBER' AND t."canceladoEm" IS NULL
        ), producao_mes AS (
          SELECT pr."clinicaId", COUNT(*) FILTER (WHERE e."status" <> 'CANCELADO')::int AS exames,
            COUNT(*) FILTER (WHERE e."status" IN ('ENVIADO_LAUDO','LAUDO_RECEBIDO','ENTREGUE') AND t."id" IS NULL)::int AS sem_titulo
          FROM escopo pr JOIN "TerceirizacaoExame" e ON e."producaoId" = pr."id"
          LEFT JOIN titulos_rel t ON t."exameId" = e."id"
          WHERE pr."dataRealizacao" >= ${inicio}::date AND pr."dataRealizacao" < ${fim}::date
          GROUP BY pr."clinicaId"
        ), valores_mes AS (
          SELECT t."clinicaId", SUM(t."valorDevido") AS produzido FROM titulos_rel t
          WHERE t."dataRealizacao" >= ${inicio}::date AND t."dataRealizacao" < ${fim}::date GROUP BY t."clinicaId"
        ), parcelas_rel AS (
          SELECT p."id", p."valorPrevisto", p."vencimento", t."clinicaId", t."dataRealizacao"
          FROM "ParcelaFinanceiraV3" p JOIN titulos_rel t ON t."id" = p."tituloId" WHERE p."canceladaEm" IS NULL
        ), baixas_rel AS (
          SELECT b."parcelaId", SUM(b."valor") AS pago,
            SUM(b."valor") FILTER (WHERE b."dataEfetiva" >= ${inicio}::date AND b."dataEfetiva" < ${fim}::date) AS caixa_mes
          FROM "BaixaFinanceiraV3" b JOIN parcelas_rel p ON p."id" = b."parcelaId"
          WHERE b."estornadoEm" IS NULL GROUP BY b."parcelaId"
        ), saldos_rel AS (
          SELECT p.*, COALESCE(b.pago, 0) AS pago, COALESCE(b.caixa_mes, 0) AS caixa_mes,
            GREATEST(p."valorPrevisto" - COALESCE(b.pago, 0), 0) AS saldo
          FROM parcelas_rel p LEFT JOIN baixas_rel b ON b."parcelaId" = p."id"
        ), carteira_mes AS (
          SELECT s."clinicaId", SUM(s.pago) AS recebido, SUM(s.saldo) AS saldo,
            SUM(s.saldo) FILTER (WHERE s."vencimento" < ${hoje}::date) AS vencido
          FROM saldos_rel s WHERE s."dataRealizacao" >= ${inicio}::date AND s."dataRealizacao" < ${fim}::date
          GROUP BY s."clinicaId"
        ), caixa_mes AS (
          SELECT s."clinicaId", SUM(s.caixa_mes) AS recebido FROM saldos_rel s
          GROUP BY s."clinicaId" HAVING SUM(s.caixa_mes) <> 0
        ), chaves AS (
          SELECT "clinicaId" FROM producao_mes UNION SELECT "clinicaId" FROM valores_mes UNION SELECT "clinicaId" FROM caixa_mes
        )
        SELECT c."id" AS "clinicaId", c."nome" AS clinica,
          COALESCE(pm.exames,0)::int AS exames, COALESCE(pm.sem_titulo,0)::int AS "semTitulo",
          COALESCE(vm.produzido,0)::text AS produzido, COALESCE(cm.recebido,0)::text AS "recebidoProducao",
          COALESCE(cm.saldo,0)::text AS "saldoProducao", COALESCE(cm.vencido,0)::text AS "vencidoProducao",
          COALESCE(cx.recebido,0)::text AS "recebidoMes"
        FROM chaves k JOIN "Clinica" c ON c."id" = k."clinicaId"
        LEFT JOIN producao_mes pm ON pm."clinicaId" = k."clinicaId"
        LEFT JOIN valores_mes vm ON vm."clinicaId" = k."clinicaId"
        LEFT JOIN carteira_mes cm ON cm."clinicaId" = k."clinicaId"
        LEFT JOIN caixa_mes cx ON cx."clinicaId" = k."clinicaId"
        ORDER BY c."nome", c."id"
      `;
      const campos = ["produzido", "recebidoProducao", "saldoProducao", "vencidoProducao", "recebidoMes"] as const;
      // Agregacao decimal exata, inclusive quando a soma ultrapassa o limite de um titulo.
      const total = { exames: 0, semTitulo: 0, produzido: "0.00", recebidoProducao: "0.00", saldoProducao: "0.00", vencidoProducao: "0.00", recebidoMes: "0.00" };
      for (const linha of linhas) { total.exames += linha.exames; total.semTitulo += linha.semTitulo; }
      for (const campo of campos) {
        const soma = linhas.reduce((s, linha) => {
          const [inteiro, frac = ""] = linha[campo].split(".");
          return s + BigInt(inteiro) * 100n + BigInt(frac.padEnd(2, "0"));
        }, 0n);
        total[campo] = dinheiroV3(soma);
      }
      res.json({ competencia: mes, total, linhas });
    } catch (erro) { responderErro(res, erro); }
  });

  // Parametros de laudos configurados por clinica e modalidade. Nunca reutilizar
  // regras de precificacao, agendamento ou vencimento da V1.
  async function retornarParametrosLaudos(req: Request, res: Response) {
    try {
      const u = usuarioDaRequisicao(req);
      const [clinicas, configuracoes] = await Promise.all([
        prisma.clinica.findMany({ where: { ativo: true, parceriaTerceirizacao: true },
          select: { id: true, nome: true, unidades: { where: { ativo: true }, select: { id: true, nome: true } } }, orderBy: { nome: "asc" } }),
        prisma.configuracaoLaudoV3.findMany({ where: { organizacaoId: u.organizacaoId },
          select: { id: true, clinicaId: true, tipoExame: true, prazoDias: true, marcoPrazo: true,
            convenios: true, formasPagamento: true, diasVencimento: true },
          orderBy: [{ clinicaId: "asc" }, { tipoExame: "asc" }] }),
      ]);
      res.json({ clinicas, configuracoes, modalidades: MODALIDADES });
    } catch (erro) { responderErro(res, erro); }
  }
  router.get("/laudos/parametros", proteger("terceirizacao.laudos.visualizar"), retornarParametrosLaudos);
  router.get("/configuracoes-laudos", proteger("terceirizacao.configuracoes.visualizar"), retornarParametrosLaudos);
  router.put("/configuracoes-laudos", proteger("terceirizacao.configuracoes.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const clinicaId = numero(req.body?.clinicaId);
      const tipoExame = String(req.body?.tipoExame ?? "");
      const prazoDias = Number(req.body?.prazoDias);
      const diasVencimento = Number(req.body?.diasVencimento);
      const marcoPrazo = String(req.body?.marcoPrazo ?? "");
      if (!clinicaId || !MODALIDADES.includes(tipoExame as Modalidade)) return invalido("Clinica e modalidade sao obrigatorias.");
      if (!Number.isInteger(prazoDias) || prazoDias < 0 || prazoDias > 180) return invalido("Prazo deve estar entre 0 e 180 dias corridos.");
      if (!Number.isInteger(diasVencimento) || diasVencimento < 0 || diasVencimento > 365) return invalido("Prazo de vencimento deve estar entre 0 e 365 dias.");
      if (marcoPrazo !== "REALIZACAO" && marcoPrazo !== "ENVIO") return invalido("Escolha o marco inicial do prazo.");
      const convenios = textosConfiguradosV3(req.body?.convenios, "Convenios");
      const formasPagamento = textosConfiguradosV3(req.body?.formasPagamento, "Formas de pagamento");
      if (formasPagamento.length === 0) return invalido("Cadastre ao menos uma forma de pagamento autorizada.");
      const clinica = await prisma.clinica.findFirst({ where: { id: clinicaId, ativo: true, parceriaTerceirizacao: true }, select: { id: true } });
      if (!clinica) throw new ErroV3(404, "Clinica nao habilitada na V3.");
      const configuracao = await prisma.configuracaoLaudoV3.upsert({
        where: { organizacaoId_clinicaId_tipoExame: { organizacaoId: u.organizacaoId, clinicaId, tipoExame: tipoExame as Modalidade } },
        create: { organizacaoId: u.organizacaoId, clinicaId, tipoExame: tipoExame as Modalidade, prazoDias,
          marcoPrazo: marcoPrazo as "REALIZACAO" | "ENVIO", convenios, formasPagamento, diasVencimento },
        update: { prazoDias, marcoPrazo: marcoPrazo as "REALIZACAO" | "ENVIO", convenios, formasPagamento, diasVencimento },
      });
      res.json({ configuracao, mensagem: "Parametros atualizados. Laudos e titulos historicos nao foram alterados." });
    } catch (erro) { responderErro(res, erro); }
  });

  // Prazos e pendencias de TODAS as competencias. Acoes continuam na rota
  // de laudos do mes correspondente; status entregue/cancelado nao entra.
  router.get("/laudos/prazos", proteger("terceirizacao.laudos.visualizar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const hoje = competenciaV3Agora().hoje;
      const pendencias = await prisma.terceirizacaoExame.findMany({
        where: {
          status: { in: ["REALIZADO", "ENVIADO_LAUDO", "LAUDO_RECEBIDO"] },
          producao: { organizacaoId: u.organizacaoId },
        },
        orderBy: [{ producao: { dataRealizacao: "asc" } }, { id: "asc" }],
        take: 1001,
        select: {
          id: true, codigoInterno: true, tipoExame: true, status: true,
          laudoPrevisaoEntrega: true,
          producao: { select: { nomePacienteDigitado: true, dataRealizacao: true,
            clinica: { select: { nome: true } },
            unidadeClinica: { select: { nome: true } },
          } },
        },
      });
      const limiteAtingido = pendencias.length > 1000;
      const itens = pendencias.slice(0, 1000).map((e) => {
        const previsao = e.laudoPrevisaoEntrega?.toISOString().slice(0, 10) ?? null;
        const classificacao = classificarPrazoLaudoV3(e.status, previsao, hoje);
        return {
          id: e.id, codigoInterno: e.codigoInterno, tipoExame: e.tipoExame,
          status: e.status, clinica: e.producao.clinica.nome,
          unidade: e.producao.unidadeClinica?.nome ?? null,
          paciente: e.producao.nomePacienteDigitado,
          dataRealizacao: e.producao.dataRealizacao.toISOString().slice(0, 10),
          previsao, ...classificacao,
        };
      });
      const contagem = (tipo: string) => itens.filter((e) => e.faixa === tipo).length;
      const prioridade: Record<string, number> = { ATRASADO: 0, HOJE: 1, PROXIMOS_3_DIAS: 2,
        SEM_PREVISAO: 3, AGUARDANDO_ENVIO: 4, NO_PRAZO: 5 };
      itens.sort((a, b) => (prioridade[a.faixa] ?? 99) - (prioridade[b.faixa] ?? 99) ||
        (a.previsao ?? "9999-12-31").localeCompare(b.previsao ?? "9999-12-31") || a.id - b.id);
      res.json({ hoje, itens, limiteAtingido, totais: {
        atraso: contagem("ATRASADO"), hoje: contagem("HOJE"), proximos3: contagem("PROXIMOS_3_DIAS"),
        semPrevisao: contagem("SEM_PREVISAO"), aguardandoEnvio: contagem("AGUARDANDO_ENVIO"),
        noPrazo: contagem("NO_PRAZO"),
      } });
    } catch (erro) { responderErro(res, erro); }
  });

  // V3 - fluxo de laudos. O recebimento e a entrega variam conforme a clinica;
  // a operacao registra o ocorrido sem transferir PDFs para o banco.
  router.get("/laudos", proteger("terceirizacao.laudos.visualizar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const mesSolicitado = typeof req.query.mes === "string" ? req.query.mes.trim() : "";
      const mes = mesSolicitado || competenciaV3Agora().mes;
      const { inicio, fim } = intervaloMesV3(mes);
      const exames = await prisma.terceirizacaoExame.findMany({
        where: { producao: { organizacaoId: u.organizacaoId, dataRealizacao: { gte: inicio, lt: fim } }, status: { not: "CANCELADO" } },
        orderBy: [{ producao: { dataRealizacao: "desc" } }, { id: "desc" }],
        take: 300,
        select: {
          id: true, codigoInterno: true, tipoExame: true, status: true, executadoPorId: true,
          laudoTelemedicina: true, laudoNascimento: true, laudoDocumento: true, laudoObservacoes: true,
          laudoEnviadoEm: true, laudoRecebidoEm: true, laudoEntregueEm: true,
          laudoMeioEntrega: true, laudoReferenciaEntrega: true,
          laudoPrevisaoOriginal: true, laudoPrevisaoEntrega: true, laudoUnidadeEntregaId: true,
          laudoUnidadeEntrega: { select: { id: true, nome: true } },
          laudoConvenio: true, laudoCategoriaAtendimento: true, laudoFormaPagamento: true,
          financeiroPendenciaV3: true,
          producao: { select: { id: true, nomePacienteDigitado: true, dataRealizacao: true, pacienteId: true,
            paciente: { select: { id: true, nome: true, cpf: true, dataNascimento: true } },
            clinica: { select: { id: true, nome: true } }, unidadeClinica: { select: { id: true, nome: true } } } },
          usoEquipamento: { select: { retiradoEm: true, descarregadoEm: true } },
          eventosLaudo: { orderBy: { id: "desc" }, take: 10,
            select: { id: true, acao: true, detalhes: true, ocorridoEm: true, usuario: { select: { nome: true } } } },
        },
      });
      res.json({ exames, competencia: mes });
    } catch (erro) { responderErro(res, erro); }
  });

  // Completa a identidade no cadastro unico Paciente (V1/V3), sem criar uma ficha paralela de laudo.
  router.get("/laudos/buscar-pacientes", proteger("terceirizacao.laudos.editar"), async (req, res) => {
    try {
      const busca = String(req.query.busca ?? "").trim().slice(0, 100);
      const digitos = busca.replace(/\D/g, "");
      if (busca.length < 3) return res.json({ pacientes: [] });
      const pacientes = await prisma.paciente.findMany({
        where: digitos.length === 11
          ? { OR: [{ nome: { contains: busca, mode: "insensitive" } }, { cpf: digitos }] }
          : { nome: { contains: busca, mode: "insensitive" } },
        select: { id: true, nome: true, cpf: true, dataNascimento: true },
        orderBy: { nome: "asc" }, take: 12,
      });
      return res.json({ pacientes });
    } catch (erro) { return responderErro(res, erro); }
  });

  router.patch("/laudos/:id/cadastro", proteger("terceirizacao.laudos.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const id = numero(req.params.id);
      if (!id) return invalido("Exame invalido.");
      const corpo = req.body ?? {};
      const nome = String(corpo.nome ?? "").trim().replace(/\s+/g, " ");
      const cpf = String(corpo.cpf ?? "").replace(/\D/g, "");
      const nascimento = corpo.dataNascimento ? dataCivil(corpo.dataNascimento) : null;
      const pacienteId = corpo.pacienteId ? numero(corpo.pacienteId) : null;
      const criarNovo = corpo.criarNovo === true;
      if (nome.length < 3 || nome.length > 160) return invalido("Informe o nome completo do paciente.");
      if (cpf) {
        if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return invalido("CPF invalido.");
        const digito = (ate: number) => {
          const soma = cpf.slice(0, ate).split("").reduce((s, c, i) => s + Number(c) * (ate + 1 - i), 0);
          const resto = (soma * 10) % 11;
          return resto === 10 ? 0 : resto;
        };
        if (digito(9) !== Number(cpf[9]) || digito(10) !== Number(cpf[10])) return invalido("CPF invalido.");
      }
      if (nascimento && nascimento > new Date()) return invalido("Nascimento nao pode ser uma data futura.");
      if (criarNovo === Boolean(pacienteId)) return invalido("Selecione paciente existente OU confirme novo cadastro.");
      if (criarNovo && corpo.identidadeConferida !== true) return invalido("Confirme que verificou possiveis cadastros existentes.");
      const exame = await prisma.terceirizacaoExame.findFirst({
        where: { id, producao: { organizacaoId: u.organizacaoId } },
        select: { executadoPorId: true, status: true, producaoId: true, producao: { select: { pacienteId: true } } },
      });
      if (!exame) throw new ErroV3(404, "Exame nao encontrado.");
      if (exame.status !== "REALIZADO") throw new ErroV3(409, "Cadastro deve ser confirmado antes do envio do laudo.");
      if (exame.executadoPorId !== u.id && !podeAcessar(req, "terceirizacao.configuracoes.editar")) {
        throw new ErroV3(403, "A preparacao cabe a executante ou a administracao.");
      }
      if (exame.producao.pacienteId && pacienteId !== exame.producao.pacienteId) {
        throw new ErroV3(409, "Esta producao ja esta vinculada a outro cadastro. Acione a administracao.");
      }
      await prisma.$transaction(async (tx) => {
        let cadastroId: number;
        if (pacienteId) {
          const atual = await tx.paciente.findUnique({ where: { id: pacienteId }, select: { id: true, nome: true, cpf: true, dataNascimento: true } });
          if (!atual) throw new ErroV3(404, "Paciente selecionado nao encontrado.");
          if (cpf && atual.cpf && atual.cpf !== cpf) throw new ErroV3(409, "CPF diferente do cadastrado. Confira a identidade.");
          if (nascimento && atual.dataNascimento && atual.dataNascimento.getTime() !== nascimento.getTime()) {
            throw new ErroV3(409, "Nascimento diferente do cadastrado. Confira a identidade.");
          }
          if (cpf && !atual.cpf) {
            const donoCpf = await tx.paciente.findUnique({ where: { cpf }, select: { id: true } });
            if (donoCpf && donoCpf.id !== pacienteId) throw new ErroV3(409, "CPF existente em outro cadastro. Selecione o paciente correto.");
          }
          await tx.paciente.update({ where: { id: pacienteId }, data: {
            ...(cpf && !atual.cpf ? { cpf } : {}),
            ...(nascimento && !atual.dataNascimento ? { dataNascimento: nascimento } : {}),
          } });
          cadastroId = pacienteId;
        } else {
          if (cpf && await tx.paciente.findUnique({ where: { cpf }, select: { id: true } })) {
            throw new ErroV3(409, "CPF ja cadastrado. Pesquise e selecione o paciente existente.");
          }
          const nomesIguais = await tx.paciente.findMany({
            where: { nome: { equals: nome, mode: "insensitive" } },
            select: { id: true, dataNascimento: true }, take: 30,
          });
          if (nomesIguais.some((p) => !p.dataNascimento || !nascimento || p.dataNascimento.getTime() === nascimento.getTime())) {
            throw new ErroV3(409, "Ha cadastro com nome e identificacao possivelmente iguais. Pesquise antes de criar outro.");
          }
          const novo = await tx.paciente.create({ data: { nome, cpf: cpf || null, dataNascimento: nascimento, criadoPorId: u.id }, select: { id: true } });
          cadastroId = novo.id;
        }
        const vinculado = await tx.terceirizacaoProducao.updateMany({
          where: { id: exame.producaoId, organizacaoId: u.organizacaoId, OR: [{ pacienteId: null }, { pacienteId: cadastroId }] },
          data: { pacienteId: cadastroId, nomePacienteDigitado: nome },
        });
        if (vinculado.count !== 1) throw new ErroV3(409, "Identidade alterada simultaneamente. Atualize a tela.");
        await tx.terceirizacaoEventoLaudo.create({ data: {
          exameId: id, usuarioId: u.id, acao: "CADASTRO_CONFERIDO",
          detalhes: criarNovo ? "Cadastro do paciente criado e vinculado." : "Cadastro existente confirmado e vinculado.",
        } });
      });
      return res.json({ mensagem: "Cadastro do paciente confirmado e vinculado ao exame." });
    } catch (erro) { return responderErro(res, erro); }
  });

  // Estimativa para conferencia na tela, sem gerar titulo nem tocar na V1.
  router.get("/laudos/:id/valor-contratado", proteger("terceirizacao.laudos.visualizar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const id = numero(req.params.id);
      if (!id) return invalido("Exame invalido.");
      const convenio = String(req.query.convenio ?? "").trim().toUpperCase();
      const categoria = String(req.query.categoriaAtendimento ?? "").trim().toUpperCase();
      if (convenio.length > 120 || categoria.length > 120) return invalido("Convenio ou categoria muito extenso.");
      const exame = await prisma.terceirizacaoExame.findFirst({ where: {
        id, producao: { organizacaoId: u.organizacaoId }, status: "REALIZADO",
      }, select: { id: true, tipoExame: true,
        producao: { select: { clinicaId: true, dataRealizacao: true } } } });
      if (!exame) throw new ErroV3(404, "Exame nao encontrado ou ja enviado.");
      const candidatas = await prisma.regraFinanceiraV3.findMany({ where: {
        organizacaoId: u.organizacaoId, clinicaId: exame.producao.clinicaId, tipoExame: exame.tipoExame,
        ativo: true, convenio: { in: [...new Set([convenio, ""])] },
        categoriaAtendimento: { in: [...new Set([categoria, ""])] },
        inicioVigencia: { lte: exame.producao.dataRealizacao },
        OR: [{ fimVigencia: null }, { fimVigencia: { gte: exame.producao.dataRealizacao } }],
      } });
      const regra = escolherRegraV3(candidatas, convenio, categoria);
      if (!regra) return res.json({ calculavel: false, mensagem: "Nenhuma regra vigente: o envio criara pendencia financeira." });
      const base = regra.valorCobradoContratado?.toString() ?? null;
      const calculo = calcularValorV3(regra, base);
      if (!calculo) return res.json({ calculavel: false,
        mensagem: "Configure o valor cobrado contratual da regra percentual na tabela da clinica." });
      res.json({ calculavel: true, metodo: regra.metodo, convenioAplicado: regra.convenio,
        categoriaAplicada: regra.categoriaAtendimento, valorCobradoContratado: base,
        percentual: regra.percentual?.toString() ?? null, valorDevido: calculo.valorDevido,
        mensagem: "Valor calculado pela regra contratual vigente na data do exame." });
    } catch (erro) { responderErro(res, erro); }
  });

  // O envio para laudar e a criacao de titulo valido ocorrem numa transacao.
  // Ausencia de regra/base nao impede o cuidado clinico: gera pendencia explicita.
  router.patch("/laudos/:id/enviar", proteger("terceirizacao.laudos.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const id = numero(req.params.id);
      if (!id) return invalido("Exame invalido.");
      const corpo = req.body ?? {};
      const telemedicina = String(corpo.telemedicina ?? "").trim();
      const observacoes = String(corpo.observacoes ?? "").trim();
      const convenio = String(corpo.convenio ?? "").trim().toUpperCase();
      const categoriaAtendimento = String(corpo.categoriaAtendimento ?? "").trim().toUpperCase();
      const formaPagamento = String(corpo.formaPagamento ?? "").trim().toUpperCase();
      const quantidadeParcelas = corpo.quantidadeParcelas === undefined ? 1 : Number(corpo.quantidadeParcelas);
      if (!Number.isSafeInteger(quantidadeParcelas) || quantidadeParcelas < 1 || quantidadeParcelas > 12) {
        return invalido("Informe de 1 a 12 parcelas.");
      }
      if (quantidadeParcelas > 1 && !/FATURAMENTO|PARCELAD|BOLETO/.test(formaPagamento)) {
        return invalido("Parcelamento disponivel apenas para formas de pagamento faturadas ou parceladas.");
      }
      const motivoAjuste = String(corpo.motivoAjustePrevisao ?? "").trim();
      const unidadeEntregaId = corpo.unidadeEntregaId ? numero(corpo.unidadeEntregaId) : null;
      if (telemedicina.length < 2 || telemedicina.length > 100) return invalido("Informe a telemedicina.");
      if (observacoes.length > 800 || convenio.length > 120 || categoriaAtendimento.length > 120) return invalido("Campo demasiado extenso.");
      if (corpo.dadosConferidos !== true) return invalido("Confirme que enviou e conferiu os dados da telemedicina.");
      if (corpo.valorBaseReal !== undefined && corpo.valorBaseReal !== null && corpo.valorBaseReal !== "") {
        return invalido("Valor manual desativado: configure o preco na tabela financeira da clinica.");
      }
      const exame = await prisma.terceirizacaoExame.findFirst({
        where: { id, producao: { organizacaoId: u.organizacaoId } },
        select: { id: true, executadoPorId: true, tipoExame: true, status: true,
          producao: { select: { clinicaId: true, unidadeClinicaId: true, dataRealizacao: true, pacienteId: true,
            clinica: { select: { ativo: true, parceriaTerceirizacao: true } } } },
          usoEquipamento: { select: { descarregadoEm: true } } },
      });
      if (!exame) throw new ErroV3(404, "Exame nao encontrado.");
      if (exame.executadoPorId !== u.id && !podeAcessar(req, "terceirizacao.configuracoes.editar")) {
        throw new ErroV3(403, "O envio cabe a executante ou a administracao.");
      }
      if (exame.status !== "REALIZADO") throw new ErroV3(409, "Exame nao esta aguardando envio; nenhum titulo duplicado foi criado.");
      if (!exame.producao.pacienteId) throw new ErroV3(409, "Confirme o cadastro do paciente primeiro.");
      if (!exame.producao.clinica.ativo || !exame.producao.clinica.parceriaTerceirizacao) {
        throw new ErroV3(409, "Clinica nao habilitada para a terceirizacao.");
      }
      if ((exame.tipoExame === "MAPA" || exame.tipoExame === "HOLTER") && !exame.usoEquipamento?.descarregadoEm) {
        throw new ErroV3(409, "Confirme retirada e descarregamento do aparelho antes do envio.");
      }
      const config = await prisma.configuracaoLaudoV3.findUnique({ where: {
        organizacaoId_clinicaId_tipoExame: { organizacaoId: u.organizacaoId,
          clinicaId: exame.producao.clinicaId, tipoExame: exame.tipoExame },
      } });
      if (!config) throw new ErroV3(409, "Cadastre prazo, convenios e formas de pagamento em Configuracoes da V3 antes do envio.");
      if (config.convenios.length > 0 && !config.convenios.includes(convenio)) return invalido("Convenio nao autorizado para esta clinica/modalidade.");
      if (!config.formasPagamento.includes(formaPagamento)) return invalido("Forma de pagamento nao autorizada para esta clinica/modalidade.");
      if (unidadeEntregaId) {
        const unidade = await prisma.unidadeClinica.findFirst({ where: {
          id: unidadeEntregaId, clinicaId: exame.producao.clinicaId, ativo: true }, select: { id: true } });
        if (!unidade) return invalido("Unidade de entrega nao pertence a clinica de realizacao.");
      }
      const agora = new Date();
      const dataEnvio = dataCivil(competenciaV3Agora().hoje);
      const marco = config.marcoPrazo === "ENVIO" ? dataEnvio : exame.producao.dataRealizacao;
      const previsaoOriginal = somarDiasV3(marco, config.prazoDias);
      const previsaoEntrega = corpo.previsaoEntrega ? dataCivil(corpo.previsaoEntrega) : previsaoOriginal;
      if (previsaoEntrega < exame.producao.dataRealizacao) return invalido("Previsao nao pode anteceder a realizacao do exame.");
      if (previsaoEntrega.getTime() !== previsaoOriginal.getTime() && (motivoAjuste.length < 8 || motivoAjuste.length > 300)) {
        return invalido("Informe motivo de 8 a 300 caracteres para mudar a previsao.");
      }
      const vencimento = somarDiasV3(exame.producao.dataRealizacao, config.diasVencimento);
      const vencimentosEnviados = corpo.vencimentosParcelas;
      if (vencimentosEnviados !== undefined &&
          (!Array.isArray(vencimentosEnviados) || vencimentosEnviados.length !== quantidadeParcelas)) {
        return invalido("Vencimentos das parcelas nao correspondem a quantidade selecionada.");
      }
      const vencimentos = Array.from({ length: quantidadeParcelas }, (_, i) =>
        vencimentosEnviados ? dataCivil(vencimentosEnviados[i]) : somarMesesV3(vencimento, i));
      if (vencimentos.some((dia, i) => dia < exame.producao.dataRealizacao ||
          (i > 0 && dia <= vencimentos[i - 1]))) {
        return invalido("Os vencimentos devem ser posteriores a realizacao e estar em ordem crescente.");
      }
      const baseTexto = null;
      const resultado = await prisma.$transaction(async (tx) => {
        const alterado = await tx.terceirizacaoExame.updateMany({
          where: { id, status: "REALIZADO", producao: { organizacaoId: u.organizacaoId } },
          data: { status: "ENVIADO_LAUDO", laudoTelemedicina: telemedicina, laudoObservacoes: observacoes || null,
            laudoEnviadoEm: agora, laudoPrevisaoOriginal: previsaoOriginal, laudoPrevisaoEntrega: previsaoEntrega,
            laudoUnidadeEntregaId: unidadeEntregaId || exame.producao.unidadeClinicaId,
            laudoConvenio: convenio, laudoCategoriaAtendimento: categoriaAtendimento,
            laudoFormaPagamento: formaPagamento, laudoValorBaseReal: baseTexto,
          },
        });
        if (alterado.count !== 1) throw new ErroV3(409, "Exame alterado por outra pessoa. Atualize a tela.");
        await tx.terceirizacaoEventoLaudo.create({ data: { exameId: id, usuarioId: u.id, acao: "ENVIADO",
          detalhes: `Telemedicina: ${telemedicina}; previsao: ${previsaoEntrega.toISOString().slice(0, 10)}; ` +
            `unidade de entrega ID: ${unidadeEntregaId || exame.producao.unidadeClinicaId || "nao definida"}; ` +
            `convenio: ${convenio || "GERAL"}; forma: ${formaPagamento}; parcelas planejadas: ${quantidadeParcelas}.`,
        } });
        if (previsaoEntrega.getTime() !== previsaoOriginal.getTime()) {
          await tx.terceirizacaoEventoLaudo.create({ data: { exameId: id, usuarioId: u.id, acao: "PREVISAO_AJUSTADA",
            detalhes: `${previsaoOriginal.toISOString().slice(0, 10)} -> ${previsaoEntrega.toISOString().slice(0, 10)}. Motivo: ${motivoAjuste}` } });
        }
        const existente = await tx.tituloFinanceiroV3.findUnique({
          where: { exameId_natureza: { exameId: id, natureza: "A_RECEBER" } }, select: { id: true },
        });
        if (existente) {
          await tx.terceirizacaoExame.update({ where: { id }, data: { financeiroPendenciaV3: null } });
          return { tituloId: existente.id, pendencia: null as string | null };
        }
        const candidatas = await tx.regraFinanceiraV3.findMany({ where: {
          organizacaoId: u.organizacaoId, clinicaId: exame.producao.clinicaId, tipoExame: exame.tipoExame,
          convenio: { in: [...new Set([convenio, ""])] },
          categoriaAtendimento: { in: [...new Set([categoriaAtendimento, ""])] }, ativo: true,
          inicioVigencia: { lte: exame.producao.dataRealizacao },
          OR: [{ fimVigencia: null }, { fimVigencia: { gte: exame.producao.dataRealizacao } }],
        } });
        const regra = escolherRegraV3(candidatas, convenio, categoriaAtendimento);
        let pendencia: string | null = null;
        if (!regra) pendencia = "Sem regra financeira vigente para clinica, exame, convenio e categoria.";
        const baseContratual = regra?.valorCobradoContratado?.toString() ?? null;
        const calculo = regra ? calcularValorV3(regra, baseContratual) : null;
        if (regra && !calculo) pendencia = "Regra percentual sem valor cobrado contratual configurado (ou repasse menor que R$ 0,01).";
        if (pendencia || !regra || !calculo) {
          await tx.terceirizacaoExame.update({ where: { id }, data: { financeiroPendenciaV3: pendencia } });
          return { tituloId: null as number | null, pendencia };
        }
        // Dividir o REPASSE da Digna, nunca o valor cobrado do paciente.
        // Centavos distribuidos sem arredondamento acumulado: ultima parcela recebe o resto.
        const repasseCentavos = centavosV3(calculo.valorDevido);
        if (!repasseCentavos || repasseCentavos < BigInt(quantidadeParcelas)) {
          throw new ErroV3(409, "Repasse inferior a quantidade de parcelas solicitadas.");
        }
        const parcelaBase = repasseCentavos / BigInt(quantidadeParcelas);
        const resto = repasseCentavos % BigInt(quantidadeParcelas);
        const parcelasPrevistas = vencimentos.map((dia, i) => ({
          numero: i + 1, vencimento: dia,
          valorPrevisto: dinheiroV3(parcelaBase + (i === quantidadeParcelas - 1 ? resto : 0n)),
        }));
        const titulo = await tx.tituloFinanceiroV3.create({ data: {
          organizacaoId: u.organizacaoId, clinicaId: exame.producao.clinicaId, exameId: id,
          regraId: regra.id, natureza: "A_RECEBER", convenio, categoriaAtendimento,
          formaPagamentoOrigem: formaPagamento, valorBaseReferencia: calculo.baseReal,
          percentualAplicado: regra.metodo === "PERCENTUAL" ? regra.percentual : null,
          valorDevido: calculo.valorDevido, dataCompetencia: exame.producao.dataRealizacao, criadoPorId: u.id,
          parcelas: { create: parcelasPrevistas },
        }, select: { id: true } });
        await tx.terceirizacaoExame.update({ where: { id }, data: { financeiroPendenciaV3: null } });
        return { tituloId: titulo.id, pendencia: null as string | null };
      });
      res.json({ mensagem: resultado.pendencia
        ? `Envio registrado. Pendencia financeira: ${resultado.pendencia}`
        : "Envio para laudo registrado e titulo financeiro criado automaticamente.", ...resultado,
        competencia: exame.producao.dataRealizacao.toISOString().slice(0, 7) });
    } catch (erro) {
      if (erro && typeof erro === "object" && "code" in erro && erro.code === "P2002") {
        return res.status(409).json({ erro: "Este exame ja possui titulo; atualize antes de reenviar." });
      }
      responderErro(res, erro);
    }
  });

  // Cancelamento conservador, transacional e auditado; SEM estorno automatico.
  // Casos com entrega/recebimento/equipamento pendente exigem regularizacao formal anterior.
  router.post("/laudos/:id/cancelar", proteger("terceirizacao.laudos.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req), id = numero(req.params.id);
      if (!id) return invalido("Exame invalido.");
      const admin = await prisma.usuario.findFirst({ where: { id: u.id, organizacaoId: u.organizacaoId,
        ativo: true, perfil: "ADMINISTRADOR" }, select: { id: true } });
      if (!admin) throw new ErroV3(403, "Somente administrador pode cancelar um exame V3.");
      const motivo = String(req.body?.motivo ?? "").trim();
      if (motivo.length < 10 || motivo.length > 1000) return invalido("Justificativa de 10 a 1000 caracteres obrigatoria.");
      const resultado = await prisma.$transaction(async tx => {
        // Serializa com fechamentos da equipe e trava exame e seus titulos.
        await tx.$queryRaw`SELECT "id" FROM "Organizacao" WHERE "id" = ${u.organizacaoId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "TerceirizacaoExame" WHERE "id" = ${id} FOR UPDATE`;
        // Bloquear titulos ANTES de carregar baixas evita validar um saldo antigo.
        await tx.$queryRaw`SELECT "id" FROM "TituloFinanceiroV3" WHERE "exameId" = ${id} ORDER BY "id" FOR UPDATE`;
        const exame = await tx.terceirizacaoExame.findFirst({ where: {
          id, producao: { organizacaoId: u.organizacaoId } },
          include: { usoEquipamento: true,
            titulosFinanceirosV3: { include: { parcelas: { include: { baixas: true } } } },
            itemBonificacaoV3: { include: { fechamento: { select: { situacao: true } } } },
          },
        });
        if (!exame) throw new ErroV3(404, "Exame nao encontrado.");
        if (exame.status === "CANCELADO") throw new ErroV3(409, "Exame ja cancelado.");
        if (exame.laudoEntregueEm || exame.status === "ENTREGUE") throw new ErroV3(409,
          "Laudo ja entregue: exige reversao administrativa especifica, nao cancelamento direto.");
        if (["ENVIADO_LAUDO", "LAUDO_RECEBIDO"].includes(exame.status) &&
            req.body?.confirmouCancelamentoExterno !== true)
          throw new ErroV3(409, "Confirme o cancelamento ou invalidacao na telemedicina externa antes de cancelar na Digna.");
        if (exame.usoEquipamento && !exame.usoEquipamento.descarregadoEm) throw new ErroV3(409,
          "Finalize retirada e descarregamento antes de cancelar o exame.");
        if (exame.itemBonificacaoV3 && exame.itemBonificacaoV3.fechamento.situacao !== "REABERTO")
          throw new ErroV3(409, "Bonificacao fechada/aprovada/paga: cancelamento bloqueado.");
        for (const t of exame.titulosFinanceirosV3) {
          if (t.parcelas.some(p => p.baixas.some(b => !b.estornadoEm))) throw new ErroV3(409,
            "Exame com recebimento ativo. Estorne formalmente antes de solicitar o cancelamento.");
        }
        const instante = new Date();
        for (const t of exame.titulosFinanceirosV3) {
          if (t.canceladoEm) continue;
          await tx.tituloFinanceiroV3.update({ where: { id: t.id }, data: { canceladoEm: instante, motivoCancelamento: motivo } });
          await tx.parcelaFinanceiraV3.updateMany({ where: { tituloId: t.id, canceladaEm: null }, data: { canceladaEm: instante } });
          await tx.auditoriaTituloV3.create({ data: { tituloId: t.id, usuarioId: u.id, motivo,
            dadosAnteriores: { canceladoEm: null, valor: t.valorDevido.toString(), parcelas: t.parcelas.length },
            dadosNovos: { canceladoEm: instante.toISOString(), exameCancelado: id } } });
        }
        const statusAnterior = exame.status;
        await tx.terceirizacaoExame.update({ where: { id }, data: { status: "CANCELADO", financeiroPendenciaV3: null } });
        await tx.terceirizacaoEventoLaudo.create({ data: { exameId: id, usuarioId: u.id,
          acao: "CANCELADO", detalhes: `Status anterior: ${statusAnterior}; ${motivo}` } });
        await tx.eventoBonificacaoV3.create({ data: { organizacaoId: u.organizacaoId,
          exameId: id, usuarioId: u.id, acao: "EXAME_CANCELADO", motivo,
          dados: { statusAnterior, titulosCancelados: exame.titulosFinanceirosV3.map(t => t.id) } } });
        return { id, status: "CANCELADO" };
      }, { timeout: 20000 });
      res.json({ mensagem: "Exame cancelado com historico. Nenhum recebimento foi apagado.", exame: resultado });
    } catch (erro) { responderErro(res, erro); }
  });

  // Reprogramacao de entrega depois de enviar, com auditoria da data/unidade anteriores.
  router.patch("/laudos/:id/previsao", proteger("terceirizacao.laudos.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const id = numero(req.params.id);
      if (!id) return invalido("Exame invalido.");
      const novaPrevisao = dataCivil(req.body?.previsaoEntrega);
      const unidadeEntregaId = req.body?.unidadeEntregaId ? numero(req.body.unidadeEntregaId) : null;
      const motivo = String(req.body?.motivo ?? "").trim();
      if (motivo.length < 8 || motivo.length > 300) return invalido("Informe motivo de 8 a 300 caracteres.");
      const exame = await prisma.terceirizacaoExame.findFirst({ where: {
        id, producao: { organizacaoId: u.organizacaoId }, status: { in: ["ENVIADO_LAUDO", "LAUDO_RECEBIDO"] },
      }, select: { id: true, laudoPrevisaoEntrega: true, laudoUnidadeEntregaId: true,
        producao: { select: { clinicaId: true, dataRealizacao: true } } } });
      if (!exame) throw new ErroV3(404, "Exame nao encontrado ou laudo ja entregue.");
      if (novaPrevisao < exame.producao.dataRealizacao) return invalido("Previsao anterior a realizacao do exame.");
      if (unidadeEntregaId) {
        const unidade = await prisma.unidadeClinica.findFirst({ where: {
          id: unidadeEntregaId, clinicaId: exame.producao.clinicaId, ativo: true }, select: { id: true } });
        if (!unidade) return invalido("Unidade de entrega nao pertence a esta clinica.");
      }
      if (novaPrevisao.getTime() === exame.laudoPrevisaoEntrega?.getTime() && unidadeEntregaId === exame.laudoUnidadeEntregaId) {
        throw new ErroV3(409, "Nao ha alteracoes na previsao ou unidade.");
      }
      await prisma.$transaction(async (tx) => {
        const alterado = await tx.terceirizacaoExame.updateMany({
          where: { id, producao: { organizacaoId: u.organizacaoId },
            status: { in: ["ENVIADO_LAUDO", "LAUDO_RECEBIDO"] },
            laudoPrevisaoEntrega: exame.laudoPrevisaoEntrega,
            laudoUnidadeEntregaId: exame.laudoUnidadeEntregaId },
          data: { laudoPrevisaoEntrega: novaPrevisao, laudoUnidadeEntregaId: unidadeEntregaId },
        });
        if (alterado.count !== 1) throw new ErroV3(409, "Laudo atualizado por outro usuario. Atualize a tela.");
        await tx.terceirizacaoEventoLaudo.create({ data: {
          exameId: id, usuarioId: u.id, acao: "ENTREGA_REPROGRAMADA",
          detalhes: `Previsao ${exame.laudoPrevisaoEntrega?.toISOString().slice(0, 10) || "sem data"} -> ${novaPrevisao.toISOString().slice(0, 10)}; ` +
            `unidade ${exame.laudoUnidadeEntregaId || "sem unidade"} -> ${unidadeEntregaId || "sem unidade"}. Motivo: ${motivo}`,
        } });
      });
      res.json({ mensagem: "Previsao e unidade de entrega atualizadas com historico." });
    } catch (erro) { responderErro(res, erro); }
  });

  router.patch("/laudos/:id/receber", proteger("terceirizacao.laudos.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const id = numero(req.params.id);
      if (!id) return invalido("Exame invalido.");
      await prisma.$transaction(async (tx) => {
        const alterado = await tx.terceirizacaoExame.updateMany({
          where: { id, status: "ENVIADO_LAUDO", producao: { organizacaoId: u.organizacaoId } },
          data: { status: "LAUDO_RECEBIDO", laudoRecebidoEm: new Date() },
        });
        if (alterado.count !== 1) throw new ErroV3(409, "Exame nao encontrado, ja recebido ou ainda nao enviado.");
        await tx.terceirizacaoEventoLaudo.create({ data: { exameId: id, usuarioId: u.id, acao: "RECEBIDO" } });
      });
      res.json({ mensagem: "Recebimento do laudo registrado." });
    } catch (erro) { responderErro(res, erro); }
  });

  router.patch("/laudos/:id/entregar", proteger("terceirizacao.laudos.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const id = numero(req.params.id);
      if (!id) return invalido("Exame invalido.");
      const canal = String(req.body?.meioEntrega ?? "").trim();
      const referencia = String(req.body?.referenciaEntrega ?? "").trim();
      if (!["EMAIL", "PASTA_REDE", "IMPRESSO"].includes(canal)) return invalido("Selecione o meio de entrega.");
      if (referencia.length < 3 || referencia.length > 250) return invalido("Informe a referencia da entrega (destinatario, pasta ou protocolo).");
      if (canal === "IMPRESSO" && req.body?.protocoloConferido !== true) {
        return invalido("Confirme que o protocolo de remessa impresso foi assinado/conferido.");
      }
      await prisma.$transaction(async (tx) => {
        await bonusTravar(tx,u.organizacaoId);
        const alterado = await tx.terceirizacaoExame.updateMany({
          where: { id, status: "LAUDO_RECEBIDO", producao: { organizacaoId: u.organizacaoId } },
          data: { status: "ENTREGUE", laudoEntregueEm: new Date(), laudoMeioEntrega: canal,
            laudoReferenciaEntrega: referencia },
        });
        if (alterado.count !== 1) throw new ErroV3(409, "Exame nao encontrado ou nao aguardando entrega.");
        await tx.terceirizacaoEventoLaudo.create({ data: { exameId: id, usuarioId: u.id, acao: "ENTREGUE",
          detalhes: `${canal}: ${referencia}` } });
      });
      res.json({ mensagem: "Entrega registrada." });
    } catch (erro) { responderErro(res, erro); }
  });


  // Tabela de precos contratados, gravacao em lote por clinica, em uma transacao.
  // Cada versao tem vigencia propria; nao alteramos titulos previamente emitidos.
  router.get("/configuracoes-financeiro/tabela", proteger("terceirizacao.configuracoes.visualizar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const [clinicas, configuracoes, regras] = await Promise.all([
        prisma.clinica.findMany({ where: { ativo: true, parceriaTerceirizacao: true },
          select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
        prisma.configuracaoLaudoV3.findMany({ where: { organizacaoId: u.organizacaoId },
          select: { clinicaId: true, tipoExame: true, convenios: true, formasPagamento: true,
            diasVencimento: true, prazoDias: true } }),
        prisma.regraFinanceiraV3.findMany({ where: { organizacaoId: u.organizacaoId },
          orderBy: [{ inicioVigencia: "desc" }, { id: "desc" }], take: 1000,
          select: { id: true, clinicaId: true, tipoExame: true, convenio: true,
            categoriaAtendimento: true, metodo: true, valorFixo: true, percentual: true,
            valorCobradoContratado: true, inicioVigencia: true, fimVigencia: true,
            observacoes: true, ativo: true, _count: { select: { titulos: true } } } }),
      ]);
      res.json({ clinicas, configuracoes, regras, modalidades: MODALIDADES });
    } catch (erro) { responderErro(res, erro); }
  });

  router.post("/configuracoes-financeiro/tabela", proteger("terceirizacao.configuracoes.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const clinicaId = numero(req.body?.clinicaId);
      const inicio = dataCivil(req.body?.inicioVigencia);
      const linhasBrutas: unknown = req.body?.linhas;
      if (!clinicaId) return invalido("Selecione uma clinica V3.");
      if (!Array.isArray(linhasBrutas) || linhasBrutas.length < 1 || linhasBrutas.length > 120) {
        return invalido("Envie de 1 a 120 linhas financeiras na mesma tabela.");
      }
      const clinica = await prisma.clinica.findFirst({ where: {
        id: clinicaId, ativo: true, parceriaTerceirizacao: true }, select: { id: true } });
      if (!clinica) throw new ErroV3(404, "Clinica nao habilitada na terceirizacao.");
      const repetidas = new Set<string>();
      const linhas = linhasBrutas.map((v: unknown) => {
        const linha = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
        const tipoExame = String(linha.tipoExame ?? "").trim();
        const convenio = String(linha.convenio ?? "").trim().toUpperCase();
        const categoria = String(linha.categoriaAtendimento ?? "").trim().toUpperCase();
        const metodo = String(linha.metodo ?? "").trim();
        const observacoes = String(linha.observacoes ?? "").trim();
        if (!MODALIDADES.includes(tipoExame as Modalidade) || convenio.length > 120 ||
          categoria.length > 120 || observacoes.length > 2000 || !["FIXO", "PERCENTUAL"].includes(metodo)) {
          return invalido("Modalidade, convenio, categoria, metodo ou observacao invalida.");
        }
        const chave = `${tipoExame}::${convenio}::${categoria}`;
        if (repetidas.has(chave)) return invalido(`Regra duplicada na tabela: ${chave}.`);
        repetidas.add(chave);
        const valorFixo = metodo === "FIXO" ? centavosV3(linha.valorFixo) : null;
        const percentual = metodo === "PERCENTUAL" ? String(linha.percentual ?? "").trim() : null;
        const valorCobrado = linha.valorCobradoContratado === "" || linha.valorCobradoContratado == null
          ? null : centavosV3(linha.valorCobradoContratado);
        if (metodo === "FIXO" && !valorFixo) return invalido(`${chave}: informe o valor fixo positivo.`);
        if (metodo === "PERCENTUAL" && (!percentual || !/^\d{1,3}(?:\.\d{1,4})?$/.test(percentual) ||
          Number(percentual) <= 0 || Number(percentual) > 100 || !valorCobrado)) {
          return invalido(`${chave}: percentual e valor cobrado contratual sao obrigatorios.`);
        }
        if (linha.valorCobradoContratado !== "" && linha.valorCobradoContratado != null && !valorCobrado) {
          return invalido(`${chave}: valor cobrado contratual invalido.`);
        }
        return { tipoExame: tipoExame as Modalidade, convenio, categoriaAtendimento: categoria,
          metodo: metodo as "FIXO" | "PERCENTUAL", valorFixo: valorFixo ? dinheiroV3(valorFixo) : null,
          percentual, valorCobradoContratado: valorCobrado ? dinheiroV3(valorCobrado) : null,
          observacoes: observacoes || null };
      });
      const resumo = await prisma.$transaction(async (tx) => {
        const ativas = await tx.regraFinanceiraV3.findMany({ where: {
          organizacaoId: u.organizacaoId, clinicaId, ativo: true },
          include: { _count: { select: { titulos: true } } } });
        let novas = 0; let atualizadas = 0; let inalteradas = 0;
        for (const linha of linhas) {
          const historico = ativas.filter((r) => r.tipoExame === linha.tipoExame &&
            r.convenio === linha.convenio && r.categoriaAtendimento === linha.categoriaAtendimento)
            .sort((a, b) => a.inicioVigencia.getTime() - b.inicioVigencia.getTime());
          const vigente = historico.find((r) => r.inicioVigencia <= inicio &&
            (!r.fimVigencia || r.fimVigencia >= inicio));
          const seguinte = historico.find((r) => r.inicioVigencia > inicio);
          const igual = vigente && vigente.metodo === linha.metodo &&
            centavosV3(vigente.valorFixo?.toString()) === centavosV3(linha.valorFixo) &&
            Number(vigente.percentual?.toString() ?? 0) === Number(linha.percentual ?? 0) &&
            centavosV3(vigente.valorCobradoContratado?.toString()) === centavosV3(linha.valorCobradoContratado) &&
            (vigente.observacoes ?? null) === linha.observacoes;
          if (igual) { inalteradas++; continue; }
          if (vigente && vigente.inicioVigencia.getTime() === inicio.getTime()) {
            if (vigente._count.titulos) throw new ErroV3(409,
              `${linha.tipoExame}/${linha.convenio || "GERAL"}: existem titulos nesta versao. Escolha vigencia posterior.`);
            await tx.regraFinanceiraV3.update({ where: { id: vigente.id }, data: {
              metodo: linha.metodo, valorFixo: linha.valorFixo, percentual: linha.percentual,
              valorCobradoContratado: linha.valorCobradoContratado, observacoes: linha.observacoes } });
            atualizadas++; continue;
          }
          if (vigente && vigente.inicioVigencia < inicio) {
            const diaAnterior = new Date(inicio.getTime() - 86400000);
            await tx.regraFinanceiraV3.update({ where: { id: vigente.id }, data: { fimVigencia: diaAnterior } });
          }
          const fim = seguinte ? new Date(seguinte.inicioVigencia.getTime() - 86400000) : null;
          await tx.regraFinanceiraV3.create({ data: {
            organizacaoId: u.organizacaoId, clinicaId, tipoExame: linha.tipoExame,
            convenio: linha.convenio, categoriaAtendimento: linha.categoriaAtendimento,
            metodo: linha.metodo, valorFixo: linha.valorFixo, percentual: linha.percentual,
            valorBaseReferencia: null, valorCobradoContratado: linha.valorCobradoContratado,
            inicioVigencia: inicio, fimVigencia: fim, ativo: true,
            observacoes: linha.observacoes, criadoPorId: u.id,
          } });
          novas++;
        }
        return { novas, atualizadas, inalteradas };
      }, { isolationLevel: "Serializable" });
      res.json({ mensagem: "Tabela financeira salva em lote. Titulos emitidos nao foram recalculados.", resumo });
    } catch (erro) { responderErro(res, erro); }
  });

  // FINANCEIRO V3 — Regras contratuais. Não consulta guias, caixa ou recebimentos da V1.
  // A configuração é independente do mês; títulos e valores por produção serão o próximo módulo.
  router.get("/financeiro/resumo", proteger("terceirizacao.financeiro.visualizar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      res.json(await resumoFinanceiroV3(prisma, u.organizacaoId));
    } catch (erro) { responderErro(res, erro); }
  });

  router.get("/financeiro/clinicas", proteger("terceirizacao.financeiro.visualizar"), async (_req, res) => {
    try {
      const clinicas = await prisma.clinica.findMany({
        where: { ativo: true, parceriaTerceirizacao: true },
        select: { id: true, nome: true }, orderBy: { nome: "asc" },
      });
      res.json({ clinicas });
    } catch (erro) { responderErro(res, erro); }
  });

  router.get("/financeiro/regras", proteger("terceirizacao.financeiro.visualizar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const clinicaId = numero(req.query.clinicaId);
      const regras = await prisma.regraFinanceiraV3.findMany({
        where: { organizacaoId: u.organizacaoId, ...(clinicaId ? { clinicaId } : {}) },
        orderBy: [{ ativo: "desc" }, { inicioVigencia: "desc" }, { id: "desc" }],
        take: 500,
        select: {
          id: true, clinicaId: true, tipoExame: true, convenio: true,
          categoriaAtendimento: true, metodo: true, valorFixo: true,
          percentual: true, valorBaseReferencia: true, valorCobradoContratado: true, inicioVigencia: true,
          fimVigencia: true, ativo: true, observacoes: true, criadoEm: true,
          clinica: { select: { nome: true } },
          _count: { select: { titulos: true } },
        },
      });
      res.json({ regras });
    } catch (erro) { responderErro(res, erro); }
  });

  router.post("/financeiro/regras", proteger("terceirizacao.financeiro.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const corpo = req.body ?? {};
      const clinicaId = numero(corpo.clinicaId);
      if (!clinicaId) return invalido("Selecione uma clínica parceira da terceirização.");
      const tipoExame = String(corpo.tipoExame ?? "").trim();
      if (!MODALIDADES.includes(tipoExame as Modalidade)) return invalido("Modalidade de exame inválida.");
      const metodo = String(corpo.metodo ?? "").trim();
      if (metodo !== "FIXO" && metodo !== "PERCENTUAL") return invalido("Selecione o método de cálculo.");
      const convenio = String(corpo.convenio ?? "").trim().toUpperCase();
      const categoriaAtendimento = String(corpo.categoriaAtendimento ?? "").trim().toUpperCase();
      const observacoes = String(corpo.observacoes ?? "").trim();
      if (convenio.length > 120 || categoriaAtendimento.length > 120 || observacoes.length > 2000) {
        return invalido("Convênio, categoria ou observações ultrapassam o limite permitido.");
      }
      function decimalSeguro(valor: unknown, casas: number, maxInteiros: number): string | null {
        if (valor === undefined || valor === null || valor === "") return null;
        const s = String(valor).trim();
        const re = new RegExp(`^\\d{1,${maxInteiros}}(?:\\.\\d{1,${casas}})?$`);
        return re.test(s) && Number(s) > 0 ? s : null;
      }
      const valorFixo = metodo === "FIXO" ? decimalSeguro(corpo.valorFixo, 2, 11) : null;
      const percentual = metodo === "PERCENTUAL" ? decimalSeguro(corpo.percentual, 4, 3) : null;
      if (metodo === "FIXO" && !valorFixo) return invalido("Informe um valor fixo positivo com até duas casas decimais.");
      if (metodo === "PERCENTUAL" && (!percentual || Number(percentual) > 100)) {
        return invalido("Informe um percentual superior a 0% e até 100% (ex.: 70). ");
      }
      const valorBaseReferencia = corpo.valorBaseReferencia === null || corpo.valorBaseReferencia === "" || corpo.valorBaseReferencia === undefined
        ? null : decimalSeguro(corpo.valorBaseReferencia, 2, 11);
      if (corpo.valorBaseReferencia !== null && corpo.valorBaseReferencia !== undefined && corpo.valorBaseReferencia !== "" && !valorBaseReferencia) {
        return invalido("Valor-base de referência inválido.");
      }
      const inicioVigencia = dataCivil(corpo.inicioVigencia);
      const fimVigencia = corpo.fimVigencia ? dataCivil(corpo.fimVigencia) : null;
      if (fimVigencia && fimVigencia < inicioVigencia) return invalido("O término não pode ser anterior ao início da vigência.");
      const clinica = await prisma.clinica.findFirst({
        where: { id: clinicaId, ativo: true, parceriaTerceirizacao: true }, select: { id: true },
      });
      if (!clinica) throw new ErroV3(404, "Clínica não habilitada na terceirização.");

      // Duas regras ativas para a mesma clínica/modalidade/convênio/categoria não podem
      // ter períodos sobrepostos. Bloqueio lógico, revalidado no momento da criação.
      const duplicada = await prisma.regraFinanceiraV3.findFirst({
        where: {
          organizacaoId: u.organizacaoId, clinicaId, tipoExame: tipoExame as Modalidade,
          convenio, categoriaAtendimento, ativo: true,
          inicioVigencia: { lte: fimVigencia ?? new Date("9999-12-31T00:00:00.000Z") },
          OR: [{ fimVigencia: null }, { fimVigencia: { gte: inicioVigencia } }],
        }, select: { id: true },
      });
      if (duplicada) throw new ErroV3(409, "Já existe regra ativa para esta combinação e período. Encerre ou desative a anterior.");
      const regra = await prisma.regraFinanceiraV3.create({
        data: {
          organizacaoId: u.organizacaoId, clinicaId, tipoExame: tipoExame as Modalidade,
          convenio, categoriaAtendimento, metodo,
          valorFixo, percentual, valorBaseReferencia,
          inicioVigencia, fimVigencia, ativo: true,
          observacoes: observacoes || null, criadoPorId: u.id,
        },
        select: { id: true, ativo: true },
      });
      res.status(201).json({ regra, mensagem: "Regra financeira da V3 cadastrada." });
    } catch (erro) { responderErro(res, erro); }
  });

  router.patch("/financeiro/regras/:id/desativar", proteger("terceirizacao.financeiro.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const id = numero(req.params.id);
      if (!id) return invalido("Regra inválida.");
      const resultado = await prisma.regraFinanceiraV3.updateMany({
        where: { id, organizacaoId: u.organizacaoId, ativo: true }, data: { ativo: false },
      });
      if (resultado.count !== 1) throw new ErroV3(404, "Regra não encontrada ou já desativada.");
      res.json({ mensagem: "Regra desativada. Títulos históricos, se existentes, não foram alterados." });
    } catch (erro) { responderErro(res, erro); }
  });


  // FINANCEIRO V3 — titulacao automatica no envio para laudo.
  // Exibe somente a competencia da realizacao; nao acessa valores da V1.
  router.get("/financeiro/titulos-mes", proteger("terceirizacao.financeiro.visualizar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const { mes, inicio, fim } = competenciaV3Agora();
      const exames = await prisma.terceirizacaoExame.findMany({ where: {
        status: { not: "CANCELADO" },
        producao: { organizacaoId: u.organizacaoId, dataRealizacao: { gte: inicio, lt: fim } },
      }, orderBy: [{ producao: { dataRealizacao: "desc" } }, { id: "desc" }], take: 300,
        select: { id: true, tipoExame: true, status: true, financeiroPendenciaV3: true,
          laudoConvenio: true, laudoFormaPagamento: true,
          producao: { select: { dataRealizacao: true, nomePacienteDigitado: true,
            clinica: { select: { id: true, nome: true } } } },
          titulosFinanceirosV3: { where: { natureza: "A_RECEBER" }, select: {
            id: true, valorDevido: true, dataCompetencia: true, convenio: true, categoriaAtendimento: true,
            formaPagamentoOrigem: true, observacoes: true, canceladoEm: true,
            parcelas: { orderBy: { numero: "asc" }, select: { id: true, numero: true,
              vencimento: true, valorPrevisto: true, canceladaEm: true,
              baixas: { where: { estornadoEm: null }, select: { id: true, valor: true } } } },
            auditorias: { orderBy: { id: "desc" }, take: 8,
              select: { id: true, motivo: true, criadoEm: true, dadosAnteriores: true,
                dadosNovos: true, usuario: { select: { nome: true } } } },
          } },
        },
      });
      res.json({ competencia: mes, exames });
    } catch (erro) { responderErro(res, erro); }
  });

  // Excecao administrativa: regularizar exame JA enviado que ficou sem titulo.
  // O plano de vencimentos deve ser confirmado explicitamente; jamais inferir historico.
  router.get("/financeiro/pendencias-historicas", proteger("terceirizacao.financeiro.visualizar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const pagina = Number(req.query.pagina || 1);
      if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 10000) return invalido("Pagina invalida.");
      const where = { producao: { organizacaoId: u.organizacaoId },
        status: { in: ["ENVIADO_LAUDO", "LAUDO_RECEBIDO", "ENTREGUE"] as
          Array<"ENVIADO_LAUDO" | "LAUDO_RECEBIDO" | "ENTREGUE"> },
        financeiroPendenciaV3: { not: null } };
      const [total, exames] = await Promise.all([
        prisma.terceirizacaoExame.count({ where }),
        prisma.terceirizacaoExame.findMany({ where,
          orderBy: [{ producao: { dataRealizacao: "asc" } }, { id: "asc" }],
          take: 25, skip: (pagina - 1) * 25,
          select: { id: true, codigoInterno: true, tipoExame: true, status: true,
            financeiroPendenciaV3: true, laudoConvenio: true, laudoFormaPagamento: true,
            producao: { select: { dataRealizacao: true, nomePacienteDigitado: true,
              clinica: { select: { nome: true } } } } },
        }),
      ]);
      res.json({ total, pagina, paginas: Math.ceil(total / 25), exames });
    } catch (erro) { responderErro(res, erro); }
  });

  router.post("/financeiro/exames/:id/regularizar", proteger("terceirizacao.financeiro.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      await verificarAdministradorFinanceiroV3(req, u.organizacaoId);
      const id = numero(req.params.id);
      if (!id) return invalido("Exame invalido.");
      const motivo = String(req.body?.motivo ?? "").trim();
      if (motivo.length < 10 || motivo.length > 1000) return invalido("Justificativa de 10 a 1000 caracteres obrigatoria.");
      if (req.body?.planoOriginalConferido !== true) return invalido("Confirme o plano de parcelas original antes de regularizar.");
      const vencimentosBrutos: unknown = req.body?.vencimentosParcelas;
      if (!Array.isArray(vencimentosBrutos) || vencimentosBrutos.length < 1 || vencimentosBrutos.length > 12)
        return invalido("Informe de 1 a 12 vencimentos originais, em ordem.");
      const vencimentos = vencimentosBrutos.map(dataCivil);
      if (vencimentos.some((d, i) => i > 0 && d <= vencimentos[i - 1]))
        return invalido("Vencimentos devem ser crescentes e sem duplicidade.");
      const resultado = await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "TerceirizacaoExame" WHERE "id" = ${id} FOR UPDATE`;
        const e = await tx.terceirizacaoExame.findFirst({ where: { id,
          status: { in: ["ENVIADO_LAUDO", "LAUDO_RECEBIDO", "ENTREGUE"] },
          producao: { organizacaoId: u.organizacaoId } },
          select: { id: true, tipoExame: true, financeiroPendenciaV3: true,
            laudoConvenio: true, laudoCategoriaAtendimento: true, laudoFormaPagamento: true,
            producao: { select: { clinicaId: true, dataRealizacao: true } } },
        });
        if (!e) throw new ErroV3(404, "Exame nao disponivel para regularizacao.");
        if (!e.financeiroPendenciaV3) throw new ErroV3(409, "Exame sem pendencia financeira registrada.");
        const envioOriginal = await tx.terceirizacaoEventoLaudo.findFirst({
          where: { exameId: id, acao: "ENVIADO" }, orderBy: { id: "desc" }, select: { detalhes: true },
        });
        const qtdHistorica = /parcelas planejadas:\s*(\d+)/i.exec(envioOriginal?.detalhes ?? "");
        if (qtdHistorica && Number(qtdHistorica[1]) !== vencimentos.length) throw new ErroV3(409,
          "Quantidade de parcelas difere do envio original. Revise antes de regularizar.");
        if (vencimentos.some(d => d < e.producao.dataRealizacao))
          throw new ErroV3(400, "Vencimento anterior a realizacao do exame.");
        const anterior = await tx.tituloFinanceiroV3.findUnique({ where: {
          exameId_natureza: { exameId: id, natureza: "A_RECEBER" } }, select: { id: true },
        });
        if (anterior) throw new ErroV3(409, "Ja existe titulo para este exame; nao e permitido duplicar ou recriar um cancelado.");
        const convenio = e.laudoConvenio || "", categoria = e.laudoCategoriaAtendimento || "";
        const candidatas = await tx.regraFinanceiraV3.findMany({ where: {
          organizacaoId: u.organizacaoId, clinicaId: e.producao.clinicaId, tipoExame: e.tipoExame,
          ativo: true, convenio: { in: [...new Set([convenio, ""])] },
          categoriaAtendimento: { in: [...new Set([categoria, ""])] },
          inicioVigencia: { lte: e.producao.dataRealizacao },
          OR: [{ fimVigencia: null }, { fimVigencia: { gte: e.producao.dataRealizacao } }],
        } });
        const regra = escolherRegraV3(candidatas, convenio, categoria);
        if (!regra) throw new ErroV3(409, "Ainda nao existe regra financeira vigente na data original do exame.");
        const base = regra.valorCobradoContratado?.toString() ?? null;
        const calculo = calcularValorV3(regra, base);
        if (!calculo) throw new ErroV3(409, "Regra percentual sem preco contratual valido.");
        const total = centavosV3(calculo.valorDevido);
        if (!total || total < BigInt(vencimentos.length))
          throw new ErroV3(409, "Repasse insuficiente para a quantidade de parcelas.");
        const porParcela = total / BigInt(vencimentos.length), resto = total % BigInt(vencimentos.length);
        const plano = vencimentos.map((d, i) => ({ numero: i + 1, vencimento: d,
          valorPrevisto: dinheiroV3(porParcela + (i === vencimentos.length - 1 ? resto : 0n)) }));
        const titulo = await tx.tituloFinanceiroV3.create({ data: {
          organizacaoId: u.organizacaoId, clinicaId: e.producao.clinicaId, exameId: id,
          regraId: regra.id, natureza: "A_RECEBER", convenio, categoriaAtendimento: categoria,
          formaPagamentoOrigem: e.laudoFormaPagamento, valorBaseReferencia: calculo.baseReal,
          percentualAplicado: regra.metodo === "PERCENTUAL" ? regra.percentual : null,
          valorDevido: calculo.valorDevido, dataCompetencia: e.producao.dataRealizacao,
          criadoPorId: u.id, parcelas: { create: plano },
        }, select: { id: true } });
        await tx.auditoriaTituloV3.create({ data: {
          tituloId: titulo.id, usuarioId: u.id, motivo,
          dadosAnteriores: { pendencia: e.financeiroPendenciaV3, planoOriginalConfirmado: true },
          dadosNovos: { regraId: regra.id, valorDevido: calculo.valorDevido,
            dataCompetencia: e.producao.dataRealizacao.toISOString().slice(0, 10),
            parcelas: plano.map(p => ({ ...p, vencimento: p.vencimento.toISOString().slice(0,10) })) },
        } });
        await tx.terceirizacaoExame.update({ where: { id }, data: { financeiroPendenciaV3: null } });
        await tx.terceirizacaoEventoLaudo.create({ data: { exameId: id, usuarioId: u.id,
          acao: "FINANCEIRO_REGULARIZADO", detalhes: `Titulo #${titulo.id}. ${motivo}` } });
        return { tituloId: titulo.id, valor: calculo.valorDevido, competencia: e.producao.dataRealizacao.toISOString().slice(0,7) };
      }, { timeout: 20000 });
      res.status(201).json({ mensagem: "Titulo regularizado com auditoria e competencia original.", ...resultado });
    } catch (erro) {
      if (erro && typeof erro === "object" && "code" in erro && erro.code === "P2002")
        return res.status(409).json({ erro: "Titulo ja existente. Atualize os dados." });
      responderErro(res, erro);
    }
  });

  // Geracao manual desativada. Somente o envio do laudo pode gerar titulo.
  router.post("/financeiro/titulos", proteger("terceirizacao.financeiro.editar"), (_req, res) => {
    res.status(410).json({ erro: "Geracao manual encerrada. O titulo e gerado ao enviar para laudar." });
  });

  // Excecao controlada: somente ADMINISTRADOR pode alterar titulo existente.
  router.patch("/financeiro/titulos/:id", proteger("terceirizacao.financeiro.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const perfil = await prisma.usuario.findFirst({ where: { id: u.id, organizacaoId: u.organizacaoId, ativo: true },
        select: { perfil: true } });
      if (perfil?.perfil !== "ADMINISTRADOR") throw new ErroV3(403, "Somente administrador pode editar titulos financeiros da V3.");
      const id = numero(req.params.id);
      if (!id) return invalido("Titulo invalido.");
      const corpo = req.body ?? {};
      const motivo = String(corpo.motivo ?? "").trim();
      if (motivo.length < 10 || motivo.length > 1000) return invalido("Informe justificativa de 10 a 1000 caracteres.");
      const valor = centavosV3(corpo.valorDevido);
      if (!valor) return invalido("Informe valor devido positivo com ate 2 casas decimais.");
      const vencimento = dataCivil(corpo.vencimento);
      const convenio = String(corpo.convenio ?? "").trim().toUpperCase();
      const categoriaAtendimento = String(corpo.categoriaAtendimento ?? "").trim().toUpperCase();
      const formaPagamentoOrigem = String(corpo.formaPagamentoOrigem ?? "").trim().toUpperCase();
      const observacoes = String(corpo.observacoes ?? "").trim();
      if (convenio.length > 120 || categoriaAtendimento.length > 120 ||
          formaPagamentoOrigem.length > 120 || observacoes.length > 2000) return invalido("Campos demasiadamente longos.");
      const resultado = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "TituloFinanceiroV3" WHERE id = ${id} FOR UPDATE`;
        const titulo = await tx.tituloFinanceiroV3.findFirst({ where: { id, organizacaoId: u.organizacaoId,
          canceladoEm: null }, include: { parcelas: { include: { baixas: true } },
          exame: { select: { producao: { select: { dataRealizacao: true } } } } } });
        if (!titulo) throw new ErroV3(404, "Titulo nao encontrado ou cancelado.");
        if (titulo.parcelas.length !== 1 || titulo.parcelas[0].canceladaEm) {
          throw new ErroV3(409, "Este titulo tem parcelamento especial. Nao e permitido editar desta tela.");
        }
        if (titulo.parcelas[0].baixas.some((b) => !b.estornadoEm)) {
          throw new ErroV3(409, "Titulo com recebimento: regularize os pagamentos antes de editar.");
        }
        if (vencimento < titulo.exame.producao.dataRealizacao) return invalido("Vencimento nao pode anteceder a realizacao.");
        const antes = { valorDevido: titulo.valorDevido.toString(), vencimento: titulo.parcelas[0].vencimento.toISOString().slice(0, 10),
          convenio: titulo.convenio, categoriaAtendimento: titulo.categoriaAtendimento,
          formaPagamentoOrigem: titulo.formaPagamentoOrigem, observacoes: titulo.observacoes };
        const depois = { valorDevido: dinheiroV3(valor), vencimento: vencimento.toISOString().slice(0, 10),
          convenio, categoriaAtendimento, formaPagamentoOrigem, observacoes };
        if (JSON.stringify(antes) === JSON.stringify(depois)) throw new ErroV3(409, "Nenhuma alteracao identificada.");
        await tx.tituloFinanceiroV3.update({ where: { id }, data: {
          valorDevido: depois.valorDevido, convenio, categoriaAtendimento,
          formaPagamentoOrigem: formaPagamentoOrigem || null, observacoes: observacoes || null,
        } });
        await tx.parcelaFinanceiraV3.update({ where: { id: titulo.parcelas[0].id }, data: {
          vencimento, valorPrevisto: depois.valorDevido,
        } });
        await tx.auditoriaTituloV3.create({ data: {
          tituloId: id, usuarioId: u.id, motivo, dadosAnteriores: antes, dadosNovos: depois,
        } });
        return depois;
      });
      res.json({ mensagem: "Titulo atualizado com historico de auditoria.", titulo: resultado });
    } catch (erro) { responderErro(res, erro); }
  });

  // ---------------------------------------------------------------------------
  // RECEBIMENTOS / ESTORNOS / PARCELAMENTO V3
  // O mes filtra sempre a DATA DE REALIZACAO do exame, mesmo que o recebimento
  // ocorra em outro mes. Historicos somente via Relatorios com permissao propria.
  // Nenhuma operacao altera o caixa ou o financeiro da V1.
  // ---------------------------------------------------------------------------
  async function verificarAdministradorFinanceiroV3(req: Request, organizacaoId: number) {
    const u = usuarioDaRequisicao(req);
    const usuario = await prisma.usuario.findFirst({
      where: { id: u.id, organizacaoId, ativo: true }, select: { perfil: true },
    });
    if (usuario?.perfil !== "ADMINISTRADOR") {
      throw new ErroV3(403, "Somente administrador pode estornar recebimentos e reprogramar parcelas.");
    }
  }

  router.get("/financeiro/recebimentos", proteger("terceirizacao.financeiro.visualizar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const atual = competenciaV3Agora().mes;
      const mes = req.query.mes === undefined ? atual : req.query.mes;
      if (typeof mes !== "string") return invalido("Informe uma competencia unica no formato AAAA-MM.");
      const { inicio, fim } = intervaloMesV3(mes);
      if (mes !== atual && !podeAcessar(req, "terceirizacao.relatorios.visualizar")) {
        throw new ErroV3(403, "Para consultar outras competencias, acesse Relatorios com a permissao correspondente.");
      }
      const pagina = req.query.pagina === undefined ? 1 : Number(req.query.pagina);
      if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 100000) return invalido("Pagina invalida.");
      const onde = {
        organizacaoId: u.organizacaoId, natureza: "A_RECEBER" as const, canceladoEm: null,
        exame: { producao: { organizacaoId: u.organizacaoId, dataRealizacao: { gte: inicio, lt: fim } } },
      };
      const tamanhoPagina = 50;
      const [total, titulos] = await Promise.all([
        prisma.tituloFinanceiroV3.count({ where: onde }),
        prisma.tituloFinanceiroV3.findMany({
          where: onde, orderBy: [{ exame: { producao: { dataRealizacao: "desc" } } }, { id: "desc" }],
          skip: (pagina - 1) * tamanhoPagina, take: tamanhoPagina,
          select: {
            id: true, natureza: true, convenio: true, formaPagamentoOrigem: true,
            valorDevido: true, dataCompetencia: true, criadoEm: true,
            exame: { select: { id: true, tipoExame: true, producao: {
              select: { nomePacienteDigitado: true, dataRealizacao: true } } } },
            clinica: { select: { nome: true } },
            parcelas: { orderBy: { numero: "asc" }, select: {
              id: true, numero: true, vencimento: true, valorPrevisto: true, canceladaEm: true,
              baixas: { orderBy: { id: "desc" }, select: {
                id: true, valor: true, dataEfetiva: true, formaPagamento: true,
                referencia: true, observacoes: true, criadoEm: true,
                estornadoEm: true, motivoEstorno: true,
                registradoPor: { select: { nome: true } },
                estornadoPor: { select: { nome: true } },
              } },
            } },
          },
        }),
      ]);
      const resposta = titulos.map((titulo) => {
        let recebido = 0n;
        let previsto = 0n;
        const parcelas = titulo.parcelas.map((parcela) => {
          const pagos = parcela.baixas.reduce((s, baixa) => s + (!baixa.estornadoEm ?
            (centavosV3(baixa.valor.toString()) ?? 0n) : 0n), 0n);
          const devido = parcela.canceladaEm ? 0n : (centavosV3(parcela.valorPrevisto.toString()) ?? 0n);
          if (!parcela.canceladaEm) { recebido += pagos; previsto += devido; }
          return { ...parcela, valorRecebido: dinheiroV3(pagos),
            saldo: dinheiroV3(devido > pagos ? devido - pagos : 0n) };
        });
        return { ...titulo, parcelas, valorRecebido: dinheiroV3(recebido),
          saldo: dinheiroV3(previsto > recebido ? previsto - recebido : 0n),
          situacao: previsto <= recebido ? "QUITADO" : recebido > 0n ? "PARCIAL" : "EM_ABERTO" };
      });
      res.json({ competencia: mes, pagina, tamanhoPagina, total,
        paginas: Math.max(1, Math.ceil(total / tamanhoPagina)), titulos: resposta });
    } catch (erro) { responderErro(res, erro); }
  });

  // Conferencia operacional por VENCIMENTO/RECEBIMENTO, nao por competencia de exame.
  // Assim parcelas de exames antigos continuam aparecendo quando vencerem.
  router.get("/financeiro/conferencia", proteger("terceirizacao.financeiro.visualizar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const clinicaId = numero(req.query.clinicaId);
      if (!clinicaId) return invalido("Selecione uma clinica para a conferencia.");
      if (typeof req.query.data !== "string") return invalido("Informe uma data de conferencia.");
      const data = dataCivil(req.query.data);
      const hoje = dataCivil(competenciaV3Agora().hoje);
      if (data > hoje) return invalido("Data real de recebimento nao pode ser futura.");
      // O vencimento consultado e INDEPENDENTE da data real do recebimento.
      // Filtros futuros apenas exibem parcelas; nao registram pagamentos futuros.
      const filtrosVencimento = ["ATE_DATA", "VENCIDAS", "HOJE", "PROXIMOS_30", "TODAS"] as const;
      const filtro = typeof req.query.filtro === "string" ? req.query.filtro : "ATE_DATA";
      if (!filtrosVencimento.includes(filtro as (typeof filtrosVencimento)[number])) {
        return invalido("Filtro de vencimento invalido.");
      }
      const vencimentoAte = filtro === "ATE_DATA"
        ? (req.query.vencimentoAte === undefined ? hoje : dataCivil(req.query.vencimentoAte)) : hoje;
      const fimProximos30 = somarDiasV3(hoje, 30);
      const clinica = await prisma.clinica.findFirst({ where: {
        id: clinicaId, ativo: true, parceriaTerceirizacao: true,
      }, select: { id: true, nome: true } });
      if (!clinica) throw new ErroV3(404, "Clinica da terceirizacao nao encontrada.");
      // Consulta agregada: traz apenas SALDOS EM ABERTO, mesmo com milhares de
      // parcelas historicas ja quitadas. Mantem desempenho da tela de conferencia.
      const parcelas = await prisma.$queryRaw<Array<{
        parcelaId: number; tituloId: number; numero: number; vencimento: Date;
        valorPrevisto: string; saldo: string; exame: string; paciente: string;
        realizacao: Date; convenio: string;
      }>>`
        SELECT p."id" AS "parcelaId", t."id" AS "tituloId", p."numero",
               p."vencimento", p."valorPrevisto"::text AS "valorPrevisto",
               (p."valorPrevisto" - COALESCE(SUM(CASE WHEN b."estornadoEm" IS NULL
                 THEN b."valor" ELSE 0 END), 0))::text AS "saldo",
               e."tipoExame"::text AS "exame", pr."nomePacienteDigitado" AS "paciente",
               pr."dataRealizacao" AS "realizacao", t."convenio"
        FROM "ParcelaFinanceiraV3" p
        JOIN "TituloFinanceiroV3" t ON t."id" = p."tituloId"
        JOIN "TerceirizacaoExame" e ON e."id" = t."exameId"
        JOIN "TerceirizacaoProducao" pr ON pr."id" = e."producaoId"
        LEFT JOIN "BaixaFinanceiraV3" b ON b."parcelaId" = p."id"
        WHERE p."canceladaEm" IS NULL
          AND CASE ${filtro}
            WHEN 'VENCIDAS' THEN p."vencimento" < ${hoje}
            WHEN 'HOJE' THEN p."vencimento" = ${hoje}
            WHEN 'PROXIMOS_30' THEN p."vencimento" BETWEEN ${hoje} AND ${fimProximos30}
            WHEN 'TODAS' THEN TRUE
            ELSE p."vencimento" <= ${vencimentoAte}
          END
          AND t."organizacaoId" = ${u.organizacaoId} AND t."clinicaId" = ${clinicaId}
          AND t."natureza" = 'A_RECEBER' AND t."canceladoEm" IS NULL
          AND pr."organizacaoId" = ${u.organizacaoId}
        GROUP BY p."id", t."id", e."id", pr."id"
        HAVING p."valorPrevisto" > COALESCE(SUM(CASE WHEN b."estornadoEm" IS NULL
          THEN b."valor" ELSE 0 END), 0)
        ORDER BY p."vencimento" ASC, p."id" ASC
        LIMIT 1001
      `;
      if (parcelas.length > 1000) {
        throw new ErroV3(409, "Ha mais de 1000 parcelas em aberto. Consulte o financeiro administrativo para dividir este volume.");
      }
      const [houveLote, recebimentosHoje] = await Promise.all([
        prisma.baixaFinanceiraV3.count({ where: {
          dataEfetiva: data, estornadoEm: null, referencia: { startsWith: "V3LOTE-" },
          parcela: { titulo: { organizacaoId: u.organizacaoId, clinicaId } },
        } }),
        prisma.baixaFinanceiraV3.count({ where: {
          dataEfetiva: data, estornadoEm: null,
          parcela: { titulo: { organizacaoId: u.organizacaoId, clinicaId } },
        } }),
      ]);
      const itens = parcelas.map((p) => ({
        parcelaId: p.parcelaId, tituloId: p.tituloId, numero: p.numero,
        exame: p.exame, paciente: p.paciente, realizacao: p.realizacao,
        convenio: p.convenio, vencimento: p.vencimento,
        valorPrevisto: p.valorPrevisto, saldo: p.saldo,
        // Uma parcela que so vence no futuro nao pode ser marcada como
        // 'nao paga no lote' de hoje: ela ainda nao era devida.
        situacao: p.vencimento < hoje ? "VENCIDA" :
          (houveLote > 0 && p.vencimento <= data ? "NAO_PAGA_NO_LOTE" : "PREVISTA"),
      }));
      res.json({ clinica, data: req.query.data, filtro, vencimentoAte: vencimentoAte.toISOString().slice(0, 10),
        conferenciaRealizada: houveLote > 0,
        recebimentosHoje, itens, total: itens.length,
        saldoPendente: dinheiroV3(itens.reduce((t, i) => t + (centavosV3(i.saldo) ?? 0n), 0n)) });
    } catch (erro) { responderErro(res, erro); }
  });

  // Um unico recebimento logico gera varias baixas atomicas com referencia V3LOTE comum.
  // O valor depositado e opcional; quando informado, deve bater EXATAMENTE com os selecionados.
  router.post("/financeiro/lotes", proteger("terceirizacao.financeiro.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const clinicaId = numero(req.body?.clinicaId);
      if (!clinicaId) return invalido("Selecione uma clinica.");
      const dataEfetiva = dataCivil(req.body?.dataEfetiva);
      if (dataEfetiva > dataCivil(competenciaV3Agora().hoje)) return invalido("Nao registre pagamentos futuros.");
      const formaPagamento = String(req.body?.formaPagamento ?? "").trim().toUpperCase();
      const referenciaExtrato = String(req.body?.referenciaExtrato ?? "").trim();
      const chave = String(req.body?.chaveLote ?? "").trim().toUpperCase();
      if (!formaPagamento || formaPagamento.length > 80 || referenciaExtrato.length > 100) {
        return invalido("Confira forma de recebimento e referencia do comprovante.");
      }
      if (!/^V3LOTE-[0-9A-F-]{36}$/.test(chave)) return invalido("Identificador do lote invalido.");
      const idsBrutos: unknown = req.body?.parcelas;
      if (!Array.isArray(idsBrutos) || idsBrutos.length < 1 || idsBrutos.length > 300) {
        return invalido("Selecione entre 1 e 300 parcelas por lote.");
      }
      const ids = idsBrutos.map(numero);
      if (ids.some((id) => id === null) || new Set(ids).size !== ids.length) {
        return invalido("Existem parcelas invalidas ou repetidas.");
      }
      const valorExtrato = req.body?.valorDeposito === "" || req.body?.valorDeposito === undefined ||
        req.body?.valorDeposito === null ? null : centavosV3(req.body.valorDeposito);
      if (req.body?.valorDeposito !== undefined && req.body?.valorDeposito !== null &&
          req.body?.valorDeposito !== "" && !valorExtrato) return invalido("Valor do deposito invalido.");
      const clinica = await prisma.clinica.findFirst({ where: {
        id: clinicaId, ativo: true, parceriaTerceirizacao: true,
      }, select: { id: true } });
      if (!clinica) throw new ErroV3(404, "Clinica V3 nao encontrada.");
      const resultado = await prisma.$transaction(async (tx) => {
        // A chave identifica uma remessa por organizacao, inclusive quando os
        // titulos selecionados sao diferentes. Serializa requisições concorrentes
        // ANTES de verificar se a chave ja foi utilizada.
        await tx.$queryRaw`SELECT 1 AS "ok" FROM pg_advisory_xact_lock(${u.organizacaoId}::integer, hashtext(${chave}::text))`;
        const anteriores = await tx.baixaFinanceiraV3.findFirst({ where: {
          referencia: chave, parcela: { titulo: { organizacaoId: u.organizacaoId } },
        }, select: { id: true } });
        if (anteriores) throw new ErroV3(409, "Este lote ja foi registrado. Atualize os recebimentos antes de tentar novamente.");
        const candidatas = await tx.parcelaFinanceiraV3.findMany({ where: { id: { in: ids as number[] } },
          select: { id: true, tituloId: true } });
        if (candidatas.length !== ids.length) throw new ErroV3(409, "Uma parcela selecionada deixou de existir.");
        const titulos = [...new Set(candidatas.map((p) => p.tituloId))].sort((a, b) => a - b);
        for (const tituloId of titulos) {
          await tx.$queryRaw`SELECT "id" FROM "TituloFinanceiroV3" WHERE "id" = ${tituloId} FOR UPDATE`;
        }
        const parcelas = await tx.parcelaFinanceiraV3.findMany({ where: {
          id: { in: ids as number[] }, canceladaEm: null,
          titulo: { organizacaoId: u.organizacaoId, clinicaId, natureza: "A_RECEBER", canceladoEm: null,
            exame: { producao: { organizacaoId: u.organizacaoId } } },
        }, select: { id: true, valorPrevisto: true,
          baixas: { select: { valor: true, estornadoEm: true } },
        } });
        if (parcelas.length !== ids.length) throw new ErroV3(409,
          "Selecao desatualizada, titulo cancelado ou parcela indisponivel.");
        let total = 0n;
        const valores = parcelas.map((p) => {
          const previsto = centavosV3(p.valorPrevisto.toString()) ?? 0n;
          const recebido = p.baixas.reduce((s, b) => s + (b.estornadoEm ? 0n :
            (centavosV3(b.valor.toString()) ?? 0n)), 0n);
          const saldo = previsto > recebido ? previsto - recebido : 0n;
          if (!saldo) throw new ErroV3(409, "Parcela ja quitada. Atualize a conferencia.");
          total += saldo;
          return { parcelaId: p.id, valor: dinheiroV3(saldo), dataEfetiva,
            formaPagamento, referencia: chave,
            observacoes: referenciaExtrato ? `Referencia do deposito: ${referenciaExtrato}` : null,
            registradoPorId: u.id };
        });
        if (valorExtrato !== null && valorExtrato !== total) throw new ErroV3(409,
          `Total selecionado (R$ ${dinheiroV3(total)}) difere do valor informado no extrato (R$ ${dinheiroV3(valorExtrato)}).`);
        await tx.baixaFinanceiraV3.createMany({ data: valores });
        return { total: dinheiroV3(total), quantidade: valores.length, chaveLote: chave };
      }, { timeout: 15000 });
      res.status(201).json({ mensagem: `${resultado.quantidade} parcela(s) recebida(s) em lote.`, ...resultado });
    } catch (erro) { responderErro(res, erro); }
  });

  // Registra um recebimento parcial ou integral. Todas as mutacoes financeiras
  // bloqueiam o titulo antes de recalcular saldo para evitar recebimento acima do devido.
  router.post("/financeiro/parcelas/:id/baixas", proteger("terceirizacao.financeiro.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      const parcelaId = numero(req.params.id);
      if (!parcelaId) return invalido("Parcela invalida.");
      const valor = centavosV3(req.body?.valor);
      if (!valor) return invalido("Informe um valor positivo em reais, com ate duas casas decimais.");
      const dataEfetiva = dataCivil(req.body?.dataEfetiva);
      if (dataEfetiva > dataCivil(competenciaV3Agora().hoje)) return invalido("Nao registre recebimento em uma data futura.");
      const formaPagamento = String(req.body?.formaPagamento ?? "").trim().toUpperCase();
      const referencia = String(req.body?.referencia ?? "").trim();
      const observacoes = String(req.body?.observacoes ?? "").trim();
      if (!formaPagamento || formaPagamento.length > 80 || referencia.length > 150 || observacoes.length > 2000) {
        return invalido("Informe forma de recebimento e confira os limites de referencia e observacoes.");
      }
      const resultado = await prisma.$transaction(async (tx) => {
        const identificacao = await tx.parcelaFinanceiraV3.findUnique({ where: { id: parcelaId },
          select: { tituloId: true } });
        if (!identificacao) throw new ErroV3(404, "Parcela nao encontrada.");
        await tx.$queryRaw`SELECT "id" FROM "TituloFinanceiroV3" WHERE "id" = ${identificacao.tituloId} FOR UPDATE`;
        const parcela = await tx.parcelaFinanceiraV3.findFirst({
          where: { id: parcelaId, titulo: { organizacaoId: u.organizacaoId,
            natureza: "A_RECEBER", canceladoEm: null } },
          include: { baixas: true },
        });
        if (!parcela || parcela.canceladaEm) throw new ErroV3(404, "Parcela nao disponivel para baixa.");
        // Referencia de comprovante evita duplicacao acidental do mesmo documento
        // na mesma parcela. Recebimentos sem referencia exigem conferencia humana.
        if (referencia && parcela.baixas.some((b) => !b.estornadoEm && b.referencia === referencia)) {
          throw new ErroV3(409, "Ja existe uma baixa ativa com essa referencia nesta parcela.");
        }
        const previsto = centavosV3(parcela.valorPrevisto.toString()) ?? 0n;
        const recebido = parcela.baixas.reduce((s, b) => s + (!b.estornadoEm ?
          (centavosV3(b.valor.toString()) ?? 0n) : 0n), 0n);
        if (recebido + valor > previsto) throw new ErroV3(409,
          `Valor maior que o saldo da parcela (R$ ${dinheiroV3(previsto > recebido ? previsto - recebido : 0n)}). Atualize a tela.`);
        const baixa = await tx.baixaFinanceiraV3.create({ data: {
          parcelaId, valor: dinheiroV3(valor), dataEfetiva,
          formaPagamento, referencia: referencia || null, observacoes: observacoes || null,
          registradoPorId: u.id,
        }, select: { id: true, valor: true, dataEfetiva: true } });
        return { baixa, saldo: dinheiroV3(previsto - recebido - valor) };
      });
      res.status(201).json({ mensagem: "Recebimento registrado na data efetiva, sem alterar a competencia do exame.", ...resultado });
    } catch (erro) { responderErro(res, erro); }
  });

  // Estorno preserva a baixa original; apenas um administrador pode executa-lo.
  router.post("/financeiro/baixas/:id/estornar", proteger("terceirizacao.financeiro.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      await verificarAdministradorFinanceiroV3(req, u.organizacaoId);
      const id = numero(req.params.id);
      if (!id) return invalido("Recebimento invalido.");
      const motivo = String(req.body?.motivo ?? "").trim();
      if (motivo.length < 10 || motivo.length > 1000) return invalido("Informe justificativa de 10 a 1000 caracteres.");
      const resultado = await prisma.$transaction(async (tx) => {
        const identificacao = await tx.baixaFinanceiraV3.findUnique({ where: { id },
          select: { parcela: { select: { tituloId: true } } } });
        if (!identificacao) throw new ErroV3(404, "Recebimento nao encontrado.");
        await tx.$queryRaw`SELECT "id" FROM "TituloFinanceiroV3" WHERE "id" = ${identificacao.parcela.tituloId} FOR UPDATE`;
        const baixa = await tx.baixaFinanceiraV3.findFirst({ where: {
          id, parcela: { titulo: { organizacaoId: u.organizacaoId,
            natureza: "A_RECEBER", canceladoEm: null } },
        }, select: { id: true, estornadoEm: true } });
        if (!baixa) throw new ErroV3(404, "Recebimento nao encontrado nesta organizacao.");
        if (baixa.estornadoEm) throw new ErroV3(409, "Este recebimento ja foi estornado.");
        return tx.baixaFinanceiraV3.update({ where: { id }, data: {
          estornadoEm: new Date(), estornadoPorId: u.id, motivoEstorno: motivo,
        }, select: { id: true, estornadoEm: true } });
      });
      res.json({ mensagem: "Recebimento estornado. Historico preservado.", baixa: resultado });
    } catch (erro) { responderErro(res, erro); }
  });

  // Reparcelamento/alteracao de vencimentos somente antes de QUALQUER baixa,
  // inclusive as posteriormente estornadas. A versao antiga fica na auditoria.
  router.put("/financeiro/titulos/:id/parcelas", proteger("terceirizacao.financeiro.editar"), async (req, res) => {
    try {
      const u = usuarioDaRequisicao(req);
      await verificarAdministradorFinanceiroV3(req, u.organizacaoId);
      const id = numero(req.params.id);
      if (!id) return invalido("Titulo invalido.");
      const motivo = String(req.body?.motivo ?? "").trim();
      if (motivo.length < 10 || motivo.length > 1000) return invalido("Informe justificativa de 10 a 1000 caracteres.");
      const bruto = req.body?.parcelas;
      if (!Array.isArray(bruto) || bruto.length < 1 || bruto.length > 24) {
        return invalido("Informe entre 1 e 24 parcelas.");
      }
      const plano = bruto.map((p: { valor?: unknown; vencimento?: unknown }) => ({
        valor: centavosV3(p?.valor), vencimento: dataCivil(p?.vencimento),
      }));
      if (plano.some((p) => !p.valor)) return invalido("Todas as parcelas precisam de valor positivo.");
      const soma = plano.reduce((s, p) => s + (p.valor ?? 0n), 0n);
      const atualizado = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "TituloFinanceiroV3" WHERE "id" = ${id} FOR UPDATE`;
        const titulo = await tx.tituloFinanceiroV3.findFirst({ where: {
          id, organizacaoId: u.organizacaoId, natureza: "A_RECEBER", canceladoEm: null,
        }, include: { parcelas: { include: { baixas: true }, orderBy: { numero: "asc" } },
          exame: { select: { producao: { select: { dataRealizacao: true } } } } } });
        if (!titulo) throw new ErroV3(404, "Titulo nao encontrado.");
        if (titulo.parcelas.some((p) => p.baixas.length > 0)) throw new ErroV3(409,
          "Titulo com recebimentos registrados: nao e permitido reprogramar parcelas, mesmo apos estorno.");
        if (plano.some((p) => p.vencimento < titulo.exame.producao.dataRealizacao)) {
          return invalido("Vencimento nao pode anteceder a realizacao do exame.");
        }
        const devido = centavosV3(titulo.valorDevido.toString()) ?? 0n;
        if (soma !== devido) throw new ErroV3(409,
          `A soma das parcelas deve ser exatamente R$ ${dinheiroV3(devido)}.`);
        const antes = titulo.parcelas.filter((p) => !p.canceladaEm).map((p) => ({
          numero: p.numero, vencimento: p.vencimento.toISOString().slice(0, 10),
          valor: p.valorPrevisto.toString(),
        }));
        const depois = plano.map((p, i) => ({ numero: i + 1,
          vencimento: p.vencimento.toISOString().slice(0, 10), valor: dinheiroV3(p.valor ?? 0n) }));
        if (JSON.stringify(antes) === JSON.stringify(depois)) throw new ErroV3(409, "Nenhuma mudanca na programacao de parcelas.");
        await tx.parcelaFinanceiraV3.deleteMany({ where: { tituloId: id } });
        await tx.parcelaFinanceiraV3.createMany({ data: depois.map((p) => ({
          tituloId: id, numero: p.numero, vencimento: dataCivil(p.vencimento), valorPrevisto: p.valor,
        })) });
        await tx.auditoriaTituloV3.create({ data: {
          tituloId: id, usuarioId: u.id, motivo,
          dadosAnteriores: { parcelas: antes }, dadosNovos: { parcelas: depois },
        } });
        return depois;
      });
      res.json({ mensagem: "Parcelas reprogramadas e alteracao registrada na auditoria.", parcelas: atualizado });
    } catch (erro) { responderErro(res, erro); }
  });

  // Equipe e bonificacoes V3: nenhuma consulta de repasses ou dados financeiros V1.
  type BonusBanco = Pick<PrismaClient,"usuario"|"terceirizacaoExame"|"regraBonificacaoV3"|"fechamentoBonificacaoV3"|"itemBonificacaoV3"|"eventoBonificacaoV3"|"$queryRaw">;
  async function bonusAdmin(req: Request, obrigatorio=false) {
    const u=usuarioDaRequisicao(req);
    const p=await prisma.usuario.findFirst({where:{id:u.id,organizacaoId:u.organizacaoId,ativo:true},select:{perfil:true}});
    const admin=p?.perfil==="ADMINISTRADOR";
    if(obrigatorio && !admin) throw new ErroV3(403,"Somente administrador pode alterar bonificacoes.");
    return admin;
  }
  async function bonusTravar(tx: BonusBanco, org:number) {
    await tx.$queryRaw`SELECT id FROM "Organizacao" WHERE id = ${org} FOR UPDATE`;
  }
  const bonusSelecao={id:true,executadoPorId:true,tipoExame:true,status:true,classificacaoBonificacaoV3:true,laudoEnviadoEm:true,laudoRecebidoEm:true,laudoEntregueEm:true,codigoInterno:true,producao:{select:{dataRealizacao:true,clinica:{select:{nome:true}}}},executadoPor:{select:{nome:true}}} as const;
  async function bonusDados(db:BonusBanco,org:number,mes:string,funcionarioId?:number) {
    const {inicio,fim}=intervaloMesV3(mes);
    const escopo={producao:{organizacaoId:org},...(funcionarioId?{executadoPorId:funcionarioId}:{})};
    // Janela ampliada em UTC; a competencia final e determinada pelo horario civil de SP.
    const [producao,entregues,regras,fechamento]=await Promise.all([
      db.terceirizacaoExame.findMany({where:{...escopo,producao:{organizacaoId:org,dataRealizacao:{gte:inicio,lt:fim}}},select:bonusSelecao}),
      db.terceirizacaoExame.findMany({where:{...escopo,status:"ENTREGUE",laudoEntregueEm:{gte:somarDiasV3(inicio,-1),lt:somarDiasV3(fim,1)}},select:bonusSelecao}),
      db.regraBonificacaoV3.findMany({where:{organizacaoId:org,...(funcionarioId?{funcionarioId}:{})},select:{id:true,funcionarioId:true,tipoExame:true,inicioVigencia:true,valor:true}}),
      db.fechamentoBonificacaoV3.findUnique({where:{organizacaoId_competencia:{organizacaoId:org,competencia:mes}},select:{id:true,situacao:true,revisao:true,vencimento:true,pagoEm:true,feriadosLocais:true,itens:{where:funcionarioId?{funcionarioId}:{},select:{exameId:true,funcionarioId:true,tipoExame:true,valor:true,concluidoEm:true}}}}),
    ]);
    const concluidos=entregues.filter(e=>e.laudoEntregueEm && bonusDiaV3(e.laudoEntregueEm).slice(0,7)===mes);
    return {producao,concluidos,regras,fechamento,calculado:bonusCalcularV3(concluidos,regras,mes)};
  }
  function bonusMotivo(valor:unknown) {
    const m=String(valor??"").trim(); if(m.length<5||m.length>500) return invalido("Informe justificativa de 5 a 500 caracteres."); return m;
  }
  router.get("/equipe",proteger("terceirizacao.equipe.visualizar"),async(req,res)=>{
    try {
      const u=usuarioDaRequisicao(req), admin=await bonusAdmin(req);
      const mes=String(req.query.competencia??competenciaV3Agora().mes);
      intervaloMesV3(mes);
      if(mes>competenciaV3Agora().mes)return invalido("Competencia futura indisponivel.");
      const d=await bonusDados(prisma,u.organizacaoId,mes,admin?undefined:u.id);
      const congelado=d.fechamento && d.fechamento.situacao!=="REABERTO";
      const itens=congelado?d.fechamento!.itens.map(i=>({...i,valor:i.valor.toString()})):d.calculado.itens;
      const funcionarios=admin?await prisma.usuario.findMany({where:{organizacaoId:u.organizacaoId},select:{id:true,nome:true,ativo:true},orderBy:{nome:"asc"}}):await prisma.usuario.findMany({where:{id:u.id,organizacaoId:u.organizacaoId},select:{id:true,nome:true,ativo:true}});
      const linhas=funcionarios.map(f=>{
        const p=d.producao.filter(e=>e.executadoPorId===f.id), i=itens.filter(e=>e.funcionarioId===f.id);
        return {id:f.id,nome:f.nome,ativo:f.ativo,realizados:p.filter(e=>e.status!=="CANCELADO").length,
          originais:p.filter(e=>e.status!=="CANCELADO"&&e.classificacaoBonificacaoV3==="ORIGINAL").length,
          repeticoes:p.filter(e=>e.status!=="CANCELADO"&&e.classificacaoBonificacaoV3==="REPETICAO").length,
          naoConferidos:p.filter(e=>e.status!=="CANCELADO"&&e.classificacaoBonificacaoV3==="NAO_CONFERIDO").length,
          aguardando:p.filter(e=>e.status!=="CANCELADO"&&e.status!=="ENTREGUE").length,
          porExame:MODALIDADES.map(tipo=>({tipo,realizados:p.filter(e=>e.tipoExame===tipo&&e.status!=="CANCELADO").length,bonificados:i.filter(e=>e.tipoExame===tipo).length})),
          bonificados:i.length,valor:dinheiroV3(i.reduce((s,e)=>s+(bonusCentavosV3(e.valor)??0n),0n)),pendencias:congelado?0:d.calculado.pendencias.filter(e=>e.funcionarioId===f.id).length};
      }).filter(f=>admin||f.id===u.id);
      const exames=admin?[...new Map([...d.producao,...d.concluidos].map(e=>[e.id,e])).values()].filter(e=>e.status!=="CANCELADO").map(e=>({id:e.id,codigo:e.codigoInterno,tipo:e.tipoExame,clinica:e.producao.clinica.nome,realizacao:e.producao.dataRealizacao,funcionarioId:e.executadoPorId,classificacao:e.classificacaoBonificacaoV3,status:e.status,pendencia:congelado?null:d.calculado.pendencias.find(p=>p.exameId===e.id)?.motivo??null})):[];
      const f=d.fechamento;
      const historico=admin&&f?await prisma.eventoBonificacaoV3.findMany({where:{organizacaoId:u.organizacaoId,fechamentoId:f.id},orderBy:{id:"desc"},select:{id:true,acao:true,motivo:true,criadoEm:true,usuario:{select:{nome:true}}}}):[];
      res.json({admin,competencia:mes,atual:competenciaV3Agora().mes,funcionarios,linhas,exames,pendencias:congelado?0:d.calculado.pendencias.length,
        total:dinheiroV3(itens.reduce((s,e)=>s+(bonusCentavosV3(e.valor)??0n),0n)),
        fechamento:f?{id:f.id,situacao:f.situacao,revisao:f.revisao,vencimento:f.vencimento,pagoEm:f.pagoEm,feriadosLocais:f.feriadosLocais}:null,historico});
    } catch(erro){responderErro(res,erro);}
  });
  router.get("/equipe/exames/:id/historico",proteger("terceirizacao.equipe.visualizar"),async(req,res)=>{
    try {await bonusAdmin(req,true);const u=usuarioDaRequisicao(req),id=numero(req.params.id);
      if(!id)return invalido("Exame invalido.");
      if(!await prisma.terceirizacaoExame.findFirst({where:{id,producao:{organizacaoId:u.organizacaoId}},select:{id:true}}))throw new ErroV3(404,"Exame indisponivel.");
      const historico=await prisma.eventoBonificacaoV3.findMany({where:{organizacaoId:u.organizacaoId,exameId:id},orderBy:{id:"desc"},select:{id:true,acao:true,motivo:true,dados:true,criadoEm:true,usuario:{select:{nome:true}}}});
      res.json({historico});
    }catch(erro){responderErro(res,erro);}
  });
  router.get("/equipe/regras",proteger("terceirizacao.equipe.visualizar"),async(req,res)=>{
    try {await bonusAdmin(req,true); const u=usuarioDaRequisicao(req);
      const regras=await prisma.regraBonificacaoV3.findMany({where:{organizacaoId:u.organizacaoId},orderBy:[{inicioVigencia:"desc"},{id:"desc"}],select:{id:true,funcionarioId:true,tipoExame:true,valor:true,inicioVigencia:true}});
      res.json({regras});
    }catch(erro){responderErro(res,erro);}
  });
  router.post("/equipe/regras",proteger("terceirizacao.equipe.visualizar"),async(req,res)=>{
    try {await bonusAdmin(req,true); const u=usuarioDaRequisicao(req);
      const inicioVigencia=dataCivil(req.body?.inicioVigencia), motivo=bonusMotivo(req.body?.motivo);
      const lista:unknown=req.body?.regras;
      if(!Array.isArray(lista)||lista.length<1||lista.length>1000)return invalido("Informe entre 1 e 1000 valores.");
      const chaves=new Set<string>();
      const regras=lista.map(r=>{const funcionarioId=numero(r?.funcionarioId), tipoExame=r?.tipoExame as Modalidade, valor=bonusCentavosV3(r?.valor);
        if(!funcionarioId||!MODALIDADES.includes(tipoExame)||valor===null)return invalido("Funcionario, exame ou valor invalido.");
        const chave=`${funcionarioId}/${tipoExame}`;if(chaves.has(chave))return invalido("Regra duplicada no lote.");chaves.add(chave);
        return {funcionarioId,tipoExame,valor:dinheiroV3(valor)};});
      const total=await prisma.$transaction(async tx=>{
        await bonusTravar(tx,u.organizacaoId);
        const ids=[...new Set(regras.map(r=>r.funcionarioId))];
        if(await tx.usuario.count({where:{organizacaoId:u.organizacaoId,id:{in:ids}}})!==ids.length)return invalido("Funcionario fora da organizacao.");
        // Vigencias sao novas versoes. Uma mesma data nao sobrescreve a regra antiga.
        for(const r of regras){
          const anterior=await tx.regraBonificacaoV3.findUnique({where:{organizacaoId_funcionarioId_tipoExame_inicioVigencia:{organizacaoId:u.organizacaoId,funcionarioId:r.funcionarioId,tipoExame:r.tipoExame,inicioVigencia}}});
          if(anterior)throw new ErroV3(409,"Ja existe regra nesta vigencia. Escolha uma nova data; valores fechados nao serao recalculados.");
        }
        await tx.regraBonificacaoV3.createMany({data:regras.map(r=>({...r,organizacaoId:u.organizacaoId,inicioVigencia,criadoPorId:u.id}))});
        await tx.eventoBonificacaoV3.create({data:{organizacaoId:u.organizacaoId,usuarioId:u.id,acao:"REGRAS",motivo,dados:{inicioVigencia:inicioVigencia.toISOString().slice(0,10),regras}}});
        return regras.length;
      },{timeout:60000});res.json({mensagem:`${total} regra(s) cadastrada(s).`});
    }catch(erro){responderErro(res,erro);}
  });
  router.patch("/equipe/exames/:id",proteger("terceirizacao.equipe.visualizar"),async(req,res)=>{
    try {await bonusAdmin(req,true);const u=usuarioDaRequisicao(req),id=numero(req.params.id),funcionarioId=numero(req.body?.funcionarioId),classificacao=req.body?.classificacao, motivo=bonusMotivo(req.body?.motivo);
      if(!id||!funcionarioId||(classificacao!=="ORIGINAL"&&classificacao!=="REPETICAO"))return invalido("Informe exame, executor e classificacao.");
      await prisma.$transaction(async tx=>{
        await bonusTravar(tx,u.organizacaoId);
        const e=await tx.terceirizacaoExame.findFirst({where:{id,producao:{organizacaoId:u.organizacaoId}},select:bonusSelecao});
        if(!e||e.status==="CANCELADO")throw new ErroV3(404,"Exame indisponivel.");
        if(!await tx.usuario.findFirst({where:{id:funcionarioId,organizacaoId:u.organizacaoId},select:{id:true}}))return invalido("Executor invalido.");
        if(e.laudoEntregueEm){const f=await tx.fechamentoBonificacaoV3.findUnique({where:{organizacaoId_competencia:{organizacaoId:u.organizacaoId,competencia:bonusDiaV3(e.laudoEntregueEm).slice(0,7)}}});if(f&&f.situacao!=="REABERTO")throw new ErroV3(409,"Reabra a competencia antes de corrigir; fechamento pago e imutavel.");}
        await tx.terceirizacaoExame.update({where:{id},data:{executadoPorId:funcionarioId,classificacaoBonificacaoV3:classificacao}});
        await tx.eventoBonificacaoV3.create({data:{organizacaoId:u.organizacaoId,exameId:id,usuarioId:u.id,acao:"CLASSIFICACAO",motivo,dados:{antes:{funcionarioId:e.executadoPorId,classificacao:e.classificacaoBonificacaoV3},depois:{funcionarioId,classificacao}}}});
      });res.json({mensagem:"Classificacao e executor atualizados com auditoria."});
    }catch(erro){responderErro(res,erro);}
  });
  router.post("/equipe/fechamento",proteger("terceirizacao.equipe.visualizar"),async(req,res)=>{
    try {await bonusAdmin(req,true);const u=usuarioDaRequisicao(req),mes=String(req.body?.competencia??""),acao=String(req.body?.acao??""),motivo=bonusMotivo(req.body?.motivo);
      intervaloMesV3(mes);if(mes>=competenciaV3Agora().mes)return invalido("Fechamento permitido somente apos terminar a competencia.");
      if(!["FECHAR","APROVAR","REABRIR","PAGAR"].includes(acao))return invalido("Acao invalida.");
      await prisma.$transaction(async tx=>{
        await bonusTravar(tx,u.organizacaoId);
        const chave={organizacaoId_competencia:{organizacaoId:u.organizacaoId,competencia:mes}};
        const anterior=await tx.fechamentoBonificacaoV3.findUnique({where:chave,include:{itens:true}});
        if(acao==="FECHAR"){
          if(anterior&&anterior.situacao!=="REABERTO")throw new ErroV3(409,"Competencia ja fechada.");
          const d=await bonusDados(tx,u.organizacaoId,mes);
          if(d.calculado.pendencias.length)throw new ErroV3(409,`Resolva ${d.calculado.pendencias.length} pendencia(s) antes do fechamento.`);
          const entrada=req.body?.feriadosLocais??[];
          if(!Array.isArray(entrada)||entrada.length>60)return invalido("Lista de feriados invalida.");
          const feriadosLocais=[...new Set<string>(entrada.map(x=>dataCivil(x).toISOString().slice(0,10)))];
          const vencimento=bonusVencimentoV3(mes,feriadosLocais);
          const f=anterior?await tx.fechamentoBonificacaoV3.update({where:{id:anterior.id},data:{situacao:"FECHADO",revisao:{increment:1},vencimento,feriadosLocais,fechadoEm:new Date(),aprovadoEm:null,pagoEm:null}}):await tx.fechamentoBonificacaoV3.create({data:{organizacaoId:u.organizacaoId,competencia:mes,vencimento,feriadosLocais}});
          if(anterior)await tx.itemBonificacaoV3.deleteMany({where:{fechamentoId:f.id}});
          if(d.calculado.itens.length)await tx.itemBonificacaoV3.createMany({data:d.calculado.itens.map(i=>({...i,fechamentoId:f.id}))});
          await tx.eventoBonificacaoV3.create({data:{organizacaoId:u.organizacaoId,fechamentoId:f.id,usuarioId:u.id,acao,motivo,dados:{revisao:f.revisao,vencimento:vencimento.toISOString().slice(0,10),quantidade:d.calculado.itens.length,total:dinheiroV3(d.calculado.itens.reduce((s,i)=>s+(bonusCentavosV3(i.valor)??0n),0n))}}});
          return;
        }
        if(!anterior)throw new ErroV3(409,"Feche a competencia primeiro.");
        if(acao==="APROVAR"&&anterior.situacao==="FECHADO")await tx.fechamentoBonificacaoV3.update({where:{id:anterior.id},data:{situacao:"APROVADO",aprovadoEm:new Date()}});
        else if(acao==="REABRIR"&&(anterior.situacao==="FECHADO"||anterior.situacao==="APROVADO"))await tx.fechamentoBonificacaoV3.update({where:{id:anterior.id},data:{situacao:"REABERTO",aprovadoEm:null}});
        else if(acao==="PAGAR"&&anterior.situacao==="APROVADO"){
          const pagoEm=dataCivil(req.body?.pagoEm);if(pagoEm>dataCivil(competenciaV3Agora().hoje)||pagoEm<intervaloMesV3(mes).fim)return invalido("Data de pagamento invalida.");
          await tx.fechamentoBonificacaoV3.update({where:{id:anterior.id},data:{situacao:"PAGO",pagoEm}});
        }else throw new ErroV3(409,"Acao nao permitida no estado atual. Fechamento pago e imutavel.");
        await tx.eventoBonificacaoV3.create({data:{organizacaoId:u.organizacaoId,fechamentoId:anterior.id,usuarioId:u.id,acao,motivo,dados:{revisao:anterior.revisao,situacaoAnterior:anterior.situacao,...(acao==="REABRIR"?{itens:anterior.itens.map(i=>({exameId:i.exameId,funcionarioId:i.funcionarioId,regraId:i.regraId,valor:i.valor.toString(),tipoExame:i.tipoExame,concluidoEm:i.concluidoEm.toISOString()}))}:{}),...(acao==="PAGAR"?{pagoEm:String(req.body?.pagoEm)}:{})}}});
      },{timeout:60000});res.json({mensagem:"Fechamento atualizado com auditoria."});
    }catch(erro){responderErro(res,erro);}
  });

  // O middleware de login do server.ts ja foi aplicado antes deste registro.
  app.use("/terceirizacao", router);
}
