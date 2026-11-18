"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
type Tipo = "ECG" | "EEG" | "ESPIROMETRIA" | "MAPA" | "HOLTER";
type ExameForm = { tipoExame: Tipo; equipamentoId: string; repeticao?: boolean };
type Clinica = { id: number; nome: string; unidades: { id: number; nome: string }[] };
type Equipamento = { id: number; codigo: string; tipo: string; disponivel: boolean };
type Paciente = { id: number; nome: string; dataNascimento: string | null };
type Producao = { id: number; nomePacienteDigitado: string; dataRealizacao: string; clinica: { nome: string };
  unidadeClinica: { nome: string } | null; exames: { id: number; tipoExame: string; status: string; codigoInterno: string;
    usoEquipamento: { equipamento: { codigo: string }; retiradoEm: string | null } | null }[] };
const MODALIDADES: Tipo[] = ["ECG", "EEG", "ESPIROMETRIA", "MAPA", "HOLTER"];
function hojeLocal() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const v = Object.fromEntries(p.map((x) => [x.type, x.value]));
  return `${v.year}-${v.month}-${v.day}`;
}
function mostrarData(valor: string) {
  const d = valor.slice(0, 10).split("-");
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : valor;
}
const campo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none";

export default function ProducaoTerceirizacaoPage() {
  const { temPermissao, usuario } = useAuth();
  const [funcionarios,setFuncionarios] = useState<{id:number;nome:string}[]>([]);
  const [executorId,setExecutorId] = useState(String(usuario.id));
  const podeCriar = temPermissao("terceirizacao.producao.criar");
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [producoes, setProducoes] = useState<Producao[]>([]);
  const [competencia, setCompetencia] = useState(hojeLocal().slice(0, 7));
  const [filtroHistorico, setFiltroHistorico] = useState("");
  useEffect(() => { const termo = new URLSearchParams(window.location.search).get("busca"); if (termo) setFiltroHistorico(termo.slice(0, 80)); }, []);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [dataRealizacao, setDataRealizacao] = useState(hojeLocal);
  const [clinicaId, setClinicaId] = useState("");
  const [unidadeClinicaId, setUnidadeClinicaId] = useState("");
  const [nome, setNome] = useState("");
  const [pacienteId, setPacienteId] = useState<number | null>(null);
  const [pacientesEncontrados, setPacientesEncontrados] = useState<Paciente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [exames, setExames] = useState<ExameForm[]>([{ tipoExame: "ECG", equipamentoId: "" }]);
  const unidades = useMemo(() => clinicas.find((c) => String(c.id) === clinicaId)?.unidades ?? [], [clinicas, clinicaId]);
  const permissaoEquipamentos = temPermissao("terceirizacao.equipamentos.visualizar");
  const producoesFiltradas = useMemo(() => producoes.filter((p) => `${p.nomePacienteDigitado} ${p.clinica.nome} ${p.exames.map((e) => `${e.tipoExame} ${e.codigoInterno}`).join(" ")}`.toLocaleLowerCase("pt-BR").includes(filtroHistorico.trim().toLocaleLowerCase("pt-BR"))), [producoes, filtroHistorico]);

  const carregar = useCallback(async () => {
    const [base, lista] = await Promise.all([
      fetch(`${API}/terceirizacao/base`, { credentials: "include" }),
      fetch(`${API}/terceirizacao/producoes`, { credentials: "include" }),
    ]);
    const dadosBase = await base.json().catch(() => ({}));
    const dadosLista = await lista.json().catch(() => ({}));
    if (!base.ok || !lista.ok) throw new Error(dadosBase.erro || dadosLista.erro || "Nao foi possivel carregar a producao.");
    setClinicas(dadosBase.clinicas ?? []);
    setFuncionarios(dadosBase.funcionarios ?? []);
    setEquipamentos(dadosBase.equipamentos ?? []);
    setProducoes(dadosLista.producoes ?? []);
    setCompetencia(dadosLista.competencia || hojeLocal().slice(0, 7));
  }, []);

  useEffect(() => {
    let montado = true;
    carregar().catch((e) => { if (montado) setErro(e instanceof Error ? e.message : "Falha de conexao."); })
      .finally(() => { if (montado) setCarregando(false); });
    return () => { montado = false; };
  }, [carregar]);

  function atualizarExame(indice: number, novo: Partial<ExameForm>) {
    setExames((lista) => lista.map((item, i) => i === indice ? { ...item, ...novo } : item));
  }

  async function buscarPacientes() {
    if (nome.trim().length < 3) return setErro("Digite pelo menos tres caracteres para pesquisar.");
    setErro(""); setBuscando(true);
    try {
      const resposta = await fetch(`${API}/terceirizacao/pacientes?busca=${encodeURIComponent(nome.trim())}`, { credentials: "include" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Falha na pesquisa.");
      setPacientesEncontrados(dados.pacientes ?? []);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha na pesquisa."); }
    finally { setBuscando(false); }
  }

  async function registrar() {
    setErro(""); setSucesso("");
    if (!podeCriar) return setErro("Sem permissao para registrar exames.");
    if (!clinicaId || !nome.trim() || !dataRealizacao) return setErro("Informe data, nome e clinica.");
    if (exames.some((e) => (e.tipoExame === "MAPA" || e.tipoExame === "HOLTER") && !e.equipamentoId)) return setErro("Selecione o aparelho para MAPA e Holter.");
    setSalvando(true);
    try {
      const resposta = await fetch(`${API}/terceirizacao/producoes`, { method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataRealizacao, clinicaId: Number(clinicaId), unidadeClinicaId: unidadeClinicaId ? Number(unidadeClinicaId) : null,
          nomePacienteDigitado: nome.trim(), pacienteId, executadoPorId: Number(executorId), exames: exames.map((e) => ({ tipoExame: e.tipoExame, equipamentoId: e.equipamentoId ? Number(e.equipamentoId) : null, repeticao: e.repeticao === true })) }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.erro || "Erro ao registrar producao.");
      setNome(""); setPacienteId(null); setPacientesEncontrados([]);
      setExames([{ tipoExame: "ECG", equipamentoId: "" }]);
      setSucesso(dataRealizacao.slice(0, 7) !== hojeLocal().slice(0, 7)
        ? `Produção #${dados.id} registrada. Como pertence a outra competência, consulte-a em Relatórios.`
        : `Produção #${dados.id} registrada com sucesso.`);
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro de conexao."); }
    finally { setSalvando(false); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-semibold text-slate-900">Produção de exames</h2>
      <p className="mt-1 text-sm text-slate-500">Registro rápido, com controle individual dos procedimentos.</p></div>
      {permissaoEquipamentos && <Link href="/terceirizacao/equipamentos" className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">Consultar equipamentos</Link>}
    </div>
    {erro && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div>}
    {sucesso && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{sucesso}</div>}
    {podeCriar && <section id="novo-lancamento" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">Novo lançamento</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Data de realização <input className={`${campo} mt-1`} type="date" value={dataRealizacao} onChange={(e) => setDataRealizacao(e.target.value)}/></label>
        <label className="block text-sm font-medium">Clínica <select className={`${campo} mt-1`} value={clinicaId} onChange={(e) => {setClinicaId(e.target.value); setUnidadeClinicaId("");}}><option value="">Selecionar clínica</option>{clinicas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        {unidades.length > 0 && <label className="block text-sm font-medium">Unidade (se aplicável) <select className={`${campo} mt-1`} value={unidadeClinicaId} onChange={(e) => setUnidadeClinicaId(e.target.value)}><option value="">Sem unidade específica</option>{unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></label>}
        {usuario.perfil === "ADMINISTRADOR" && <label className="block text-sm font-medium">Executor dos exames <select className={`${campo} mt-1`} value={executorId} onChange={e=>setExecutorId(e.target.value)}><option value={usuario.id}>{usuario.nome} (eu)</option>{funcionarios.filter(f=>f.id!==usuario.id).map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>}
        <div className="sm:col-span-2"><label className="block text-sm font-medium" htmlFor="v3-nome">Nome do paciente</label>
          <div className="mt-1 flex flex-wrap gap-2"><input id="v3-nome" className={`${campo} min-w-44 flex-1`} value={nome} placeholder="Nome completo" onChange={(e) => {setNome(e.target.value);setPacienteId(null);setPacientesEncontrados([]);}}/>
          <button type="button" onClick={buscarPacientes} disabled={buscando} className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">{buscando ? "Buscando..." : "Pesquisar cadastro"}</button></div>
          {pacienteId && <p className="mt-1 text-xs text-emerald-700">Cadastro existente vinculado após seleção confirmada.</p>}
          {pacientesEncontrados.length > 0 && <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border"><p className="p-2 text-xs text-slate-500">Confirme a identidade; nomes iguais não são vinculados automaticamente.</p>{pacientesEncontrados.map((p) => <button key={p.id} type="button" onClick={() => {setPacienteId(p.id);setNome(p.nome);setPacientesEncontrados([]);}} className="flex w-full justify-between border-t px-3 py-2 text-left text-sm hover:bg-emerald-50"><span>{p.nome}</span><span className="text-slate-500">{p.dataNascimento ? mostrarData(p.dataNascimento) : "Nascimento não informado"}</span></button>)}</div>}
          <p className="mt-1 text-xs text-slate-500">É possível registrar apenas pelo nome e completar a identificação depois.</p>
        </div>
      </div>
      <div className="mt-5 space-y-3"><div className="flex items-center justify-between"><h4 className="font-semibold">Exames realizados</h4><button type="button" disabled={exames.length >= 12} onClick={() => setExames((v) => [...v, {tipoExame:"ECG",equipamentoId:""}])} className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40">+ Adicionar exame</button></div>
        {exames.map((e, i) => <div key={i} className="grid items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-sm font-medium">Exame <select className={`${campo} mt-1`} value={e.tipoExame} onChange={(evt) => atualizarExame(i,{tipoExame:evt.target.value as Tipo,equipamentoId:""})}>{MODALIDADES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
          {e.tipoExame === "MAPA" || e.tipoExame === "HOLTER" ? <label className="text-sm font-medium">Aparelho <select className={`${campo} mt-1`} value={e.equipamentoId} onChange={(evt) => atualizarExame(i,{equipamentoId:evt.target.value})}><option value="">Selecionar aparelho</option>{equipamentos.filter((x) => x.tipo === e.tipoExame && x.disponivel).map((x) => <option key={x.id} value={x.id}>{x.codigo}</option>)}</select></label> : <div className="text-xs text-slate-500 sm:pb-3">Sem aparelho para vincular</div>}
          <button type="button" disabled={exames.length === 1} onClick={() => setExames((v) => v.filter((_,j) => j !== i))} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-30">Remover</button>
          <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" checked={e.repeticao===true} onChange={evt=>atualizarExame(i,{repeticao:evt.target.checked})}/> Repetição técnica (não bonificável)</label>
        </div>)}
      </div>
      <button type="button" disabled={salvando || carregando} onClick={registrar} className="mt-5 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{salvando ? "Salvando..." : `Registrar ${exames.length} exame${exames.length === 1 ? "" : "s"}`}</button>
    </section>}
    <section id="historico" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-semibold">Produções do mês atual ({competencia.split("-").reverse().join("/")})</h3><button type="button" className="text-sm text-emerald-700 hover:underline" onClick={() => carregar().catch((e)=>setErro(String(e)))}>Atualizar</button></div>
      <label className="mb-4 block max-w-md text-sm font-medium text-[#18383D]">Filtrar produções
        <input className={`${campo} mt-1`} value={filtroHistorico} onChange={(e) => setFiltroHistorico(e.target.value)} placeholder="Paciente, clínica, exame ou código" />
      </label>
      {carregando ? <p className="text-sm text-slate-500">Carregando...</p> : producoesFiltradas.length === 0 ? <p className="text-sm text-slate-500">Nenhuma produção encontrada neste mês para esse filtro. Para consultar outros meses, acesse Relatórios.</p> :
        <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3">Data</th><th>Paciente</th><th>Clínica</th><th>Exames</th></tr></thead><tbody>{producoesFiltradas.map((p) => <tr key={p.id} className="border-b align-top last:border-0"><td className="py-3">{mostrarData(p.dataRealizacao)}</td><td>{p.nomePacienteDigitado}</td><td>{p.clinica.nome}{p.unidadeClinica && <span className="block text-xs text-slate-500">{p.unidadeClinica.nome}</span>}</td><td><div className="flex flex-wrap gap-1">{p.exames.map((e) => <span key={e.id} title={e.codigoInterno} className="rounded-md bg-slate-100 px-2 py-1 text-xs">{e.tipoExame}{e.usoEquipamento && ` · ${e.usoEquipamento.equipamento.codigo}`}</span>)}</div></td></tr>)}</tbody></table></div>}
    </section>
    <p className="text-xs text-slate-500">A lista apresenta exclusivamente exames realizados no mês atual. Registros de outros meses ficam em <Link className="font-semibold text-emerald-700 hover:underline" href="/terceirizacao/relatorios">Relatórios</Link>.</p>
    <p className="text-xs text-slate-500">Etapa inicial: realização e consulta. Complementação para laudo, classificação de repetição e correção auditada disponíveis no módulo Equipe.</p>
  </div>;
}
