"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle, ArrowLeft, Building2, CalendarClock, ChevronRight,
  ClipboardList, FileText, Mail, MapPin, Pencil, Phone, Plus, RefreshCw,
  Stethoscope, UserRound, UsersRound, WalletCards, X
} from "lucide-react";

type ItemGuia = { id:number; status:string; procedimento:{id:number;nome:string}; tipoAgendamento:"HORARIO"|"ORDEM_CHEGADA"|null; dataAgendamento:string|null; horarioAgendamento:string|null };
type Guia = { id:number; codigoPublico:string; status:string; clinica:{id:number;nome:string}; valorFinal:number; pagoLiquido:number; saldo:number; itens:ItemGuia[] };
type Atendimento = { id:number; codigoPublico:string; criadoEm:string; status:string; guias:Guia[] };
type Agendamento = { atendimentoId:number; atendimentoCodigo:string; guiaId:number; guiaCodigo:string; clinica:string; procedimento:string; tipoAgendamento:"HORARIO"|"ORDEM_CHEGADA"|null; dataAgendamento:string; horarioAgendamento:string|null };
type Familiar = { id:number; tipo:string; removivel:boolean; paciente:{id:number;codigoPublico:string|null;nome:string;nomeSocial:string|null;cpf:string} };
type PacienteBusca = { id:number; codigoPublico:string|null; nome:string; cpf:string };

type PacienteDetalhe = {
  id:number; codigoPublico:string|null; nome:string; nomeSocial:string|null; cpf:string; rg:string|null;
  telefone:string; telefoneSecundario:string|null; email:string|null; dataNascimento:string|null; nomeMae:string|null;
  cep:string|null; logradouro:string|null; numeroEndereco:string|null; complementoEndereco:string|null;
  bairro:string|null; cidade:string|null; uf:string|null;
  responsavelLegalEhMae:boolean; responsavelLegalNome:string|null; responsavelLegalCpf:string|null;
  responsavelLegalTelefone:string|null; responsavelLegalParentesco:string|null;
  beneficioAtivo:boolean; empresa:{id:number;nome:string}|null; criadoPor:{id:number;nome:string}|null;
  criadoEm:string; atualizadoEm:string;
  cadastro:{percentual:number;completo:boolean;faltantes:string[];menor:boolean};
  familiares:Familiar[];
  resumo:{totalAtendimentos:number;totalGuias:number;proximosAgendamentos:number;saldoPendente:number;possuiEstornoPendente:boolean};
  proximoAgendamento:Agendamento|null; agendamentosFuturos:Agendamento[]; atendimentos:Atendimento[];
};

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:3333";
const TIPOS=[
  ["PAI","Pai"],["MAE","Mãe"],["FILHO","Filho"],["FILHA","Filha"],["IRMAO","Irmão"],["IRMA","Irmã"],
  ["AVO","Avô"],["AVO_FEMININO","Avó"],["NETO","Neto"],["NETA","Neta"],["MARIDO","Marido"],
  ["ESPOSA","Esposa"],["COMPANHEIRO","Companheiro"],["COMPANHEIRA","Companheira"],["RESPONSAVEL","Responsável"],
  ["DEPENDENTE","Dependente"],["OUTRO","Outro"],
] as const;
const LABEL_TIPO=Object.fromEntries(TIPOS);

