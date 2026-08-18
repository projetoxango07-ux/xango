import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("🌱 Iniciando dados iniciais da Digna Conect...");

  // =========================================================
  // EMPRESA / BENEFÍCIO DE TESTE
  // =========================================================

  const empresa = await prisma.empresa.upsert({
    where: {
      documento: "00000000000100",
    },
    update: {},
    create: {
      nome: "Empresa Parceira Teste",
      documento: "00000000000100",
      percentualBeneficio: 15,
      ativo: true,
    },
  });

  // =========================================================
  // PACIENTES DE TESTE
  // =========================================================

  await prisma.paciente.upsert({
    where: {
      cpf: "12345678901",
    },
    update: {},
    create: {
      nome: "Maria da Silva",
      cpf: "12345678901",
      telefone: "(13) 99999-1111",
      beneficioAtivo: false,
    },
  });

  await prisma.paciente.upsert({
    where: {
      cpf: "98765432100",
    },
    update: {},
    create: {
      nome: "João Santos",
      cpf: "98765432100",
      telefone: "(13) 99999-2222",
      empresaId: empresa.id,
      beneficioAtivo: true,
    },
  });

  // =========================================================
  // PROCEDIMENTOS
  // =========================================================

  const procedimentosDados = [
    {
      nome: "Holter 24h",
      categoria: "Cardiologia",
      valor: 120,
      repasse: 80,
    },
    {
      nome: "MAPA 24h",
      categoria: "Cardiologia",
      valor: 110,
      repasse: 75,
    },
    {
      nome: "Eletrocardiograma",
      categoria: "Cardiologia",
      valor: 50,
      repasse: 45,
    },
    {
      nome: "Ultrassom de Abdome Total",
      categoria: "Ultrassonografia",
      valor: 150,
      repasse: 100,
    },
    {
      nome: "EEG",
      categoria: "Neurologia",
      valor: 130,
      repasse: 90,
    },
    {
      nome: "Espirometria",
      categoria: "Pneumologia",
      valor: 80,
      repasse: 50,
    },
  ];

  const procedimentos = [];

  for (const dados of procedimentosDados) {
    let procedimento = await prisma.procedimento.findFirst({
      where: {
        nome: dados.nome,
      },
    });

    if (!procedimento) {
      procedimento = await prisma.procedimento.create({
        data: {
          nome: dados.nome,
          categoria: dados.categoria,
          ativo: true,
        },
      });
    }

    procedimentos.push({
      ...procedimento,
      valor: dados.valor,
      repasse: dados.repasse,
    });
  }

  // =========================================================
  // CLÍNICAS
  // =========================================================

  const clinicasDados = [
    {
      nome: "Clínica Alfa",
      procedimentos: [
        "Holter 24h",
        "MAPA 24h",
        "Eletrocardiograma",
        "Espirometria",
      ],
    },
    {
      nome: "Clínica Beta",
      procedimentos: [
        "Eletrocardiograma",
        "Ultrassom de Abdome Total",
      ],
    },
    {
      nome: "Clínica Gama",
      procedimentos: [
        "Holter 24h",
        "MAPA 24h",
        "EEG",
      ],
    },
  ];

  for (const dadosClinica of clinicasDados) {
    let clinica = await prisma.clinica.findFirst({
      where: {
        nome: dadosClinica.nome,
      },
    });

    if (!clinica) {
      clinica = await prisma.clinica.create({
        data: {
          nome: dadosClinica.nome,
          ativo: true,
        },
      });
    }

    // =======================================================
    // PREÇOS E REPASSES POR CLÍNICA
    // =======================================================

    for (const nomeProcedimento of dadosClinica.procedimentos) {
      const procedimento = procedimentos.find(
        (item) => item.nome === nomeProcedimento
      );

      if (!procedimento) {
        continue;
      }

      await prisma.precoProcedimentoClinica.upsert({
        where: {
          clinicaId_procedimentoId: {
            clinicaId: clinica.id,
            procedimentoId: procedimento.id,
          },
        },
        update: {
          valorPaciente: procedimento.valor,
          valorRepasse: procedimento.repasse,
          ativo: true,
        },
        create: {
          clinicaId: clinica.id,
          procedimentoId: procedimento.id,
          valorPaciente: procedimento.valor,
          valorRepasse: procedimento.repasse,
          ativo: true,
        },
      });
    }
  }

  console.log("✅ Dados iniciais criados com sucesso.");
}

main()
  .catch((erro) => {
    console.error("❌ Erro ao criar dados iniciais:");
    console.error(erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });