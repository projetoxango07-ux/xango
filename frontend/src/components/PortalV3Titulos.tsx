"use client";

import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
const campo = "mt-1 w-full rounded-lg border border-[#CBD5D5] bg-white px-3 py-2.5 text-sm text-[#18383D] outline-none focus:border-[#087681]";
type Tit = { id: number; valorDevido: string; canceladoEm: string | null; convenio: string;
  parcelas: { numero: number; vencimento: string; valorPrevisto: string }[] };
type Exame = { id: number; tipoExame: string; status: string;
  producao: { dataRealizacao: string; nomePacienteDigitado: string; clinica: { id: number; nome: string } };
  titulosFinanceirosV3: Tit[] };
function hojeLocal() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).map((i) => [i.type, i.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function dia(valor: string) { return valor.slice(0, 10).split("-").reverse().join("/"); }
function moeda(valor: string) { return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export default function PortalV3Titulos({ podeEditar }: { podeEditar: boolean }) {
  const [exames, setExames] = useState<Exame[]>([]);
  const [mes, setMes] = useState(hojeLocal().slice(0, 7));
  const [carregando, setCarregando] = useState(true);
  const [emissao, setEmissao] = useState<number | null>(null);
  const [convenio, setConvenio] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valorBaseReal, setValorBaseReal] = useState("");
  const [vencimento, setVencimento] = useState(hojeLocal);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const carregar = useCallback(async () => {
    const r = await fetch(`${API}/terceirizacao/financeiro/titulos-mes`, { credentials: "include", cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || "Erro ao consultar titulos da V3.");
    setMes(d.competencia || hojeLocal().slice(0, 7));
    setExames(Array.isArray(d.exames) ? d.exames : []);
  }, []);
  useEffect(() => { void carregar().catch(e => setErro(e instanceof Error ? e.message : "Falha ao carregar.")).finally(() => setCarregando(false)); }, [carregar]);
  async function gerar() {
    if (emissao === null) return;
    if (!window.confirm("Gerar titulo financeiro e primeira parcela para este exame? Nenhum recebimento sera registrado automaticamente.")) return;
    setSalvando(true); setErro(""); setSucesso("");
    try {
      const r = await fetch(`${API}/terceirizacao/financeiro/titulos`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exameId: emissao, convenio, categoriaAtendimento: categoria,
          valorBaseReal: valorBaseReal || null, vencimento }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || "Falha ao gerar titulo.");
      setSucesso(`Titulo #${d.titulo.id} de ${moeda(d.titulo.valorDevido)} criado. O recebimento ainda nao foi registrado.`);
      setEmissao(null); setValorBaseReal(""); setConvenio(""); setCategoria("");
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao gerar titulo."); }
    finally { setSalvando(false); }
  }
  const ativos = exames.filter(e => e.titulosFinanceirosV3.some(t => !t.canceladoEm));
  return <section className="rounded-xl border border-[#E3E5E1] bg-white p-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-semibold text-[#18383D]">Títulos por exame — competência {mes.split("-").reverse().join("/")}</h3>
      <p className="text-sm text-[#667A7D]">Somente exames do mês atual. Emissão manual com regra vigente na data do exame.</p></div>
      <button type="button" onClick={() => void carregar().catch(e => setErro(e.message))}
        className="rounded-lg border border-[#CBD5D5] px-4 py-2 text-sm text-[#087681]">Atualizar</button>
    </div>
    {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    {sucesso && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{sucesso}</p>}
    <p className="text-xs text-[#667A7D]">{exames.length} exames encontrados · {ativos.length} com título. Exames de outras competências ficam nos Relatórios.</p>
    {carregando ? <p className="text-sm text-[#667A7D]">Carregando exames...</p> : exames.length === 0 ?
      <p className="rounded-lg bg-[#F7F6F2] p-4 text-sm text-[#667A7D]">Nenhum exame produzido na competência atual. Faça um lançamento de teste na Produção para gerar o primeiro título.</p> :
      <div className="overflow-x-auto"><table className="w-full min-w-[710px] text-left text-sm">
        <thead className="border-b text-xs uppercase text-[#667A7D]"><tr><th className="p-2">Realização</th><th className="p-2">Paciente</th><th className="p-2">Clínica / exame</th><th className="p-2">Título</th><th className="p-2">Ação</th></tr></thead>
        <tbody>{exames.map(e => {
          const titulo = e.titulosFinanceirosV3[0];
          return <tr key={e.id} className="border-b align-top">
            <td className="p-2 whitespace-nowrap">{dia(e.producao.dataRealizacao)}</td>
            <td className="p-2">{e.producao.nomePacienteDigitado}</td>
            <td className="p-2">{e.producao.clinica.nome}<div className="text-[#667A7D]">{e.tipoExame}</div></td>
            <td className="p-2">{titulo ? <><b>{moeda(titulo.valorDevido)}</b><div className="text-xs text-[#667A7D]">Venc. {dia(titulo.parcelas[0]?.vencimento || "")} · {titulo.canceladoEm ? "Cancelado" : "Em aberto"}</div></> : "Não gerado"}</td>
            <td className="p-2">{podeEditar && !titulo ? <button type="button" disabled={salvando} onClick={() => {
              setEmissao(e.id); setErro(""); setSucesso(""); setValorBaseReal(""); setConvenio(""); setCategoria("");
              setVencimento(hojeLocal() > e.producao.dataRealizacao.slice(0,10) ? hojeLocal() : e.producao.dataRealizacao.slice(0,10));
            }} className="font-semibold text-[#087681] hover:underline">Gerar título</button> : "—"}</td>
          </tr>;
        })}</tbody>
      </table></div>}
    {emissao !== null && podeEditar && <div className="rounded-lg border border-[#087681] bg-[#F7F6F2] p-4 space-y-3">
      <h4 className="font-semibold text-[#18383D]">Gerar título do exame #{emissao}</h4>
      <p className="text-xs text-[#667A7D]">Convênio e categoria precisam corresponder exatamente à regra vigente. Deixe em branco para regra geral. Para percentual, informe o valor-base real (não apenas referência).</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">Convênio <input className={campo} value={convenio} maxLength={120} onChange={e=>setConvenio(e.target.value)} placeholder="Geral: em branco" /></label>
        <label className="text-sm">Categoria <input className={campo} value={categoria} maxLength={120} onChange={e=>setCategoria(e.target.value)} placeholder="Geral: em branco" /></label>
        <label className="text-sm">Base real para percentual (R$) <input className={campo} value={valorBaseReal} onChange={e=>setValorBaseReal(e.target.value)} type="number" min="0.01" step="0.01" placeholder="Somente se percentual" /></label>
        <label className="text-sm">Vencimento da 1ª parcela <input className={campo} value={vencimento} onChange={e=>setVencimento(e.target.value)} type="date" required /></label>
      </div>
      <div className="flex gap-3">
        <button type="button" disabled={salvando || !vencimento} onClick={() => void gerar()} className="rounded-lg bg-[#087681] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{salvando ? "Gerando..." : "Confirmar geração"}</button>
        <button type="button" disabled={salvando} onClick={() => setEmissao(null)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
      </div>
    </div>}
    <p className="text-xs text-[#667A7D]">Este pacote cria apenas título e primeira parcela em aberto; recebimentos, estornos e parcelamentos adicionais serão implementados em etapa separada.</p>
  </section>;
}
