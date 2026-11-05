"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Cake, Copy, ExternalLink, RefreshCw } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:3333";
type Aniversariante = { id: number; nome: string; telefone: string | null };
function telefoneWhatsapp(telefone: string | null) {
  let digitos = String(telefone || "").replace(/\D/g, "");
  // Cadastros podem guardar DDD+número ou o prefixo 55.
  if (digitos.startsWith("55") && [12, 13].includes(digitos.length)) digitos = digitos.slice(2);
  return [10, 11].includes(digitos.length) ? `55${digitos}` : null;
}

export default function MensagensPage() {
  const router = useRouter();
  const [pacientes, setPacientes] = useState<Aniversariante[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [modelo, setModelo] = useState("Olá, {nome}! 🎉 A equipe da Digna Saúde deseja um feliz aniversário, com muita saúde e felicidades!");
  const [mensagem, setMensagem] = useState("");
  const [copiadoId, setCopiadoId] = useState<number | null>(null);

  async function carregar() {
    try {
      setCarregando(true); setErro("");
      const resposta = await fetch(`${API_URL}/pacientes/aniversariantes-hoje`, { cache: "no-store" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Falha ao consultar aniversariantes.");
      setPacientes(Array.isArray(dados.aniversariantes) ? dados.aniversariantes : []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar aniversariantes.");
    } finally { setCarregando(false); }
  }
  useEffect(() => { const t = window.setTimeout(() => void carregar(), 0); return () => window.clearTimeout(t); }, []);
  const filtrados = useMemo(() => pacientes.filter(p => p.nome.toLocaleLowerCase("pt-BR").includes(busca.trim().toLocaleLowerCase("pt-BR"))), [pacientes, busca]);
  function texto(p: Aniversariante) {
    return modelo.replaceAll("{nome}", p.nome.trim().split(/\s+/)[0] || p.nome);
  }
  async function copiar(p: Aniversariante) {
    const conteudo = texto(p);
    let sucesso = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(conteudo);
        sucesso = true;
      }
    } catch { /* Tenta método alternativo abaixo. */ }
    if (!sucesso) {
      const auxiliar = document.createElement("textarea");
      auxiliar.value = conteudo;
      auxiliar.setAttribute("readonly", "");
      auxiliar.style.position = "fixed";
      auxiliar.style.left = "-9999px";
      document.body.appendChild(auxiliar);
      try {
        auxiliar.focus(); auxiliar.select();
        sucesso = document.execCommand("copy");
      } catch { sucesso = false; }
      finally { document.body.removeChild(auxiliar); }
    }
    setCopiadoId(sucesso ? p.id : null);
    setMensagem(sucesso ? `Mensagem de ${p.nome} copiada.` : `Não foi possível copiar a mensagem de ${p.nome}. Verifique as permissões de cópia do navegador.`);
  }
  function whatsapp(p: Aniversariante) {
    const numero = telefoneWhatsapp(p.telefone);
    if (!numero) return;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto(p))}`, "_blank", "noopener,noreferrer");
  }
  return <div className="mx-auto max-w-5xl pb-12">
    <button type="button" onClick={() => router.push("/")} className="mb-5 flex items-center gap-2 text-sm font-semibold text-xango-primary"><ArrowLeft size={16}/>Dashboard</button>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-semibold text-xango-text"><Cake size={23}/>Mensagens de aniversário</h1><p className="mt-1 text-sm text-xango-muted">Prepare mensagens individuais para pacientes aniversariantes do dia. Nenhum envio é automático.</p></div><button onClick={() => void carregar()} type="button" disabled={carregando} className="flex items-center gap-2 rounded-md border border-xango-border px-3 py-2 text-sm disabled:opacity-50"><RefreshCw size={14}/>Atualizar</button></div>
    {erro && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    <section className="mt-5 rounded-lg border border-xango-border bg-white p-5"><label className="block text-sm font-semibold">Texto da mensagem — use {"{nome}"} para personalizar</label><textarea value={modelo} onChange={e => setModelo(e.target.value)} rows={3} maxLength={1000} className="mt-2 w-full rounded-md border border-xango-border p-3 text-sm"/><p className="mt-2 text-xs text-xango-muted">Confira o conteúdo, a finalidade do contato e as preferências de comunicação do paciente antes de enviar.</p></section>
    {mensagem && <p role="status" className="mt-3 rounded-md border border-xango-border bg-white p-3 text-sm text-xango-primary">{mensagem}</p>}
    <section className="mt-4 rounded-lg border border-xango-border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Aniversariantes de hoje ({pacientes.length})</h2><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Filtrar pelo nome" className="rounded-md border border-xango-border px-3 py-2 text-sm"/></div>
    {carregando ? <p className="mt-4 text-sm text-xango-muted">Carregando...</p> : filtrados.length === 0 ? <p className="mt-4 text-sm text-xango-muted">Nenhum aniversariante encontrado.</p> : <div className="mt-4 divide-y divide-xango-border">{filtrados.map(p => <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><button onClick={() => router.push(`/pacientes/${p.id}`)} className="text-left text-sm font-semibold text-xango-primary hover:underline">{p.nome}</button><p className="text-xs text-xango-muted">{p.telefone || "Telefone não informado"}</p></div><div className="flex gap-2"><button type="button" onClick={() => void copiar(p)} className="flex items-center gap-1 rounded-md border border-xango-border px-3 py-2 text-xs font-semibold"><Copy size={14}/>{copiadoId === p.id ? "Copiado!" : "Copiar"}</button><button type="button" disabled={!telefoneWhatsapp(p.telefone)} onClick={() => whatsapp(p)} className="flex items-center gap-1 rounded-md border border-xango-primary px-3 py-2 text-xs font-semibold text-xango-primary disabled:opacity-40"><ExternalLink size={14}/>WhatsApp</button></div>{copiadoId === p.id && <p role="status" className="w-full text-xs font-semibold text-emerald-700">Mensagem copiada com sucesso.</p>}</div>)}</div>}
    </section>
  </div>;
}
