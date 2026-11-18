"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronRight, LogOut, Plus, UserRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { secaoPortalV3 } from "@/components/PortalV3Menu";
import { PortalV3BuscaNotificacoes } from "@/components/PortalV3BuscaNotificacoes";

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return `${partes[0]?.[0] || "U"}${partes.length > 1 ? partes[partes.length - 1]?.[0] || "" : ""}`.toUpperCase();
}

export function PortalV3Header() {
  const pathname = usePathname();
  const { usuario, temPermissao, sair } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);
  const secao = secaoPortalV3(pathname);
  const podeCriar = temPermissao("terceirizacao.producao.criar");

  return (
    <header className="relative z-40 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-[#E3E5E1] bg-white px-4 py-4 sm:px-6 xl:px-8">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#087681]">
          <span>Digna Conect</span><ChevronRight size={12} aria-hidden="true" /><span>V3.0</span>
        </div>
        <h1 className="mt-1 text-lg font-bold tracking-tight text-[#18383D]">{secao.label}</h1>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:gap-3">
        {podeCriar && (
          <Link href="/terceirizacao/producao#novo-lancamento"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#087681] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#06616B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087681] sm:px-4 sm:text-sm">
            <Plus size={17} aria-hidden="true" /><span className="hidden sm:inline">Novo lançamento de exame</span><span className="sm:hidden">Novo exame</span>
          </Link>
        )}
        <PortalV3BuscaNotificacoes />
        <div className="relative">
          <button type="button" onClick={() => setMenuAberto((v) => !v)} aria-expanded={menuAberto} aria-haspopup="menu"
            className="flex items-center gap-2 rounded-lg border border-[#E3E5E1] p-1.5 text-[#18383D] transition hover:bg-[#F7F6F2] sm:gap-3 sm:px-2 sm:py-1.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#064E57] text-xs font-bold text-white">{iniciais(usuario.nome)}</span>
            <span className="hidden max-w-40 text-left lg:block">
              <span className="block truncate text-xs font-semibold">{usuario.nome}</span>
              <span className="block text-[11px] text-[#667A7D]">{usuario.perfil === "ADMINISTRADOR" ? "Administrador" : usuario.perfil === "GERENTE" ? "Gerente" : usuario.perfil === "DESENVOLVEDOR" ? "Desenvolvedor" : "Atendente"}</span>
            </span>
            <ChevronDown size={15} aria-hidden="true" className="text-[#667A7D]" />
          </button>
          {menuAberto && (
            <>
              <button type="button" aria-label="Fechar menu do usuário" onClick={() => setMenuAberto(false)} className="fixed inset-0 z-40 cursor-default" />
              <div role="menu" className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-[#E3E5E1] bg-white p-2 shadow-xl">
                <div className="border-b border-[#E3E5E1] px-3 py-3">
                  <p className="truncate text-sm font-semibold text-[#18383D]">{usuario.nome}</p>
                  <p className="mt-1 truncate text-xs text-[#667A7D]">{usuario.email || "Usuário do sistema"}</p>
                </div>
                <Link href="/trocar-senha" role="menuitem" onClick={() => setMenuAberto(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-3 text-sm text-[#18383D] hover:bg-[#F7F6F2]"><UserRound size={16} />Alterar senha</Link>
                <button type="button" role="menuitem" onClick={() => void sair()} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"><LogOut size={16} />Sair</button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
