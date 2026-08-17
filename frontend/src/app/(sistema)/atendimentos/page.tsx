"use client";

import { useState } from "react";

const atendimentos = [
  {
    id: 1024,
    paciente: "João Silva",
    procedimento: "Holter",
    clinica: "Clínica Alfa",
    status: "Aguardando horário da clínica",
    atualizado: "Há 18 min",
    telefone: "(13) 99999-1111",
  },
  {
    id: 1025,
    paciente: "Maria Oliveira",
    procedimento: "Ultrassom",
    clinica: "Clínica Beta",
    status: "Aguardando confirmação do paciente",
    atualizado: "Há 32 min",
    telefone: "(13) 99999-2222",
  },
  {
    id: 1026,
    paciente: "Carlos Souza",
    procedimento: "MAPA",
    clinica: "Clínica Gama",
    status: "Agendado",
    atualizado: "Há 1 h",
    telefone: "(13) 99999-3333",
  },
];

function statusClass(status: string) {
  if (status === "Aguardando horário da clínica") {
    return "bg-amber-100 text-amber-800";
  }

  if (status === "Aguardando confirmação do paciente") {
    return "bg-blue-100 text-blue-800";
  }

  if (status === "Agendado") {
    return "bg-emerald-100 text-emerald-800";
  }

  return "bg-slate-100 text-slate-700";
}

export default function AtendimentosPage() {
  const [selecionado, setSelecionado] = useState<
    (typeof atendimentos)[number] | null
  >(null);

  const [filtro, setFiltro] = useState("Todos");

  const atendimentosFiltrados = atendimentos.filter((atendimento) => {
    if (filtro === "Todos") return true;

    if (filtro === "Aguardando clínica") {
      return atendimento.status === "Aguardando horário da clínica";
    }

    if (filtro === "Aguardando paciente") {
      return atendimento.status === "Aguardando confirmação do paciente";
    }

    if (filtro === "Agendados") {
      return atendimento.status === "Agendado";
    }

    return true;
  });

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Atendimentos</h2>
        <p className="mt-1 text-slate-500">
          Acompanhe os atendimentos em andamento.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          "Todos",
          "Aguardando clínica",
          "Aguardando paciente",
          "Agendados",
        ].map((item) => (
          <button
            key={item}
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

      <div className="overflow-hidden rounded-md bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="border-b bg-slate-50 text-sm text-slate-500">
            <tr>
              <th className="px-5 py-3">Atendimento</th>
              <th className="px-5 py-3">Paciente</th>
              <th className="px-5 py-3">Procedimento</th>
              <th className="px-5 py-3">Clínica</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Atualização</th>
            </tr>
          </thead>

          <tbody>
            {atendimentosFiltrados.map((atendimento) => (
              <tr
                key={atendimento.id}
                onClick={() => setSelecionado(atendimento)}
                className="cursor-pointer border-b last:border-b-0 hover:bg-xango-background"
              >
                <td className="px-5 py-4 font-medium">
                  #{atendimento.id}
                </td>

                <td className="px-5 py-4">{atendimento.paciente}</td>

                <td className="px-5 py-4">
                  {atendimento.procedimento}
                </td>

                <td className="px-5 py-4">{atendimento.clinica}</td>

                <td className="px-5 py-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                      atendimento.status
                    )}`}
                  >
                    {atendimento.status}
                  </span>
                </td>

                <td className="px-5 py-4 text-sm text-slate-500">
                  {atendimento.atualizado}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selecionado && (
        <>
          <button
            aria-label="Fechar painel"
            onClick={() => setSelecionado(null)}
            className="fixed inset-0 z-40 bg-black/20"
          />

          <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Atendimento #{selecionado.id}
                </p>

                <h3 className="mt-1 text-xl font-semibold text-xango-text">
                  {selecionado.paciente}
                </h3>
                </div>

                <button
                  onClick={() => setSelecionado(null)}
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
                        {selecionado.telefone}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-xango-muted">
                        Clínica
                      </p>
                      <p className="mt-1 text-sm text-xango-text">
                        {selecionado.clinica}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-xango-muted">
                      Procedimento
                    </p>

                    <div className="mt-2 rounded-md border border-xango-border bg-xango-background px-3 py-3">
                      <p className="text-sm font-semibold text-xango-text">
                        {selecionado.procedimento}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-xango-muted">
                      Status
                    </p>

                    <span
                      className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                        selecionado.status
                      )}`}
                    >
                      {selecionado.status}
                    </span>
                  </div>

                  <div className="border-t border-xango-border pt-5">
                    <p className="text-sm font-semibold text-xango-text">
                      Próxima ação
                    </p>

                    <div className="mt-2 rounded-md border border-xango-accent/30 bg-amber-50 px-3 py-3">
                      <p className="text-sm leading-5 text-xango-text">
                        O sistema mostrará aqui a ação necessária para continuar este atendimento.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-xango-border pt-5">
                    <button className="flex-1 rounded-md bg-xango-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-xango-primary-hover">
                      Continuar atendimento
                    </button>

                    <button className="rounded-md border border-xango-border px-4 py-2.5 text-sm text-xango-text transition hover:bg-xango-background">
                      Editar
                    </button>
                  </div>
                </div>
                </aside>
        </>
      )}
    </>
  );
}