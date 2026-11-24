"use client";
import { useCallback, useEffect, useState } from "react";
import { FilePlus2, FileText, Trash2, Download, Eye } from "lucide-react";
const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:3333";
const MAXIMO = 8 * 1024 * 1024;
const FORMATOS = ["pdf", "jpg", "jpeg", "png"];

type Pedido = { id: number; atendimentoId: number; nomeOriginal: string; mimeType: string; tamanhoBytes: number; criadoEm: string; atendimentoCodigo?: string | null };
async function lerErro(r: Response): Promise<string> {
  try { return (await r.json()).erro || "Não foi possível executar a operação."; } catch { return "Não foi possível executar a operação."; }
}
function arquivoAceito(f: File) {
  const ext = f.name.split(".").pop()?.toLowerCase() || "";
  return FORMATOS.includes(ext) && f.size > 0 && f.size <= MAXIMO;
}
export async function enviarPedidoMedicoV13(atendimentoId: number, arquivo: File) {
  if (!arquivoAceito(arquivo)) throw new Error(`${arquivo.name}: envie PDF, JPG ou PNG de até 8 MB.`);
  const formData = new FormData(); formData.append("arquivo", arquivo);
  const r = await fetch(`${API}/atendimentos/${atendimentoId}/pedidos-medicos`, {
    method: "POST", body: formData, credentials: "include",
  });
  if (!r.ok) throw new Error(await lerErro(r));
}
async function acessarArquivo(p: Pedido, visualizar: boolean) {
  const r = await fetch(`${API}/atendimentos/${p.atendimentoId}/pedidos-medicos/${p.id}/arquivo${visualizar ? "?visualizar=1" : ""}`, {
    cache: "no-store", credentials: "include",
  });
  if (!r.ok) throw new Error(await lerErro(r));
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  if (visualizar) {
    const janela = window.open(url, "_blank", "noopener,noreferrer");
    if (!janela) { const a = document.createElement("a"); a.href = url; a.download = p.nomeOriginal; a.click(); }
  } else {
    const a = document.createElement("a"); a.href = url; a.download = p.nomeOriginal; document.body.appendChild(a); a.click(); a.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120000);
}
function dataFormatada(v: string) { return new Date(v).toLocaleDateString("pt-BR"); }

