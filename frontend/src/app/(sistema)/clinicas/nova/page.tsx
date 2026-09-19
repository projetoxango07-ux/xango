"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
  WalletCards,
} from "lucide-react";

type UnidadeForm = {
  nome: string;
  usaEnderecoFiscal: boolean;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  telefone: string;
  whatsapp: string;
  email: string;
  aberto: boolean;
  buscandoCep: boolean;
};

type Formulario = {
  nome: string;
  razaoSocial: string;
  documento: string;
  telefone: string;
  whatsapp: string;
  email: string;

  cepFiscal: string;
  logradouroFiscal: string;
  numeroFiscal: string;
  complementoFiscal: string;
  bairroFiscal: string;
  cidadeFiscal: string;
  ufFiscal: string;

  responsavelLegalNome: string;
  responsavelLegalCpf: string;
  responsavelLegalCargo: string;
  responsavelLegalTelefone: string;
  responsavelLegalEmail: string;

  financeiroMesmoLegal: boolean;
  responsavelFinanceiroNome: string;
  responsavelFinanceiroCpf: string;
  responsavelFinanceiroCargo: string;
  responsavelFinanceiroTelefone: string;
  responsavelFinanceiroEmail: string;

  observacoes: string;
};

const formularioInicial: Formulario = {
  nome: "",
  razaoSocial: "",
  documento: "",
  telefone: "",
  whatsapp: "",
  email: "",
  cepFiscal: "",
  logradouroFiscal: "",
  numeroFiscal: "",
  complementoFiscal: "",
  bairroFiscal: "",
  cidadeFiscal: "",
  ufFiscal: "",
  responsavelLegalNome: "",
  responsavelLegalCpf: "",
  responsavelLegalCargo: "",
  responsavelLegalTelefone: "",
  responsavelLegalEmail: "",
  financeiroMesmoLegal: false,
  responsavelFinanceiroNome: "",
  responsavelFinanceiroCpf: "",
  responsavelFinanceiroCargo: "",
  responsavelFinanceiroTelefone: "",
  responsavelFinanceiroEmail: "",
  observacoes: "",
};

function novaUnidade(indice: number): UnidadeForm {
  return {
    nome: indice === 0 ? "Unidade principal" : `Unidade ${indice + 1}`,
    usaEnderecoFiscal: false,
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    telefone: "",
    whatsapp: "",
    email: "",
    aberto: true,
    buscandoCep: false,
  };
}

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, "");
}

