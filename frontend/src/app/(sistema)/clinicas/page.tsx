"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Stethoscope,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:3333";


type ClinicaResumo = {
  id: number;
  nome: string;
  razaoSocial: string | null;
  documento: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  cidadeFiscal: string | null;
  ufFiscal: string | null;
  ativo: boolean;
  totalUnidades: number;
  unidadesAtivas: number;
  totalProcedimentos: number;
  totalGuias: number;
  totalRepasses: number;
  criadoEm: string;
  atualizadoEm: string;
};

type FiltroClinica =
  | "Todas"
  | "Ativas"
  | "Inativas"
  | "Sem unidade"
  | "Sem preços";

function formatarDocumento(documento: string | null) {
  if (!documento) return "Documento não informado";

  const numeros = documento.replace(/\D/g, "");

  if (numeros.length === 14) {
    return `${numeros.slice(0, 2)}.${numeros.slice(2, 5)}.${numeros.slice(
      5,
      8
    )}/${numeros.slice(8, 12)}-${numeros.slice(12)}`;
  }

  if (numeros.length === 11) {
    return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(
      6,
      9
    )}-${numeros.slice(9)}`;
  }

  return documento;
}

function formatarTelefone(telefone: string | null) {
  if (!telefone) return null;

  const numeros = telefone.replace(/\D/g, "");

  if (numeros.length === 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(
      7
    )}`;
  }

  if (numeros.length === 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(
      6
    )}`;
  }

  return telefone;
}

export default function ClinicasPage() {
  const router = useRouter();

  const [clinicas, setClinicas] = useState<ClinicaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroClinica>("Todas");

  async function carregarClinicas() {
    try {
      setCarregando(true);
      setErro("");

      const resposta = await fetch(
        `${API_URL}/clinicas/resumo`,
        { cache: "no-store" }
      );

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro || "Não foi possível carregar as clínicas."
        );
      }

      setClinicas(resultado);
    } catch (erro) {
      console.error("Erro ao carregar clínicas:", erro);
      setErro("Não foi possível carregar as clínicas.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void carregarClinicas();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const clinicasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const termoNumerico = termo.replace(/\D/g, "");

    return clinicas.filter((clinica) => {
      if (filtro === "Ativas" && !clinica.ativo) return false;
      if (filtro === "Inativas" && clinica.ativo) return false;
      if (filtro === "Sem unidade" && clinica.unidadesAtivas > 0) return false;
      if (filtro === "Sem preços" && clinica.totalProcedimentos > 0) return false;

      if (!termo) return true;

      const texto = [
        clinica.nome,
        clinica.razaoSocial,
        clinica.documento,
        formatarDocumento(clinica.documento),
        clinica.telefone,
        clinica.whatsapp,
        clinica.email,
        clinica.cidadeFiscal,
        clinica.ufFiscal,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (texto.includes(termo)) return true;

      if (
        termoNumerico &&
        [clinica.documento, clinica.telefone, clinica.whatsapp]
          .filter(Boolean)
          .some((valor) =>
            String(valor).replace(/\D/g, "").includes(termoNumerico)
          )
      ) {
        return true;
      }

      return false;
    });
  }, [clinicas, busca, filtro]);

  const resumo = useMemo(
    () => ({
      total: clinicas.length,
      ativas: clinicas.filter((clinica) => clinica.ativo).length,
      unidades: clinicas.reduce(
        (total, clinica) => total + clinica.unidadesAtivas,
        0
      ),
      semPrecos: clinicas.filter(
        (clinica) => clinica.ativo && clinica.totalProcedimentos === 0
      ).length,
    }),
    [clinicas]
  );

  return (
    <div className="mx-auto max-w-375">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-xango-text">
            Clínicas
          </h2>
          <p className="mt-1 text-sm text-xango-muted">
            Gerencie clínicas parceiras, unidades e tabelas de procedimentos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void carregarClinicas()}
            disabled={carregando}
            className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary transition hover:bg-xango-background disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={carregando ? "animate-spin" : ""}
            />
            Atualizar
          </button>

          <button
            type="button"
            onClick={() => router.push("/clinicas/nova")}
            className="flex items-center gap-2 rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-xango-primary-hover"
          >
            <Plus size={16} />
            Nova clínica
          </button>
        </div>
      </div>

      {erro && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">{erro}</p>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ResumoCard
          icone={<Building2 size={18} />}
          valor={carregando ? "—" : String(resumo.total)}
          titulo="Clínicas"
          ativo={filtro === "Todas"}
          onClick={() => setFiltro("Todas")}
        />

        <ResumoCard
          icone={<CheckCircle2 size={18} />}
          valor={carregando ? "—" : String(resumo.ativas)}
          titulo="Clínicas ativas"
          ativo={filtro === "Ativas"}
          onClick={() => setFiltro("Ativas")}
        />

        <ResumoCard
          icone={<MapPin size={18} />}
          valor={carregando ? "—" : String(resumo.unidades)}
          titulo="Unidades ativas"
          ativo={filtro === "Sem unidade"}
          onClick={() =>
            setFiltro(filtro === "Sem unidade" ? "Todas" : "Sem unidade")
          }
          subtitulo="Clique para ver clínicas sem unidade"
        />

        <ResumoCard
          icone={<AlertCircle size={18} />}
          valor={carregando ? "—" : String(resumo.semPrecos)}
          titulo="Sem tabela de preços"
          ativo={filtro === "Sem preços"}
          onClick={() => setFiltro("Sem preços")}
        />
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFiltro("Todas")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            filtro === "Todas"
              ? "bg-xango-primary text-white"
              : "border border-xango-border bg-white text-xango-muted hover:text-xango-primary"
          }`}
        >
          Todas
        </button>
        <button
          type="button"
          onClick={() => setFiltro("Ativas")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            filtro === "Ativas"
              ? "bg-xango-primary text-white"
              : "border border-xango-border bg-white text-xango-muted hover:text-xango-primary"
          }`}
        >
          Ativas
        </button>
        <button
          type="button"
          onClick={() => setFiltro("Inativas")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            filtro === "Inativas"
              ? "bg-xango-primary text-white"
              : "border border-xango-border bg-white text-xango-muted hover:text-xango-primary"
          }`}
        >
          Inativas
        </button>
        <button
          type="button"
          onClick={() => setFiltro("Sem unidade")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            filtro === "Sem unidade"
              ? "bg-xango-primary text-white"
              : "border border-xango-border bg-white text-xango-muted hover:text-xango-primary"
          }`}
        >
          Sem unidade
        </button>
        <button
          type="button"
          onClick={() => setFiltro("Sem preços")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            filtro === "Sem preços"
              ? "bg-xango-primary text-white"
              : "border border-xango-border bg-white text-xango-muted hover:text-xango-primary"
          }`}
        >
          Sem preços
        </button>
      </div>

      <div className="relative mt-4">
        <Search
          size={17}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-xango-muted"
        />
        <input
          type="text"
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Pesquisar por clínica, razão social, CNPJ/CPF, telefone, e-mail ou cidade..."
          className="w-full rounded-md border border-xango-border bg-white py-3 pl-10 pr-4 text-sm text-xango-text outline-none transition focus:border-xango-primary"
        />
      </div>

      <section className="mt-4 overflow-hidden rounded-lg border border-xango-border bg-white shadow-sm">
        <div className="border-b border-xango-border px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-xango-text">
                Lista de clínicas
              </h3>
              <p className="mt-1 text-xs text-xango-muted">
                {carregando
                  ? "Carregando..."
                  : `${clinicasFiltradas.length} resultado(s)`}
              </p>
            </div>

            {filtro !== "Todas" && (
              <button
                type="button"
                onClick={() => setFiltro("Todas")}
                className="text-xs font-semibold text-xango-primary hover:underline"
              >
                Limpar filtro
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-250 border-collapse">
            <thead>
              <tr className="border-b border-xango-border bg-xango-background/60 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-xango-muted">
                  Clínica
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-xango-muted">
                  Contato
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-xango-muted">
                  Localização
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-xango-muted">
                  Unidades
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-xango-muted">
                  Procedimentos
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-xango-muted">
                  Status
                </th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>

            <tbody className="divide-y divide-xango-border">
              {carregando && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm text-xango-muted"
                  >
                    Carregando clínicas...
                  </td>
                </tr>
              )}

              {!carregando &&
                clinicasFiltradas.map((clinica) => {
                  const telefone =
                    formatarTelefone(clinica.whatsapp) ||
                    formatarTelefone(clinica.telefone);

                  return (
                    <tr
                      key={clinica.id}
                      onClick={() => router.push(`/clinicas/${clinica.id}`)}
                      className="cursor-pointer transition hover:bg-xango-background/60"
                    >
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-md bg-xango-background p-2 text-xango-primary">
                            <Building2 size={17} />
                          </div>
                          <div>
                            <p className="font-semibold text-xango-text">
                              {clinica.nome}
                            </p>
                            <p className="mt-1 text-xs text-xango-muted">
                              {clinica.razaoSocial || "Razão social não informada"}
                            </p>
                            <p className="mt-1 text-xs font-medium text-xango-primary">
                              {formatarDocumento(clinica.documento)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <p className="text-sm text-xango-text">
                          {telefone || "Telefone não informado"}
                        </p>
                        <p className="mt-1 text-xs text-xango-muted">
                          {clinica.email || "E-mail não informado"}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <p className="text-sm text-xango-text">
                          {clinica.cidadeFiscal
                            ? `${clinica.cidadeFiscal}${
                                clinica.ufFiscal ? ` / ${clinica.ufFiscal}` : ""
                              }`
                            : "Endereço fiscal não informado"}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <p className="text-sm font-semibold text-xango-text">
                          {clinica.unidadesAtivas}
                        </p>
                        <p className="mt-1 text-xs text-xango-muted">
                          {clinica.totalUnidades === 1
                            ? "1 unidade cadastrada"
                            : `${clinica.totalUnidades} unidades cadastradas`}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <Stethoscope
                            size={15}
                            className={
                              clinica.totalProcedimentos > 0
                                ? "text-emerald-600"
                                : "text-amber-600"
                            }
                          />
                          <span className="text-sm font-semibold text-xango-text">
                            {clinica.totalProcedimentos}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-xango-muted">
                          {clinica.totalProcedimentos > 0
                            ? "Na tabela de preços"
                            : "Tabela ainda não cadastrada"}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        {clinica.ativo ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                            Ativa
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                            Inativa
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-4 text-right align-middle">
                        <ChevronRight size={18} className="text-xango-muted" />
                      </td>
                    </tr>
                  );
                })}

              {!carregando && clinicasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
                    <Building2
                      size={32}
                      className="mx-auto text-xango-muted/50"
                    />
                    <p className="mt-3 text-sm font-semibold text-xango-text">
                      Nenhuma clínica encontrada
                    </p>
                    <p className="mt-1 text-xs text-xango-muted">
                      Tente alterar a busca ou o filtro selecionado.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ResumoCard({
  icone,
  valor,
  titulo,
  subtitulo,
  ativo,
  onClick,
}: {
  icone: React.ReactNode;
  valor: string;
  titulo: string;
  subtitulo?: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border bg-white p-4 text-left shadow-sm transition ${
        ativo
          ? "border-xango-primary ring-1 ring-xango-primary"
          : "border-xango-border hover:border-xango-primary/40"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xango-primary">{icone}</div>
        <p className="text-xl font-bold text-xango-text">{valor}</p>
      </div>
      <p className="mt-3 text-xs font-medium text-xango-muted">{titulo}</p>
      {subtitulo && (
        <p className="mt-1 text-[10px] text-xango-muted">{subtitulo}</p>
      )}
    </button>
  );
}
