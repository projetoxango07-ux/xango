"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "react-qr-code";


type GuiaApi = {
  id: number;
  status: string;
  subtotal: string | number;
  desconto: string | number;
  beneficio: string | number;
  valorFinal: string | number;
  clinica: {
    id: number;
    nome: string;
    razaoSocial: string | null;
    documento: string | null;
    telefone: string | null;
    email: string | null;
    endereco: string | null;
  };
  organizacao: {
    id: number;
    nomeFantasia: string;
    razaoSocial: string | null;
    documento: string | null;
    telefone: string | null;
    email: string | null;
    endereco: string | null;
  } | null;
  geradaPor: {
    id: number;
    nome: string;
    email: string | null;
  } | null;
  emitidaEm: string | null;
  validadeAte: string | null;
  atendimento: {
    id: number;
    paciente: {
      id: number;
      nome: string;
      cpf: string;
      telefone: string;
    };
  };
  itens: {
    id: number;
    status: string;
    valorPaciente: string | number;
    tipoAgendamento: "HORARIO" | "ORDEM_CHEGADA" | null;
    dataAgendamento: string | null;
    horarioAgendamento: string | null;
    procedimento: {
      id: number;
      nome: string;
      categoria: string | null;
    };
  }[];
  pagamentos: {
    id: number;
    valor: string | number;
    forma: string;
    observacao: string | null;
  }[];
  estornos: {
    id: number;
    valor: string | number;
    forma: string;
    motivo: string | null;
  }[];
};

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, "");
}

