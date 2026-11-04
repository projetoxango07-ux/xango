"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  HandCoins,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  WalletCards,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type Resumo = {
  recebidoBruto: number;
  estornos: number;
  tarifasFinanceiras: number;
  recebidoAntesTarifas: number;
  recebidoLiquido: number;
  aReceber: number;
  repassesAPagar: number;
  quantidadeRecebimentos: number;
  quantidadeEstornos: number;
  quantidadeGuiasAReceber: number;
  quantidadeRepassesAPagar: number;
};

type Clinica = { id: number; nome: string };

type ContaResumo = {
  id: number;
  nome: string;
  tipo: string;
  tipoLabel: string;
  ativo: boolean;
  saldoInicial: number;
  saldoInicialEm: string | null;
  entradas: number;
  saidas: number;
  saldoAtual: number;
  entradasPeriodo: number;
  saidasPeriodo: number;
  variacaoPeriodo: number;
};

type Movimentacao = {
  id: string;
  tipo: "RECEBIMENTO" | "ESTORNO";
  data: string;
  valor: number;
  forma: string;
  formaLabel: string;
  formaRecebimento: string | null;
  parcelas: number;
  operadora: string | null;
  contaFinanceira: string | null;
  taxaPercentual: number;
  taxaFixa: number;
  valorTarifa: number;
  valorLiquido: number;
  observacao: string | null;
  guiaId: number;
  codigoVoucher: string | null;
  pacienteId: number;
  paciente: string;
  clinicaId: number;
  clinica: string;
};

type GuiaAReceber = {
  guiaId: number;
  codigoVoucher: string | null;
  pacienteId: number;
  paciente: string;
  clinicaId: number;
  clinica: string;
  valorFinal: number;
  pagoLiquido: number;
  saldo: number;
  criadoEm: string;
  status: string;
};

type RepasseAPagar = {
  guiaId: number;
  codigoVoucher: string | null;
  pacienteId: number;
  paciente: string;
  clinicaId: number;
  clinica: string;
  confirmadoEm: string;
  valorPrevisto: number;
  valorPago: number;
  saldo: number;
  statusRepasse: string | null;
};

type FinanceiroApi = {
  periodo: { inicio: string; fim: string };
  resumo: Resumo;
  clinicas: Clinica[];
  contas: ContaResumo[];
  movimentacoes: Movimentacao[];
  guiasAReceber: GuiaAReceber[];
  repassesAPagar: RepasseAPagar[];
};

type TarifaEditor = {
  parcelas: number;
  percentual: number;
  fixa: number;
  ativo: boolean;
};

type ContaEditor = {
  id?: number;
  chave: string;
  nome: string;
  tipo: string;
  saldoInicial: number;
  saldoInicialEm: string;
  ativo: boolean;
};

type OperadoraEditor = {
  id?: number;
  chave: string;
  nome: string;
  ativo: boolean;
};

type FormaEditor = {
  id?: number;
  chave: string;
  nome: string;
  forma: string;
  operadoraChave: string;
  contaPadraoChave: string;
  ativo: boolean;
  tarifas: TarifaEditor[];
};

type ConfigApi = {
  maxParcelasCredito: number;
  tiposConta: Array<{ codigo: string; label: string }>;
  formasPagamento: Array<{ codigo: string; label: string }>;
  formasRepasse: Array<{ codigo: string; label: string }>;
  contas: Array<{
    id: number;
    nome: string;
    tipo: string;
    saldoInicial: number;
    saldoInicialEm: string | null;
    ativo: boolean;
  }>;
  operadoras: Array<{
    id: number;
    nome: string;
    ativo: boolean;
  }>;
  formasRecebimento: Array<{
    id: number;
    nome: string;
    forma: string;
    ativo: boolean;
    operadora: { id: number; nome: string; ativo: boolean } | null;
    contaPadrao: { id: number; nome: string; ativo: boolean } | null;
    tarifas: TarifaEditor[];
  }>;
  contasPadraoRepasse: Array<{
    forma: string;
    contaFinanceiraId: number;
  }>;
};

const TIPOS_CONTA_PADRAO = [
  { codigo: "BANCO", label: "Banco" },
  { codigo: "CARTEIRA_DIGITAL", label: "Carteira digital / adquirente" },
  { codigo: "CAIXA", label: "Caixa físico" },
  { codigo: "OUTRO", label: "Outro" },
];

const FORMAS_PAGAMENTO_PADRAO = [
  { codigo: "PIX", label: "PIX" },
  { codigo: "DINHEIRO", label: "Dinheiro" },
  { codigo: "CARTAO_CREDITO", label: "Cartão de crédito" },
  { codigo: "CARTAO_DEBITO", label: "Cartão de débito" },
  { codigo: "BOLETO", label: "Boleto" },
  { codigo: "TRANSFERENCIA", label: "Transferência" },
  { codigo: "OUTRO", label: "Outro" },
];

const FORMAS_REPASSE_PADRAO = [
  { codigo: "PIX", label: "PIX" },
  { codigo: "TRANSFERENCIA", label: "Transferência / TED / DOC" },
  { codigo: "BOLETO", label: "Boleto" },
  { codigo: "DINHEIRO", label: "Dinheiro" },
  { codigo: "OUTRO", label: "Outro" },
];