function formatarCpfCnpj(valor: string) {
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

function formatarCpf(valor: string) {
  const n = somenteNumeros(valor).slice(0, 11);

  return n
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatarTelefone(valor: string) {
  const n = somenteNumeros(valor).slice(0, 11);

  if (n.length <= 10) {
    return n
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return n
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function formatarCep(valor: string) {
  const n = somenteNumeros(valor).slice(0, 8);
  return n.replace(/^(\d{5})(\d)/, "$1-$2");
}

type ViaCep = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export default function NovaClinicaPage() {
  const router = useRouter();

  const [form, setForm] = useState<Formulario>(formularioInicial);
  const [unidades, setUnidades] = useState<UnidadeForm[]>([novaUnidade(0)]);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCepFiscal, setBuscandoCepFiscal] = useState(false);
  const [erro, setErro] = useState("");

  const fiscalCompleto = useMemo(
    () =>
      Boolean(
        form.cepFiscal &&
          form.logradouroFiscal &&
          form.numeroFiscal &&
          form.bairroFiscal &&
          form.cidadeFiscal &&
          form.ufFiscal
      ),
    [form]
  );

  function alterar<K extends keyof Formulario>(
    campo: K,
    valor: Formulario[K]
  ) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  function alterarUnidade(
    indice: number,
    campo: keyof UnidadeForm,
    valor: string | boolean
  ) {
    setUnidades((atuais) =>
      atuais.map((unidade, i) =>
        i === indice ? { ...unidade, [campo]: valor } : unidade
      )
    );
  }

  async function consultarCepFiscal() {
    const cep = somenteNumeros(form.cepFiscal);

    if (cep.length !== 8) return;

    try {
      setBuscandoCepFiscal(true);
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const dados: ViaCep = await resposta.json();

      if (!resposta.ok || dados.erro) {
        throw new Error("CEP não encontrado.");
      }

      setForm((atual) => ({
        ...atual,
        cepFiscal: formatarCep(dados.cep || cep),
        logradouroFiscal: dados.logradouro || atual.logradouroFiscal,
        complementoFiscal: atual.complementoFiscal || dados.complemento || "",
        bairroFiscal: dados.bairro || atual.bairroFiscal,
        cidadeFiscal: dados.localidade || atual.cidadeFiscal,
        ufFiscal: dados.uf || atual.ufFiscal,
      }));
    } catch (e) {
      console.error("Erro ao consultar CEP fiscal:", e);
      setErro("Não foi possível localizar o CEP fiscal.");
    } finally {
      setBuscandoCepFiscal(false);
    }
  }

  async function consultarCepUnidade(indice: number) {
    const unidade = unidades[indice];
    const cep = somenteNumeros(unidade.cep);

    if (cep.length !== 8 || unidade.usaEnderecoFiscal) return;

    try {
      alterarUnidade(indice, "buscandoCep", true);

      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const dados: ViaCep = await resposta.json();

      if (!resposta.ok || dados.erro) {
        throw new Error("CEP não encontrado.");
      }

      setUnidades((atuais) =>
        atuais.map((item, i) =>
          i === indice
            ? {
                ...item,
                cep: formatarCep(dados.cep || cep),
                logradouro: dados.logradouro || item.logradouro,
                complemento: item.complemento || dados.complemento || "",
                bairro: dados.bairro || item.bairro,
                cidade: dados.localidade || item.cidade,
                uf: dados.uf || item.uf,
                buscandoCep: false,
              }
            : item
        )
      );
    } catch (e) {
      console.error("Erro ao consultar CEP da unidade:", e);
      alterarUnidade(indice, "buscandoCep", false);
      setErro("Não foi possível localizar o CEP da unidade.");
    }
  }

  function marcarEnderecoFiscal(indice: number, marcado: boolean) {
    setUnidades((atuais) =>
      atuais.map((unidade, i) => {
        if (i !== indice) return unidade;

        if (!marcado) {
          return { ...unidade, usaEnderecoFiscal: false };
        }

        return {
          ...unidade,
          usaEnderecoFiscal: true,
          cep: form.cepFiscal,
          logradouro: form.logradouroFiscal,
          numero: form.numeroFiscal,
          complemento: form.complementoFiscal,
          bairro: form.bairroFiscal,
          cidade: form.cidadeFiscal,
          uf: form.ufFiscal,
        };
      })
    );
  }

  function adicionarUnidade() {
    setUnidades((atuais) => [...atuais, novaUnidade(atuais.length)]);
  }

  function removerUnidade(indice: number) {
    if (unidades.length === 1) return;
    setUnidades((atuais) => atuais.filter((_, i) => i !== indice));
  }

  async function salvar() {
    try {
      setErro("");

      if (!form.nome.trim()) {
        setErro("Informe o nome fantasia da clínica.");
        return;
      }

      if (!somenteNumeros(form.documento)) {
        setErro("Informe o CNPJ ou CPF da clínica.");
        return;
      }

      if (unidades.some((unidade) => !unidade.nome.trim())) {
        setErro("Informe o nome de todas as unidades.");
        return;
      }

      setSalvando(true);

      const payload = {
        ...form,
        unidades: unidades.map((unidade) => ({
          nome: unidade.nome,
          usaEnderecoFiscal: unidade.usaEnderecoFiscal,
          cep: unidade.cep,
          logradouro: unidade.logradouro,
          numero: unidade.numero,
          complemento: unidade.complemento,
          bairro: unidade.bairro,
          cidade: unidade.cidade,
          uf: unidade.uf,
          telefone: unidade.telefone,
          whatsapp: unidade.whatsapp,
          email: unidade.email,
        })),
      };

      const resposta = await fetch("http://localhost:3333/clinicas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro || "Não foi possível cadastrar a clínica."
        );
      }

      router.push(`/clinicas/${resultado.id}`);
    } catch (e) {
      console.error("Erro ao cadastrar clínica:", e);

      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível cadastrar a clínica."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto max-w-375 pb-12">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.push("/clinicas")}
            className="mt-0.5 rounded-md border border-xango-border bg-white p-2 text-xango-primary transition hover:bg-xango-background"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <h2 className="text-2xl font-semibold text-xango-text">
              Nova clínica
            </h2>
            <p className="mt-1 text-sm text-xango-muted">
              Cadastre a empresa parceira, responsáveis e unidades de atendimento.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando}
          className="flex items-center gap-2 rounded-md bg-xango-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-xango-primary-hover disabled:opacity-50"
        >
          {salvando ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {salvando ? "Salvando..." : "Salvar clínica"}
        </button>
      </div>

      {erro && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {erro}
        </div>
      )}

      <Bloco
        icone={<Building2 size={18} />}
        titulo="Dados da clínica"
        descricao="Dados cadastrais e principais canais de contato."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Campo label="Nome fantasia *">
            <input
              value={form.nome}
              onChange={(e) => alterar("nome", e.target.value)}
              className={inputClass}
            />
          </Campo>

          <Campo label="Razão social">
            <input
              value={form.razaoSocial}
              onChange={(e) => alterar("razaoSocial", e.target.value)}
              className={inputClass}
            />
          </Campo>

          <Campo label="CNPJ / CPF *">
            <input
              value={form.documento}
              onChange={(e) =>
                alterar("documento", formatarCpfCnpj(e.target.value))
              }
              className={inputClass}
            />
          </Campo>

          <Campo label="Telefone">
            <input
              value={form.telefone}
              onChange={(e) =>
                alterar("telefone", formatarTelefone(e.target.value))
              }
              className={inputClass}
            />
          </Campo>

          <Campo label="WhatsApp">
            <input
              value={form.whatsapp}
              onChange={(e) =>
                alterar("whatsapp", formatarTelefone(e.target.value))
              }
              className={inputClass}
            />
          </Campo>

          <Campo label="E-mail">
            <input
              type="email"
              value={form.email}
              onChange={(e) => alterar("email", e.target.value)}
              className={inputClass}
            />
          </Campo>
        </div>
      </Bloco>

      <Bloco
        icone={<MapPin size={18} />}
        titulo="Endereço fiscal"
        descricao="Digite o CEP para preencher automaticamente o endereço."
      >
        <Endereco
          valores={{
            cep: form.cepFiscal,
            logradouro: form.logradouroFiscal,
            numero: form.numeroFiscal,
            complemento: form.complementoFiscal,
            bairro: form.bairroFiscal,
            cidade: form.cidadeFiscal,
            uf: form.ufFiscal,
          }}
          buscandoCep={buscandoCepFiscal}
          consultarCep={() => void consultarCepFiscal()}
          alterar={(campo, valor) => {
            const mapa = {
              cep: "cepFiscal",
              logradouro: "logradouroFiscal",
              numero: "numeroFiscal",
              complemento: "complementoFiscal",
              bairro: "bairroFiscal",
              cidade: "cidadeFiscal",
              uf: "ufFiscal",
            } as const;

            alterar(mapa[campo], valor);
          }}
        />
      </Bloco>

      <Bloco
        icone={<UserRound size={18} />}
        titulo="Responsável legal"
        descricao="Pessoa legalmente responsável pela clínica."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Campo label="Nome completo">
            <input
              value={form.responsavelLegalNome}
              onChange={(e) =>
                alterar("responsavelLegalNome", e.target.value)
              }
              className={inputClass}
            />
          </Campo>

          <Campo label="CPF">
            <input
              value={form.responsavelLegalCpf}
              onChange={(e) =>
                alterar(
                  "responsavelLegalCpf",
                  formatarCpf(e.target.value)
                )
              }
              className={inputClass}
            />
          </Campo>

          <Campo label="Cargo / função">
            <input
              value={form.responsavelLegalCargo}
              onChange={(e) =>
                alterar("responsavelLegalCargo", e.target.value)
              }
              className={inputClass}
            />
          </Campo>

          <Campo label="Telefone / WhatsApp">
            <input
              value={form.responsavelLegalTelefone}
              onChange={(e) =>
                alterar(
                  "responsavelLegalTelefone",
                  formatarTelefone(e.target.value)
                )
              }
              className={inputClass}
            />
          </Campo>

          <Campo label="E-mail">
            <input
              type="email"
              value={form.responsavelLegalEmail}
              onChange={(e) =>
                alterar("responsavelLegalEmail", e.target.value)
              }
              className={inputClass}
            />
          </Campo>
        </div>
      </Bloco>

      <Bloco
        icone={<WalletCards size={18} />}
        titulo="Responsável financeiro"
        descricao="Contato responsável por repasses e assuntos financeiros."
      >
        <label className="mb-5 flex cursor-pointer items-center gap-3 rounded-md border border-xango-border bg-xango-background/50 px-4 py-3">
          <input
            type="checkbox"
            checked={form.financeiroMesmoLegal}
            onChange={(e) =>
              alterar("financeiroMesmoLegal", e.target.checked)
            }
            className="h-4 w-4 accent-xango-primary"
          />
          <div>
            <p className="text-sm font-semibold text-xango-text">
              Responsável financeiro é o mesmo responsável legal
            </p>
            <p className="mt-0.5 text-xs text-xango-muted">
              Os dados do responsável legal serão utilizados automaticamente.
            </p>
          </div>
        </label>

        {form.financeiroMesmoLegal ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <Check size={16} />
            Utilizando os dados do responsável legal.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Campo label="Nome completo">
              <input
                value={form.responsavelFinanceiroNome}
                onChange={(e) =>
                  alterar("responsavelFinanceiroNome", e.target.value)
                }
                className={inputClass}
              />
            </Campo>

            <Campo label="CPF">
              <input
                value={form.responsavelFinanceiroCpf}
                onChange={(e) =>
                  alterar(
                    "responsavelFinanceiroCpf",
                    formatarCpf(e.target.value)
                  )
                }
                className={inputClass}
              />
            </Campo>

            <Campo label="Cargo / função">
              <input
                value={form.responsavelFinanceiroCargo}
                onChange={(e) =>
                  alterar("responsavelFinanceiroCargo", e.target.value)
                }
                className={inputClass}
              />
            </Campo>

            <Campo label="Telefone / WhatsApp">
              <input
                value={form.responsavelFinanceiroTelefone}
                onChange={(e) =>
                  alterar(
                    "responsavelFinanceiroTelefone",
                    formatarTelefone(e.target.value)
                  )
                }
                className={inputClass}
              />
            </Campo>

            <Campo label="E-mail">
              <input
                type="email"
                value={form.responsavelFinanceiroEmail}
                onChange={(e) =>
                  alterar("responsavelFinanceiroEmail", e.target.value)
                }
                className={inputClass}
              />
            </Campo>
          </div>
        )}
      </Bloco>

      <section className="mt-4 overflow-hidden rounded-lg border border-xango-border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-xango-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-xango-primary">
              <Building2 size={18} />
              <h3 className="font-semibold text-xango-text">
                Unidades de atendimento
              </h3>
            </div>

            <p className="mt-1 text-xs text-xango-muted">
              Cadastre pelo menos uma unidade.
            </p>
          </div>

          <button
            type="button"
            onClick={adicionarUnidade}
            className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary transition hover:bg-xango-background"
          >
            <Plus size={15} />
            Adicionar unidade
          </button>
        </div>

        <div className="space-y-3 p-5">
          {unidades.map((unidade, indice) => (
            <div
              key={indice}
              className="overflow-hidden rounded-lg border border-xango-border"
            >
              <div className="flex items-center gap-3 bg-xango-background/40 px-4 py-3">
                <button
                  type="button"
                  onClick={() =>
                    alterarUnidade(indice, "aberto", !unidade.aberto)
                  }
                  className="text-xango-muted"
                >
                  {unidade.aberto ? (
                    <ChevronUp size={17} />
                  ) : (
                    <ChevronDown size={17} />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-xango-text">
                    {unidade.nome || `Unidade ${indice + 1}`}
                  </p>

                  <p className="text-xs text-xango-muted">
                    {unidade.usaEnderecoFiscal
                      ? "Usando endereço fiscal"
                      : "Endereço próprio"}
                  </p>
                </div>

                {unidades.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removerUnidade(indice)}
                    className="rounded-md p-2 text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {unidade.aberto && (
                <div className="p-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Campo label="Nome da unidade *">
                      <input
                        value={unidade.nome}
                        onChange={(e) =>
                          alterarUnidade(indice, "nome", e.target.value)
                        }
                        className={inputClass}
                        placeholder="Ex.: Unidade Praia Grande"
                      />
                    </Campo>

                    <Campo label="Telefone">
                      <input
                        value={unidade.telefone}
                        onChange={(e) =>
                          alterarUnidade(
                            indice,
                            "telefone",
                            formatarTelefone(e.target.value)
                          )
                        }
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="WhatsApp">
                      <input
                        value={unidade.whatsapp}
                        onChange={(e) =>
                          alterarUnidade(
                            indice,
                            "whatsapp",
                            formatarTelefone(e.target.value)
                          )
                        }
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="E-mail">
                      <input
                        type="email"
                        value={unidade.email}
                        onChange={(e) =>
                          alterarUnidade(indice, "email", e.target.value)
                        }
                        className={inputClass}
                      />
                    </Campo>
                  </div>

                  <label className="my-5 flex cursor-pointer items-center gap-3 rounded-md border border-xango-border bg-xango-background/50 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={unidade.usaEnderecoFiscal}
                      onChange={(e) =>
                        marcarEnderecoFiscal(indice, e.target.checked)
                      }
                      disabled={
                        !fiscalCompleto && !unidade.usaEnderecoFiscal
                      }
                      className="h-4 w-4 accent-xango-primary disabled:opacity-50"
                    />

                    <div>
                      <p className="text-sm font-semibold text-xango-text">
                        Usar endereço fiscal nesta unidade
                      </p>

                      <p className="mt-0.5 text-xs text-xango-muted">
                        {fiscalCompleto
                          ? "O endereço fiscal será copiado para a unidade."
                          : "Preencha o endereço fiscal acima para utilizar esta opção."}
                      </p>
                    </div>
                  </label>

                  <Endereco
                    valores={unidade}
                    buscandoCep={unidade.buscandoCep}
                    consultarCep={() =>
                      void consultarCepUnidade(indice)
                    }
                    desabilitado={unidade.usaEnderecoFiscal}
                    alterar={(campo, valor) =>
                      alterarUnidade(indice, campo, valor)
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <Bloco
        icone={<Building2 size={18} />}
        titulo="Observações"
        descricao="Informações administrativas internas sobre a parceria."
      >
        <textarea
          value={form.observacoes}
          onChange={(e) => alterar("observacoes", e.target.value)}
          rows={4}
          className={`${inputClass} resize-y`}
          placeholder="Observações internas..."
        />
      </Bloco>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/clinicas")}
          className="rounded-md border border-xango-border bg-white px-4 py-2.5 text-sm font-semibold text-xango-muted transition hover:bg-xango-background"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando}
          className="flex items-center gap-2 rounded-md bg-xango-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-xango-primary-hover disabled:opacity-50"
        >
          {salvando ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          Salvar clínica
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-xango-border bg-white px-3 py-2.5 text-sm text-xango-text outline-none transition placeholder:text-xango-muted/60 focus:border-xango-primary";

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-xango-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function Bloco({
  icone,
  titulo,
  descricao,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-xango-border bg-white shadow-sm">
      <div className="border-b border-xango-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="text-xango-primary">{icone}</div>
          <h3 className="font-semibold text-xango-text">{titulo}</h3>
        </div>

        <p className="mt-1 text-xs text-xango-muted">{descricao}</p>
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}

type EnderecoValores = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

function Endereco({
  valores,
  alterar,
  consultarCep,
  buscandoCep,
  desabilitado = false,
}: {
  valores: EnderecoValores;
  alterar: (campo: keyof EnderecoValores, valor: string) => void;
  consultarCep: () => void;
  buscandoCep: boolean;
  desabilitado?: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
      <div className="lg:col-span-2">
        <Campo label="CEP">
          <div className="flex gap-2">
            <input
              value={valores.cep}
              onChange={(e) => alterar("cep", formatarCep(e.target.value))}
              onBlur={() => {
                if (somenteNumeros(valores.cep).length === 8) consultarCep();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  consultarCep();
                }
              }}
              disabled={desabilitado}
              className={inputClass}
              placeholder="00000-000"
            />

            <button
              type="button"
              onClick={consultarCep}
              disabled={
                desabilitado ||
                buscandoCep ||
                somenteNumeros(valores.cep).length !== 8
              }
              className="flex shrink-0 items-center gap-2 rounded-md border border-xango-border bg-white px-3 text-xs font-semibold text-xango-primary transition hover:bg-xango-background disabled:opacity-40"
            >
              {buscandoCep ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
              Buscar
            </button>
          </div>
        </Campo>
      </div>

      <div className="lg:col-span-3">
        <Campo label="Logradouro">
          <input
            value={valores.logradouro}
            onChange={(e) => alterar("logradouro", e.target.value)}
            disabled={desabilitado}
            className={inputClass}
          />
        </Campo>
      </div>

      <div className="lg:col-span-1">
        <Campo label="Número">
          <input
            value={valores.numero}
            onChange={(e) => alterar("numero", e.target.value)}
            disabled={desabilitado}
            className={inputClass}
          />
        </Campo>
      </div>

      <div className="lg:col-span-2">
        <Campo label="Complemento">
          <input
            value={valores.complemento}
            onChange={(e) => alterar("complemento", e.target.value)}
            disabled={desabilitado}
            className={inputClass}
          />
        </Campo>
      </div>

      <div className="lg:col-span-2">
        <Campo label="Bairro">
          <input
            value={valores.bairro}
            onChange={(e) => alterar("bairro", e.target.value)}
            disabled={desabilitado}
            className={inputClass}
          />
        </Campo>
      </div>

      <div className="lg:col-span-1">
        <Campo label="Cidade">
          <input
            value={valores.cidade}
            onChange={(e) => alterar("cidade", e.target.value)}
            disabled={desabilitado}
            className={inputClass}
          />
        </Campo>
      </div>

      <div className="lg:col-span-1">
        <Campo label="UF">
          <input
            value={valores.uf}
            onChange={(e) =>
              alterar("uf", e.target.value.toUpperCase().slice(0, 2))
            }
            disabled={desabilitado}
            className={inputClass}
            maxLength={2}
          />
        </Campo>
      </div>
    </div>
  );
}