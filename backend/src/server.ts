import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

const app = express();
const PORT = 3333;

// Temporário enquanto o login ainda não está implementado.
// Depois estes valores virão do usuário autenticado.
const ORGANIZACAO_PADRAO_ID = 1;
const USUARIO_PADRAO_ID = 2;

function calcularValidadeGuia(dataBase = new Date()) {
  const validade = new Date(dataBase);
  validade.setMonth(validade.getMonth() + 6);
  return validade;
}

app.use(cors());
app.use(express.json());

function mapearFormaPagamento(
  forma: string | undefined
):
  | "PIX"
  | "DINHEIRO"
  | "CARTAO_CREDITO"
  | "CARTAO_DEBITO"
  | "TRANSFERENCIA"
  | "OUTRO" {
  const valor = (forma || "").toLowerCase();

  if (valor === "pix") return "PIX";
  if (valor === "dinheiro") return "DINHEIRO";
  if (valor === "credito") return "CARTAO_CREDITO";
  if (valor === "debito") return "CARTAO_DEBITO";
  if (valor === "transferencia") return "TRANSFERENCIA";

  return "OUTRO";
}

function calcularStatusGuia(
  statusRecebido: string | undefined,
  valorFinal: number,
  valorPago: number,
  valorEstornado: number
):
  | "RASCUNHO"
  | "AGUARDANDO_PAGAMENTO"
  | "PARCIALMENTE_PAGA"
  | "PAGA"
  | "ESTORNO_PENDENTE"
  | "CANCELADA" {
  if (statusRecebido === "CANCELADA") {
    return "CANCELADA";
  }

  if (statusRecebido === "RASCUNHO") {
    return "RASCUNHO";
  }

  const pagoLiquido = Math.max(valorPago - valorEstornado, 0);

  if (pagoLiquido > valorFinal) {
    return "ESTORNO_PENDENTE";
  }

  if (valorFinal > 0 && pagoLiquido >= valorFinal) {
    return "PAGA";
  }

  if (pagoLiquido > 0) {
    return "PARCIALMENTE_PAGA";
  }

  if (statusRecebido === "AGUARDANDO_PAGAMENTO") {
    return "AGUARDANDO_PAGAMENTO";
  }

  if (statusRecebido === "PARCIALMENTE_PAGA") {
    return "PARCIALMENTE_PAGA";
  }

  if (statusRecebido === "PAGA") {
    return "PAGA";
  }

  if (statusRecebido === "ESTORNO_PENDENTE") {
    return "ESTORNO_PENDENTE";
  }

  return "AGUARDANDO_PAGAMENTO";
}


// ======================================================
// TESTE DA API
// ======================================================

app.get("/", (_req, res) => {
  res.json({
    sistema: "Digna Conect",
    api: "online",
  });
});

// ======================================================
// CLÍNICAS
// ======================================================

app.get("/clinicas", async (_req, res) => {
  try {
    const clinicas = await prisma.clinica.findMany({
      where: {
        ativo: true,
      },
      include: {
        precos: {
          where: {
            ativo: true,
          },
          include: {
            procedimento: true,
          },
        },
      },
      orderBy: {
        nome: "asc",
      },
    });

    res.json(clinicas);
  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Não foi possível carregar as clínicas.",
    });
  }
});

// ======================================================
// PROCEDIMENTOS
// ======================================================

app.get("/procedimentos", async (_req, res) => {
  try {
    const procedimentos = await prisma.procedimento.findMany({
      where: {
        ativo: true,
      },
      include: {
        precos: {
          where: {
            ativo: true,
          },
          include: {
            clinica: true,
          },
        },
      },
      orderBy: {
        nome: "asc",
      },
    });

    res.json(procedimentos);
  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Não foi possível carregar os procedimentos.",
    });
  }
});

  // ======================================================
// PACIENTES
// ======================================================

app.get("/pacientes", async (_req, res) => {
  try {
    const pacientes = await prisma.paciente.findMany({
      include: {
        empresa: true,
      },
      orderBy: {
        nome: "asc",
      },
    });

    res.json(pacientes);
  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Não foi possível carregar os pacientes.",
    });
  }
});

// ======================================================
// CADASTRAR PACIENTE
// ======================================================

