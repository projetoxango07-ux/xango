"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Procedimento = {
  id: number;
  nome: string;
  categoria: string | null;
};

type ItemGuia = {
  id: number;
  status: string;
  valorPaciente: string | number;
  valorRepasse: string | number;
  dataAgendamento: string | null;
  horarioAgendamento: string | null;
  procedimento: Procedimento;
};

type Clinica = {
  id: number;
  nome: string;
};

type Guia = {
  id: number;
  status: string;
  subtotal: string | number;
  desconto: string | number;
  beneficio: string | number;
  valorFinal: string | number;
  clinica: Clinica;
  itens: ItemGuia[];
};

type Paciente = {
  id: number;
  nome: string;
  cpf: string;
  telefone: string;
};

type Atendimento = {
  id: number;
  pacienteId: number;
  status: string;
  etapaAtual: number;
  criadoEm: string;
  atualizadoEm: string;
  paciente: Paciente;
  guias: Guia[];
};

function formatarStatus(atendimento: Atendimento) {
  if (atendimento.status === "CANCELADO") {
    return "Cancelado";
  }

  if (atendimento.status === "CONCLUIDO") {
    return "Concluído";
  }

  if (
    atendimento.guias.some(
      (guia) => guia.status === "ESTORNO_PENDENTE"
    )
  ) {
    return "Estorno pendente";
  }

  if (
    atendimento.guias.some(
      (guia) => guia.status === "PARCIALMENTE_PAGA"
    )
  ) {
    return "Parcialmente pago";
  }

  if (
    atendimento.guias.some(
      (guia) => guia.status === "AGUARDANDO_PAGAMENTO"
    )
  ) {
    return "Aguardando pagamento";
  }

  if (
    atendimento.guias.length > 0 &&
    atendimento.guias.every((guia) => guia.status === "PAGA")
  ) {
    return "Pago";
  }

  return "Em andamento";
}

