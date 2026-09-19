"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  Save,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type ConfiguracoesApi = {
  organizacao: {
    id: number;
    nomeFantasia: string;
    razaoSocial: string | null;
    documento: string | null;
    telefone: string | null;
    whatsapp: string | null;
    email: string | null;
    endereco: string | null;
  };
  orcamentos: {
    validadeDiasPadrao: number;
    condicoesPagamentoPadrao: string;
  };
  guias: {
    validadeMesesPadrao: number;
  };
};

type Formulario = {
  nomeFantasia: string;
  razaoSocial: string;
  documento: string;
  telefone: string;
  whatsapp: string;
  email: string;
  endereco: string;
  validadeOrcamentoDiasPadrao: string;
  condicoesPagamentoOrcamentoPadrao: string;
  validadeGuiaMesesPadrao: string;
};

const formularioVazio: Formulario = {
  nomeFantasia: "",
  razaoSocial: "",
  documento: "",
  telefone: "",
  whatsapp: "",
  email: "",
  endereco: "",
  validadeOrcamentoDiasPadrao: "15",
  condicoesPagamentoOrcamentoPadrao:
    "Consulte a equipe Digna Saúde sobre as formas e condições de pagamento disponíveis.",
  validadeGuiaMesesPadrao: "6",
};

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, "");
}

