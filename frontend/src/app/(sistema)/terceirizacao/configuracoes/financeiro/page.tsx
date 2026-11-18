"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
const MODALIDADES = ["ECG", "EEG", "ESPIROMETRIA", "MAPA", "HOLTER"] as const;
const campo = "w-full rounded-md border border-[#CBD5D5] bg-white px-2 py-2 text-sm outline-none focus:border-[#087681]";
type Clinica = { id: number; nome: string };
type Config = { clinicaId: number; tipoExame: string; convenios: string[]; formasPagamento: string[]; prazoDias: number; diasVencimento: number };
type Regra = { id: number; clinicaId: number; tipoExame: string; convenio: string; categoriaAtendimento: string; metodo: "FIXO" | "PERCENTUAL";
  valorFixo: string | null; percentual: string | null; valorCobradoContratado: string | null; inicioVigencia: string; fimVigencia: string | null;
  observacoes: string | null; ativo: boolean; _count: { titulos: number } };
type Linha = { chave: string; tipoExame: string; convenio: string; categoriaAtendimento: string; metodo: "FIXO" | "PERCENTUAL";
  valorCobradoContratado: string; valorFixo: string; percentual: string; observacoes: string; existente: boolean };
function hojeSP() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const inicioData = (v: string) => v.slice(0, 10);
const valorNumero = (valor: string) => Number(valor || 0);
const money = (valor: number) => Number.isFinite(valor) ? valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

