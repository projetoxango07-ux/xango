"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  Eye,
  FileCheck2,
  FileText,
  HandCoins,
  Loader2,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type AbaRepasse = "PENDENTES" | "HISTORICO";

type Clinica = { id: number; nome: string };

type GuiaDisponivel = {
  guiaId: number;
  codigoVoucher: string | null;
  pacienteId: number;
  paciente: string;
  clinicaId: number;
  clinica: string;
  confirmadoEm: string;
  valorRepasse: number;
};

type ItemRepasse = {
  id: number;
  guiaId: number;
  atendimentoId: number;
  codigoVoucher: string | null;
  codigoAtendimento: string | null;
  paciente: string;
  valor: number;
  confirmadoEm: string;
};

type DocumentoRepasse = {
  id: number;
  tipo: "COMPROVANTE_PAGAMENTO" | "NOTA_FISCAL_SERVICO";
  nomeOriginal: string;
  mimeType: string;
  tamanhoBytes: number;
  criadoEm: string;
  enviadoPor: string | null;
};

type Repasse = {
  id: number;
  codigoPublico: string;
  clinicaId: number;
  clinica: string;
  status: string;
  statusLabel: string;
  origem: string;
  valorTotal: number;
  dataPagamentoSolicitada: string | null;
  solicitadoEm: string;
  emAnaliseEm: string | null;
  aprovadoEm: string | null;
  recusadoEm: string | null;
  pagoEm: string | null;
  dataPagamentoEfetivo: string | null;
  formaPagamento: string | null;
  formaPagamentoLabel: string | null;
  observacaoPagamento: string | null;
  motivoRecusa: string | null;
  observacoes: string | null;
  solicitadoPor: string | null;
  aprovadoPor: string | null;
  recusadoPor: string | null;
  pagoPor: string | null;
  quantidadeGuias: number;
  percentualDocumentacao: number;
  documentos: DocumentoRepasse[];
  itens: ItemRepasse[];
};

type DadosApi = {
  clinicas: Clinica[];
  limitesDataPagamento: { minimo: string; maximo: string };
  resumo: {
    disponivel: number;
    quantidadeDisponivel: number;
    emSolicitacao: number;
    aprovado: number;
    pago: number;
  };
  guiasDisponiveis: GuiaDisponivel[];
  repasses: Repasse[];
  paginacao: {
    pagina: number;
    porPagina: number;
    total: number;
    totalPaginas: number;
  };
};

type DetalheAtendimento = {
  repasse: {
    id: number;
    codigoPublico: string;
    status: string;
    statusLabel: string;
    clinica: string;
    valorItem: number;
  };
  atendimento: {
    id: number;
    codigoPublico: string | null;
    status: string;
    etapaAtual: number;
    criadoEm: string;
    paciente: {
      id: number;
      codigoPublico: string | null;
      nome: string;
      cpf: string;
      telefone: string;
      email: string | null;
    };
  };
  guia: {
    id: number;
    codigoPublico: string | null;
    status: string;
    clinica: string;
    unidade: {
      id: number;
      nome: string;
      cidade: string | null;
      uf: string | null;
    } | null;
    confirmadaEm: string | null;
    realizadaEm: string | null;
    emitidaEm: string | null;
    validadeAte: string | null;
    financeiro: {
      subtotal: number;
      desconto: number;
      beneficio: number;
      valorFinal: number;
      totalPago: number;
      totalEstornado: number;
      pagoLiquido: number;
      saldo: number;
      valorRepasse: number;
    };
    procedimentos: {
      id: number;
      status: string;
      procedimento: string;
      valorPaciente: number;
      valorRepasse: number;
      tipoAgendamento: string | null;
      dataAgendamento: string | null;
      horarioAgendamento: string | null;
      motivoCancelamento: string | null;
    }[];
  };
};

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dataCurta(valor: string | null) {
  if (!valor) return "-";
  return new Date(valor).toLocaleDateString("pt-BR");
}

function dataHora(valor: string | null) {
  if (!valor) return "-";
  return new Date(valor).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarCpf(valor: string) {
  const n = valor.replace(/\D/g, "");
  if (n.length !== 11) return valor;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

function formatarTelefone(valor: string) {
  const n = String(valor || "").replace(/\D/g, "");
  if (n.length === 11) {
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  }
  if (n.length === 10) {
    return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  }
  return valor || "-";
}

function formatarStatus(valor: string) {
  return String(valor || "")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letra) => letra.toUpperCase());
}

