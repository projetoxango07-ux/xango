"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
const campo = "mt-1 w-full rounded-md border border-[#CBD5D5] bg-white px-3 py-2 text-sm";
type Config = { clinicaId: number; tipoExame: string; prazoDias: number; marcoPrazo: string;
  convenios: string[]; formasPagamento: string[]; diasVencimento: number };
type Dados = { clinicas: { id: number; nome: string }[]; configuracoes: Config[]; modalidades: string[] };
export default function ConfigLaudosV3() {
  const { temPermissao } = useAuth();
  const podeEditar = temPermissao("terceirizacao.configuracoes.editar");
  const [dados, setDados] = useState<Dados>({ clinicas: [], configuracoes: [], modalidades: ["ECG","EEG","ESPIROMETRIA","MAPA","HOLTER"] });
  const [clinicaId, setClinicaId] = useState("");
  const [tipoExame, setTipoExame] = useState("ECG");
  const [prazoDias, setPrazoDias] = useState("");
  const [marcoPrazo, setMarcoPrazo] = useState("REALIZACAO");
  const [diasVencimento, setDiasVencimento] = useState("0");
  const [convenios, setConvenios] = useState("");
  const [formasPagamento, setFormasPagamento] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(""); const [ok, setOk] = useState("");
  const carregar = useCallback(async () => {
    const r = await fetch(`${API}/terceirizacao/configuracoes-laudos`, { credentials: "include", cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || "Não foi possível consultar as configurações.");
    setDados({ clinicas: j.clinicas || [], configuracoes: j.configuracoes || [], modalidades: j.modalidades || [] });
  }, []);
  useEffect(() => { void carregar().catch((e) => setErro(String(e))); }, [carregar]);
  const atual = useMemo(() => dados.configuracoes.find((x) => String(x.clinicaId) === clinicaId && x.tipoExame === tipoExame), [dados,clinicaId,tipoExame]);
  useEffect(() => {
    setPrazoDias(atual ? String(atual.prazoDias) : "");
    setMarcoPrazo(atual?.marcoPrazo || "REALIZACAO");
    setDiasVencimento(atual ? String(atual.diasVencimento) : "0");
    setConvenios(atual?.convenios.join(", ") || "");
    setFormasPagamento(atual?.formasPagamento.join(", ") || "");
  }, [atual]);
  const lista = (s: string) => s.split(/[,\n;]/).map((x) => x.trim()).filter(Boolean);
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(""); setOk(""); setSalvando(true);
    try {
      const r = await fetch(`${API}/terceirizacao/configuracoes-laudos`, { method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          clinicaId: Number(clinicaId), tipoExame, prazoDias: Number(prazoDias),
          marcoPrazo, diasVencimento: Number(diasVencimento),
          convenios: lista(convenios), formasPagamento: lista(formasPagamento),
        }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || "Falha ao salvar.");
      setOk("Parâmetros salvos. Laudos e títulos históricos não foram alterados."); await carregar();
    } catch(e) { setErro(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { setSalvando(false); }
  }
  return <div className="space-y-5">
    <Link className="text-sm font-semibold text-[#087681] hover:underline" href="/terceirizacao/configuracoes">Voltar às Configurações</Link>
    <div><h2 className="text-2xl font-semibold text-[#18383D]">Prazos e condições dos laudos</h2>
      <p className="mt-1 text-sm text-slate-600">Configure cada combinação clínica/exame antes do primeiro envio. Dias corridos; valores não são calculados aqui.</p></div>
    {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
    {ok && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{ok}</p>}
    <form onSubmit={(e) => void salvar(e)} className="rounded-xl border bg-white p-5 space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium">Clínica parceira *
          <select className={campo} required value={clinicaId} onChange={(e) => setClinicaId(e.target.value)}>
            <option value="">Selecione</option>{dados.clinicas.map((c) => <option value={c.id} key={c.id}>{c.nome}</option>)}
          </select></label>
        <label className="text-sm font-medium">Exame *
          <select className={campo} value={tipoExame} onChange={(e) => setTipoExame(e.target.value)}>
            {dados.modalidades.map((m) => <option key={m}>{m}</option>)}
          </select></label>
        <label className="text-sm font-medium">Prazo padrão (dias corridos) *
          <input required className={campo} type="number" min="0" max="180" value={prazoDias} onChange={(e) => setPrazoDias(e.target.value)}/></label>
        <label className="text-sm font-medium">Contar o prazo a partir de *
          <select className={campo} value={marcoPrazo} onChange={(e) => setMarcoPrazo(e.target.value)}>
            <option value="REALIZACAO">Data de realização</option><option value="ENVIO">Data de envio para laudar</option>
          </select></label>
        <label className="text-sm font-medium md:col-span-2">Convênios disponíveis (separados por vírgula)
          <input className={campo} value={convenios} onChange={(e) => setConvenios(e.target.value)} placeholder="Ex.: SUS, PARTICULAR, OCI (vazio = regra geral)" /></label>
        <label className="text-sm font-medium md:col-span-2">Formas de pagamento disponíveis (separadas por vírgula) *
          <input required className={campo} value={formasPagamento} onChange={(e) => setFormasPagamento(e.target.value)} placeholder="Ex.: FATURAMENTO, PIX, BOLETO" /></label>
        <label className="text-sm font-medium">Prazo contratual até o vencimento (dias após realização)
          <input required className={campo} type="number" min="0" max="365" value={diasVencimento} onChange={(e) => setDiasVencimento(e.target.value)} /></label>
      </div>
      <p className="text-xs text-slate-600">Deixar convênios em branco permite somente a opção geral. Para alterar a unidade de entrega, ela deve existir no cadastro da clínica. O vencimento da cobrança é independente da previsão do laudo.</p>
      {podeEditar && <button type="submit" disabled={salvando || !clinicaId} className="rounded-lg bg-[#087681] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{salvando ? "Salvando..." : "Salvar parâmetros"}</button>}
    </form>
    <section className="rounded-xl border bg-white p-5"><h3 className="font-semibold">Parâmetros cadastrados</h3>
      <div className="mt-3 space-y-2">{dados.configuracoes.map((c) => <div key={`${c.clinicaId}-${c.tipoExame}`} className="flex flex-wrap justify-between gap-2 border-b pb-2 text-sm">
        <span><b>{dados.clinicas.find((x) => x.id === c.clinicaId)?.nome || `Clínica ${c.clinicaId}`}</b> · {c.tipoExame}</span>
        <span>{c.prazoDias} dias ({c.marcoPrazo === "ENVIO" ? "envio" : "realização"}) · vencimento +{c.diasVencimento} dias · {c.formasPagamento.join(", ")}</span>
      </div>)}{dados.configuracoes.length === 0 && <p className="text-sm text-slate-500">Nenhuma configuração cadastrada.</p>}</div>
    </section>
  </div>;
}
