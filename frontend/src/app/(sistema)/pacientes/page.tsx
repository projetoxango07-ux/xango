"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  RefreshCw,
  Search,
  UserPlus,
  UsersRound,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "http://localhost:3333";

const POR_PAGINA = 50;

type PacienteResumo = {
  id: number;
  codigoPublico: string | null;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  dataNascimento: string | null;
  beneficioAtivo: boolean;
  empresa: {
    id: number;
    nome: string;
  } | null;
  criadoEm: string;
  atualizadoEm: string;
  cadastro: {
    percentual: number;
    completo: boolean;
  };
  totalAtendimentos: number;
  ultimoAtendimento: {
    id: number;
    codigoPublico: string;
    criadoEm: string;
    status: string;
  } | null;
  proximoAgendamento: {
    atendimentoId: number;
    atendimentoCodigo: string;
    dataAgendamento: string;
    horarioAgendamento: string | null;
    tipoAgendamento:
      | "HORARIO"
      | "ORDEM_CHEGADA"
      | null;
    procedimento: string;
  } | null;
  financeiro: {
    possuiPendencia: boolean;
    saldoPendente: number;
  };
};

type FiltroPaciente =
  | "Todos"
  | "Com agendamento"
  | "Pendências"
  | "Cadastro incompleto";

type RespostaPacientes = {
  pacientes: PacienteResumo[];
  paginacao: {
    pagina: number;
    porPagina: number;
    total: number;
    totalPaginas: number;
  };
  resumo: {
    total: number;
    comAgendamento: number;
    pendencias: number;
    incompletos: number;
  };
  erro?: string;
};

function filtroParaApi(
  filtro: FiltroPaciente
) {
  switch (filtro) {
    case "Com agendamento":
      return "agendamento";
    case "Pendências":
      return "pendencias";
    case "Cadastro incompleto":
      return "incompleto";
    default:
      return "todos";
  }
}

function formatarCpf(cpf: string | null) {
  if (!cpf) {
    return "Não informado";
  }

  const numeros = cpf.replace(/\D/g, "");

  if (numeros.length !== 11) {
    return cpf;
  }

  return `${numeros.slice(0, 3)}.${numeros.slice(
    3,
    6
  )}.${numeros.slice(6, 9)}-${numeros.slice(9)}`;
}

function formatarTelefone(
  telefone: string | null
) {
  if (!telefone) {
    return "Não informado";
  }

  const numeros = telefone.replace(/\D/g, "");

  if (numeros.length === 11) {
    return `(${numeros.slice(
      0,
      2
    )}) ${numeros.slice(2, 7)}-${numeros.slice(
      7
    )}`;
  }

  if (numeros.length === 10) {
    return `(${numeros.slice(
      0,
      2
    )}) ${numeros.slice(2, 6)}-${numeros.slice(
      6
    )}`;
  }

  return telefone;
}

function formatarData(data: string | null) {
  if (!data) {
    return "—";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(data));
}

