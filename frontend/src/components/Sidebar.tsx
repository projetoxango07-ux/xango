"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  { label: "Dashboard", href: "/" },
  { label: "Atendimentos", href: "/atendimentos" },
  { label: "Orçamentos", href: "/orcamentos" },
  { label: "Guias", href: "/guias" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-slate-900 p-4 text-white">
      <nav className="space-y-2">
        {menuItems.map((item) => {
          const ativo = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-4 py-3 transition ${
                ativo
                  ? "bg-slate-700 font-semibold"
                  : "hover:bg-slate-800"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}