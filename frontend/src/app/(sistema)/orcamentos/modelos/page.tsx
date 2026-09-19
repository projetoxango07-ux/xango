"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileStack,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Star,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type Modelo = {
  id: number;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  ativo: boolean;
  favorito: boolean;
  totalUsos: number;
  ultimoUsoEm: string | null;
  atualizadoEm: string;
  itens: Array<{
    procedimentoNome: string;
    clinicaNome: string | null;
    unidadeClinicaNome: string | null;
  }>;
};

function normalizar(valor: string) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatarData(data: string | null) {
  if (!data) return "Nunca usado";
  return new Date(data).toLocaleDateString("pt-BR");
}

export default function ModelosOrcamentoPage() {
  const router = useRouter();
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("TODAS");
  const [somenteFavoritos, setSomenteFavoritos] = useState(false);
  const [somenteAtivos, setSomenteAtivos] = useState(true);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");
      const resposta = await fetch(`${API_URL}/modelos-orcamento`, {
        cache: "no-store",
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Não foi possível carregar os modelos.");
      }
      setModelos(Array.isArray(dados) ? dados : []);
    } catch (erro) {
      setErro(
        erro instanceof Error
          ? erro.message
          : "Não foi possível carregar os modelos."
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const categorias = useMemo(() => {
    return [...new Set(modelos.map((modelo) => modelo.categoria).filter(Boolean))]
      .map(String)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [modelos]);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);

    return modelos
      .filter((modelo) => !somenteAtivos || modelo.ativo)
      .filter((modelo) => !somenteFavoritos || modelo.favorito)
      .filter(
        (modelo) => categoria === "TODAS" || modelo.categoria === categoria
      )
      .filter((modelo) => {
        if (!termo) return true;
        const texto = normalizar(
          [
            modelo.nome,
            modelo.categoria || "",
            modelo.descricao || "",
            ...modelo.itens.map((item) => item.procedimentoNome),
          ].join(" ")
        );
        return texto.includes(termo);
      })
      .sort((a, b) => {
        if (a.favorito !== b.favorito) return a.favorito ? -1 : 1;
        if (a.totalUsos !== b.totalUsos) return b.totalUsos - a.totalUsos;
        return a.nome.localeCompare(b.nome, "pt-BR");
      });
  }, [modelos, busca, categoria, somenteFavoritos, somenteAtivos]);

  async function alterarStatus(modelo: Modelo) {
    try {
      setErro("");
      const resposta = await fetch(
        `${API_URL}/modelos-orcamento/${modelo.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ativo: !modelo.ativo }),
        }
      );
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Não foi possível alterar o modelo.");
      }
      setModelos((atuais) =>
        atuais.map((item) =>
          item.id === modelo.id ? { ...item, ativo: !modelo.ativo } : item
        )
      );
    } catch (erro) {
      setErro(
        erro instanceof Error
          ? erro.message
          : "Não foi possível alterar o modelo."
      );
    }
  }

  async function alternarFavorito(modelo: Modelo) {
    try {
      setErro("");
      const resposta = await fetch(
        `${API_URL}/modelos-orcamento/${modelo.id}/favorito`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ favorito: !modelo.favorito }),
        }
      );
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Não foi possível alterar o favorito.");
      }
      setModelos((atuais) =>
        atuais.map((item) =>
          item.id === modelo.id
            ? { ...item, favorito: !modelo.favorito }
            : item
        )
      );
    } catch (erro) {
      setErro(
        erro instanceof Error
          ? erro.message
          : "Não foi possível alterar o favorito."
      );
    }
  }

  return (
    <div className="mx-auto max-w-375">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.push("/orcamentos")}
            className="rounded-md border border-xango-border bg-white p-2 text-xango-primary"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-semibold text-xango-text">
              Modelos de orçamento
            </h2>
            <p className="mt-1 text-sm text-xango-muted">
              Favoritos e mais usados aparecem primeiro. Os preços continuam
              sendo consultados somente quando o modelo é usado.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void carregar()}
            className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary"
          >
            <RefreshCw size={14} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => router.push("/orcamentos/modelos/novo")}
            className="flex items-center gap-2 rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            Novo modelo
          </button>
        </div>
      </div>

      {erro && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {erro}
        </div>
      )}

      <section className="rounded-xl border border-xango-border bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto_auto] lg:items-center">
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xango-muted"
            />
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Pesquisar modelo, categoria ou procedimento..."
              className="w-full rounded-lg border border-xango-border bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-xango-primary"
            />
          </div>

          <select
            value={categoria}
            onChange={(event) => setCategoria(event.target.value)}
            className="rounded-lg border border-xango-border bg-white px-3 py-3 text-sm outline-none focus:border-xango-primary"
          >
            <option value="TODAS">Todas as categorias</option>
            {categorias.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-xango-text">
            <input
              type="checkbox"
              checked={somenteFavoritos}
              onChange={(event) => setSomenteFavoritos(event.target.checked)}
              className="accent-xango-primary"
            />
            Favoritos
          </label>

          <label className="flex items-center gap-2 text-sm text-xango-text">
            <input
              type="checkbox"
              checked={somenteAtivos}
              onChange={(event) => setSomenteAtivos(event.target.checked)}
              className="accent-xango-primary"
            />
            Só ativos
          </label>
        </div>
      </section>

      <div className="mt-4 overflow-hidden rounded-xl border border-xango-border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-270 w-full text-left text-sm">
            <thead className="border-b border-xango-border bg-slate-50 text-xs uppercase tracking-wide text-xango-muted">
              <tr>
                <th className="w-12 px-4 py-3" />
                <th className="px-4 py-3">Modelo</th>
                <th className="px-4 py-3">Procedimentos</th>
                <th className="px-4 py-3">Uso</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-xango-border">
              {carregando ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-xango-muted">
                    <Loader2 size={18} className="mx-auto mb-2 animate-spin" />
                    Carregando modelos...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <FileStack size={24} className="mx-auto text-xango-muted" />
                    <p className="mt-2 font-semibold text-xango-text">
                      Nenhum modelo encontrado
                    </p>
                  </td>
                </tr>
              ) : (
                filtrados.map((modelo) => {
                  const preferencias = modelo.itens.filter(
                    (item) => item.clinicaNome
                  ).length;

                  return (
                    <tr key={modelo.id}>
                      <td className="px-4 py-4 align-top">
                        <button
                          type="button"
                          onClick={() => void alternarFavorito(modelo)}
                          title={
                            modelo.favorito
                              ? "Remover dos favoritos"
                              : "Adicionar aos favoritos"
                          }
                          className="rounded-md p-1.5 hover:bg-amber-50"
                        >
                          <Star
                            size={18}
                            className={
                              modelo.favorito
                                ? "fill-amber-400 text-amber-500"
                                : "text-slate-300"
                            }
                          />
                        </button>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-xango-text">
                          {modelo.nome}
                        </p>
                        <p className="mt-1 text-xs text-xango-muted">
                          {modelo.categoria || "Sem categoria"}
                        </p>
                        {modelo.descricao && (
                          <p className="mt-2 max-w-md text-xs text-xango-muted">
                            {modelo.descricao}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-medium text-xango-text">
                          {modelo.itens.length} procedimento
                          {modelo.itens.length === 1 ? "" : "s"}
                        </p>
                        <p className="mt-1 max-w-sm text-xs text-xango-muted">
                          {modelo.itens
                            .slice(0, 3)
                            .map((item) => item.procedimentoNome)
                            .join(", ")}
                          {modelo.itens.length > 3
                            ? ` +${modelo.itens.length - 3}`
                            : ""}
                        </p>
                        <p className="mt-1 text-xs text-xango-muted">
                          {preferencias > 0
                            ? `${preferencias} com clínica preferencial`
                            : "Clínicas definidas ao usar"}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-xango-text">
                          {modelo.totalUsos} uso{modelo.totalUsos === 1 ? "" : "s"}
                        </p>
                        <p className="mt-1 text-xs text-xango-muted">
                          {modelo.ultimoUsoEm
                            ? `Último em ${formatarData(modelo.ultimoUsoEm)}`
                            : "Ainda não utilizado"}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <button
                          type="button"
                          onClick={() => void alterarStatus(modelo)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            modelo.ativo
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {modelo.ativo ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={!modelo.ativo}
                            onClick={() =>
                              router.push(`/orcamentos/novo?modelo=${modelo.id}`)
                            }
                            className="flex items-center gap-1.5 rounded-md bg-xango-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                          >
                            <Play size={14} />
                            Usar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/orcamentos/modelos/${modelo.id}/editar`
                              )
                            }
                            className="flex items-center gap-1.5 rounded-md border border-xango-border px-3 py-2 text-xs font-semibold text-xango-primary"
                          >
                            <Pencil size={14} />
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
