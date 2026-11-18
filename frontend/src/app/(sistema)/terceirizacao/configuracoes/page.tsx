import Link from "next/link";

export default function ModuloPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <Link href="/terceirizacao/configuracoes/laudos" className="mb-5 mr-3 inline-block rounded-md bg-[#064E57] px-4 py-2 text-sm font-semibold text-white">Prazos, convênios e entrega de laudos</Link>
      <Link href="/terceirizacao/configuracoes/clinicas" className="mb-5 mr-3 inline-block rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Gerenciar clínicas e parcerias</Link>
      <Link href="/terceirizacao/configuracoes/financeiro" className="mb-5 inline-block rounded-md bg-[#087681] px-4 py-2 text-sm font-semibold text-white">Tabela financeira por clínica</Link>
      <h2 className="text-2xl font-semibold text-slate-900">
        Configurações
      </h2>

      <p className="mt-2 text-slate-500">
        Clínicas, exames, valores, telemedicinas e parâmetros.
      </p>

      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">
          Estrutura inicial criada. As funcionalidades deste módulo
          serão integradas nas próximas etapas do desenvolvimento.
        </p>
      </div>
    </div>
  );
}