"use client";

import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Search,
  Stethoscope,
  X,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
const ITENS_POR_PAGINA = 25;

type AbaPrincipal = "OPERACIONAIS" | "FINANCEIROS" | "PRODUCAO";
type AbaOperacional = "ATENDIMENTOS" | "GUIAS";
type AbaFinanceira = "MOVIMENTACOES" | "REPASSES";
type AbaProducao = "CLINICAS" | "PROCEDIMENTOS";

type Opcao = { id: number; nome: string };
type AtendenteOpcao = Opcao & { perfil: string };

type AtendimentoRelatorio = {
  id: number;
  codigoPublico: string | null;
  status: string;
  etapaAtual: number;
  criadoEm: string;
  atualizadoEm: string;
  canceladoEm: string | null;
  motivoCancelamento: string | null;
  paciente: {
    id: number;
    codigoPublico: string | null;
    nome: string;
    cpf: string;
    telefone: string;
  };
  atendente: { id: number; nome: string } | null;
  quantidadeGuias: number;
  quantidadeGuiasAtivas: number;
  valorGuias: number;
  recebidoLiquido: number;
  saldo: number;
};

type GuiaRelatorio = {
  id: number;
  codigoPublico: string | null;
  status: string;
  realizacao: string;
  criadoEm: string;
  emitidaEm: string | null;
  validadeAte: string | null;
  confirmadaEm: string | null;
  realizadaEm: string | null;
  dataAgendamento: string | null;
  atendimentoId: number;
  codigoAtendimento: string | null;
  paciente: {
    id: number;
    codigoPublico: string | null;
    nome: string;
    cpf: string;
    telefone: string;
  };
  clinica: Opcao;
  unidade: Opcao | null;
  atendente: { id: number; nome: string } | null;
  procedimentos: Array<{
    id: number;
    nome: string;
    categoria: string | null;
    status: string;
    valorPaciente: number;
    valorRepasse: number;
  }>;
  valorFinal: number;
  recebidoBruto: number;
  estornos: number;
  recebidoLiquido: number;
  saldo: number;
  valorRepasse: number;
};

type DadosRelatorio = {
  periodo: { inicio: string; fim: string };
  filtros: {
    busca: string;
    clinicaId: number | null;
    atendenteId: number | null;
    statusAtendimento: string;
    statusGuia: string;
    statusRealizacao: string;
    dataGuia: string;
  };
  opcoes: {
    clinicas: Opcao[];
    atendentes: AtendenteOpcao[];
  };
  resumo: {
    atendimentos: {
      total: number;
      concluidos: number;
      cancelados: number;
      emAndamento: number;
      valorGuias: number;
      recebidoLiquido: number;
      saldo: number;
    };
    guias: {
      total: number;
      realizadas: number;
      aguardandoRealizacao: number;
      canceladas: number;
      valorCobrado: number;
      recebidoLiquido: number;
      saldo: number;
      repassePrevisto: number;
    };
  };
  atendimentos: AtendimentoRelatorio[];
  guias: GuiaRelatorio[];
};

type Filtros = {
  inicio: string;
  fim: string;
  busca: string;
  clinicaId: string;
  atendenteId: string;
  statusAtendimento: string;
  statusGuia: string;
  statusRealizacao: string;
  dataGuia: string;
};


type MovimentacaoFinanceiraRelatorio = {
  id: string;
  tipo: "RECEBIMENTO" | "ESTORNO";
  data: string;
  valor: number;
  forma: string;
  formaLabel: string;
  observacao: string | null;
  guiaId: number;
  codigoVoucher: string | null;
  atendimentoId: number;
  codigoAtendimento: string | null;
  pacienteId: number;
  paciente: string;
  cpf: string;
  telefone: string;
  clinicaId: number;
  clinica: string;
};

type DocumentoRepasseRelatorio = {
  id: number;
  tipo: string;
  nomeOriginal: string;
  mimeType: string;
  tamanhoBytes: number;
  criadoEm: string;
  enviadoPor: string | null;
};

type ItemRepasseRelatorio = {
  id: number;
  guiaId: number;
  atendimentoId: number;
  codigoVoucher: string | null;
  codigoAtendimento: string | null;
  pacienteId: number;
  paciente: string;
  cpf: string;
  telefone: string;
  valor: number;
  confirmadoEm: string;
};

type RepasseFinanceiroRelatorio = {
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
  percentualDocumentacao: number | null;
  documentos: DocumentoRepasseRelatorio[];
  itens: ItemRepasseRelatorio[];
};

type DadosRelatorioFinanceiro = {
  periodo: { inicio: string; fim: string };
  filtros: {
    busca: string;
    clinicaId: number | null;
    tipoMovimentacao: string;
    formaPagamento: string;
    statusRepasse: string;
    dataRepasse: string;
    formaRepasse: string;
  };
  opcoes: {
    clinicas: Opcao[];
    formasPagamento: Array<{ codigo: string; label: string }>;
  };
  resumo: {
    movimentacoes: {
      total: number;
      quantidadeRecebimentos: number;
      quantidadeEstornos: number;
      recebidoBruto: number;
      estornos: number;
      recebidoLiquido: number;
    };
    repasses: {
      total: number;
      valorTotal: number;
      pendentes: number;
      valorPendente: number;
      pagos: number;
      valorPago: number;
      recusados: number;
      valorRecusado: number;
      documentacaoCompleta: number;
    };
  };
  movimentacoes: MovimentacaoFinanceiraRelatorio[];
  repasses: RepasseFinanceiroRelatorio[];
};

type FiltrosFinanceiros = {
  inicio: string;
  fim: string;
  busca: string;
  clinicaId: string;
  tipoMovimentacao: string;
  formaPagamento: string;
  statusRepasse: string;
  dataRepasse: string;
  formaRepasse: string;
};


type GuiaProducaoResumo = {
  guiaId: number;
  codigoVoucher: string | null;
  atendimentoId: number;
  codigoAtendimento: string | null;
  pacienteId: number;
  paciente: string;
  cpf: string;
  clinicaId: number;
  clinica: string;
  unidade: string | null;
  realizadoEm: string | null;
  procedimentoId: number;
  procedimento: string;
  valorPaciente: number;
  valorRepasse: number;
};

type ProducaoClinica = {
  id: number;
  nome: string;
  quantidadeAtendimentos: number;
  quantidadeGuias: number;
  quantidadePacientes: number;
  quantidadeProcedimentos: number;
  valorPaciente: number;
  valorRepasse: number;
  diferenca: number;
  margemPercentual: number;
  procedimentos: Array<{
    id: number;
    nome: string;
    categoria: string | null;
    quantidade: number;
    valorPaciente: number;
    valorRepasse: number;
    diferenca: number;
  }>;
  ultimasGuias: GuiaProducaoResumo[];
};

type ProducaoProcedimento = {
  id: number;
  nome: string;
  categoria: string | null;
  quantidadeClinicas: number;
  quantidadeAtendimentos: number;
  quantidadeGuias: number;
  quantidadePacientes: number;
  quantidade: number;
  valorPaciente: number;
  valorRepasse: number;
  diferenca: number;
  margemPercentual: number;
  clinicas: Array<{
    id: number;
    nome: string;
    quantidade: number;
    valorPaciente: number;
    valorRepasse: number;
    diferenca: number;
  }>;
  ultimasGuias: GuiaProducaoResumo[];
};

type DadosRelatorioProducao = {
  periodo: { inicio: string; fim: string };
  filtros: {
    busca: string;
    clinicaId: number | null;
    procedimentoId: number | null;
  };
  opcoes: {
    clinicas: Opcao[];
    procedimentos: Array<Opcao & { categoria: string | null }>;
  };
  resumo: {
    clinicas: number;
    procedimentos: number;
    quantidadeRealizada: number;
    atendimentos: number;
    guias: number;
    pacientes: number;
    valorPaciente: number;
    valorRepasse: number;
    diferenca: number;
    margemPercentual: number;
  };
  clinicas: ProducaoClinica[];
  procedimentos: ProducaoProcedimento[];
};

type FiltrosProducao = {
  inicio: string;
  fim: string;
  busca: string;
  clinicaId: string;
  procedimentoId: string;
};

function dois(valor: number) {
  return String(valor).padStart(2, "0");
}

function periodoMesAtual() {
  const agora = new Date();
  const inicio = `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-01`;
  const ultimo = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const fim = `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(ultimo)}`;
  return { inicio, fim };
}

const PERIODO_INICIAL = periodoMesAtual();

const FILTROS_INICIAIS: Filtros = {
  inicio: PERIODO_INICIAL.inicio,
  fim: PERIODO_INICIAL.fim,
  busca: "",
  clinicaId: "",
  atendenteId: "",
  statusAtendimento: "TODOS",
  statusGuia: "TODOS",
  statusRealizacao: "TODOS",
  dataGuia: "CRIACAO",
};


const FILTROS_FINANCEIROS_INICIAIS: FiltrosFinanceiros = {
  inicio: PERIODO_INICIAL.inicio,
  fim: PERIODO_INICIAL.fim,
  busca: "",
  clinicaId: "",
  tipoMovimentacao: "TODOS",
  formaPagamento: "TODAS",
  statusRepasse: "TODOS",
  dataRepasse: "SOLICITACAO",
  formaRepasse: "TODAS",
};

const FILTROS_PRODUCAO_INICIAIS: FiltrosProducao = {
  inicio: PERIODO_INICIAL.inicio,
  fim: PERIODO_INICIAL.fim,
  busca: "",
  clinicaId: "",
  procedimentoId: "",
};

const FORMAS_RECEBIMENTO = [
  ["TODAS", "Todas as formas"],
  ["PIX", "Pix"],
  ["DINHEIRO", "Dinheiro"],
  ["CARTAO_CREDITO", "Cartão de crédito"],
  ["CARTAO_DEBITO", "Cartão de débito"],
  ["TRANSFERENCIA", "Transferência"],
  ["OUTRO", "Outro"],
] as const;

const FORMAS_REPASSE = [
  ["TODAS", "Todas as formas"],
  ["PIX", "PIX"],
  ["TRANSFERENCIA", "Transferência / TED / DOC"],
  ["BOLETO", "Boleto"],
  ["DINHEIRO", "Dinheiro"],
  ["OUTRO", "Outro"],
] as const;

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dataBr(valor: string | null | undefined, comHora = false) {
  if (!valor) return "-";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR", comHora
    ? { dateStyle: "short", timeStyle: "short" }
    : { dateStyle: "short" }
  );
}