export default function TabelaFinanceiraClinicaV3() {
  const { temPermissao } = useAuth();
  const podeEditar = temPermissao("terceirizacao.configuracoes.editar");
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [regras, setRegras] = useState<Regra[]>([]);
  const [clinicaId, setClinicaId] = useState("");
  const [inicioVigencia, setInicioVigencia] = useState(hojeSP);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const resposta = await fetch(`${API}/terceirizacao/configuracoes-financeiro/tabela`, { credentials: "include", cache: "no-store" });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || "Não foi possível carregar a tabela financeira.");
    setClinicas(dados.clinicas || []);
    setConfigs(dados.configuracoes || []);
    setRegras(dados.regras || []);
  }, []);
  useEffect(() => { void carregar().catch((e) => setErro(e instanceof Error ? e.message : String(e))).finally(() => setCarregando(false)); }, [carregar]);
  useEffect(() => {
    const parametro = new URLSearchParams(window.location.search).get("clinicaId");
    if (parametro && clinicas.some((c) => String(c.id) === parametro)) setClinicaId(parametro);
  }, [clinicas]);

  const configsClinica = useMemo(() => configs.filter((c) => String(c.clinicaId) === clinicaId), [configs, clinicaId]);
  const regrasVigentes = useMemo(() => regras.filter((r) => String(r.clinicaId) === clinicaId && r.ativo &&
    inicioData(r.inicioVigencia) <= inicioVigencia && (!r.fimVigencia || inicioData(r.fimVigencia) >= inicioVigencia)),
    [regras, clinicaId, inicioVigencia]);

  useEffect(() => {
    if (!clinicaId) { setLinhas([]); return; }
    const tabela = new Map<string, Linha>();
    const chave = (tipo: string, convenio: string, categoria: string) => `${tipo}\u00b7${convenio}\u00b7${categoria}`;
    function nova(tipo: string, convenio: string, categoria: string, r?: Regra) {
      const k = chave(tipo, convenio, categoria);
      if (!tabela.has(k)) tabela.set(k, {
        chave: k, tipoExame: tipo, convenio, categoriaAtendimento: categoria,
        metodo: r?.metodo || "FIXO", valorCobradoContratado: r?.valorCobradoContratado || "",
        valorFixo: r?.valorFixo || "", percentual: r?.percentual || "", observacoes: r?.observacoes || "", existente: !!r,
      });
    }
    for (const modalidade of MODALIDADES) {
      const config = configsClinica.find((c) => c.tipoExame === modalidade);
      const convenios = config?.convenios.length ? config.convenios : [""];
      for (const convenio of convenios) nova(modalidade, convenio, "");
    }
    for (const r of [...regrasVigentes].sort((a, b) => inicioData(b.inicioVigencia).localeCompare(inicioData(a.inicioVigencia)))) {
      const k = chave(r.tipoExame, r.convenio, r.categoriaAtendimento);
      tabela.set(k, { chave: k, tipoExame: r.tipoExame, convenio: r.convenio,
        categoriaAtendimento: r.categoriaAtendimento, metodo: r.metodo,
        valorCobradoContratado: r.valorCobradoContratado || "", valorFixo: r.valorFixo || "",
        percentual: r.percentual || "", observacoes: r.observacoes || "", existente: true });
    }
    setLinhas([...tabela.values()]);
  }, [clinicaId, inicioVigencia, configsClinica, regrasVigentes]);

  function alterar(chave: string, propriedade: keyof Linha, valor: string) {
    setLinhas((ls) => ls.map((l) => l.chave === chave ? { ...l, [propriedade]: valor } : l));
    setSucesso("");
  }
  function adicionar() {
    const chave = `novo-${Date.now()}-${linhas.length}`;
    setLinhas((ls) => [...ls, { chave, tipoExame: "ECG", convenio: "", categoriaAtendimento: "",
      metodo: "FIXO", valorCobradoContratado: "", valorFixo: "", percentual: "", observacoes: "", existente: false }]);
  }
  function remover(chave: string) {
    setLinhas((ls) => ls.filter((l) => l.chave !== chave));
  }
  const completas = linhas.filter((l) => l.metodo === "FIXO" ? valorNumero(l.valorFixo) > 0 :
    valorNumero(l.percentual) > 0 && valorNumero(l.valorCobradoContratado) > 0);
  const preview = (l: Linha) => {
    const valor = l.metodo === "FIXO" ? valorNumero(l.valorFixo) :
      Math.round(valorNumero(l.valorCobradoContratado) * valorNumero(l.percentual)) / 100;
    return valor > 0 ? money(valor) : "Não configurado";
  };
  async function salvar() {
    setErro(""); setSucesso("");
    if (!clinicaId) { setErro("Selecione a clínica."); return; }
    const parcialmente = linhas.filter((l) => l.metodo === "PERCENTUAL" ?
      (l.percentual.trim() !== "" || l.valorCobradoContratado.trim() !== "") &&
      !(valorNumero(l.percentual) > 0 && valorNumero(l.valorCobradoContratado) > 0) :
      l.valorFixo.trim() !== "" && !(valorNumero(l.valorFixo) > 0));
    if (parcialmente.length) { setErro("Complete os percentuais e valores contratados das linhas preenchidas."); return; }
    if (!completas.length) { setErro("Preencha ao menos um valor para salvar a tabela."); return; }
    if (!window.confirm(`Salvar ${completas.length} regra(s) da clínica para vigência a partir de ${inicioVigencia.split("-").reverse().join("/")}? Títulos já emitidos não serão alterados.`)) return;
    setSalvando(true);
    try {
      const resposta = await fetch(`${API}/terceirizacao/configuracoes-financeiro/tabela`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicaId: Number(clinicaId), inicioVigencia, linhas: completas.map((l) => ({
          tipoExame: l.tipoExame, convenio: l.convenio, categoriaAtendimento: l.categoriaAtendimento,
          metodo: l.metodo, valorCobradoContratado: l.valorCobradoContratado || null,
          valorFixo: l.metodo === "FIXO" ? l.valorFixo : null,
          percentual: l.metodo === "PERCENTUAL" ? l.percentual : null, observacoes: l.observacoes,
        })) }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível salvar a tabela.");
      setSucesso(`Tabela atualizada. ${dados.resumo?.novas ?? 0} novas, ${dados.resumo?.atualizadas ?? 0} atualizadas e ${dados.resumo?.inalteradas ?? 0} sem alteração.`);
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao salvar a tabela."); }
    finally { setSalvando(false); }
  }
  return <div className="space-y-5">
    <Link className="text-sm font-semibold text-[#087681] hover:underline" href="/terceirizacao/configuracoes">Voltar às Configurações</Link>
    <div><h2 className="text-2xl font-semibold text-[#18383D]">Tabela financeira por clínica</h2>
      <p className="mt-1 text-sm text-[#667A7D]">Configure os preços e repasses de vários exames de uma só vez. A tabela é utilizada automaticamente ao enviar exames para laudar.</p></div>
    {erro && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{erro}</p>}
    {sucesso && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{sucesso}</p>}
    <div className="rounded-xl border border-[#E3E5E1] bg-white p-5 space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm font-medium">Clínica da terceirização
          <select className={`${campo} mt-1`} value={clinicaId} onChange={(e) => setClinicaId(e.target.value)}>
            <option value="">Selecione uma clínica</option>{clinicas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select></label>
        <label className="text-sm font-medium">Início da vigência dos preços
          <input className={`${campo} mt-1`} type="date" value={inicioVigencia} onChange={(e) => setInicioVigencia(e.target.value)} /></label>
        <div className="flex items-end gap-2">
          <button className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" type="button" onClick={() => void carregar().catch((e) => setErro(String(e)))}>Atualizar valores</button>
          <Link className="rounded-md border px-3 py-2 text-sm text-[#087681] hover:bg-slate-50" href="/terceirizacao/configuracoes/laudos">Prazos e convênios</Link>
        </div>
      </div>
      {clinicaId && <div className="rounded-lg bg-[#F7F6F2] p-3 text-xs text-[#667A7D]">
        <b>Condições já cadastradas:</b> {configsClinica.length ? configsClinica.map((c) => `${c.tipoExame}: ${c.formasPagamento.join("/")} · venc. +${c.diasVencimento} dias`).join(" | ") :
          "Nenhuma condição de laudo cadastrada. Configure também prazos, convênios e pagamentos."}
      </div>}
      {!clinicaId ? <p className="p-5 text-center text-sm text-[#667A7D]">Selecione uma clínica para montar sua tabela.</p> :
        <><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-[#064E57] text-white"><tr>
            <th className="p-3">Exame</th><th className="p-3">Convênio</th><th className="p-3">Categoria</th>
            <th className="p-3">Valor cobrado (R$)</th><th className="p-3">Repasse</th>
            <th className="p-3">Valor / %</th><th className="p-3">Digna recebe</th><th className="p-3">Ação</th>
          </tr></thead>
          <tbody className="divide-y divide-[#E3E5E1]">{linhas.map((l) => <tr key={l.chave}>
            <td className="p-2"><select aria-label="Exame" className={campo} value={l.tipoExame} onChange={(e) => alterar(l.chave, "tipoExame", e.target.value)} disabled={!podeEditar}>{MODALIDADES.map((m) => <option key={m}>{m}</option>)}</select></td>
            <td className="p-2"><input aria-label="Convênio" className={campo} value={l.convenio} onChange={(e) => alterar(l.chave, "convenio", e.target.value.toUpperCase())} placeholder="GERAL" maxLength={120} disabled={!podeEditar}/></td>
            <td className="p-2"><input aria-label="Categoria" className={campo} value={l.categoriaAtendimento} onChange={(e) => alterar(l.chave, "categoriaAtendimento", e.target.value.toUpperCase())} placeholder="Geral" maxLength={120} disabled={!podeEditar}/></td>
            <td className="p-2"><input aria-label="Valor cobrado contratado" className={campo} type="number" min="0.01" step="0.01" value={l.valorCobradoContratado} onChange={(e) => alterar(l.chave, "valorCobradoContratado", e.target.value)} placeholder="—" disabled={!podeEditar}/></td>
            <td className="p-2"><select aria-label="Método do repasse" className={campo} value={l.metodo} onChange={(e) => alterar(l.chave, "metodo", e.target.value)} disabled={!podeEditar}>
              <option value="FIXO">Fixo</option><option value="PERCENTUAL">Percentual</option></select></td>
            <td className="p-2"><input aria-label={l.metodo === "FIXO" ? "Valor fixo Digna" : "Percentual Digna"} className={campo} type="number" min="0.01" step={l.metodo === "FIXO" ? "0.01" : "0.0001"} max={l.metodo === "PERCENTUAL" ? 100 : undefined}
              value={l.metodo === "FIXO" ? l.valorFixo : l.percentual} onChange={(e) => alterar(l.chave, l.metodo === "FIXO" ? "valorFixo" : "percentual", e.target.value)}
              placeholder={l.metodo === "FIXO" ? "R$" : "%"} disabled={!podeEditar}/></td>
            <td className="p-2 font-semibold text-[#087681]">{preview(l)}</td>
            <td className="p-2">{podeEditar && !l.existente ? <button type="button" className="text-red-700 hover:underline" onClick={() => remover(l.chave)}>Remover</button> : l.existente ? <span className="text-xs text-slate-500">Registrada</span> : "—"}</td>
          </tr>)}</tbody></table></div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#667A7D]">Linhas sem repasse preenchido não geram novas regras. Linhas já cadastradas não são excluídas por ausência da tabela; edições geram nova vigência quando necessário.</p>
            <div className="flex gap-3">{podeEditar && <button type="button" className="rounded-md border px-4 py-2 text-sm font-semibold" onClick={adicionar}>+ Outra combinação</button>}
              {podeEditar && <button type="button" disabled={salvando || !completas.length} onClick={() => void salvar()}
                className="rounded-md bg-[#087681] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">{salvando ? "Salvando..." : `Salvar tabela financeira (${completas.length})`}</button>}</div>
          </div></>}
      {carregando && <p className="text-sm text-[#667A7D]">Carregando configurações...</p>}
    </div>
    <div className="rounded-xl border border-[#E3E5E1] bg-white p-5 text-sm text-[#667A7D] space-y-2">
      <p><b>Como funciona:</b> para percentual, informe o valor cobrado contratado e o percentual da Digna. Para repasse fixo, informe diretamente o valor devido à Digna.</p>
      <p>Ao enviar para laudar, o título usa a regra válida na data de realização do exame, com convênio específico quando houver e regra geral como alternativa. Não será necessário digitar valores na tela de Laudos.</p>
      <p>Alterações não recalculam títulos já emitidos. Para condições excepcionais, a edição de títulos continua exclusiva do administrador, com justificativa e histórico.</p>
      <Link className="font-semibold text-[#087681] hover:underline" href="/terceirizacao/financeiro">Consultar títulos financeiros</Link>
    </div>
  </div>;
}
