"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarDays,
  Cake,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileWarning,
  Gift,
  HandCoins,
  Headphones,
  RefreshCw,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type DashboardResumo = {
  atendimentosAtivos: number;
  aguardandoAgendamento: number;
  aguardandoPagamento: number;
  agendados: number;
  pendencias: number;
  pendenciasCriticas: number;
  atrasados: number;
  concluidos: number;
  agendamentosHoje: number;
  recebidoHoje: number;
  recebidoMes: number;
  repassesPendentesQuantidade: number;
  repassesPendentesValor: number;
};

type AtendimentoRecente = {
  id: number;
  codigoPublico: string;
  paciente: string;
  procedimento: string;
  clinica: string;
  status: string;
  atualizado: string;
};

type AgendaItem = {
  itemGuiaId: number;
  atendimentoId: number;
  codigoPublico: string;
  horario: string;
  paciente: string;
  procedimento: string;
  clinica: string;
  status: string;
};

type Aniversariante = {
  id: number;
  codigoPublico: string | null;
  nome: string;
  tipo: string;
};

type Atrasado = {
  id: number;
  atendimentoId: number;
  codigoPublico: string;
  paciente: string;
  procedimento: string;
  clinica: string;
  dataAgendamento: string | null;
  horarioAgendamento: string | null;
};

type DashboardResponse = {
  geradoEm: string;
  financeiroVisivel: boolean;
  resumo: DashboardResumo;
  atendimentosRecentes: AtendimentoRecente[];
  agendaHoje: AgendaItem[];
  aniversariantesHoje: Aniversariante[];
  atrasadosDetalhes: Atrasado[];
};

const resumoVazio: DashboardResumo = {
  atendimentosAtivos: 0,
  aguardandoAgendamento: 0,
  aguardandoPagamento: 0,
  agendados: 0,
  pendencias: 0,
  pendenciasCriticas: 0,
  atrasados: 0,
  concluidos: 0,
  agendamentosHoje: 0,
  recebidoHoje: 0,
  recebidoMes: 0,
  repassesPendentesQuantidade: 0,
  repassesPendentesValor: 0,
};

