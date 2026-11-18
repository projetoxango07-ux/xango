"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
const campo = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#18383D]";
const botao = "rounded-lg border border-[#087681] px-3 py-2 text-sm font-semibold text-[#087681] disabled:opacity-40";
function hojeSP() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date());
  const p = Object.fromEntries(partes.map((item) => [item.type, item.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const dinheiro = (valor: number | string) => Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (valor: string) => valor ? valor.slice(0, 10).split("-").reverse().join("/") : "—";
function erroMensagem(valor: unknown) { return valor instanceof Error ? valor.message : "Não foi possível concluir a operação."; }
type Clinica = { id: number; nome: string };
type ParcelaAberta = {
  parcelaId: number; tituloId: number; numero: number; exame: string; paciente: string;
  realizacao: string; convenio: string; vencimento: string; valorPrevisto: string;
  saldo: string; situacao: "VENCIDA" | "PREVISTA" | "NAO_PAGA_NO_LOTE";
};
type FiltroVencimento = "ATE_DATA" | "VENCIDAS" | "HOJE" | "PROXIMOS_30" | "TODAS";
const filtrosRapidos: { value: FiltroVencimento; label: string }[] = [
  { value: "VENCIDAS", label: "Vencidas" },
  { value: "HOJE", label: "Vencem hoje" },
  { value: "PROXIMOS_30", label: "Próximos 30 dias" },
  { value: "TODAS", label: "Todas em aberto" },
  { value: "ATE_DATA", label: "Até a data" },
];
type Conferencia = {
  clinica: Clinica; data: string; itens: ParcelaAberta[];
  conferenciaRealizada: boolean; recebimentosHoje: number; total: number; saldoPendente: string;
};

export default function PortalV3ConferenciaLotes() {
  const { temPermissao } = useAuth();
  const podeConsultar = temPermissao("terceirizacao.financeiro.visualizar");
  const podeEditar = temPermissao("terceirizacao.financeiro.editar");
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [clinicaId, setClinicaId] = useState("");
  const [dataEfetiva, setDataEfetiva] = useState(hojeSP);
  // A data do pagamento e a data-limite da pesquisa nunca sao o mesmo controle.
  const [filtroVencimento, setFiltroVencimento] = useState<FiltroVencimento>("TODAS");
  const [vencimentoAte, setVencimentoAte] = useState(hojeSP);
  const [conferencia, setConferencia] = useState<Conferencia | null>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [formaPagamento, setFormaPagamento] = useState("TRANSFERENCIA");
  const [valorDeposito, setValorDeposito] = useState("");
  const [referenciaExtrato, setReferenciaExtrato] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const chavePendente = useRef<string | null>(null);
  const consultaAtual = useRef(0);

  useEffect(() => {
    if (!podeConsultar) return;
    let ativo = true;
    fetch(`${API}/terceirizacao/financeiro/clinicas`, { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(json.erro || "Falha ao carregar clínicas.");
        if (ativo) setClinicas(json.clinicas || []);
      })
      .catch((e) => { if (ativo) setErro(erroMensagem(e)); });
    return () => { ativo = false; };
  }, [podeConsultar]);

  const carregar = useCallback(async () => {
    if (!podeConsultar || !clinicaId || !dataEfetiva) return;
    const idConsulta = ++consultaAtual.current;
    setCarregando(true); setErro("");
    try {
      const params = new URLSearchParams({
        clinicaId, data: dataEfetiva, filtro: filtroVencimento, vencimentoAte,
      });
      const r = await fetch(`${API}/terceirizacao/financeiro/conferencia?${params}`, {
        credentials: "include", cache: "no-store",
      });
      const json = await r.json().catch(() => ({}));
      if (idConsulta !== consultaAtual.current) return;
      if (!r.ok) throw new Error(json.erro || "Falha na conferência de parcelas.");
      setConferencia(json as Conferencia);
      setSelecionados([]);
    } catch (e) {
      if (idConsulta === consultaAtual.current) { setConferencia(null); setErro(erroMensagem(e)); }
    } finally { if (idConsulta === consultaAtual.current) setCarregando(false); }
  }, [clinicaId, dataEfetiva, filtroVencimento, vencimentoAte, podeConsultar]);
  useEffect(() => { void carregar(); }, [carregar]);

  const itens = conferencia?.itens || [];
  const ids = useMemo(() => itens.map((item) => item.parcelaId), [itens]);
  const totalSelecionado = useMemo(() => itens
    .filter((item) => selecionados.includes(item.parcelaId))
    .reduce((soma, item) => soma + Math.round(Number(item.saldo) * 100), 0) / 100,
  [itens, selecionados]);
  const totalNaoSelecionado = Math.max(0, itens.length - selecionados.length);
  const diferencaExtrato = valorDeposito === "" ? null :
    Math.round(Number(valorDeposito) * 100) - Math.round(totalSelecionado * 100);
  const depositadoValido = valorDeposito === "" ||
    (Number.isFinite(Number(valorDeposito)) && Number(valorDeposito) > 0 && diferencaExtrato === 0);

  function alternar(id: number, checked: boolean) {
    setSelecionados((atual) => checked ? [...new Set([...atual, id])] : atual.filter((item) => item !== id));
    chavePendente.current = null; setSucesso("");
  }
  async function salvarLote() {
    if (!podeEditar || salvando || !conferencia || selecionados.length === 0 || !depositadoValido) return;
    if (!chavePendente.current) chavePendente.current = `V3LOTE-${window.crypto.randomUUID()}`;
    setSalvando(true); setErro(""); setSucesso("");
    try {
      const r = await fetch(`${API}/terceirizacao/financeiro/lotes`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicaId: Number(clinicaId), dataEfetiva, formaPagamento,
          referenciaExtrato, valorDeposito: valorDeposito || null, parcelas: selecionados,
          chaveLote: chavePendente.current }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.erro || "Não foi possível registrar o lote.");
      chavePendente.current = null;
      setValorDeposito(""); setReferenciaExtrato("");
      setSucesso(`${json.mensagem || "Recebimento registrado."} Total: ${dinheiro(json.total)}. ${totalNaoSelecionado} parcela(s) permaneceram em aberto.`);
      await carregar();
    } catch (e) { setErro(erroMensagem(e)); }
    finally { setSalvando(false); }
  }

  if (!podeConsultar) return null;
  return <section className="rounded-xl border border-[#DDE7E6] bg-white p-5 space-y-5">
    <div className="flex flex-wrap justify-between items-start gap-3">
      <div><h3 className="text-xl font-bold text-[#064E57]">Conferir recebimento em lote</h3>
        <p className="mt-1 text-sm text-[#667A7D]">Selecione uma clínica e marque somente os exames/parcelas efetivamente pagos.</p></div>
      <button type="button" className={botao} disabled={carregando || !clinicaId} onClick={() => void carregar()}>
        {carregando ? "Consultando..." : "Atualizar"}
      </button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm font-medium">Clínica parceira
        <select className={campo} value={clinicaId} onChange={(e) => {
          setClinicaId(e.target.value); setConferencia(null); setSelecionados([]);
          chavePendente.current = null; setErro(""); setSucesso("");
        }}><option value="">Selecione a clínica</option>
          {clinicas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">Data real do recebimento
        <input className={campo} type="date" max={hojeSP()} value={dataEfetiva} onChange={(e) => {
          setDataEfetiva(e.target.value); setConferencia(null); setSelecionados([]);
          chavePendente.current = null; setErro(""); setSucesso("");
        }}/>
      </label>
      <label className="text-sm font-medium">Forma de recebimento
        <select className={campo} value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>
          <option value="TRANSFERENCIA">Transferência</option>
          <option value="PIX">PIX</option>
          <option value="BOLETO">Boleto</option>
          <option value="DINHEIRO">Dinheiro</option>
          <option value="OUTRO">Outro</option>
        </select>
      </label>
    </div>
    <div className="space-y-3 rounded-lg border border-[#DDE7E6] bg-[#FAFCFB] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-[#064E57]">Consultar parcelas por vencimento</h4>
          <p className="text-xs text-slate-600">A consulta pode incluir vencimentos futuros, sem mudar a data real de recebimento.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros de vencimento">
        {filtrosRapidos.map((opcao) => <button type="button" key={opcao.value}
          aria-pressed={filtroVencimento === opcao.value}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${filtroVencimento === opcao.value
            ? "border-[#087681] bg-[#087681] text-white" : "border-[#BBD4D2] bg-white text-[#064E57] hover:bg-teal-50"}`}
          onClick={() => { setFiltroVencimento(opcao.value); setConferencia(null); setSelecionados([]);
            chavePendente.current = null; setErro(""); setSucesso(""); }}>
          {opcao.label}
        </button>)}
      </div>
      {filtroVencimento === "ATE_DATA" && <label className="block max-w-xs text-sm font-medium">
        Consultar vencimentos até
        <input className={campo} type="date" value={vencimentoAte} onChange={(e) => {
          setVencimentoAte(e.target.value); setConferencia(null); setSelecionados([]);
          chavePendente.current = null; setErro(""); setSucesso("");
        }}/>
        <span className="mt-1 block text-xs font-normal text-slate-600">Esta data pode ser futura; é apenas um filtro de consulta.</span>
      </label>}
    </div>
    {erro && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
    {sucesso && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{sucesso}</p>}
    {!clinicaId && <div className="rounded-lg bg-[#F7F6F2] p-4 text-sm text-slate-600">Selecione uma clínica para carregar os vencimentos e atrasos dela.</div>}
    {conferencia && <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-[#F7F6F2] p-3"><div className="text-xs text-slate-500">Em aberto na consulta</div>
          <b className="text-lg text-[#18383D]">{dinheiro(conferencia.saldoPendente)}</b></div>
        <div className="rounded-lg bg-teal-50 p-3"><div className="text-xs text-slate-600">Total marcado para receber</div>
          <b className="text-lg text-[#087681]">{dinheiro(totalSelecionado)}</b></div>
        <div className="rounded-lg bg-amber-50 p-3"><div className="text-xs text-slate-600">Parcelas não selecionadas</div>
          <b className="text-lg text-amber-900">{totalNaoSelecionado}</b></div>
      </div>
      {conferencia.conferenciaRealizada && itens.length > 0 &&
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Já houve recebimento em lote nesta clínica e nesta data. As parcelas ainda abertas são <b>não pagas na conferência</b> ou estão vencidas.
        </div>}
      {!itens.length ? <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">Nenhuma parcela em aberto para o filtro de vencimento selecionado.</p> :
      <div className="overflow-x-auto rounded-lg border border-[#DDE7E6]">
        <table className="min-w-[850px] w-full text-sm">
          <thead className="bg-[#064E57] text-white"><tr>
            <th className="px-3 py-3 text-left"><input aria-label="Selecionar todas as parcelas" type="checkbox"
              checked={ids.length > 0 && selecionados.length === ids.length}
              onChange={(e) => { setSelecionados(e.target.checked ? ids : []); chavePendente.current = null; setSucesso(""); }}/></th>
            <th className="px-3 py-3 text-left">Paciente / exame</th><th className="px-3 py-3 text-left">Convênio</th>
            <th className="px-3 py-3 text-left">Parcela</th><th className="px-3 py-3 text-left">Vencimento</th>
            <th className="px-3 py-3 text-right">A receber</th><th className="px-3 py-3 text-left">Situação</th>
          </tr></thead>
          <tbody>{itens.map((item) => <tr key={item.parcelaId} className="border-b last:border-b-0 hover:bg-slate-50">
            <td className="px-3 py-3"><input type="checkbox" aria-label={`Receber parcela ${item.numero} do exame ${item.exame} de ${item.paciente}`}
              checked={selecionados.includes(item.parcelaId)} onChange={(e) => alternar(item.parcelaId, e.target.checked)}/></td>
            <td className="px-3 py-3"><b>{item.paciente}</b><div className="text-xs text-slate-600">{item.exame} · realizado {dataBR(item.realizacao)}</div></td>
            <td className="px-3 py-3">{item.convenio || "GERAL"}</td>
            <td className="px-3 py-3">{item.numero}</td><td className="px-3 py-3">{dataBR(item.vencimento)}</td>
            <td className="px-3 py-3 text-right font-semibold tabular-nums">{dinheiro(item.saldo)}</td>
            <td className="px-3 py-3">{item.situacao === "VENCIDA" ? <span className="font-semibold text-red-700">Vencida</span> :
              item.situacao === "NAO_PAGA_NO_LOTE" ? <span className="font-semibold text-amber-800">Não paga no lote</span> :
              <span className="text-slate-600">Prevista</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      {podeEditar && itens.length > 0 && <div className="space-y-3 rounded-lg bg-[#F7F6F2] p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Valor do depósito no extrato (opcional)
            <input className={campo} type="number" step="0.01" min="0.01" placeholder="Confere o total marcado" value={valorDeposito}
              onChange={(e) => { setValorDeposito(e.target.value); chavePendente.current = null; }}/>
          </label>
          <label className="text-sm font-medium">Referência/comprovante do depósito (opcional)
            <input className={campo} maxLength={100} placeholder="Identificação no banco" value={referenciaExtrato}
              onChange={(e) => { setReferenciaExtrato(e.target.value); chavePendente.current = null; }}/>
          </label>
        </div>
        {diferencaExtrato !== null && diferencaExtrato !== 0 && <p className="text-sm font-semibold text-red-700">
          Divergência no extrato: {dinheiro(Math.abs(diferencaExtrato) / 100)}. Ajuste a seleção antes de confirmar.
        </p>}
        {totalNaoSelecionado > 0 && <p className="text-xs text-amber-900">
          {totalNaoSelecionado} parcela(s) não selecionada(s) continuarão em aberto. Se já houver lote nesta data,
          aparecerão como não pagas na conferência.
        </p>}
        <p className="text-xs text-slate-600">Parcelas com vencimento futuro podem ser pagas antecipadamente.
          O recebimento sera registrado apenas na data real informada acima, nunca em uma data futura.</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">Selecionadas: <b>{selecionados.length}</b> · Total: <b className="text-lg text-[#087681]">{dinheiro(totalSelecionado)}</b></div>
          <button type="button" className="rounded-lg bg-[#087681] px-5 py-3 font-semibold text-white disabled:opacity-40"
            disabled={salvando || selecionados.length === 0 || !depositadoValido}
            onClick={() => void salvarLote()}>{salvando ? "Registrando..." : "Confirmar recebimento em lote"}</button>
        </div>
      </div>}
      <p className="text-xs text-slate-500">A baixa usa a data real informada. A competência do exame permanece na realização,
        inclusive quando parcelas de meses anteriores vencem agora. Nenhuma movimentação é enviada ao caixa da V1.</p>
    </>}
  </section>;
}
