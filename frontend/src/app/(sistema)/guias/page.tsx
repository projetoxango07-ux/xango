"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  MapPin,
  Printer,
  RefreshCw,
  Search,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type Guia = {
  id: number;
  codigoPublico: string | null;
  status: string;
  criadoEm: string;
  atualizadoEm: string;
  emitidaEm: string | null;
  validadeAte: string | null;
  confirmadaEm: string | null;
  realizadaEm: string | null;
  atendimento: {
    id: number;
    codigoPublico: string | null;
    status: string;
  };
  paciente: {
    id: number;
    codigoPublico: string | null;
    nome: string;
    cpf: string;
    telefone: string;
  };
  clinica: {
    id: number;
    nome: string;
  };
  unidade: {
    id: number;
    nome: string;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
  } | null;
  procedimentos: {
    id: number;
    nome: string;
    valorPaciente: number;
    valorRepasse: number;
  }[];
  itensCancelados: {
    id: number;
    procedimento: string;
    motivoCancelamento: string | null;
  }[];
  agendamentos: {
    itemGuiaId: number;
    procedimentoId: number;
    procedimento: string;
    tipoAgendamento: "HORARIO" | "ORDEM_CHEGADA" | null;
    dataAgendamento: string | null;
    horarioAgendamento: string | null;
  }[];
  financeiro: {
    subtotal: number;
    desconto: number;
    beneficio: number;
    valorFinal: number;
    totalPago: number;
    totalEstornado: number;
    pagoLiquido: number;
    saldo: number;
  };
  podeImprimir: boolean;
};

const filtros = [
  "Todas",
  "Aguardando pagamento",
  "Parcialmente pagas",
  "Pagas",
  "Estorno pendente",
  "Canceladas",
] as const;

type Filtro = (typeof filtros)[number];

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, "");
}

function formatarCpf(valor: string) {
  const n = somenteNumeros(valor);
  if (n.length !== 11) return valor;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

function formatarTelefone(valor: string) {
  const n = somenteNumeros(valor);
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return valor;
}

function statusLabel(status: string) {
  switch (status) {
    case "RASCUNHO": return "Rascunho";
    case "AGUARDANDO_PAGAMENTO": return "Aguardando pagamento";
    case "PARCIALMENTE_PAGA": return "Parcialmente paga";
    case "PAGA": return "Paga";
    case "ESTORNO_PENDENTE": return "Estorno pendente";
    case "CANCELADA": return "Cancelada";
    default: return status;
  }
}

function statusClass(status: string) {
  if (status === "PAGA") return "bg-emerald-100 text-emerald-800";
  if (status === "PARCIALMENTE_PAGA") return "bg-blue-100 text-blue-800";
  if (status === "AGUARDANDO_PAGAMENTO" || status === "RASCUNHO") {
    return "bg-amber-100 text-amber-800";
  }
  if (status === "ESTORNO_PENDENTE" || status === "CANCELADA") {
    return "bg-red-100 text-red-700";
  }
  return "bg-slate-100 text-slate-700";
}

function correspondeFiltro(guia: Guia, filtro: Filtro) {
  if (filtro === "Todas") return true;
  if (filtro === "Aguardando pagamento") {
    return guia.status === "AGUARDANDO_PAGAMENTO" || guia.status === "RASCUNHO";
  }
  if (filtro === "Parcialmente pagas") return guia.status === "PARCIALMENTE_PAGA";
  if (filtro === "Pagas") return guia.status === "PAGA";
  if (filtro === "Estorno pendente") return guia.status === "ESTORNO_PENDENTE";
  return guia.status === "CANCELADA";
}

function dataBr(valor: string | null) {
  if (!valor) return "";
  return new Date(valor).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function hojeInput() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function enderecoUnidade(guia: Guia) {
  if (!guia.unidade) return "";
  const linha1 = [guia.unidade.logradouro, guia.unidade.numero]
    .filter(Boolean)
    .join(", ");
  const linha2 = [guia.unidade.bairro, guia.unidade.cidade, guia.unidade.uf]
    .filter(Boolean)
    .join(" • ");
  return [linha1, linha2].filter(Boolean).join(" — ");
}

function resumoAgendamento(guia: Guia) {
  const ativos = guia.agendamentos.filter((item) => item.dataAgendamento);
  if (ativos.length === 0) return "Aguardando agendamento";

  const primeiro = ativos[0];
  if (primeiro.tipoAgendamento === "ORDEM_CHEGADA") {
    return `${dataBr(primeiro.dataAgendamento)} • ordem de chegada`;
  }

  return `${dataBr(primeiro.dataAgendamento)}${
    primeiro.horarioAgendamento ? ` às ${primeiro.horarioAgendamento}` : ""
  }`;
}

export default function GuiasPage() {
  const router = useRouter();
  const [guias, setGuias] = useState<Guia[]>([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("Todas");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [selecionada, setSelecionada] = useState<Guia | null>(null);
  const [dataRealizacao, setDataRealizacao] = useState(hojeInput());
  const [confirmandoRealizacao, setConfirmandoRealizacao] = useState(false);

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");
      const resposta = await fetch(`${API_URL}/guias`, {
        cache: "no-store",
        credentials: "include",
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Não foi possível carregar as guias.");
      }
      setGuias(Array.isArray(dados) ? dados : []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar as guias.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || guias.length === 0) return;

    const guiaId = Number(new URLSearchParams(window.location.search).get("guia"));
    if (!Number.isInteger(guiaId) || guiaId <= 0) return;

    const guiaDaUrl = guias.find((guia) => guia.id === guiaId);
    if (guiaDaUrl && selecionada?.id !== guiaDaUrl.id) {
      setSelecionada(guiaDaUrl);
    }
  }, [guias, selecionada?.id]);

  useEffect(() => {
    if (selecionada && !selecionada.confirmadaEm) {
      setDataRealizacao(hojeInput());
    }
  }, [selecionada?.id, selecionada?.confirmadaEm]);

  function fecharDetalhes() {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("guia")) {
        url.searchParams.delete("guia");
        window.history.replaceState(
          window.history.state,
          "",
          `${url.pathname}${url.search}${url.hash}`
        );
      }
    }

    setSelecionada(null);
  }

  async function confirmarAtendimentoRealizado() {
    if (!selecionada || confirmandoRealizacao) return;

    if (selecionada.status !== "PAGA" || selecionada.financeiro.saldo > 0.009) {
      alert("A guia precisa estar totalmente quitada antes da confirmação do atendimento.");
      return;
    }

    if (!dataRealizacao) {
      alert("Informe a data em que o atendimento foi realizado.");
      return;
    }

    const data = new Date(`${dataRealizacao}T12:00:00`);
    if (Number.isNaN(data.getTime())) {
      alert("Informe uma data de realização válida.");
      return;
    }

    const confirmou = window.confirm(
      `Confirmar que o atendimento da guia ${selecionada.codigoPublico || `#${selecionada.id}`} foi realizado em ${data.toLocaleDateString("pt-BR")}?`
    );

    if (!confirmou) return;

    try {
      setConfirmandoRealizacao(true);

      const resposta = await fetch(
        `${API_URL}/guias/${selecionada.id}/confirmar-realizacao`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            realizadaEm: data.toISOString(),
          }),
        }
      );

      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Não foi possível confirmar o atendimento realizado.");
      }

      alert("Atendimento realizado confirmado com sucesso.");
      fecharDetalhes();
      await carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Não foi possível confirmar o atendimento realizado.");
    } finally {
      setConfirmandoRealizacao(false);
    }
  }

  const guiasFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const numeros = somenteNumeros(busca);

    return guias.filter((guia) => {
      if (!correspondeFiltro(guia, filtro)) return false;
      if (!termo) return true;

      const texto = [
        guia.codigoPublico,
        guia.atendimento.codigoPublico,
        guia.paciente.codigoPublico,
        guia.paciente.nome,
        guia.paciente.cpf,
        guia.paciente.telefone,
        guia.clinica.nome,
        guia.unidade?.nome,
        ...guia.procedimentos.map((procedimento) => procedimento.nome),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      return (
        texto.includes(termo) ||
        (numeros.length > 0 && somenteNumeros(texto).includes(numeros))
      );
    });
  }, [guias, busca, filtro]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-xango-text">Guias</h2>
          <p className="mt-1 text-sm text-xango-muted">
            Consulte vouchers emitidos, situação financeira, agendamento, confirmação e reimpressão.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void carregar()}
          disabled={carregando}
          className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary disabled:opacity-50"
        >
          <RefreshCw size={14} className={carregando ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {erro && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="relative">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-xango-muted" />
        <input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Pesquisar por voucher, atendimento, paciente, CPF, telefone, clínica, unidade ou procedimento..."
          className="w-full rounded-md border border-xango-border bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-xango-primary"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {filtros.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFiltro(item)}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
              filtro === item
                ? "border-xango-primary bg-xango-primary text-white"
                : "border-xango-border bg-white text-xango-text hover:bg-xango-background"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <section className="mt-4 overflow-hidden rounded-lg border border-xango-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="bg-xango-background text-xs text-xango-muted">
              <tr>
                <th className="px-3 py-3">Voucher</th>
                <th className="px-3 py-3">Paciente</th>
                <th className="px-3 py-3">Procedimento(s)</th>
                <th className="px-3 py-3">Clínica / Unidade</th>
                <th className="px-3 py-3">Agendamento</th>
                <th className="px-3 py-3">Financeiro</th>
                <th className="px-3 py-3">Status</th>
                <th className="sticky right-0 z-20 bg-xango-background px-3 py-3 text-right shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-xango-border">
              {carregando && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-xango-muted">
                    Carregando guias...
                  </td>
                </tr>
              )}

              {!carregando && guiasFiltradas.map((guia) => (
                <tr
                  key={guia.id}
                  onClick={() => setSelecionada(guia)}
                  className="group cursor-pointer transition hover:bg-xango-background/60"
                >
                  <td className="px-3 py-4 align-top">
                    <p className="font-semibold text-xango-primary">
                      {guia.codigoPublico || `#${guia.id}`}
                    </p>
                    <p className="mt-1 text-[11px] text-xango-muted">
                      {guia.atendimento.codigoPublico || `Atendimento #${guia.atendimento.id}`}
                    </p>
                  </td>

                  <td className="px-3 py-4 align-top">
                    <p className="font-medium text-xango-text">{guia.paciente.nome}</p>
                    <p className="mt-1 text-xs text-xango-muted">{formatarTelefone(guia.paciente.telefone)}</p>
                  </td>

                  <td className="px-3 py-4 align-top">
                    {guia.procedimentos.length > 0 ? (
                      <div className="space-y-1">
                        {guia.procedimentos.slice(0, 2).map((procedimento) => (
                          <p key={procedimento.id} className="text-sm text-xango-text">
                            {procedimento.nome}
                          </p>
                        ))}
                        {guia.procedimentos.length > 2 && (
                          <p className="text-xs text-xango-muted">+ {guia.procedimentos.length - 2} procedimento(s)</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-xango-muted">Sem procedimentos ativos</span>
                    )}
                  </td>

                  <td className="px-3 py-4 align-top">
                    <p className="text-sm font-medium text-xango-text">{guia.clinica.nome}</p>
                    {guia.unidade && (
                      <p className="mt-1 text-xs text-xango-muted">{guia.unidade.nome}</p>
                    )}
                  </td>

                  <td className="px-3 py-4 align-top text-sm text-xango-text">
                    {resumoAgendamento(guia)}
                  </td>

                  <td className="px-3 py-4 align-top">
                    <p className="font-semibold text-xango-text">{moeda(guia.financeiro.valorFinal)}</p>
                    <p className={`mt-1 text-xs ${guia.financeiro.saldo > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                      {guia.financeiro.saldo > 0
                        ? `Saldo ${moeda(guia.financeiro.saldo)}`
                        : "Quitada"}
                    </p>
                  </td>

                  <td className="px-3 py-4 align-top">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(guia.status)}`}>
                      {statusLabel(guia.status)}
                    </span>
                  </td>

                  <td className="sticky right-0 z-10 bg-white px-3 py-4 align-top text-right shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)] group-hover:bg-xango-background">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        title="Abrir atendimento"
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/atendimentos/${guia.atendimento.id}?modo=revisao`);
                        }}
                        className="rounded-md border border-xango-border p-2 text-xango-primary hover:bg-xango-background"
                      >
                        <ExternalLink size={15} />
                      </button>

                      {guia.podeImprimir && (
                        <button
                          type="button"
                          title="Imprimir / reimprimir voucher"
                          onClick={(event) => {
                            event.stopPropagation();
                            window.open(`/impressao/guia/${guia.id}`, "_blank", "noopener,noreferrer");
                          }}
                          className="rounded-md border border-xango-border p-2 text-xango-primary hover:bg-xango-background"
                        >
                          <Printer size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!carregando && guiasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center">
                    <FileText size={32} className="mx-auto text-xango-muted/50" />
                    <p className="mt-3 text-sm font-semibold text-xango-text">Nenhuma guia encontrada</p>
                    <p className="mt-1 text-xs text-xango-muted">Altere a busca ou o filtro selecionado.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selecionada && (
        <>
          <button
            type="button"
            aria-label="Fechar detalhes"
            onClick={fecharDetalhes}
            className="fixed inset-0 z-40 bg-black/25"
          />

          <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-xango-primary">Voucher</p>
                <h3 className="mt-1 text-xl font-semibold text-xango-text">
                  {selecionada.codigoPublico || `#${selecionada.id}`}
                </h3>
                <p className="mt-1 text-xs text-xango-muted">
                  {selecionada.atendimento.codigoPublico || `Atendimento #${selecionada.atendimento.id}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(selecionada.status)}`}>
                  {statusLabel(selecionada.status)}
                </span>
                <button
                  type="button"
                  aria-label="Fechar detalhes"
                  onClick={fecharDetalhes}
                  className="rounded-md border border-xango-border p-2 text-xango-muted transition hover:bg-xango-background hover:text-xango-text"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-xango-border p-4">
                <div className="flex items-center gap-2 text-xango-primary">
                  <UserRound size={16} />
                  <p className="text-xs font-semibold uppercase tracking-wide">Paciente</p>
                </div>
                <p className="mt-2 font-semibold text-xango-text">{selecionada.paciente.nome}</p>
                <p className="mt-1 text-xs text-xango-muted">
                  CPF {formatarCpf(selecionada.paciente.cpf)} • {formatarTelefone(selecionada.paciente.telefone)}
                </p>
              </div>

              <div className="rounded-lg border border-xango-border p-4">
                <div className="flex items-center gap-2 text-xango-primary">
                  <MapPin size={16} />
                  <p className="text-xs font-semibold uppercase tracking-wide">Local de atendimento</p>
                </div>
                <p className="mt-2 font-semibold text-xango-text">{selecionada.clinica.nome}</p>
                {selecionada.unidade && (
                  <>
                    <p className="mt-1 text-sm font-medium text-xango-text">{selecionada.unidade.nome}</p>
                    {enderecoUnidade(selecionada) && (
                      <p className="mt-1 text-xs text-xango-muted">{enderecoUnidade(selecionada)}</p>
                    )}
                  </>
                )}
              </div>

              <div className="rounded-lg border border-xango-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">Procedimentos</p>
                <div className="mt-3 divide-y divide-xango-border">
                  {selecionada.procedimentos.map((procedimento) => (
                    <div key={procedimento.id} className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
                      <p className="text-sm text-xango-text">{procedimento.nome}</p>
                      <p className="text-sm font-semibold text-xango-text">{moeda(procedimento.valorPaciente)}</p>
                    </div>
                  ))}
                  {selecionada.procedimentos.length === 0 && (
                    <p className="text-sm text-xango-muted">Nenhum procedimento ativo.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-xango-border p-4">
                <div className="flex items-center gap-2 text-xango-primary">
                  <CalendarDays size={16} />
                  <p className="text-xs font-semibold uppercase tracking-wide">Agendamento</p>
                </div>
                <p className="mt-2 text-sm text-xango-text">{resumoAgendamento(selecionada)}</p>
              </div>

              <div className="rounded-lg border border-xango-border p-4">
                <div className="flex items-center gap-2 text-xango-primary">
                  <WalletCards size={16} />
                  <p className="text-xs font-semibold uppercase tracking-wide">Financeiro</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-xango-muted">Valor da guia</p>
                    <p className="mt-1 font-semibold text-xango-text">{moeda(selecionada.financeiro.valorFinal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-xango-muted">Pago líquido</p>
                    <p className="mt-1 font-semibold text-emerald-700">{moeda(selecionada.financeiro.pagoLiquido)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-xango-muted">Estornado</p>
                    <p className="mt-1 font-semibold text-red-600">{moeda(selecionada.financeiro.totalEstornado)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-xango-muted">Saldo</p>
                    <p className="mt-1 font-semibold text-xango-text">{moeda(selecionada.financeiro.saldo)}</p>
                  </div>
                </div>
              </div>

              {selecionada.confirmadaEm ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 size={17} />
                    <p className="text-xs font-semibold uppercase tracking-wide">Atendimento confirmado</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-emerald-900">
                    Procedimento realizado em {dataBr(selecionada.realizadaEm || selecionada.confirmadaEm)}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Confirmação registrada em {new Date(selecionada.confirmadaEm).toLocaleString("pt-BR")}
                  </p>
                </div>
              ) : selecionada.status === "PAGA" && selecionada.financeiro.saldo <= 0.009 && selecionada.procedimentos.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-amber-800">
                    <CheckCircle2 size={17} />
                    <p className="text-xs font-semibold uppercase tracking-wide">Confirmar atendimento realizado</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-amber-800">
                    Use esta confirmação somente depois que a clínica informar que o procedimento foi realizado. Na V2, a própria clínica fará esta etapa pelo Portal Parceiro.
                  </p>
                  <label className="mt-3 block text-xs font-semibold text-xango-text">
                    Data da realização
                    <input
                      type="date"
                      value={dataRealizacao}
                      onChange={(event) => setDataRealizacao(event.target.value)}
                      className="mt-1 w-full rounded-md border border-xango-border bg-white px-3 py-2 text-sm font-normal outline-none focus:border-xango-primary"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void confirmarAtendimentoRealizado()}
                    disabled={confirmandoRealizacao}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    {confirmandoRealizacao ? "Confirmando..." : "Confirmar atendimento realizado"}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap gap-2 border-t border-xango-border pt-5">
              <button
                type="button"
                onClick={() => router.push(`/atendimentos/${selecionada.atendimento.id}?modo=revisao`)}
                className="flex items-center gap-2 rounded-md border border-xango-border px-4 py-2 text-sm font-semibold text-xango-primary"
              >
                <ExternalLink size={15} />
                Abrir atendimento
              </button>

              {selecionada.podeImprimir && (
                <button
                  type="button"
                  onClick={() => window.open(`/impressao/guia/${selecionada.id}`, "_blank", "noopener,noreferrer")}
                  className="flex items-center gap-2 rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white"
                >
                  <Printer size={15} />
                  Imprimir / reimprimir
                </button>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
