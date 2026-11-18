"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
type Uso = { id: number; retiradaPrevista: string | null; retiradoEm: string | null;
  exame: { producao: { nomePacienteDigitado: string; dataRealizacao: string; clinica: { nome: string } } } };
type Equipamento = { id: number; codigo: string; tipo: string; ativo: boolean; usos: Uso[] };
function dataBR(valor: string | null) { return valor ? valor.slice(0, 10).split("-").reverse().join("/") : "—"; }
const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
export default function EquipamentosV3Page() {
  const { temPermissao } = useAuth();
  const podeEditar = temPermissao("terceirizacao.equipamentos.editar");
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [codigo, setCodigo] = useState("");
  const [filtroLista, setFiltroLista] = useState("");
  useEffect(() => { const termo = new URLSearchParams(window.location.search).get("busca"); if (termo) setFiltroLista(termo.slice(0, 80)); }, []);
  const [tipo, setTipo] = useState("MAPA");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const carregar = useCallback(async () => {
    const r = await fetch(`${API}/terceirizacao/equipamentos`, { credentials: "include" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || "Nao foi possivel consultar equipamentos.");
    setEquipamentos(d.equipamentos ?? []);
  }, []);
  useEffect(() => { carregar().catch((e) => setErro(String(e))).finally(() => setCarregando(false)); }, [carregar]);
  async function enviar(rota: string, metodo: "POST" | "PATCH", corpo?: object) {
    setErro("");setMensagem("");setOcupado(true);
    try {
      const r = await fetch(`${API}/terceirizacao/${rota}`, { method: metodo, credentials: "include", headers: { "Content-Type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || "Operacao nao concluida.");
      setMensagem(d.mensagem || "Operacao concluida.");setCodigo("");await carregar();
    } catch(e) { setErro(e instanceof Error ? e.message : "Falha de conexao."); }
    finally { setOcupado(false); }
  }
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-semibold">Equipamentos MAPA e Holter</h2><p className="mt-1 text-sm text-slate-500">Veja quem está com cada aparelho e registre a retirada e o descarregamento.</p></div>
    {erro && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div>}
    {mensagem && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{mensagem}</div>}
    {podeEditar && <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="mb-3 font-semibold">Cadastrar aparelho</h3><div className="flex flex-wrap items-end gap-3"><label className="min-w-44 flex-1 text-sm font-medium">Código <input className={`${input} mt-1`} placeholder="Ex.: HOLTER 07" value={codigo} onChange={(e) => setCodigo(e.target.value)}/></label><label className="text-sm font-medium">Tipo <select className={`${input} mt-1`} value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="MAPA">MAPA</option><option value="HOLTER">Holter</option></select></label><button disabled={ocupado || !codigo.trim()} onClick={()=>enviar("equipamentos", "POST", {codigo,tipo})} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Cadastrar</button></div></section>}
    <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Aparelhos cadastrados</h3><button onClick={()=>carregar().catch((e)=>setErro(String(e)))} className="text-sm text-emerald-700 hover:underline">Atualizar</button></div>
      <label className="mb-4 block max-w-md text-sm font-medium text-[#18383D]">Filtrar equipamentos
        <input className={`${input} mt-1`} placeholder="Código, tipo, paciente ou clínica" value={filtroLista} onChange={(e) => setFiltroLista(e.target.value)} />
      </label>
      {carregando ? <p className="text-sm text-slate-500">Carregando...</p> : equipamentos.length === 0 ? <p className="text-sm text-slate-500">Nenhum aparelho cadastrado na V3.</p> :
      <div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3">Aparelho</th><th>Paciente e clínica</th><th>Retirada prevista</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{equipamentos.filter((e) => `${e.codigo} ${e.tipo} ${e.usos[0]?.exame.producao.nomePacienteDigitado || ""} ${e.usos[0]?.exame.producao.clinica.nome || ""}`.toLocaleLowerCase("pt-BR").includes(filtroLista.toLocaleLowerCase("pt-BR").trim())).map((e)=>{ const uso=e.usos[0]; return <tr key={e.id} className="border-b align-top last:border-0"><td className="py-3"><b>{e.codigo}</b><span className="block text-xs text-slate-500">{e.tipo}</span></td><td>{uso ? <>{uso.exame.producao.nomePacienteDigitado}<span className="block text-xs text-slate-500">{uso.exame.producao.clinica.nome}</span></> : "—"}</td><td>{uso ? dataBR(uso.retiradaPrevista) : "—"}</td><td>{!e.ativo ? "Inativo" : !uso ? "Disponível" : uso.retiradoEm ? "Aguardando descarregamento" : "Em uso"}</td><td>{uso && podeEditar && <button disabled={ocupado} className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs text-emerald-800 disabled:opacity-40" onClick={()=>enviar(`usos/${uso.id}/${uso.retiradoEm ? "descarregamento" : "retirada"}`, "PATCH")}>{uso.retiradoEm ? "Confirmar descarregamento" : "Registrar retirada"}</button>}</td></tr>;})}</tbody></table></div>}
    </section>
    <p className="text-xs text-slate-500">A liberação para nova instalação acontece somente após a retirada e a confirmação do descarregamento.</p>
  </div>;
}
