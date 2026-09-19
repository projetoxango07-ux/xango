"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "react-qr-code";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type EstornoApi = {
  id: number;
  codigoPublico: string;
  numero: number | null;
  ano: number | null;
  valor: string | number;
  forma: string;
  motivo: string | null;
  criadoEm: string;

  organizacao: {
    id: number;
    nomeFantasia: string;
    razaoSocial: string | null;
    documento: string | null;
    telefone: string | null;
    email: string | null;
    endereco: string | null;
  } | null;

  emitidoPor: {
    id: number;
    codigoPublico: string | null;
    nome: string;
  } | null;

  pagamento: {
    id: number;
    valor: string | number;
    forma: string;
    criadoEm: string;
    recibos: {
      recibo: {
        id: number;
        codigoPublico: string;
        status: string;
        valorRecebido: string | number;
        valorEstornado: string | number;
      };
    }[];
  } | null;

  guia: {
    id: number;
    codigoPublico: string | null;
    organizacao: {
      nomeFantasia: string;
      razaoSocial: string | null;
      documento: string | null;
      telefone: string | null;
      endereco: string | null;
    } | null;
    geradaPor: {
      nome: string;
      codigoPublico: string | null;
    } | null;
    clinica: {
      id: number;
      nome: string;
      razaoSocial: string | null;
      documento: string | null;
      telefone: string | null;
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
  };
};

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, "");
}

