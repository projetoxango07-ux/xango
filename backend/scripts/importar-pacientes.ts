import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { randomInt } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const SISTEMA_ORIGEM = "AMPLIMED";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

type LinhaAmplimed = Record<string, string>;

type PacienteSnapshot = {
  id: number;
  codigoPublico: string | null;
  nome: string;
  nomeSocial: string | null;
  cpf: string | null;
  rg: string | null;
  telefone: string | null;
  telefoneSecundario: string | null;
  email: string | null;
  dataNascimento: Date | null;
  nomeMae: string | null;
  cep: string | null;
  logradouro: string | null;
  numeroEndereco: string | null;
  complementoEndereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  responsavelLegalEhMae: boolean;
  responsavelLegalNome: string | null;
  responsavelLegalCpf: string | null;
  responsavelLegalTelefone: string | null;
  responsavelLegalParentesco: string | null;
};

type DadosPaciente = Omit<PacienteSnapshot, "id" | "codigoPublico">;

type RegistroLegadoSnapshot = {
  id: number;
  pacienteId: number;
  sistema: string;
  chaveExterna: string;
  dadosOriginais: unknown;
};

type Contadores = {
  linhasLidas: number;
  cpfValidos: number;
  semCpf: number;
  cpfInvalidos: number;
  duplicidadesCpfConsolidadas: number;
  duplicidadesRevisadasConsolidadas: number;
  pacientesCriar: number;
  pacientesAtualizar: number;
  pacientesSemAlteracao: number;
  registrosLegadosCriar: number;
  registrosLegadosAtualizar: number;
  registrosLegadosSemAlteracao: number;
  nomesAusentesComFallback: number;
  chavesOrigemAusentesComFallback: number;
  datasNascimentoInvalidas: number;
  emailsInvalidos: number;
  linhasSemTelefoneUtilizavel: number;
  conflitos: number;
  erros: number;
};

type DetalheProblema = {
  linha: number;
  codp: string;
  nome: string;
  cpfOriginal: string;
  tipo: "CONFLITO" | "ERRO" | "AVISO";
  motivo: string;
};


type GrupoDuplicidadeRevisado = {
  grupoRelatorio: number;
  criterio: string;
  chave: string;
  codpPrincipalSugerido: string;
  codpsConsolidarNoPrincipal: string[];
  registros: Array<{ codp: string }>;
};

type ArquivoRevisaoDuplicidades = {
  resumo?: {
    duplicidadesEvidentes?: number;
    manterSeparadosPorEnquanto?: number;
  };
  duplicidadesEvidentes: GrupoDuplicidadeRevisado[];
  revisaoManual?: Array<{
    grupoRelatorio: number;
    criterio: string;
    chave: string;
    registros: Array<{ codp: string }>;
  }>;
};

type PossivelDuplicidade = {
  criterio: "NOME_DATA_NASCIMENTO" | "NOME_TELEFONE";
  chave: string;
  registros: Array<{
    linha: number;
    codp: string;
    nome: string;
    dataNascimento: string;
    telefones: string[];
    cpfOriginal: string;
  }>;
};

const pacienteSelect = {
  id: true,
  codigoPublico: true,
  nome: true,
  nomeSocial: true,
  cpf: true,
  rg: true,
  telefone: true,
  telefoneSecundario: true,
  email: true,
  dataNascimento: true,
  nomeMae: true,
  cep: true,
  logradouro: true,
  numeroEndereco: true,
  complementoEndereco: true,
  bairro: true,
  cidade: true,
  uf: true,
  responsavelLegalEhMae: true,
  responsavelLegalNome: true,
  responsavelLegalCpf: true,
  responsavelLegalTelefone: true,
  responsavelLegalParentesco: true,
} as const;

const args: string[] = process.argv.slice(2);
const aplicar = args.includes("--apply");
const caminhoInformado = args.find((arg) => !arg.startsWith("--"));
const arquivo =
  caminhoInformado ??
  path.join(process.cwd(), "scripts", "dados_pacientes_amplimed_original.csv");
const arquivoRevisaoDuplicidades = path.join(
  process.cwd(),
  "scripts",
  "revisao-duplicidades-amplimed.json",
);

function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

function textoOuNull(valor: unknown): string | null {
  const v = texto(valor);
  return v || null;
}

function somenteDigitos(valor: unknown): string {
  return texto(valor).replace(/\D/g, "");
}

function normalizarNome(valor: unknown): string {
  return texto(valor)
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("pt-BR");
}

