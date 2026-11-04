/**
 * Digna Conect V1.2 — movimentos financeiros e caixa.
 * Rotas montadas sob /financeiro/v12, DEPOIS dos middlewares globais de
 * autenticação e autorização definidos em server.ts.
 * Requer o schema V1.2 e sua migration aplicados no banco de desenvolvimento.
 */
import { Router } from "express";
import type { Response, Request } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";

type ContextoFinanceiro = {
  organizacaoAtualId: () => number;
  usuarioAtualId: () => number;
  podeVerSaldoBancario: (req: Request) => boolean;
  podeOperar: (req: Request) => boolean;
  podeSupervisionarCaixas: (req: Request) => boolean;
};

class RejeicaoFinanceira extends Error {
  constructor(mensagem: string, public readonly status = 400) {
    super(mensagem);
  }
}

function exigir(condicao: unknown, mensagem: string, status = 400): asserts condicao {
  if (!condicao) throw new RejeicaoFinanceira(mensagem, status);
}

function inteiroPositivo(valor: unknown, campo: string): number {
  const numero = Number(valor);
  exigir(Number.isSafeInteger(numero) && numero > 0, `${campo} inválido.`);
  return numero;
}

function valorMonetario(valor: unknown): number {
  const numero = typeof valor === "string" ? Number(valor.trim().replace(",", ".")) : Number(valor);
  exigir(Number.isFinite(numero) && numero > 0 && numero <= 10000000, "Informe um valor positivo válido.");
  const centavos = Math.round(numero * 100);
  exigir(Math.abs(numero * 100 - centavos) < 0.000001, "O valor deve ter no máximo duas casas decimais.");
  return centavos / 100;
}

function valorNaoNegativo(valor: unknown, campo: string): number {
  const numero = typeof valor === "string" ? Number(valor.trim().replace(",", ".")) : Number(valor);
  exigir(Number.isFinite(numero) && numero >= 0 && numero <= 10000000, `${campo} inválido.`);
  const centavos = Math.round(numero * 100);
  exigir(Math.abs(numero * 100 - centavos) < 0.000001, `${campo} deve ter no máximo duas casas decimais.`);
  return centavos / 100;
}

function texto(valor: unknown, campo: string, limite: number, obrigatorio = false): string | null {
  const resultado = typeof valor === "string" ? valor.trim() : "";
  exigir(resultado.length <= limite, `${campo} deve ter no máximo ${limite} caracteres.`);
  exigir(!obrigatorio || resultado.length > 0, `Informe ${campo}.`);
  return resultado || null;
}

// Datas de negócio são calendários brasileiros, NÃO instantes de lançamento.
// O meio-dia de SP mantém a data correta em colunas PostgreSQL @db.Date.
function dataCalendario(valor: unknown, campo: string, padraoHoje = false): Date {
  const entrada = valor === undefined && padraoHoje ? diaAtualSaoPaulo() : valor;
  exigir(typeof entrada === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entrada), `${campo}: use AAAA-MM-DD.`);
  const [ano, mes, dia] = entrada.split("-").map(Number);
  const conferida = new Date(Date.UTC(ano, mes - 1, dia));
  exigir(
    conferida.getUTCFullYear() === ano && conferida.getUTCMonth() + 1 === mes && conferida.getUTCDate() === dia,
    `${campo} inválida.`,
  );
  return new Date(`${entrada}T12:00:00-03:00`);
}