app.post("/pacientes", async (req, res) => {
  try {
    const {
      nome,
      cpf,
      telefone,
      email,
      dataNascimento,
    } = req.body;

    if (!nome?.trim() || !cpf?.trim() || !telefone?.trim()) {
      return res.status(400).json({
        erro: "Nome, CPF e telefone são obrigatórios.",
      });
    }

    const cpfLimpo = cpf.replace(/\D/g, "");

    const telefoneLimpo = telefone.replace(/\D/g, "");

    const nomePadronizado = nome
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase();

    const emailPadronizado = email?.trim()
      ? email.trim().toLowerCase()
      : null;

    const pacienteExistente = await prisma.paciente.findUnique({
      where: {
        cpf: cpfLimpo,
      },
    });

    if (pacienteExistente) {
      return res.status(409).json({
        erro: "Já existe um paciente cadastrado com este CPF.",
      });
    }

    const paciente = await prisma.paciente.create({
      data: {
        nome: nomePadronizado,
        cpf: cpfLimpo,
        telefone: telefoneLimpo,
        email: emailPadronizado,
        dataNascimento: dataNascimento
          ? new Date(`${dataNascimento}T12:00:00`)
          : null,
        beneficioAtivo: false,
      },
      include: {
        empresa: true,
      },
    });

    return res.status(201).json(paciente);
  } catch (erro) {
    console.error("Erro ao cadastrar paciente:", erro);

    return res.status(500).json({
      erro: "Não foi possível cadastrar o paciente.",
    });
  }
});

// ======================================================
// CRIAR ATENDIMENTO COMPLETO
// ======================================================

app.post("/atendimentos", async (req, res) => {
  try {
    const {
      pacienteId,
      etapaAtual,
      guias = [],
    } = req.body;

    if (!pacienteId) {
      return res.status(400).json({
        erro: "Paciente é obrigatório.",
      });
    }

    const paciente = await prisma.paciente.findUnique({
      where: {
        id: Number(pacienteId),
      },
    });

    if (!paciente) {
      return res.status(404).json({
        erro: "Paciente não encontrado.",
      });
    }

    const atendimento = await prisma.$transaction(async (tx) => {
      const novoAtendimento = await tx.atendimento.create({
        data: {
          pacienteId: Number(pacienteId),
          organizacaoId: ORGANIZACAO_PADRAO_ID,
          criadoPorId: USUARIO_PADRAO_ID,
          etapaAtual: Number(etapaAtual) || 1,
          status: "EM_ANDAMENTO",
        },
      });

      for (const guiaRecebida of guias) {
        const valorFinal = Number(guiaRecebida.valorFinal) || 0;
        const valorPago = Number(guiaRecebida.valorPago) || 0;
        const valorEstornado = Number(guiaRecebida.valorEstornado) || 0;

        const statusCalculado = calcularStatusGuia(
          guiaRecebida.status,
          valorFinal,
          valorPago,
          valorEstornado
        );

        const guia = await tx.guia.create({
          data: {
            atendimentoId: novoAtendimento.id,
            clinicaId: Number(guiaRecebida.clinicaId),
            organizacaoId: ORGANIZACAO_PADRAO_ID,
            geradaPorId: USUARIO_PADRAO_ID,

            status: statusCalculado,

            subtotal: Number(guiaRecebida.subtotal) || 0,
            desconto: Number(guiaRecebida.desconto) || 0,
            beneficio: Number(guiaRecebida.beneficio) || 0,
            valorFinal,

            emitidaEm: new Date(),
            validadeAte: calcularValidadeGuia(),
          },
        });

        for (const item of guiaRecebida.itens || []) {
          await tx.itemGuia.create({
            data: {
              guiaId: guia.id,
              procedimentoId: Number(item.procedimentoId),

              status: item.cancelado
                ? "CANCELADO"
                : "ATIVO",

              valorPaciente: Number(item.valorPaciente) || 0,
              valorRepasse: Number(item.valorRepasse) || 0,

              tipoAgendamento:
                item.tipoAgendamento === "horario"
                  ? "HORARIO"
                  : item.tipoAgendamento === "ordem"
                    ? "ORDEM_CHEGADA"
                    : null,

              dataAgendamento: item.dataAgendamento
                ? new Date(`${item.dataAgendamento}T12:00:00`)
                : null,

              horarioAgendamento:
                item.horarioAgendamento || null,

              canceladoEm: item.cancelado
                ? new Date()
                : null,

              motivoCancelamento: item.cancelado
                ? "Cancelado durante o atendimento"
                : null,
            },
          });
        }

        const todosItensCancelados =
          (guiaRecebida.itens || []).length > 0 &&
          (guiaRecebida.itens || []).every(
            (item: { cancelado?: boolean }) => !!item.cancelado
          );

        if (valorPago > 0 && todosItensCancelados) {
          throw new Error("PAGAMENTO_GUIA_CANCELADA");
        }

        if (valorPago > 0) {
          await tx.pagamento.create({
            data: {
              guiaId: guia.id,
              valor: valorPago,
              forma: mapearFormaPagamento(guiaRecebida.formaPagamento),
              observacao:
                guiaRecebida.observacaoPagamento ||
                "Pagamento registrado durante criação inicial do atendimento.",
            },
          });
        }

        if (valorEstornado > 0) {
          await tx.estorno.create({
            data: {
              guiaId: guia.id,
              valor: valorEstornado,
              forma: mapearFormaPagamento(guiaRecebida.formaEstorno),
              motivo:
                guiaRecebida.observacaoEstorno ||
                "Estorno registrado durante criação inicial do atendimento.",
            },
          });
        }
      }

      return tx.atendimento.findUnique({
        where: {
          id: novoAtendimento.id,
        },
        include: {
          paciente: true,
          guias: {
            include: {
              clinica: true,
              itens: {
                include: {
                  procedimento: true,
                },
              },
              pagamentos: true,
              estornos: true,
            },
          },
        },
      });
    });

    return res.status(201).json(atendimento);
  } catch (erro) {
    console.error("Erro ao criar atendimento:", erro);

    if (
      erro instanceof Error &&
      erro.message === "PAGAMENTO_GUIA_CANCELADA"
    ) {
      return res.status(400).json({
        erro: "Não é permitido registrar pagamento em uma guia com todos os procedimentos cancelados.",
      });
    }

    return res.status(500).json({
      erro: "Não foi possível salvar o atendimento.",
    });
  }
});