function datasMesAtual() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  const dois = (n: number) => String(n).padStart(2, "0");
  return {
    inicio: `${ano}-${dois(mes + 1)}-01`,
    fim: `${ano}-${dois(mes + 1)}-${dois(new Date(ano, mes + 1, 0).getDate())}`,
  };
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dataHora(valor: string) {
  return new Date(valor).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dataCurta(valor: string) {
  return new Date(valor).toLocaleDateString("pt-BR");
}

function statusGuiaLabel(valor: string) {
  const mapa: Record<string, string> = {
    RASCUNHO: "Rascunho",
    AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
    PARCIALMENTE_PAGA: "Parcialmente paga",
    PAGA: "Paga",
    ESTORNO_PENDENTE: "Estorno pendente",
    CANCELADA: "Cancelada",
  };
  return mapa[valor] || valor.replaceAll("_", " ");
}

function statusRepasseLabel(valor: string | null) {
  if (!valor) return "Disponível";
  const mapa: Record<string, string> = {
    DISPONIVEL: "Disponível",
    SOLICITADO: "Solicitado",
    EM_ANALISE: "Em análise",
    APROVADO: "Aprovado",
    PAGO: "Pago",
    RECUSADO: "Recusado",
  };
  return mapa[valor] || valor.replaceAll("_", " ");
}

function chave(prefixo: string, id?: number, indice = 0) {
  return id ? `${prefixo}-${id}` : `${prefixo}-novo-${Date.now()}-${indice}`;
}

function tarifasPadrao(forma: string, maxParcelas: number): TarifaEditor[] {
  const quantidade = forma === "CARTAO_CREDITO" ? maxParcelas : 1;
  return Array.from({ length: quantidade }, (_, indice) => ({
    parcelas: indice + 1,
    percentual: 0,
    fixa: 0,
    ativo: true,
  }));
}

function Card({
  titulo,
  valor,
  apoio,
  icone,
  onClick,
  alerta = false,
  alertaTexto,
}: {
  titulo: string;
  valor: string;
  apoio: string;
  icone: React.ReactNode;
  onClick?: () => void;
  alerta?: boolean;
  alertaTexto?: string;
}) {
  const clicavel = Boolean(onClick);
  return (
    <div
      role={clicavel ? "button" : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick || !["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        onClick();
      }}
      className={`min-w-0 rounded-xl border p-5 shadow-sm transition ${
        alerta ? "border-red-300 bg-red-50" : "border-xango-border bg-white"
      } ${
        clicavel
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-xango-primary/30"
          : ""
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-xs font-semibold uppercase tracking-wide ${alerta ? "text-red-700" : "text-xango-muted"}`}>
              {titulo}
            </p>
            {alerta && <AlertTriangle size={15} className="shrink-0 text-red-600" />}
          </div>
          <p className={`mt-2 whitespace-nowrap text-xl font-bold 2xl:text-2xl ${alerta ? "text-red-800" : "text-xango-text"}`}>
            {valor}
          </p>
          <p className={`mt-1 text-xs ${alerta ? "text-red-700" : "text-xango-muted"}`}>{apoio}</p>
          {alerta && alertaTexto && <p className="mt-2 text-xs font-semibold text-red-700">{alertaTexto}</p>}
        </div>
        <div className={`shrink-0 rounded-lg p-2.5 ${alerta ? "bg-red-100 text-red-700" : "bg-xango-background text-xango-primary"}`}>
          {icone}
        </div>
      </div>
      {clicavel && (
        <div className={`mt-3 flex items-center justify-end gap-1 text-[11px] font-semibold ${alerta ? "text-red-700" : "text-xango-primary"}`}>
          Abrir <ChevronRight size={13} />
        </div>
      )}
    </div>
  );
}

export default function FinanceiroPage() {
  const router = useRouter();
  const mesAtual = useMemo(() => datasMesAtual(), []);
  const movimentacoesRef = useRef<HTMLElement | null>(null);
  const guiasRef = useRef<HTMLElement | null>(null);

  const [inicio, setInicio] = useState(mesAtual.inicio);
  const [fim, setFim] = useState(mesAtual.fim);
  const [clinicaId, setClinicaId] = useState("");
  const [busca, setBusca] = useState("");
  const [tipoMovimentacao, setTipoMovimentacao] = useState<"TODOS" | "RECEBIMENTO" | "ESTORNO">("TODOS");
  const [dados, setDados] = useState<FinanceiroApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [podeConfigurarContas, setPodeConfigurarContas] = useState(false);
  useEffect(() => {
    const controle = new AbortController();
    void fetch(`${API_URL}/auth/me`, { credentials: "include", cache: "no-store", signal: controle.signal })
      .then(async resposta => resposta.ok ? resposta.json() : null)
      .then(dados => {
        if (!controle.signal.aborted) {
          const permissoes = dados?.usuario?.permissoesEfetivas;
          setPodeConfigurarContas(Array.isArray(permissoes) && permissoes.includes("financeiro.saldos_bancarios.visualizar"));
        }
      }).catch(() => undefined);
    return () => controle.abort();
  }, []);
  const [editorAberto, setEditorAberto] = useState(false);
  const [carregandoConfig, setCarregandoConfig] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [erroConfig, setErroConfig] = useState("");
  const [sucessoConfig, setSucessoConfig] = useState("");
  const [maxParcelasCredito, setMaxParcelasCredito] = useState(12);
  const [tiposConta, setTiposConta] = useState(TIPOS_CONTA_PADRAO);
  const [formasPagamento, setFormasPagamento] = useState(FORMAS_PAGAMENTO_PADRAO);
  const [formasRepasse, setFormasRepasse] = useState(FORMAS_REPASSE_PADRAO);
  const [contasEditor, setContasEditor] = useState<ContaEditor[]>([]);
  const [operadorasEditor, setOperadorasEditor] = useState<OperadoraEditor[]>([]);
  const [formasEditor, setFormasEditor] = useState<FormaEditor[]>([]);
  const [padroesRepasse, setPadroesRepasse] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");
      const params = new URLSearchParams({ inicio, fim });
      if (clinicaId) params.set("clinicaId", clinicaId);
      const resposta = await fetch(`${API_URL}/financeiro/resumo?${params.toString()}`, {
        cache: "no-store",
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível carregar o financeiro.");
      setDados(resultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o financeiro.");
    } finally {
      setCarregando(false);
    }
  }, [inicio, fim, clinicaId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void carregar();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  const carregarConfig = useCallback(async () => {
    try {
      setCarregandoConfig(true);
      setErroConfig("");
      setSucessoConfig("");
      const resposta = await fetch(`${API_URL}/financeiro/configuracao-recebimentos`, {
        cache: "no-store",
      });
      const resultado: ConfigApi & { erro?: string } = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível carregar as configurações financeiras.");

      const maximo = Number(resultado.maxParcelasCredito) || 12;
      setMaxParcelasCredito(maximo);
      setTiposConta(resultado.tiposConta?.length ? resultado.tiposConta : TIPOS_CONTA_PADRAO);
      setFormasPagamento(resultado.formasPagamento?.length ? resultado.formasPagamento : FORMAS_PAGAMENTO_PADRAO);
      setFormasRepasse(resultado.formasRepasse?.length ? resultado.formasRepasse : FORMAS_REPASSE_PADRAO);

      const contas = (resultado.contas || []).map((conta, indice) => ({
        id: conta.id,
        chave: chave("conta", conta.id, indice),
        nome: conta.nome,
        tipo: conta.tipo,
        saldoInicial: Number(conta.saldoInicial || 0),
        saldoInicialEm: conta.saldoInicialEm ? conta.saldoInicialEm.slice(0, 10) : "",
        ativo: conta.ativo !== false,
      }));
      const operadoras = (resultado.operadoras || []).map((operadora, indice) => ({
        id: operadora.id,
        chave: chave("op", operadora.id, indice),
        nome: operadora.nome,
        ativo: operadora.ativo !== false,
      }));
      const contaChavePorId = new Map(contas.map((item) => [item.id, item.chave]));
      const operadoraChavePorId = new Map(operadoras.map((item) => [item.id, item.chave]));

      const formas = (resultado.formasRecebimento || []).map((forma, indice) => {
        const tarifasExistentes = forma.tarifas || [];
        const tarifas = tarifasPadrao(forma.forma, maximo).map((padrao) => {
          const existente = tarifasExistentes.find((item) => Number(item.parcelas) === padrao.parcelas);
          return existente
            ? {
                parcelas: padrao.parcelas,
                percentual: Number(existente.percentual || 0),
                fixa: Number(existente.fixa || 0),
                ativo: existente.ativo !== false,
              }
            : padrao;
        });
        return {
          id: forma.id,
          chave: chave("forma", forma.id, indice),
          nome: forma.nome,
          forma: forma.forma,
          operadoraChave: forma.operadora?.id ? operadoraChavePorId.get(forma.operadora.id) || "" : "",
          contaPadraoChave: forma.contaPadrao?.id ? contaChavePorId.get(forma.contaPadrao.id) || "" : "",
          ativo: forma.ativo !== false,
          tarifas,
        };
      });

      const padroes: Record<string, string> = {};
      for (const item of resultado.contasPadraoRepasse || []) {
        padroes[item.forma] = contaChavePorId.get(item.contaFinanceiraId) || "";
      }

      setContasEditor(contas);
      setOperadorasEditor(operadoras);
      setFormasEditor(formas);
      setPadroesRepasse(padroes);
    } catch (e) {
      setErroConfig(e instanceof Error ? e.message : "Não foi possível carregar as configurações financeiras.");
    } finally {
      setCarregandoConfig(false);
    }
  }, []);

  useEffect(() => {
    if (!editorAberto) return;
    const timer = window.setTimeout(() => {
      void carregarConfig();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editorAberto, carregarConfig]);

  function adicionarConta() {
    setContasEditor((atuais) => [
      ...atuais,
      {
        chave: chave("conta", undefined, atuais.length),
        nome: "",
        tipo: "BANCO",
        saldoInicial: 0,
        saldoInicialEm: "",
        ativo: true,
      },
    ]);
  }

  function adicionarOperadora() {
    setOperadorasEditor((atuais) => [
      ...atuais,
      {
        chave: chave("op", undefined, atuais.length),
        nome: "",
        ativo: true,
      },
    ]);
  }

  function adicionarForma() {
    setFormasEditor((atuais) => [
      ...atuais,
      {
        chave: chave("forma", undefined, atuais.length),
        nome: "",
        forma: "PIX",
        operadoraChave: "",
        contaPadraoChave: "",
        ativo: true,
        tarifas: tarifasPadrao("PIX", maxParcelasCredito),
      },
    ]);
  }

  function alterarFormaTipo(chaveForma: string, forma: string) {
    setFormasEditor((atuais) =>
      atuais.map((item) =>
        item.chave === chaveForma
          ? { ...item, forma, tarifas: tarifasPadrao(forma, maxParcelasCredito) }
          : item
      )
    );
  }

  async function salvarConfig() {
    try {
      setSalvandoConfig(true);
      setErroConfig("");
      setSucessoConfig("");

      if (contasEditor.some((item) => !item.nome.trim())) {
        throw new Error("Informe o nome de todas as contas financeiras.");
      }
      if (operadorasEditor.some((item) => !item.nome.trim())) {
        throw new Error("Informe o nome de todas as operadoras.");
      }
      if (formasEditor.some((item) => !item.nome.trim())) {
        throw new Error("Informe o nome de todas as formas de recebimento.");
      }

      const resposta = await fetch(`${API_URL}/financeiro/configuracao-recebimentos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contas: contasEditor.map((item) => ({
            id: item.id,
            chave: item.chave,
            nome: item.nome.trim(),
            tipo: item.tipo,
            saldoInicial: Number(item.saldoInicial || 0),
            saldoInicialEm: item.saldoInicialEm || null,
            ativo: item.ativo,
          })),
          operadoras: operadorasEditor.map((item) => ({
            id: item.id,
            chave: item.chave,
            nome: item.nome.trim(),
            ativo: item.ativo,
          })),
          formasRecebimento: formasEditor.map((item) => ({
            id: item.id,
            chave: item.chave,
            nome: item.nome.trim(),
            forma: item.forma,
            operadoraChave: item.operadoraChave || null,
            contaPadraoChave: item.contaPadraoChave || null,
            ativo: item.ativo,
            tarifas: item.tarifas.map((tarifa) => ({
              parcelas: tarifa.parcelas,
              percentual: Number(tarifa.percentual || 0),
              fixa: Number(tarifa.fixa || 0),
              ativo: tarifa.ativo,
            })),
          })),
          contasPadraoRepasse: formasRepasse.map((item) => ({
            forma: item.codigo,
            contaChave: padroesRepasse[item.codigo] || null,
          })),
        }),
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível salvar as configurações financeiras.");

      setSucessoConfig(resultado.mensagem || "Configurações financeiras atualizadas com sucesso.");
      await carregarConfig();
      await carregar();
    } catch (e) {
      setErroConfig(e instanceof Error ? e.message : "Não foi possível salvar as configurações financeiras.");
    } finally {
      setSalvandoConfig(false);
    }
  }

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const movimentacoesBuscadas = useMemo(
    () =>
      (dados?.movimentacoes || []).filter((item) =>
        !termo ||
        [
          item.paciente,
          item.clinica,
          item.codigoVoucher || "",
          item.formaLabel,
          item.formaRecebimento || "",
          item.operadora || "",
          item.contaFinanceira || "",
        ].some((texto) => texto.toLocaleLowerCase("pt-BR").includes(termo))
      ),
    [dados, termo]
  );
  const movimentacoes = useMemo(
    () => movimentacoesBuscadas.filter((item) => tipoMovimentacao === "TODOS" || item.tipo === tipoMovimentacao),
    [movimentacoesBuscadas, tipoMovimentacao]
  );
  const guias = useMemo(
    () =>
      (dados?.guiasAReceber || []).filter((item) =>
        !termo || [item.paciente, item.clinica, item.codigoVoucher || ""].some((texto) => texto.toLocaleLowerCase("pt-BR").includes(termo))
      ),
    [dados, termo]
  );
  const repasses = useMemo(
    () =>
      (dados?.repassesAPagar || []).filter((item) =>
        !termo || [item.paciente, item.clinica, item.codigoVoucher || ""].some((texto) => texto.toLocaleLowerCase("pt-BR").includes(termo))
      ),
    [dados, termo]
  );

  const alertaGuias = (dados?.resumo.quantidadeGuiasAReceber || 0) > 100;
  const quantidadeRepassesSolicitados = useMemo(
    () => (dados?.repassesAPagar || []).filter((item) => ["SOLICITADO", "EM_ANALISE", "APROVADO"].includes(item.statusRepasse || "")).length,
    [dados]
  );
  const alertaRepasses = quantidadeRepassesSolicitados > 50;

  function rolarPara(ref: React.RefObject<HTMLElement | null>) {
    window.requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function abrirMovimentacoes(tipo: "TODOS" | "RECEBIMENTO" | "ESTORNO") {
    setTipoMovimentacao(tipo);
    rolarPara(movimentacoesRef);
  }

  function abrirRepasseDaLista(repasse: RepasseAPagar) {
    const status = repasse.statusRepasse || "DISPONIVEL";
    if (status === "DISPONIVEL") {
      router.push(`/guias/${repasse.guiaId}`);
      return;
    }
    const params = new URLSearchParams();
    params.set("busca", repasse.codigoVoucher || repasse.paciente);
    params.set("visao", ["PAGO", "RECUSADO"].includes(status) ? "HISTORICO" : "PENDENTES");
    router.push(`/financeiro/repasses?${params.toString()}`);
  }

  if (carregando && !dados) {
    return (
      <div className="flex min-h-80 items-center justify-center text-sm text-xango-muted">
        <Loader2 size={20} className="mr-2 animate-spin" /> Carregando painel financeiro...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-375 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-xango-text">Financeiro</h2>
          <p className="mt-1 text-sm text-xango-muted">
            Recebimentos, tarifas, contas, valores pendentes, estornos e repasses da operação Digna.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/financeiro/v12"
            className="flex items-center gap-2 rounded-lg border border-xango-border bg-white px-4 py-2.5 text-sm font-semibold text-xango-primary transition hover:bg-xango-background"
          >
            <WalletCards size={16} /> Gestão financeira V1.2
          </Link>
          {podeConfigurarContas && <button
            type="button"
            onClick={() => setEditorAberto((aberto) => !aberto)}
            className="flex items-center gap-2 rounded-lg border border-xango-border bg-white px-4 py-2.5 text-sm font-semibold text-xango-primary"
          >
            <Settings2 size={16} />
            {editorAberto ? "Fechar configurações" : "Contas e recebimentos"}
          </button>}
          <Link href="/financeiro/repasses" className="flex items-center gap-2 rounded-lg bg-xango-primary px-4 py-2.5 text-sm font-semibold text-white">
            <HandCoins size={16} /> Gerenciar repasses
          </Link>
          <button type="button" onClick={() => void carregar()} disabled={carregando} className="flex items-center gap-2 rounded-lg border border-xango-border bg-white px-4 py-2.5 text-sm font-semibold text-xango-primary disabled:opacity-50">
            <RefreshCw size={16} className={carregando ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>
      </div>

      {editorAberto && podeConfigurarContas && (
        <section className="mt-6 rounded-xl border border-xango-border bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-xango-border p-5">
            <div>
              <h3 className="font-semibold text-xango-text">Contas, formas de recebimento e tarifas</h3>
              <p className="mt-1 text-sm text-xango-muted">
                A conta padrão é apenas uma sugestão: no atendimento e no repasse ela pode ser alterada sem bloqueio.
              </p>
            </div>
            <button type="button" onClick={() => void salvarConfig()} disabled={salvandoConfig || carregandoConfig} className="flex items-center gap-2 rounded-lg bg-xango-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {salvandoConfig ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar configurações
            </button>
          </div>

          {erroConfig && <div className="m-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erroConfig}</div>}
          {sucessoConfig && <div className="m-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{sucessoConfig}</div>}

          {carregandoConfig ? (
            <div className="flex items-center justify-center p-10 text-sm text-xango-muted"><Loader2 size={18} className="mr-2 animate-spin" /> Carregando configurações...</div>
          ) : (
            <div className="space-y-8 p-5">
              <section>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-xango-text">1. Contas financeiras</h4>
                    <p className="mt-1 text-xs text-xango-muted">Ex.: Caixa Econômica, PagBank, Banco Inter, C6 e Caixa físico.</p>
                  </div>
                  <button type="button" onClick={adicionarConta} className="flex items-center gap-2 rounded-lg border border-xango-border px-3 py-2 text-xs font-semibold text-xango-primary"><Plus size={14} /> Nova conta</button>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {contasEditor.map((conta) => (
                    <div key={conta.chave} className="rounded-lg border border-xango-border p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-xango-muted">Nome
                          <input value={conta.nome} onChange={(e) => setContasEditor((atuais) => atuais.map((item) => item.chave === conta.chave ? { ...item, nome: e.target.value } : item))} placeholder="Ex.: PagBank" className="mt-1 w-full rounded-lg border border-xango-border px-3 py-2.5 text-sm font-normal outline-none focus:border-xango-primary" />
                        </label>
                        <label className="text-xs font-semibold text-xango-muted">Tipo
                          <select value={conta.tipo} onChange={(e) => setContasEditor((atuais) => atuais.map((item) => item.chave === conta.chave ? { ...item, tipo: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-xango-border bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-xango-primary">
                            {tiposConta.map((tipo) => <option key={tipo.codigo} value={tipo.codigo}>{tipo.label}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-xango-muted">Saldo inicial
                          <input type="number" step="0.01" value={conta.saldoInicial} onChange={(e) => setContasEditor((atuais) => atuais.map((item) => item.chave === conta.chave ? { ...item, saldoInicial: Number(e.target.value) } : item))} className="mt-1 w-full rounded-lg border border-xango-border px-3 py-2.5 text-sm font-normal outline-none focus:border-xango-primary" />
                        </label>
                        <label className="text-xs font-semibold text-xango-muted">Data do saldo inicial
                          <input type="date" value={conta.saldoInicialEm} onChange={(e) => setContasEditor((atuais) => atuais.map((item) => item.chave === conta.chave ? { ...item, saldoInicialEm: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-xango-border px-3 py-2.5 text-sm font-normal outline-none focus:border-xango-primary" />
                        </label>
                      </div>
                      <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-xango-muted"><input type="checkbox" checked={conta.ativo} onChange={(e) => setContasEditor((atuais) => atuais.map((item) => item.chave === conta.chave ? { ...item, ativo: e.target.checked } : item))} /> Conta ativa</label>
                    </div>
                  ))}
                  {contasEditor.length === 0 && <p className="rounded-lg border border-dashed border-xango-border p-5 text-sm text-xango-muted">Nenhuma conta cadastrada.</p>}
                </div>
              </section>

              <section className="border-t border-xango-border pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-xango-text">2. Operadoras / adquirentes</h4>
                    <p className="mt-1 text-xs text-xango-muted">Opcional. Use para identificar quem processa a cobrança, como PagBank.</p>
                  </div>
                  <button type="button" onClick={adicionarOperadora} className="flex items-center gap-2 rounded-lg border border-xango-border px-3 py-2 text-xs font-semibold text-xango-primary"><Plus size={14} /> Nova operadora</button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {operadorasEditor.map((operadora) => (
                    <div key={operadora.chave} className="flex items-center gap-3 rounded-lg border border-xango-border p-3">
                      <input value={operadora.nome} onChange={(e) => setOperadorasEditor((atuais) => atuais.map((item) => item.chave === operadora.chave ? { ...item, nome: e.target.value } : item))} placeholder="Ex.: PagBank" className="min-w-0 flex-1 rounded-lg border border-xango-border px-3 py-2 text-sm outline-none focus:border-xango-primary" />
                      <label className="flex shrink-0 items-center gap-1.5 text-xs text-xango-muted"><input type="checkbox" checked={operadora.ativo} onChange={(e) => setOperadorasEditor((atuais) => atuais.map((item) => item.chave === operadora.chave ? { ...item, ativo: e.target.checked } : item))} /> Ativa</label>
                    </div>
                  ))}
                  {operadorasEditor.length === 0 && <p className="rounded-lg border border-dashed border-xango-border p-5 text-sm text-xango-muted">Nenhuma operadora cadastrada. Isso não impede PIX por chave, dinheiro ou transferência.</p>}
                </div>
              </section>

              <section className="border-t border-xango-border pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-xango-text">3. Formas de recebimento</h4>
                    <p className="mt-1 text-xs text-xango-muted">Você pode ter várias formas do mesmo tipo, como “PIX pela maquininha” e “PIX por chave”.</p>
                  </div>
                  <button type="button" onClick={adicionarForma} className="flex items-center gap-2 rounded-lg border border-xango-border px-3 py-2 text-xs font-semibold text-xango-primary"><Plus size={14} /> Nova forma</button>
                </div>

                <div className="mt-4 space-y-4">
                  {formasEditor.map((forma) => (
                    <article key={forma.chave} className="overflow-hidden rounded-xl border border-xango-border">
                      <div className="grid gap-3 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-5">
                        <label className="text-xs font-semibold text-xango-muted xl:col-span-2">Nome exibido no atendimento
                          <input value={forma.nome} onChange={(e) => setFormasEditor((atuais) => atuais.map((item) => item.chave === forma.chave ? { ...item, nome: e.target.value } : item))} placeholder="Ex.: PIX pela maquininha" className="mt-1 w-full rounded-lg border border-xango-border bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-xango-primary" />
                        </label>
                        <label className="text-xs font-semibold text-xango-muted">Tipo
                          <select value={forma.forma} onChange={(e) => alterarFormaTipo(forma.chave, e.target.value)} className="mt-1 w-full rounded-lg border border-xango-border bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-xango-primary">
                            {formasPagamento.map((item) => <option key={item.codigo} value={item.codigo}>{item.label}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-xango-muted">Operadora
                          <select value={forma.operadoraChave} onChange={(e) => setFormasEditor((atuais) => atuais.map((item) => item.chave === forma.chave ? { ...item, operadoraChave: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-xango-border bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-xango-primary">
                            <option value="">Sem operadora</option>
                            {operadorasEditor.filter((item) => item.ativo).map((item) => <option key={item.chave} value={item.chave}>{item.nome || "Nova operadora"}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-xango-muted">Conta padrão
                          <select value={forma.contaPadraoChave} onChange={(e) => setFormasEditor((atuais) => atuais.map((item) => item.chave === forma.chave ? { ...item, contaPadraoChave: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-xango-border bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-xango-primary">
                            <option value="">Sem padrão</option>
                            {contasEditor.filter((item) => item.ativo).map((item) => <option key={item.chave} value={item.chave}>{item.nome || "Nova conta"}</option>)}
                          </select>
                        </label>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">Tarifa</p>
                            <p className="mt-1 text-xs text-xango-muted">Percentual + valor fixo. 1x é crédito à vista.</p>
                          </div>
                          <label className="flex items-center gap-2 text-xs font-semibold text-xango-muted"><input type="checkbox" checked={forma.ativo} onChange={(e) => setFormasEditor((atuais) => atuais.map((item) => item.chave === forma.chave ? { ...item, ativo: e.target.checked } : item))} /> Forma ativa</label>
                        </div>

                        {forma.forma === "CARTAO_CREDITO" ? (
                          <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-xango-border">
                            <table className="w-full min-w-105 text-sm">
                              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-xango-muted"><tr><th className="px-3 py-2">Parcelas</th><th className="px-3 py-2">%</th><th className="px-3 py-2">Fixa</th></tr></thead>
                              <tbody className="divide-y divide-xango-border">
                                {forma.tarifas.map((tarifa) => (
                                  <tr key={tarifa.parcelas}>
                                    <td className="px-3 py-2 font-medium text-xango-text">{tarifa.parcelas}x</td>
                                    <td className="px-3 py-2"><input type="number" min="0" max="100" step="0.0001" value={tarifa.percentual} onChange={(e) => setFormasEditor((atuais) => atuais.map((item) => item.chave !== forma.chave ? item : { ...item, tarifas: item.tarifas.map((t) => t.parcelas === tarifa.parcelas ? { ...t, percentual: Number(e.target.value) } : t) }))} className="w-24 rounded-md border border-xango-border px-2 py-1.5" /></td>
                                    <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={tarifa.fixa} onChange={(e) => setFormasEditor((atuais) => atuais.map((item) => item.chave !== forma.chave ? item : { ...item, tarifas: item.tarifas.map((t) => t.parcelas === tarifa.parcelas ? { ...t, fixa: Number(e.target.value) } : t) }))} className="w-28 rounded-md border border-xango-border px-2 py-1.5" /></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="mt-3 grid max-w-lg gap-3 sm:grid-cols-2">
                            <label className="text-xs font-semibold text-xango-muted">Percentual (%)
                              <input type="number" min="0" max="100" step="0.0001" value={forma.tarifas[0]?.percentual || 0} onChange={(e) => setFormasEditor((atuais) => atuais.map((item) => item.chave === forma.chave ? { ...item, tarifas: [{ ...(item.tarifas[0] || { parcelas: 1, fixa: 0, ativo: true }), percentual: Number(e.target.value) }] } : item))} className="mt-1 w-full rounded-lg border border-xango-border px-3 py-2.5 text-sm font-normal outline-none focus:border-xango-primary" />
                            </label>
                            <label className="text-xs font-semibold text-xango-muted">Tarifa fixa
                              <input type="number" min="0" step="0.01" value={forma.tarifas[0]?.fixa || 0} onChange={(e) => setFormasEditor((atuais) => atuais.map((item) => item.chave === forma.chave ? { ...item, tarifas: [{ ...(item.tarifas[0] || { parcelas: 1, percentual: 0, ativo: true }), fixa: Number(e.target.value) }] } : item))} className="mt-1 w-full rounded-lg border border-xango-border px-3 py-2.5 text-sm font-normal outline-none focus:border-xango-primary" />
                            </label>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                  {formasEditor.length === 0 && <p className="rounded-lg border border-dashed border-xango-border p-5 text-sm text-xango-muted">Nenhuma forma de recebimento cadastrada.</p>}
                </div>
              </section>

              <section className="border-t border-xango-border pt-6">
                <h4 className="font-semibold text-xango-text">4. Conta padrão para pagamento de repasses</h4>
                <p className="mt-1 text-xs text-xango-muted">A conta será sugerida ao registrar o pagamento da clínica, mas poderá ser alterada na hora.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {formasRepasse.map((item) => (
                    <label key={item.codigo} className="text-xs font-semibold text-xango-muted">{item.label}
                      <select value={padroesRepasse[item.codigo] || ""} onChange={(e) => setPadroesRepasse((atuais) => ({ ...atuais, [item.codigo]: e.target.value }))} className="mt-1 w-full rounded-lg border border-xango-border bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-xango-primary">
                        <option value="">Sem padrão</option>
                        {contasEditor.filter((conta) => conta.ativo).map((conta) => <option key={conta.chave} value={conta.chave}>{conta.nome || "Nova conta"}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </section>
            </div>
          )}
        </section>
      )}

      <section className="mt-6 rounded-xl border border-xango-border bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[160px_160px_minmax(220px,1fr)_minmax(260px,1fr)_auto] lg:items-end">
          <label className="text-xs font-semibold text-xango-muted">De
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="mt-1 w-full rounded-lg border border-xango-border px-3 py-2.5 text-sm font-normal text-xango-text outline-none focus:border-xango-primary" />
          </label>
          <label className="text-xs font-semibold text-xango-muted">Até
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="mt-1 w-full rounded-lg border border-xango-border px-3 py-2.5 text-sm font-normal text-xango-text outline-none focus:border-xango-primary" />
          </label>
          <label className="text-xs font-semibold text-xango-muted">Clínica
            <select value={clinicaId} onChange={(e) => setClinicaId(e.target.value)} className="mt-1 w-full rounded-lg border border-xango-border bg-white px-3 py-2.5 text-sm font-normal text-xango-text outline-none focus:border-xango-primary">
              <option value="">Todas as clínicas</option>
              {(dados?.clinicas || []).map((clinica) => <option key={clinica.id} value={clinica.id}>{clinica.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-xango-muted">Busca
            <div className="relative mt-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-xango-muted" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Paciente, clínica, voucher, conta..." className="w-full rounded-lg border border-xango-border py-2.5 pl-9 pr-3 text-sm font-normal text-xango-text outline-none focus:border-xango-primary" /></div>
          </label>
          <button type="button" onClick={() => { setInicio(mesAtual.inicio); setFim(mesAtual.fim); setClinicaId(""); setBusca(""); setTipoMovimentacao("TODOS"); }} className="flex items-center justify-center gap-2 rounded-lg border border-xango-border px-4 py-2.5 text-sm font-semibold text-xango-muted"><RotateCcw size={15} /> Mês atual</button>
        </div>
      </section>

      {erro && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{erro}</div>}

      {dados && (
        <>
          <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <Card titulo="Recebido bruto" valor={moeda(dados.resumo.recebidoBruto)} apoio={`${dados.resumo.quantidadeRecebimentos} recebimento(s)`} icone={<ArrowDownCircle size={20} />} onClick={() => abrirMovimentacoes("RECEBIMENTO")} />
            <Card titulo="Estornos" valor={moeda(dados.resumo.estornos)} apoio={`${dados.resumo.quantidadeEstornos} estorno(s)`} icone={<ArrowUpCircle size={20} />} onClick={() => abrirMovimentacoes("ESTORNO")} />
            <Card titulo="Tarifas" valor={moeda(dados.resumo.tarifasFinanceiras)} apoio="Custos das formas de recebimento" icone={<WalletCards size={20} />} onClick={() => abrirMovimentacoes("RECEBIMENTO")} />
            <Card titulo="Recebido líquido" valor={moeda(dados.resumo.recebidoLiquido)} apoio="Bruto menos estornos e tarifas" icone={<CircleDollarSign size={20} />} onClick={() => abrirMovimentacoes("TODOS")} />
            <Card titulo="A receber" valor={moeda(dados.resumo.aReceber)} apoio={`${dados.resumo.quantidadeGuiasAReceber} guia(s) com saldo`} icone={<Clock3 size={20} />} onClick={() => rolarPara(guiasRef)} alerta={alertaGuias} alertaTexto={alertaGuias ? "Volume alto: mais de 100 guias com saldo pendente." : undefined} />
            <Card titulo="Repasses a pagar" valor={moeda(dados.resumo.repassesAPagar)} apoio={`${dados.resumo.quantidadeRepassesAPagar} guia(s) confirmada(s)`} icone={<HandCoins size={20} />} onClick={() => router.push("/financeiro/repasses")} alerta={alertaRepasses} alertaTexto={alertaRepasses ? "Volume alto de repasses aguardando conclusão." : undefined} />
          </section>

          <section className="mt-6 rounded-xl border border-xango-border bg-white shadow-sm">
            <div className="border-b border-xango-border px-5 py-4">
              <h3 className="font-semibold text-xango-text">Saldos por conta</h3>
              <p className="mt-1 text-xs text-xango-muted">O saldo atual considera saldo inicial + entradas líquidas - saídas registradas. O filtro de clínica não altera o saldo bancário.</p>
            </div>
            {(dados.contas || []).length === 0 ? (
              <div className="p-8 text-center text-sm text-xango-muted">Cadastre as contas financeiras para acompanhar onde o dinheiro está entrando e saindo.</div>
            ) : (
              <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
                {dados.contas.map((conta) => (
                  <div key={conta.id} className={`rounded-xl border p-4 ${conta.ativo ? "border-xango-border" : "border-slate-200 bg-slate-50"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-semibold text-xango-text">{conta.nome}</p><p className="mt-1 text-xs text-xango-muted">{conta.tipoLabel}{conta.ativo ? "" : " • Inativa"}</p></div>
                      <Landmark size={18} className="text-xango-primary" />
                    </div>
                    <p className="mt-4 text-2xl font-bold text-xango-text">{moeda(conta.saldoAtual)}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-xango-border pt-3 text-xs">
                      <div><p className="text-xango-muted">Entradas no período</p><p className="mt-1 font-semibold text-emerald-700">{moeda(conta.entradasPeriodo)}</p></div>
                      <div><p className="text-xango-muted">Saídas no período</p><p className="mt-1 font-semibold text-red-700">{moeda(conta.saidasPeriodo)}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section ref={movimentacoesRef} className="mt-6 scroll-mt-6 overflow-hidden rounded-xl border border-xango-border bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-xango-border px-5 py-4">
              <div><h3 className="font-semibold text-xango-text">Movimentações do período</h3><p className="mt-1 text-xs text-xango-muted">Recebimentos e estornos efetivamente registrados.</p></div>
              <div className="flex flex-wrap gap-2">
                {([ ["TODOS", "Todos"], ["RECEBIMENTO", "Recebimentos"], ["ESTORNO", "Estornos"] ] as const).map(([valor, label]) => (
                  <button key={valor} type="button" onClick={() => setTipoMovimentacao(valor)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${tipoMovimentacao === valor ? "bg-xango-primary text-white" : "border border-xango-border bg-white text-xango-muted"}`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-310 text-left text-sm">
                <thead className="border-b border-xango-border bg-slate-50 text-xs uppercase tracking-wide text-xango-muted"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Paciente / voucher</th><th className="px-4 py-3">Clínica</th><th className="px-4 py-3">Forma / conta</th><th className="px-4 py-3 text-right">Bruto</th><th className="px-4 py-3 text-right">Tarifa</th><th className="px-4 py-3 text-right">Líquido</th></tr></thead>
                <tbody className="divide-y divide-xango-border">
                  {movimentacoes.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-xs text-xango-muted">{dataHora(item.data)}</td>
                      <td className="px-4 py-3"><p className="font-semibold text-xango-text">{item.paciente}</p><p className="mt-0.5 text-xs text-xango-muted">{item.codigoVoucher || `Guia #${item.guiaId}`}</p></td>
                      <td className="px-4 py-3 text-xango-muted">{item.clinica}</td>
                      <td className="px-4 py-3"><p className="font-medium text-xango-text">{item.formaRecebimento || item.formaLabel}{item.forma === "CARTAO_CREDITO" && item.parcelas > 1 ? ` • ${item.parcelas}x` : ""}</p><p className="mt-0.5 text-xs text-xango-muted">{[item.operadora, item.contaFinanceira ? `Conta: ${item.contaFinanceira}` : null].filter(Boolean).join(" • ") || "Sem conta vinculada"}</p></td>
                      <td className="px-4 py-3 text-right font-semibold text-xango-text">{moeda(item.valor)}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{item.tipo === "RECEBIMENTO" ? moeda(item.valorTarifa) : "-"}</td>
                      <td className={`px-4 py-3 text-right font-bold ${item.tipo === "ESTORNO" ? "text-red-700" : "text-emerald-700"}`}>{moeda(item.valorLiquido)}</td>
                    </tr>
                  ))}
                  {movimentacoes.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-xango-muted">Nenhuma movimentação encontrada.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section ref={guiasRef} className="mt-6 scroll-mt-6 overflow-hidden rounded-xl border border-xango-border bg-white shadow-sm">
            <div className="border-b border-xango-border px-5 py-4"><h3 className="font-semibold text-xango-text">Guias a receber</h3><p className="mt-1 text-xs text-xango-muted">Guias do período que ainda possuem saldo do paciente.</p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-230 text-left text-sm"><thead className="border-b border-xango-border bg-slate-50 text-xs uppercase tracking-wide text-xango-muted"><tr><th className="px-4 py-3">Paciente / voucher</th><th className="px-4 py-3">Clínica</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-right">Recebido</th><th className="px-4 py-3 text-right">Saldo</th></tr></thead><tbody className="divide-y divide-xango-border">{guias.map((item) => <tr key={item.guiaId}><td className="px-4 py-3"><p className="font-semibold text-xango-text">{item.paciente}</p><p className="mt-0.5 text-xs text-xango-muted">{item.codigoVoucher || `Guia #${item.guiaId}`} • {dataCurta(item.criadoEm)}</p></td><td className="px-4 py-3 text-xango-muted">{item.clinica}</td><td className="px-4 py-3 text-xango-muted">{statusGuiaLabel(item.status)}</td><td className="px-4 py-3 text-right">{moeda(item.valorFinal)}</td><td className="px-4 py-3 text-right text-emerald-700">{moeda(item.pagoLiquido)}</td><td className="px-4 py-3 text-right font-bold text-xango-primary">{moeda(item.saldo)}</td></tr>)}{guias.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-xango-muted">Nenhuma guia com saldo encontrada.</td></tr>}</tbody></table></div>
          </section>

          <section className="mt-6 overflow-hidden rounded-xl border border-xango-border bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-xango-border px-5 py-4"><div><h3 className="font-semibold text-xango-text">Repasses a pagar</h3><p className="mt-1 text-xs text-xango-muted">Guias confirmadas com repasse ainda pendente.</p></div><Link href="/financeiro/repasses" className="text-xs font-semibold text-xango-primary">Gerenciar repasses</Link></div>
            <div className="divide-y divide-xango-border">{repasses.map((item) => <button key={item.guiaId} type="button" onClick={() => abrirRepasseDaLista(item)} className="flex w-full flex-wrap items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"><div><p className="font-semibold text-xango-text">{item.paciente}</p><p className="mt-1 text-xs text-xango-muted"><Building2 size={12} className="mr-1 inline" />{item.clinica} • {item.codigoVoucher || `Guia #${item.guiaId}`} • {statusRepasseLabel(item.statusRepasse)}</p></div><div className="text-right"><p className="font-bold text-xango-primary">{moeda(item.saldo)}</p><p className="mt-1 text-xs text-xango-muted">de {moeda(item.valorPrevisto)}</p></div></button>)}{repasses.length === 0 && <div className="p-10 text-center text-sm text-xango-muted">Nenhum repasse pendente encontrado.</div>}</div>
          </section>
        </>
      )}
    </div>
  );
}
