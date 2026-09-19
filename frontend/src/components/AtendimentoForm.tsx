"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

const etapas = [
  "Paciente",
  "Procedimento",
  "Clínica / Agendamento",
  "Guias / Pagamento",
  "Revisão",
];

type EmpresaApi = {
  id: number;
  nome: string;
  percentualBeneficio: string | number | null;
};

type PacienteApi = {
  id: number;
  nome: string;
  cpf: string;
  telefone: string;
  email: string | null;
  dataNascimento: string | null;
  beneficioAtivo: boolean;
  empresa: EmpresaApi | null;
  cadastro?: { percentual: number; completo: boolean; faltantes: string[]; menor: boolean };
};

type ClinicaApi = {
  id: number;
  nome: string;
  unidades?: {
    id: number;
    nome: string;
    logradouro?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    ativo: boolean;
  }[];
  precos: {
    procedimentoId: number;
    valorPaciente: string | number;
    valorRepasse: string | number;
    procedimento: {
      id: number;
      nome: string;
      categoria: string | null;
    };
  }[];
};

type ProcedimentoApi = {
  id: number;
  nome: string;
  categoria: string | null;
  aliases?: string[];
  precos: {
    clinicaId: number;
    valorPaciente: string | number;
    valorRepasse: string | number;
  }[];
};

type Paciente = {
  id: number;
  nome: string;
  cpf: string;
  telefone: string;
  email?: string;
  dataNascimento?: string;
  empresa?: string;
  beneficioAtivo: boolean;
  beneficioNome?: string;
  beneficioPercentual: number;
  cadastroPercentual?: number;
  cadastroCompleto?: boolean;
};

type Procedimento = {
  id: number;
  nome: string;
  categoria: string;
  aliases: string[];
  valor: number;
  repasse: number;
};

type UnidadeClinica = {
  id: number;
  nome: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
};

type Clinica = {
  id: number;
  nome: string;
  procedimentos: number[];
  unidades: UnidadeClinica[];
  precos: Record<number, { valorPaciente: number; valorRepasse: number }>;
};

type AtendimentoFormProps = {
  atendimentoId?: number;
};

type AtendimentoExistenteApi = {
  id: number;
  etapaAtual: number;
  paciente: PacienteApi;
  guias: {
    id: number;
    status: string;
    clinicaId: number;
    unidadeClinicaId: number | null;
    unidadeClinica?: {
      id: number;
      nome: string;
    } | null;
    desconto: string | number;
    pagamentos?: { valor: string | number }[];
    estornos?: { valor: string | number }[];
    itens: {
      status: string;
      valorPaciente: string | number;
      valorRepasse: string | number;
      tipoAgendamento: "HORARIO" | "ORDEM_CHEGADA" | null;
      dataAgendamento: string | null;
      horarioAgendamento: string | null;
      procedimento: {
        id: number;
        nome: string;
        categoria: string | null;
      };
    }[];
  }[];
};


type DocumentoFinanceiroApi = {
  atendimento: {
    id: number;
    codigoPublico: string | null;
    paciente: {
      id: number;
      codigoPublico: string | null;
      nome: string;
      cpf: string;
    };
  };
  recibos: {
    id: number;
    codigoPublico: string;
    status: string;
    valorRecebido: string | number;
    valorEstornado: string | number;
    emitidoEm: string;
    guiaId: number;
    codigoVoucher: string | null;
    clinica: string;
    pagamentos: {
      id: number;
      valor: string | number;
      forma: string;
      criadoEm: string;
    }[];
  }[];
  estornos: {
    id: number;
    codigoPublico: string | null;
    valor: string | number;
    forma: string;
    motivo: string | null;
    criadoEm: string;
    guiaId: number;
    codigoVoucher: string | null;
    clinica: string;
    reciboRelacionado: {
      codigoPublico: string;
      status: string;
    } | null;
    emitidoPor: {
      nome: string;
      codigoPublico: string | null;
    } | null;
  }[];
};

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


function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, "");
}

function formatarCpf(valor: string) {
  const numeros = somenteNumeros(valor).slice(0, 11);

  if (numeros.length <= 3) return numeros;
  if (numeros.length <= 6) {
    return `${numeros.slice(0, 3)}.${numeros.slice(3)}`;
  }
  if (numeros.length <= 9) {
    return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6)}`;
  }

  return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9, 11)}`;
}

function formatarTelefone(valor: string) {
  const numeros = somenteNumeros(valor).slice(0, 11);

  if (numeros.length === 0) return "";
  if (numeros.length <= 2) return `(${numeros}`;
  if (numeros.length <= 6) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
  }

  if (numeros.length <= 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6, 10)}`;
  }

  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
}


function normalizarBuscaProcedimento(valor: string) {
  return valor
    .toLocaleUpperCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function AtendimentoForm({ atendimentoId }: AtendimentoFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modoRevisao =
  searchParams.get("modo") === "revisao";
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [clinicas, setClinicas] = useState<Clinica[]>([]);

  const [carregandoDados, setCarregandoDados] = useState(true);
  const [carregandoAtendimento, setCarregandoAtendimento] = useState(
    atendimentoId !== undefined
  );
  const [erroDados, setErroDados] = useState("");
  const [busca, setBusca] = useState("");

  const [pacienteSelecionado, setPacienteSelecionado] = useState<
    Paciente | null
  >(null);
  const [carregandoCadastroPaciente, setCarregandoCadastroPaciente] = useState(false);
  const [procedimentosCancelados, setProcedimentosCancelados] = useState<
  Record<number, boolean>
  >({});
  const [novoPacienteAberto, setNovoPacienteAberto] = useState(false);
  const [guiasSalvas, setGuiasSalvas] = useState<Record<string, boolean>>({});
  const [guiasPagas, setGuiasPagas] = useState<Record<string, boolean>>({});
  const [guiaIds, setGuiaIds] = useState<Record<string, number>>({});
  const [atendimentoPersistidoId, setAtendimentoPersistidoId] = useState<
    number | undefined
  >(atendimentoId);
  const [documentosFinanceirosAbertos, setDocumentosFinanceirosAbertos] =
    useState(false);
  const [documentosFinanceiros, setDocumentosFinanceiros] =
    useState<DocumentoFinanceiroApi | null>(null);
  const [carregandoDocumentos, setCarregandoDocumentos] = useState(false);
  const [emitindoReciboGuiaId, setEmitindoReciboGuiaId] = useState<
    number | null
  >(null);
  const [processandoPagamento, setProcessandoPagamento] = useState(false);
  const [processandoEstorno, setProcessandoEstorno] = useState(false);
  const [etapaAtual, setEtapaAtual] = useState(0);
  const [novoNome, setNovoNome] = useState("");
  const [novoCpf, setNovoCpf] = useState("");
  const [novoNascimento, setNovoNascimento] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [buscaProcedimento, setBuscaProcedimento] = useState("");
  const [procedimentosSelecionados, setProcedimentosSelecionados] = useState<
     Procedimento[]
  >([]);
  const [clinicasSelecionadas, setClinicasSelecionadas] = useState<
  Record<number, number>
  >({});
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState<
  Record<number, number>
  >({});
  const [carregandoPrecoProcedimentoId, setCarregandoPrecoProcedimentoId] = useState<number | null>(null);
  const [tiposAgendamento, setTiposAgendamento] = useState<
  Record<number, "horario" | "aguardando" | "ordem">
  >({});
  const [datasAgendamento, setDatasAgendamento] = useState<
  Record<number, string>
  >({});
  const [horariosAgendamento, setHorariosAgendamento] = useState<
  Record<number, string>
  >({});
  const [descontosGuias, setDescontosGuias] = useState<
  Record<string, number>
  >({});
  const [guiaPagamentoAberta, setGuiaPagamentoAberta] = useState<string | null>(
  null
  );
  const [guiaEstornoAberta, setGuiaEstornoAberta] = useState<string | null>(
  null
  );
  const [formaEstorno, setFormaEstorno] = useState("");
  const [valorEstornadoInformado, setValorEstornadoInformado] = useState("");
  const [observacaoEstorno, setObservacaoEstorno] = useState("");

  const [estornosGuias, setEstornosGuias] = useState<Record<string, number>>({});

  const [formaPagamento, setFormaPagamento] = useState("");

  const [valorRecebido, setValorRecebido] = useState("");

  const [pagamentosGuias, setPagamentosGuias] = useState<
  Record<string, number>
  >({});
  useEffect(() => {
    async function carregarDados() {
      try {
        setCarregandoDados(true);
        setErroDados("");

        const [resPacientes, resProcedimentos, resClinicas] =
          await Promise.all([
            fetch("http://localhost:3333/pacientes"),
            fetch("http://localhost:3333/procedimentos"),
            fetch("http://localhost:3333/clinicas"),
          ]);

        if (!resPacientes.ok || !resProcedimentos.ok || !resClinicas.ok) {
          throw new Error("Erro ao carregar dados da API.");
        }

        const pacientesApi: PacienteApi[] = await resPacientes.json();
        const procedimentosApi: ProcedimentoApi[] = await resProcedimentos.json();
        const clinicasApi: ClinicaApi[] = await resClinicas.json();

        const pacientesAdaptados: Paciente[] = pacientesApi.map((paciente) => ({
          id: paciente.id,
          nome: paciente.nome,
          cpf: paciente.cpf,
          telefone: paciente.telefone,
          email: paciente.email || undefined,
          dataNascimento: paciente.dataNascimento || undefined,
          empresa: paciente.empresa?.nome,
          beneficioAtivo: paciente.beneficioAtivo,
          beneficioNome:
            paciente.beneficioAtivo && paciente.empresa
              ? paciente.empresa.nome
              : undefined,
          beneficioPercentual:
            paciente.beneficioAtivo && paciente.empresa
              ? Number(paciente.empresa.percentualBeneficio || 0)
              : 0,
          cadastroPercentual: paciente.cadastro?.percentual,
          cadastroCompleto: paciente.cadastro?.completo,
        }));

        const procedimentosAdaptados: Procedimento[] =
          procedimentosApi.map((procedimento) => {
            const primeiroPreco = procedimento.precos[0];

            return {
              id: procedimento.id,
              nome: procedimento.nome,
              categoria: procedimento.categoria || "Sem categoria",
              aliases: Array.isArray(procedimento.aliases)
                ? procedimento.aliases
                : [],
              valor: primeiroPreco ? Number(primeiroPreco.valorPaciente) : 0,
              repasse: primeiroPreco ? Number(primeiroPreco.valorRepasse) : 0,
            };
          });

        const clinicasAdaptadas: Clinica[] = clinicasApi.map((clinica) => ({
          id: clinica.id,
          nome: clinica.nome,
          procedimentos: clinica.precos.map((preco) => preco.procedimentoId),
          unidades: (clinica.unidades || []).map((unidade) => ({
            id: unidade.id,
            nome: unidade.nome,
            logradouro: unidade.logradouro || undefined,
            numero: unidade.numero || undefined,
            bairro: unidade.bairro || undefined,
            cidade: unidade.cidade || undefined,
            uf: unidade.uf || undefined,
          })),
          precos: Object.fromEntries(
            clinica.precos.map((preco) => [
              preco.procedimentoId,
              {
                valorPaciente: Number(preco.valorPaciente),
                valorRepasse: Number(preco.valorRepasse),
              },
            ])
          ),
        }));

        setPacientes(pacientesAdaptados);
        setProcedimentos(procedimentosAdaptados);
        setClinicas(clinicasAdaptadas);
      } catch (erro) {
        console.error(erro);
        setErroDados("Não foi possível carregar os dados do sistema.");
      } finally {
        setCarregandoDados(false);
      }
    }

    carregarDados();
  }, []);

  useEffect(() => {
    if (!atendimentoId || carregandoDados) {
      return;
    }

    async function carregarAtendimentoExistente() {
      try {
        setCarregandoAtendimento(true);

        const resposta = await fetch(
          `http://localhost:3333/atendimentos/${atendimentoId}`
        );

        const dados: AtendimentoExistenteApi & { erro?: string } =
          await resposta.json();

        if (!resposta.ok) {
          throw new Error(dados.erro || "Não foi possível carregar o atendimento.");
        }

        let cadastroAtual = dados.paciente.cadastro;

        try {
          const respostaPaciente = await fetch(
            `http://localhost:3333/pacientes/${dados.paciente.id}`
          );

          if (respostaPaciente.ok) {
            const pacienteCompleto = await respostaPaciente.json();
            cadastroAtual = pacienteCompleto.cadastro;
          }
        } catch (erroCadastro) {
          console.error(
            "Não foi possível atualizar a porcentagem do cadastro:",
            erroCadastro
          );
        }

        const pacienteAdaptado: Paciente = {
          id: dados.paciente.id,
          nome: dados.paciente.nome,
          cpf: dados.paciente.cpf,
          telefone: dados.paciente.telefone,
          email: dados.paciente.email || undefined,
          dataNascimento: dados.paciente.dataNascimento || undefined,
          empresa: dados.paciente.empresa?.nome,
          beneficioAtivo: dados.paciente.beneficioAtivo,
          beneficioNome:
            dados.paciente.beneficioAtivo && dados.paciente.empresa
              ? dados.paciente.empresa.nome
              : undefined,
          beneficioPercentual:
            dados.paciente.beneficioAtivo && dados.paciente.empresa
              ? Number(dados.paciente.empresa.percentualBeneficio || 0)
              : 0,
          cadastroPercentual: Number(cadastroAtual?.percentual || 0),
          cadastroCompleto: Boolean(cadastroAtual?.completo),
        };

        const procedimentosDoAtendimento: Procedimento[] = [];
        const novasClinicasSelecionadas: Record<number, number> = {};
        const novasUnidadesSelecionadas: Record<number, number> = {};
        const novosTipos: Record<number, "horario" | "aguardando" | "ordem"> = {};
        const novasDatas: Record<number, string> = {};
        const novosHorarios: Record<number, string> = {};
        const novosCancelados: Record<number, boolean> = {};
        const novasGuiasSalvas: Record<string, boolean> = {};
        const novasGuiasPagas: Record<string, boolean> = {};
        const novosGuiaIds: Record<string, number> = {};
        const novosDescontos: Record<string, number> = {};
        const novosPagamentos: Record<string, number> = {};
        const novosEstornos: Record<string, number> = {};

        dados.guias.forEach((guia) => {
          const primeiroItem = guia.itens[0];

          const tipo: "horario" | "aguardando" | "ordem" =
            primeiroItem?.tipoAgendamento === "HORARIO"
              ? "horario"
              : primeiroItem?.tipoAgendamento === "ORDEM_CHEGADA"
                ? "ordem"
                : "aguardando";

          const data = primeiroItem?.dataAgendamento
            ? primeiroItem.dataAgendamento.slice(0, 10)
            : "";

          const horario = primeiroItem?.horarioAgendamento || "";

          const chave = [
            guia.clinicaId,
            guia.unidadeClinicaId || 0,
            tipo,
            data,
            tipo === "horario" ? horario : "",
          ].join("-");

          novosGuiaIds[chave] = guia.id;
          novasGuiasSalvas[chave] = guia.status !== "RASCUNHO";
          novasGuiasPagas[chave] = guia.status === "PAGA";
          novosDescontos[chave] = Number(guia.desconto || 0);
          novosPagamentos[chave] = (guia.pagamentos || []).reduce(
            (total, pagamento) => total + Number(pagamento.valor),
            0
          );
          novosEstornos[chave] = (guia.estornos || []).reduce(
            (total, estorno) => total + Number(estorno.valor),
            0
          );

          guia.itens.forEach((item) => {
            if (
              !procedimentosDoAtendimento.some(
                (procedimento) => procedimento.id === item.procedimento.id
              )
            ) {
              procedimentosDoAtendimento.push({
                id: item.procedimento.id,
                nome: item.procedimento.nome,
                categoria: item.procedimento.categoria || "Sem categoria",
                aliases: [],
                valor: Number(item.valorPaciente),
                repasse: Number(item.valorRepasse),
              });
            }

            novasClinicasSelecionadas[item.procedimento.id] = guia.clinicaId;
            if (guia.unidadeClinicaId) {
              novasUnidadesSelecionadas[item.procedimento.id] = guia.unidadeClinicaId;
            }
            novosTipos[item.procedimento.id] = tipo;

            if (data) {
              novasDatas[item.procedimento.id] = data;
            }

            if (horario) {
              novosHorarios[item.procedimento.id] = horario;
            }

            if (item.status === "CANCELADO") {
              novosCancelados[item.procedimento.id] = true;
            }
          });
        });

        setAtendimentoPersistidoId(dados.id);
        setPacienteSelecionado(pacienteAdaptado);
        setBusca(pacienteAdaptado.nome);
        setProcedimentosSelecionados(procedimentosDoAtendimento);
        setClinicasSelecionadas(novasClinicasSelecionadas);
        setUnidadesSelecionadas(novasUnidadesSelecionadas);
        setTiposAgendamento(novosTipos);
        setDatasAgendamento(novasDatas);
        setHorariosAgendamento(novosHorarios);
        setProcedimentosCancelados(novosCancelados);
        setGuiasSalvas(novasGuiasSalvas);
        setGuiasPagas(novasGuiasPagas);
        setGuiaIds(novosGuiaIds);
        setDescontosGuias(novosDescontos);
        setPagamentosGuias(novosPagamentos);
        setEstornosGuias(novosEstornos);

        const etapaBanco = Math.max(
            1,
            Math.min(Number(dados.etapaAtual || 1), 5)
          );

          if (modoRevisao) {
            setEtapaAtual(4);
          } else {
            setEtapaAtual(etapaBanco - 1);
          }
      } catch (erro) {
        console.error("Erro ao carregar atendimento:", erro);
        setErroDados(
          erro instanceof Error
            ? erro.message
            : "Não foi possível carregar o atendimento."
        );
      } finally {
        setCarregandoAtendimento(false);
      }
    }

    carregarAtendimentoExistente();
        }, [
        atendimentoId,
        carregandoDados,
        modoRevisao,
      ]);

    const pacientesFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    const termoNumerico = somenteNumeros(busca);

    if (!termo) {
      return [];
    }

    return pacientes.filter((paciente) => {
      return (
        paciente.nome.toLowerCase().includes(termo) ||
        (termoNumerico.length > 0 &&
          somenteNumeros(paciente.cpf).includes(termoNumerico)) ||
        (termoNumerico.length > 0 &&
          somenteNumeros(paciente.telefone).includes(termoNumerico))
      );
    });
  }, [busca, pacientes]);

  const procedimentosFiltrados = useMemo(() => {
    const termo = normalizarBuscaProcedimento(buscaProcedimento);

    if (!termo) {
      return procedimentos;
    }

    return procedimentos
      .map((procedimento) => {
        const nomeNormalizado = normalizarBuscaProcedimento(procedimento.nome);
        const aliasesNormalizados = procedimento.aliases.map((alias) =>
          normalizarBuscaProcedimento(alias)
        );

        const encontrouNoNome = nomeNormalizado.includes(termo);
        const aliasEncontrado = procedimento.aliases.find((_, index) =>
          aliasesNormalizados[index]?.includes(termo)
        );

        return {
          procedimento,
          encontrouNoNome,
          aliasEncontrado,
        };
      })
      .filter(
        (resultado) =>
          resultado.encontrouNoNome || Boolean(resultado.aliasEncontrado)
      )
      .sort((a, b) => {
        if (a.encontrouNoNome !== b.encontrouNoNome) {
          return a.encontrouNoNome ? -1 : 1;
        }

        return a.procedimento.nome.localeCompare(
          b.procedimento.nome,
          "pt-BR"
        );
      })
      .map((resultado) => resultado.procedimento);
  }, [buscaProcedimento, procedimentos]);