function formatarAgendamento(
  paciente: PacienteResumo
) {
  const agendamento =
    paciente.proximoAgendamento;

  if (!agendamento) {
    return null;
  }

  const data = formatarData(
    agendamento.dataAgendamento
  );

  if (
    agendamento.tipoAgendamento ===
    "ORDEM_CHEGADA"
  ) {
    return `${data} • Ordem de chegada`;
  }

  return `${data} • ${
    agendamento.horarioAgendamento || "--:--"
  }`;
}

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function PacientesPage() {
  const router = useRouter();

  const [pacientes, setPacientes] = useState<
    PacienteResumo[]
  >([]);

  const [carregando, setCarregando] =
    useState(true);

  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState("");

  const [filtro, setFiltro] =
    useState<FiltroPaciente>("Todos");

  const [pagina, setPagina] = useState(1);

  const [chaveAtualizacao, setChaveAtualizacao] =
    useState(0);

  const [paginacao, setPaginacao] = useState({
    pagina: 1,
    porPagina: POR_PAGINA,
    total: 0,
    totalPaginas: 1,
  });

  const [resumo, setResumo] = useState({
    total: 0,
    comAgendamento: 0,
    pendencias: 0,
    incompletos: 0,
  });

  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(
      async () => {
        try {
          setCarregando(true);
          setErro("");

          const parametros =
            new URLSearchParams({
              pagina: String(pagina),
              porPagina: String(POR_PAGINA),
              filtro: filtroParaApi(filtro),
            });

          const termo = busca.trim();

          if (termo) {
            parametros.set("busca", termo);
          }

          const resposta = await fetch(
            `${API_URL}/pacientes/resumo?${parametros.toString()}`,
            {
              cache: "no-store",
              signal: controller.signal,
            }
          );

          const resultado: RespostaPacientes =
            await resposta.json();

          if (!resposta.ok) {
            throw new Error(
              resultado.erro ||
                "Não foi possível carregar os pacientes."
            );
          }

          setPacientes(
            Array.isArray(resultado.pacientes)
              ? resultado.pacientes
              : []
          );

          setPaginacao(resultado.paginacao);
          setResumo(resultado.resumo);

          if (
            resultado.paginacao.pagina !==
            pagina
          ) {
            setPagina(
              resultado.paginacao.pagina
            );
          }
        } catch (erroCarregamento) {
          if (controller.signal.aborted) {
            return;
          }

          console.error(
            "Erro ao carregar pacientes:",
            erroCarregamento
          );

          setErro(
            erroCarregamento instanceof Error
              ? erroCarregamento.message
              : "Não foi possível carregar os pacientes."
          );
        } finally {
          if (!controller.signal.aborted) {
            setCarregando(false);
          }
        }
      },
      busca.trim() ? 300 : 0
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    busca,
    filtro,
    pagina,
    chaveAtualizacao,
  ]);

  function aplicarFiltro(
    novoFiltro: FiltroPaciente
  ) {
    setFiltro(novoFiltro);
    setPagina(1);
  }

  function abrirPaciente(
    paciente: PacienteResumo
  ) {
    if (paciente.ultimoAtendimento) {
      router.push(
        `/atendimentos/${paciente.ultimoAtendimento.id}?modo=revisao`
      );
      return;
    }

    router.push(
      `/atendimentos/novo?pacienteId=${paciente.id}`
    );
  }

  const primeiroResultado =
    paginacao.total === 0
      ? 0
      : (paginacao.pagina - 1) *
          paginacao.porPagina +
        1;

  const ultimoResultado = Math.min(
    paginacao.pagina * paginacao.porPagina,
    paginacao.total
  );

  return (
    <div className="mx-auto max-w-375">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-xango-text">
            Pacientes
          </h2>

          <p className="mt-1 text-sm text-xango-muted">
            Consulte cadastros, próximos
            agendamentos e pendências.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setChaveAtualizacao(
                (atual) => atual + 1
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

          <button
            type="button"
            onClick={() =>
              router.push(
                "/atendimentos/novo"
              )
            }
            className="flex items-center gap-2 rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-xango-primary-hover"
          >
            <UserPlus size={16} />
            Novo paciente
          </button>
        </div>
      </div>

      {erro && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">
            {erro}
          </p>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ResumoCard
          icone={<UsersRound size={18} />}
          valor={
            carregando && resumo.total === 0
              ? "—"
              : String(resumo.total)
          }
          titulo="Pacientes"
          ativo={filtro === "Todos"}
          onClick={() =>
            aplicarFiltro("Todos")
          }
        />

        <ResumoCard
          icone={
            <CalendarClock size={18} />
          }
          valor={
            carregando &&
            resumo.comAgendamento === 0 &&
            resumo.total === 0
              ? "—"
              : String(
                  resumo.comAgendamento
                )
          }
          titulo="Com agendamento"
          ativo={
            filtro === "Com agendamento"
          }
          onClick={() =>
            aplicarFiltro("Com agendamento")
          }
        />

        <ResumoCard
          icone={
            <CircleDollarSign size={18} />
          }
          valor={
            carregando &&
            resumo.pendencias === 0 &&
            resumo.total === 0
              ? "—"
              : String(resumo.pendencias)
          }
          titulo="Pendências"
          ativo={filtro === "Pendências"}
          onClick={() =>
            aplicarFiltro("Pendências")
          }
        />

        <ResumoCard
          icone={
            <AlertCircle size={18} />
          }
          valor={
            carregando &&
            resumo.incompletos === 0 &&
            resumo.total === 0
              ? "—"
              : String(resumo.incompletos)
          }
          titulo="Cadastro incompleto"
          ativo={
            filtro ===
            "Cadastro incompleto"
          }
          onClick={() =>
            aplicarFiltro(
              "Cadastro incompleto"
            )
          }
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
          onChange={(event) => {
            setBusca(event.target.value);
            setPagina(1);
          }}
          placeholder="Pesquisar por nome, CPF, telefone, e-mail ou código PAC..."
          className="w-full rounded-md border border-xango-border bg-white py-3 pl-10 pr-4 text-sm text-xango-text outline-none transition focus:border-xango-primary"
        />
      </div>

      <section className="mt-4 overflow-hidden rounded-lg border border-xango-border bg-white shadow-sm">
        <div className="border-b border-xango-border px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-xango-text">
                Lista de pacientes
              </h3>

              <p className="mt-1 text-xs text-xango-muted">
                {carregando
                  ? "Carregando..."
                  : `${paginacao.total} resultado(s)`}
              </p>
            </div>

            {filtro !== "Todos" && (
              <button
                type="button"
                onClick={() =>
                  aplicarFiltro("Todos")
                }
                className="text-xs font-semibold text-xango-primary hover:underline"
              >
                Limpar filtro
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-250 border-collapse">
            <thead>
              <tr className="border-b border-xango-border bg-xango-background/60 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-xango-muted">
                  Paciente
                </th>

                <th className="px-4 py-3 text-xs font-semibold text-xango-muted">
                  Contato
                </th>

                <th className="px-4 py-3 text-xs font-semibold text-xango-muted">
                  Cadastro
                </th>

                <th className="px-4 py-3 text-xs font-semibold text-xango-muted">
                  Próximo agendamento
                </th>

                <th className="px-4 py-3 text-xs font-semibold text-xango-muted">
                  Financeiro
                </th>

                <th className="px-4 py-3 text-xs font-semibold text-xango-muted">
                  Atendimentos
                </th>

                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>

            <tbody className="divide-y divide-xango-border">
              {carregando && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm text-xango-muted"
                  >
                    Carregando pacientes...
                  </td>
                </tr>
              )}

              {!carregando &&
                pacientes.map((paciente) => {
                  const agendamento =
                    formatarAgendamento(
                      paciente
                    );

                  return (
                    <tr
                      key={paciente.id}
                      onClick={() =>
                        abrirPaciente(
                          paciente
                        )
                      }
                      className="cursor-pointer transition hover:bg-xango-background/60"
                    >
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold text-xango-text">
                          {paciente.nome}
                        </p>

                        <p className="mt-1 text-xs font-medium text-xango-primary">
                          {paciente.codigoPublico ||
                            "Código pendente"}
                        </p>

                        <p className="mt-1 text-xs text-xango-muted">
                          CPF{" "}
                          {formatarCpf(
                            paciente.cpf
                          )}
                        </p>

                        {paciente.beneficioAtivo &&
                          paciente.empresa && (
                            <span className="mt-2 inline-flex rounded-full bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-800">
                              {
                                paciente
                                  .empresa.nome
                              }
                            </span>
                          )}
                      </td>

                      <td className="px-4 py-4 align-top">
                        <p className="text-sm text-xango-text">
                          {formatarTelefone(
                            paciente.telefone
                          )}
                        </p>

                        <p className="mt-1 text-xs text-xango-muted">
                          {paciente.email ||
                            "E-mail não informado"}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-2">
                          {paciente.cadastro
                            .completo ? (
                            <CheckCircle2
                              size={15}
                              className="text-emerald-600"
                            />
                          ) : (
                            <AlertCircle
                              size={15}
                              className="text-amber-600"
                            />
                          )}

                          <span
                            className={`text-sm font-semibold ${
                              paciente.cadastro
                                .completo
                                ? "text-emerald-700"
                                : "text-amber-700"
                            }`}
                          >
                            {
                              paciente
                                .cadastro
                                .percentual
                            }
                            %
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-xango-muted">
                          {paciente.cadastro
                            .completo
                            ? "Completo"
                            : "Incompleto"}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        {agendamento ? (
                          <>
                            <p className="text-sm font-medium text-xango-text">
                              {agendamento}
                            </p>

                            <p className="mt-1 text-xs text-xango-muted">
                              {
                                paciente
                                  .proximoAgendamento
                                  ?.procedimento
                              }
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-xango-muted">
                            Sem agendamento futuro
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 align-top">
                        {paciente.financeiro
                          .possuiPendencia ? (
                          <>
                            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                              Pendência
                            </span>

                            {paciente.financeiro
                              .saldoPendente >
                              0 && (
                              <p className="mt-1 text-xs text-xango-muted">
                                {moeda(
                                  paciente
                                    .financeiro
                                    .saldoPendente
                                )}
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                            Sem pendência
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 align-top">
                        <p className="text-sm font-semibold text-xango-text">
                          {
                            paciente.totalAtendimentos
                          }
                        </p>

                        <p className="mt-1 text-xs text-xango-muted">
                          {paciente.ultimoAtendimento
                            ? `Último ${formatarData(
                                paciente
                                  .ultimoAtendimento
                                  .criadoEm
                              )}`
                            : "Nenhum atendimento"}
                        </p>
                      </td>

                      <td className="px-3 py-4 text-right align-middle">
                        <ChevronRight
                          size={18}
                          className="text-xango-muted"
                        />
                      </td>
                    </tr>
                  );
                })}

              {!carregando &&
                pacientes.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-14 text-center"
                    >
                      <UsersRound
                        size={32}
                        className="mx-auto text-xango-muted/50"
                      />

                      <p className="mt-3 text-sm font-semibold text-xango-text">
                        Nenhum paciente
                        encontrado
                      </p>

                      <p className="mt-1 text-xs text-xango-muted">
                        Tente alterar a busca ou
                        o filtro selecionado.
                      </p>
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>

        {!carregando &&
          paginacao.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-xango-border px-5 py-4">
              <p className="text-xs text-xango-muted">
                Mostrando{" "}
                {primeiroResultado}–
                {ultimoResultado} de{" "}
                {paginacao.total}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPagina((atual) =>
                      Math.max(
                        atual - 1,
                        1
                      )
                    )
                  }
                  disabled={
                    paginacao.pagina <= 1
                  }
                  className="flex items-center gap-1 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary transition hover:bg-xango-background disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                  Anterior
                </button>

                <span className="min-w-24 text-center text-xs font-medium text-xango-muted">
                  Página{" "}
                  {paginacao.pagina} de{" "}
                  {paginacao.totalPaginas}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPagina((atual) =>
                      Math.min(
                        atual + 1,
                        paginacao.totalPaginas
                      )
                    )
                  }
                  disabled={
                    paginacao.pagina >=
                    paginacao.totalPaginas
                  }
                  className="flex items-center gap-1 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary transition hover:bg-xango-background disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Próxima
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
      </section>
    </div>
  );
}

function ResumoCard({
  icone,
  valor,
  titulo,
  ativo,
  onClick,
}: {
  icone: React.ReactNode;
  valor: string;
  titulo: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border bg-white p-4 text-left shadow-sm transition ${
        ativo
          ? "border-xango-primary ring-1 ring-xango-primary"
          : "border-xango-border hover:border-xango-primary/40"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xango-primary">
          {icone}
        </div>

        <p className="text-xl font-bold text-xango-text">
          {valor}
        </p>
      </div>

      <p className="mt-3 text-xs font-medium text-xango-muted">
        {titulo}
      </p>
    </button>
  );
}