function statusClass(status: string) {
  if (status === "Aguardando pagamento") {
    return "bg-amber-100 text-amber-800";
  }

  if (status === "Parcialmente pago") {
    return "bg-blue-100 text-blue-800";
  }

  if (status === "Pago" || status === "Concluído") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "Estorno pendente" || status === "Cancelado") {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function formatarAtualizacao(data: string) {
  const agora = new Date();
  const atualizacao = new Date(data);

  const diferencaMs =
    agora.getTime() - atualizacao.getTime();

  const minutos = Math.floor(
    diferencaMs / 1000 / 60
  );

  if (minutos < 1) {
    return "Agora";
  }

  if (minutos < 60) {
    return `Há ${minutos} min`;
  }

  const horas = Math.floor(minutos / 60);

  if (horas < 24) {
    return `Há ${horas} h`;
  }

  return atualizacao.toLocaleDateString("pt-BR");
}

function listarProcedimentos(atendimento: Atendimento) {
  const nomes = atendimento.guias.flatMap((guia) =>
    guia.itens
      .filter((item) => item.status !== "CANCELADO")
      .map((item) => item.procedimento.nome)
  );

  const unicos = [...new Set(nomes)];

  return unicos.length > 0
    ? unicos.join(", ")
    : "Nenhum procedimento";
}

function listarClinicas(atendimento: Atendimento) {
  const nomes = atendimento.guias.map(
    (guia) => guia.clinica.nome
  );

  const unicos = [...new Set(nomes)];

  return unicos.length > 0
    ? unicos.join(", ")
    : "Não definida";
}

export default function AtendimentosPage() {
  const router = useRouter();

  const [atendimentos, setAtendimentos] = useState<
    Atendimento[]
  >([]);

  const [selecionado, setSelecionado] =
    useState<Atendimento | null>(null);

  const [filtro, setFiltro] = useState("Todos");

  const [carregando, setCarregando] =
    useState(true);

  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarAtendimentos() {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await fetch(
          "http://localhost:3333/atendimentos"
        );

        if (!resposta.ok) {
          throw new Error(
            "Não foi possível carregar os atendimentos."
          );
        }

        const dados: Atendimento[] =
          await resposta.json();

        setAtendimentos(dados);
      } catch (erro) {
        console.error(
          "Erro ao carregar atendimentos:",
          erro
        );

        setErro(
          "Não foi possível carregar os atendimentos."
        );
      } finally {
        setCarregando(false);
      }
    }

    carregarAtendimentos();
  }, []);

  const atendimentosFiltrados = useMemo(() => {
    return atendimentos.filter((atendimento) => {
      const status = formatarStatus(atendimento);

      if (filtro === "Todos") {
        return true;
      }

      if (filtro === "Em andamento") {
        return status === "Em andamento";
      }

      if (filtro === "Aguardando pagamento") {
        return (
          status === "Aguardando pagamento" ||
          status === "Parcialmente pago"
        );
      }

      if (filtro === "Pendências") {
        return status === "Estorno pendente";
      }

      if (filtro === "Concluídos") {
        return (
          status === "Pago" ||
          status === "Concluído"
        );
      }

      return true;
    });
  }, [atendimentos, filtro]);

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-xango-text">
          Atendimentos
        </h2>

        <p className="mt-1 text-sm text-xango-muted">
          Acompanhe os atendimentos salvos e continue de onde parou.
        </p>
      </div>

      {carregando && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-700">
            Carregando atendimentos...
          </p>
        </div>
      )}

      {erro && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">
            {erro}
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          "Todos",
          "Em andamento",
          "Aguardando pagamento",
          "Pendências",
          "Concluídos",
        ].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFiltro(item)}
            className={`rounded-md px-3 py-2 text-sm transition ${
              filtro === item
                ? "bg-xango-primary text-white"
                : "border border-xango-border bg-white text-xango-text hover:bg-xango-background"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-md border border-xango-border bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="border-b border-xango-border bg-slate-50 text-sm text-xango-muted">
            <tr>
              <th className="px-5 py-3">
                Atendimento
              </th>

              <th className="px-5 py-3">
                Paciente
              </th>

              <th className="px-5 py-3">
                Procedimento
              </th>

              <th className="px-5 py-3">
                Clínica
              </th>

              <th className="px-5 py-3">
                Status
              </th>

              <th className="px-5 py-3">
                Atualização
              </th>
            </tr>
          </thead>

          <tbody>
            {!carregando &&
              atendimentosFiltrados.map(
                (atendimento) => {
                  const status =
                    formatarStatus(atendimento);

                  return (
                    <tr
                      key={atendimento.id}
                      onClick={() =>
                        setSelecionado(
                          atendimento
                        )
                      }
                      className="cursor-pointer border-b border-xango-border last:border-b-0 hover:bg-xango-background"
                    >
                      <td className="px-5 py-4 font-medium text-xango-text">
                        #{atendimento.id}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium text-xango-text">
                          {
                            atendimento.paciente
                              .nome
                          }
                        </p>

                        <p className="mt-1 text-xs text-xango-muted">
                          {
                            atendimento.paciente
                              .telefone
                          }
                        </p>
                      </td>

                      <td className="max-w-xs px-5 py-4 text-sm text-xango-text">
                        {listarProcedimentos(
                          atendimento
                        )}
                      </td>

                      <td className="max-w-xs px-5 py-4 text-sm text-xango-text">
                        {listarClinicas(
                          atendimento
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-xango-muted">
                        {formatarAtualizacao(
                          atendimento.atualizadoEm
                        )}
                      </td>
                    </tr>
                  );
                }
              )}

            {!carregando &&
              atendimentosFiltrados.length ===
                0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-sm text-xango-muted"
                  >
                    Nenhum atendimento encontrado.
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>

      {selecionado && (
        <>
          <button
            type="button"
            aria-label="Fechar painel"
            onClick={() =>
              setSelecionado(null)
            }
            className="fixed inset-0 z-40 bg-black/20"
          />

          <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-xango-muted">
                  Atendimento #
                  {selecionado.id}
                </p>

                <h3 className="mt-1 text-xl font-semibold text-xango-text">
                  {
                    selecionado.paciente
                      .nome
                  }
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelecionado(null)
                }
                className="rounded-md border border-xango-border px-3 py-2 text-sm text-xango-text transition hover:bg-xango-background"
              >
                Fechar
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-xango-muted">
                    Telefone
                  </p>

                  <p className="mt-1 text-sm text-xango-text">
                    {
                      selecionado.paciente
                        .telefone
                    }
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-xango-muted">
                    Etapa
                  </p>

                  <p className="mt-1 text-sm text-xango-text">
                    {selecionado.etapaAtual} de 5
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-xango-muted">
                  Clínica
                </p>

                <p className="mt-1 text-sm text-xango-text">
                  {listarClinicas(
                    selecionado
                  )}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-xango-muted">
                  Procedimentos
                </p>

                <div className="mt-2 space-y-2">
                  {selecionado.guias.flatMap(
                    (guia) =>
                      guia.itens.map(
                        (item) => (
                          <div
                            key={item.id}
                            className="rounded-md border border-xango-border bg-xango-background px-3 py-3"
                          >
                            <p className="text-sm font-semibold text-xango-text">
                              {
                                item
                                  .procedimento
                                  .nome
                              }
                            </p>

                            <p className="mt-1 text-xs text-xango-muted">
                              {
                                guia.clinica
                                  .nome
                              }
                            </p>
                          </div>
                        )
                      )
                  )}

                  {selecionado.guias.length ===
                    0 && (
                    <div className="rounded-md border border-dashed border-xango-border p-3">
                      <p className="text-sm text-xango-muted">
                        Nenhuma guia criada.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-xango-muted">
                  Status
                </p>

                <span
                  className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                    formatarStatus(
                      selecionado
                    )
                  )}`}
                >
                  {formatarStatus(
                    selecionado
                  )}
                </span>
              </div>

              <div className="border-t border-xango-border pt-5">
                <p className="text-sm font-semibold text-xango-text">
                  Próxima ação
                </p>

                <div className="mt-2 rounded-md border border-xango-accent/30 bg-amber-50 px-3 py-3">
                  <p className="text-sm leading-5 text-xango-text">
                    Continue o atendimento para revisar as guias, pagamentos e pendências.
                  </p>
                </div>
              </div>

              <div className="border-t border-xango-border pt-5">
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/atendimentos/${selecionado.id}`
                    )
                  }
                  className="w-full rounded-md bg-xango-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-xango-primary-hover"
                >
                  Continuar atendimento
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}