function formatarMoeda(valor: number) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(valor: string | null) {
  if (!valor) return "—";
  return new Date(valor).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function statusClass(status: string) {
  if (status === "Pago e agendado" || status === "Concluído") return "bg-emerald-50 text-emerald-700";
  if (status === "Aguardando agendamento") return "bg-violet-50 text-violet-700";
  if (status === "Aguardando pagamento" || status === "Parcialmente pago") return "bg-amber-50 text-amber-700";
  if (status === "Estorno pendente") return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-700";
}

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { usuario, temPermissao } = useAuth();
  const [dados, setDados] = useState<DashboardResponse>({
    geradoEm: "",
    financeiroVisivel: false,
    resumo: resumoVazio,
    atendimentosRecentes: [],
    agendaHoje: [],
    aniversariantesHoje: [],
    atrasadosDetalhes: [],
  });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [atendimentoSelecionado, setAtendimentoSelecionado] = useState<AtendimentoRecente | null>(null);

  async function carregarDashboard() {
    try {
      setCarregando(true);
      setErro("");
      const resposta = await fetch(`${API_URL}/dashboard`, { cache: "no-store" });
      const tipo = resposta.headers.get("content-type") || "";
      if (!tipo.includes("application/json")) {
        const texto = await resposta.text();
        throw new Error(
          `A API respondeu em formato inesperado (${resposta.status}). ${texto.slice(0, 120)}`
        );
      }
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível carregar o dashboard.");

      // Compatibilidade defensiva: uma resposta parcial da API não derruba o Dashboard.
      setDados({
        geradoEm: resultado.geradoEm || "",
        financeiroVisivel: Boolean(resultado.financeiroVisivel),
        resumo: { ...resumoVazio, ...(resultado.resumo || {}) },
        atendimentosRecentes: Array.isArray(resultado.atendimentosRecentes)
          ? resultado.atendimentosRecentes
          : [],
        agendaHoje: Array.isArray(resultado.agendaHoje) ? resultado.agendaHoje : [],
        aniversariantesHoje: Array.isArray(resultado.aniversariantesHoje)
          ? resultado.aniversariantesHoje
          : [],
        atrasadosDetalhes: Array.isArray(resultado.atrasadosDetalhes)
          ? resultado.atrasadosDetalhes
          : [],
      });
    } catch (erro) {
      console.error("Erro ao carregar dashboard:", erro);
      setErro("Não foi possível carregar os dados do dashboard.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void carregarDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (searchParams.get("secao") !== "pendencias") return;
    const timer = window.setTimeout(() => {
      document.getElementById("pendencias")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [searchParams, carregando]);

  const agora = new Date();
  const dataCompleta = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(agora);
  const diaSemana = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone: "America/Sao_Paulo",
  }).format(agora);
  const diaSemanaFormatado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);

  const abrirAtendimentos = (filtro?: string) => {
    if (!filtro) return router.push("/atendimentos");
    router.push(`/atendimentos?filtro=${encodeURIComponent(filtro)}`);
  };

  const podeVerFinanceiro = temPermissao("financeiro.visualizar") && dados.financeiroVisivel;

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-8">
          <div>
            <h2 className="text-2xl font-bold text-xango-text">Olá, {usuario.nome.split(" ")[0]}! 👋</h2>
            <p className="mt-1 text-sm text-xango-muted">Aqui está o resumo da operação de {usuario.organizacao.nomeFantasia} hoje.</p>
          </div>
          <div className="mt-0.5 hidden border-l border-xango-border pl-6 lg:block">
            <p className="text-sm font-semibold capitalize text-xango-text">{dataCompleta}</p>
            <p className="mt-1 text-xs text-xango-muted">{diaSemanaFormatado}</p>
          </div>
        </div>
        <button type="button" onClick={() => void carregarDashboard()} disabled={carregando} className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary transition hover:bg-xango-background disabled:cursor-not-allowed disabled:opacity-50">
          <RefreshCw size={14} className={carregando ? "animate-spin" : ""} /> Atualizar dados
        </button>
      </div>

      {erro && <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3"><p className="text-sm font-medium text-red-700">{erro}</p></div>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div data-aprendiz="resumo-dashboard">
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            <DashboardMetric icon={<Headphones size={19} />} iconClass="bg-xango-primary text-white" value={carregando ? "—" : String(dados.resumo.atendimentosAtivos)} label="Atendimentos ativos" footer="Todos os atendimentos ainda não encerrados" onClick={() => abrirAtendimentos("Todos")} />
            <DashboardMetric icon={<Clock3 size={19} />} iconClass="bg-violet-600 text-white" value={carregando ? "—" : String(dados.resumo.aguardandoAgendamento)} label="Aguardando agendamento" footer="Ainda precisam de data ou horário" onClick={() => abrirAtendimentos("Aguardando agendamento")} />
            <DashboardMetric icon={<WalletCards size={19} />} iconClass="bg-amber-500 text-white" value={carregando ? "—" : String(dados.resumo.aguardandoPagamento)} label="Guias aguardando pagamento" footer="Inclui pagamentos parciais" onClick={() => router.push("/guias")} />
            <DashboardMetric icon={<CalendarCheck2 size={19} />} iconClass="bg-emerald-600 text-white" value={carregando ? "—" : String(dados.resumo.agendados)} label="Pagos e agendados" footer="Prontos para realização" onClick={() => abrirAtendimentos("Agendados")} />
            <DashboardMetric icon={<AlertTriangle size={19} />} iconClass="bg-red-600 text-white" value={carregando ? "—" : String(dados.resumo.pendenciasCriticas)} label="Pendências críticas" footer="Atrasos, estornos e repasses que exigem ação" onClick={() => document.getElementById("pendencias")?.scrollIntoView({ behavior: "smooth" })} />
            <DashboardMetric icon={<CalendarDays size={19} />} iconClass="bg-xango-primary text-white" value={carregando ? "—" : String(dados.resumo.agendamentosHoje)} label="Agendamentos hoje" footer="Procedimentos previstos para hoje" onClick={() => router.push("/agenda")} />
          </section>

          {podeVerFinanceiro && (
            <section className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3" data-aprendiz="resumo-financeiro-dashboard">
              <DashboardMetric icon={<DollarSign size={19} />} iconClass="bg-xango-accent text-white" value={carregando ? "—" : formatarMoeda(dados.resumo.recebidoHoje)} label="Recebido hoje" footer="Pagamentos menos estornos de hoje" onClick={() => router.push("/financeiro")} />
              <DashboardMetric icon={<CheckCircle2 size={19} />} iconClass="bg-emerald-600 text-white" value={carregando ? "—" : formatarMoeda(dados.resumo.recebidoMes)} label="Recebido no mês" footer="Pagamentos menos estornos do mês" onClick={() => router.push("/financeiro")} />
              <DashboardMetric icon={<HandCoins size={19} />} iconClass="bg-sky-600 text-white" value={carregando ? "—" : String(dados.resumo.repassesPendentesQuantidade)} label="Repasses pendentes" footer={`${formatarMoeda(dados.resumo.repassesPendentesValor)} aguardando conclusão`} onClick={() => router.push("/financeiro/repasses")} />
            </section>
          )}
          </div>

          <section className="mt-5 overflow-hidden rounded-lg border border-xango-border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-xango-border px-5 py-4">
              <div><h3 className="font-semibold text-xango-text">Atendimentos em andamento</h3><p className="mt-1 text-xs text-xango-muted">Últimos atendimentos ativos atualizados.</p></div>
              <button type="button" onClick={() => abrirAtendimentos()} className="text-sm font-semibold text-xango-primary hover:underline">Ver todos</button>
            </div>

            <div className="hidden grid-cols-[110px_minmax(130px,1.05fr)_minmax(160px,1.3fr)_minmax(120px,1fr)_140px] gap-3 bg-xango-background px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-xango-muted md:grid">
              <span>Atendimento</span><span>Paciente</span><span>Procedimento</span><span>Clínica</span><span>Status</span>
            </div>

            <div className="divide-y divide-xango-border">
              {!carregando && dados.atendimentosRecentes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAtendimentoSelecionado(item)}
                  className="grid w-full gap-2 px-4 py-4 text-left transition hover:bg-xango-background/60 md:grid-cols-[110px_minmax(130px,1.05fr)_minmax(160px,1.3fr)_minmax(120px,1fr)_140px] md:items-center md:gap-3"
                >
                  <div><p className="text-xs font-semibold text-xango-primary">{item.codigoPublico}</p><p className="mt-1 text-[10px] text-xango-muted">{item.atualizado}</p></div>
                  <p className="text-sm font-medium text-xango-text">{item.paciente}</p>
                  <p className="text-xs leading-5 text-xango-text">{item.procedimento}</p>
                  <p className="text-xs leading-5 text-xango-text">{item.clinica}</p>
                  <div><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${statusClass(item.status)}`}>{item.status}</span></div>
                </button>
              ))}
              {!carregando && dados.atendimentosRecentes.length === 0 && <p className="px-5 py-10 text-center text-sm text-xango-muted">Nenhum atendimento ativo no momento.</p>}
              {carregando && <p className="px-5 py-10 text-center text-sm text-xango-muted">Carregando atendimentos...</p>}
            </div>
          </section>

          <section id="pendencias" data-aprendiz="fila-pendencias" className="mt-5 scroll-mt-24 rounded-lg border border-xango-border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div><h3 className="font-semibold text-xango-text">Pendências que precisam de atenção</h3><p className="mt-1 text-xs text-xango-muted">Use esta área como fila de trabalho da equipe.</p></div>
              <button type="button" onClick={() => void carregarDashboard()} className="text-sm font-semibold text-xango-primary hover:underline">Atualizar</button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <AttentionCard icon={<AlertTriangle size={19} />} iconClass="bg-red-200 text-red-800" cardClass="bg-red-50" value={String(dados.resumo.atrasados)} title="Agendamentos atrasados" description="Data anterior a hoje e procedimento ainda não realizado." onClick={() => document.getElementById("atrasados-lista")?.scrollIntoView({ behavior: "smooth" })} />
              <AttentionCard icon={<Clock3 size={19} />} iconClass="bg-violet-200 text-violet-800" cardClass="bg-violet-50" value={String(dados.resumo.aguardandoAgendamento)} title="Aguardando agendamento" description="Atendimentos que ainda precisam de data ou horário." onClick={() => abrirAtendimentos("Aguardando agendamento")} />
              <AttentionCard icon={<UserRound size={19} />} iconClass="bg-amber-200 text-amber-800" cardClass="bg-amber-50" value={String(dados.resumo.aguardandoPagamento)} title="Guias aguardando pagamento" description="Guias sem quitação integral, incluindo pagamentos parciais." onClick={() => router.push("/guias")} />
              <AttentionCard icon={<FileWarning size={19} />} iconClass="bg-red-200 text-red-800" cardClass="bg-red-50" value={String(dados.resumo.pendencias)} title="Estornos pendentes" description="Valores que precisam de conferência ou regularização." onClick={() => router.push("/guias")} />
              {podeVerFinanceiro && <AttentionCard icon={<HandCoins size={19} />} iconClass="bg-sky-200 text-sky-800" cardClass="bg-sky-50" value={String(dados.resumo.repassesPendentesQuantidade)} title="Repasses pendentes" description={`${formatarMoeda(dados.resumo.repassesPendentesValor)} aguardando análise, aprovação ou pagamento.`} onClick={() => router.push("/financeiro/repasses")} />}
            </div>

            {dados.atrasadosDetalhes.length > 0 && (
              <div id="atrasados-lista" className="mt-5 overflow-hidden rounded-lg border border-red-200">
                <div className="border-b border-red-100 bg-red-50 px-4 py-3"><p className="text-sm font-semibold text-red-800">Agendamentos vencidos / atrasados</p><p className="mt-1 text-xs text-red-700">Confira estes casos antes das demais pendências.</p></div>
                <div className="divide-y divide-red-100">
                  {dados.atrasadosDetalhes.map((item) => (
                    <button key={item.id} type="button" onClick={() => router.push(`/atendimentos/${item.atendimentoId}`)} className="grid w-full gap-2 px-4 py-3 text-left hover:bg-red-50/50 md:grid-cols-[120px_1fr_1.2fr_1fr_110px] md:items-center">
                      <span className="text-xs font-semibold text-xango-primary">{item.codigoPublico}</span>
                      <span className="text-sm font-medium text-xango-text">{item.paciente}</span>
                      <span className="text-xs text-xango-text">{item.procedimento}</span>
                      <span className="text-xs text-xango-text">{item.clinica}</span>
                      <span className="text-xs font-semibold text-red-700">{formatarData(item.dataAgendamento)}{item.horarioAgendamento ? ` ${item.horarioAgendamento}` : ""}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <aside className="overflow-hidden rounded-lg border border-xango-border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-xango-border p-5">
              <div><h3 className="font-semibold text-xango-text">Agenda de hoje</h3><p className="mt-1 text-xs text-xango-muted">{dados.resumo.agendamentosHoje} {dados.resumo.agendamentosHoje === 1 ? "procedimento previsto" : "procedimentos previstos"}</p></div>
              <button type="button" onClick={() => router.push("/agenda")} className="rounded-lg border border-xango-border px-3 py-2 text-xs font-semibold text-xango-primary transition hover:bg-xango-background">Ver agenda</button>
            </div>
            <div className="p-4">
              <div className="space-y-0">
                {!carregando && dados.agendaHoje.map((item) => (
                  <button key={item.itemGuiaId} type="button" onClick={() => router.push(`/atendimentos/${item.atendimentoId}`)} className="group flex w-full gap-3 rounded-lg px-2 py-4 text-left transition hover:bg-xango-background">
                    <div className="w-12 shrink-0 pt-0.5"><p className="text-xs font-bold text-xango-text">{item.horario}</p></div>
                    <div className="relative min-w-0 flex-1 border-l border-xango-border pl-4">
                      <span className="absolute -left-1.25 top-1 h-2.5 w-2.5 rounded-full bg-xango-primary ring-4 ring-white" />
                      <p className="truncate text-sm font-semibold text-xango-text">{item.paciente}</p>
                      <p className="mt-1 text-xs text-xango-text">{item.procedimento}</p>
                      <p className="mt-1 text-[11px] text-xango-muted">{item.clinica}</p>
                      <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClass(item.status)}`}>{item.status}</span>
                    </div>
                  </button>
                ))}
                {!carregando && dados.agendaHoje.length === 0 && <div className="rounded-md border border-dashed border-xango-border px-4 py-8 text-center"><p className="text-sm font-medium text-xango-text">Nenhum agendamento para hoje.</p><p className="mt-1 text-xs text-xango-muted">Os agendamentos aparecerão aqui automaticamente.</p></div>}
                {carregando && <p className="py-8 text-center text-xs text-xango-muted">Carregando agenda...</p>}
              </div>
              {temPermissao("atendimentos.criar") && <button type="button" onClick={() => router.push("/atendimentos/novo")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-xango-primary px-4 py-3 text-xs font-semibold text-xango-primary transition hover:bg-xango-background"><CalendarDays size={16} />Novo atendimento</button>}
            </div>
          </aside>

          <section className="rounded-lg border border-xango-border bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-xango-accent text-white"><Cake size={17} /></div><div><h3 className="text-sm font-semibold text-xango-text">Aniversariantes do dia</h3><p className="text-[11px] text-xango-muted">Pacientes cadastrados</p></div></div>
              <span className="rounded-full bg-xango-background px-2.5 py-1 text-[11px] font-semibold text-xango-primary">{dados.aniversariantesHoje.length}</span>
            </div>
            <div className="space-y-1">
              {dados.aniversariantesHoje.map((pessoa) => <BirthdayPerson key={pessoa.id} nome={pessoa.nome} tipo={pessoa.tipo} />)}
              {!carregando && dados.aniversariantesHoje.length === 0 && <p className="rounded-md border border-dashed border-xango-border px-3 py-5 text-center text-xs text-xango-muted">Nenhum paciente aniversariando hoje.</p>}
            </div>
          </section>
        </div>
      </div>

      {atendimentoSelecionado && (
        <>
          <button aria-label="Fechar detalhes" type="button" onClick={() => setAtendimentoSelecionado(null)} className="fixed inset-0 z-40 bg-slate-900/20" />
          <aside className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-md overflow-y-auto border-l border-xango-border bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-xango-accent">Resumo do atendimento</p><h3 className="mt-1 text-xl font-bold text-xango-text">{atendimentoSelecionado.codigoPublico}</h3></div>
              <button type="button" onClick={() => setAtendimentoSelecionado(null)} className="rounded-md p-2 text-xango-muted hover:bg-xango-background"><X size={18} /></button>
            </div>
            <div className="mt-6 space-y-4 text-sm">
              <ResumoCampo titulo="Paciente" valor={atendimentoSelecionado.paciente} />
              <ResumoCampo titulo="Procedimento(s)" valor={atendimentoSelecionado.procedimento} />
              <ResumoCampo titulo="Clínica(s)" valor={atendimentoSelecionado.clinica} />
              <div><p className="text-xs font-semibold text-xango-muted">Status</p><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(atendimentoSelecionado.status)}`}>{atendimentoSelecionado.status}</span></div>
              <ResumoCampo titulo="Última atualização" valor={atendimentoSelecionado.atualizado} />
            </div>
            <button type="button" onClick={() => router.push(`/atendimentos/${atendimentoSelecionado.id}`)} className="mt-8 w-full rounded-md bg-xango-primary px-4 py-3 text-sm font-semibold text-white hover:bg-xango-primary-hover">Abrir atendimento</button>
          </aside>
        </>
      )}
    </div>
  );
}

function DashboardMetric({ icon, iconClass, value, label, footer, onClick, large = false }: { icon: React.ReactNode; iconClass: string; value: string; label: string; footer: string; onClick?: () => void; large?: boolean; }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${large ? "min-h-30 p-5" : "min-h-34.5 p-4"} rounded-lg border border-xango-border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="flex items-start gap-3">
        <div className={`${large ? "h-12 w-12" : "h-10 w-10"} flex shrink-0 items-center justify-center rounded-full ${iconClass}`}>{icon}</div>
        <div className="min-w-0">
          <p className={`${large ? "text-[28px]" : "text-[20px]"} font-bold leading-tight text-xango-text`}>{value}</p>
          <p className={`${large ? "text-[13px]" : "text-[12px]"} mt-1 leading-4.25 text-xango-muted`}>{label}</p>
        </div>
      </div>
      <p className={`${large ? "mt-4 text-[11px]" : "mt-3 text-[10px]"} leading-4 text-xango-muted`}>{footer}</p>
    </button>
  );
}

function AttentionCard({ icon, iconClass, cardClass, value, title, description, onClick }: { icon: React.ReactNode; iconClass: string; cardClass: string; value: string; title: string; description: string; onClick?: () => void; }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-start gap-3 rounded-lg border border-xango-border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${cardClass}`}><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClass}`}>{icon}</div><div className="min-w-0"><p className="text-lg font-bold text-xango-text">{value}</p><p className="mt-0.5 text-xs font-semibold leading-4 text-xango-text">{title}</p><p className="mt-1 text-[11px] leading-4 text-xango-muted">{description}</p></div></button>;
}

function BirthdayPerson({ nome, tipo }: { nome: string; tipo: string; }) {
  return <div className="flex w-full items-center justify-between rounded-md px-2 py-2"><div className="min-w-0"><p className="truncate text-xs font-semibold text-xango-text">{nome}</p><p className="mt-0.5 text-[10px] text-xango-muted">{tipo}</p></div><Gift size={15} className="shrink-0 text-xango-accent" /></div>;
}

function ResumoCampo({ titulo, valor }: { titulo: string; valor: string }) {
  return <div><p className="text-xs font-semibold text-xango-muted">{titulo}</p><p className="mt-1 leading-6 text-xango-text">{valor}</p></div>;
}
