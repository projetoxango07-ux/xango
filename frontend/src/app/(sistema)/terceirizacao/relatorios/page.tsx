"use client";

import { useCallback, useEffect, useState } from "react";
import PortalV3Recebimentos from "@/components/PortalV3Recebimentos";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
const TIPOS = ["ECG", "EEG", "ESPIROMETRIA", "MAPA", "HOLTER"];
const STATUS = ["REALIZADO", "ENVIADO_LAUDO", "LAUDO_RECEBIDO", "ENTREGUE", "CANCELADO"];
const NOMES: Record<string, string> = {
  REALIZADO: "Aguardando envio", ENVIADO_LAUDO: "Aguardando laudo",
  LAUDO_RECEBIDO: "Aguardando entrega", ENTREGUE: "Entregue", CANCELADO: "Cancelado",
};
const campo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none";

type Registro = {
  id: number; codigoInterno: string; tipoExame: string; status: string;
  laudoEnviadoEm: string | null; laudoRecebidoEm: string | null; laudoEntregueEm: string | null;
  producao: {
    id: number; dataRealizacao: string; nomePacienteDigitado: string;
    clinica: { id: number; nome: string }; unidadeClinica: { nome: string } | null;
  };
  usoEquipamento: { equipamento: { codigo: string }; retiradoEm: string | null; descarregadoEm: string | null } | null;
};
type Resposta = {
  competencia: string; pagina: number; tamanhoPagina: number; total: number; paginas: number;
  porStatus: { status: string; quantidade: number }[];
  clinicas: { id: number; nome: string }[]; exames: Registro[];
};
function mesSaoPaulo() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}`;
}
function dataBR(valor: string | null) {
  return valor ? valor.slice(0, 10).split("-").reverse().join("/") : "—";
}


type ValoresGerenciais = { exames: number; semTitulo: number; produzido: string; recebidoProducao: string; saldoProducao: string; vencidoProducao: string; recebidoMes: string };
type LinhaGerencial = ValoresGerenciais & { clinicaId: number; clinica: string };
type ResumoGerencial = { competencia: string; total: ValoresGerenciais; linhas: LinhaGerencial[] };
const moedaRel = (v: string) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function exportarResumoV3(dados: ResumoGerencial) {
  const textoSeguro = (s: string) => '"' + (/^\s*[=+\-@\t\r\n]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"';
  const decimal = (s: string) => s.replace(".", ",");
  const cab = ["Clinica", "Competencia", "Exames", "Enviados sem titulo", "Titulos da producao (R$)", "Recebido dessa producao ate agora (R$)", "Saldo dessa producao hoje (R$)", "Vencido dessa producao hoje (R$)", "Recebido no mes - todas competencias (R$)"];
  const linhas = dados.linhas.map(l => [textoSeguro(l.clinica), dados.competencia, l.exames, l.semTitulo, decimal(l.produzido), decimal(l.recebidoProducao), decimal(l.saldoProducao), decimal(l.vencidoProducao), decimal(l.recebidoMes)].join(";"));
  const t = dados.total;
  linhas.push(["TOTAL", dados.competencia, t.exames, t.semTitulo, decimal(t.produzido), decimal(t.recebidoProducao), decimal(t.saldoProducao), decimal(t.vencidoProducao), decimal(t.recebidoMes)].join(";"));
  const url = URL.createObjectURL(new Blob(["\uFEFF" + [cab.join(";"), ...linhas].join("\r\n")], {type:"text/csv;charset=utf-8;"}));
  const a = document.createElement("a"); a.href = url; a.download = `digna-v3-resumo-${dados.competencia}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ResumoFinanceiroClinicas({mes, clinicaId}: {mes: string; clinicaId: string}) {
  const [dados, setDados] = useState<ResumoGerencial | null>(null);
  const [erro, setErro] = useState("");
  const [oculto, setOculto] = useState(false);
  const [atualizacao, setAtualizacao] = useState(0);
  useEffect(() => {
    const ctl = new AbortController(); setDados(null); setErro(""); setOculto(false);
    const query = new URLSearchParams({mes}); if (clinicaId) query.set("clinicaId", clinicaId);
    void (async () => { try {
      const r = await fetch(`${API}/terceirizacao/relatorios/financeiro?${query}`, {credentials:"include",cache:"no-store",signal:ctl.signal});
      if (ctl.signal.aborted) return;
      if (r.status === 403) {setOculto(true); return;}
      const j = await r.json(); if (ctl.signal.aborted) return;
      if (!r.ok) throw new Error(j.erro || "Não foi possível consultar o resumo financeiro.");
      setDados(j as ResumoGerencial);
    } catch (e) { if (!ctl.signal.aborted) setErro(e instanceof Error ? e.message : "Falha na consulta."); } })();
    return () => ctl.abort();
  }, [mes,clinicaId,atualizacao]);
  if (oculto) return null;
  const t = dados?.total;
  return <section className="rounded-xl border border-[#E3E5E1] bg-white p-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-[#18383D]">Resumo gerencial por clínica</h3><p className="mt-1 text-xs text-[#667A7D]">Competência {mes.split("-").reverse().join("/")} · filtros de competência e clínica; todos os exames e situações.</p></div><div className="flex gap-2"><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={()=>setAtualizacao(n=>n+1)}>Atualizar</button><button type="button" disabled={!dados} onClick={()=>dados && exportarResumoV3(dados)} className="rounded-lg bg-[#087681] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Exportar CSV</button></div></div>
    {erro ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{erro}</p> : !dados || !t ? <p className="text-sm text-[#667A7D]">Consultando resumo financeiro...</p> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
        ["Títulos da produção", t.produzido], ["Recebido dessa produção até agora", t.recebidoProducao], ["Saldo atual dessa produção", t.saldoProducao], ["Recebido no mês (todas competências)", t.recebidoMes],
      ].map(([nome,v])=><div key={nome} className="rounded-lg border border-[#E3E5E1] p-3"><p className="text-xs text-[#667A7D]">{nome}</p><p className="mt-1 text-xl font-bold tabular-nums text-[#18383D]">{moedaRel(v)}</p></div>)}</div>
      <p className="text-sm text-[#667A7D]">Exames enviados sem título: <b>{t.semTitulo}</b> · Saldo vencido hoje dessa produção: <b>{moedaRel(t.vencidoProducao)}</b></p>
      {dados.linhas.length ? <div className="overflow-x-auto"><table className="min-w-[970px] w-full text-left text-sm"><thead className="bg-[#064E57] text-white text-xs"><tr><th className="p-3">Clínica</th><th className="p-3">Exames</th><th className="p-3">Sem título</th><th className="p-3">Produção</th><th className="p-3">Recebido dessa produção</th><th className="p-3">Saldo atual</th><th className="p-3">Vencido hoje</th><th className="p-3">Recebido no mês</th></tr></thead><tbody>{dados.linhas.map(l=><tr key={l.clinicaId} className="border-b"><td className="p-3 font-medium">{l.clinica}</td><td className="p-3">{l.exames}</td><td className="p-3">{l.semTitulo}</td>{[l.produzido,l.recebidoProducao,l.saldoProducao,l.vencidoProducao,l.recebidoMes].map((v,i)=><td key={i} className="whitespace-nowrap p-3 tabular-nums">{moedaRel(v)}</td>)}</tr>)}</tbody></table></div> : <p className="rounded-lg bg-[#F7F6F2] p-3 text-sm">Nenhuma produção ou recebimento encontrado.</p>}
      <p className="text-xs text-[#667A7D]">O saldo e os recebimentos da produção refletem a situação atual dos títulos dessa competência, não uma fotografia do encerramento do mês. Recebido no mês usa a data efetiva, de qualquer competência. Baixas estornadas e títulos/parcelas cancelados não integram os valores. Exames sem título não compõem a produção financeira.</p>
    </>}
  </section>;
}

