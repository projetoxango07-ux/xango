"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const API = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333"}/financeiro/v12`;
const moeda = (numero: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numero || 0);
const dataBR = (valor: string | null | undefined) => valor ? valor.slice(0, 10).split("-").reverse().join("/") : "—";
const dataHoraBR = (valor: string | null | undefined) => valor
  ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(valor)) : "—";

type Movimento = {
  id: number;
  tipo: "ENTRADA" | "SAIDA";
  origem: string;
  descricao: string | null;
  valor: number;
  criadoEm: string;
};
type RelatorioCaixa = {
  sessaoId: number;
  status: "ABERTA" | "FECHADA";
  conta: string;
  dataMovimento: string;
  abertoPor: string;
  fechadoPor: string | null;
  abertoEm: string;
  fechadoEm: string | null;
  observacaoAbertura: string | null;
  observacaoFechamento: string | null;
  saldoInicial: number;
  entradas: number;
  saidas: number;
  saldoFinalEsperado: number;
  saldoFinalContado: number | null;
  diferenca: number | null;
  movimentos: Movimento[];
};

export default function ImpressaoFechamentoCaixa() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [dados, setDados] = useState<RelatorioCaixa | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const controlador = new AbortController();
    const numero = Number(id);
    if (!Number.isSafeInteger(numero) || numero <= 0) {
      setErro("Caixa inválido.");
      setCarregando(false);
      return;
    }
    fetch(`${API}/caixas/${numero}/conferencia`, {
      credentials: "include", cache: "no-store", signal: controlador.signal,
    }).then(async (resposta) => {
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.erro || "Erro ao carregar fechamento.");
      return corpo as RelatorioCaixa;
    }).then((conteudo) => setDados(conteudo))
      .catch((falha) => { if (!controlador.signal.aborted) setErro(falha instanceof Error ? falha.message : "Erro ao carregar fechamento."); })
      .finally(() => { if (!controlador.signal.aborted) setCarregando(false); });
    return () => controlador.abort();
  }, [id]);

  return <div id="digna-v12-caixa-impressao" className="min-h-screen bg-slate-100 p-4 text-slate-900 print:bg-white print:p-0">
    <style>{`@media print {
      @page { size: A4 portrait; margin: 12mm; }
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      /* O relatorio esta sob o layout autenticado. Oculta o menu, o cabecalho
         e os demais componentes da aplicacao sem afetar a visualizacao normal. */
      body * { visibility: hidden !important; }
      #digna-v12-caixa-impressao, #digna-v12-caixa-impressao * { visibility: visible !important; }
      #digna-v12-caixa-impressao {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }
      #digna-v12-caixa-impressao .sem-impressao { display: none !important; }
      #digna-v12-caixa-impressao .folha {
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        box-shadow: none !important;
      }
      #digna-v12-caixa-impressao .folha header { padding-bottom: 10px !important; }
      #digna-v12-caixa-impressao .folha > section.mt-5 { margin-top: 12px !important; }
      #digna-v12-caixa-impressao .folha > h2.mt-7 { margin-top: 18px !important; }
      #digna-v12-caixa-impressao .folha .assinaturas { margin-top: 22px !important; break-inside: avoid; }
      #digna-v12-caixa-impressao .folha .assinaturas > div.mt-14 { margin-top: 32px !important; }
      #digna-v12-caixa-impressao .folha footer { margin-top: 24px !important; }
      #digna-v12-caixa-impressao .folha th,
      #digna-v12-caixa-impressao .folha td { padding-top: 5px !important; padding-bottom: 5px !important; }
      #digna-v12-caixa-impressao thead { display: table-header-group; }
      #digna-v12-caixa-impressao tr { break-inside: avoid; page-break-inside: avoid; }
    }`}</style>
    <div className="sem-impressao mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3">
      <Link href="/financeiro/v12" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Voltar ao financeiro</Link>
      <button type="button" disabled={!dados || dados.status !== "FECHADA"} onClick={() => window.print()}
        className="rounded bg-purple-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
        Imprimir / Salvar como PDF
      </button>
    </div>
    <article className="folha mx-auto max-w-4xl border border-slate-200 bg-white p-8 shadow print:text-[11px]">
      {carregando && <p>Carregando o fechamento...</p>}
      {erro && <p role="alert" className="text-red-700">{erro}</p>}
      {dados && <>
        <header className="flex justify-between gap-4 border-b-2 border-purple-900 pb-4">
          <div><p className="text-sm font-bold uppercase tracking-wider text-purple-900">Digna Saúde · Digna Conect</p>
            <h1 className="mt-1 text-2xl font-bold">Relatório diário de fechamento de caixa</h1>
            <p className="mt-2 text-sm">Caixa #{dados.sessaoId} · {dados.conta} · Movimento: {dataBR(dados.dataMovimento)}</p>
          </div>
          <span className="h-fit rounded border px-3 py-1 text-xs font-bold">{dados.status === "FECHADA" ? "CAIXA FECHADO" : "CAIXA EM ABERTO"}</span>
        </header>
        <section className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div><span className="text-slate-500">Funcionário responsável pelo caixa:</span><br/><b>{dados.abertoPor}</b></div>
          <div><span className="text-slate-500">Abertura:</span><br/><b>{dataHoraBR(dados.abertoEm)}</b></div>
          <div><span className="text-slate-500">Fechamento realizado pelo titular:</span><br/><b>{dados.fechadoPor || "Pendente"}</b></div>
          <div><span className="text-slate-500">Fechamento:</span><br/><b>{dataHoraBR(dados.fechadoEm)}</b></div>
        </section>
        <h2 className="mt-7 border-b pb-2 text-lg font-semibold">Movimentações do caixa físico</h2>
        <table className="mt-2 w-full border-collapse text-left text-sm">
          <thead><tr className="border-b-2 border-slate-500 text-xs uppercase text-slate-500"><th className="py-2 pr-2">Horário</th><th className="py-2 pr-2">Origem</th><th className="py-2 pr-2">Descrição</th><th className="py-2 text-right">Entrada</th><th className="py-2 text-right">Saída</th></tr></thead>
          <tbody>{dados.movimentos.map((m) => <tr key={m.id} className="border-b border-slate-200 align-top">
            <td className="whitespace-nowrap py-2 pr-2">{dataHoraBR(m.criadoEm)}</td>
            <td className="py-2 pr-2">{m.origem.replaceAll("_", " ")}</td>
            <td className="py-2 pr-2">{m.descricao || "—"}</td>
            <td className="whitespace-nowrap py-2 text-right">{m.tipo === "ENTRADA" ? moeda(m.valor) : "—"}</td>
            <td className="whitespace-nowrap py-2 text-right">{m.tipo === "SAIDA" ? moeda(m.valor) : "—"}</td>
          </tr>)}</tbody>
        </table>
        {dados.movimentos.length === 0 && <p className="py-5 text-sm text-slate-500">Nenhuma movimentação registrada nesta sessão.</p>}
        <h2 className="mt-7 border-b pb-2 text-lg font-semibold">Conferência e encerramento</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <p>Saldo inicial contado: <b>{moeda(dados.saldoInicial)}</b></p>
          <p>Entradas: <b>{moeda(dados.entradas)}</b></p>
          <p>Saídas: <b>{moeda(dados.saidas)}</b></p>
          <p>Saldo esperado: <b>{moeda(dados.saldoFinalEsperado)}</b></p>
          <p>Saldo final contado: <b>{dados.saldoFinalContado === null ? "Pendente" : moeda(dados.saldoFinalContado)}</b></p>
          <p className="font-bold">Diferença: {dados.diferenca === null ? "Pendente" : moeda(dados.diferenca)}</p>
        </div>
        {(dados.observacaoAbertura || dados.observacaoFechamento) && <section className="mt-4 text-sm">
          {dados.observacaoAbertura && <p>Observação na abertura: {dados.observacaoAbertura}</p>}
          {dados.observacaoFechamento && <p>Observação no fechamento: {dados.observacaoFechamento}</p>}
        </section>}
        <section className="assinaturas mt-12 text-center">
          <h2 className="border-b pb-2 text-left text-lg font-semibold">Responsabilidade e assinatura</h2>
          <div className="mx-auto mt-14 w-80 max-w-full border-t border-slate-800 pt-2 text-xs">
            <b>{dados.abertoPor}</b><br/>Assinatura do funcionário responsável pelo caixa
          </div>
        </section>
        <footer className="mt-10 border-t pt-3 text-xs text-slate-500">Documento gerado a partir do caixa registrado no Digna Conect. Assinaturas manuscritas não representam assinaturas digitais.</footer>
      </>}
    </article>
  </div>;
}
