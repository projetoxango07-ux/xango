"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type Indicadores = {
  examesRealizados: number;
  aguardandoEnvio: number;
  aguardandoLaudo: number;
  aparelhosEmUso: number;
  aguardandoDescarregamento: number;
  retiradasPendentes: number;
};
type Grupo = { quantidade: number };
type DadosDashboard = {
  competencia: string;
  indicadores: Indicadores;
  porModalidade: (Grupo & { tipo: string })[];
  porClinica: (Grupo & { clinica: string })[];
  retiradas: {
    id: number;
    aparelho: string;
    tipo: string;
    paciente: string;
    clinica: string;
    retiradaPrevista: string | null;
    situacao: "EM_USO" | "RETIRADA_PENDENTE" | "AGUARDANDO_DESCARREGAMENTO";
  }[];
};

type ResumoFinanceiro = {
  competencia: string; titulosMes: string; recebidoMes: string; saldoAberto: string;
  saldoVencido: string; parcelasVencidas: number; saldoHoje: string; parcelasHoje: number; pendenciasMes: number;
};
const moeda = (v: string) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
function Quantidade({ valor }: { valor: number }) {
  return <span className="text-3xl font-bold tabular-nums text-slate-900">{valor.toLocaleString("pt-BR")}</span>;
}
function Barras({ itens, nome }: { itens: { nome: string; quantidade: number }[]; nome: string }) {
  const maximo = Math.max(1, ...itens.map((item) => item.quantidade));
  return <section className="rounded-xl border border-slate-200 bg-white p-5">
    <h3 className="text-lg font-semibold text-slate-900">{nome}</h3>
    {itens.length === 0 ? <p className="mt-4 text-sm text-slate-500">Nenhum exame nesta competência.</p> :
      <div className="mt-4 space-y-4">{itens.map((item) => <div key={item.nome}>
        <div className="mb-1 flex items-center justify-between gap-3 text-sm">
          <span className="truncate text-slate-700" title={item.nome}>{item.nome}</span>
          <span className="font-semibold tabular-nums">{item.quantidade.toLocaleString("pt-BR")}</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${(item.quantidade / maximo) * 100}%` }}/>
        </div>
      </div>)}</div>}
  </section>;
}

export default function TerceirizacaoDashboard() {
  const { temPermissao } = useAuth();
  const podeFinanceiro = temPermissao("terceirizacao.financeiro.visualizar");
  const [financeiro, setFinanceiro] = useState<ResumoFinanceiro | null>(null);
  const [erroFinanceiro, setErroFinanceiro] = useState("");
  const [carregandoFinanceiro, setCarregandoFinanceiro] = useState(false);
  const [dados, setDados] = useState<DadosDashboard | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const resposta = await fetch(`${API}/terceirizacao/dashboard`, {
        credentials: "include", cache: "no-store",
      });
      const json = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(json.erro || "Não foi possível carregar o Dashboard.");
      setDados(json as DadosDashboard);
    } catch (e) {
      setDados(null);
      setErro(e instanceof Error ? e.message : "Falha na conexão.");
    } finally { setCarregando(false); }
  }, []);

  const carregarFinanceiro = useCallback(async () => {
    if (!podeFinanceiro) return;
    setCarregandoFinanceiro(true); setErroFinanceiro("");
    try {
      const r = await fetch(`${API}/terceirizacao/financeiro/resumo`, { credentials: "include", cache: "no-store" });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.erro || "Não foi possível carregar o resumo financeiro.");
      setFinanceiro(json as ResumoFinanceiro);
    } catch (e) { setFinanceiro(null); setErroFinanceiro(e instanceof Error ? e.message : "Falha na conexão."); }
    finally { setCarregandoFinanceiro(false); }
  }, [podeFinanceiro]);
  useEffect(() => { void carregarFinanceiro(); }, [carregarFinanceiro]);
  useEffect(() => { void carregar(); }, [carregar]);
  const i = dados?.indicadores;
  const cards = [
    { titulo: "Exames no mês", valor: i?.examesRealizados, descricao: "Exames individuais, sem cancelados" },
    { titulo: "Aguardando laudo", valor: i?.aguardandoLaudo, descricao: "Exames enviados, aguardando retorno" },
    { titulo: "Aguardando envio", valor: i?.aguardandoEnvio, descricao: "Exames ainda no status Realizado" },
    { titulo: "Aparelhos em uso", valor: i?.aparelhosEmUso, descricao: "MAPA e Holter não retirados" },
    { titulo: "Retiradas pendentes", valor: i?.retiradasPendentes, descricao: "Previstas para hoje ou anteriores" },
    { titulo: "Aguardando descarregamento", valor: i?.aguardandoDescarregamento, descricao: "Retirados, ainda não liberados" },
  ];

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Dashboard da Terceirização</h2>
        <p className="mt-1 text-sm text-slate-500">Produção e equipamentos com dados reais da V3.</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="rounded-lg border border-[#E3E5E1] bg-white px-3 py-2 text-sm text-[#18383D]">
          <span className="block text-xs text-[#667A7D]">Competência atual</span>
          <strong>{(dados?.competencia || mesSaoPaulo()).split("-").reverse().join("/")}</strong>
        </div>
        <button type="button" onClick={() => { void carregar(); void carregarFinanceiro(); }} disabled={carregando || carregandoFinanceiro}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
          {carregando || carregandoFinanceiro ? "Atualizando..." : "Atualizar"}
        </button>
      </div>
    </div>

    {erro && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</div>}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => <div key={card.titulo} className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">{card.titulo}</p>
        <div className="mt-3">{carregando || card.valor === undefined ?
          <span className="text-3xl text-slate-400">—</span> : <Quantidade valor={card.valor}/>}</div>
        <p className="mt-2 text-xs text-slate-500">{card.descricao}</p>
      </div>)}
    </div>

    {podeFinanceiro && <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-lg font-semibold text-[#18383D]">Resumo financeiro</h3>
          <p className="text-sm text-slate-500">Produção, recebimentos efetivos e carteira a receber.</p></div>
        <Link href="/terceirizacao/financeiro" className="rounded-lg bg-[#087681] px-4 py-2 text-sm font-semibold text-white">Conferir recebimentos</Link>
      </div>
      {erroFinanceiro && <p role="alert" className="text-sm text-red-700">{erroFinanceiro}</p>}
      {carregandoFinanceiro && <p className="text-sm text-slate-500">Atualizando financeiro...</p>}
      {!carregandoFinanceiro && financeiro && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { nome: "Títulos da produção do mês", valor: financeiro.titulosMes, detalhe: "Repasse devido de exames da competência atual" },
            { nome: "Recebido no mês", valor: financeiro.recebidoMes, detalhe: "Data efetiva das baixas, de qualquer competência" },
            { nome: "Total em aberto", valor: financeiro.saldoAberto, detalhe: "Todas as competências, inclusive parcelas futuras" },
            { nome: "Em atraso", valor: financeiro.saldoVencido, detalhe: `${financeiro.parcelasVencidas} parcela(s) vencidas` },
          ].map(c => <div key={c.nome} className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm text-slate-600">{c.nome}</p>
            <p className="mt-2 break-words text-xl font-bold tabular-nums text-[#18383D]">{moeda(c.valor)}</p>
            <p className="mt-2 text-xs text-slate-500">{c.detalhe}</p>
          </div>)}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-200 pt-3 text-sm">
          <span>Vencem hoje: <strong>{financeiro.parcelasHoje} parcela(s) · {moeda(financeiro.saldoHoje)}</strong></span>
          <span>Exames enviados sem título (mês atual): <strong className={financeiro.pendenciasMes ? "text-amber-700" : ""}>{financeiro.pendenciasMes}</strong></span>
        </div>
        <p className="text-xs text-slate-500">Valores consideram títulos e parcelas ativos e baixas não estornadas. O total da produção não inclui exames ainda sem título.</p>
      </>}
    </section>}

    <div className="grid gap-4 lg:grid-cols-2">
      <Barras nome="Exames por modalidade" itens={(dados?.porModalidade ?? []).map((x) => ({ nome: x.tipo, quantidade: x.quantidade }))}/>
      <Barras nome="Exames por clínica" itens={(dados?.porClinica ?? []).map((x) => ({ nome: x.clinica, quantidade: x.quantidade }))}/>
    </div>

    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Aparelhos ocupados e próximas retiradas</h3>
        <Link href="/terceirizacao/equipamentos" className="text-sm font-medium text-emerald-700 hover:underline">Abrir equipamentos</Link>
      </div>
      {dados?.retiradas.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm">
        <thead className="border-b text-xs uppercase text-slate-500"><tr>
          <th className="py-3">Aparelho</th><th>Paciente</th><th>Clínica</th><th>Retirada prevista</th><th>Situação</th>
        </tr></thead>
        <tbody>{dados.retiradas.map((r) => <tr className="border-b last:border-0" key={r.id}>
          <td className="py-3 font-medium">{r.aparelho}</td><td>{r.paciente}</td><td>{r.clinica}</td>
          <td>{dataBR(r.retiradaPrevista)}</td>
          <td className={r.situacao === "RETIRADA_PENDENTE" ? "font-medium text-amber-700" : "text-slate-600"}>
            {r.situacao === "RETIRADA_PENDENTE" ? "Retirada pendente" : r.situacao === "AGUARDANDO_DESCARREGAMENTO" ? "Aguardando descarregamento" : "Em uso"}
          </td>
        </tr>)}</tbody>
      </table></div> : <p className="text-sm text-slate-500">Nenhum aparelho ocupado entre os exames produzidos neste mês.</p>}
    </section>

    <div className="flex flex-wrap gap-3 text-sm">
      <Link className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800" href="/terceirizacao/producao">Registrar produção</Link>
      <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50" href="/terceirizacao/equipamentos">Consultar retiradas</Link>
    </div>
    <p className="text-xs text-slate-500">Os indicadores operacionais e a lista de retiradas são referentes à produção do mês atual, pela data de realização. A carteira financeira inclui todas as competências; os recebimentos do mês usam a data efetiva da baixa. Para outros meses, utilize <Link className="font-semibold text-emerald-700 hover:underline" href="/terceirizacao/relatorios">Relatórios</Link>. O inventário global de aparelhos permanece disponível em Equipamentos.</p>
  </div>;
}
