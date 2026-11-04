"use client";

import Link from "next/link";
import AlertasParcelasV12 from "@/components/AlertasParcelasV12";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowLeft, ArrowLeftRight, Banknote, Building2, CheckCircle2,
  ChevronRight, CircleDollarSign, ClipboardCheck, CreditCard, HandCoins,
  Loader2, RefreshCw, Save, Wallet,
} from "lucide-react";

// A V1.2 local utiliza a mesma camada de autenticação do Portal Digna.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
const RAIZ = `${API_URL}/financeiro/v12`;

type Conta = {
  id: number; nome: string; tipo: "CAIXA" | "BANCO" | "CARTEIRA_DIGITAL" | "OUTRO";
  ativo: boolean; saldoInicial: number; saldoCalculado: number;
  responsavelCaixaId: number | null;
};
type Movimento = {
  id: number; conta: string; contaFinanceiraId: number; tipo: "ENTRADA" | "SAIDA";
  origem: string; valor: number; descricao: string | null;
  dataMovimentacao: string; registradoEm: string;
};
type Despesa = {
  id: number; descricao: string; categoria: string | null; valor: number;
  dataPagamento: string; conta: string; registradoPor: string; canceladaEm: string | null;
};
type Sessao = {
  id: number; contaFinanceiraId: number; conta: string; status: "ABERTA" | "FECHADA";
  dataMovimento: string; saldoInicialInformado: number; saldoFinalEsperado: number | null;
  saldoFinalContado: number | null; diferenca: number | null;
  abertoPor: string; fechadoPor: string | null; abertoEm: string; fechadoEm: string | null;
};
type Conferencia = {
  sessaoId: number; status: string; saldoInicial: number; entradas: number;
  saidas: number; saldoFinalEsperado: number; saldoFinalContado: number | null;
  diferenca: number | null; movimentos: Array<{ id: number; descricao: string | null; valor: number; tipo: string }>;
};
type Aba = "resumo" | "despesa" | "transferencia" | "retirada" | "caixa";