function chaveNome(valor: unknown): string {
  return normalizarNome(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cpfValido(cpfInformado: unknown): boolean {
  const cpf = somenteDigitos(cpfInformado);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  for (let tamanho = 9; tamanho <= 10; tamanho += 1) {
    let soma = 0;
    for (let i = 0; i < tamanho; i += 1) {
      soma += Number(cpf[i]) * (tamanho + 1 - i);
    }

    let digito = (soma * 10) % 11;
    if (digito === 10) digito = 0;
    if (digito !== Number(cpf[tamanho])) return false;
  }

  return true;
}

function emailOuNull(valor: unknown): string | null {
  const v = texto(valor).toLowerCase();
  if (!v) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v;
}

function dataOuNull(valor: unknown): Date | null {
  const v = texto(valor);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;

  const [ano, mes, dia] = v.split("-").map(Number);
  if (!ano || !mes || !dia || ano < 1900) return null;

  const data = new Date(`${v}T12:00:00`);
  if (Number.isNaN(data.getTime())) return null;

  if (
    data.getFullYear() !== ano ||
    data.getMonth() + 1 !== mes ||
    data.getDate() !== dia ||
    data > new Date()
  ) {
    return null;
  }

  return data;
}

function telefoneValidoOuNull(valor: unknown): string | null {
  let v = somenteDigitos(valor);
  if (!v) return null;

  if ((v.length === 12 || v.length === 13) && v.startsWith("55")) {
    v = v.slice(2);
  }

  if (v.length < 10 || v.length > 11) return null;
  if (/^(\d)\1+$/.test(v)) return null;
  return v;
}

function extrairTelefones(...valores: unknown[]): string[] {
  const encontrados: string[] = [];

  const adicionar = (valor: unknown) => {
    const telefone = telefoneValidoOuNull(valor);
    if (telefone && !encontrados.includes(telefone)) encontrados.push(telefone);
  };

  for (const valor of valores) {
    const bruto = texto(valor);
    if (!bruto) continue;

    adicionar(bruto);

    const partes = bruto
      .split(/[\/;,|\n\r]+/g)
      .map((parte) => parte.trim())
      .filter(Boolean);

    for (const parte of partes) adicionar(parte);
  }

  return encontrados;
}

function blocoAleatorioAlfanumerico(tamanho = 6) {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "";

  for (let i = 0; i < tamanho; i += 1) {
    codigo += caracteres[randomInt(0, caracteres.length)];
  }

  return codigo;
}

function gerarCodigoPublicoPaciente(codigosUsados: Set<string>) {
  for (let tentativa = 0; tentativa < 100; tentativa += 1) {
    const codigo = `PAC-${blocoAleatorioAlfanumerico(6)}`;
    if (!codigosUsados.has(codigo)) {
      codigosUsados.add(codigo);
      return codigo;
    }
  }

  throw new Error("Não foi possível gerar código público único para paciente.");
}

function parseCsvSemDependencia(conteudo: string): LinhaAmplimed[] {
  const linhas: string[][] = [];
  let atual = "";
  let linha: string[] = [];
  let entreAspas = false;

  for (let i = 0; i < conteudo.length; i += 1) {
    const ch = conteudo[i];
    const prox = conteudo[i + 1];

    if (ch === '"') {
      if (entreAspas && prox === '"') {
        atual += '"';
        i += 1;
      } else {
        entreAspas = !entreAspas;
      }
      continue;
    }

    if (ch === ";" && !entreAspas) {
      linha.push(atual);
      atual = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !entreAspas) {
      if (ch === "\r" && prox === "\n") i += 1;
      linha.push(atual);
      atual = "";
      if (linha.some((v) => v !== "")) linhas.push(linha);
      linha = [];
      continue;
    }

    atual += ch;
  }

  if (atual.length > 0 || linha.length > 0) {
    linha.push(atual);
    if (linha.some((v) => v !== "")) linhas.push(linha);
  }

  if (linhas.length === 0) return [];

  linhas[0][0] = linhas[0][0].replace(/^\uFEFF/, "");
  const cabecalhos = linhas[0].map((h) => h.trim());

  return linhas.slice(1).map((valores) => {
    const obj: LinhaAmplimed = {};
    cabecalhos.forEach((h, idx) => {
      obj[h] = valores[idx] ?? "";
    });
    return obj;
  });
}

function dadosPacienteDaLinha(linha: LinhaAmplimed, chaveExterna: string) {
  const nomeOriginal = normalizarNome(linha.nome);
  const nome = nomeOriginal || `PACIENTE SEM NOME - AMPLIMED ${chaveExterna}`;

  const cpfDigitos = somenteDigitos(linha.cpf);
  const cpf = cpfValido(cpfDigitos) ? cpfDigitos : null;

  const telefones = extrairTelefones(linha.celular, linha.telf, linha.telo);
  const telefone = telefones[0] ?? null;
  const telefoneSecundario = telefones[1] ?? null;

  const emailOriginal = texto(linha.email);
  const email = emailOuNull(emailOriginal);
  const dataNascimentoTexto = texto(linha.dtnasc);
  const dataNascimento = dataOuNull(dataNascimentoTexto);
  const responsavelCpf = somenteDigitos(linha.cpfresponsavel) || null;

  const dados: DadosPaciente = {
    nome,
    nomeSocial: null,
    cpf,
    rg: textoOuNull(linha.rg),
    telefone,
    telefoneSecundario,
    email,
    dataNascimento,
    nomeMae: textoOuNull(linha.nmae),
    cep: somenteDigitos(linha.cep) || null,
    logradouro: textoOuNull(linha.endereco),
    numeroEndereco: textoOuNull(linha.numero),
    complementoEndereco: textoOuNull(linha.comple),
    bairro: textoOuNull(linha.bairro),
    cidade: textoOuNull(linha.idcidade),
    uf: texto(linha.uf).toUpperCase() || null,
    responsavelLegalEhMae: false,
    responsavelLegalNome: textoOuNull(linha.nresp),
    responsavelLegalCpf: responsavelCpf,
    responsavelLegalTelefone: null,
    responsavelLegalParentesco: null,
  };

  return {
    dados,
    cpfOriginal: texto(linha.cpf),
    cpfDigitos,
    cpfEhValido: cpf !== null,
    telefones,
    emailOriginal,
    dataNascimentoTexto,
    nomeOriginal,
  };
}

function valorAusente(valor: unknown): boolean {
  return valor === null || valor === undefined || valor === "";
}

function montarComplementoPaciente(
  existente: PacienteSnapshot,
  recebido: DadosPaciente,
): Partial<DadosPaciente> {
  const update: Partial<DadosPaciente> = {};

  if (!existente.cpf && recebido.cpf) update.cpf = recebido.cpf;
  if (valorAusente(existente.nomeSocial) && recebido.nomeSocial) {
    update.nomeSocial = recebido.nomeSocial;
  }
  if (valorAusente(existente.rg) && recebido.rg) update.rg = recebido.rg;
  if (valorAusente(existente.email) && recebido.email) update.email = recebido.email;
  if (!existente.dataNascimento && recebido.dataNascimento) {
    update.dataNascimento = recebido.dataNascimento;
  }
  if (valorAusente(existente.nomeMae) && recebido.nomeMae) update.nomeMae = recebido.nomeMae;
  if (valorAusente(existente.cep) && recebido.cep) update.cep = recebido.cep;
  if (valorAusente(existente.logradouro) && recebido.logradouro) {
    update.logradouro = recebido.logradouro;
  }
  if (valorAusente(existente.numeroEndereco) && recebido.numeroEndereco) {
    update.numeroEndereco = recebido.numeroEndereco;
  }
  if (valorAusente(existente.complementoEndereco) && recebido.complementoEndereco) {
    update.complementoEndereco = recebido.complementoEndereco;
  }
  if (valorAusente(existente.bairro) && recebido.bairro) update.bairro = recebido.bairro;
  if (valorAusente(existente.cidade) && recebido.cidade) update.cidade = recebido.cidade;
  if (valorAusente(existente.uf) && recebido.uf) update.uf = recebido.uf;
  if (valorAusente(existente.responsavelLegalNome) && recebido.responsavelLegalNome) {
    update.responsavelLegalNome = recebido.responsavelLegalNome;
  }
  if (valorAusente(existente.responsavelLegalCpf) && recebido.responsavelLegalCpf) {
    update.responsavelLegalCpf = recebido.responsavelLegalCpf;
  }
  if (
    valorAusente(existente.responsavelLegalTelefone) &&
    recebido.responsavelLegalTelefone
  ) {
    update.responsavelLegalTelefone = recebido.responsavelLegalTelefone;
  }
  if (
    valorAusente(existente.responsavelLegalParentesco) &&
    recebido.responsavelLegalParentesco
  ) {
    update.responsavelLegalParentesco = recebido.responsavelLegalParentesco;
  }

  const atuais = [existente.telefone, existente.telefoneSecundario].filter(
    (v): v is string => Boolean(v),
  );
  const recebidos = [recebido.telefone, recebido.telefoneSecundario].filter(
    (v): v is string => Boolean(v),
  );

  let telefoneFinal = existente.telefone;
  if (!telefoneFinal && recebidos.length > 0) {
    telefoneFinal = recebidos[0];
    update.telefone = telefoneFinal;
  }

  if (!existente.telefoneSecundario) {
    const candidatoSecundario = recebidos.find(
      (v) => v !== telefoneFinal && !atuais.includes(v),
    );
    if (candidatoSecundario) update.telefoneSecundario = candidatoSecundario;
  }

  return update;
}

function aplicarUpdateEmSnapshot(
  paciente: PacienteSnapshot,
  update: Partial<DadosPaciente>,
): PacienteSnapshot {
  return {
    ...paciente,
    ...update,
  };
}

function canonicalizarJson(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(canonicalizarJson);

  if (valor && typeof valor === "object") {
    const obj = valor as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((chave) => [chave, canonicalizarJson(obj[chave])]),
    );
  }

  return valor;
}

function jsonIgual(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalizarJson(a)) === JSON.stringify(canonicalizarJson(b));
}

