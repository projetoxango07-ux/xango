"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:3333";
const raiz = `${API_URL}/financeiro/v12/parcelamentos`;

type Parcela = {
  id: number; numero: number; vencimento: string; valorPrevisto: number;
  recebido: number; saldo: number; status: string; atrasada: boolean;
};
type Plano = { id: number; forma: "BOLETO" | "PIX_PARCELADO"; valorTotal: number; numeroParcelas: number; parcelas: Parcela[] };
type Conta = { id: number; nome: string; tipo: string };
type Dados = { planos: Plano[]; saldoLivre: number; comprometido: number; contas: Conta[]; podeDarBaixa: boolean };
type Props = {
  guiaId: number | undefined;
  onBaixa?: (financeiro: { totalPago?: number; totalEstornado?: number; status?: string }) => void;
  onModoAlterado?: (aberto: boolean) => void;
  onPlanoCriado?: () => void;
};
const reais = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const dataPt = (iso: string) => iso.split("-").reverse().join("/");

async function chamada<T>(url: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(url, {
    credentials: "include", cache: "no-store", ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || `Erro ${resposta.status}.`);
  return dados as T;
}

export default function ParcelamentosGuiaV12({ guiaId, onBaixa, onModoAlterado, onPlanoCriado }: Props) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<Dados | null>(null);
  const [voucherLiberado, setVoucherLiberado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [forma, setForma] = useState<"BOLETO" | "PIX_PARCELADO">("BOLETO");
  const [valorTotal, setValorTotal] = useState("");
  const [parcelas, setParcelas] = useState(2);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(hoje);
  const [observacao, setObservacao] = useState("");
  const [baixaParcela, setBaixaParcela] = useState<number | null>(null);
  const [contaId, setContaId] = useState("");
  const [dataRecebimento, setDataRecebimento] = useState(hoje);

  const carregar = useCallback(async () => {
    if (!guiaId) return;
    try {
      setCarregando(true); setErro("");
      const resultado = await chamada<Dados>(`${raiz}/guia/${guiaId}`);
      setDados(resultado);
      // Consultar sempre a elegibilidade real da guia no backend. O status
      // da parcela por si só não substitui a validação de cadastro/financeiro.
      try {
        const detalhe = await chamada<{ elegibilidadeImpressao?: { podeImprimir?: boolean } }>(
          `${API_URL}/guias/${guiaId}`,
        );
        setVoucherLiberado(Boolean(detalhe.elegibilidadeImpressao?.podeImprimir));
      } catch {
        setVoucherLiberado(false);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar parcelas.");
    } finally { setCarregando(false); }
  }, [guiaId]);

  useEffect(() => {
    if (!aberto || !guiaId) return;
    const timer = window.setTimeout(() => { void carregar(); }, 0);
    return () => window.clearTimeout(timer);
  }, [aberto, guiaId, carregar]);

  const valor = Number(valorTotal.replace(",", "."));
  const centavos = Math.round(valor * 100);
  const valido = Number.isFinite(valor) && centavos >= parcelas && parcelas >= 1 && parcelas <= 24 &&
    Boolean(primeiroVencimento) && centavos <= Math.round((dados?.saldoLivre || 0) * 100);
  const valorBase = valido ? Math.floor(centavos / parcelas) : 0;
  const resto = valido ? centavos % parcelas : 0;

  async function criarPlano() {
    if (!guiaId || !valido) return;
    if (!window.confirm(`Programar ${parcelas} parcela(s) de ${reais(valor)}? Nenhum valor será marcado como recebido.`)) return;
    try {
      setSalvando(true); setErro(""); setMensagem("");
      await chamada(`${raiz}/guia/${guiaId}`, { method: "POST", body: JSON.stringify({
        forma, valorTotal: valor, parcelas, primeiroVencimento, observacao,
      }) });
      setMensagem("Parcelamento registrado. A liberação do voucher depende da cobertura integral do saldo e do cadastro completo do paciente; as parcelas continuam pendentes até cada baixa.");
      setValorTotal(""); setObservacao("");
      await carregar();
      onPlanoCriado?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o parcelamento.");
    } finally { setSalvando(false); }
  }

  async function baixar(planoId: number, parcela: Parcela) {
    if (!dados?.podeDarBaixa || !contaId || !dataRecebimento) return;
    if (!window.confirm(`Confirmar recebimento de ${reais(parcela.saldo)} na conta selecionada em ${dataPt(dataRecebimento)}?`)) return;
    try {
      setSalvando(true); setErro(""); setMensagem("");
      const resposta = await chamada<{ financeiro: { totalPago?: number; totalEstornado?: number; status?: string } }>(
        `${raiz}/${planoId}/parcelas/${parcela.id}/baixa`, {
          method: "POST", body: JSON.stringify({ contaFinanceiraId: Number(contaId), dataRecebimento }),
        });
      setMensagem(`Baixa da parcela ${parcela.numero} confirmada em ${dataPt(dataRecebimento)}.`);
      setBaixaParcela(null); onBaixa?.(resposta.financeiro);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível registrar a baixa.");
    } finally { setSalvando(false); }
  }

  return (
    <section className="rounded-lg border border-purple-200 bg-purple-50/40 p-4">
      <button type="button" onClick={() => { const proximo = !aberto; setAberto(proximo); onModoAlterado?.(proximo); }}
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-purple-900">
        <span>Boleto / PIX parcelado — baixa manual</span><span>{aberto ? "Recolher" : "Programar / consultar"}</span>
      </button>
      {aberto && <div className="mt-4 space-y-4">
        {!guiaId ? <p className="text-sm text-amber-800">Salve a guia antes de programar parcelas.</p> : <>
          <p className="text-xs leading-5 text-slate-600">O parcelamento é independente do recebimento imediato. Ao programar o valor integral pendente, com cadastro completo, o voucher fica autorizado para impressão. Nenhuma parcela será marcada como recebida antes da baixa manual.</p>
          {carregando && <p className="text-xs text-slate-600">Atualizando parcelas...</p>}
          {erro && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          {mensagem && <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{mensagem}</p>}
          {voucherLiberado && (
            <a href={`/impressao/guia/${guiaId}`} target="_blank" rel="noopener noreferrer"
              className="block rounded-lg bg-emerald-700 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-800">
              Emitir voucher autorizado
            </a>
          )}
          {dados && <>
            <div className="grid grid-cols-2 gap-3 rounded border border-purple-200 bg-white p-3 text-sm">
              <div>Saldo livre: <strong>{reais(dados.saldoLivre)}</strong></div>
              <div>Programado e pendente: <strong>{reais(dados.comprometido)}</strong></div>
            </div>
            {dados.saldoLivre > 0.009 && <div className="space-y-3 rounded border border-purple-200 bg-white p-3">
              <p className="text-sm font-semibold">Novo parcelamento</p>
              <label className="block text-xs">Forma
                <select value={forma} onChange={e => setForma(e.target.value as typeof forma)}
                  className="mt-1 w-full rounded border p-2 text-sm"><option value="BOLETO">Boleto</option><option value="PIX_PARCELADO">PIX parcelado</option></select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs">Valor total (R$)
                  <input type="number" min="0.01" step="0.01" value={valorTotal} onChange={e=>setValorTotal(e.target.value)} className="mt-1 w-full rounded border p-2 text-sm" placeholder="0,00" />
                </label>
                <label className="block text-xs">Parcelas
                  <select value={parcelas} onChange={e=>setParcelas(Number(e.target.value))} className="mt-1 w-full rounded border p-2 text-sm">
                    {Array.from({length:24},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}x</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-xs">Primeiro vencimento
                <input type="date" value={primeiroVencimento} onChange={e=>setPrimeiroVencimento(e.target.value)} className="mt-1 w-full rounded border p-2 text-sm" />
              </label>
              <label className="block text-xs">Observações (opcional)
                <input value={observacao} maxLength={500} onChange={e=>setObservacao(e.target.value)} className="mt-1 w-full rounded border p-2 text-sm" />
              </label>
              {valido && <p className="text-xs text-slate-600">Prévia: {parcelas}x, primeira parcela {reais((valorBase + (resto>0?1:0))/100)}. A diferença de centavos será distribuída entre as primeiras parcelas.</p>}
              <button type="button" disabled={!valido || salvando} onClick={()=>void criarPlano()}
                className="w-full rounded bg-purple-800 p-3 text-sm font-semibold text-white disabled:opacity-40">{salvando ? "Registrando..." : "Programar parcelas (sem receber)"}</button>
            </div>}
            {dados.planos.map(plano => <div key={plano.id} className="space-y-3 rounded border border-purple-200 bg-white p-3">
              <p className="font-semibold text-sm">{plano.forma === "BOLETO" ? "Boleto" : "PIX parcelado"} · {plano.numeroParcelas}x · {reais(plano.valorTotal)}</p>
              {plano.parcelas.map(parcela => <div key={parcela.id} className="border-t pt-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Parcela {parcela.numero} · {dataPt(parcela.vencimento)}{parcela.atrasada && <strong className="ml-2 text-red-700">VENCIDA</strong>}</span>
                  <strong>{reais(parcela.valorPrevisto)}</strong>
                </div>
                <p className="mt-1 text-slate-600">Recebido: {reais(parcela.recebido)} · Em aberto: {reais(parcela.saldo)} · {parcela.status === "RECEBIDA" ? "Baixada" : "Pendente"}</p>
                {parcela.saldo > 0.009 && dados.podeDarBaixa && <>
                  {baixaParcela !== parcela.id ? <button type="button" onClick={()=>{setBaixaParcela(parcela.id);setDataRecebimento(hoje());setContaId("");}} className="mt-2 rounded border border-purple-600 px-3 py-2 font-semibold text-purple-700">Dar baixa nesta parcela</button> : <div className="mt-2 space-y-2 rounded bg-purple-50 p-2">
                    <label className="block">Conta que recebeu
                      <select value={contaId} onChange={e=>setContaId(e.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Selecione</option>
                        {dados.contas.map(conta=><option key={conta.id} value={conta.id}>{conta.nome}</option>)}</select>
                    </label>
                    <label className="block">Data efetiva do crédito
                      <input type="date" max={hoje()} value={dataRecebimento} onChange={e=>setDataRecebimento(e.target.value)} className="mt-1 w-full rounded border p-2" />
                    </label>
                    <div className="flex gap-2"><button disabled={salvando || !contaId} type="button" onClick={()=>void baixar(plano.id,parcela)} className="rounded bg-purple-800 px-3 py-2 text-white disabled:opacity-40">Confirmar baixa de {reais(parcela.saldo)}</button>
                    <button type="button" onClick={()=>setBaixaParcela(null)} className="rounded border px-3 py-2">Cancelar</button></div>
                  </div>}
                </>}
              </div>)}
            </div>)}
            {dados.planos.length === 0 && <p className="text-xs text-slate-500">Nenhum parcelamento programado para esta guia.</p>}
            {!dados.podeDarBaixa && dados.planos.length > 0 && <p className="text-xs text-slate-600">A baixa bancária é reservada a usuários autorizados a operar contas bancárias.</p>}
          </>}
        </>}
      </div>}
    </section>
  );
}
