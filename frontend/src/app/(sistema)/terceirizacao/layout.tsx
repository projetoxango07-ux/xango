"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { secaoPortalV3 } from "@/components/PortalV3Menu";

export default function TerceirizacaoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { temPermissao } = useAuth();
  const pathname = usePathname();
  const secao = secaoPortalV3(pathname);

  if (!temPermissao("terceirizacao.visualizar") || !temPermissao(secao.permissao)) {
    return (
      <section className="rounded-xl border border-[#E3E5E1] bg-white p-6">
        <h2 className="text-xl font-semibold text-[#18383D]">Acesso não autorizado</h2>
        <p className="mt-2 text-sm text-[#667A7D]">Seu perfil não permite acessar esta área da terceirização.</p>
      </section>
    );
  }

  // A navegação e a identidade V3 agora são responsabilidade do SistemaShell.
  // Evita a barra horizontal duplicada que existia anteriormente.
  return <div className="mx-auto w-full max-w-[1500px] space-y-6">{children}</div>;
}