export function PedidosMedicosAtendimentoV13({ atendimentoId, pendentes, onPendentesChange, refresh }:
  { atendimentoId?: number; pendentes: File[]; onPendentesChange: (v: File[]) => void; refresh: number }) {
  const [lista, setLista] = useState<Pedido[]>([]);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const carregar = useCallback(async () => {
    if (!atendimentoId) { setLista([]); return; }
    try { const r = await fetch(`${API}/atendimentos/${atendimentoId}/pedidos-medicos`, { cache: "no-store", credentials: "include" });
      if (!r.ok) throw new Error(await lerErro(r)); setLista(await r.json());
    } catch(e) { setErro(e instanceof Error ? e.message : "Erro ao carregar anexos."); }
  }, [atendimentoId]);
  useEffect(() => { void carregar(); }, [carregar, refresh]);
  async function incluir(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setErro("");setMensagem("");
    const recebidos = Array.from(arquivos);
    if (recebidos.some(f => !arquivoAceito(f))) { setErro("Envie somente PDF, JPG ou PNG com até 8 MB por arquivo."); return; }
    if (!atendimentoId) {
      if (pendentes.length + recebidos.length > 25) { setErro("Limite de 25 pedidos por atendimento."); return; }
      onPendentesChange([...pendentes, ...recebidos]);
      setMensagem("Arquivos preparados. Serão anexados quando o atendimento for salvo.");
      return;
    }
    setEnviando(true);
    const falhas: string[] = [];
    try {
      for (const arquivo of recebidos) {
        try { await enviarPedidoMedicoV13(atendimentoId, arquivo); }
        catch (e) { falhas.push(`${arquivo.name}: ${e instanceof Error ? e.message : "falhou"}`); }
      }
      await carregar();
      if (falhas.length) setErro(falhas.join(" | "));
      else setMensagem("Pedido(s) anexado(s) com sucesso.");
    } finally { setEnviando(false); }
  }
  async function remover(p: Pedido) {
    if (!atendimentoId || !window.confirm(`Remover ${p.nomeOriginal} da visualização? O histórico será preservado.`)) return;
    setErro("");
    const r = await fetch(`${API}/atendimentos/${atendimentoId}/pedidos-medicos/${p.id}`, { method: "DELETE", credentials: "include" });
    if (!r.ok) { setErro(await lerErro(r)); return; }
    await carregar();
  }
  return <section className="mb-6 rounded-lg border border-xango-border bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="flex items-center gap-2 font-semibold text-xango-text"><FilePlus2 size={18}/> Pedidos médicos <span className="text-xs font-normal text-xango-muted">(opcional)</span></h3>
        <p className="mt-1 text-xs text-xango-muted">Você pode anexar em qualquer etapa, mesmo após o pagamento ou a emissão do voucher.</p></div>
      <label className={`cursor-pointer rounded-md border border-xango-primary px-3 py-2 text-sm font-semibold text-xango-primary ${enviando ? "opacity-50" : ""}`}>
        {enviando ? "Enviando..." : "+ Anexar pedido"}
        <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" disabled={enviando}
          onChange={e=>{void incluir(e.target.files);e.target.value="";}} />
      </label>
    </div>
    {!atendimentoId && <p className="mt-3 text-xs text-xango-muted">Antes do primeiro salvamento, os arquivos ficam preparados apenas neste navegador. Salve o atendimento para armazená-los com segurança.</p>}
    {erro && <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-xs text-red-700">{erro}</p>}
    {mensagem && <p role="status" className="mt-3 rounded-md bg-emerald-50 p-3 text-xs text-emerald-800">{mensagem}</p>}
    {pendentes.length > 0 && <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-semibold">Arquivos aguardando salvamento ({pendentes.length})</p>
      {pendentes.map((f,i)=><div key={`${f.name}-${i}`} className="mt-2 flex items-center justify-between gap-2"><span className="truncate">{f.name}</span><button type="button" onClick={()=>onPendentesChange(pendentes.filter((_,j)=>j!==i))} className="text-xs underline">Retirar</button></div>)}
    </div>}
    {lista.length > 0 && <div className="mt-3 divide-y divide-xango-border rounded-md border border-xango-border">
      {lista.map(p => <div key={p.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
        <FileText size={16}/><span className="min-w-0 flex-1 break-all">{p.nomeOriginal}<span className="ml-2 text-xs text-xango-muted">{dataFormatada(p.criadoEm)}</span></span>
        <button type="button" className="flex items-center gap-1 text-xs font-semibold text-xango-primary" onClick={()=>void acessarArquivo(p,true).catch(e=>setErro(String(e)))}><Eye size={14}/>Abrir</button>
        <button type="button" className="flex items-center gap-1 text-xs font-semibold text-xango-primary" onClick={()=>void acessarArquivo(p,false).catch(e=>setErro(String(e)))}><Download size={14}/>Baixar</button>
        <button type="button" className="flex items-center gap-1 text-xs font-semibold text-red-600" onClick={()=>void remover(p)}><Trash2 size={14}/>Remover</button>
      </div>)}
    </div>}
    {lista.length === 0 && pendentes.length === 0 && <p className="mt-3 text-xs text-xango-muted">Nenhum pedido médico anexado.</p>}
  </section>;
}

export function PedidosMedicosPacienteV13({ pacienteId }: { pacienteId: number }) {
  const [lista, setLista] = useState<Pedido[]>([]), [erro, setErro] = useState("");
  useEffect(() => { let ativo = true;
    fetch(`${API}/pacientes/${pacienteId}/pedidos-medicos`, { credentials: "include", cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error(await lerErro(r)); return r.json(); })
      .then(d => { if (ativo) setLista(d); }).catch(e => { if(ativo) setErro(String(e)); });
    return () => { ativo = false; };
  }, [pacienteId]);
  return <section className="mt-4 rounded-lg border border-xango-border bg-white p-5 shadow-sm">
    <h3 className="flex items-center gap-2 font-semibold"><FileText size={18}/>Pedidos médicos</h3>
    <p className="mt-1 text-xs text-xango-muted">Documentos vinculados a atendimentos deste paciente. Para incluir ou remover, abra o atendimento.</p>
    {erro && <p role="alert" className="mt-3 text-sm text-red-600">{erro}</p>}
    {!erro && lista.length===0 && <p className="mt-3 text-sm text-xango-muted">Nenhum pedido anexado.</p>}
    {lista.map(p => <div key={p.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-xango-border p-3 text-sm">
      <span className="min-w-0 break-all">{p.nomeOriginal}<span className="ml-2 text-xs text-xango-muted">{p.atendimentoCodigo || `Atendimento #${p.atendimentoId}`}</span></span>
      <button className="flex items-center gap-1 text-xs font-semibold text-xango-primary" type="button" onClick={()=>void acessarArquivo(p,false).catch(e=>setErro(String(e)))}><Download size={14}/>Baixar</button>
    </div>)}
  </section>;
}