// ======================================================
// ATUALIZAR ATENDIMENTO EXISTENTE
// ======================================================

app.put("/atendimentos/:id", async (req, res) => {
  try {
    const atendimentoId = Number(req.params.id);

    if (!atendimentoId) {
      return res.status(400).json({
        erro: "ID do atendimento inválido.",
      });
    }

    const {
      pacienteId,
      etapaAtual,
      guias = [],
    } = req.body;

    const atendimentoExistente =
      await prisma.atendimento.findUnique({
        where: {
          id: atendimentoId,
        },
        include: {
          guias: {
            include: {
              itens: true,
              pagamentos: true,
              estornos: true,
            },
          },
        },
      });

    if (!atendimentoExistente) {
      return res.status(404).json({
        erro: "Atendimento não encontrado.",
      });
    }

    const atendimentoAtualizado =
      await prisma.$transaction(async (tx) => {
        await tx.atendimento.update({
          where: {
            id: atendimentoId,
          },
          data: {
            pacienteId: pacienteId
              ? Number(pacienteId)
              : atendimentoExistente.pacienteId,

            organizacaoId:
              atendimentoExistente.organizacaoId || ORGANIZACAO_PADRAO_ID,

            criadoPorId:
              atendimentoExistente.criadoPorId || USUARIO_PADRAO_ID,

            etapaAtual:
              Number(etapaAtual) ||
              atendimentoExistente.etapaAtual,
          },
        });

        const guiasUtilizadas = new Set<number>();

        for (const guiaRecebida of guias) {
          const clinicaId =
            Number(guiaRecebida.clinicaId);

          // Tenta reaproveitar uma guia existente da mesma clínica.
          const guiaExistente =
            atendimentoExistente.guias.find(
              (guia) =>
                guia.clinicaId === clinicaId &&
                !guiasUtilizadas.has(guia.id)
            );

          let guiaId: number;

          if (guiaExistente) {
            guiaId = guiaExistente.id;
            guiasUtilizadas.add(guiaExistente.id);

            await tx.guia.update({
              where: {
                id: guiaExistente.id,
              },
              data: {
                clinicaId,

                organizacaoId:
                  guiaExistente.organizacaoId || ORGANIZACAO_PADRAO_ID,

                geradaPorId:
                  guiaExistente.geradaPorId || USUARIO_PADRAO_ID,

                emitidaEm:
                  guiaExistente.emitidaEm || new Date(),

                validadeAte:
                  guiaExistente.validadeAte || calcularValidadeGuia(),

                status: calcularStatusGuia(
                  guiaRecebida.status,
                  Number(guiaRecebida.valorFinal) || 0,
                  Number(guiaRecebida.valorPago) || 0,
                  Number(guiaRecebida.valorEstornado) || 0
                ),

                subtotal:
                  Number(guiaRecebida.subtotal) || 0,

                desconto:
                  Number(guiaRecebida.desconto) || 0,

                beneficio:
                  Number(guiaRecebida.beneficio) || 0,

                valorFinal:
                  Number(guiaRecebida.valorFinal) || 0,
              },
            });

            const procedimentosRecebidos =
              new Set<number>();

            for (const item of guiaRecebida.itens || []) {
              const procedimentoId =
                Number(item.procedimentoId);

              procedimentosRecebidos.add(
                procedimentoId
              );

              const itemExistente =
                guiaExistente.itens.find(
                  (itemBanco) =>
                    itemBanco.procedimentoId ===
                    procedimentoId
                );

              const dadosItem = {
                status: item.cancelado
                  ? ("CANCELADO" as const)
                  : ("ATIVO" as const),

                valorPaciente:
                  Number(item.valorPaciente) || 0,

                valorRepasse:
                  Number(item.valorRepasse) || 0,

                tipoAgendamento:
                  item.tipoAgendamento === "horario"
                    ? ("HORARIO" as const)
                    : item.tipoAgendamento === "ordem"
                      ? ("ORDEM_CHEGADA" as const)
                      : null,

                dataAgendamento:
                  item.dataAgendamento
                    ? new Date(
                        `${item.dataAgendamento}T12:00:00`
                      )
                    : null,

                horarioAgendamento:
                  item.horarioAgendamento || null,

                canceladoEm: item.cancelado
                  ? new Date()
                  : null,

                motivoCancelamento:
                  item.cancelado
                    ? "Cancelado durante o atendimento"
                    : null,
              };

              if (itemExistente) {
                await tx.itemGuia.update({
                  where: {
                    id: itemExistente.id,
                  },
                  data: dadosItem,
                });
              } else {
                await tx.itemGuia.create({
                  data: {
                    guiaId,
                    procedimentoId,
                    ...dadosItem,
                  },
                });
              }
            }

            // Procedimentos que existiam e não vieram mais
            // não são apagados: ficam cancelados.
            for (const itemBanco of guiaExistente.itens) {
              if (
                !procedimentosRecebidos.has(
                  itemBanco.procedimentoId
                )
              ) {
                await tx.itemGuia.update({
                  where: {
                    id: itemBanco.id,
                  },
                  data: {
                    status: "CANCELADO",
                    canceladoEm: new Date(),
                    motivoCancelamento:
                      "Removido durante alteração do atendimento",
                  },
                });
              }
            }

            // Pagamento recebido pelo frontend é o TOTAL.
            // Criamos somente a diferença ainda não registrada.
            const totalPagoBanco =
              guiaExistente.pagamentos.reduce(
                (total, pagamento) =>
                  total + Number(pagamento.valor),
                0
              );

            const totalPagoTela =
              Number(guiaRecebida.valorPago) || 0;

            const diferencaPagamento =
              totalPagoTela - totalPagoBanco;

            const todosItensCancelados =
              (guiaRecebida.itens || []).length > 0 &&
              (guiaRecebida.itens || []).every(
                (item: { cancelado?: boolean }) => !!item.cancelado
              );

            if (diferencaPagamento > 0 && todosItensCancelados) {
              throw new Error("PAGAMENTO_GUIA_CANCELADA");
            }

            if (diferencaPagamento > 0) {
              await tx.pagamento.create({
                data: {
                  guiaId,
                  valor: diferencaPagamento,
                  forma: mapearFormaPagamento(guiaRecebida.formaPagamento),
                  observacao:
                    guiaRecebida.observacaoPagamento ||
                    "Pagamento acrescentado durante atualização do atendimento.",
                },
              });
            }

            const totalEstornadoBanco =
              guiaExistente.estornos.reduce(
                (total, estorno) =>
                  total + Number(estorno.valor),
                0
              );

            const totalEstornadoTela =
              Number(
                guiaRecebida.valorEstornado
              ) || 0;

            const diferencaEstorno =
              totalEstornadoTela -
              totalEstornadoBanco;

            if (diferencaEstorno > 0) {
              await tx.estorno.create({
                data: {
                  guiaId,
                  valor: diferencaEstorno,
                  forma: mapearFormaPagamento(guiaRecebida.formaEstorno),
                  motivo:
                    guiaRecebida.observacaoEstorno ||
                    "Estorno acrescentado durante atualização do atendimento.",
                },
              });
            }
          } else {
            // Guia nova dentro de atendimento existente.
            const novaGuia = await tx.guia.create({
              data: {
                atendimentoId,
                clinicaId,
                organizacaoId: ORGANIZACAO_PADRAO_ID,
                geradaPorId: USUARIO_PADRAO_ID,
                emitidaEm: new Date(),
                validadeAte: calcularValidadeGuia(),

                status: calcularStatusGuia(
                  guiaRecebida.status,
                  Number(guiaRecebida.valorFinal) || 0,
                  Number(guiaRecebida.valorPago) || 0,
                  Number(guiaRecebida.valorEstornado) || 0
                ),

                subtotal:
                  Number(guiaRecebida.subtotal) || 0,

                desconto:
                  Number(guiaRecebida.desconto) || 0,

                beneficio:
                  Number(guiaRecebida.beneficio) || 0,

                valorFinal:
                  Number(guiaRecebida.valorFinal) || 0,
              },
            });

            guiaId = novaGuia.id;
            guiasUtilizadas.add(novaGuia.id);

            for (const item of guiaRecebida.itens || []) {
              await tx.itemGuia.create({
                data: {
                  guiaId,
                  procedimentoId:
                    Number(item.procedimentoId),

                  status: item.cancelado
                    ? "CANCELADO"
                    : "ATIVO",

                  valorPaciente:
                    Number(item.valorPaciente) || 0,

                  valorRepasse:
                    Number(item.valorRepasse) || 0,

                  tipoAgendamento:
                    item.tipoAgendamento === "horario"
                      ? "HORARIO"
                      : item.tipoAgendamento === "ordem"
                        ? "ORDEM_CHEGADA"
                        : null,

                  dataAgendamento:
                    item.dataAgendamento
                      ? new Date(
                          `${item.dataAgendamento}T12:00:00`
                        )
                      : null,

                  horarioAgendamento:
                    item.horarioAgendamento || null,

                  canceladoEm: item.cancelado
                    ? new Date()
                    : null,

                  motivoCancelamento:
                    item.cancelado
                      ? "Cancelado durante o atendimento"
                      : null,
                },
              });
            }

            const valorPago =
              Number(guiaRecebida.valorPago) || 0;

            const todosItensCanceladosNovaGuia =
              (guiaRecebida.itens || []).length > 0 &&
              (guiaRecebida.itens || []).every(
                (item: { cancelado?: boolean }) => !!item.cancelado
              );

            if (valorPago > 0 && todosItensCanceladosNovaGuia) {
              throw new Error("PAGAMENTO_GUIA_CANCELADA");
            }

            if (valorPago > 0) {
              await tx.pagamento.create({
                data: {
                  guiaId,
                  valor: valorPago,
                  forma: mapearFormaPagamento(guiaRecebida.formaPagamento),
                  observacao:
                    guiaRecebida.observacaoPagamento ||
                    "Pagamento registrado durante atualização do atendimento.",
                },
              });
            }

            const valorEstornado =
              Number(
                guiaRecebida.valorEstornado
              ) || 0;

            if (valorEstornado > 0) {
              await tx.estorno.create({
                data: {
                  guiaId,
                  valor: valorEstornado,
                  forma: mapearFormaPagamento(guiaRecebida.formaEstorno),
                  motivo:
                    guiaRecebida.observacaoEstorno ||
                    "Estorno registrado durante atualização do atendimento.",
                },
              });
            }
          }
        }

        // Guias antigas que desapareceram da tela não são excluídas.
        // São mantidas no histórico como canceladas.
        for (const guiaBanco of atendimentoExistente.guias) {
          if (!guiasUtilizadas.has(guiaBanco.id)) {
            await tx.guia.update({
              where: {
                id: guiaBanco.id,
              },
              data: {
                status: "CANCELADA",
              },
            });

            await tx.itemGuia.updateMany({
              where: {
                guiaId: guiaBanco.id,
                status: {
                  not: "CANCELADO",
                },
              },
              data: {
                status: "CANCELADO",
                canceladoEm: new Date(),
                motivoCancelamento:
                  "Guia cancelada durante alteração do atendimento",
              },
            });
          }
        }

        return tx.atendimento.findUnique({
          where: {
            id: atendimentoId,
          },
          include: {
            paciente: {
              include: {
                empresa: true,
              },
            },
            guias: {
              include: {
                clinica: true,
                itens: {
                  include: {
                    procedimento: true,
                  },
                },
                pagamentos: true,
                estornos: true,
              },
            },
          },
        });
      });

    return res.json(atendimentoAtualizado);
  } catch (erro) {
    console.error(
      "Erro ao atualizar atendimento:",
      erro
    );

    if (
      erro instanceof Error &&
      erro.message === "PAGAMENTO_GUIA_CANCELADA"
    ) {
      return res.status(400).json({
        erro: "Não é permitido registrar pagamento em uma guia com todos os procedimentos cancelados.",
      });
    }

    return res.status(500).json({
      erro: "Não foi possível atualizar o atendimento.",
    });
  }
});

