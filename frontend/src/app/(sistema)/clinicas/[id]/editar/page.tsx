"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Calculator,
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
  id?: number;
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
  ativo?: boolean;
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

  tipoEstabelecimento: "CLINICA" | "LABORATORIO_ANALISES_CLINICAS";
  tipoPrecificacao: "INDIVIDUAL" | "CH";
  valorChRepasse: string;
  margemChPercentual: string;

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
  tipoEstabelecimento: "CLINICA",
  tipoPrecificacao: "INDIVIDUAL",
  valorChRepasse: "",
  margemChPercentual: "",
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

function numeroDecimal(valor: string | number | null | undefined) {
  if (valor === null || valor === undefined || valor === "") return 0;
  const texto = String(valor).trim().replace(/\./g, "").replace(",", ".");
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function formatarDecimalInput(valor: string) {
  return valor.replace(/[^0-9,]/g, "").replace(/(,.*),/g, "$1");
}

function margemPercentualPorCh(repasse: number, paciente: number) {
  if (paciente <= 0 || repasse < 0 || repasse > paciente) return 0;
  return ((paciente - repasse) / paciente) * 100;
}

function calcularChPaciente(repasse: number, margemPercentual: number) {
  if (repasse < 0 || margemPercentual < 0 || margemPercentual >= 100) return 0;
  if (margemPercentual === 0) return repasse;
  return repasse / (1 - margemPercentual / 100);
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

export default function EditarClinicaPage() {
  const router = useRouter();
  const params = useParams();
  const clinicaId = Number(params.id);

  const [form, setForm] = useState<Formulario>(formularioInicial);
  const [unidades, setUnidades] = useState<UnidadeForm[]>([novaUnidade(0)]);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [buscandoCepFiscal, setBuscandoCepFiscal] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          setCarregando(true);
          setErro("");

          const resposta = await fetch(
            `http://localhost:3333/clinicas/${clinicaId}`,
            { cache: "no-store" }
          );

          const clinica = await resposta.json();

          if (!resposta.ok) {
            throw new Error(
              clinica.erro || "Não foi possível carregar a clínica."
            );
          }

          setForm({
            nome: clinica.nome || "",
            razaoSocial: clinica.razaoSocial || "",
            documento: formatarCpfCnpj(clinica.documento || ""),
            telefone: formatarTelefone(clinica.telefone || ""),
            whatsapp: formatarTelefone(clinica.whatsapp || ""),
            email: clinica.email || "",
            cepFiscal: formatarCep(clinica.cepFiscal || ""),
            logradouroFiscal: clinica.logradouroFiscal || "",
            numeroFiscal: clinica.numeroFiscal || "",
            complementoFiscal: clinica.complementoFiscal || "",
            bairroFiscal: clinica.bairroFiscal || "",
            cidadeFiscal: clinica.cidadeFiscal || "",
            ufFiscal: clinica.ufFiscal || "",
            responsavelLegalNome: clinica.responsavelLegalNome || "",
            responsavelLegalCpf: formatarCpf(
              clinica.responsavelLegalCpf || ""
            ),
            responsavelLegalCargo: clinica.responsavelLegalCargo || "",
            responsavelLegalTelefone: formatarTelefone(
              clinica.responsavelLegalTelefone || ""
            ),
            responsavelLegalEmail: clinica.responsavelLegalEmail || "",
            financeiroMesmoLegal: Boolean(clinica.financeiroMesmoLegal),
            responsavelFinanceiroNome:
              clinica.responsavelFinanceiroNome || "",
            responsavelFinanceiroCpf: formatarCpf(
              clinica.responsavelFinanceiroCpf || ""
            ),
            responsavelFinanceiroCargo:
              clinica.responsavelFinanceiroCargo || "",
            responsavelFinanceiroTelefone: formatarTelefone(
              clinica.responsavelFinanceiroTelefone || ""
            ),
            responsavelFinanceiroEmail:
              clinica.responsavelFinanceiroEmail || "",
            tipoEstabelecimento:
              clinica.tipoEstabelecimento === "LABORATORIO_ANALISES_CLINICAS"
                ? "LABORATORIO_ANALISES_CLINICAS"
                : "CLINICA",
            tipoPrecificacao:
              clinica.tipoPrecificacao === "CH" ? "CH" : "INDIVIDUAL",
            valorChRepasse:
              clinica.valorChRepasse === null || clinica.valorChRepasse === undefined
                ? ""
                : String(Number(clinica.valorChRepasse)).replace(".", ","),
            margemChPercentual:
              clinica.valorChRepasse !== null &&
              clinica.valorChRepasse !== undefined &&
              clinica.valorChPaciente !== null &&
              clinica.valorChPaciente !== undefined
                ? margemPercentualPorCh(
                    Number(clinica.valorChRepasse),
                    Number(clinica.valorChPaciente)
                  )
                    .toFixed(2)
                    .replace(".", ",")
                : "",
            observacoes: clinica.observacoes || "",
          });

          setUnidades(
            Array.isArray(clinica.unidades) && clinica.unidades.length > 0
                ? clinica.unidades.map(
                    (unidade: {
                    id: number;
                    nome: string | null;
                    usaEnderecoFiscal: boolean;
                    cep: string | null;
                    logradouro: string | null;
                    numero: string | null;
                    complemento: string | null;
                    bairro: string | null;
                    cidade: string | null;
                    uf: string | null;
                    telefone: string | null;
                    whatsapp: string | null;
                    email: string | null;
                    ativo: boolean;
                    }) => ({
                    id: unidade.id,
                    nome: unidade.nome || "",
                    usaEnderecoFiscal: Boolean(unidade.usaEnderecoFiscal),
                    cep: formatarCep(unidade.cep || ""),
                    logradouro: unidade.logradouro || "",
                    numero: unidade.numero || "",
                    complemento: unidade.complemento || "",
                    bairro: unidade.bairro || "",
                    cidade: unidade.cidade || "",
                    uf: unidade.uf || "",
                    telefone: formatarTelefone(unidade.telefone || ""),
                    whatsapp: formatarTelefone(unidade.whatsapp || ""),
                    email: unidade.email || "",
                    ativo: Boolean(unidade.ativo),
                    aberto: true,
                    buscandoCep: false,
                    })
                )
                : [novaUnidade(0)]
            );
        } catch (e) {
          console.error("Erro ao carregar clínica:", e);
          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível carregar a clínica."
          );
        } finally {
          setCarregando(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [clinicaId]);

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

      const valorChRepasseNumero = numeroDecimal(form.valorChRepasse);
      const margemChNumero = numeroDecimal(form.margemChPercentual);
      const valorChPacienteNumero = calcularChPaciente(
        valorChRepasseNumero,
        margemChNumero
      );

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

      if (form.tipoPrecificacao === "CH") {
        if (valorChRepasseNumero <= 0) {
          setErro("Informe o valor do CH contratado para repasse.");
          return;
        }

        if (margemChNumero < 0 || margemChNumero >= 100) {
          setErro("A margem Digna deve ser maior ou igual a 0% e menor que 100%.");
          return;
        }
      }

      setSalvando(true);

      const respostaClinica = await fetch(
        `http://localhost:3333/clinicas/${clinicaId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            valorChRepasse:
              form.tipoPrecificacao === "CH" ? valorChRepasseNumero : null,
            valorChPaciente:
              form.tipoPrecificacao === "CH" ? valorChPacienteNumero : null,
          }),
        }
      );

      const resultadoClinica = await respostaClinica.json();

      if (!respostaClinica.ok) {
        throw new Error(
          resultadoClinica.erro || "Não foi possível atualizar a clínica."
        );
      }

      const respostaPrecificacao = await fetch(
        `http://localhost:3333/clinicas/${clinicaId}/precificacao`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipoEstabelecimento: form.tipoEstabelecimento,
            tipoPrecificacao: form.tipoPrecificacao,
            valorChRepasse:
              form.tipoPrecificacao === "CH" ? valorChRepasseNumero : null,
            valorChPaciente:
              form.tipoPrecificacao === "CH" ? valorChPacienteNumero : null,
          }),
        }
      );

      const resultadoPrecificacao = await respostaPrecificacao.json();

      if (!respostaPrecificacao.ok) {
        throw new Error(
          resultadoPrecificacao.erro ||
            "Não foi possível atualizar a precificação da clínica."
        );
      }

      for (const unidade of unidades) {
        const payloadUnidade = {
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
          ativo: unidade.ativo ?? true,
        };

        const url = unidade.id
          ? `http://localhost:3333/clinicas/${clinicaId}/unidades/${unidade.id}`
          : `http://localhost:3333/clinicas/${clinicaId}/unidades`;

        const respostaUnidade = await fetch(url, {
          method: unidade.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadUnidade),
        });

        const resultadoUnidade = await respostaUnidade.json();

        if (!respostaUnidade.ok) {
          throw new Error(
            resultadoUnidade.erro ||
              `Não foi possível salvar a unidade ${unidade.nome}.`
          );
        }
      }

      router.push(`/clinicas/${clinicaId}`);
    } catch (e) {
      console.error("Erro ao atualizar clínica:", e);
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível atualizar a clínica."
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-80 items-center justify-center text-xango-muted">
        <Loader2 size={22} className="mr-2 animate-spin" />
        Carregando dados da clínica...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-375 pb-12">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.push(`/clinicas/${clinicaId}`)}
            className="mt-0.5 rounded-md border border-xango-border bg-white p-2 text-xango-primary transition hover:bg-xango-background"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <h2 className="text-2xl font-semibold text-xango-text">
              Editar clínica
            </h2>
            <p className="mt-1 text-sm text-xango-muted">
              Atualize os dados cadastrais, responsáveis e unidades de atendimento.
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
          {salvando ? "Salvando..." : "Salvar alterações"}
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

                {unidades.length > 1 && !unidade.id && (
                  <button
                    type="button"
                    onClick={() => removerUnidade(indice)}
                    className="rounded-md p-2 text-red-600 transition hover:bg-red-50"
                    title="Remover unidade ainda não salva"
                  >
                    <Trash2 size={16} />
                  </button>
                )}

                {unidade.id && (
                  <button
                    type="button"
                    onClick={() =>
                      alterarUnidade(
                        indice,
                        "ativo",
                        !(unidade.ativo ?? true)
                      )
                    }
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      unidade.ativo ?? true
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {unidade.ativo ?? true ? "Ativa" : "Inativa"}
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
        icone={<Calculator size={18} />}
        titulo="Tipo e precificação"
        descricao="Defina o tipo da parceria e como os procedimentos desta clínica serão precificados."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Tipo de estabelecimento">
            <select
              value={form.tipoEstabelecimento}
              onChange={(e) => {
                const tipo = e.target.value as Formulario["tipoEstabelecimento"];
                alterar("tipoEstabelecimento", tipo);

                if (tipo === "LABORATORIO_ANALISES_CLINICAS") {
                  alterar("tipoPrecificacao", "CH");
                }
              }}
              className={inputClass}
            >
              <option value="CLINICA">Clínica / centro diagnóstico</option>
              <option value="LABORATORIO_ANALISES_CLINICAS">
                Laboratório de análises clínicas
              </option>
            </select>
          </Campo>

          <Campo label="Modelo de precificação">
            <select
              value={form.tipoPrecificacao}
              onChange={(e) =>
                alterar(
                  "tipoPrecificacao",
                  e.target.value as Formulario["tipoPrecificacao"]
                )
              }
              className={inputClass}
            >
              <option value="INDIVIDUAL">Valores individuais por procedimento</option>
              <option value="CH">Baseado em CH</option>
            </select>
          </Campo>
        </div>

        {form.tipoEstabelecimento === "LABORATORIO_ANALISES_CLINICAS" && (
          <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            Laboratórios de análises clínicas usam CH como modelo sugerido.
            Procedimentos específicos ainda poderão ter preço fixo como exceção.
          </div>
        )}

        {form.tipoPrecificacao === "CH" && (
          <div className="mt-5">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Campo label="Valor do CH — repasse *">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-xango-muted">
                    R$
                  </span>
                  <input
                    value={form.valorChRepasse}
                    onChange={(e) =>
                      alterar(
                        "valorChRepasse",
                        formatarDecimalInput(e.target.value)
                      )
                    }
                    inputMode="decimal"
                    className={`${inputClass} pl-10`}
                    placeholder="0,00"
                  />
                </div>
              </Campo>

              <Campo label="Margem Digna sobre o preço final (%)">
                <div className="relative">
                  <input
                    value={form.margemChPercentual}
                    onChange={(e) =>
                      alterar(
                        "margemChPercentual",
                        formatarDecimalInput(e.target.value)
                      )
                    }
                    inputMode="decimal"
                    className={`${inputClass} pr-9`}
                    placeholder="0,00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-xango-muted">
                    %
                  </span>
                </div>
              </Campo>

              <div className="rounded-md border border-xango-border bg-xango-background/50 px-4 py-3">
                <p className="text-xs font-semibold text-xango-muted">CH calculado para paciente</p>
                <p className="mt-1 text-lg font-semibold text-xango-text">
                  {calcularChPaciente(
                    numeroDecimal(form.valorChRepasse),
                    numeroDecimal(form.margemChPercentual)
                  ).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4,
                  })}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-900">Exemplo com 30 CH</p>
              <div className="mt-2 grid gap-2 text-sm text-amber-800 sm:grid-cols-3">
                <div>
                  Repasse: <strong>{(30 * numeroDecimal(form.valorChRepasse)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
                </div>
                <div>
                  Paciente: <strong>{(30 * calcularChPaciente(numeroDecimal(form.valorChRepasse), numeroDecimal(form.margemChPercentual))).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
                </div>
                <div>
                  Margem: <strong>{(30 * (calcularChPaciente(numeroDecimal(form.valorChRepasse), numeroDecimal(form.margemChPercentual)) - numeroDecimal(form.valorChRepasse))).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs text-xango-muted">
              A margem usa a mesma lógica das tabelas de preços do sistema: (valor paciente − repasse) ÷ valor paciente.
            </p>
          </div>
        )}
      </Bloco>

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
          onClick={() => router.push(`/clinicas/${clinicaId}`)}
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
