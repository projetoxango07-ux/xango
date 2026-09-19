"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Copy,
  FileText,
  Loader2,
  MapPin,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type Paciente = {
  id: number;
  nome: string;
  cpf: string;
  telefone: string;
  email: string | null;
};

type UnidadeClinica = {
  id: number;
  nome: string;
  cidade: string | null;
  uf: string | null;
};

type ClinicaPreco = {
  id: number;
  nome: string;
  ativo: boolean;
  unidades: UnidadeClinica[];
};

type PrecoClinica = {
  id: number;
  clinicaId: number;
  procedimentoId: number;
  valorPaciente: number;
  valorRepasse: number;
  ativo: boolean;
  clinica: ClinicaPreco;
};

type PrecoUnidade = {
  id: number;
  unidadeClinicaId: number;
  procedimentoId: number;
  valorPaciente: number;
  valorRepasse: number;
  ativo: boolean;
  unidadeClinica: {
    id: number;
    nome: string;
    clinicaId: number;
    cidade: string | null;
    uf: string | null;
    ativo: boolean;
    clinica: {
      id: number;
      nome: string;
      ativo: boolean;
    };
  };
};

type Procedimento = {
  id: number;
  nome: string;
  categoria: string | null;
  aliases: string[];
  codigoTuss: string | null;
  ativo: boolean;
  precos: PrecoClinica[];
  precosUnidade: PrecoUnidade[];
};

type ItemSelecionado = {
  id?: number;
  procedimentoId: number;
  clinicaId: number | null;
  unidadeClinicaId: number | null;

  valorCongeladoPaciente?: number;
  valorCongeladoRepasse?: number;

  procedimentoOriginalId?: number;
  clinicaOriginalId?: number | null;
  unidadeOriginalId?: number | null;
};

type OrcamentoApi = {
  id: number;
  codigoPublico: string | null;
  pacienteId: number | null;
  nomePaciente: string;
  telefonePaciente: string;
  status: "ABERTO" | "PARCIALMENTE_CONVERTIDO" | "ENCERRADO" | "VENCIDO";
  statusBanco?: "ABERTO" | "PARCIALMENTE_CONVERTIDO" | "ENCERRADO";
  vencido?: boolean;
  validadeDias?: number;
  validadeAte?: string | null;
  condicoesPagamento?: string | null;
  observacoes: string | null;
  itens: Array<{
    id: number;
    procedimentoId: number;
    procedimentoNome: string;
    clinicaId: number | null;
    clinicaNome: string | null;
    unidadeClinicaId: number | null;
    unidadeClinicaNome: string | null;
    valorPaciente: number;
    valorRepasse: number;
    convertido: boolean;
  }>;
};

type ModeloOrcamentoApi = {
  id: number;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  ativo: boolean;
  itens: Array<{
    id: number;
    procedimentoId: number;
    procedimentoNome: string;
    procedimentoAtivo: boolean;
    clinicaId: number | null;
    clinicaNome: string | null;
    unidadeClinicaId: number | null;
    unidadeClinicaNome: string | null;
  }>;
};

type OrcamentoFormProps = {
  orcamentoId?: number;
};

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, "");
}

function formatarCpf(valor: string) {
  const numeros = somenteNumeros(valor).slice(0, 11);

  if (numeros.length !== 11) return valor;

  return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(
    6,
    9
  )}-${numeros.slice(9)}`;
}

function formatarTelefone(valor: string) {
  const numeros = somenteNumeros(valor).slice(0, 11);

  if (numeros.length === 0) return "";
  if (numeros.length <= 2) return `(${numeros}`;
  if (numeros.length <= 6) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
  }

  if (numeros.length <= 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(
      2,
      6
    )}-${numeros.slice(6, 10)}`;
  }

  return `(${numeros.slice(0, 2)}) ${numeros.slice(
    2,
    7
  )}-${numeros.slice(7, 11)}`;
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizar(valor: string) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function opcoesClinica(procedimento: Procedimento) {
  const mapa = new Map<number, PrecoClinica>();

  for (const preco of procedimento.precos || []) {
    if (!preco.ativo || !preco.clinica?.ativo) continue;
    if (!mapa.has(preco.clinicaId)) mapa.set(preco.clinicaId, preco);
  }

  return [...mapa.values()].sort((a, b) =>
    a.clinica.nome.localeCompare(b.clinica.nome, "pt-BR")
  );
}

function precoBase(
  procedimento: Procedimento,
  clinicaId: number | null
): PrecoClinica | null {
  if (!clinicaId) return null;

  return (
    procedimento.precos.find(
      (preco) =>
        preco.clinicaId === clinicaId &&
        preco.ativo &&
        preco.clinica?.ativo
    ) || null
  );
}

function unidadesDisponiveis(
  procedimento: Procedimento,
  clinicaId: number | null
) {
  return precoBase(procedimento, clinicaId)?.clinica.unidades || [];
}

