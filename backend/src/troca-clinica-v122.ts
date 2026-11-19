/**
 * Digna Conect V1.2.2 — alteração integral de clínica de uma guia existente.
 * Não move pagamentos, estornos, recibos ou repasses e não cria voucher novo.
 * A simulação e a confirmação compartilham a mesma validação.
 */
import { Router } from "express";
import { createHash } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client.js";

type ContextoTroca = {
  organizacaoAtualId: () => number;
  usuarioAtualId: () => number;
  recalcularGuia: (tx: any, guiaId: number) => Promise<unknown>;
};

class ErroTroca extends Error {
  constructor(public readonly codigoHttp: number, mensagem: string) {
    super(mensagem);
  }
}

function exigir(condicao: unknown, mensagem: string, codigoHttp = 409): asserts condicao {
  if (!condicao) throw new ErroTroca(codigoHttp, mensagem);
}

function centavos(valor: unknown): number {
  const n = Number(valor);
  exigir(Number.isFinite(n) && n >= 0, "Valor financeiro inválido.", 400);
  return Math.round(n * 100);
}

function reais(valorCentavos: number): number {
  return valorCentavos / 100;
}

function dataAgendada(texto: unknown): Date {
  const valor = String(texto || "");
  exigir(/^\d{4}-\d{2}-\d{2}$/.test(valor), "Informe a data do novo agendamento.", 400);
  const data = new Date(`${valor}T12:00:00`);
  exigir(!Number.isNaN(data.getTime()) &&
    data.getFullYear() === Number(valor.slice(0, 4)) &&
    data.getMonth() + 1 === Number(valor.slice(5, 7)) &&
    data.getDate() === Number(valor.slice(8, 10)), "Data de agendamento inválida.", 400);
  return data;
}