function cpfBr(valor: string) {
  const n = String(valor || "").replace(/\D/g, "");
  if (n.length !== 11) return valor;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

function statusLabel(status: string) {
  const mapa: Record<string, string> = {
    EM_ANDAMENTO: "Em andamento",
    AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
    PARCIALMENTE_PAGO: "Parcialmente pago",
    CONCLUIDO: "Concluído",
    CANCELADO: "Cancelado",
    RASCUNHO: "Rascunho",
    PARCIALMENTE_PAGA: "Parcialmente paga",
    PAGA: "Paga",
    ESTORNO_PENDENTE: "Estorno pendente",
    CANCELADA: "Cancelada",
    AGUARDANDO: "Aguardando",
    PARCIAL: "Parcial",
    REALIZADO: "Realizado",
    SOLICITADO: "Solicitado",
    EM_ANALISE: "Em análise",
    APROVADO: "Aprovado",
    PAGO: "Pago",
    RECUSADO: "Recusado",
    RECEBIMENTO: "Recebimento",
    ESTORNO: "Estorno",
  };
  return mapa[status] || status.replaceAll("_", " ");
}

function classeStatus(status: string) {
  if (["CONCLUIDO", "PAGA", "PAGO", "REALIZADO"].includes(status)) {
    return "bg-emerald-100 text-emerald-800";
  }
  if (["CANCELADO", "CANCELADA", "RECUSADO", "ESTORNO"].includes(status)) {
    return "bg-red-100 text-red-700";
  }
  if (["AGUARDANDO_PAGAMENTO", "AGUARDANDO", "ESTORNO_PENDENTE", "SOLICITADO", "APROVADO"].includes(status)) {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-sky-100 text-sky-800";
}

function csvCampo(valor: unknown) {
  const texto = String(valor ?? "").replaceAll('"', '""');
  return `"${texto}"`;
}

function baixarCsv(nome: string, linhas: string[][]) {
  const conteudo = "\uFEFF" + linhas.map((linha) => linha.map(csvCampo).join(";")).join("\r\n");
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escaparHtml(valor: unknown) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function buscarRelatorio(filtros: Filtros, signal?: AbortSignal) {
  const params = new URLSearchParams({
    inicio: filtros.inicio,
    fim: filtros.fim,
    busca: filtros.busca.trim(),
    statusAtendimento: filtros.statusAtendimento,
    statusGuia: filtros.statusGuia,
    statusRealizacao: filtros.statusRealizacao,
    dataGuia: filtros.dataGuia,
  });
  if (filtros.clinicaId) params.set("clinicaId", filtros.clinicaId);
  if (filtros.atendenteId) params.set("atendenteId", filtros.atendenteId);

  const resposta = await fetch(`${API_URL}/relatorios/operacionais?${params.toString()}`, {
    credentials: "include",
    signal,
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(dados?.erro || "Não foi possível carregar os relatórios.");
  }
  return dados as DadosRelatorio;
}

async function buscarRelatorioFinanceiro(filtros: FiltrosFinanceiros, signal?: AbortSignal) {
  const params = new URLSearchParams({
    inicio: filtros.inicio,
    fim: filtros.fim,
    busca: filtros.busca.trim(),
    tipoMovimentacao: filtros.tipoMovimentacao,
    formaPagamento: filtros.formaPagamento,
    statusRepasse: filtros.statusRepasse,
    dataRepasse: filtros.dataRepasse,
    formaRepasse: filtros.formaRepasse,
  });
  if (filtros.clinicaId) params.set("clinicaId", filtros.clinicaId);

  const resposta = await fetch(`${API_URL}/relatorios/financeiros?${params.toString()}`, {
    credentials: "include",
    signal,
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(dados?.erro || "Não foi possível carregar os relatórios financeiros.");
  }
  return dados as DadosRelatorioFinanceiro;
}


async function buscarRelatorioProducao(filtros: FiltrosProducao, signal?: AbortSignal) {
  const params = new URLSearchParams({
    inicio: filtros.inicio,
    fim: filtros.fim,
    busca: filtros.busca.trim(),
  });
  if (filtros.clinicaId) params.set("clinicaId", filtros.clinicaId);
  if (filtros.procedimentoId) params.set("procedimentoId", filtros.procedimentoId);

  const resposta = await fetch(`${API_URL}/relatorios/producao?${params.toString()}`, {
    credentials: "include",
    signal,
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(dados?.erro || "Não foi possível carregar os relatórios de produção.");
  }
  return dados as DadosRelatorioProducao;
}

function percentual(valor: number) {
  return `${Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function CardResumo({
  titulo,
  valor,
  detalhe,
  icone,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  icone: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{valor}</p>
          {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5 text-xango-primary">{icone}</div>
      </div>
    </div>
  );
}

export default function RelatoriosPage() {
  const router = useRouter();
  const [abaPrincipal, setAbaPrincipal] = useState<AbaPrincipal>("OPERACIONAIS");
  const [abaOperacional, setAbaOperacional] = useState<AbaOperacional>("ATENDIMENTOS");
  const [abaFinanceira, setAbaFinanceira] = useState<AbaFinanceira>("MOVIMENTACOES");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [filtrosFinanceiros, setFiltrosFinanceiros] = useState<FiltrosFinanceiros>(FILTROS_FINANCEIROS_INICIAIS);
  const [dados, setDados] = useState<DadosRelatorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [pagina, setPagina] = useState(1);
  const [atendimentoSelecionado, setAtendimentoSelecionado] = useState<AtendimentoRelatorio | null>(null);
  const [guiaSelecionada, setGuiaSelecionada] = useState<GuiaRelatorio | null>(null);
  const [dadosFinanceiros, setDadosFinanceiros] = useState<DadosRelatorioFinanceiro | null>(null);
  const [carregandoFinanceiro, setCarregandoFinanceiro] = useState(false);
  const [erroFinanceiro, setErroFinanceiro] = useState("");
  const [paginaFinanceira, setPaginaFinanceira] = useState(1);
  const [movimentacaoSelecionada, setMovimentacaoSelecionada] = useState<MovimentacaoFinanceiraRelatorio | null>(null);
  const [repasseSelecionado, setRepasseSelecionado] = useState<RepasseFinanceiroRelatorio | null>(null);
  const [abaProducao, setAbaProducao] = useState<AbaProducao>("CLINICAS");
  const [filtrosProducao, setFiltrosProducao] = useState<FiltrosProducao>(FILTROS_PRODUCAO_INICIAIS);
  const [dadosProducao, setDadosProducao] = useState<DadosRelatorioProducao | null>(null);
  const [carregandoProducao, setCarregandoProducao] = useState(false);
  const [erroProducao, setErroProducao] = useState("");
  const [paginaProducao, setPaginaProducao] = useState(1);
  const [clinicaProducaoSelecionada, setClinicaProducaoSelecionada] = useState<ProducaoClinica | null>(null);
  const [procedimentoProducaoSelecionado, setProcedimentoProducaoSelecionado] = useState<ProducaoProcedimento | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    buscarRelatorio(FILTROS_INICIAIS, controller.signal)
      .then((resultado) => {
        setDados(resultado);
        setErro("");
      })
      .catch((e) => {
        if (e?.name !== "AbortError") {
          setErro(e instanceof Error ? e.message : "Não foi possível carregar os relatórios.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false);
      });
    return () => controller.abort();
  }, []);

  async function aplicarFiltros() {
    setAtendimentoSelecionado(null);
    setGuiaSelecionada(null);
    setCarregando(true);
    setErro("");
    try {
      const resultado = await buscarRelatorio(filtros);
      setDados(resultado);
      setPagina(1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os relatórios.");
    } finally {
      setCarregando(false);
    }
  }

  function limparFiltros() {
    setAtendimentoSelecionado(null);
    setGuiaSelecionada(null);
    setFiltros(FILTROS_INICIAIS);
    setCarregando(true);
    setErro("");
    buscarRelatorio(FILTROS_INICIAIS)
      .then((resultado) => {
        setDados(resultado);
        setPagina(1);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar os relatórios."))
      .finally(() => setCarregando(false));
  }


  async function trocarAbaPrincipal(aba: AbaPrincipal) {
    setAbaPrincipal(aba);
    setAtendimentoSelecionado(null);
    setGuiaSelecionada(null);
    setMovimentacaoSelecionada(null);
    setRepasseSelecionado(null);
    setClinicaProducaoSelecionada(null);
    setProcedimentoProducaoSelecionado(null);

    if (aba === "FINANCEIROS" && !dadosFinanceiros && !carregandoFinanceiro) {
      setCarregandoFinanceiro(true);
      setErroFinanceiro("");
      try {
        const resultado = await buscarRelatorioFinanceiro(filtrosFinanceiros);
        setDadosFinanceiros(resultado);
        setPaginaFinanceira(1);
      } catch (e) {
        setErroFinanceiro(e instanceof Error ? e.message : "Não foi possível carregar os relatórios financeiros.");
      } finally {
        setCarregandoFinanceiro(false);
      }
    }

    if (aba === "PRODUCAO" && !dadosProducao && !carregandoProducao) {
      setCarregandoProducao(true);
      setErroProducao("");
      try {
        const resultado = await buscarRelatorioProducao(filtrosProducao);
        setDadosProducao(resultado);
        setPaginaProducao(1);
      } catch (e) {
        setErroProducao(e instanceof Error ? e.message : "Não foi possível carregar os relatórios de produção.");
      } finally {
        setCarregandoProducao(false);
      }
    }
  }

  async function aplicarFiltrosFinanceiros() {
    setMovimentacaoSelecionada(null);
    setRepasseSelecionado(null);
    setCarregandoFinanceiro(true);
    setErroFinanceiro("");
    try {
      const resultado = await buscarRelatorioFinanceiro(filtrosFinanceiros);
      setDadosFinanceiros(resultado);
      setPaginaFinanceira(1);
    } catch (e) {
      setErroFinanceiro(e instanceof Error ? e.message : "Não foi possível carregar os relatórios financeiros.");
    } finally {
      setCarregandoFinanceiro(false);
    }
  }

  async function limparFiltrosFinanceiros() {
    setMovimentacaoSelecionada(null);
    setRepasseSelecionado(null);
    setFiltrosFinanceiros(FILTROS_FINANCEIROS_INICIAIS);
    setCarregandoFinanceiro(true);
    setErroFinanceiro("");
    try {
      const resultado = await buscarRelatorioFinanceiro(FILTROS_FINANCEIROS_INICIAIS);
      setDadosFinanceiros(resultado);
      setPaginaFinanceira(1);
    } catch (e) {
      setErroFinanceiro(e instanceof Error ? e.message : "Não foi possível carregar os relatórios financeiros.");
    } finally {
      setCarregandoFinanceiro(false);
    }
  }

  function trocarAbaFinanceira(aba: AbaFinanceira) {
    setAbaFinanceira(aba);
    setMovimentacaoSelecionada(null);
    setRepasseSelecionado(null);
    setPaginaFinanceira(1);
  }

  const itensFinanceirosAtivos = abaFinanceira === "MOVIMENTACOES"
    ? dadosFinanceiros?.movimentacoes || []
    : dadosFinanceiros?.repasses || [];
  const totalPaginasFinanceiras = Math.max(1, Math.ceil(itensFinanceirosAtivos.length / ITENS_POR_PAGINA));

  const movimentacoesPagina = useMemo(() => {
    const inicio = (paginaFinanceira - 1) * ITENS_POR_PAGINA;
    return (dadosFinanceiros?.movimentacoes || []).slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [dadosFinanceiros?.movimentacoes, paginaFinanceira]);

  const repassesPagina = useMemo(() => {
    const inicio = (paginaFinanceira - 1) * ITENS_POR_PAGINA;
    return (dadosFinanceiros?.repasses || []).slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [dadosFinanceiros?.repasses, paginaFinanceira]);


  async function aplicarFiltrosProducao() {
    setClinicaProducaoSelecionada(null);
    setProcedimentoProducaoSelecionado(null);
    setCarregandoProducao(true);
    setErroProducao("");
    try {
      const resultado = await buscarRelatorioProducao(filtrosProducao);
      setDadosProducao(resultado);
      setPaginaProducao(1);
    } catch (e) {
      setErroProducao(e instanceof Error ? e.message : "Não foi possível carregar os relatórios de produção.");
    } finally {
      setCarregandoProducao(false);
    }
  }

  async function limparFiltrosProducao() {
    setClinicaProducaoSelecionada(null);
    setProcedimentoProducaoSelecionado(null);
    setFiltrosProducao(FILTROS_PRODUCAO_INICIAIS);
    setCarregandoProducao(true);
    setErroProducao("");
    try {
      const resultado = await buscarRelatorioProducao(FILTROS_PRODUCAO_INICIAIS);
      setDadosProducao(resultado);
      setPaginaProducao(1);
    } catch (e) {
      setErroProducao(e instanceof Error ? e.message : "Não foi possível carregar os relatórios de produção.");
    } finally {
      setCarregandoProducao(false);
    }
  }

  function trocarAbaProducao(aba: AbaProducao) {
    setAbaProducao(aba);
    setClinicaProducaoSelecionada(null);
    setProcedimentoProducaoSelecionado(null);
    setPaginaProducao(1);
  }

  const itensProducaoAtivos = abaProducao === "CLINICAS"
    ? dadosProducao?.clinicas || []
    : dadosProducao?.procedimentos || [];
  const totalPaginasProducao = Math.max(1, Math.ceil(itensProducaoAtivos.length / ITENS_POR_PAGINA));

  const clinicasProducaoPagina = useMemo(() => {
    const inicio = (paginaProducao - 1) * ITENS_POR_PAGINA;
    return (dadosProducao?.clinicas || []).slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [dadosProducao?.clinicas, paginaProducao]);

  const procedimentosProducaoPagina = useMemo(() => {
    const inicio = (paginaProducao - 1) * ITENS_POR_PAGINA;
    return (dadosProducao?.procedimentos || []).slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [dadosProducao?.procedimentos, paginaProducao]);

  const itensAtivos = abaOperacional === "ATENDIMENTOS" ? dados?.atendimentos || [] : dados?.guias || [];
  const totalPaginas = Math.max(1, Math.ceil(itensAtivos.length / ITENS_POR_PAGINA));


  const atendimentosPagina = useMemo(() => {
    const inicio = (pagina - 1) * ITENS_POR_PAGINA;
    return (dados?.atendimentos || []).slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [dados?.atendimentos, pagina]);

  const guiasPagina = useMemo(() => {
    const inicio = (pagina - 1) * ITENS_POR_PAGINA;
    return (dados?.guias || []).slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [dados?.guias, pagina]);

  function trocarAbaOperacional(aba: AbaOperacional) {
    setAtendimentoSelecionado(null);
    setGuiaSelecionada(null);
    setAbaOperacional(aba);
    setPagina(1);
  }

  function exportarCsv() {
    if (!dados) return;
    if (abaOperacional === "ATENDIMENTOS") {
      baixarCsv(`relatorio-atendimentos-${filtros.inicio}-a-${filtros.fim}.csv`, [
        ["Atendimento", "Data", "Paciente", "CPF", "Atendente", "Status", "Guias", "Valor das guias", "Recebido líquido", "Saldo"],
        ...dados.atendimentos.map((item) => [
          item.codigoPublico || String(item.id),
          dataBr(item.criadoEm, true),
          item.paciente.nome,
          cpfBr(item.paciente.cpf),
          item.atendente?.nome || "-",
          statusLabel(item.status),
          String(item.quantidadeGuias),
          moeda(item.valorGuias),
          moeda(item.recebidoLiquido),
          moeda(item.saldo),
        ]),
      ]);
      return;
    }

    baixarCsv(`relatorio-guias-${filtros.inicio}-a-${filtros.fim}.csv`, [
      ["Voucher", "Atendimento", "Data", "Paciente", "CPF", "Clínica", "Unidade", "Procedimentos", "Financeiro", "Realização", "Valor", "Recebido líquido", "Saldo", "Repasse previsto"],
      ...dados.guias.map((item) => [
        item.codigoPublico || String(item.id),
        item.codigoAtendimento || String(item.atendimentoId),
        dataBr(item.dataAgendamento || item.criadoEm),
        item.paciente.nome,
        cpfBr(item.paciente.cpf),
        item.clinica.nome,
        item.unidade?.nome || "-",
        item.procedimentos.map((p) => p.nome).join(" | "),
        statusLabel(item.status),
        statusLabel(item.realizacao),
        moeda(item.valorFinal),
        moeda(item.recebidoLiquido),
        moeda(item.saldo),
        moeda(item.valorRepasse),
      ]),
    ]);
  }

  function imprimirPdf() {
    if (!dados) return;
    const janela = window.open("", "_blank", "width=1200,height=800");
    if (!janela) {
      alert("O navegador bloqueou a janela de impressão. Libere pop-ups para gerar o PDF.");
      return;
    }

    const titulo = abaOperacional === "ATENDIMENTOS" ? "Relatório de Atendimentos" : "Relatório de Guias / Vouchers";
    const cabecalho = abaOperacional === "ATENDIMENTOS"
      ? ["Atendimento", "Data", "Paciente", "Atendente", "Status", "Guias", "Valor", "Recebido", "Saldo"]
      : ["Voucher", "Data", "Paciente", "Clínica", "Procedimentos", "Financeiro", "Realização", "Valor", "Saldo"];
    const linhas = abaOperacional === "ATENDIMENTOS"
      ? dados.atendimentos.map((item) => [
          item.codigoPublico || item.id,
          dataBr(item.criadoEm),
          item.paciente.nome,
          item.atendente?.nome || "-",
          statusLabel(item.status),
          item.quantidadeGuias,
          moeda(item.valorGuias),
          moeda(item.recebidoLiquido),
          moeda(item.saldo),
        ])
      : dados.guias.map((item) => [
          item.codigoPublico || item.id,
          dataBr(item.dataAgendamento || item.criadoEm),
          item.paciente.nome,
          item.clinica.nome,
          item.procedimentos.map((p) => p.nome).join(", "),
          statusLabel(item.status),
          statusLabel(item.realizacao),
          moeda(item.valorFinal),
          moeda(item.saldo),
        ]);

    janela.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escaparHtml(titulo)}</title><style>
      body{font-family:Arial,sans-serif;color:#17343a;padding:28px;font-size:11px}h1{font-size:20px;margin:0 0 6px}p{margin:0 0 18px;color:#64748b}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d9e0e2;padding:7px;text-align:left;vertical-align:top}th{background:#f5f7f7;font-size:10px;text-transform:uppercase}tr:nth-child(even){background:#fafafa}@page{size:landscape;margin:12mm}</style></head><body>
      <h1>${escaparHtml(titulo)}</h1><p>Período: ${escaparHtml(filtros.inicio)} a ${escaparHtml(filtros.fim)} • Gerado em ${escaparHtml(new Date().toLocaleString("pt-BR"))}</p>
      <table><thead><tr>${cabecalho.map((c) => `<th>${escaparHtml(c)}</th>`).join("")}</tr></thead><tbody>${linhas.map((linha) => `<tr>${linha.map((c) => `<td>${escaparHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <script>window.onload=()=>{window.print();}</script></body></html>`);
    janela.document.close();
  }


  function exportarCsvFinanceiro() {
    if (!dadosFinanceiros) return;

    if (abaFinanceira === "MOVIMENTACOES") {
      baixarCsv(`relatorio-recebimentos-estornos-${filtrosFinanceiros.inicio}-a-${filtrosFinanceiros.fim}.csv`, [
        ["Data", "Tipo", "Paciente", "CPF", "Voucher", "Atendimento", "Clínica", "Forma", "Valor", "Observação"],
        ...dadosFinanceiros.movimentacoes.map((item) => [
          dataBr(item.data, true),
          statusLabel(item.tipo),
          item.paciente,
          cpfBr(item.cpf),
          item.codigoVoucher || String(item.guiaId),
          item.codigoAtendimento || String(item.atendimentoId),
          item.clinica,
          item.formaLabel,
          moeda(item.valor),
          item.observacao || "",
        ]),
      ]);
      return;
    }

    baixarCsv(`relatorio-repasses-${filtrosFinanceiros.inicio}-a-${filtrosFinanceiros.fim}.csv`, [
      ["Repasse", "Clínica", "Status", "Guias", "Solicitado em", "Pagamento solicitado", "Pagamento efetivo", "Forma", "Valor", "Documentação", "Motivo da recusa"],
      ...dadosFinanceiros.repasses.map((item) => [
        item.codigoPublico,
        item.clinica,
        item.statusLabel,
        String(item.quantidadeGuias),
        dataBr(item.solicitadoEm, true),
        dataBr(item.dataPagamentoSolicitada),
        dataBr(item.dataPagamentoEfetivo),
        item.formaPagamentoLabel || "-",
        moeda(item.valorTotal),
        item.percentualDocumentacao === null ? "-" : `${item.percentualDocumentacao}%`,
        item.motivoRecusa || "",
      ]),
    ]);
  }

  function imprimirPdfFinanceiro() {
    if (!dadosFinanceiros) return;
    const janela = window.open("", "_blank", "width=1200,height=800");
    if (!janela) {
      alert("O navegador bloqueou a janela de impressão. Libere pop-ups para gerar o PDF.");
      return;
    }

    const titulo = abaFinanceira === "MOVIMENTACOES"
      ? "Relatório de Recebimentos e Estornos"
      : "Relatório de Repasses às Clínicas";
    const cabecalho = abaFinanceira === "MOVIMENTACOES"
      ? ["Data", "Tipo", "Paciente", "Voucher", "Clínica", "Forma", "Valor"]
      : ["Repasse", "Clínica", "Status", "Guias", "Solicitado", "Pagamento", "Valor", "Docs"];
    const linhas = abaFinanceira === "MOVIMENTACOES"
      ? dadosFinanceiros.movimentacoes.map((item) => [
          dataBr(item.data, true),
          statusLabel(item.tipo),
          item.paciente,
          item.codigoVoucher || item.guiaId,
          item.clinica,
          item.formaLabel,
          moeda(item.valor),
        ])
      : dadosFinanceiros.repasses.map((item) => [
          item.codigoPublico,
          item.clinica,
          item.statusLabel,
          item.quantidadeGuias,
          dataBr(item.solicitadoEm),
          dataBr(item.dataPagamentoEfetivo || item.dataPagamentoSolicitada),
          moeda(item.valorTotal),
          item.percentualDocumentacao === null ? "-" : `${item.percentualDocumentacao}%`,
        ]);

    janela.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escaparHtml(titulo)}</title><style>
      body{font-family:Arial,sans-serif;color:#17343a;padding:28px;font-size:11px}h1{font-size:20px;margin:0 0 6px}p{margin:0 0 18px;color:#64748b}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d9e0e2;padding:7px;text-align:left;vertical-align:top}th{background:#f5f7f7;font-size:10px;text-transform:uppercase}tr:nth-child(even){background:#fafafa}@page{size:landscape;margin:12mm}</style></head><body>
      <h1>${escaparHtml(titulo)}</h1><p>Período: ${escaparHtml(filtrosFinanceiros.inicio)} a ${escaparHtml(filtrosFinanceiros.fim)} • Gerado em ${escaparHtml(new Date().toLocaleString("pt-BR"))}</p>
      <table><thead><tr>${cabecalho.map((c) => `<th>${escaparHtml(c)}</th>`).join("")}</tr></thead><tbody>${linhas.map((linha) => `<tr>${linha.map((c) => `<td>${escaparHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <script>window.onload=()=>{window.print();}</script></body></html>`);
    janela.document.close();
  }


  function exportarCsvProducao() {
    if (!dadosProducao) return;

    if (abaProducao === "CLINICAS") {
      baixarCsv(`relatorio-producao-clinicas-${filtrosProducao.inicio}-a-${filtrosProducao.fim}.csv`, [
        ["Clínica", "Atendimentos", "Guias", "Pacientes", "Procedimentos realizados", "Valor paciente", "Repasse", "Diferença operacional", "Margem operacional"],
        ...dadosProducao.clinicas.map((item) => [
          item.nome,
          String(item.quantidadeAtendimentos),
          String(item.quantidadeGuias),
          String(item.quantidadePacientes),
          String(item.quantidadeProcedimentos),
          moeda(item.valorPaciente),
          moeda(item.valorRepasse),
          moeda(item.diferenca),
          percentual(item.margemPercentual),
        ]),
      ]);
      return;
    }

    baixarCsv(`relatorio-producao-procedimentos-${filtrosProducao.inicio}-a-${filtrosProducao.fim}.csv`, [
      ["Procedimento", "Categoria", "Clínicas", "Atendimentos", "Guias", "Pacientes", "Realizados", "Valor paciente", "Repasse", "Diferença operacional", "Margem operacional"],
      ...dadosProducao.procedimentos.map((item) => [
        item.nome,
        item.categoria || "-",
        String(item.quantidadeClinicas),
        String(item.quantidadeAtendimentos),
        String(item.quantidadeGuias),
        String(item.quantidadePacientes),
        String(item.quantidade),
        moeda(item.valorPaciente),
        moeda(item.valorRepasse),
        moeda(item.diferenca),
        percentual(item.margemPercentual),
      ]),
    ]);
  }

  function imprimirPdfProducao() {
    if (!dadosProducao) return;
    const janela = window.open("", "_blank", "width=1200,height=800");
    if (!janela) {
      alert("O navegador bloqueou a janela de impressão. Libere pop-ups para gerar o PDF.");
      return;
    }

    const titulo = abaProducao === "CLINICAS"
      ? "Relatório de Produção por Clínica"
      : "Relatório de Produção por Procedimento";
    const cabecalho = abaProducao === "CLINICAS"
      ? ["Clínica", "Atend.", "Guias", "Realizados", "Valor paciente", "Repasse", "Diferença", "Margem"]
      : ["Procedimento", "Categoria", "Clínicas", "Realizados", "Valor paciente", "Repasse", "Diferença", "Margem"];
    const linhas = abaProducao === "CLINICAS"
      ? dadosProducao.clinicas.map((item) => [
          item.nome,
          item.quantidadeAtendimentos,
          item.quantidadeGuias,
          item.quantidadeProcedimentos,
          moeda(item.valorPaciente),
          moeda(item.valorRepasse),
          moeda(item.diferenca),
          percentual(item.margemPercentual),
        ])
      : dadosProducao.procedimentos.map((item) => [
          item.nome,
          item.categoria || "-",
          item.quantidadeClinicas,
          item.quantidade,
          moeda(item.valorPaciente),
          moeda(item.valorRepasse),
          moeda(item.diferenca),
          percentual(item.margemPercentual),
        ]);

    janela.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escaparHtml(titulo)}</title><style>
      body{font-family:Arial,sans-serif;color:#17343a;padding:28px;font-size:11px}h1{font-size:20px;margin:0 0 6px}p{margin:0 0 18px;color:#64748b}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d9e0e2;padding:7px;text-align:left;vertical-align:top}th{background:#f5f7f7;font-size:10px;text-transform:uppercase}tr:nth-child(even){background:#fafafa}@page{size:landscape;margin:12mm}</style></head><body>
      <h1>${escaparHtml(titulo)}</h1><p>Período de realização: ${escaparHtml(filtrosProducao.inicio)} a ${escaparHtml(filtrosProducao.fim)} • Gerado em ${escaparHtml(new Date().toLocaleString("pt-BR"))}</p>
      <table><thead><tr>${cabecalho.map((c) => `<th>${escaparHtml(c)}</th>`).join("")}</tr></thead><tbody>${linhas.map((linha) => `<tr>${linha.map((c) => `<td>${escaparHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <script>window.onload=()=>{window.print();}</script></body></html>`);
    janela.document.close();
  }

  async function abrirDocumentoRepasse(documento: DocumentoRepasseRelatorio) {
    if (!repasseSelecionado) return;
    try {
      const resposta = await fetch(`${API_URL}/financeiro/repasses/${repasseSelecionado.id}/documentos/${documento.id}`, {
        credentials: "include",
      });
      if (!resposta.ok) {
        const resultado = await resposta.json().catch(() => null);
        throw new Error(resultado?.erro || "Não foi possível abrir o documento.");
      }
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Não foi possível abrir o documento.");
    }
  }

  const resumoAtd = dados?.resumo.atendimentos;
  const resumoGuias = dados?.resumo.guias;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Relatórios</h1>
        <p className="mt-1 text-sm text-slate-500">Consulte, filtre e exporte informações operacionais, financeiras e de produção da Digna Saúde.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <div className="grid gap-1 sm:grid-cols-3">
          {([
            ["OPERACIONAIS", "Operacionais", "Atendimentos e guias"],
            ["FINANCEIROS", "Financeiros", "Recebimentos e repasses"],
            ["PRODUCAO", "Produção", "Clínicas e procedimentos"],
          ] as Array<[AbaPrincipal, string, string]>).map(([chave, titulo, descricao]) => (
            <button
              key={chave}
              type="button"
              onClick={() => void trocarAbaPrincipal(chave)}
              className={`rounded-lg px-4 py-3 text-left transition ${abaPrincipal === chave ? "bg-xango-primary text-white" : "text-slate-700 hover:bg-slate-50"}`}
            >
              <span className="block text-sm font-semibold">{titulo}</span>
              <span className={`mt-0.5 block text-xs ${abaPrincipal === chave ? "text-white/80" : "text-slate-500"}`}>{descricao}</span>
            </button>
          ))}
        </div>
      </div>

      {abaPrincipal === "PRODUCAO" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
            <div className="flex gap-6">
              <button
                type="button"
                onClick={() => trocarAbaProducao("CLINICAS")}
                className={`border-b-2 px-1 pb-3 text-sm font-semibold ${abaProducao === "CLINICAS" ? "border-xango-primary text-xango-primary" : "border-transparent text-slate-500"}`}
              >
                Produção por clínica
              </button>
              <button
                type="button"
                onClick={() => trocarAbaProducao("PROCEDIMENTOS")}
                className={`border-b-2 px-1 pb-3 text-sm font-semibold ${abaProducao === "PROCEDIMENTOS" ? "border-xango-primary text-xango-primary" : "border-transparent text-slate-500"}`}
              >
                Produção por procedimento
              </button>
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              <button type="button" onClick={exportarCsvProducao} disabled={!dadosProducao || carregandoProducao} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <FileSpreadsheet size={16} /> Exportar CSV
              </button>
              <button type="button" onClick={imprimirPdfProducao} disabled={!dadosProducao || carregandoProducao} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <Download size={16} /> Imprimir / PDF
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-12">
              <label className="lg:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Realizado de</span>
                <input type="date" value={filtrosProducao.inicio} onChange={(e) => setFiltrosProducao((atual) => ({ ...atual, inicio: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary" />
              </label>
              <label className="lg:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Até</span>
                <input type="date" value={filtrosProducao.fim} onChange={(e) => setFiltrosProducao((atual) => ({ ...atual, fim: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary" />
              </label>
              <label className="lg:col-span-4">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Clínica</span>
                <select value={filtrosProducao.clinicaId} onChange={(e) => setFiltrosProducao((atual) => ({ ...atual, clinicaId: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary">
                  <option value="">Todas as clínicas</option>
                  {(dadosProducao?.opcoes.clinicas || dados?.opcoes.clinicas || []).map((clinica) => <option key={clinica.id} value={clinica.id}>{clinica.nome}</option>)}
                </select>
              </label>
              <label className="lg:col-span-4">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Procedimento</span>
                <select value={filtrosProducao.procedimentoId} onChange={(e) => setFiltrosProducao((atual) => ({ ...atual, procedimentoId: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary">
                  <option value="">Todos os procedimentos</option>
                  {(dadosProducao?.opcoes.procedimentos || []).map((procedimento) => <option key={procedimento.id} value={procedimento.id}>{procedimento.nome}</option>)}
                </select>
              </label>

              <label className="lg:col-span-9">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Busca</span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input value={filtrosProducao.busca} onChange={(e) => setFiltrosProducao((atual) => ({ ...atual, busca: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") void aplicarFiltrosProducao(); }} placeholder="Clínica, procedimento, paciente, CPF, atendimento ou voucher..." className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-xango-primary" />
                </div>
              </label>
              <div className="flex items-end gap-2 lg:col-span-3">
                <button type="button" onClick={() => void aplicarFiltrosProducao()} disabled={carregandoProducao} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-xango-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-xango-primary-hover disabled:opacity-60">
                  <RefreshCw size={16} className={carregandoProducao ? "animate-spin" : ""} /> Aplicar
                </button>
                <button type="button" onClick={() => void limparFiltrosProducao()} disabled={carregandoProducao} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Limpar</button>
              </div>
            </div>
          </div>

          {erroProducao && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erroProducao}</div>}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <CardResumo
              titulo={abaProducao === "CLINICAS" ? "Clínicas com produção" : "Procedimentos realizados"}
              valor={String(abaProducao === "CLINICAS" ? dadosProducao?.resumo.clinicas || 0 : dadosProducao?.resumo.procedimentos || 0)}
              detalhe={`${dadosProducao?.resumo.pacientes || 0} paciente(s) no período`}
              icone={<Stethoscope size={20} />}
            />
            <CardResumo
              titulo="Produção realizada"
              valor={String(dadosProducao?.resumo.quantidadeRealizada || 0)}
              detalhe={`${dadosProducao?.resumo.guias || 0} guia(s) • ${dadosProducao?.resumo.atendimentos || 0} atendimento(s)`}
              icone={<ClipboardList size={20} />}
            />
            <CardResumo
              titulo="Valor paciente"
              valor={moeda(dadosProducao?.resumo.valorPaciente || 0)}
              detalhe="soma dos procedimentos realizados"
              icone={<CircleDollarSign size={20} />}
            />
            <CardResumo
              titulo="Diferença operacional"
              valor={moeda(dadosProducao?.resumo.diferenca || 0)}
              detalhe={`${moeda(dadosProducao?.resumo.valorRepasse || 0)} de repasse • ${percentual(dadosProducao?.resumo.margemPercentual || 0)}`}
              icone={<Activity size={20} />}
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">{abaProducao === "CLINICAS" ? "Produção por clínica" : "Produção por procedimento"}</h2>
                <p className="mt-0.5 text-xs text-slate-500">Somente procedimentos marcados como realizados no período. Clique em uma linha para abrir o detalhamento.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{itensProducaoAtivos.length} registro(s)</span>
            </div>

            {carregandoProducao ? (
              <div className="px-6 py-16 text-center text-sm text-slate-500">Carregando relatório de produção...</div>
            ) : abaProducao === "CLINICAS" ? (
              clinicasProducaoPagina.length === 0 ? <Vazio /> : (
                <div className="w-full overflow-hidden">
                  <table className="w-full table-fixed text-left">
                    <colgroup>
                      <col className="w-[24%]" />
                      <col className="w-[10%]" />
                      <col className="w-[9%]" />
                      <col className="w-[11%]" />
                      <col className="w-[13%]" />
                      <col className="w-[12%]" />
                      <col className="w-[13%]" />
                      <col className="w-[8%]" />
                    </colgroup>
                    <thead className="bg-slate-50"><tr>
                      <Th>Clínica</Th><Th>Atend.</Th><Th>Guias</Th><Th>Realizados</Th><Th>Valor paciente</Th><Th>Repasse</Th><Th>Diferença</Th><Th>Margem</Th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {clinicasProducaoPagina.map((item) => (
                        <tr key={item.id} onClick={() => setClinicaProducaoSelecionada(item)} className="cursor-pointer align-top transition hover:bg-slate-50">
                          <Td><p className="break-words font-semibold text-xango-primary">{item.nome}</p><p className="mt-1 text-[11px] text-slate-500">{item.quantidadePacientes} paciente(s)</p></Td>
                          <Td className="text-center tabular-nums">{item.quantidadeAtendimentos}</Td>
                          <Td className="text-center tabular-nums">{item.quantidadeGuias}</Td>
                          <Td className="text-center font-semibold tabular-nums">{item.quantidadeProcedimentos}</Td>
                          <Td className="whitespace-nowrap text-xs font-semibold tabular-nums">{moeda(item.valorPaciente)}</Td>
                          <Td className="whitespace-nowrap text-xs tabular-nums">{moeda(item.valorRepasse)}</Td>
                          <Td className={`whitespace-nowrap text-xs font-semibold tabular-nums ${item.diferenca >= 0 ? "text-emerald-700" : "text-red-700"}`}>{moeda(item.diferenca)}</Td>
                          <Td className="whitespace-nowrap text-xs font-semibold tabular-nums">{percentual(item.margemPercentual)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : procedimentosProducaoPagina.length === 0 ? <Vazio /> : (
              <div className="w-full overflow-hidden">
                <table className="w-full table-fixed text-left">
                  <colgroup>
                    <col className="w-[25%]" />
                    <col className="w-[13%]" />
                    <col className="w-[8%]" />
                    <col className="w-[9%]" />
                    <col className="w-[13%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[8%]" />
                  </colgroup>
                  <thead className="bg-slate-50"><tr>
                    <Th>Procedimento</Th><Th>Categoria</Th><Th>Clínicas</Th><Th>Realizados</Th><Th>Valor paciente</Th><Th>Repasse</Th><Th>Diferença</Th><Th>Margem</Th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {procedimentosProducaoPagina.map((item) => (
                      <tr key={item.id} onClick={() => setProcedimentoProducaoSelecionado(item)} className="cursor-pointer align-top transition hover:bg-slate-50">
                        <Td><p className="break-words font-semibold text-xango-primary">{item.nome}</p><p className="mt-1 text-[11px] text-slate-500">{item.quantidadePacientes} paciente(s) • {item.quantidadeGuias} guia(s)</p></Td>
                        <Td><span className="break-words text-xs">{item.categoria || "-"}</span></Td>
                        <Td className="text-center tabular-nums">{item.quantidadeClinicas}</Td>
                        <Td className="text-center font-semibold tabular-nums">{item.quantidade}</Td>
                        <Td className="whitespace-nowrap text-xs font-semibold tabular-nums">{moeda(item.valorPaciente)}</Td>
                        <Td className="whitespace-nowrap text-xs tabular-nums">{moeda(item.valorRepasse)}</Td>
                        <Td className={`whitespace-nowrap text-xs font-semibold tabular-nums ${item.diferenca >= 0 ? "text-emerald-700" : "text-red-700"}`}>{moeda(item.diferenca)}</Td>
                        <Td className="whitespace-nowrap text-xs font-semibold tabular-nums">{percentual(item.margemPercentual)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!carregandoProducao && itensProducaoAtivos.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
                <p className="text-xs text-slate-500">Página {paginaProducao} de {totalPaginasProducao} • {itensProducaoAtivos.length} registro(s)</p>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={paginaProducao <= 1} onClick={() => setPaginaProducao((p) => Math.max(1, p - 1))} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={17} /></button>
                  <button type="button" disabled={paginaProducao >= totalPaginasProducao} onClick={() => setPaginaProducao((p) => Math.min(totalPaginasProducao, p + 1))} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={17} /></button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : abaPrincipal === "FINANCEIROS" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
            <div className="flex gap-6">
              <button
                type="button"
                onClick={() => trocarAbaFinanceira("MOVIMENTACOES")}
                className={`border-b-2 px-1 pb-3 text-sm font-semibold ${abaFinanceira === "MOVIMENTACOES" ? "border-xango-primary text-xango-primary" : "border-transparent text-slate-500"}`}
              >
                Recebimentos e Estornos
              </button>
              <button
                type="button"
                onClick={() => trocarAbaFinanceira("REPASSES")}
                className={`border-b-2 px-1 pb-3 text-sm font-semibold ${abaFinanceira === "REPASSES" ? "border-xango-primary text-xango-primary" : "border-transparent text-slate-500"}`}
              >
                Repasses às clínicas
              </button>
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              <button type="button" onClick={exportarCsvFinanceiro} disabled={!dadosFinanceiros || carregandoFinanceiro} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <FileSpreadsheet size={16} /> Exportar CSV
              </button>
              <button type="button" onClick={imprimirPdfFinanceiro} disabled={!dadosFinanceiros || carregandoFinanceiro} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <Download size={16} /> Imprimir / PDF
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-12">
              <label className="lg:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-600">De</span>
                <input type="date" value={filtrosFinanceiros.inicio} onChange={(e) => setFiltrosFinanceiros((atual) => ({ ...atual, inicio: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary" />
              </label>
              <label className="lg:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Até</span>
                <input type="date" value={filtrosFinanceiros.fim} onChange={(e) => setFiltrosFinanceiros((atual) => ({ ...atual, fim: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary" />
              </label>
              <label className="lg:col-span-3">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Clínica</span>
                <select value={filtrosFinanceiros.clinicaId} onChange={(e) => setFiltrosFinanceiros((atual) => ({ ...atual, clinicaId: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary">
                  <option value="">Todas as clínicas</option>
                  {(dadosFinanceiros?.opcoes.clinicas || dados?.opcoes.clinicas || []).map((clinica) => <option key={clinica.id} value={clinica.id}>{clinica.nome}</option>)}
                </select>
              </label>

              {abaFinanceira === "MOVIMENTACOES" ? (
                <>
                  <label className="lg:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Tipo</span>
                    <select value={filtrosFinanceiros.tipoMovimentacao} onChange={(e) => setFiltrosFinanceiros((atual) => ({ ...atual, tipoMovimentacao: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary">
                      <option value="TODOS">Todos</option><option value="RECEBIMENTO">Recebimentos</option><option value="ESTORNO">Estornos</option>
                    </select>
                  </label>
                  <label className="lg:col-span-3">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Forma de pagamento</span>
                    <select value={filtrosFinanceiros.formaPagamento} onChange={(e) => setFiltrosFinanceiros((atual) => ({ ...atual, formaPagamento: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary">
                      {FORMAS_RECEBIMENTO.map(([codigo, label]) => <option key={codigo} value={codigo}>{label}</option>)}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label className="lg:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Período por</span>
                    <select value={filtrosFinanceiros.dataRepasse} onChange={(e) => setFiltrosFinanceiros((atual) => ({ ...atual, dataRepasse: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary">
                      <option value="SOLICITACAO">Solicitação</option><option value="PAGAMENTO_SOLICITADO">Data solicitada</option><option value="PAGAMENTO_EFETIVO">Pagamento efetivo</option>
                    </select>
                  </label>
                  <label className="lg:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Status</span>
                    <select value={filtrosFinanceiros.statusRepasse} onChange={(e) => setFiltrosFinanceiros((atual) => ({ ...atual, statusRepasse: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary">
                      <option value="TODOS">Todos</option><option value="SOLICITADO">Solicitado</option><option value="EM_ANALISE">Em análise</option><option value="APROVADO">Aprovado</option><option value="PAGO">Pago</option><option value="RECUSADO">Recusado</option>
                    </select>
                  </label>
                  <label className="lg:col-span-1">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Forma</span>
                    <select value={filtrosFinanceiros.formaRepasse} onChange={(e) => setFiltrosFinanceiros((atual) => ({ ...atual, formaRepasse: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-2 py-2.5 text-sm outline-none focus:border-xango-primary">
                      {FORMAS_REPASSE.map(([codigo, label]) => <option key={codigo} value={codigo}>{label}</option>)}
                    </select>
                  </label>
                </>
              )}

              <label className="lg:col-span-9">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Busca</span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input value={filtrosFinanceiros.busca} onChange={(e) => setFiltrosFinanceiros((atual) => ({ ...atual, busca: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") void aplicarFiltrosFinanceiros(); }} placeholder={abaFinanceira === "MOVIMENTACOES" ? "Paciente, CPF, voucher, atendimento, clínica ou observação..." : "Repasse, clínica, paciente, CPF ou voucher..."} className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-xango-primary" />
                </div>
              </label>
              <div className="flex items-end gap-2 lg:col-span-3">
                <button type="button" onClick={() => void aplicarFiltrosFinanceiros()} disabled={carregandoFinanceiro} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-xango-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-xango-primary-hover disabled:opacity-60">
                  <RefreshCw size={16} className={carregandoFinanceiro ? "animate-spin" : ""} /> Aplicar
                </button>
                <button type="button" onClick={() => void limparFiltrosFinanceiros()} disabled={carregandoFinanceiro} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Limpar</button>
              </div>
            </div>
          </div>

          {erroFinanceiro && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erroFinanceiro}</div>}

          {abaFinanceira === "MOVIMENTACOES" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <CardResumo titulo="Recebido bruto" valor={moeda(dadosFinanceiros?.resumo.movimentacoes.recebidoBruto || 0)} detalhe={`${dadosFinanceiros?.resumo.movimentacoes.quantidadeRecebimentos || 0} recebimento(s)`} icone={<CircleDollarSign size={20} />} />
              <CardResumo titulo="Estornos" valor={moeda(dadosFinanceiros?.resumo.movimentacoes.estornos || 0)} detalhe={`${dadosFinanceiros?.resumo.movimentacoes.quantidadeEstornos || 0} estorno(s)`} icone={<XCircle size={20} />} />
              <CardResumo titulo="Recebido líquido" valor={moeda(dadosFinanceiros?.resumo.movimentacoes.recebidoLiquido || 0)} detalhe="recebimentos menos estornos" icone={<CheckCircle2 size={20} />} />
              <CardResumo titulo="Movimentações" valor={String(dadosFinanceiros?.resumo.movimentacoes.total || 0)} detalhe="no período filtrado" icone={<Activity size={20} />} />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <CardResumo titulo="Repasses" valor={moeda(dadosFinanceiros?.resumo.repasses.valorTotal || 0)} detalhe={`${dadosFinanceiros?.resumo.repasses.total || 0} registro(s)`} icone={<CircleDollarSign size={20} />} />
              <CardResumo titulo="Pendentes" valor={moeda(dadosFinanceiros?.resumo.repasses.valorPendente || 0)} detalhe={`${dadosFinanceiros?.resumo.repasses.pendentes || 0} aguardando conclusão`} icone={<CalendarDays size={20} />} />
              <CardResumo titulo="Pagos" valor={moeda(dadosFinanceiros?.resumo.repasses.valorPago || 0)} detalhe={`${dadosFinanceiros?.resumo.repasses.pagos || 0} repasse(s) pago(s)`} icone={<CheckCircle2 size={20} />} />
              <CardResumo titulo="Documentação 100%" valor={String(dadosFinanceiros?.resumo.repasses.documentacaoCompleta || 0)} detalhe={`${dadosFinanceiros?.resumo.repasses.recusados || 0} recusado(s) no filtro`} icone={<FileText size={20} />} />
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">{abaFinanceira === "MOVIMENTACOES" ? "Recebimentos e estornos do período" : "Repasses às clínicas"}</h2>
                <p className="mt-1 text-xs text-slate-500">Clique em uma linha para visualizar os detalhes antes de abrir o registro relacionado.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{itensFinanceirosAtivos.length} registro(s)</span>
            </div>

            {carregandoFinanceiro ? (
              <div className="px-6 py-16 text-center text-sm text-slate-500">Carregando relatório financeiro...</div>
            ) : abaFinanceira === "MOVIMENTACOES" ? (
              movimentacoesPagina.length === 0 ? <Vazio /> : (
                <div className="w-full overflow-hidden">
                  <table className="w-full table-fixed text-left">
                    <colgroup>
                      <col className="w-[13%]" /><col className="w-[11%]" /><col className="w-[20%]" /><col className="w-[14%]" /><col className="w-[18%]" /><col className="w-[13%]" /><col className="w-[11%]" />
                    </colgroup>
                    <thead className="bg-slate-50"><tr><Th>Data</Th><Th>Tipo</Th><Th>Paciente</Th><Th>Voucher</Th><Th>Clínica</Th><Th>Forma</Th><Th>Valor</Th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {movimentacoesPagina.map((item) => (
                        <tr key={item.id} onClick={() => setMovimentacaoSelecionada(item)} className="cursor-pointer align-top transition hover:bg-slate-50">
                          <Td><span className="text-xs">{dataBr(item.data, true)}</span></Td>
                          <Td><span className={`inline-flex max-w-full whitespace-normal rounded-full px-2 py-1 text-[11px] font-semibold leading-tight ${classeStatus(item.tipo)}`}>{statusLabel(item.tipo)}</span></Td>
                          <Td><p className="break-words font-semibold text-slate-800">{item.paciente}</p><p className="mt-1 text-[11px] text-slate-500">{cpfBr(item.cpf)}</p></Td>
                          <Td><p className="break-words font-semibold text-xango-primary">{item.codigoVoucher || `#${item.guiaId}`}</p><p className="mt-1 break-words text-[11px] text-slate-500">{item.codigoAtendimento || `ATD #${item.atendimentoId}`}</p></Td>
                          <Td><span className="break-words">{item.clinica}</span></Td>
                          <Td><span className="break-words text-xs">{item.formaLabel}</span></Td>
                          <Td className={`break-words font-semibold ${item.tipo === "ESTORNO" ? "text-red-700" : "text-emerald-700"}`}>{item.tipo === "ESTORNO" ? "- " : ""}{moeda(item.valor)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : repassesPagina.length === 0 ? <Vazio /> : (
              <div className="w-full overflow-hidden">
                <table className="w-full table-fixed text-left">
                  <colgroup>
                    <col className="w-[14%]" />
                    <col className="w-[14%]" />
                    <col className="w-[22%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[11%]" />
                    <col className="w-[7%]" />
                    <col className="w-[8%]" />
                    <col className="w-[4%]" />
                  </colgroup>
                  <thead className="bg-slate-50">
                    <tr>
                      <Th>Repasse</Th>
                      <Th>Clínica</Th>
                      <Th>Guias / Pacientes</Th>
                      <Th>Status</Th>
                      <Th>Solicitado</Th>
                      <Th>Pagamento</Th>
                      <Th>Forma</Th>
                      <Th>Valor</Th>
                      <Th>Docs</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {repassesPagina.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setRepasseSelecionado(item)}
                        className="cursor-pointer align-middle transition hover:bg-slate-50"
                      >
                        <Td>
                          <p className="break-words font-semibold leading-tight text-xango-primary">
                            {item.codigoPublico}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {item.quantidadeGuias} guia(s)
                          </p>
                        </Td>
                        <Td>
                          <span className="break-words font-medium leading-tight text-slate-800">
                            {item.clinica}
                          </span>
                        </Td>
                        <Td>
                          <div className="space-y-1">
                            {item.itens.slice(0, 2).map((guia) => (
                              <p key={guia.id} className="break-words text-xs leading-tight">
                                {guia.paciente} • {guia.codigoVoucher || `#${guia.guiaId}`}
                              </p>
                            ))}
                            {item.itens.length > 2 && (
                              <p className="text-[11px] text-slate-500">
                                + {item.itens.length - 2} guia(s)
                              </p>
                            )}
                          </div>
                        </Td>
                        <Td>
                          <span
                            className={`inline-flex max-w-full whitespace-normal rounded-full px-2 py-1 text-[11px] font-semibold leading-tight ${classeStatus(item.status)}`}
                          >
                            {item.statusLabel}
                          </span>
                        </Td>
                        <Td>
                          <span className="whitespace-nowrap text-xs">
                            {dataBr(item.solicitadoEm)}
                          </span>
                        </Td>
                        <Td>
                          <p className="whitespace-nowrap text-xs">
                            {dataBr(item.dataPagamentoEfetivo || item.dataPagamentoSolicitada)}
                          </p>
                          {item.dataPagamentoEfetivo && (
                            <p className="mt-1 text-[10px] text-slate-500">Efetivo</p>
                          )}
                        </Td>
                        <Td>
                          <span className="break-words text-xs">
                            {item.formaPagamentoLabel || "-"}
                          </span>
                        </Td>
                        <Td className="whitespace-nowrap text-xs font-semibold tabular-nums">
                          {moeda(item.valorTotal)}
                        </Td>
                        <Td>
                          <span
                            className={`whitespace-nowrap text-xs font-semibold ${
                              item.percentualDocumentacao === 100
                                ? "text-emerald-700"
                                : item.percentualDocumentacao === null
                                  ? "text-slate-400"
                                  : "text-amber-700"
                            }`}
                          >
                            {item.percentualDocumentacao === null
                              ? "-"
                              : `${item.percentualDocumentacao}%`}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!carregandoFinanceiro && itensFinanceirosAtivos.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
                <p className="text-xs text-slate-500">Página {paginaFinanceira} de {totalPaginasFinanceiras} • {itensFinanceirosAtivos.length} registro(s)</p>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={paginaFinanceira <= 1} onClick={() => setPaginaFinanceira((p) => Math.max(1, p - 1))} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={17} /></button>
                  <button type="button" disabled={paginaFinanceira >= totalPaginasFinanceiras} onClick={() => setPaginaFinanceira((p) => Math.min(totalPaginasFinanceiras, p + 1))} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={17} /></button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
            <div className="flex gap-6">
              <button
                type="button"
                onClick={() => trocarAbaOperacional("ATENDIMENTOS")}
                className={`border-b-2 px-1 pb-3 text-sm font-semibold ${abaOperacional === "ATENDIMENTOS" ? "border-xango-primary text-xango-primary" : "border-transparent text-slate-500"}`}
              >
                Atendimentos
              </button>
              <button
                type="button"
                onClick={() => trocarAbaOperacional("GUIAS")}
                className={`border-b-2 px-1 pb-3 text-sm font-semibold ${abaOperacional === "GUIAS" ? "border-xango-primary text-xango-primary" : "border-transparent text-slate-500"}`}
              >
                Guias / Vouchers
              </button>
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              <button type="button" onClick={exportarCsv} disabled={!dados || carregando} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <FileSpreadsheet size={16} /> Exportar CSV
              </button>
              <button type="button" onClick={imprimirPdf} disabled={!dados || carregando} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <Download size={16} /> Imprimir / PDF
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-12">
              <label className="lg:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-600">De</span>
                <input type="date" value={filtros.inicio} onChange={(e) => setFiltros((atual) => ({ ...atual, inicio: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary" />
              </label>
              <label className="lg:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Até</span>
                <input type="date" value={filtros.fim} onChange={(e) => setFiltros((atual) => ({ ...atual, fim: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary" />
              </label>
              <label className="lg:col-span-3">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Clínica</span>
                <select value={filtros.clinicaId} onChange={(e) => setFiltros((atual) => ({ ...atual, clinicaId: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary">
                  <option value="">Todas as clínicas</option>
                  {(dados?.opcoes.clinicas || []).map((clinica) => <option key={clinica.id} value={clinica.id}>{clinica.nome}</option>)}
                </select>
              </label>
              <label className="lg:col-span-3">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Atendente</span>
                <select value={filtros.atendenteId} onChange={(e) => setFiltros((atual) => ({ ...atual, atendenteId: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary">
                  <option value="">Todos os atendentes</option>
                  {(dados?.opcoes.atendentes || []).map((atendente) => <option key={atendente.id} value={atendente.id}>{atendente.nome}</option>)}
                </select>
              </label>
              <label className="lg:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-600">{abaOperacional === "ATENDIMENTOS" ? "Status" : "Financeiro"}</span>
                {abaOperacional === "ATENDIMENTOS" ? (
                  <select value={filtros.statusAtendimento} onChange={(e) => setFiltros((atual) => ({ ...atual, statusAtendimento: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary">
                    <option value="TODOS">Todos</option><option value="EM_ANDAMENTO">Em andamento</option><option value="AGUARDANDO_PAGAMENTO">Aguardando pagamento</option><option value="PARCIALMENTE_PAGO">Parcialmente pago</option><option value="CONCLUIDO">Concluído</option><option value="CANCELADO">Cancelado</option>
                  </select>
                ) : (
                  <select value={filtros.statusGuia} onChange={(e) => setFiltros((atual) => ({ ...atual, statusGuia: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary">
                    <option value="TODOS">Todos</option><option value="AGUARDANDO_PAGAMENTO">Aguardando pagamento</option><option value="PARCIALMENTE_PAGA">Parcialmente paga</option><option value="PAGA">Paga</option><option value="ESTORNO_PENDENTE">Estorno pendente</option><option value="CANCELADA">Cancelada</option>
                  </select>
                )}
              </label>

              {abaOperacional === "GUIAS" && (
                <>
                  <label className="lg:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Período por</span>
                    <select value={filtros.dataGuia} onChange={(e) => setFiltros((atual) => ({ ...atual, dataGuia: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary">
                      <option value="CRIACAO">Criação da guia</option><option value="AGENDAMENTO">Agendamento</option>
                    </select>
                  </label>
                  <label className="lg:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Realização</span>
                    <select value={filtros.statusRealizacao} onChange={(e) => setFiltros((atual) => ({ ...atual, statusRealizacao: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-xango-primary">
                      <option value="TODOS">Todos</option><option value="AGUARDANDO">Aguardando</option><option value="PARCIAL">Parcial</option><option value="REALIZADO">Realizado</option><option value="CANCELADO">Cancelado</option>
                    </select>
                  </label>
                </>
              )}

              <label className={abaOperacional === "GUIAS" ? "lg:col-span-5" : "lg:col-span-8"}>
                <span className="mb-1 block text-xs font-semibold text-slate-600">Busca</span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input value={filtros.busca} onChange={(e) => setFiltros((atual) => ({ ...atual, busca: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") void aplicarFiltros(); }} placeholder="Paciente, CPF, atendimento, voucher, clínica ou procedimento..." className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-xango-primary" />
                </div>
              </label>
              <div className="flex items-end gap-2 lg:col-span-3">
                <button type="button" onClick={() => void aplicarFiltros()} disabled={carregando} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-xango-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-xango-primary-hover disabled:opacity-60">
                  <RefreshCw size={16} className={carregando ? "animate-spin" : ""} /> Aplicar
                </button>
                <button type="button" onClick={limparFiltros} disabled={carregando} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Limpar</button>
              </div>
            </div>
          </div>

          {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

          {abaOperacional === "ATENDIMENTOS" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CardResumo titulo="Atendimentos" valor={String(resumoAtd?.total || 0)} detalhe="no período filtrado" icone={<ClipboardList size={20} />} />
              <CardResumo titulo="Em andamento" valor={String(resumoAtd?.emAndamento || 0)} detalhe="ainda exigem acompanhamento" icone={<Activity size={20} />} />
              <CardResumo titulo="Concluídos" valor={String(resumoAtd?.concluidos || 0)} detalhe={`${resumoAtd?.cancelados || 0} cancelado(s)`} icone={<CheckCircle2 size={20} />} />
              <CardResumo titulo="Saldo das guias" valor={moeda(resumoAtd?.saldo || 0)} detalhe={`${moeda(resumoAtd?.recebidoLiquido || 0)} recebido líquido`} icone={<CircleDollarSign size={20} />} />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CardResumo titulo="Guias / Vouchers" valor={String(resumoGuias?.total || 0)} detalhe="no período filtrado" icone={<FileText size={20} />} />
              <CardResumo titulo="Realizadas" valor={String(resumoGuias?.realizadas || 0)} detalhe={`${resumoGuias?.aguardandoRealizacao || 0} aguardando realização`} icone={<Stethoscope size={20} />} />
              <CardResumo titulo="Valor cobrado" valor={moeda(resumoGuias?.valorCobrado || 0)} detalhe={`${moeda(resumoGuias?.recebidoLiquido || 0)} recebido líquido`} icone={<CircleDollarSign size={20} />} />
              <CardResumo titulo="Repasse previsto" valor={moeda(resumoGuias?.repassePrevisto || 0)} detalhe={`${moeda(resumoGuias?.saldo || 0)} ainda a receber`} icone={<CalendarDays size={20} />} />
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">{abaOperacional === "ATENDIMENTOS" ? "Atendimentos do período" : "Guias / vouchers do período"}</h2>
                <p className="mt-0.5 text-xs text-slate-500">Clique em uma linha para visualizar um resumo antes de abrir o registro.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{itensAtivos.length} registro(s)</span>
            </div>

            {carregando ? (
              <div className="px-6 py-16 text-center text-sm text-slate-500">Carregando relatório...</div>
            ) : abaOperacional === "ATENDIMENTOS" ? (
              atendimentosPagina.length === 0 ? <Vazio /> : (
                <div className="w-full overflow-hidden">
                  <table className="w-full table-fixed text-left">
                    <colgroup>
                      <col className="w-[15%]" />
                      <col className="w-[22%]" />
                      <col className="w-[14%]" />
                      <col className="w-[13%]" />
                      <col className="w-[6%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead className="bg-slate-50"><tr>
                      <Th>Atendimento</Th><Th>Paciente</Th><Th>Atendente</Th><Th>Status</Th><Th>Guias</Th><Th>Valor</Th><Th>Recebido</Th><Th>Saldo</Th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {atendimentosPagina.map((item) => (
                        <tr key={item.id} onClick={() => setAtendimentoSelecionado(item)} className="cursor-pointer align-top transition hover:bg-slate-50">
                          <Td><p className="break-words font-semibold text-xango-primary">{item.codigoPublico || `#${item.id}`}</p><p className="mt-1 text-[11px] leading-tight text-slate-500">{dataBr(item.criadoEm, true)}</p></Td>
                          <Td><p className="break-words font-semibold text-slate-800">{item.paciente.nome}</p><p className="mt-1 text-[11px] text-slate-500">{cpfBr(item.paciente.cpf)}</p></Td>
                          <Td><span className="break-words">{item.atendente?.nome || "-"}</span></Td>
                          <Td><span className={`inline-flex max-w-full whitespace-normal rounded-full px-2 py-1 text-[11px] font-semibold leading-tight ${classeStatus(item.status)}`}>{statusLabel(item.status)}</span></Td>
                          <Td className="text-center">{item.quantidadeGuias}</Td><Td className="break-words font-semibold">{moeda(item.valorGuias)}</Td><Td className="break-words">{moeda(item.recebidoLiquido)}</Td><Td className={`${item.saldo > 0.009 ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"} break-words`}>{moeda(item.saldo)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : guiasPagina.length === 0 ? <Vazio /> : (
              <div className="w-full overflow-hidden">
                <table className="w-full table-fixed text-left">
                  <colgroup>
                    <col className="w-[12%]" />
                    <col className="w-[16%]" />
                    <col className="w-[13%]" />
                    <col className="w-[17%]" />
                    <col className="w-[9%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[7%]" />
                    <col className="w-[6%]" />
                  </colgroup>
                  <thead className="bg-slate-50"><tr>
                    <Th>Voucher</Th><Th>Paciente</Th><Th>Clínica / Unidade</Th><Th>Procedimento(s)</Th><Th>Agendamento</Th><Th>Financeiro</Th><Th>Realização</Th><Th>Valor</Th><Th>Saldo</Th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {guiasPagina.map((item) => (
                      <tr key={item.id} onClick={() => setGuiaSelecionada(item)} className="cursor-pointer align-top transition hover:bg-slate-50">
                        <Td><p className="break-words font-semibold text-xango-primary">{item.codigoPublico || `#${item.id}`}</p><p className="mt-1 break-words text-[11px] leading-tight text-slate-500">{item.codigoAtendimento || `ATD #${item.atendimentoId}`}</p></Td>
                        <Td><p className="break-words font-semibold text-slate-800">{item.paciente.nome}</p><p className="mt-1 text-[11px] text-slate-500">{cpfBr(item.paciente.cpf)}</p></Td>
                        <Td><p className="break-words font-medium text-slate-800">{item.clinica.nome}</p><p className="mt-1 break-words text-[11px] leading-tight text-slate-500">{item.unidade?.nome || "Sem unidade"}</p></Td>
                        <Td><div className="space-y-1">{item.procedimentos.slice(0, 2).map((p) => <p key={p.id} className="break-words text-xs leading-tight">{p.nome}</p>)}{item.procedimentos.length > 2 && <p className="text-[11px] text-slate-500">+ {item.procedimentos.length - 2} procedimento(s)</p>}</div></Td>
                        <Td><span className="text-xs">{dataBr(item.dataAgendamento || item.criadoEm)}</span></Td>
                        <Td><span className={`inline-flex max-w-full whitespace-normal rounded-full px-2 py-1 text-[11px] font-semibold leading-tight ${classeStatus(item.status)}`}>{statusLabel(item.status)}</span></Td>
                        <Td><span className={`inline-flex max-w-full whitespace-normal rounded-full px-2 py-1 text-[11px] font-semibold leading-tight ${classeStatus(item.realizacao)}`}>{statusLabel(item.realizacao)}</span></Td>
                        <Td className="break-words text-xs font-semibold">{moeda(item.valorFinal)}</Td><Td className={`${item.saldo > 0.009 ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"} break-words text-xs`}>{moeda(item.saldo)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!carregando && itensAtivos.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
                <p className="text-xs text-slate-500">Página {pagina} de {totalPaginas} • {itensAtivos.length} registro(s)</p>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={17} /></button>
                  <button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={17} /></button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {atendimentoSelecionado && (
        <>
          <button
            type="button"
            aria-label="Fechar resumo do atendimento"
            onClick={() => setAtendimentoSelecionado(null)}
            className="fixed inset-0 z-40 bg-black/25"
          />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo do atendimento</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{atendimentoSelecionado.codigoPublico || `Atendimento #${atendimentoSelecionado.id}`}</h3>
                <p className="mt-1 text-sm text-slate-500">{dataBr(atendimentoSelecionado.criadoEm, true)}</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setAtendimentoSelecionado(null)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <section className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paciente</p>
                    <p className="mt-1 font-semibold text-slate-900">{atendimentoSelecionado.paciente.nome}</p>
                    <p className="mt-1 text-sm text-slate-500">CPF {cpfBr(atendimentoSelecionado.paciente.cpf)}</p>
                    <p className="mt-1 text-sm text-slate-500">{atendimentoSelecionado.paciente.telefone || "Telefone não informado"}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classeStatus(atendimentoSelecionado.status)}`}>{statusLabel(atendimentoSelecionado.status)}</span>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <InfoResumo titulo="Atendente" valor={atendimentoSelecionado.atendente?.nome || "-"} />
                <InfoResumo titulo="Guias" valor={String(atendimentoSelecionado.quantidadeGuias)} detalhe={`${atendimentoSelecionado.quantidadeGuiasAtivas} ativa(s)`} />
                <InfoResumo titulo="Valor das guias" valor={moeda(atendimentoSelecionado.valorGuias)} />
                <InfoResumo titulo="Recebido líquido" valor={moeda(atendimentoSelecionado.recebidoLiquido)} />
                <InfoResumo titulo="Saldo" valor={moeda(atendimentoSelecionado.saldo)} destaque={atendimentoSelecionado.saldo > 0.009} />
                <InfoResumo titulo="Última atualização" valor={dataBr(atendimentoSelecionado.atualizadoEm, true)} />
              </section>

              {atendimentoSelecionado.motivoCancelamento && (
                <section className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Motivo do cancelamento</p>
                  <p className="mt-2 text-sm text-red-800">{atendimentoSelecionado.motivoCancelamento}</p>
                </section>
              )}

              <button
                type="button"
                onClick={() => router.push(`/atendimentos/${atendimentoSelecionado.id}?modo=revisao`)}
                className="w-full rounded-lg bg-xango-primary px-4 py-3 text-sm font-semibold text-white hover:bg-xango-primary-hover"
              >
                Abrir atendimento
              </button>
            </div>
          </aside>
        </>
      )}

      {guiaSelecionada && (
        <>
          <button
            type="button"
            aria-label="Fechar resumo da guia"
            onClick={() => setGuiaSelecionada(null)}
            className="fixed inset-0 z-40 bg-black/25"
          />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo da guia / voucher</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{guiaSelecionada.codigoPublico || `Guia #${guiaSelecionada.id}`}</h3>
                <p className="mt-1 text-sm text-slate-500">{guiaSelecionada.codigoAtendimento || `Atendimento #${guiaSelecionada.atendimentoId}`}</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setGuiaSelecionada(null)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <section className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paciente</p>
                <p className="mt-1 font-semibold text-slate-900">{guiaSelecionada.paciente.nome}</p>
                <p className="mt-1 text-sm text-slate-500">CPF {cpfBr(guiaSelecionada.paciente.cpf)}</p>
                <p className="mt-1 text-sm text-slate-500">{guiaSelecionada.paciente.telefone || "Telefone não informado"}</p>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <InfoResumo titulo="Clínica" valor={guiaSelecionada.clinica.nome} detalhe={guiaSelecionada.unidade?.nome || "Sem unidade"} />
                <InfoResumo titulo="Agendamento" valor={dataBr(guiaSelecionada.dataAgendamento || guiaSelecionada.criadoEm)} />
                <InfoResumo titulo="Financeiro" valor={statusLabel(guiaSelecionada.status)} />
                <InfoResumo titulo="Realização" valor={statusLabel(guiaSelecionada.realizacao)} />
                <InfoResumo titulo="Valor da guia" valor={moeda(guiaSelecionada.valorFinal)} />
                <InfoResumo titulo="Recebido líquido" valor={moeda(guiaSelecionada.recebidoLiquido)} />
                <InfoResumo titulo="Saldo" valor={moeda(guiaSelecionada.saldo)} destaque={guiaSelecionada.saldo > 0.009} />
                <InfoResumo titulo="Repasse previsto" valor={moeda(guiaSelecionada.valorRepasse)} />
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-slate-900">Procedimentos</h4>
                  <span className="text-xs text-slate-500">{guiaSelecionada.procedimentos.length} item(ns)</span>
                </div>
                <div className="space-y-2">
                  {guiaSelecionada.procedimentos.map((procedimento) => (
                    <div key={procedimento.id} className="rounded-lg border border-slate-200 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-800">{procedimento.nome}</p>
                          {procedimento.categoria && <p className="mt-1 text-xs text-slate-500">{procedimento.categoria}</p>}
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${classeStatus(procedimento.status)}`}>{statusLabel(procedimento.status)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <button
                type="button"
                onClick={() => router.push(`/guias/${guiaSelecionada.id}`)}
                className="w-full rounded-lg bg-xango-primary px-4 py-3 text-sm font-semibold text-white hover:bg-xango-primary-hover"
              >
                Abrir guia / voucher
              </button>
            </div>
          </aside>
        </>

      )}

      {movimentacaoSelecionada && (
        <>
          <button
            type="button"
            aria-label="Fechar resumo da movimentação"
            onClick={() => setMovimentacaoSelecionada(null)}
            className="fixed inset-0 z-40 bg-black/25"
          />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Movimentação financeira</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{statusLabel(movimentacaoSelecionada.tipo)}</h3>
                <p className="mt-1 text-sm text-slate-500">{dataBr(movimentacaoSelecionada.data, true)}</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setMovimentacaoSelecionada(null)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <section className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paciente</p>
                    <p className="mt-1 font-semibold text-slate-900">{movimentacaoSelecionada.paciente}</p>
                    <p className="mt-1 text-sm text-slate-500">CPF {cpfBr(movimentacaoSelecionada.cpf)}</p>
                    <p className="mt-1 text-sm text-slate-500">{movimentacaoSelecionada.telefone || "Telefone não informado"}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classeStatus(movimentacaoSelecionada.tipo)}`}>{statusLabel(movimentacaoSelecionada.tipo)}</span>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <InfoResumo titulo="Voucher" valor={movimentacaoSelecionada.codigoVoucher || `Guia #${movimentacaoSelecionada.guiaId}`} detalhe={movimentacaoSelecionada.codigoAtendimento || `Atendimento #${movimentacaoSelecionada.atendimentoId}`} />
                <InfoResumo titulo="Clínica" valor={movimentacaoSelecionada.clinica} />
                <InfoResumo titulo="Forma de pagamento" valor={movimentacaoSelecionada.formaLabel} />
                <InfoResumo titulo="Valor" valor={moeda(movimentacaoSelecionada.valor)} destaque={movimentacaoSelecionada.tipo === "ESTORNO"} />
              </section>

              {movimentacaoSelecionada.observacao && (
                <section className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observação</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{movimentacaoSelecionada.observacao}</p>
                </section>
              )}

              <button
                type="button"
                onClick={() => router.push(`/guias/${movimentacaoSelecionada.guiaId}`)}
                className="w-full rounded-lg bg-xango-primary px-4 py-3 text-sm font-semibold text-white hover:bg-xango-primary-hover"
              >
                Abrir guia / voucher
              </button>
            </div>
          </aside>
        </>
      )}

      {repasseSelecionado && (
        <>
          <button
            type="button"
            aria-label="Fechar resumo do repasse"
            onClick={() => setRepasseSelecionado(null)}
            className="fixed inset-0 z-40 bg-black/25"
          />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo do repasse</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{repasseSelecionado.codigoPublico}</h3>
                <p className="mt-1 text-sm text-slate-500">{repasseSelecionado.clinica}</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setRepasseSelecionado(null)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <section className="grid gap-3 sm:grid-cols-2">
                <InfoResumo titulo="Status" valor={repasseSelecionado.statusLabel} />
                <InfoResumo titulo="Valor total" valor={moeda(repasseSelecionado.valorTotal)} />
                <InfoResumo titulo="Solicitado em" valor={dataBr(repasseSelecionado.solicitadoEm, true)} detalhe={repasseSelecionado.solicitadoPor ? `Por ${repasseSelecionado.solicitadoPor}` : undefined} />
                <InfoResumo titulo="Pagamento solicitado" valor={dataBr(repasseSelecionado.dataPagamentoSolicitada)} />
                <InfoResumo titulo="Pagamento efetivo" valor={dataBr(repasseSelecionado.dataPagamentoEfetivo)} detalhe={repasseSelecionado.pagoPor ? `Registrado por ${repasseSelecionado.pagoPor}` : undefined} />
                <InfoResumo titulo="Forma de pagamento" valor={repasseSelecionado.formaPagamentoLabel || "-"} />
                {repasseSelecionado.status === "PAGO" && (
                  <InfoResumo titulo="Documentação" valor={`${repasseSelecionado.percentualDocumentacao || 0}%`} destaque={(repasseSelecionado.percentualDocumentacao || 0) < 100} />
                )}
                <InfoResumo titulo="Guias" valor={String(repasseSelecionado.quantidadeGuias)} />
              </section>

              {repasseSelecionado.motivoRecusa && (
                <section className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Motivo da recusa</p>
                  <p className="mt-2 text-sm text-red-800">{repasseSelecionado.motivoRecusa}</p>
                </section>
              )}

              {repasseSelecionado.observacaoPagamento && (
                <section className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observação do pagamento</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{repasseSelecionado.observacaoPagamento}</p>
                </section>
              )}

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-slate-900">Guias do repasse</h4>
                  <span className="text-xs text-slate-500">{repasseSelecionado.itens.length} item(ns)</span>
                </div>
                <div className="space-y-2">
                  {repasseSelecionado.itens.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => router.push(`/guias/${item.guiaId}`)}
                      className="block w-full rounded-lg border border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-800">{item.paciente}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.codigoVoucher || `Guia #${item.guiaId}`} • {item.codigoAtendimento || `Atendimento #${item.atendimentoId}`}</p>
                        </div>
                        <span className="text-sm font-semibold text-slate-800">{moeda(item.valor)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {repasseSelecionado.status === "PAGO" && (
                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="font-semibold text-slate-900">Documentos</h4>
                    <span className="text-xs text-slate-500">{repasseSelecionado.documentos.length} arquivo(s)</span>
                  </div>
                  {repasseSelecionado.documentos.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">Nenhum comprovante ou nota fiscal anexado.</div>
                  ) : (
                    <div className="space-y-2">
                      {repasseSelecionado.documentos.map((documento) => (
                        <button
                          key={documento.id}
                          type="button"
                          onClick={() => void abrirDocumentoRepasse(documento)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">{documento.nomeOriginal}</p>
                            <p className="mt-1 text-xs text-slate-500">{documento.tipo === "COMPROVANTE_PAGAMENTO" ? "Comprovante de pagamento" : "Nota fiscal de serviço"} • {dataBr(documento.criadoEm, true)}</p>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-xango-primary">Abrir</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <button
                type="button"
                onClick={() => router.push(`/financeiro/repasses?busca=${encodeURIComponent(repasseSelecionado.codigoPublico)}&visao=${["PAGO", "RECUSADO"].includes(repasseSelecionado.status) ? "HISTORICO" : "PENDENTES"}`)}
                className="w-full rounded-lg bg-xango-primary px-4 py-3 text-sm font-semibold text-white hover:bg-xango-primary-hover"
              >
                Abrir controle de repasses
              </button>
            </div>
          </aside>
        </>
      )}

      {clinicaProducaoSelecionada && (
        <>
          <button type="button" aria-label="Fechar produção da clínica" onClick={() => setClinicaProducaoSelecionada(null)} className="fixed inset-0 z-40 bg-black/25" />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Produção da clínica</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{clinicaProducaoSelecionada.nome}</h3>
                <p className="mt-1 text-sm text-slate-500">{filtrosProducao.inicio} a {filtrosProducao.fim}</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setClinicaProducaoSelecionada(null)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X size={18} /></button>
            </div>
            <div className="space-y-6 p-6">
              <section className="grid gap-3 sm:grid-cols-2">
                <InfoResumo titulo="Procedimentos realizados" valor={String(clinicaProducaoSelecionada.quantidadeProcedimentos)} detalhe={`${clinicaProducaoSelecionada.quantidadePacientes} paciente(s)`} />
                <InfoResumo titulo="Atendimentos / Guias" valor={`${clinicaProducaoSelecionada.quantidadeAtendimentos} / ${clinicaProducaoSelecionada.quantidadeGuias}`} />
                <InfoResumo titulo="Valor paciente" valor={moeda(clinicaProducaoSelecionada.valorPaciente)} />
                <InfoResumo titulo="Repasse" valor={moeda(clinicaProducaoSelecionada.valorRepasse)} />
                <InfoResumo titulo="Diferença operacional" valor={moeda(clinicaProducaoSelecionada.diferenca)} />
                <InfoResumo titulo="Margem operacional" valor={percentual(clinicaProducaoSelecionada.margemPercentual)} />
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-slate-900">Procedimentos realizados</h4>
                  <span className="text-xs text-slate-500">{clinicaProducaoSelecionada.procedimentos.length} tipo(s)</span>
                </div>
                <div className="space-y-2">
                  {clinicaProducaoSelecionada.procedimentos.slice(0, 12).map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{item.nome}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.categoria || "Sem categoria"} • {item.quantidade} realizado(s)</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-slate-800">{moeda(item.valorPaciente)}</p>
                          <p className="mt-1 text-xs text-slate-500">Repasse {moeda(item.valorRepasse)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-slate-900">Últimas realizações do período</h4>
                  <span className="text-xs text-slate-500">até 12 itens</span>
                </div>
                <div className="space-y-2">
                  {clinicaProducaoSelecionada.ultimasGuias.map((item, indice) => (
                    <button key={`${item.guiaId}-${item.procedimentoId}-${indice}`} type="button" onClick={() => router.push(`/guias/${item.guiaId}`)} className="block w-full rounded-lg border border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{item.paciente}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.procedimento} • {item.codigoVoucher || `Guia #${item.guiaId}`}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-semibold text-slate-700">{dataBr(item.realizadoEm)}</p>
                          <p className="mt-1 text-xs text-slate-500">{moeda(item.valorPaciente)}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <button type="button" onClick={() => router.push(`/clinicas/${clinicaProducaoSelecionada.id}`)} className="w-full rounded-lg bg-xango-primary px-4 py-3 text-sm font-semibold text-white hover:bg-xango-primary-hover">Abrir clínica</button>
            </div>
          </aside>
        </>
      )}

      {procedimentoProducaoSelecionado && (
        <>
          <button type="button" aria-label="Fechar produção do procedimento" onClick={() => setProcedimentoProducaoSelecionado(null)} className="fixed inset-0 z-40 bg-black/25" />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Produção do procedimento</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{procedimentoProducaoSelecionado.nome}</h3>
                <p className="mt-1 text-sm text-slate-500">{procedimentoProducaoSelecionado.categoria || "Sem categoria"}</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setProcedimentoProducaoSelecionado(null)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X size={18} /></button>
            </div>
            <div className="space-y-6 p-6">
              <section className="grid gap-3 sm:grid-cols-2">
                <InfoResumo titulo="Realizados" valor={String(procedimentoProducaoSelecionado.quantidade)} detalhe={`${procedimentoProducaoSelecionado.quantidadeClinicas} clínica(s)`} />
                <InfoResumo titulo="Pacientes / Guias" valor={`${procedimentoProducaoSelecionado.quantidadePacientes} / ${procedimentoProducaoSelecionado.quantidadeGuias}`} />
                <InfoResumo titulo="Valor paciente" valor={moeda(procedimentoProducaoSelecionado.valorPaciente)} />
                <InfoResumo titulo="Repasse" valor={moeda(procedimentoProducaoSelecionado.valorRepasse)} />
                <InfoResumo titulo="Diferença operacional" valor={moeda(procedimentoProducaoSelecionado.diferenca)} />
                <InfoResumo titulo="Margem operacional" valor={percentual(procedimentoProducaoSelecionado.margemPercentual)} />
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-slate-900">Distribuição por clínica</h4>
                  <span className="text-xs text-slate-500">{procedimentoProducaoSelecionado.clinicas.length} clínica(s)</span>
                </div>
                <div className="space-y-2">
                  {procedimentoProducaoSelecionado.clinicas.map((item) => (
                    <button key={item.id} type="button" onClick={() => router.push(`/clinicas/${item.id}`)} className="block w-full rounded-lg border border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-800">{item.nome}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.quantidade} realizado(s)</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-800">{moeda(item.valorPaciente)}</p>
                          <p className="mt-1 text-xs text-slate-500">Repasse {moeda(item.valorRepasse)}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-slate-900">Últimas realizações do período</h4>
                  <span className="text-xs text-slate-500">até 12 itens</span>
                </div>
                <div className="space-y-2">
                  {procedimentoProducaoSelecionado.ultimasGuias.map((item, indice) => (
                    <button key={`${item.guiaId}-${item.clinicaId}-${indice}`} type="button" onClick={() => router.push(`/guias/${item.guiaId}`)} className="block w-full rounded-lg border border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{item.paciente}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.clinica} • {item.codigoVoucher || `Guia #${item.guiaId}`}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-semibold text-slate-700">{dataBr(item.realizadoEm)}</p>
                          <p className="mt-1 text-xs text-slate-500">{moeda(item.valorPaciente)}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <button type="button" onClick={() => router.push("/procedimentos")} className="w-full rounded-lg bg-xango-primary px-4 py-3 text-sm font-semibold text-white hover:bg-xango-primary-hover">Abrir catálogo de procedimentos</button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function InfoResumo({
  titulo,
  valor,
  detalhe,
  destaque = false,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-1 break-words font-semibold ${destaque ? "text-amber-700" : "text-slate-900"}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-2.5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{children}</th>;
}

function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-2.5 py-4 text-sm text-slate-700 ${className}`}>{children}</td>;
}

function Vazio() {
  return (
    <div className="px-6 py-16 text-center">
      <XCircle className="mx-auto text-slate-300" size={34} />
      <p className="mt-3 font-semibold text-slate-700">Nenhum registro encontrado</p>
      <p className="mt-1 text-sm text-slate-500">Ajuste os filtros e tente novamente.</p>
    </div>
  );
}
