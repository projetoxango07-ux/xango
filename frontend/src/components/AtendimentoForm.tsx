"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
};

type ClinicaApi = {
  id: number;
  nome: string;
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
};

type Procedimento = {
  id: number;
  nome: string;
  categoria: string;
  valor: number;
  repasse: number;
};

type Clinica = {
  id: number;
  nome: string;
  procedimentos: number[];
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

export default function AtendimentoForm({ atendimentoId }: AtendimentoFormProps) {
  const router = useRouter();

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
  const [procedimentosCancelados, setProcedimentosCancelados] = useState<
  Record<number, boolean>
  >({});
  const [novoPacienteAberto, setNovoPacienteAberto] = useState(false);
  const [guiasSalvas, setGuiasSalvas] = useState<Record<string, boolean>>({});
  const [guiasPagas, setGuiasPagas] = useState<Record<string, boolean>>({});
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
        }));

        const procedimentosAdaptados: Procedimento[] =
          procedimentosApi.map((procedimento) => {
            const primeiroPreco = procedimento.precos[0];

            return {
              id: procedimento.id,
              nome: procedimento.nome,
              categoria: procedimento.categoria || "Sem categoria",
              valor: primeiroPreco ? Number(primeiroPreco.valorPaciente) : 0,
              repasse: primeiroPreco ? Number(primeiroPreco.valorRepasse) : 0,
            };
          });

        const clinicasAdaptadas: Clinica[] = clinicasApi.map((clinica) => ({
          id: clinica.id,
          nome: clinica.nome,
          procedimentos: clinica.precos.map((preco) => preco.procedimentoId),
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
        };

        const procedimentosDoAtendimento: Procedimento[] = [];
        const novasClinicasSelecionadas: Record<number, number> = {};
        const novosTipos: Record<number, "horario" | "aguardando" | "ordem"> = {};
        const novasDatas: Record<number, string> = {};
        const novosHorarios: Record<number, string> = {};
        const novosCancelados: Record<number, boolean> = {};
        const novasGuiasSalvas: Record<string, boolean> = {};
        const novasGuiasPagas: Record<string, boolean> = {};
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
            tipo,
            data,
            tipo === "horario" ? horario : "",
          ].join("-");

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
                valor: Number(item.valorPaciente),
                repasse: Number(item.valorRepasse),
              });
            }

            novasClinicasSelecionadas[item.procedimento.id] = guia.clinicaId;
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

        setPacienteSelecionado(pacienteAdaptado);
        setBusca(pacienteAdaptado.nome);
        setProcedimentosSelecionados(procedimentosDoAtendimento);
        setClinicasSelecionadas(novasClinicasSelecionadas);
        setTiposAgendamento(novosTipos);
        setDatasAgendamento(novasDatas);
        setHorariosAgendamento(novosHorarios);
        setProcedimentosCancelados(novosCancelados);
        setGuiasSalvas(novasGuiasSalvas);
        setGuiasPagas(novasGuiasPagas);
        setDescontosGuias(novosDescontos);
        setPagamentosGuias(novosPagamentos);
        setEstornosGuias(novosEstornos);

        const etapaBanco = Math.max(1, Math.min(Number(dados.etapaAtual || 1), 5));
        setEtapaAtual(etapaBanco - 1);
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
  }, [atendimentoId, carregandoDados]);

  const pacientesFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();

    if (!termo) {
      return [];
    }
    
    return pacientes.filter((paciente) => {
      return (
        paciente.nome.toLowerCase().includes(termo) ||
        paciente.cpf.includes(termo) ||
        paciente.telefone.includes(termo)
      );
    });
  }, [busca, pacientes]);
  const procedimentosFiltrados = useMemo(() => {
  const termo = buscaProcedimento.toLowerCase().trim();

  if (!termo) {
    return procedimentos;
  }

  return procedimentos.filter((procedimento) =>
    procedimento.nome.toLowerCase().includes(termo)
  );
}, [buscaProcedimento, procedimentos]);

