export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="flex h-16 items-center justify-between border-b bg-white px-6">
        <div>
          <h1 className="text-xl font-bold">XANGÔ</h1>
          <p className="text-xs text-slate-500">Digna Saúde</p>
        </div>

        <div className="text-sm">
          Diego
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside className="w-64 border-r bg-slate-900 p-4 text-white">
          <nav className="space-y-2">
            <button className="w-full rounded-lg bg-slate-800 px-4 py-3 text-left">
              Dashboard
            </button>

            <button className="w-full rounded-lg px-4 py-3 text-left hover:bg-slate-800">
              Atendimentos
            </button>

            <button className="w-full rounded-lg px-4 py-3 text-left hover:bg-slate-800">
              Orçamentos
            </button>

            <button className="w-full rounded-lg px-4 py-3 text-left hover:bg-slate-800">
              Guias
            </button>

            <button className="w-full rounded-lg px-4 py-3 text-left hover:bg-slate-800">
              Clínicas
            </button>

            <button className="w-full rounded-lg px-4 py-3 text-left hover:bg-slate-800">
              Financeiro
            </button>
          </nav>
        </aside>

        <main className="flex-1 p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold">Dashboard</h2>
            <p className="mt-1 text-slate-500">
              Visão geral da operação.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Atendimentos hoje</p>
              <p className="mt-2 text-3xl font-bold">0</p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Guias pendentes</p>
              <p className="mt-2 text-3xl font-bold">0</p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Pendências</p>
              <p className="mt-2 text-3xl font-bold">0</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}