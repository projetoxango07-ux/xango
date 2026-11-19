"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:3333";
type Linha = { id: number; guiaId: number; atendimentoId: number; numero: number; forma: string; vencimento: string; saldo: number };
type Resumo = { vencidas: Linha[]; proximas: Linha[] };
const dinheiro = (valor: number) => valor.toLocaleString("pt-BR", {style:"currency",currency:"BRL"});
export default function AlertasParcelasV12() {
  const [dados, setDados] = useState<Resumo|null>(null);
  const [erro,setErro] = useState("");
  useEffect(()=>{
    const ctrl = new AbortController();
    void fetch(`${API}/financeiro/v12/parcelamentos/alertas?dias=15`,{
      credentials:"include",cache:"no-store",signal:ctrl.signal,
    }).then(async r=>{if(!r.ok)throw new Error("Não foi possível consultar vencimentos.");return r.json();})
      .then(d=>{if(!ctrl.signal.aborted)setDados(d);})
      .catch(()=>{if(!ctrl.signal.aborted)setErro("Avisos de parcelas indisponíveis.");});
    return ()=>ctrl.abort();
  },[]);
  if (!dados) return erro ? <p className="text-xs text-slate-500">{erro}</p> : null;
  const mostrar=[...dados.vencidas,...dados.proximas].slice(0,8);
  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-slate-900">Parcelas a receber — próximos 15 dias</h2>
      <span className="text-sm"><strong className="text-red-700">{dados.vencidas.length} vencida(s)</strong> · {dados.proximas.length} próxima(s)</span>
    </div>
    {mostrar.length===0 ? <p className="mt-2 text-sm text-slate-500">Nenhuma parcela vencida ou próxima do vencimento.</p> : <div className="mt-3 space-y-2">
      {mostrar.map(p=><Link key={p.id} href={`/atendimentos/${p.atendimentoId}?modo=revisao`} className="flex flex-wrap justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
        <span>Guia #{p.guiaId} · {p.forma==="BOLETO"?"Boleto":"PIX parcelado"} · Parcela {p.numero} · {p.vencimento.split("-").reverse().join("/")}</span>
        <strong className={p.vencimento < new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()) ? "text-red-700" : "text-amber-700"}>{dinheiro(p.saldo)}</strong>
      </Link>)}
    </div>}
  </section>;
}
