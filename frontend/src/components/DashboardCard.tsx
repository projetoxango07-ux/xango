type DashboardCardProps = {
  title: string;
  value: string | number;
};

export function DashboardCard({
  title,
  value,
}: DashboardCardProps) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}