export function criarRotasTrocaClinicaV122(prisma: PrismaClient, contexto: ContextoTroca) {
  const rotas = Router();

  async function executar(req: any, res: any, simular: boolean) {
    try {
      const guiaId = Number(req.params.id);
      const clinicaId = Number(req.body?.clinicaId);
      const unidadeClinicaId = req.body?.unidadeClinicaId === null ||
        req.body?.unidadeClinicaId === undefined || req.body?.unidadeClinicaId === ""
        ? null : Number(req.body.unidadeClinicaId);
      const motivo = String(req.body?.motivo || "").trim();
      const tipoAgendamento = String(req.body?.tipoAgendamento || "");
      const dataTexto = req.body?.dataAgendamento;
      const horarioTexto = String(req.body?.horarioAgendamento || "").trim();

      exigir(Number.isInteger(guiaId) && guiaId > 0, "Guia inválida.", 400);
      exigir(Number.isInteger(clinicaId) && clinicaId > 0, "Selecione a nova clínica.", 400);
      exigir(unidadeClinicaId === null || (Number.isInteger(unidadeClinicaId) && unidadeClinicaId > 0),
        "Unidade inválida.", 400);
      exigir(motivo.length >= 8 && motivo.length <= 500,
        "Informe um motivo de 8 a 500 caracteres.", 400);
      exigir(["AGUARDANDO", "HORARIO", "ORDEM_CHEGADA"].includes(tipoAgendamento),
        "Escolha como ficará o agendamento na nova clínica.", 400);
      if (tipoAgendamento === "AGUARDANDO") {
        exigir(!dataTexto && !horarioTexto, "Aguardando não deve ter data nem horário.", 400);
      }
      if (tipoAgendamento === "ORDEM_CHEGADA") {
        exigir(!horarioTexto, "Ordem de chegada não deve ter horário.", 400);
      }
      if (tipoAgendamento === "HORARIO") {
        exigir(/^([01]\d|2[0-3]):[0-5]\d$/.test(horarioTexto), "Horário inválido.", 400);
      }
      const novaData = tipoAgendamento === "AGUARDANDO" ? null : dataAgendada(dataTexto);
      const novoHorario = tipoAgendamento === "HORARIO" ? horarioTexto : null;
      const novoTipo = tipoAgendamento === "AGUARDANDO" ? null : tipoAgendamento as "HORARIO" | "ORDEM_CHEGADA";
      const organizacaoId = contexto.organizacaoAtualId();
      const usuarioId = contexto.usuarioAtualId();

      const resultado = await prisma.$transaction(async (tx) => {
        // Ordem de bloqueio: atendimento antes da guia, igual à edição convencional.
        await tx.$queryRaw`SELECT a."id" FROM "Atendimento" a JOIN "Guia" g ON g."atendimentoId" = a."id" WHERE g."id" = ${guiaId} FOR UPDATE OF a`;
        // A mesma linha é bloqueada nas operações financeiras da guia.
        await tx.$queryRaw`SELECT "id" FROM "Guia" WHERE "id" = ${guiaId} FOR UPDATE`;
        const guia = await tx.guia.findFirst({
          where: { id: guiaId, OR: [{ organizacaoId }, { organizacaoId: null }] },
          include: {
            atendimento: { select: { organizacaoId: true, status: true } },
            clinica: { select: { nome: true, documento: true } },
            unidadeClinica: { select: { nome: true } },
            itens: { orderBy: { id: "asc" } },
            pagamentos: { select: { id: true, valor: true } },
            estornos: { select: { id: true, valor: true } },
            repasses: { select: { id: true } },
            planosParcelamento: { where: { ativo: true }, select: { id: true } },
          },
        });
        exigir(guia, "Guia não encontrada.", 404);
        exigir(guia.atendimento.organizacaoId === organizacaoId ||
          guia.atendimento.organizacaoId === null, "Guia não encontrada.", 404);
        exigir(guia.atendimento.status !== "CANCELADO", "Atendimento cancelado não pode ser alterado.");
        exigir(guia.status !== "CANCELADA" && guia.status !== "ESTORNO_PENDENTE",
          "Guia cancelada ou com estorno pendente exige correção financeira específica.");
        exigir(guia.clinicaId !== clinicaId || (guia.unidadeClinicaId ?? null) !== unidadeClinicaId,
          "A clínica e a unidade selecionadas já são as atuais.", 400);
        exigir(guia.repasses.length === 0, "Guia vinculada a repasse. Regularize o repasse antes da troca.");
        exigir(!guia.realizadaEm && !guia.confirmadaEm &&
          guia.itens.every((item) => item.status === "ATIVO" && !item.realizadaEm && !item.confirmadaEm),
          "Existem procedimentos realizados ou confirmados. Utilize o fluxo administrativo de correção.");
        exigir(guia.itens.length > 0, "Guia sem procedimentos ativos.");
        exigir(guia.planosParcelamento.length === 0,
          "Guia com parcelamento ativo. Revise o plano financeiro antes de trocar a clínica.");

        const clinica = await tx.clinica.findFirst({
          where: { id: clinicaId, ativo: true },
          select: { id: true, nome: true, documento: true, unidades: { where: { ativo: true }, select: { id: true, nome: true } } },
        });
        exigir(clinica, "Clínica inexistente ou inativa.", 404);
        if (clinica.unidades.length > 0) {
          exigir(unidadeClinicaId !== null && clinica.unidades.some((u) => u.id === unidadeClinicaId),
            "Selecione uma unidade ativa da nova clínica.", 400);
        } else {
          exigir(unidadeClinicaId === null,
            "Esta clínica não possui unidades ativas; não informe unidade.", 400);
        }

        const itensNovos: { itemGuiaId: number; procedimentoId: number; quantidade: number;
          valorPacienteCentavos: number; valorRepasseCentavos: number }[] = [];
        for (const item of guia.itens) {
          exigir(Number.isInteger(item.quantidade) && item.quantidade > 0 && item.quantidade <= 100,
            "Quantidade de procedimento inválida. Corrija o cadastro antes da troca.");
          const precoBase = await tx.precoProcedimentoClinica.findFirst({
            where: { clinicaId, procedimentoId: item.procedimentoId, ativo: true,
              procedimento: { ativo: true } },
            select: { valorPaciente: true, valorRepasse: true },
          });
          exigir(precoBase, `A clínica não possui preço ativo para o procedimento ${item.procedimentoId}.`);
          let valorPaciente = precoBase.valorPaciente;
          let valorRepasse = precoBase.valorRepasse;
          if (unidadeClinicaId !== null) {
            const excecao = await tx.precoProcedimentoUnidade.findUnique({
              where: { unidadeClinicaId_procedimentoId: {
                unidadeClinicaId, procedimentoId: item.procedimentoId } },
              select: { valorPaciente: true, valorRepasse: true, ativo: true },
            });
            exigir(!excecao || excecao.ativo,
              `O procedimento ${item.procedimentoId} está inativo na unidade selecionada.`);
            if (excecao) {
              valorPaciente = excecao.valorPaciente;
              valorRepasse = excecao.valorRepasse;
            }
          }
          itensNovos.push({
            itemGuiaId: item.id,
            procedimentoId: item.procedimentoId,
            quantidade: item.quantidade,
            valorPacienteCentavos: centavos(valorPaciente) * item.quantidade,
            valorRepasseCentavos: centavos(valorRepasse) * item.quantidade,
          });
        }

        const subtotalNovo = itensNovos.reduce((total, item) => total + item.valorPacienteCentavos, 0);
        const repasseNovo = itensNovos.reduce((total, item) => total + item.valorRepasseCentavos, 0);
        const descontoOriginal = centavos(guia.desconto);
        const beneficioOriginal = centavos(guia.beneficio);
        const subtotalAnterior = centavos(guia.subtotal);
        exigir(subtotalAnterior > 0 || beneficioOriginal === 0,
          "Benefício original inconsistente. É necessária revisão administrativa.");
        const percentualBeneficioOriginal = subtotalAnterior > 0 ? beneficioOriginal / subtotalAnterior : 0;
        exigir(percentualBeneficioOriginal >= 0 && percentualBeneficioOriginal <= 1,
          "Benefício original inválido.");
        // Benefício mantém a proporção do documento original; desconto manual mantém o valor fixo.
        const beneficioNovo = Math.round(subtotalNovo * percentualBeneficioOriginal);
        exigir(subtotalNovo - beneficioNovo - descontoOriginal >= repasseNovo,
          "Os descontos e benefícios originais ultrapassam a margem da nova clínica. Solicite revisão administrativa.");
        const valorFinalNovo = subtotalNovo - beneficioNovo - descontoOriginal;
        const totalPago = guia.pagamentos.reduce((total, p) => total + centavos(p.valor), 0);
        const totalEstornado = guia.estornos.reduce((total, e) => total + centavos(e.valor), 0);
        exigir(totalPago >= totalEstornado, "Pagamentos e estornos da guia estão inconsistentes.");
        const pagoLiquido = totalPago - totalEstornado;
        const saldo = Math.max(valorFinalNovo - pagoLiquido, 0);
        const excedente = Math.max(pagoLiquido - valorFinalNovo, 0);
        const assinatura = createHash("sha256").update(JSON.stringify({
          id: guia.id, atualizadoEm: guia.atualizadoEm.toISOString(), clinicaId,
          unidadeClinicaId, motivo, tipoAgendamento, dataTexto: novaData?.toISOString() || null,
          horarioTexto: novoHorario, subtotalNovo, beneficioNovo, descontoOriginal,
          valorFinalNovo, totalPago, totalEstornado, itensNovos,
          pagamentos: guia.pagamentos.map((p) => [p.id, centavos(p.valor)]),
          estornos: guia.estornos.map((e) => [e.id, centavos(e.valor)]),
        })).digest("hex");

        const previsao = {
          guiaId: guia.id,
          codigoVoucher: guia.codigoPublico,
          clinicaAnteriorId: guia.clinicaId,
          clinicaAnteriorNome: guia.clinica.nome,
          novaClinicaId: clinica.id,
          novaClinicaNome: clinica.nome,
          unidadeNovaId: unidadeClinicaId,
          subtotalAnterior: reais(subtotalAnterior),
          valorAnterior: Number(guia.valorFinal),
          subtotalNovo: reais(subtotalNovo),
          valorNovo: reais(valorFinalNovo),
          descontoPreservado: reais(descontoOriginal),
          beneficioNovo: reais(beneficioNovo),
          pagoLiquido: reais(pagoLiquido),
          saldo: reais(saldo),
          excedenteARegularizar: reais(excedente),
          assinatura,
          aviso: "O voucher anterior deve ser comunicado como desatualizado. Reimprima a guia e avise o paciente e a clínica anterior; nenhum aviso será enviado automaticamente.",
        };
        if (simular) return { ...previsao, simulado: true };
        exigir(typeof req.body?.assinatura === "string" && req.body.assinatura === assinatura,
          "A guia, os preços ou o pedido mudaram após a simulação. Simule novamente.");

        const dadosAnteriores = {
          clinicaId: guia.clinicaId, clinicaNome: guia.clinica.nome, documentoClinica: guia.clinica.documento ?? null,
          unidadeClinicaId: guia.unidadeClinicaId,
          unidadeClinicaNome: guia.unidadeClinica?.nome || null,
          subtotal: Number(guia.subtotal), desconto: Number(guia.desconto),
          beneficio: Number(guia.beneficio), valorFinal: Number(guia.valorFinal),
          pagamentos: reais(totalPago), estornos: reais(totalEstornado),
          itens: guia.itens.map((item) => ({ id: item.id, procedimentoId: item.procedimentoId,
            valorPaciente: Number(item.valorPaciente), valorRepasse: Number(item.valorRepasse),
            tipoAgendamento: item.tipoAgendamento, dataAgendamento: item.dataAgendamento?.toISOString() || null,
            horarioAgendamento: item.horarioAgendamento })),
        };
        for (const novo of itensNovos) {
          await tx.itemGuia.update({
            where: { id: novo.itemGuiaId },
            data: {
              valorPaciente: reais(novo.valorPacienteCentavos),
              valorRepasse: reais(novo.valorRepasseCentavos),
              tipoAgendamento: novoTipo,
              dataAgendamento: novaData,
              horarioAgendamento: novoHorario,
            },
          });
        }
        await tx.guia.update({
          where: { id: guia.id },
          data: {
            clinicaId, unidadeClinicaId,
            subtotal: reais(subtotalNovo), desconto: reais(descontoOriginal),
            beneficio: reais(beneficioNovo), valorFinal: reais(valorFinalNovo),
          },
        });
        const financeiro = await contexto.recalcularGuia(tx, guia.id);
        await tx.atendimento.update({
          where: { id: guia.atendimentoId },
          data: { atualizadoEm: new Date() },
        });
        await tx.auditoriaFinanceira.create({
          data: {
            organizacaoId, usuarioId, entidade: "GUIA", registroId: guia.id,
            acao: "TROCA_CLINICA", motivo,
            dadosAnteriores,
            dadosNovos: {
              clinicaId, clinicaNome: clinica.nome, documentoClinica: clinica.documento ?? null, unidadeClinicaId,
              unidadeClinicaNome: clinica.unidades.find((u) => u.id === unidadeClinicaId)?.nome || null,
              subtotal: reais(subtotalNovo),
              desconto: reais(descontoOriginal), beneficio: reais(beneficioNovo),
              valorFinal: reais(valorFinalNovo), pagoLiquido: reais(pagoLiquido),
              saldo: reais(saldo), excedenteARegularizar: reais(excedente),
              tipoAgendamento: novoTipo, dataAgendamento: novaData?.toISOString() || null,
              horarioAgendamento: novoHorario,
              itens: itensNovos.map((item) => ({ id: item.itemGuiaId, procedimentoId: item.procedimentoId,
                valorPaciente: reais(item.valorPacienteCentavos), valorRepasse: reais(item.valorRepasseCentavos) })),
              avisoComunicacaoPendente: true,
            },
          },
        });
        return { ...previsao, simulado: false, financeiro };
      }, { isolationLevel: "Serializable" });
      return res.json(resultado);
    } catch (erro) {
      if (erro instanceof ErroTroca) return res.status(erro.codigoHttp).json({ erro: erro.message });
      console.error("Erro ao trocar clínica da guia:", erro);
      return res.status(500).json({ erro: "Não foi possível trocar a clínica da guia." });
    }
  }

  rotas.post("/:id/trocar-clinica/simular", (req, res) => void executar(req, res, true));
  rotas.post("/:id/trocar-clinica", (req, res) => void executar(req, res, false));
  return rotas;
}
