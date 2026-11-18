"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
const campo = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const botao = "rounded-lg border border-[#087681] px-3 py-2 text-sm font-semibold text-[#087681] hover:bg-teal-50 disabled:opacity-40";
const primario = "rounded-lg bg-[#087681] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40";

type Baixa = {
  id: number; valor: string; dataEfetiva: string; formaPagamento: string | null;
  referencia: string | null; observacoes: string | null; criadoEm: string;
  estornadoEm: string | null; motivoEstorno: string | null;
  registradoPor: { nome: string }; estornadoPor: { nome: string } | null;
};
type Parcela = {
  id: number; numero: number; valorPrevisto: string; vencimento: string;
  valorRecebido: string; saldo: string; canceladaEm: string | null;
  baixas: Baixa[];
};
type Titulo = {
  id: number; convenio: string; formaPagamentoOrigem: string | null;
  valorDevido: string; dataCompetencia: string | null; valorRecebido: string;
  saldo: string; situacao: "QUITADO" | "PARCIAL" | "EM_ABERTO";
  exame: { tipoExame: string; producao: { nomePacienteDigitado: string; dataRealizacao: string } };
  clinica: { nome: string }; parcelas: Parcela[];
};
type Resposta = { competencia: string; pagina: number; tamanhoPagina: number;
  total: number; paginas: number; titulos: Titulo[] };
type Plano = { vencimento: string; valor: string };

function dinheiro(v: string | number) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dataBR(v: string) { return v ? v.slice(0,10).split("-").reverse().join("/") : "—"; }
function hojeSP() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function erroMensagem(e: unknown) { return e instanceof Error ? e.message : "Não foi possível concluir a operação."; }

