"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  codigoPublico: string | null;
  pacienteId: number;
  status: string;
  etapaAtual: number;
  criadoEm: string;
  atualizadoEm: string;
  canceladoEm: string | null;
  motivoCancelamento: string | null;
  paciente: Paciente;
  guias: Guia[];
};

function obterAcaoAtendimento(atendimento: Atendimento) {
  if (atendimento.status === "CANCELADO") {
    return {
      titulo: "Atendimento cancelado",
      descricao: atendimento.motivoCancelamento
        ? `Motivo: ${atendimento.motivoCancelamento}`
        : "Este atendimento foi cancelado e permanece disponível apenas para histórico.",
    };
  }

  const guiasAtivas = atendimento.guias.filter((guia) =>
    guia.itens.some((item) => item.status !== "CANCELADO")
  );

  const possuiGuias = guiasAtivas.length > 0;

  const pagamentoConcluido =
    possuiGuias &&
    guiasAtivas.every(
      (guia) =>
        guia.status === "PAGA" ||
        guia.status === "CONCLUIDA"
    );

  const possuiAgendamento =
    possuiGuias &&
    guiasAtivas.every((guia) =>
      guia.itens
        .filter((item) => item.status !== "CANCELADO")
        .every((item) => Boolean(item.dataAgendamento))
    );

  if (pagamentoConcluido && possuiAgendamento) {
    return {
      titulo: "Conferir atendimento",
      descricao:
        "Pagamento concluído e agendamento definido. Confira os dados do atendimento, voucher e documentos.",
    };
  }

  if (pagamentoConcluido) {
    return {
      titulo: "Continuar atendimento",
      descricao:
        "Pagamento concluído. Falta concluir as informações de agendamento.",
    };
  }

  return {
    titulo: "Continuar atendimento",
    descricao:
      "Continue o atendimento para revisar as guias, pagamentos e pendências.",
  };
}

