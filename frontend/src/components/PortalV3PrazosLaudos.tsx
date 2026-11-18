"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Status = "REALIZADO" | "ENVIADO_LAUDO" | "LAUDO_RECEBIDO";
type Faixa = "ATRASADO" | "HOJE" | "PROXIMOS_3_DIAS" | "SEM_PREVISAO" | "AGUARDANDO_ENVIO" | "NO_PRAZO";
type Item = {
  id: number; codigoInterno: string; paciente: string; tipoExame: string;
  clinica: string; unidade: string | null; dataRealizacao: string; previsao: string | null;
  status: Status; faixa: Faixa; diasRestantes: number | null;
};
type Dados = { hoje: string; itens: Item[]; limiteAtingido: boolean;
  totais: { atraso: number; hoje: number; proximos3: number; semPrevisao: number; aguardandoEnvio: number; noPrazo: number } };
const rotulo: Record<Faixa,string> = {
  ATRASADO: "Em atraso", HOJE: "Vence hoje", PROXIMOS_3_DIAS: "Próximos 3 dias",
  SEM_PREVISAO: "Sem previsão", AGUARDANDO_ENVIO: "Aguardando envio", NO_PRAZO: "No prazo",
};
function dataBR(data: string | null) { return data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data.split("-").reverse().join("/") : "—"; }
export default function PortalV3PrazosLaudos({api,versao,aoAbrir}: {
  api: string; versao: number; aoAbrir: (dataRealizacao:string,status:Status,codigo:string)=>void;
}) {
  const [dados,setDados] = useState<Dados | null>(null);
  const [erro,setErro] = useState("");
  const [ocupado,setOcupado] = useState(false);
  const [faixa,setFaixa] = useState<Faixa | "TODOS">("TODOS");
  const carregar = useCallback(async (signal?: AbortSignal) => {
    setOcupado(true);setErro("");
    try {
      const resposta = await fetch(`${api}/terceirizacao/laudos/prazos`, {credentials:"include",cache:"no-store",signal});
      const json = await resposta.json().catch(()=>({}));
      if (!resposta.ok) throw new Error(json.erro || "Falha na consulta de prazos.");
      if (!signal?.aborted) setDados(json as Dados);
    } catch (e) { if (!signal?.aborted) setErro(e instanceof Error?e.message:"Falha na consulta de prazos."); }
    finally {if (!signal?.aborted) setOcupado(false);}
  },[api]);
  useEffect(()=>{const controller=new AbortController();void carregar(controller.signal);return ()=>controller.abort();},[carregar,versao]);
  const itens=useMemo(()=>dados?.itens.filter(e=>faixa==="TODOS"||e.faixa===faixa)??[],[dados,faixa]);
  const botoes: {label:string;f:Faixa;value:number}[] = dados ? [
    {label:"Em atraso",f:"ATRASADO",value:dados.totais.atraso},
    {label:"Vencem hoje",f:"HOJE",value:dados.totais.hoje},
    {label:"Próximos 3 dias",f:"PROXIMOS_3_DIAS",value:dados.totais.proximos3},
    {label:"Sem previsão",f:"SEM_PREVISAO",value:dados.totais.semPrevisao},
    {label:"Aguardando envio",f:"AGUARDANDO_ENVIO",value:dados.totais.aguardandoEnvio},
  ]:[];
  return <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-semibold text-slate-900">Prazos e pendências dos laudos</h3>
      <p className="text-xs text-slate-500">Todas as competências. Atrasos consideram a previsão de entrega configurada, não o vencimento financeiro.</p></div>
      <button type="button" onClick={()=>void carregar()} disabled={ocupado} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">{ocupado?"Atualizando...":"Atualizar alertas"}</button>
    </div>
    {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>setFaixa("TODOS")} className={`rounded-lg border px-3 py-2 text-sm ${faixa==="TODOS"?"border-teal-700 bg-teal-50 font-semibold":""}`}>Todas: {dados?.itens.length ?? "—"}</button>
      {botoes.map(b=><button type="button" key={b.f} onClick={()=>setFaixa(b.f)} className={`rounded-lg border px-3 py-2 text-sm ${faixa===b.f?"border-teal-700 bg-teal-50 font-semibold":""}`}>
        {b.label}: <b>{b.value}</b></button>)}
    </div>
    {dados?.limiteAtingido && <p role="status" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Há mais de 1.000 pendências. Esta visão é limitada aos primeiros 1.000 registros; consulte os relatórios para uma apuração completa.</p>}
    {!ocupado && !erro && !itens.length && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Nenhuma pendência encontrada para o filtro escolhido.</p>}
    {itens.length>0 && <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm">
      <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2">Paciente / exame</th><th>Clínica</th><th>Realização</th><th>Previsão</th><th>Alerta</th><th></th></tr></thead>
      <tbody>{itens.slice(0,25).map(e=><tr key={e.id} className="border-b last:border-0">
        <td className="py-3"><b>{e.paciente}</b><p className="text-xs text-slate-500">{e.tipoExame} · {e.codigoInterno}</p></td>
        <td>{e.clinica}{e.unidade ? ` · ${e.unidade}`:""}</td>
        <td>{dataBR(e.dataRealizacao)}</td><td>{dataBR(e.previsao)}</td>
        <td><span className={`rounded-md px-2 py-1 text-xs ${e.faixa==="ATRASADO"?"bg-red-50 text-red-700":e.faixa==="HOJE"?"bg-amber-50 text-amber-800":"bg-slate-100 text-slate-700"}`}>{rotulo[e.faixa]}{e.faixa==="ATRASADO"&&e.diasRestantes!==null?` · ${-e.diasRestantes}d`:""}</span></td>
        <td><button type="button" className="font-semibold text-teal-700 hover:underline" onClick={()=>aoAbrir(e.dataRealizacao,e.status,e.codigoInterno)}>Abrir</button></td>
      </tr>)}</tbody></table>
      {itens.length>25&&<p className="mt-2 text-xs text-slate-500">Exibindo 25 de {itens.length} pendências neste filtro. Refine pelos alertas ou use a pesquisa na lista de exames.</p>}
    </div>}
  </section>;
}
