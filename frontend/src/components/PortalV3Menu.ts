import {
  Activity,
  ChartNoAxesCombined,
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  Settings,
  Users,
  WalletCards,
} from "lucide-react";

export const PORTAL_V3_MENU = [
  { label: "Dashboard", href: "/terceirizacao", permissao: "terceirizacao.visualizar", icon: LayoutDashboard },
  { label: "Produção", href: "/terceirizacao/producao", permissao: "terceirizacao.producao.visualizar", icon: ClipboardList },
  { label: "Equipamentos", href: "/terceirizacao/equipamentos", permissao: "terceirizacao.equipamentos.visualizar", icon: Activity },
  { label: "Laudos", href: "/terceirizacao/laudos", permissao: "terceirizacao.laudos.visualizar", icon: FileCheck2 },
  { label: "Financeiro", href: "/terceirizacao/financeiro", permissao: "terceirizacao.financeiro.visualizar", icon: WalletCards },
  { label: "Relatórios", href: "/terceirizacao/relatorios", permissao: "terceirizacao.relatorios.visualizar", icon: ChartNoAxesCombined },
  { label: "Equipe", href: "/terceirizacao/equipe", permissao: "terceirizacao.equipe.visualizar", icon: Users },
  { label: "Configurações", href: "/terceirizacao/configuracoes", permissao: "terceirizacao.configuracoes.visualizar", icon: Settings },
] as const;

export function secaoPortalV3(pathname: string) {
  return [...PORTAL_V3_MENU]
    .reverse()
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? PORTAL_V3_MENU[0];
}

export function itemPortalV3Ativo(pathname: string, href: string) {
  return href === "/terceirizacao"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}
