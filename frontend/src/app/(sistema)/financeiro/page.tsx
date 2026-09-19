"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  HandCoins,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  WalletCards,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type Resumo = {
  recebidoBruto: number;
  estornos: number;
  recebidoLiquido: number;
  aReceber: number;
  repassesAPagar: number;
  quantidadeRecebimentos: number;
  quantidadeEstornos: number;
  quantidadeGuiasAReceber: number;
  quantidadeRepassesAPagar: number;
};

type Clinica = { id: number; nome: string };

type Movimentacao = {
  id: string;
  tipo: "RECEBIMENTO" | "ESTORNO";
  data: string;
  valor: number;
  forma: string;
  formaLabel: string;
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
  movimentacoes: Movimentacao[];
  guiasAReceber: GuiaAReceber[];
  repassesAPagar: RepasseAPagar[];
};

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

  function acionarPorTeclado(evento: React.KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return;
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      onClick();
    }
  }

  return (
    <div
      role={clicavel ? "button" : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onClick={onClick}
      onKeyDown={clicavel ? acionarPorTeclado : undefined}
      className={`min-w-0 rounded-xl border p-5 shadow-sm transition ${
        alerta
          ? "border-red-300 bg-red-50"
          : "border-xango-border bg-white"
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
          {alerta && alertaTexto && (
            <p className="mt-2 text-xs font-semibold text-red-700">{alertaTexto}</p>
          )}
        </div>
        <div className={`shrink-0 rounded-lg p-2.5 ${alerta ? "bg-red-100 text-red-700" : "bg-xango-background text-xango-primary"}`}>
          {icone}
        </div>
      </div>
      {clicavel && (
        <div className={`mt-3 flex items-center justify-end gap-1 text-[11px] font-semibold ${alerta ? "text-red-700" : "text-xango-primary"}`}>
          Abrir
          <ChevronRight size={13} />
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
    void carregar();
  }, [carregar]);

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const movimentacoesBuscadas = useMemo(
    () =>
      (dados?.movimentacoes || []).filter((item) =>
        !termo ||
        [item.paciente, item.clinica, item.codigoVoucher || "", item.formaLabel]
          .some((texto) => texto.toLocaleLowerCase("pt-BR").includes(termo))
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
        !termo ||
        [item.paciente, item.clinica, item.codigoVoucher || ""]
          .some((texto) => texto.toLocaleLowerCase("pt-BR").includes(termo))
      ),
    [dados, termo]
  );
  const repasses = useMemo(
    () =>
      (dados?.repassesAPagar || []).filter((item) =>
        !termo ||
        [item.paciente, item.clinica, item.codigoVoucher || ""]
          .some((texto) => texto.toLocaleLowerCase("pt-BR").includes(termo))
      ),
    [dados, termo]
  );

  const alertaGuias = (dados?.resumo.quantidadeGuiasAReceber || 0) > 100;
  const quantidadeRepassesSolicitados = useMemo(
    () => (dados?.repassesAPagar || []).filter((item) =>
      ["SOLICITADO", "EM_ANALISE", "APROVADO"].includes(item.statusRepasse || "")
    ).length,
    [dados]
  );
  const alertaRepasses = quantidadeRepassesSolicitados > 50;

  function rolarPara(ref: React.RefObject<HTMLElement | null>) {
    window.requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
        <Loader2 size={20} className="mr-2 animate-spin" />
        Carregando painel financeiro...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-375 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-xango-text">Financeiro</h2>
          <p className="mt-1 text-sm text-xango-muted">
            Recebimentos, valores pendentes, estornos e repasses da operação Digna.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/financeiro/repasses"
            className="flex items-center gap-2 rounded-lg bg-xango-primary px-4 py-2.5 text-sm font-semibold text-white"
          >
            <HandCoins size={16} />
            Gerenciar repasses
          </Link>
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={carregando}
            className="flex items-center gap-2 rounded-lg border border-xango-border bg-white px-4 py-2.5 text-sm font-semibold text-xango-primary disabled:opacity-50"
          >
            <RefreshCw size={16} className={carregando ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-xango-border bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[160px_160px_minmax(220px,1fr)_minmax(260px,1fr)_auto] lg:items-end">
          <label className="text-xs font-semibold text-xango-muted">
            De
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="mt-1 w-full rounded-lg border border-xango-border px-3 py-2.5 text-sm font-normal text-xango-text outline-none focus:border-xango-primary"
            />
          </label>
          <label className="text-xs font-semibold text-xango-muted">
            Até
            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="mt-1 w-full rounded-lg border border-xango-border px-3 py-2.5 text-sm font-normal text-xango-text outline-none focus:border-xango-primary"
            />
          </label>
          <label className="text-xs font-semibold text-xango-muted">
            Clínica
            <select
              value={clinicaId}
              onChange={(e) => setClinicaId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-xango-border bg-white px-3 py-2.5 text-sm font-normal text-xango-text outline-none focus:border-xango-primary"
            >
              <option value="">Todas as clínicas</option>
              {(dados?.clinicas || []).map((clinica) => (
                <option key={clinica.id} value={clinica.id}>{clinica.nome}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-xango-muted">
            Busca
            <div className="relative mt-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-xango-muted" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Paciente, clínica, voucher..."
                className="w-full rounded-lg border border-xango-border py-2.5 pl-9 pr-3 text-sm font-normal text-xango-text outline-none focus:border-xango-primary"
              />
            </div>
          </label>
          <button
            type="button"
            onClick={() => {
              setInicio(mesAtual.inicio);
              setFim(mesAtual.fim);
              setClinicaId("");
              setBusca("");
              setTipoMovimentacao("TODOS");
            }}
            className="flex items-center justify-center gap-2 rounded-lg border border-xango-border px-4 py-2.5 text-sm font-semibold text-xango-muted"
          >
            <RotateCcw size={15} />
            Mês atual
          </button>
        </div>
      </section>

      {erro && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {erro}
        </div>
      )}

      {dados && (
        <>
          <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card
              titulo="Recebido bruto"
              valor={moeda(dados.resumo.recebidoBruto)}
              apoio={`${dados.resumo.quantidadeRecebimentos} recebimento(s) no período`}
              icone={<ArrowDownCircle size={20} />}
              onClick={() => abrirMovimentacoes("RECEBIMENTO")}
            />
            <Card
              titulo="Estornos"
              valor={moeda(dados.resumo.estornos)}
              apoio={`${dados.resumo.quantidadeEstornos} estorno(s) no período`}
              icone={<ArrowUpCircle size={20} />}
              onClick={() => abrirMovimentacoes("ESTORNO")}
            />
            <Card
              titulo="Recebido líquido"
              valor={moeda(dados.resumo.recebidoLiquido)}
              apoio="Recebimentos menos estornos do período"
              icone={<CircleDollarSign size={20} />}
              onClick={() => abrirMovimentacoes("TODOS")}
            />
            <Card
              titulo="A receber"
              valor={moeda(dados.resumo.aReceber)}
              apoio={`${dados.resumo.quantidadeGuiasAReceber} guia(s) do período com saldo`}
              icone={<Clock3 size={20} />}
              onClick={() => rolarPara(guiasRef)}
              alerta={alertaGuias}
              alertaTexto={alertaGuias ? "Volume alto: mais de 100 guias com saldo pendente." : undefined}
            />
            <Card
              titulo="Repasses a pagar"
              valor={moeda(dados.resumo.repassesAPagar)}
              apoio={`${dados.resumo.quantidadeRepassesAPagar} guia(s) confirmada(s) no período`}
              icone={<WalletCards size={20} />}
              onClick={() => router.push("/financeiro/repasses")}
              alerta={alertaRepasses}
              alertaTexto={alertaRepasses ? "Volume alto: mais de 50 repasses solicitados aguardando conclusão." : undefined}
            />
          </section>

          <section ref={movimentacoesRef} className="mt-6 scroll-mt-6 overflow-hidden rounded-xl border border-xango-border bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-xango-border px-5 py-4">
              <div>
                <h3 className="font-semibold text-xango-text">Movimentações do período</h3>
                <p className="mt-1 text-xs text-xango-muted">Recebimentos e estornos efetivamente registrados.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {([
                  ["TODOS", "Todos"],
                  ["RECEBIMENTO", "Recebimentos"],
                  ["ESTORNO", "Estornos"],
                ] as const).map(([valor, label]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setTipoMovimentacao(valor)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      tipoMovimentacao === valor
                        ? "bg-xango-primary text-white"
                        : "bg-xango-background text-xango-primary hover:bg-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <span className="rounded-full bg-xango-background px-3 py-1 text-xs font-semibold text-xango-primary">
                  {movimentacoes.length} registro(s)
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-270 w-full text-left text-sm">
                <thead className="border-b border-xango-border bg-slate-50 text-xs uppercase tracking-wide text-xango-muted">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Paciente / voucher</th>
                    <th className="px-4 py-3">Clínica</th>
                    <th className="px-4 py-3">Forma</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-xango-border">
                  {movimentacoes.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-xango-muted">Nenhuma movimentação encontrada neste período.</td></tr>
                  ) : movimentacoes.map((item) => (
                    <tr
                      key={item.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => router.push(`/guias/${item.guiaId}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/guias/${item.guiaId}`);
                        }
                      }}
                      className="cursor-pointer transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-xango-muted">{dataHora(item.data)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.tipo === "RECEBIMENTO" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>
                          {item.tipo === "RECEBIMENTO" ? "Recebimento" : "Estorno"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-xango-text">{item.paciente}</p>
                        <p className="mt-0.5 text-xs text-xango-muted">{item.codigoVoucher || `Guia #${item.guiaId}`}</p>
                      </td>
                      <td className="px-4 py-3 text-xango-text">{item.clinica}</td>
                      <td className="px-4 py-3 text-xango-muted">{item.formaLabel}</td>
                      <td className={`px-4 py-3 text-right font-bold ${item.tipo === "RECEBIMENTO" ? "text-emerald-700" : "text-red-700"}`}>
                        <span className="inline-flex items-center gap-1">
                          {item.tipo === "ESTORNO" ? "- " : ""}{moeda(item.valor)}
                          <ChevronRight size={14} className="text-xango-muted" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section ref={guiasRef} className={`scroll-mt-6 overflow-hidden rounded-xl border bg-white shadow-sm ${alertaGuias ? "border-red-300" : "border-xango-border"}`}>
              <div className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${alertaGuias ? "border-red-200 bg-red-50" : "border-xango-border"}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-xango-text">Guias a receber</h3>
                    {alertaGuias && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                        <AlertTriangle size={13} /> Volume alto
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-xango-muted">Saldo atual das guias criadas no período selecionado.</p>
                </div>
                <CalendarDays size={20} className="text-xango-primary" />
              </div>
              <div className="max-h-120 overflow-auto">
                {guias.length === 0 ? (
                  <div className="p-8 text-center text-sm text-xango-muted">Nenhuma guia com saldo pendente.</div>
                ) : guias.map((guia) => (
                  <div
                    key={guia.guiaId}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/guias/${guia.guiaId}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/guias/${guia.guiaId}`);
                      }
                    }}
                    className="group cursor-pointer border-b border-xango-border p-4 transition last:border-b-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-xango-text">{guia.paciente}</p>
                        <p className="mt-1 text-xs text-xango-muted">{guia.clinica} • {guia.codigoVoucher || `Guia #${guia.guiaId}`}</p>
                        <p className="mt-1 text-xs text-xango-muted">{dataCurta(guia.criadoEm)} • {statusGuiaLabel(guia.status)}</p>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <div>
                          <p className="text-lg font-bold text-amber-700">{moeda(guia.saldo)}</p>
                          <p className="mt-1 text-xs text-xango-muted">de {moeda(guia.valorFinal)}</p>
                        </div>
                        <ChevronRight size={18} className="text-xango-muted transition group-hover:translate-x-0.5 group-hover:text-xango-primary" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={`overflow-hidden rounded-xl border bg-white shadow-sm ${alertaRepasses ? "border-red-300" : "border-xango-border"}`}>
              <div className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${alertaRepasses ? "border-red-200 bg-red-50" : "border-xango-border"}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-xango-text">Repasses a pagar</h3>
                    {alertaRepasses && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                        <AlertTriangle size={13} /> Volume alto
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-xango-muted">Guias confirmadas no período ainda com repasse pendente.</p>
                </div>
                <Building2 size={20} className="text-xango-primary" />
              </div>
              <div className="max-h-120 overflow-auto">
                {repasses.length === 0 ? (
                  <div className="p-8 text-center text-sm text-xango-muted">Nenhum repasse pendente no período.</div>
                ) : repasses.map((repasse) => (
                  <div
                    key={repasse.guiaId}
                    role="link"
                    tabIndex={0}
                    onClick={() => abrirRepasseDaLista(repasse)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        abrirRepasseDaLista(repasse);
                      }
                    }}
                    className="group cursor-pointer border-b border-xango-border p-4 transition last:border-b-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-xango-text">{repasse.clinica}</p>
                        <p className="mt-1 text-xs text-xango-muted">{repasse.paciente} • {repasse.codigoVoucher || `Guia #${repasse.guiaId}`}</p>
                        <p className="mt-1 text-xs text-xango-muted">Confirmado em {dataCurta(repasse.confirmadoEm)} • {statusRepasseLabel(repasse.statusRepasse)}</p>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <div>
                          <p className="text-lg font-bold text-xango-primary">{moeda(repasse.saldo)}</p>
                          <p className="mt-1 text-xs text-xango-muted">previsto {moeda(repasse.valorPrevisto)}</p>
                        </div>
                        <ChevronRight size={18} className="text-xango-muted transition group-hover:translate-x-0.5 group-hover:text-xango-primary" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
