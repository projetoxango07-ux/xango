/**
 * V1.2 – boleto e PIX parcelado com baixa manual individual.
 * Um plano NAO representa receita recebida. So a baixa de uma parcela
 * gera Pagamento e MovimentacaoConta, com a data efetiva do credito.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";

type Contexto = {
  organizacaoAtualId: () => number;
  usuarioAtualId: () => number;
  podeOperar: (req: Request) => boolean;
  podeVerSaldoBancario: (req: Request) => boolean;
  recalcularGuia: (tx: any, guiaId: number) => Promise<any>;
};
class Falha extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function exigir(valor: unknown, mensagem: string, status = 400): asserts valor {
  if (!valor) throw new Falha(mensagem, status);
}
function idPositivo(valor: unknown): number {
  const n = Number(valor);
  exigir(Number.isSafeInteger(n) && n > 0, "Identificador inválido.");
  return n;
}
function centavos(valor: unknown): number {
  const numero = typeof valor === "string" ? Number(valor.replace(",", ".")) : Number(valor);
  exigir(Number.isFinite(numero) && numero > 0 && numero <= 10000000, "Valor inválido.");
  const total = Math.round(numero * 100);
  exigir(Math.abs(numero * 100 - total) < 0.00001, "Informe no máximo duas casas decimais.");
  return total;
}
function moeda(c: number): number { return c / 100; }
function hojeSP(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const p = Object.fromEntries(partes.map(item => [item.type, item.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function dataValida(valor: unknown): Date {
  exigir(typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor), "Data inválida; use AAAA-MM-DD.");
  const [a,m,d] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(a,m-1,d));
  exigir(data.getUTCFullYear() === a && data.getUTCMonth() + 1 === m && data.getUTCDate() === d, "Data inválida.");
  // Meio-dia de Sao Paulo evita deslocamento de um dia em DATETIME e DATE.
  return new Date(`${valor}T12:00:00-03:00`);
}
function avancarMes(data: Date, meses: number): Date {
  const ano = data.getUTCFullYear(), mes = data.getUTCMonth(), dia = data.getUTCDate();
  const primeiro = new Date(Date.UTC(ano, mes + meses, 1));
  const ultimo = new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth()+1, 0)).getUTCDate();
  return new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth(), Math.min(dia,ultimo)));
}
function numero(valor: unknown) { return Number(valor || 0); }
function valorLiquidoParcela(parcela: any) {
  const bruto = (parcela.pagamentos || []).reduce((s: number, p: any) => s + numero(p.valor), 0);
  const estornos = (parcela.pagamentos || []).reduce((s: number,p: any) => s + (p.estornos || []).reduce((t: number,e: any) => t + numero(e.valor),0),0);
  return Math.max(0, Math.round((bruto - estornos) * 100));
}
const incluirParcelas = {
  parcelas: { orderBy: { numero: "asc" as const }, include: {
    pagamentos: { include: { estornos: { select: { valor: true } } } },
  } },
};
async function buscarPlanos(tx: any, guiaId: number, organizacaoId: number) {
  return tx.planoParcelamento.findMany({
    where: { guiaId, organizacaoId, ativo: true },
    include: incluirParcelas, orderBy: { criadoEm: "asc" },
  });
}
function resumoPlanos(planos: any[]) {
  return planos.map((plano: any) => ({
    id: plano.id, forma: plano.forma, valorTotal: numero(plano.valorTotal),
    numeroParcelas: plano.numeroParcelas, criadoEm: plano.criadoEm,
    parcelas: plano.parcelas.map((parcela: any) => {
      const pagoCentavos = valorLiquidoParcela(parcela);
      const previstoCentavos = Math.round(numero(parcela.valorPrevisto) * 100);
      const saldoCentavos = Math.max(0, previstoCentavos - pagoCentavos);
      const vencimento = parcela.vencimento.toISOString().slice(0,10);
      return { id: parcela.id, numero: parcela.numero, vencimento,
        valorPrevisto: moeda(previstoCentavos), recebido: moeda(pagoCentavos),
        saldo: moeda(saldoCentavos), status: saldoCentavos < 1 ? "RECEBIDA" : pagoCentavos > 0 ? "PARCIALMENTE_RECEBIDA" : "PENDENTE",
        atrasada: saldoCentavos > 0 && vencimento < hojeSP(),
      };
    }),
  }));
}
function pendenteEmCentavos(planos: any[]) {
  return planos.reduce((s,p) => s + p.parcelas.reduce((t: number,parcela: any) =>
    t + Math.max(0, Math.round(numero(parcela.valorPrevisto) * 100) - valorLiquidoParcela(parcela)), 0), 0);
}
async function guiaAutorizada(tx: any, guiaId: number, orgId: number) {
  const guia = await tx.guia.findFirst({ where: { id: guiaId, OR: [
    { organizacaoId: orgId },
    { organizacaoId: null, atendimento: { OR: [{ organizacaoId: orgId }, ...(orgId === 1 ? [{ organizacaoId: null }] : [])] } },
  ] }, include: { pagamentos: { include: { estornos: { select: { valor: true } } } }, itens: { select: { status: true } } } });
  exigir(guia, "Guia não encontrada para sua organização.", 404);
  exigir(guia.itens.some((item: any) => item.status !== "CANCELADO"), "Guia sem procedimentos ativos.");
  return guia;
}
function saldoLivreCentavos(guia: any, planos: any[]) {
  const recebidos = guia.pagamentos.reduce((s: number,p: any) => s + numero(p.valor) -
    (p.estornos || []).reduce((t: number,e: any) => t + numero(e.valor),0),0);
  return Math.max(0, Math.round((numero(guia.valorFinal) - recebidos) * 100) - pendenteEmCentavos(planos));
}
function responderErro(res: Response, erro: unknown) {
  if (erro instanceof Falha) return res.status(erro.status).json({ erro: erro.message });
  const codigo = (erro as {code?: string})?.code;
  if (codigo === "P2034" || codigo === "P2002") return res.status(409).json({ erro: "Conflito financeiro. Atualize e confira antes de repetir." });
  console.error("Parcelamento manual V1.2:", erro);
  return res.status(500).json({ erro: "Não foi possível concluir a operação financeira." });
}
/**
 * O voucher pode ser liberado quando o valor ainda devido está integralmente
 * coberto por parcelas ativas. Isso NÃO equivale a pagamento nem quitação.
 * Se uma parcela for cancelada, estornada ou a guia mudar de valor, a
 * elegibilidade será recalculada na próxima consulta.
 */
