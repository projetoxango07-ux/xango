"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
const campo = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
type Parcela = { id: number; numero: number; vencimento: string; valorPrevisto: string; canceladaEm: string | null;
  baixas: { id: number; valor: string }[] };
type Auditoria = { id: number; motivo: string; criadoEm: string; usuario: { nome: string };
  dadosAnteriores: unknown; dadosNovos: unknown };
type Titulo = { id: number; valorDevido: string; dataCompetencia: string | null; convenio: string; categoriaAtendimento: string;
  formaPagamentoOrigem: string | null; observacoes: string | null; canceladoEm: string | null;
  parcelas: Parcela[]; auditorias: Auditoria[] };
type Pendencia = { id: number; codigoInterno: string; tipoExame: string; status: string;
  financeiroPendenciaV3: string | null; laudoConvenio: string | null; laudoFormaPagamento: string | null;
  producao: { dataRealizacao: string; nomePacienteDigitado: string; clinica: { nome: string } } };
type Exame = { id: number; tipoExame: string; status: string; financeiroPendenciaV3: string | null;
  laudoConvenio: string | null; laudoFormaPagamento: string | null;
  producao: { nomePacienteDigitado: string; dataRealizacao: string; clinica: { id: number; nome: string } };
  titulosFinanceirosV3: Titulo[] };