export default function RelatoriosTerceirizacaoPage() {
  const [mes, setMes] = useState(mesSaoPaulo);
  const [tipo, setTipo] = useState("");
  const [status, setStatus] = useState("");
  const [clinicaId, setClinicaId] = useState("");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const parametros = new URLSearchParams({ mes, pagina: String(pagina) });
      if (tipo) parametros.set("tipo", tipo);
      if (status) parametros.set("status", status);
      if (clinicaId) parametros.set("clinicaId", clinicaId);
      const r = await fetch(`${API}/terceirizacao/relatorios?${parametros.toString()}`, {
        credentials: "include", cache: "no-store",
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.erro || "Não foi possível carregar os relatórios.");
      setDados(json as Resposta);
    } catch (e) {
      setDados(null); setErro(e instanceof Error ? e.message : "Erro de conexão.");
    } finally { setCarregando(false); }
  }, [mes, tipo, status, clinicaId, pagina]);

  useEffect(() => { void carregar(); }, [carregar]);
  const pularPara = (n: number) => setPagina(Math.max(1, Math.min(dados?.paginas || 1, n)));
  return <div className="space-y-5">
    <div>
      <h2 className="text-2xl font-semibold text-[#18383D]">Relatórios da Terceirização</h2>
      <p className="mt-1 text-sm text-[#667A7D]">Consulte a produção de qualquer competência pela data em que o exame foi realizado, independentemente da data do laudo.</p>
    </div>
    <section className="rounded-xl border border-[#E3E5E1] bg-white p-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm font-medium">Competência
          <input aria-label="Competência dos relatórios" className={`${campo} mt-1`} type="month" value={mes} onChange={(e) => {setMes(e.target.value);setPagina(1);setClinicaId("");}} />
        </label>
        <label className="text-sm font-medium">Clínica
          <select className={`${campo} mt-1`} value={clinicaId} onChange={(e) => {setClinicaId(e.target.value);setPagina(1);}}>
            <option value="">Todas as clínicas</option>
            {(dados?.clinicas ?? []).map((c) => <option value={c.id} key={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Exame
          <select className={`${campo} mt-1`} value={tipo} onChange={(e) => {setTipo(e.target.value);setPagina(1);}}>
            <option value="">Todos os exames</option>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Situação do laudo
          <select className={`${campo} mt-1`} value={status} onChange={(e) => {setStatus(e.target.value);setPagina(1);}}>
            <option value="">Todas as situações</option>{STATUS.map((s) => <option key={s} value={s}>{NOMES[s]}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void carregar()} disabled={carregando}
          className="self-end rounded-lg border border-[#087681] px-4 py-2 text-sm font-semibold text-[#064E57] hover:bg-[#E7F3F3] disabled:opacity-50">
          {carregando ? "Consultando..." : "Atualizar consulta"}
        </button>
      </div>
    </section>
    {erro && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</div>}
    <section className="rounded-xl border border-[#E3E5E1] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-semibold text-[#18383D]">Exames da competência {dados?.competencia?.split("-").reverse().join("/") || mes.split("-").reverse().join("/")}</h3>
          <p className="mt-1 text-xs text-[#667A7D]">Exames individuais; cada lançamento pode incluir vários exames.</p></div>
        <span className="text-2xl font-bold tabular-nums text-[#087681]">{carregando ? "—" : dados?.total.toLocaleString("pt-BR") ?? "—"}</span>
      </div>
      {dados && <div className="mt-4 flex flex-wrap gap-2">
        {dados.porStatus.map((g) => <span key={g.status} className="rounded-full bg-[#F7F6F2] px-3 py-1.5 text-xs text-[#18383D]">
          {NOMES[g.status] || g.status}: <b>{g.quantidade}</b>
        </span>)}
      </div>}
      {carregando ? <p className="py-8 text-sm text-[#667A7D]">Carregando produção histórica...</p> :
        !dados?.exames.length ? <p className="py-8 text-sm text-[#667A7D]">Não foram encontrados exames para esta competência e estes filtros.</p> :
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm">
          <thead className="border-b text-xs uppercase text-[#667A7D]"><tr>
            <th className="py-3">Realização</th><th>Paciente</th><th>Clínica</th><th>Exame</th><th>Código</th><th>Laudo</th><th>Aparelho</th>
          </tr></thead>
          <tbody>{dados.exames.map((e) => <tr key={e.id} className="border-b align-top last:border-0">
            <td className="py-3">{dataBR(e.producao.dataRealizacao)}</td>
            <td className="font-medium">{e.producao.nomePacienteDigitado}</td>
            <td>{e.producao.clinica.nome}{e.producao.unidadeClinica && <span className="block text-xs text-[#667A7D]">{e.producao.unidadeClinica.nome}</span>}</td>
            <td>{e.tipoExame}</td><td className="font-mono text-xs">{e.codigoInterno}</td>
            <td>{NOMES[e.status] || e.status}
              {e.laudoEntregueEm && <span className="block text-xs text-[#667A7D]">Entregue em {dataBR(e.laudoEntregueEm)}</span>}
            </td><td>{e.usoEquipamento?.equipamento.codigo || "—"}</td>
          </tr>)}</tbody>
        </table></div>}
      {dados && dados.total > 0 && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#E3E5E1] pt-4 text-sm">
        <span className="text-[#667A7D]">Página {dados.pagina} de {dados.paginas} · até {dados.tamanhoPagina} exames por página</span>
        <div className="flex gap-2">
          <button type="button" disabled={carregando || pagina <= 1} onClick={() => pularPara(pagina - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button>
          <button type="button" disabled={carregando || pagina >= dados.paginas} onClick={() => pularPara(pagina + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Próxima</button>
        </div>
      </div>}
    </section>
    <ResumoFinanceiroClinicas mes={mes} clinicaId={clinicaId} />
    <PortalV3Recebimentos mes={mes} />
    <p className="text-xs text-[#667A7D]">Histórico de produção por competência da realização. Recebimentos de títulos históricos ficam disponíveis somente a usuários autorizados do Financeiro e dos Relatórios. Nenhuma informação financeira da V1 é exibida.</p>
  </div>;
}
