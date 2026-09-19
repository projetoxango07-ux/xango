"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  LayoutDashboard, Headphones, FileText, TicketCheck, CalendarDays, Users,
  Building2, Stethoscope, WalletCards, ChartNoAxesCombined, Settings,
  CalendarCheck, CircleAlert, CircleHelp, GraduationCap, Sparkles,
} from "lucide-react";

const grupos = [
  {
    titulo: "OPERAÇÃO",
    itens: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard, permissao: "dashboard.visualizar" },
      { label: "Atendimentos", href: "/atendimentos", icon: Headphones, permissao: "atendimentos.visualizar" },
      { label: "Orçamentos", href: "/orcamentos", icon: FileText, permissao: "orcamentos.visualizar" },
      { label: "Guias", href: "/guias", icon: TicketCheck, permissao: "guias.visualizar" },
      { label: "Agenda", href: "/agenda", icon: CalendarDays, permissao: "agenda.visualizar" },
    ],
  },
  {
    titulo: "CADASTROS",
    itens: [
      { label: "Pacientes", href: "/pacientes", icon: Users, permissao: "pacientes.visualizar" },
      { label: "Clínicas", href: "/clinicas", icon: Building2, permissao: "clinicas.visualizar" },
      { label: "Procedimentos", href: "/procedimentos", icon: Stethoscope, permissao: "procedimentos.visualizar" },
    ],
  },
  {
    titulo: "GESTÃO",
    itens: [
      { label: "Financeiro", href: "/financeiro", icon: WalletCards, permissao: "financeiro.visualizar" },
      { label: "Relatórios", href: "/relatorios", icon: ChartNoAxesCombined, permissao: "relatorios.visualizar" },
    ],
  },
];

function hojeSaoPaulo() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valor = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valor.year}-${valor.month}-${valor.day}`;
}

export function Sidebar() {
  const pathname = usePathname();
  const { usuario, temPermissao, recarregarUsuario } = useAuth();
  const hoje = hojeSaoPaulo();

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col bg-xango-sidebar px-4 py-6 text-white">
      <div className="mb-5 px-3 pt-1">
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-center">
          <p className="text-xl font-black tracking-wide text-white">{usuario.organizacao.nomeFantasia}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-digna-green">Portal interno</p>
        </div>
      </div>

      <nav className="flex-1">
        {grupos.map((grupo) => {
          const itens = grupo.itens.filter((item) => temPermissao(item.permissao));
          if (itens.length === 0) return null;
          return (
            <div key={grupo.titulo} className="mb-7">
              <p className="mb-2 px-3 text-[11px] font-semibold tracking-widest text-white/45">{grupo.titulo}</p>
              <div className="space-y-1">
                {itens.map((item) => {
                  const ativo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className={`relative flex items-center gap-3 overflow-hidden rounded-md px-4 py-3 text-sm transition ${ativo ? "bg-xango-primary font-semibold shadow-sm" : "text-white/80 hover:bg-xango-sidebar-hover hover:text-white"}`}>
                      {ativo && (
                        <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-digna-green" />
                      )}
                      <Icon size={18} strokeWidth={1.8} /><span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {temPermissao("configuracoes.visualizar") && (
          <div className="mb-7">
            <p className="mb-2 px-3 text-[11px] font-semibold tracking-widest text-white/45">SISTEMA</p>
            <Link href="/configuracoes" className={`relative flex items-center gap-3 overflow-hidden rounded-md px-4 py-3 text-sm transition ${pathname.startsWith("/configuracoes") ? "bg-xango-primary font-semibold shadow-sm" : "text-white/80 hover:bg-xango-sidebar-hover hover:text-white"}`}>
              {pathname.startsWith("/configuracoes") && (
                <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-digna-green" />
              )}
              <Settings size={18} strokeWidth={1.8} /><span>Configurações</span>
            </Link>
          </div>
        )}
      </nav>

      {usuario.modoAprendizAtivo && (
        <div className="mb-4 rounded-lg border border-digna-green/60 bg-white/5 p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-digna-green/15 text-digna-green">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white">Modo Aprendiz ativo</p>
              <p className="mt-1 text-[10px] leading-4 text-white/60">
                Seu perfil está em treinamento contínuo.
              </p>
              <button
                type="button"
                onClick={async () => {
                  const confirmar = window.confirm(
                    "Deseja encerrar o Modo Aprendiz para o seu usuário?"
                  );
                  if (!confirmar) return;
                  const resposta = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333"}/treinamento/me`,
                    {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ modoAprendizAtivo: false }),
                    }
                  );
                  const dados = await resposta.json().catch(() => ({}));
                  if (!resposta.ok) {
                    window.alert(dados.erro || "Não foi possível encerrar o Modo Aprendiz.");
                    return;
                  }
                  await recarregarUsuario();
                }}
                className="mt-2 text-[10px] font-semibold text-digna-green hover:underline"
              >
                Encerrar Modo Aprendiz
              </button>
            </div>
          </div>
        </div>
      )}

      <Link
        href="/ajuda"
        data-aprendiz="ajuda"
        className="ajuda-destaque group mb-5 flex w-full items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-digna-green text-digna-green"><CircleHelp size={20} strokeWidth={1.8} /></div>
        <div className="min-w-0"><p className="text-sm font-semibold text-white">Precisa de ajuda?</p><p className="mt-1 text-[11px] leading-4 text-white/65">Central de ajuda, Tour Guiado e informe de problemas.</p></div>
      </Link>

      <div className="border-t border-white/15 pt-5">
        <p className="px-3 text-xs font-semibold tracking-wider text-digna-green">ATALHOS</p>
        <div className="mt-2 space-y-1">
          {temPermissao("agenda.visualizar") && (
            <Link href={`/agenda?data=${hoje}`} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/75 transition hover:bg-white/10 hover:text-white">
              <CalendarCheck size={17} />Agenda do dia
            </Link>
          )}
          <Link href="/?secao=pendencias" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/75 transition hover:bg-white/10 hover:text-white">
            <CircleAlert size={17} />Pendências
          </Link>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("digna:ativar-tour"))}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            <GraduationCap size={17} />Tour desta tela
          </button>
        </div>
      </div>
    </aside>
  );
}
