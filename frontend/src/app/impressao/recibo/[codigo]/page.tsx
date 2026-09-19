"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "react-qr-code";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type ReciboApi = {
  id: number;
  codigoPublico: string;
  numero: number;
  ano: number;
  status: "ATIVO" | "PARCIALMENTE_ESTORNADO" | "ESTORNADO" | "CANCELADO";
  valorRecebido: string | number;
  valorEstornado: string | number;
  emitidoEm: string;

  nomePaciente: string;
  cpfPaciente: string;
  nomeClinica: string;
  documentoClinica: string | null;
  nomeOrganizacao: string;
  documentoOrganizacao: string | null;
  descricaoProcedimentos: string;
  observacao: string | null;

  organizacao: {
    id: number;
    nomeFantasia: string;
    razaoSocial: string | null;
    documento: string | null;
    telefone: string | null;
    email: string | null;
    endereco: string | null;
  };

  emitidoPor: {
    id: number;
    codigoPublico: string | null;
    nome: string;
    email: string | null;
  } | null;

  pagamentos: {
    criadoEm: string;
    pagamento: {
      id: number;
      valor: string | number;
      forma: string;
      observacao: string | null;
      criadoEm: string;
    };
  }[];

  guia: {
    id: number;
    codigoPublico: string | null;
    clinica: {
      id: number;
      nome: string;
      razaoSocial: string | null;
      documento: string | null;
      telefone: string | null;
      email: string | null;
      endereco: string | null;
    };
    atendimento: {
      id: number;
      codigoPublico: string | null;
      paciente: {
        id: number;
        codigoPublico: string | null;
        nome: string;
        cpf: string;
        telefone: string;
      };
    };
    itens: {
      id: number;
      status: string;
      procedimento: {
        id: number;
        nome: string;
        categoria: string | null;
      };
    }[];
    estornos: {
      id: number;
      valor: string | number;
      forma: string;
      motivo: string | null;
      criadoEm: string;
    }[];
  };
};

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, "");
}

function formatarCpf(valor: string) {
  const numeros = somenteNumeros(valor).slice(0, 11);

  if (numeros.length !== 11) {
    return valor;
  }

  return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9, 11)}`;
}

function formatarDocumento(valor: string | null) {
  if (!valor) return "Não informado";

  const numeros = somenteNumeros(valor);

  if (numeros.length === 14) {
    return `${numeros.slice(0, 2)}.${numeros.slice(2, 5)}.${numeros.slice(5, 8)}/${numeros.slice(8, 12)}-${numeros.slice(12, 14)}`;
  }

  if (numeros.length === 11) {
    return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9, 11)}`;
  }

  return valor;
}

function moeda(valor: string | number) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formaPagamentoLabel(forma: string) {
  switch (forma) {
    case "PIX":
      return "PIX";
    case "DINHEIRO":
      return "Dinheiro";
    case "CARTAO_CREDITO":
      return "Cartão de crédito";
    case "CARTAO_DEBITO":
      return "Cartão de débito";
    case "TRANSFERENCIA":
      return "Transferência";
    default:
      return "Outro";
  }
}

function statusLabel(status: ReciboApi["status"]) {
  switch (status) {
    case "PARCIALMENTE_ESTORNADO":
      return "PARCIALMENTE ESTORNADO";
    case "ESTORNADO":
      return "ESTORNADO";
    case "CANCELADO":
      return "CANCELADO";
    default:
      return "ATIVO";
  }
}

