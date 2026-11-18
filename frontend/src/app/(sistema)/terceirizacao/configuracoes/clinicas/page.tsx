"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
type Clinica = {
  id: number;
  nome: string;
  ativo: boolean;
  parceriaAgendamentos: boolean;
  parceriaTerceirizacao: boolean;
};

export default function ParceriasClinicasPage() {
  const { temPermissao } = useAuth();
  const podeEditar = temPermissao("terceirizacao.configuracoes.editar");
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [busca, setBusca] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const resposta = await fetch(`${API}/terceirizacao/clinicas-parcerias`, { cache: "no-store" });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || "Falha ao consultar clínicas.");
    setClinicas(Array.isArray(dados.clinicas) ? dados.clinicas : []);
  }, []);
  useEffect(() => {
    void carregar().catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar clínicas."));
  }, [carregar]);

  function alterar(id: number, campo: "parceriaAgendamentos" | "parceriaTerceirizacao", valor: boolean) {
    setClinicas((lista) => lista.map((c) => c.id === id ? { ...c, [campo]: valor } : c));
    setSucesso("");
  }

  async function salvar(clinica: Clinica) {
    setErro(""); setSucesso(""); setSalvando(true);
    try {
      const resposta = await fetch(`${API}/terceirizacao/clinicas-parcerias/${clinica.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parceriaAgendamentos: clinica.parceriaAgendamentos,
          parceriaTerceirizacao: clinica.parceriaTerceirizacao,
        }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível salvar a parceria.");
      setSucesso(`Parcerias de ${clinica.nome} atualizadas.`);
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao salvar."); }
    finally { setSalvando(false); }
  }

  async function criar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault(); setErro(""); setSucesso(""); setSalvando(true);
    try {
      const resposta = await fetch(`${API}/terceirizacao/clinicas-parcerias`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: novoNome.trim() }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível cadastrar a clínica.");
      setNovoNome(""); setSucesso("Clínica de terceirização cadastrada.");
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao cadastrar."); }
    finally { setSalvando(false); }
  }

  const filtradas = clinicas.filter((c) => c.nome.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  return <section className="space-y-5">
    <div>
      <h2 className="text-2xl font-semibold">Clínicas e tipos de parceria</h2>
      <p className="mt-1 text-sm text-slate-500">Um único cadastro por clínica, com participação independente na V1 e na V3.</p>
    </div>
    {erro && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    {sucesso && <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">{sucesso}</p>}
    {podeEditar && <form onSubmit={criar} className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-5">
      <label className="flex min-w-56 flex-1 flex-col gap-2 text-sm font-semibold">Cadastrar clínica exclusiva da V3
        <input className="rounded-md border p-3 font-normal" placeholder="Nome da clínica" value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)} minLength={3} maxLength={160} required />
      </label>
      <button type="submit" disabled={salvando} className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Cadastrar</button>
    </form>}
    <div className="rounded-xl border bg-white p-5">
      <input value={busca} onChange={(e) => setBusca(e.target.value)} className="mb-3 w-full rounded-md border p-3 text-sm" placeholder="Filtrar clínicas por nome" />
      <p className="mb-3 text-xs text-slate-500">As clínicas existentes começam habilitadas na V1. Habilite a V3 somente nas clínicas que fazem terceirização.</p>
      <div className="divide-y">
        {filtradas.map((c) => <div key={c.id} className="flex flex-wrap items-center gap-4 py-3">
          <div className="min-w-44 flex-1"><p className="font-medium">{c.nome}</p><p className="text-xs text-slate-500">{c.ativo ? "Ativa" : "Inativa"}</p></div>
          <label className="flex items-center gap-2 text-sm"><input disabled={!podeEditar} type="checkbox" checked={c.parceriaAgendamentos}
            onChange={(e) => alterar(c.id, "parceriaAgendamentos", e.target.checked)} /> V1 — Agendamentos</label>
          <label className="flex items-center gap-2 text-sm"><input disabled={!podeEditar} type="checkbox" checked={c.parceriaTerceirizacao}
            onChange={(e) => alterar(c.id, "parceriaTerceirizacao", e.target.checked)} /> V3 — Terceirização</label>
          {c.parceriaTerceirizacao && <Link href={`/terceirizacao/configuracoes/financeiro?clinicaId=${c.id}`} className="rounded-md border border-[#087681] px-3 py-2 text-sm font-medium text-[#087681] hover:bg-emerald-50">Tabela financeira</Link>}
          {podeEditar && <button disabled={salvando} onClick={() => void salvar(c)} className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-40">Salvar</button>}
        </div>)}
        {filtradas.length === 0 && <p className="py-5 text-sm text-slate-500">Nenhuma clínica encontrada.</p>}
      </div>
    </div>
  </section>;
}