// ======================================================
// LISTAR ATENDIMENTOS
// ======================================================

app.get("/atendimentos", async (_req, res) => {
  try {
    const atendimentos = await prisma.atendimento.findMany({
      include: {
        paciente: true,
        guias: {
          include: {
            clinica: true,
            itens: {
              include: {
                procedimento: true,
              },
            },
          },
        },
      },
      orderBy: {
        atualizadoEm: "desc",
      },
    });

    return res.json(atendimentos);
  } catch (erro) {
    console.error("Erro ao carregar atendimentos:", erro);

    return res.status(500).json({
      erro: "Não foi possível carregar os atendimentos.",
    });
  }
});

// ======================================================
// BUSCAR ATENDIMENTO POR ID
// ======================================================

app.get("/atendimentos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        erro: "ID do atendimento inválido.",
      });
    }

    const atendimento = await prisma.atendimento.findUnique({
      where: {
        id,
      },
      include: {
        paciente: {
          include: {
            empresa: true,
          },
        },
        guias: {
          include: {
            clinica: true,
            itens: {
              include: {
                procedimento: true,
              },
            },
            pagamentos: true,
            estornos: true,
          },
        },
      },
    });

    if (!atendimento) {
      return res.status(404).json({
        erro: "Atendimento não encontrado.",
      });
    }

    return res.json(atendimento);
  } catch (erro) {
    console.error("Erro ao carregar atendimento:", erro);

    return res.status(500).json({
      erro: "Não foi possível carregar o atendimento.",
    });
  }
});