const guias = useMemo(() => {
  const grupos: Record<
    string,
    {
      chave: string;
      clinicaId: number;
      clinicaNome: string;
      tipoAgendamento: "horario" | "aguardando" | "ordem";
      data: string;
      horario: string;
      procedimentos: Procedimento[];
    }
  > = {};

  procedimentosSelecionados.forEach((procedimento) => {
    const id = procedimento.id;
    const clinicaId = clinicasSelecionadas[id];
    const tipo = tiposAgendamento[id];

    if (!clinicaId || !tipo) {
      return;
    }

    const clinica = clinicas.find((item) => item.id === clinicaId);

    if (!clinica) {
      return;
    }

    const data = datasAgendamento[id] || "";
    const horario = horariosAgendamento[id] || "";

    const chave = [
      clinicaId,
      tipo,
      data,
      tipo === "horario" ? horario : "",
    ].join("-");

    if (!grupos[chave]) {
      grupos[chave] = {
        chave,
        clinicaId,
        clinicaNome: clinica.nome,
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
  tiposAgendamento,
  datasAgendamento,
  horariosAgendamento,
  clinicas,
]);


  async function salvarAtendimentoParaDepois() {
    if (atendimentoId) {
      alert(
        "O atendimento existente foi carregado. Na próxima etapa vamos ligar a atualização ao banco sem criar um atendimento duplicado."
      );
      return;
    }

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

        const guiaQuitada =
          !!guiasSalvas[guia.chave] &&
          saldoPendente === 0 &&
          !possuiEstornoPendente;

        let status = "RASCUNHO";

        if (guiasSalvas[guia.chave]) {
          status = "AGUARDANDO_PAGAMENTO";
        }

        if (valorPagoLiquido > 0 && !guiaQuitada) {
          status = "PARCIALMENTE_PAGA";
        }

        if (guiaQuitada) {
          status = "PAGA";
        }

        if (possuiEstornoPendente) {
          status = "ESTORNO_PENDENTE";
        }

        return {
          clinicaId: guia.clinicaId,
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

      const resposta = await fetch("http://localhost:3333/atendimentos", {
        method: "POST",
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

      localStorage.removeItem("digna-conect-atendimento-rascunho");

      alert(`Atendimento #${dados.id} salvo com sucesso.`);
      router.push("/atendimentos");
    } catch (erro) {
      console.error("Erro ao salvar atendimento:", erro);
      alert(
        "Não foi possível conectar ao servidor para salvar o atendimento."
      );
    }
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

  return (
    <div className="mx-auto max-w-5xl">
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
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-700">
              {erroDados}
            </p>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-lg border border-xango-border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-5 gap-2">
          {etapas.map((etapa, index) => (
            <div
              key={etapa}
              className={`rounded-md border px-3 py-3 text-center text-xs font-medium ${
                index === etapaAtual
                  ? "border-xango-primary bg-xango-primary text-white"
                  : index < etapaAtual
                    ? "border-xango-primary/30 bg-teal-50 text-xango-primary"
                    : "border-xango-border bg-xango-background text-xango-muted"
              }`}
            >
              <div className="mb-1 text-sm font-bold">{index + 1}</div>
              {etapa}
            </div>
          ))}
        </div>
      </div>

      {etapaAtual === 0 && (
      <section className="rounded-lg border border-xango-border bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-xango-text">
            Paciente
          </h3>

          <p className="mt-1 text-sm text-xango-muted">
            Localize um paciente existente ou cadastre um novo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
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
                    onClick={() => setPacienteSelecionado(paciente)}
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
                        CPF: {paciente.cpf}
                      </p>
                    </div>

                    <p className="text-xs text-xango-muted">
                      {paciente.telefone}
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
          <div className="mt-5 rounded-md border border-xango-primary/30 bg-xango-background p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
              Paciente selecionado
            </p>

            <p className="mt-2 font-semibold text-xango-text">
              {pacienteSelecionado.nome}
            </p>

            <p className="mt-1 text-sm text-xango-muted">
              {pacienteSelecionado.cpf} • {pacienteSelecionado.telefone}
            </p>

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
  <section className="rounded-lg border border-xango-border bg-white p-6 shadow-sm">
    <div className="mb-5">
      <h3 className="text-lg font-semibold text-xango-text">
        Procedimento
      </h3>

      <p className="mt-1 text-sm text-xango-muted">
        Selecione a consulta ou exame solicitado pelo paciente.
      </p>
    </div>

    <input
      type="text"
      value={buscaProcedimento}
      onChange={(event) => setBuscaProcedimento(event.target.value)}
      placeholder="Pesquisar procedimento..."
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

    <div className="mt-5 flex items-center justify-between rounded-md border border-xango-border bg-xango-background px-4 py-3">
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
  <section className="rounded-lg border border-xango-border bg-white p-6 shadow-sm">
    <div className="mb-5">
      <h3 className="text-lg font-semibold text-xango-text">
        Clínica e agendamento
      </h3>

      <p className="mt-1 text-sm text-xango-muted">
        Escolha a clínica para cada procedimento selecionado.
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
              <div className="grid gap-2 md:grid-cols-2">
                {clinicasDisponiveis.map((clinica) => {
                  const selecionada =
                    clinicasSelecionadas[procedimento.id] === clinica.id;

                  return (
                    <button
                      key={clinica.id}
                      type="button"
                      onClick={() =>
                        setClinicasSelecionadas((atuais) => ({
                          ...atuais,
                          [procedimento.id]: clinica.id,
                        }))
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
            {clinicasSelecionadas[procedimento.id] && (
              <div className="mt-5 border-t border-xango-border pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Agendamento
                </p>

                <div className="grid gap-2 md:grid-cols-3">
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
                    <div>
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

                    <div>
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
                  <div className="mt-4 max-w-sm">
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
                        onClick={() => setEtapaAtual(3)}
                        disabled={
                        procedimentosSelecionados.length === 0 ||
                        procedimentosSelecionados.some((procedimento) => {
                          const id = procedimento.id;
                          const clinica = clinicasSelecionadas[id];
                          const tipo = tiposAgendamento[id];

                          if (!clinica || !tipo) {
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
  <section className="rounded-lg border border-xango-border bg-white p-6 shadow-sm">
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

        const guiaQuitada =
          !!guiasSalvas[guia.chave] &&
          saldoPendente === 0 &&
          !possuiEstornoPendente;
        
        const statusGuia =
          !guiasSalvas[guia.chave]
            ? "Não salva"
            : possuiEstornoPendente
              ? "Estorno pendente"
              : guiaQuitada
                ? "Paga"
                : valorPagoLiquido > 0
                  ? "Parcialmente paga"
                  : "Aguardando pagamento";

        return (
          <div
            key={guia.chave}
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
                  disabled={
                    guiasSalvas[guia.chave] ||
                    beneficioExcedeLimite
                  }
                  onClick={() =>
                    setGuiasSalvas((atuais) => ({
                      ...atuais,
                      [guia.chave]: true,
                    }))
                  }
                  className="rounded-md bg-xango-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-xango-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Salvar guia
                </button>

                <button
                  type="button"
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

                <button
                  type="button"
                  disabled={!guiaQuitada}
                  className="rounded-md border border-xango-border px-4 py-2 text-xs font-semibold text-xango-text transition enabled:hover:bg-xango-background disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Imprimir guia
                </button>
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
          onClick={salvarAtendimentoParaDepois}
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

{guiaPagamentoAberta && (
  <>
    <button
      type="button"
      aria-label="Fechar pagamento"
      onClick={() => setGuiaPagamentoAberta(null)}
      className="fixed inset-0 z-40 bg-black/25"
    />

    <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
      {(() => {
        const guia = guias.find(
          (item) => item.chave === guiaPagamentoAberta
        );

        if (!guia) {
          return null;
        }

        const subtotal = guia.procedimentos.reduce(
          (total, procedimento) => total + procedimento.valor,
          0
        );

        const desconto = descontosGuias[guia.chave] || 0;
        const valorFinal = Math.max(subtotal - desconto, 0);
        const jaPago = pagamentosGuias[guia.chave] || 0;
        const saldo = Math.max(valorFinal - jaPago, 0);


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
                    {jaPago.toLocaleString("pt-BR", {
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

              <div>
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

              <div>
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
                disabled={
                  !formaPagamento ||
                  !valorRecebido ||
                  Number(valorRecebido) <= 0 ||
                  Number(valorRecebido) > saldo
                }
                onClick={() => {
                  const recebido = Number(valorRecebido);
                  const novoTotalPago = jaPago + recebido;

                  setPagamentosGuias((atuais) => ({
                    ...atuais,
                    [guia.chave]: novoTotalPago,
                  }));

                  if (novoTotalPago >= valorFinal) {
                    setGuiasPagas((atuais) => ({
                      ...atuais,
                      [guia.chave]: true,
                    }));
                  }

                  setGuiaPagamentoAberta(null);
                  setFormaPagamento("");
                  setValorRecebido("");
                }}
                className="w-full rounded-md bg-xango-primary px-4 py-3 text-sm font-semibold text-white transition enabled:hover:bg-xango-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirmar pagamento
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

    <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
      {(() => {
        const guia = guias.find(
          (item) => item.chave === guiaEstornoAberta
        );

        if (!guia) {
          return null;
        }

        const subtotal = guia.procedimentos
          .filter(
            (procedimento) =>
              !procedimentosCancelados[procedimento.id]
          )
          .reduce(
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

        const descontoManual =
          pacienteSelecionado?.beneficioAtivo
            ? 0
            : descontosGuias[guia.chave] || 0;

        const valorFinal = Math.max(
          subtotal - valorBeneficio - descontoManual,
          0
        );

        const valorPago =
          pagamentosGuias[guia.chave] || 0;

        const totalEstornado =
          estornosGuias[guia.chave] || 0;

        const valorNecessario = Math.max(
          valorPago - valorFinal - totalEstornado,
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
                  Valor a estornar
                </p>

                <p className="mt-2 text-2xl font-bold text-red-700">
                  {valorNecessario.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              </div>

              <div>
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

              <div>
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
                disabled={
                  !formaEstorno ||
                  !valorEstornadoInformado ||
                  Number(valorEstornadoInformado) <= 0 ||
                  Number(valorEstornadoInformado) >
                    valorNecessario
                }
                onClick={() => {
                  const valor =
                    Number(valorEstornadoInformado);

                  setEstornosGuias((atuais) => ({
                    ...atuais,
                    [guia.chave]:
                      (atuais[guia.chave] || 0) + valor,
                  }));

                  setGuiaEstornoAberta(null);
                  setFormaEstorno("");
                  setValorEstornadoInformado("");
                  setObservacaoEstorno("");
                }}
                className="w-full rounded-md bg-red-600 px-4 py-3 text-sm font-semibold text-white transition enabled:hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirmar estorno
              </button>
            </div>
          </>
        );
      })()}
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

          <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl">
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
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Nome completo
                </label>

                <input
                  type="text"
                  value={novoNome}
                  onChange={(event) => setNovoNome(event.target.value)}
                  className="mt-2 w-full rounded-md border border-xango-border px-4 py-3 text-sm outline-none focus:border-xango-primary"
                  placeholder="Nome do paciente"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                    CPF
                  </label>

                  <input
                    type="text"
                    value={novoCpf}
                    onChange={(event) => setNovoCpf(event.target.value)}
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

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Telefone / WhatsApp
                </label>

                <input
                  type="text"
                  value={novoTelefone}
                  onChange={(event) => setNovoTelefone(event.target.value)}
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
                  onChange={(event) => setNovoEmail(event.target.value)}
                  className="mt-2 w-full rounded-md border border-xango-border px-4 py-3 text-sm outline-none focus:border-xango-primary"
                  placeholder="paciente@email.com"
                />
              </div>

              <div className="border-t border-xango-border pt-5">
                <button
                  type="button"
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