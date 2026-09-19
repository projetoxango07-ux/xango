import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function main() {
  const arquivo =
    process.argv[2] ||
    path.join(process.cwd(), "scripts", "amb92-tuss.csv");

  if (!fs.existsSync(arquivo)) {
    throw new Error(`Arquivo não encontrado: ${arquivo}`);
  }

  const conteudo = fs
    .readFileSync(arquivo, "utf8")
    .replace(/^\uFEFF/, "");

  const linhas = conteudo
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);

  if (linhas.length < 2) {
    throw new Error("CSV vazio ou sem registros.");
  }

  const cab = linhas[0]
    .split(";")
    .map((v) => v.trim().replace(/^"|"$/g, "").toUpperCase());

  const iTuss = cab.indexOf("TUSS");
  const iCh = cab.indexOf("CH");
  const iAmb = cab.indexOf("AMB92");

  if (iTuss < 0 || iCh < 0) {
    console.log("Cabeçalho encontrado:", cab);
    throw new Error("CSV precisa conter as colunas TUSS e CH.");
  }

  let atualizados = 0;
  let naoEncontrados = 0;
  let invalidos = 0;

  for (const linha of linhas.slice(1)) {
    const c = linha
      .split(";")
      .map((v) => v.trim().replace(/^"|"$/g, ""));

    const tuss = (c[iTuss] || "").replace(/\D/g, "");
    const ch = Number((c[iCh] || "").replace(",", "."));
    const amb = iAmb >= 0 ? c[iAmb] || "" : "";

    if (!tuss || !Number.isFinite(ch) || ch < 0) {
      invalidos++;
      continue;
    }

    const ref = await prisma.procedimentoReferencia.findUnique({
      where: { codigoTuss: tuss },
      select: { id: true },
    });

    if (!ref) {
      naoEncontrados++;
      continue;
    }

    await prisma.procedimentoReferencia.update({
      where: { codigoTuss: tuss },
      data: {
        quantidadeCh: ch,
        fonteCh: amb ? `AMB/92 (${amb})` : "AMB/92",
      },
    });

    atualizados++;
  }

  console.log("");
  console.log("Importação concluída.");
  console.log(`CH atualizados: ${atualizados}`);
  console.log(`TUSS não encontrados: ${naoEncontrados}`);
  console.log(`Linhas inválidas: ${invalidos}`);
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
