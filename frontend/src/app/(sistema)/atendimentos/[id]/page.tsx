"use client";

import { useParams } from "next/navigation";
import AtendimentoForm from "@/components/AtendimentoForm";

export default function ContinuarAtendimentoPage() {
  const params = useParams();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const atendimentoId = Number(idParam);

  if (!Number.isInteger(atendimentoId) || atendimentoId <= 0) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Atendimento inválido.
      </div>
    );
  }

  return <AtendimentoForm atendimentoId={atendimentoId} />;
}