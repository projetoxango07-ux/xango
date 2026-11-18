"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Check, Clock3, FileCheck2, Search, Stethoscope, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
type ResultadoV3 = { id: number; tipo: string; titulo: string; subtitulo: string; href: string };
type NotificacaoV3 = { id: string; titulo: string; descricao: string; href: string; prioridade: "ALTA" | "MEDIA" | "BAIXA" };
function rotulo(tipo: string) {
  if (tipo === "EXAME_V3") return "Exame";
  if (tipo === "PACIENTE_V3") return "Paciente V3";
  if (tipo === "APARELHO_V3") return "Equipamento";
  return "Clínica V3";
}

export function PortalV3BuscaNotificacoes() {
  const pathname = usePathname();
  const { temPermissao } = useAuth();
  const [busca, setBusca] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoV3[]>([]);
  const [erroBusca, setErroBusca] = useState("");
  const [notificacoes, setNotificacoes] = useState<NotificacaoV3[]>([]);
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
  const [carregandoNotif, setCarregandoNotif] = useState(false);
  const [erroNotif, setErroNotif] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const podePesquisar = ["producao", "laudos", "equipamentos", "configuracoes"].some((modulo) =>
    temPermissao(`terceirizacao.${modulo}.visualizar`)
  );

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && podePesquisar) {
        e.preventDefault();
        setBuscaAberta(true);
        inputRef.current?.focus();
      }
      if (e.key === "Escape") { setBuscaAberta(false); setNotificacoesAbertas(false); }
    };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, [podePesquisar]);

  useEffect(() => { setBuscaAberta(false); setNotificacoesAbertas(false); }, [pathname]);

  useEffect(() => {
    const q = busca.trim();
    if (q.length < 2 || !podePesquisar) { setResultados([]); setBuscando(false); setErroBusca(""); return; }
    const controlador = new AbortController();
    const tempo = window.setTimeout(async () => {
      setBuscando(true); setErroBusca("");
      try {
        const r = await fetch(`${API}/terceirizacao/busca-global?q=${encodeURIComponent(q)}`, {
          cache: "no-store", credentials: "include", signal: controlador.signal,
        });
        const dados = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(dados.erro || "Não foi possível pesquisar na V3.");
        if (!controlador.signal.aborted) setResultados(Array.isArray(dados.resultados) ? dados.resultados : []);
      } catch (e) {
        if (!controlador.signal.aborted) { setErroBusca(e instanceof Error ? e.message : "Falha de conexão."); setResultados([]); }
      } finally { if (!controlador.signal.aborted) setBuscando(false); }
    }, 300);
    return () => { controlador.abort(); window.clearTimeout(tempo); };
  }, [busca, podePesquisar]);

  async function carregarNotificacoes() {
    setCarregandoNotif(true); setErroNotif("");
    try {
      const r = await fetch(`${API}/terceirizacao/notificacoes`, { cache: "no-store", credentials: "include" });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(dados.erro || "Não foi possível carregar as notificações da V3.");
      setNotificacoes(Array.isArray(dados.notificacoes) ? dados.notificacoes : []);
    } catch (e) { setErroNotif(e instanceof Error ? e.message : "Falha de conexão."); }
    finally { setCarregandoNotif(false); }
  }
  useEffect(() => { void carregarNotificacoes(); }, []); // Carrega apenas pendências V3 na entrada do portal.

  function abrirResultado(href: string) {
    if (!href.startsWith("/terceirizacao/")) return;
    setBuscaAberta(false); setNotificacoesAbertas(false); setBusca(""); setResultados([]);
    window.location.assign(href);
  }

  return (
    <>
      {podePesquisar && <div className="relative min-w-0 flex-1 xl:max-w-md">
        <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#667A7D]" />
        <input ref={inputRef} type="search" autoComplete="off" value={busca} onChange={(e) => { setBusca(e.target.value); setBuscaAberta(true); }}
          onFocus={() => setBuscaAberta(true)} aria-label="Pesquisa global exclusiva da Terceirização"
          placeholder="Pesquisar na terceirização..."
          className="w-full rounded-lg border border-[#E3E5E1] bg-[#F7F6F2] py-2.5 pl-10 pr-3 text-sm text-[#18383D] outline-none placeholder:text-[#667A7D] focus:border-[#087681]" />
        {buscaAberta && busca.trim().length >= 2 && <>
          <button type="button" aria-label="Fechar pesquisa" onClick={() => setBuscaAberta(false)} className="fixed inset-0 z-30 cursor-default" />
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 min-w-[280px] overflow-y-auto rounded-xl border border-[#E3E5E1] bg-white p-2 shadow-2xl">
            <div className="flex items-center justify-between px-2 py-2 text-[11px] text-[#667A7D]"><span>Resultados da V3 · competência atual</span><button type="button" title="Fechar" onClick={() => setBuscaAberta(false)}><X size={15}/></button></div>
            {buscando && <p className="px-3 py-4 text-sm text-[#667A7D]">Pesquisando...</p>}
            {erroBusca && <p role="alert" className="px-3 py-3 text-sm text-red-700">{erroBusca}</p>}
            {!buscando && !erroBusca && resultados.length === 0 && <p className="px-3 py-4 text-sm text-[#667A7D]">Nenhum resultado na competência atual.</p>}
            {!buscando && resultados.map((item) => <button type="button" key={`${item.tipo}-${item.id}`} onClick={() => abrirResultado(item.href)}
              className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[#F7F6F2]">
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#18383D]">{item.titulo}</span><span className="mt-0.5 block truncate text-xs text-[#667A7D]">{item.subtitulo}</span></span>
              <span className="shrink-0 rounded bg-[#E7F3F3] px-2 py-1 text-[10px] font-semibold text-[#064E57]">{rotulo(item.tipo)}</span>
            </button>)}
          </div>
        </>}
      </div>}
      <div className="relative shrink-0">
        <button type="button" aria-label="Pendências e notificações da terceirização" aria-expanded={notificacoesAbertas}
          onClick={() => { setNotificacoesAbertas((v) => !v); setBuscaAberta(false); if (!notificacoesAbertas) void carregarNotificacoes(); }}
          className="relative rounded-lg border border-[#E3E5E1] bg-white p-2.5 text-[#064E57] hover:bg-[#F7F6F2]">
          <Bell size={19} />
          {notificacoes.length > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D79422] px-1 text-[10px] font-bold text-[#064E57]">{notificacoes.length >= 24 ? "24+" : notificacoes.length}</span>}
        </button>
        {notificacoesAbertas && <>
          <button type="button" aria-label="Fechar notificações" onClick={() => setNotificacoesAbertas(false)} className="fixed inset-0 z-30 cursor-default" />
          <div className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-[min(92vw,410px)] overflow-y-auto rounded-xl border border-[#E3E5E1] bg-white p-2 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E3E5E1] px-2 py-3">
              <div><p className="font-semibold text-[#18383D]">Pendências da Terceirização</p><p className="mt-1 text-[11px] text-[#667A7D]">Somente atividades da V3</p></div>
              <button type="button" disabled={carregandoNotif} onClick={() => void carregarNotificacoes()} className="text-xs font-semibold text-[#087681] disabled:opacity-50">Atualizar</button>
            </div>
            {carregandoNotif && <p className="p-4 text-sm text-[#667A7D]">Atualizando...</p>}
            {erroNotif && <p role="alert" className="p-4 text-sm text-red-700">{erroNotif}</p>}
            {!carregandoNotif && !erroNotif && notificacoes.length === 0 && <p className="p-4 text-sm text-[#667A7D]">Nenhuma pendência da V3 encontrada.</p>}
            {!carregandoNotif && notificacoes.map((item) => <button key={item.id} type="button" onClick={() => abrirResultado(item.href)} className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left hover:bg-[#F7F6F2]">
              <span className={`mt-1 shrink-0 ${item.prioridade === "ALTA" ? "text-red-600" : "text-[#087681]"}`}>
                {item.prioridade === "ALTA" ? <Clock3 size={17}/> : item.id.startsWith("laudo-") ? <FileCheck2 size={17}/> : <Stethoscope size={17}/>}</span>
              <span className="min-w-0"><span className="block text-sm font-semibold text-[#18383D]">{item.titulo}</span><span className="mt-1 block text-xs leading-5 text-[#667A7D]">{item.descricao}</span></span>
            </button>)}
            <p className="border-t border-[#E3E5E1] px-3 py-2 text-[11px] text-[#667A7D]">Pendências operacionais, não mensagens não lidas. Filtros históricos serão incorporados aos Relatórios.</p>
          </div>
        </>}
      </div>
    </>
  );
}
