"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:3333";

type ClinicaOpcao = {
  id: number;
  nome: string;
  unidades: { id: number; nome: string }[];
};

type Simulacao = {
  guiaId: number;
  codigoVoucher: string | null;
  novaClinicaNome: string;
  valorAnterior: number;
  valorNovo: number;
  pagoLiquido: number;
  saldo: number;
  excedenteARegularizar: number;
  assinatura: string;
  aviso: string;
};

export default function TrocaClinicaGuiaV122({
  guiaId,
  clinicaAtualId,
  unidadeAtualId,
  clinicas,
  onConcluido,
}: {
  guiaId: number;
  clinicaAtualId: number;
  unidadeAtualId: number | null;
  clinicas: ClinicaOpcao[];
  onConcluido: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [clinicaNovaId, setClinicaNovaId] = useState(String(clinicaAtualId));
  const [unidadeNovaId, setUnidadeNovaId] = useState(unidadeAtualId ? String(unidadeAtualId) : "");
  const [tipo, setTipo] = useState<"AGUARDANDO" | "HORARIO" | "ORDEM_CHEGADA">("AGUARDANDO");
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [motivo, setMotivo] = useState("");
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const clinica = clinicas.find((item) => item.id === Number(clinicaNovaId));
  const moeda = (valor: number) => Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const invalidar = () => { setSimulacao(null); setErro(""); };

  async function enviar(simular: boolean) {
    try {
      setProcessando(true);
      setErro("");
      const corpo = {
        clinicaId: Number(clinicaNovaId),
        unidadeClinicaId: unidadeNovaId ? Number(unidadeNovaId) : null,
        tipoAgendamento: tipo,
        dataAgendamento: tipo === "AGUARDANDO" ? null : data,
        horarioAgendamento: tipo === "HORARIO" ? horario : null,
        motivo: motivo.trim(),
        ...(simular ? {} : { assinatura: simulacao?.assinatura }),
      };
      const resposta = await fetch(`${API_URL}/guias/${guiaId}/trocar-clinica${simular ? "/simular" : ""}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível processar a troca da guia.");
      if (simular) {
        setSimulacao(dados as Simulacao);
      } else {
        alert(`Clínica alterada na mesma guia ${dados.codigoVoucher || `#${guiaId}`}!\n${dados.aviso}`);
        onConcluido();
      }
    } catch (falha) {
      setSimulacao(null);
      setErro(falha instanceof Error ? falha.message : "Falha ao trocar a clínica.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="mt-3 w-full">
      {!aberto ? (
        <button type="button" onClick={() => setAberto(true)}
          className="rounded-md border border-amber-600 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50">
          Trocar clínica/unidade desta guia
        </button>
      ) : (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-amber-900">Alterar clínica — guia #{guiaId}</strong>
            <button type="button" className="text-xs underline" disabled={processando}
              onClick={() => { setAberto(false); invalidar(); }}>Fechar</button>
          </div>
          <p className="mt-2 text-xs text-amber-900">
            Essa operação altera a guia inteira, não transfere procedimentos isolados e preserva os recebimentos.
            Um agendamento antigo não será mantido automaticamente.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold">Nova clínica
              <select className="mt-1 w-full rounded-md border p-2 text-sm" value={clinicaNovaId}
                onChange={(e) => { setClinicaNovaId(e.target.value); setUnidadeNovaId(""); invalidar(); }}>
                {clinicas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold">Nova unidade
              <select className="mt-1 w-full rounded-md border p-2 text-sm" value={unidadeNovaId}
                disabled={!clinica?.unidades.length}
                onChange={(e) => { setUnidadeNovaId(e.target.value); invalidar(); }}>
                <option value="">{clinica?.unidades.length ? "Selecione a unidade" : "Sem unidade"}</option>
                {clinica?.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold">Novo agendamento
              <select className="mt-1 w-full rounded-md border p-2 text-sm" value={tipo}
                onChange={(e) => { setTipo(e.target.value as typeof tipo); setData(""); setHorario(""); invalidar(); }}>
                <option value="AGUARDANDO">Aguardando nova confirmação</option>
                <option value="HORARIO">Data e horário</option>
                <option value="ORDEM_CHEGADA">Ordem de chegada</option>
              </select>
            </label>
            {tipo !== "AGUARDANDO" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold">Data
                  <input type="date" className="mt-1 w-full rounded-md border p-2 text-sm" value={data}
                    onChange={(e) => { setData(e.target.value); invalidar(); }} />
                </label>
                {tipo === "HORARIO" && <label className="text-xs font-semibold">Horário
                  <input type="time" className="mt-1 w-full rounded-md border p-2 text-sm" value={horario}
                    onChange={(e) => { setHorario(e.target.value); invalidar(); }} />
                </label>}
              </div>
            )}
          </div>
          <label className="mt-3 block text-xs font-semibold">Motivo da troca (obrigatório)
            <textarea className="mt-1 w-full rounded-md border p-2 text-sm" rows={2} value={motivo}
              placeholder="Explique por que a guia será transferida para outra clínica."
              onChange={(e) => { setMotivo(e.target.value); invalidar(); }} />
          </label>
          {erro && <p role="alert" className="mt-3 rounded-md bg-red-100 p-2 text-xs text-red-800">{erro}</p>}
          {simulacao && (
            <div className="mt-3 rounded-md border border-amber-300 bg-white p-3">
              <p className="font-semibold">Simulação — voucher {simulacao.codigoVoucher || `#${guiaId}`}</p>
              <p className="mt-1">Novo local: {simulacao.novaClinicaNome}</p>
              <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                <p>Valor anterior: <strong>{moeda(simulacao.valorAnterior)}</strong></p>
                <p>Novo valor: <strong>{moeda(simulacao.valorNovo)}</strong></p>
                <p>Já recebido (líquido): <strong>{moeda(simulacao.pagoLiquido)}</strong></p>
                <p>Saldo: <strong>{moeda(simulacao.saldo)}</strong></p>
              </div>
              {simulacao.excedenteARegularizar > 0 && (
                <p className="mt-2 font-semibold text-red-700">Excedente a regularizar: {moeda(simulacao.excedenteARegularizar)}. Nenhum estorno é automático.</p>
              )}
              <p className="mt-2 text-xs text-amber-900">{simulacao.aviso}</p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={processando} onClick={() => void enviar(true)}
              className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-600 disabled:opacity-50">
              {processando ? "Processando..." : "Simular valores e bloqueios"}
            </button>
            <button type="button" disabled={!simulacao || processando} onClick={() => void enviar(false)}
              className="rounded-md bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
              Confirmar troca auditada
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
