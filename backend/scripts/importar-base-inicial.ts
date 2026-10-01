import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import * as XLSXNS from "xlsx";

const XLSX: any = (XLSXNS as any).default ?? XLSXNS;
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

type LinhaClinica = {
  "Nome Fantasia"?: unknown;
  "Razão Social"?: unknown;
  "CNPJ / CPF"?: unknown;
  "Endereço Fiscal"?: unknown;
  "Unidade"?: unknown;
  "Endereço da Unidade"?: unknown;
  "Telefone / WhatsApp"?: unknown;
  "Observação"?: unknown;
  "Fonte"?: unknown;
  "Status"?: unknown;
};

type LinhaPreco = {
  "Clínica"?: unknown;
  "Unidade(s)"?: unknown;
  "Código"?: unknown;
  "Procedimento"?: unknown;
  "Valor Repasse"?: unknown;
  "Valor Paciente"?: unknown;
  "Fonte"?: unknown;
  "Observação"?: unknown;
};

type Endereco = {
  enderecoCompleto: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

type Contadores = {
  clinicasCriar: number;
  clinicasAtualizar: number;
  unidadesCriar: number;
  unidadesAtualizar: number;
  procedimentosCriar: number;
  procedimentosReutilizar: number;
  precosCriar: number;
  precosAtualizar: number;
  linhasPrecoIgnoradas: number;
};

const args = process.argv.slice(2);
const aplicar = args.includes("--apply");
const caminhoInformado = args.find((arg) => !arg.startsWith("--"));
const arquivo =
  caminhoInformado ??
  path.join(process.cwd(), "scripts", "Digna_Conect_Base_Final_Conferida.xlsx");

function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

function textoOuNull(valor: unknown): string | null {
  const v = texto(valor);
  return v ? v : null;
}

function normalizarNome(valor: unknown): string {
  return texto(valor)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function somenteDigitos(valor: unknown): string | null {
  const v = texto(valor).replace(/\D/g, "");
  return v || null;
}

function numero(valor: unknown): number | null {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }

  const t = texto(valor)
    .replace(/\s/g, "")
    .replace(/^R\$/i, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (!t) return null;

  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function separarTelefoneWhatsapp(valor: unknown) {
  const bruto = texto(valor);
  if (!bruto) {
    return { telefone: null as string | null, whatsapp: null as string | null };
  }

  const partes = bruto.split("/").map((p) => p.trim()).filter(Boolean);
  let telefone: string | null = null;
  let whatsapp: string | null = null;

  for (const parte of partes) {
    const digitos = somenteDigitos(parte);
    if (!digitos) continue;

    if (/whats/i.test(parte)) {
      whatsapp = digitos;
    } else if (!telefone) {
      telefone = digitos;
    } else if (!whatsapp) {
      whatsapp = digitos;
    }
  }

  return { telefone, whatsapp };
}

function limparComplemento(valor: string | null): string | null {
  if (!valor) return null;
  const v = valor
    .replace(/^[-–—,\s]+/, "")
    .replace(/[-–—,\s]+$/, "")
    .trim();
  return v || null;
}

function interpretarEndereco(valor: unknown): Endereco {
  const original = texto(valor);

  if (!original || /^MESMO ENDEREÇO$/i.test(original)) {
    return {
      enderecoCompleto: original || null,
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      uf: null,
    };
  }

  const cepMatch = original.match(/\b(\d{5})-?(\d{3})\b/);
  const cep = cepMatch ? `${cepMatch[1]}${cepMatch[2]}` : null;

  const semCep = original
    .replace(/\bCEP\s*\d{5}-?\d{3}\b/gi, "")
    .replace(/\b\d{5}-?\d{3}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const partes = semCep
    .split(/\s+[–—-]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  let cidade: string | null = null;
  let uf: string | null = null;
  let bairro: string | null = null;

  const ultima = partes.at(-1) ?? "";
  const cidadeUf = ultima.match(/^(.+?)\/([A-Za-z]{2})$/);

  if (cidadeUf) {
    cidade = cidadeUf[1].trim();
    uf = cidadeUf[2].toUpperCase();
    partes.pop();
  }

  if (partes.length >= 2) {
    bairro = partes.pop() ?? null;
  }

  const trechoEndereco = partes.join(" - ").trim() || semCep;
  const numeroMatch = trechoEndereco.match(/^(.*?),\s*([0-9A-Za-zºª.\-]+)(.*)$/);

  let logradouro: string | null = trechoEndereco || null;
  let numeroEndereco: string | null = null;
  let complemento: string | null = null;

  if (numeroMatch) {
    logradouro = numeroMatch[1].trim() || null;
    numeroEndereco = numeroMatch[2].trim() || null;
    complemento = limparComplemento(numeroMatch[3]);
  }

  return {
    enderecoCompleto: original,
    cep,
    logradouro,
    numero: numeroEndereco,
    complemento,
    bairro,
    cidade,
    uf,
  };
}

function iguaisPreco(a: unknown, b: unknown) {
  const na = numero(a);
  const nb = numero(b);
  if (na === null || nb === null) return false;
  return Math.abs(na - nb) < 0.005;
}

function abaObrigatoria(workbook: any, nome: string) {
  const sheet = workbook.Sheets[nome];
  if (!sheet) {
    throw new Error(`Aba obrigatória não encontrada: ${nome}`);
  }
  return sheet;
}

async function localizarClinica(nome: string, documento: string | null) {
  const todas = await prisma.clinica.findMany();

  if (documento) {
    const documentoNormalizado = documento.replace(/\D/g, "");

    const porDocumento = todas.find((clinica) => {
      const docBanco = String(clinica.documento ?? "").replace(/\D/g, "");
      return docBanco && docBanco === documentoNormalizado;
    });

    if (porDocumento) return porDocumento;
  }

  const nomeNormalizado = normalizarNome(nome);

  return (
    todas.find((clinica) => normalizarNome(clinica.nome) === nomeNormalizado) ??
    null
  );
}

async function localizarProcedimento(codigo: string | null, nome: string) {
  const nomeNormalizado = normalizarNome(nome);

  // O nome operacional é o primeiro critério.
  // Isso permite que "COM RETORNO" e "SEM RETORNO" coexistam
  // mesmo quando apontam para a mesma referência TUSS.
  const candidatosNome = await prisma.procedimento.findMany({
    where: { ativo: true },
    select: {
      id: true,
      nome: true,
      referenciaId: true,
      codigoTuss: true,
    },
  });

  const porNome = candidatosNome.find(
    (p) => normalizarNome(p.nome) === nomeNormalizado
  );

  if (porNome) {
    return prisma.procedimento.findUnique({
      where: { id: porNome.id },
    });
  }

  if (!codigo) return null;

  const referencia = await prisma.procedimentoReferencia.findUnique({
    where: { codigoTuss: codigo },
    select: { id: true },
  });

  if (referencia) {
    const vinculados = await prisma.procedimento.findMany({
      where: { referenciaId: referencia.id },
      select: { id: true, nome: true },
    });

    const mesmoNome = vinculados.find(
      (p) => normalizarNome(p.nome) === nomeNormalizado
    );

    if (mesmoNome) {
      return prisma.procedimento.findUnique({
        where: { id: mesmoNome.id },
      });
    }

    // A mesma referência TUSS pode ter mais de um procedimento operacional.
    // Não reutilizamos outro procedimento apenas porque compartilha referenciaId.
    return null;
  }

  // Compatibilidade com registros legados que ainda usam codigoTuss diretamente.
  const legado = await prisma.procedimento.findUnique({
    where: { codigoTuss: codigo },
  });

  if (legado && normalizarNome(legado.nome) === nomeNormalizado) {
    return legado;
  }

  return null;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não está definida.");
  }

  if (!fs.existsSync(arquivo)) {
    throw new Error(`Planilha não encontrada: ${arquivo}`);
  }

  console.log("");
  console.log("======================================================");
  console.log(" Digna Conect - Importação da base inicial");
  console.log("======================================================");
  console.log(`Planilha: ${arquivo}`);
  console.log(`Modo: ${aplicar ? "APLICAR ALTERAÇÕES" : "DRY-RUN / SOMENTE SIMULAÇÃO"}`);
  console.log("");

  const workbook = XLSX.read(fs.readFileSync(arquivo), {
    type: "buffer",
    cellDates: false,
    raw: true,
  });

  const clinicas = XLSX.utils.sheet_to_json(
    abaObrigatoria(workbook, "CLÍNICAS"),
    { defval: null }
  ) as LinhaClinica[];

  const precos = XLSX.utils.sheet_to_json(
    abaObrigatoria(workbook, "PREÇOS CLÍNICAS"),
    { defval: null }
  ) as LinhaPreco[];

  const contadores: Contadores = {
    clinicasCriar: 0,
    clinicasAtualizar: 0,
    unidadesCriar: 0,
    unidadesAtualizar: 0,
    procedimentosCriar: 0,
    procedimentosReutilizar: 0,
    precosCriar: 0,
    precosAtualizar: 0,
    linhasPrecoIgnoradas: 0,
  };

  const clinicasPorNome = new Map<
    string,
    { id: number | null; nome: string; documento: string | null; ativo: boolean }
  >();

  console.log("1) CLÍNICAS E UNIDADES");
  console.log("----------------------");

  for (const linha of clinicas) {
    const nome = texto(linha["Nome Fantasia"]);
    if (!nome) continue;

    const chaveNome = normalizarNome(nome);
    const razaoSocial = textoOuNull(linha["Razão Social"]);
    const documento = somenteDigitos(linha["CNPJ / CPF"]);
    const status = normalizarNome(linha["Status"]);
    const ativo = status !== "INATIVA";
    const observacoes = textoOuNull(linha["Observação"]);

    const fiscal = interpretarEndereco(linha["Endereço Fiscal"]);
    const contatos = separarTelefoneWhatsapp(linha["Telefone / WhatsApp"]);

    const existente = await localizarClinica(nome, documento);

    const tipoLaboratorio = /LABORAT[ÓO]RIO/i.test(nome);

    const dataClinica = {
      nome,
      razaoSocial,
      documento,
      telefone: contatos.telefone,
      whatsapp: contatos.whatsapp,
      tipoEstabelecimento: tipoLaboratorio
        ? ("LABORATORIO_ANALISES_CLINICAS" as const)
        : ("CLINICA" as const),
      tipoPrecificacao: tipoLaboratorio && /GONZAGA/i.test(nome)
        ? ("CH" as const)
        : ("INDIVIDUAL" as const),
      valorChRepasse: tipoLaboratorio && /GONZAGA/i.test(nome) ? 0.17 : null,
      // O Gonzaga possui preço final individual por exame na planilha.
      // Por isso NÃO gravamos valorChPaciente como regra global.
      valorChPaciente: null,
      endereco: fiscal.enderecoCompleto,
      cepFiscal: fiscal.cep,
      logradouroFiscal: fiscal.logradouro,
      numeroFiscal: fiscal.numero,
      complementoFiscal: fiscal.complemento,
      bairroFiscal: fiscal.bairro,
      cidadeFiscal: fiscal.cidade,
      ufFiscal: fiscal.uf,
      observacoes,
      ativo,
    };

    let clinicaId = existente?.id ?? null;

    if (!existente) {
      contadores.clinicasCriar += 1;
      console.log(`[CRIAR]   Clínica: ${nome} | ativo=${ativo}`);

      if (aplicar) {
        const criada = await prisma.clinica.create({ data: dataClinica });
        clinicaId = criada.id;
      }
    } else {
      contadores.clinicasAtualizar += 1;
      console.log(`[ATUALIZAR] Clínica: ${nome} | ativo=${ativo}`);

      if (aplicar) {
        const atualizada = await prisma.clinica.update({
          where: { id: existente.id },
          data: dataClinica,
        });
        clinicaId = atualizada.id;
      }
    }

    clinicasPorNome.set(chaveNome, {
      id: clinicaId,
      nome,
      documento,
      ativo,
    });

    if (aplicar && clinicaId && !ativo) {
      await prisma.unidadeClinica.updateMany({
        where: { clinicaId },
        data: { ativo: false },
      });

      await prisma.precoProcedimentoClinica.updateMany({
        where: { clinicaId },
        data: { ativo: false },
      });
    }

    const nomeUnidade = texto(linha["Unidade"]);
    if (!nomeUnidade || /^UNIDADE A DEFINIR$/i.test(nomeUnidade)) {
      continue;
    }

    const unidadeTexto = texto(linha["Endereço da Unidade"]);
    const usaEnderecoFiscal = /^MESMO ENDEREÇO$/i.test(unidadeTexto);
    const unidadeEndereco = usaEnderecoFiscal
      ? fiscal
      : interpretarEndereco(unidadeTexto);
    const contatosUnidade = separarTelefoneWhatsapp(linha["Telefone / WhatsApp"]);

    if (!clinicaId && !aplicar) {
      console.log(`           Unidade: ${nomeUnidade} (será criada junto da clínica)`);
      contadores.unidadesCriar += 1;
      continue;
    }

    if (!clinicaId) {
      throw new Error(`Não foi possível determinar o ID da clínica ${nome}.`);
    }

    const unidadeExistente = await prisma.unidadeClinica.findFirst({
      where: {
        clinicaId,
        nome: {
          equals: nomeUnidade,
          mode: "insensitive",
        },
      },
    });

    const dataUnidade = {
      nome: nomeUnidade,
      usaEnderecoFiscal,
      cep: unidadeEndereco.cep ?? (usaEnderecoFiscal ? fiscal.cep : null),
      logradouro:
        unidadeEndereco.logradouro ?? (usaEnderecoFiscal ? fiscal.logradouro : null),
      numero:
        unidadeEndereco.numero ?? (usaEnderecoFiscal ? fiscal.numero : null),
      complemento:
        unidadeEndereco.complemento ??
        (usaEnderecoFiscal ? fiscal.complemento : null),
      bairro:
        unidadeEndereco.bairro ?? (usaEnderecoFiscal ? fiscal.bairro : null),
      cidade:
        unidadeEndereco.cidade ?? (usaEnderecoFiscal ? fiscal.cidade : null),
      uf: unidadeEndereco.uf ?? (usaEnderecoFiscal ? fiscal.uf : null),
      telefone: contatosUnidade.telefone,
      whatsapp: contatosUnidade.whatsapp,
      ativo,
    };

    if (!unidadeExistente) {
      contadores.unidadesCriar += 1;
      console.log(`           [CRIAR] unidade: ${nomeUnidade}`);

      if (aplicar) {
        await prisma.unidadeClinica.create({
          data: {
            clinicaId,
            ...dataUnidade,
          },
        });
      }
    } else {
      contadores.unidadesAtualizar += 1;
      console.log(`           [ATUALIZAR] unidade: ${nomeUnidade}`);

      if (aplicar) {
        await prisma.unidadeClinica.update({
          where: { id: unidadeExistente.id },
          data: dataUnidade,
        });
      }
    }
  }

  console.log("");
  console.log("2) PROCEDIMENTOS E PREÇOS");
  console.log("-------------------------");

  const cacheProcedimentos = new Map<
    string,
    Awaited<ReturnType<typeof localizarProcedimento>>
  >();

  for (const linha of precos) {
    const nomeClinica = texto(linha["Clínica"]);
    const nomeProcedimento = texto(linha["Procedimento"]);
    const valorRepasse = numero(linha["Valor Repasse"]);
    const valorPaciente = numero(linha["Valor Paciente"]);

    // Linhas totalmente vazias podem existir no fim da área formatada da planilha.
    // Elas não representam registros e não devem ser contadas como "ignoradas".
    if (!nomeClinica && !nomeProcedimento) {
      continue;
    }

    if (!nomeClinica || !nomeProcedimento) {
      contadores.linhasPrecoIgnoradas += 1;
      console.log(
        `[IGNORAR] Linha incompleta: clínica="${nomeClinica}" procedimento="${nomeProcedimento}".`
      );
      continue;
    }

    if (valorRepasse === null || valorPaciente === null) {
      contadores.linhasPrecoIgnoradas += 1;
      console.log(
        `[IGNORAR] ${nomeClinica} / ${nomeProcedimento}: preço não numérico ou ausente.`
      );
      continue;
    }

    const clinicaPlanilha = clinicasPorNome.get(normalizarNome(nomeClinica));

    if (!clinicaPlanilha) {
      throw new Error(
        `Clínica da tabela de preços não foi localizada na aba CLÍNICAS: ${nomeClinica}`
      );
    }

    if (!clinicaPlanilha.ativo) {
      contadores.linhasPrecoIgnoradas += 1;
      console.log(
        `[IGNORAR] ${nomeClinica} / ${nomeProcedimento}: clínica está INATIVA.`
      );
      continue;
    }

    let clinicaId = clinicaPlanilha.id;

    if (!clinicaId) {
      const noBanco = await localizarClinica(
        clinicaPlanilha.nome,
        clinicaPlanilha.documento
      );
      clinicaId = noBanco?.id ?? null;
    }

    if (!clinicaId && aplicar) {
      throw new Error(
        `Não foi possível localizar a clínica após criação: ${nomeClinica}`
      );
    }

    const codigoBruto = textoOuNull(linha["Código"]);
    const codigo = codigoBruto ? codigoBruto.replace(/\s+/g, "") : null;

    const chaveProcedimento =
      `COD:${codigo ?? ""}|NOME:${normalizarNome(nomeProcedimento)}`;

    let procedimento = cacheProcedimentos.get(chaveProcedimento);

    if (procedimento === undefined) {
      procedimento = await localizarProcedimento(codigo, nomeProcedimento);
      cacheProcedimentos.set(chaveProcedimento, procedimento);
    }

    if (!procedimento) {
      contadores.procedimentosCriar += 1;

      let referenciaId: number | null = null;

      if (codigo) {
        const ref = await prisma.procedimentoReferencia.findUnique({
          where: { codigoTuss: codigo },
          select: { id: true },
        });
        referenciaId = ref?.id ?? null;
      }

      console.log(
        `[CRIAR]   Procedimento: ${nomeProcedimento}${codigo ? ` | ${codigo}` : ""}`
      );

      if (aplicar) {
        let codigoLegado: string | null = null;
        let nomeTussLegado: string | null = null;

        if (!referenciaId && codigo) {
          const codigoJaUsado = await prisma.procedimento.findUnique({
            where: { codigoTuss: codigo },
            select: { id: true },
          });

          if (!codigoJaUsado) {
            codigoLegado = codigo;
            nomeTussLegado = nomeProcedimento;
          }
        }

        procedimento = await prisma.procedimento.create({
          data: {
            nome: nomeProcedimento,
            referenciaId,
            codigoTuss: codigoLegado,
            nomeTuss: nomeTussLegado,
            ativo: true,
          },
        });
        cacheProcedimentos.set(chaveProcedimento, procedimento);
      }
    } else {
      contadores.procedimentosReutilizar += 1;
    }

    if (!aplicar) {
      // No dry-run, entidades novas ainda não possuem ID no banco.
      // Se clínica ou procedimento ainda não existem, o preço necessariamente será criado.
      if (!clinicaId || !procedimento) {
        contadores.precosCriar += 1;
        console.log(
          `           [PREÇO A CRIAR] ${nomeClinica} / ${nomeProcedimento}: repasse=${valorRepasse.toFixed(
            2
          )} paciente=${valorPaciente.toFixed(2)}`
        );
        continue;
      }

      const precoExistenteDryRun =
        await prisma.precoProcedimentoClinica.findUnique({
          where: {
            clinicaId_procedimentoId: {
              clinicaId,
              procedimentoId: procedimento.id,
            },
          },
        });

      if (!precoExistenteDryRun) {
        contadores.precosCriar += 1;
        console.log(
          `           [PREÇO A CRIAR] ${nomeClinica} / ${nomeProcedimento}: repasse=${valorRepasse.toFixed(
            2
          )} paciente=${valorPaciente.toFixed(2)}`
        );
      } else {
        const mudou =
          !iguaisPreco(precoExistenteDryRun.valorRepasse, valorRepasse) ||
          !iguaisPreco(precoExistenteDryRun.valorPaciente, valorPaciente) ||
          !precoExistenteDryRun.ativo;

        if (mudou) {
          contadores.precosAtualizar += 1;
          console.log(
            `           [PREÇO A ATUALIZAR] ${nomeClinica} / ${nomeProcedimento}`
          );
        } else {
          console.log(
            `           [PREÇO OK] ${nomeClinica} / ${nomeProcedimento}`
          );
        }
      }

      continue;
    }

    if (!procedimento || !clinicaId) {
      throw new Error(
        `Falha ao preparar preço: ${nomeClinica} / ${nomeProcedimento}`
      );
    }

    const precoExistente = await prisma.precoProcedimentoClinica.findUnique({
      where: {
        clinicaId_procedimentoId: {
          clinicaId,
          procedimentoId: procedimento.id,
        },
      },
    });

    if (!precoExistente) {
      contadores.precosCriar += 1;
      await prisma.precoProcedimentoClinica.create({
        data: {
          clinicaId,
          procedimentoId: procedimento.id,
          valorRepasse,
          valorPaciente,
          modoPreco: "FIXO",
          ativo: true,
        },
      });
      console.log(
        `[CRIAR]   Preço: ${nomeClinica} / ${nomeProcedimento} = ${valorPaciente.toFixed(
          2
        )}`
      );
    } else {
      const mudou =
        !iguaisPreco(precoExistente.valorRepasse, valorRepasse) ||
        !iguaisPreco(precoExistente.valorPaciente, valorPaciente) ||
        !precoExistente.ativo;

      if (mudou) {
        contadores.precosAtualizar += 1;
        await prisma.precoProcedimentoClinica.update({
          where: { id: precoExistente.id },
          data: {
            valorRepasse,
            valorPaciente,
            modoPreco: "FIXO",
            ativo: true,
          },
        });
        console.log(
          `[ATUALIZAR] Preço: ${nomeClinica} / ${nomeProcedimento}`
        );
      }
    }
  }

  console.log("");
  console.log("======================================================");
  console.log(" RESUMO");
  console.log("======================================================");
  console.table(contadores);

  if (!aplicar) {
    console.log("");
    console.log("DRY-RUN concluído.");
    console.log("Nenhuma alteração foi gravada no banco.");
    console.log("");
    console.log("Para aplicar somente depois de conferir o relatório:");
    console.log(
      `npx tsx scripts/importar-base-inicial.ts "${arquivo}" --apply`
    );
  } else {
    console.log("");
    console.log("Importação aplicada com sucesso.");
    console.log("Clínicas INATIVAS tiveram unidades e preços existentes desativados, sem exclusão física.");
  }
}

main()
  .catch((erro) => {
    console.error("");
    console.error("ERRO NA IMPORTAÇÃO");
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