function formatarCpf(valor: string) {
  const numeros = somenteNumeros(valor).slice(0, 11);
  if (numeros.length !== 11) return valor;

  return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9, 11)}`;
}

function formatarTelefone(valor: string) {
  const numeros = somenteNumeros(valor).slice(0, 11);

  if (numeros.length === 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  }

  if (numeros.length === 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  }

  return valor;
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

function textoOuNaoInformado(valor: string | null | undefined) {
  return valor?.trim() || "Não informado";
}


function dataBr(valor: string | null) {
  if (!valor) return "";

  return new Date(valor).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });
}


export default function ImprimirGuiaPage() {
  const params = useParams();
  const id = Number(params.id);

  const [guia, setGuia] = useState<GuiaApi | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await fetch(`http://localhost:3333/guias/${id}`);
        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(dados.erro || "Não foi possível carregar a guia.");
        }

        setGuia(dados);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível carregar a guia.");
      } finally {
        setCarregando(false);
      }
    }

    if (id) carregar();
  }, [id]);

  if (carregando) {
    return <main className="p-8">Carregando guia...</main>;
  }

  if (erro || !guia) {
    return (
      <main className="p-8">
        <p className="font-semibold text-red-700">{erro || "Guia não encontrada."}</p>
      </main>
    );
  }

  const itensAtivos = guia.itens.filter((item) => item.status !== "CANCELADO");
  const totalPago = guia.pagamentos.reduce(
    (total, pagamento) => total + Number(pagamento.valor),
    0
  );
  const totalEstornado = guia.estornos.reduce(
    (total, estorno) => total + Number(estorno.valor),
    0
  );
  const pagoLiquido = Math.max(totalPago - totalEstornado, 0);

  const podeImprimir =
    itensAtivos.length > 0 &&
    guia.status === "PAGA" &&
    pagoLiquido >= Number(guia.valorFinal);

  const dataEmissao = guia.emitidaEm
    ? new Date(guia.emitidaEm)
    : new Date();

  const validadeAte = guia.validadeAte
    ? new Date(guia.validadeAte)
    : null;

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
          disabled={!podeImprimir}
          onClick={() => window.print()}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Imprimir
        </button>
      </div>

      <article className="mx-auto max-w-4xl bg-white p-8 shadow print:max-w-none print:p-0 print:shadow-none">
        {!podeImprimir && (
          <div className="mb-5 rounded-md border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700 print:hidden">
            Este voucher não está liberado para impressão.
          </div>
        )}

        {/* CABEÇALHO DA EMPRESA CONTRATANTE */}
        <header className="border-b-2 border-slate-900 pb-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <div>
              <h1 className="text-xl font-black tracking-tight">
                {guia.organizacao?.nomeFantasia || "DIGNA SAÚDE"}
              </h1>

              {guia.organizacao?.razaoSocial && (
                <p className="mt-1 text-xs text-slate-600">
                  {guia.organizacao.razaoSocial}
                </p>
              )}

              <div className="mt-2 grid gap-x-5 gap-y-1 text-[11px] leading-4 text-slate-600 sm:grid-cols-2">
                <div>
                  <strong>CNPJ/Documento:</strong>{" "}
                  {formatarDocumento(guia.organizacao?.documento || null)}
                </div>

                <div>
                  <strong>Telefone:</strong>{" "}
                  {textoOuNaoInformado(guia.organizacao?.telefone)}
                </div>

                <div className="sm:col-span-2">
                  <strong>Endereço:</strong>{" "}
                  {textoOuNaoInformado(guia.organizacao?.endereco)}
                </div>

                <div className="sm:col-span-2">
                  <strong>Atendente responsável:</strong>{" "}
                  {guia.geradaPor?.nome || "Não informado"}
                </div>
              </div>
            </div>

            <div className="text-right text-[10px] leading-4 text-slate-500">
              <p>
                Emitido em{" "}
                <strong className="text-slate-700">
                  {dataEmissao.toLocaleDateString("pt-BR")} às{" "}
                  {dataEmissao.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
              </p>

              <p className="mt-1">
                {validadeAte ? (
                  <>
                    Válido até{" "}
                    <strong className="text-slate-700">
                      {validadeAte.toLocaleDateString("pt-BR")}
                    </strong>
                  </>
                ) : (
                  "Validade não informada"
                )}
              </p>
            </div>
          </div>
        </header>

        {/* IDENTIFICAÇÃO DO VOUCHER */}
        <section className="mt-4 grid gap-4 border-b border-slate-300 pb-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Voucher de Atendimento
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <span className="text-[10px] uppercase text-slate-500">
                  Nº do voucher
                </span>
                <p className="text-lg font-black">#{guia.id}</p>
              </div>

              <div>
                <span className="text-[10px] uppercase text-slate-500">
                  Autorização
                </span>
                <p className="text-lg font-black">
                  AT-{guia.atendimento.id}-{guia.id}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white p-1">
              <QRCode
                value={`DIGNA|VOUCHER:${guia.id}|AUTORIZACAO:AT-${guia.atendimento.id}-${guia.id}`}
                size={92}
                level="M"
                bgColor="#FFFFFF"
                fgColor="#111827"
              />
            </div>

            <p className="max-w-28 text-[10px] leading-4 text-slate-500">
              QR Code para identificação e futura validação do voucher.
            </p>
          </div>
        </section>

        {/* PACIENTE */}
        <section className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Paciente
          </p>

          <div className="mt-2 grid gap-x-5 gap-y-2 rounded-md border border-slate-300 px-4 py-3 text-sm sm:grid-cols-3">
            <div className="sm:col-span-2">
              <span className="text-[10px] uppercase text-slate-500">Nome</span>
              <p className="font-bold">{guia.atendimento.paciente.nome}</p>
            </div>

            <div>
              <span className="text-[10px] uppercase text-slate-500">CPF</span>
              <p>{formatarCpf(guia.atendimento.paciente.cpf)}</p>
            </div>

            <div>
              <span className="text-[10px] uppercase text-slate-500">Telefone</span>
              <p>{formatarTelefone(guia.atendimento.paciente.telefone)}</p>
            </div>
          </div>
        </section>

        {/* CLÍNICA */}
        <section className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Clínica responsável pelo atendimento
          </p>

          <div className="mt-2 grid gap-x-5 gap-y-2 rounded-md border border-slate-300 px-4 py-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="font-bold">{guia.clinica.nome}</p>
              {guia.clinica.razaoSocial && (
                <p className="text-xs text-slate-600">
                  {guia.clinica.razaoSocial}
                </p>
              )}
            </div>

            <div>
              <strong>CNPJ/Documento:</strong>{" "}
              {formatarDocumento(guia.clinica.documento)}
            </div>

            <div>
              <strong>Telefone:</strong>{" "}
              {textoOuNaoInformado(guia.clinica.telefone)}
            </div>

            <div className="sm:col-span-2">
              <strong>Endereço:</strong>{" "}
              {textoOuNaoInformado(guia.clinica.endereco)}
            </div>
          </div>
        </section>

        {/* PROCEDIMENTOS COMPACTOS */}
        <section className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Procedimento(s)
          </p>

          <div className="mt-2 overflow-hidden rounded-md border border-slate-300">
            <div className="grid grid-cols-[1fr_170px] border-b border-slate-300 bg-slate-50 px-4 py-2 text-[10px] font-semibold uppercase text-slate-500">
              <span>Procedimento</span>
              <span>Agendamento</span>
            </div>

            {itensAtivos.map((item) => {
              const agendamento =
                item.tipoAgendamento === "HORARIO"
                  ? `${dataBr(item.dataAgendamento)} às ${item.horarioAgendamento || ""}`
                  : item.tipoAgendamento === "ORDEM_CHEGADA"
                    ? `${dataBr(item.dataAgendamento)} • ordem de chegada`
                    : "Aguardando clínica";

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_170px] items-center gap-4 border-b border-slate-200 px-4 py-2 text-sm last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="font-semibold leading-5">
                      {item.procedimento.nome}
                    </p>

                    {item.procedimento.categoria && (
                      <p className="text-[10px] text-slate-500">
                        {item.procedimento.categoria}
                      </p>
                    )}
                  </div>

                  <p className="text-xs leading-4 text-slate-700">
                    {agendamento}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="mt-6 border-t border-slate-300 pt-3 text-[10px] text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Documento emitido eletronicamente pela{" "}
              {guia.organizacao?.nomeFantasia || "Digna Saúde"}.
            </span>

            <span>
              Gerado pelo Digna Conect • Voucher #{guia.id}
            </span>
          </div>
        </footer>
      </article>
    </main>
  );
}