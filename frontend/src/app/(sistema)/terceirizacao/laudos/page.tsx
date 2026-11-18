"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import PortalV3LaudosLote from "@/components/PortalV3LaudosLote";
import PortalV3PrazosLaudos from "@/components/PortalV3PrazosLaudos";
import { podeSelecionarLaudoV3, type AcaoLoteV3 } from "@/lib/laudosLoteV3";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
const campo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none";
type Status = "REALIZADO" | "ENVIADO_LAUDO" | "LAUDO_RECEBIDO" | "ENTREGUE" | "CANCELADO";
type Registro = {
  id: number; codigoInterno: string; tipoExame: string; status: Status; executadoPorId: number;
  laudoTelemedicina: string | null;
  laudoObservacoes: string | null; laudoEnviadoEm: string | null; laudoRecebidoEm: string | null;
  laudoEntregueEm: string | null; laudoMeioEntrega: string | null; laudoReferenciaEntrega: string | null;
  laudoPrevisaoOriginal: string | null; laudoPrevisaoEntrega: string | null;
  laudoUnidadeEntregaId: number | null; laudoUnidadeEntrega: { id: number; nome: string } | null;
  laudoConvenio: string | null; laudoCategoriaAtendimento: string | null;
  laudoFormaPagamento: string | null; financeiroPendenciaV3: string | null;
  producao: { id: number; nomePacienteDigitado: string; dataRealizacao: string; pacienteId: number | null;
    paciente: { id: number; nome: string; cpf: string | null; dataNascimento: string | null } | null;
    clinica: { id: number; nome: string }; unidadeClinica: { id: number; nome: string } | null };
  usoEquipamento: { retiradoEm: string | null; descarregadoEm: string | null } | null;
  eventosLaudo: { id: number; acao: string; detalhes: string | null; ocorridoEm: string; usuario: { nome: string } }[];
};
type ParametrosV3 = {
  clinicas: { id: number; nome: string; unidades: { id: number; nome: string }[] }[];
  configuracoes: { clinicaId: number; tipoExame: string; prazoDias: number;
    marcoPrazo: "REALIZACAO" | "ENVIO"; diasVencimento: number;
    convenios: string[]; formasPagamento: string[] }[];
};
function hojeSP() {
  const partes = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}
function adicionarDias(data: string, dias: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return "";
  return new Date(Date.parse(`${data}T00:00:00.000Z`) + dias * 86400000).toISOString().slice(0, 10);
}
function adicionarMeses(data: string, meses: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return "";
  const [ano, mes, dia] = data.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes + meses, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes - 1 + meses, Math.min(dia, ultimoDia))).toISOString().slice(0, 10);
}
function dinheiroBR(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
type CadastroEncontrado = { id: number; nome: string; cpf: string | null; dataNascimento: string | null };
const rotulos: Record<Status, string> = {
  REALIZADO: "Aguardando envio", ENVIADO_LAUDO: "Aguardando laudo", LAUDO_RECEBIDO: "Aguardando entrega",
  ENTREGUE: "Entregue", CANCELADO: "Cancelado",
};
function dataCurta(valor: string | null) {
  if (!valor) return "—";
  const parte = valor.slice(0, 10).split("-");
  return parte.length === 3 ? `${parte[2]}/${parte[1]}/${parte[0]}` : valor;
}
function dataHora(valor: string | null) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(valor));
}