function tamanhoArquivo(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hojeInput() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function statusClasse(status: string) {
  const mapa: Record<string, string> = {
    SOLICITADO: "bg-amber-100 text-amber-800",
    EM_ANALISE: "bg-blue-100 text-blue-800",
    APROVADO: "bg-teal-100 text-teal-800",
    PAGO: "bg-emerald-100 text-emerald-800",
    RECUSADO: "bg-red-100 text-red-800",
  };
  return mapa[status] || "bg-slate-100 text-slate-700";
}

function CardResumo({
  titulo,
  valor,
  apoio,
  icone,
}: {
  titulo: string;
  valor: string;
  apoio: string;
  icone: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-xango-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">{titulo}</p>
          <p className="mt-2 text-2xl font-bold text-xango-text">{valor}</p>
          <p className="mt-1 text-xs text-xango-muted">{apoio}</p>
        </div>
        <div className="shrink-0 rounded-lg bg-xango-background p-2.5 text-xango-primary">{icone}</div>
      </div>
    </div>
  );
}

function BarraDocumentacao({ percentual }: { percentual: number }) {
  const classe = percentual >= 100
    ? "bg-emerald-600"
    : percentual >= 50
      ? "bg-amber-500"
      : "bg-slate-300";

  return (
    <div className="min-w-40">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-xango-muted">Documentação</span>
        <span className="font-semibold text-xango-text">{percentual}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all ${classe}`} style={{ width: `${percentual}%` }} />
      </div>
    </div>
  );
}

export default function RepassesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const buscaInicial = searchParams.get("busca")?.trim() || "";
  const visaoInicial: AbaRepasse = searchParams.get("visao") === "HISTORICO" ? "HISTORICO" : "PENDENTES";
  const { temPermissao } = useAuth();
  const podeEditar = temPermissao("financeiro.editar");

  const [dados, setDados] = useState<DadosApi | null>(null);
  const [aba, setAba] = useState<AbaRepasse>(visaoInicial);
  const [pagina, setPagina] = useState(1);
  const [clinicaFiltro, setClinicaFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("TODOS");
  const [busca, setBusca] = useState(buscaInicial);
  const [buscaAplicada, setBuscaAplicada] = useState(buscaInicial);

  const [novaAberta, setNovaAberta] = useState(false);
  const [clinicaNova, setClinicaNova] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [selecionadas, setSelecionadas] = useState<number[]>([]);

  const [abertos, setAbertos] = useState<number[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const [repassePagamento, setRepassePagamento] = useState<Repasse | null>(null);
  const [pagamentoData, setPagamentoData] = useState(hojeInput());
  const [pagamentoForma, setPagamentoForma] = useState("PIX");
  const [pagamentoObservacao, setPagamentoObservacao] = useState("");
  const [pagamentoComprovante, setPagamentoComprovante] = useState<File | null>(null);
  const [pagamentoNota, setPagamentoNota] = useState<File | null>(null);

  const [repasseDocumentos, setRepasseDocumentos] = useState<Repasse | null>(null);
  const [documentoComprovante, setDocumentoComprovante] = useState<File | null>(null);
  const [documentoNota, setDocumentoNota] = useState<File | null>(null);

  const [detalheAtendimento, setDetalheAtendimento] = useState<DetalheAtendimento | null>(null);
  const [painelAtendimentoAberto, setPainelAtendimentoAberto] = useState(false);
  const [carregandoAtendimento, setCarregandoAtendimento] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPagina(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [busca]);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");
      const params = new URLSearchParams();
      params.set("visao", aba);
      params.set("pagina", String(pagina));
      params.set("porPagina", "25");
      if (clinicaFiltro) params.set("clinicaId", clinicaFiltro);
      if (statusFiltro !== "TODOS") params.set("status", statusFiltro);
      if (buscaAplicada) params.set("busca", buscaAplicada);

      const resposta = await fetch(`${API_URL}/financeiro/repasses?${params.toString()}`, {
        cache: "no-store",
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível carregar os repasses.");
      setDados(resultado);
      setDataPagamento((atual) => atual || resultado.limitesDataPagamento?.minimo || "");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os repasses.");
    } finally {
      setCarregando(false);
    }
  }, [aba, buscaAplicada, clinicaFiltro, pagina, statusFiltro]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void carregar();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [carregar]);

  function trocarAba(novaAba: AbaRepasse) {
    setAba(novaAba);
    setStatusFiltro("TODOS");
    setPagina(1);
    setAbertos([]);
  }

  const guiasNovaClinica = useMemo(() => {
    if (!clinicaNova) return [];
    return (dados?.guiasDisponiveis || []).filter((guia) => guia.clinicaId === Number(clinicaNova));
  }, [dados, clinicaNova]);

  const valorSelecionado = useMemo(
    () =>
      guiasNovaClinica
        .filter((guia) => selecionadas.includes(guia.guiaId))
        .reduce((total, guia) => total + guia.valorRepasse, 0),
    [guiasNovaClinica, selecionadas]
  );

  function alternarGuia(id: number) {
    setSelecionadas((atuais) =>
      atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id]
    );
  }

  function limparAvisos() {
    setErro("");
    setMensagem("");
  }

  async function criarRepasse() {
    if (!clinicaNova || selecionadas.length === 0 || !dataPagamento) return;
    try {
      setProcessando(true);
      limparAvisos();
      const resposta = await fetch(`${API_URL}/financeiro/repasses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guiaIds: selecionadas,
          dataPagamentoSolicitada: dataPagamento,
          observacoes: observacoes.trim() || null,
        }),
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível criar o repasse.");

      setMensagem(`Solicitação ${resultado.codigoPublico} criada e colocada automaticamente em análise.`);
      setSelecionadas([]);
      setObservacoes("");
      setNovaAberta(false);
      setStatusFiltro("TODOS");
      setPagina(1);
      if (aba === "PENDENTES") {
        await carregar();
      } else {
        setAba("PENDENTES");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o repasse.");
    } finally {
      setProcessando(false);
    }
  }

  async function alterarStatus(repasse: Repasse, status: string) {
    let motivoRecusa: string | null = null;
    if (status === "RECUSADO") {
      motivoRecusa = window.prompt("Informe o motivo da recusa:")?.trim() || null;
      if (!motivoRecusa) return;
    }

    const mensagens: Record<string, string> = {
      EM_ANALISE: "Colocar esta solicitação em análise?",
      APROVADO: "Aprovar este repasse?",
      RECUSADO: "Recusar este repasse? A solicitação sairá da fila de pendentes e a guia poderá ser solicitada novamente.",
    };
    if (!window.confirm(mensagens[status] || "Confirmar alteração?")) return;

    try {
      setProcessando(true);
      limparAvisos();
      const resposta = await fetch(`${API_URL}/financeiro/repasses/${repasse.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, motivoRecusa }),
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível atualizar o repasse.");
      setMensagem(`${repasse.codigoPublico} atualizado com sucesso.`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar o repasse.");
    } finally {
      setProcessando(false);
    }
  }

  function abrirPagamento(repasse: Repasse) {
    setRepassePagamento(repasse);
    setPagamentoData(repasse.dataPagamentoEfetivo ? repasse.dataPagamentoEfetivo.slice(0, 10) : hojeInput());
    setPagamentoForma(repasse.formaPagamento || "PIX");
    setPagamentoObservacao(repasse.observacaoPagamento || "");
    setPagamentoComprovante(null);
    setPagamentoNota(null);
  }

  async function registrarPagamento() {
    if (!repassePagamento || !pagamentoData || !pagamentoForma) return;
    try {
      setProcessando(true);
      limparAvisos();
      const form = new FormData();
      form.append("dataPagamento", pagamentoData);
      form.append("formaPagamento", pagamentoForma);
      form.append("observacaoPagamento", pagamentoObservacao.trim());
      if (pagamentoComprovante) form.append("comprovante", pagamentoComprovante);
      if (pagamentoNota) form.append("notaFiscal", pagamentoNota);

      const resposta = await fetch(`${API_URL}/financeiro/repasses/${repassePagamento.id}/pagamento`, {
        method: "POST",
        body: form,
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível registrar o pagamento.");

      setMensagem(resultado.mensagem || "Pagamento registrado com sucesso.");
      setRepassePagamento(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível registrar o pagamento.");
    } finally {
      setProcessando(false);
    }
  }

  function abrirDocumentos(repasse: Repasse) {
    setRepasseDocumentos(repasse);
    setDocumentoComprovante(null);
    setDocumentoNota(null);
  }

  async function salvarDocumentos() {
    if (!repasseDocumentos || (!documentoComprovante && !documentoNota)) return;
    try {
      setProcessando(true);
      limparAvisos();
      const form = new FormData();
      if (documentoComprovante) form.append("comprovante", documentoComprovante);
      if (documentoNota) form.append("notaFiscal", documentoNota);

      const resposta = await fetch(`${API_URL}/financeiro/repasses/${repasseDocumentos.id}/documentos`, {
        method: "POST",
        body: form,
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível salvar os documentos.");

      setMensagem(resultado.mensagem || "Documentos salvos com sucesso.");
      setRepasseDocumentos(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar os documentos.");
    } finally {
      setProcessando(false);
    }
  }

  async function abrirDocumento(repasse: Repasse, documento: DocumentoRepasse) {
    try {
      limparAvisos();
      const resposta = await fetch(`${API_URL}/financeiro/repasses/${repasse.id}/documentos/${documento.id}`);
      if (!resposta.ok) {
        const resultado = await resposta.json().catch(() => null);
        throw new Error(resultado?.erro || "Não foi possível abrir o documento.");
      }
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível abrir o documento.");
    }
  }

  async function removerDocumento(repasse: Repasse, documento: DocumentoRepasse) {
    if (!window.confirm(`Remover ${documento.nomeOriginal} deste repasse? O histórico do arquivo será preservado para auditoria.`)) return;
    try {
      setProcessando(true);
      limparAvisos();
      const resposta = await fetch(`${API_URL}/financeiro/repasses/${repasse.id}/documentos/${documento.id}`, {
        method: "DELETE",
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível remover o documento.");
      setMensagem(resultado.mensagem || "Documento removido.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível remover o documento.");
    } finally {
      setProcessando(false);
    }
  }

  async function verAtendimento(item: ItemRepasse) {
    try {
      setPainelAtendimentoAberto(true);
      setCarregandoAtendimento(true);
      setDetalheAtendimento(null);
      setErro("");
      const resposta = await fetch(`${API_URL}/financeiro/repasses/itens/${item.id}/atendimento`, {
        cache: "no-store",
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível carregar o atendimento.");
      setDetalheAtendimento(resultado);
    } catch (e) {
      setPainelAtendimentoAberto(false);
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o atendimento.");
    } finally {
      setCarregandoAtendimento(false);
    }
  }

  const repasseDoPainel = detalheAtendimento
    ? (dados?.repasses || []).find((repasse) => repasse.id === detalheAtendimento.repasse.id) || null
    : null;

  const statusDisponiveis = aba === "PENDENTES"
    ? [
        ["TODOS", "Todos os pendentes"],
        ["SOLICITADO", "Solicitado"],
        ["EM_ANALISE", "Em análise"],
        ["APROVADO", "Aprovado a pagar"],
      ]
    : [
        ["TODOS", "Todos os concluídos"],
        ["PAGO", "Pago"],
        ["RECUSADO", "Recusado"],
      ];

  if (carregando && !dados) {
    return (
      <div className="flex min-h-80 items-center justify-center text-sm text-xango-muted">
        <Loader2 size={20} className="mr-2 animate-spin" />
        Carregando controle de repasses...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-375 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/financeiro"
            className="mt-0.5 rounded-lg border border-xango-border bg-white p-2 text-xango-primary"
            title="Voltar ao financeiro"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="text-2xl font-semibold text-xango-text">Repasses às clínicas</h2>
            <p className="mt-1 text-sm text-xango-muted">
              Analise solicitações pendentes, registre pagamentos e consulte o histórico concluído.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {podeEditar && (
            <button
              type="button"
              onClick={() => setNovaAberta((aberta) => !aberta)}
              className="flex items-center gap-2 rounded-lg bg-xango-primary px-4 py-2.5 text-sm font-semibold text-white"
            >
              {novaAberta ? <X size={16} /> : <Plus size={16} />}
              {novaAberta ? "Fechar solicitação manual" : "Nova solicitação manual"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={carregando || processando}
            className="flex items-center gap-2 rounded-lg border border-xango-border bg-white px-4 py-2.5 text-sm font-semibold text-xango-primary disabled:opacity-50"
          >
            <RefreshCw size={16} className={carregando ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {erro && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>
      )}
      {mensagem && (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensagem}</div>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardResumo
          titulo="Disponível para solicitar"
          valor={moeda(dados?.resumo.disponivel || 0)}
          apoio={`${dados?.resumo.quantidadeDisponivel || 0} guia(s) confirmada(s)`}
          icone={<HandCoins size={20} />}
        />
        <CardResumo
          titulo="Em análise"
          valor={moeda(dados?.resumo.emSolicitacao || 0)}
          apoio="Solicitado ou em análise"
          icone={<Clock3 size={20} />}
        />
        <CardResumo
          titulo="Aprovado a pagar"
          valor={moeda(dados?.resumo.aprovado || 0)}
          apoio="Aguardando baixa do pagamento"
          icone={<BadgeCheck size={20} />}
        />
        <CardResumo
          titulo="Total pago"
          valor={moeda(dados?.resumo.pago || 0)}
          apoio="Repasses já baixados"
          icone={<CircleDollarSign size={20} />}
        />
      </section>

      {podeEditar && novaAberta && (
        <section className="mt-6 rounded-xl border border-xango-border bg-white shadow-sm">
          <div className="border-b border-xango-border p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-xango-background p-2 text-xango-primary"><WalletCards size={19} /></div>
              <div>
                <h3 className="font-semibold text-xango-text">Nova solicitação manual</h3>
                <p className="mt-1 text-sm text-xango-muted">
                  Recurso administrativo para exceções. A solicitação entra automaticamente em análise.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(250px,1fr)_190px]">
              <label className="text-xs font-semibold text-xango-muted">
                Clínica
                <select
                  value={clinicaNova}
                  onChange={(e) => {
                    setClinicaNova(e.target.value);
                    setSelecionadas([]);
                  }}
                  className="mt-1 w-full rounded-lg border border-xango-border bg-white px-3 py-2.5 text-sm font-normal text-xango-text outline-none focus:border-xango-primary"
                >
                  <option value="">Selecione a clínica</option>
                  {(dados?.clinicas || []).map((clinica) => (
                    <option key={clinica.id} value={clinica.id}>{clinica.nome}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-xango-muted">
                Data solicitada para pagamento
                <input
                  type="date"
                  min={dados?.limitesDataPagamento.minimo}
                  max={dados?.limitesDataPagamento.maximo}
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-xango-border px-3 py-2.5 text-sm font-normal text-xango-text outline-none focus:border-xango-primary"
                />
              </label>
            </div>

            {!clinicaNova ? (
              <div className="mt-5 rounded-lg border border-dashed border-xango-border p-8 text-center text-sm text-xango-muted">
                Selecione uma clínica para visualizar as guias confirmadas disponíveis.
              </div>
            ) : guiasNovaClinica.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-xango-border p-8 text-center text-sm text-xango-muted">
                Esta clínica não possui guias confirmadas disponíveis para uma nova solicitação.
              </div>
            ) : (
              <div className="mt-5 overflow-hidden rounded-lg border border-xango-border">
                <div className="overflow-x-auto">
                  <table className="min-w-230 w-full text-left text-sm">
                    <thead className="border-b border-xango-border bg-slate-50 text-xs uppercase tracking-wide text-xango-muted">
                      <tr>
                        <th className="w-12 px-4 py-3" />
                        <th className="px-4 py-3">Paciente / voucher</th>
                        <th className="px-4 py-3">Confirmado em</th>
                        <th className="px-4 py-3 text-right">Repasse</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-xango-border">
                      {guiasNovaClinica.map((guia) => (
                        <tr key={guia.guiaId} className={selecionadas.includes(guia.guiaId) ? "bg-teal-50/50" : ""}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selecionadas.includes(guia.guiaId)}
                              onChange={() => alternarGuia(guia.guiaId)}
                              className="h-4 w-4 accent-teal-700"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-xango-text">{guia.paciente}</p>
                            <p className="mt-0.5 text-xs text-xango-muted">{guia.codigoVoucher || `Guia #${guia.guiaId}`}</p>
                          </td>
                          <td className="px-4 py-3 text-xango-muted">{dataCurta(guia.confirmadoEm)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-xango-text">{moeda(guia.valorRepasse)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <label className="text-xs font-semibold text-xango-muted">
                Observações da solicitação
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value.slice(0, 2000))}
                  rows={2}
                  placeholder="Opcional"
                  className="mt-1 w-full resize-none rounded-lg border border-xango-border px-3 py-2.5 text-sm font-normal text-xango-text outline-none focus:border-xango-primary"
                />
              </label>
              <div className="min-w-65 rounded-lg bg-xango-background p-4">
                <p className="text-xs uppercase tracking-wide text-xango-muted">Selecionado</p>
                <p className="mt-1 text-xl font-bold text-xango-text">{moeda(valorSelecionado)}</p>
                <p className="mt-1 text-xs text-xango-muted">{selecionadas.length} guia(s)</p>
                <button
                  type="button"
                  disabled={processando || !clinicaNova || selecionadas.length === 0 || !dataPagamento}
                  onClick={() => void criarRepasse()}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-xango-primary px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {processando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Criar solicitação
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mt-6 overflow-hidden rounded-xl border border-xango-border bg-white shadow-sm">
        <div className="border-b border-xango-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-xango-text">
                {aba === "PENDENTES" ? "Fila de repasses pendentes" : "Histórico de repasses"}
              </h3>
              <p className="mt-1 text-sm text-xango-muted">
                {aba === "PENDENTES"
                  ? "Aqui ficam somente as solicitações que ainda exigem alguma ação."
                  : "Pagamentos concluídos e solicitações recusadas ficam preservados para consulta."}
              </p>
            </div>
            <span className="rounded-full bg-xango-background px-3 py-1 text-xs font-semibold text-xango-primary">
              {dados?.paginacao.total || 0} registro(s)
            </span>
          </div>

          <div className="mt-5 flex gap-2 border-b border-xango-border">
            <button
              type="button"
              onClick={() => trocarAba("PENDENTES")}
              className={`border-b-2 px-4 py-2.5 text-sm font-semibold ${
                aba === "PENDENTES"
                  ? "border-xango-primary text-xango-primary"
                  : "border-transparent text-xango-muted hover:text-xango-text"
              }`}
            >
              Pendentes
            </button>
            <button
              type="button"
              onClick={() => trocarAba("HISTORICO")}
              className={`border-b-2 px-4 py-2.5 text-sm font-semibold ${
                aba === "HISTORICO"
                  ? "border-xango-primary text-xango-primary"
                  : "border-transparent text-xango-muted hover:text-xango-text"
              }`}
            >
              Histórico
            </button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_240px_210px]">
            <div className="relative">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-xango-muted" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Código, clínica, paciente, CPF ou voucher..."
                className="w-full rounded-lg border border-xango-border py-2.5 pl-9 pr-3 text-sm outline-none focus:border-xango-primary"
              />
            </div>
            <select
              value={clinicaFiltro}
              onChange={(e) => {
                setClinicaFiltro(e.target.value);
                setPagina(1);
              }}
              className="rounded-lg border border-xango-border bg-white px-3 py-2.5 text-sm outline-none focus:border-xango-primary"
            >
              <option value="">Todas as clínicas</option>
              {(dados?.clinicas || []).map((clinica) => (
                <option key={clinica.id} value={clinica.id}>{clinica.nome}</option>
              ))}
            </select>
            <select
              value={statusFiltro}
              onChange={(e) => {
                setStatusFiltro(e.target.value);
                setPagina(1);
              }}
              className="rounded-lg border border-xango-border bg-white px-3 py-2.5 text-sm outline-none focus:border-xango-primary"
            >
              {statusDisponiveis.map(([valor, label]) => (
                <option key={valor} value={valor}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="divide-y divide-xango-border">
          {carregando && (
            <div className="flex items-center justify-center p-10 text-sm text-xango-muted">
              <Loader2 size={18} className="mr-2 animate-spin" /> Atualizando repasses...
            </div>
          )}

          {!carregando && (dados?.repasses || []).length === 0 && (
            <div className="p-12 text-center">
              <FileCheck2 size={30} className="mx-auto text-xango-muted" />
              <p className="mt-3 font-semibold text-xango-text">
                {aba === "PENDENTES" ? "Nenhum repasse pendente" : "Nenhum repasse encontrado no histórico"}
              </p>
              <p className="mt-1 text-sm text-xango-muted">
                {aba === "PENDENTES"
                  ? "Quando houver uma solicitação que exija ação, ela aparecerá aqui."
                  : "Altere os filtros para localizar registros concluídos."}
              </p>
            </div>
          )}

          {!carregando && (dados?.repasses || []).map((repasse) => {
            const aberto = abertos.includes(repasse.id);
            const pagamentoIncompleto = repasse.status === "PAGO" && (!repasse.dataPagamentoEfetivo || !repasse.formaPagamento);
            return (
              <article key={repasse.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-xango-text">{repasse.codigoPublico}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasse(repasse.status)}`}>
                        {repasse.statusLabel}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-xango-muted">
                      <span className="flex items-center gap-1"><Building2 size={14} />{repasse.clinica}</span>
                      <span className="flex items-center gap-1"><CalendarClock size={14} />Solicitado {dataHora(repasse.solicitadoEm)}</span>
                      <span>Pagamento pedido: {dataCurta(repasse.dataPagamentoSolicitada)}</span>
                      <span>{repasse.quantidadeGuias} guia(s)</span>
                    </div>
                    {repasse.motivoRecusa && (
                      <p className="mt-2 text-sm text-red-600"><strong>Motivo da recusa:</strong> {repasse.motivoRecusa}</p>
                    )}
                  </div>

                  <div className="min-w-52 text-right">
                    <p className="text-xl font-bold text-xango-text">{moeda(repasse.valorTotal)}</p>
                    <button
                      type="button"
                      onClick={() => setAbertos((atuais) =>
                        atuais.includes(repasse.id)
                          ? atuais.filter((id) => id !== repasse.id)
                          : [...atuais, repasse.id]
                      )}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-xango-primary"
                    >
                      {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {aberto ? "Ocultar detalhes" : "Ver detalhes"}
                    </button>
                  </div>
                </div>

                {aba === "PENDENTES" && podeEditar && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {repasse.status === "SOLICITADO" && (
                      <button
                        type="button"
                        disabled={processando}
                        onClick={() => void alterarStatus(repasse, "EM_ANALISE")}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50"
                      >
                        Colocar em análise
                      </button>
                    )}
                    {["SOLICITADO", "EM_ANALISE"].includes(repasse.status) && (
                      <>
                        <button
                          type="button"
                          disabled={processando}
                          onClick={() => void alterarStatus(repasse, "APROVADO")}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                        >
                          Aprovar repasse
                        </button>
                        <button
                          type="button"
                          disabled={processando}
                          onClick={() => void alterarStatus(repasse, "RECUSADO")}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                        >
                          Recusar
                        </button>
                      </>
                    )}
                    {repasse.status === "APROVADO" && (
                      <button
                        type="button"
                        disabled={processando}
                        onClick={() => abrirPagamento(repasse)}
                        className="rounded-lg bg-xango-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Registrar pagamento
                      </button>
                    )}
                  </div>
                )}

                {aberto && (
                  <div className="mt-4 rounded-lg border border-xango-border bg-slate-50/50 p-4">
                    <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                      <div className="grid gap-3 text-xs text-xango-muted sm:grid-cols-2 lg:grid-cols-4">
                        <p><strong className="text-xango-text">Solicitado por:</strong> {repasse.solicitadoPor || "-"}</p>
                        <p><strong className="text-xango-text">Aprovado por:</strong> {repasse.aprovadoPor || "-"}</p>
                        <p><strong className="text-xango-text">Pago por:</strong> {repasse.pagoPor || "-"}</p>
                        <p><strong className="text-xango-text">Pago em:</strong> {dataCurta(repasse.dataPagamentoEfetivo || repasse.pagoEm)}</p>
                      </div>
                      {repasse.status === "PAGO" && (
                        <BarraDocumentacao percentual={repasse.percentualDocumentacao} />
                      )}
                    </div>

                    {repasse.status === "PAGO" && (
                      <div className="mt-4 grid gap-3 rounded-lg border border-xango-border bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-xs font-semibold uppercase text-xango-muted">Data efetiva</p>
                          <p className="mt-1 font-medium text-xango-text">{dataCurta(repasse.dataPagamentoEfetivo)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-xango-muted">Forma</p>
                          <p className="mt-1 font-medium text-xango-text">{repasse.formaPagamentoLabel || "Não informada"}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-xs font-semibold uppercase text-xango-muted">Observação</p>
                          <p className="mt-1 text-xango-text">{repasse.observacaoPagamento || "Sem observação"}</p>
                        </div>
                      </div>
                    )}

                    {repasse.observacoes && (
                      <p className="mt-4 text-sm text-xango-muted"><strong className="text-xango-text">Observações da solicitação:</strong> {repasse.observacoes}</p>
                    )}

                    <div className="mt-4 overflow-hidden rounded-lg border border-xango-border bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-180 text-left text-sm">
                          <thead className="border-b border-xango-border bg-slate-50 text-xs uppercase tracking-wide text-xango-muted">
                            <tr>
                              <th className="px-4 py-3">Paciente / voucher</th>
                              <th className="px-4 py-3">Confirmação</th>
                              <th className="px-4 py-3 text-right">Valor</th>
                              <th className="px-4 py-3 text-right">Análise</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-xango-border">
                            {repasse.itens.map((item) => (
                              <tr key={item.id}>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-xango-text">{item.paciente}</p>
                                  <p className="mt-0.5 text-xs text-xango-muted">{item.codigoVoucher || `Guia #${item.guiaId}`}</p>
                                </td>
                                <td className="px-4 py-3 text-xango-muted">{dataCurta(item.confirmadoEm)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-xango-text">{moeda(item.valor)}</td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => void verAtendimento(item)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary hover:bg-xango-background"
                                  >
                                    <Eye size={14} /> Ver atendimento
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {repasse.status === "PAGO" && (
                    <div className="mt-4 rounded-lg border border-xango-border bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-xango-text">Documentos do repasse</h4>
                          <p className="mt-1 text-xs text-xango-muted">
                            Comprovante + nota fiscal completam 100% da documentação.
                          </p>
                        </div>
                        {podeEditar && (
                          <div className="flex flex-wrap gap-2">
                            {pagamentoIncompleto && (
                              <button
                                type="button"
                                onClick={() => abrirPagamento(repasse)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
                              >
                                <WalletCards size={14} /> Completar dados do pagamento
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => abrirDocumentos(repasse)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary"
                            >
                              <Upload size={14} /> Adicionar / substituir documentos
                            </button>
                          </div>
                        )}
                      </div>

                      {repasse.documentos.length === 0 ? (
                        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-xango-muted">Nenhum documento anexado.</p>
                      ) : (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {repasse.documentos.map((documento) => (
                            <div key={documento.id} className="flex items-center justify-between gap-3 rounded-lg border border-xango-border p-3">
                              <div className="min-w-0 flex items-start gap-2.5">
                                <Paperclip size={16} className="mt-0.5 shrink-0 text-xango-primary" />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold uppercase text-xango-muted">
                                    {documento.tipo === "COMPROVANTE_PAGAMENTO" ? "Comprovante" : "Nota fiscal de serviço"}
                                  </p>
                                  <p className="mt-0.5 truncate text-sm font-medium text-xango-text">{documento.nomeOriginal}</p>
                                  <p className="mt-0.5 text-[11px] text-xango-muted">
                                    {tamanhoArquivo(documento.tamanhoBytes)} • {dataHora(documento.criadoEm)}
                                    {documento.enviadoPor ? ` • ${documento.enviadoPor}` : ""}
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  onClick={() => void abrirDocumento(repasse, documento)}
                                  className="rounded-md border border-xango-border p-2 text-xango-primary"
                                  title="Abrir documento"
                                >
                                  <Eye size={14} />
                                </button>
                                {podeEditar && (
                                  <button
                                    type="button"
                                    onClick={() => void removerDocumento(repasse, documento)}
                                    className="rounded-md border border-red-200 p-2 text-red-600"
                                    title="Remover documento"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {(dados?.paginacao.totalPaginas || 1) > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-xango-border px-5 py-4">
            <p className="text-xs text-xango-muted">
              Página {dados?.paginacao.pagina || 1} de {dados?.paginacao.totalPaginas || 1} • {dados?.paginacao.total || 0} registro(s)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={(dados?.paginacao.pagina || 1) <= 1 || carregando}
                onClick={() => setPagina((atual) => Math.max(atual - 1, 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Anterior
              </button>
              <button
                type="button"
                disabled={(dados?.paginacao.pagina || 1) >= (dados?.paginacao.totalPaginas || 1) || carregando}
                onClick={() => setPagina((atual) => atual + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary disabled:opacity-40"
              >
                Próxima <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </section>

      {repassePagamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-xango-border p-5">
              <div>
                <h3 className="font-semibold text-xango-text">
                  {repassePagamento.status === "PAGO" ? "Dados do pagamento" : "Registrar pagamento"}
                </h3>
                <p className="mt-1 text-sm text-xango-muted">
                  {repassePagamento.codigoPublico} • {repassePagamento.clinica} • {moeda(repassePagamento.valorTotal)}
                </p>
              </div>
              <button type="button" onClick={() => setRepassePagamento(null)} className="rounded-md p-1.5 text-xango-muted hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-xango-muted">
                  Data efetiva do pagamento *
                  <input
                    type="date"
                    value={pagamentoData}
                    onChange={(e) => setPagamentoData(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-xango-border px-3 py-2.5 text-sm font-normal text-xango-text outline-none focus:border-xango-primary"
                  />
                </label>
                <label className="text-xs font-semibold text-xango-muted">
                  Forma de pagamento *
                  <select
                    value={pagamentoForma}
                    onChange={(e) => setPagamentoForma(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-xango-border bg-white px-3 py-2.5 text-sm font-normal text-xango-text outline-none focus:border-xango-primary"
                  >
                    <option value="PIX">PIX</option>
                    <option value="TRANSFERENCIA">Transferência / TED / DOC</option>
                    <option value="BOLETO">Boleto</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </label>
              </div>

              <label className="block text-xs font-semibold text-xango-muted">
                Observação do pagamento
                <textarea
                  rows={2}
                  value={pagamentoObservacao}
                  onChange={(e) => setPagamentoObservacao(e.target.value.slice(0, 2000))}
                  placeholder="Opcional"
                  className="mt-1 w-full resize-none rounded-lg border border-xango-border px-3 py-2.5 text-sm font-normal text-xango-text outline-none focus:border-xango-primary"
                />
              </label>

              <div className="rounded-lg border border-xango-border bg-slate-50 p-4">
                <p className="text-sm font-semibold text-xango-text">Documentos opcionais nesta etapa</p>
                <p className="mt-1 text-xs text-xango-muted">
                  O pagamento pode ser salvo sem os arquivos. Eles poderão ser anexados ou substituídos posteriormente.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-xango-muted">
                    Comprovante de pagamento
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setPagamentoComprovante(e.target.files?.[0] || null)}
                      className="mt-1 block w-full text-xs font-normal text-xango-text file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-xango-primary"
                    />
                  </label>
                  <label className="text-xs font-semibold text-xango-muted">
                    Nota fiscal de serviço
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.xml"
                      onChange={(e) => setPagamentoNota(e.target.files?.[0] || null)}
                      className="mt-1 block w-full text-xs font-normal text-xango-text file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-xango-primary"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-xango-border p-5">
              <button type="button" onClick={() => setRepassePagamento(null)} className="rounded-lg border border-xango-border px-4 py-2.5 text-sm font-semibold text-xango-text">
                Cancelar
              </button>
              <button
                type="button"
                disabled={processando || !pagamentoData || !pagamentoForma}
                onClick={() => void registrarPagamento()}
                className="inline-flex items-center gap-2 rounded-lg bg-xango-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {processando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Salvar pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {repasseDocumentos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-xango-border p-5">
              <div>
                <h3 className="font-semibold text-xango-text">Documentos do repasse</h3>
                <p className="mt-1 text-sm text-xango-muted">{repasseDocumentos.codigoPublico}</p>
              </div>
              <button type="button" onClick={() => setRepasseDocumentos(null)} className="rounded-md p-1.5 text-xango-muted hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
                Se já existir um documento do mesmo tipo, o novo arquivo passa a ser o vigente. O anterior continua preservado para auditoria.
              </p>
              <label className="block text-xs font-semibold text-xango-muted">
                Comprovante de pagamento
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setDocumentoComprovante(e.target.files?.[0] || null)}
                  className="mt-1 block w-full rounded-lg border border-xango-border p-2 text-xs font-normal text-xango-text"
                />
              </label>
              <label className="block text-xs font-semibold text-xango-muted">
                Nota fiscal de serviço
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.xml"
                  onChange={(e) => setDocumentoNota(e.target.files?.[0] || null)}
                  className="mt-1 block w-full rounded-lg border border-xango-border p-2 text-xs font-normal text-xango-text"
                />
              </label>
              <p className="text-xs text-xango-muted">Formatos aceitos: PDF, JPG, PNG e XML. Máximo de 10 MB por arquivo.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-xango-border p-5">
              <button type="button" onClick={() => setRepasseDocumentos(null)} className="rounded-lg border border-xango-border px-4 py-2.5 text-sm font-semibold text-xango-text">
                Cancelar
              </button>
              <button
                type="button"
                disabled={processando || (!documentoComprovante && !documentoNota)}
                onClick={() => void salvarDocumentos()}
                className="inline-flex items-center gap-2 rounded-lg bg-xango-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {processando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Salvar documentos
              </button>
            </div>
          </div>
        </div>
      )}

      {painelAtendimentoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/30" onClick={() => setPainelAtendimentoAberto(false)}>
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-xango-border bg-white p-5">
              <div>
                <h3 className="font-semibold text-xango-text">Detalhes do atendimento</h3>
                <p className="mt-1 text-sm text-xango-muted">Conferência rápida para análise do repasse.</p>
              </div>
              <button type="button" onClick={() => setPainelAtendimentoAberto(false)} className="rounded-md p-1.5 text-xango-muted hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            {carregandoAtendimento && (
              <div className="flex min-h-80 items-center justify-center text-sm text-xango-muted">
                <Loader2 size={18} className="mr-2 animate-spin" /> Carregando atendimento...
              </div>
            )}

            {!carregandoAtendimento && detalheAtendimento && (
              <div className="space-y-5 p-5">
                <div className="rounded-lg border border-xango-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-xango-muted">Repasse</p>
                      <p className="mt-1 font-bold text-xango-text">{detalheAtendimento.repasse.codigoPublico}</p>
                      <p className="mt-1 text-sm text-xango-muted">{detalheAtendimento.repasse.clinica}</p>
                    </div>
                    <p className="text-lg font-bold text-xango-text">{moeda(detalheAtendimento.repasse.valorItem)}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-xango-border p-4">
                  <div className="flex items-center gap-2 text-xango-primary"><UserRound size={16} /><h4 className="font-semibold">Paciente</h4></div>
                  <p className="mt-3 font-semibold text-xango-text">{detalheAtendimento.atendimento.paciente.nome}</p>
                  <div className="mt-2 grid gap-2 text-sm text-xango-muted sm:grid-cols-2">
                    <p>CPF: {formatarCpf(detalheAtendimento.atendimento.paciente.cpf)}</p>
                    <p>Telefone: {formatarTelefone(detalheAtendimento.atendimento.paciente.telefone)}</p>
                    <p className="sm:col-span-2">Atendimento: {detalheAtendimento.atendimento.codigoPublico || `#${detalheAtendimento.atendimento.id}`}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-xango-border p-4">
                  <div className="flex items-center gap-2 text-xango-primary"><FileText size={16} /><h4 className="font-semibold">Guia / voucher</h4></div>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <p><span className="text-xango-muted">Voucher:</span><br /><strong className="text-xango-text">{detalheAtendimento.guia.codigoPublico || `#${detalheAtendimento.guia.id}`}</strong></p>
                    <p><span className="text-xango-muted">Status:</span><br /><strong className="text-xango-text">{formatarStatus(detalheAtendimento.guia.status)}</strong></p>
                    <p><span className="text-xango-muted">Clínica:</span><br /><strong className="text-xango-text">{detalheAtendimento.guia.clinica}</strong></p>
                    <p><span className="text-xango-muted">Unidade:</span><br /><strong className="text-xango-text">{detalheAtendimento.guia.unidade?.nome || "Não informada"}</strong></p>
                    <p><span className="text-xango-muted">Confirmado em:</span><br /><strong className="text-xango-text">{dataHora(detalheAtendimento.guia.confirmadaEm)}</strong></p>
                    <p><span className="text-xango-muted">Realizado em:</span><br /><strong className="text-xango-text">{dataHora(detalheAtendimento.guia.realizadaEm)}</strong></p>
                  </div>
                </div>

                <div className="rounded-lg border border-xango-border p-4">
                  <h4 className="font-semibold text-xango-text">Procedimentos</h4>
                  <div className="mt-3 divide-y divide-xango-border">
                    {detalheAtendimento.guia.procedimentos.map((procedimento) => (
                      <div key={procedimento.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-xango-text">{procedimento.procedimento}</p>
                            <p className="mt-1 text-xs text-xango-muted">
                              {formatarStatus(procedimento.status)}
                              {procedimento.dataAgendamento ? ` • ${dataCurta(procedimento.dataAgendamento)}` : ""}
                              {procedimento.horarioAgendamento ? ` • ${procedimento.horarioAgendamento}` : ""}
                            </p>
                          </div>
                          <div className="text-right text-xs">
                            <p className="font-semibold text-xango-text">Paciente {moeda(procedimento.valorPaciente)}</p>
                            <p className="mt-1 text-xango-muted">Repasse {moeda(procedimento.valorRepasse)}</p>
                          </div>
                        </div>
                        {procedimento.motivoCancelamento && <p className="mt-2 text-xs text-red-600">{procedimento.motivoCancelamento}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-xango-border p-4">
                  <h4 className="font-semibold text-xango-text">Financeiro da guia</h4>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <p><span className="text-xango-muted">Valor final</span><br /><strong>{moeda(detalheAtendimento.guia.financeiro.valorFinal)}</strong></p>
                    <p><span className="text-xango-muted">Pago líquido</span><br /><strong>{moeda(detalheAtendimento.guia.financeiro.pagoLiquido)}</strong></p>
                    <p><span className="text-xango-muted">Saldo</span><br /><strong>{moeda(detalheAtendimento.guia.financeiro.saldo)}</strong></p>
                    <p><span className="text-xango-muted">Repasse solicitado</span><br /><strong>{moeda(detalheAtendimento.guia.financeiro.valorRepasse)}</strong></p>
                  </div>
                </div>

                {podeEditar && repasseDoPainel && ["SOLICITADO", "EM_ANALISE"].includes(repasseDoPainel.status) && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={processando}
                      onClick={() => {
                        setPainelAtendimentoAberto(false);
                        void alterarStatus(repasseDoPainel, "APROVADO");
                      }}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 disabled:opacity-50"
                    >
                      Aprovar repasse
                    </button>
                    <button
                      type="button"
                      disabled={processando}
                      onClick={() => {
                        setPainelAtendimentoAberto(false);
                        void alterarStatus(repasseDoPainel, "RECUSADO");
                      }}
                      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-50"
                    >
                      Recusar repasse
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => router.push(`/guias/${detalheAtendimento.guia.id}`)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-xango-primary px-4 py-3 text-sm font-semibold text-white"
                >
                  <Eye size={16} /> Ir para a guia
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
