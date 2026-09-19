"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  FileText,
  Hash,
  Loader2,
  RotateCcw,
  Save,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type FormaPagamento = {
  codigo: string;
  label: string;
};

type ConfiguracaoApi = {
  formasPagamentoDisponiveis: FormaPagamento[];
  formasPagamentoHabilitadas: string[];
  numeracao: {
    proximoNumeroRecibo: number;
    proximoNumeroEstorno: number;
  };
  documentos: {
    textoPadraoRecibo: string;
    textoPadraoEstorno: string;
  };
};

export default function ConfiguracoesOperacionaisPage() {
  const router = useRouter();
  const { temPermissao } = useAuth();
  const podeEditar = temPermissao("configuracoes.editar");

  const [dadosOriginais, setDadosOriginais] = useState<ConfiguracaoApi | null>(null);
  const [formasDisponiveis, setFormasDisponiveis] = useState<FormaPagamento[]>([]);
  const [formasHabilitadas, setFormasHabilitadas] = useState<string[]>([]);
  const [proximoNumeroRecibo, setProximoNumeroRecibo] = useState(100001);
  const [proximoNumeroEstorno, setProximoNumeroEstorno] = useState(100001);
  const [textoPadraoRecibo, setTextoPadraoRecibo] = useState("");
  const [textoPadraoEstorno, setTextoPadraoEstorno] = useState("");

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  function aplicarDados(dados: ConfiguracaoApi) {
    setDadosOriginais(dados);
    setFormasDisponiveis(dados.formasPagamentoDisponiveis || []);
    setFormasHabilitadas(dados.formasPagamentoHabilitadas || []);
    setProximoNumeroRecibo(dados.numeracao?.proximoNumeroRecibo || 100001);
    setProximoNumeroEstorno(dados.numeracao?.proximoNumeroEstorno || 100001);
    setTextoPadraoRecibo(dados.documentos?.textoPadraoRecibo || "");
    setTextoPadraoEstorno(dados.documentos?.textoPadraoEstorno || "");
  }

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");
      const resposta = await fetch(`${API_URL}/configuracoes/operacionais`, {
        credentials: "include",
        cache: "no-store",
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(
          dados.erro || "Não foi possível carregar as configurações."
        );
      }
      aplicarDados(dados);
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar as configurações."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  const alterado = useMemo(() => {
    if (!dadosOriginais) return false;
    const atuais = [...formasHabilitadas].sort().join("|");
    const originais = [...dadosOriginais.formasPagamentoHabilitadas]
      .sort()
      .join("|");

    return (
      atuais !== originais ||
      proximoNumeroRecibo !==
        dadosOriginais.numeracao.proximoNumeroRecibo ||
      proximoNumeroEstorno !==
        dadosOriginais.numeracao.proximoNumeroEstorno ||
      textoPadraoRecibo !== dadosOriginais.documentos.textoPadraoRecibo ||
      textoPadraoEstorno !== dadosOriginais.documentos.textoPadraoEstorno
    );
  }, [
    dadosOriginais,
    formasHabilitadas,
    proximoNumeroRecibo,
    proximoNumeroEstorno,
    textoPadraoRecibo,
    textoPadraoEstorno,
  ]);

  function alternarForma(codigo: string) {
    setSucesso("");
    setFormasHabilitadas((atuais) =>
      atuais.includes(codigo)
        ? atuais.filter((item) => item !== codigo)
        : [...atuais, codigo]
    );
  }

  function restaurar() {
    if (!dadosOriginais) return;
    aplicarDados(dadosOriginais);
    setErro("");
    setSucesso("");
  }

  async function salvar() {
    if (!podeEditar || !alterado) return;

    if (formasHabilitadas.length === 0) {
      setErro("Mantenha ao menos uma forma de pagamento habilitada.");
      return;
    }

    try {
      setSalvando(true);
      setErro("");
      setSucesso("");

      const resposta = await fetch(`${API_URL}/configuracoes/operacionais`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formasPagamentoHabilitadas: formasHabilitadas,
          proximoNumeroRecibo,
          proximoNumeroEstorno,
          textoPadraoRecibo,
          textoPadraoEstorno,
        }),
      });
      const resultado = await resposta.json();
      if (!resposta.ok) {
        throw new Error(
          resultado.erro || "Não foi possível salvar as configurações."
        );
      }

      setSucesso("Parâmetros salvos com sucesso.");
      await carregar();
      setSucesso("Parâmetros salvos com sucesso.");
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar as configurações."
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-80 items-center justify-center text-sm text-xango-muted">
        <Loader2 size={20} className="mr-2 animate-spin" />
        Carregando parâmetros...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl pb-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.push("/configuracoes")}
            className="rounded-md border border-xango-border bg-white p-2 text-xango-primary hover:bg-xango-background"
            aria-label="Voltar para configurações"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-semibold text-xango-text">
              Parâmetros operacionais e financeiros
            </h2>
            <p className="mt-1 text-sm text-xango-muted">
              Defina meios de pagamento, numeração e textos padrão dos
              documentos financeiros.
            </p>
          </div>
        </div>

        {podeEditar && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={restaurar}
              disabled={!alterado || salvando}
              className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-sm font-semibold text-xango-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw size={16} />
              Desfazer
            </button>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={!alterado || salvando}
              className="flex items-center gap-2 rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salvando ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Salvar configurações
            </button>
          </div>
        )}
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {sucesso}
        </div>
      )}

      {!podeEditar && (
        <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          Seu perfil possui acesso somente para consulta destas configurações.
        </div>
      )}

      <div className="space-y-5">
        <section className="rounded-xl border border-xango-border bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3 border-b border-xango-border pb-4">
            <div className="rounded-lg bg-xango-background p-2.5 text-xango-primary">
              <CreditCard size={19} />
            </div>
            <div>
              <h3 className="font-semibold text-xango-text">
                Formas de pagamento
              </h3>
              <p className="mt-1 text-sm text-xango-muted">
                Escolha as formas que os módulos financeiros deverão oferecer
                nos novos lançamentos.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {formasDisponiveis.map((forma) => {
              const marcada = formasHabilitadas.includes(forma.codigo);
              return (
                <label
                  key={forma.codigo}
                  className={`flex items-center gap-3 rounded-lg border p-4 transition ${
                    marcada
                      ? "border-xango-primary bg-xango-background"
                      : "border-xango-border bg-white"
                  } ${podeEditar ? "cursor-pointer" : "cursor-default"}`}
                >
                  <input
                    type="checkbox"
                    checked={marcada}
                    disabled={!podeEditar}
                    onChange={() => alternarForma(forma.codigo)}
                    className="h-4 w-4 accent-xango-primary"
                  />
                  <span className="text-sm font-semibold text-xango-text">
                    {forma.label}
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-xango-border bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3 border-b border-xango-border pb-4">
            <div className="rounded-lg bg-xango-background p-2.5 text-xango-primary">
              <Hash size={19} />
            </div>
            <div>
              <h3 className="font-semibold text-xango-text">
                Numeração dos documentos
              </h3>
              <p className="mt-1 text-sm text-xango-muted">
                Informe o próximo número a ser usado. A sequência pode avançar,
                mas nunca retroceder.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-xango-text">
              Próximo recibo
              <input
                type="number"
                min={1}
                max={999999999}
                value={proximoNumeroRecibo}
                disabled={!podeEditar}
                onChange={(event) =>
                  setProximoNumeroRecibo(Number(event.target.value))
                }
                className="mt-2 w-full rounded-lg border border-xango-border bg-white px-3 py-3 text-sm outline-none focus:border-xango-primary disabled:bg-slate-50"
              />
            </label>
            <label className="text-sm font-medium text-xango-text">
              Próximo estorno
              <input
                type="number"
                min={1}
                max={999999999}
                value={proximoNumeroEstorno}
                disabled={!podeEditar}
                onChange={(event) =>
                  setProximoNumeroEstorno(Number(event.target.value))
                }
                className="mt-2 w-full rounded-lg border border-xango-border bg-white px-3 py-3 text-sm outline-none focus:border-xango-primary disabled:bg-slate-50"
              />
            </label>
          </div>

          <p className="mt-3 text-xs leading-5 text-xango-muted">
            Alterar para um número maior cria um salto intencional na sequência.
            O sistema não permite reutilizar números de documentos anteriores.
          </p>
        </section>

        <section className="rounded-xl border border-xango-border bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3 border-b border-xango-border pb-4">
            <div className="rounded-lg bg-xango-background p-2.5 text-xango-primary">
              <FileText size={19} />
            </div>
            <div>
              <h3 className="font-semibold text-xango-text">
                Textos padrão de documentos
              </h3>
              <p className="mt-1 text-sm text-xango-muted">
                Textos institucionais que poderão ser usados nos recibos e
                comprovantes de estorno.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-xango-text">
              Texto padrão do recibo
              <textarea
                rows={4}
                maxLength={2000}
                value={textoPadraoRecibo}
                disabled={!podeEditar}
                onChange={(event) => setTextoPadraoRecibo(event.target.value)}
                placeholder="Ex.: Recebemos o valor referente aos procedimentos descritos neste recibo."
                className="mt-2 w-full resize-y rounded-lg border border-xango-border bg-white px-3 py-3 text-sm outline-none focus:border-xango-primary disabled:bg-slate-50"
              />
              <span className="mt-1 block text-right text-xs font-normal text-xango-muted">
                {textoPadraoRecibo.length}/2000
              </span>
            </label>

            <label className="block text-sm font-medium text-xango-text">
              Texto padrão do comprovante de estorno
              <textarea
                rows={4}
                maxLength={2000}
                value={textoPadraoEstorno}
                disabled={!podeEditar}
                onChange={(event) => setTextoPadraoEstorno(event.target.value)}
                placeholder="Ex.: Estorno referente ao pagamento identificado neste comprovante."
                className="mt-2 w-full resize-y rounded-lg border border-xango-border bg-white px-3 py-3 text-sm outline-none focus:border-xango-primary disabled:bg-slate-50"
              />
              <span className="mt-1 block text-right text-xs font-normal text-xango-muted">
                {textoPadraoEstorno.length}/2000
              </span>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