export default function ReciboPagamentoPage() {
  const params = useParams();
  const codigo = String(params.codigo || "");

  const [recibo, setRecibo] = useState<ReciboApi | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarRecibo() {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await fetch(
          `${API_URL}/recibos/${encodeURIComponent(codigo)}`,
          { credentials: "include", cache: "no-store" }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados.erro || "Não foi possível carregar o recibo."
          );
        }

        setRecibo(dados);
      } catch (erro) {
        setErro(
          erro instanceof Error
            ? erro.message
            : "Não foi possível carregar o recibo."
        );
      } finally {
        setCarregando(false);
      }
    }

    if (codigo) {
      carregarRecibo();
    }
  }, [codigo]);

  const dadosFinanceiros = useMemo(() => {
    if (!recibo) {
      return {
        totalPagamentos: 0,
        valorEstornado: 0,
        valorLiquido: 0,
      };
    }

    const totalPagamentos = recibo.pagamentos.reduce(
      (total, item) => total + Number(item.pagamento.valor),
      0
    );

    const valorEstornado = Number(recibo.valorEstornado || 0);
    const valorLiquido = Math.max(
      Number(recibo.valorRecebido || 0) - valorEstornado,
      0
    );

    return {
      totalPagamentos,
      valorEstornado,
      valorLiquido,
    };
  }, [recibo]);

  if (carregando) {
    return <main className="p-8">Carregando recibo...</main>;
  }

  if (erro || !recibo) {
    return (
      <main className="p-8">
        <p className="font-semibold text-red-700">
          {erro || "Recibo não encontrado."}
        </p>
      </main>
    );
  }

  const emitidoEm = new Date(recibo.emitidoEm);
  const voucher =
    recibo.guia.codigoPublico || `VCH-LEGADO-${recibo.guia.id}`;

  return (
    <main className="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-4xl justify-end gap-2 print:hidden">
        <button
          type="button"
          onClick={() => window.close()}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm"
        >
          Fechar
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Imprimir recibo
        </button>
      </div>

      <article className="mx-auto max-w-4xl bg-white p-8 shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-slate-900 pb-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <div>
              <h1 className="text-xl font-black tracking-tight">
                {recibo.nomeOrganizacao}
              </h1>

              {recibo.organizacao.razaoSocial && (
                <p className="mt-1 text-xs text-slate-600">
                  {recibo.organizacao.razaoSocial}
                </p>
              )}

              <div className="mt-2 grid gap-x-5 gap-y-1 text-[11px] leading-4 text-slate-600 sm:grid-cols-2">
                <div>
                  <strong>CNPJ/Documento:</strong>{" "}
                  {formatarDocumento(recibo.documentoOrganizacao)}
                </div>

                <div>
                  <strong>Telefone:</strong>{" "}
                  {recibo.organizacao.telefone || "Não informado"}
                </div>

                <div className="sm:col-span-2">
                  <strong>Endereço:</strong>{" "}
                  {recibo.organizacao.endereco || "Não informado"}
                </div>

                <div className="sm:col-span-2">
                  <strong>Atendente responsável:</strong>{" "}
                  {recibo.emitidoPor?.nome || "Não informado"}
                  {recibo.emitidoPor?.codigoPublico
                    ? ` • ${recibo.emitidoPor.codigoPublico}`
                    : ""}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <QRCode
                value={`DIGNA|RECIBO:${recibo.codigoPublico}`}
                size={92}
                level="M"
                bgColor="#FFFFFF"
                fgColor="#111827"
              />

              <p className="mt-2 max-w-[150px] text-center text-[9px] leading-3 text-slate-500">
                Identificação única deste recibo.
              </p>
            </div>
          </div>
        </header>

        <section className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-slate-300 pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Recibo de pagamento
            </p>

            <p className="mt-2 text-2xl font-black">
              {recibo.codigoPublico}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Voucher relacionado: {voucher}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[10px] uppercase text-slate-500">
              Situação
            </p>

            <p
              className={`mt-1 text-sm font-black ${
                recibo.status === "ATIVO"
                  ? "text-emerald-700"
                  : "text-red-700"
              }`}
            >
              {statusLabel(recibo.status)}
            </p>
          </div>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-slate-300 p-4">
            <p className="text-[11px] font-semibold uppercase text-slate-500">
              Recebemos de
            </p>

            <p className="mt-2 font-bold">{recibo.nomePaciente}</p>

            <p className="mt-1 text-xs text-slate-600">
              CPF: {formatarCpf(recibo.cpfPaciente)}
            </p>
          </div>

          <div className="rounded-md border border-slate-300 p-4">
            <p className="text-[11px] font-semibold uppercase text-slate-500">
              Parceiro do atendimento
            </p>

            <p className="mt-2 font-bold">{recibo.nomeClinica}</p>

            <p className="mt-1 text-xs text-slate-600">
              Documento: {formatarDocumento(recibo.documentoClinica)}
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-md border border-slate-300 p-4">
          <p className="text-[11px] font-semibold uppercase text-slate-500">
            Referente a
          </p>

          <p className="mt-2 text-sm font-semibold leading-5">
            {recibo.descricaoProcedimentos}
          </p>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-slate-300 p-4">
            <p className="text-[11px] font-semibold uppercase text-slate-500">
              Valor recebido neste recibo
            </p>

            <p className="mt-2 text-2xl font-black text-emerald-700">
              {moeda(recibo.valorRecebido)}
            </p>

            {dadosFinanceiros.valorEstornado > 0 && (
              <>
                <div className="mt-3 flex justify-between gap-4 border-t border-slate-200 pt-3 text-sm text-red-700">
                  <span>Valor estornado</span>
                  <strong>{moeda(dadosFinanceiros.valorEstornado)}</strong>
                </div>

                <div className="mt-2 flex justify-between gap-4 text-sm">
                  <span>Valor líquido</span>
                  <strong>{moeda(dadosFinanceiros.valorLiquido)}</strong>
                </div>
              </>
            )}
          </div>

          <div className="rounded-md border border-slate-300 p-4">
            <p className="text-[11px] font-semibold uppercase text-slate-500">
              Pagamento(s) vinculado(s)
            </p>

            <div className="mt-3 space-y-2">
              {recibo.pagamentos.map((item) => (
                <div
                  key={item.pagamento.id}
                  className="border-b border-slate-200 pb-2 text-sm last:border-b-0 last:pb-0"
                >
                  <div className="flex justify-between gap-4">
                    <span>
                      {formaPagamentoLabel(item.pagamento.forma)}
                    </span>

                    <strong>{moeda(item.pagamento.valor)}</strong>
                  </div>

                  <p className="mt-1 text-[10px] text-slate-500">
                    {new Date(item.pagamento.criadoEm).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {recibo.observacao && (
          <section className="mt-4 rounded-md border border-slate-300 p-4">
            <p className="text-[11px] font-semibold uppercase text-slate-500">
              Observação
            </p>

            <p className="mt-2 text-sm text-slate-700">
              {recibo.observacao}
            </p>
          </section>
        )}

        <section className="mt-5 rounded-md border-2 border-slate-800 p-4 text-center">
          <p className="text-sm font-bold">
            Recebemos de {recibo.nomePaciente} o valor de{" "}
            {moeda(recibo.valorRecebido)}, referente ao(s) procedimento(s)
            descrito(s) neste recibo.
          </p>
        </section>

        <footer className="mt-6 border-t border-slate-300 pt-3 text-[10px] text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Emitido em {emitidoEm.toLocaleDateString("pt-BR")} às{" "}
              {emitidoEm.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            <span>
              Gerado pelo Digna Conect • {recibo.codigoPublico}
            </span>
          </div>
        </footer>
      </article>
    </main>
  );
}