function formatarCpf(valor: string) {
  const numeros = somenteNumeros(valor).slice(0, 11);

  if (numeros.length !== 11) return valor;

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

export default function ComprovanteEstornoPage() {
  const params = useParams();
  const codigo = String(params.codigo || "");

  const [estorno, setEstorno] = useState<EstornoApi | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await fetch(
          `${API_URL}/estornos/${encodeURIComponent(codigo)}`,
          { credentials: "include", cache: "no-store" }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados.erro || "Não foi possível carregar o estorno."
          );
        }

        setEstorno(dados);
      } catch (erro) {
        setErro(
          erro instanceof Error
            ? erro.message
            : "Não foi possível carregar o estorno."
        );
      } finally {
        setCarregando(false);
      }
    }

    if (codigo) {
      carregar();
    }
  }, [codigo]);

  if (carregando) {
    return <main className="p-8">Carregando comprovante...</main>;
  }

  if (erro || !estorno) {
    return (
      <main className="p-8">
        <p className="font-semibold text-red-700">
          {erro || "Estorno não encontrado."}
        </p>
      </main>
    );
  }

  const organizacao =
    estorno.organizacao || estorno.guia.organizacao;

  const emitidoPor =
    estorno.emitidoPor || estorno.guia.geradaPor;

  const reciboRelacionado =
    estorno.pagamento?.recibos?.[0]?.recibo || null;

  const procedimentosAtivos = estorno.guia.itens.filter(
    (item) => item.status !== "CANCELADO"
  );

  const criadoEm = new Date(estorno.criadoEm);

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
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Imprimir comprovante
        </button>
      </div>

      <article className="mx-auto max-w-4xl bg-white p-8 shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-slate-900 pb-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <div>
              <h1 className="text-xl font-black tracking-tight">
                {organizacao?.nomeFantasia || "DIGNA SAÚDE"}
              </h1>

              {organizacao?.razaoSocial && (
                <p className="mt-1 text-xs text-slate-600">
                  {organizacao.razaoSocial}
                </p>
              )}

              <div className="mt-2 grid gap-x-5 gap-y-1 text-[11px] leading-4 text-slate-600 sm:grid-cols-2">
                <div>
                  <strong>CNPJ/Documento:</strong>{" "}
                  {formatarDocumento(organizacao?.documento || null)}
                </div>

                <div>
                  <strong>Telefone:</strong>{" "}
                  {organizacao?.telefone || "Não informado"}
                </div>

                <div className="sm:col-span-2">
                  <strong>Endereço:</strong>{" "}
                  {organizacao?.endereco || "Não informado"}
                </div>

                <div className="sm:col-span-2">
                  <strong>Atendente responsável:</strong>{" "}
                  {emitidoPor?.nome || "Não informado"}
                  {emitidoPor?.codigoPublico
                    ? ` • ${emitidoPor.codigoPublico}`
                    : ""}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <QRCode
                value={`DIGNA|ESTORNO:${estorno.codigoPublico}`}
                size={92}
                level="M"
                bgColor="#FFFFFF"
                fgColor="#111827"
              />

              <p className="mt-2 max-w-37.5 text-center text-[9px] leading-3 text-slate-500">
                Identificação única deste comprovante de estorno.
              </p>
            </div>
          </div>
        </header>

        <section className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-slate-300 pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Comprovante de estorno
            </p>

            <p className="mt-2 text-2xl font-black text-red-700">
              {estorno.codigoPublico}
            </p>

            {estorno.guia.codigoPublico && (
              <p className="mt-1 text-xs text-slate-500">
                Voucher relacionado: {estorno.guia.codigoPublico}
              </p>
            )}
          </div>

          <div className="text-right">
            <p className="text-[10px] uppercase text-slate-500">
              Valor estornado
            </p>

            <p className="mt-1 text-2xl font-black text-red-700">
              {moeda(estorno.valor)}
            </p>
          </div>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-slate-300 p-4">
            <p className="text-[11px] font-semibold uppercase text-slate-500">
              Cliente
            </p>

            <p className="mt-2 font-bold">
              {estorno.guia.atendimento.paciente.nome}
            </p>

            <p className="mt-1 text-xs text-slate-600">
              CPF:{" "}
              {formatarCpf(
                estorno.guia.atendimento.paciente.cpf
              )}
            </p>
          </div>

          <div className="rounded-md border border-slate-300 p-4">
            <p className="text-[11px] font-semibold uppercase text-slate-500">
              Parceiro do atendimento
            </p>

            <p className="mt-2 font-bold">
              {estorno.guia.clinica.nome}
            </p>

            <p className="mt-1 text-xs text-slate-600">
              Documento:{" "}
              {formatarDocumento(
                estorno.guia.clinica.documento
              )}
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-[11px] font-semibold uppercase text-red-700">
            Dados do estorno
          </p>

          <div className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <span className="text-xs text-slate-500">
                Valor
              </span>
              <p className="font-bold text-red-700">
                {moeda(estorno.valor)}
              </p>
            </div>

            <div>
              <span className="text-xs text-slate-500">
                Forma
              </span>
              <p className="font-semibold">
                {formaPagamentoLabel(estorno.forma)}
              </p>
            </div>

            <div>
              <span className="text-xs text-slate-500">
                Data e hora
              </span>
              <p className="font-semibold">
                {criadoEm.toLocaleString("pt-BR")}
              </p>
            </div>

            <div>
              <span className="text-xs text-slate-500">
                Recibo relacionado
              </span>
              <p className="font-semibold">
                {reciboRelacionado?.codigoPublico ||
                  "Não informado"}
              </p>
            </div>

            <div className="sm:col-span-2">
              <span className="text-xs text-slate-500">
                Motivo
              </span>
              <p className="font-semibold">
                {estorno.motivo || "Não informado"}
              </p>
            </div>
          </div>
        </section>

        {reciboRelacionado && (
          <section className="mt-4 rounded-md border border-slate-300 p-4">
            <p className="text-[11px] font-semibold uppercase text-slate-500">
              Situação do recibo relacionado
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">
                  {reciboRelacionado.codigoPublico}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Valor recebido:{" "}
                  {moeda(reciboRelacionado.valorRecebido)}
                </p>
              </div>

              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                {reciboRelacionado.status.replaceAll("_", " ")}
              </span>
            </div>
          </section>
        )}

        {procedimentosAtivos.length > 0 && (
          <section className="mt-4">
            <p className="text-[11px] font-semibold uppercase text-slate-500">
              Procedimentos ativos na guia
            </p>

            <div className="mt-2 overflow-hidden rounded-md border border-slate-300">
              {procedimentosAtivos.map((item) => (
                <div
                  key={item.id}
                  className="border-b border-slate-200 px-4 py-2.5 text-sm last:border-b-0"
                >
                  <p className="font-semibold">
                    {item.procedimento.nome}
                  </p>

                  {item.procedimento.categoria && (
                    <p className="text-[10px] text-slate-500">
                      {item.procedimento.categoria}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-5 rounded-md border-2 border-red-300 p-4 text-center">
          <p className="text-sm font-bold text-red-700">
            Este documento comprova o estorno de{" "}
            {moeda(estorno.valor)} vinculado ao atendimento e
            pagamento identificados acima.
          </p>
        </section>

        <footer className="mt-6 border-t border-slate-300 pt-3 text-[10px] text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Emitido em {criadoEm.toLocaleDateString("pt-BR")} às{" "}
              {criadoEm.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            <span>
              Gerado pelo Digna Conect • {estorno.codigoPublico}
            </span>
          </div>
        </footer>
      </article>
    </main>
  );
}