function cpfFormatado(v:string){const n=(v||"").replace(/\D/g,"");return n.length===11?`${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`:v||"Não informado"}
function telefoneFormatado(v:string|null){const n=(v||"").replace(/\D/g,"");if(n.length===11)return`(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;if(n.length===10)return`(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;return v||"Não informado"}
function dataFormatada(v:string|null){if(!v)return"Não informado";return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(v))}
function moeda(v:number){return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function statusClass(s:string){if(s==="Pago e agendado"||s==="Concluído")return"bg-emerald-100 text-emerald-800";if(s==="Aguardando agendamento")return"bg-violet-100 text-violet-800";if(s==="Aguardando pagamento"||s==="Parcialmente pago")return"bg-amber-100 text-amber-800";if(s==="Estorno pendente"||s==="Cancelado")return"bg-red-100 text-red-700";return"bg-slate-100 text-slate-700"}
function dataInput(v:string|null){return v?new Date(v).toISOString().slice(0,10):""}
function dataHora(a:Agendamento){return `${dataFormatada(a.dataAgendamento)} • ${a.tipoAgendamento==="ORDEM_CHEGADA"?"Ordem de chegada":a.horarioAgendamento||"--:--"}`}

export default function PacienteDetalhePage(){
  const params=useParams(); const router=useRouter(); const pacienteId=String(params.id);
  const [paciente,setPaciente]=useState<PacienteDetalhe|null>(null); const [carregando,setCarregando]=useState(true);
  const [erro,setErro]=useState(""); const [editando,setEditando]=useState(false); const [salvando,setSalvando]=useState(false);
  const [form,setForm]=useState<Record<string,string|boolean>>({});
  const [modalFamilia,setModalFamilia]=useState(false); const [todosPacientes,setTodosPacientes]=useState<PacienteBusca[]>([]);
  const [buscaFamiliar,setBuscaFamiliar]=useState(""); const [familiarId,setFamiliarId]=useState(""); const [tipoVinculo,setTipoVinculo]=useState("MAE");
  const [buscandoCep,setBuscandoCep]=useState(false); const [cepMensagem,setCepMensagem]=useState("");

  const carregarPaciente=useCallback(async()=>{
    try{setCarregando(true);setErro("");const r=await fetch(`${API}/pacientes/${pacienteId}`,{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.erro);setPaciente(j)}
    catch(e){console.error(e);setErro("Não foi possível carregar a ficha do paciente.")}finally{setCarregando(false)}
  },[pacienteId]);

  useEffect(()=>{const t=window.setTimeout(()=>void carregarPaciente(),0);return()=>window.clearTimeout(t)},[carregarPaciente]);

  const procedimentos=useMemo(()=>paciente?.atendimentos.reduce((t,a)=>t+a.guias.reduce((x,g)=>x+g.itens.filter(i=>i.status!=="CANCELADO").length,0),0)||0,[paciente]);

  function abrirEdicao(){
    if(!paciente)return;
    setForm({
      nome:paciente.nome,nomeSocial:paciente.nomeSocial||"",cpf:paciente.cpf,rg:paciente.rg||"",telefone:paciente.telefone,
      telefoneSecundario:paciente.telefoneSecundario||"",email:paciente.email||"",dataNascimento:dataInput(paciente.dataNascimento),
      nomeMae:paciente.nomeMae||"",cep:paciente.cep||"",logradouro:paciente.logradouro||"",numeroEndereco:paciente.numeroEndereco||"",
      complementoEndereco:paciente.complementoEndereco||"",bairro:paciente.bairro||"",cidade:paciente.cidade||"",uf:paciente.uf||"",
      responsavelLegalEhMae:paciente.responsavelLegalEhMae,responsavelLegalNome:paciente.responsavelLegalNome||"",
      responsavelLegalCpf:paciente.responsavelLegalCpf||"",responsavelLegalTelefone:paciente.responsavelLegalTelefone||"",
      responsavelLegalParentesco:paciente.responsavelLegalParentesco||"",
    });setEditando(true)
  }
  function campo(nome:string,valor:string|boolean){setForm(f=>({...f,[nome]:valor}))}
  function menorForm(){const d=String(form.dataNascimento||"");if(!d)return false;const n=new Date(`${d}T12:00:00`),h=new Date();let idade=h.getFullYear()-n.getFullYear();const m=h.getMonth()-n.getMonth();if(m<0||(m===0&&h.getDate()<n.getDate()))idade--;return idade<18}

  async function buscarCep(valor:string){
    const cep=valor.replace(/\D/g,"").slice(0,8);
    campo("cep",cep);
    setCepMensagem("");
    if(cep.length!==8)return;

    try{
      setBuscandoCep(true);
      const r=await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j=await r.json();

      if(!r.ok||j.erro){
        setCepMensagem("CEP não encontrado. Preencha o endereço manualmente.");
        return;
      }

      setForm(f=>({
        ...f,
        cep,
        logradouro:j.logradouro||String(f.logradouro||""),
        bairro:j.bairro||String(f.bairro||""),
        cidade:j.localidade||String(f.cidade||""),
        uf:j.uf||String(f.uf||""),
      }));
      setCepMensagem("Endereço preenchido pelo CEP. Informe o número e confira os dados.");
    }catch(e){
      console.error("Erro ao consultar CEP:",e);
      setCepMensagem("Não foi possível consultar o CEP agora. Você pode preencher manualmente.");
    }finally{
      setBuscandoCep(false);
    }
  }

  async function salvar(){
    setSalvando(true);setErro("");
    try{const r=await fetch(`${API}/pacientes/${pacienteId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});const j=await r.json();if(!r.ok)throw new Error(j.erro||"Erro ao salvar.");setEditando(false);await carregarPaciente()}
    catch(e){setErro(e instanceof Error?e.message:"Não foi possível salvar.")}finally{setSalvando(false)}
  }

  async function abrirFamilia(){
    setModalFamilia(true);setBuscaFamiliar("");setFamiliarId("");
    try{const r=await fetch(`${API}/pacientes`);const j=await r.json();setTodosPacientes(Array.isArray(j)?j.filter((p:PacienteBusca)=>String(p.id)!==pacienteId):[])}catch{setTodosPacientes([])}
  }
  const candidatos=todosPacientes.filter(p=>`${p.nome} ${p.cpf} ${p.codigoPublico||""}`.toLowerCase().includes(buscaFamiliar.toLowerCase())).slice(0,8);
  async function vincular(){
    if(!familiarId)return;
    const r=await fetch(`${API}/pacientes/${pacienteId}/familiares`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pacienteId:Number(familiarId),tipo:tipoVinculo})});
    const j=await r.json();if(!r.ok){setErro(j.erro||"Não foi possível vincular.");return}setModalFamilia(false);await carregarPaciente()
  }
  async function encerrarVinculo(v:Familiar){
    if(!v.removivel)return;
    if(!window.confirm(`Encerrar o vínculo com ${v.paciente.nome}? O histórico será preservado.`))return;
    const r=await fetch(`${API}/pacientes/${pacienteId}/familiares/${v.id}`,{method:"DELETE"});const j=await r.json();
    if(!r.ok){setErro(j.erro||"Não foi possível encerrar.");return}await carregarPaciente()
  }

  if(carregando)return <div className="mx-auto max-w-375 py-16 text-center text-sm text-xango-muted">Carregando ficha do paciente...</div>;
  if(erro&&!paciente)return <div className="mx-auto max-w-375"><button onClick={()=>router.push("/pacientes")} className="mb-5 flex items-center gap-2 text-sm font-semibold text-xango-primary"><ArrowLeft size={16}/>Voltar</button><div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">{erro}</div></div>;
  if(!paciente)return null;

  return <div className="mx-auto max-w-375">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <button onClick={()=>router.push("/pacientes")} className="flex items-center gap-2 text-sm font-semibold text-xango-primary hover:underline"><ArrowLeft size={16}/>Pacientes</button>
      <div className="flex gap-2">
        <button onClick={()=>void carregarPaciente()} className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary"><RefreshCw size={14}/>Atualizar</button>
        <button onClick={abrirEdicao} className="flex items-center gap-2 rounded-md border border-xango-primary bg-white px-3 py-2 text-xs font-semibold text-xango-primary"><Pencil size={14}/>Editar cadastro</button>
        <button onClick={()=>router.push(`/atendimentos/novo?pacienteId=${paciente.id}`)} className="rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white">+ Novo atendimento</button>
      </div>
    </div>

    {erro&&<div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
    {!paciente.cadastro.completo&&<div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex gap-3"><AlertCircle className="mt-0.5 text-amber-700" size={20}/><div><p className="font-semibold text-amber-900">Cadastro incompleto — impressão de guia será bloqueada</p><p className="mt-1 text-sm text-amber-800">Falta preencher: {paciente.cadastro.faltantes.join(", ")}.</p></div></div>
    </div>}

    <section className="rounded-lg border border-xango-border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-xango-primary text-white"><UserRound size={22}/></div>
          <div><h2 className="text-2xl font-semibold text-xango-text">{paciente.nomeSocial||paciente.nome}</h2>{paciente.nomeSocial&&<p className="mt-1 text-xs text-xango-muted">Nome civil: {paciente.nome}</p>}
            <div className="mt-2 flex flex-wrap gap-2"><Badge>{paciente.codigoPublico||"Código pendente"}</Badge><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paciente.cadastro.completo?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>Cadastro {paciente.cadastro.percentual}%</span>{paciente.cadastro.menor&&<span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">Menor de idade</span>}</div>
          </div>
        </div>
        <div className="text-right text-xs text-xango-muted"><p>Cadastrado em {dataFormatada(paciente.criadoEm)}</p>{paciente.criadoPor&&<p className="mt-1">Por {paciente.criadoPor.nome}</p>}<p className="mt-1">Atualizado em {dataFormatada(paciente.atualizadoEm)}</p></div>
      </div>
      <div className="mt-6 grid gap-4 border-t border-xango-border pt-5 md:grid-cols-2 xl:grid-cols-4">
        <Info titulo="CPF" valor={cpfFormatado(paciente.cpf)}/><Info titulo="RG" valor={paciente.rg||"Não informado"}/><Info titulo="Nascimento" valor={dataFormatada(paciente.dataNascimento)}/><Info titulo="Nome da mãe" valor={paciente.nomeMae||"Não informado"}/>
        <Info titulo="Telefone" valor={telefoneFormatado(paciente.telefone)} icone={<Phone size={14}/>}/><Info titulo="Outro telefone" valor={telefoneFormatado(paciente.telefoneSecundario)} icone={<Phone size={14}/>}/><Info titulo="E-mail" valor={paciente.email||"Não informado"} icone={<Mail size={14}/>}/>
      </div>
      <div className="mt-5 border-t border-xango-border pt-5"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-xango-muted">Endereço</p><div className="flex gap-2 text-sm text-xango-text"><MapPin size={16} className="mt-0.5 shrink-0 text-xango-muted"/><span>{paciente.logradouro?`${paciente.logradouro}, ${paciente.numeroEndereco||"s/n"}${paciente.complementoEndereco?` - ${paciente.complementoEndereco}`:""} • ${paciente.bairro||""} • ${paciente.cidade||""}/${paciente.uf||""} • CEP ${paciente.cep||"não informado"}`:"Não informado"}</span></div></div>
      {paciente.cadastro.menor&&<div className="mt-5 border-t border-xango-border pt-5"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-xango-muted">Responsável legal</p><p className="text-sm text-xango-text">{paciente.responsavelLegalEhMae?`${paciente.nomeMae||"Mãe"} — mãe e responsável legal`:`${paciente.responsavelLegalNome||"Não informado"}${paciente.responsavelLegalParentesco?` — ${paciente.responsavelLegalParentesco}`:""}`}</p></div>}
    </section>

    <section className="mt-4 rounded-lg border border-xango-border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-xango-border px-5 py-4"><div><h3 className="flex items-center gap-2 font-semibold text-xango-text"><UsersRound size={18}/>Familiares</h3><p className="mt-1 text-xs text-xango-muted">Vínculos familiares do paciente.</p></div><button onClick={()=>void abrirFamilia()} className="flex items-center gap-2 rounded-md bg-xango-primary px-3 py-2 text-xs font-semibold text-white"><Plus size={14}/>Vincular familiar</button></div>
      {paciente.familiares.length===0?<div className="px-5 py-7 text-sm text-xango-muted">Nenhum familiar vinculado.</div>:<div className="divide-y divide-xango-border">{paciente.familiares.map(v=><div key={v.id} className="flex items-center justify-between gap-3 px-5 py-4"><button onClick={()=>router.push(`/pacientes/${v.paciente.id}`)} className="text-left"><p className="font-medium text-xango-text">{v.paciente.nomeSocial||v.paciente.nome}</p><p className="mt-1 text-xs text-xango-muted">{LABEL_TIPO[v.tipo]||v.tipo} • {v.paciente.codigoPublico||cpfFormatado(v.paciente.cpf)}</p></button><div className="flex items-center gap-3">{v.removivel?<button onClick={()=>void encerrarVinculo(v)} className="text-xs font-semibold text-red-600">Encerrar vínculo</button>:<span className="text-xs text-xango-muted">Vínculo permanente</span>}<ChevronRight size={17} className="text-xango-muted"/></div></div>)}</div>}
    </section>

    <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><Resumo titulo="Atendimentos" valor={String(paciente.resumo.totalAtendimentos)} icone={<ClipboardList size={18}/>}/><Resumo titulo="Procedimentos" valor={String(procedimentos)} icone={<Stethoscope size={18}/>}/><Resumo titulo="Próximos agendamentos" valor={String(paciente.resumo.proximosAgendamentos)} icone={<CalendarClock size={18}/>}/><Resumo titulo="Saldo pendente" valor={moeda(paciente.resumo.saldoPendente)} icone={<WalletCards size={18}/>} alerta={paciente.resumo.saldoPendente>0||paciente.resumo.possuiEstornoPendente}/></section>

    <section className="mt-4 rounded-lg border border-xango-border bg-white shadow-sm"><div className="border-b border-xango-border px-5 py-4"><h3 className="font-semibold text-xango-text">Próximos agendamentos</h3></div>{paciente.agendamentosFuturos.length===0?<div className="px-5 py-8 text-sm text-xango-muted">Nenhum agendamento futuro.</div>:<div className="divide-y divide-xango-border">{paciente.agendamentosFuturos.map((a,i)=><button key={`${a.guiaId}-${i}`} onClick={()=>router.push(`/atendimentos/${a.atendimentoId}?modo=revisao`)} className="grid w-full gap-3 px-5 py-4 text-left hover:bg-xango-background/60 md:grid-cols-[190px_1fr_1fr_auto]"><div><p className="text-sm font-semibold">{dataHora(a)}</p><p className="mt-1 text-xs text-xango-muted">{a.atendimentoCodigo}</p></div><p className="text-sm">{a.procedimento}</p><div className="flex gap-2"><Building2 size={14}/><p className="text-sm">{a.clinica}</p></div><ChevronRight size={17}/></button>)}</div>}</section>

    <section className="mt-4 overflow-hidden rounded-lg border border-xango-border bg-white shadow-sm"><div className="border-b border-xango-border px-5 py-4"><h3 className="font-semibold text-xango-text">Histórico de atendimentos</h3></div>{paciente.atendimentos.length===0?<div className="px-5 py-10 text-center text-sm text-xango-muted">Este paciente ainda não possui atendimentos.</div>:<div className="divide-y divide-xango-border">{paciente.atendimentos.map(a=><button key={a.id} onClick={()=>router.push(`/atendimentos/${a.id}?modo=revisao`)} className="w-full px-5 py-5 text-left hover:bg-xango-background/60"><div className="flex justify-between"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{a.codigoPublico}</p><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(a.status)}`}>{a.status}</span><span className="text-xs text-xango-muted">{dataFormatada(a.criadoEm)}</span></div><ChevronRight size={18}/></div><div className="mt-3 grid gap-2">{a.guias.map(g=><div key={g.id} className="rounded-md border border-xango-border bg-xango-background/40 px-4 py-3"><div className="flex justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><FileText size={14}/><span className="text-xs font-semibold text-xango-primary">{g.codigoPublico}</span><span className="text-xs text-xango-muted">{g.clinica.nome}</span></div><span className="text-xs font-semibold">{moeda(g.valorFinal)}</span></div></div>)}</div></button>)}</div>}</section>

    {editando&&<Modal titulo="Editar cadastro" fechar={()=>setEditando(false)}>
      <div className="grid gap-4 md:grid-cols-2"><Campo label="Nome completo *" value={String(form.nome||"")} onChange={v=>campo("nome",v)}/><Campo label="Nome social" value={String(form.nomeSocial||"")} onChange={v=>campo("nomeSocial",v)}/><Campo label="CPF *" value={String(form.cpf||"")} onChange={v=>campo("cpf",v)}/><Campo label="RG *" value={String(form.rg||"")} onChange={v=>campo("rg",v)}/><Campo label="Data de nascimento *" type="date" value={String(form.dataNascimento||"")} onChange={v=>campo("dataNascimento",v)}/><Campo label="Nome da mãe *" value={String(form.nomeMae||"")} onChange={v=>campo("nomeMae",v)}/><Campo label="Telefone *" value={String(form.telefone||"")} onChange={v=>campo("telefone",v)}/><Campo label="Outro telefone" value={String(form.telefoneSecundario||"")} onChange={v=>campo("telefoneSecundario",v)}/><Campo label="E-mail" value={String(form.email||"")} onChange={v=>campo("email",v)}/></div>
      <h4 className="mt-6 border-t border-xango-border pt-5 font-semibold">Endereço obrigatório</h4><div className="mt-3 grid gap-4 md:grid-cols-2"><div><Campo label="CEP *" value={String(form.cep||"")} onChange={v=>void buscarCep(v)} placeholder="00000000"/>{buscandoCep&&<p className="mt-1 text-xs text-xango-muted">Buscando CEP...</p>}{!buscandoCep&&cepMensagem&&<p className="mt-1 text-xs text-xango-muted">{cepMensagem}</p>}</div><Campo label="Logradouro *" value={String(form.logradouro||"")} onChange={v=>campo("logradouro",v)}/><Campo label="Número *" value={String(form.numeroEndereco||"")} onChange={v=>campo("numeroEndereco",v)}/><Campo label="Complemento" value={String(form.complementoEndereco||"")} onChange={v=>campo("complementoEndereco",v)}/><Campo label="Bairro *" value={String(form.bairro||"")} onChange={v=>campo("bairro",v)}/><Campo label="Cidade *" value={String(form.cidade||"")} onChange={v=>campo("cidade",v)}/><Campo label="UF *" value={String(form.uf||"")} onChange={v=>campo("uf",v)}/></div>
      {menorForm()&&<div className="mt-6 border-t border-xango-border pt-5"><h4 className="font-semibold">Responsável legal *</h4><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.responsavelLegalEhMae)} onChange={e=>campo("responsavelLegalEhMae",e.target.checked)}/>Responsável legal é a mãe</label>{!form.responsavelLegalEhMae&&<div className="mt-4 grid gap-4 md:grid-cols-2"><Campo label="Nome do responsável *" value={String(form.responsavelLegalNome||"")} onChange={v=>campo("responsavelLegalNome",v)}/><Campo label="CPF do responsável *" value={String(form.responsavelLegalCpf||"")} onChange={v=>campo("responsavelLegalCpf",v)}/><Campo label="Telefone do responsável *" value={String(form.responsavelLegalTelefone||"")} onChange={v=>campo("responsavelLegalTelefone",v)}/><Campo label="Parentesco" value={String(form.responsavelLegalParentesco||"")} onChange={v=>campo("responsavelLegalParentesco",v)}/></div>}</div>}
      <div className="mt-6 flex justify-end gap-2"><button onClick={()=>setEditando(false)} className="rounded-md border px-4 py-2 text-sm">Cancelar</button><button disabled={salvando} onClick={()=>void salvar()} className="rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{salvando?"Salvando...":"Salvar cadastro"}</button></div>
    </Modal>}

    {modalFamilia&&<Modal titulo="Vincular familiar" fechar={()=>setModalFamilia(false)}>
      <Campo label="Pesquisar paciente" value={buscaFamiliar} onChange={setBuscaFamiliar} placeholder="Nome, CPF ou código PAC"/>
      <div className="mt-3 max-h-52 overflow-auto rounded-md border border-xango-border">{candidatos.length===0?<p className="p-4 text-sm text-xango-muted">Nenhum paciente encontrado.</p>:candidatos.map(p=><button key={p.id} onClick={()=>setFamiliarId(String(p.id))} className={`block w-full border-b px-4 py-3 text-left text-sm last:border-0 ${familiarId===String(p.id)?"bg-xango-background":""}`}><span className="font-medium">{p.nome}</span><span className="ml-2 text-xs text-xango-muted">{p.codigoPublico||cpfFormatado(p.cpf)}</span></button>)}</div>
      <label className="mt-4 block text-xs font-semibold text-xango-muted">RELAÇÃO DESTE PACIENTE COM O FAMILIAR</label><select value={tipoVinculo} onChange={e=>setTipoVinculo(e.target.value)} className="mt-1 w-full rounded-md border border-xango-border bg-white px-3 py-2 text-sm">{TIPOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
      <p className="mt-3 text-xs text-xango-muted">Pai, mãe, irmãos e demais vínculos consanguíneos são permanentes. Marido, esposa e companheiro(a) podem ser encerrados sem apagar o histórico.</p>
      <div className="mt-5 flex justify-end gap-2"><button onClick={()=>setModalFamilia(false)} className="rounded-md border px-4 py-2 text-sm">Cancelar</button><button disabled={!familiarId} onClick={()=>void vincular()} className="rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Criar vínculo</button></div>
    </Modal>}
  </div>
}

function Badge({children}:{children:React.ReactNode}){return <span className="rounded-full bg-xango-background px-2.5 py-1 text-xs font-semibold text-xango-primary">{children}</span>}
function Info({titulo,valor,icone}:{titulo:string;valor:string;icone?:React.ReactNode}){return <div><p className="flex items-center gap-1 text-xs font-medium text-xango-muted">{icone}{titulo}</p><p className="mt-1 text-sm font-medium text-xango-text">{valor}</p></div>}
function Resumo({titulo,valor,icone,alerta=false}:{titulo:string;valor:string;icone:React.ReactNode;alerta?:boolean}){return <div className={`rounded-lg border bg-white p-4 shadow-sm ${alerta?"border-amber-300":"border-xango-border"}`}><div className="flex items-center gap-2 text-xango-muted">{icone}<span className="text-xs font-medium">{titulo}</span></div><p className="mt-2 text-xl font-semibold text-xango-text">{valor}</p></div>}
function Campo({label,value,onChange,type="text",placeholder}:{label:string;value:string;onChange:(v:string)=>void;type?:string;placeholder?:string}){return <label className="block"><span className="text-xs font-semibold text-xango-muted">{label}</span><input type={type} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} className="mt-1 w-full rounded-md border border-xango-border bg-white px-3 py-2 text-sm outline-none focus:border-xango-primary"/></label>}
function Modal({titulo,fechar,children}:{titulo:string;fechar:()=>void;children:React.ReactNode}){return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-xl bg-white shadow-xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-xango-border bg-white px-5 py-4"><h3 className="text-lg font-semibold text-xango-text">{titulo}</h3><button onClick={fechar} className="rounded-md p-1 text-xango-muted hover:bg-xango-background"><X size={20}/></button></div><div className="p-5">{children}</div></div></div>}
