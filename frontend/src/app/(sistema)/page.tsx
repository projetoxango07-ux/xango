import {
  CalendarDays,
  Clock3,
  DollarSign,
  FileWarning,
  Headphones,
  TrendingUp,
  UserRound,
  Cake,
  Gift,
} from "lucide-react";

const agendaHoje = [
  {
    horario: "08:00",
    paciente: "João Silva",
    procedimento: "Holter 24h",
    clinica: "Clínica Alfa",
    status: "Confirmado",
    statusClass: "bg-emerald-50 text-emerald-700",
  },
  {
    horario: "09:30",
    paciente: "Maria Oliveira",
    procedimento: "Ultrassom",
    clinica: "Clínica Beta",
    status: "Pendente",
    statusClass: "bg-amber-50 text-amber-700",
  },
  {
    horario: "11:00",
    paciente: "Carlos Souza",
    procedimento: "MAPA",
    clinica: "Clínica Gama",
    status: "Confirmado",
    statusClass: "bg-emerald-50 text-emerald-700",
  },
  {
    horario: "13:30",
    paciente: "Ana Paula Lima",
    procedimento: "Espirometria",
    clinica: "Clínica Alfa",
    status: "Confirmado",
    statusClass: "bg-emerald-50 text-emerald-700",
  },
  {
    horario: "15:00",
    paciente: "Fernanda Reis",
    procedimento: "EEG",
    clinica: "Clínica Delta",
    status: "Pendente",
    statusClass: "bg-amber-50 text-amber-700",
  },
];

const atendimentos = [
  {
    id: 1024,
    paciente: "João Silva",
    procedimento: "Holter 24h",
    clinica: "Clínica Alfa",
    status: "Aguardando horário da clínica",
    statusClass: "bg-amber-50 text-amber-700",
    atualizado: "Há 18 min",
  },
  {
    id: 1025,
    paciente: "Maria Oliveira",
    procedimento: "Ultrassom",
    clinica: "Clínica Beta",
    status: "Aguardando confirmação do paciente",
    statusClass: "bg-blue-50 text-blue-700",
    atualizado: "Há 32 min",
  },
  {
    id: 1026,
    paciente: "Carlos Souza",
    procedimento: "MAPA",
    clinica: "Clínica Gama",
    status: "Agendado",
    statusClass: "bg-emerald-50 text-emerald-700",
    atualizado: "Há 1 h",
  },
  {
    id: 1027,
    paciente: "Ana Paula Lima",
    procedimento: "Espirometria",
    clinica: "Clínica Alfa",
    status: "Aguardando horário da clínica",
    statusClass: "bg-amber-50 text-amber-700",
    atualizado: "Há 1 h",
  },
];

