"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Printer, Share2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type Orcamento = {
  id: number;
  codigoPublico: string | null;
  nomePaciente: string;
  telefonePaciente: string;
  status: "ABERTO" | "PARCIALMENTE_CONVERTIDO" | "ENCERRADO" | "VENCIDO";
  vencido: boolean;
  validadeDias: number;
  validadeAte: string | null;
  condicoesPagamento: string | null;
  observacoes: string | null;
  criadoEm: string;
  organizacao: {
    nomeFantasia: string;
    razaoSocial: string | null;
    documento: string | null;
    telefone: string | null;
    email: string | null;
    endereco: string | null;
  } | null;
  itens: Array<{
    id: number;
    procedimentoNome: string;
    clinicaNome: string | null;
    unidadeClinicaNome: string | null;
    valorPaciente: number;
    convertido: boolean;
  }>;
};

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarTelefone(valor: string | null) {
  const numeros = String(valor || "").replace(/\D/g, "");
  if (numeros.length === 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  }
  if (numeros.length === 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  }
  return valor || "";
}

function formatarData(valor: string | null) {
  return valor ? new Date(valor).toLocaleDateString("pt-BR") : "—";
}

function statusLabel(status: Orcamento["status"]) {
  if (status === "PARCIALMENTE_CONVERTIDO") return "Parcialmente convertido";
  if (status === "ENCERRADO") return "Encerrado";
  if (status === "VENCIDO") return "Vencido";
  return "Em aberto";
}

function nomeBaseArquivo(orcamento: Orcamento) {
  const numero = (orcamento.codigoPublico || String(orcamento.id)).replace(
    /[^a-zA-Z0-9_-]/g,
    "-"
  );
  return `orcamento-${numero}`;
}