function snapshotNovoSimulado(
  id: number,
  codigoPublico: string,
  dados: DadosPaciente,
): PacienteSnapshot {
  return {
    id,
    codigoPublico,
    ...dados,
  };
}

function registrarPossiveisDuplicidades(linhas: LinhaAmplimed[]): PossivelDuplicidade[] {
  type Item = {
    linha: number;
    codp: string;
    nome: string;
    dataNascimento: string;
    telefones: string[];
    cpfOriginal: string;
  };

  const porNomeData = new Map<string, Item[]>();
  const porNomeTelefone = new Map<string, Item[]>();

  for (let i = 0; i < linhas.length; i += 1) {
    const linha = linhas[i];
    const cpfOriginal = texto(linha.cpf);
    if (cpfValido(cpfOriginal)) continue;

    const nome = normalizarNome(linha.nome);
    const nomeKey = chaveNome(nome);
    if (!nomeKey) continue;

    const dataNascimento = texto(linha.dtnasc);
    const dataValida = dataOuNull(dataNascimento);
    const telefones = extrairTelefones(linha.celular, linha.telf, linha.telo);

    const item: Item = {
      linha: i + 2,
      codp: texto(linha.codp),
      nome,
      dataNascimento,
      telefones,
      cpfOriginal,
    };

    if (dataValida) {
      const chave = `${nomeKey}|${dataNascimento}`;
      const grupo = porNomeData.get(chave) ?? [];
      grupo.push(item);
      porNomeData.set(chave, grupo);
    }

    for (const telefone of telefones) {
      const chave = `${nomeKey}|${telefone}`;
      const grupo = porNomeTelefone.get(chave) ?? [];
      grupo.push(item);
      porNomeTelefone.set(chave, grupo);
    }
  }

  const saida: PossivelDuplicidade[] = [];
  const gruposJaAdicionados = new Set<string>();

  for (const [chave, registros] of porNomeData.entries()) {
    if (registros.length < 2) continue;
    const assinatura = registros.map((r) => r.codp).sort().join("|");
    gruposJaAdicionados.add(`DATA:${assinatura}`);
    saida.push({ criterio: "NOME_DATA_NASCIMENTO", chave, registros });
  }

  for (const [chave, registros] of porNomeTelefone.entries()) {
    if (registros.length < 2) continue;
    const assinatura = registros.map((r) => r.codp).sort().join("|");
    if (gruposJaAdicionados.has(`DATA:${assinatura}`)) continue;
    saida.push({ criterio: "NOME_TELEFONE", chave, registros });
  }

  return saida.sort((a, b) => b.registros.length - a.registros.length);
}

