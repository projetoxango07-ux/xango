"use client";

import { useParams } from "next/navigation";
import OrcamentoForm from "@/components/OrcamentoForm";

export default function EditarOrcamentoPage() {
  const params = useParams();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const orcamentoId = Number(idParam);

  if (!Number.isInteger(orcamentoId) || orcamentoId <= 0) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Orçamento inválido.
      </div>
    );
  }

  return <OrcamentoForm orcamentoId={orcamentoId} />;
}