function formatarStatus(atendimento: Atendimento) {
  if (atendimento.status === "CANCELADO") {
    return "Cancelado";
  }

  if (atendimento.status === "CONCLUIDO") {
    return "Concluído";
  }

  const guiasAtivas = atendimento.guias.filter(
    (guia) =>
      guia.status !== "CANCELADA" &&
      guia.itens.some(
        (item) => item.status !== "CANCELADO"
      )
  );

  if (guiasAtivas.length === 0) {
    return "Em andamento";
  }

  const possuiEstornoPendente = guiasAtivas.some(
    (guia) => guia.status === "ESTORNO_PENDENTE"
  );

  if (possuiEstornoPendente) {
    return "Estorno pendente";
  }

  const possuiAgendamentoPendente = guiasAtivas.some(
    (guia) =>
      guia.itens
        .filter(
          (item) => item.status !== "CANCELADO"
        )
        .some(
          (item) => !item.dataAgendamento
        )
  );

  if (possuiAgendamentoPendente) {
    return "Aguardando agendamento";
  }

  const possuiPagamentoParcial = guiasAtivas.some(
    (guia) =>
      guia.status === "PARCIALMENTE_PAGA"
  );

  if (possuiPagamentoParcial) {
    return "Parcialmente pago";
  }

  const possuiPagamentoPendente = guiasAtivas.some(
    (guia) =>
      guia.status === "AGUARDANDO_PAGAMENTO" ||
      guia.status === "RASCUNHO"
  );

  if (possuiPagamentoPendente) {
    return "Aguardando pagamento";
  }

  const todasPagas = guiasAtivas.every(
    (guia) => guia.status === "PAGA"
  );

  if (todasPagas) {
    return "Pago e agendado";
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

  if (
    status === "Pago e agendado" ||
    status === "Concluído"
  ) {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "Estorno pendente" || status === "Cancelado") {
    return "bg-red-100 text-red-700";
  }

  if (status === "Aguardando agendamento") {
    return "bg-violet-100 text-violet-800";
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
  const nomes = atendimento.guias
    .filter(
      (guia) => guia.status !== "CANCELADA"
    )
    .filter((guia) =>
      guia.itens.some(
        (item) => item.status !== "CANCELADO"
      )
    )
    .map(
      (guia) => guia.clinica.nome
    );

  const unicos = [...new Set(nomes)];

  return unicos.length > 0
    ? unicos.join(", ")
    : "Não definida";
}

export default function AtendimentosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filtrosValidos = [
    "Todos",
    "Em andamento",
    "Aguardando agendamento",
    "Aguardando pagamento",
    "Agendados",
    "Pendências",
    "Concluídos",
    "Cancelados",
  ];

  const filtroUrl = searchParams.get("filtro");
  const filtroInicial =
    filtroUrl && filtrosValidos.includes(filtroUrl)
      ? filtroUrl
      : "Todos";

  const [atendimentos, setAtendimentos] = useState<
    Atendimento[]
  >([]);

  const [selecionado, setSelecionado] =
    useState<Atendimento | null>(null);

  const [filtro, setFiltro] = useState(filtroInicial);

  const [busca, setBusca] = useState("");

  const [carregando, setCarregando] =
    useState(true);

  const [erro, setErro] = useState("");

  const [cancelando, setCancelando] = useState<Atendimento | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [processandoCancelamento, setProcessandoCancelamento] = useState(false);

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
  const termo = busca.trim().toLowerCase();

  return atendimentos.filter((atendimento) => {
    const status = formatarStatus(atendimento);

    let correspondeFiltro = true;

    if (filtro === "Aguardando agendamento") {
      correspondeFiltro =
        status === "Aguardando agendamento";
    }

    if (filtro === "Em andamento") {
      correspondeFiltro = status === "Em andamento";
    }

    if (filtro === "Aguardando pagamento") {
      correspondeFiltro =
        status === "Aguardando pagamento" ||
        status === "Parcialmente pago";
    }

    if (filtro === "Pendências") {
      correspondeFiltro =
        status === "Estorno pendente";
    }

    if (filtro === "Concluídos") {
      correspondeFiltro =
        status === "Concluído";
    }

    if (filtro === "Cancelados") {
      correspondeFiltro =
        status === "Cancelado";
    }

    if (filtro === "Agendados") {
      correspondeFiltro =
        status === "Pago e agendado";
    }

    if (!correspondeFiltro) {
      return false;
    }

    if (!termo) {
      return true;
    }

    const dadosPesquisa = [
      atendimento.codigoPublico,
      atendimento.paciente.nome,
      atendimento.paciente.cpf,
      atendimento.paciente.telefone,
      listarProcedimentos(atendimento),
      listarClinicas(atendimento),
      status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return dadosPesquisa.includes(termo);
  });
}, [atendimentos, filtro, busca]);

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

      <div className="mb-4">
        <input
          type="text"
          value={busca}
          onChange={(event) =>
            setBusca(event.target.value)
          }
          placeholder="Pesquisar por paciente, código, CPF, telefone, clínica ou procedimento..."
          className="w-full rounded-md border border-xango-border bg-white px-4 py-3 text-sm text-xango-text outline-none transition focus:border-xango-primary"
        />
      </div>        

      <div className="mb-4 flex flex-wrap gap-2">
        {filtrosValidos.map((item) => (
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

              <th className="px-5 py-3 text-right">
                Ações
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
                        {atendimento.codigoPublico || "Código pendente"}
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

                      <td className="px-5 py-4 text-right">
                        {atendimento.status !== "CANCELADO" &&
                          atendimento.status !== "CONCLUIDO" && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setCancelando(atendimento);
                                setMotivoCancelamento("");
                              }}
                              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              Cancelar
                            </button>
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
                    colSpan={7}
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
                  Atendimento{" "}
                  {selecionado.codigoPublico || "Código pendente"}
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
                  {selecionado.guias
                    .filter(
                      (guia) => guia.status !== "CANCELADA"
                    )
                    .flatMap(
                      (guia) =>
                        guia.itens
                          .filter(
                            (item) => item.status !== "CANCELADO"
                          )
                          .map(
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
                  Agendamento
                </p>

                <div className="mt-2 space-y-2">
                  {selecionado.guias
                    .filter(
                      (guia) => guia.status !== "CANCELADA"
                    )
                    .flatMap((guia) =>  
                    guia.itens
                      .filter(
                        (item) => item.status !== "CANCELADO"
                      )
                      .map((item) => {
                        const data = item.dataAgendamento
                          ? new Date(item.dataAgendamento)
                          : null;

                        return (
                          <div
                            key={`agenda-${item.id}`}
                            className="rounded-md border border-xango-border bg-xango-background px-3 py-3"
                          >
                            <p className="text-sm font-semibold text-xango-text">
                              {item.procedimento.nome}
                            </p>

                            <p className="mt-1 text-xs text-xango-muted">
                              {guia.clinica.nome}
                            </p>

                            {data ? (
                              <p className="mt-2 text-sm text-xango-text">
                                {data.toLocaleDateString("pt-BR", {
                                  timeZone: "UTC",
                                })}

                                {item.horarioAgendamento
                                  ? ` às ${item.horarioAgendamento}`
                                  : " • Ordem de chegada"}
                              </p>
                            ) : (
                              <p className="mt-2 text-xs font-medium text-amber-700">
                                Aguardando definição de data
                              </p>
                            )}
                          </div>
                        );
                      })
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

                {selecionado.status === "CANCELADO" && (
                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3">
                    <p className="text-xs font-semibold text-red-700">Motivo do cancelamento</p>
                    <p className="mt-1 text-sm text-red-800">
                      {selecionado.motivoCancelamento || "Motivo não informado"}
                    </p>
                    {selecionado.canceladoEm && (
                      <p className="mt-2 text-[11px] text-red-600">
                        {new Date(selecionado.canceladoEm).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-xango-border pt-5">
                <p className="text-sm font-semibold text-xango-text">
                  Próxima ação
                </p>

                <div className="mt-2 rounded-md border border-xango-accent/30 bg-amber-50 px-3 py-3">
                  <p className="text-sm leading-5 text-xango-text">
                    {obterAcaoAtendimento(selecionado).descricao}
                  </p>
                </div>
              </div>

              <div className="border-t border-xango-border pt-5">
                <button
                  type="button"
                  disabled={selecionado.status === "CANCELADO"}
                  onClick={() => {
                    if (selecionado.status === "CANCELADO") return;
                    const acao = obterAcaoAtendimento(selecionado);

                    if (acao.titulo === "Conferir atendimento") {
                      router.push(
                        `/atendimentos/${selecionado.id}?modo=revisao`
                      );
                      return;
                    }

                    router.push(`/atendimentos/${selecionado.id}`);
                  }}
                  className="w-full rounded-md bg-xango-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-xango-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {obterAcaoAtendimento(selecionado).titulo}
                </button>
              </div>
            </div>
          </aside>
        </>
      )}


      {cancelando && (
        <>
          <button
            type="button"
            aria-label="Fechar cancelamento"
            onClick={() => !processandoCancelamento && setCancelando(null)}
            className="fixed inset-0 z-60 bg-black/30"
          />

          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-semibold text-xango-text">
                Cancelar atendimento
              </h3>

              <p className="mt-2 text-sm text-xango-muted">
                {cancelando.codigoPublico || `Atendimento #${cancelando.id}`} • {cancelando.paciente.nome}
              </p>

              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                O atendimento não será apagado. Ele ficará no histórico na aba Cancelados, junto com o motivo informado.
              </div>

              <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-xango-muted">
                Motivo do cancelamento
              </label>
              <textarea
                value={motivoCancelamento}
                onChange={(event) => setMotivoCancelamento(event.target.value)}
                rows={4}
                autoFocus
                placeholder="Ex.: atendimento aberto por engano, paciente duplicado, procedimento lançado incorretamente..."
                className="mt-2 w-full rounded-md border border-xango-border px-3 py-2 text-sm outline-none focus:border-xango-primary"
              />

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={processandoCancelamento}
                  onClick={() => setCancelando(null)}
                  className="rounded-md border border-xango-border px-4 py-2 text-sm font-semibold text-xango-text disabled:opacity-50"
                >
                  Voltar
                </button>

                <button
                  type="button"
                  disabled={processandoCancelamento || motivoCancelamento.trim().length < 3}
                  onClick={async () => {
                    try {
                      setProcessandoCancelamento(true);
                      const resposta = await fetch(
                        `http://localhost:3333/atendimentos/${cancelando.id}/cancelar`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ motivo: motivoCancelamento.trim() }),
                        }
                      );
                      const dados = await resposta.json();
                      if (!resposta.ok) {
                        throw new Error(dados.erro || "Não foi possível cancelar o atendimento.");
                      }

                      setAtendimentos((atuais) =>
                        atuais.map((item) =>
                          item.id === cancelando.id ? { ...item, ...dados } : item
                        )
                      );
                      setSelecionado((atual) =>
                        atual?.id === cancelando.id ? { ...atual, ...dados } : atual
                      );
                      setCancelando(null);
                      setMotivoCancelamento("");
                      setFiltro("Cancelados");
                    } catch (erro) {
                      window.alert(
                        erro instanceof Error
                          ? erro.message
                          : "Não foi possível cancelar o atendimento."
                      );
                    } finally {
                      setProcessandoCancelamento(false);
                    }
                  }}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {processandoCancelamento ? "Cancelando..." : "Confirmar cancelamento"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}