function carregarRevisaoDuplicidades(linhas: LinhaAmplimed[]) {
  if (!fs.existsSync(arquivoRevisaoDuplicidades)) {
    throw new Error(
      `Arquivo de revisão de duplicidades não encontrado: ${arquivoRevisaoDuplicidades}`,
    );
  }

  const revisao = JSON.parse(
    fs.readFileSync(arquivoRevisaoDuplicidades, "utf8"),
  ) as ArquivoRevisaoDuplicidades;

  if (!Array.isArray(revisao.duplicidadesEvidentes)) {
    throw new Error(
      "Arquivo de revisão inválido: duplicidadesEvidentes não foi encontrado.",
    );
  }

  const linhaPorCodp = new Map<string, LinhaAmplimed>();
  for (const linha of linhas) {
    const codp = texto(linha.codp);
    if (codp) linhaPorCodp.set(codp, linha);
  }

  const principalPorCodp = new Map<string, string>();
  const linhaPrincipalPorCodp = new Map<string, LinhaAmplimed>();
  let totalConsolidacoes = 0;

  for (const grupo of revisao.duplicidadesEvidentes) {
    const principal = texto(grupo.codpPrincipalSugerido);
    if (!principal) {
      throw new Error(
        `Grupo ${grupo.grupoRelatorio}: codpPrincipalSugerido ausente.`,
      );
    }

    const linhaPrincipal = linhaPorCodp.get(principal);
    if (!linhaPrincipal) {
      throw new Error(
        `Grupo ${grupo.grupoRelatorio}: CODP principal ${principal} não existe no CSV.`,
      );
    }

    const codps = [
      principal,
      ...(Array.isArray(grupo.codpsConsolidarNoPrincipal)
        ? grupo.codpsConsolidarNoPrincipal.map(texto).filter(Boolean)
        : []),
    ];

    for (const codp of codps) {
      if (!linhaPorCodp.has(codp)) {
        throw new Error(
          `Grupo ${grupo.grupoRelatorio}: CODP ${codp} não existe no CSV.`,
        );
      }

      const principalAnterior = principalPorCodp.get(codp);
      if (principalAnterior && principalAnterior !== principal) {
        throw new Error(
          `CODP ${codp} aparece em mais de um grupo de consolidação (${principalAnterior} e ${principal}).`,
        );
      }

      principalPorCodp.set(codp, principal);
    }

    linhaPrincipalPorCodp.set(principal, linhaPrincipal);
    totalConsolidacoes += Math.max(0, codps.length - 1);
  }

  return {
    revisao,
    principalPorCodp,
    linhaPrincipalPorCodp,
    totalConsolidacoes,
  };
}