function formatarDocumento(valor: string) {
  const n = somenteNumeros(valor).slice(0, 14);

  if (n.length <= 11) {
    return n
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  return n
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function campoClasse(desabilitado = false) {
  return `mt-1.5 w-full rounded-md border border-xango-border px-3 py-2.5 text-sm outline-none transition focus:border-xango-primary focus:ring-2 focus:ring-xango-primary/10 ${
    desabilitado ? "bg-slate-50 text-xango-muted" : "bg-white text-xango-text"
  }`;
}

export default function ConfiguracoesGeraisPage() {
  const router = useRouter();
  const { temPermissao, recarregarUsuario } = useAuth();
  const podeVisualizar = temPermissao("configuracoes.visualizar");
  const podeEditar = temPermissao("configuracoes.editar");

  const [form, setForm] = useState<Formulario>(formularioVazio);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    if (!podeVisualizar) {
      setCarregando(false);
      return;
    }

    let ativo = true;

    void (async () => {
      try {
        setErro("");
        const resposta = await fetch(`${API_URL}/configuracoes/gerais`, {
          cache: "no-store",
        });
        const dados: ConfiguracoesApi & { erro?: string } =
          await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados.erro || "Não foi possível carregar as configurações."
          );
        }

        if (!ativo) return;

        setForm({
          nomeFantasia: dados.organizacao.nomeFantasia || "",
          razaoSocial: dados.organizacao.razaoSocial || "",
          documento: formatarDocumento(dados.organizacao.documento || ""),
          telefone: dados.organizacao.telefone || "",
          whatsapp: dados.organizacao.whatsapp || "",
          email: dados.organizacao.email || "",
          endereco: dados.organizacao.endereco || "",
          validadeOrcamentoDiasPadrao: String(
            dados.orcamentos.validadeDiasPadrao || 15
          ),
          condicoesPagamentoOrcamentoPadrao:
            dados.orcamentos.condicoesPagamentoPadrao || "",
          validadeGuiaMesesPadrao: String(
            dados.guias.validadeMesesPadrao || 6
          ),
        });
      } catch (e) {
        if (ativo) {
          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível carregar as configurações."
          );
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [podeVisualizar]);

  function alterar<K extends keyof Formulario>(campo: K, valor: Formulario[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    setSucesso("");
  }

  async function salvar() {
    if (!podeEditar || salvando) return;

    try {
      setSalvando(true);
      setErro("");
      setSucesso("");

      if (!form.nomeFantasia.trim()) {
        throw new Error("Informe o nome fantasia.");
      }

      const validadeOrcamento = Number(form.validadeOrcamentoDiasPadrao);
      const validadeGuia = Number(form.validadeGuiaMesesPadrao);

      if (
        !Number.isInteger(validadeOrcamento) ||
        validadeOrcamento < 1 ||
        validadeOrcamento > 365
      ) {
        throw new Error(
          "A validade padrão do orçamento deve ficar entre 1 e 365 dias."
        );
      }

      if (
        !Number.isInteger(validadeGuia) ||
        validadeGuia < 1 ||
        validadeGuia > 60
      ) {
        throw new Error(
          "A validade padrão do voucher deve ficar entre 1 e 60 meses."
        );
      }

      const documento = somenteNumeros(form.documento);
      if (documento && ![11, 14].includes(documento.length)) {
        throw new Error("Informe um CPF ou CNPJ com 11 ou 14 dígitos.");
      }

      const resposta = await fetch(`${API_URL}/configuracoes/gerais`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeFantasia: form.nomeFantasia.trim(),
          razaoSocial: form.razaoSocial.trim(),
          documento,
          telefone: form.telefone.trim(),
          whatsapp: form.whatsapp.trim(),
          email: form.email.trim(),
          endereco: form.endereco.trim(),
          validadeOrcamentoDiasPadrao: validadeOrcamento,
          condicoesPagamentoOrcamentoPadrao:
            form.condicoesPagamentoOrcamentoPadrao.trim(),
          validadeGuiaMesesPadrao: validadeGuia,
        }),
      });

      const resultado: { erro?: string } = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro || "Não foi possível salvar as configurações."
        );
      }

      await recarregarUsuario();
      setSucesso("Configurações salvas com sucesso.");
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

  if (!podeVisualizar) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 text-amber-700" size={22} />
          <div>
            <h2 className="font-semibold text-amber-900">Acesso restrito</h2>
            <p className="mt-1 text-sm text-amber-800">
              Seu usuário não possui permissão para visualizar as configurações
              gerais.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="flex min-h-80 items-center justify-center text-sm text-xango-muted">
        <Loader2 className="mr-2 animate-spin" size={20} />
        Carregando configurações...
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
            className="rounded-md border border-xango-border bg-white p-2 text-xango-primary transition hover:bg-xango-background"
            title="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-semibold text-xango-text">
              Organização e parâmetros
            </h2>
            <p className="mt-1 text-sm text-xango-muted">
              Estes padrões são usados em novos documentos. O histórico já
              emitido não é alterado.
            </p>
          </div>
        </div>

        {podeEditar && (
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
            className="flex items-center gap-2 rounded-md bg-xango-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-xango-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {salvando ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Save size={17} />
            )}
            {salvando ? "Salvando..." : "Salvar configurações"}
          </button>
        )}
      </div>

      {erro && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="mb-5 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 size={17} />
          {sucesso}
        </div>
      )}

      <div className="space-y-5">
        <section className="rounded-xl border border-xango-border bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3 border-b border-xango-border pb-4">
            <div className="rounded-lg bg-xango-background p-2.5 text-xango-primary">
              <Building2 size={19} />
            </div>
            <div>
              <h3 className="font-semibold text-xango-text">
                Dados da organização
              </h3>
              <p className="mt-1 text-sm text-xango-muted">
                Informações usadas no sistema e nos documentos da Digna.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-xango-text">
              Nome fantasia <span className="text-red-500">*</span>
              <input
                value={form.nomeFantasia}
                onChange={(e) => alterar("nomeFantasia", e.target.value)}
                disabled={!podeEditar}
                className={campoClasse(!podeEditar)}
                maxLength={150}
              />
            </label>

            <label className="text-sm font-medium text-xango-text">
              Razão social
              <input
                value={form.razaoSocial}
                onChange={(e) => alterar("razaoSocial", e.target.value)}
                disabled={!podeEditar}
                className={campoClasse(!podeEditar)}
                maxLength={200}
              />
            </label>

            <label className="text-sm font-medium text-xango-text">
              CPF / CNPJ
              <input
                value={form.documento}
                onChange={(e) =>
                  alterar("documento", formatarDocumento(e.target.value))
                }
                disabled={!podeEditar}
                className={campoClasse(!podeEditar)}
                inputMode="numeric"
              />
            </label>

            <label className="text-sm font-medium text-xango-text">
              E-mail
              <input
                type="email"
                value={form.email}
                onChange={(e) => alterar("email", e.target.value)}
                disabled={!podeEditar}
                className={campoClasse(!podeEditar)}
                maxLength={200}
              />
            </label>

            <label className="text-sm font-medium text-xango-text">
              Telefone
              <input
                value={form.telefone}
                onChange={(e) => alterar("telefone", e.target.value)}
                disabled={!podeEditar}
                className={campoClasse(!podeEditar)}
                maxLength={30}
              />
            </label>

            <label className="text-sm font-medium text-xango-text">
              WhatsApp
              <input
                value={form.whatsapp}
                onChange={(e) => alterar("whatsapp", e.target.value)}
                disabled={!podeEditar}
                className={campoClasse(!podeEditar)}
                maxLength={30}
              />
            </label>

            <label className="text-sm font-medium text-xango-text md:col-span-2">
              Endereço completo
              <input
                value={form.endereco}
                onChange={(e) => alterar("endereco", e.target.value)}
                disabled={!podeEditar}
                className={campoClasse(!podeEditar)}
                maxLength={500}
                placeholder="Rua, número, complemento, bairro, cidade - UF, CEP"
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-xango-border bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3 border-b border-xango-border pb-4">
            <div className="rounded-lg bg-xango-background p-2.5 text-xango-primary">
              <FileText size={19} />
            </div>
            <div>
              <h3 className="font-semibold text-xango-text">Orçamentos</h3>
              <p className="mt-1 text-sm text-xango-muted">
                Valores padrão aplicados quando um novo orçamento é aberto.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[220px_1fr]">
            <label className="text-sm font-medium text-xango-text">
              Validade padrão (dias)
              <input
                type="number"
                min={1}
                max={365}
                value={form.validadeOrcamentoDiasPadrao}
                onChange={(e) =>
                  alterar("validadeOrcamentoDiasPadrao", e.target.value)
                }
                disabled={!podeEditar}
                className={campoClasse(!podeEditar)}
              />
              <span className="mt-1 block text-xs font-normal text-xango-muted">
                Entre 1 e 365 dias.
              </span>
            </label>

            <label className="text-sm font-medium text-xango-text">
              Condições de pagamento padrão
              <textarea
                value={form.condicoesPagamentoOrcamentoPadrao}
                onChange={(e) =>
                  alterar(
                    "condicoesPagamentoOrcamentoPadrao",
                    e.target.value
                  )
                }
                disabled={!podeEditar}
                className={`${campoClasse(!podeEditar)} min-h-28 resize-y`}
                maxLength={1000}
              />
              <span className="mt-1 block text-xs font-normal text-xango-muted">
                Pode ser ajustada individualmente em cada orçamento.
              </span>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-xango-border bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3 border-b border-xango-border pb-4">
            <div className="rounded-lg bg-xango-background p-2.5 text-xango-primary">
              <CalendarDays size={19} />
            </div>
            <div>
              <h3 className="font-semibold text-xango-text">
                Guias e vouchers
              </h3>
              <p className="mt-1 text-sm text-xango-muted">
                Define a validade inicial de novas guias geradas pelo sistema.
              </p>
            </div>
          </div>

          <div className="mt-5 max-w-xs">
            <label className="text-sm font-medium text-xango-text">
              Validade padrão (meses)
              <input
                type="number"
                min={1}
                max={60}
                value={form.validadeGuiaMesesPadrao}
                onChange={(e) =>
                  alterar("validadeGuiaMesesPadrao", e.target.value)
                }
                disabled={!podeEditar}
                className={campoClasse(!podeEditar)}
              />
              <span className="mt-1 block text-xs font-normal text-xango-muted">
                O padrão atual da Digna é 6 meses. Alterações valem apenas para
                novas guias.
              </span>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