export default function LaudosTerceirizacaoPage() {
  const { usuario, temPermissao } = useAuth();
  const podeEditar = temPermissao("terceirizacao.laudos.editar");
  const podeAdministrar = temPermissao("terceirizacao.configuracoes.editar");
  const [lista, setLista] = useState<Registro[]>([]);
  const [competencia, setCompetencia] = useState("");
  const [mesConsulta, setMesConsulta] = useState("");
  const [versaoPrazos, setVersaoPrazos] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [busca, setBusca] = useState("");
  useEffect(() => { const q = new URLSearchParams(window.location.search);
    const termo=q.get("busca"), mes=q.get("mes");
    if(mes && /^20\d{2}-(0[1-9]|1[0-2])$/.test(mes)) setMesConsulta(mes);
    if (termo) { setBusca(termo.slice(0,80)); setFiltro("TODOS"); }
  }, []);
  const [filtro, setFiltro] = useState<"TODOS" | Status>("REALIZADO");
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [idsLote, setIdsLote] = useState<number[]>([]);
  const [loteAberto, setLoteAberto] = useState(false);
  const [telemedicina, setTelemedicina] = useState("");
  const [parametros, setParametros] = useState<ParametrosV3>({ clinicas: [], configuracoes: [] });
  const [convenio, setConvenio] = useState("");
  const [categoriaAtendimento, setCategoriaAtendimento] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(1);
  const [vencimentosPersonalizados, setVencimentosPersonalizados] = useState<string[]>([]);
  const [estimativaFinanceira, setEstimativaFinanceira] = useState<{ calculavel: boolean; mensagem: string;
    metodo?: string; valorCobradoContratado?: string | null; percentual?: string | null; valorDevido?: string } | null>(null);
  const [unidadeEntregaId, setUnidadeEntregaId] = useState("");
  const [previsaoEntrega, setPrevisaoEntrega] = useState("");
  const [motivoAjustePrevisao, setMotivoAjustePrevisao] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [nomeCadastro, setNomeCadastro] = useState("");
  const [cpfCadastro, setCpfCadastro] = useState("");
  const [pacienteEscolhidoId, setPacienteEscolhidoId] = useState<number | null>(null);
  const [candidatos, setCandidatos] = useState<CadastroEncontrado[]>([]);
  const [conferiuIdentidade, setConferiuIdentidade] = useState(false);
  const [buscandoPaciente, setBuscandoPaciente] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [conferidos, setConferidos] = useState(false);
  const [meioEntrega, setMeioEntrega] = useState("EMAIL");
  const [referencia, setReferencia] = useState("");
  const [protocoloConferido, setProtocoloConferido] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [cancelamentoExternoConferido, setCancelamentoExternoConferido] = useState(false);

  const carregar = useCallback(async () => {
    const url = `${API}/terceirizacao/laudos${mesConsulta ? `?mes=${encodeURIComponent(mesConsulta)}` : ""}`;
    const resposta = await fetch(url, { credentials: "include", cache: "no-store" });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || "Não foi possível carregar os laudos.");
    setLista(dados.exames ?? []);
    setCompetencia(dados.competencia || "");
    setVersaoPrazos((n) => n + 1);
  }, [mesConsulta]);
  useEffect(() => {
    fetch(`${API}/terceirizacao/laudos/parametros`, { credentials: "include", cache: "no-store" })
      .then(async (r) => { const dados = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(dados.erro || "Falha ao carregar parametros de laudos.");
        setParametros({ clinicas: dados.clinicas ?? [], configuracoes: dados.configuracoes ?? [] }); })
      .catch((e) => setErro(e instanceof Error ? e.message : "Falha nos parametros de laudos."));
  }, []);
  useEffect(() => {
    let ativo = true;
    carregar().catch((e) => { if (ativo) setErro(e instanceof Error ? e.message : "Falha de conexão."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [carregar]);

  const totais = useMemo(() => ({
    REALIZADO: lista.filter((e) => e.status === "REALIZADO").length,
    ENVIADO_LAUDO: lista.filter((e) => e.status === "ENVIADO_LAUDO").length,
    LAUDO_RECEBIDO: lista.filter((e) => e.status === "LAUDO_RECEBIDO").length,
    ENTREGUE: lista.filter((e) => e.status === "ENTREGUE").length,
  }), [lista]);
  const filtrados = useMemo(() => lista.filter((e) =>
    (filtro === "TODOS" || e.status === filtro) &&
    `${e.producao.nomePacienteDigitado} ${e.producao.clinica.nome} ${e.tipoExame} ${e.codigoInterno}`
      .toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR").trim())
  ), [lista, filtro, busca]);
  const acaoLote: AcaoLoteV3 | null = filtro === "REALIZADO" ? "enviar" : filtro === "ENVIADO_LAUDO" ? "receber" : filtro === "LAUDO_RECEBIDO" ? "entregar" : null;
  const elegiveis = acaoLote && podeEditar && usuario ? filtrados.filter(e => podeSelecionarLaudoV3(e, acaoLote, usuario.id, podeAdministrar)) : [];
  const examesLote = elegiveis.filter(e => idsLote.includes(e.id));
  const todosMarcados = elegiveis.length > 0 && examesLote.length === elegiveis.length;
  function limparLote() { setIdsLote([]); setLoteAberto(false); }
  function mudarFiltro(v: "TODOS" | Status) { setFiltro(v); setSelecionado(null); limparLote(); }
  function abrirPendencia(dataRealizacao: string, status: Status, codigo: string) {
    setSelecionado(null); limparLote(); setErro(""); setSucesso("");
    setMesConsulta(dataRealizacao.slice(0, 7)); setFiltro(status); setBusca(codigo);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function marcarLote(id: number, marcado: boolean) { setLoteAberto(false); setSelecionado(null); setIdsLote(prev => marcado ? [...new Set([...prev,id])] : prev.filter(x => x !== id)); }
  async function concluirLote(mensagem: string, falhas: string) {
    limparLote(); setSucesso(mensagem); setErro(falhas);
    try { await carregar(); } catch { setLista([]); setErro((falhas ? falhas + " | " : "") + "Não foi possível atualizar a lista. Clique em Atualizar antes de repetir a operação."); }
  }
  const atual = lista.find((e) => e.id === selecionado) || null;
  const configAtual = parametros.configuracoes.find((c) => c.clinicaId === atual?.producao.clinica.id && c.tipoExame === atual?.tipoExame);
  const unidadesAtuais = parametros.clinicas.find((c) => c.id === atual?.producao.clinica.id)?.unidades ?? [];
  const previsaoPadrao = atual && configAtual
    ? adicionarDias(configAtual.marcoPrazo === "ENVIO" ? hojeSP() : atual.producao.dataRealizacao.slice(0, 10), configAtual.prazoDias)
    : "";
  const previsaoEscolhida = previsaoEntrega || previsaoPadrao;
  const alterouPrevisao = Boolean(previsaoPadrao && previsaoEscolhida && previsaoPadrao !== previsaoEscolhida);
  const permiteParcelar = /FATURAMENTO|PARCELAD|BOLETO/i.test(formaPagamento);
  const vencimentoInicial = atual && configAtual
    ? adicionarDias(atual.producao.dataRealizacao.slice(0, 10), configAtual.diasVencimento) : "";
  const vencimentosParcelas = Array.from({ length: quantidadeParcelas }, (_, i) =>
    vencimentosPersonalizados[i] || adicionarMeses(vencimentoInicial, i));
  const centavosRepasse = estimativaFinanceira?.calculavel
    ? Math.round(Number(estimativaFinanceira.valorDevido) * 100) : 0;
  const centavosPorParcela = Math.floor(centavosRepasse / quantidadeParcelas);
  const restoParcelamento = centavosRepasse % quantidadeParcelas;

  useEffect(() => {
    if (!atual || atual.status !== "REALIZADO") { setEstimativaFinanceira(null); return; }
    const controle = new AbortController();
    setEstimativaFinanceira(null);
    const query = new URLSearchParams({ convenio, categoriaAtendimento });
    fetch(`${API}/terceirizacao/laudos/${atual.id}/valor-contratado?${query.toString()}`, {
      credentials: "include", cache: "no-store", signal: controle.signal,
    }).then(async (r) => {
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(dados.erro || "Não foi possível calcular o repasse.");
      return dados;
    }).then(setEstimativaFinanceira).catch((e) => {
      if (!controle.signal.aborted) setEstimativaFinanceira({ calculavel: false, mensagem: e instanceof Error ? e.message : "Erro de cálculo." });
    });
    return () => controle.abort();
  }, [atual?.id, atual?.status, convenio, categoriaAtendimento]);

  function abrir(exame: Registro) {
    limparLote();
    setSelecionado(exame.id);
    setTelemedicina(exame.laudoTelemedicina || "");
    setConvenio(exame.laudoConvenio || "");
    setCategoriaAtendimento(exame.laudoCategoriaAtendimento || "");
    setFormaPagamento(exame.laudoFormaPagamento || "");
    setQuantidadeParcelas(1);
    setVencimentosPersonalizados([]);
    setEstimativaFinanceira(null);
    setUnidadeEntregaId(String(exame.laudoUnidadeEntregaId || exame.producao.unidadeClinica?.id || ""));
    setPrevisaoEntrega(exame.laudoPrevisaoEntrega?.slice(0, 10) || "");
    setMotivoAjustePrevisao("");
    setNomeCadastro(exame.producao.paciente?.nome || exame.producao.nomePacienteDigitado);
    setNascimento(exame.producao.paciente?.dataNascimento?.slice(0, 10) || "");
    setCpfCadastro(exame.producao.paciente?.cpf || "");
    setPacienteEscolhidoId(exame.producao.pacienteId);
    setCandidatos([]);
    setConferiuIdentidade(false);
    setObservacoes(exame.laudoObservacoes || "");
    setConferidos(false);
    setMeioEntrega("EMAIL");
    setReferencia("");
    setProtocoloConferido(false);
    setErro(""); setSucesso("");
  }
  async function buscarCadastro() {
    setBuscandoPaciente(true); setErro("");
    try {
      const termo = cpfCadastro.replace(/\D/g, "").length === 11 ? cpfCadastro.replace(/\D/g, "") : nomeCadastro.trim();
      if (termo.length < 3) throw new Error("Informe nome ou CPF para pesquisar.");
      const resposta = await fetch(`${API}/terceirizacao/laudos/buscar-pacientes?busca=${encodeURIComponent(termo)}`, { credentials: "include" });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.erro || "Falha na pesquisa de pacientes.");
      setCandidatos(dados.pacientes || []);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha na pesquisa."); }
    finally { setBuscandoPaciente(false); }
  }
  async function salvarCadastro() {
    if (!atual) return;
    setSalvando(true); setErro(""); setSucesso("");
    try {
      const resposta = await fetch(`${API}/terceirizacao/laudos/${atual.id}/cadastro`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nomeCadastro, cpf: cpfCadastro, dataNascimento: nascimento || null,
          pacienteId: pacienteEscolhidoId, criarNovo: !pacienteEscolhidoId, identidadeConferida: conferiuIdentidade }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível salvar o cadastro.");
      setSucesso(dados.mensagem || "Cadastro confirmado.");
      setCandidatos([]);
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha na comunicação."); }
    finally { setSalvando(false); }
  }
  async function cancelarExame() {
    if (!atual || !podeAdministrar || salvando || motivoCancelamento.trim().length < 10) return;
    if (!window.confirm("Cancelar este exame e o titulo em aberto? A operacao sera auditada e nao pode ser desfeita nesta tela.")) return;
    setSalvando(true); setErro(""); setSucesso("");
    try {
      const r = await fetch(`${API}/terceirizacao/laudos/${atual.id}/cancelar`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivoCancelamento, confirmouCancelamentoExterno: cancelamentoExternoConferido }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || "Nao foi possivel cancelar o exame.");
      setSucesso(j.mensagem || "Exame cancelado."); setSelecionado(null); setMotivoCancelamento("");
      await carregar(); // O carregamento tambem atualiza a versao dos alertas de prazos.
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha no cancelamento."); }
    finally { setSalvando(false); }
  }
  async function executar(acao: "enviar" | "receber" | "entregar" | "previsao") {
    if (!atual) return;
    setSalvando(true); setErro(""); setSucesso("");
    try {
      const payload = acao === "enviar" ? {
        telemedicina, observacoes, dadosConferidos: conferidos,
        convenio, categoriaAtendimento, formaPagamento,
        quantidadeParcelas: permiteParcelar ? quantidadeParcelas : 1,
        vencimentosParcelas: permiteParcelar ? vencimentosParcelas : vencimentosParcelas.slice(0, 1),
        unidadeEntregaId: unidadeEntregaId ? Number(unidadeEntregaId) : null,
        previsaoEntrega: previsaoEscolhida, motivoAjustePrevisao,
      } : acao === "entregar" ? { meioEntrega, referenciaEntrega: referencia, protocoloConferido }
        : acao === "previsao" ? { previsaoEntrega: previsaoEscolhida,
          unidadeEntregaId: unidadeEntregaId ? Number(unidadeEntregaId) : null,
          motivo: motivoAjustePrevisao } : {};
      const resposta = await fetch(`${API}/terceirizacao/laudos/${atual.id}/${acao}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível registrar a etapa.");
      setSucesso(dados.mensagem || "Etapa registrada com sucesso.");
      setSelecionado(null);
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha na comunicação com a API."); }
    finally { setSalvando(false); }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-semibold text-slate-900">Controle de laudos</h2>
        <p className="mt-1 text-sm text-slate-500">Exames da competência {competencia ? `(${competencia.split("-").reverse().join("/")})` : ""}. Os alertas de prazo abaixo incluem pendências de todos os meses.</p></div>
      <Link href="/terceirizacao/producao" className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">Abrir Produção</Link>
    </div>
    {erro && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div>}
    {sucesso && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{sucesso}</div>}
    <PortalV3PrazosLaudos api={API} versao={versaoPrazos} aoAbrir={abrirPendencia} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {(["REALIZADO", "ENVIADO_LAUDO", "LAUDO_RECEBIDO", "ENTREGUE"] as const).map((s) =>
        <button type="button" key={s} disabled={salvando} onClick={() => mudarFiltro(s)}
          className={`rounded-xl border bg-white p-4 text-left ${filtro === s ? "border-emerald-600 ring-1 ring-emerald-600" : "border-slate-200"}`}>
          <p className="text-sm text-slate-500">{rotulos[s]}</p><p className="mt-2 text-2xl font-bold">{totais[s]}</p>
        </button>)}
    </div>
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Competência dos exames
          <input type="month" className={`${campo} mt-1`} value={mesConsulta || competencia} disabled={salvando}
            onChange={(e) => {setMesConsulta(e.target.value);setBusca("");setSelecionado(null);limparLote();}} />
        </label>
        <label className="min-w-48 flex-1 text-sm font-medium">Pesquisar por paciente, clínica, exame ou código
          <input value={busca} disabled={salvando} onChange={(e) => {setBusca(e.target.value); limparLote();}} className={`${campo} mt-1`} placeholder="Buscar exames" /></label>
        <label className="text-sm font-medium">Situação
          <select className={`${campo} mt-1`} value={filtro} disabled={salvando} onChange={(e) => mudarFiltro(e.target.value as "TODOS" | Status)}>
            <option value="TODOS">Todos</option>
            {(["REALIZADO", "ENVIADO_LAUDO", "LAUDO_RECEBIDO", "ENTREGUE"] as const).map((s) =>
              <option key={s} value={s}>{rotulos[s]}</option>)}
          </select></label>
        <button type="button" disabled={salvando} onClick={() => {limparLote(); carregar().catch((e) => setErro(String(e)));}} className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50">Atualizar</button>
      </div>
      {acaoLote && podeEditar && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-slate-50 p-3">
        <div className="text-sm"><b>{examesLote.length} exame(s) selecionado(s)</b>{acaoLote === "enviar" && <p className="text-xs text-slate-600">Para envio em lote, o cadastro deve estar vinculado e os aparelhos descarregados. Use Detalhes para completar dados ou ajustar datas individuais.</p>}</div>
        <div className="flex gap-2"><button type="button" disabled={salvando || !examesLote.length} onClick={limparLote} className="rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-40">Limpar</button><button type="button" disabled={salvando || !examesLote.length || loteAberto} onClick={() => {setSelecionado(null);setLoteAberto(true);setErro("");setSucesso("");}} className="rounded-lg bg-[#087681] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{acaoLote === "enviar" ? "Preparar envio em lote" : acaoLote === "receber" ? "Receber em lote" : "Entregar em lote"}</button></div>
      </div>}
      {carregando ? <p className="py-8 text-sm text-slate-500">Carregando exames...</p> :
        filtrados.length === 0 ? <p className="py-8 text-sm text-slate-500">Nenhum exame encontrado nessa competência para este filtro.</p> :
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm">
          <thead><tr className="border-b text-xs uppercase text-slate-500">{acaoLote && podeEditar && <th className="w-10"><input type="checkbox" aria-label="Selecionar todos os exames disponíveis" checked={todosMarcados} disabled={salvando || !elegiveis.length} onChange={e=>{setLoteAberto(false);setSelecionado(null);setIdsLote(e.target.checked ? elegiveis.map(x=>x.id) : []);}} /></th>}<th className="py-3">Realização</th><th>Paciente</th><th>Clínica</th><th>Exame</th><th>Situação</th><th></th></tr></thead>
          <tbody>{filtrados.map((e) => <tr key={e.id} className="border-b last:border-0">
            {acaoLote && podeEditar && <td><input type="checkbox" aria-label={`Selecionar ${e.producao.nomePacienteDigitado} ${e.tipoExame}`} checked={examesLote.some(x=>x.id===e.id)} disabled={salvando || !elegiveis.some(x=>x.id===e.id)} onChange={x=>marcarLote(e.id,x.target.checked)} /></td>}
            <td className="py-3">{dataCurta(e.producao.dataRealizacao)}</td><td className="font-medium">{e.producao.nomePacienteDigitado}</td>
            <td>{e.producao.clinica.nome}{e.producao.unidadeClinica ? ` · ${e.producao.unidadeClinica.nome}` : ""}</td>
            <td>{e.tipoExame}</td><td><span className="rounded-md bg-slate-100 px-2 py-1 text-xs">{rotulos[e.status]}</span></td>
            <td><button type="button" className="font-semibold text-emerald-700 hover:underline" disabled={salvando} onClick={() => abrir(e)}>Detalhes</button></td>
          </tr>)}</tbody></table></div>}
      {loteAberto && acaoLote && examesLote.length > 0 && <PortalV3LaudosLote key={`${acaoLote}:${examesLote.map(e=>e.id).join(",")}`} exames={examesLote} parametros={parametros} acao={acaoLote} api={API} ocupado={salvando} setOcupado={setSalvando} aoConcluir={concluirLote} aoCancelar={limparLote} />}
    </section>

    {atual && <section className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="text-lg font-semibold">{atual.producao.nomePacienteDigitado} — {atual.tipoExame}</h3>
          <p className="text-xs text-slate-500">Código interno: {atual.codigoInterno} · {atual.producao.clinica.nome}</p></div>
        <button type="button" className="rounded-lg border px-3 py-1 text-sm" onClick={() => setSelecionado(null)}>Fechar</button>
      </div>
      {atual.status === "REALIZADO" && <div className="mt-5 space-y-4">
        {atual.usoEquipamento && !atual.usoEquipamento.descarregadoEm &&
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">MAPA/Holter: registre primeiro a retirada e o descarregamento em Equipamentos.</p>}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div><h4 className="font-semibold text-slate-900">1. Confirmar ou completar cadastro do paciente</h4>
            <p className="mt-1 text-xs text-slate-600">Os dados ficam na ficha única do paciente, compartilhada com a V1. Não usamos o nome sozinho para unir cadastros.</p></div>
          {atual.producao.pacienteId && <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">Paciente vinculado: {atual.producao.paciente?.nome}. Confira ou complete dados antes do envio.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium sm:col-span-2">Nome completo
              <input className={`${campo} mt-1`} value={nomeCadastro} onChange={(e) => { setNomeCadastro(e.target.value); setPacienteEscolhidoId(null); setConferiuIdentidade(false); }} /></label>
            <label className="text-sm font-medium">CPF (se disponível)
              <input className={`${campo} mt-1`} inputMode="numeric" value={cpfCadastro} onChange={(e) => setCpfCadastro(e.target.value)} placeholder="Somente números" maxLength={14} /></label>
            <label className="text-sm font-medium">Data de nascimento (se disponível)
              <input className={`${campo} mt-1`} type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} /></label>
          </div>
          <button type="button" onClick={() => void buscarCadastro()} disabled={!podeEditar || buscandoPaciente || salvando}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50">
            {buscandoPaciente ? "Pesquisando..." : "Pesquisar cadastro existente"}</button>
          {candidatos.length > 0 && <div className="space-y-2"><p className="text-xs font-semibold">Possíveis cadastros — confirme com o paciente:</p>
            {candidatos.map((p) => <button type="button" key={p.id} onClick={() => {
              setPacienteEscolhidoId(p.id); setNomeCadastro(p.nome); setCpfCadastro(p.cpf || cpfCadastro);
              setNascimento(p.dataNascimento?.slice(0, 10) || nascimento); setConferiuIdentidade(false);
            }} className={`block w-full rounded-lg border p-2 text-left text-sm ${pacienteEscolhidoId === p.id ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white"}`}>
              {p.nome} · Nascimento: {dataCurta(p.dataNascimento)} · CPF: {p.cpf ? `***${p.cpf.slice(-4)}` : "não cadastrado"}
            </button>)}
          </div>}
          <p className="text-xs text-slate-600">{pacienteEscolhidoId ? `Cadastro existente selecionado (ID ${pacienteEscolhidoId}).` : "Nenhum cadastro selecionado: salvar criará um novo paciente."}</p>
          {!pacienteEscolhidoId && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={conferiuIdentidade} onChange={(e) => setConferiuIdentidade(e.target.checked)} />
            Conferi que não se trata de paciente já cadastrado na Digna.</label>}
          <button type="button" disabled={!podeEditar || salvando || (atual.executadoPorId !== usuario.id && !podeAdministrar) || (!pacienteEscolhidoId && !conferiuIdentidade)}
            onClick={() => void salvarCadastro()} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Salvar e vincular cadastro</button>
        </div>
        <div className="space-y-3">
          <h4 className="font-semibold text-slate-900">2. Registrar envio para laudo</h4>
          <p className="text-sm text-slate-600">Após conferir o cadastro, encaminhe o exame na plataforma externa e confirme aqui.</p>
          <label className="block text-sm font-medium">Telemedicina utilizada *
            <input className={`${campo} mt-1`} value={telemedicina} maxLength={100} onChange={(e) => setTelemedicina(e.target.value)} placeholder="Ex.: RWE, SHD" /></label>
          {!configAtual && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Esta clínica/modalidade ainda não possui prazo e condições financeiras configurados.
            <Link href="/terceirizacao/configuracoes/laudos" className="ml-2 font-semibold underline">Configurar</Link>
          </div>}
          {configAtual && <div className="rounded-xl border border-emerald-100 bg-[#F7F6F2] p-4 space-y-3">
            <h5 className="font-semibold text-[#064E57]">Destino e condições do laudo</h5>
            <p className="text-xs text-slate-600">Clínica de realização: <b>{atual.producao.clinica.nome}</b>.
              A unidade e a previsão de entrega podem ser diferentes; a competência financeira permanece {dataCurta(atual.producao.dataRealizacao)}.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Convênio
                <select value={convenio} onChange={(e) => setConvenio(e.target.value)} className={`${campo} mt-1`}>
                  <option value="">{configAtual.convenios.length ? "Selecione" : "Geral / sem convênio"}</option>
                  {configAtual.convenios.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Forma de pagamento *
                <select value={formaPagamento} onChange={(e) => {
                  setFormaPagamento(e.target.value); setQuantidadeParcelas(1); setVencimentosPersonalizados([]);
                }} className={`${campo} mt-1`}>
                  <option value="">Selecione</option>
                  {configAtual.formasPagamento.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Categoria (se aplicável)
                <input className={`${campo} mt-1`} value={categoriaAtendimento} maxLength={120}
                  onChange={(e) => setCategoriaAtendimento(e.target.value)} placeholder="Ex.: OCI" />
              </label>
              <div className="rounded-lg border border-emerald-200 bg-white p-3 text-sm">
                <b className="text-[#064E57]">Repasse financeiro automático</b>
                {!estimativaFinanceira ? <p className="mt-1 text-slate-500">Consultando a tabela contratual...</p> :
                  estimativaFinanceira.calculavel ? <>
                    <p className="mt-1 text-emerald-900">Valor da Digna: <b>{Number(estimativaFinanceira.valorDevido).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b></p>
                    <p className="text-xs text-slate-600">{estimativaFinanceira.metodo === "PERCENTUAL" ?
                      `${estimativaFinanceira.percentual}% sobre valor contratado de R$ ${Number(estimativaFinanceira.valorCobradoContratado).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Repasse fixo contratado"}</p>
                  </> : <p className="mt-1 text-amber-800">{estimativaFinanceira.mensagem}</p>}
                <p className="mt-1 text-xs text-slate-500">Valores configurados por clínica; não é necessário digitar o preço neste exame.</p>
              </div>
              {permiteParcelar && <div className="sm:col-span-2 rounded-lg border border-teal-200 bg-white p-3 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-sm font-medium">Parcelas do repasse da Digna
                    <select className={`${campo} mt-1`} value={quantidadeParcelas} onChange={(e) => {
                      setQuantidadeParcelas(Number(e.target.value)); setVencimentosPersonalizados([]);
                    }}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}x</option>)}
                    </select>
                  </label>
                  <p className="text-xs text-slate-600 flex-1">O valor das parcelas é calculado sobre <b>o repasse devido à Digna</b>,
                    nunca sobre o valor integral pago pelo paciente. Os vencimentos podem ser ajustados aqui.</p>
                </div>
                {estimativaFinanceira?.calculavel && <div className="text-sm font-semibold text-[#064E57]">
                  Total a receber: {dinheiroBR(centavosRepasse / 100)} em {quantidadeParcelas} parcela(s)
                </div>}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {vencimentosParcelas.map((dia, i) => <label key={i} className="text-xs font-medium">
                    Parcela {i + 1}/{quantidadeParcelas} · {estimativaFinanceira?.calculavel
                      ? dinheiroBR((centavosPorParcela + (i === quantidadeParcelas - 1 ? restoParcelamento : 0)) / 100) : "valor pendente"}
                    <input className={`${campo} mt-1`} type="date" min={atual.producao.dataRealizacao.slice(0,10)} value={dia}
                      onChange={(e) => setVencimentosPersonalizados((a) => {
                        const proximos = [...vencimentosParcelas]; proximos[i] = e.target.value; return proximos;
                      })} />
                  </label>)}
                </div>
              </div>}
              <label className="text-sm font-medium">Unidade de entrega do resultado
                <select className={`${campo} mt-1`} value={unidadeEntregaId} onChange={(e) => setUnidadeEntregaId(e.target.value)}>
                  <option value="">{unidadesAtuais.length ? "Sem unidade definida" : "Clínica sem unidades cadastradas"}</option>
                  {unidadesAtuais.map((un) => <option key={un.id} value={un.id}>{un.nome}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Previsão de entrega (ajustável)
                <input className={`${campo} mt-1`} type="date" min={atual.producao.dataRealizacao.slice(0, 10)}
                  value={previsaoEscolhida} onChange={(e) => setPrevisaoEntrega(e.target.value)} />
              </label>
            </div>
            <p className="text-xs text-slate-600">Previsão padrão: <b>{dataCurta(previsaoPadrao)}</b> · {configAtual.prazoDias} dias corridos desde {configAtual.marcoPrazo === "ENVIO" ? "o envio" : "a realização"}.
              Vencimento financeiro padrão: {configAtual.diasVencimento} dias após a realização.</p>
            {alterouPrevisao && <label className="block text-sm font-medium">Motivo da alteração de previsão *
              <input className={`${campo} mt-1`} value={motivoAjustePrevisao} maxLength={300}
                onChange={(e) => setMotivoAjustePrevisao(e.target.value)} placeholder="Ex.: resultado antecipado a pedido do paciente" />
            </label>}
            <p className="text-xs text-slate-600">Ao confirmar o envio, o sistema utiliza a tabela financeira da clínica e registra o título com competência na data de realização. Se faltar alguma configuração, o envio gerará uma pendência financeira identificada.</p>
          </div>}
          <label className="block text-sm font-medium">Observações do preparo (opcional, sem dados clínicos sensíveis)
            <textarea className={`${campo} mt-1`} value={observacoes} maxLength={800} rows={2} onChange={(e) => setObservacoes(e.target.value)} /></label>
        </div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={conferidos} onChange={(e) => setConferidos(e.target.checked)} />
          <span>Já encaminhei o exame pela plataforma da telemedicina e conferi os dados exigidos para este procedimento.</span></label>
        <button type="button" disabled={!podeEditar || !conferidos || !configAtual || !formaPagamento ||
            (configAtual.convenios.length > 0 && !convenio) ||
            (alterouPrevisao && motivoAjustePrevisao.trim().length < 8) ||
            vencimentosParcelas.some((dia, i) => !dia || (i > 0 && dia <= vencimentosParcelas[i - 1])) ||
            !atual.producao.pacienteId || salvando || (atual.executadoPorId !== usuario.id && !podeAdministrar)}
          onClick={() => void executar("enviar")} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          {salvando ? "Salvando..." : "Registrar envio para laudo"}</button>
        {atual.executadoPorId !== usuario.id && !podeAdministrar && <p className="text-xs text-slate-500">O envio deve ser registrado pela funcionária executante; a administração pode atuar em exceções.</p>}
      </div>}
      {(["ENVIADO_LAUDO", "LAUDO_RECEBIDO"] as Status[]).includes(atual.status) && <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
        <h4 className="font-semibold text-amber-950">Reprogramar previsão ou unidade de entrega</h4>
        <p className="text-xs text-amber-950">Previsão atual: {dataCurta(atual.laudoPrevisaoEntrega)} · Unidade: {atual.laudoUnidadeEntrega?.nome || "Não definida"}. Ajustes ficam no histórico.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Nova previsão de entrega
            <input className={`${campo} mt-1`} type="date" min={atual.producao.dataRealizacao.slice(0,10)}
              value={previsaoEscolhida} onChange={(e) => setPrevisaoEntrega(e.target.value)} /></label>
          <label className="text-sm font-medium">Unidade onde entregar
            <select className={`${campo} mt-1`} value={unidadeEntregaId} onChange={(e) => setUnidadeEntregaId(e.target.value)}>
              <option value="">Sem unidade definida</option>{unidadesAtuais.map((un) => <option key={un.id} value={un.id}>{un.nome}</option>)}
            </select></label>
        </div>
        <label className="block text-sm font-medium">Justificativa da alteração *
          <input className={`${campo} mt-1`} maxLength={300} value={motivoAjustePrevisao}
            onChange={(e) => setMotivoAjustePrevisao(e.target.value)} placeholder="Ex.: paciente solicitou outra unidade de retirada" /></label>
        <button type="button" className="rounded-lg bg-[#064E57] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          disabled={!podeEditar || salvando || !previsaoEscolhida || motivoAjustePrevisao.trim().length < 8}
          onClick={() => void executar("previsao")}>Salvar alteração de entrega</button>
      </div>}
      {atual.status === "ENVIADO_LAUDO" && <div className="mt-5 space-y-3">
        <p className="text-sm">Telemedicina: <b>{atual.laudoTelemedicina || "Não informada"}</b> · Enviado em: {dataHora(atual.laudoEnviadoEm)}</p>
        <p className="text-sm text-slate-600">Previsão: <b>{dataCurta(atual.laudoPrevisaoEntrega)}</b> · Unidade de entrega: <b>{atual.laudoUnidadeEntrega?.nome || "Não definida"}</b></p>
        {atual.financeiroPendenciaV3 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Pendência financeira: {atual.financeiroPendenciaV3}</p>}
        <p className="text-sm text-slate-600">Registre o recebimento somente quando o laudo estiver disponível na plataforma externa.</p>
        <button type="button" disabled={!podeEditar || salvando} onClick={() => void executar("receber")}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Confirmar recebimento do laudo</button>
      </div>}
      {atual.status === "LAUDO_RECEBIDO" && <div className="mt-5 space-y-3">
        <p className="text-sm text-slate-600">Recebido em {dataHora(atual.laudoRecebidoEm)}. Registre a entrega real à clínica conforme o procedimento da unidade.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Meio de entrega
            <select className={`${campo} mt-1`} value={meioEntrega} onChange={(e) => { setMeioEntrega(e.target.value); setProtocoloConferido(false); }}>
              <option value="EMAIL">E-mail</option><option value="PASTA_REDE">Pasta de rede da clínica</option><option value="IMPRESSO">Impresso com protocolo</option>
            </select></label>
          <label className="text-sm font-medium">Referência da entrega *
            <input className={`${campo} mt-1`} value={referencia} maxLength={250} onChange={(e) => setReferencia(e.target.value)} placeholder="Destinatário, pasta ou protocolo" /></label>
        </div>
        {meioEntrega === "IMPRESSO" && <label className="flex gap-2 text-sm"><input type="checkbox" checked={protocoloConferido} onChange={(e) => setProtocoloConferido(e.target.checked)} />
          Protocolo assinado e conferido.</label>}
        <button type="button" disabled={!podeEditar || salvando || referencia.trim().length < 3 || (meioEntrega === "IMPRESSO" && !protocoloConferido)}
          onClick={() => void executar("entregar")} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Registrar entrega à clínica</button>
        <p className="text-xs text-slate-500">Os PDFs continuam armazenados nas plataformas/pastas já usadas pela Digna. O anexo do protocolo assinado será incorporado em etapa posterior.</p>
      </div>}
      {atual.status === "ENTREGUE" && <p className="mt-4 text-sm text-emerald-800">Entregue em {dataHora(atual.laudoEntregueEm)} por {atual.laudoMeioEntrega}. Referência: {atual.laudoReferenciaEntrega}.</p>}
      {podeAdministrar && atual.status !== "ENTREGUE" && atual.status !== "CANCELADO" && <details className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
        <summary className="cursor-pointer font-semibold text-red-900">Cancelar exame (excepcional, administração)</summary>
        <p className="mt-2 text-xs text-red-800">Bloqueado se houver recebimento ativo, laudo entregue ou aparelho pendente. Não cancela automaticamente na telemedicina externa.</p>
        <label className="mt-2 block text-sm">Motivo obrigatório (mín. 10 caracteres)<textarea className={`${campo} mt-1`} maxLength={1000} value={motivoCancelamento} onChange={e => setMotivoCancelamento(e.target.value)} /></label>
        {["ENVIADO_LAUDO", "LAUDO_RECEBIDO"].includes(atual.status) && <label className="mt-2 flex gap-2 text-xs text-red-900"><input type="checkbox" checked={cancelamentoExternoConferido} onChange={e=>setCancelamentoExternoConferido(e.target.checked)} /> Confirmei o cancelamento/invalidação também na telemedicina externa.</label>}
        <button type="button" disabled={salvando || motivoCancelamento.trim().length < 10 || (["ENVIADO_LAUDO", "LAUDO_RECEBIDO"].includes(atual.status) && !cancelamentoExternoConferido)} onClick={() => void cancelarExame()} className="mt-2 rounded bg-red-800 px-3 py-2 text-sm text-white disabled:opacity-50">Confirmar cancelamento auditado</button>
      </details>}
      <div className="mt-5 border-t pt-3"><h4 className="text-sm font-semibold">Histórico registrado</h4>
        {atual.eventosLaudo.length ? <div className="mt-2 space-y-2">{atual.eventosLaudo.map((ev) => <p key={ev.id} className="text-xs text-slate-600">{dataHora(ev.ocorridoEm)} — {ev.acao} por {ev.usuario.nome}{ev.detalhes ? ` · ${ev.detalhes}` : ""}</p>)}</div>
          : <p className="mt-2 text-xs text-slate-500">Ainda não existem ações registradas para este exame.</p>}
      </div>
    </section>}
    <p className="text-xs text-slate-500">Previsões, unidades de entrega e títulos são registrados com o envio para laudar. O histórico de alterações permanece disponível em cada exame.</p>
  </div>;
}
