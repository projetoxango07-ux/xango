"use client";

import { useParams } from "next/navigation";

export default function ContinuarAtendimentoPage() {
  const params = useParams();

  return (
    <div>
      <h2 className="text-2xl font-semibold text-xango-text">
        Continuar atendimento
      </h2>

      <p className="mt-2 text-xango-muted">
        Atendimento #{params.id}
      </p>
    </div>
  );
}