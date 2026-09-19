import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const API_BASE =
  "https://consulta-ocl.apps.sa-1a.mendixcloud.com/rest/oclservice/ANS/concepts/tuss-22";

type RegistroOcl = {
  id?: string | number;
  display_name?: string;
  source?: string;
  extras?: {
    inicio_vigencia?: string | null;
    fim_vigencia?: string | null;
    fim_implantacao?: string | null;
    [chave: string]: unknown;
  };
};

function dataOpcional(valor: unknown): Date | null {
  const texto = String(valor ?? "").trim();

  if (!texto || texto === "-" || texto.toLowerCase() === "null") {
    return null;
  }

  const data = new Date(`${texto}T00:00:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

function referenciaAtiva(fimVigencia: Date | null) {
  if (!fimVigencia) return true;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return fimVigencia >= hoje;
}

async function buscarPagina(pagina: number): Promise<RegistroOcl[]> {
  const url = `${API_BASE}?page=${pagina}`;

  const resposta = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Digna-Conect/1.0",
    },
  });

  if (!resposta.ok) {
    throw new Error(
      `ANS/OCL respondeu ${resposta.status} na página ${pagina}.`
    );
  }

  const dados = await resposta.json();

  if (!Array.isArray(dados)) {
    throw new Error(
      `Formato inesperado recebido da ANS/OCL na página ${pagina}.`
    );
  }

  return dados as RegistroOcl[];
}

async function importarPagina(registros: RegistroOcl[]) {
  let importados = 0;
  let ignorados = 0;

  for (const registro of registros) {
    const codigoTuss = String(registro.id ?? "")
      .replace(/\D/g, "")
      .trim();

    const nomeTuss = String(registro.display_name ?? "")
      .trim()
      .toUpperCase();

    if (!codigoTuss || !nomeTuss) {
      ignorados += 1;
      continue;
    }

    const inicioVigencia = dataOpcional(registro.extras?.inicio_vigencia);
    const fimVigencia = dataOpcional(registro.extras?.fim_vigencia);

    await prisma.procedimentoReferencia.upsert({
      where: { codigoTuss },
      create: {
        codigoTuss,
        nomeTuss,
        quantidadeCh: null,
        fonteCh: null,
        versaoReferencia: "ANS OCL - TUSS 22",
        inicioVigencia,
        fimVigencia,
        ativo: referenciaAtiva(fimVigencia),
      },
      update: {
        nomeTuss,
        versaoReferencia: "ANS OCL - TUSS 22",
        inicioVigencia,
        fimVigencia,
        ativo: referenciaAtiva(fimVigencia),
      },
    });

    importados += 1;
  }

  return { importados, ignorados };
}

async function main() {
  console.log("");
  console.log("============================================");
  console.log(" Digna Conect - Sincronização TUSS 22 / ANS");
  console.log("============================================");
  console.log("");
  console.log("Fonte oficial: ANS / Open Concept Lab (OCL)");
  console.log("A quantidade de CH NÃO será alterada por esta importação.");
  console.log("");

  let pagina = 1;
  let totalImportados = 0;
  let totalIgnorados = 0;
  const idsPrimeiroRegistro = new Set<string>();

  while (true) {
    process.stdout.write(`Baixando página ${pagina}... `);

    const registros = await buscarPagina(pagina);

    if (registros.length === 0) {
      console.log("fim.");
      break;
    }

    const primeiroId = String(registros[0]?.id ?? "");

    // Proteção caso o serviço remoto volte a repetir a mesma página.
    if (primeiroId && idsPrimeiroRegistro.has(primeiroId)) {
      console.log("");
      throw new Error(
        `A API repetiu registros na página ${pagina}. Importação interrompida por segurança.`
      );
    }

    if (primeiroId) idsPrimeiroRegistro.add(primeiroId);

    const resultado = await importarPagina(registros);

    totalImportados += resultado.importados;
    totalIgnorados += resultado.ignorados;

    console.log(
      `${registros.length} recebidos | ${resultado.importados} gravados`
    );

    pagina += 1;

    // Mais do que suficiente para a TUSS 22 atual e evita loop infinito.
    if (pagina > 1000) {
      throw new Error("Limite de segurança de 1000 páginas atingido.");
    }
  }

  const totalBanco = await prisma.procedimentoReferencia.count();

  console.log("");
  console.log("Sincronização concluída.");
  console.log(`Importados/atualizados nesta execução: ${totalImportados}`);
  console.log(`Ignorados por falta de código/nome: ${totalIgnorados}`);
  console.log(`Total na Base Mestre: ${totalBanco}`);
  console.log("");
}

main()
  .catch((erro) => {
    console.error("");
    console.error("Falha na sincronização da TUSS 22:");
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });