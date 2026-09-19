"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FileText,
  MapPin,
  Printer,
  UserRound,
  WalletCards,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type GuiaDetalhe = {
  id: number;
  codigoPublico: string | null;
  status: string;
  subtotal: string | number;
  desconto: string | number;
  beneficio: string | number;
  valorFinal: string | number;
  emitidaEm: string | null;
  validadeAte: string | null;
  confirmadaEm: string | null;
  realizadaEm: string | null;
  atendimento: {
    id: number;
    codigoPublico: string | null;
    status: string;
    paciente: {
      id: number;
      nome: string;
      cpf: string;
      telefone: string;
      email?: string | null;
    };
  };
  clinica: {
    id: number;
    nome: string;
  };
  unidadeClinica: {
    id: number;
    nome: string;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
  } | null;
  geradaPor: {
    id: number;
    nome: string;
  } | null;
  confirmadaPor: {
    id: number;
    nome: string;
  } | null;
  itens: Array<{
    id: number;
    status: string;
    valorPaciente: string | number;
    valorRepasse: string | number;
    tipoAgendamento: "HORARIO" | "ORDEM_CHEGADA" | null;
    dataAgendamento: string | null;
    horarioAgendamento: string | null;
    motivoCancelamento: string | null;
    procedimento: {
      id: number;
      nome: string;
      categoria?: string | null;
    };
  }>;
  pagamentos: Array<{
    id: number;
    valor: string | number;
    forma: string;
    observacao: string | null;
    criadoEm: string;
  }>;
  estornos: Array<{
    id: number;
    codigoPublico: string | null;
    valor: string | number;
    forma: string;
    motivo: string | null;
    criadoEm: string;
  }>;
  elegibilidadeImpressao?: {
    podeImprimir: boolean;
    motivos: string[];
  };
};

