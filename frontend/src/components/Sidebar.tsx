"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Headphones,
  FileText,
  TicketCheck,
  CalendarDays,
  Users,
  Building2,
  Stethoscope,
  WalletCards,
  ChartNoAxesCombined,
  Settings,
  CalendarCheck,
  CircleAlert,
  CircleHelp,
} from "lucide-react";

const grupos = [
  {
    titulo: "OPERAÇÃO",
    itens: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Atendimentos", href: "/atendimentos", icon: Headphones },
      { label: "Orçamentos", href: "/orcamentos", icon: FileText },
      { label: "Guias", href: "/guias", icon: TicketCheck },
      { label: "Agenda", href: "/agenda", icon: CalendarDays },
    ],
  },
  {
    titulo: "CADASTROS",
    itens: [
      { label: "Pacientes", href: "/pacientes", icon: Users },
      { label: "Clínicas", href: "/clinicas", icon: Building2 },
      { label: "Procedimentos", href: "/procedimentos", icon: Stethoscope },
    ],
  },
  {
    titulo: "GESTÃO",
    itens: [
      { label: "Financeiro", href: "/financeiro", icon: WalletCards },
      { label: "Relatórios", href: "/relatorios", icon: ChartNoAxesCombined },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col bg-xango-sidebar px-4 py-6 text-white">
      <div className="mb-5 px-3 pt-1">
        {/* Marca Digna Conect */}
        <div className="flex justify-center">
          <Image
            src="/digna-conect-branca-v2.png"
            alt="Digna Conect"
            width={220}
            height={100}
            priority
            className="h-auto w-full max-w-55 object-contain"
          />
        </div>

        {/* Empresa que utiliza o sistema */}
        <div className="mt-2 border-t border-white/15 pt-3 text-center">
          <p className="text-base font-bold tracking-wide text-xango-accent">
            Digna Saúde
          </p>
        </div>
      </div>

      <nav className="flex-1">
        {grupos.map((grupo) => (
          <div key={grupo.titulo} className="mb-7">
            <p className="mb-2 px-3 text-[11px] font-semibold tracking-widest text-white/45">
              {grupo.titulo}
            </p>

            <div className="space-y-1">
              {grupo.itens.map((item) => {
                const ativo =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-3 overflow-hidden rounded-md px-4 py-3 text-sm transition ${
                      ativo
                        ? "menu-ativo bg-xango-primary font-semibold shadow-sm"
                        : "text-white/80 hover:bg-xango-sidebar-hover hover:text-white"
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mb-7">
          <p className="mb-2 px-3 text-[11px] font-semibold tracking-widest text-white/45">
            SISTEMA
          </p>

          <Link
            href="/configuracoes"
            className={`relative flex items-center gap-3 overflow-hidden rounded-md px-4 py-3 text-sm transition ${
              pathname.startsWith("/configuracoes")
                ? "menu-ativo bg-xango-primary font-semibold shadow-sm"
                : "text-white/80 hover:bg-xango-sidebar-hover hover:text-white"
            }`}
          >
            <Settings size={18} strokeWidth={1.8} />
            <span>Configurações</span>
          </Link>
        </div>
      </nav>

      <button className="ajuda-destaque group mb-5 flex w-full items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10">
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-xango-accent text-xango-accent">
    <CircleHelp size={20} strokeWidth={1.8} />
  </div>

  <div className="min-w-0">
    <p className="text-sm font-semibold text-white">
      Precisa de ajuda?
    </p>

    <p className="mt-1 text-[11px] leading-4 text-white/65">
      Acesse nossos tutoriais e artigos da base de conhecimento.
    </p>
  </div>
</button>

      <div className="border-t border-white/15 pt-5">
        <p className="px-3 text-xs font-semibold tracking-wider text-xango-accent">
          ATALHOS
        </p>

        <div className="mt-2 space-y-1">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/75 transition hover:bg-white/10 hover:text-white">
            <CalendarCheck size={17} />
            Agenda do dia
          </button>

          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/75 transition hover:bg-white/10 hover:text-white">
            <CircleAlert size={17} />
            Pendências
          </button>
        </div>
      </div>
    </aside>
  );
}