async function selecionarClinicaDoProcedimento(
  procedimentoId: number,
  clinicaId: number
) {
  const clinica = clinicas.find((item) => item.id === clinicaId);
  if (!clinica) return;

  const precoBase = clinica.precos[procedimentoId];
  if (!precoBase) {
    alert("Esta clínica não possui preço ativo para o procedimento selecionado.");
    return;
  }

  setClinicasSelecionadas((atuais) => ({
    ...atuais,
    [procedimentoId]: clinicaId,
  }));

  setUnidadesSelecionadas((atuais) => {
    const proximo = { ...atuais };
    delete proximo[procedimentoId];
    return proximo;
  });

  setProcedimentosSelecionados((atuais) =>
    atuais.map((procedimento) =>
      procedimento.id === procedimentoId
        ? {
            ...procedimento,
            valor: precoBase.valorPaciente,
            repasse: precoBase.valorRepasse,
          }
        : procedimento
    )
  );
}

async function selecionarUnidadeDoProcedimento(
  procedimentoId: number,
  clinicaId: number,
  unidadeId: number
) {
  try {
    setCarregandoPrecoProcedimentoId(procedimentoId);

    const resposta = await fetch(
      `http://localhost:3333/clinicas/${clinicaId}/unidades/${unidadeId}/precos`,
      { cache: "no-store" }
    );
    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || "Não foi possível carregar o preço da unidade.");
    }

    const preco = (Array.isArray(dados.precos) ? dados.precos : []).find(
      (item: { procedimento?: { id?: number } }) =>
        Number(item.procedimento?.id) === procedimentoId
    );

    if (!preco) {
      throw new Error("O procedimento não possui preço disponível nesta unidade.");
    }

    setUnidadesSelecionadas((atuais) => ({
      ...atuais,
      [procedimentoId]: unidadeId,
    }));

    setProcedimentosSelecionados((atuais) =>
      atuais.map((procedimento) =>
        procedimento.id === procedimentoId
          ? {
              ...procedimento,
              valor: Number(preco.valorPaciente),
              repasse: Number(preco.valorRepasse),
            }
          : procedimento
      )
    );
  } catch (erro) {
    alert(
      erro instanceof Error
        ? erro.message
        : "Não foi possível carregar o preço da unidade."
    );
  } finally {
    setCarregandoPrecoProcedimentoId(null);
  }
}

const guias = useMemo(() => {
  const grupos: Record<
    string,
    {
      chave: string;
      clinicaId: number;
      clinicaNome: string;
      unidadeClinicaId: number | null;
      unidadeClinicaNome: string | null;
      tipoAgendamento: "horario" | "aguardando" | "ordem";
      data: string;
      horario: string;
      procedimentos: Procedimento[];
    }
  > = {};

  procedimentosSelecionados.forEach((procedimento) => {
    const id = procedimento.id;
    const clinicaId = clinicasSelecionadas[id];
    const unidadeClinicaId = unidadesSelecionadas[id] || null;
    const tipo = tiposAgendamento[id];

    if (!clinicaId || !tipo) {
      return;
    }

    const clinica = clinicas.find((item) => item.id === clinicaId);

    if (!clinica) {
      return;
    }

    if (clinica.unidades.length > 0 && !unidadeClinicaId) {
      return;
    }

    const unidadeClinica = unidadeClinicaId
      ? clinica.unidades.find((unidade) => unidade.id === unidadeClinicaId) || null
      : null;

    const data = datasAgendamento[id] || "";
    const horario = horariosAgendamento[id] || "";

    const chave = [
      clinicaId,
      unidadeClinicaId || 0,
      tipo,
      data,
      tipo === "horario" ? horario : "",
    ].join("-");

    if (!grupos[chave]) {
      grupos[chave] = {
        chave,
        clinicaId,
        clinicaNome: clinica.nome,
        unidadeClinicaId,
        unidadeClinicaNome: unidadeClinica?.nome || null,
        tipoAgendamento: tipo,
        data,
        horario,
        procedimentos: [],
      };
    }

    grupos[chave].procedimentos.push(procedimento);
  });

  return Object.values(grupos);
}, [
  procedimentosSelecionados,
  clinicasSelecionadas,
  unidadesSelecionadas,
  tiposAgendamento,
  datasAgendamento,
  horariosAgendamento,
  clinicas,
]);

const etapaMaximaLiberada = useMemo(() => {
  // Etapa 1 - Paciente
  let maxima = 0;

  if (!pacienteSelecionado) {
    return maxima;
  }

  // Etapa 2 - Procedimento
  maxima = 1;

  if (procedimentosSelecionados.length === 0) {
    return maxima;
  }

  // Etapa 3 - Clínica / Agendamento
  maxima = 2;

  const configuracaoClinicaValida =
    procedimentosSelecionados.every((procedimento) => {
      const id = procedimento.id;
      const clinicaId = clinicasSelecionadas[id];
      const tipo = tiposAgendamento[id];

      if (!clinicaId || !tipo) {
        return false;
      }

      const clinica = clinicas.find((item) => item.id === clinicaId);
      if (clinica?.unidades.length && !unidadesSelecionadas[id]) {
        return false;
      }

      if (tipo === "horario") {
        return Boolean(
          datasAgendamento[id] &&
          horariosAgendamento[id]
        );
      }

      if (tipo === "ordem") {
        return Boolean(datasAgendamento[id]);
      }

      // "aguardando" pode avançar para Guias/Pagamento,
      // mas ainda não libera a Revisão.
      return tipo === "aguardando";
    });

  if (!configuracaoClinicaValida) {
    return maxima;
  }

  // Etapa 4 - Guias / Pagamento
  maxima = 3;

  if (guias.length === 0) {
    return maxima;
  }

  const revisaoLiberada = guias.every((guia) => {
    const procedimentosAtivos =
      guia.procedimentos.filter(
        (procedimento) =>
          !procedimentosCancelados[procedimento.id]
      );

    // Guia totalmente cancelada não bloqueia a revisão.
    if (procedimentosAtivos.length === 0) {
      return true;
    }

    // Agendamento precisa estar efetivamente definido.
    if (guia.tipoAgendamento === "aguardando") {
      return false;
    }

    if (
      guia.tipoAgendamento === "horario" &&
      (!guia.data || !guia.horario)
    ) {
      return false;
    }

    if (
      guia.tipoAgendamento === "ordem" &&
      !guia.data
    ) {
      return false;
    }

    const subtotal = procedimentosAtivos.reduce(
      (total, procedimento) =>
        total + procedimento.valor,
      0
    );

    const percentualBeneficio =
      pacienteSelecionado.beneficioAtivo
        ? pacienteSelecionado.beneficioPercentual
        : 0;

    const valorBeneficio =
      subtotal * (percentualBeneficio / 100);

    const descontoManual =
      pacienteSelecionado.beneficioAtivo
        ? 0
        : descontosGuias[guia.chave] || 0;

    const valorFinal = Math.max(
      subtotal - valorBeneficio - descontoManual,
      0
    );

    const totalPago =
      pagamentosGuias[guia.chave] || 0;

    const totalEstornado =
      estornosGuias[guia.chave] || 0;

    const pagoLiquido = Math.max(
      totalPago - totalEstornado,
      0
    );

    return (
      !!guiasSalvas[guia.chave] &&
      Math.abs(pagoLiquido - valorFinal) < 0.01
    );
  });

  if (revisaoLiberada) {
    maxima = 4;
  }

  return maxima;
}, [
  pacienteSelecionado,
  procedimentosSelecionados,
  clinicasSelecionadas,
  unidadesSelecionadas,
  clinicas,
  tiposAgendamento,
  datasAgendamento,
  horariosAgendamento,
  guias,
  procedimentosCancelados,
  descontosGuias,
  pagamentosGuias,
  estornosGuias,
  guiasSalvas,
]);