function precoAtual(
  procedimento: Procedimento,
  item: ItemSelecionado
): {
  valorPaciente: number;
  valorRepasse: number;
  especificoUnidade: boolean;
} | null {
  const base = precoBase(procedimento, item.clinicaId);
  if (!base) return null;

  if (item.unidadeClinicaId) {
    const especifico = procedimento.precosUnidade.find(
      (preco) =>
        preco.unidadeClinicaId === item.unidadeClinicaId &&
        preco.procedimentoId === procedimento.id &&
        preco.ativo &&
        preco.unidadeClinica?.ativo &&
        preco.unidadeClinica?.clinicaId === item.clinicaId
    );

    if (especifico) {
      return {
        valorPaciente: Number(especifico.valorPaciente),
        valorRepasse: Number(especifico.valorRepasse),
        especificoUnidade: true,
      };
    }
  }

  return {
    valorPaciente: Number(base.valorPaciente),
    valorRepasse: Number(base.valorRepasse),
    especificoUnidade: false,
  };
}

function itemMantemConfiguracaoOriginal(item: ItemSelecionado) {
  return (
    item.id !== undefined &&
    item.procedimentoOriginalId === item.procedimentoId &&
    item.clinicaOriginalId === item.clinicaId &&
    item.unidadeOriginalId === item.unidadeClinicaId
  );
}

function precoExibido(
  procedimento: Procedimento,
  item: ItemSelecionado
): {
  valorPaciente: number;
  valorRepasse: number;
  especificoUnidade: boolean;
  congelado: boolean;
} | null {
  if (
    itemMantemConfiguracaoOriginal(item) &&
    item.valorCongeladoPaciente !== undefined &&
    item.valorCongeladoRepasse !== undefined
  ) {
    return {
      valorPaciente: item.valorCongeladoPaciente,
      valorRepasse: item.valorCongeladoRepasse,
      especificoUnidade: false,
      congelado: true,
    };
  }

  const atual = precoAtual(procedimento, item);
  if (!atual) return null;

  return {
    ...atual,
    congelado: false,
  };
}

