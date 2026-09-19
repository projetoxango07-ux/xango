"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Clock3,
  FileStack,
  FileText,
  X,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type StatusOrcamento =
  | "ABERTO"
  | "PARCIALMENTE_CONVERTIDO"
  | "ENCERRADO"
  | "VENCIDO";

type ItemOrcamento = {
  id: number;
  procedimentoId: number;
  procedimentoNome: string;
  clinicaId?: number | null;
  clinicaNome?: string | null;
  unidadeClinicaId?: number | null;
  unidadeClinicaNome?: string | null;
  valorPaciente: number | string;
  convertido: boolean;
};

type Orcamento = {
  id: number;
  codigoPublico?: string | null;
  nomePaciente: string;
  telefonePaciente: string;
  pacienteId?: number | null;
  status: StatusOrcamento;
  statusBanco?: "ABERTO" | "PARCIALMENTE_CONVERTIDO" | "ENCERRADO";
  vencido?: boolean;
  validadeDias?: number;
  validadeAte?: string | null;
  criadoEm: string;
  atualizadoEm: string;
  itens: ItemOrcamento[];
};

function moeda(valor: number | string) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(data: string | null | undefined) {
  return data ? new Date(data).toLocaleDateString("pt-BR") : "—";
}

function formatarTelefone(valor: string) {
  const n = String(valor || "").replace(/\D/g, "");
  if (n.length === 11) {
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  }
  if (n.length === 10) {
    return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  }
  return valor || "Não informado";
}

function normalizar(valor: string) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function statusLabel(status: StatusOrcamento) {
  if (status === "PARCIALMENTE_CONVERTIDO") return "Parcialmente convertido";
  if (status === "ENCERRADO") return "Encerrado";
  if (status === "VENCIDO") return "Vencido";
  return "Em aberto";
}

function statusClasse(status: StatusOrcamento) {
  if (status === "PARCIALMENTE_CONVERTIDO") {
    return "bg-blue-100 text-blue-800";
  }
  if (status === "ENCERRADO") return "bg-emerald-100 text-emerald-800";
  if (status === "VENCIDO") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-800";
}

function StatusCard({
  titulo,
  valor,
  icone,
  ativo,
  onClick,
}: {
  titulo: string;
  valor: string;
  icone: React.ReactNode;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border bg-white p-4 text-left transition ${
        ativo
          ? "border-xango-primary ring-1 ring-xango-primary"
          : "border-xango-border hover:border-slate-300"
      }`}
    >
      <div className="flex items-center justify-between">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            ativo
              ? "bg-xango-primary text-white"
              : "bg-xango-background text-xango-primary"
          }`}
        >
          {icone}
        </div>
        <span className="text-2xl font-bold text-xango-text">{valor}</span>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-xango-muted">
        {titulo}
      </p>
    </button>
  );
}

function Indicador({
  titulo,
  valor,
  detalhe,
  icone,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  icone: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-xango-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
            {titulo}
          </p>
          <p className="mt-2 text-2xl font-bold text-xango-text">{valor}</p>
          <p className="mt-1 text-xs text-xango-muted">{detalhe}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-xango-background text-xango-primary">
          {icone}
        </div>
      </div>
    </div>
  );
}

