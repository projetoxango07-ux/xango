"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  ExternalLink,
  FileText,
  Loader2,
  Receipt,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type StatusAssinatura =
  | "NAO_CONFIGURADA"
  | "ATIVA"
  | "EM_ATRASO"
  | "SUSPENSA"
  | "CANCELADA"
  | "ISENTA";

type StatusFatura = "ABERTA" | "PAGA" | "VENCIDA" | "CANCELADA";

type Fatura = {
  id: number;
  codigoPublico: string | null;
  competencia: string;
  valor: number;
  vencimento: string;
  status: StatusFatura;
  statusBanco: StatusFatura;
  pagoEm: string | null;
  urlFatura: string | null;
  observacoes: string | null;
  criadoEm: string;
};

type AssinaturaApi = {
  organizacao: {
    id: number;
    nomeFantasia: string;
  };
  assinatura: {
    plano: string | null;
    valorMensalidade: number | null;
    diaVencimento: number | null;
    status: StatusAssinatura;
    statusBanco: StatusAssinatura;
    proximaCobrancaEm: string | null;
    totalPendente: number;
  };
  faturas: Fatura[];
  administracao: {
    somenteLeitura: boolean;
    mensagem: string;
  };
};

function moeda(valor: number | null | undefined) {
  if (valor === null || valor === undefined) return "Não configurado";
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dataBr(valor: string | null | undefined) {
  if (!valor) return "Não configurado";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Não configurado";
  return data.toLocaleDateString("pt-BR");
}

function competenciaBr(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  const texto = data.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const statusAssinaturaLabel: Record<StatusAssinatura, string> = {
  NAO_CONFIGURADA: "Não configurada",
  ATIVA: "Ativa",
  EM_ATRASO: "Em atraso",
  SUSPENSA: "Suspensa",
  CANCELADA: "Cancelada",
  ISENTA: "Isenta",
};

const statusFaturaLabel: Record<StatusFatura, string> = {
  ABERTA: "Em aberto",
  PAGA: "Paga",
  VENCIDA: "Vencida",
  CANCELADA: "Cancelada",
};

function classeStatusAssinatura(status: StatusAssinatura) {
  if (status === "ATIVA" || status === "ISENTA") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "EM_ATRASO") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status === "SUSPENSA" || status === "CANCELADA") {
    return "border-red-200 bg-red-50 text-red-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function classeStatusFatura(status: StatusFatura) {
  if (status === "PAGA") return "bg-emerald-100 text-emerald-800";
  if (status === "VENCIDA") return "bg-red-100 text-red-700";
  if (status === "CANCELADA") return "bg-slate-100 text-slate-600";
  return "bg-amber-100 text-amber-800";
}

export default function AssinaturaPage() {
  const router = useRouter();
  const { temPermissao } = useAuth();
  const podeVisualizar = temPermissao("configuracoes.visualizar");

  const [dados, setDados] = useState<AssinaturaApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!podeVisualizar) {
      setCarregando(false);
      return;
    }

    let ativo = true;

    void (async () => {
      try {
        setErro("");
        const resposta = await fetch(`${API_URL}/configuracoes/assinatura`, {
          cache: "no-store",
        });
        const resultado: AssinaturaApi & { erro?: string } =
          await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            resultado.erro ||
              "Não foi possível carregar a assinatura do sistema."
          );
        }

        if (ativo) setDados(resultado);
      } catch (e) {
        if (ativo) {
          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível carregar a assinatura do sistema."
          );
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [podeVisualizar]);

  const faturasEmAberto = useMemo(
    () =>
      dados?.faturas.filter((fatura) =>
        ["ABERTA", "VENCIDA"].includes(fatura.status)
      ).length || 0,
    [dados]
  );

  if (!podeVisualizar) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 text-amber-700" size={22} />
          <div>
            <h2 className="font-semibold text-amber-900">Acesso restrito</h2>
            <p className="mt-1 text-sm text-amber-800">
              Seu usuário não possui permissão para visualizar as informações
              de assinatura e faturamento do sistema.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="flex min-h-80 items-center justify-center text-sm text-xango-muted">
        <Loader2 className="mr-2 animate-spin" size={20} />
        Carregando assinatura e faturas...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.push("/configuracoes")}
            className="rounded-md border border-xango-border bg-white p-2 text-xango-primary hover:bg-xango-background"
            aria-label="Voltar para configurações"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <h2 className="text-2xl font-semibold text-xango-text">
              Plano e faturamento do sistema
            </h2>
            <p className="mt-1 text-sm text-xango-muted">
              Consulte a assinatura do Digna Conect e as faturas da organização.
            </p>
          </div>
        </div>
      </div>

      {erro && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erro}
        </div>
      )}

      {dados && (
        <>
          <div
            className={`mb-5 rounded-xl border p-4 ${classeStatusAssinatura(
              dados.assinatura.status
            )}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {dados.assinatura.status === "ATIVA" ||
                dados.assinatura.status === "ISENTA" ? (
                  <ShieldCheck className="mt-0.5" size={22} />
                ) : dados.assinatura.status === "EM_ATRASO" ||
                  dados.assinatura.status === "SUSPENSA" ? (
                  <AlertTriangle className="mt-0.5" size={22} />
                ) : (
                  <Receipt className="mt-0.5" size={22} />
                )}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-75">
                    Situação da assinatura
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {statusAssinaturaLabel[dados.assinatura.status]}
                  </p>
                  <p className="mt-1 text-sm opacity-90">
                    Organização: {dados.organizacao.nomeFantasia}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-current/15 bg-white/50 px-3 py-2 text-right">
                <p className="text-xs opacity-75">Total pendente</p>
                <p className="mt-0.5 font-semibold">
                  {moeda(dados.assinatura.totalPendente)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-xango-border bg-white p-5">
              <div className="flex items-center gap-2 text-xango-primary">
                <FileText size={18} />
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Plano
                </p>
              </div>
              <p className="mt-3 text-lg font-semibold text-xango-text">
                {dados.assinatura.plano || "Não configurado"}
              </p>
            </div>

            <div className="rounded-xl border border-xango-border bg-white p-5">
              <div className="flex items-center gap-2 text-xango-primary">
                <CircleDollarSign size={18} />
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Mensalidade
                </p>
              </div>
              <p className="mt-3 text-lg font-semibold text-xango-text">
                {moeda(dados.assinatura.valorMensalidade)}
              </p>
            </div>

            <div className="rounded-xl border border-xango-border bg-white p-5">
              <div className="flex items-center gap-2 text-xango-primary">
                <CalendarDays size={18} />
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Vencimento
                </p>
              </div>
              <p className="mt-3 text-lg font-semibold text-xango-text">
                {dados.assinatura.diaVencimento
                  ? `Dia ${dados.assinatura.diaVencimento}`
                  : "Não configurado"}
              </p>
            </div>

            <div className="rounded-xl border border-xango-border bg-white p-5">
              <div className="flex items-center gap-2 text-xango-primary">
                <CalendarDays size={18} />
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Próxima cobrança
                </p>
              </div>
              <p className="mt-3 text-lg font-semibold text-xango-text">
                {dataBr(dados.assinatura.proximaCobrancaEm)}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-xango-border bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-xango-border px-5 py-4">
              <div>
                <h3 className="font-semibold text-xango-text">
                  Histórico de faturas
                </h3>
                <p className="mt-1 text-sm text-xango-muted">
                  {faturasEmAberto > 0
                    ? `${faturasEmAberto} fatura(s) em aberto ou vencida(s).`
                    : "Nenhuma pendência de fatura identificada."}
                </p>
              </div>
              <span className="rounded-full bg-xango-background px-3 py-1 text-xs font-semibold text-xango-primary">
                {dados.faturas.length} fatura(s)
              </span>
            </div>

            {dados.faturas.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Receipt className="mx-auto text-xango-muted" size={28} />
                <p className="mt-3 font-semibold text-xango-text">
                  Nenhuma fatura disponível
                </p>
                <p className="mx-auto mt-1 max-w-xl text-sm leading-5 text-xango-muted">
                  As faturas aparecerão aqui quando a assinatura for configurada
                  e as cobranças forem emitidas pelo Digna Conect.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-xango-muted">
                    <tr>
                      <th className="px-5 py-3">Competência</th>
                      <th className="px-5 py-3">Vencimento</th>
                      <th className="px-5 py-3">Valor</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Pagamento</th>
                      <th className="px-5 py-3 text-right">Fatura</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-xango-border">
                    {dados.faturas.map((fatura) => (
                      <tr key={fatura.id} className="align-top">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-xango-text">
                            {competenciaBr(fatura.competencia)}
                          </p>
                          {fatura.codigoPublico && (
                            <p className="mt-1 text-xs text-xango-muted">
                              {fatura.codigoPublico}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xango-text">
                          {dataBr(fatura.vencimento)}
                        </td>
                        <td className="px-5 py-4 font-semibold text-xango-text">
                          {moeda(fatura.valor)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classeStatusFatura(
                              fatura.status
                            )}`}
                          >
                            {statusFaturaLabel[fatura.status]}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xango-text">
                          {fatura.pagoEm ? dataBr(fatura.pagoEm) : "-"}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {fatura.urlFatura ? (
                            <a
                              href={fatura.urlFatura}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md border border-xango-border px-3 py-2 text-xs font-semibold text-xango-primary hover:bg-xango-background"
                            >
                              Abrir fatura
                              <ExternalLink size={13} />
                            </a>
                          ) : (
                            <span className="text-xs text-xango-muted">
                              Indisponível
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-semibold">Informações somente para consulta</p>
                <p className="mt-1 leading-5 text-sky-800">
                  {dados.administracao.mensagem} O bloqueio automático por
                  inadimplência ainda não está ativo nesta etapa.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