export default function Home() {
  const agora = new Date();

  const dataCompleta = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(agora);

  const diaSemana = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone: "America/Sao_Paulo",
  }).format(agora);

  const diaSemanaFormatado =
    diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* COLUNA PRINCIPAL */}
        <div className="min-w-0">
          {/* SAUDAÇÃO + DATA */}
          <div className="mb-6 flex items-start gap-8">
            <div>
              <h2 className="text-2xl font-bold text-xango-text">
                Olá, Diego! 👋
              </h2>

              <p className="mt-1 text-sm text-xango-muted">
                Aqui está o resumo do que precisa da sua atenção hoje.
              </p>
            </div>

            <div className="mt-0.5 hidden border-l border-xango-border pl-6 lg:block">
              <p className="text-sm font-semibold capitalize text-xango-text">
                {dataCompleta}
              </p>

              <p className="mt-1 text-xs text-xango-muted">
                {diaSemanaFormatado}
              </p>
            </div>
          </div>

          {/* RESUMO */}
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <DashboardMetric
              icon={<Headphones size={19} />}
              iconClass="bg-xango-primary text-white"
              value="32"
              label="Atendimentos em andamento"
              footer="+12% vs. ontem"
            />

            <DashboardMetric
              icon={<Clock3 size={19} />}
              iconClass="bg-xango-accent text-white"
              value="14"
              label="Aguardando clínica"
              footer="+8% vs. ontem"
            />

            <DashboardMetric
              icon={<UserRound size={19} />}
              iconClass="bg-xango-primary text-white"
              value="9"
              label="Aguardando paciente"
              footer="-5% vs. ontem"
            />

            <DashboardMetric
              icon={<DollarSign size={19} />}
              iconClass="bg-xango-accent text-white"
              value="R$ 18.540"
              label="Recebido no mês"
              footer="+15% vs. mês passado"
            />
          </section>

          {/* ATENDIMENTOS */}
          <section className="mt-5 overflow-hidden rounded-lg border border-xango-border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-xango-border px-5 py-4">
              <div>
                <h3 className="font-semibold text-xango-text">
                  Atendimentos em andamento
                </h3>

                <p className="mt-1 text-xs text-xango-muted">
                  Últimos atendimentos atualizados.
                </p>
              </div>

              <button className="text-sm font-semibold text-xango-primary hover:underline">
                Ver todos
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-xango-background text-[11px] uppercase tracking-wide text-xango-muted">
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
                  {atendimentos.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-xango-border transition hover:bg-xango-background/60"
                    >
                      <td className="px-5 py-4 font-semibold">
                        #{item.id}
                      </td>

                      <td className="px-5 py-4">{item.paciente}</td>

                      <td className="px-5 py-4">{item.procedimento}</td>

                      <td className="px-5 py-4">{item.clinica}</td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${item.statusClass}`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-xs text-xango-muted">
                        {item.atualizado}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* PENDÊNCIAS */}
          <section className="mt-5 rounded-lg border border-xango-border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-xango-text">
                  Pendências que precisam de atenção
                </h3>

                <p className="mt-1 text-xs text-xango-muted">
                  Situações que exigem ação da equipe.
                </p>
              </div>

              <button className="text-sm font-semibold text-xango-primary hover:underline">
                Ver todas
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <AttentionCard
                icon={<Clock3 size={19} />}
                iconClass="bg-amber-200 text-amber-800"
                cardClass="bg-amber-50"
                value="14"
                title="Aguardando horário da clínica"
                description="Sem retorno da clínica após o envio."
              />

              <AttentionCard
                icon={<UserRound size={19} />}
                iconClass="bg-blue-200 text-blue-800"
                cardClass="bg-blue-50"
                value="9"
                title="Aguardando confirmação"
                description="Pacientes que ainda não confirmaram."
              />

              <AttentionCard
                icon={<FileWarning size={19} />}
                iconClass="bg-red-200 text-red-800"
                cardClass="bg-red-50"
                value="3"
                title="Pendências operacionais"
                description="Exames ou guias que precisam de revisão."
              />
            </div>
          </section>
        </div>
    {/* COLUNA DA DIREITA */}
    <div className="space-y-4">

      {/* AGENDA */}
      <aside className="min-h-180 overflow-hidden rounded-lg border border-xango-border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-xango-border p-5">
          <div>
            <h3 className="font-semibold text-xango-text">
              Agenda de hoje
            </h3>

            <p className="mt-1 text-xs text-xango-muted">
              Compromissos e tarefas
            </p>
          </div>

          <button className="rounded-lg border border-xango-border px-3 py-2 text-xs font-semibold text-xango-primary transition hover:bg-xango-background">
            Ver agenda
          </button>
        </div>

        <div className="p-4">
          <div className="space-y-0">
            {agendaHoje.map((item) => (
              <button
                key={`${item.horario}-${item.paciente}`}
                className="group flex w-full gap-3 rounded-lg px-2 py-4 text-left transition hover:bg-xango-background"
              >
                <div className="w-12 shrink-0 pt-0.5">
                  <p className="text-xs font-bold text-xango-text">
                    {item.horario}
                  </p>
                </div>

                <div className="relative min-w-0 flex-1 border-l border-xango-border pl-4">
                  <span className="absolute -left-1.25 top-1 h-2.5 w-2.5 rounded-full bg-xango-primary ring-4 ring-white" />

                  <p className="truncate text-sm font-semibold text-xango-text">
                    {item.paciente}
                  </p>

                  <p className="mt-1 text-xs text-xango-text">
                    {item.procedimento}
                  </p>

                  <p className="mt-1 text-[11px] text-xango-muted">
                    {item.clinica}
                  </p>

                  <span
                    className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.statusClass}`}
                  >
                    {item.status}
                  </span>

                  <div className="mt-2 hidden rounded-lg border border-xango-border bg-white p-3 text-xs text-xango-muted shadow-md group-hover:block">
                    Clique para abrir os detalhes deste atendimento.
                  </div>
                </div>
              </button>
            ))}
          </div>

          <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-xango-primary px-4 py-3 text-xs font-semibold text-xango-primary transition hover:bg-teal-50">
            <CalendarDays size={16} />
            Nova reserva na agenda
          </button>
        </div>
      </aside>

      {/* ANIVERSARIANTES */}
      <section className="rounded-lg border border-xango-border bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-xango-accent text-white">
              <Cake size={17} />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-xango-text">
                Aniversariantes do dia
              </h3>

              <p className="text-[11px] text-xango-muted">
                Pessoas relacionadas à Digna
              </p>
            </div>
          </div>

          <span className="rounded-full bg-xango-background px-2.5 py-1 text-[11px] font-semibold text-xango-primary">
            3
          </span>
        </div>

        <div className="space-y-1">
          <BirthdayPerson
            nome="Mariana Souza"
            tipo="Paciente"
          />

          <BirthdayPerson
            nome="Dr. Ricardo Alves"
            tipo="Médico parceiro"
          />

          <BirthdayPerson
            nome="Ana Martins"
            tipo="Funcionária"
          />
        </div>
      </section>
    </div>
  </div>