function diaAtualSaoPaulo(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const componentes = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${componentes.year}-${componentes.month}-${componentes.day}`;
}

function diaDoBanco(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function erroApi(erro: unknown, res: Response, operacao: string) {
  if (erro instanceof RejeicaoFinanceira) {
    return res.status(erro.status).json({ erro: erro.message });
  }
  // Erro Prisma de conflito/serialização é devolvido para revisão manual, sem repetir transação financeira.
  const codigo = (erro as { code?: string })?.code;
  if (codigo === "P2002" || codigo === "P2034") {
    return res.status(409).json({ erro: "Conflito financeiro. Atualize a página e confira antes de tentar novamente." });
  }
  console.error(`Erro V1.2 (${operacao}):`, erro);
  return res.status(500).json({ erro: `Não foi possível ${operacao}.` });
}

type Tx = Pick<PrismaClient,
  | "contaFinanceira"
  | "movimentacaoConta"
  | "sessaoCaixa"
  | "despesaFinanceira"
  | "transferenciaFinanceira"
  | "retiradaSocio"
  | "auditoriaFinanceira"
>;

async function contaDaOrganizacao(tx: Tx, organizacaoId: number, contaId: number) {
  const conta = await tx.contaFinanceira.findFirst({
    where: { id: contaId, organizacaoId, ativo: true },
  });
  exigir(conta, "Conta financeira não encontrada ou inativa.", 404);
  return conta;
}

async function caixaAberto(tx: Tx, organizacaoId: number, contaId: number, usuarioId: number) {
  const sessao = await tx.sessaoCaixa.findFirst({
    where: { organizacaoId, contaFinanceiraId: contaId, abertoPorId: usuarioId, status: "ABERTA" },
    orderBy: { abertoEm: "desc" },
  });
  exigir(sessao, "Abra o caixa físico antes de registrar a movimentação.", 409);
  exigir(diaDoBanco(sessao.dataMovimento) === diaAtualSaoPaulo(), "Existe um caixa aberto de outra data. Faça o fechamento antes de continuar.", 409);
  return sessao;
}

async function sessaoObrigatoriaSeCaixa(
  tx: Tx, organizacaoId: number,
  conta: { id: number; tipo: string; responsavelCaixaId: number | null }, usuarioId: number,
) {
  if (conta.tipo !== "CAIXA") return null;
  exigir(conta.responsavelCaixaId === usuarioId,
    "Este caixa pertence a outro funcionário ou ainda não está vinculado. Use seu próprio caixa.", 403);
  return (await caixaAberto(tx, organizacaoId, conta.id, usuarioId)).id;
}

async function saldoCentavos(tx: Tx, organizacaoId: number, conta: { id: number; saldoInicial: unknown }) {
  const grupos = await tx.movimentacaoConta.groupBy({
    by: ["tipo"], where: { organizacaoId, contaFinanceiraId: conta.id }, _sum: { valor: true },
  });
  return grupos.reduce(
    (centavos, grupo) => centavos + (grupo.tipo === "ENTRADA" ? 1 : -1) * Math.round(Number(grupo._sum.valor || 0) * 100),
    Math.round(Number(conta.saldoInicial) * 100),
  );
}

async function verificarDisponibilidadeCaixa(tx: Tx, organizacaoId: number, conta: { id: number; tipo: string; saldoInicial: unknown }, valor: number) {
  if (conta.tipo !== "CAIXA") return;
  const saldo = await saldoCentavos(tx, organizacaoId, conta);
  exigir(saldo >= Math.round(valor * 100), "O saldo registrado do caixa físico é insuficiente.", 409);
}

async function gravarAuditoria(
  tx: Tx,
  organizacaoId: number,
  usuarioId: number,
  entidade: string,
  registroId: number,
  dadosNovos: Record<string, string | number | boolean | null>,
) {
  await tx.auditoriaFinanceira.create({
    data: { organizacaoId, usuarioId, entidade, registroId, acao: "CRIACAO", dadosNovos },
  });
}

function soAdministracao(req: { usuarioAutenticado?: { perfil?: string } }) {
  exigir(
    req.usuarioAutenticado?.perfil === "ADMINISTRADOR" || req.usuarioAutenticado?.perfil === "DESENVOLVEDOR",
    "Esta operação exige perfil de administrador.", 403,
  );
}

export function criarRotasFinanceiroV12(prisma: PrismaClient, contexto: ContextoFinanceiro) {
  const rotas = Router();
  // Permissão no servidor é obrigatória: ocultar cartões no frontend não protege saldos.
  function exigirPermissaoBanco(req: Request, conta: { tipo: string; responsavelCaixaId?: number | null }) {
    if (conta.tipo === "CAIXA") {
      exigir(conta.responsavelCaixaId === contexto.usuarioAtualId(),
        "Este caixa não pertence ao usuário conectado.", 403);
    } else {
      exigir(contexto.podeVerSaldoBancario(req),
        "Você não possui permissão para movimentar ou consultar contas bancárias.", 403);
    }
  }
  function permitirConsultarSessao(req: Request, abertoPorId: number) {
    exigir(abertoPorId === contexto.usuarioAtualId() || contexto.podeSupervisionarCaixas(req),
      "Você só pode consultar seu próprio caixa.", 403);
  }


  // Leitura simples: contas e saldos consolidados pelo livro de movimentos.
  rotas.get("/contas", async (req, res) => {
    try {
      const organizacaoId = contexto.organizacaoAtualId();
      const contas = await prisma.contaFinanceira.findMany({
        where: { organizacaoId, ...(contexto.podeVerSaldoBancario(req)
          ? {} : { tipo: "CAIXA", responsavelCaixaId: contexto.usuarioAtualId() }) },
        orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      });
      const grupos = await prisma.movimentacaoConta.groupBy({
        by: ["contaFinanceiraId", "tipo"], where: { organizacaoId }, _sum: { valor: true },
      });
      return res.json({
        podeVerSaldoBancario: contexto.podeVerSaldoBancario(req),
        podeOperar: contexto.podeOperar(req),
        minhaContaCaixaId: contas.find((conta) => conta.tipo === "CAIXA" &&
          conta.responsavelCaixaId === contexto.usuarioAtualId())?.id || null,
        contas: contas.map((conta) => {
        const centavos = grupos.filter((g) => g.contaFinanceiraId === conta.id).reduce(
          (acum, g) => acum + (g.tipo === "ENTRADA" ? 1 : -1) * Math.round(Number(g._sum.valor || 0) * 100),
          Math.round(Number(conta.saldoInicial) * 100),
        );
        return { id: conta.id, nome: conta.nome, tipo: conta.tipo, ativo: conta.ativo,
          responsavelCaixaId: conta.responsavelCaixaId,
          saldoInicial: Number(conta.saldoInicial), saldoCalculado: centavos / 100 };
      }) });
    } catch (erro) { return erroApi(erro, res, "consultar contas financeiras"); }
  });

  rotas.get("/movimentacoes", async (req, res) => {
    try {
      const organizacaoId = contexto.organizacaoAtualId();
      const contaId = req.query.contaId ? inteiroPositivo(req.query.contaId, "Conta") : undefined;
      const limiteRecebido = req.query.limite === undefined ? 100 : Number(req.query.limite);
      exigir(Number.isSafeInteger(limiteRecebido) && limiteRecebido >= 1 && limiteRecebido <= 200, "Limite inválido.");
      if (contaId) {
        const conta = await prisma.contaFinanceira.findFirst({ where: { id: contaId, organizacaoId } });
        exigir(conta, "Conta não encontrada.", 404);
        exigirPermissaoBanco(req, conta);
      }
      const movimentos = await prisma.movimentacaoConta.findMany({
        where: { organizacaoId, ...(contaId ? { contaFinanceiraId: contaId } : {}),
          ...(contexto.podeVerSaldoBancario(req) ? {} : { contaFinanceira: { tipo: "CAIXA", responsavelCaixaId: contexto.usuarioAtualId() } }) },
        include: { contaFinanceira: { select: { nome: true } } },
        orderBy: [{ dataMovimentacao: "desc" }, { id: "desc" }], take: limiteRecebido,
      });
      return res.json({ movimentacoes: movimentos.map((m) => ({
        id: m.id, contaFinanceiraId: m.contaFinanceiraId, conta: m.contaFinanceira.nome,
        tipo: m.tipo, origem: m.origem, valor: Number(m.valor), descricao: m.descricao,
        dataMovimentacao: m.dataMovimentacao, registradoEm: m.criadoEm,
      })) });
    } catch (erro) { return erroApi(erro, res, "consultar movimentações"); }
  });

  // Despesas: lançadas contra uma conta própria. Nunca são tratadas como recebimento.
  rotas.post("/despesas", async (req, res) => {
    try {
      const organizacaoId = contexto.organizacaoAtualId();
      const usuarioId = contexto.usuarioAtualId();
      const contaId = inteiroPositivo(req.body?.contaFinanceiraId, "Conta");
      const valor = valorMonetario(req.body?.valor);
      const descricao = texto(req.body?.descricao, "a descrição da despesa", 240, true)!;
      const categoria = texto(req.body?.categoria, "Categoria", 100);
      const data = dataCalendario(req.body?.dataPagamento, "Data do pagamento", true);
      const documentoReferencia = texto(req.body?.documentoReferencia, "Documento", 120);
      const comprovanteReferencia = texto(req.body?.comprovanteReferencia, "Comprovante", 240);
      const resultado = await prisma.$transaction(async (tx) => {
        const conta = await contaDaOrganizacao(tx, organizacaoId, contaId);
        exigirPermissaoBanco(req, conta);
        const sessaoCaixaId = await sessaoObrigatoriaSeCaixa(tx, organizacaoId, conta, usuarioId);
        if (sessaoCaixaId) exigir(diaDoBanco(data) === diaAtualSaoPaulo(), "Despesas do caixa aberto devem usar a data de hoje.");
        await verificarDisponibilidadeCaixa(tx, organizacaoId, conta, valor);
        const despesa = await tx.despesaFinanceira.create({ data: {
          organizacaoId, contaFinanceiraId: contaId, descricao, categoria, valor, dataPagamento: data,
          documentoReferencia, comprovanteReferencia, registradoPorId: usuarioId,
        } });
        const movimento = await tx.movimentacaoConta.create({ data: {
          organizacaoId, contaFinanceiraId: contaId, tipo: "SAIDA", origem: "DESPESA", valor,
          descricao: `Despesa #${despesa.id} • ${descricao}`, dataMovimentacao: data,
          despesaFinanceiraId: despesa.id, sessaoCaixaId,
        } });
        await gravarAuditoria(tx, organizacaoId, usuarioId, "DespesaFinanceira", despesa.id,
          { descricao, categoria, contaFinanceiraId: contaId, valor, dataPagamento: diaDoBanco(data), movimentoId: movimento.id });
        return { id: despesa.id, movimentoId: movimento.id };
      }, { isolationLevel: "Serializable" });
      return res.status(201).json({ ok: true, despesa: { ...resultado, valor, descricao, dataPagamento: diaDoBanco(data) } });
    } catch (erro) { return erroApi(erro, res, "registrar a despesa"); }
  });

  rotas.get("/despesas", async (req, res) => {
    try {
      const organizacaoId = contexto.organizacaoAtualId();
      const despesas = await prisma.despesaFinanceira.findMany({
        where: { organizacaoId,
          ...(contexto.podeVerSaldoBancario(req) ? {} : { contaFinanceira: { tipo: "CAIXA", responsavelCaixaId: contexto.usuarioAtualId() } }) }, orderBy: [{ dataPagamento: "desc" }, { id: "desc" }], take: 100,
        include: { contaFinanceira: { select: { nome: true } }, registradoPor: { select: { nome: true } } },
      });
      return res.json({ despesas: despesas.map((d) => ({
        id: d.id, descricao: d.descricao, categoria: d.categoria, valor: Number(d.valor),
        dataPagamento: diaDoBanco(d.dataPagamento), conta: d.contaFinanceira.nome,
        registradoPor: d.registradoPor.nome, canceladaEm: d.canceladaEm,
      })) });
    } catch (erro) { return erroApi(erro, res, "listar despesas"); }
  });

  // Transferência/depósito: saída + entrada na mesma transação, nunca faturamento.
  rotas.post("/transferencias", async (req, res) => {
    try {
      const organizacaoId = contexto.organizacaoAtualId();
      const usuarioId = contexto.usuarioAtualId();
      const origemId = inteiroPositivo(req.body?.contaOrigemId, "Conta de origem");
      const destinoId = inteiroPositivo(req.body?.contaDestinoId, "Conta de destino");
      exigir(origemId !== destinoId, "Origem e destino precisam ser contas diferentes.");
      const valor = valorMonetario(req.body?.valor);
      const data = dataCalendario(req.body?.dataEfetiva, "Data da transferência", true);
      const natureza = req.body?.natureza === "DEPOSITO" ? "DEPOSITO" : "ENTRE_CONTAS";
      const descricao = texto(req.body?.descricao, "Descrição", 240);
      const comprovanteReferencia = texto(req.body?.comprovanteReferencia, "Comprovante", 240);
      const resultado = await prisma.$transaction(async (tx) => {
        const origem = await contaDaOrganizacao(tx, organizacaoId, origemId);
        const destino = await contaDaOrganizacao(tx, organizacaoId, destinoId);
        exigirPermissaoBanco(req, origem);
        exigirPermissaoBanco(req, destino);
        if (natureza === "DEPOSITO") {
          exigir(origem.tipo === "CAIXA" && (destino.tipo === "BANCO" || destino.tipo === "CARTEIRA_DIGITAL"),
            "Depósito exige origem em caixa físico e destino bancário/digital.");
        }
        const sessaoOrigem = await sessaoObrigatoriaSeCaixa(tx, organizacaoId, origem, usuarioId);
        const sessaoDestino = await sessaoObrigatoriaSeCaixa(tx, organizacaoId, destino, usuarioId);
        if (sessaoOrigem || sessaoDestino) exigir(diaDoBanco(data) === diaAtualSaoPaulo(), "Movimentos do caixa devem utilizar a data de hoje.");
        await verificarDisponibilidadeCaixa(tx, organizacaoId, origem, valor);
        const transferencia = await tx.transferenciaFinanceira.create({ data: {
          organizacaoId, contaOrigemId: origemId, contaDestinoId: destinoId,
          natureza, valor, dataEfetiva: data, descricao, comprovanteReferencia, registradoPorId: usuarioId,
        } });
        await tx.movimentacaoConta.createMany({ data: [
          { organizacaoId, contaFinanceiraId: origemId, tipo: "SAIDA", origem: natureza === "DEPOSITO" ? "DEPOSITO" : "TRANSFERENCIA", valor,
            descricao: `Transferência #${transferencia.id} • para ${destino.nome}`, dataMovimentacao: data,
            transferenciaId: transferencia.id, sessaoCaixaId: sessaoOrigem },
          { organizacaoId, contaFinanceiraId: destinoId, tipo: "ENTRADA", origem: natureza === "DEPOSITO" ? "DEPOSITO" : "TRANSFERENCIA", valor,
            descricao: `Transferência #${transferencia.id} • de ${origem.nome}`, dataMovimentacao: data,
            transferenciaId: transferencia.id, sessaoCaixaId: sessaoDestino },
        ] });
        await gravarAuditoria(tx, organizacaoId, usuarioId, "TransferenciaFinanceira", transferencia.id,
          { contaOrigemId: origemId, contaDestinoId: destinoId, natureza, valor, dataEfetiva: diaDoBanco(data) });
        return transferencia.id;
      }, { isolationLevel: "Serializable" });
      return res.status(201).json({ ok: true, transferencia: { id: resultado, natureza, valor, dataEfetiva: diaDoBanco(data) } });
    } catch (erro) { return erroApi(erro, res, "registrar transferência"); }
  });

  // Retirada de sócio: regra deliberadamente restrita a administrador.
  rotas.post("/retiradas-socio", async (req, res) => {
    try {
      soAdministracao(req as typeof req & { usuarioAutenticado?: { perfil?: string } });
      const organizacaoId = contexto.organizacaoAtualId();
      const usuarioId = contexto.usuarioAtualId();
      const contaId = inteiroPositivo(req.body?.contaFinanceiraId, "Conta");
      const valor = valorMonetario(req.body?.valor);
      const socioNome = texto(req.body?.socioNome, "o nome do sócio", 160, true)!;
      const tipo = String(req.body?.tipo || "");
      const tiposPermitidos = ["PRO_LABORE", "DISTRIBUICAO_LUCROS", "ADIANTAMENTO", "OUTRA"] as const;
      exigir(tiposPermitidos.includes(tipo as typeof tiposPermitidos[number]), "Tipo de retirada inválido.");
      const competencia = req.body?.competencia ? dataCalendario(req.body.competencia, "Competência") : null;
      const data = dataCalendario(req.body?.dataEfetiva, "Data da retirada", true);
      const observacao = texto(req.body?.observacao, "Observação", 1000);
      const comprovanteReferencia = texto(req.body?.comprovanteReferencia, "Comprovante", 240);
      const id = await prisma.$transaction(async (tx) => {
        const conta = await contaDaOrganizacao(tx, organizacaoId, contaId);
        exigirPermissaoBanco(req, conta);
        const sessaoCaixaId = await sessaoObrigatoriaSeCaixa(tx, organizacaoId, conta, usuarioId);
        if (sessaoCaixaId) exigir(diaDoBanco(data) === diaAtualSaoPaulo(), "Retiradas do caixa devem utilizar a data de hoje.");
        await verificarDisponibilidadeCaixa(tx, organizacaoId, conta, valor);
        const retirada = await tx.retiradaSocio.create({ data: {
          organizacaoId, contaFinanceiraId: contaId, socioNome, tipo: tipo as typeof tiposPermitidos[number],
          competencia, valor, dataEfetiva: data, observacao, comprovanteReferencia, registradoPorId: usuarioId,
        } });
        await tx.movimentacaoConta.create({ data: {
          organizacaoId, contaFinanceiraId: contaId, tipo: "SAIDA", origem: "RETIRADA_SOCIO", valor,
          descricao: `${tipo.replaceAll("_", " ")} • ${socioNome}`, dataMovimentacao: data,
          retiradaSocioId: retirada.id, sessaoCaixaId,
        } });
        await gravarAuditoria(tx, organizacaoId, usuarioId, "RetiradaSocio", retirada.id,
          { socioNome, tipo, valor, contaFinanceiraId: contaId, dataEfetiva: diaDoBanco(data) });
        return retirada.id;
      }, { isolationLevel: "Serializable" });
      return res.status(201).json({ ok: true, retirada: { id, socioNome, tipo, valor, dataEfetiva: diaDoBanco(data) } });
    } catch (erro) { return erroApi(erro, res, "registrar retirada de sócio"); }
  });

  // Cada funcionário usa uma conta de caixa exclusiva. O primeiro acesso
  // cria o caixa pessoal zerado. O saldo contado não é uma nova receita:
  // precisa corresponder ao saldo contabilizado da conta.
  rotas.post("/caixas/abrir", async (req, res) => {
    try {
      const organizacaoId = contexto.organizacaoAtualId();
      const usuarioId = contexto.usuarioAtualId();
      const saldoInicialInformado = valorNaoNegativo(req.body?.saldoInicialInformado, "Saldo inicial");
      const observacaoAbertura = texto(req.body?.observacaoAbertura, "Observação", 500);
      const data = dataCalendario(diaAtualSaoPaulo(), "Data");
      const resultado = await prisma.$transaction(async (tx) => {
        const usuario = await prisma.usuario.findFirst({
          where: { id: usuarioId, organizacaoId, ativo: true }, select: { nome: true },
        });
        exigir(usuario, "Usuário não encontrado ou inativo.", 403);
        const caixaAnterior = await tx.sessaoCaixa.findFirst({
          where: { organizacaoId, abertoPorId: usuarioId, OR: [
            { status: "ABERTA" }, { dataMovimento: data },
          ] },
        });
        exigir(!caixaAnterior, "Você já possui um caixa aberto ou encerrado hoje.", 409);
        let conta = await tx.contaFinanceira.findFirst({
          where: { organizacaoId, responsavelCaixaId: usuarioId },
        });
        if (!conta) {
          conta = await tx.contaFinanceira.create({ data: {
            organizacaoId, responsavelCaixaId: usuarioId, tipo: "CAIXA", ativo: true,
            nome: `Caixa de ${usuario.nome} (#${usuarioId})`.slice(0, 100), saldoInicial: 0,
          } });
        }
        exigir(conta.tipo === "CAIXA" && conta.ativo, "Seu caixa individual está inativo ou inválido.", 409);
        const ocupado = await tx.sessaoCaixa.findFirst({ where: {
          organizacaoId, contaFinanceiraId: conta.id,
          OR: [{ status: "ABERTA" }, { dataMovimento: data }],
        } });
        exigir(!ocupado, "Este caixa já possui abertura no dia ou está em uso.", 409);
        const saldoRegistrado = await saldoCentavos(tx, organizacaoId, conta);
        exigir(saldoRegistrado === Math.round(saldoInicialInformado * 100),
          `Saldo contado (${saldoInicialInformado.toFixed(2)}) diferente do saldo registrado (${(saldoRegistrado / 100).toFixed(2)}). Regularize a diferença antes de abrir.`, 409);
        const sessao = await tx.sessaoCaixa.create({ data: {
          organizacaoId, contaFinanceiraId: conta.id, dataMovimento: data,
          saldoInicialInformado, observacaoAbertura, abertoPorId: usuarioId,
        } });
        await gravarAuditoria(tx, organizacaoId, usuarioId, "SessaoCaixa", sessao.id,
          { contaFinanceiraId: conta.id, dataMovimento: diaDoBanco(data), saldoInicialInformado, responsavelId: usuarioId });
        return { id: sessao.id, contaFinanceiraId: conta.id };
      }, { isolationLevel: "Serializable" });
      return res.status(201).json({ ok: true, sessaoCaixaId: resultado.id,
        contaFinanceiraId: resultado.contaFinanceiraId, dataMovimento: diaDoBanco(data) });
    } catch (erro) { return erroApi(erro, res, "abrir o caixa individual"); }
  });

  rotas.get("/caixas", async (req, res) => {
    try {
      const organizacaoId = contexto.organizacaoAtualId();
      const sessoes = await prisma.sessaoCaixa.findMany({
        where: { organizacaoId, ...(contexto.podeSupervisionarCaixas(req) ? {} : {
          abertoPorId: contexto.usuarioAtualId(),
        }) }, orderBy: [{ abertoEm: "desc" }, { id: "desc" }], take: 60,
        include: { contaFinanceira: { select: { nome: true } }, abertoPor: { select: { nome: true } }, fechadoPor: { select: { nome: true } } },
      });
      return res.json({ sessoes: sessoes.map((s) => ({
        id: s.id, contaFinanceiraId: s.contaFinanceiraId, conta: s.contaFinanceira.nome,
        status: s.status, dataMovimento: diaDoBanco(s.dataMovimento),
        saldoInicialInformado: Number(s.saldoInicialInformado),
        saldoFinalEsperado: s.saldoFinalEsperado === null ? null : Number(s.saldoFinalEsperado),
        saldoFinalContado: s.saldoFinalContado === null ? null : Number(s.saldoFinalContado),
        diferenca: s.diferenca === null ? null : Number(s.diferenca),
        abertoEm: s.abertoEm, fechadoEm: s.fechadoEm, abertoPor: s.abertoPor.nome, fechadoPor: s.fechadoPor?.nome || null,
      })) });
    } catch (erro) { return erroApi(erro, res, "consultar os caixas"); }
  });

  // Prévia e fechamento usam TODAS as movimentações efetivamente lançadas
  // no caixa desde a abertura (incluindo pagamentos legados, sem sessaoCaixaId).
  async function calcularMovimentosSessao(tx: Tx, sessao: { organizacaoId: number; contaFinanceiraId: number; abertoEm: Date }, agora: Date) {
    const movimentos = await tx.movimentacaoConta.findMany({
      where: {
        organizacaoId: sessao.organizacaoId,
        contaFinanceiraId: sessao.contaFinanceiraId,
        criadoEm: { gte: sessao.abertoEm, lte: agora },
      }, select: { id: true, tipo: true, valor: true, origem: true, descricao: true, criadoEm: true },
      orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
    });
    let entradasCentavos = 0;
    let saidasCentavos = 0;
    for (const m of movimentos) {
      if (m.tipo === "ENTRADA") entradasCentavos += Math.round(Number(m.valor) * 100);
      else saidasCentavos += Math.round(Number(m.valor) * 100);
    }
    return { entradas: entradasCentavos / 100, saidas: saidasCentavos / 100,
      movimentos: movimentos.map((m) => ({ ...m, valor: Number(m.valor) })) };
  }

  rotas.get("/caixas/:id/conferencia", async (req, res) => {
    try {
      const organizacaoId = contexto.organizacaoAtualId();
      const id = inteiroPositivo(req.params.id, "Caixa");
      const sessao = await prisma.sessaoCaixa.findFirst({ where: { id, organizacaoId } });
      exigir(sessao, "Sessão de caixa não encontrada.", 404);
      permitirConsultarSessao(req, sessao.abertoPorId);
      const [abridor, fechador, conta] = await Promise.all([
        prisma.usuario.findFirst({ where: { id: sessao.abertoPorId, organizacaoId }, select: { nome: true } }),
        sessao.fechadoPorId ? prisma.usuario.findFirst({ where: { id: sessao.fechadoPorId, organizacaoId }, select: { nome: true } }) : Promise.resolve(null),
        prisma.contaFinanceira.findFirst({ where: { id: sessao.contaFinanceiraId, organizacaoId }, select: { nome: true, tipo: true } }),
      ]);
      exigir(conta?.tipo === "CAIXA", "A sessão não corresponde a um caixa físico.", 409);
      const resumo = await calcularMovimentosSessao(prisma, sessao, sessao.fechadoEm || new Date());
      const saldoFinalEsperado = Math.round((Number(sessao.saldoInicialInformado) + resumo.entradas - resumo.saidas) * 100) / 100;
      return res.json({ sessaoId: id, status: sessao.status, dataMovimento: diaDoBanco(sessao.dataMovimento),
        conta: conta.nome, abertoPor: abridor?.nome || "Responsável não identificado",
        fechadoPor: fechador?.nome || null,
        abertoEm: sessao.abertoEm, fechadoEm: sessao.fechadoEm,
        observacaoAbertura: sessao.observacaoAbertura, observacaoFechamento: sessao.observacaoFechamento,
        saldoInicial: Number(sessao.saldoInicialInformado), ...resumo,
        saldoFinalEsperado: sessao.saldoFinalEsperado === null ? saldoFinalEsperado : Number(sessao.saldoFinalEsperado),
        saldoFinalContado: sessao.saldoFinalContado === null ? null : Number(sessao.saldoFinalContado),
        diferenca: sessao.diferenca === null ? null : Number(sessao.diferenca),
      });
    } catch (erro) { return erroApi(erro, res, "conferir o caixa"); }
  });

  rotas.post("/caixas/:id/fechar", async (req, res) => {
    try {
      const organizacaoId = contexto.organizacaoAtualId();
      const usuarioId = contexto.usuarioAtualId();
      const id = inteiroPositivo(req.params.id, "Caixa");
      const saldoFinalContado = valorNaoNegativo(req.body?.saldoFinalContado, "Saldo contado");
      const observacaoFechamento = texto(req.body?.observacaoFechamento, "Observação", 500);
      const resultado = await prisma.$transaction(async (tx) => {
        const sessao = await tx.sessaoCaixa.findFirst({ where: { id, organizacaoId } });
        exigir(sessao, "Sessão de caixa não encontrada.", 404);
        exigir(sessao.abertoPorId === usuarioId,
          "Somente o funcionário responsável pode fechar seu caixa.", 403);
        exigir(sessao.status === "ABERTA", "Este caixa já está fechado.", 409);
        const agora = new Date();
        const resumo = await calcularMovimentosSessao(tx, sessao, agora);
        const centavosEsperados = Math.round(Number(sessao.saldoInicialInformado) * 100) + Math.round(resumo.entradas * 100) - Math.round(resumo.saidas * 100);
        const centavosContados = Math.round(saldoFinalContado * 100);
        const saldoFinalEsperado = centavosEsperados / 100;
        const diferenca = (centavosContados - centavosEsperados) / 100;
        await tx.sessaoCaixa.update({ where: { id }, data: {
          status: "FECHADA", fechadoEm: agora, fechadoPorId: usuarioId,
          saldoFinalEsperado, saldoFinalContado, diferenca, observacaoFechamento,
        } });
        await tx.auditoriaFinanceira.create({ data: {
          organizacaoId, usuarioId, entidade: "SessaoCaixa", registroId: id, acao: "FECHAMENTO",
          dadosNovos: { saldoFinalEsperado, saldoFinalContado, diferenca, entradas: resumo.entradas, saidas: resumo.saidas },
        } });
        return { saldoFinalEsperado, saldoFinalContado, diferenca, entradas: resumo.entradas, saidas: resumo.saidas };
      }, { isolationLevel: "Serializable" });
      return res.json({ ok: true, sessaoId: id, ...resultado });
    } catch (erro) { return erroApi(erro, res, "fechar o caixa"); }
  });

  return rotas;
}
