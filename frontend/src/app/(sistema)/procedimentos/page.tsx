"use client";

import {
  Building2,
  Calculator,
  ChevronRight,
  FlaskConical,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Stethoscope,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type Unidade = {
  id: number;
  nome: string;
  cidade: string | null;
  uf: string | null;
};

type Clinica = {
  id: number;
  nome: string;
  ativo: boolean;
  tipoEstabelecimento: "CLINICA" | "LABORATORIO_ANALISES_CLINICAS";
  tipoPrecificacao: "INDIVIDUAL" | "CH";
  valorChRepasse: number | null;
  valorChPaciente: number | null;
  unidades: Unidade[];
};

type PrecoClinica = {
  id: number;
  clinicaId: number;
  procedimentoId: number;
  valorPaciente: number;
  valorRepasse: number;
  margemReais: number;
  margemPercentual: number;
  modoPreco: "FIXO" | "CH";
  ativo: boolean;
  clinica: Clinica;
};

type PrecoUnidade = {
  id: number;
  unidadeClinicaId: number;
  procedimentoId: number;
  valorPaciente: number;
  valorRepasse: number;
  margemReais: number;
  margemPercentual: number;
  ativo: boolean;
  unidadeClinica: {
    id: number;
    nome: string;
    clinicaId: number;
    cidade: string | null;
    uf: string | null;
    ativo: boolean;
    clinica: { id: number; nome: string; ativo: boolean };
  };
};

type Procedimento = {
  id: number;
  nome: string;
  categoria: string | null;
  preparo: string | null;
  aliases: string[];
  codigoTuss: string | null;
  nomeTuss: string | null;
  quantidadeCh: number | null;
  ativo: boolean;
  precos: PrecoClinica[];
  precosUnidade: PrecoUnidade[];
};

type ReferenciaMestre = {
  id: number;
  codigoTuss: string;
  nomeTuss: string;
  quantidadeCh: number | null;
  fonteCh: string | null;
  versaoReferencia: string | null;
};

type Formulario = {
  nome: string;
  categoria: string;
  codigoTuss: string;
  nomeTuss: string;
  quantidadeCh: string;
  aliases: string;
  preparo: string;
};

const formularioVazio: Formulario = {
  nome: "",
  categoria: "",
  codigoTuss: "",
  nomeTuss: "",
  quantidadeCh: "",
  aliases: "",
  preparo: "",
};

function dinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function badgeStatus(ativo: boolean) {
  return ativo
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-slate-100 text-slate-600 ring-slate-200";
}

export default function ProcedimentosPage() {
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("TODAS");
  const [status, setStatus] = useState<"TODOS" | "ATIVOS" | "INATIVOS">("ATIVOS");
  const [tuss, setTuss] = useState<"TODOS" | "VINCULADOS" | "SEM_TUSS">("TODOS");
  const [selecionado, setSelecionado] = useState<Procedimento | null>(null);
  const [modal, setModal] = useState<"NOVO" | "EDITAR" | null>(null);
  const [form, setForm] = useState<Formulario>(formularioVazio);
  const [salvando, setSalvando] = useState(false);
  const [mensagemModal, setMensagemModal] = useState("");
  const [confirmarMesmoAssim, setConfirmarMesmoAssim] = useState(false);
  const [baseAberta, setBaseAberta] = useState(false);
  const [buscaBase, setBuscaBase] = useState("");
  const [resultadosBase, setResultadosBase] = useState<ReferenciaMestre[]>([]);
  const [buscandoBase, setBuscandoBase] = useState(false);
  const [referenciaBase, setReferenciaBase] = useState<ReferenciaMestre | null>(null);
  const [nomeDignaBase, setNomeDignaBase] = useState("");
  const [categoriaBase, setCategoriaBase] = useState("");
  const [aliasesBase, setAliasesBase] = useState("");
  const [preparoBase, setPreparoBase] = useState("");
  const [mensagemBase, setMensagemBase] = useState("");
  const [salvandoBase, setSalvandoBase] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const resposta = await fetch(`${API_URL}/procedimentos/catalogo`, {
        cache: "no-store",
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Erro ao carregar procedimentos.");
      setProcedimentos(dados);
      setSelecionado((atual) =>
        atual ? dados.find((p: Procedimento) => p.id === atual.id) || null : null
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os procedimentos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void carregar(); }, 0);
    return () => clearTimeout(timer);
  }, [carregar]);

  useEffect(() => {
    if (!baseAberta || buscaBase.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBuscandoBase(true);
      try {
        const resposta = await fetch(
          `${API_URL}/referencias-procedimentos?busca=${encodeURIComponent(buscaBase)}&limite=60`,
          { signal: controller.signal }
        );
        const dados = await resposta.json();
        if (resposta.ok) setResultadosBase(Array.isArray(dados) ? dados : []);
      } finally {
        setBuscandoBase(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [baseAberta, buscaBase]);

  function abrirBaseMestre() {
    setBaseAberta(true);
    setBuscaBase("");
    setResultadosBase([]);
    setReferenciaBase(null);
    setNomeDignaBase("");
    setCategoriaBase("");
    setAliasesBase("");
    setPreparoBase("");
    setMensagemBase("");
  }

  function escolherBase(ref: ReferenciaMestre) {
    setReferenciaBase(ref);
    setNomeDignaBase(ref.nomeTuss);
    setMensagemBase("");
  }

  async function adicionarDaBase() {
    if (!referenciaBase) return;
    setSalvandoBase(true);
    setMensagemBase("");
    try {
      const resposta = await fetch(`${API_URL}/procedimentos/da-referencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenciaId: referenciaBase.id,
          nome: nomeDignaBase,
          categoria: categoriaBase,
          aliases: aliasesBase.split(/\n|,/).map((v) => v.trim()).filter(Boolean),
          preparo: preparoBase,
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível adicionar.");
      setBaseAberta(false);
      await carregar();
    } catch (e) {
      setMensagemBase(e instanceof Error ? e.message : "Não foi possível adicionar.");
    } finally {
      setSalvandoBase(false);
    }
  }

  const categorias = useMemo(
    () =>
      Array.from(
        new Set(
          procedimentos
            .map((p) => p.categoria)
            .filter((v): v is string => Boolean(v))
        )
      ).sort(),
    [procedimentos]
  );

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    return procedimentos.filter((p) => {
      if (status === "ATIVOS" && !p.ativo) return false;
      if (status === "INATIVOS" && p.ativo) return false;
      if (categoria !== "TODAS" && p.categoria !== categoria) return false;
      if (tuss === "VINCULADOS" && !p.codigoTuss) return false;
      if (tuss === "SEM_TUSS" && p.codigoTuss) return false;
      if (!termo) return true;

      const campos = [
        p.nome,
        p.codigoTuss || "",
        p.nomeTuss || "",
        p.categoria || "",
        ...p.aliases,
      ];
      return campos.some((campo) => normalizar(campo).includes(termo));
    });
  }, [procedimentos, busca, categoria, status, tuss]);

  const abrirNovo = () => {
    setForm(formularioVazio);
    setConfirmarMesmoAssim(false);
    setMensagemModal("");
    setModal("NOVO");
  };

  const abrirEditar = (p: Procedimento) => {
    setForm({
      nome: p.nome,
      categoria: p.categoria || "",
      codigoTuss: p.codigoTuss || "",
      nomeTuss: p.nomeTuss || "",
      quantidadeCh: p.quantidadeCh === null ? "" : String(p.quantidadeCh).replace(".", ","),
      aliases: p.aliases.join("\n"),
      preparo: p.preparo || "",
    });
    setSelecionado(p);
    setConfirmarMesmoAssim(false);
    setMensagemModal("");
    setModal("EDITAR");
  };

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMensagemModal("");
    try {
      const payload = {
        nome: form.nome,
        categoria: form.categoria,
        codigoTuss: form.codigoTuss,
        nomeTuss: form.nomeTuss,
        quantidadeCh: form.quantidadeCh,
        aliases: form.aliases
          .split(/\n|,/)
          .map((v) => v.trim())
          .filter(Boolean),
        preparo: form.preparo,
        confirmarMesmoAssim,
      };

      const editando = modal === "EDITAR" && selecionado;
      const resposta = await fetch(
        editando
          ? `${API_URL}/procedimentos/${selecionado.id}`
          : `${API_URL}/procedimentos`,
        {
          method: editando ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const dados = await resposta.json();

      if (!resposta.ok) {
        if (dados.tipo === "POSSIVEL_DUPLICIDADE") {
          setConfirmarMesmoAssim(true);
          const nomes = (dados.candidatos || [])
            .map((c: { nome: string }) => c.nome)
            .slice(0, 3)
            .join(", ");
          setMensagemModal(
            `Possível duplicidade: ${nomes}. Confira os dados e clique novamente em Salvar para cadastrar mesmo assim.`
          );
          return;
        }
        throw new Error(dados.erro || "Não foi possível salvar.");
      }

      setModal(null);
      await carregar();
      if (dados.id) {
        setSelecionado((atual) => atual?.id === dados.id ? { ...atual, ...dados } : atual);
      }
    } catch (e) {
      setMensagemModal(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function desativar(p: Procedimento) {
    if (!window.confirm(`Desativar "${p.nome}"? O histórico será preservado.`)) return;
    try {
      const resposta = await fetch(`${API_URL}/procedimentos/${p.id}`, {
        method: "DELETE",
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível desativar.");
      setSelecionado(null);
      await carregar();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Não foi possível desativar.");
    }
  }

  const clinicasAtivas = (p: Procedimento) =>
    p.precos.filter((preco) => preco.ativo && preco.clinica.ativo);

  return (
    <div className="mx-auto max-w-375 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-xango-text">Procedimentos</h1>
          <p className="mt-1 text-sm text-xango-muted">
            Catálogo central, nomenclatura TUSS, CH e comparação de preços.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={abrirBaseMestre} className="inline-flex items-center gap-2 rounded-lg bg-xango-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-xango-primary-hover">
            <Search size={17} /> Pesquisar Base TUSS
          </button>
          <button onClick={abrirNovo} className="inline-flex items-center gap-2 rounded-lg border border-xango-border bg-white px-4 py-2.5 text-sm font-semibold text-xango-primary">
            <Plus size={17} /> Cadastro manual
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-xango-border bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px_180px]">
          <label className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={17} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, sinônimo, TUSS ou categoria..."
              className="w-full rounded-lg border border-xango-border py-2.5 pl-10 pr-3 text-sm outline-none focus:border-xango-primary"
            />
          </label>

          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="rounded-lg border border-xango-border px-3 py-2.5 text-sm outline-none"
          >
            <option value="TODAS">Todas as categorias</option>
            {categorias.map((item) => <option key={item}>{item}</option>)}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-lg border border-xango-border px-3 py-2.5 text-sm outline-none"
          >
            <option value="ATIVOS">Ativos</option>
            <option value="INATIVOS">Inativos</option>
            <option value="TODOS">Todos</option>
          </select>

          <select
            value={tuss}
            onChange={(e) => setTuss(e.target.value as typeof tuss)}
            className="rounded-lg border border-xango-border px-3 py-2.5 text-sm outline-none"
          >
            <option value="TODOS">Todos — TUSS</option>
            <option value="VINCULADOS">Com TUSS</option>
            <option value="SEM_TUSS">Sem TUSS</option>
          </select>
        </div>
      </div>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-xango-border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-270 w-full text-left text-sm">
            <thead className="border-b border-xango-border bg-slate-50 text-xs uppercase tracking-wide text-xango-muted">
              <tr>
                <th className="px-4 py-3">Procedimento</th>
                <th className="px-4 py-3">TUSS</th>
                <th className="px-4 py-3">CH</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Clínicas</th>
                <th className="px-4 py-3">Status</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-xango-border">
              {carregando ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-xango-muted">Carregando procedimentos...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-xango-muted">Nenhum procedimento encontrado.</td></tr>
              ) : (
                filtrados.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelecionado(p)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-xango-text">{p.nome}</div>
                      {p.aliases.length > 0 && (
                        <div className="mt-1 max-w-xl truncate text-xs text-xango-muted">
                          {p.aliases.slice(0, 3).join(" • ")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.codigoTuss ? (
                        <div>
                          <div className="font-medium text-xango-text">{p.codigoTuss}</div>
                          {p.nomeTuss && <div className="mt-1 max-w-xs truncate text-xs text-xango-muted">{p.nomeTuss}</div>}
                        </div>
                      ) : <span className="text-xs text-slate-400">Não vinculado</span>}
                    </td>
                    <td className="px-4 py-3 font-medium">{p.quantidadeCh ?? "—"}</td>
                    <td className="px-4 py-3">{p.categoria || "—"}</td>
                    <td className="px-4 py-3">{clinicasAtivas(p).length}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badgeStatus(p.ativo)}`}>
                        {p.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right"><ChevronRight size={18} className="text-slate-400" /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!carregando && (
        <div className="text-xs text-xango-muted">
          Exibindo {filtrados.length} procedimento{filtrados.length === 1 ? "" : "s"}.
        </div>
      )}

      {selecionado && !modal && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/25" onMouseDown={() => setSelecionado(null)}>
          <aside
            className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-5 flex items-start justify-between border-b border-xango-border bg-white px-6 py-5">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-xango-muted">Procedimento</div>
                <h2 className="mt-1 text-xl font-semibold text-xango-text">{selecionado.nome}</h2>
              </div>
              <button onClick={() => setSelecionado(null)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoCard titulo="TUSS" valor={selecionado.codigoTuss || "Não vinculado"} icone={<Stethoscope size={18} />} />
                <InfoCard titulo="CH" valor={selecionado.quantidadeCh === null ? "Não informado" : String(selecionado.quantidadeCh)} icone={<Calculator size={18} />} />
                <InfoCard titulo="Categoria" valor={selecionado.categoria || "Sem categoria"} icone={<SlidersHorizontal size={18} />} />
              </div>

              {selecionado.nomeTuss && (
                <section className="rounded-xl border border-xango-border p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-xango-muted">Nomenclatura oficial TUSS</div>
                  <div className="mt-2 text-sm font-medium text-xango-text">{selecionado.nomeTuss}</div>
                </section>
              )}

              {selecionado.aliases.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-xango-text">Sinônimos / aliases</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selecionado.aliases.map((alias) => (
                      <span key={alias} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{alias}</span>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-xango-text">Clínicas e preços</h3>
                    <p className="mt-0.5 text-xs text-xango-muted">Comparação do preço-base e exceções por unidade.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {clinicasAtivas(selecionado).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-xango-border p-5 text-sm text-xango-muted">
                      Este procedimento ainda não está ativo na tabela de nenhuma clínica.
                    </div>
                  ) : (
                    clinicasAtivas(selecionado).map((preco) => {
                      const excecoes = selecionado.precosUnidade.filter(
                        (u) => u.ativo && u.unidadeClinica.ativo && u.unidadeClinica.clinicaId === preco.clinicaId
                      );
                      return (
                        <div key={preco.id} className="rounded-xl border border-xango-border p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 font-semibold text-xango-text">
                                {preco.clinica.tipoEstabelecimento === "LABORATORIO_ANALISES_CLINICAS"
                                  ? <FlaskConical size={17} />
                                  : <Building2 size={17} />}
                                {preco.clinica.nome}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-slate-100 px-2 py-1">
                                  {preco.modoPreco === "CH" ? "Calculado por CH" : "Preço fixo"}
                                </span>
                                {preco.clinica.tipoPrecificacao === "CH" && (
                                  <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">
                                    Laboratório CH
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-xango-text">{dinheiro(preco.valorPaciente)}</div>
                              <div className="text-xs text-xango-muted">Paciente</div>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                            <div><div className="text-xs text-xango-muted">Repasse</div><div className="font-medium">{dinheiro(preco.valorRepasse)}</div></div>
                            <div><div className="text-xs text-xango-muted">Margem</div><div className="font-medium">{dinheiro(preco.margemReais)}</div></div>
                            <div><div className="text-xs text-xango-muted">Margem %</div><div className="font-medium">{preco.margemPercentual.toFixed(1)}%</div></div>
                          </div>

                          {preco.modoPreco === "CH" && selecionado.quantidadeCh !== null && (
                            <div className="mt-3 text-xs text-xango-muted">
                              {selecionado.quantidadeCh} CH × {dinheiro(preco.clinica.valorChPaciente || 0)} paciente •
                              {" "}{selecionado.quantidadeCh} CH × {dinheiro(preco.clinica.valorChRepasse || 0)} repasse
                            </div>
                          )}

                          {excecoes.length > 0 && (
                            <div className="mt-4 border-t border-xango-border pt-3">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-xango-muted">Exceções por unidade</div>
                              <div className="space-y-2">
                                {excecoes.map((u) => (
                                  <div key={u.id} className="grid gap-2 rounded-lg bg-amber-50 p-3 text-sm sm:grid-cols-[1fr_auto_auto_auto]">
                                    <div>
                                      <div className="font-medium">{u.unidadeClinica.nome}</div>
                                      <div className="text-xs text-xango-muted">
                                        {[u.unidadeClinica.cidade, u.unidadeClinica.uf].filter(Boolean).join(" / ")}
                                      </div>
                                    </div>
                                    <div><span className="text-xs text-xango-muted">Paciente</span><div>{dinheiro(u.valorPaciente)}</div></div>
                                    <div><span className="text-xs text-xango-muted">Repasse</span><div>{dinheiro(u.valorRepasse)}</div></div>
                                    <div><span className="text-xs text-xango-muted">Margem</span><div>{dinheiro(u.margemReais)}</div></div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {selecionado.preparo && (
                <section className="rounded-xl border border-xango-border p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-xango-muted">Preparo / observações</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-xango-text">{selecionado.preparo}</div>
                </section>
              )}

              <div className="flex flex-wrap gap-2 border-t border-xango-border pt-4">
                <button onClick={() => abrirEditar(selecionado)} className="inline-flex items-center gap-2 rounded-lg border border-xango-border px-4 py-2 text-sm font-medium hover:bg-slate-50">
                  <Pencil size={16} /> Editar procedimento
                </button>
                {selecionado.ativo && (
                  <button onClick={() => void desativar(selecionado)} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                    Desativar
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {baseAberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-xango-border px-6 py-4">
              <div><h2 className="text-lg font-semibold">Base Mestre TUSS / CH</h2><p className="mt-1 text-xs text-xango-muted">Pesquise a referência antes de adicioná-la ao Catálogo Digna.</p></div>
              <button onClick={() => setBaseAberta(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button>
            </div>
            {!referenciaBase ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <label className="relative block">
                  <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input autoFocus value={buscaBase} onChange={(e) => setBuscaBase(e.target.value)} placeholder='Ex.: "ombro", "hemograma", "40304361"...' className="w-full rounded-lg border border-xango-border py-2.5 pl-10 pr-3 text-sm outline-none focus:border-xango-primary" />
                </label>
                <div className="mt-4 overflow-hidden rounded-xl border border-xango-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-xango-muted"><tr><th className="px-4 py-3">TUSS</th><th className="px-4 py-3">Nome oficial</th><th className="px-4 py-3">CH</th><th className="px-4 py-3">Fonte</th></tr></thead>
                    <tbody className="divide-y divide-xango-border">
                      {buscandoBase ? <tr><td colSpan={4} className="px-4 py-10 text-center text-xango-muted">Pesquisando...</td></tr> :
                      buscaBase.trim().length < 2 ? <tr><td colSpan={4} className="px-4 py-10 text-center text-xango-muted">Digite pelo menos 2 caracteres.</td></tr> :
                      resultadosBase.length === 0 ? <tr><td colSpan={4} className="px-4 py-10 text-center text-xango-muted">Nenhuma referência encontrada.</td></tr> :
                      resultadosBase.map((ref) => (
                        <tr key={ref.id} onClick={() => escolherBase(ref)} className="cursor-pointer hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-xango-primary">{ref.codigoTuss}</td>
                          <td className="px-4 py-3">{ref.nomeTuss}</td>
                          <td className="px-4 py-3 font-semibold">{ref.quantidadeCh ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-xango-muted">{ref.fonteCh || "CH não localizado"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <button onClick={() => setReferenciaBase(null)} className="mb-4 text-sm font-semibold text-xango-primary">← Voltar à pesquisa</button>
                <div className="rounded-xl border border-xango-border bg-slate-50 p-4">
                  <div className="grid gap-4 sm:grid-cols-[140px_1fr_120px]">
                    <div><div className="text-xs text-xango-muted">TUSS</div><div className="mt-1 font-semibold">{referenciaBase.codigoTuss}</div></div>
                    <div><div className="text-xs text-xango-muted">Nome oficial</div><div className="mt-1 font-semibold">{referenciaBase.nomeTuss}</div></div>
                    <div><div className="text-xs text-xango-muted">CH AMB/92</div><div className="mt-1 font-semibold">{referenciaBase.quantidadeCh ?? "—"}</div></div>
                  </div>
                  <p className="mt-3 text-xs text-xango-muted">Fonte CH: {referenciaBase.fonteCh || "Ainda não vinculada"}</p>
                </div>
                {mensagemBase && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{mensagemBase}</div>}
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Campo label="Nome usado pela Digna *"><input value={nomeDignaBase} onChange={(e) => setNomeDignaBase(e.target.value)} className="input-proc" /></Campo>
                  <Campo label="Categoria"><input value={categoriaBase} onChange={(e) => setCategoriaBase(e.target.value)} className="input-proc" placeholder="Ex.: ANÁLISES CLÍNICAS" /></Campo>
                </div>
                <div className="mt-4"><Campo label="Sinônimos / aliases"><textarea rows={4} value={aliasesBase} onChange={(e) => setAliasesBase(e.target.value)} className="input-proc resize-y" placeholder="Um por linha" /></Campo></div>
                <div className="mt-4"><Campo label="Preparo / observações"><textarea rows={4} value={preparoBase} onChange={(e) => setPreparoBase(e.target.value)} className="input-proc resize-y" /></Campo></div>
                <div className="mt-6 flex justify-end gap-2 border-t border-xango-border pt-4">
                  <button onClick={() => setBaseAberta(false)} className="rounded-lg border border-xango-border px-4 py-2 text-sm">Cancelar</button>
                  <button onClick={() => void adicionarDaBase()} disabled={salvandoBase || !nomeDignaBase.trim()} className="rounded-lg bg-xango-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{salvandoBase ? "Adicionando..." : "Adicionar ao Catálogo Digna"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <form onSubmit={salvar} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-5 flex items-center justify-between border-b border-xango-border bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-xango-text">{modal === "NOVO" ? "Novo procedimento" : "Editar procedimento"}</h2>
                <p className="text-xs text-xango-muted">Catálogo Digna + referência TUSS + CH.</p>
              </div>
              <button type="button" onClick={() => setModal(null)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button>
            </div>

            <div className="space-y-5 p-6">
              {mensagemModal && (
                <div className={`rounded-lg border p-3 text-sm ${confirmarMesmoAssim ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700"}`}>
                  {mensagemModal}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Nome usado pela Digna *">
                  <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input-proc" placeholder="Ex.: HEMOGRAMA COMPLETO" />
                </Campo>
                <Campo label="Categoria">
                  <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="input-proc" placeholder="Ex.: ANÁLISES CLÍNICAS" />
                </Campo>
              </div>

              <div className="rounded-xl border border-xango-border bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 font-semibold text-xango-text"><Stethoscope size={17} /> Referência TUSS</div>
                <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                  <Campo label="Código TUSS">
                    <input inputMode="numeric" value={form.codigoTuss} onChange={(e) => setForm({ ...form, codigoTuss: e.target.value.replace(/\D/g, "") })} className="input-proc bg-white" placeholder="Código" />
                  </Campo>
                  <Campo label="Nomenclatura oficial TUSS">
                    <input value={form.nomeTuss} onChange={(e) => setForm({ ...form, nomeTuss: e.target.value })} className="input-proc bg-white" placeholder="Nome oficial" />
                  </Campo>
                </div>
              </div>

              <div className="rounded-xl border border-xango-border bg-amber-50/50 p-4">
                <div className="mb-3 flex items-center gap-2 font-semibold text-xango-text"><Calculator size={17} /> Coeficiente CH</div>
                <div className="max-w-xs">
                  <Campo label="Quantidade de CH">
                    <input value={form.quantidadeCh} onChange={(e) => setForm({ ...form, quantidadeCh: e.target.value })} className="input-proc bg-white" placeholder="Ex.: 18" />
                  </Campo>
                </div>
                <p className="mt-2 text-xs text-xango-muted">
                  Usado somente nas clínicas/laboratórios configurados para precificação por CH. Preços fixos continuam permitidos como exceção.
                </p>
              </div>

              <Campo label="Sinônimos / aliases">
                <textarea value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} rows={4} className="input-proc resize-y" placeholder={"Um por linha. Ex.:\nHEMOGRAMA\nHC"} />
              </Campo>

              <Campo label="Preparo / observações">
                <textarea value={form.preparo} onChange={(e) => setForm({ ...form, preparo: e.target.value })} rows={4} className="input-proc resize-y" placeholder="Orientações de preparo do procedimento..." />
              </Campo>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-xango-border bg-white px-6 py-4">
              <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-xango-border px-4 py-2 text-sm font-medium hover:bg-slate-50">Cancelar</button>
              <button disabled={salvando} className="rounded-lg bg-xango-primary px-4 py-2 text-sm font-semibold text-white hover:bg-xango-primary-hover disabled:opacity-50">
                {salvando ? "Salvando..." : confirmarMesmoAssim ? "Salvar mesmo assim" : "Salvar procedimento"}
              </button>
            </div>
          </form>
        </div>
      )}

      <style jsx global>{`
        .input-proc {
          width: 100%;
          border: 1px solid var(--color-xango-border);
          border-radius: 0.5rem;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input-proc:focus {
          border-color: var(--color-xango-primary);
        }
      `}</style>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-xango-muted">{label}</span>
      {children}
    </label>
  );
}

function InfoCard({ titulo, valor, icone }: { titulo: string; valor: string; icone: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-xango-border p-3">
      <div className="flex items-center gap-2 text-xs text-xango-muted">{icone}{titulo}</div>
      <div className="mt-2 truncate text-sm font-semibold text-xango-text">{valor}</div>
    </div>
  );
}