// ======================================================
// BUSCAR GUIA POR ID - IMPRESSÃO
// ======================================================

app.get("/guias/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        erro: "ID da guia inválido.",
      });
    }

    const guia = await prisma.guia.findUnique({
      where: {
        id,
      },
      include: {
        clinica: true,
        organizacao: true,
        geradaPor: true,
        atendimento: {
          include: {
            paciente: {
              include: {
                empresa: true,
              },
            },
          },
        },
        itens: {
          include: {
            procedimento: true,
          },
          orderBy: {
            id: "asc",
          },
        },
        pagamentos: {
          orderBy: {
            id: "asc",
          },
        },
        estornos: {
          orderBy: {
            id: "asc",
          },
        },
      },
    });

    if (!guia) {
      return res.status(404).json({
        erro: "Guia não encontrada.",
      });
    }

    let organizacao = guia.organizacao;
    let geradaPor = guia.geradaPor;

    if (!organizacao) {
      organizacao = await prisma.organizacao.findUnique({
        where: {
          id: ORGANIZACAO_PADRAO_ID,
        },
      });
    }

    if (!geradaPor) {
      geradaPor = await prisma.usuario.findUnique({
        where: {
          id: USUARIO_PADRAO_ID,
        },
      });
    }

    return res.json({
      ...guia,
      organizacao,
      geradaPor,
    });
  } catch (erro) {
    console.error("Erro ao carregar guia:", erro);

    return res.status(500).json({
      erro: "Não foi possível carregar a guia.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Digna Conect API rodando em http://localhost:${PORT}`);
});