function duplicidadeJaConsolidadaPorRevisao(
  duplicidade: PossivelDuplicidade,
  principalPorCodp: Map<string, string>,
): boolean {
  const principais = new Set(
    duplicidade.registros
      .map((registro) => principalPorCodp.get(registro.codp))
      .filter((valor): valor is string => Boolean(valor)),
  );

  if (principais.size !== 1) return false;
  const principal = [...principais][0];
  return duplicidade.registros.every(
    (registro) => principalPorCodp.get(registro.codp) === principal,
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não está definida.");
  }

  if (!fs.existsSync(arquivo)) {
    throw new Error(`Arquivo não encontrado: ${arquivo}`);
  }

  const conteudo = fs.readFileSync(arquivo, "utf8");
  const linhas = parseCsvSemDependencia(conteudo);

  if (linhas.length === 0) {
    throw new Error("O CSV não possui registros para importar.");
  }

  const cabecalhosObrigatorios = ["codp", "nome", "cpf"];
  const primeiro = linhas[0];
  for (const cabecalho of cabecalhosObrigatorios) {
    if (!(cabecalho in primeiro)) {
      throw new Error(`Cabeçalho obrigatório ausente no CSV: ${cabecalho}`);
    }
  }

  const {
    revisao: revisaoDuplicidades,
    principalPorCodp,
    linhaPrincipalPorCodp,
    totalConsolidacoes: totalConsolidacoesRevisadas,
  } = carregarRevisaoDuplicidades(linhas);

  const contadores: Contadores = {
    linhasLidas: linhas.length,
    cpfValidos: 0,
    semCpf: 0,
    cpfInvalidos: 0,
    duplicidadesCpfConsolidadas: 0,
    duplicidadesRevisadasConsolidadas: totalConsolidacoesRevisadas,
    pacientesCriar: 0,
    pacientesAtualizar: 0,
    pacientesSemAlteracao: 0,
    registrosLegadosCriar: 0,
    registrosLegadosAtualizar: 0,
    registrosLegadosSemAlteracao: 0,
    nomesAusentesComFallback: 0,
    chavesOrigemAusentesComFallback: 0,
    datasNascimentoInvalidas: 0,
    emailsInvalidos: 0,
    linhasSemTelefoneUtilizavel: 0,
    conflitos: 0,
    erros: 0,
  };

  const problemas: DetalheProblema[] = [];
  const cpfsVistosNoArquivo = new Set<string>();

  console.log("====================================================");
  console.log("IMPORTAÇÃO LEGADA DE PACIENTES - AMPLIMED -> DIGNA CONECT");
  console.log("====================================================");
  console.log(`Modo: ${aplicar ? "APPLY" : "DRY-RUN"}`);
  console.log(`Arquivo: ${arquivo}`);
  console.log(`Linhas encontradas: ${linhas.length}`);
  console.log(`Revisão de duplicidades: ${arquivoRevisaoDuplicidades}`);
  console.log(
    `Consolidações manuais aprovadas: ${totalConsolidacoesRevisadas}`,
  );
  console.log("");
  console.log("Carregando pacientes e vínculos legados já existentes...");

  const pacientesBanco = (await prisma.paciente.findMany({
    select: pacienteSelect,
  })) as PacienteSnapshot[];

  const registrosLegadosBanco = (await prisma.pacienteImportacaoLegada.findMany({
    where: { sistema: SISTEMA_ORIGEM },
    select: {
      id: true,
      pacienteId: true,
      sistema: true,
      chaveExterna: true,
      dadosOriginais: true,
    },
  })) as RegistroLegadoSnapshot[];

  const pacientesPorId = new Map<number, PacienteSnapshot>();
  const pacientesPorCpf = new Map<string, PacienteSnapshot>();
  const codigosPublicosUsados = new Set<string>();

  for (const paciente of pacientesBanco) {
    pacientesPorId.set(paciente.id, paciente);
    if (paciente.cpf && cpfValido(paciente.cpf)) {
      pacientesPorCpf.set(somenteDigitos(paciente.cpf), paciente);
    }
    if (paciente.codigoPublico) codigosPublicosUsados.add(paciente.codigoPublico);
  }

  const legadosPorChave = new Map<string, RegistroLegadoSnapshot>();
  for (const legado of registrosLegadosBanco) {
    legadosPorChave.set(legado.chaveExterna, legado);
  }

  const pacientesPorGrupoRevisado = new Map<string, PacienteSnapshot>();

  for (const grupo of revisaoDuplicidades.duplicidadesEvidentes) {
    const principal = texto(grupo.codpPrincipalSugerido);
    const codpsGrupo = [
      principal,
      ...(grupo.codpsConsolidarNoPrincipal ?? []).map(texto).filter(Boolean),
    ];

    const pacientesExistentes = new Map<number, PacienteSnapshot>();
    for (const codp of codpsGrupo) {
      const legado = legadosPorChave.get(codp);
      if (!legado) continue;
      const paciente = pacientesPorId.get(legado.pacienteId);
      if (paciente) pacientesExistentes.set(paciente.id, paciente);
    }

    if (pacientesExistentes.size > 1) {
      throw new Error(
        `O grupo revisado do CODP principal ${principal} já está vinculado a mais de um paciente no banco. Interrompido para evitar fusão indevida.`,
      );
    }

    const pacienteExistente = [...pacientesExistentes.values()][0];
    if (pacienteExistente) {
      pacientesPorGrupoRevisado.set(principal, pacienteExistente);
    }
  }

  let proximoIdSimulado = -1;

  for (let i = 0; i < linhas.length; i += 1) {
    const linha = linhas[i];
    const numeroLinha = i + 2;
    const codpOriginal = texto(linha.codp);
    const chaveExterna = codpOriginal || `SEM-CODP-LINHA-${numeroLinha}`;

    if (!codpOriginal) contadores.chavesOrigemAusentesComFallback += 1;

    const preparado = dadosPacienteDaLinha(linha, chaveExterna);
    const { dados } = preparado;
    const principalRevisao = principalPorCodp.get(chaveExterna);
    const linhaPrincipalRevisao = principalRevisao
      ? linhaPrincipalPorCodp.get(principalRevisao)
      : undefined;
    const preparadoPrincipalRevisao = linhaPrincipalRevisao
      ? dadosPacienteDaLinha(linhaPrincipalRevisao, principalRevisao!)
      : undefined;
    const dadosParaCriacao = preparadoPrincipalRevisao?.dados ?? dados;

    if (!preparado.nomeOriginal) contadores.nomesAusentesComFallback += 1;

    if (!preparado.cpfDigitos) {
      contadores.semCpf += 1;
    } else if (preparado.cpfEhValido) {
      contadores.cpfValidos += 1;
      if (cpfsVistosNoArquivo.has(preparado.cpfDigitos)) {
        contadores.duplicidadesCpfConsolidadas += 1;
      }
      cpfsVistosNoArquivo.add(preparado.cpfDigitos);
    } else {
      contadores.cpfInvalidos += 1;
    }

    if (preparado.dataNascimentoTexto && !dados.dataNascimento) {
      contadores.datasNascimentoInvalidas += 1;
    }
    if (preparado.emailOriginal && !dados.email) contadores.emailsInvalidos += 1;
    if (preparado.telefones.length === 0) contadores.linhasSemTelefoneUtilizavel += 1;

    try {
      const legadoExistente = legadosPorChave.get(chaveExterna);
      let paciente: PacienteSnapshot | undefined;

      if (legadoExistente) {
        paciente = pacientesPorId.get(legadoExistente.pacienteId);

        if (!paciente) {
          contadores.conflitos += 1;
          problemas.push({
            linha: numeroLinha,
            codp: chaveExterna,
            nome: dados.nome,
            cpfOriginal: preparado.cpfOriginal,
            tipo: "CONFLITO",
            motivo: `O registro legado já existe, mas aponta para paciente inexistente (ID ${legadoExistente.pacienteId}).`,
          });
          continue;
        }

        if (
          preparado.cpfEhValido &&
          paciente.cpf &&
          somenteDigitos(paciente.cpf) !== preparado.cpfDigitos
        ) {
          contadores.conflitos += 1;
          problemas.push({
            linha: numeroLinha,
            codp: chaveExterna,
            nome: dados.nome,
            cpfOriginal: preparado.cpfOriginal,
            tipo: "CONFLITO",
            motivo: `O CODP ${chaveExterna} já está vinculado ao paciente ${paciente.id}, cujo CPF difere do CPF válido atual do CSV.`,
          });
          continue;
        }
      } else if (principalRevisao) {
        paciente = pacientesPorGrupoRevisado.get(principalRevisao);
      } else if (preparado.cpfEhValido) {
        paciente = pacientesPorCpf.get(preparado.cpfDigitos);
      }

      if (!paciente) {
        contadores.pacientesCriar += 1;
        if (!legadoExistente) contadores.registrosLegadosCriar += 1;

        const codigoPublico = gerarCodigoPublicoPaciente(codigosPublicosUsados);

        if (aplicar) {
          const criado = (await prisma.paciente.create({
            data: {
              codigoPublico,
              nome: dadosParaCriacao.nome,
              nomeSocial: dadosParaCriacao.nomeSocial,
              cpf: dadosParaCriacao.cpf,
              rg: dadosParaCriacao.rg,
              telefone: dadosParaCriacao.telefone,
              telefoneSecundario: dadosParaCriacao.telefoneSecundario,
              email: dadosParaCriacao.email,
              dataNascimento: dadosParaCriacao.dataNascimento,
              nomeMae: dadosParaCriacao.nomeMae,
              cep: dadosParaCriacao.cep,
              logradouro: dadosParaCriacao.logradouro,
              numeroEndereco: dadosParaCriacao.numeroEndereco,
              complementoEndereco: dadosParaCriacao.complementoEndereco,
              bairro: dadosParaCriacao.bairro,
              cidade: dadosParaCriacao.cidade,
              uf: dadosParaCriacao.uf,
              responsavelLegalEhMae: dadosParaCriacao.responsavelLegalEhMae,
              responsavelLegalNome: dadosParaCriacao.responsavelLegalNome,
              responsavelLegalCpf: dadosParaCriacao.responsavelLegalCpf,
              responsavelLegalTelefone: dadosParaCriacao.responsavelLegalTelefone,
              responsavelLegalParentesco: dadosParaCriacao.responsavelLegalParentesco,
              beneficioAtivo: false,
              importacoesLegadas: {
                create: {
                  sistema: SISTEMA_ORIGEM,
                  chaveExterna,
                  dadosOriginais: linha as any,
                },
              },
            },
            select: pacienteSelect,
          })) as PacienteSnapshot;

          paciente = criado;
        } else {
          paciente = snapshotNovoSimulado(
            proximoIdSimulado,
            codigoPublico,
            dadosParaCriacao,
          );
          proximoIdSimulado -= 1;
        }

        pacientesPorId.set(paciente.id, paciente);
        if (paciente.cpf) pacientesPorCpf.set(somenteDigitos(paciente.cpf), paciente);
        if (principalRevisao) {
          pacientesPorGrupoRevisado.set(principalRevisao, paciente);
        }

        const complementoInicial = montarComplementoPaciente(paciente, dados);
        if (Object.keys(complementoInicial).length > 0) {
          if (aplicar) {
            const atualizado = (await prisma.paciente.update({
              where: { id: paciente.id },
              data: complementoInicial,
              select: pacienteSelect,
            })) as PacienteSnapshot;
            paciente = atualizado;
          } else {
            paciente = aplicarUpdateEmSnapshot(paciente, complementoInicial);
          }

          pacientesPorId.set(paciente.id, paciente);
          if (paciente.cpf) {
            pacientesPorCpf.set(somenteDigitos(paciente.cpf), paciente);
          }
          if (principalRevisao) {
            pacientesPorGrupoRevisado.set(principalRevisao, paciente);
          }
        }

        const legadoSimulado: RegistroLegadoSnapshot = {
          id: proximoIdSimulado,
          pacienteId: paciente.id,
          sistema: SISTEMA_ORIGEM,
          chaveExterna,
          dadosOriginais: linha,
        };
        proximoIdSimulado -= 1;
        legadosPorChave.set(chaveExterna, legadoSimulado);
        continue;
      }

      if (
        preparado.cpfEhValido &&
        paciente.cpf &&
        somenteDigitos(paciente.cpf) !== preparado.cpfDigitos
      ) {
        contadores.conflitos += 1;
        problemas.push({
          linha: numeroLinha,
          codp: chaveExterna,
          nome: dados.nome,
          cpfOriginal: preparado.cpfOriginal,
          tipo: "CONFLITO",
          motivo: `O paciente ${paciente.id} possui CPF diferente do CPF válido da linha. Nenhuma consolidação foi feita.`,
        });
        continue;
      }

      if (preparado.cpfEhValido && !paciente.cpf) {
        const outroComMesmoCpf = pacientesPorCpf.get(preparado.cpfDigitos);
        if (outroComMesmoCpf && outroComMesmoCpf.id !== paciente.id) {
          contadores.conflitos += 1;
          problemas.push({
            linha: numeroLinha,
            codp: chaveExterna,
            nome: dados.nome,
            cpfOriginal: preparado.cpfOriginal,
            tipo: "CONFLITO",
            motivo: `O CODP ${chaveExterna} está vinculado ao paciente ${paciente.id}, mas o CPF válido da linha já pertence ao paciente ${outroComMesmoCpf.id}. Nenhuma consolidação automática foi feita.`,
          });
          continue;
        }
      }

      const updatePaciente = montarComplementoPaciente(paciente, dados);
      const temUpdatePaciente = Object.keys(updatePaciente).length > 0;

      if (temUpdatePaciente) {
        contadores.pacientesAtualizar += 1;
      } else {
        contadores.pacientesSemAlteracao += 1;
      }

      if (!legadoExistente) {
        contadores.registrosLegadosCriar += 1;
      } else if (!jsonIgual(legadoExistente.dadosOriginais, linha)) {
        contadores.registrosLegadosAtualizar += 1;
      } else {
        contadores.registrosLegadosSemAlteracao += 1;
      }

      if (aplicar) {
        if (!legadoExistente) {
          const atualizado = (await prisma.paciente.update({
            where: { id: paciente.id },
            data: {
              ...updatePaciente,
              importacoesLegadas: {
                create: {
                  sistema: SISTEMA_ORIGEM,
                  chaveExterna,
                  dadosOriginais: linha as any,
                },
              },
            },
            select: pacienteSelect,
          })) as PacienteSnapshot;
          paciente = atualizado;
        } else {
          const operacoes: Promise<unknown>[] = [];

          if (temUpdatePaciente) {
            operacoes.push(
              prisma.paciente.update({
                where: { id: paciente.id },
                data: updatePaciente,
              }),
            );
          }

          if (!jsonIgual(legadoExistente.dadosOriginais, linha)) {
            operacoes.push(
              prisma.pacienteImportacaoLegada.update({
                where: { id: legadoExistente.id },
                data: { dadosOriginais: linha as any },
              }),
            );
          }

          if (operacoes.length > 0) {
            await prisma.$transaction(operacoes as any);
          }

          paciente = aplicarUpdateEmSnapshot(paciente, updatePaciente);
        }
      } else {
        paciente = aplicarUpdateEmSnapshot(paciente, updatePaciente);
      }

      pacientesPorId.set(paciente.id, paciente);
      if (paciente.cpf) pacientesPorCpf.set(somenteDigitos(paciente.cpf), paciente);
      if (principalRevisao) {
        pacientesPorGrupoRevisado.set(principalRevisao, paciente);
      }

      if (!legadoExistente) {
        const legadoSimulado: RegistroLegadoSnapshot = {
          id: proximoIdSimulado,
          pacienteId: paciente.id,
          sistema: SISTEMA_ORIGEM,
          chaveExterna,
          dadosOriginais: linha,
        };
        proximoIdSimulado -= 1;
        legadosPorChave.set(chaveExterna, legadoSimulado);
      } else if (!jsonIgual(legadoExistente.dadosOriginais, linha)) {
        legadosPorChave.set(chaveExterna, {
          ...legadoExistente,
          dadosOriginais: linha,
        });
      }
    } catch (erro) {
      contadores.erros += 1;
      problemas.push({
        linha: numeroLinha,
        codp: chaveExterna,
        nome: dados.nome,
        cpfOriginal: preparado.cpfOriginal,
        tipo: "ERRO",
        motivo: erro instanceof Error ? erro.message : String(erro),
      });
    }

    if ((i + 1) % 1000 === 0) {
      console.log(`Processadas ${i + 1}/${linhas.length} linhas...`);
    }
  }

  const possiveisDuplicidadesDetectadas = registrarPossiveisDuplicidades(linhas);
  const possiveisDuplicidades = possiveisDuplicidadesDetectadas.filter(
    (duplicidade) =>
      !duplicidadeJaConsolidadaPorRevisao(duplicidade, principalPorCodp),
  );
  const sufixo = aplicar ? "apply" : "dry-run";
  const pastaRelatorios = path.dirname(arquivo);

  const resumo = {
    geradoEm: new Date().toISOString(),
    modo: aplicar ? "APPLY" : "DRY-RUN",
    arquivo,
    sistemaOrigem: SISTEMA_ORIGEM,
    contadores,
    pacientesNoBancoAntes: pacientesBanco.length,
    vinculosAmplimedNoBancoAntes: registrosLegadosBanco.length,
    arquivoRevisaoDuplicidades,
    gruposDuplicidadeEvidentesAprovados:
      revisaoDuplicidades.duplicidadesEvidentes.length,
    consolidacoesIndividuaisAprovadas: totalConsolidacoesRevisadas,
    gruposMantidosSeparadosPorEnquanto:
      revisaoDuplicidades.revisaoManual?.length ?? 0,
    totalPossiveisDuplicidadesDetectadasAntesDaRevisao:
      possiveisDuplicidadesDetectadas.length,
    totalPossiveisDuplicidadesParaRevisao: possiveisDuplicidades.length,
  };

  fs.writeFileSync(
    path.join(pastaRelatorios, `importacao-pacientes-amplimed-resumo-${sufixo}.json`),
    JSON.stringify(resumo, null, 2),
    "utf8",
  );

  if (problemas.length > 0) {
    fs.writeFileSync(
      path.join(pastaRelatorios, `importacao-pacientes-amplimed-problemas-${sufixo}.json`),
      JSON.stringify(problemas, null, 2),
      "utf8",
    );
  }

  if (possiveisDuplicidades.length > 0) {
    fs.writeFileSync(
      path.join(
        pastaRelatorios,
        `importacao-pacientes-amplimed-possiveis-duplicidades-${sufixo}.json`,
      ),
      JSON.stringify(possiveisDuplicidades, null, 2),
      "utf8",
    );
  }

  console.log("");
  console.log("====================================================");
  console.log("RESUMO");
  console.log("====================================================");
  console.table(contadores);
  console.log(
    `Duplicidades revisadas e consolidadas: ${totalConsolidacoesRevisadas}`,
  );
  console.log(
    `Possíveis duplicidades restantes para revisão manual: ${possiveisDuplicidades.length}`,
  );
  console.log(`Relatório de resumo salvo em: ${path.join(pastaRelatorios, `importacao-pacientes-amplimed-resumo-${sufixo}.json`)}`);

  if (problemas.length > 0) {
    console.log(
      `Problemas/conflitos salvos em: ${path.join(pastaRelatorios, `importacao-pacientes-amplimed-problemas-${sufixo}.json`)}`,
    );
  }

  if (possiveisDuplicidades.length > 0) {
    console.log(
      `Possíveis duplicidades salvas em: ${path.join(pastaRelatorios, `importacao-pacientes-amplimed-possiveis-duplicidades-${sufixo}.json`)}`,
    );
  }

  console.log("");
  if (aplicar) {
    console.log("Importação legada aplicada. Revise o resumo e os relatórios antes de seguir para produção.");
  } else {
    console.log("DRY-RUN concluído. Nenhuma alteração foi gravada no banco.");
  }
}

main()
  .catch((erro) => {
    console.error("Erro fatal na importação legada de pacientes:", erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
