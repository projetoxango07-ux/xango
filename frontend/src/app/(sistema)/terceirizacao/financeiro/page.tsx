"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import PortalV3ConferenciaLotes from "@/components/PortalV3ConferenciaLotes";
import PortalV3TitulosAuto from "@/components/PortalV3TitulosAuto";
import PortalV3Recebimentos from "@/components/PortalV3Recebimentos";

export default function FinanceiroTerceirizacaoPage() {
  const { usuario, temPermissao } = useAuth();
  const podeEditar = temPermissao("terceirizacao.financeiro.editar");
  const podeAdministrarTitulos = usuario?.perfil === "ADMINISTRADOR" && podeEditar;
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-semibold text-[#18383D]">Financeiro da Terceirização</h2>
        <p className="mt-1 text-sm text-[#667A7D]">Conferência rápida dos pagamentos por clínica e vencimento, inclusive exames de competências anteriores.</p></div>
      <Link href="/terceirizacao/configuracoes/financeiro"
        className="rounded-lg border border-[#087681] px-4 py-2 text-sm font-semibold text-[#087681] hover:bg-teal-50">
        Tabela de preços por clínica
      </Link>
    </header>
    <PortalV3ConferenciaLotes />
    <section className="rounded-xl border border-[#E3E5E1] bg-white p-4">
      <button type="button" aria-expanded={detalhesAbertos}
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-[#064E57]"
        onClick={() => setDetalhesAbertos((aberto) => !aberto)}>
        <span>Títulos, histórico e ajustes excepcionais</span>
        <span className="text-lg" aria-hidden="true">{detalhesAbertos ? "−" : "+"}</span>
      </button>
      {detalhesAbertos && <div className="mt-4 space-y-4">
        <p className="text-sm text-[#667A7D]">Consulta por competência de produção. Edição de títulos, estornos e reprogramação são ações auditadas e restritas ao Administrador.</p>
        <PortalV3TitulosAuto podeAdministrar={podeAdministrarTitulos} />
        <PortalV3Recebimentos />
      </div>}
    </section>
  </div>;
}