export default function ImpressaoOrcamentoPage() {
  const params = useParams();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = Number(idParam);

  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const resposta = await fetch(`${API_URL}/orcamentos/${id}`, {
          credentials: "include",
          cache: "no-store",
        });
        const dados = await resposta.json();
        if (!resposta.ok) {
          throw new Error(dados.erro || "Não foi possível carregar o orçamento.");
        }
        setOrcamento(dados);
      } catch (erro) {
        setErro(
          erro instanceof Error
            ? erro.message
            : "Não foi possível carregar o orçamento."
        );
      } finally {
        setCarregando(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!orcamento) return;
    const tituloAnterior = document.title;
    document.title = nomeBaseArquivo(orcamento);
    return () => {
      document.title = tituloAnterior;
    };
  }, [orcamento]);

  const total = useMemo(
    () =>
      orcamento?.itens.reduce(
        (soma, item) => soma + Number(item.valorPaciente || 0),
        0
      ) || 0,
    [orcamento]
  );

  function imprimir() {
    if (!orcamento) return;
    document.title = nomeBaseArquivo(orcamento);
    window.setTimeout(() => window.print(), 80);
  }

  async function compartilhar() {
    if (!orcamento) return;

    const contatoDigna = [
      orcamento.organizacao?.telefone
        ? formatarTelefone(orcamento.organizacao.telefone)
        : null,
      orcamento.organizacao?.email,
    ]
      .filter(Boolean)
      .join(" • ");

    const texto = [
      `ORÇAMENTO ${orcamento.codigoPublico || `#${orcamento.id}`} — DIGNA SAÚDE`,
      `Paciente: ${orcamento.nomePaciente}`,
      `Válido até: ${formatarData(orcamento.validadeAte)}`,
      "",
      ...orcamento.itens.map(
        (item) =>
          `• ${item.procedimentoNome}${
            item.clinicaNome
              ? ` — ${item.clinicaNome}${
                  item.unidadeClinicaNome ? ` / ${item.unidadeClinicaNome}` : ""
                }`
              : ""
          }: ${moeda(item.valorPaciente)}`
      ),
      "",
      `TOTAL: ${moeda(total)}`,
      orcamento.condicoesPagamento
        ? `Condições de pagamento: ${orcamento.condicoesPagamento}`
        : "",
      orcamento.observacoes ? `Observações: ${orcamento.observacoes}` : "",
      contatoDigna ? `Contato Digna Saúde: ${contatoDigna}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Orçamento ${orcamento.codigoPublico || orcamento.id}`,
          text: texto,
        });
        return;
      }
      await navigator.clipboard.writeText(texto);
      setAviso("Resumo copiado para compartilhar.");
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === "AbortError") return;
      setAviso("Não foi possível compartilhar automaticamente.");
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="mr-2 animate-spin" />
        Carregando...
      </div>
    );
  }

  if (erro || !orcamento) {
    return <div className="p-8 text-red-700">{erro || "Orçamento não encontrado."}</div>;
  }

  const empresa = orcamento.organizacao;
  const contatoRodape = [
    empresa?.telefone ? formatarTelefone(empresa.telefone) : null,
    empresa?.email,
    empresa?.endereco,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <main className="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-4xl justify-end gap-2">
        <button
          type="button"
          onClick={() => void compartilhar()}
          className="flex items-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-semibold"
        >
          <Share2 size={16} />
          Compartilhar
        </button>
        <button
          type="button"
          onClick={imprimir}
          className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          <Printer size={16} />
          Imprimir / Salvar PDF
        </button>
      </div>

      {aviso && (
        <div className="no-print mx-auto mb-4 max-w-4xl rounded-md bg-blue-50 p-3 text-sm text-blue-800">
          {aviso}
        </div>
      )}

      <article className="mx-auto max-w-4xl bg-white p-8 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-xl font-black text-white">
              D
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                {empresa?.nomeFantasia || "Digna Saúde"}
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
                ORÇAMENTO
              </h1>
              <p className="mt-1 text-xs text-slate-600">
                Digna Conect • Gestão e atendimento em saúde
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-lg font-black text-slate-900">
              {orcamento.codigoPublico || `#${orcamento.id}`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Emitido em {formatarData(orcamento.criadoEm)}
            </p>
            <p className={`mt-1 text-xs font-bold ${orcamento.vencido ? "text-red-700" : "text-slate-700"}`}>
              {statusLabel(orcamento.status)} • válido até {formatarData(orcamento.validadeAte)}
            </p>
          </div>
        </header>

        <section className="mt-6 grid gap-4 rounded-lg border border-slate-300 p-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Paciente</p>
            <p className="mt-1 font-bold text-slate-900">{orcamento.nomePaciente}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Telefone</p>
            <p className="mt-1 text-slate-800">{formatarTelefone(orcamento.telefonePaciente)}</p>
          </div>
        </section>

        <section className="mt-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-slate-300 bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Procedimento</th>
                <th className="px-3 py-2">Clínica / unidade</th>
                <th className="px-3 py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {orcamento.itens.map((item) => (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="px-3 py-3 font-semibold text-slate-900">{item.procedimentoNome}</td>
                  <td className="px-3 py-3 text-slate-700">
                    {item.clinicaNome || "A definir"}
                    {item.unidadeClinicaNome ? ` • ${item.unidadeClinicaNome}` : ""}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-900">{moeda(item.valorPaciente)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-5 flex justify-end">
            <div className="w-full max-w-xs border-t-2 border-slate-900 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold uppercase text-slate-600">Total</span>
                <span className="text-2xl font-black text-slate-900">{moeda(total)}</span>
              </div>
            </div>
          </div>
        </section>

        {orcamento.condicoesPagamento && (
          <section className="mt-7 border-t border-slate-300 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Condições de pagamento</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{orcamento.condicoesPagamento}</p>
          </section>
        )}

        {orcamento.observacoes && (
          <section className="mt-7 border-t border-slate-300 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Observações</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{orcamento.observacoes}</p>
          </section>
        )}

        <section className="mt-7 rounded-lg bg-slate-50 p-4 text-xs leading-5 text-slate-600">
          <strong>Validade:</strong> este orçamento é válido até {formatarData(orcamento.validadeAte)}. Após essa data, os valores devem ser confirmados novamente com a equipe Digna Saúde.
        </section>

        <footer className="mt-8 border-t border-slate-300 pt-4 text-center text-[10px] leading-4 text-slate-500">
          <p className="font-semibold text-slate-700">
            {empresa?.razaoSocial || empresa?.nomeFantasia || "Digna Saúde"}
            {empresa?.documento ? ` • ${empresa.documento}` : ""}
          </p>
          {contatoRodape && <p>{contatoRodape}</p>}
          <p className="mt-1">Orçamento emitido pelo sistema Digna Conect.</p>
        </footer>
      </article>
    </main>
  );
}
