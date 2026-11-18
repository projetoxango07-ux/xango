"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { ModoAprendiz } from "@/components/ModoAprendiz";
import { PortalV3Sidebar } from "@/components/PortalV3Sidebar";
import { PortalV3Header } from "@/components/PortalV3Header";
import { dignaBrandStyle } from "@/lib/dignaBrand";

// Valores limitados ao Portal Terceirização. Não alteram a identidade da V1.
const coresV3 = {
  "--background": "#F7F6F2",
  "--foreground": "#18383D",
  "--xango-primary": "#087681",
  "--xango-primary-hover": "#06616B",
  "--xango-sidebar": "#064E57",
  "--xango-sidebar-hover": "#0A6570",
  "--digna-green": "#D79422",
  "--xango-accent": "#D79422",
  "--xango-background": "#F7F6F2",
  "--xango-border": "#E3E5E1",
  "--xango-text": "#18383D",
  "--xango-muted": "#667A7D",
} as CSSProperties;

export function SistemaShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const v3 = pathname === "/terceirizacao" || pathname.startsWith("/terceirizacao/");

  if (v3) {
    return (
      <div style={coresV3} className="min-h-screen bg-[#F7F6F2] text-[#18383D]">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <PortalV3Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <PortalV3Header />
            <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 xl:px-8 xl:py-8">{children}</main>
          </div>
        </div>
      </div>
    );
  }

  // Estrutura original preservada integralmente para V1 / V1.2.
  return (
    <div style={dignaBrandStyle} className="min-h-screen bg-xango-background text-xango-text">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 p-8">{children}</main>
        </div>
      </div>
      <ModoAprendiz />
    </div>
  );
}