function numero(valor: string | number | null | undefined) {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function moeda(valor: string | number | null | undefined) {
  return numero(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, "");
}

function formatarCpf(valor: string) {
  const n = somenteNumeros(valor || "");
  if (n.length !== 11) return valor || "Não informado";
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

function formatarTelefone(valor: string) {
  const n = somenteNumeros(valor || "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return valor || "Não informado";
}

function dataBr(valor: string | null) {
  if (!valor) return "—";
  return new Date(valor).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function dataHoraBr(valor: string | null) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("pt-BR");
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
  if (status === "AGUARDANDO_PAGAMENTO" || status === "RASCUNHO") return "bg-amber-100 text-amber-800";
  if (status === "ESTORNO_PENDENTE" || status === "CANCELADA") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function formaLabel(forma: string) {
  const mapa: Record<string, string> = {
    PIX: "PIX",
    DINHEIRO: "Dinheiro",
    CARTAO_CREDITO: "Cartão de crédito",
    CARTAO_DEBITO: "Cartão de débito",
    TRANSFERENCIA: "Transferência",
    OUTRO: "Outro",
  };
  return mapa[forma] || forma;
}

function endereco(unidade: GuiaDetalhe["unidadeClinica"]) {
  if (!unidade) return "Unidade não informada";
  const linha1 = [unidade.logradouro, unidade.numero].filter(Boolean).join(", ");
  const linha2 = [unidade.bairro, unidade.cidade, unidade.uf].filter(Boolean).join(" • ");
  return [linha1, linha2].filter(Boolean).join(" — ") || unidade.nome;
}

export default function GuiaDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const guiaId = Number(idParam);

  const [guia, setGuia] = useState<GuiaDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!Number.isInteger(guiaId) || guiaId <= 0) {
      setErro("Guia inválida.");
      setCarregando(false);
      return;
    }

    let ativo = true;

    async function carregar() {
      try {
        setCarregando(true);
        setErro("");
        const resposta = await fetch(`${API_URL}/guias/${guiaId}`, {
          cache: "no-store",
          credentials: "include",
        });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados?.erro || "Não foi possível carregar a guia.");
        if (ativo) setGuia(dados);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar a guia.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();
    return () => { ativo = false; };
  }, [guiaId]);

  const financeiro = useMemo(() => {
    if (!guia) return { totalPago: 0, totalEstornado: 0, pagoLiquido: 0, saldo: 0 };
    const totalPago = guia.pagamentos.reduce((soma, item) => soma + numero(item.valor), 0);
    const totalEstornado = guia.estornos.reduce((soma, item) => soma + numero(item.valor), 0);
    const pagoLiquido = Math.max(totalPago - totalEstornado, 0);
    const saldo = Math.max(numero(guia.valorFinal) - pagoLiquido, 0);
    return { totalPago, totalEstornado, pagoLiquido, saldo };
  }, [guia]);

  if (carregando) {
    return <div className="rounded-lg border border-xango-border bg-white p-8 text-sm text-xango-muted">Carregando guia...</div>;
  }

  if (erro || !guia) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => router.back()} className="flex items-center gap-2 text-sm font-semibold text-xango-primary">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">{erro || "Guia não encontrada."}</div>
      </div>
    );
  }

  const itensAtivos = guia.itens.filter((item) => item.status !== "CANCELADO");

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button type="button" onClick={() => router.back()} className="mb-3 flex items-center gap-2 text-sm font-semibold text-xango-primary hover:underline">
            <ArrowLeft size={16} /> Voltar
          </button>
          <p className="text-xs font-semibold uppercase tracking-wide text-xango-primary">Guia / voucher</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-xango-text">{guia.codigoPublico || `Guia #${guia.id}`}</h2>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(guia.status)}`}>{statusLabel(guia.status)}</span>
          </div>
          <p className="mt-1 text-sm text-xango-muted">{guia.atendimento.codigoPublico || `Atendimento #${guia.atendimento.id}`}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => router.push("/guias")} className="rounded-md border border-xango-border px-4 py-2 text-sm font-semibold text-xango-primary">
            Lista de guias
          </button>
          <button type="button" onClick={() => router.push(`/atendimentos/${guia.atendimento.id}?modo=revisao`)} className="flex items-center gap-2 rounded-md border border-xango-border px-4 py-2 text-sm font-semibold text-xango-primary">
            <ExternalLink size={15} /> Abrir atendimento
          </button>
          {guia.elegibilidadeImpressao?.podeImprimir !== false && (
            <button type="button" onClick={() => window.open(`/impressao/guia/${guia.id}`, "_blank", "noopener,noreferrer")} className="flex items-center gap-2 rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white">
              <Printer size={15} /> Imprimir / reimprimir
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-xango-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xango-primary"><UserRound size={17} /><h3 className="font-semibold">Paciente</h3></div>
          <p className="mt-3 font-semibold text-xango-text">{guia.atendimento.paciente.nome}</p>
          <p className="mt-1 text-sm text-xango-muted">CPF {formatarCpf(guia.atendimento.paciente.cpf)}</p>
          <p className="mt-1 text-sm text-xango-muted">{formatarTelefone(guia.atendimento.paciente.telefone)}</p>
        </section>

        <section className="rounded-lg border border-xango-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xango-primary"><MapPin size={17} /><h3 className="font-semibold">Local de atendimento</h3></div>
          <p className="mt-3 font-semibold text-xango-text">{guia.clinica.nome}</p>
          {guia.unidadeClinica && <p className="mt-1 text-sm font-medium text-xango-text">{guia.unidadeClinica.nome}</p>}
          <p className="mt-1 text-sm text-xango-muted">{endereco(guia.unidadeClinica)}</p>
        </section>

        <section className="rounded-lg border border-xango-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xango-primary"><CalendarDays size={17} /><h3 className="font-semibold">Confirmação</h3></div>
          <p className="mt-3 text-sm text-xango-muted">Realizado em</p>
          <p className="font-semibold text-xango-text">{dataBr(guia.realizadaEm)}</p>
          <p className="mt-2 text-sm text-xango-muted">Confirmado em</p>
          <p className="font-semibold text-xango-text">{dataHoraBr(guia.confirmadaEm)}</p>
          {guia.confirmadaPor?.nome && <p className="mt-1 text-xs text-xango-muted">Por {guia.confirmadaPor.nome}</p>}
        </section>
      </div>

      <section className="rounded-lg border border-xango-border bg-white shadow-sm">
        <div className="border-b border-xango-border px-5 py-4">
          <div className="flex items-center gap-2 text-xango-primary"><FileText size={17} /><h3 className="font-semibold">Procedimentos e agendamento</h3></div>
        </div>
        <div className="divide-y divide-xango-border">
          {itensAtivos.map((item) => (
            <div key={item.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_220px_150px] md:items-center">
              <div>
                <p className="font-semibold text-xango-text">{item.procedimento.nome}</p>
                {item.procedimento.categoria && <p className="mt-1 text-xs text-xango-muted">{item.procedimento.categoria}</p>}
              </div>
              <div className="text-sm text-xango-muted">
                {item.dataAgendamento ? (
                  item.tipoAgendamento === "ORDEM_CHEGADA"
                    ? `${dataBr(item.dataAgendamento)} • ordem de chegada`
                    : `${dataBr(item.dataAgendamento)}${item.horarioAgendamento ? ` às ${item.horarioAgendamento}` : ""}`
                ) : "Aguardando agendamento"}
              </div>
              <p className="text-right font-semibold text-xango-text">{moeda(item.valorPaciente)}</p>
            </div>
          ))}
          {itensAtivos.length === 0 && <div className="px-5 py-8 text-sm text-xango-muted">Nenhum procedimento ativo nesta guia.</div>}
        </div>
      </section>

      <section className="rounded-lg border border-xango-border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-xango-primary"><WalletCards size={17} /><h3 className="font-semibold">Financeiro</h3></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div><p className="text-xs text-xango-muted">Valor da guia</p><p className="mt-1 font-semibold text-xango-text">{moeda(guia.valorFinal)}</p></div>
          <div><p className="text-xs text-xango-muted">Recebido</p><p className="mt-1 font-semibold text-xango-text">{moeda(financeiro.totalPago)}</p></div>
          <div><p className="text-xs text-xango-muted">Estornado</p><p className="mt-1 font-semibold text-red-600">{moeda(financeiro.totalEstornado)}</p></div>
          <div><p className="text-xs text-xango-muted">Pago líquido</p><p className="mt-1 font-semibold text-emerald-700">{moeda(financeiro.pagoLiquido)}</p></div>
          <div><p className="text-xs text-xango-muted">Saldo</p><p className="mt-1 font-semibold text-xango-text">{moeda(financeiro.saldo)}</p></div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-xango-border bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-xango-text">Pagamentos</h3>
          <div className="mt-3 space-y-2">
            {guia.pagamentos.map((pagamento) => (
              <div key={pagamento.id} className="flex items-start justify-between gap-4 rounded-md bg-xango-background px-4 py-3 text-sm">
                <div><p className="font-medium text-xango-text">{formaLabel(pagamento.forma)}</p><p className="mt-1 text-xs text-xango-muted">{dataHoraBr(pagamento.criadoEm)}{pagamento.observacao ? ` • ${pagamento.observacao}` : ""}</p></div>
                <p className="font-semibold text-emerald-700">{moeda(pagamento.valor)}</p>
              </div>
            ))}
            {guia.pagamentos.length === 0 && <p className="text-sm text-xango-muted">Nenhum pagamento registrado.</p>}
          </div>
        </section>

        <section className="rounded-lg border border-xango-border bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-xango-text">Estornos</h3>
          <div className="mt-3 space-y-2">
            {guia.estornos.map((estorno) => (
              <div key={estorno.id} className="flex items-start justify-between gap-4 rounded-md bg-red-50 px-4 py-3 text-sm">
                <div><p className="font-medium text-xango-text">{formaLabel(estorno.forma)}</p><p className="mt-1 text-xs text-xango-muted">{dataHoraBr(estorno.criadoEm)}{estorno.motivo ? ` • ${estorno.motivo}` : ""}</p></div>
                <p className="font-semibold text-red-700">-{moeda(estorno.valor)}</p>
              </div>
            ))}
            {guia.estornos.length === 0 && <p className="text-sm text-xango-muted">Nenhum estorno registrado.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
