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

app.use(cors());
app.use(express.json());

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
        nome: nome.trim(),
        cpf: cpfLimpo,
        telefone: telefone.trim(),
        email: email?.trim() || null,
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
          etapaAtual: Number(etapaAtual) || 1,
          status: "EM_ANDAMENTO",
        },
      });

      for (const guiaRecebida of guias) {
        const guia = await tx.guia.create({
          data: {
            atendimentoId: novoAtendimento.id,
            clinicaId: Number(guiaRecebida.clinicaId),

            status: guiaRecebida.status || "RASCUNHO",

            subtotal: Number(guiaRecebida.subtotal) || 0,
            desconto: Number(guiaRecebida.desconto) || 0,
            beneficio: Number(guiaRecebida.beneficio) || 0,
            valorFinal: Number(guiaRecebida.valorFinal) || 0,
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

        const valorPago = Number(guiaRecebida.valorPago) || 0;

        if (valorPago > 0) {
          await tx.pagamento.create({
            data: {
              guiaId: guia.id,
              valor: valorPago,
              forma: "OUTRO",
              observacao:
                "Pagamento registrado durante criação inicial do atendimento.",
            },
          });
        }

        const valorEstornado =
          Number(guiaRecebida.valorEstornado) || 0;

        if (valorEstornado > 0) {
          await tx.estorno.create({
            data: {
              guiaId: guia.id,
              valor: valorEstornado,
              forma: "OUTRO",
              motivo:
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

    return res.status(500).json({
      erro: "Não foi possível salvar o atendimento.",
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

app.listen(PORT, () => {
  console.log(`🚀 Digna Conect API rodando em http://localhost:${PORT}`);
});