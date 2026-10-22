"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:3333";

type Candidata = {
  id: number;
  nome: string;
  cpf: string | null;
  dataNascimento: string | null;
};

type Props = {
  nome: string;
  selecionadaId: number | null;
  pacienteId?: number;
  onDigitar: (nome: string) => void;
  onSelecionar: (paciente: { id: number; nome: string }) => void;
};

function nascimento(v: string | null) {
  if (!v) return "Nascimento não informado";
  const data = new Date(v);
  return Number.isNaN(data.valueOf())
    ? "Nascimento não informado"
    : data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
function cpfVisivel(v: string | null) {
  const n = (v || "").replace(/\D/g, "");
  return n.length === 11 ? `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}` : "CPF não informado";
}

export default function BuscaMaePaciente({ nome, selecionadaId, pacienteId, onDigitar, onSelecionar }: Props) {
  const [pesquisar, setPesquisar] = useState(false);
  const [resultados, setResultados] = useState<Candidata[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const termo = nome.trim();
    if (!pesquisar || selecionadaId || termo.length < 2) return;
    const controller = new AbortController();
    const tempo = window.setTimeout(async () => {
      try {
        setCarregando(true); setErro("");
        const resposta = await fetch(`${API}/pacientes/busca?termo=${encodeURIComponent(termo)}&limite=20`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const dados = await resposta.json();
        if (!resposta.ok || !Array.isArray(dados)) throw new Error("Não foi possível pesquisar pacientes.");
        if (!controller.signal.aborted) setResultados(dados.filter((p: Candidata) => p.id !== pacienteId));
      } catch {
        if (!controller.signal.aborted) { setErro("Falha na pesquisa de pacientes."); setResultados([]); }
      } finally {
        if (!controller.signal.aborted) setCarregando(false);
      }
    }, 300);
    return () => { window.clearTimeout(tempo); controller.abort(); };
  }, [nome, pacienteId, pesquisar, selecionadaId]);

  return <div className="relative min-w-0">
    <label className="block text-xs font-semibold text-xango-muted">Nome da mãe</label>
    <input
      type="text"
      autoComplete="off"
      value={nome}
      onFocus={() => setPesquisar(true)}
      onChange={e => { onDigitar(e.target.value); setPesquisar(true); setResultados([]); }}
      placeholder="Digite o nome ou CPF; selecione se já for paciente"
      className="mt-1 w-full rounded-md border border-xango-border bg-white px-3 py-2 text-sm outline-none focus:border-xango-primary"
    />
    {selecionadaId ? <p className="mt-1 text-xs font-semibold text-emerald-700">Mãe selecionada para vínculo familiar.</p> :
      <p className="mt-1 text-[11px] text-xango-muted">Se ela não estiver cadastrada, mantenha o nome digitado.</p>}
    {pesquisar && !selecionadaId && nome.trim().length >= 2 && <div className="mt-2 max-h-52 overflow-y-auto rounded-md border border-xango-border bg-white shadow-sm">
      {carregando && <p className="p-2 text-xs text-xango-muted">Pesquisando...</p>}
      {erro && <p className="p-2 text-xs text-red-700">{erro}</p>}
      {!carregando && !erro && resultados.length === 0 && <p className="p-2 text-xs text-xango-muted">Nenhuma correspondência. É possível digitar o nome livremente.</p>}
      {resultados.map(p => <button key={p.id} type="button"
        onClick={() => { onSelecionar({ id: p.id, nome: p.nome }); setPesquisar(false); setResultados([]); }}
        className="flex w-full min-w-0 items-center gap-2 border-b border-xango-border px-2 py-2 text-left last:border-b-0 hover:bg-xango-background"
      >
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold" title={p.nome}>{p.nome}</span>
        <span className="shrink-0 whitespace-nowrap text-[10px] text-xango-muted">{nascimento(p.dataNascimento)}</span>
        <span className="shrink-0 whitespace-nowrap text-[10px] text-xango-muted">{cpfVisivel(p.cpf)}</span>
      </button>)}
    </div>}
  </div>;
}
