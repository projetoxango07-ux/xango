"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CircleDollarSign,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Stethoscope,
  UserRound,
  Download,
  FileSpreadsheet,
  Plus,
  Save,
  Search,
  X,
  Trash2,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";

type Unidade = {
  id: number;
  nome: string;
  usaEnderecoFiscal: boolean;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  ativo: boolean;
};

type Preco = {
  id: number;
  ativo: boolean;
  valorPaciente: string | number;
  valorRepasse: string | number;
  procedimento: {
    id: number;
    nome: string;
  };
};

type PrecoUnidade = {
  procedimento: {
    id: number;
    nome: string;
  };
  valorPaciente: number;
  valorRepasse: number;
  margemReais: number;
  margemPercentual: number;
  origem: "CLINICA" | "UNIDADE";
  excecaoId: number | null;
  ativo: boolean;
};

type Clinica = {
  id: number;
  nome: string;
  razaoSocial: string | null;
  documento: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  cepFiscal: string | null;
  logradouroFiscal: string | null;
  numeroFiscal: string | null;
  complementoFiscal: string | null;
  bairroFiscal: string | null;
  cidadeFiscal: string | null;
  ufFiscal: string | null;
  responsavelLegalNome: string | null;
  responsavelLegalCpf: string | null;
  responsavelLegalCargo: string | null;
  responsavelLegalTelefone: string | null;
  responsavelLegalEmail: string | null;
  financeiroMesmoLegal: boolean;
  responsavelFinanceiroNome: string | null;
  responsavelFinanceiroCpf: string | null;
  responsavelFinanceiroCargo: string | null;
  responsavelFinanceiroTelefone: string | null;
  responsavelFinanceiroEmail: string | null;
  observacoes: string | null;
  ativo: boolean;
  unidades: Unidade[];
  precos: Preco[];
  _count: {
    guias: number;
    repasses: number;
  };
  resumoClinica: {
    guiasMes: number;
    valorRepassePendente: number;
  };
};