const contextoAprendizAtendimento = useMemo(() => {
  const criar = (estado: string, alvo: string, detalhe = "") => ({
    estado,
    alvo,
    detalhe,
  });

  if (carregandoDados || carregandoAtendimento) {
    return criar(
      "carregando",
      '[data-aprendiz="atendimento-fluxo"]'
    );
  }

  if (erroDados) {
    return criar(
      "erro",
      '[data-aprendiz="atendimento-erro"]',
      erroDados
    );
  }

  if (novoPacienteAberto) {
    if (!novoNome.trim()) {
      return criar(
        "novo-paciente-nome",
        '[data-aprendiz="atendimento-novo-paciente-nome"]'
      );
    }

    if (!novoCpf.trim()) {
      return criar(
        "novo-paciente-cpf",
        '[data-aprendiz="atendimento-novo-paciente-cpf"]'
      );
    }

    if (!novoTelefone.trim()) {
      return criar(
        "novo-paciente-telefone",
        '[data-aprendiz="atendimento-novo-paciente-telefone"]'
      );
    }

    return criar(
      "novo-paciente-salvar",
      '[data-aprendiz="atendimento-novo-paciente-salvar"]'
    );
  }

  const resumoFinanceiroDaGuia = (guia: (typeof guias)[number]) => {
    const procedimentosAtivos = guia.procedimentos.filter(
      (procedimento) => !procedimentosCancelados[procedimento.id]
    );

    const subtotal = procedimentosAtivos.reduce(
      (total, procedimento) => total + procedimento.valor,
      0
    );

    const repasseTotal = procedimentosAtivos.reduce(
      (total, procedimento) => total + procedimento.repasse,
      0
    );

    const percentualBeneficio = pacienteSelecionado?.beneficioAtivo
      ? pacienteSelecionado.beneficioPercentual
      : 0;

    const valorBeneficio = subtotal * (percentualBeneficio / 100);
    const descontoMaximo = Math.max(subtotal - repasseTotal, 0);
    const beneficioExcedeLimite =
      !!pacienteSelecionado?.beneficioAtivo &&
      valorBeneficio > descontoMaximo;

    const descontoManualInformado = pacienteSelecionado?.beneficioAtivo
      ? 0
      : descontosGuias[guia.chave] || 0;

    const descontoManual = Math.min(
      descontoManualInformado,
      descontoMaximo
    );

    const valorFinal = Math.max(
      subtotal - valorBeneficio - descontoManual,
      0
    );

    const totalPago = pagamentosGuias[guia.chave] || 0;
    const totalEstornado = estornosGuias[guia.chave] || 0;
    const pagoLiquido = Math.max(totalPago - totalEstornado, 0);
    const saldo = Math.max(valorFinal - pagoLiquido, 0);
    const estornoNecessario = Math.max(pagoLiquido - valorFinal, 0);

    return {
      procedimentosAtivos,
      valorFinal,
      pagoLiquido,
      saldo,
      estornoNecessario,
      beneficioExcedeLimite,
    };
  };

  if (guiaPagamentoAberta) {
    const guia = guias.find((item) => item.chave === guiaPagamentoAberta);
    const detalhe = guia?.clinicaNome || "guia selecionada";

    if (!formaPagamento) {
      return criar(
        "pagamento-forma",
        '[data-aprendiz="atendimento-pagamento-forma"]',
        detalhe
      );
    }

    const valor = Number(valorRecebido);
    if (!valorRecebido || !Number.isFinite(valor) || valor <= 0) {
      return criar(
        "pagamento-valor",
        '[data-aprendiz="atendimento-pagamento-valor"]',
        detalhe
      );
    }

    if (guia) {
      const resumo = resumoFinanceiroDaGuia(guia);
      if (valor > resumo.saldo + 0.001) {
        return criar(
          "pagamento-valor-invalido",
          '[data-aprendiz="atendimento-pagamento-valor"]',
          detalhe
        );
      }
    }

    return criar(
      "pagamento-confirmar",
      '[data-aprendiz="atendimento-pagamento-confirmar"]',
      detalhe
    );
  }

  if (guiaEstornoAberta) {
    const guia = guias.find((item) => item.chave === guiaEstornoAberta);
    const detalhe = guia?.clinicaNome || "guia selecionada";

    if (!formaEstorno) {
      return criar(
        "estorno-forma",
        '[data-aprendiz="atendimento-estorno-forma"]',
        detalhe
      );
    }

    const valor = Number(valorEstornadoInformado);
    if (!valorEstornadoInformado || !Number.isFinite(valor) || valor <= 0) {
      return criar(
        "estorno-valor",
        '[data-aprendiz="atendimento-estorno-valor"]',
        detalhe
      );
    }

    if (guia) {
      const resumo = resumoFinanceiroDaGuia(guia);
      if (valor > resumo.pagoLiquido + 0.001) {
        return criar(
          "estorno-valor-invalido",
          '[data-aprendiz="atendimento-estorno-valor"]',
          detalhe
        );
      }
    }

    return criar(
      "estorno-confirmar",
      '[data-aprendiz="atendimento-estorno-confirmar"]',
      detalhe
    );
  }

  if (etapaAtual === 0) {
    if (!pacienteSelecionado) {
      return criar(
        "paciente-buscar",
        '[data-aprendiz="atendimento-paciente-busca"]'
      );
    }

    if (pacienteSelecionado.cadastroCompleto === false) {
      return criar(
        "paciente-cadastro-incompleto",
        '[data-aprendiz="atendimento-paciente-editar"]',
        `${pacienteSelecionado.nome}|${pacienteSelecionado.cadastroPercentual ?? 0}`
      );
    }

    return criar(
      "paciente-continuar",
      '[data-aprendiz="atendimento-paciente-continuar"]',
      pacienteSelecionado.nome
    );
  }

  if (etapaAtual === 1) {
    if (procedimentosSelecionados.length === 0) {
      return criar(
        "procedimento-buscar",
        '[data-aprendiz="atendimento-procedimento-busca"]'
      );
    }

    return criar(
      "procedimento-continuar",
      '[data-aprendiz="atendimento-procedimento-continuar"]',
      String(procedimentosSelecionados.length)
    );
  }

  if (etapaAtual === 2) {
    for (const procedimento of procedimentosSelecionados) {
      const id = procedimento.id;
      const clinicasDisponiveis = clinicas.filter((clinica) =>
        clinica.procedimentos.includes(id)
      );
      const clinicaId = clinicasSelecionadas[id];
      const tipo = tiposAgendamento[id];

      if (clinicasDisponiveis.length === 0) {
        return criar(
          "clinica-indisponivel",
          `[data-aprendiz="atendimento-clinica-card"][data-procedimento-id="${id}"]`,
          procedimento.nome
        );
      }

      if (!clinicaId) {
        return criar(
          "clinica-selecionar",
          `[data-aprendiz="atendimento-clinica-opcoes"][data-procedimento-id="${id}"]`,
          procedimento.nome
        );
      }

      const clinica = clinicas.find((item) => item.id === clinicaId);
      if (clinica?.unidades.length && !unidadesSelecionadas[id]) {
        return criar(
          "unidade-selecionar",
          `[data-aprendiz="atendimento-unidade-opcoes"][data-procedimento-id="${id}"]`,
          `${procedimento.nome}|${clinica.nome}`
        );
      }

      if (!tipo) {
        return criar(
          "agendamento-tipo",
          `[data-aprendiz="atendimento-agendamento-tipos"][data-procedimento-id="${id}"]`,
          procedimento.nome
        );
      }

      if (tipo === "horario" && !datasAgendamento[id]) {
        return criar(
          "agendamento-data",
          `[data-aprendiz="atendimento-agendamento-data"][data-procedimento-id="${id}"]`,
          procedimento.nome
        );
      }

      if (tipo === "horario" && !horariosAgendamento[id]) {
        return criar(
          "agendamento-horario",
          `[data-aprendiz="atendimento-agendamento-horario"][data-procedimento-id="${id}"]`,
          procedimento.nome
        );
      }

      if (tipo === "ordem" && !datasAgendamento[id]) {
        return criar(
          "agendamento-data-ordem",
          `[data-aprendiz="atendimento-agendamento-data"][data-procedimento-id="${id}"]`,
          procedimento.nome
        );
      }
    }

    return criar(
      "clinica-continuar",
      '[data-aprendiz="atendimento-clinica-continuar"]'
    );
  }

  if (etapaAtual === 3) {
    if (guias.length === 0) {
      return criar(
        "guias-vazias",
        '[data-aprendiz="atendimento-guias"]'
      );
    }

    for (const guia of guias) {
      const resumo = resumoFinanceiroDaGuia(guia);
      const detalhe = guia.clinicaNome;
      const seletorGuia = `[data-aprendiz="atendimento-guia"][data-guia-chave="${guia.chave}"]`;

      if (resumo.beneficioExcedeLimite) {
        return criar(
          "guia-beneficio-revisar",
          seletorGuia,
          detalhe
        );
      }

      if (!guiasSalvas[guia.chave]) {
        return criar(
          "guia-salvar",
          `${seletorGuia} [data-aprendiz="atendimento-guia-salvar"]`,
          detalhe
        );
      }

      if (resumo.estornoNecessario > 0.001) {
        return criar(
          "guia-estorno",
          `${seletorGuia} [data-aprendiz="atendimento-guia-estorno"]`,
          detalhe
        );
      }

      if (
        resumo.procedimentosAtivos.length > 0 &&
        guia.tipoAgendamento === "aguardando"
      ) {
        return criar(
          "guia-aguardando-clinica",
          '[data-aprendiz="atendimento-salvar-depois"]',
          detalhe
        );
      }

      if (
        resumo.procedimentosAtivos.length > 0 &&
        resumo.saldo > 0.001
      ) {
        return criar(
          "guia-pagamento",
          `${seletorGuia} [data-aprendiz="atendimento-guia-pagamento"]`,
          detalhe
        );
      }
    }

    if (etapaMaximaLiberada >= 4) {
      return criar(
        "guias-revisao",
        '[data-aprendiz="atendimento-etapa-4"]'
      );
    }

    return criar(
      "guias-continuar-depois",
      '[data-aprendiz="atendimento-salvar-depois"]'
    );
  }

  if (pacienteSelecionado?.cadastroCompleto === false) {
    return criar(
      "revisao-cadastro-incompleto",
      '[data-aprendiz="atendimento-revisao-editar-paciente"]',
      `${pacienteSelecionado.nome}|${pacienteSelecionado.cadastroPercentual ?? 0}`
    );
  }

  return criar(
    "revisao-conferir",
    '[data-aprendiz="atendimento-revisao"]'
  );
}, [
  carregandoDados,
  carregandoAtendimento,
  erroDados,
  novoPacienteAberto,
  novoNome,
  novoCpf,
  novoTelefone,
  guiaPagamentoAberta,
  guiaEstornoAberta,
  formaPagamento,
  valorRecebido,
  formaEstorno,
  valorEstornadoInformado,
  etapaAtual,
  pacienteSelecionado,
  procedimentosSelecionados,
  clinicas,
  clinicasSelecionadas,
  unidadesSelecionadas,
  tiposAgendamento,
  datasAgendamento,
  horariosAgendamento,
  guias,
  procedimentosCancelados,
  descontosGuias,
  pagamentosGuias,
  estornosGuias,
  guiasSalvas,
  etapaMaximaLiberada,
]);

  async function salvarAtendimentoParaDepois(
    permanecerNaTela = false,
    chaveGuiaParaSalvar?: string
  ) {
    if (!pacienteSelecionado) {
      alert("Selecione um paciente antes de salvar o atendimento.");
      return;
    }

    try {
      const guiasParaSalvar = guias.map((guia) => {
        const procedimentosAtivos = guia.procedimentos.filter(
          (procedimento) => !procedimentosCancelados[procedimento.id]
        );

        const subtotal = procedimentosAtivos.reduce(
          (total, procedimento) => total + procedimento.valor,
          0
        );

        const repasseTotal = procedimentosAtivos.reduce(
          (total, procedimento) => total + procedimento.repasse,
          0
        );

        const percentualBeneficio = pacienteSelecionado.beneficioAtivo
          ? pacienteSelecionado.beneficioPercentual
          : 0;

        const valorBeneficio = subtotal * (percentualBeneficio / 100);
        const descontoMaximo = Math.max(subtotal - repasseTotal, 0);

        const descontoManualInformado = pacienteSelecionado.beneficioAtivo
          ? 0
          : descontosGuias[guia.chave] || 0;

        const descontoManual = Math.min(
          descontoManualInformado,
          descontoMaximo
        );

        const valorFinal = Math.max(
          subtotal - valorBeneficio - descontoManual,
          0
        );

        const valorPago = pagamentosGuias[guia.chave] || 0;
        const valorEstornado = estornosGuias[guia.chave] || 0;
        const valorPagoLiquido = Math.max(valorPago - valorEstornado, 0);
        const saldoPendente = Math.max(valorFinal - valorPagoLiquido, 0);
        const valorEstornoNecessario = Math.max(
          valorPagoLiquido - valorFinal,
          0
        );
        const possuiEstornoPendente = valorEstornoNecessario > 0;

        const todosProcedimentosCancelados =
          guia.procedimentos.length > 0 &&
          procedimentosAtivos.length === 0;

        const cancelamentoLiquidado =
          todosProcedimentosCancelados &&
          valorPago > 0 &&
          valorEstornado >= valorPago;

        const guiaConsideradaSalva =
          !!guiasSalvas[guia.chave] ||
          chaveGuiaParaSalvar === guia.chave;

        const guiaQuitada =
          guiaConsideradaSalva &&
          procedimentosAtivos.length > 0 &&
          saldoPendente === 0 &&
          !possuiEstornoPendente;

        let status = "RASCUNHO";

        if (guiaConsideradaSalva) {
          status = "AGUARDANDO_PAGAMENTO";
        }

        if (todosProcedimentosCancelados) {
          status = possuiEstornoPendente
            ? "ESTORNO_PENDENTE"
            : "CANCELADA";
        } else {
          if (valorPagoLiquido > 0 && !guiaQuitada) {
            status = "PARCIALMENTE_PAGA";
          }

          if (guiaQuitada) {
            status = "PAGA";
          }

          if (possuiEstornoPendente) {
            status = "ESTORNO_PENDENTE";
          }
        }

        if (cancelamentoLiquidado) {
          status = "CANCELADA";
        }
        return {
          clinicaId: guia.clinicaId,
          unidadeClinicaId: guia.unidadeClinicaId,
          status,
          subtotal,
          desconto: descontoManual,
          beneficio: valorBeneficio,
          valorFinal,
          valorPago,
          valorEstornado,
          itens: guia.procedimentos.map((procedimento) => ({
            procedimentoId: procedimento.id,
            valorPaciente: procedimento.valor,
            valorRepasse: procedimento.repasse,
            tipoAgendamento: guia.tipoAgendamento,
            dataAgendamento: guia.data || null,
            horarioAgendamento: guia.horario || null,
            cancelado: !!procedimentosCancelados[procedimento.id],
          })),
        };
      });

      const idEfetivo = atendimentoPersistidoId;

      const url = idEfetivo
        ? `http://localhost:3333/atendimentos/${idEfetivo}`
        : "http://localhost:3333/atendimentos";

      const resposta = await fetch(url, {
        method: idEfetivo ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pacienteId: pacienteSelecionado.id,
          etapaAtual: etapaAtual + 1,
          guias: guiasParaSalvar,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(dados.erro || "Não foi possível salvar o atendimento.");
        return;
      }

      setAtendimentoPersistidoId(dados.id);

      const novosIds: Record<string, number> = {};
      const novasSalvas: Record<string, boolean> = {};
      const novosPagamentos: Record<string, number> = {};
      const novosEstornos: Record<string, number> = {};
      const novasPagas: Record<string, boolean> = {};

      (dados.guias || []).forEach(
        (guiaApi: AtendimentoExistenteApi["guias"][number]) => {
          const primeiroItem = guiaApi.itens[0];

          const tipo =
            primeiroItem?.tipoAgendamento === "HORARIO"
              ? "horario"
              : primeiroItem?.tipoAgendamento === "ORDEM_CHEGADA"
                ? "ordem"
                : "aguardando";

          const data = primeiroItem?.dataAgendamento
            ? primeiroItem.dataAgendamento.slice(0, 10)
            : "";

          const horario =
            primeiroItem?.horarioAgendamento || "";

          const chave = [
            guiaApi.clinicaId,
            guiaApi.unidadeClinicaId || 0,
            tipo,
            data,
            tipo === "horario" ? horario : "",
          ].join("-");

          novosIds[chave] = guiaApi.id;
          novasSalvas[chave] =
            guiaApi.status !== "RASCUNHO";
          novasPagas[chave] =
            guiaApi.status === "PAGA";

          novosPagamentos[chave] = (
            guiaApi.pagamentos || []
          ).reduce(
            (total, pagamento) =>
              total + Number(pagamento.valor),
            0
          );

          novosEstornos[chave] = (
            guiaApi.estornos || []
          ).reduce(
            (total, estorno) =>
              total + Number(estorno.valor),
            0
          );
        }
      );

      setGuiaIds((atuais) => ({
        ...atuais,
        ...novosIds,
      }));
      setGuiasSalvas((atuais) => ({
        ...atuais,
        ...novasSalvas,
      }));
      setGuiasPagas((atuais) => ({
        ...atuais,
        ...novasPagas,
      }));
      setPagamentosGuias((atuais) => ({
        ...atuais,
        ...novosPagamentos,
      }));
      setEstornosGuias((atuais) => ({
        ...atuais,
        ...novosEstornos,
      }));

      localStorage.removeItem(
        "digna-conect-atendimento-rascunho"
      );

      if (permanecerNaTela) {
        return dados;
      }

      alert(
        idEfetivo
          ? `Atendimento #${dados.id} atualizado com sucesso.`
          : `Atendimento #${dados.id} salvo com sucesso.`
      );

      router.push("/atendimentos");

      return dados;
    } catch (erro) {
      console.error("Erro ao salvar atendimento:", erro);
      alert(
        "Não foi possível conectar ao servidor para salvar o atendimento."
      );
    }
  }

  async function atualizarCadastroPacienteSelecionado(pacienteId: number) {
    try {
      setCarregandoCadastroPaciente(true);
      const resposta = await fetch(`http://localhost:3333/pacientes/${pacienteId}`);
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível carregar o cadastro do paciente.");

      const atualizar = (paciente: Paciente) => ({
        ...paciente,
        nome: dados.nome,
        cpf: dados.cpf,
        telefone: dados.telefone,
        email: dados.email || undefined,
        dataNascimento: dados.dataNascimento || undefined,
        cadastroPercentual: Number(dados.cadastro?.percentual || 0),
        cadastroCompleto: Boolean(dados.cadastro?.completo),
      });

      setPacienteSelecionado((atual) =>
        atual && atual.id === pacienteId ? atualizar(atual) : atual
      );
      setPacientes((atuais) =>
        atuais.map((paciente) => paciente.id === pacienteId ? atualizar(paciente) : paciente)
      );
    } catch (erro) {
      console.error("Erro ao atualizar cadastro do paciente:", erro);
    } finally {
      setCarregandoCadastroPaciente(false);
    }
  }

  function editarCadastroPaciente(pacienteId: number) {
    window.open(`/pacientes/${pacienteId}`, "_blank", "noopener,noreferrer");
    const atualizarAoRetornar = () => {
      void atualizarCadastroPacienteSelecionado(pacienteId);
      window.removeEventListener("focus", atualizarAoRetornar);
    };
    window.addEventListener("focus", atualizarAoRetornar);
  }

  async function salvarNovoPaciente() {
    if (!novoNome.trim() || !novoCpf.trim() || !novoTelefone.trim()) {
      alert("Preencha nome, CPF e telefone.");
      return;
    }

    try {
      const resposta = await fetch("http://localhost:3333/pacientes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: novoNome,
          cpf: novoCpf,
          telefone: novoTelefone,
          email: novoEmail,
          dataNascimento: novoNascimento,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(dados.erro || "Não foi possível cadastrar o paciente.");
        return;
      }

      const novoPaciente: Paciente = {
        id: dados.id,
        nome: dados.nome,
        cpf: dados.cpf,
        telefone: dados.telefone,
        email: dados.email || undefined,
        dataNascimento: dados.dataNascimento || undefined,
        empresa: dados.empresa?.nome,
        beneficioAtivo: dados.beneficioAtivo,
        beneficioNome:
          dados.beneficioAtivo && dados.empresa
            ? dados.empresa.nome
            : undefined,
        beneficioPercentual:
          dados.beneficioAtivo && dados.empresa
            ? Number(dados.empresa.percentualBeneficio || 0)
            : 0,
        cadastroPercentual: dados.cadastro?.percentual,
        cadastroCompleto: dados.cadastro?.completo,
      };

      setPacientes((atuais) => [...atuais, novoPaciente]);
      setPacienteSelecionado(novoPaciente);
      setBusca(novoPaciente.nome);
      setNovoPacienteAberto(false);

      setNovoNome("");
      setNovoCpf("");
      setNovoNascimento("");
      setNovoTelefone("");
      setNovoEmail("");
    } catch (erro) {
      console.error("Erro ao cadastrar paciente:", erro);
      alert(
        "Não foi possível conectar ao servidor para cadastrar o paciente."
      );
    }
  }


  async function carregarDocumentosFinanceiros(
    idAtendimento = atendimentoPersistidoId
  ) {
    if (!idAtendimento) {
      alert(
        "Salve o atendimento antes de consultar os documentos financeiros."
      );
      return;
    }

    try {
      setCarregandoDocumentos(true);

      const resposta = await fetch(
        `http://localhost:3333/atendimentos/${idAtendimento}/documentos-financeiros`
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(
          dados.erro ||
            "Não foi possível carregar os documentos financeiros."
        );
        return;
      }

      setDocumentosFinanceiros(dados);
    } catch (erro) {
      console.error(
        "Erro ao carregar documentos financeiros:",
        erro
      );

      alert(
        "Não foi possível conectar ao servidor para carregar os documentos financeiros."
      );
    } finally {
      setCarregandoDocumentos(false);
    }
  }

  async function emitirOuAbrirProximoRecibo(
    guiaId: number
  ) {
    try {
      setEmitindoReciboGuiaId(guiaId);

      const resposta = await fetch(
        `http://localhost:3333/guias/${guiaId}/recibo`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(
          dados.erro ||
            "Não foi possível emitir o recibo."
        );
        return;
      }

      await carregarDocumentosFinanceiros();

      if (dados.codigoPublico) {
        window.open(
          `/impressao/recibo/${encodeURIComponent(
            dados.codigoPublico
          )}`,
          "_blank",
          "noopener,noreferrer"
        );
      }
    } catch (erro) {
      console.error("Erro ao emitir recibo:", erro);

      alert(
        "Não foi possível conectar ao servidor para emitir o recibo."
      );
    } finally {
      setEmitindoReciboGuiaId(null);
    }
  }

  async function registrarPagamentoImediato(
    guiaChave: string,
    guiaId: number,
    valor: number,
    forma: string
  ) {
    try {
      setProcessandoPagamento(true);

      const resposta = await fetch(
        `http://localhost:3333/guias/${guiaId}/pagamentos`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            valor,
            forma,
          }),
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(
          dados.erro ||
            "Não foi possível registrar o pagamento."
        );
        return false;
      }

      setPagamentosGuias((atuais) => ({
        ...atuais,
        [guiaChave]:
          Number(dados.financeiro?.totalPago || 0),
      }));

      setEstornosGuias((atuais) => ({
        ...atuais,
        [guiaChave]:
          Number(dados.financeiro?.totalEstornado || 0),
      }));

      setGuiasPagas((atuais) => ({
        ...atuais,
        [guiaChave]:
          dados.financeiro?.status === "PAGA",
      }));

      return true;
    } catch (erro) {
      console.error(
        "Erro ao registrar pagamento:",
        erro
      );

      alert(
        "Não foi possível conectar ao servidor para registrar o pagamento."
      );

      return false;
    } finally {
      setProcessandoPagamento(false);
    }
  }

  async function registrarEstornoImediato(
    guiaChave: string,
    guiaId: number,
    valor: number,
    forma: string,
    motivo: string
  ) {
    try {
      setProcessandoEstorno(true);

      const resposta = await fetch(
        `http://localhost:3333/guias/${guiaId}/estornos`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            valor,
            forma,
            motivo,
          }),
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(
          dados.erro ||
            "Não foi possível registrar o estorno."
        );
        return false;
      }

      setPagamentosGuias((atuais) => ({
        ...atuais,
        [guiaChave]:
          Number(dados.financeiro?.totalPago || 0),
      }));

      setEstornosGuias((atuais) => ({
        ...atuais,
        [guiaChave]:
          Number(dados.financeiro?.totalEstornado || 0),
      }));

      setGuiasPagas((atuais) => ({
        ...atuais,
        [guiaChave]:
          dados.financeiro?.status === "PAGA",
      }));

      await carregarDocumentosFinanceiros();

      return true;
    } catch (erro) {
      console.error(
        "Erro ao registrar estorno:",
        erro
      );

      alert(
        "Não foi possível conectar ao servidor para registrar o estorno."
      );

      return false;
    } finally {
      setProcessandoEstorno(false);
    }
  }

  return (
    <div
      className="mx-auto max-w-5xl"
      data-aprendiz-atendimento="true"
      data-aprendiz="atendimento-fluxo"
      data-aprendiz-estado={contextoAprendizAtendimento.estado}
      data-aprendiz-alvo={contextoAprendizAtendimento.alvo}
      data-aprendiz-detalhe={contextoAprendizAtendimento.detalhe}
    >
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-xango-text">
          {atendimentoId ? `Atendimento #${atendimentoId}` : "Novo Atendimento"}
        </h2>

        <p className="mt-1 text-sm text-xango-muted">
          {atendimentoId
            ? "Continue o atendimento salvo de onde parou."
            : "Inicie um novo atendimento e acompanhe todas as etapas do processo."}
        </p>

        {(carregandoDados || carregandoAtendimento) && (
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm text-blue-700">
              {carregandoAtendimento ? "Carregando atendimento salvo..." : "Carregando dados do sistema..."}
            </p>
          </div>
        )}

        {erroDados && (
          <div
            data-aprendiz="atendimento-erro"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3"
          >
            <p className="text-sm font-medium text-red-700">
              {erroDados}
            </p>
          </div>
        )}
      </div>

      <div
        data-aprendiz="atendimento-etapas"
        className="mb-6 rounded-lg border border-xango-border bg-white p-4 shadow-sm"
      >
        <div className="grid grid-cols-5 gap-2">
          {etapas.map((etapa, index) => {
            const liberada =
              index <= etapaMaximaLiberada;

            return (
              <button
                key={etapa}
                data-aprendiz={`atendimento-etapa-${index}`}
                type="button"
                disabled={!liberada}
                onClick={() => setEtapaAtual(index)}
                className={`rounded-md border px-3 py-3 text-center text-xs font-medium transition ${
                  index === etapaAtual
                    ? "border-xango-primary bg-xango-primary text-white"
                    : liberada
                      ? "cursor-pointer border-xango-primary/30 bg-teal-50 text-xango-primary hover:border-xango-primary hover:bg-teal-100"
                      : "cursor-not-allowed border-xango-border bg-xango-background text-xango-muted opacity-50"
                }`}
              >
                <div className="mb-1 text-sm font-bold">
                  {index + 1}
                </div>

                {etapa}
              </button>
            );
          })}
        </div>
      </div>

      {etapaAtual === 0 && (
      <section
        data-aprendiz="atendimento-paciente"
        className="rounded-lg border border-xango-border bg-white p-6 shadow-sm"
      >
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-xango-text">
            Paciente
          </h3>

          <p className="mt-1 text-sm text-xango-muted">
            Localize um paciente existente ou cadastre um novo.
          </p>
        </div>

        <div
          data-aprendiz="atendimento-paciente-busca"
          className="grid gap-4 md:grid-cols-[1fr_auto]"
        >
          <input
            type="text"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Pesquisar por nome, CPF ou telefone..."
            className="w-full rounded-md border border-xango-border bg-white px-4 py-3 text-sm outline-none transition focus:border-xango-primary focus:ring-2 focus:ring-xango-primary/10"
          />

          <button
            type="button"
            onClick={() => setNovoPacienteAberto(true)}
            className="rounded-md border border-xango-primary px-4 py-3 text-sm font-medium text-xango-primary transition hover:bg-xango-background"
          >
            + Novo paciente
          </button>
        </div>

        <div className="mt-5">
          {busca && pacientesFiltrados.length > 0 && (
            <div className="overflow-hidden rounded-md border border-xango-border">
              {pacientesFiltrados.map((paciente) => {
                const selecionado = pacienteSelecionado?.id === paciente.id;

                return (
                  <button
                    key={paciente.id}
                    type="button"
                    onClick={() => {
                      setPacienteSelecionado(paciente);
                      void atualizarCadastroPacienteSelecionado(paciente.id);
                    }}
                    className={`flex w-full items-center justify-between border-b border-xango-border px-4 py-3 text-left last:border-b-0 ${
                      selecionado
                        ? "bg-xango-background"
                        : "bg-white hover:bg-xango-background/60"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-xango-text">
                        {paciente.nome}
                      </p>

                      <p className="mt-1 text-xs text-xango-muted">
                        CPF: {formatarCpf(paciente.cpf)}
                      </p>
                    </div>

                    <p className="text-xs text-xango-muted">
                      {formatarTelefone(paciente.telefone)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {busca && pacientesFiltrados.length === 0 && (
            <div className="rounded-md border border-dashed border-xango-border bg-xango-background p-6 text-center">
              <p className="text-sm text-xango-muted">
                Nenhum paciente encontrado.
              </p>
            </div>
          )}

          {!busca && !pacienteSelecionado && (
            <div className="rounded-md border border-dashed border-xango-border bg-xango-background p-6 text-center">
              <p className="text-sm text-xango-muted">
                Pesquise um paciente para continuar o atendimento.
              </p>
            </div>
          )}
        </div>

        {pacienteSelecionado && (
          <div
            data-aprendiz="atendimento-paciente-selecionado"
            className="mt-5 rounded-md border border-xango-primary/30 bg-xango-background p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">Paciente selecionado</p>
                <p className="mt-2 font-semibold text-xango-text">{pacienteSelecionado.nome}</p>
                <p className="mt-1 text-sm text-xango-muted">
                  {formatarCpf(pacienteSelecionado.cpf)} • {formatarTelefone(pacienteSelecionado.telefone)}
                </p>
                <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  pacienteSelecionado.cadastroCompleto ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"
                }`}>
                  {carregandoCadastroPaciente ? "Atualizando cadastro..." :
                    pacienteSelecionado.cadastroCompleto ? "Cadastro 100% • Completo" :
                    `Cadastro ${pacienteSelecionado.cadastroPercentual ?? 0}%`}
                </span>
              </div>
              <button
                type="button"
                data-aprendiz="atendimento-paciente-editar"
                onClick={() => editarCadastroPaciente(pacienteSelecionado.id)}
                className="rounded-md border border-xango-primary bg-white px-4 py-2 text-sm font-semibold text-xango-primary transition hover:bg-teal-50"
              >
                Editar cadastro
              </button>
            </div>

            {pacienteSelecionado.beneficioAtivo && (
              <div className="mt-4 rounded-md border border-xango-accent/30 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Benefício vinculado
                </p>

                <p className="mt-1 text-sm font-semibold text-xango-text">
                  {pacienteSelecionado.empresa}
                </p>

                <p className="mt-1 text-sm text-xango-muted">
                  {pacienteSelecionado.beneficioNome} •{" "}
                  <span className="font-bold text-xango-accent">
                    {pacienteSelecionado.beneficioPercentual}% de desconto
                  </span>
                </p>
              </div>
            )}

            {!pacienteSelecionado.beneficioAtivo && (
              <p className="mt-3 text-xs text-xango-muted">
                Nenhum benefício vinculado ao cadastro.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end border-t border-xango-border pt-5">
          <button
            type="button"
            data-aprendiz="atendimento-paciente-continuar"
            onClick={() => setEtapaAtual(1)}
            disabled={!pacienteSelecionado}
            className="rounded-md bg-xango-primary px-5 py-2.5 text-sm font-medium text-white transition enabled:hover:bg-xango-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continuar
          </button>
        </div>
      </section>
      )}

      {etapaAtual === 1 && (
  <section
    data-aprendiz="atendimento-procedimentos"
    className="rounded-lg border border-xango-border bg-white p-6 shadow-sm"
  >
    <div className="mb-5">
      <h3 className="text-lg font-semibold text-xango-text">
        Procedimento
      </h3>

      <p className="mt-1 text-sm text-xango-muted">
        Selecione a consulta ou exame solicitado pelo paciente.
      </p>
    </div>

    <input
      data-aprendiz="atendimento-procedimento-busca"
      type="text"
      value={buscaProcedimento}
      onChange={(event) => setBuscaProcedimento(event.target.value)}
      placeholder="Pesquisar por nome ou sinônimo (ex.: rins e vias)..."
      className="w-full rounded-md border border-xango-border bg-white px-4 py-3 text-sm outline-none transition focus:border-xango-primary focus:ring-2 focus:ring-xango-primary/10"
    />

    <div className="mt-5 overflow-hidden rounded-md border border-xango-border">
      {procedimentosFiltrados.map((procedimento) => {
        const selecionado = procedimentosSelecionados.some(
          (item) => item.id === procedimento.id
        );

        return (
          <button
            key={procedimento.id}
            type="button"
            onClick={() => {
              setProcedimentosSelecionados((atuais) => {
                const jaSelecionado = atuais.some(
                  (item) => item.id === procedimento.id
                );

                if (jaSelecionado) {
                  return atuais.filter(
                    (item) => item.id !== procedimento.id
                  );
                }

                return [...atuais, procedimento];
              });
            }}

            className={`flex w-full items-center justify-between border-b border-xango-border px-4 py-3 text-left transition last:border-b-0 ${
              selecionado
                ? "bg-teal-50"
                : "bg-white hover:bg-xango-background"
            }`}
          >
            <div>
              <p className="text-sm font-semibold text-xango-text">
                {procedimento.nome}
              </p>

              <p className="mt-1 text-xs text-xango-muted">
                {procedimento.categoria}
              </p>

              {buscaProcedimento.trim() &&
                !normalizarBuscaProcedimento(procedimento.nome).includes(
                  normalizarBuscaProcedimento(buscaProcedimento)
                ) && (
                  <p className="mt-1 text-[11px] font-medium text-xango-primary">
                    Encontrado por:{" "}
                    {procedimento.aliases.find((alias) =>
                      normalizarBuscaProcedimento(alias).includes(
                        normalizarBuscaProcedimento(buscaProcedimento)
                      )
                    )}
                  </p>
                )}
            </div>

            {selecionado && (
              <span className="text-xs font-semibold text-xango-primary">
                Selecionado
              </span>
            )}
          </button>
        );
      })}
    </div>

    <div
      data-aprendiz="atendimento-procedimentos-selecionados"
      className="mt-5 flex items-center justify-between rounded-md border border-xango-border bg-xango-background px-4 py-3"
    >
      <p className="text-sm text-xango-muted">
        {procedimentosSelecionados.length === 0
          ? "Nenhum procedimento selecionado"
          : `${procedimentosSelecionados.length} ${
              procedimentosSelecionados.length === 1
                ? "procedimento selecionado"
                : "procedimentos selecionados"
            }`}
      </p>

      {procedimentosSelecionados.length > 0 && (
        <button
          type="button"
          onClick={() => setProcedimentosSelecionados([])}
          className="text-xs font-semibold text-xango-primary hover:underline"
        >
          Limpar seleção
        </button>
      )}
    </div>

    <div className="mt-6 flex items-center justify-between border-t border-xango-border pt-5">
      <button
        type="button"
        onClick={() => setEtapaAtual(0)}
        className="rounded-md border border-xango-border px-5 py-2.5 text-sm font-medium text-xango-text transition hover:bg-xango-background"
      >
        Voltar
      </button>

      <button
        type="button"
        data-aprendiz="atendimento-procedimento-continuar"
        onClick={() => setEtapaAtual(2)}
        disabled={procedimentosSelecionados.length === 0}
        className="rounded-md bg-xango-primary px-5 py-2.5 text-sm font-medium text-white transition enabled:hover:bg-xango-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continuar
      </button>
    </div>
  </section>
)}
{etapaAtual === 2 && (
  <section
    data-aprendiz="atendimento-clinica"
    className="rounded-lg border border-xango-border bg-white p-6 shadow-sm"
  >
    <div className="mb-5">
      <h3 className="text-lg font-semibold text-xango-text">
        Clínica e agendamento
      </h3>

      <p className="mt-1 text-sm text-xango-muted">
        Escolha a clínica e a unidade de atendimento para cada procedimento selecionado.
      </p>
    </div>

    <div className="space-y-4">
      {procedimentosSelecionados.map((procedimento) => {
        const clinicasDisponiveis = clinicas.filter((clinica) =>
          clinica.procedimentos.includes(procedimento.id)
        );

        return (
          <div
            key={procedimento.id}
            data-aprendiz="atendimento-clinica-card"
            data-procedimento-id={procedimento.id}
            className="rounded-md border border-xango-border p-4"
          >
            <div className="mb-4">
              <p className="font-semibold text-xango-text">
                {procedimento.nome}
              </p>

              <p className="mt-1 text-xs text-xango-muted">
                {procedimento.categoria}
              </p>
            </div>

            {clinicasDisponiveis.length > 0 ? (
              <div
                data-aprendiz="atendimento-clinica-opcoes"
                data-procedimento-id={procedimento.id}
                className="grid gap-2 md:grid-cols-2"
              >
                {clinicasDisponiveis.map((clinica) => {
                  const selecionada =
                    clinicasSelecionadas[procedimento.id] === clinica.id;

                  return (
                    <button
                      key={clinica.id}
                      type="button"
                      onClick={() =>
                        void selecionarClinicaDoProcedimento(
                          procedimento.id,
                          clinica.id
                        )
                      }
                      className={`rounded-md border px-4 py-3 text-left transition ${
                        selecionada
                          ? "border-xango-primary bg-teal-50"
                          : "border-xango-border bg-white hover:bg-xango-background"
                      }`}
                    >
                      <p className="text-sm font-semibold text-xango-text">
                        {clinica.nome}
                      </p>

                      <p className="mt-1 text-xs text-xango-muted">
                        Disponível para este procedimento
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-800">
                  Nenhuma clínica cadastrada para este procedimento.
                </p>
              </div>
            )}

            {clinicasSelecionadas[procedimento.id] && (() => {
              const clinicaSelecionada = clinicas.find(
                (clinica) => clinica.id === clinicasSelecionadas[procedimento.id]
              );

              if (!clinicaSelecionada) return null;

              if (clinicaSelecionada.unidades.length === 0) {
                return (
                  <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                      Unidade de atendimento
                    </p>
                    <p className="mt-1 text-sm text-xango-text">
                      Esta clínica ainda não possui unidades cadastradas. Será usado o preço-base da clínica.
                    </p>
                    <p className="mt-2 text-sm font-semibold text-xango-primary">
                      Valor: {procedimento.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                );
              }

              return (
                <div className="mt-4 border-t border-xango-border pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-xango-muted">
                    Unidade de atendimento
                  </p>
                  <div
                    data-aprendiz="atendimento-unidade-opcoes"
                    data-procedimento-id={procedimento.id}
                    className="grid gap-2 md:grid-cols-2"
                  >
                    {clinicaSelecionada.unidades.map((unidade) => {
                      const selecionada = unidadesSelecionadas[procedimento.id] === unidade.id;
                      const carregando = carregandoPrecoProcedimentoId === procedimento.id;
                      const endereco = [
                        unidade.logradouro,
                        unidade.numero,
                        unidade.bairro,
                        unidade.cidade,
                        unidade.uf,
                      ].filter(Boolean).join(" • ");

                      return (
                        <button
                          key={unidade.id}
                          type="button"
                          disabled={carregando}
                          onClick={() =>
                            void selecionarUnidadeDoProcedimento(
                              procedimento.id,
                              clinicaSelecionada.id,
                              unidade.id
                            )
                          }
                          className={`rounded-md border px-4 py-3 text-left transition disabled:opacity-50 ${
                            selecionada
                              ? "border-xango-primary bg-teal-50"
                              : "border-xango-border bg-white hover:bg-xango-background"
                          }`}
                        >
                          <p className="text-sm font-semibold text-xango-text">{unidade.nome}</p>
                          {endereco && (
                            <p className="mt-1 text-xs text-xango-muted">{endereco}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {unidadesSelecionadas[procedimento.id] && (
                    <div className="mt-3 flex items-center justify-between rounded-md bg-xango-background px-4 py-3">
                      <span className="text-sm text-xango-muted">Preço desta unidade</span>
                      <span className="text-sm font-bold text-xango-primary">
                        {procedimento.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {clinicasSelecionadas[procedimento.id] && (
              <div className="mt-5 border-t border-xango-border pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Agendamento
                </p>

                <div
                  data-aprendiz="atendimento-agendamento-tipos"
                  data-procedimento-id={procedimento.id}
                  className="grid gap-2 md:grid-cols-3"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setTiposAgendamento((atuais) => ({
                        ...atuais,
                        [procedimento.id]: "horario",
                      }))
                    }
                    className={`rounded-md border px-3 py-3 text-left text-sm transition ${
                      tiposAgendamento[procedimento.id] === "horario"
                        ? "border-xango-primary bg-teal-50 text-xango-primary"
                        : "border-xango-border bg-white text-xango-text hover:bg-xango-background"
                    }`}
                  >
                    <span className="font-semibold">Data e horário</span>

                    <span className="mt-1 block text-xs text-xango-muted">
                      Agendamento já definido
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setTiposAgendamento((atuais) => ({
                        ...atuais,
                        [procedimento.id]: "aguardando",
                      }))
                    }
                    className={`rounded-md border px-3 py-3 text-left text-sm transition ${
                      tiposAgendamento[procedimento.id] === "aguardando"
                        ? "border-amber-400 bg-amber-50 text-amber-800"
                        : "border-xango-border bg-white text-xango-text hover:bg-xango-background"
                    }`}
                  >
                    <span className="font-semibold">Aguardando clínica</span>

                    <span className="mt-1 block text-xs text-xango-muted">
                      Horário ainda não informado
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setTiposAgendamento((atuais) => ({
                        ...atuais,
                        [procedimento.id]: "ordem",
                      }))
                    }
                    className={`rounded-md border px-3 py-3 text-left text-sm transition ${
                      tiposAgendamento[procedimento.id] === "ordem"
                        ? "border-xango-primary bg-teal-50 text-xango-primary"
                        : "border-xango-border bg-white text-xango-text hover:bg-xango-background"
                    }`}
                  >
                    <span className="font-semibold">Ordem de chegada</span>

                    <span className="mt-1 block text-xs text-xango-muted">
                      Não necessita horário
                    </span>
                  </button>
                </div>
                {tiposAgendamento[procedimento.id] === "horario" && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div
                      data-aprendiz="atendimento-agendamento-data"
                      data-procedimento-id={procedimento.id}
                    >
                      <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                        Data
                      </label>

                      <input
                        type="date"
                        value={datasAgendamento[procedimento.id] || ""}
                        onChange={(event) =>
                          setDatasAgendamento((atuais) => ({
                            ...atuais,
                            [procedimento.id]: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-md border border-xango-border bg-white px-4 py-3 text-sm text-xango-text outline-none transition focus:border-xango-primary"
                      />
                    </div>

                    <div
                      data-aprendiz="atendimento-agendamento-horario"
                      data-procedimento-id={procedimento.id}
                    >
                      <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                        Horário
                      </label>

                      <input
                        type="time"
                        value={horariosAgendamento[procedimento.id] || ""}
                        onChange={(event) =>
                          setHorariosAgendamento((atuais) => ({
                            ...atuais,
                            [procedimento.id]: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-md border border-xango-border bg-white px-4 py-3 text-sm text-xango-text outline-none transition focus:border-xango-primary"
                      />
                    </div>
                  </div>
                )}

                {tiposAgendamento[procedimento.id] === "ordem" && (
                  <div
                    data-aprendiz="atendimento-agendamento-data"
                    data-procedimento-id={procedimento.id}
                    className="mt-4 max-w-sm"
                  >
                    <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                      Data prevista
                    </label>

                    <input
                      type="date"
                      value={datasAgendamento[procedimento.id] || ""}
                      onChange={(event) =>
                        setDatasAgendamento((atuais) => ({
                          ...atuais,
                          [procedimento.id]: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-md border border-xango-border bg-white px-4 py-3 text-sm text-xango-text outline-none transition focus:border-xango-primary"
                    />
                  </div>
                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-xango-border pt-5">
                      <button
                        type="button"
                        onClick={() => setEtapaAtual(1)}
                        className="rounded-md border border-xango-border px-5 py-2.5 text-sm font-medium text-xango-text transition hover:bg-xango-background"
                      >
                        Voltar
                      </button>

                      <button
                        type="button"
                        data-aprendiz="atendimento-clinica-continuar"
                        onClick={() => setEtapaAtual(3)}
                        disabled={
                        procedimentosSelecionados.length === 0 ||
                        procedimentosSelecionados.some((procedimento) => {
                          const id = procedimento.id;
                          const clinicaId = clinicasSelecionadas[id];
                          const tipo = tiposAgendamento[id];

                          if (!clinicaId || !tipo) {
                            return true;
                          }

                          const clinica = clinicas.find((item) => item.id === clinicaId);
                          if (clinica?.unidades.length && !unidadesSelecionadas[id]) {
                            return true;
                          }

                          if (tipo === "horario") {
                            return !datasAgendamento[id] || !horariosAgendamento[id];
                          }

                          if (tipo === "ordem") {
                            return !datasAgendamento[id];
                          }

                          return false;
                        })
                      }
                        className="rounded-md bg-xango-primary px-5 py-2.5 text-sm font-medium text-white transition enabled:hover:bg-xango-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Continuar
                      </button>
                    </div>
                  </section>
                )}

      {etapaAtual === 3 && (
  <section
    data-aprendiz="atendimento-guias"
    className="rounded-lg border border-xango-border bg-white p-6 shadow-sm"
  >
    <div className="mb-5">
      <h3 className="text-lg font-semibold text-xango-text">
        Guias e pagamento
      </h3>

      <p className="mt-1 text-sm text-xango-muted">
        Confira, salve e acompanhe o pagamento das guias deste atendimento.
      </p>
    </div>

    <div className="space-y-4">
      {guias.map((guia, index) => {
        const procedimentosAtivos = guia.procedimentos.filter(
          (procedimento) => !procedimentosCancelados[procedimento.id]
        );
        const subtotal = procedimentosAtivos.reduce(
          (total, procedimento) => total + procedimento.valor,
          0
        );

        const repasseTotal = procedimentosAtivos.reduce(
          (total, procedimento) => total + procedimento.repasse,
          0
        );
        const percentualBeneficio =
          pacienteSelecionado?.beneficioAtivo
            ? pacienteSelecionado.beneficioPercentual
            : 0;

        const valorBeneficio =
          subtotal * (percentualBeneficio / 100);

        const descontoMaximo = Math.max(subtotal - repasseTotal, 0);
        const beneficioExcedeLimite =
          !!pacienteSelecionado?.beneficioAtivo &&
          valorBeneficio > descontoMaximo;

        const descontoManualInformado =
          pacienteSelecionado?.beneficioAtivo
            ? 0
            : descontosGuias[guia.chave] || 0;

        const descontoManual = Math.min(
          descontoManualInformado,
          descontoMaximo
        );

        const valorFinal = Math.max(
          subtotal - valorBeneficio - descontoManual,
          0
        );

        const valorPago = pagamentosGuias[guia.chave] || 0;
        const totalEstornado = estornosGuias[guia.chave] || 0;

        const valorPagoLiquido = Math.max(
          valorPago - totalEstornado,
          0
        );

        const saldoPendente = Math.max(
          valorFinal - valorPagoLiquido,
          0
        );

        const valorEstornoNecessario = Math.max(
          valorPagoLiquido - valorFinal,
          0
        );

        const possuiEstornoPendente =
          valorEstornoNecessario > 0;


        const todosProcedimentosCancelados =
          guia.procedimentos.length > 0 &&
          procedimentosAtivos.length === 0;

        const cancelamentoLiquidado =
          todosProcedimentosCancelados &&
          valorPago > 0 &&
          totalEstornado >= valorPago;

        const guiaQuitada =
          !!guiasSalvas[guia.chave] &&
          procedimentosAtivos.length > 0 &&
          saldoPendente === 0 &&
          !possuiEstornoPendente;

        const podeImprimirGuia =
          guiaQuitada &&
          procedimentosAtivos.length > 0;

        const statusGuia =
          !guiasSalvas[guia.chave]
            ? "Não salva"
            : todosProcedimentosCancelados && possuiEstornoPendente
              ? "Cancelada • estorno pendente"
              : cancelamentoLiquidado
                ? "Cancelada • valores liquidados"
                : possuiEstornoPendente
                  ? "Estorno pendente"
                  : guiaQuitada
                    ? "Paga"
                    : valorPagoLiquido > 0
                      ? "Parcialmente paga"
                      : todosProcedimentosCancelados
                        ? "Cancelada"
                        : "Aguardando pagamento";

        return (
          <div
            key={guia.chave}
            data-aprendiz="atendimento-guia"
            data-guia-chave={guia.chave}
            className="rounded-md border border-xango-border bg-white p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Guia {index + 1}
                </p>

                <h4 className="mt-1 text-base font-semibold text-xango-text">
                  {guia.clinicaNome}
                </h4>
                {guia.unidadeClinicaNome && (
                  <p className="mt-1 text-xs font-semibold text-xango-primary">
                    Unidade: {guia.unidadeClinicaNome}
                  </p>
                )}
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  statusGuia === "Paga"
                    ? "bg-emerald-100 text-emerald-800"
                    : statusGuia === "Parcialmente paga"
                      ? "bg-blue-100 text-blue-800"
                      : statusGuia === "Estorno pendente"
                        ? "bg-red-100 text-red-700"
                        : statusGuia === "Aguardando pagamento"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-xango-background text-xango-muted"
                }`}
              >
                {statusGuia}
              </span>
            </div>

            <div className="mt-4 border-t border-xango-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-xango-muted">
                Procedimentos
              </p>

              <div className="space-y-2">
                {guia.procedimentos.map((procedimento) => {
                  const cancelado = !!procedimentosCancelados[procedimento.id];
                return (
                    <div
                      key={procedimento.id}
                      className={`flex items-center justify-between gap-4 rounded-md px-3 py-3 ${
                        cancelado
                          ? "bg-red-50 opacity-70"
                          : "bg-xango-background"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium ${
                              cancelado
                                ? "text-slate-400 line-through"
                                : "text-xango-text"
                            }`}
                          >
                            {procedimento.nome}
                          </span>

                          {cancelado && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                              Cancelado
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-xango-muted">
                          {procedimento.categoria}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <p
                          className={`text-sm font-semibold ${
                            cancelado
                              ? "text-slate-400 line-through"
                              : "text-xango-text"
                          }`}
                        >
                          {procedimento.valor.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </p>

                        {!cancelado && (
                          <button
                            type="button"
                            onClick={() =>
                              setProcedimentosCancelados((atuais) => ({
                                ...atuais,
                                [procedimento.id]: true,
                              }))
                            }
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-xango-border pt-4">
              <p className="text-sm font-semibold text-xango-text">
                Total da guia
              </p>

              <p className="text-lg font-bold text-xango-primary">
                {subtotal.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
            </div>

            <div className="mt-4 rounded-md border border-xango-border bg-xango-background p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-xango-muted">
                  Subtotal
                </span>

                <span className="text-sm font-semibold text-xango-text">
                  {subtotal.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>

              <div className="mt-4">
                <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Benefício
                </label>

                <input
                  type="text"
                  value={
                    pacienteSelecionado?.beneficioAtivo
                      ? pacienteSelecionado.beneficioNome
                      : "Nenhum benefício"
                  }
                  disabled
                  className="mt-2 w-full rounded-md border border-xango-border bg-xango-background px-3 py-2.5 text-sm text-xango-muted disabled:cursor-not-allowed"
                />
              </div>

              {beneficioExcedeLimite && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-semibold text-red-700">
                    Benefício necessita de revisão
                  </p>

                  <p className="mt-1 text-xs leading-5 text-red-600">
                    O benefício cadastrado ultrapassa o limite permitido para esta guia.
                    Solicite autorização administrativa antes de continuar.
                  </p>
                </div>
              )}

              <div className="mt-4">
                <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Desconto manual
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={descontoManual}
                  disabled={
                    !!pacienteSelecionado?.beneficioAtivo ||
                    guiasPagas[guia.chave]
                  }
                  onChange={(event) => {
                    const valor = Number(event.target.value);

                    setDescontosGuias((atuais) => ({
                      ...atuais,
                      [guia.chave]: Math.min(valor, descontoMaximo),
                    }));
                  }}
                  placeholder="0,00"
                  className="mt-2 w-full rounded-md border border-xango-border bg-white px-3 py-2.5 text-sm text-xango-text outline-none focus:border-xango-primary disabled:cursor-not-allowed disabled:bg-xango-background disabled:opacity-50"
                />

                {!pacienteSelecionado?.beneficioAtivo && (
                  <p className="mt-1 text-[11px] text-xango-muted">
                    O sistema limita automaticamente o desconto ao valor máximo permitido.
                  </p>
                )}              
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-xango-muted">
                  {pacienteSelecionado?.beneficioAtivo
                    ? `Benefício (${percentualBeneficio}%)`
                    : "Desconto manual"}
                </span>

                <span className="text-sm font-medium text-red-600">
                  -{" "}
                  {(pacienteSelecionado?.beneficioAtivo
                    ? valorBeneficio
                    : descontoManual
                  ).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-xango-border pt-4">
                <span className="text-sm font-bold text-xango-text">
                  Valor a pagar
                </span>

                <span className="text-xl font-bold text-xango-primary">
                  {valorFinal.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>
            </div>

            {guiasSalvas[guia.chave] && (
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-xango-border pt-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-xango-muted">
                    Pago Liquido
                  </p>

                  <p className="mt-1 text-base font-bold text-emerald-700">
                    {valorPagoLiquido.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-medium uppercase tracking-wide text-xango-muted">
                    Saldo pendente
                  </p>

                  <p
                    className={`mt-1 text-base font-bold ${
                      saldoPendente === 0
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    {saldoPendente.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </p>
                </div>
              </div>
            )}
            {possuiEstornoPendente && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-red-700">
                      Estorno necessário
                    </p>

                    <p className="mt-1 text-xs text-red-600">
                      O valor recebido é maior que o valor atual desta guia.
                    </p>
                  </div>

                  <p className="text-lg font-bold text-red-700">
                    {valorEstornoNecessario.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  data-aprendiz="atendimento-guia-estorno"
                  onClick={() => {
                    setGuiaEstornoAberta(guia.chave);
                    setFormaEstorno("");
                    setValorEstornadoInformado("");
                    setObservacaoEstorno("");
                  }}
                  className="mt-3 rounded-md bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                >
                  Registrar estorno
                </button>

                <p className="mt-3 border-t border-red-200 pt-3 text-xs text-red-600">
                  Existe uma pendência financeira que deverá ser resolvida antes do
                  encerramento da guia.
                </p>
              </div>
            )}

            <div className="mt-4 border-t border-xango-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                Agendamento
              </p>

              {guia.tipoAgendamento === "horario" && (
                <p className="mt-2 text-sm text-xango-text">
                  {guia.data} às {guia.horario}
                </p>
              )}

              {guia.tipoAgendamento === "ordem" && (
                <p className="mt-2 text-sm text-xango-text">
                  {guia.data} • Ordem de chegada
                </p>
              )}

              {guia.tipoAgendamento === "aguardando" && (
                <p className="mt-2 text-sm font-medium text-amber-700">
                  Aguardando retorno da clínica
                </p>
              )}
            </div>
            
            <div className="mt-4 border-t border-xango-border pt-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-xango-text">
                    Situação da guia 
                  </p>

                  <p className="mt-1 text-xs text-xango-muted">
                    {statusGuia === "Paga"
                      ? "Pagamento confirmado. Guia liberada para impressão."
                      : statusGuia === "Parcialmente paga"
                        ? "A guia possui pagamento parcial e ainda tem saldo pendente."
                        : statusGuia === "Estorno pendente"
                          ? "Existe um estorno pendente que precisa ser concluído."
                          : statusGuia === "Aguardando pagamento"
                            ? "Guia salva e aguardando pagamento."
                            : "A guia ainda não foi salva."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-aprendiz="atendimento-guia-salvar"
                  disabled={
                    guiasSalvas[guia.chave] ||
                    beneficioExcedeLimite
                  }
                  onClick={async () => {
                    await salvarAtendimentoParaDepois(
                      true,
                      guia.chave
                    );
                  }}
                  className="rounded-md bg-xango-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-xango-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Salvar guia
                </button>

                {procedimentosAtivos.length > 0 && (
                  <button
                    type="button"
                    data-aprendiz="atendimento-guia-pagamento"
                    disabled={
                      !guiasSalvas[guia.chave] ||
                      guiaQuitada ||
                      possuiEstornoPendente
                    }
                    onClick={() => {
                      setGuiaPagamentoAberta(guia.chave);
                      setFormaPagamento("");
                      setValorRecebido("");
                    }}
                    className="rounded-md border border-xango-primary px-4 py-2 text-xs font-semibold text-xango-primary transition enabled:hover:bg-xango-background disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Registrar pagamento
                  </button>
                )}

                {guiasSalvas[guia.chave] &&
                  valorPagoLiquido > 0 && (
                    <button
                      type="button"
                      data-aprendiz="atendimento-guia-estorno"
                      disabled={!guiaIds[guia.chave]}
                      onClick={() => {
                        setGuiaEstornoAberta(guia.chave);
                        setFormaEstorno("");
                        setValorEstornadoInformado("");
                        setObservacaoEstorno("");
                      }}
                      className="rounded-md border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition enabled:hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Registrar estorno
                    </button>
                  )}

                {guiasSalvas[guia.chave] &&
                  valorPagoLiquido > 0 && (
                    <button
                      type="button"
                      disabled={
                        !guiaIds[guia.chave] ||
                        emitindoReciboGuiaId ===
                          guiaIds[guia.chave]
                      }
                      onClick={() => {
                        const guiaId =
                          guiaIds[guia.chave];

                        if (!guiaId) {
                          alert(
                            "Salve a guia antes de emitir o recibo."
                          );
                          return;
                        }

                        void emitirOuAbrirProximoRecibo(
                          guiaId
                        );
                      }}
                      className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition enabled:hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {emitindoReciboGuiaId ===
                      guiaIds[guia.chave]
                        ? "Emitindo recibo..."
                        : "Emitir próximo recibo"}
                    </button>
                  )}

                {podeImprimirGuia && (
                  <button
                    type="button"
                    disabled={!guiaIds[guia.chave]}
                    onClick={() => {
                      const guiaId = guiaIds[guia.chave];

                      if (!guiaId) {
                        alert(
                          "Salve o atendimento antes de imprimir a guia."
                        );
                        return;
                      }

                      window.open(
                        `/impressao/guia/${guiaId}`,
                        "_blank",
                        "noopener,noreferrer"
                      );
                    }}
                    className="rounded-md border border-xango-border px-4 py-2 text-xs font-semibold text-xango-text transition enabled:hover:bg-xango-background disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Imprimir guia
                  </button>
                )}


              </div>
            </div>
          </div>
        );
      })}
    </div>

    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-xango-border pt-5">
      <button
        type="button"
        onClick={() => setEtapaAtual(2)}
        className="rounded-md border border-xango-border px-5 py-2.5 text-sm font-medium text-xango-text transition hover:bg-xango-background"
      >
        Voltar
      </button>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!atendimentoPersistidoId}
          onClick={async () => {
            setDocumentosFinanceirosAbertos(true);
            await carregarDocumentosFinanceiros();
          }}
          className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Documentos financeiros
        </button>

        <button
          type="button"
          data-aprendiz="atendimento-salvar-depois"
          onClick={() =>
            void salvarAtendimentoParaDepois(false)
          }
          className="rounded-md border border-xango-accent px-5 py-2.5 text-sm font-semibold text-xango-accent transition hover:bg-amber-50"
        >
          Salvar e continuar depois
        </button>

        <button
          type="button"
          disabled
          className="rounded-md bg-xango-primary px-5 py-2.5 text-sm font-medium text-white opacity-40"
        >
          Continuar
        </button>
      </div>
    </div>
  </section>
)}

{etapaAtual === 4 && (
  <section
    data-aprendiz="atendimento-revisao"
    className="rounded-lg border border-xango-border bg-white p-6 shadow-sm"
  >
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-xango-primary">
        Etapa final
      </p>

      <h3 className="mt-1 text-xl font-semibold text-xango-text">
        Revisão do atendimento
      </h3>

      <p className="mt-1 text-sm text-xango-muted">
        Confira os dados do paciente, procedimentos, agendamentos e situação
        financeira deste atendimento.
      </p>
    </div>

    {/* PACIENTE */}
    <div className="rounded-lg border border-xango-border bg-xango-background p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
        Paciente
      </p>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-xango-text">
            {pacienteSelecionado?.nome || "Paciente não informado"}
          </p>
          {pacienteSelecionado && (
            <>
              <p className="mt-1 text-sm text-xango-muted">
                CPF: {formatarCpf(pacienteSelecionado.cpf)}{" • "}{formatarTelefone(pacienteSelecionado.telefone)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  pacienteSelecionado.cadastroCompleto ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"
                }`}>
                  {carregandoCadastroPaciente ? "Atualizando cadastro..." :
                    pacienteSelecionado.cadastroCompleto ? "Cadastro 100% • Completo" :
                    `Cadastro ${pacienteSelecionado.cadastroPercentual ?? 0}%`}
                </span>
                {pacienteSelecionado.beneficioAtivo && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    {pacienteSelecionado.beneficioNome} • {pacienteSelecionado.beneficioPercentual}% de benefício
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        {pacienteSelecionado && (
          <button
            type="button"
            data-aprendiz="atendimento-revisao-editar-paciente"
            onClick={() => editarCadastroPaciente(pacienteSelecionado.id)}
            className="rounded-md border border-xango-primary bg-white px-4 py-2 text-sm font-semibold text-xango-primary transition hover:bg-teal-50"
          >
            Editar cadastro
          </button>
        )}
      </div>
    </div>

    {/* GUIAS */}
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-base font-semibold text-xango-text">
          Guias do atendimento
        </h4>

        <span className="text-xs text-xango-muted">
          {guias.length} {guias.length === 1 ? "guia" : "guias"}
        </span>
      </div>

      <div className="space-y-4">
        {guias.map((guia, index) => {
          const procedimentosAtivos = guia.procedimentos.filter(
            (procedimento) => !procedimentosCancelados[procedimento.id]
          );

          const subtotal = procedimentosAtivos.reduce(
            (total, procedimento) => total + procedimento.valor,
            0
          );

          const percentualBeneficio =
            pacienteSelecionado?.beneficioAtivo
              ? pacienteSelecionado.beneficioPercentual
              : 0;

          const valorBeneficio =
            subtotal * (percentualBeneficio / 100);

          const descontoManual =
            pacienteSelecionado?.beneficioAtivo
              ? 0
              : descontosGuias[guia.chave] || 0;

          const valorFinal = Math.max(
            subtotal - valorBeneficio - descontoManual,
            0
          );

          const totalPago =
            pagamentosGuias[guia.chave] || 0;

          const totalEstornado =
            estornosGuias[guia.chave] || 0;

          const pagoLiquido = Math.max(
            totalPago - totalEstornado,
            0
          );

          const saldo = Math.max(
            valorFinal - pagoLiquido,
            0
          );

          const quitada =
            procedimentosAtivos.length > 0 &&
            saldo === 0 &&
            pagoLiquido <= valorFinal;

          const todosCancelados =
            guia.procedimentos.length > 0 &&
            procedimentosAtivos.length === 0;

          return (
            <div
              key={guia.chave}
              className="overflow-hidden rounded-lg border border-xango-border"
            >
              {/* CABEÇALHO DA GUIA */}
              <div className="flex flex-wrap items-start justify-between gap-4 bg-xango-background px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                    Guia {index + 1}
                  </p>

                  <p className="mt-1 text-base font-semibold text-xango-text">
                    {guia.clinicaNome}
                  </p>
                  {guia.unidadeClinicaNome && (
                    <p className="mt-1 text-xs font-semibold text-xango-primary">
                      Unidade: {guia.unidadeClinicaNome}
                    </p>
                  )}
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    todosCancelados
                      ? "bg-red-100 text-red-700"
                      : quitada
                        ? "bg-emerald-100 text-emerald-800"
                        : pagoLiquido > 0
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {todosCancelados
                    ? "Cancelada"
                    : quitada
                      ? "Paga"
                      : pagoLiquido > 0
                        ? "Pagamento parcial"
                        : "Aguardando pagamento"}
                </span>
              </div>

              {/* PROCEDIMENTOS */}
              <div className="px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Procedimentos
                </p>

                <div className="mt-3 space-y-2">
                  {guia.procedimentos.map((procedimento) => {
                    const cancelado =
                      !!procedimentosCancelados[procedimento.id];

                    return (
                      <div
                        key={procedimento.id}
                        className="flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm ${
                              cancelado
                                ? "text-slate-400 line-through"
                                : "text-xango-text"
                            }`}
                          >
                            {procedimento.nome}
                          </span>

                          {cancelado && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                              Cancelado
                            </span>
                          )}
                        </div>

                        <span
                          className={`text-sm font-semibold ${
                            cancelado
                              ? "text-slate-400 line-through"
                              : "text-xango-text"
                          }`}
                        >
                          {procedimento.valor.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AGENDAMENTO */}
              <div className="border-t border-xango-border px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Agendamento
                </p>

                {guia.tipoAgendamento === "horario" && (
                  <p className="mt-2 text-sm font-medium text-xango-text">
                    {guia.data} às {guia.horario}
                  </p>
                )}

                {guia.tipoAgendamento === "ordem" && (
                  <p className="mt-2 text-sm font-medium text-xango-text">
                    {guia.data} • Ordem de chegada
                  </p>
                )}

                {guia.tipoAgendamento === "aguardando" && (
                  <p className="mt-2 text-sm font-medium text-amber-700">
                    Aguardando confirmação da clínica
                  </p>
                )}
              </div>

              {/* FINANCEIRO */}
              <div className="border-t border-xango-border bg-slate-50 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Financeiro
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-xango-muted">
                      Valor da guia
                    </p>

                    <p className="mt-1 font-semibold text-xango-text">
                      {valorFinal.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-xango-muted">
                      Recebido
                    </p>

                    <p className="mt-1 font-semibold text-xango-text">
                      {totalPago.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-xango-muted">
                      Estornado
                    </p>

                    <p
                      className={`mt-1 font-semibold ${
                        totalEstornado > 0
                          ? "text-red-600"
                          : "text-xango-text"
                      }`}
                    >
                      {totalEstornado.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-xango-muted">
                      Saldo
                    </p>

                    <p
                      className={`mt-1 font-bold ${
                        saldo === 0
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }`}
                    >
                      {saldo.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* AÇÕES */}
              <div className="flex flex-wrap gap-2 border-t border-xango-border px-5 py-4">
                <button
                  type="button"
                  onClick={() => setEtapaAtual(2)}
                  className="rounded-md border border-xango-border px-3 py-2 text-xs font-semibold text-xango-text transition hover:bg-xango-background"
                >
                  Conferir agendamento
                </button>

                <button
                  type="button"
                  onClick={() => setEtapaAtual(3)}
                  className="rounded-md border border-xango-border px-3 py-2 text-xs font-semibold text-xango-text transition hover:bg-xango-background"
                >
                  Conferir financeiro
                </button>

                {quitada && guiaIds[guia.chave] && (
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        `/impressao/guia/${guiaIds[guia.chave]}`,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    className="rounded-md border border-xango-primary px-3 py-2 text-xs font-semibold text-xango-primary transition hover:bg-xango-background"
                  >
                    Visualizar voucher
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* DOCUMENTOS */}
    <div className="mt-6 rounded-lg border border-xango-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="font-semibold text-xango-text">
            Documentos financeiros
          </h4>

          <p className="mt-1 text-sm text-xango-muted">
            Consulte recibos de pagamentos e comprovantes de estorno.
          </p>
        </div>

        <button
          type="button"
          disabled={!atendimentoPersistidoId}
          onClick={async () => {
            setDocumentosFinanceirosAbertos(true);
            await carregarDocumentosFinanceiros();
          }}
          className="rounded-md border border-xango-primary px-4 py-2.5 text-sm font-semibold text-xango-primary transition enabled:hover:bg-xango-background disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ver documentos
        </button>
      </div>
    </div>

    {/* RODAPÉ */}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-xango-border pt-5">
      <button
        type="button"
        onClick={() => router.push("/atendimentos")}
        className="rounded-md border border-xango-border px-5 py-2.5 text-sm font-medium text-xango-text transition hover:bg-xango-background"
      >
        Voltar para atendimentos
      </button>

      <button
        type="button"
        onClick={() => setEtapaAtual(3)}
        className="rounded-md bg-xango-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-xango-primary-hover"
      >
        Conferir guias e pagamentos
      </button>
    </div>
  </section>
)}

{guiaPagamentoAberta && (
  <>
    <button
      type="button"
      aria-label="Fechar pagamento"
      onClick={() => setGuiaPagamentoAberta(null)}
      className="fixed inset-0 z-40 bg-black/25"
    />

    <aside
      data-aprendiz="atendimento-pagamento-modal"
      className="fixed right-0 top-0 z-50 h-screen w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl"
    >
      {(() => {
        const guia = guias.find(
          (item) => item.chave === guiaPagamentoAberta
        );

        if (!guia) {
          return null;
        }

        const procedimentosAtivosPagamento = guia.procedimentos.filter(
          (procedimento) => !procedimentosCancelados[procedimento.id]
        );

        if (procedimentosAtivosPagamento.length === 0) {
          return null;
        }

        const subtotal = procedimentosAtivosPagamento.reduce(
          (total, procedimento) =>
            total + procedimento.valor,
          0
        );

        const percentualBeneficio =
          pacienteSelecionado?.beneficioAtivo
            ? pacienteSelecionado.beneficioPercentual
            : 0;

        const valorBeneficio =
          subtotal * (percentualBeneficio / 100);

        const desconto =
          pacienteSelecionado?.beneficioAtivo
            ? 0
            : descontosGuias[guia.chave] || 0;

        const valorFinal = Math.max(
          subtotal - valorBeneficio - desconto,
          0
        );

        const jaPago =
          pagamentosGuias[guia.chave] || 0;

        const totalEstornado =
          estornosGuias[guia.chave] || 0;

        const pagoLiquido = Math.max(
          jaPago - totalEstornado,
          0
        );

        const saldo = Math.max(
          valorFinal - pagoLiquido,
          0
        );


        return (
          <>
            <div className="flex items-start justify-between border-b border-xango-border pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Registrar pagamento
                </p>

                <h3 className="mt-1 text-xl font-semibold text-xango-text">
                  {guia.clinicaNome}
                </h3>
                {guia.unidadeClinicaNome && (
                  <p className="mt-1 text-xs font-semibold text-xango-primary">
                    Unidade: {guia.unidadeClinicaNome}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setGuiaPagamentoAberta(null)}
                className="rounded-md border border-xango-border px-3 py-2 text-sm hover:bg-xango-background"
              >
                Fechar
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div className="rounded-md border border-xango-border bg-xango-background p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-xango-muted">Valor da guia</span>
                  <span className="font-semibold text-xango-text">
                    {valorFinal.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>

                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-xango-muted">Pago Liquido</span>
                  <span className="font-semibold text-emerald-700">
                    {pagoLiquido.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>

                <div className="mt-3 flex justify-between border-t border-xango-border pt-3">
                  <span className="text-sm font-semibold text-xango-text">
                    Saldo
                  </span>

                  <span className="text-lg font-bold text-xango-primary">
                    {saldo.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
              </div>

              <div data-aprendiz="atendimento-pagamento-forma">
                <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Forma de pagamento
                </label>

                <select
                  value={formaPagamento}
                  onChange={(event) => setFormaPagamento(event.target.value)}
                  className="mt-2 w-full rounded-md border border-xango-border bg-white px-3 py-3 text-sm outline-none focus:border-xango-primary"
                >
                  <option value="">Selecione</option>
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="credito">Cartão de crédito</option>
                  <option value="debito">Cartão de débito</option>
                </select>
              </div>

              <div data-aprendiz="atendimento-pagamento-valor">
                <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Valor recebido
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorRecebido}
                  onChange={(event) => setValorRecebido(event.target.value)}
                  placeholder="0,00"
                  className="mt-2 w-full rounded-md border border-xango-border px-4 py-3 text-sm outline-none focus:border-xango-primary"
                />
              </div>

              <button
                type="button"
                data-aprendiz="atendimento-pagamento-confirmar"
                disabled={
                  !formaPagamento ||
                  !valorRecebido ||
                  Number(valorRecebido) <= 0 ||
                  Number(valorRecebido) > saldo ||
                  processandoPagamento
                }
                onClick={async () => {
                  const guiaId =
                    guiaIds[guia.chave];

                  if (!guiaId) {
                    alert(
                      "Salve a guia antes de registrar o pagamento."
                    );
                    return;
                  }

                  const sucesso =
                    await registrarPagamentoImediato(
                      guia.chave,
                      guiaId,
                      Number(valorRecebido),
                      formaPagamento
                    );

                  if (!sucesso) {
                    return;
                  }

                  setGuiaPagamentoAberta(null);
                  setFormaPagamento("");
                  setValorRecebido("");
                }}
                className="w-full rounded-md bg-xango-primary px-4 py-3 text-sm font-semibold text-white transition enabled:hover:bg-xango-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {processandoPagamento
                  ? "Registrando..."
                  : "Confirmar pagamento"}
              </button>
            </div>
          </>
        );
      })()}
    </aside>
  </>
)}
{guiaEstornoAberta && (
  <>
    <button
      type="button"
      aria-label="Fechar estorno"
      onClick={() => setGuiaEstornoAberta(null)}
      className="fixed inset-0 z-40 bg-black/25"
    />

    <aside
      data-aprendiz="atendimento-estorno-modal"
      className="fixed right-0 top-0 z-50 h-screen w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl"
    >
      {(() => {
        const guia = guias.find(
          (item) => item.chave === guiaEstornoAberta
        );

        if (!guia) {
          return null;
        }
           
        const valorPago =
          pagamentosGuias[guia.chave] || 0;

        const totalEstornado =
          estornosGuias[guia.chave] || 0;

        const valorDisponivelEstorno = Math.max(
          valorPago - totalEstornado,
          0
        );

        return (
          <>
            <div className="flex items-start justify-between border-b border-xango-border pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Registrar estorno
                </p>

                <h3 className="mt-1 text-xl font-semibold text-xango-text">
                  {guia.clinicaNome}
                </h3>
                {guia.unidadeClinicaNome && (
                  <p className="mt-1 text-xs font-semibold text-xango-primary">
                    Unidade: {guia.unidadeClinicaNome}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setGuiaEstornoAberta(null)}
                className="rounded-md border border-xango-border px-3 py-2 text-sm hover:bg-xango-background"
              >
                Fechar
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div className="rounded-md border border-red-200 bg-red-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                  Disponível para estorno
                </p>

                <p className="mt-2 text-2xl font-bold text-red-700">
                  {valorDisponivelEstorno.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              </div>

              <div data-aprendiz="atendimento-estorno-forma">
                <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Forma do estorno
                </label>

                <select
                  value={formaEstorno}
                  onChange={(event) =>
                    setFormaEstorno(event.target.value)
                  }
                  className="mt-2 w-full rounded-md border border-xango-border bg-white px-3 py-3 text-sm outline-none focus:border-xango-primary"
                >
                  <option value="">Selecione</option>
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="credito">Estorno no cartão</option>
                  <option value="transferencia">
                    Transferência
                  </option>
                </select>
              </div>

              <div data-aprendiz="atendimento-estorno-valor">
                <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Valor estornado
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorEstornadoInformado}
                  onChange={(event) =>
                    setValorEstornadoInformado(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-md border border-xango-border px-4 py-3 text-sm outline-none focus:border-xango-primary"
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Observação
                </label>

                <textarea
                  value={observacaoEstorno}
                  onChange={(event) =>
                    setObservacaoEstorno(event.target.value)
                  }
                  rows={3}
                  className="mt-2 w-full rounded-md border border-xango-border px-4 py-3 text-sm outline-none focus:border-xango-primary"
                  placeholder="Motivo ou observação sobre o estorno..."
                />
              </div>

              <button
                type="button"
                data-aprendiz="atendimento-estorno-confirmar"
                disabled={
                  !formaEstorno ||
                  !valorEstornadoInformado ||
                  Number(valorEstornadoInformado) <= 0 ||
                  Number(valorEstornadoInformado) >
                    valorDisponivelEstorno ||
                  processandoEstorno
                }
                onClick={async () => {
                  const guiaId =
                    guiaIds[guia.chave];

                  if (!guiaId) {
                    alert(
                      "Salve a guia antes de registrar o estorno."
                    );
                    return;
                  }

                  const sucesso =
                    await registrarEstornoImediato(
                      guia.chave,
                      guiaId,
                      Number(valorEstornadoInformado),
                      formaEstorno,
                      observacaoEstorno
                    );

                  if (!sucesso) {
                    return;
                  }

                  setGuiaEstornoAberta(null);
                  setFormaEstorno("");
                  setValorEstornadoInformado("");
                  setObservacaoEstorno("");
                }}
                className="w-full rounded-md bg-red-600 px-4 py-3 text-sm font-semibold text-white transition enabled:hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {processandoEstorno
                  ? "Registrando estorno..."
                  : "Confirmar estorno"}
              </button>
            </div>
          </>
        );
      })()}
    </aside>
  </>
)}

      {documentosFinanceirosAbertos && (
        <>
          <button
            type="button"
            aria-label="Fechar documentos financeiros"
            onClick={() =>
              setDocumentosFinanceirosAbertos(false)
            }
            className="fixed inset-0 z-40 bg-black/25"
          />

          <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-xango-border pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Documentos financeiros
                </p>

                <h3 className="mt-1 text-xl font-semibold text-xango-text">
                  {documentosFinanceiros?.atendimento.paciente.nome ||
                    pacienteSelecionado?.nome ||
                    "Atendimento"}
                </h3>

                {documentosFinanceiros?.atendimento
                  .codigoPublico && (
                  <p className="mt-1 text-xs text-xango-muted">
                    {
                      documentosFinanceiros.atendimento
                        .codigoPublico
                    }
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setDocumentosFinanceirosAbertos(false)
                }
                className="rounded-md border border-xango-border px-3 py-2 text-sm hover:bg-xango-background"
              >
                Fechar
              </button>
            </div>

            {carregandoDocumentos ? (
              <div className="py-10 text-center text-sm text-xango-muted">
                Carregando documentos...
              </div>
            ) : (
              <div className="mt-6 space-y-7">
                <section>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-xango-text">
                      Recibos
                    </h4>

                    <span className="text-xs text-xango-muted">
                      {documentosFinanceiros?.recibos.length || 0}
                    </span>
                  </div>

                  <div className="mt-3 space-y-3">
                    {!documentosFinanceiros ||
                    documentosFinanceiros.recibos.length ===
                      0 ? (
                      <div className="rounded-md border border-dashed border-xango-border p-4 text-sm text-xango-muted">
                        Nenhum recibo emitido neste atendimento.
                      </div>
                    ) : (
                      documentosFinanceiros.recibos.map(
                        (recibo) => {
                          const pagamento =
                            recibo.pagamentos[0];

                          const imprimivel =
                            recibo.status === "ATIVO";

                          return (
                            <div
                              key={recibo.id}
                              className="rounded-md border border-xango-border p-4"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-semibold text-xango-text">
                                    {recibo.codigoPublico}
                                  </p>

                                  <p className="mt-1 text-xs text-xango-muted">
                                    {recibo.clinica}
                                    {recibo.codigoVoucher
                                      ? ` • ${recibo.codigoVoucher}`
                                      : ""}
                                  </p>
                                </div>

                                <span
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                    recibo.status ===
                                    "ATIVO"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {recibo.status.replaceAll(
                                    "_",
                                    " "
                                  )}
                                </span>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-xango-border pt-3">
                                <div>
                                  <p className="text-sm font-bold text-xango-text">
                                    {Number(
                                      recibo.valorRecebido
                                    ).toLocaleString(
                                      "pt-BR",
                                      {
                                        style:
                                          "currency",
                                        currency:
                                          "BRL",
                                      }
                                    )}
                                  </p>

                                  {pagamento && (
                                    <p className="mt-1 text-xs text-xango-muted">
                                      {formaPagamentoLabel(
                                        pagamento.forma
                                      )}{" "}
                                      •{" "}
                                      {new Date(
                                        pagamento.criadoEm
                                      ).toLocaleString(
                                        "pt-BR"
                                      )}
                                    </p>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    window.open(
                                      `/impressao/recibo/${encodeURIComponent(
                                        recibo.codigoPublico
                                      )}`,
                                      "_blank",
                                      "noopener,noreferrer"
                                    )
                                  }
                                  className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                                    imprimivel
                                      ? "border-xango-primary text-xango-primary hover:bg-xango-background"
                                      : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  {imprimivel
                                    ? "Visualizar / imprimir"
                                    : "Conferir"}
                                </button>
                              </div>

                              {Number(
                                recibo.valorEstornado
                              ) > 0 && (
                                <p className="mt-3 text-xs font-medium text-red-600">
                                  Estornado:{" "}
                                  {Number(
                                    recibo.valorEstornado
                                  ).toLocaleString(
                                    "pt-BR",
                                    {
                                      style:
                                        "currency",
                                      currency: "BRL",
                                    }
                                  )}
                                </p>
                              )}
                            </div>
                          );
                        }
                      )
                    )}
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-xango-text">
                      Estornos
                    </h4>

                    <span className="text-xs text-xango-muted">
                      {documentosFinanceiros?.estornos.length ||
                        0}
                    </span>
                  </div>

                  <div className="mt-3 space-y-3">
                    {!documentosFinanceiros ||
                    documentosFinanceiros.estornos.length ===
                      0 ? (
                      <div className="rounded-md border border-dashed border-xango-border p-4 text-sm text-xango-muted">
                        Nenhum estorno registrado neste atendimento.
                      </div>
                    ) : (
                      documentosFinanceiros.estornos.map(
                        (estorno) => (
                          <div
                            key={estorno.id}
                            className="rounded-md border border-red-200 bg-red-50/40 p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-semibold text-red-700">
                                  {estorno.codigoPublico ||
                                    `Estorno #${estorno.id}`}
                                </p>

                                <p className="mt-1 text-xs text-xango-muted">
                                  {estorno.clinica}
                                  {estorno.codigoVoucher
                                    ? ` • ${estorno.codigoVoucher}`
                                    : ""}
                                </p>
                              </div>

                              <p className="font-bold text-red-700">
                                {Number(
                                  estorno.valor
                                ).toLocaleString(
                                  "pt-BR",
                                  {
                                    style: "currency",
                                    currency: "BRL",
                                  }
                                )}
                              </p>
                            </div>

                            <div className="mt-3 border-t border-red-100 pt-3 text-xs text-xango-muted">
                              <p>
                                {formaPagamentoLabel(
                                  estorno.forma
                                )}{" "}
                                •{" "}
                                {new Date(
                                  estorno.criadoEm
                                ).toLocaleString(
                                  "pt-BR"
                                )}
                              </p>

                              {estorno.reciboRelacionado && (
                                <p className="mt-1">
                                  Recibo relacionado:{" "}
                                  <strong>
                                    {
                                      estorno
                                        .reciboRelacionado
                                        .codigoPublico
                                    }
                                  </strong>
                                </p>
                              )}

                              {estorno.motivo && (
                                <p className="mt-1">
                                  Motivo: {estorno.motivo}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={!estorno.codigoPublico}
                              onClick={() => {
                                if (!estorno.codigoPublico) return;

                                window.open(
                                  `/impressao/estorno/${encodeURIComponent(
                                    estorno.codigoPublico
                                  )}`,
                                  "_blank",
                                  "noopener,noreferrer"
                                );
                              }}
                              className="mt-3 rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition enabled:hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Visualizar comprovante
                            </button>
                          </div>
                        )
                      )
                    )}
                  </div>
                </section>
              </div>
            )}
          </aside>
        </>
      )}

      {novoPacienteAberto && (
        <>
          <button
            type="button"
            aria-label="Fechar cadastro"
            onClick={() => setNovoPacienteAberto(false)}
            className="fixed inset-0 z-40 bg-black/25"
          />

          <aside
            data-aprendiz="atendimento-novo-paciente"
            className="fixed right-0 top-0 z-50 h-screen w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-xango-border pb-4">
              <div>
                <h3 className="text-xl font-semibold text-xango-text">
                  Novo paciente
                </h3>

                <p className="mt-1 text-sm text-xango-muted">
                  Cadastro rápido para continuar o atendimento.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setNovoPacienteAberto(false)}
                className="rounded-md border border-xango-border px-3 py-2 text-sm hover:bg-xango-background"
              >
                Fechar
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div data-aprendiz="atendimento-novo-paciente-nome">
                <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Nome completo
                </label>

                <input
                  type="text"
                  value={novoNome}
                  onChange={(event) =>
                    setNovoNome(event.target.value.toUpperCase())
                  }
                  className="mt-2 w-full rounded-md border border-xango-border px-4 py-3 text-sm outline-none focus:border-xango-primary"
                  placeholder="Nome do paciente"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div data-aprendiz="atendimento-novo-paciente-cpf">
                  <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                    CPF
                  </label>

                  <input
                    type="text"
                    value={formatarCpf(novoCpf)}
                    onChange={(event) =>
                      setNovoCpf(somenteNumeros(event.target.value))
                    }
                    inputMode="numeric"
                    maxLength={14}
                    className="mt-2 w-full rounded-md border border-xango-border px-4 py-3 text-sm outline-none focus:border-xango-primary"
                    placeholder="000.000.000-00"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                    Data de nascimento
                  </label>

                  <input
                    type="date"
                    value={novoNascimento}
                    onChange={(event) => setNovoNascimento(event.target.value)}
                    className="mt-2 w-full rounded-md border border-xango-border px-4 py-3 text-sm outline-none focus:border-xango-primary"
                  />
                </div>
              </div>

              <div data-aprendiz="atendimento-novo-paciente-telefone">
                <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Telefone / WhatsApp
                </label>

                <input
                  type="text"
                  value={formatarTelefone(novoTelefone)}
                  onChange={(event) =>
                    setNovoTelefone(somenteNumeros(event.target.value))
                  }
                  inputMode="numeric"
                  maxLength={15}
                  className="mt-2 w-full rounded-md border border-xango-border px-4 py-3 text-sm outline-none focus:border-xango-primary"
                  placeholder="(13) 99999-9999"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  E-mail
                </label>

                <input
                  type="email"
                  value={novoEmail}
                  onChange={(event) =>
                    setNovoEmail(event.target.value.toLowerCase())
                  }
                  className="mt-2 w-full rounded-md border border-xango-border px-4 py-3 text-sm outline-none focus:border-xango-primary"
                  placeholder="paciente@email.com"
                />
              </div>

              <div className="border-t border-xango-border pt-5">
                <button
                  type="button"
                  data-aprendiz="atendimento-novo-paciente-salvar"
                  onClick={salvarNovoPaciente}
                  className="w-full rounded-md bg-xango-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-xango-primary-hover"
                >
                  Salvar paciente e continuar
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}