export default function PortalV3Recebimentos({ mes }: { mes?: string }) {
  const { usuario, temPermissao } = useAuth();
  const podeConsultar = temPermissao("terceirizacao.financeiro.visualizar");
  const podeRegistrar = temPermissao("terceirizacao.financeiro.editar");
  const administrador = podeRegistrar && usuario?.perfil === "ADMINISTRADOR";
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(""); const [ok, setOk] = useState("");
  const [aberto, setAberto] = useState<number | null>(null);
  const [pagando, setPagando] = useState<number | null>(null);
  const [valor, setValor] = useState("");
  const [dataEfetiva, setDataEfetiva] = useState(hojeSP);
  const [forma, setForma] = useState(""); const [referencia, setReferencia] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [estornando, setEstornando] = useState<number | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState("");
  const [reprogramando, setReprogramando] = useState<number | null>(null);
  const [plano, setPlano] = useState<Plano[]>([]);
  const [motivoParcelamento, setMotivoParcelamento] = useState("");

  const carregar = useCallback(async () => {
    if (!podeConsultar) return;
    setCarregando(true);
    try {
      const params = new URLSearchParams({ pagina: String(pagina) });
      if (mes) params.set("mes", mes);
      const r = await fetch(`${API}/terceirizacao/financeiro/recebimentos?${params}`, {
        credentials: "include", cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || "Não foi possível consultar o financeiro da V3.");
      setDados(j as Resposta); setErro("");
    } catch (e) { setDados(null); setErro(erroMensagem(e)); }
    finally { setCarregando(false); }
  }, [podeConsultar, pagina, mes]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { setPagina(1); setAberto(null); setPagando(null);
    setEstornando(null); setReprogramando(null); }, [mes]);
  const totalPagina = useMemo(() => {
    const titulos = dados?.titulos || [];
    return { previsto: titulos.reduce((s, t) => s + Number(t.valorDevido), 0),
      recebido: titulos.reduce((s, t) => s + Number(t.valorRecebido), 0),
      saldo: titulos.reduce((s, t) => s + Number(t.saldo), 0) };
  }, [dados]);

  function abrirBaixa(p: Parcela) {
    setPagando(p.id); setValor(p.saldo); setDataEfetiva(hojeSP());
    setForma(""); setReferencia(""); setObservacoes(""); setErro(""); setOk("");
    setEstornando(null); setReprogramando(null);
  }
  async function requisitar(url: string, metodo: "POST" | "PUT", corpo: unknown) {
    const r = await fetch(`${API}/terceirizacao${url}`, { method: metodo,
      credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || "A operação não foi concluída.");
    return j as { mensagem?: string };
  }
  async function registrarBaixa(evento: React.FormEvent) {
    evento.preventDefault(); if (pagando === null || salvando) return;
    if (!window.confirm(`Registrar recebimento de ${dinheiro(valor)} em ${dataBR(dataEfetiva)}?`)) return;
    setSalvando(true); setErro(""); setOk("");
    try {
      const resultado = await requisitar(`/financeiro/parcelas/${pagando}/baixas`, "POST",
        { valor, dataEfetiva, formaPagamento: forma, referencia, observacoes });
      setPagando(null); setOk(resultado.mensagem || "Recebimento registrado."); await carregar();
    } catch (e) { setErro(erroMensagem(e)); }
    finally { setSalvando(false); }
  }
  async function confirmarEstorno(evento: React.FormEvent) {
    evento.preventDefault(); if (estornando === null || salvando) return;
    if (!window.confirm("Estornar este recebimento? A operação será registrada no histórico e reabrirá o saldo.")) return;
    setSalvando(true); setErro(""); setOk("");
    try {
      const resultado = await requisitar(`/financeiro/baixas/${estornando}/estornar`, "POST", { motivo: motivoEstorno });
      setEstornando(null); setMotivoEstorno(""); setOk(resultado.mensagem || "Estorno registrado."); await carregar();
    } catch (e) { setErro(erroMensagem(e)); }
    finally { setSalvando(false); }
  }
  function abrirPlano(t: Titulo) {
    setReprogramando(t.id); setPlano(t.parcelas.filter((p) => !p.canceladaEm)
      .map((p) => ({ valor: p.valorPrevisto, vencimento: p.vencimento.slice(0,10) })));
    setMotivoParcelamento(""); setPagando(null); setEstornando(null); setErro(""); setOk("");
  }
  async function confirmarPlano(evento: React.FormEvent) {
    evento.preventDefault(); if (reprogramando === null || salvando) return;
    if (!window.confirm("Substituir os vencimentos e valores das parcelas? A alteração será auditada.")) return;
    setSalvando(true); setErro(""); setOk("");
    try {
      const resultado = await requisitar(`/financeiro/titulos/${reprogramando}/parcelas`, "PUT",
        { motivo: motivoParcelamento, parcelas: plano });
      setReprogramando(null); setOk(resultado.mensagem || "Parcelas reprogramadas."); await carregar();
    } catch (e) { setErro(erroMensagem(e)); }
    finally { setSalvando(false); }
  }

  if (!podeConsultar) return null;
  return <section className="rounded-xl border border-[#E3E5E1] bg-white p-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-semibold text-[#18383D]">Recebimentos e parcelas da terceirização</h3>
        <p className="text-sm text-slate-600">Competência da realização: <b>{(dados?.competencia || mes || "").split("-").reverse().join("/") || "mês atual"}</b>. A baixa usa a data real do recebimento.</p>
      </div>
      <button type="button" className={botao} disabled={carregando} onClick={() => void carregar()}>{carregando ? "Consultando..." : "Atualizar"}</button>
    </div>
    {dados && <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg bg-[#F7F6F2] p-3 text-sm"><b>{dinheiro(totalPagina.previsto)}</b><div className="text-slate-600">Títulos nesta página</div></div>
      <div className="rounded-lg bg-[#F7F6F2] p-3 text-sm"><b>{dinheiro(totalPagina.recebido)}</b><div className="text-slate-600">Recebido nesta página</div></div>
      <div className="rounded-lg bg-amber-50 p-3 text-sm"><b>{dinheiro(totalPagina.saldo)}</b><div className="text-slate-600">Saldo nesta página</div></div>
    </div>}
    {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
    {ok && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{ok}</p>}
    {carregando && !dados ? <p className="text-sm text-slate-500">Carregando...</p> :
      !dados?.titulos.length ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Não há títulos emitidos nessa competência.</p> :
      <div className="space-y-3">{dados.titulos.map((t) => {
        const comHistorico = t.parcelas.some((p) => p.baixas.length > 0);
        return <div key={t.id} className="rounded-lg border border-[#E3E5E1] p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm"><b>#{t.id} · {t.exame.tipoExame} — {t.exame.producao.nomePacienteDigitado}</b>
              <div className="text-xs text-slate-600">{t.clinica.nome} · Realizado em {dataBR(t.exame.producao.dataRealizacao)} · {t.convenio || "Geral"}</div></div>
            <div className="text-right text-sm"><b>{dinheiro(t.valorDevido)}</b>
              <div className="text-xs text-slate-600">Recebido {dinheiro(t.valorRecebido)} · Saldo {dinheiro(t.saldo)}</div>
              <span className={`text-xs font-semibold ${t.situacao === "QUITADO" ? "text-emerald-700" : t.situacao === "PARCIAL" ? "text-amber-700" : "text-slate-600"}`}>
                {t.situacao === "QUITADO" ? "Quitado" : t.situacao === "PARCIAL" ? "Parcialmente recebido" : "Em aberto"}</span></div>
            <button type="button" className={botao} onClick={() => setAberto(aberto === t.id ? null : t.id)}>
              {aberto === t.id ? "Ocultar parcelas" : "Ver parcelas"}</button>
          </div>
          {aberto === t.id && <div className="border-t pt-3 space-y-4">
            <div className="text-sm text-slate-600">As parcelas e as baixas preservam seus próprios vencimentos e datas efetivas.</div>
            {t.parcelas.map((p) => <div key={p.id} className={`rounded-lg border p-3 space-y-3 ${p.canceladaEm ? "bg-slate-50 opacity-70" : "bg-white"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <b>Parcela {p.numero} · vencimento {dataBR(p.vencimento)} {p.canceladaEm ? "(cancelada)" : ""}</b>
                <span>Previsto {dinheiro(p.valorPrevisto)} · Recebido {dinheiro(p.valorRecebido)} · Saldo {dinheiro(p.saldo)}</span>
                {podeRegistrar && !p.canceladaEm && Number(p.saldo) > 0 && <button type="button" className={botao} onClick={() => abrirBaixa(p)}>Registrar recebimento</button>}
              </div>
              {p.baixas.length > 0 && <div className="space-y-2">{p.baixas.map((b) => <div key={b.id} className="rounded-md bg-[#F7F6F2] p-2 text-xs flex flex-wrap justify-between gap-2">
                <div><b>{dinheiro(b.valor)}</b> · {dataBR(b.dataEfetiva)} · {b.formaPagamento || "Não informada"}
                  {b.referencia && <> · Ref. {b.referencia}</>}
                  <div className="text-slate-600">Registrado por {b.registradoPor.nome}{b.observacoes && <> · {b.observacoes}</>}</div>
                  {b.estornadoEm && <div className="text-red-700">ESTORNADO em {new Date(b.estornadoEm).toLocaleString("pt-BR")} por {b.estornadoPor?.nome || "Administrador"}. Motivo: {b.motivoEstorno}</div>}</div>
                {administrador && !b.estornadoEm && !p.canceladaEm && <button type="button" className="text-red-700 underline" onClick={() => { setEstornando(b.id); setMotivoEstorno(""); setPagando(null); setReprogramando(null); }}>Estornar</button>}
              </div>)}</div>}
              {pagando === p.id && <form onSubmit={(e) => void registrarBaixa(e)} className="rounded-lg border border-teal-200 bg-teal-50 p-3 space-y-3">
                <h4 className="font-semibold text-sm">Registrar recebimento — Parcela {p.numero}</h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-xs font-semibold">Valor recebido (R$) *<input required type="number" min="0.01" max={p.saldo} step="0.01" className={campo} value={valor} onChange={(e) => setValor(e.target.value)}/></label>
                  <label className="text-xs font-semibold">Data efetiva *<input required type="date" max={hojeSP()} className={campo} value={dataEfetiva} onChange={(e) => setDataEfetiva(e.target.value)}/></label>
                  <label className="text-xs font-semibold">Forma de recebimento *<input required maxLength={80} className={campo} placeholder="PIX, transferência, dinheiro..." value={forma} onChange={(e) => setForma(e.target.value)}/></label>
                  <label className="text-xs font-semibold">Referência do comprovante<input maxLength={150} className={campo} value={referencia} onChange={(e) => setReferencia(e.target.value)}/></label>
                  <label className="text-xs font-semibold lg:col-span-2">Observações<input maxLength={2000} className={campo} value={observacoes} onChange={(e) => setObservacoes(e.target.value)}/></label>
                </div>
                <div className="flex flex-wrap gap-2"><button type="submit" disabled={salvando || !valor || !forma} className={primario}>{salvando ? "Salvando..." : "Confirmar recebimento"}</button>
                  <button type="button" className={botao} onClick={() => setPagando(null)}>Cancelar</button></div>
              </form>}
              {estornando !== null && p.baixas.some((b) => b.id === estornando) && <form onSubmit={(e) => void confirmarEstorno(e)} className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-3">
                <label className="block text-sm font-semibold">Justificativa do estorno *<textarea required minLength={10} maxLength={1000} rows={2} className={campo} value={motivoEstorno} onChange={(e) => setMotivoEstorno(e.target.value)}/></label>
                <div className="flex flex-wrap gap-2"><button type="submit" className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={salvando || motivoEstorno.trim().length < 10}>Confirmar estorno</button>
                  <button type="button" className={botao} onClick={() => setEstornando(null)}>Cancelar</button></div>
              </form>}
            </div>)}
            {administrador && <div className="space-y-3">
              <button type="button" className={botao} disabled={comHistorico}
                title={comHistorico ? "Parcelas com histórico de baixa não podem ser reprogramadas" : ""}
                onClick={() => abrirPlano(t)}>Reprogramar parcelas</button>
              {comHistorico && <p className="text-xs text-slate-500">Reprogramação bloqueada: existe histórico de recebimento, inclusive estornado.</p>}
              {reprogramando === t.id && <form onSubmit={(e) => void confirmarPlano(e)} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <h4 className="font-semibold text-sm">Reprogramação administrativa — Título #{t.id}</h4>
                <p className="text-xs text-amber-900">Defina até 24 parcelas. A soma deve ser exatamente {dinheiro(t.valorDevido)}. Não altera a competência de realização.</p>
                {plano.map((p, i) => <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <label className="text-xs font-semibold">Vencimento {i + 1} *<input className={campo} type="date" required min={t.exame.producao.dataRealizacao.slice(0,10)} value={p.vencimento}
                    onChange={(e) => setPlano((a) => a.map((x,j) => i === j ? { ...x, vencimento: e.target.value } : x))}/></label>
                  <label className="text-xs font-semibold">Valor (R$) *<input className={campo} type="number" min="0.01" step="0.01" required value={p.valor}
                    onChange={(e) => setPlano((a) => a.map((x,j) => i === j ? { ...x, valor: e.target.value } : x))}/></label>
                  <button type="button" className={botao} disabled={plano.length === 1} onClick={() => setPlano((a) => a.filter((_,j) => i !== j))}>Remover</button>
                </div>)}
                <div className="flex flex-wrap gap-3 items-center">
                  <button type="button" className={botao} disabled={plano.length >= 24} onClick={() => setPlano((a) => [...a, { valor: "", vencimento: a[a.length-1]?.vencimento || hojeSP() }])}>+ Parcela</button>
                  <span className="text-xs">Soma: <b>{dinheiro(plano.reduce((s,p) => s + (Number(p.valor) || 0),0))}</b></span>
                </div>
                <label className="block text-sm font-semibold">Justificativa *<textarea className={campo} required rows={2} minLength={10} maxLength={1000} value={motivoParcelamento} onChange={(e) => setMotivoParcelamento(e.target.value)}/></label>
                <div className="flex flex-wrap gap-2"><button className={primario} disabled={salvando || motivoParcelamento.trim().length < 10} type="submit">{salvando ? "Salvando..." : "Salvar parcelamento e auditoria"}</button>
                  <button type="button" className={botao} onClick={() => setReprogramando(null)}>Cancelar</button></div>
              </form>}
            </div>}
          </div>}
        </div>;
      })}</div>}
    {dados && <div className="flex flex-wrap justify-between items-center gap-3 border-t pt-3 text-sm">
      <span className="text-slate-600">{dados.total} títulos · Página {dados.pagina} de {dados.paginas}. Valores acima referem-se apenas aos títulos desta página.</span>
      <div className="flex gap-2"><button type="button" className={botao} disabled={carregando || pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
        <button type="button" className={botao} disabled={carregando || pagina >= dados.paginas} onClick={() => setPagina(pagina + 1)}>Próxima</button></div>
    </div>}
    <p className="text-xs text-slate-500">Recebimentos e estornos são lançamentos auditáveis da V3. Nenhum valor movimenta o caixa da V1; a data efetiva da baixa é independente da competência do exame.</p>
  </section>;
}
