"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCw,
  Search,
  UserRound,
  Building2,
  Stethoscope,
  WalletCards,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:3333";


type AgendaRegistro = {
  itemGuiaId: number;
  atendimentoId: number;
  atendimentoCodigo: string;
  guiaId: number;
  guiaCodigo: string;

  paciente: {
    id: number;
    codigoPublico: string | null;
    nome: string;
    telefone: string;
  };

  procedimento: {
    id: number;
    nome: string;
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

  tipoAgendamento: "HORARIO" | "ORDEM_CHEGADA" | null;
  dataAgendamento: string | null;
  horarioAgendamento: string | null;

  statusItem: string;
  statusGuia: string;
  statusAtendimento: string;

  financeiro: {
    valorFinal: number;
    totalPago: number;
    totalEstornado: number;
    pagoLiquido: number;
    saldo: number;
  };
};

type AgendaResponse = {
  data: string;
  resumo: {
    total: number;
    horarioMarcado: number;
    ordemChegada: number;
    pagosAgendados: number;
    pendencias: number;
  };
  registros: AgendaRegistro[];
};

function hojeSaoPaulo() {
  const partes = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const ano =
    partes.find(
      (parte) => parte.type === "year"
    )?.value || "1970";

  const mes =
    partes.find(
      (parte) => parte.type === "month"
    )?.value || "01";

  const dia =
    partes.find(
      (parte) => parte.type === "day"
    )?.value || "01";

  return `${ano}-${mes}-${dia}`;
}

function deslocarData(
  data: string,
  dias: number
) {
  const base = new Date(`${data}T12:00:00`);
  base.setDate(base.getDate() + dias);

  const ano = base.getFullYear();
  const mes = String(
    base.getMonth() + 1
  ).padStart(2, "0");
  const dia = String(
    base.getDate()
  ).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function formatarDataCabecalho(data: string) {
  const objeto = new Date(
    `${data}T12:00:00`
  );

  const dataCompleta =
    new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(objeto);

  return (
    dataCompleta.charAt(0).toUpperCase() +
    dataCompleta.slice(1)
  );
}

function formatarTelefone(
  telefone: string
) {
  const numeros = telefone.replace(
    /\D/g,
    ""
  );

  if (numeros.length === 11) {
    return `(${numeros.slice(
      0,
      2
    )}) ${numeros.slice(
      2,
      7
    )}-${numeros.slice(7)}`;
  }

  if (numeros.length === 10) {
    return `(${numeros.slice(
      0,
      2
    )}) ${numeros.slice(
      2,
      6
    )}-${numeros.slice(6)}`;
  }

  return telefone;
}

function statusClass(status: string) {
  if (
    status === "Pago e agendado" ||
    status === "Concluído"
  ) {
    return "bg-emerald-100 text-emerald-800";
  }

  if (
    status ===
    "Aguardando agendamento"
  ) {
    return "bg-violet-100 text-violet-800";
  }

  if (
    status ===
      "Aguardando pagamento" ||
    status === "Parcialmente pago"
  ) {
    return "bg-amber-100 text-amber-800";
  }

  if (
    status === "Estorno pendente" ||
    status === "Cancelado"
  ) {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

export default function AgendaPage() {
  const router = useRouter();

  const [dataSelecionada, setDataSelecionada] =
    useState(hojeSaoPaulo());

  const [dados, setDados] =
    useState<AgendaResponse | null>(null);

  const [busca, setBusca] =
    useState("");

  const [carregando, setCarregando] =
    useState(true);

  const [erro, setErro] =
    useState("");

  async function carregarAgenda(
    data: string
  ) {
    try {
      setCarregando(true);
      setErro("");

      const resposta = await fetch(
        `${API_URL}/agenda?data=${encodeURIComponent(
          data
        )}`,
        {
          cache: "no-store",
        }
      );

      const resultado =
        await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro ||
            "Não foi possível carregar a agenda."
        );
      }

      setDados(resultado);
    } catch (erro) {
      console.error(
        "Erro ao carregar agenda:",
        erro
      );

      setErro(
        "Não foi possível carregar a agenda."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        void carregarAgenda(
          dataSelecionada
        );
      },
      0
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [dataSelecionada]);

  const registrosFiltrados =
    useMemo(() => {
      const termo = busca
        .trim()
        .toLowerCase();

      if (!dados) {
        return [];
      }

      if (!termo) {
        return dados.registros;
      }

      return dados.registros.filter(
        (registro) => {
          const texto = [
            registro.atendimentoCodigo,
            registro.guiaCodigo,
            registro.paciente.nome,
            registro.paciente.telefone,
            registro.procedimento.nome,
            registro.clinica.nome,
            registro.unidade?.nome,
            registro.unidade?.cidade,
            registro.statusAtendimento,
            registro.horarioAgendamento,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return texto.includes(termo);
        }
      );
    }, [dados, busca]);

  const ehHoje =
    dataSelecionada ===
    hojeSaoPaulo();

  return (
    <div className="mx-auto max-w-375">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-xango-text">
            Agenda
          </h2>

          <p className="mt-1 text-sm text-xango-muted">
            Consulte os procedimentos agendados por dia.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            carregarAgenda(
              dataSelecionada
            )
          }
          disabled={carregando}
          className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary transition hover:bg-xango-background disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={
              carregando
                ? "animate-spin"
                : ""
            }
          />
          Atualizar
        </button>
      </div>

      {erro && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">
            {erro}
          </p>
        </div>
      )}

      <section className="rounded-lg border border-xango-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setDataSelecionada(
                  deslocarData(
                    dataSelecionada,
                    -1
                  )
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-md border border-xango-border text-xango-text transition hover:bg-xango-background"
              aria-label="Dia anterior"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              type="button"
              onClick={() =>
                setDataSelecionada(
                  hojeSaoPaulo()
                )
              }
              className={`rounded-md px-4 py-2.5 text-sm font-semibold transition ${
                ehHoje
                  ? "bg-xango-primary text-white"
                  : "border border-xango-border bg-white text-xango-primary hover:bg-xango-background"
              }`}
            >
              Hoje
            </button>

            <button
              type="button"
              onClick={() =>
                setDataSelecionada(
                  deslocarData(
                    dataSelecionada,
                    1
                  )
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-md border border-xango-border text-xango-text transition hover:bg-xango-background"
              aria-label="Próximo dia"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <input
            type="date"
            value={dataSelecionada}
            onChange={(event) =>
              setDataSelecionada(
                event.target.value
              )
            }
            className="rounded-md border border-xango-border bg-white px-3 py-2 text-sm text-xango-text outline-none transition focus:border-xango-primary"
          />
        </div>

        <div className="mt-5 border-t border-xango-border pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-xango-primary text-white">
              <CalendarDays size={18} />
            </div>

            <div>
              <p className="font-semibold text-xango-text">
                {formatarDataCabecalho(
                  dataSelecionada
                )}
              </p>

              <p className="mt-0.5 text-xs text-xango-muted">
                {dados?.resumo.total || 0}{" "}
                {(dados?.resumo.total || 0) ===
                1
                  ? "procedimento agendado"
                  : "procedimentos agendados"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <ResumoCard
          value={
            carregando
              ? "—"
              : String(
                  dados?.resumo.total || 0
                )
          }
          label="Total do dia"
        />

        <ResumoCard
          value={
            carregando
              ? "—"
              : String(
                  dados?.resumo
                    .horarioMarcado || 0
                )
          }
          label="Horário marcado"
        />

        <ResumoCard
          value={
            carregando
              ? "—"
              : String(
                  dados?.resumo
                    .ordemChegada || 0
                )
          }
          label="Ordem de chegada"
        />

        <ResumoCard
          value={
            carregando
              ? "—"
              : String(
                  dados?.resumo
                    .pagosAgendados || 0
                )
          }
          label="Pagos e agendados"
        />

        <ResumoCard
          value={
            carregando
              ? "—"
              : String(
                  dados?.resumo
                    .pendencias || 0
                )
          }
          label="Pendências"
        />
      </section>

      <div className="relative mt-4">
        <Search
          size={17}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-xango-muted"
        />

        <input
          type="text"
          value={busca}
          onChange={(event) =>
            setBusca(event.target.value)
          }
          placeholder="Pesquisar paciente, telefone, procedimento, clínica ou código..."
          className="w-full rounded-md border border-xango-border bg-white py-3 pl-10 pr-4 text-sm text-xango-text outline-none transition focus:border-xango-primary"
        />
      </div>

      <section className="mt-4 overflow-hidden rounded-lg border border-xango-border bg-white shadow-sm">
        <div className="border-b border-xango-border px-5 py-4">
          <h3 className="font-semibold text-xango-text">
            Agendamentos do dia
          </h3>

          <p className="mt-1 text-xs text-xango-muted">
            Clique em um registro para abrir o atendimento completo.
          </p>
        </div>

        <div className="divide-y divide-xango-border">
          {carregando && (
            <div className="px-5 py-12 text-center text-sm text-xango-muted">
              Carregando agenda...
            </div>
          )}

          {!carregando &&
            registrosFiltrados.map(
              (registro) => (
                <button
                  key={
                    registro.itemGuiaId
                  }
                  type="button"
                  onClick={() =>
                    router.push(
                      `/atendimentos/${registro.atendimentoId}?modo=revisao`
                    )
                  }
                  className="grid w-full gap-4 px-5 py-5 text-left transition hover:bg-xango-background/60 lg:grid-cols-[110px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_170px]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock3
                        size={16}
                        className="text-xango-primary"
                      />

                      <p className="text-base font-bold text-xango-text">
                        {registro.tipoAgendamento ===
                        "ORDEM_CHEGADA"
                          ? "Ordem"
                          : registro.horarioAgendamento ||
                            "--:--"}
                      </p>
                    </div>

                    <p className="mt-1 text-[11px] text-xango-muted">
                      {registro.tipoAgendamento ===
                      "ORDEM_CHEGADA"
                        ? "Ordem de chegada"
                        : "Horário marcado"}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <UserRound
                        size={15}
                        className="text-xango-muted"
                      />

                      <p className="font-semibold text-xango-text">
                        {
                          registro.paciente
                            .nome
                        }
                      </p>
                    </div>

                    <p className="mt-1 text-xs text-xango-muted">
                      {formatarTelefone(
                        registro.paciente
                          .telefone
                      )}
                    </p>

                    <p className="mt-2 text-[11px] font-medium text-xango-primary">
                      {
                        registro.atendimentoCodigo
                      }
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <Stethoscope
                        size={15}
                        className="text-xango-muted"
                      />

                      <p className="text-sm font-medium text-xango-text">
                        {
                          registro
                            .procedimento.nome
                        }
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <Building2
                        size={15}
                        className="text-xango-muted"
                      />

                      <p className="text-sm text-xango-text">
                        {
                          registro.clinica
                            .nome
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-2 lg:items-end">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                        registro.statusAtendimento
                      )}`}
                    >
                      {
                        registro.statusAtendimento
                      }
                    </span>

                    <div className="flex items-center gap-1 text-[11px] text-xango-muted">
                      <WalletCards
                        size={13}
                      />

                      <span>
                        {registro.financeiro
                          .saldo > 0
                          ? `Saldo R$ ${registro.financeiro.saldo.toLocaleString(
                              "pt-BR",
                              {
                                minimumFractionDigits: 2,
                              }
                            )}`
                          : "Financeiro quitado"}
                      </span>
                    </div>
                  </div>
                </button>
              )
            )}

          {!carregando &&
            registrosFiltrados.length ===
              0 && (
              <div className="px-5 py-14 text-center">
                <CalendarDays
                  size={32}
                  className="mx-auto text-xango-muted/50"
                />

                <p className="mt-3 text-sm font-semibold text-xango-text">
                  Nenhum agendamento encontrado
                </p>

                <p className="mt-1 text-xs text-xango-muted">
                  Não há procedimentos agendados para esta data com os filtros atuais.
                </p>
              </div>
            )}
        </div>
      </section>
    </div>
  );
}

function ResumoCard({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-xango-border bg-white p-4 shadow-sm">
      <p className="text-xl font-bold text-xango-text">
        {value}
      </p>

      <p className="mt-1 text-xs text-xango-muted">
        {label}
      </p>
    </div>
  );
}
