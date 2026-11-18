"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronRight, Stethoscope } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { itemPortalV3Ativo, PORTAL_V3_MENU } from "@/components/PortalV3Menu";

export function PortalV3Sidebar() {
  const pathname = usePathname();
  const { temPermissao } = useAuth();
  const itens = PORTAL_V3_MENU.filter((item) => temPermissao(item.permissao));
  const podeVoltar = temPermissao("dashboard.visualizar");

  return (
    <>
      <aside className="hidden min-h-screen w-64 shrink-0 flex-col bg-[#064E57] px-4 py-6 text-white lg:flex xl:w-72">
        <Link href="/terceirizacao" className="mb-8 rounded-xl border border-white/15 bg-white/5 px-4 py-5 transition hover:bg-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#D79422]/70 bg-[#063E45] text-xl font-black tracking-tighter text-[#F0C77D] shadow-inner">
              DC
            </div>
            <div className="min-w-0">
              <p className="text-[17px] font-extrabold leading-tight tracking-wide">DIGNA</p>
              <p className="text-[10px] font-bold tracking-[0.28em] text-[#E9BC68]">CONECT</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-white/15 pt-4">
            <Stethoscope size={16} className="text-[#E9BC68]" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold">Portal Terceirização</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-widest text-white/55">Ambiente V3.0</p>
            </div>
          </div>
        </Link>

        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#F0C77D]">Gestão operacional</p>
        <nav aria-label="Menu da Terceirização" className="flex-1 space-y-1">
          {itens.map((item) => {
            const ativo = itemPortalV3Ativo(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F0C77D] ${
                  ativo
                    ? "bg-[#087681] font-semibold text-white shadow-sm ring-1 ring-white/10"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                {ativo && <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-[#E9BC68]" />}
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" className={ativo ? "text-[#F0C77D]" : ""} />
                <span className="flex-1">{item.label}</span>
                {ativo && <ChevronRight size={14} className="text-[#F0C77D]" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>

        {podeVoltar && (
          <div className="mt-8 border-t border-white/15 pt-5">
            <Link href="/" className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-[#F1CF91] transition hover:bg-white/10 hover:text-white">
              <ArrowLeft size={17} aria-hidden="true" />
              Voltar à Digna Saúde
            </Link>
            <p className="mt-2 px-4 text-[11px] leading-5 text-white/50">Ambiente de agendamentos (V1)</p>
          </div>
        )}
      </aside>

      <div className="border-b border-[#0B6873] bg-[#064E57] px-4 pb-3 pt-4 text-white lg:hidden">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D79422] text-xs font-black text-[#F0C77D]">DC</div>
            <span className="text-sm font-bold">Digna Conect <span className="font-normal text-[#F0C77D]">· Terceirização</span></span>
          </div>
          {podeVoltar && (
            <Link href="/" aria-label="Voltar ao Portal Digna Saúde" title="Voltar à Digna Saúde" className="rounded-lg border border-white/25 p-2 text-[#F0C77D]">
              <ArrowLeft size={17} aria-hidden="true" />
            </Link>
          )}
        </div>
        <nav aria-label="Menu da Terceirização (celular)" className="flex gap-1 overflow-x-auto pb-1">
          {itens.map((item) => {
            const ativo = itemPortalV3Ativo(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} aria-current={ativo ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs ${ativo ? "bg-[#087681] font-bold text-[#FFE1A8]" : "text-white/80"}`}>
                <Icon size={15} aria-hidden="true" />{item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
