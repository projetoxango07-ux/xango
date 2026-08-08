import { DashboardCard } from "@/components/DashboardCard";

const agendaHoje = [
  {
    horario: "08:00",
    paciente: "João Silva",
    procedimento: "MAPA",
    clinica: "Clínica Alfa",
    status: "Confirmado",
  },
  {
    horario: "09:30",
    paciente: "Maria Oliveira",
    procedimento: "Holter",
    clinica: "Clínica Beta",
    status: "Aguardando pagamento",
  },
  {
    horario: "11:00",
    paciente: "Carlos Souza",
    procedimento: "Ultrassom",
    clinica: "Clínica Gama",
    status: "Agendado",
  },
];

export default function Home() {
  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="mt-1 text-slate-500">
          Visão geral da operação.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DashboardCard title="Retornos pendentes" value={8} />
            <DashboardCard title="Guias pendentes" value={12} />
            <DashboardCard title="Agendamentos hoje" value={23} />
            <DashboardCard title="Recebido hoje" value="R$ 2.350" />
            <DashboardCard title="Repasses pendentes" value={4} />
            <DashboardCard title="Alertas" value={6} />
          </div>

          <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Atenção</h3>

            <div className="mt-4 space-y-3">
              <button className="block w-full rounded-lg border p-4 text-left hover:bg-slate-50">
                3 pacientes aguardando confirmação
              </button>

              <button className="block w-full rounded-lg border p-4 text-left hover:bg-slate-50">
                2 guias com pagamento pendente para amanhã
              </button>

              <button className="block w-full rounded-lg border p-4 text-left hover:bg-slate-50">
                1 clínica aguardando fechamento de repasse
              </button>
            </div>
          </div>
        </section>

        <aside className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Agenda do dia</h3>
              <p className="text-sm text-slate-500">
                Compromissos e tarefas de hoje
              </p>
            </div>

            <button className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">
              Ver agenda
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {agendaHoje.map((item) => (
              <button
                key={`${item.horario}-${item.paciente}`}
                className="group w-full rounded-xl border p-4 text-left transition hover:border-slate-400 hover:bg-slate-50"
              >
                <div className="flex gap-4">
                  <span className="w-12 text-sm font-semibold">
                    {item.horario}
                  </span>

                  <div className="flex-1">
                    <p className="font-semibold">{item.paciente}</p>
                    <p className="text-sm text-slate-600">
                      {item.procedimento}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.clinica}
                    </p>

                    <div className="mt-3 hidden rounded-lg bg-slate-100 p-3 text-xs text-slate-600 group-hover:block">
                      Status: {item.status}
                      <br />
                      Clique para abrir o atendimento.
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}