function brData(d: string | null) { return d ? d.slice(0,10).split("-").reverse().join("/") : "—"; }
function moeda(v: string | null) { return v === null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
export default function PortalV3TitulosAuto({ podeAdministrar }: { podeAdministrar: boolean }) {
  const [exames, setExames] = useState<Exame[]>([]);
  const [competencia, setCompetencia] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(""); const [sucesso, setSucesso] = useState("");
  const [editando, setEditando] = useState<number | null>(null);
  const [valor, setValor] = useState(""); const [vencimento, setVencimento] = useState("");
  const [convenio, setConvenio] = useState(""); const [categoria, setCategoria] = useState("");
  const [forma, setForma] = useState(""); const [observacoes, setObservacoes] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [paginaPendencias, setPaginaPendencias] = useState(1);
  const [totalPendencias, setTotalPendencias] = useState(0);
  const [regularizando, setRegularizando] = useState<number | null>(null);
  const [vencimentos, setVencimentos] = useState<string[]>([""]);
  const [justificativaReg, setJustificativaReg] = useState("");
  const [conferePlano, setConferePlano] = useState(false);
  const carregarPendencias = useCallback(async () => {
    if (!podeAdministrar) return;
    const r = await fetch(`${API}/terceirizacao/financeiro/pendencias-historicas?pagina=${paginaPendencias}`,
      { credentials: "include", cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || "Erro ao consultar pendências.");
    setPendencias(Array.isArray(j.exames) ? j.exames : []); setTotalPendencias(Number(j.total) || 0);
  }, [podeAdministrar, paginaPendencias]);
  useEffect(() => { void carregarPendencias().catch(e => setErro(String(e))); }, [carregarPendencias]);
  async function regularizar(e: React.FormEvent) {
    e.preventDefault(); if (!regularizando || !podeAdministrar) return;
    setSalvando(true); setErro(""); setSucesso("");
    try {
      const r = await fetch(`${API}/terceirizacao/financeiro/exames/${regularizando}/regularizar`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vencimentosParcelas: vencimentos, motivo: justificativaReg,
          planoOriginalConferido: conferePlano }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || "Falha ao regularizar título.");
      setSucesso(`Título #${j.tituloId} regularizado, com competência ${j.competencia} e auditoria.`);
      setRegularizando(null); await Promise.all([carregar(), carregarPendencias()]);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro de comunicação."); }
    finally { setSalvando(false); }
  }
  const carregar = useCallback(async () => {
    const r = await fetch(`${API}/terceirizacao/financeiro/titulos-mes`, { credentials: "include", cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || "Não foi possível consultar os títulos da V3.");
    setExames(Array.isArray(j.exames) ? j.exames : []); setCompetencia(j.competencia || "");
  }, []);
  useEffect(() => { void carregar().catch((e) => setErro(String(e))).finally(() => setCarregando(false)); }, [carregar]);
  const resumo = useMemo(() => {
    const comTitulo = exames.filter((e) => e.titulosFinanceirosV3.some((t) => !t.canceladoEm));
    const pendentes = exames.filter((e) => e.status === "ENVIADO_LAUDO" && !e.titulosFinanceirosV3.some((t) => !t.canceladoEm));
    const valorTotal = comTitulo.reduce((s, e) => s + e.titulosFinanceirosV3.filter((t) => !t.canceladoEm).reduce((q,t) => q + Number(t.valorDevido),0),0);
    return { emitidos: comTitulo.length, pendentes: pendentes.length, valorTotal };
  }, [exames]);
  function abrirEdicao(t: Titulo) {
    setEditando(t.id); setValor(String(t.valorDevido)); setVencimento(t.parcelas[0]?.vencimento.slice(0,10) || "");
    setConvenio(t.convenio); setCategoria(t.categoriaAtendimento);
    setForma(t.formaPagamentoOrigem || ""); setObservacoes(t.observacoes || "");
    setMotivo(""); setErro(""); setSucesso("");
  }
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); if (!editando) return;
    setSalvando(true); setErro(""); setSucesso("");
    try {
      const r = await fetch(`${API}/terceirizacao/financeiro/titulos/${editando}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valorDevido: valor, vencimento, convenio, categoriaAtendimento: categoria,
          formaPagamentoOrigem: forma, observacoes, motivo }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || "Não foi possível atualizar o título.");
      setSucesso("Título atualizado e auditoria registrada."); setEditando(null); await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao atualizar título."); }
    finally { setSalvando(false); }
  }
  const atual = exames.flatMap((e) => e.titulosFinanceirosV3).find((t) => t.id === editando);
  return <section className="rounded-xl border border-[#E3E5E1] bg-white p-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-semibold text-[#18383D]">Títulos automáticos por exame</h3>
        <p className="text-sm text-slate-600">Competência {competencia ? competencia.split("-").reverse().join("/") : "atual"}.
          Criados na confirmação do envio para laudar; nenhuma baixa é automática.</p></div>
      <button type="button" className="rounded-lg border px-4 py-2 text-sm font-medium" onClick={() => void carregar().catch((e) => setErro(String(e)))}>Atualizar</button>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg bg-[#F7F6F2] p-3 text-sm"><b>{resumo.emitidos}</b><div className="text-slate-600">Títulos emitidos</div></div>
      <div className="rounded-lg bg-amber-50 p-3 text-sm"><b>{resumo.pendentes}</b><div className="text-slate-600">Exames enviados sem título</div></div>
      <div className="rounded-lg bg-[#F7F6F2] p-3 text-sm"><b>{resumo.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b><div className="text-slate-600">Valor de títulos ativos</div></div>
    </div>
    {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
    {sucesso && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{sucesso}</p>}
    {carregando ? <p className="text-sm text-slate-500">Carregando...</p> : exames.length === 0 ?
      <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Nenhum exame realizado no mês atual.</p> :
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
        <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-2">Exame / realização</th><th className="p-2">Clínica</th><th className="p-2">Situação financeira</th><th className="p-2">Valor</th><th className="p-2">Vencimento</th><th className="p-2">Ações</th></tr></thead>
        <tbody>{exames.map((e) => { const t = e.titulosFinanceirosV3.find((a) => !a.canceladoEm); const parcela = t?.parcelas.find((p) => !p.canceladaEm);
          const recebido = (t?.parcelas || []).filter((p) => !p.canceladaEm)
            .flatMap((p) => p.baixas).reduce((n,b) => n + Number(b.valor),0);
          return <tr key={e.id} className="border-b align-top">
            <td className="p-2"><b>{e.tipoExame}</b> · {e.producao.nomePacienteDigitado}<div className="text-xs text-slate-500">{brData(e.producao.dataRealizacao)}</div></td>
            <td className="p-2">{e.producao.clinica.nome}</td>
            <td className="p-2">{t ? (recebido >= Number(t.valorDevido) ? "Quitado" : recebido > 0 ? "Recebimento parcial" : "Emitido") : e.financeiroPendenciaV3 ?
              <span className="text-amber-800" title={e.financeiroPendenciaV3}>Pendente: {e.financeiroPendenciaV3}</span> :
              e.status === "REALIZADO" ? "Aguardando envio para laudar" : "Sem título"}</td>
            <td className="p-2">{t ? moeda(t.valorDevido) : "—"}</td>
            <td className="p-2">{parcela ? brData(parcela.vencimento) : "—"}</td>
            <td className="p-2">{podeAdministrar && t && <button type="button" className="font-semibold text-[#087681] hover:underline"
              onClick={() => abrirEdicao(t)}>Editar título</button>}</td>
          </tr>; })}</tbody>
      </table></div>}
    {podeAdministrar && atual && <form onSubmit={(e) => void salvar(e)} className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center justify-between"><h4 className="font-semibold">Edição excepcional — Título #{atual.id}</h4>
        <button className="text-sm underline" type="button" onClick={() => setEditando(null)}>Cancelar</button></div>
      <p className="text-sm text-amber-900">Somente administrador. A data de realização e a competência permanecem inalteradas.
        Títulos com baixas ativas ou parcelamentos especiais são bloqueados pela API.</p>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium">Valor devido (R$) *<input className={campo} type="number" min="0.01" step="0.01" required value={valor} onChange={(e) => setValor(e.target.value)}/></label>
        <label className="text-sm font-medium">Vencimento *<input className={campo} type="date" required value={vencimento} onChange={(e) => setVencimento(e.target.value)}/></label>
        <label className="text-sm font-medium">Convênio<input className={campo} value={convenio} maxLength={120} onChange={(e) => setConvenio(e.target.value)}/></label>
        <label className="text-sm font-medium">Categoria<input className={campo} value={categoria} maxLength={120} onChange={(e) => setCategoria(e.target.value)}/></label>
        <label className="text-sm font-medium">Forma de pagamento<input className={campo} value={forma} maxLength={120} onChange={(e) => setForma(e.target.value)}/></label>
        <label className="text-sm font-medium">Observações<input className={campo} value={observacoes} maxLength={2000} onChange={(e) => setObservacoes(e.target.value)}/></label>
      </div>
      <label className="block text-sm font-medium">Justificativa da alteração *
        <textarea className={campo} value={motivo} required minLength={10} maxLength={1000} rows={2}
          onChange={(e) => setMotivo(e.target.value)} placeholder="Informe por que o título precisa ser corrigido." /></label>
      <button disabled={salvando || motivo.trim().length < 10} type="submit" className="rounded-lg bg-[#064E57] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
        {salvando ? "Salvando..." : "Salvar correção e registrar auditoria"}</button>
      {atual.auditorias.length > 0 && <div className="border-t pt-3"><h5 className="text-sm font-semibold">Histórico de edições</h5>
        {atual.auditorias.map((a) => <p key={a.id} className="mt-2 text-xs text-slate-600">{new Date(a.criadoEm).toLocaleString("pt-BR")} · {a.usuario.nome}: {a.motivo}</p>)}
      </div>}
    </form>}
    {podeAdministrar && <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold">Regularização excepcional — todas as competências ({totalPendencias})</h4>
        <button type="button" onClick={() => void carregarPendencias().catch(e => setErro(String(e)))} className="text-sm underline">Atualizar pendências</button></div>
      <p className="text-xs text-amber-900">Somente administração. Configure a tabela de preços com vigência na realização, confirme os vencimentos originais e registre uma justificativa. Não é emissão manual comum.</p>
      {pendencias.map(e => <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
        <div><b>{e.producao.nomePacienteDigitado} · {e.tipoExame}</b> · {e.producao.clinica.nome} · {brData(e.producao.dataRealizacao)}
          <p className="text-xs text-amber-900">{e.financeiroPendenciaV3}</p></div>
        <button type="button" className="rounded border bg-white px-3 py-1" onClick={() => {setRegularizando(e.id);setVencimentos([""]);setConferePlano(false);setJustificativaReg("");}}>Regularizar</button>
      </div>)}
      {totalPendencias > 25 && <div className="flex gap-2 items-center text-sm">
        <button type="button" className="rounded border p-1 disabled:opacity-40" disabled={paginaPendencias===1} onClick={()=>setPaginaPendencias(p=>p-1)}>Anterior</button>
        <span>{paginaPendencias}/{Math.ceil(totalPendencias/25)}</span>
        <button type="button" className="rounded border p-1 disabled:opacity-40" disabled={paginaPendencias*25>=totalPendencias} onClick={()=>setPaginaPendencias(p=>p+1)}>Próxima</button>
      </div>}
      {regularizando && <form onSubmit={(e)=>void regularizar(e)} className="rounded-lg border bg-white p-3 space-y-3">
        <h5 className="font-semibold">Reconstruir plano original do exame #{regularizando}</h5>
        <p className="text-xs text-slate-700">Os vencimentos originais não foram guardados quando o exame ficou sem título. Confira o contrato antes de informar. O valor será calculado sobre o repasse da Digna.</p>
        <label className="block text-sm">Número de parcelas (1 a 12)
          <select className={campo} value={vencimentos.length} onChange={e=>setVencimentos(Array.from({length:Number(e.target.value)},()=>""))}>
            {Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div className="grid gap-2 sm:grid-cols-3">{vencimentos.map((v,i)=><label key={i} className="text-xs">Parcela {i+1}/{vencimentos.length}
          <input type="date" required className={campo} value={v} onChange={e=>setVencimentos(a=>a.map((x,j)=>i===j?e.target.value:x))} />
        </label>)}</div>
        <label className="block text-sm">Justificativa obrigatória
          <textarea className={campo} required minLength={10} maxLength={1000} value={justificativaReg} onChange={e=>setJustificativaReg(e.target.value)} />
        </label>
        <label className="flex gap-2 text-xs"><input type="checkbox" required checked={conferePlano} onChange={e=>setConferePlano(e.target.checked)} /> Conferi no contrato a quantidade de parcelas e os vencimentos originais.</label>
        <div className="flex gap-2"><button type="submit" disabled={salvando||!conferePlano||justificativaReg.trim().length<10||vencimentos.some(v=>!v)} className="rounded bg-teal-700 px-3 py-2 text-sm text-white disabled:opacity-40">Criar título auditado</button>
          <button type="button" onClick={()=>setRegularizando(null)} className="rounded border px-3 py-2 text-sm">Cancelar</button></div>
      </form>}
    </div>}
    <p className="text-xs text-slate-500">Demais competências estão disponíveis em Relatórios. Regularizações usam a data original da realização e não alteram o envio do laudo.</p>
  </section>;
}