export default function OrcamentoForm({ orcamentoId }: OrcamentoFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const modoEdicao = Number.isInteger(orcamentoId) && Number(orcamentoId) > 0;
  const duplicarDeParametro = Number(searchParams.get("duplicarDe"));
  const duplicarDeId =
    !modoEdicao &&
    Number.isInteger(duplicarDeParametro) &&
    duplicarDeParametro > 0
      ? duplicarDeParametro
      : undefined;
  const modeloParametro = Number(searchParams.get("modelo"));
  const modeloId =
    !modoEdicao &&
    !duplicarDeId &&
    Number.isInteger(modeloParametro) &&
    modeloParametro > 0
      ? modeloParametro
      : undefined;

  const procedimentoPreSelecionadoParametro = Number(
    searchParams.get("procedimentoId")
  );
  const procedimentoPreSelecionadoId =
    !modoEdicao &&
    !duplicarDeId &&
    !modeloId &&
    Number.isInteger(procedimentoPreSelecionadoParametro) &&
    procedimentoPreSelecionadoParametro > 0
      ? procedimentoPreSelecionadoParametro
      : undefined;

  const clinicaPreSelecionadaParametro = Number(searchParams.get("clinicaId"));
  const clinicaPreSelecionadaId =
    Number.isInteger(clinicaPreSelecionadaParametro) &&
    clinicaPreSelecionadaParametro > 0
      ? clinicaPreSelecionadaParametro
      : undefined;

  const unidadePreSelecionadaParametro = Number(
    searchParams.get("unidadeClinicaId")
  );
  const unidadePreSelecionadaId =
    Number.isInteger(unidadePreSelecionadaParametro) &&
    unidadePreSelecionadaParametro > 0
      ? unidadePreSelecionadaParametro
      : undefined;

  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState("");

  const [origem, setOrigem] = useState<OrcamentoApi | null>(null);
  const [modeloOrigem, setModeloOrigem] = useState<ModeloOrcamentoApi | null>(null);

  const [modoPaciente, setModoPaciente] = useState<"CADASTRADO" | "NOVO">(
    "CADASTRADO"
  );
  const [buscaPaciente, setBuscaPaciente] = useState("");
  const [pacienteSelecionado, setPacienteSelecionado] =
    useState<Paciente | null>(null);
  const [nomePacienteNovo, setNomePacienteNovo] = useState("");
  const [telefonePacienteNovo, setTelefonePacienteNovo] = useState("");

  const [buscaProcedimento, setBuscaProcedimento] = useState("");
  const [itens, setItens] = useState<ItemSelecionado[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [validadeDias, setValidadeDias] = useState(15);
  const [condicoesPagamento, setCondicoesPagamento] = useState(
    "Consulte a equipe Digna Saúde sobre as formas e condições de pagamento disponíveis."
  );
  const [renovarValidade, setRenovarValidade] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          setCarregando(true);
          setErroCarregamento("");

          const [resPacientes, resProcedimentos] = await Promise.all([
            fetch(`${API_URL}/pacientes`, { cache: "no-store" }),
            fetch(`${API_URL}/procedimentos/catalogo`, {
              cache: "no-store",
            }),
          ]);

          if (!resPacientes.ok || !resProcedimentos.ok) {
            throw new Error("Não foi possível carregar os dados do orçamento.");
          }

          const pacientesApi: Paciente[] = await resPacientes.json();
          const procedimentosApi: Procedimento[] =
            await resProcedimentos.json();

          const pacientesValidos = Array.isArray(pacientesApi)
            ? pacientesApi
            : [];
          const procedimentosValidos = Array.isArray(procedimentosApi)
            ? procedimentosApi
            : [];

          setPacientes(pacientesValidos);
          setProcedimentos(procedimentosValidos);

          if (procedimentoPreSelecionadoId) {
            const procedimento = procedimentosValidos.find(
              (registro) =>
                registro.id === procedimentoPreSelecionadoId && registro.ativo
            );

            if (procedimento) {
              const clinicasDisponiveis = opcoesClinica(procedimento);
              const clinica = clinicaPreSelecionadaId
                ? clinicasDisponiveis.find(
                    (registro) => registro.clinicaId === clinicaPreSelecionadaId
                  ) || null
                : null;
              const unidades = clinica?.clinica.unidades || [];
              const unidade =
                clinica && unidadePreSelecionadaId
                  ? unidades.find(
                      (registro) => registro.id === unidadePreSelecionadaId
                    ) || null
                  : null;

              setItens([
                {
                  procedimentoId: procedimento.id,
                  clinicaId: clinica?.clinicaId || null,
                  unidadeClinicaId: unidade?.id || null,
                },
              ]);
              setBuscaProcedimento(procedimento.nome);
            }
          }

          if (modeloId) {
            const respostaModelo = await fetch(
              `${API_URL}/modelos-orcamento/${modeloId}`,
              { cache: "no-store" }
            );
            const dadosModelo: ModeloOrcamentoApi = await respostaModelo.json();
            if (!respostaModelo.ok) {
              throw new Error(
                (dadosModelo as unknown as { erro?: string }).erro ||
                  "Não foi possível carregar o modelo de orçamento."
              );
            }
            if (!dadosModelo.ativo) {
              throw new Error("Este modelo está inativo e não pode ser utilizado.");
            }

            setModeloOrigem(dadosModelo);
            const itensDoModelo: ItemSelecionado[] = [];
            for (const itemModelo of dadosModelo.itens) {
              const procedimento = procedimentosValidos.find(
                (p) => p.id === itemModelo.procedimentoId && p.ativo
              );
              if (!procedimento) continue;

              const clinicas = opcoesClinica(procedimento);
              const preferida = itemModelo.clinicaId
                ? clinicas.find((c) => c.clinicaId === itemModelo.clinicaId) || null
                : null;
              const escolhida = preferida || (clinicas.length === 1 ? clinicas[0] : null);
              const unidades = escolhida?.clinica.unidades || [];
              const unidadePreferida = itemModelo.unidadeClinicaId
                ? unidades.find((u) => u.id === itemModelo.unidadeClinicaId) || null
                : null;

              itensDoModelo.push({
                procedimentoId: procedimento.id,
                clinicaId: escolhida?.clinicaId || null,
                unidadeClinicaId:
                  unidadePreferida?.id || (unidades.length === 1 ? unidades[0].id : null),
              });
            }
            setItens(itensDoModelo);
          }

          const origemId = modoEdicao ? orcamentoId : duplicarDeId;

          if (!origemId) return;

          const respostaOrigem = await fetch(
            `${API_URL}/orcamentos/${origemId}`,
            { cache: "no-store" }
          );

          const dadosOrigem: OrcamentoApi = await respostaOrigem.json();

          if (!respostaOrigem.ok) {
            throw new Error(
              (dadosOrigem as unknown as { erro?: string }).erro ||
                "Não foi possível carregar o orçamento."
            );
          }

          if (
            modoEdicao &&
            (dadosOrigem.statusBanco || dadosOrigem.status) !== "ABERTO"
          ) {
            throw new Error(
              "Este orçamento já possui conversão e não pode mais ser editado. Duplique-o para criar uma nova cotação."
            );
          }

          setOrigem(dadosOrigem);
          setObservacoes(dadosOrigem.observacoes || "");
          setValidadeDias(Number(dadosOrigem.validadeDias || 15));
          setCondicoesPagamento(
            dadosOrigem.condicoesPagamento ||
              "Consulte a equipe Digna Saúde sobre as formas e condições de pagamento disponíveis."
          );
          setRenovarValidade(false);

          if (dadosOrigem.pacienteId) {
            const paciente = pacientesValidos.find(
              (registro) => registro.id === dadosOrigem.pacienteId
            );

            if (paciente) {
              setModoPaciente("CADASTRADO");
              setPacienteSelecionado(paciente);
              setNomePacienteNovo("");
              setTelefonePacienteNovo("");
            } else {
              setModoPaciente("NOVO");
              setPacienteSelecionado(null);
              setNomePacienteNovo(dadosOrigem.nomePaciente);
              setTelefonePacienteNovo(
                somenteNumeros(dadosOrigem.telefonePaciente)
              );
            }
          } else {
            setModoPaciente("NOVO");
            setPacienteSelecionado(null);
            setNomePacienteNovo(dadosOrigem.nomePaciente);
            setTelefonePacienteNovo(
              somenteNumeros(dadosOrigem.telefonePaciente)
            );
          }

          setItens(
            dadosOrigem.itens.map((item) => ({
              id: modoEdicao ? item.id : undefined,
              procedimentoId: item.procedimentoId,
              clinicaId: item.clinicaId,
              unidadeClinicaId: item.unidadeClinicaId,
              valorCongeladoPaciente: modoEdicao
                ? Number(item.valorPaciente)
                : undefined,
              valorCongeladoRepasse: modoEdicao
                ? Number(item.valorRepasse)
                : undefined,
              procedimentoOriginalId: modoEdicao
                ? item.procedimentoId
                : undefined,
              clinicaOriginalId: modoEdicao ? item.clinicaId : undefined,
              unidadeOriginalId: modoEdicao
                ? item.unidadeClinicaId
                : undefined,
            }))
          );
        } catch (erro) {
          console.error("Erro ao carregar orçamento:", erro);
          setErroCarregamento(
            erro instanceof Error
              ? erro.message
              : "Não foi possível carregar os dados do orçamento."
          );
        } finally {
          setCarregando(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    modoEdicao,
    orcamentoId,
    duplicarDeId,
    modeloId,
    procedimentoPreSelecionadoId,
    clinicaPreSelecionadaId,
    unidadePreSelecionadaId,
  ]);

  const pacientesFiltrados = useMemo(() => {
    const termo = normalizar(buscaPaciente);
    const numeros = somenteNumeros(buscaPaciente);

    return pacientes
      .filter((paciente) => {
        if (!termo && !numeros) return true;

        const texto = normalizar(
          `${paciente.nome} ${paciente.cpf} ${paciente.telefone} ${
            paciente.email || ""
          }`
        );

        if (termo && texto.includes(termo)) return true;

        if (
          numeros &&
          (somenteNumeros(paciente.cpf).includes(numeros) ||
            somenteNumeros(paciente.telefone).includes(numeros))
        ) {
          return true;
        }

        return false;
      })
      .slice(0, 8);
  }, [pacientes, buscaPaciente]);

  const idsSelecionados = useMemo(
    () => new Set(itens.map((item) => item.procedimentoId)),
    [itens]
  );

  const procedimentosFiltrados = useMemo(() => {
    const termo = normalizar(buscaProcedimento);

    return procedimentos
      .filter((procedimento) => procedimento.ativo)
      .filter((procedimento) => opcoesClinica(procedimento).length > 0)
      .filter((procedimento) => !idsSelecionados.has(procedimento.id))
      .filter((procedimento) => {
        if (!termo) return true;

        const texto = normalizar(
          [
            procedimento.nome,
            procedimento.categoria || "",
            procedimento.codigoTuss || "",
            ...(procedimento.aliases || []),
          ].join(" ")
        );

        return texto.includes(termo);
      })
      .slice(0, 12);
  }, [procedimentos, buscaProcedimento, idsSelecionados]);

  const itensDetalhados = useMemo(() => {
    return itens
      .map((item) => {
        const procedimento = procedimentos.find(
          (registro) => registro.id === item.procedimentoId
        );

        if (!procedimento) return null;

        const unidades = unidadesDisponiveis(procedimento, item.clinicaId);
        const preco = precoExibido(procedimento, item);

        return {
          item,
          procedimento,
          unidades,
          preco,
        };
      })
      .filter(
        (
          registro
        ): registro is {
          item: ItemSelecionado;
          procedimento: Procedimento;
          unidades: UnidadeClinica[];
          preco: ReturnType<typeof precoExibido>;
        } => registro !== null
      );
  }, [itens, procedimentos]);

  const valorTotal = useMemo(
    () =>
      itensDetalhados.reduce(
        (total, registro) =>
          total + (registro.preco?.valorPaciente || 0),
        0
      ),
    [itensDetalhados]
  );

  function adicionarProcedimento(procedimento: Procedimento) {
    const clinicas = opcoesClinica(procedimento);
    const unicaClinica = clinicas.length === 1 ? clinicas[0] : null;
    const unidades = unicaClinica?.clinica.unidades || [];

    setItens((atuais) => [
      ...atuais,
      {
        procedimentoId: procedimento.id,
        clinicaId: unicaClinica?.clinicaId || null,
        unidadeClinicaId: unidades.length === 1 ? unidades[0].id : null,
      },
    ]);

    setBuscaProcedimento("");
    setErroSalvar("");
  }

  function removerProcedimento(procedimentoId: number) {
    setItens((atuais) =>
      atuais.filter((item) => item.procedimentoId !== procedimentoId)
    );
    setErroSalvar("");
  }

  function alterarClinica(procedimento: Procedimento, clinicaId: number) {
    const base = precoBase(procedimento, clinicaId);
    const unidades = base?.clinica.unidades || [];

    setItens((atuais) =>
      atuais.map((item) =>
        item.procedimentoId === procedimento.id
          ? {
              ...item,
              clinicaId,
              unidadeClinicaId:
                unidades.length === 1 ? unidades[0].id : null,
            }
          : item
      )
    );

    setErroSalvar("");
  }

  function alterarUnidade(procedimentoId: number, unidadeClinicaId: number) {
    setItens((atuais) =>
      atuais.map((item) =>
        item.procedimentoId === procedimentoId
          ? {
              ...item,
              unidadeClinicaId,
            }
          : item
      )
    );

    setErroSalvar("");
  }

  async function salvarOrcamento() {
    setErroSalvar("");

    if (modoPaciente === "CADASTRADO" && !pacienteSelecionado) {
      setErroSalvar("Selecione um paciente cadastrado.");
      return;
    }

    if (modoPaciente === "NOVO") {
      if (nomePacienteNovo.trim().length < 2) {
        setErroSalvar("Informe o nome do paciente.");
        return;
      }

      const telefone = somenteNumeros(telefonePacienteNovo);
      if (telefone.length < 10 || telefone.length > 11) {
        setErroSalvar("Informe um telefone válido com DDD.");
        return;
      }
    }

    if (itens.length === 0) {
      setErroSalvar("Adicione ao menos um procedimento ao orçamento.");
      return;
    }

    for (const registro of itensDetalhados) {
      if (!registro.item.clinicaId) {
        setErroSalvar(
          `Selecione a clínica de ${registro.procedimento.nome}.`
        );
        return;
      }

      if (registro.unidades.length > 0 && !registro.item.unidadeClinicaId) {
        setErroSalvar(
          `Selecione a unidade de ${registro.procedimento.nome}.`
        );
        return;
      }

      if (!registro.preco) {
        setErroSalvar(
          `Não foi possível determinar o preço de ${registro.procedimento.nome}.`
        );
        return;
      }
    }

    try {
      setSalvando(true);

      const url = modoEdicao
        ? `${API_URL}/orcamentos/${orcamentoId}`
        : `${API_URL}/orcamentos`;

      const resposta = await fetch(url, {
        method: modoEdicao ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pacienteId:
            modoPaciente === "CADASTRADO"
              ? pacienteSelecionado?.id || null
              : null,
          nomePaciente:
            modoPaciente === "CADASTRADO"
              ? pacienteSelecionado?.nome || ""
              : nomePacienteNovo,
          telefonePaciente:
            modoPaciente === "CADASTRADO"
              ? pacienteSelecionado?.telefone || ""
              : somenteNumeros(telefonePacienteNovo),
          observacoes,
          validadeDias,
          condicoesPagamento,
          renovarValidade: modoEdicao ? renovarValidade : false,
          modeloId: modeloId || null,
          itens: itens.map((item) => ({
            id: item.id,
            procedimentoId: item.procedimentoId,
            clinicaId: item.clinicaId,
            unidadeClinicaId: item.unidadeClinicaId,
          })),
        }),
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro || "Não foi possível salvar o orçamento."
        );
      }

      router.push(`/orcamentos/${resultado.id}`);
      router.refresh();
    } catch (erro) {
      console.error("Erro ao salvar orçamento:", erro);
      setErroSalvar(
        erro instanceof Error
          ? erro.message
          : "Não foi possível salvar o orçamento."
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-80 items-center justify-center text-xango-muted">
        <Loader2 size={22} className="mr-2 animate-spin" />
        {modoEdicao
          ? "Carregando orçamento..."
          : duplicarDeId
            ? "Preparando cópia do orçamento..."
            : modeloId
              ? "Aplicando modelo de orçamento..."
              : "Carregando novo orçamento..."}
      </div>
    );
  }

  const titulo = modoEdicao
    ? `Editar ${origem?.codigoPublico || "orçamento"}`
    : duplicarDeId
      ? "Duplicar orçamento"
      : modeloId
        ? `Novo orçamento • ${modeloOrigem?.nome || "Modelo"}`
        : "Novo orçamento";

  const descricao = modoEdicao
    ? "Altere o paciente, os procedimentos ou as clínicas enquanto o orçamento estiver em aberto."
    : duplicarDeId
      ? "Revise os dados da cópia antes de salvar. Os preços são conferidos novamente pela tabela atual."
      : modeloId
        ? "O modelo já trouxe os procedimentos e preferências. Escolha o paciente e confira os preços atuais antes de salvar."
        : "Identifique o paciente, escolha os procedimentos e defina a clínica de cada item.";

  const rotaVoltar = modoEdicao
    ? `/orcamentos/${orcamentoId}`
    : duplicarDeId
      ? `/orcamentos/${duplicarDeId}`
      : modeloId
        ? "/orcamentos/modelos"
        : "/orcamentos";

  return (
    <div className="mx-auto max-w-375 pb-12">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.push(rotaVoltar)}
            className="mt-0.5 rounded-md border border-xango-border bg-white p-2 text-xango-primary transition hover:bg-xango-background"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-xango-text">
                {titulo}
              </h2>

              {duplicarDeId && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-800">
                  <Copy size={12} /> Nova cópia
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-xango-muted">{descricao}</p>
          </div>
        </div>
      </div>

      {erroCarregamento && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {erroCarregamento}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="rounded-xl border border-xango-border bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-xango-background text-xango-primary">
                <UserRound size={19} />
              </div>
              <div>
                <h3 className="font-semibold text-xango-text">Paciente</h3>
                <p className="text-xs text-xango-muted">
                  Para um orçamento inicial, nome e telefone são suficientes.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setModoPaciente("CADASTRADO");
                  setErroSalvar("");
                }}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                  modoPaciente === "CADASTRADO"
                    ? "bg-xango-primary text-white"
                    : "border border-xango-border bg-white text-xango-text hover:bg-xango-background"
                }`}
              >
                Paciente cadastrado
              </button>

              <button
                type="button"
                onClick={() => {
                  setModoPaciente("NOVO");
                  setPacienteSelecionado(null);
                  setErroSalvar("");
                }}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                  modoPaciente === "NOVO"
                    ? "bg-xango-primary text-white"
                    : "border border-xango-border bg-white text-xango-text hover:bg-xango-background"
                }`}
              >
                Ainda não cadastrado
              </button>
            </div>

            {modoPaciente === "CADASTRADO" ? (
              <div className="mt-4">
                {pacienteSelecionado ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-emerald-900">
                          {pacienteSelecionado.nome}
                        </p>
                        <p className="mt-1 text-sm text-emerald-800">
                          {formatarCpf(pacienteSelecionado.cpf)} •{" "}
                          {formatarTelefone(pacienteSelecionado.telefone)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setPacienteSelecionado(null);
                          setBuscaPaciente("");
                        }}
                        className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800"
                      >
                        Trocar paciente
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search
                        size={17}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-xango-muted"
                      />
                      <input
                        value={buscaPaciente}
                        onChange={(event) => setBuscaPaciente(event.target.value)}
                        placeholder="Pesquisar por nome, CPF ou telefone..."
                        className="w-full rounded-lg border border-xango-border bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-xango-primary"
                      />
                    </div>

                    <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-xango-border">
                      {pacientesFiltrados.length === 0 ? (
                        <div className="p-5 text-center text-sm text-xango-muted">
                          Nenhum paciente encontrado.
                        </div>
                      ) : (
                        pacientesFiltrados.map((paciente) => (
                          <button
                            key={paciente.id}
                            type="button"
                            onClick={() => {
                              setPacienteSelecionado(paciente);
                              setBuscaPaciente("");
                              setErroSalvar("");
                            }}
                            className="flex w-full items-center justify-between gap-4 border-b border-xango-border px-4 py-3 text-left last:border-b-0 hover:bg-xango-background"
                          >
                            <div>
                              <p className="text-sm font-semibold text-xango-text">
                                {paciente.nome}
                              </p>
                              <p className="mt-1 text-xs text-xango-muted">
                                {formatarCpf(paciente.cpf)} •{" "}
                                {formatarTelefone(paciente.telefone)}
                              </p>
                            </div>
                            <Plus size={16} className="text-xango-primary" />
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-xango-text">
                  Nome
                  <input
                    value={nomePacienteNovo}
                    onChange={(event) => {
                      setNomePacienteNovo(event.target.value);
                      setErroSalvar("");
                    }}
                    placeholder="Nome do paciente"
                    className="mt-1.5 w-full rounded-lg border border-xango-border px-3 py-3 text-sm outline-none focus:border-xango-primary"
                  />
                </label>

                <label className="text-sm font-medium text-xango-text">
                  Telefone
                  <input
                    value={formatarTelefone(telefonePacienteNovo)}
                    onChange={(event) => {
                      setTelefonePacienteNovo(
                        somenteNumeros(event.target.value).slice(0, 11)
                      );
                      setErroSalvar("");
                    }}
                    placeholder="(13) 99999-9999"
                    inputMode="tel"
                    className="mt-1.5 w-full rounded-lg border border-xango-border px-3 py-3 text-sm outline-none focus:border-xango-primary"
                  />
                </label>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-xango-border bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-xango-background text-xango-primary">
                <FileText size={19} />
              </div>
              <div>
                <h3 className="font-semibold text-xango-text">
                  Procedimentos
                </h3>
                <p className="text-xs text-xango-muted">
                  Pesquise pelo nome, sinônimo ou código TUSS.
                </p>
              </div>
            </div>

            <div className="relative mt-5">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xango-muted"
              />
              <input
                value={buscaProcedimento}
                onChange={(event) => setBuscaProcedimento(event.target.value)}
                placeholder="Ex.: ultrassom rins, USG, hemograma..."
                className="w-full rounded-lg border border-xango-border bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-xango-primary"
              />
            </div>

            <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-xango-border">
              {procedimentosFiltrados.length === 0 ? (
                <div className="p-5 text-center text-sm text-xango-muted">
                  Nenhum procedimento disponível para esta busca.
                </div>
              ) : (
                procedimentosFiltrados.map((procedimento) => {
                  const clinicas = opcoesClinica(procedimento);
                  const menorPreco = Math.min(
                    ...clinicas.map((preco) => Number(preco.valorPaciente))
                  );

                  return (
                    <button
                      key={procedimento.id}
                      type="button"
                      onClick={() => adicionarProcedimento(procedimento)}
                      className="flex w-full items-center justify-between gap-4 border-b border-xango-border px-4 py-3 text-left last:border-b-0 hover:bg-xango-background"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-xango-text">
                          {procedimento.nome}
                        </p>
                        <p className="mt-1 text-xs text-xango-muted">
                          {procedimento.categoria || "Sem categoria"}
                          {procedimento.codigoTuss
                            ? ` • TUSS ${procedimento.codigoTuss}`
                            : ""}
                          {` • ${clinicas.length} clínica${
                            clinicas.length === 1 ? "" : "s"
                          }`}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xs text-xango-muted">A partir de</p>
                        <p className="text-sm font-semibold text-xango-primary">
                          {moeda(menorPreco)}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {itensDetalhados.length > 0 && (
            <section className="space-y-3">
              {itensDetalhados.map(
                ({ item, procedimento, unidades, preco }) => {
                  const clinicas = opcoesClinica(procedimento);
                  const clinicaAtual = precoBase(
                    procedimento,
                    item.clinicaId
                  )?.clinica;

                  return (
                    <div
                      key={`${item.id || "novo"}-${procedimento.id}`}
                      className="rounded-xl border border-xango-border bg-white p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-xango-text">
                            {procedimento.nome}
                          </p>
                          <p className="mt-1 text-xs text-xango-muted">
                            {procedimento.categoria || "Sem categoria"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removerProcedimento(procedimento.id)
                          }
                          className="rounded-md border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100"
                          aria-label={`Remover ${procedimento.nome}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="text-sm font-medium text-xango-text">
                          <span className="flex items-center gap-1.5">
                            <Building2 size={14} /> Clínica
                          </span>
                          <select
                            value={item.clinicaId || ""}
                            onChange={(event) =>
                              alterarClinica(
                                procedimento,
                                Number(event.target.value)
                              )
                            }
                            className="mt-1.5 w-full rounded-lg border border-xango-border bg-white px-3 py-3 text-sm outline-none focus:border-xango-primary"
                          >
                            <option value="">Selecione a clínica</option>
                            {clinicas.map((registro) => (
                              <option
                                key={registro.clinicaId}
                                value={registro.clinicaId}
                              >
                                {registro.clinica.nome} —{" "}
                                {moeda(Number(registro.valorPaciente))}
                              </option>
                            ))}
                          </select>
                        </label>

                        {item.clinicaId && unidades.length > 0 ? (
                          <label className="text-sm font-medium text-xango-text">
                            <span className="flex items-center gap-1.5">
                              <MapPin size={14} /> Unidade
                            </span>
                            <select
                              value={item.unidadeClinicaId || ""}
                              onChange={(event) =>
                                alterarUnidade(
                                  procedimento.id,
                                  Number(event.target.value)
                                )
                              }
                              className="mt-1.5 w-full rounded-lg border border-xango-border bg-white px-3 py-3 text-sm outline-none focus:border-xango-primary"
                            >
                              <option value="">Selecione a unidade</option>
                              {unidades.map((unidade) => (
                                <option key={unidade.id} value={unidade.id}>
                                  {unidade.nome}
                                  {unidade.cidade
                                    ? ` — ${unidade.cidade}${
                                        unidade.uf ? `/${unidade.uf}` : ""
                                      }`
                                    : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : item.clinicaId ? (
                          <div className="rounded-lg border border-xango-border bg-xango-background p-3 text-sm text-xango-muted">
                            <p className="font-medium text-xango-text">
                              {clinicaAtual?.nome}
                            </p>
                            <p className="mt-1 text-xs">
                              Clínica sem unidades separadas cadastradas.
                            </p>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-lg bg-xango-background p-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                            Valor do orçamento
                          </p>
                          {preco?.congelado ? (
                            <p className="mt-1 text-xs text-xango-primary">
                              Valor preservado do orçamento original
                            </p>
                          ) : preco?.especificoUnidade ? (
                            <p className="mt-1 text-xs text-xango-primary">
                              Valor específico desta unidade
                            </p>
                          ) : null}
                        </div>

                        <p className="text-xl font-bold text-xango-text">
                          {preco ? moeda(preco.valorPaciente) : "—"}
                        </p>
                      </div>
                    </div>
                  );
                }
              )}
            </section>
          )}

          <section className="rounded-xl border border-xango-border bg-white p-5">
            <h3 className="font-semibold text-xango-text">Validade e condições</h3>
            <p className="mt-1 text-xs text-xango-muted">
              Essas informações aparecem na impressão, no PDF e na mensagem de compartilhamento.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <label className="text-sm font-medium text-xango-text">
                Validade do orçamento
                <select
                  value={validadeDias}
                  onChange={(event) => {
                    setValidadeDias(Number(event.target.value));
                    if (modoEdicao) setRenovarValidade(true);
                  }}
                  className="mt-1.5 w-full rounded-lg border border-xango-border bg-white px-3 py-3 text-sm outline-none focus:border-xango-primary"
                >
                  <option value={7}>7 dias</option>
                  <option value={15}>15 dias</option>
                  <option value={30}>30 dias</option>
                  <option value={60}>60 dias</option>
                  <option value={90}>90 dias</option>
                </select>
              </label>

              <label className="text-sm font-medium text-xango-text">
                Condições de pagamento
                <textarea
                  value={condicoesPagamento}
                  onChange={(event) => setCondicoesPagamento(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Condições, formas de pagamento ou orientação ao paciente..."
                  className="mt-1.5 w-full resize-none rounded-lg border border-xango-border px-3 py-3 text-sm outline-none focus:border-xango-primary"
                />
              </label>
            </div>

            {modoEdicao && origem?.validadeAte && (
              <label className="mt-4 flex items-start gap-2 rounded-lg border border-xango-border bg-xango-background p-3 text-sm text-xango-text">
                <input
                  type="checkbox"
                  checked={renovarValidade}
                  onChange={(event) => setRenovarValidade(event.target.checked)}
                  className="mt-0.5 accent-xango-primary"
                />
                <span>
                  <strong>Renovar validade a partir de hoje.</strong>
                  <span className="mt-1 block text-xs text-xango-muted">
                    Se desmarcado e o prazo não for alterado, permanece a validade atual do orçamento.
                  </span>
                </span>
              </label>
            )}
          </section>

          <section className="rounded-xl border border-xango-border bg-white p-5">
            <label className="text-sm font-medium text-xango-text">
              Observações
              <textarea
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Informações úteis deste orçamento..."
                className="mt-1.5 w-full resize-none rounded-lg border border-xango-border px-3 py-3 text-sm outline-none focus:border-xango-primary"
              />
            </label>
          </section>
        </div>

        <aside className="h-fit rounded-xl border border-xango-border bg-white p-5 xl:sticky xl:top-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
            Resumo do orçamento
          </p>

          {modeloOrigem && (
        <div className="mt-4 mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <strong>Modelo aplicado:</strong> {modeloOrigem.nome}
          {modeloOrigem.categoria ? ` • ${modeloOrigem.categoria}` : ""}. Os preços exibidos são os valores atuais das clínicas/unidades.
        </div>
      )}

      {duplicarDeId && origem?.codigoPublico && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
              Cópia baseada em <strong>{origem.codigoPublico}</strong>. Ao salvar,
              será gerado um novo código de orçamento.
            </div>
          )}

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-xango-muted">Paciente</span>
              <span className="max-w-44 text-right font-semibold text-xango-text">
                {modoPaciente === "CADASTRADO"
                  ? pacienteSelecionado?.nome || "Não selecionado"
                  : nomePacienteNovo.trim() || "Não informado"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-xango-muted">Procedimentos</span>
              <span className="font-semibold text-xango-text">
                {itens.length}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-xango-muted">Validade</span>
              <span className="font-semibold text-xango-text">
                {validadeDias} dias
              </span>
            </div>

            <div className="border-t border-xango-border pt-4">
              <p className="text-xs text-xango-muted">Valor total</p>
              <p className="mt-1 text-3xl font-bold text-xango-text">
                {moeda(valorTotal)}
              </p>
            </div>
          </div>

          {erroSalvar && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              {erroSalvar}
            </div>
          )}

          <button
            type="button"
            onClick={() => void salvarOrcamento()}
            disabled={salvando || Boolean(erroCarregamento)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-xango-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-xango-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Save size={17} />
            )}
            {salvando
              ? "Salvando..."
              : modoEdicao
                ? "Salvar alterações"
                : duplicarDeId
                  ? "Salvar nova cópia"
                  : "Salvar orçamento"}
          </button>

          <p className="mt-3 text-center text-xs text-xango-muted">
            {modoEdicao
              ? "Itens sem alteração mantêm o valor já congelado. Mudanças de clínica ou unidade usam a tabela atual."
              : "Os valores serão congelados no momento do salvamento."}
          </p>
        </aside>
      </div>
    </div>
  );
}