</div>
  );
}

function DashboardMetric({
  icon,
  iconClass,
  value,
  label,
  footer,
}: {
  icon: React.ReactNode;
  iconClass: string;
  value: string;
  label: string;
  footer: string;
}) {
  return (
    <div className="min-h-34.5 rounded-lg border border-xango-border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClass}`}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-[20px] font-bold leading-tight text-xango-text">
            {value}
          </p>

          <p className="mt-1 text-[12px] leading-4.25 text-xango-muted">
            {label}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1 text-[10px] text-xango-muted">
        <TrendingUp size={12} className="shrink-0 text-xango-primary" />
        <span>{footer}</span>
      </div>
    </div>
  );
}

function AttentionCard({
  icon,
  iconClass,
  cardClass,
  value,
  title,
  description,
}: {
  icon: React.ReactNode;
  iconClass: string;
  cardClass: string;
  value: string;
  title: string;
  description: string;
}) {
  return (
    <button
      className={`flex w-full items-start gap-3 rounded-lg border border-xango-border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${cardClass}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClass}`}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-lg font-bold text-xango-text">{value}</p>

        <p className="mt-0.5 text-xs font-semibold leading-4 text-xango-text">
          {title}
        </p>

        <p className="mt-1 text-[11px] leading-4 text-xango-muted">
          {description}
        </p>
      </div>
    </button>
  );
}

function BirthdayPerson({
  nome,
  tipo,
}: {
  nome: string;
  tipo: string;
}) {
  return (
    <button className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left transition hover:bg-xango-background">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-xango-text">
          {nome}
        </p>

        <p className="mt-0.5 text-[10px] text-xango-muted">
          {tipo}
        </p>
      </div>

      <Gift size={15} className="shrink-0 text-xango-accent" />
    </button>
  );
}