function formatarDocumento(documento: string | null) {
  if (!documento) return "Não informado";
  const n = documento.replace(/\D/g, "");

  if (n.length === 14) {
    return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(
      8,
      12
    )}-${n.slice(12)}`;
  }

  if (n.length === 11) {
    return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
  }

  return documento;
}

function formatarTelefone(valor: string | null) {
  if (!valor) return "Não informado";
  const n = valor.replace(/\D/g, "");

  if (n.length === 11) {
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  }

  if (n.length === 10) {
    return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  }

  return valor;
}

function moeda(valor: string | number) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}


function numero(valor: string | number) {
  const n = Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function arredondar(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function calcularPorCampo(
  campo: "valorPaciente" | "valorRepasse" | "margemReais" | "margemPercentual",
  valor: number,
  atual: { valorPaciente: string; valorRepasse: string }
) {
  let paciente = numero(atual.valorPaciente);
  let repasse = numero(atual.valorRepasse);

  if (campo === "valorPaciente") paciente = valor;
  if (campo === "valorRepasse") repasse = valor;
  if (campo === "margemReais") paciente = repasse + valor;
  if (campo === "margemPercentual") {
    if (valor >= 100) return null;
    paciente = valor === 100 ? paciente : repasse / (1 - valor / 100);
  }

  return {
    valorPaciente: arredondar(paciente).toFixed(2),
    valorRepasse: arredondar(repasse).toFixed(2),
  };
}

type PreviewExcelRegistro = {
  linha: number;

  informado: {
    tuss: string | null;
    procedimento: string | null;
    valorRepasse: number | null;
    valorPaciente: number | null;
  };

  correspondencia: {
    tipo: string;
    similaridade: number;
  };

  procedimento: {
    id: number | null;
    nome: string;
    aliases: string[];
    tuss: string | null;
    nomeTuss: string | null;
    ch: number | null;
    fonteCh: string | null;
    origem: "CATALOGO" | "BASE_MESTRE";
    referenciaId: number | null;
  } | null;

  valores: {
    valorRepasse: number | null;
    valorPaciente: number | null;
    origem: "PLANILHA" | "CH" | "INCOMPLETO";
  };

  jaCadastradoNaClinica: boolean;
  precoAtual: unknown;
  status: "PRONTO" | "CONFERIR" | "NAO_ENCONTRADO" | "ERRO";
  erros: string[];
};

type PreviewExcel = {
  previewId?: string;
  expiraEm?: string;
  arquivo: string;
  aba: string;

  clinica: {
    id: number;
    nome: string;
    tipoPrecificacao: string;
    valorChPaciente?: number | null;
    valorChRepasse?: number | null;
  };

  resumo: {
    total: number;
    prontos: number;
    conferir: number;
    naoEncontrados: number;
    erros: number;
    jaCadastrados: number;
    calculadosPorCh: number;
  };

  registros: PreviewExcelRegistro[];
};

export default function ClinicaPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [clinica, setClinica] = useState<Clinica | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editandoPrecos, setEditandoPrecos] = useState(false);
  const [salvandoPrecoId, setSalvandoPrecoId] = useState<number | null>(null);
  const [buscaPreco, setBuscaPreco] = useState("");
  const [precosEdicao, setPrecosEdicao] = useState<Record<number, { valorPaciente: string; valorRepasse: string }>>({});
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [modalLote, setModalLote] = useState(false);
  const [modalImportar, setModalImportar] = useState(false);
  const [tipoImportacao, setTipoImportacao] =
  useState<"EXCEL" | "CLINICA" | null>(null);
  const [arquivoExcel, setArquivoExcel] = useState<File | null>(null);
  const [previewExcel, setPreviewExcel] =
  useState<PreviewExcel | null>(null);
  const [carregandoExcel, setCarregandoExcel] = useState(false);
  const [erroExcel, setErroExcel] = useState("");
  const [erroImportacao, setErroImportacao] = useState("");
  const [carregandoClinicasImportacao, setCarregandoClinicasImportacao] = useState(false);
  const [carregandoPrecosOrigem, setCarregandoPrecosOrigem] = useState(false);
  const requisicaoExcel = useRef<AbortController | null>(null);
  const requisicaoImportacao = useRef<AbortController | null>(null);
  const [modalAdicionar, setModalAdicionar] = useState(false);
  const [clinicasImportacao, setClinicasImportacao] = useState<Array<{ id: number; nome: string }>>([]);
  const [clinicaOrigemId, setClinicaOrigemId] = useState("");
  const [precosOrigem, setPrecosOrigem] = useState<Preco[]>([]);
  const [selecionadosImportacao, setSelecionadosImportacao] = useState<number[]>([]);
  const [buscaImportacao, setBuscaImportacao] = useState("");
  const [procedimentosCatalogo, setProcedimentosCatalogo] = useState<Array<{ id: number; nome: string; categoria?: string | null; preparo?: string | null; aliases?: string[] }>>([]);
  const [selecionadosAdicionar, setSelecionadosAdicionar] = useState<number[]>([]);
  const [buscaAdicionar, setBuscaAdicionar] = useState("");
  const [operacaoLote, setOperacaoLote] = useState("MARGEM_PERCENTUAL");
  const [valorLote, setValorLote] = useState("");
  const [processando, setProcessando] = useState(false);
  const [substituirExistentes, setSubstituirExistentes] = useState(false);
  const [criandoProcedimento, setCriandoProcedimento] = useState(false);
  const [novoProcedimentoNome, setNovoProcedimentoNome] = useState("");
  const [novoProcedimentoCategoria, setNovoProcedimentoCategoria] = useState("");
  const [novoProcedimentoPreparo, setNovoProcedimentoPreparo] = useState("");
  const [novoProcedimentoValorPaciente, setNovoProcedimentoValorPaciente] = useState("");
  const [novoProcedimentoValorRepasse, setNovoProcedimentoValorRepasse] = useState("");
  const [novoAlias, setNovoAlias] = useState("");
  const [novosAliases, setNovosAliases] = useState<string[]>([]);
  const [possiveisDuplicados, setPossiveisDuplicados] = useState<Array<{ id: number; nome: string; aliases?: string[]; similaridade?: number }>>([]);
  const [podeConfirmarMesmoAssim, setPodeConfirmarMesmoAssim] = useState(false);
  const [procedimentoEditando, setProcedimentoEditando] = useState<{
    id: number;
    nome: string;
    categoria: string;
    preparo: string;
    aliases: string[];
  } | null>(null);
  const [aliasEdicao, setAliasEdicao] = useState("");
  const [modalPrecosUnidade, setModalPrecosUnidade] = useState(false);
  const [unidadePrecoId, setUnidadePrecoId] = useState("");
  const [precosUnidade, setPrecosUnidade] = useState<PrecoUnidade[]>([]);
  const [buscaPrecoUnidade, setBuscaPrecoUnidade] = useState("");
  const [carregandoPrecosUnidade, setCarregandoPrecosUnidade] = useState(false);
  const [editandoPrecoUnidadeId, setEditandoPrecoUnidadeId] = useState<number | null>(null);
  const [edicaoPrecoUnidade, setEdicaoPrecoUnidade] = useState<{ valorPaciente: string; valorRepasse: string }>({ valorPaciente: "", valorRepasse: "" });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          setCarregando(true);
          setErro("");

          const resposta = await fetch(
            `http://localhost:3333/clinicas/${id}`,
            {
              cache: "no-store",
            }
          );

          const resultado = await resposta.json();

          if (!resposta.ok) {
            throw new Error(
              resultado.erro ||
                "Não foi possível carregar a clínica."
            );
          }

          setClinica(resultado);
        } catch (e) {
          console.error("Erro ao carregar clínica:", e);

          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível carregar a clínica."
          );
        } finally {
          setCarregando(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [id]);

  useEffect(() => {
    return () => {
      requisicaoExcel.current?.abort();
      requisicaoImportacao.current?.abort();
      requisicaoExcel.current = null;
      requisicaoImportacao.current = null;
    };
  }, [id]);

  function interromperAnaliseExcel() {
    requisicaoExcel.current?.abort();
    requisicaoExcel.current = null;
    setCarregandoExcel(false);
  }

  function voltarImportacao() {
    if (processando) return;
    interromperAnaliseExcel();
    requisicaoImportacao.current?.abort();
    requisicaoImportacao.current = null;
    setCarregandoClinicasImportacao(false);
    setCarregandoPrecosOrigem(false);
    setTipoImportacao(null);
  }

  function fecharImportacao() {
    if (processando) return;
    voltarImportacao();
    setModalImportar(false);
  }

  async function carregarClinicasImportacao() {
    requisicaoImportacao.current?.abort();
    const controle = new AbortController();
    requisicaoImportacao.current = controle;
    setTipoImportacao("CLINICA");
    setErroImportacao("");
    setCarregandoClinicasImportacao(true);
    try {
      const resposta = await fetch("http://localhost:3333/clinicas/resumo", {
        cache: "no-store", signal: controle.signal,
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível carregar as clínicas.");
      if (!Array.isArray(dados)) throw new Error("A lista de clínicas recebida é inválida.");
      if (requisicaoImportacao.current !== controle) return;
      setClinicasImportacao(dados.filter((c: { id: number }) => c.id !== id));
    } catch (e) {
      if (controle.signal.aborted || requisicaoImportacao.current !== controle) return;
      setErroImportacao(e instanceof Error ? e.message : "Erro ao carregar as clínicas.");
    } finally {
      if (requisicaoImportacao.current === controle) {
        requisicaoImportacao.current = null;
        setCarregandoClinicasImportacao(false);
      }
    }
  }

  async function carregarPrecosOrigem(valor: string) {
    requisicaoImportacao.current?.abort();
    requisicaoImportacao.current = null;
    setClinicaOrigemId(valor);
    setPrecosOrigem([]);
    setSelecionadosImportacao([]);
    setBuscaImportacao("");
    setErroImportacao("");
    setCarregandoPrecosOrigem(false);
    if (!valor) return;
    const controle = new AbortController();
    requisicaoImportacao.current = controle;
    setCarregandoPrecosOrigem(true);
    try {
      const resposta = await fetch(`http://localhost:3333/clinicas/${valor}/precos`, {
        cache: "no-store", signal: controle.signal,
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível carregar a tabela de origem.");
      const precos = Array.isArray(dados.precos) ? dados.precos : Array.isArray(dados) ? dados : null;
      if (!precos) throw new Error("A tabela de origem recebida é inválida.");
      if (requisicaoImportacao.current !== controle) return;
      setPrecosOrigem(precos);
    } catch (e) {
      if (controle.signal.aborted || requisicaoImportacao.current !== controle) return;
      setErroImportacao(e instanceof Error ? e.message : "Erro ao carregar a tabela de origem.");
    } finally {
      if (requisicaoImportacao.current === controle) {
        requisicaoImportacao.current = null;
        setCarregandoPrecosOrigem(false);
      }
    }
  }

  async function analisarPlanilha() {
    if (!arquivoExcel || carregandoExcel || processando) return;
    interromperAnaliseExcel();
    const controle = new AbortController();
    requisicaoExcel.current = controle;
    setCarregandoExcel(true);
    setErroExcel("");
    setPreviewExcel(null);
    const timeout = window.setTimeout(() => controle.abort(), 120000);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivoExcel);
      const resposta = await fetch(
        `http://localhost:3333/clinicas/${id}/precos/importar-excel/preview`,
        { method: "POST", body: formData, signal: controle.signal }
      );
      // Alguns erros de upload/proxy não retornam JSON.
      const texto = await resposta.text();
      let dados;
      try {
        dados = JSON.parse(texto);
      } catch {
        throw new Error(`O servidor retornou uma resposta inválida (HTTP ${resposta.status}). Tente novamente.`);
      }
      if (!resposta.ok) throw new Error(dados?.erro || "Não foi possível analisar a planilha.");
      if (!dados || !Array.isArray(dados.registros) || !dados.resumo ||
          !dados.registros.every((registro: PreviewExcelRegistro) =>
            registro && registro.informado && registro.valores && registro.correspondencia &&
            ["PRONTO", "CONFERIR", "NAO_ENCONTRADO", "ERRO"].includes(registro.status)
          )) {
        throw new Error("A prévia recebida está incompleta. Confira a resposta do servidor.");
      }
      if (requisicaoExcel.current !== controle) return;
      setPreviewExcel(dados);
    } catch (e) {
      if (requisicaoExcel.current !== controle) return;
      setErroExcel(controle.signal.aborted
        ? "A análise demorou mais que o esperado. Tente novamente."
        : e instanceof Error ? e.message : "Erro ao analisar a planilha.");
    } finally {
      window.clearTimeout(timeout);
      if (requisicaoExcel.current === controle) {
        requisicaoExcel.current = null;
        setCarregandoExcel(false);
      }
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-80 items-center justify-center text-xango-muted">
        <Loader2 size={22} className="mr-2 animate-spin" />
        Carregando clínica...
      </div>
    );
  }

  if (erro || !clinica) {
    return (
      <div className="mx-auto max-w-375">
        <button
          type="button"
          onClick={() => router.push("/clinicas")}
          className="mb-4 flex items-center gap-2 text-sm font-semibold text-xango-primary"
        >
          <ArrowLeft size={16} />
          Voltar para clínicas
        </button>

        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
          {erro || "Clínica não encontrada."}
        </div>
      </div>
    );
  }

  const unidadeAtivas = clinica.unidades.filter((u) => u.ativo);
  const precosAtivos = clinica.precos.filter((p) => p.ativo);

  return (
    <div className="mx-auto max-w-375 pb-12">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.push("/clinicas")}
            className="mt-0.5 rounded-md border border-xango-border bg-white p-2 text-xango-primary transition hover:bg-xango-background"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-xango-text">
                {clinica.nome}
              </h2>

              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  clinica.ativo
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {clinica.ativo ? "Ativa" : "Inativa"}
              </span>
            </div>

            <p className="mt-1 text-sm text-xango-muted">
              {clinica.razaoSocial || "Razão social não informada"} •{" "}
              {formatarDocumento(clinica.documento)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push(`/clinicas/${clinica.id}/editar`)}
          className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-4 py-2.5 text-sm font-semibold text-xango-primary transition hover:bg-xango-background"
        >
          <Pencil size={16} />
          Editar dados
        </button>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo
          icone={<Building2 size={18} />}
          valor={String(unidadeAtivas.length)}
          titulo="Unidades ativas"
        />
        <Resumo
          icone={<Stethoscope size={18} />}
          valor={String(precosAtivos.length)}
          titulo="Procedimentos"
        />
        <Resumo
          icone={<Building2 size={18} />}
          valor={String(clinica.resumoClinica.guiasMes)}
          titulo="Guias no mês"
        />
        <Resumo
          icone={<CircleDollarSign size={18} />}
          valor={moeda(clinica.resumoClinica.valorRepassePendente)}
          titulo="Repasse pendente"
        />
      </section>

      <Bloco titulo="Dados da clínica" icone={<Building2 size={18} />}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Info titulo="Nome fantasia" valor={clinica.nome} />
          <Info
            titulo="Razão social"
            valor={clinica.razaoSocial || "Não informado"}
          />
          <Info
            titulo="CNPJ / CPF"
            valor={formatarDocumento(clinica.documento)}
          />
          <Info
            titulo="Telefone"
            valor={formatarTelefone(clinica.telefone)}
          />
          <Info
            titulo="WhatsApp"
            valor={formatarTelefone(clinica.whatsapp)}
          />
          <Info titulo="E-mail" valor={clinica.email || "Não informado"} />
        </div>
      </Bloco>

      <Bloco titulo="Endereço fiscal" icone={<MapPin size={18} />}>
        <p className="text-sm text-xango-text">
          {clinica.logradouroFiscal
            ? `${clinica.logradouroFiscal}, ${clinica.numeroFiscal || "s/n"}${
                clinica.complementoFiscal
                  ? ` - ${clinica.complementoFiscal}`
                  : ""
              }`
            : "Endereço fiscal não informado"}
        </p>

        {clinica.bairroFiscal && (
          <p className="mt-1 text-sm text-xango-muted">
            {clinica.bairroFiscal} • {clinica.cidadeFiscal || ""}
            {clinica.ufFiscal ? ` / ${clinica.ufFiscal}` : ""} • CEP{" "}
            {clinica.cepFiscal || "não informado"}
          </p>
        )}
      </Bloco>

      <Bloco titulo="Responsáveis" icone={<UserRound size={18} />}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Responsavel
            titulo="Responsável legal"
            nome={clinica.responsavelLegalNome}
            cargo={clinica.responsavelLegalCargo}
            telefone={clinica.responsavelLegalTelefone}
            email={clinica.responsavelLegalEmail}
          />

          <Responsavel
            titulo="Responsável financeiro"
            nome={clinica.responsavelFinanceiroNome}
            cargo={clinica.responsavelFinanceiroCargo}
            telefone={clinica.responsavelFinanceiroTelefone}
            email={clinica.responsavelFinanceiroEmail}
          />
        </div>
      </Bloco>

      <Bloco titulo="Unidades de atendimento" icone={<MapPin size={18} />}>
        {clinica.unidades.length === 0 ? (
          <p className="text-sm text-xango-muted">
            Nenhuma unidade cadastrada.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {clinica.unidades.map((unidade) => (
              <div
                key={unidade.id}
                className="rounded-lg border border-xango-border p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-xango-text">
                    {unidade.nome}
                  </p>

                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                      unidade.ativo
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {unidade.ativo ? "Ativa" : "Inativa"}
                  </span>
                </div>

                <p className="mt-2 text-sm text-xango-muted">
                  {unidade.logradouro
                    ? `${unidade.logradouro}, ${unidade.numero || "s/n"}`
                    : "Endereço não informado"}
                </p>

                {unidade.cidade && (
                  <p className="mt-1 text-xs text-xango-muted">
                    {unidade.bairro ? `${unidade.bairro} • ` : ""}
                    {unidade.cidade}
                    {unidade.uf ? ` / ${unidade.uf}` : ""}
                  </p>
                )}

                <div className="mt-3 space-y-1">
                  {(unidade.whatsapp || unidade.telefone) && (
                    <p className="flex items-center gap-2 text-xs text-xango-muted">
                      <Phone size={13} />
                      {formatarTelefone(
                        unidade.whatsapp || unidade.telefone
                      )}
                    </p>
                  )}

                  {unidade.email && (
                    <p className="flex items-center gap-2 text-xs text-xango-muted">
                      <Mail size={13} />
                      {unidade.email}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Bloco>

      <Bloco
        titulo="Procedimentos e preços"
        icone={<Stethoscope size={18} />}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-64 flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-xango-muted" />
            <input
              value={buscaPreco}
              onChange={(e) => setBuscaPreco(e.target.value)}
              placeholder="Buscar procedimento..."
              className="w-full rounded-md border border-xango-border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-xango-primary"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {selecionados.length > 0 && (
              <button type="button" onClick={() => setModalLote(true)} className="rounded-md border border-xango-border bg-white px-3 py-2 text-sm font-semibold text-xango-primary">
                Alterar em lote ({selecionados.length})
              </button>
            )}
            {unidadeAtivas.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setModalPrecosUnidade(true);
                  setUnidadePrecoId("");
                  setPrecosUnidade([]);
                  setBuscaPrecoUnidade("");
                  setEditandoPrecoUnidadeId(null);
                }}
                className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-sm font-semibold text-xango-primary"
              >
                <SlidersHorizontal size={15} />
                Preços por unidade
              </button>
            )}
            <button type="button" onClick={() => {
              setTipoImportacao(null);
              setSubstituirExistentes(false);
              setClinicaOrigemId("");
              setPrecosOrigem([]);
              setSelecionadosImportacao([]);
              setBuscaImportacao("");
              setArquivoExcel(null);
              setPreviewExcel(null);
              setErroExcel("");
              setErroImportacao("");
              setModalImportar(true);
            }} className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-sm font-semibold text-xango-primary">
              <Download size={15} /> Importar tabela
            </button>
            <button type="button" onClick={async () => {
              setModalAdicionar(true);
              const r = await fetch("http://localhost:3333/procedimentos", { cache: "no-store" });
              const dados = await r.json();
              setProcedimentosCatalogo(Array.isArray(dados) ? dados : []);
            }} className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-sm font-semibold text-xango-primary">
              <Plus size={15} /> Adicionar procedimentos
            </button>
            <button
              type="button"
              onClick={() => setEditandoPrecos((v) => !v)}
              className="flex items-center gap-2 rounded-md bg-xango-primary px-3 py-2 text-sm font-semibold text-white"
            >
              {editandoPrecos ? <X size={15} /> : <Pencil size={15} />}
              {editandoPrecos ? "Finalizar edição" : "Editar preços"}
            </button>
          </div>
        </div>

        {precosAtivos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-xango-border p-8 text-center">
            <Stethoscope size={24} className="mx-auto text-xango-muted" />
            <p className="mt-2 text-sm font-semibold text-xango-text">Nenhuma tabela de preços cadastrada.</p>
            <p className="mt-1 text-xs text-xango-muted">Adicione procedimentos ou importe a tabela de outra clínica.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-xango-border text-left">
                  <th className="w-10 py-2 pr-2">
                    <input type="checkbox" checked={precosAtivos.length > 0 && selecionados.length === precosAtivos.length} onChange={(e) => setSelecionados(e.target.checked ? precosAtivos.map((p) => p.id) : [])} />
                  </th>
                  <th className="py-2 pr-3 text-xs font-semibold text-xango-muted">Procedimento</th>
                  <th className="px-2 py-2 text-xs font-semibold text-xango-muted">Valor paciente</th>
                  <th className="px-2 py-2 text-xs font-semibold text-xango-muted">Repasse</th>
                  <th className="px-2 py-2 text-xs font-semibold text-xango-muted">Margem R$</th>
                  <th className="px-2 py-2 text-xs font-semibold text-xango-muted">Margem %</th>
                  {editandoPrecos && <th className="py-2 pl-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-xango-border">
                {precosAtivos
                  .filter((preco) => preco.procedimento.nome.toLowerCase().includes(buscaPreco.toLowerCase()))
                  .map((preco) => {
                    const edicao = precosEdicao[preco.id] || {
                      valorPaciente: String(preco.valorPaciente),
                      valorRepasse: String(preco.valorRepasse),
                    };
                    const paciente = Number(edicao.valorPaciente) || 0;
                    const repasse = Number(edicao.valorRepasse) || 0;
                    const margem = paciente - repasse;
                    const margemPercentual = paciente > 0 ? (margem / paciente) * 100 : 0;

                    const atualizar = (campo: "valorPaciente" | "valorRepasse", valor: string) =>
                      setPrecosEdicao((atual) => ({
                        ...atual,
                        [preco.id]: { ...edicao, [campo]: valor },
                      }));

                    return (
                      <tr key={preco.id}>
                        <td className="py-3 pr-2">
                          <input type="checkbox" checked={selecionados.includes(preco.id)} onChange={(e) => setSelecionados((atual) => e.target.checked ? [...atual, preco.id] : atual.filter((id) => id !== preco.id))} />
                        </td>
                        <td className="py-3 pr-3 text-sm font-medium text-xango-text">{preco.procedimento.nome}</td>
                        <td className="px-2 py-2">
                          {editandoPrecos ? (
                            <input type="number" step="0.01" value={edicao.valorPaciente} onChange={(e) => atualizar("valorPaciente", e.target.value)} className="w-28 rounded-md border border-xango-border px-2 py-1.5 text-sm" />
                          ) : moeda(preco.valorPaciente)}
                        </td>
                        <td className="px-2 py-2">
                          {editandoPrecos ? (
                            <input type="number" step="0.01" value={edicao.valorRepasse} onChange={(e) => atualizar("valorRepasse", e.target.value)} className="w-28 rounded-md border border-xango-border px-2 py-1.5 text-sm" />
                          ) : moeda(preco.valorRepasse)}
                        </td>
                        <td className="px-2 py-2">
                          {editandoPrecos ? (
                            <input type="number" step="0.01" value={margem.toFixed(2)} onChange={(e) => {
                              const calculado = calcularPorCampo("margemReais", numero(e.target.value), edicao);
                              if (calculado) setPrecosEdicao((atual) => ({ ...atual, [preco.id]: calculado }));
                            }} className={`w-28 rounded-md border px-2 py-1.5 text-sm ${margem < 0 ? "border-red-300 text-red-600" : "border-xango-border"}`} />
                          ) : <span className={margem < 0 ? "text-red-600" : "text-xango-text"}>{moeda(margem)}</span>}
                        </td>
                        <td className="px-2 py-2">
                          {editandoPrecos ? (
                            <input type="number" step="0.01" max="99.99" value={margemPercentual.toFixed(2)} onChange={(e) => {
                              const calculado = calcularPorCampo("margemPercentual", numero(e.target.value), edicao);
                              if (calculado) setPrecosEdicao((atual) => ({ ...atual, [preco.id]: calculado }));
                            }} className={`w-24 rounded-md border px-2 py-1.5 text-sm ${margemPercentual < 0 ? "border-red-300 text-red-600" : "border-xango-border"}`} />
                          ) : <span className={margemPercentual < 0 ? "text-red-600" : "text-xango-text"}>{margemPercentual.toFixed(2)}%</span>}
                        </td>
                        {editandoPrecos && (
                          <td className="py-2 pl-2">
                            <button
                              type="button"
                              disabled={salvandoPrecoId === preco.id}
                              onClick={async () => {
                                try {
                                  setSalvandoPrecoId(preco.id);
                                  const resposta = await fetch(`http://localhost:3333/clinicas/${clinica.id}/precos/${preco.procedimento.id}`, {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ valorPaciente: paciente, valorRepasse: repasse }),
                                  });
                                  const resultado = await resposta.json();
                                  if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível salvar.");
                                  setClinica((atual) => atual ? {
                                    ...atual,
                                    precos: atual.precos.map((p) => p.id === preco.id ? { ...p, valorPaciente: paciente, valorRepasse: repasse } : p),
                                  } : atual);
                                } catch (e) {
                                  window.alert(e instanceof Error ? e.message : "Não foi possível salvar o preço.");
                                } finally {
                                  setSalvandoPrecoId(null);
                                }
                              }}
                              className="rounded-md border border-xango-border p-2 text-xango-primary hover:bg-xango-background disabled:opacity-50"
                              title="Salvar"
                            >
                              {salvandoPrecoId === preco.id ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </Bloco>


      {modalPrecosUnidade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-xango-text">Preços específicos por unidade</h3>
                <p className="mt-1 text-sm text-xango-muted">
                  A unidade usa a tabela-base da clínica. Crie uma exceção somente quando o valor for diferente.
                </p>
              </div>
              <button type="button" onClick={() => setModalPrecosUnidade(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(220px,320px)_1fr]">
              <select
                value={unidadePrecoId}
                onChange={async (e) => {
                  const valor = e.target.value;
                  setUnidadePrecoId(valor);
                  setEditandoPrecoUnidadeId(null);
                  if (!valor) {
                    setPrecosUnidade([]);
                    return;
                  }

                  try {
                    setCarregandoPrecosUnidade(true);
                    const r = await fetch(
                      `http://localhost:3333/clinicas/${clinica.id}/unidades/${valor}/precos`,
                      { cache: "no-store" }
                    );
                    const d = await r.json();
                    if (!r.ok) throw new Error(d.erro || "Não foi possível carregar os preços da unidade.");
                    setPrecosUnidade(Array.isArray(d.precos) ? d.precos : []);
                  } catch (e) {
                    window.alert(e instanceof Error ? e.message : "Erro ao carregar preços da unidade.");
                  } finally {
                    setCarregandoPrecosUnidade(false);
                  }
                }}
                className="rounded-md border border-xango-border bg-white px-3 py-2 text-sm"
              >
                <option value="">Selecione a unidade</option>
                {unidadeAtivas.map((unidade) => (
                  <option key={unidade.id} value={unidade.id}>
                    {unidade.nome}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-xango-muted" />
                <input
                  value={buscaPrecoUnidade}
                  onChange={(e) => setBuscaPrecoUnidade(e.target.value)}
                  placeholder="Buscar procedimento..."
                  disabled={!unidadePrecoId}
                  className="w-full rounded-md border border-xango-border bg-white py-2 pl-9 pr-3 text-sm disabled:bg-slate-50"
                />
              </div>
            </div>

            {!unidadePrecoId ? (
              <div className="mt-5 rounded-lg border border-dashed border-xango-border p-8 text-center text-sm text-xango-muted">
                Selecione uma unidade para conferir ou alterar suas exceções de preço.
              </div>
            ) : carregandoPrecosUnidade ? (
              <div className="flex min-h-40 items-center justify-center text-sm text-xango-muted">
                <Loader2 size={18} className="mr-2 animate-spin" />
                Carregando preços...
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-lg border border-xango-border">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-xango-border bg-xango-background text-left">
                      <th className="px-3 py-2 text-xs font-semibold text-xango-muted">Procedimento</th>
                      <th className="px-3 py-2 text-xs font-semibold text-xango-muted">Valor paciente</th>
                      <th className="px-3 py-2 text-xs font-semibold text-xango-muted">Repasse</th>
                      <th className="px-3 py-2 text-xs font-semibold text-xango-muted">Margem</th>
                      <th className="px-3 py-2 text-xs font-semibold text-xango-muted">Origem</th>
                      <th className="w-28 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-xango-border">
                    {precosUnidade
                      .filter((p) =>
                        p.procedimento.nome.toLowerCase().includes(buscaPrecoUnidade.toLowerCase())
                      )
                      .map((preco) => {
                        const editando = editandoPrecoUnidadeId === preco.procedimento.id;
                        const pacienteEditado = editando ? numero(edicaoPrecoUnidade.valorPaciente) : preco.valorPaciente;
                        const repasseEditado = editando ? numero(edicaoPrecoUnidade.valorRepasse) : preco.valorRepasse;
                        const margem = pacienteEditado - repasseEditado;
                        const margemPct = pacienteEditado > 0 ? (margem / pacienteEditado) * 100 : 0;

                        return (
                          <tr key={preco.procedimento.id}>
                            <td className="px-3 py-3 text-sm font-medium text-xango-text">
                              {preco.procedimento.nome}
                            </td>
                            <td className="px-3 py-3 text-sm">
                              {editando ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={edicaoPrecoUnidade.valorPaciente}
                                  onChange={(e) =>
                                    setEdicaoPrecoUnidade((atual) => ({
                                      ...atual,
                                      valorPaciente: e.target.value,
                                    }))
                                  }
                                  className="w-28 rounded-md border border-xango-border px-2 py-1.5"
                                />
                              ) : (
                                moeda(preco.valorPaciente)
                              )}
                            </td>
                            <td className="px-3 py-3 text-sm">
                              {editando ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={edicaoPrecoUnidade.valorRepasse}
                                  onChange={(e) =>
                                    setEdicaoPrecoUnidade((atual) => ({
                                      ...atual,
                                      valorRepasse: e.target.value,
                                    }))
                                  }
                                  className="w-28 rounded-md border border-xango-border px-2 py-1.5"
                                />
                              ) : (
                                moeda(preco.valorRepasse)
                              )}
                            </td>
                            <td className={`px-3 py-3 text-sm ${margem < 0 ? "text-red-600" : "text-xango-text"}`}>
                              {moeda(margem)} <span className="text-xs text-xango-muted">({margemPct.toFixed(2)}%)</span>
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                  preco.origem === "UNIDADE"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {preco.origem === "UNIDADE" ? "Exceção da unidade" : "Tabela-base"}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex justify-end gap-1">
                                {editando ? (
                                  <>
                                    <button
                                      type="button"
                                      title="Salvar exceção"
                                      disabled={processando}
                                      onClick={async () => {
                                        try {
                                          setProcessando(true);
                                          const r = await fetch(
                                            `http://localhost:3333/clinicas/${clinica.id}/unidades/${unidadePrecoId}/precos/${preco.procedimento.id}`,
                                            {
                                              method: "PUT",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({
                                                valorPaciente: pacienteEditado,
                                                valorRepasse: repasseEditado,
                                              }),
                                            }
                                          );
                                          const d = await r.json();
                                          if (!r.ok) throw new Error(d.erro || "Não foi possível salvar a exceção.");

                                          setPrecosUnidade((atual) =>
                                            atual.map((item) =>
                                              item.procedimento.id === preco.procedimento.id
                                                ? {
                                                    ...item,
                                                    valorPaciente: Number(d.valorPaciente),
                                                    valorRepasse: Number(d.valorRepasse),
                                                    margemReais: Number(d.margemReais),
                                                    margemPercentual: Number(d.margemPercentual),
                                                    origem: "UNIDADE",
                                                    excecaoId: d.id,
                                                  }
                                                : item
                                            )
                                          );
                                          setEditandoPrecoUnidadeId(null);
                                        } catch (e) {
                                          window.alert(e instanceof Error ? e.message : "Erro ao salvar exceção.");
                                        } finally {
                                          setProcessando(false);
                                        }
                                      }}
                                      className="rounded-md border border-xango-border p-2 text-xango-primary"
                                    >
                                      {processando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    </button>
                                    <button
                                      type="button"
                                      title="Cancelar"
                                      onClick={() => setEditandoPrecoUnidadeId(null)}
                                      className="rounded-md border border-xango-border p-2 text-xango-muted"
                                    >
                                      <X size={14} />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    title={preco.origem === "UNIDADE" ? "Editar exceção" : "Criar exceção para esta unidade"}
                                    onClick={() => {
                                      setEditandoPrecoUnidadeId(preco.procedimento.id);
                                      setEdicaoPrecoUnidade({
                                        valorPaciente: String(preco.valorPaciente),
                                        valorRepasse: String(preco.valorRepasse),
                                      });
                                    }}
                                    className="rounded-md border border-xango-border p-2 text-xango-primary"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                )}

                                {preco.origem === "UNIDADE" && !editando && (
                                  <button
                                    type="button"
                                    title="Restaurar tabela-base da clínica"
                                    onClick={async () => {
                                      if (!window.confirm("Remover esta exceção e voltar a usar o preço-base da clínica?")) return;

                                      try {
                                        setProcessando(true);
                                        const r = await fetch(
                                          `http://localhost:3333/clinicas/${clinica.id}/unidades/${unidadePrecoId}/precos/${preco.procedimento.id}`,
                                          { method: "DELETE" }
                                        );
                                        const d = await r.json();
                                        if (!r.ok) throw new Error(d.erro || "Não foi possível restaurar o preço-base.");

                                        const base = clinica.precos.find(
                                          (p) => p.procedimento.id === preco.procedimento.id && p.ativo
                                        );

                                        if (base) {
                                          const vp = Number(base.valorPaciente);
                                          const vr = Number(base.valorRepasse);
                                          const mr = vp - vr;
                                          setPrecosUnidade((atual) =>
                                            atual.map((item) =>
                                              item.procedimento.id === preco.procedimento.id
                                                ? {
                                                    ...item,
                                                    valorPaciente: vp,
                                                    valorRepasse: vr,
                                                    margemReais: mr,
                                                    margemPercentual: vp > 0 ? (mr / vp) * 100 : 0,
                                                    origem: "CLINICA",
                                                    excecaoId: null,
                                                  }
                                                : item
                                            )
                                          );
                                        }
                                      } catch (e) {
                                        window.alert(e instanceof Error ? e.message : "Erro ao restaurar preço-base.");
                                      } finally {
                                        setProcessando(false);
                                      }
                                    }}
                                    className="rounded-md border border-amber-200 p-2 text-amber-700"
                                  >
                                    <RotateCcw size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-xango-muted">
                “Tabela-base” acompanha automaticamente futuras alterações da clínica. “Exceção da unidade” permanece independente até ser restaurada.
              </p>
              <button
                type="button"
                onClick={() => setModalPrecosUnidade(false)}
                className="rounded-md border border-xango-border px-4 py-2 text-sm font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalLote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between"><h3 className="font-semibold text-xango-text">Alteração em lote</h3><button onClick={() => setModalLote(false)}><X size={18} /></button></div>
            <p className="mt-1 text-sm text-xango-muted">{selecionados.length} procedimento(s) selecionado(s).</p>
            <div className="mt-4 grid gap-3">
              <select value={operacaoLote} onChange={(e) => setOperacaoLote(e.target.value)} className="rounded-md border border-xango-border px-3 py-2 text-sm">
                <option value="MARGEM_PERCENTUAL">Definir margem %</option>
                <option value="MARGEM_REAIS">Definir margem R$</option>
                <option value="VALOR_PACIENTE_PERCENTUAL">Alterar valor paciente em %</option>
                <option value="VALOR_PACIENTE_REAIS">Alterar valor paciente em R$</option>
                <option value="REPASSE_PERCENTUAL">Alterar repasse em %</option>
                <option value="REPASSE_REAIS">Alterar repasse em R$</option>
              </select>
              <input type="number" step="0.01" value={valorLote} onChange={(e) => setValorLote(e.target.value)} placeholder="Valor da alteração" className="rounded-md border border-xango-border px-3 py-2 text-sm" />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setModalLote(false)} className="rounded-md border border-xango-border px-4 py-2 text-sm font-semibold">Cancelar</button>
              <button disabled={processando || !valorLote} onClick={async () => {
                try {
                  setProcessando(true);
                  const procedimentoIds = clinica.precos.filter((p) => selecionados.includes(p.id)).map((p) => p.procedimento.id);
                  const r = await fetch(`http://localhost:3333/clinicas/${clinica.id}/precos/lote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ procedimentoIds, operacao: operacaoLote, valor: numero(valorLote) }) });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.erro || "Não foi possível alterar os preços.");
                  window.location.reload();
                } catch (e) { window.alert(e instanceof Error ? e.message : "Erro na alteração em lote."); } finally { setProcessando(false); }
              }} className="rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{processando ? "Aplicando..." : "Aplicar alteração"}</button>
            </div>
          </div>
        </div>
      )}

      {modalImportar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-importacao"
            className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="titulo-importacao" className="font-semibold text-xango-text">Importar tabela</h3>
                <p className="mt-1 text-sm text-xango-muted">{clinica.nome}</p>
              </div>
              <button type="button" aria-label="Fechar importação" disabled={processando}
                onClick={fecharImportacao} className="rounded-md p-2 disabled:opacity-50"><X size={18} /></button>
            </div>

            {tipoImportacao === null && (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <button type="button" onClick={() => setTipoImportacao("EXCEL")}
                  className="rounded-lg border border-xango-border p-5 text-left transition hover:border-xango-primary hover:bg-xango-background">
                  <FileSpreadsheet size={24} className="mb-3 text-xango-primary" />
                  <span className="block font-semibold text-xango-text">Importar arquivo Excel</span>
                  <span className="mt-1 block text-sm text-xango-muted">Envie a tabela recebida da clínica e confira a prévia dos procedimentos e valores.</span>
                </button>
                <button type="button" onClick={() => void carregarClinicasImportacao()}
                  className="rounded-lg border border-xango-border p-5 text-left transition hover:border-xango-primary hover:bg-xango-background">
                  <Building2 size={24} className="mb-3 text-xango-primary" />
                  <span className="block font-semibold text-xango-text">Copiar de outra clínica</span>
                  <span className="mt-1 block text-sm text-xango-muted">Utilize procedimentos e preços já cadastrados em outra clínica.</span>
                </button>
              </div>
            )}

            {tipoImportacao !== null && (
              <button type="button" onClick={voltarImportacao} disabled={processando}
                className="mt-4 flex items-center gap-2 text-sm font-semibold text-xango-primary disabled:opacity-50">
                <ArrowLeft size={16} /> Voltar às opções
              </button>
            )}

            {tipoImportacao === "EXCEL" && (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-xango-border p-4">
                  <h4 className="font-semibold text-xango-text">Importar arquivo Excel</h4>
                  <p id="ajuda-arquivo-excel" className="mt-1 text-sm text-xango-muted">
                    Formatos .xlsx e .xls. Será analisada a primeira aba. Colunas reconhecidas: TUSS, PROCEDIMENTO, VALOR REPASSE e VALOR PACIENTE.
                  </p>
                  <label htmlFor="arquivo-excel" className="mt-4 block text-sm font-semibold text-xango-text">Selecionar planilha</label>
                  <input id="arquivo-excel" type="file" accept=".xlsx,.xls" disabled={processando} aria-describedby="ajuda-arquivo-excel"
                    onChange={(e) => {
                      const arquivo = e.target.files?.[0] ?? null;
                      if (!arquivo) return;
                      interromperAnaliseExcel();
                      setPreviewExcel(null);
                      setErroExcel("");
                      if (!/\.xlsx?$/i.test(arquivo.name) || arquivo.size === 0) {
                        setArquivoExcel(null);
                        setErroExcel(arquivo.size === 0 ? "O arquivo está vazio. Selecione outra planilha." : "Selecione um arquivo Excel nos formatos .xlsx ou .xls.");
                        e.target.value = "";
                        return;
                      }
                      setArquivoExcel(arquivo);
                    }}
                    className="mt-2 block w-full rounded-md border border-xango-border p-2 text-sm" />
                  {arquivoExcel && (
                    <p className="mt-3 break-all text-sm text-xango-text">
                      <span className="font-semibold">Arquivo selecionado:</span> {arquivoExcel.name}
                      <span className="ml-2 text-xs text-xango-muted">({(arquivoExcel.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB)</span>
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-xango-muted">A análise é uma prévia e não altera cadastros ou preços.</p>
                    <button type="button" disabled={!arquivoExcel || carregandoExcel || processando} onClick={() => void analisarPlanilha()}
                      className="flex items-center gap-2 rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      {carregandoExcel && <Loader2 size={16} className="animate-spin" />}
                      {carregandoExcel ? "Analisando..." : previewExcel ? "Analisar novamente" : "Analisar planilha"}
                    </button>
                  </div>
                </div>
                {erroExcel && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erroExcel}</p>}
                {carregandoExcel && <p role="status" className="text-sm text-xango-muted">Analisando os procedimentos e valores da planilha...</p>}
                {previewExcel && <PreviaImportacaoExcel key={previewExcel.previewId || "previa"} preview={previewExcel}
                  onProcessando={setProcessando}
                  onAtualizarClinica={async () => {
                    const resposta = await fetch(`http://localhost:3333/clinicas/${clinica.id}`, { cache: "no-store" });
                    const dados = await resposta.json();
                    if (!resposta.ok) throw new Error(dados.erro || "Não foi possível atualizar a tabela.");
                    setClinica(dados);
                    setPrecosEdicao({});
                    setSelecionados([]);
                  }} />}
              </div>
            )}

            {tipoImportacao === "CLINICA" && (
              <fieldset disabled={processando} className="mt-4 min-w-0 border-0 p-0">
                <legend className="font-semibold text-xango-text">Copiar de outra clínica</legend>
                {erroImportacao && (
                  <div role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <p>{erroImportacao}</p>
                    <button type="button" className="mt-2 font-semibold underline" onClick={() => void (clinicaOrigemId ? carregarPrecosOrigem(clinicaOrigemId) : carregarClinicasImportacao())}>Tentar novamente</button>
                  </div>
                )}
                <label htmlFor="clinica-origem" className="mt-3 block text-xs font-semibold text-xango-muted">Clínica de origem</label>
                <select id="clinica-origem" value={clinicaOrigemId}
                  disabled={carregandoClinicasImportacao || processando}
                  onChange={(e) => void carregarPrecosOrigem(e.target.value)}
                  className="mt-1 w-full rounded-md border border-xango-border px-3 py-2 text-sm disabled:opacity-50">
                  <option value="">Selecione a clínica de origem</option>
                  {clinicasImportacao.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                {(carregandoClinicasImportacao || carregandoPrecosOrigem) && (
                  <p role="status" className="mt-3 flex items-center gap-2 text-sm text-xango-muted"><Loader2 size={16} className="animate-spin" />Carregando {carregandoClinicasImportacao ? "clínicas" : "tabela de origem"}...</p>
                )}
                {!carregandoClinicasImportacao && !erroImportacao && clinicasImportacao.length === 0 && (
                  <p className="mt-3 text-sm text-xango-muted">Nenhuma outra clínica disponível para copiar a tabela.</p>
                )}
            {clinicaOrigemId && !carregandoPrecosOrigem && <>
              <input value={buscaImportacao} onChange={(e) => setBuscaImportacao(e.target.value)} placeholder="Buscar procedimento na tabela..." className="mt-3 w-full rounded-md border border-xango-border px-3 py-2 text-sm" />
              <p className="mt-2 text-xs text-xango-muted">{selecionadosImportacao.length} procedimento(s) selecionado(s).</p>
              <div className="mt-3 max-h-80 overflow-auto rounded-md border border-xango-border">
                {precosOrigem.filter((p) => p.ativo && p.procedimento.nome.toLowerCase().includes(buscaImportacao.toLowerCase())).length === 0 && (
                  <p className="p-4 text-sm text-xango-muted">Nenhum procedimento disponível para esta busca.</p>
                )}
                {precosOrigem
                  .filter((p) => p.ativo)
                  .filter((p) => p.procedimento.nome.toLowerCase().includes(buscaImportacao.toLowerCase()))
                  .map((p) => {
                    const atual = clinica.precos.find(
                      (destino) => destino.procedimento.id === p.procedimento.id && destino.ativo
                    );

                    return (
                      <label key={p.id} className="flex items-center gap-3 border-b border-xango-border px-3 py-2 text-sm last:border-0">
                        <input
                          type="checkbox"
                          checked={selecionadosImportacao.includes(p.procedimento.id)}
                          onChange={(e) =>
                            setSelecionadosImportacao((a) =>
                              e.target.checked
                                ? [...a, p.procedimento.id]
                                : a.filter((id) => id !== p.procedimento.id)
                            )
                          }
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-xango-text">
                              {p.procedimento.nome}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                atual
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {atual ? "Já existe" : "Novo"}
                            </span>
                          </div>

                          {atual && (
                            <p className="mt-1 text-xs text-xango-muted">
                              Atual: {moeda(atual.valorPaciente)} • Repasse{" "}
                              {moeda(atual.valorRepasse)}
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <p className="font-medium text-xango-text">
                            {moeda(p.valorPaciente)}
                          </p>
                          <p className="text-xs text-xango-muted">
                            Rep. {moeda(p.valorRepasse)}
                          </p>
                        </div>
                      </label>
                    );
                  })}
              </div>
              <div className="mt-4 rounded-md border border-xango-border bg-xango-background p-3">
                <p className="text-xs font-semibold text-xango-text">
                  Quando o procedimento já existir na clínica de destino:
                </p>
                <div className="mt-2 flex flex-wrap gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-xango-text">
                    <input
                      type="radio"
                      checked={!substituirExistentes}
                      onChange={() => setSubstituirExistentes(false)}
                    />
                    Manter os valores atuais
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-xango-text">
                    <input
                      type="radio"
                      checked={substituirExistentes}
                      onChange={() => setSubstituirExistentes(true)}
                    />
                    Substituir pelos valores da clínica de origem
                  </label>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-between gap-2">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      setSelecionadosImportacao(
                        precosOrigem.filter((p) => p.ativo).map((p) => p.procedimento.id)
                      )
                    }
                    className="text-sm font-semibold text-xango-primary"
                  >
                    Selecionar tabela completa
                  </button>

                  {selecionadosImportacao.length > 0 && (
                    <button
                      onClick={() => setSelecionadosImportacao([])}
                      className="text-sm font-semibold text-xango-muted"
                    >
                      Limpar seleção
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={fecharImportacao}
                    className="rounded-md border border-xango-border px-4 py-2 text-sm font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={processando || carregandoPrecosOrigem || !clinicaOrigemId || selecionadosImportacao.length === 0}
                    onClick={async () => {
                      try {
                        setProcessando(true);
                        const r = await fetch(
                          `http://localhost:3333/clinicas/${clinica.id}/precos/importar`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              clinicaOrigemId: Number(clinicaOrigemId),
                              procedimentoIds: selecionadosImportacao,
                              substituirExistentes,
                            }),
                          }
                        );
                        const d = await r.json();
                        if (!r.ok) throw new Error(d.erro || "Não foi possível importar.");

                        window.alert(
                          `Importação concluída. ${d.criados ?? 0} novo(s), ${
                            d.substituidos ?? 0
                          } substituído(s), ${d.mantidos ?? 0} mantido(s).`
                        );
                        window.location.reload();
                      } catch (e) {
                        setErroImportacao(e instanceof Error ? e.message : "Erro ao importar.");
                      } finally {
                        setProcessando(false);
                      }
                    }}
                    className="rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {processando ? "Importando..." : "Importar selecionados"}
                  </button>
                </div>
              </div>
            </>}
              </fieldset>
            )}
          </div>
        </div>
      )}

      {procedimentoEditando && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-xango-text">
                  Editar procedimento
                </h3>
                <p className="mt-1 text-xs text-xango-muted">
                  A alteração valerá para todas as clínicas que utilizam este procedimento.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProcedimentoEditando(null);
                  setAliasEdicao("");
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-xango-muted">
                  Nome oficial *
                </label>
                <input
                  value={procedimentoEditando.nome}
                  onChange={(e) =>
                    setProcedimentoEditando((atual) =>
                      atual
                        ? {
                            ...atual,
                            nome: e.target.value.toLocaleUpperCase("pt-BR"),
                          }
                        : atual
                    )
                  }
                  className="w-full rounded-md border border-xango-border px-3 py-2 text-sm uppercase"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-xango-muted">
                  Categoria
                </label>
                <input
                  value={procedimentoEditando.categoria}
                  onChange={(e) =>
                    setProcedimentoEditando((atual) =>
                      atual
                        ? {
                            ...atual,
                            categoria: e.target.value.toLocaleUpperCase("pt-BR"),
                          }
                        : atual
                    )
                  }
                  className="w-full rounded-md border border-xango-border px-3 py-2 text-sm uppercase"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-xango-muted">
                  Preparo
                </label>
                <input
                  value={procedimentoEditando.preparo}
                  onChange={(e) =>
                    setProcedimentoEditando((atual) =>
                      atual ? { ...atual, preparo: e.target.value } : atual
                    )
                  }
                  className="w-full rounded-md border border-xango-border px-3 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-xango-muted">
                  Nomes alternativos / Sinônimos
                </label>

                <div className="flex gap-2">
                  <input
                    value={aliasEdicao}
                    onChange={(e) =>
                      setAliasEdicao(e.target.value.toLocaleUpperCase("pt-BR"))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const alias = aliasEdicao.trim().toLocaleUpperCase("pt-BR");

                        if (
                          alias &&
                          !procedimentoEditando.aliases.includes(alias) &&
                          alias !== procedimentoEditando.nome
                        ) {
                          setProcedimentoEditando((atual) =>
                            atual
                              ? { ...atual, aliases: [...atual.aliases, alias] }
                              : atual
                          );
                        }

                        setAliasEdicao("");
                      }
                    }}
                    placeholder="Adicionar sinônimo"
                    className="flex-1 rounded-md border border-xango-border px-3 py-2 text-sm uppercase"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const alias = aliasEdicao.trim().toLocaleUpperCase("pt-BR");

                      if (
                        alias &&
                        !procedimentoEditando.aliases.includes(alias) &&
                        alias !== procedimentoEditando.nome
                      ) {
                        setProcedimentoEditando((atual) =>
                          atual
                            ? { ...atual, aliases: [...atual.aliases, alias] }
                            : atual
                        );
                      }

                      setAliasEdicao("");
                    }}
                    className="rounded-md border border-xango-border px-3 py-2 text-sm font-semibold text-xango-primary"
                  >
                    Adicionar
                  </button>
                </div>

                {procedimentoEditando.aliases.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {procedimentoEditando.aliases.map((alias) => (
                      <span
                        key={alias}
                        className="flex items-center gap-1 rounded-full bg-xango-background px-2.5 py-1 text-xs font-medium text-xango-text"
                      >
                        {alias}
                        <button
                          type="button"
                          onClick={() =>
                            setProcedimentoEditando((atual) =>
                              atual
                                ? {
                                    ...atual,
                                    aliases: atual.aliases.filter(
                                      (item) => item !== alias
                                    ),
                                  }
                                : atual
                            )
                          }
                          className="text-xango-muted"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setProcedimentoEditando(null);
                  setAliasEdicao("");
                }}
                className="rounded-md border border-xango-border px-4 py-2 text-sm font-semibold"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={processando || !procedimentoEditando.nome.trim()}
                onClick={async () => {
                  try {
                    setProcessando(true);

                    const salvar = async (confirmarMesmoAssim: boolean) =>
                      fetch(
                        `http://localhost:3333/procedimentos/${procedimentoEditando.id}`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            nome: procedimentoEditando.nome,
                            categoria: procedimentoEditando.categoria || null,
                            preparo: procedimentoEditando.preparo || null,
                            aliases: procedimentoEditando.aliases,
                            confirmarMesmoAssim,
                          }),
                        }
                      );

                    let r = await salvar(false);
                    let d = await r.json();

                    if (
                      r.status === 409 &&
                      d.tipo === "POSSIVEL_DUPLICIDADE"
                    ) {
                      const nomes = Array.isArray(d.candidatos)
                        ? d.candidatos.map((c: { nome: string }) => c.nome).join("\\n• ")
                        : "";

                      const confirmar = window.confirm(
                        `Encontramos procedimento(s) possivelmente equivalente(s):\\n\\n• ${nomes}\\n\\nVocê conferiu e deseja salvar mesmo assim?`
                      );

                      if (!confirmar) {
                        return;
                      }

                      r = await salvar(true);
                      d = await r.json();
                    }

                    if (!r.ok) {
                      throw new Error(
                        d.erro || "Não foi possível editar o procedimento."
                      );
                    }

                    setProcedimentosCatalogo((atual) =>
                      atual.map((p) =>
                        p.id === d.id
                          ? {
                              ...p,
                              nome: d.nome,
                              categoria: d.categoria,
                              preparo: d.preparo,
                              aliases: d.aliases,
                            }
                          : p
                      )
                    );

                    setProcedimentoEditando(null);
                    setAliasEdicao("");
                    window.location.reload();
                  } catch (e) {
                    window.alert(
                      e instanceof Error
                        ? e.message
                        : "Não foi possível editar o procedimento."
                    );
                  } finally {
                    setProcessando(false);
                  }
                }}
                className="rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {processando ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAdicionar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-xango-text">Adicionar procedimentos</h3>
              <button onClick={() => setModalAdicionar(false)}><X size={18} /></button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                value={buscaAdicionar}
                onChange={(e) => setBuscaAdicionar(e.target.value)}
                placeholder="Buscar no catálogo geral..."
                className="min-w-64 flex-1 rounded-md border border-xango-border px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setCriandoProcedimento((v) => !v)}
                className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-sm font-semibold text-xango-primary"
              >
                <Plus size={15} />
                Novo procedimento
              </button>
            </div>

            {criandoProcedimento && (
              <div className="mt-3 rounded-lg border border-xango-border bg-xango-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-xango-text">
                      Cadastrar novo procedimento
                    </p>
                    <p className="mt-0.5 text-xs text-xango-muted">
                      O procedimento será criado no catálogo geral e já adicionado a esta clínica.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCriandoProcedimento(false)}
                    className="text-xango-muted"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-xango-muted">
                      Nome do procedimento *
                    </label>
                    <input
                      value={novoProcedimentoNome}
                      onChange={(e) => setNovoProcedimentoNome(e.target.value.toLocaleUpperCase("pt-BR"))}
                      placeholder="Ex.: Ultrassom de abdome total"
                      className="w-full rounded-md border border-xango-border bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-xango-muted">
                      Categoria
                    </label>
                    <input
                      value={novoProcedimentoCategoria}
                      onChange={(e) => setNovoProcedimentoCategoria(e.target.value.toLocaleUpperCase("pt-BR"))}
                      placeholder="Ex.: Ultrassonografia"
                      className="w-full rounded-md border border-xango-border bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-xango-muted">
                      Preparo
                    </label>
                    <input
                      value={novoProcedimentoPreparo}
                      onChange={(e) => setNovoProcedimentoPreparo(e.target.value)}
                      placeholder="Opcional"
                      className="w-full rounded-md border border-xango-border bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-xango-muted">
                      Nomes alternativos / Sinônimos
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={novoAlias}
                        onChange={(e) => setNovoAlias(e.target.value.toLocaleUpperCase("pt-BR"))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const alias = novoAlias.trim().toLocaleUpperCase("pt-BR");
                            if (alias && !novosAliases.includes(alias)) {
                              setNovosAliases((atual) => [...atual, alias]);
                            }
                            setNovoAlias("");
                          }
                        }}
                        placeholder="Ex.: USG RINS E VIAS"
                        className="flex-1 rounded-md border border-xango-border bg-white px-3 py-2 text-sm uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const alias = novoAlias.trim().toLocaleUpperCase("pt-BR");
                          if (alias && !novosAliases.includes(alias)) {
                            setNovosAliases((atual) => [...atual, alias]);
                          }
                          setNovoAlias("");
                        }}
                        className="rounded-md border border-xango-border bg-white px-3 py-2 text-sm font-semibold text-xango-primary"
                      >
                        Adicionar
                      </button>
                    </div>

                    {novosAliases.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {novosAliases.map((alias) => (
                          <span
                            key={alias}
                            className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-xango-text"
                          >
                            {alias}
                            <button
                              type="button"
                              onClick={() =>
                                setNovosAliases((atual) =>
                                  atual.filter((item) => item !== alias)
                                )
                              }
                              className="text-xango-muted"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="mt-1 text-[11px] text-xango-muted">
                      Esses nomes também poderão ser usados na pesquisa de exames.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-xango-muted">
                      Valor paciente
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={novoProcedimentoValorPaciente}
                      onChange={(e) => setNovoProcedimentoValorPaciente(e.target.value)}
                      placeholder="0,00"
                      className="w-full rounded-md border border-xango-border bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-xango-muted">
                      Repasse
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={novoProcedimentoValorRepasse}
                      onChange={(e) => setNovoProcedimentoValorRepasse(e.target.value)}
                      placeholder="0,00"
                      className="w-full rounded-md border border-xango-border bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {possiveisDuplicados.length > 0 && (
                  <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-900">
                      Possível procedimento já cadastrado
                    </p>
                    <p className="mt-1 text-xs text-amber-800">
                      Confira a sugestão. O sistema só deve impedir definitivamente
                      quando encontrar uma equivalência praticamente exata.
                    </p>

                    <div className="mt-2 space-y-2">
                      {possiveisDuplicados.map((candidato) => (
                        <div key={candidato.id} className="rounded-md bg-white p-2">
                          <p className="text-sm font-semibold text-xango-text">
                            {candidato.nome}
                          </p>
                          {candidato.aliases && candidato.aliases.length > 0 && (
                            <p className="mt-1 text-xs text-xango-muted">
                              Também conhecido como: {candidato.aliases.join(" • ")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {podeConfirmarMesmoAssim && (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-white p-3">
                        <p className="text-xs text-xango-text">
                          Se você conferiu e realmente são procedimentos diferentes,
                          pode continuar o cadastro.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setPossiveisDuplicados([]);
                          }}
                          className="shrink-0 rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900"
                        >
                          São diferentes
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={processando || !novoProcedimentoNome.trim()}
                    onClick={async () => {
                      try {
                        setProcessando(true);

                        const criar = await fetch("http://localhost:3333/procedimentos", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            nome: novoProcedimentoNome.trim(),
                            categoria: novoProcedimentoCategoria.trim() || null,
                            preparo: novoProcedimentoPreparo.trim() || null,
                            aliases: novosAliases,
                            confirmarMesmoAssim: podeConfirmarMesmoAssim,
                          }),
                        });

                        const procedimentoCriado = await criar.json();

                        if (!criar.ok) {
                          if (
                            criar.status === 409 &&
                            procedimentoCriado.tipo === "POSSIVEL_DUPLICIDADE"
                          ) {
                            setPossiveisDuplicados(
                              Array.isArray(procedimentoCriado.candidatos)
                                ? procedimentoCriado.candidatos
                                : []
                            );
                            setPodeConfirmarMesmoAssim(true);
                            throw new Error(
                              "Encontramos um procedimento possivelmente equivalente. Confira a sugestão abaixo antes de criar."
                            );
                          }

                          if (
                            criar.status === 409 &&
                            procedimentoCriado.tipo === "DUPLICIDADE"
                          ) {
                            setPossiveisDuplicados(
                              procedimentoCriado.candidato
                                ? [procedimentoCriado.candidato]
                                : []
                            );
                            setPodeConfirmarMesmoAssim(false);
                          }

                          throw new Error(
                            procedimentoCriado.erro ||
                              "Não foi possível criar o procedimento."
                          );
                        }

                        const vincular = await fetch(
                          `http://localhost:3333/clinicas/${clinica.id}/precos/${procedimentoCriado.id}`,
                          {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              valorPaciente: numero(novoProcedimentoValorPaciente),
                              valorRepasse: numero(novoProcedimentoValorRepasse),
                            }),
                          }
                        );

                        const precoCriado = await vincular.json();

                        if (!vincular.ok) {
                          throw new Error(
                            precoCriado.erro ||
                              "O procedimento foi criado, mas não foi possível adicioná-lo à clínica."
                          );
                        }

                        setNovoProcedimentoNome("");
                        setNovoProcedimentoCategoria("");
                        setNovoProcedimentoPreparo("");
                        setNovoProcedimentoValorPaciente("");
                        setNovoProcedimentoValorRepasse("");
                        setNovoAlias("");
                        setNovosAliases([]);
                        setPossiveisDuplicados([]);
                        setPodeConfirmarMesmoAssim(false);
                        setCriandoProcedimento(false);

                        window.location.reload();
                      } catch (e) {
                        window.alert(
                          e instanceof Error
                            ? e.message
                            : "Não foi possível criar o procedimento."
                        );
                      } finally {
                        setProcessando(false);
                      }
                    }}
                    className="rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {processando ? "Criando..." : "Criar e adicionar à clínica"}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-xango-muted">
                {selecionadosAdicionar.length} procedimento(s) selecionado(s)
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setSelecionadosAdicionar(
                      procedimentosCatalogo
                        .filter(
                          (p) =>
                            !clinica.precos.some(
                              (preco) =>
                                preco.procedimento.id === p.id && preco.ativo
                            )
                        )
                        .filter((p) =>
                          p.nome.toLowerCase().includes(buscaAdicionar.toLowerCase())
                        )
                        .map((p) => p.id)
                    )
                  }
                  className="text-xs font-semibold text-xango-primary"
                >
                  Selecionar exibidos
                </button>
                {selecionadosAdicionar.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelecionadosAdicionar([])}
                    className="text-xs font-semibold text-xango-muted"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            <div className="mt-2 max-h-80 overflow-auto rounded-md border border-xango-border">
              {procedimentosCatalogo.filter((p) => (
                !buscaAdicionar.trim() ||
                p.nome.toLowerCase().includes(buscaAdicionar.toLowerCase()) ||
                (p.aliases || []).some((alias) =>
                  alias.toLowerCase().includes(buscaAdicionar.toLowerCase())
                )
              )).map((p) => { 
                const jaAdicionado = clinica.precos.some(
                  (preco) => preco.procedimento.id === p.id && preco.ativo
                );

                return (
                <div key={p.id} className="flex items-center gap-3 border-b border-xango-border px-3 py-2 text-sm last:border-0">
                  <input
                    type="checkbox"
                    disabled={jaAdicionado}
                    checked={!jaAdicionado && selecionadosAdicionar.includes(p.id)}
                    onChange={(e) =>
                      setSelecionadosAdicionar((a) =>
                        e.target.checked ? [...a, p.id] : a.filter((id) => id !== p.id)
                      )
                    }
                    title={jaAdicionado ? "Este procedimento já está nesta clínica" : "Selecionar para adicionar"}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-xango-text">{p.nome}</p>
                      {jaAdicionado && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Já adicionado
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-2">
                      {p.categoria && (
                        <span className="text-xs text-xango-muted">{p.categoria}</span>
                      )}
                      {p.aliases && p.aliases.length > 0 && (
                        <span className="text-xs text-xango-muted">
                          {p.aliases.length} sinônimo(s)
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    title="Editar procedimento"
                    onClick={() =>
                      setProcedimentoEditando({
                        id: p.id,
                        nome: p.nome,
                        categoria: p.categoria || "",
                        preparo: p.preparo || "",
                        aliases: p.aliases || [],
                      })
                    }
                    className="rounded-md border border-xango-border p-1.5 text-xango-primary hover:bg-xango-background"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    type="button"
                    title="Excluir procedimento"
                    onClick={async () => {
                      if (
                        !window.confirm(
                          `Excluir "${p.nome}" do catálogo?\n\nO histórico existente será preservado.`
                        )
                      ) {
                        return;
                      }

                      try {
                        setProcessando(true);
                        const r = await fetch(
                          `http://localhost:3333/procedimentos/${p.id}`,
                          { method: "DELETE" }
                        );
                        const d = await r.json();

                        if (!r.ok) {
                          throw new Error(
                            d.erro || "Não foi possível excluir o procedimento."
                          );
                        }

                        setProcedimentosCatalogo((atual) =>
                          atual.filter((item) => item.id !== p.id)
                        );
                        setSelecionadosAdicionar((atual) =>
                          atual.filter((id) => id !== p.id)
                        );

                        // Se o procedimento também estiver nesta clínica,
                        // recarrega para removê-lo da tabela ativa de preços.
                        if (
                          clinica.precos.some(
                            (preco) => preco.procedimento.id === p.id && preco.ativo
                          )
                        ) {
                          window.location.reload();
                        }
                      } catch (e) {
                        window.alert(
                          e instanceof Error
                            ? e.message
                            : "Não foi possível excluir o procedimento."
                        );
                      } finally {
                        setProcessando(false);
                      }
                    }}
                    className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-xango-muted">Os procedimentos serão adicionados com valores iniciais zerados para você preencher na tabela.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setModalAdicionar(false)} className="rounded-md border border-xango-border px-4 py-2 text-sm font-semibold">Cancelar</button>
              <button disabled={processando || selecionadosAdicionar.length === 0} onClick={async () => {
                try {
                  setProcessando(true);
                  for (const procedimentoId of selecionadosAdicionar) {
                    const r = await fetch(`http://localhost:3333/clinicas/${clinica.id}/precos/${procedimentoId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valorPaciente: 0, valorRepasse: 0 }) });
                    const d = await r.json(); if (!r.ok) throw new Error(d.erro || "Não foi possível adicionar procedimento.");
                  }
                  window.location.reload();
                } catch (e) { window.alert(e instanceof Error ? e.message : "Erro ao adicionar procedimentos."); } finally { setProcessando(false); }
              }} className="rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{processando ? "Adicionando..." : `Adicionar selecionados (${selecionadosAdicionar.length})`}</button>
            </div>
          </div>
        </div>
      )}

      {clinica.observacoes && (
        <Bloco titulo="Observações" icone={<Building2 size={18} />}>
          <p className="whitespace-pre-wrap text-sm text-xango-text">
            {clinica.observacoes}
          </p>
        </Bloco>
      )}
    </div>
  );
}

function Resumo({
  icone,
  valor,
  titulo,
}: {
  icone: React.ReactNode;
  valor: string;
  titulo: string;
}) {
  return (
    <div className="rounded-lg border border-xango-border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xango-primary">{icone}</div>
        <p className="text-xl font-bold text-xango-text">{valor}</p>
      </div>
      <p className="mt-3 text-xs font-medium text-xango-muted">{titulo}</p>
    </div>
  );
}

function Bloco({
  titulo,
  icone,
  children,
}: {
  titulo: string;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-xango-border bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-xango-border px-5 py-4">
        <div className="text-xango-primary">{icone}</div>
        <h3 className="font-semibold text-xango-text">{titulo}</h3>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Info({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-xango-muted">{titulo}</p>
      <p className="mt-1 text-sm font-medium text-xango-text">{valor}</p>
    </div>
  );
}

function Responsavel({
  titulo,
  nome,
  cargo,
  telefone,
  email,
}: {
  titulo: string;
  nome: string | null;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
}) {
  return (
    <div className="rounded-lg border border-xango-border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
        {titulo}
      </p>

      <p className="mt-2 font-semibold text-xango-text">
        {nome || "Não informado"}
      </p>

      {cargo && <p className="mt-1 text-xs text-xango-muted">{cargo}</p>}

      {telefone && (
        <p className="mt-3 flex items-center gap-2 text-sm text-xango-text">
          <Phone size={14} />
          {formatarTelefone(telefone)}
        </p>
      )}

      {email && (
        <p className="mt-1 flex items-center gap-2 text-sm text-xango-text">
          <Mail size={14} />
          {email}
        </p>
      )}
    </div>
  );
}

const STATUS_EXCEL: Record<PreviewExcelRegistro["status"], { titulo: string; classe: string }> = {
  PRONTO: { titulo: "Pronto", classe: "bg-emerald-100 text-emerald-800" },
  CONFERIR: { titulo: "Conferir", classe: "bg-amber-100 text-amber-800" },
  NAO_ENCONTRADO: { titulo: "Não encontrado", classe: "bg-slate-100 text-slate-700" },
  ERRO: { titulo: "Erro", classe: "bg-red-100 text-red-800" },
};

function moedaPrevia(valor: number | null | undefined) {
  return valor == null || !Number.isFinite(Number(valor)) ? "Não informado" : moeda(valor);
}

type ModoImportacaoExcel = "FIXO" | "CH";
type ResultadoConfirmacaoExcel = {
  selecionados: number; criados: number; substituidos: number; mantidos: number;
  reativados: number; procedimentosCriados: number; porCh: number; fixos: number;
};

function valoresModoExcel(registro: PreviewExcelRegistro, preview: PreviewExcel, modo: ModoImportacaoExcel) {
  if (modo === "FIXO") return { valorPaciente: registro.informado.valorPaciente, valorRepasse: registro.informado.valorRepasse };
  const ch = registro.procedimento?.ch;
  const paciente = preview.clinica.valorChPaciente;
  const repasse = preview.clinica.valorChRepasse;
  if (preview.clinica.tipoPrecificacao !== "CH" || ch == null || paciente == null || repasse == null || ch < 0 || paciente < 0 || repasse < 0) {
    return { valorPaciente: null, valorRepasse: null };
  }
  return { valorPaciente: arredondar(ch * paciente), valorRepasse: arredondar(ch * repasse) };
}

function valoresExcelValidos(valores: { valorPaciente: number | null; valorRepasse: number | null }) {
  return valores.valorPaciente !== null && valores.valorRepasse !== null &&
    Number.isFinite(valores.valorPaciente) && Number.isFinite(valores.valorRepasse) &&
    valores.valorPaciente >= 0 && valores.valorRepasse >= 0 &&
    valores.valorPaciente <= 99999999.99 && valores.valorRepasse <= 99999999.99 &&
    valores.valorRepasse <= valores.valorPaciente;
}

function PreviaImportacaoExcel({ preview: previewOriginal, onProcessando, onAtualizarClinica }: {
  preview: PreviewExcel;
  onProcessando: (valor: boolean) => void;
  onAtualizarClinica: () => Promise<void>;
}) {
  const [vinculosManuais, setVinculosManuais] = useState<Record<number, { vinculoId: string; registro: PreviewExcelRegistro }>>({});
  const [linhaBusca, setLinhaBusca] = useState<number | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const registrosEfetivos = previewOriginal.registros.map((registro) => vinculosManuais[registro.linha]?.registro ?? registro);
  const preview: PreviewExcel = { ...previewOriginal, registros: registrosEfetivos, resumo: {
    total: registrosEfetivos.length,
    prontos: registrosEfetivos.filter((r) => r.status === "PRONTO").length,
    conferir: registrosEfetivos.filter((r) => r.status === "CONFERIR").length,
    naoEncontrados: registrosEfetivos.filter((r) => r.status === "NAO_ENCONTRADO").length,
    erros: registrosEfetivos.filter((r) => r.status === "ERRO").length,
    jaCadastrados: registrosEfetivos.filter((r) => r.jaCadastradoNaClinica).length,
    calculadosPorCh: registrosEfetivos.filter((r) => r.valores.origem === "CH").length,
  } };
  const [filtro, setFiltro] = useState<"TODOS" | PreviewExcelRegistro["status"]>("TODOS");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [revisadas, setRevisadas] = useState<number[]>([]);
  const [modos, setModos] = useState<Record<number, ModoImportacaoExcel>>({});
  const [novosProcedimentos, setNovosProcedimentos] = useState<Record<number, { nome: string; confirmado: boolean }>>({});
  const [substituir, setSubstituir] = useState(false);
  const [confirmandoImportacao, setConfirmando] = useState(false);
  const confirmando = confirmandoImportacao || vinculando;
  const [erroConfirmacao, setErroConfirmacao] = useState("");
  const [resultado, setResultado] = useState<ResultadoConfirmacaoExcel | null>(null);
  const [avisoAtualizacao, setAvisoAtualizacao] = useState("");
  const confirmacaoEmAndamento = useRef(false);
  const modoDoRegistro = (registro: PreviewExcelRegistro): ModoImportacaoExcel => modos[registro.linha] ?? (registro.valores.origem === "CH" ? "CH" : "FIXO");
  const podeSelecionar = (registro: PreviewExcelRegistro) => {
    const novo = novosProcedimentos[registro.linha];
    const nomeNovo = novo?.nome.trim().replace(/\s+/g, " ") || "";
    const novoRevisado = registro.status === "NAO_ENCONTRADO" && !registro.procedimento && !registro.informado.tuss &&
      novo?.confirmado === true && nomeNovo.length >= 2 && nomeNovo.length <= 200 && /[\p{L}\p{N}]/u.test(nomeNovo) && modoDoRegistro(registro) === "FIXO";
    const identificado = registro.procedimento && (registro.status === "PRONTO" || (registro.status === "CONFERIR" && revisadas.includes(registro.linha)));
    return Boolean(preview.previewId && (identificado || novoRevisado) && registro.erros.length === 0 &&
      valoresExcelValidos(valoresModoExcel(registro, preview, modoDoRegistro(registro))));
  };

  async function confirmarImportacao() {
    if (!preview.previewId || confirmacaoEmAndamento.current || vinculando || linhaBusca !== null || resultado || selecionadas.length === 0) return;
    const registrosSelecionados = preview.registros.filter((registro) => selecionadas.includes(registro.linha));
    if (registrosSelecionados.some((registro) => !podeSelecionar(registro))) {
      setErroConfirmacao("Confira as sugestões e os valores dos registros selecionados.");
      return;
    }
    confirmacaoEmAndamento.current = true;
    setConfirmando(true);
    onProcessando(true);
    setErroConfirmacao("");
    try {
      const resposta = await fetch(`http://localhost:3333/clinicas/${preview.clinica.id}/precos/importar-excel/confirmar`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewId: preview.previewId, substituirExistentes: substituir,
          registros: registrosSelecionados.map((registro) => ({
            linha: registro.linha, modoPreco: modoDoRegistro(registro), confirmarSugestao: revisadas.includes(registro.linha),
            ...(vinculosManuais[registro.linha] ? { vinculoManualId: vinculosManuais[registro.linha].vinculoId } : {}),
            ...(registro.status === "NAO_ENCONTRADO" && novosProcedimentos[registro.linha]
              ? { novoProcedimento: { nome: novosProcedimentos[registro.linha].nome.trim(), confirmado: novosProcedimentos[registro.linha].confirmado } }
              : {}),
          })) }),
      });
      let dados;
      try { dados = await resposta.json(); }
      catch { throw new Error("Não foi possível ler o resultado. Tente confirmar novamente com a mesma seleção para consultar a importação."); }
      if (!resposta.ok) throw new Error(dados?.erro || "Não foi possível confirmar a importação.");
      if (!dados || typeof dados.criados !== "number" || typeof dados.mantidos !== "number") throw new Error("Resposta inesperada. Tente confirmar novamente com a mesma seleção para consultar o resultado.");
      setResultado(dados);
      try { await onAtualizarClinica(); }
      catch { setAvisoAtualizacao("A importação foi concluída, mas a tabela da página não foi atualizada. Recarregue a página para visualizar os preços."); }
    } catch (erro) {
      setErroConfirmacao(erro instanceof Error ? erro.message : "Falha de conexão. Tente confirmar novamente com a mesma seleção.");
    } finally {
      confirmacaoEmAndamento.current = false;
      setConfirmando(false);
      onProcessando(false);
    }
  }
  const porPagina = 50;
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const registros = preview.registros.filter((registro) => {
    const texto = [registro.informado.procedimento, registro.informado.tuss,
      registro.procedimento?.nome, registro.procedimento?.tuss,
      registro.procedimento?.nomeTuss, ...(registro.procedimento?.aliases ?? [])]
      .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
    return (filtro === "TODOS" || registro.status === filtro) && (!termo || texto.includes(termo));
  });
  const totalPaginas = Math.max(1, Math.ceil(registros.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * porPagina;
  const resumo = preview.resumo;

  return (
    <section aria-label="Prévia da planilha" className="space-y-4">
      <div>
        <h4 className="font-semibold text-xango-text">Prévia da planilha</h4>
        <p className="mt-1 break-all text-xs text-xango-muted">Arquivo: {preview.arquivo} • Aba: {preview.aba}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-live="polite">
        {[
          { titulo: "Total", valor: resumo.total, classe: "bg-xango-background text-xango-text" },
          { titulo: "Prontos", valor: resumo.prontos, classe: STATUS_EXCEL.PRONTO.classe },
          { titulo: "Conferir", valor: resumo.conferir, classe: STATUS_EXCEL.CONFERIR.classe },
          { titulo: "Não encontrados", valor: resumo.naoEncontrados, classe: STATUS_EXCEL.NAO_ENCONTRADO.classe },
          { titulo: "Erros", valor: resumo.erros, classe: STATUS_EXCEL.ERRO.classe },
        ].map((item) => (
          <div key={item.titulo} className={`rounded-lg p-3 ${item.classe}`}>
            <p className="text-xl font-bold">{item.valor ?? 0}</p>
            <p className="mt-1 text-xs font-semibold">{item.titulo}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-xango-muted">
        Já cadastrados na clínica: {resumo.jaCadastrados ?? 0} • Calculados por CH: {resumo.calculadosPorCh ?? 0}
      </p>
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Registros em “Conferir” precisam da confirmação “Revisei esta sugestão” em cada linha. Você pode buscar e escolher um procedimento do catálogo ou da Base Mestre na própria linha. Para os não encontrados, também pode revisar o cadastro como novo procedimento. Registros com erro devem ser corrigidos na planilha e analisados novamente.
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="busca-previa-excel" className="mb-1 block text-xs font-semibold text-xango-muted">Buscar nome ou TUSS</label>
          <input id="busca-previa-excel" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
            placeholder="Buscar na prévia..." className="w-full rounded-md border border-xango-border px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="status-previa-excel" className="mb-1 block text-xs font-semibold text-xango-muted">Situação</label>
          <select id="status-previa-excel" value={filtro}
            onChange={(e) => { setFiltro(e.target.value as typeof filtro); setPagina(1); }}
            className="rounded-md border border-xango-border bg-white px-3 py-2 text-sm">
            <option value="TODOS">Todas as situações</option>
            {Object.entries(STATUS_EXCEL).map(([valor, status]) => <option key={valor} value={valor}>{status.titulo}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-xango-text">{selecionadas.length} registro(s) selecionado(s) • {selecionadas.filter((linha) => novosProcedimentos[linha]?.confirmado).length} novo(s) sem TUSS</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={confirmando || Boolean(resultado)} onClick={() => setSelecionadas(preview.registros.filter((r) => r.status === "PRONTO" && podeSelecionar(r)).map((r) => r.linha))} className="text-sm font-semibold text-xango-primary disabled:opacity-50">Selecionar prontos</button>
          <button type="button" disabled={confirmando || Boolean(resultado)} onClick={() => setSelecionadas([])} className="text-sm font-semibold text-xango-muted disabled:opacity-50">Limpar seleção</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-xango-border">
        <table className="w-full min-w-240 border-collapse text-left text-sm">
          <thead className="bg-xango-background text-xs text-xango-muted">
            <tr>
              <th scope="col" className="px-3 py-3">Linha / situação</th>
              <th scope="col" className="px-3 py-3">Informado na planilha</th>
              <th scope="col" className="px-3 py-3">Correspondência / sugestão</th>
              <th scope="col" className="px-3 py-3">TUSS / CH</th>
              <th scope="col" className="px-3 py-3">Modo e valores a importar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-xango-border">
            {registros.slice(inicio, inicio + porPagina).map((registro, indice) => {
              const procedimento = registro.procedimento;
              const status = STATUS_EXCEL[registro.status];
              const novoProcedimento = novosProcedimentos[registro.linha];
              const nomeNovo = novoProcedimento?.nome.trim().replace(/\s+/g, " ") || "";
              const nomeNovoValido = nomeNovo.length >= 2 && nomeNovo.length <= 200 && /[\p{L}\p{N}]/u.test(nomeNovo);
              const modo = modoDoRegistro(registro);
              const valoresSelecionados = valoresModoExcel(registro, preview, modo);
              const permiteFixo = valoresExcelValidos(valoresModoExcel(registro, preview, "FIXO"));
              const permiteCh = valoresExcelValidos(valoresModoExcel(registro, preview, "CH"));
              const precoAtual = registro.precoAtual && typeof registro.precoAtual === "object"
                ? registro.precoAtual as { valorPaciente?: number | null; valorRepasse?: number | null }
                : null;
              return (
                <tr key={`${registro.linha}-${inicio + indice}`} className="align-top">
                  <td className="px-3 py-3">
                    <label className="mb-2 flex items-center gap-2 text-xs text-xango-muted">
                      <input type="checkbox" aria-label={`Importar linha ${registro.linha}`} checked={selecionadas.includes(registro.linha)}
                        disabled={confirmando || Boolean(resultado) || !podeSelecionar(registro)}
                        onChange={(e) => setSelecionadas((atual) => e.target.checked ? [...atual, registro.linha] : atual.filter((linha) => linha !== registro.linha))} />
                      Linha {registro.linha}
                    </label>
                    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${status.classe}`}>{status.titulo}</span>
                    {novoProcedimento?.confirmado && <p className="mt-2 text-xs font-semibold text-blue-800">Novo cadastro revisado — selecione a linha para importar</p>}
                  </td>
                  <td className="max-w-64 px-3 py-3">
                    <p className="wrap-break-words font-medium text-xango-text">{registro.informado.procedimento || "Nome não informado"}</p>
                    <p className="mt-1 text-xs text-xango-muted">TUSS: {registro.informado.tuss || "Não informado"}</p>
                    <p className="mt-2 text-xs text-xango-muted">Paciente: {moedaPrevia(registro.informado.valorPaciente)}</p>
                    <p className="mt-1 text-xs text-xango-muted">Repasse: {moedaPrevia(registro.informado.valorRepasse)}</p>
                  </td>
                  <td className="max-w-80 px-3 py-3">
                    {procedimento ? (
                      <>
                        {registro.status === "CONFERIR" && (
                          <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-800">
                            <input type="checkbox" aria-label={`Revisar sugestão da linha ${registro.linha}`} checked={revisadas.includes(registro.linha)} disabled={confirmando || Boolean(resultado)}
                              onChange={(e) => {
                                setRevisadas((atual) => e.target.checked ? [...atual, registro.linha] : atual.filter((linha) => linha !== registro.linha));
                                if (!e.target.checked) setSelecionadas((atual) => atual.filter((linha) => linha !== registro.linha));
                              }} /> Revisei esta sugestão
                          </label>
                        )}
                        <p className="wrap-break-words font-medium text-xango-text">{procedimento.nome}</p>
                        <span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-semibold ${procedimento.origem === "CATALOGO" ? "bg-blue-100 text-blue-800" : "bg-violet-100 text-violet-800"}`}>
                          {procedimento.origem === "CATALOGO" ? "CATALOGO · Catálogo Digna" : "BASE_MESTRE · Base Mestre TUSS"}
                        </span>
                        <p className="mt-2 text-xs text-xango-muted">Correspondência: {registro.correspondencia.tipo === "MANUAL" ? "Escolha manual" : registro.correspondencia.tipo || "Não informada"}</p>
                        {registro.jaCadastradoNaClinica && (
                          <div className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                            <p className="font-semibold">Já cadastrado nesta clínica</p>
                            {precoAtual && <p className="mt-1">Atual: paciente {moedaPrevia(precoAtual.valorPaciente)} • Repasse {moedaPrevia(precoAtual.valorRepasse)}</p>}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xango-muted">Nenhuma correspondência encontrada.</p>
                        {registro.status === "NAO_ENCONTRADO" && (
                          registro.informado.tuss ? (
                            <p className="text-xs text-amber-800">O TUSS informado não foi localizado. Corrija o código ou retire-o da planilha para cadastrar sem TUSS.</p>
                          ) : novoProcedimento ? (
                            <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50 p-3">
                              <label className="block text-xs font-semibold text-xango-text">
                                Nome do novo procedimento
                                <input aria-label={`Nome do novo procedimento da linha ${registro.linha}`} value={novoProcedimento.nome} maxLength={200}
                                  disabled={confirmando || Boolean(resultado)}
                                  onChange={(e) => {
                                    const nome = e.target.value.toLocaleUpperCase("pt-BR");
                                    setNovosProcedimentos((atual) => ({ ...atual, [registro.linha]: { nome, confirmado: false } }));
                                    setSelecionadas((atual) => atual.filter((linha) => linha !== registro.linha));
                                    setErroConfirmacao("");
                                  }} className="mt-1 w-full rounded-md border border-xango-border bg-white px-2 py-2 text-sm uppercase disabled:opacity-50" />
                              </label>
                              <p className="text-xs text-xango-muted">Será criado no catálogo Digna sem TUSS e sem CH, usando os preços fixos da planilha. O cadastro só será salvo ao confirmar a importação.</p>
                              <label className="flex items-start gap-2 text-xs font-semibold text-xango-text">
                                <input type="checkbox" aria-label={`Confirmar novo procedimento da linha ${registro.linha}`} checked={novoProcedimento.confirmado}
                                  disabled={confirmando || Boolean(resultado) || !nomeNovoValido || !permiteFixo}
                                  onChange={(e) => {
                                    setNovosProcedimentos((atual) => ({ ...atual, [registro.linha]: { ...novoProcedimento, confirmado: e.target.checked } }));
                                    if (!e.target.checked) setSelecionadas((atual) => atual.filter((linha) => linha !== registro.linha));
                                  }} />Conferi o nome e quero cadastrar este novo procedimento
                              </label>
                              {!nomeNovoValido && <p className="text-xs text-red-700">Informe um nome de 2 a 200 caracteres com letras ou números.</p>}
                              {!permiteFixo && <p className="text-xs text-red-700">Preencha preços válidos de paciente e repasse na planilha e analise novamente.</p>}
                              <button type="button" disabled={confirmando || Boolean(resultado)} onClick={() => {
                                setNovosProcedimentos((atual) => { const copia = { ...atual }; delete copia[registro.linha]; return copia; });
                                setSelecionadas((atual) => atual.filter((linha) => linha !== registro.linha));
                                setErroConfirmacao("");
                              }} className="text-xs font-semibold text-xango-primary disabled:opacity-50">Cancelar novo cadastro</button>
                            </div>
                          ) : (
                            <button type="button" disabled={confirmando || Boolean(resultado) || !preview.previewId} onClick={() => {
                              setNovosProcedimentos((atual) => ({ ...atual, [registro.linha]: { nome: (registro.informado.procedimento || "").trim().toLocaleUpperCase("pt-BR"), confirmado: false } }));
                              setModos((atual) => ({ ...atual, [registro.linha]: "FIXO" }));
                              setErroConfirmacao("");
                            }} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-xango-primary disabled:opacity-50">Cadastrar como novo procedimento</button>
                          )
                        )}
                      </div>
                    )}
                    {!resultado && (
                      <div className="mt-3 space-y-2">
                        {linhaBusca === registro.linha ? (
                          <LocalizarProcedimentoExcel key={registro.linha}
                            previewId={preview.previewId || ""} clinicaId={preview.clinica.id}
                            registro={previewOriginal.registros.find((r) => r.linha === registro.linha) || registro}
                            onCancelar={() => setLinhaBusca(null)}
                            onOcupado={(valor) => { setVinculando(valor); onProcessando(valor); }}
                            onAplicar={(vinculo) => {
                              setVinculosManuais((atual) => ({ ...atual, [registro.linha]: vinculo }));
                              setSelecionadas((atual) => atual.filter((linha) => linha !== registro.linha));
                              setRevisadas((atual) => atual.filter((linha) => linha !== registro.linha));
                              setNovosProcedimentos((atual) => { const copia = { ...atual }; delete copia[registro.linha]; return copia; });
                              setModos((atual) => ({ ...atual, [registro.linha]: vinculo.registro.valores.origem === "CH" ? "CH" : "FIXO" }));
                              setErroConfirmacao("");
                              setLinhaBusca(null);
                              setFiltro("TODOS");
                              setBusca("");
                            }} />
                        ) : (
                          <button type="button" disabled={confirmando || !preview.previewId}
                            onClick={() => setLinhaBusca(registro.linha)}
                            className="rounded-md border border-xango-border px-3 py-2 text-xs font-semibold text-xango-primary disabled:opacity-50">
                            {procedimento ? "Escolher outro procedimento" : "Buscar procedimento existente"}
                          </button>
                        )}
                        {vinculosManuais[registro.linha] && (
                          <>
                            <p className="text-xs font-semibold text-blue-800">Vínculo escolhido nesta prévia. Confira os valores e selecione a linha para importar.</p>
                            <button type="button" disabled={confirmando} onClick={() => {
                              setVinculosManuais((atual) => { const copia = { ...atual }; delete copia[registro.linha]; return copia; });
                              setSelecionadas((atual) => atual.filter((linha) => linha !== registro.linha));
                              setRevisadas((atual) => atual.filter((linha) => linha !== registro.linha));
                              setModos((atual) => { const copia = { ...atual }; delete copia[registro.linha]; return copia; });
                              setLinhaBusca(null);
                              setErroConfirmacao("");
                            }} className="text-xs font-semibold text-xango-muted disabled:opacity-50">Desfazer vínculo manual</button>
                          </>
                        )}
                      </div>
                    )}
                    {(registro.erros ?? []).length > 0 && (
                      <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-red-700">
                        {registro.erros.map((mensagem, index) => <li key={index}>{mensagem}</li>)}
                      </ul>
                    )}
                  </td>
                  <td className="max-w-64 px-3 py-3 text-xs text-xango-text">
                    <p>TUSS: <span className="font-semibold">{procedimento?.tuss || "—"}</span></p>
                    <p className="mt-2">CH: <span className="font-semibold">{procedimento?.ch == null ? "—" : Number(procedimento.ch).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}</span></p>
                    {procedimento?.fonteCh && <p className="mt-1 text-xango-muted">Fonte: {procedimento.fonteCh}</p>}
                    {procedimento?.nomeTuss && procedimento.nomeTuss !== procedimento.nome && <p className="mt-2 wrap-break-words text-xango-muted">{procedimento.nomeTuss}</p>}
                  </td>
                  <td className="px-3 py-3 text-xs text-xango-text">
                    <p className="whitespace-nowrap">Paciente: <span className="font-semibold">{moedaPrevia(valoresSelecionados.valorPaciente)}</span></p>
                    <p className="mt-2 whitespace-nowrap">Repasse: <span className="font-semibold">{moedaPrevia(valoresSelecionados.valorRepasse)}</span></p>
                    <label className="mt-3 block text-xs text-xango-muted">
                      Modo de preço
                      <select aria-label={`Modo de preço da linha ${registro.linha}`} value={modo}
                        disabled={confirmando || Boolean(resultado) || !procedimento || registro.status === "ERRO" || (!permiteCh && !permiteFixo)}
                        onChange={(e) => {
                          setModos((atual) => ({ ...atual, [registro.linha]: e.target.value as ModoImportacaoExcel }));
                          setErroConfirmacao("");
                        }} className="mt-1 block w-full rounded-md border border-xango-border bg-white px-2 py-2 text-xs disabled:opacity-50">
                        <option value="FIXO" disabled={!permiteFixo}>Fixo — valores da planilha</option>
                        <option value="CH" disabled={!permiteCh}>CH — regra da clínica</option>
                      </select>
                    </label>
                    <p className="mt-2 text-xs text-xango-muted">{modo === "CH" ? "Acompanha os reajustes de CH da clínica." : "Preço fixo; não acompanha os reajustes de CH."}</p>
                  </td>
                </tr>
              );
            })}
            {registros.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-xango-muted">{preview.registros.length === 0 ? "A planilha não contém registros para exibir." : "Nenhum registro corresponde à busca ou situação selecionada."}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-xango-muted">
        <p>{registros.length === 0 ? "0 registros" : `${inicio + 1}–${Math.min(inicio + porPagina, registros.length)} de ${registros.length} registro(s)`}</p>
        {totalPaginas > 1 && (
          <div className="flex items-center gap-3">
            <button type="button" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)} className="rounded-md border border-xango-border px-3 py-2 font-semibold disabled:opacity-50">Anterior</button>
            <span>Página {paginaAtual} de {totalPaginas}</span>
            <button type="button" disabled={paginaAtual === totalPaginas} onClick={() => setPagina(paginaAtual + 1)} className="rounded-md border border-xango-border px-3 py-2 font-semibold disabled:opacity-50">Próxima</button>
          </div>
        )}
      </div>
      {!preview.previewId && <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Esta prévia não permite confirmação. Analise a planilha novamente.</p>}
      {resultado ? (
        <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Importação concluída.</p>
          <p className="mt-2">{resultado.criados} vínculo(s) novo(s), {resultado.substituidos} substituído(s), {resultado.mantidos} mantido(s).</p>
          <p className="mt-1">{resultado.procedimentosCriados} procedimento(s) criado(s) no catálogo. Preços gravados: {resultado.porCh} por CH e {resultado.fixos} fixo(s).</p>
          {resultado.reativados > 0 && <p className="mt-1">{resultado.reativados} vínculo(s) reativado(s).</p>}
          {avisoAtualizacao && <p className="mt-2 font-semibold">{avisoAtualizacao}</p>}
          <p className="mt-2">Para importar outros registros, analise a planilha novamente.</p>
        </div>
      ) : (
        <div className="space-y-3 rounded-md border border-xango-border bg-xango-background p-4">
          <fieldset disabled={confirmando}>
            <legend className="text-sm font-semibold text-xango-text">Quando já existir preço nesta clínica:</legend>
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="radio" name="existentes-excel" checked={!substituir} onChange={() => setSubstituir(false)} />Manter preços, modo e situação atuais</label>
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="radio" name="existentes-excel" checked={substituir} onChange={() => setSubstituir(true)} />Substituir pelos valores e modos selecionados (reativa vínculos inativos)</label>
          </fieldset>
          <p className="text-xs text-xango-muted">Somente os registros selecionados serão importados. Novos cadastros serão verificados por nome e sinônimos para evitar duplicidades. Preços específicos das unidades permanecem preservados.</p>
          {preview.expiraEm && <p className="text-xs text-xango-muted">Prévia válida até {new Date(preview.expiraEm).toLocaleTimeString("pt-BR")}. Se a prévia expirar, analise novamente.</p>}
          {erroConfirmacao && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erroConfirmacao}</p>}
          <div className="flex justify-end">
            <button type="button" disabled={!preview.previewId || confirmando || linhaBusca !== null || selecionadas.length === 0} onClick={() => void confirmarImportacao()}
              className="flex items-center gap-2 rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {confirmando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {confirmando ? "Importando..." : `Confirmar importação (${selecionadas.length})`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

type CandidatoVinculoExcel = {
  origem: "CATALOGO" | "BASE_MESTRE";
  id: number;
  nome: string;
  tuss: string | null;
  ch: number | null;
  aliases: string[];
};

function LocalizarProcedimentoExcel({ previewId, clinicaId, registro, onCancelar, onAplicar, onOcupado }: {
  previewId: string;
  clinicaId: number;
  registro: PreviewExcelRegistro;
  onCancelar: () => void;
  onAplicar: (vinculo: { vinculoId: string; registro: PreviewExcelRegistro }) => void;
  onOcupado: (valor: boolean) => void;
}) {
  const [termo, setTermo] = useState(registro.informado.procedimento || registro.informado.tuss || "");
  const [candidatos, setCandidatos] = useState<CandidatoVinculoExcel[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState("");
  const requisicao = useRef<AbortController | null>(null);
  const aplicacaoEmAndamento = useRef(false);
  useEffect(() => () => { requisicao.current?.abort(); requisicao.current = null; }, []);

  async function buscar() {
    if (aplicacaoEmAndamento.current) return;
    requisicao.current?.abort();
    const controle = new AbortController();
    requisicao.current = controle;
    setCarregando(true); setErro(""); setTotal(null); setCandidatos([]);
    const timeout = window.setTimeout(() => controle.abort(), 30000);
    try {
      const query = new URLSearchParams({ previewId, busca: termo.trim() });
      const resposta = await fetch(`http://localhost:3333/clinicas/${clinicaId}/precos/importar-excel/buscar?${query}`, { signal: controle.signal, cache: "no-store" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível buscar os procedimentos.");
      if (!Array.isArray(dados.candidatos) || typeof dados.total !== "number") throw new Error("A busca retornou uma resposta inválida.");
      if (requisicao.current !== controle) return;
      setCandidatos(dados.candidatos); setTotal(dados.total);
    } catch (e) {
      if (requisicao.current === controle) setErro(controle.signal.aborted ? "A busca demorou mais que o esperado. Tente novamente." : e instanceof Error ? e.message : "Não foi possível buscar.");
    } finally {
      window.clearTimeout(timeout);
      if (requisicao.current === controle) { requisicao.current = null; setCarregando(false); }
    }
  }

  async function aplicar(candidato: CandidatoVinculoExcel) {
    if (aplicacaoEmAndamento.current) return;
    const divergente = Boolean(registro.informado.tuss && registro.informado.tuss !== candidato.tuss);
    if (divergente && !window.confirm(`O TUSS da planilha (${registro.informado.tuss}) é diferente do procedimento escolhido (${candidato.tuss || "sem TUSS"}).\n\nDeseja usar "${candidato.nome}" nesta linha?`)) return;
    aplicacaoEmAndamento.current = true;
    setAplicando(true); onOcupado(true); setErro("");
    requisicao.current?.abort();
    const controle = new AbortController();
    requisicao.current = controle;
    const timeout = window.setTimeout(() => controle.abort(), 30000);
    try {
      const resposta = await fetch(`http://localhost:3333/clinicas/${clinicaId}/precos/importar-excel/vincular`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controle.signal,
        body: JSON.stringify({ previewId, linha: registro.linha, origem: candidato.origem, id: candidato.id, confirmarTussDivergente: divergente }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível aplicar o vínculo.");
      if (!dados.vinculoId || dados.registro?.linha !== registro.linha || !dados.registro?.procedimento) throw new Error("O vínculo recebido está incompleto. Tente novamente.");
      if (requisicao.current !== controle) return;
      onAplicar(dados);
    } catch (e) {
      if (requisicao.current === controle) setErro(controle.signal.aborted ? "A escolha demorou mais que o esperado. Tente novamente." : e instanceof Error ? e.message : "Não foi possível escolher o procedimento.");
    } finally {
      window.clearTimeout(timeout);
      aplicacaoEmAndamento.current = false;
      setAplicando(false); onOcupado(false);
      if (requisicao.current === controle) requisicao.current = null;
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50 p-3">
      <form onSubmit={(e) => { e.preventDefault(); void buscar(); }} className="space-y-2">
        <label className="block text-xs font-semibold text-xango-text">Buscar no catálogo e na Base Mestre
          <input aria-label={`Buscar vínculo da linha ${registro.linha}`} value={termo} maxLength={200} disabled={aplicando}
            onChange={(e) => {
              requisicao.current?.abort(); requisicao.current = null;
              setTermo(e.target.value); setCandidatos([]); setTotal(null); setErro(""); setCarregando(false);
            }} placeholder="Nome, sinônimo ou TUSS" className="mt-1 w-full rounded-md border border-xango-border bg-white px-2 py-2 text-sm disabled:opacity-50" />
        </label>
        <div className="flex gap-3">
          <button type="submit" disabled={aplicando || carregando || termo.trim().length < 2} className="rounded-md bg-xango-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{carregando ? "Buscando..." : "Buscar"}</button>
          <button type="button" disabled={aplicando} onClick={onCancelar} className="text-xs font-semibold text-xango-muted disabled:opacity-50">Cancelar busca</button>
        </div>
      </form>
      {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
      {aplicando && <p role="status" className="flex items-center gap-2 text-xs"><Loader2 size={14} className="animate-spin" />Atualizando a prévia...</p>}
      {total !== null && <p role="status" className="text-xs text-xango-muted">{total === 0 ? "Nenhum resultado. Tente outro nome, sinônimo ou código." : total > candidatos.length ? `${total} resultados. Exibindo ${candidatos.length}; refine a busca para localizar os demais.` : `${total} resultado(s).`}</p>}
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {candidatos.map((candidato) => (
          <div key={`${candidato.origem}-${candidato.id}`} className="rounded-md border border-xango-border bg-white p-3">
            <p className="wrap-break-words text-sm font-semibold text-xango-text">{candidato.nome}</p>
            <p className="mt-1 text-xs font-semibold text-xango-primary">{candidato.origem === "CATALOGO" ? "Catálogo Digna" : "Base Mestre TUSS"}</p>
            <p className="mt-1 text-xs text-xango-muted">TUSS: {candidato.tuss || "—"} • CH: {candidato.ch == null ? "—" : candidato.ch.toLocaleString("pt-BR")}</p>
            {candidato.aliases.length > 0 && <p className="mt-1 wrap-break-words text-xs text-xango-muted">Sinônimos: {candidato.aliases.join(" • ")}</p>}
            <button type="button" disabled={aplicando} onClick={() => void aplicar(candidato)} className="mt-2 text-xs font-semibold text-xango-primary disabled:opacity-50">Usar este procedimento</button>
          </div>
        ))}
      </div>
      <p className="text-xs text-xango-muted">A escolha atualiza a prévia. O vínculo e os preços só serão gravados na confirmação da importação.</p>
    </div>
  );
}