const dinheiro = (valor: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
const dataHoje = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const dataBR = (valor: string) => {
  if (!valor) return "—";
  const apenasDia = valor.slice(0, 10);
  const partes = apenasDia.split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : valor;
};

async function requisicao<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${RAIZ}${caminho}`, {
    credentials: "include", cache: "no-store", ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const conteudo: { erro?: string } & Partial<T> = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(conteudo.erro || `Falha na solicitação (${resposta.status}).`);
  return conteudo as T;
}
const enviar = (caminho: string, dados: Record<string, unknown>) =>
  requisicao<{ ok: boolean }>(caminho, { method: "POST", body: JSON.stringify(dados) });

const campoClasse = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600";
const tituloClasse = "text-sm font-medium text-slate-700";

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className={tituloClasse}>{rotulo}</span>{children}</label>;
}
function BotaoSalvar({ carregando, titulo }: { carregando: boolean; titulo: string }) {
  return <button type="submit" disabled={carregando} className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-900 disabled:opacity-60">
    {carregando ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}{titulo}
  </button>;
}
function SeletorConta({ contas, valor, alterar, somenteCaixa = false }: {
  contas: Conta[]; valor: string; alterar: (v: string) => void; somenteCaixa?: boolean;
}) {
  const opcoes = contas.filter((c) => c.ativo && (!somenteCaixa || c.tipo === "CAIXA"));
  return <select value={valor} onChange={(e) => alterar(e.target.value)} className={campoClasse} required>
    <option value="">Selecione uma conta</option>
    {opcoes.map((conta) => <option key={conta.id} value={conta.id}>{conta.nome} — {dinheiro(conta.saldoCalculado)}</option>)}
  </select>;
}

export default function GestaoFinanceiraV12() {
  const [aba, setAba] = useState<Aba>("resumo");
  const [contas, setContas] = useState<Conta[]>([]);
  const [podeVerBanco, setPodeVerBanco] = useState(false);
  const [podeOperar, setPodeOperar] = useState(false);
  const [minhaContaCaixaId, setMinhaContaCaixaId] = useState<number | null>(null);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [contaDespesa, setContaDespesa] = useState("");
  const [valorDespesa, setValorDespesa] = useState("");
  const [descricaoDespesa, setDescricaoDespesa] = useState("");
  const [categoriaDespesa, setCategoriaDespesa] = useState("");
  const [dataDespesa, setDataDespesa] = useState(dataHoje);
  const [documentoDespesa, setDocumentoDespesa] = useState("");

  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [valorTransferencia, setValorTransferencia] = useState("");
  const [tipoTransferencia, setTipoTransferencia] = useState<"ENTRE_CONTAS" | "DEPOSITO">("ENTRE_CONTAS");
  const [dataTransferencia, setDataTransferencia] = useState(dataHoje);
  const [descricaoTransferencia, setDescricaoTransferencia] = useState("");

  const [contaRetirada, setContaRetirada] = useState("");
  const [socio, setSocio] = useState("");
  const [tipoRetirada, setTipoRetirada] = useState("PRO_LABORE");
  const [valorRetirada, setValorRetirada] = useState("");
  const [dataRetirada, setDataRetirada] = useState(dataHoje);
  const [observacaoRetirada, setObservacaoRetirada] = useState("");

  const [caixaSelecionado, setCaixaSelecionado] = useState("");
  const [saldoAbertura, setSaldoAbertura] = useState("");
  const [observacaoAbertura, setObservacaoAbertura] = useState("");
  const [saldoContado, setSaldoContado] = useState("");
  const [observacaoFechamento, setObservacaoFechamento] = useState("");
  const [conferencia, setConferencia] = useState<Conferencia | null>(null);

  const atualizar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const [c, m, d, s] = await Promise.all([
        requisicao<{ contas: Conta[]; podeVerSaldoBancario: boolean; podeOperar: boolean;
          minhaContaCaixaId: number | null }>("/contas"),
        requisicao<{ movimentacoes: Movimento[] }>("/movimentacoes?limite=50"),
        requisicao<{ despesas: Despesa[] }>("/despesas"),
        requisicao<{ sessoes: Sessao[] }>("/caixas"),
      ]);
      setContas(c.contas);
      setSaldoAbertura((atual) => atual || String(c.contas.find((conta) => conta.id === c.minhaContaCaixaId)?.saldoCalculado ?? 0).replace(".", ","));
      setPodeVerBanco(c.podeVerSaldoBancario === true);
      setPodeOperar(c.podeOperar === true);
      setMinhaContaCaixaId(c.minhaContaCaixaId ?? null);
      setMovimentos(m.movimentacoes); setDespesas(d.despesas); setSessoes(s.sessoes);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível carregar o financeiro."); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void atualizar(); }, [atualizar]);

  const totais = useMemo(() => ({
    geral: contas.reduce((t, c) => t + c.saldoCalculado, 0),
    caixa: contas.filter((c) => c.tipo === "CAIXA").reduce((t, c) => t + c.saldoCalculado, 0),
    banco: contas.filter((c) => c.tipo === "BANCO" || c.tipo === "CARTEIRA_DIGITAL").reduce((t, c) => t + c.saldoCalculado, 0),
    despesas: despesas.filter((d) => !d.canceladaEm).reduce((t, d) => t + d.valor, 0),
  }), [contas, despesas]);

  async function realizar(acao: () => Promise<unknown>, sucesso: string) {
    setSalvando(true); setMensagem(""); setErro("");
    try {
      await acao(); setMensagem(sucesso); await atualizar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível concluir a operação."); }
    finally { setSalvando(false); }
  }
  async function abrirConferencia(id: number) {
    setErro("");
    try { setConferencia(await requisicao<Conferencia>(`/caixas/${id}/conferencia`)); }
    catch (e) { setErro(e instanceof Error ? e.message : "Erro ao conferir caixa."); }
  }

  const abasDisponiveis: Array<{ id: Aba; rotulo: string; icone: React.ReactNode }> = [
    { id: "resumo", rotulo: "Visão geral", icone: <Wallet size={16} /> },
    { id: "despesa", rotulo: "Lançar despesa", icone: <Banknote size={16} /> },
    { id: "transferencia", rotulo: "Transferir / depositar", icone: <ArrowLeftRight size={16} /> },
    { id: "retirada", rotulo: "Retirada de sócio", icone: <HandCoins size={16} /> },
    { id: "caixa", rotulo: "Abrir / fechar caixa", icone: <ClipboardCheck size={16} /> },
  ];
  const abas = abasDisponiveis.filter((item) => podeOperar || item.id === "resumo" || item.id === "caixa");

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <Link href="/financeiro" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-purple-800 hover:underline"><ArrowLeft size={15} /> Financeiro</Link>
        <h1 className="text-2xl font-bold text-slate-900">Gestão financeira — V1.2</h1>
        <p className="mt-1 text-sm text-slate-500">Despesas, contas próprias, depósitos, retiradas e conferência de caixa.</p>
      </div>
      <div className="flex items-center gap-2">
        {podeVerBanco && <Link href="/financeiro" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cadastrar contas</Link>}
        <button type="button" disabled={carregando || salvando} onClick={() => void atualizar()} className="inline-flex items-center gap-2 rounded-lg border border-purple-200 px-4 py-2.5 text-sm font-semibold text-purple-800 hover:bg-purple-50 disabled:opacity-50"><RefreshCw size={16} className={carregando ? "animate-spin" : ""} /> Atualizar</button>
      </div>
    </div>

    {erro && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle size={18} className="mt-0.5 shrink-0" />{erro}</div>}
    {mensagem && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={18} />{mensagem}</div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ...(podeVerBanco ? [{ titulo: "Saldo entre contas", valor: totais.geral, icone: <CircleDollarSign size={21} /> }] : []),
        { titulo: "Dinheiro em caixa", valor: totais.caixa, icone: <Wallet size={21} /> },
        ...(podeVerBanco ? [{ titulo: "Contas bancárias / digitais", valor: totais.banco, icone: <Building2 size={21} /> }] : []),
        { titulo: "Despesas registradas", valor: totais.despesas, icone: <CreditCard size={21} /> },
      ].map((c) => <div key={c.titulo} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm text-slate-500"><span>{c.titulo}</span><span className="text-purple-700">{c.icone}</span></div>
        <div className="mt-2 text-xl font-bold text-slate-900">{carregando ? "..." : dinheiro(c.valor)}</div>
      </div>)}
    </div>

    <AlertasParcelasV12 />

    {contas.length === 0 && !carregando && <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="font-semibold">Primeiro cadastre suas contas financeiras.</p>
      <p className="mt-1">{podeVerBanco ? "Cadastre ao menos um Caixa físico e uma Conta bancária no menu Financeiro." : "Solicite ao administrador que cadastre um caixa físico."}</p>
      {podeVerBanco && <Link href="/financeiro" className="mt-3 inline-flex items-center gap-1 font-semibold underline">Abrir cadastro de contas <ChevronRight size={15} /></Link>}
    </div>}

    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
      {abas.map((item) => <button key={item.id} type="button" onClick={() => { setAba(item.id); setMensagem(""); setErro(""); }}
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${aba === item.id ? "bg-purple-800 text-white" : "text-slate-700 hover:bg-slate-100"}`}>{item.icone}{item.rotulo}</button>)}
    </div>

    {aba === "resumo" && <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Contas e saldos registrados</h2>
        {contas.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nenhuma conta cadastrada.</p> :
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{contas.map((c) => <div key={c.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex justify-between gap-3"><span className="text-sm font-semibold text-slate-800">{c.nome}</span><span className={`text-xs ${c.ativo ? "text-emerald-600" : "text-slate-400"}`}>{c.ativo ? "Ativa" : "Inativa"}</span></div>
            <p className="mt-1 text-xs text-slate-500">{c.tipo.replaceAll("_", " ")}</p><p className="mt-3 text-lg font-bold text-slate-900">{dinheiro(c.saldoCalculado)}</p>
          </div>)}</div>}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Últimas movimentações</h2>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs text-slate-500"><th className="p-3">Data</th><th className="p-3">Conta</th><th className="p-3">Descrição</th><th className="p-3 text-right">Valor</th></tr></thead>
          <tbody>{movimentos.map((m) => <tr key={m.id} className="border-b border-slate-100"><td className="whitespace-nowrap p-3">{dataBR(m.dataMovimentacao)}</td><td className="p-3">{m.conta}</td><td className="p-3">{m.descricao || m.origem}</td><td className={`whitespace-nowrap p-3 text-right font-semibold ${m.tipo === "ENTRADA" ? "text-emerald-700" : "text-red-700"}`}>{m.tipo === "ENTRADA" ? "+" : "−"}{dinheiro(m.valor)}</td></tr>)}
          {movimentos.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">Nenhuma movimentação registrada.</td></tr>}</tbody>
        </table></div>
      </section>
    </div>}

    {aba === "despesa" && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">Lançar despesa da empresa</h2><p className="mt-1 text-sm text-slate-500">A saída será registrada na conta escolhida. Para dinheiro físico, abra o caixa antes.</p>
      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void realizar(() => enviar("/despesas", {
        contaFinanceiraId: Number(contaDespesa), valor: valorDespesa, descricao: descricaoDespesa,
        categoria: categoriaDespesa, dataPagamento: dataDespesa, documentoReferencia: documentoDespesa,
      }), "Despesa registrada com sucesso."); }}>
        <Campo rotulo="Conta de saída"><SeletorConta contas={contas} valor={contaDespesa} alterar={setContaDespesa} /></Campo>
        <Campo rotulo="Valor da despesa (R$)"><input required className={campoClasse} inputMode="decimal" value={valorDespesa} onChange={(e) => setValorDespesa(e.target.value)} placeholder="Ex.: 50,00" /></Campo>
        <Campo rotulo="Descrição"><input required maxLength={240} className={campoClasse} value={descricaoDespesa} onChange={(e) => setDescricaoDespesa(e.target.value)} placeholder="Ex.: Material de limpeza" /></Campo>
        <Campo rotulo="Categoria"><input maxLength={100} className={campoClasse} value={categoriaDespesa} onChange={(e) => setCategoriaDespesa(e.target.value)} placeholder="Ex.: Materiais" /></Campo>
        <Campo rotulo="Data do pagamento"><input type="date" required className={campoClasse} value={dataDespesa} onChange={(e) => setDataDespesa(e.target.value)} /></Campo>
        <Campo rotulo="Documento / nota (opcional)"><input maxLength={120} className={campoClasse} value={documentoDespesa} onChange={(e) => setDocumentoDespesa(e.target.value)} /></Campo>
        <div className="md:col-span-2"><BotaoSalvar carregando={salvando} titulo="Registrar despesa" /></div>
      </form>
      <h3 className="mt-8 font-bold text-slate-900">Despesas recentes</h3><div className="mt-3 space-y-2">{despesas.slice(0, 10).map((d) => <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm"><div><b>{d.descricao}</b><p className="text-xs text-slate-500">{d.conta} · {dataBR(d.dataPagamento)} · {d.registradoPor}</p></div><span className="font-semibold text-red-700">{dinheiro(d.valor)}</span></div>)}{despesas.length === 0 && <p className="text-sm text-slate-500">Nenhuma despesa cadastrada.</p>}</div>
    </section>}

    {aba === "transferencia" && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">Transferência entre contas próprias</h2><p className="mt-1 text-sm text-slate-500">O sistema registra uma saída e uma entrada. Isso não aumenta o faturamento da Digna.</p>
      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (origem === destino) { setErro("Escolha contas diferentes."); return; }
        void realizar(() => enviar("/transferencias", { contaOrigemId: Number(origem), contaDestinoId: Number(destino),
          natureza: tipoTransferencia, valor: valorTransferencia, dataEfetiva: dataTransferencia, descricao: descricaoTransferencia,
        }), "Transferência registrada nas duas contas."); }}>
        <Campo rotulo="Operação"><select className={campoClasse} value={tipoTransferencia} onChange={(e) => setTipoTransferencia(e.target.value as "DEPOSITO" | "ENTRE_CONTAS")}><option value="ENTRE_CONTAS">Transferência entre contas</option><option value="DEPOSITO">Depósito do caixa no banco</option></select></Campo>
        <Campo rotulo="Valor (R$)"><input required inputMode="decimal" className={campoClasse} value={valorTransferencia} onChange={(e) => setValorTransferencia(e.target.value)} placeholder="Ex.: 300,00" /></Campo>
        <Campo rotulo="Conta de origem"><SeletorConta contas={contas.filter((c) => tipoTransferencia !== "DEPOSITO" || c.tipo === "CAIXA")} valor={origem} alterar={setOrigem} /></Campo>
        <Campo rotulo="Conta de destino"><SeletorConta contas={contas.filter((c) => c.id !== Number(origem) && (tipoTransferencia !== "DEPOSITO" || ["BANCO", "CARTEIRA_DIGITAL"].includes(c.tipo)))} valor={destino} alterar={setDestino} /></Campo>
        <Campo rotulo="Data efetiva"><input required type="date" className={campoClasse} value={dataTransferencia} onChange={(e) => setDataTransferencia(e.target.value)} /></Campo>
        <Campo rotulo="Descrição (opcional)"><input maxLength={240} className={campoClasse} value={descricaoTransferencia} onChange={(e) => setDescricaoTransferencia(e.target.value)} /></Campo>
        <div className="md:col-span-2"><BotaoSalvar carregando={salvando} titulo={tipoTransferencia === "DEPOSITO" ? "Registrar depósito" : "Registrar transferência"} /></div>
      </form>
    </section>}

    {aba === "retirada" && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">Retirada de sócio</h2><p className="mt-1 text-sm text-slate-500">Operação disponível apenas para administrador. Pró-labore e distribuição de lucros possuem classificações próprias.</p>
      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void realizar(() => enviar("/retiradas-socio", {
        contaFinanceiraId: Number(contaRetirada), socioNome: socio, tipo: tipoRetirada,
        valor: valorRetirada, dataEfetiva: dataRetirada, observacao: observacaoRetirada,
      }), "Retirada registrada com sucesso."); }}>
        <Campo rotulo="Sócio beneficiário"><input required maxLength={160} className={campoClasse} value={socio} onChange={(e) => setSocio(e.target.value)} /></Campo>
        <Campo rotulo="Tipo de retirada"><select className={campoClasse} value={tipoRetirada} onChange={(e) => setTipoRetirada(e.target.value)}><option value="PRO_LABORE">Pró-labore</option><option value="DISTRIBUICAO_LUCROS">Distribuição de lucros</option><option value="ADIANTAMENTO">Adiantamento</option><option value="OUTRA">Outra retirada</option></select></Campo>
        <Campo rotulo="Conta de saída"><SeletorConta contas={contas} valor={contaRetirada} alterar={setContaRetirada} /></Campo>
        <Campo rotulo="Valor (R$)"><input required inputMode="decimal" className={campoClasse} value={valorRetirada} onChange={(e) => setValorRetirada(e.target.value)} /></Campo>
        <Campo rotulo="Data efetiva"><input required type="date" className={campoClasse} value={dataRetirada} onChange={(e) => setDataRetirada(e.target.value)} /></Campo>
        <Campo rotulo="Observações"><input maxLength={1000} className={campoClasse} value={observacaoRetirada} onChange={(e) => setObservacaoRetirada(e.target.value)} /></Campo>
        <div className="md:col-span-2"><BotaoSalvar carregando={salvando} titulo="Registrar retirada" /></div>
      </form>
    </section>}

    {aba === "caixa" && <section className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Abertura do meu caixa</h2><p className="mt-1 text-sm text-slate-500">Cada funcionário é responsável por abrir e fechar seu próprio caixa. A conta individual é criada automaticamente no primeiro uso.</p>
        {podeOperar && <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void realizar(() => enviar("/caixas/abrir", {
          saldoInicialInformado: saldoAbertura, observacaoAbertura,
        }), "Caixa aberto com sucesso."); }}>
          <div className="rounded-lg bg-purple-50 px-3 py-2.5 text-sm text-purple-900">
            <b>Meu caixa:</b> {contas.find((c) => c.id === minhaContaCaixaId)?.nome || "Será criado no primeiro uso"}
            <p className="mt-1 text-xs">Saldo registrado: {dinheiro(contas.find((c) => c.id === minhaContaCaixaId)?.saldoCalculado || 0)}</p>
          </div>
          <Campo rotulo="Saldo inicial contado (R$)"><input required inputMode="decimal" className={campoClasse} placeholder="0,00" value={saldoAbertura} onChange={(e) => setSaldoAbertura(e.target.value)} /></Campo>
          <div className="md:col-span-2"><Campo rotulo="Observação (opcional)"><input maxLength={500} className={campoClasse} value={observacaoAbertura} onChange={(e) => setObservacaoAbertura(e.target.value)} /></Campo></div>
          <div className="md:col-span-2"><BotaoSalvar carregando={salvando} titulo="Abrir caixa" /></div>
        </form>}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Caixas registrados</h2>
        {sessoes.length === 0 && <p className="mt-3 text-sm text-slate-500">Nenhuma abertura registrada.</p>}
        <div className="mt-3 space-y-3">{sessoes.map((s) => <div key={s.id} className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap justify-between gap-2"><div><span className="font-semibold">{s.conta}</span><span className="ml-2 text-xs text-slate-500">{dataBR(s.dataMovimento)}</span></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${s.status === "ABERTA" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{s.status === "ABERTA" ? "Aberto" : "Fechado"}</span></div>
          <p className="mt-1 text-xs text-slate-500">Responsável: {s.abertoPor} · Saldo inicial {dinheiro(s.saldoInicialInformado)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" className="rounded-lg border border-purple-300 px-3 py-2 text-sm font-semibold text-purple-800 hover:bg-purple-50" onClick={() => { setCaixaSelecionado(String(s.contaFinanceiraId)); void abrirConferencia(s.id); }}>Conferir movimentos</button>
            {s.status === "FECHADA" && <Link href={`/financeiro/v12/caixas/${s.id}/impressao`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100">Imprimir / Salvar PDF</Link>}
            {s.status === "FECHADA" && <span className="text-sm text-slate-600">Contado: {dinheiro(s.saldoFinalContado || 0)} · Diferença: {dinheiro(s.diferenca || 0)}</span>}</div>
          {conferencia?.sessaoId === s.id && <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm"><div className="grid gap-2 sm:grid-cols-4"><span>Saldo inicial: <b>{dinheiro(conferencia.saldoInicial)}</b></span><span>Entradas: <b>{dinheiro(conferencia.entradas)}</b></span><span>Saídas: <b>{dinheiro(conferencia.saidas)}</b></span><span>Saldo esperado: <b>{dinheiro(conferencia.saldoFinalEsperado)}</b></span></div>
            {podeOperar && s.status === "ABERTA" && s.contaFinanceiraId === minhaContaCaixaId && <form className="mt-4 space-y-3 border-t border-slate-200 pt-4" onSubmit={(e) => { e.preventDefault();
              void realizar(() => enviar(`/caixas/${s.id}/fechar`, { saldoFinalContado: saldoContado, observacaoFechamento }), "Caixa fechado e conferido."); }}>
              <div className="grid gap-3 md:grid-cols-2"><Campo rotulo="Valor contado no caixa (R$)"><input required className={campoClasse} inputMode="decimal" value={saldoContado} onChange={(e) => setSaldoContado(e.target.value)} /></Campo><Campo rotulo="Observação do fechamento"><input className={campoClasse} maxLength={500} value={observacaoFechamento} onChange={(e) => setObservacaoFechamento(e.target.value)} /></Campo></div>
              <BotaoSalvar carregando={salvando} titulo="Confirmar fechamento" />
            </form>}
          </div>}
        </div>)}</div>
      </div>
    </section>}
    <p className="text-xs text-slate-500">Ambiente de desenvolvimento V1.2. Os registros são gravados no banco local configurado; não representam lançamentos de produção.</p>
  </div>;
}