export default function OrcamentosPage() {
  const router = useRouter();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"TODOS" | StatusOrcamento>("TODOS");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [clinica, setClinica] = useState("TODAS");

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");
      const resposta = await fetch(`${API_URL}/orcamentos`, {
        cache: "no-store",
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Não foi possível carregar os orçamentos.");
      }
      setOrcamentos(Array.isArray(dados) ? dados : []);
    } catch (erro) {
      setErro(
        erro instanceof Error
          ? erro.message
          : "Não foi possível carregar os orçamentos."
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const resumo = useMemo(
    () => ({
      total: orcamentos.length,
      abertos: orcamentos.filter((o) => o.status === "ABERTO").length,
      parciais: orcamentos.filter(
        (o) => o.status === "PARCIALMENTE_CONVERTIDO"
      ).length,
      encerrados: orcamentos.filter((o) => o.status === "ENCERRADO").length,
      vencidos: orcamentos.filter((o) => o.status === "VENCIDO").length,
    }),
    [orcamentos]
  );

  const indicadores = useMemo(() => {
    const valorOrcado = orcamentos.reduce(
      (total, orcamento) =>
        total +
        orcamento.itens.reduce(
          (subtotal, item) => subtotal + Number(item.valorPaciente || 0),
          0
        ),
      0
    );
    const converteram = orcamentos.filter((orcamento) =>
      orcamento.itens.some((item) => item.convertido)
    ).length;
    const taxa = orcamentos.length
      ? (converteram / orcamentos.length) * 100
      : 0;

    return {
      emitidos: orcamentos.length,
      valorOrcado,
      converteram,
      taxa,
    };
  }, [orcamentos]);

  const clinicas = useMemo(() => {
    return [
      ...new Set(
        orcamentos.flatMap((orcamento) =>
          orcamento.itens.map((item) => item.clinicaNome).filter(Boolean)
        )
      ),
    ]
      .map(String)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [orcamentos]);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    const numero = busca.replace(/\D/g, "");
    const inicio = dataInicial ? new Date(`${dataInicial}T00:00:00`) : null;
    const fim = dataFinal ? new Date(`${dataFinal}T23:59:59`) : null;

    return orcamentos.filter((orcamento) => {
      if (filtro !== "TODOS" && orcamento.status !== filtro) return false;

      const criadoEm = new Date(orcamento.criadoEm);
      if (inicio && criadoEm < inicio) return false;
      if (fim && criadoEm > fim) return false;

      if (
        clinica !== "TODAS" &&
        !orcamento.itens.some((item) => item.clinicaNome === clinica)
      ) {
        return false;
      }

      if (!termo && !numero) return true;

      const texto = normalizar(
        [
          orcamento.codigoPublico,
          orcamento.nomePaciente,
          orcamento.telefonePaciente,
          ...orcamento.itens.map((item) => item.procedimentoNome),
          ...orcamento.itens.map((item) => item.clinicaNome || ""),
          ...orcamento.itens.map((item) => item.unidadeClinicaNome || ""),
        ].join(" ")
      );

      return (
        (termo && texto.includes(termo)) ||
        (numero &&
          orcamento.telefonePaciente.replace(/\D/g, "").includes(numero))
      );
    });
  }, [orcamentos, busca, filtro, dataInicial, dataFinal, clinica]);

  function limparFiltros() {
    setBusca("");
    setFiltro("TODOS");
    setDataInicial("");
    setDataFinal("");
    setClinica("TODAS");
  }

  const filtrosAtivos = Boolean(
    busca ||
      filtro !== "TODOS" ||
      dataInicial ||
      dataFinal ||
      clinica !== "TODAS"
  );

  return (
    <div className="mx-auto max-w-375">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-xango-text">Orçamentos</h2>
          <p className="mt-1 text-sm text-xango-muted">
            Consulte, acompanhe conversões e identifique orçamentos vencidos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/orcamentos/modelos")}
            className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-4 py-2 text-sm font-semibold text-xango-primary hover:bg-xango-background"
          >
            <FileStack size={16} />
            Modelos
          </button>
          <button
            type="button"
            disabled={carregando}
            onClick={() => void carregar()}
            className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={carregando ? "animate-spin" : ""}
            />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => router.push("/orcamentos/novo")}
            className="flex items-center gap-2 rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white hover:bg-xango-primary-hover"
          >
            <Plus size={16} />
            Novo orçamento
          </button>
        </div>
      </div>

      {erro && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {erro}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Indicador
          titulo="Orçamentos emitidos"
          valor={carregando ? "—" : String(indicadores.emitidos)}
          detalhe="Base atual de orçamentos"
          icone={<BarChart3 size={18} />}
        />
        <Indicador
          titulo="Valor orçado"
          valor={carregando ? "—" : moeda(indicadores.valorOrcado)}
          detalhe="Soma dos valores cotados"
          icone={<DollarSign size={18} />}
        />
        <Indicador
          titulo="Viraram atendimento"
          valor={carregando ? "—" : String(indicadores.converteram)}
          detalhe="Com pelo menos um item convertido"
          icone={<CheckCircle2 size={18} />}
        />
        <Indicador
          titulo="Taxa de conversão"
          valor={carregando ? "—" : `${indicadores.taxa.toFixed(1)}%`}
          detalhe="Orçamentos com alguma conversão"
          icone={<TrendingUp size={18} />}
        />
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatusCard
          icone={<FileText size={18} />}
          valor={carregando ? "—" : String(resumo.total)}
          titulo="Todos"
          ativo={filtro === "TODOS"}
          onClick={() => setFiltro("TODOS")}
        />
        <StatusCard
          icone={<Clock3 size={18} />}
          valor={carregando ? "—" : String(resumo.abertos)}
          titulo="Em aberto"
          ativo={filtro === "ABERTO"}
          onClick={() => setFiltro("ABERTO")}
        />
        <StatusCard
          icone={<CalendarDays size={18} />}
          valor={carregando ? "—" : String(resumo.parciais)}
          titulo="Parcialmente convertidos"
          ativo={filtro === "PARCIALMENTE_CONVERTIDO"}
          onClick={() => setFiltro("PARCIALMENTE_CONVERTIDO")}
        />
        <StatusCard
          icone={<CheckCircle2 size={18} />}
          valor={carregando ? "—" : String(resumo.encerrados)}
          titulo="Encerrados"
          ativo={filtro === "ENCERRADO"}
          onClick={() => setFiltro("ENCERRADO")}
        />
        <StatusCard
          icone={<AlertTriangle size={18} />}
          valor={carregando ? "—" : String(resumo.vencidos)}
          titulo="Vencidos"
          ativo={filtro === "VENCIDO"}
          onClick={() => setFiltro("VENCIDO")}
        />
      </section>

      <section className="mt-4 rounded-xl border border-xango-border bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_230px_auto] lg:items-end">
          <label className="text-xs font-semibold text-xango-muted">
            Busca geral
            <div className="relative mt-1">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xango-muted"
              />
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Código, paciente, telefone, procedimento, clínica..."
                className="w-full rounded-lg border border-xango-border bg-white py-3 pl-10 pr-4 text-sm font-normal text-xango-text outline-none focus:border-xango-primary"
              />
            </div>
          </label>

          <label className="text-xs font-semibold text-xango-muted">
            De
            <input
              type="date"
              value={dataInicial}
              onChange={(event) => setDataInicial(event.target.value)}
              className="mt-1 w-full rounded-lg border border-xango-border bg-white px-3 py-3 text-sm font-normal text-xango-text outline-none focus:border-xango-primary"
            />
          </label>

          <label className="text-xs font-semibold text-xango-muted">
            Até
            <input
              type="date"
              value={dataFinal}
              onChange={(event) => setDataFinal(event.target.value)}
              className="mt-1 w-full rounded-lg border border-xango-border bg-white px-3 py-3 text-sm font-normal text-xango-text outline-none focus:border-xango-primary"
            />
          </label>

          <label className="text-xs font-semibold text-xango-muted">
            Clínica
            <select
              value={clinica}
              onChange={(event) => setClinica(event.target.value)}
              className="mt-1 w-full rounded-lg border border-xango-border bg-white px-3 py-3 text-sm font-normal text-xango-text outline-none focus:border-xango-primary"
            >
              <option value="TODAS">Todas as clínicas</option>
              {clinicas.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={!filtrosAtivos}
            onClick={limparFiltros}
            className="flex items-center justify-center gap-2 rounded-lg border border-xango-border bg-white px-4 py-3 text-sm font-semibold text-xango-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={16} />
            Limpar
          </button>
        </div>
      </section>

      <div className="mt-4 overflow-hidden rounded-xl border border-xango-border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-270 w-full text-left text-sm">
            <thead className="border-b border-xango-border bg-slate-50 text-xs uppercase tracking-wide text-xango-muted">
              <tr>
                <th className="px-4 py-3">Orçamento</th>
                <th className="px-4 py-3">Paciente</th>
                <th className="px-4 py-3">Procedimentos</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Validade</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-xango-border">
              {carregando ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-xango-muted">
                    Carregando orçamentos...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <FileText size={22} className="mx-auto text-xango-primary" />
                    <p className="mt-3 font-semibold text-xango-text">
                      Nenhum orçamento encontrado
                    </p>
                    <p className="mt-1 text-sm text-xango-muted">
                      {filtrosAtivos
                        ? "Tente alterar a busca ou os filtros."
                        : "Os novos orçamentos aparecerão aqui."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtrados.map((orcamento) => {
                  const total = orcamento.itens.reduce(
                    (soma, item) => soma + Number(item.valorPaciente || 0),
                    0
                  );
                  const nomes = orcamento.itens
                    .slice(0, 2)
                    .map((item) => item.procedimentoNome);
                  const restantes = orcamento.itens.length - nomes.length;
                  const convertidos = orcamento.itens.filter(
                    (item) => item.convertido
                  ).length;

                  return (
                    <tr
                      key={orcamento.id}
                      onClick={() => router.push(`/orcamentos/${orcamento.id}`)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-xango-primary">
                          {orcamento.codigoPublico || `#${orcamento.id}`}
                        </p>
                        <p className="mt-1 text-xs text-xango-muted">
                          Criado em {formatarData(orcamento.criadoEm)}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-xango-text">
                          {orcamento.nomePaciente}
                        </p>
                        <p className="mt-1 text-xs text-xango-muted">
                          {formatarTelefone(orcamento.telefonePaciente)}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="max-w-xs font-medium text-xango-text">
                          {nomes.join(", ") || "Nenhum procedimento"}
                        </p>
                        {restantes > 0 && (
                          <p className="mt-1 text-xs font-medium text-xango-primary">
                            + {restantes} procedimento{restantes > 1 ? "s" : ""}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-xango-muted">
                          {convertidos} de {orcamento.itens.length} convertido
                          {convertidos !== 1 ? "s" : ""}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top font-semibold text-xango-text">
                        {moeda(total)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasse(
                            orcamento.status
                          )}`}
                        >
                          {statusLabel(orcamento.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p
                          className={`font-medium ${
                            orcamento.status === "VENCIDO"
                              ? "text-red-700"
                              : "text-xango-text"
                          }`}
                        >
                          {formatarData(orcamento.validadeAte)}
                        </p>
                        <p className="mt-1 text-xs text-xango-muted">
                          {orcamento.validadeDias || 15} dias
                        </p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <ChevronRight size={18} className="text-xango-muted" />
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
