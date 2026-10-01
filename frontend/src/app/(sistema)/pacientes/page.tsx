"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  RefreshCw,
  Search,
  UserPlus,
  UsersRound,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:3333";

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

function formatarTelefone(telefone: string | null) {
  if (!telefone) {
    return "Não informado";
  }

  const numeros = telefone.replace(/\D/g, "");

  if (numeros.length === 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(
      2,
      7
    )}-${numeros.slice(7)}`;
  }

  if (numeros.length === 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(
      2,
      6
    )}-${numeros.slice(6)}`;
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
  const agendamento = paciente.proximoAgendamento;

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

  async function carregarPacientes() {
    try {
      setCarregando(true);
      setErro("");

      const resposta = await fetch(
        `${API_URL}/pacientes/resumo`,
        {
          cache: "no-store",
        }
      );

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro ||
            "Não foi possível carregar os pacientes."
        );
      }

      setPacientes(resultado);
    } catch (erro) {
      console.error(
        "Erro ao carregar pacientes:",
        erro
      );

      setErro(
        "Não foi possível carregar os pacientes."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void carregarPacientes();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const pacientesFiltrados = useMemo(() => {
    const termo = busca
      .trim()
      .toLowerCase();

    return pacientes.filter((paciente) => {
      if (
        filtro === "Com agendamento" &&
        !paciente.proximoAgendamento
      ) {
        return false;
      }

      if (
        filtro === "Pendências" &&
        !paciente.financeiro.possuiPendencia
      ) {
        return false;
      }

      if (
        filtro === "Cadastro incompleto" &&
        paciente.cadastro.completo
      ) {
        return false;
      }

      if (!termo) {
        return true;
      }

      const texto = [
        paciente.codigoPublico,
        paciente.nome,
        paciente.cpf,
        formatarCpf(paciente.cpf),
        paciente.telefone,
        formatarTelefone(paciente.telefone),
        paciente.email,
        paciente.empresa?.nome,
        paciente.ultimoAtendimento
          ?.codigoPublico,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const termoNumerico = termo.replace(
        /\D/g,
        ""
      );

      if (texto.includes(termo)) {
        return true;
      }

      if (
        termoNumerico &&
        [
          paciente.cpf,
          paciente.telefone,
        ].some((valor) =>
          (valor || "")
            .replace(/\D/g, "")
            .includes(termoNumerico)
        )
      ) {
        return true;
      }

      return false;
    });
  }, [pacientes, busca, filtro]);

  const resumo = useMemo(
    () => ({
      total: pacientes.length,
      comAgendamento: pacientes.filter(
        (paciente) =>
          Boolean(
            paciente.proximoAgendamento
          )
      ).length,
      pendencias: pacientes.filter(
        (paciente) =>
          paciente.financeiro
            .possuiPendencia
      ).length,
      incompletos: pacientes.filter(
        (paciente) =>
          !paciente.cadastro.completo
      ).length,
    }),
    [pacientes]
  );

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

  return (
    <div className="mx-auto max-w-375">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-xango-text">
            Pacientes
          </h2>

          <p className="mt-1 text-sm text-xango-muted">
            Consulte cadastros, próximos agendamentos e pendências.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void carregarPacientes()
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
            carregando
              ? "—"
              : String(resumo.total)
          }
          titulo="Pacientes"
          ativo={filtro === "Todos"}
          onClick={() => setFiltro("Todos")}
        />

        <ResumoCard
          icone={
            <CalendarClock size={18} />
          }
          valor={
            carregando
              ? "—"
              : String(
                  resumo.comAgendamento
                )
          }
          titulo="Com agendamento"
          ativo={
            filtro ===
            "Com agendamento"
          }
          onClick={() =>
            setFiltro("Com agendamento")
          }
        />

        <ResumoCard
          icone={
            <CircleDollarSign size={18} />
          }
          valor={
            carregando
              ? "—"
              : String(resumo.pendencias)
          }
          titulo="Pendências"
          ativo={
            filtro === "Pendências"
          }
          onClick={() =>
            setFiltro("Pendências")
          }
        />

        <ResumoCard
          icone={
            <AlertCircle size={18} />
          }
          valor={
            carregando
              ? "—"
              : String(resumo.incompletos)
          }
          titulo="Cadastro incompleto"
          ativo={
            filtro ===
            "Cadastro incompleto"
          }
          onClick={() =>
            setFiltro(
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
          onChange={(event) =>
            setBusca(event.target.value)
          }
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
                  : `${pacientesFiltrados.length} resultado(s)`}
              </p>
            </div>

            {filtro !== "Todos" && (
              <button
                type="button"
                onClick={() =>
                  setFiltro("Todos")
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
                pacientesFiltrados.map(
                  (paciente) => {
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
                  }
                )}

              {!carregando &&
                pacientesFiltrados.length ===
                  0 && (
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
                        Nenhum paciente encontrado
                      </p>

                      <p className="mt-1 text-xs text-xango-muted">
                        Tente alterar a busca ou o filtro selecionado.
                      </p>
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
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