export function temCoberturaParcelamentoV12(
  planos: any[],
  saldoFinanceiro: number,
): boolean {
  const saldoCentavos = Math.round(Math.max(0, saldoFinanceiro) * 100);
  if (saldoCentavos <= 0 || planos.length === 0) return false;

  let cobertura = 0;
  for (const plano of planos) {
    if (!plano.ativo || (plano.forma !== "BOLETO" && plano.forma !== "PIX_PARCELADO")) continue;
    for (const parcela of plano.parcelas || []) {
      if (parcela.status === "CANCELADA") continue;
      const previsto = Math.round(numero(parcela.valorPrevisto) * 100);
      const recebido = valorLiquidoParcela(parcela);
      cobertura += Math.max(0, previsto - recebido);
    }
  }
  return cobertura > 0 && cobertura === saldoCentavos;
}

export function criarRotasParcelamentosV12(prisma: PrismaClient, contexto: Contexto) {
  const router = Router();
  router.get("/guia/:guiaId", async (req,res) => {
    try {
      const guiaId = idPositivo(req.params.guiaId);
      const org = contexto.organizacaoAtualId();
      const guia = await guiaAutorizada(prisma, guiaId, org);
      const planos = await buscarPlanos(prisma, guiaId, org);
      const autorizadoBanco = contexto.podeVerSaldoBancario(req);
      const contas = autorizadoBanco ? await prisma.contaFinanceira.findMany({
        where: { organizacaoId: org, ativo: true, tipo: { in: ["BANCO","CARTEIRA_DIGITAL"] } },
        select: { id: true, nome: true, tipo: true }, orderBy: { nome: "asc" },
      }) : [];
      return res.json({ planos: resumoPlanos(planos), saldoLivre: moeda(saldoLivreCentavos(guia,planos)),
        comprometido: moeda(pendenteEmCentavos(planos)), contas, podeDarBaixa: autorizadoBanco && contexto.podeOperar(req) });
    } catch (erro) { return responderErro(res,erro); }
  });
  router.post("/guia/:guiaId", async (req,res) => {
    try {
      exigir(contexto.podeOperar(req),"Sem permissão para registrar parcelamentos.",403);
      const guiaId = idPositivo(req.params.guiaId), org = contexto.organizacaoAtualId();
      const forma = String(req.body?.forma || "");
      exigir(forma === "BOLETO" || forma === "PIX_PARCELADO", "Selecione boleto ou PIX parcelado.");
      const quantidade = Number(req.body?.parcelas);
      exigir(Number.isSafeInteger(quantidade) && quantidade >= 1 && quantidade <= 24, "Informe entre 1 e 24 parcelas.");
      const primeiroVencimento = dataValida(req.body?.primeiroVencimento);
      const valorCentavos = centavos(req.body?.valorTotal);
      exigir(valorCentavos >= quantidade, "Cada parcela precisa ter pelo menos R$ 0,01.");
      const obs = String(req.body?.observacao || "").trim();
      exigir(obs.length <= 500, "Observação muito longa.");
      const criado = await prisma.$transaction(async (tx: any) => {
        // Serializar criacoes concorrentes da mesma guia, inclusive em navegadores diferentes.
        await tx.$queryRaw`SELECT "id" FROM "Guia" WHERE "id" = ${guiaId} FOR UPDATE`;
        const guia = await guiaAutorizada(tx, guiaId, org);
        const planos = await buscarPlanos(tx, guiaId, org);
        exigir(valorCentavos <= saldoLivreCentavos(guia,planos), "Valor supera o saldo livre da guia (há valores já recebidos ou programados).",409);
        const base = Math.floor(valorCentavos / quantidade), resto = valorCentavos % quantidade;
        const parcelas = Array.from({length:quantidade},(_,i) => ({
          numero:i+1, vencimento:avancarMes(primeiroVencimento,i),
          valorPrevisto: moeda(base + (i < resto ? 1 : 0)),
        }));
        return tx.planoParcelamento.create({ data: {
          organizacaoId:org, guiaId, forma: forma as "BOLETO"|"PIX_PARCELADO",
          descricaoForma:forma === "BOLETO" ? "Boleto parcelado" : "PIX parcelado",
          valorTotal:moeda(valorCentavos), numeroParcelas:quantidade,
          observacao:obs || null, parcelas:{create:parcelas},
        }, include:incluirParcelas });
      }, { isolationLevel: "Serializable" });
      return res.status(201).json({ plano:resumoPlanos([criado])[0] });
    } catch(erro) { return responderErro(res,erro); }
  });
  router.post("/:planoId/parcelas/:parcelaId/baixa", async (req,res) => {
    try {
      exigir(contexto.podeOperar(req) && contexto.podeVerSaldoBancario(req),
        "A baixa bancária exige permissão financeira e autorização para contas bancárias.",403);
      const planoId=idPositivo(req.params.planoId), parcelaId=idPositivo(req.params.parcelaId), org=contexto.organizacaoAtualId();
      const contaId=idPositivo(req.body?.contaFinanceiraId);
      const data=dataValida(req.body?.dataRecebimento || hojeSP());
      exigir(data.toISOString().slice(0,10) <= hojeSP(), "Não é permitido registrar recebimento em data futura.");
      const observacao=String(req.body?.observacao || "").trim();
      exigir(observacao.length <= 500, "Observação muito longa.");
      const resultado=await prisma.$transaction(async(tx:any) => {
        await tx.$queryRaw`SELECT "id" FROM "ParcelaReceber" WHERE "id" = ${parcelaId} FOR UPDATE`;
        const parcela=await tx.parcelaReceber.findFirst({
          where:{ id:parcelaId, planoParcelamentoId:planoId, planoParcelamento:{ organizacaoId:org, ativo:true } },
          include:{ planoParcelamento:true, pagamentos:{include:{estornos:{select:{valor:true}}}} },
        });
        exigir(parcela,"Parcela não encontrada ou cancelada.",404);
        exigir(parcela.status !== "CANCELADA", "Esta parcela está cancelada.",409);
        const conta=await tx.contaFinanceira.findFirst({where:{id:contaId,organizacaoId:org,ativo:true,
          tipo:{in:["BANCO","CARTEIRA_DIGITAL"]}}});
        exigir(conta,"Selecione uma conta bancária/digital ativa da organização.");
        const valorPrevisto=Math.round(numero(parcela.valorPrevisto)*100);
        const saldo=valorPrevisto-valorLiquidoParcela(parcela);
        exigir(saldo>0,"Parcela já recebida. Atualize antes de tentar novamente.",409);
        const guia=await guiaAutorizada(tx,parcela.planoParcelamento.guiaId,org);
        const recebidoGuia = guia.pagamentos.reduce((total: number, pg: any) => total + Number(pg.valor) -
          pg.estornos.reduce((st: number, est: any) => st + Number(est.valor),0),0);
        exigir(Math.round(recebidoGuia*100)+saldo <= Math.round(Number(guia.valorFinal)*100),
          "O total da guia foi alterado. Revise o parcelamento antes da baixa.",409);
        // O valor previsto foi reservado na criacao: a baixa substitui compromisso por dinheiro.
        const pagamento=await tx.pagamento.create({data:{
          guiaId:guia.id, parcelaReceberId:parcela.id, forma:parcela.planoParcelamento.forma,
          parcelas:1, valor:moeda(saldo), contaFinanceiraId:conta.id,
          contaFinanceiraNome:conta.nome, formaRecebimentoNome:parcela.planoParcelamento.descricaoForma,
          valorTarifa:0,valorLiquido:moeda(saldo),taxaPercentualAplicada:0,taxaFixaAplicada:0,
          dataRecebimento:data,registradoPorId:contexto.usuarioAtualId(),observacao:observacao || null,
        }});
        await tx.movimentacaoConta.create({data:{organizacaoId:org, contaFinanceiraId:conta.id,
          tipo:"ENTRADA",origem:"PAGAMENTO", valor:moeda(saldo),pagamentoId:pagamento.id,
          dataMovimentacao:data,descricao:`Baixa parcela ${parcela.numero}/${parcela.planoParcelamento.numeroParcelas} • guia #${guia.id}`,
        }});
        await tx.parcelaReceber.update({where:{id:parcela.id},data:{status:"RECEBIDA"}});
        const financeiro=await contexto.recalcularGuia(tx,guia.id);
        return { pagamentoId:pagamento.id, valorRecebido:moeda(saldo), financeiro };
      },{isolationLevel:"Serializable"});
      return res.status(201).json(resultado);
    } catch(erro) { return responderErro(res,erro); }
  });
  router.get("/alertas", async(req,res) => {
    try {
      const org=contexto.organizacaoAtualId();
      const dias=Math.max(0,Math.min(90,Number(req.query.dias) || 7));
      const ate=new Date(Date.UTC(new Date(hojeSP()+"T12:00:00Z").getUTCFullYear(),
        new Date(hojeSP()+"T12:00:00Z").getUTCMonth(),new Date(hojeSP()+"T12:00:00Z").getUTCDate()+dias));
      const parcelas=await prisma.parcelaReceber.findMany({where:{
        status:{in:["PENDENTE","PARCIALMENTE_RECEBIDA"]},
        vencimento:{lte:ate},planoParcelamento:{organizacaoId:org,ativo:true},
      },include:{planoParcelamento:{select:{id:true,forma:true,guia:{select:{id:true,atendimentoId:true,codigoPublico:true}}}},
        pagamentos:{include:{estornos:{select:{valor:true}}}}},orderBy:{vencimento:"asc"},take:100});
      const lista=parcelas.map(p=>{
        const previsto=Math.round(numero(p.valorPrevisto)*100);
        const saldo=previsto-valorLiquidoParcela(p);
        return {id:p.id,guiaId:p.planoParcelamento.guia.id,atendimentoId:p.planoParcelamento.guia.atendimentoId,
          numero:p.numero,forma:p.planoParcelamento.forma,vencimento:p.vencimento.toISOString().slice(0,10),saldo:moeda(Math.max(saldo,0)),
          vencida:p.vencimento.toISOString().slice(0,10)<hojeSP()};
      }).filter(p=>p.saldo>0);
      return res.json({vencidas:lista.filter(p=>p.vencida),proximas:lista.filter(p=>!p.vencida)});
    }catch(erro){return responderErro(res,erro);}
  });
  return router;
}
