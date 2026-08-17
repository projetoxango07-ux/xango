import Link from "next/link";

export function Header() {
  return (
    <header className="flex h-20 items-center gap-6 border-b border-xango-border bg-white px-6">
      
      <div className="flex flex-1 justify-center">
        <div className="relative w-full max-w-2xl">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xango-muted">
            🔍
          </span>

          <input
            type="text"
            placeholder="Pesquisar paciente, guia, orçamento, clínica, atendimento..."
            className="w-full rounded-md border border-xango-border bg-white py-3 pl-11 pr-20 text-sm text-xango-text outline-none transition placeholder:text-xango-muted focus:border-xango-primary focus:ring-2 focus:ring-xango-primary/10"
          />

          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-xango-border bg-xango-background px-2 py-1 text-xs text-xango-muted">
            Ctrl + K
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/atendimentos/novo"
          className="rounded-md bg-xango-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-xango-primary-hover"
        >
          + Novo Atendimento
        </Link>

        <button
          type="button"
          className="relative rounded-md border border-xango-border bg-white px-3 py-3 text-sm hover:bg-xango-background"
          title="Notificações"
        >
          🔔
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-xango-accent px-1 text-[10px] font-bold text-white">
            3
          </span>
        </button>

        <button
          type="button"
          className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-xango-background"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-xango-primary font-semibold text-white">
            DR
          </div>

          <div className="hidden text-left lg:block">
            <p className="text-sm font-semibold text-xango-text">Diego</p>
            <p className="text-xs text-xango-muted">Administrador</p>
          </div>

          <span className="text-xango-muted">⌄</span>
        </button>
      </div>
    </header>
  );
}