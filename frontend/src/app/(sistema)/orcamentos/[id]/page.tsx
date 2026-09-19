"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Copy,
  Clipboard,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  Share2,
  RefreshCw,
  AlertTriangle,
  UserRound,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type Orcamento = {
  id: number;
  codigoPublico: string | null;
  pacienteId: number | null;
  nomePaciente: string;
  telefonePaciente: string;
  status: "ABERTO" | "PARCIALMENTE_CONVERTIDO" | "ENCERRADO" | "VENCIDO";
  statusBanco: "ABERTO" | "PARCIALMENTE_CONVERTIDO" | "ENCERRADO";
  vencido: boolean;
  validadeDias: number;
  validadeAte: string | null;
  condicoesPagamento: string | null;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
  criadoPor: {
    id: number;
    nome: string;
  } | null;
  organizacao: {
    id: number;
    nomeFantasia: string;
    razaoSocial: string | null;
    documento: string | null;
    telefone: string | null;
    email: string | null;
    endereco: string | null;
  } | null;
  historico: Array<{
    id: number;
    acao: string;
    descricao: string | null;
    criadoEm: string;
    usuario: { id: number; nome: string } | null;
  }>;
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
    convertidoEm: string | null;
    itemGuiaId: number | null;
    guiaId: number | null;
    atendimentoId: number | null;
    codigoVoucher: string | null;
  }>;
};

function somenteNumeros(valor: string) {
  return String(valor || "").replace(/\D/g, "");
}

function formatarTelefone(valor: string) {
  const numeros = somenteNumeros(valor);

  if (numeros.length === 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(
      7
    )}`;
  }

  if (numeros.length === 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(
      6
    )}`;
  }

  return valor || "Não informado";
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(data: string | null) {
  if (!data) return "—";

  return new Date(data).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: Orcamento["status"]) {
  if (status === "PARCIALMENTE_CONVERTIDO") return "Parcialmente convertido";
  if (status === "ENCERRADO") return "Encerrado";
  if (status === "VENCIDO") return "Vencido";
  return "Em aberto";
}

function statusClasse(status: Orcamento["status"]) {
  if (status === "PARCIALMENTE_CONVERTIDO") {
    return "bg-blue-100 text-blue-800";
  }
  if (status === "ENCERRADO") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "VENCIDO") {
    return "bg-red-100 text-red-700";
  }
  return "bg-amber-100 text-amber-800";
}

function formatarDataCurta(data: string | null) {
  if (!data) return "—";
  return new Date(data).toLocaleDateString("pt-BR");
}


type LinhaPdf = {
  texto: string;
  tamanho?: number;
  negrito?: boolean;
};

function limparTextoPdf(valor: string) {
  return String(valor || "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/•/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x00-\xFF]/g, "?");
}

function textoParaHexPdf(valor: string) {
  const texto = limparTextoPdf(valor);
  let hex = "";

  for (let indice = 0; indice < texto.length; indice += 1) {
    hex += texto.charCodeAt(indice).toString(16).padStart(2, "0");
  }

  return hex.toUpperCase();
}

function quebrarLinhaPdf(texto: string, limite = 78) {
  const valor = String(texto || "").trim();

  if (!valor) return [""];

  const palavras = valor.split(/\s+/);
  const linhas: string[] = [];
  let atual = "";

  for (const palavra of palavras) {
    const candidata = atual ? `${atual} ${palavra}` : palavra;

    if (candidata.length <= limite) {
      atual = candidata;
      continue;
    }

    if (atual) {
      linhas.push(atual);
    }

    if (palavra.length <= limite) {
      atual = palavra;
      continue;
    }

    let restante = palavra;

    while (restante.length > limite) {
      linhas.push(restante.slice(0, limite));
      restante = restante.slice(limite);
    }

    atual = restante;
  }

  if (atual) {
    linhas.push(atual);
  }

  return linhas;
}

function montarArquivoPdfOrcamento(
  orcamento: Orcamento,
  total: number
) {
  const linhas: LinhaPdf[] = [];
  const adicionar = (
    texto: string,
    opcoes: Omit<LinhaPdf, "texto"> = {}
  ) => {
    const partes = quebrarLinhaPdf(
      texto,
      opcoes.tamanho && opcoes.tamanho >= 14 ? 62 : 78
    );

    partes.forEach((parte) =>
      linhas.push({
        texto: parte,
        ...opcoes,
      })
    );
  };

  adicionar("DIGNA SAÚDE", { tamanho: 18, negrito: true });
  adicionar(
    `ORÇAMENTO ${orcamento.codigoPublico || `#${orcamento.id}`}`,
    { tamanho: 14, negrito: true }
  );
  adicionar("");
  adicionar(`Paciente: ${orcamento.nomePaciente}`, {
    tamanho: 11,
    negrito: true,
  });
  adicionar(`Criado em: ${formatarData(orcamento.criadoEm)}`, {
    tamanho: 10,
  });
  adicionar(`Situação: ${statusLabel(orcamento.status)}`, {
    tamanho: 10,
  });
  adicionar(`Validade: ${formatarDataCurta(orcamento.validadeAte)} (${orcamento.validadeDias} dias)`, {
    tamanho: 10,
  });
  adicionar("");
  adicionar("PROCEDIMENTOS", { tamanho: 12, negrito: true });
  adicionar("");

  orcamento.itens.forEach((item, indice) => {
    adicionar(`${indice + 1}. ${item.procedimentoNome}`, {
      tamanho: 10,
      negrito: true,
    });

    const local = [item.clinicaNome, item.unidadeClinicaNome]
      .filter(Boolean)
      .join(" - ");

    if (local) {
      adicionar(local, { tamanho: 9 });
    }

    adicionar(`Valor: ${moeda(item.valorPaciente)}`, {
      tamanho: 10,
      negrito: true,
    });
    adicionar("");
  });

  adicionar(`TOTAL: ${moeda(total)}`, {
    tamanho: 13,
    negrito: true,
  });

  if (orcamento.condicoesPagamento) {
    adicionar("");
    adicionar("CONDIÇÕES DE PAGAMENTO", { tamanho: 11, negrito: true });
    adicionar(orcamento.condicoesPagamento, { tamanho: 9 });
  }

  if (orcamento.observacoes) {
    adicionar("");
    adicionar("OBSERVAÇÕES", { tamanho: 11, negrito: true });
    adicionar(orcamento.observacoes, { tamanho: 9 });
  }

  adicionar("");
  const contato = [
    orcamento.organizacao?.telefone
      ? formatarTelefone(orcamento.organizacao.telefone)
      : null,
    orcamento.organizacao?.email,
    orcamento.organizacao?.endereco,
  ].filter(Boolean).join(" | ");
  adicionar(
    `${orcamento.organizacao?.nomeFantasia || "Digna Saúde"}${contato ? ` - ${contato}` : ""}`,
    { tamanho: 8, negrito: true }
  );
  adicionar(
    `Orçamento válido até ${formatarDataCurta(orcamento.validadeAte)}. Valores correspondem à cotação registrada e devem ser confirmados após o vencimento.`,
    { tamanho: 8 }
  );

  const paginas: LinhaPdf[][] = [];
  let paginaAtual: LinhaPdf[] = [];
  let alturaConsumida = 0;
  const alturaDisponivel = 680;

  for (const linha of linhas) {
    const tamanho = linha.tamanho || 10;
    const alturaLinha = Math.max(tamanho + 5, 14);

    if (
      paginaAtual.length > 0 &&
      alturaConsumida + alturaLinha > alturaDisponivel
    ) {
      paginas.push(paginaAtual);
      paginaAtual = [];
      alturaConsumida = 0;
    }

    paginaAtual.push(linha);
    alturaConsumida += alturaLinha;
  }

  if (paginaAtual.length > 0) {
    paginas.push(paginaAtual);
  }

  const objetos = new Map<number, string>();
  const paginaIds: number[] = [];

  objetos.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objetos.set(
    3,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  );
  objetos.set(
    4,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
  );

  paginas.forEach((pagina, indicePagina) => {
    const paginaId = 5 + indicePagina * 2;
    const conteudoId = paginaId + 1;
    paginaIds.push(paginaId);

    let y = 795;
    let conteudo = "";

    pagina.forEach((linha) => {
      const tamanho = linha.tamanho || 10;
      const fonte = linha.negrito ? "F2" : "F1";

      if (linha.texto) {
        conteudo += `BT /${fonte} ${tamanho} Tf 45 ${y} Td <${textoParaHexPdf(
          linha.texto
        )}> Tj ET\n`;
      }

      y -= Math.max(tamanho + 5, 14);
    });

    const rodape = `Página ${indicePagina + 1} de ${paginas.length}`;
    conteudo += `BT /F1 8 Tf 45 35 Td <${textoParaHexPdf(
      rodape
    )}> Tj ET\n`;

    objetos.set(
      paginaId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${conteudoId} 0 R >>`
    );
    objetos.set(
      conteudoId,
      `<< /Length ${conteudo.length} >>\nstream\n${conteudo}endstream`
    );
  });

  objetos.set(
    2,
    `<< /Type /Pages /Kids [${paginaIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${paginaIds.length} >>`
  );

  const totalObjetos = 4 + paginas.length * 2;
  let pdf = "%PDF-1.4\n% Digna Conect\n";
  const offsets: number[] = new Array(totalObjetos + 1).fill(0);

  for (let id = 1; id <= totalObjetos; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objetos.get(id) || "<<>>"}\nendobj\n`;
  }

  const inicioXref = pdf.length;
  pdf += `xref\n0 ${totalObjetos + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let id = 1; id <= totalObjetos; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${
    totalObjetos + 1
  } /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`;

  const numeroOrcamento = (
    orcamento.codigoPublico || String(orcamento.id)
  )
    .replace(/[^a-zA-Z0-9_-]/g, "-");

  const nomeBase = `orcamento-${numeroOrcamento}`;

  return new File(
    [pdf],
    `${nomeBase}.pdf`,
    { type: "application/pdf" }
  );
}

function baixarArquivo(arquivo: File) {
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = arquivo.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

export default function OrcamentoPage() {
  const params = useParams();
  const router = useRouter();

  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const orcamentoId = Number(idParam);

  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [convertendo, setConvertendo] = useState(false);
  const [erroConversao, setErroConversao] = useState("");
  const [avisoCompartilhamento, setAvisoCompartilhamento] = useState("");
  const [menuWhatsappAberto, setMenuWhatsappAberto] = useState(false);

  async function carregarOrcamento() {
    if (!Number.isInteger(orcamentoId) || orcamentoId <= 0) {
      setErro("Orçamento inválido.");
      setCarregando(false);
      return;
    }

    try {
      setCarregando(true);
      setErro("");

      const resposta = await fetch(`${API_URL}/orcamentos/${orcamentoId}`, {
        cache: "no-store",
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro || "Não foi possível carregar o orçamento."
        );
      }

      setOrcamento(resultado);
      setSelecionados((atuais) =>
        atuais.filter((id) =>
          resultado.itens.some(
            (item: Orcamento["itens"][number]) =>
              item.id === id && !item.convertido
          )
        )
      );
    } catch (erro) {
      console.error("Erro ao carregar orçamento:", erro);
      setErro(
        erro instanceof Error
          ? erro.message
          : "Não foi possível carregar o orçamento."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void carregarOrcamento();
    }, 0);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentoId]);

  const resumo = useMemo(() => {
    if (!orcamento) {
      return {
        total: 0,
        quantidade: 0,
        convertidos: 0,
        disponiveis: 0,
      };
    }

    const convertidos = orcamento.itens.filter(
      (item) => item.convertido
    ).length;

    return {
      total: orcamento.itens.reduce(
        (total, item) => total + Number(item.valorPaciente || 0),
        0
      ),
      quantidade: orcamento.itens.length,
      convertidos,
      disponiveis: orcamento.itens.length - convertidos,
    };
  }, [orcamento]);

  const idsDisponiveis = useMemo(
    () =>
      orcamento?.itens
        .filter((item) => !item.convertido)
        .map((item) => item.id) || [],
    [orcamento]
  );

  const todosDisponiveisSelecionados =
    idsDisponiveis.length > 0 &&
    idsDisponiveis.every((id) => selecionados.includes(id));

  function alternarItem(itemId: number) {
    setErroConversao("");
    setSelecionados((atuais) =>
      atuais.includes(itemId)
        ? atuais.filter((id) => id !== itemId)
        : [...atuais, itemId]
    );
  }

  function alternarTodosDisponiveis() {
    setErroConversao("");

    if (todosDisponiveisSelecionados) {
      setSelecionados([]);
    } else {
      setSelecionados(idsDisponiveis);
    }
  }

  function montarTextoCompartilhamento() {
    if (!orcamento) return "";

    const linhas = orcamento.itens.map((item) => {
      const local = [item.clinicaNome, item.unidadeClinicaNome]
        .filter(Boolean)
        .join(" • ");

      return `• ${item.procedimentoNome}${
        local ? ` — ${local}` : ""
      }: ${moeda(item.valorPaciente)}`;
    });

    const contatoDigna = [
      orcamento.organizacao?.telefone
        ? formatarTelefone(orcamento.organizacao.telefone)
        : null,
      orcamento.organizacao?.email,
    ].filter(Boolean).join(" • ");

    return [
      `ORÇAMENTO ${
        orcamento.codigoPublico || `#${orcamento.id}`
      } — DIGNA SAÚDE`,
      `Paciente: ${orcamento.nomePaciente}`,
      `Válido até: ${formatarDataCurta(orcamento.validadeAte)}`,
      "",
      ...linhas,
      "",
      `TOTAL: ${moeda(resumo.total)}`,
      orcamento.condicoesPagamento
        ? `Condições de pagamento: ${orcamento.condicoesPagamento}`
        : "",
      orcamento.observacoes
        ? `Observações: ${orcamento.observacoes}`
        : "",
      contatoDigna ? `Contato Digna Saúde: ${contatoDigna}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function copiarTexto(texto: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return;
    }

    const area = document.createElement("textarea");
    area.value = texto;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
  }

  async function compartilharOrcamento() {
    if (!orcamento) return;

    const texto = montarTextoCompartilhamento();

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Orçamento ${
            orcamento.codigoPublico || orcamento.id
          }`,
          text: texto,
        });
        setAvisoCompartilhamento(
          "Orçamento enviado para compartilhamento."
        );
      } else {
        await copiarTexto(texto);
        setAvisoCompartilhamento(
          "Resumo do orçamento copiado. Agora é só colar no WhatsApp, e-mail ou outro aplicativo."
        );
      }
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === "AbortError") {
        return;
      }

      try {
        await copiarTexto(texto);
        setAvisoCompartilhamento(
          "Resumo do orçamento copiado para a área de transferência."
        );
      } catch {
        setAvisoCompartilhamento(
          "Não foi possível compartilhar automaticamente. Use a opção Imprimir / PDF."
        );
      }
    }
  }

  async function copiarMensagemWhatsapp() {
    if (!orcamento) return;

    try {
      await copiarTexto(montarTextoCompartilhamento());
      setMenuWhatsappAberto(false);
      setAvisoCompartilhamento(
        "Mensagem do orçamento copiada. Abra a conversa no WhatsApp e cole com Ctrl+V."
      );
    } catch {
      setAvisoCompartilhamento(
        "Não foi possível copiar a mensagem automaticamente."
      );
    }
  }

  function abrirConversaWhatsapp() {
    if (!orcamento) return;

    const telefoneLocal = somenteNumeros(orcamento.telefonePaciente);

    if (telefoneLocal.length !== 10 && telefoneLocal.length !== 11) {
      setMenuWhatsappAberto(false);
      setAvisoCompartilhamento(
        "O telefone deste orçamento não é válido para abrir uma conversa no WhatsApp."
      );
      return;
    }

    const telefoneWhatsapp = `55${telefoneLocal}`;
    const texto = encodeURIComponent(montarTextoCompartilhamento());
    const url = `https://web.whatsapp.com/send?phone=${telefoneWhatsapp}&text=${texto}`;

    const janela = window.open(url, "digna-whatsapp");

    if (janela) {
      janela.focus();
      setAvisoCompartilhamento(
        "Conversa aberta no WhatsApp. Nas próximas vezes, o Digna Conect tentará reutilizar essa mesma aba."
      );
    } else {
      setAvisoCompartilhamento(
        "O navegador bloqueou a abertura do WhatsApp. Libere pop-ups para o Digna Conect ou use Copiar mensagem."
      );
    }

    setMenuWhatsappAberto(false);
  }


  async function compartilharPdfWhatsapp() {
    if (!orcamento) return;

    setMenuWhatsappAberto(false);

    try {
      const arquivo = montarArquivoPdfOrcamento(
        orcamento,
        resumo.total
      );

      const navegador = navigator as Navigator & {
        canShare?: (dados: { files?: File[] }) => boolean;
        share?: (dados: {
          title?: string;
          text?: string;
          files?: File[];
        }) => Promise<void>;
      };

      const podeCompartilharArquivo =
        typeof navegador.share === "function" &&
        typeof navegador.canShare === "function" &&
        navegador.canShare({
          files: [arquivo],
        });

      if (podeCompartilharArquivo && navegador.share) {
        await navegador.share({
          title: `Orçamento ${
            orcamento.codigoPublico || orcamento.id
          }`,
          text: `Segue o orçamento da Digna Saúde para ${orcamento.nomePaciente}.`,
          files: [arquivo],
        });

        setAvisoCompartilhamento(
          "PDF enviado para o menu de compartilhamento. Selecione o WhatsApp para enviar o documento."
        );
        return;
      }

      baixarArquivo(arquivo);
      setAvisoCompartilhamento(
        "Neste navegador o PDF não pode ser anexado automaticamente ao WhatsApp. O arquivo foi baixado; use a conversa que já está aberta e anexe o PDF."
      );
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === "AbortError") {
        return;
      }

      try {
        const arquivo = montarArquivoPdfOrcamento(
          orcamento,
          resumo.total
        );
        baixarArquivo(arquivo);
        setAvisoCompartilhamento(
          "Não foi possível abrir o compartilhamento de arquivos. O PDF foi baixado para você anexar no WhatsApp."
        );
      } catch {
        setAvisoCompartilhamento(
          "Não foi possível gerar o PDF deste orçamento."
        );
      }
    }
  }

  async function converterSelecionados() {
    if (!orcamento) return;

    setErroConversao("");

    if (orcamento.vencido) {
      setErroConversao(
        "Este orçamento está vencido. Renove a validade ou duplique-o antes de converter."
      );
      return;
    }

    if (!orcamento.pacienteId) {
      setErroConversao(
        "Antes de converter, vincule este orçamento a um paciente cadastrado."
      );
      return;
    }

    if (selecionados.length === 0) {
      setErroConversao("Selecione ao menos um procedimento para converter.");
      return;
    }

    try {
      setConvertendo(true);

      const resposta = await fetch(
        `${API_URL}/orcamentos/${orcamento.id}/converter`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            itemIds: selecionados,
          }),
        }
      );

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro || "Não foi possível converter o orçamento."
        );
      }

      router.push(`/atendimentos/${resultado.atendimentoId}`);
      router.refresh();
    } catch (erro) {
      console.error("Erro ao converter orçamento:", erro);
      setErroConversao(
        erro instanceof Error
          ? erro.message
          : "Não foi possível converter o orçamento."
      );
    } finally {
      setConvertendo(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-80 items-center justify-center text-xango-muted">
        <Loader2 size={22} className="mr-2 animate-spin" />
        Carregando orçamento...
      </div>
    );
  }

  if (erro || !orcamento) {
    return (
      <div className="mx-auto max-w-375">
        <button
          type="button"
          onClick={() => router.push("/orcamentos")}
          className="mb-5 flex items-center gap-2 text-sm font-semibold text-xango-primary"
        >
          <ArrowLeft size={16} />
          Voltar para orçamentos
        </button>

        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
          {erro || "Orçamento não encontrado."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-375 pb-12">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.push("/orcamentos")}
            className="mt-0.5 rounded-md border border-xango-border bg-white p-2 text-xango-primary transition hover:bg-xango-background"
            aria-label="Voltar para orçamentos"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-xango-text">
                {orcamento.codigoPublico || `Orçamento #${orcamento.id}`}
              </h2>

              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasse(
                  orcamento.status
                )}`}
              >
                {statusLabel(orcamento.status)}
              </span>
            </div>

            <p className="mt-1 text-sm text-xango-muted">
              Criado em {formatarData(orcamento.criadoEm)}
              {orcamento.criadoPor?.nome
                ? ` por ${orcamento.criadoPor.nome}`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
          type="button"
          onClick={() => window.open(`/impressao/orcamento/${orcamento.id}`, "_blank", "noopener,noreferrer")}
          className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary hover:bg-xango-background"
        >
          <Printer size={14} />
          Imprimir / PDF
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuWhatsappAberto((aberto) => !aberto)}
            className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary hover:bg-xango-background"
          >
            <MessageCircle size={14} />
            WhatsApp
          </button>

          {menuWhatsappAberto && (
            <>
              <button
                type="button"
                aria-label="Fechar menu do WhatsApp"
                onClick={() => setMenuWhatsappAberto(false)}
                className="fixed inset-0 z-30 cursor-default"
              />

              <div className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-lg border border-xango-border bg-white shadow-xl">
                <button
                  type="button"
                  onClick={() => void copiarMensagemWhatsapp()}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-xango-background"
                >
                  <Clipboard
                    size={17}
                    className="mt-0.5 shrink-0 text-xango-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-xango-text">
                      Copiar mensagem
                    </span>
                    <span className="mt-0.5 block text-xs leading-4 text-xango-muted">
                      Ideal quando o WhatsApp já está aberto. Depois, basta colar com Ctrl+V.
                    </span>
                  </span>
                </button>

                <div className="border-t border-xango-border" />

                <button
                  type="button"
                  onClick={abrirConversaWhatsapp}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-xango-background"
                >
                  <ExternalLink
                    size={17}
                    className="mt-0.5 shrink-0 text-xango-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-xango-text">
                      Abrir conversa do paciente
                    </span>
                    <span className="mt-0.5 block text-xs leading-4 text-xango-muted">
                      Abre {formatarTelefone(orcamento.telefonePaciente)} e reutiliza a aba do WhatsApp criada pelo Digna Conect.
                    </span>
                  </span>
                </button>

                <div className="border-t border-xango-border" />

                <button
                  type="button"
                  onClick={() => void compartilharPdfWhatsapp()}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-xango-background"
                >
                  <FileText
                    size={17}
                    className="mt-0.5 shrink-0 text-xango-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-xango-text">
                      Compartilhar PDF
                    </span>
                    <span className="mt-0.5 block text-xs leading-4 text-xango-muted">
                      No celular, permite escolher o WhatsApp e enviar o orçamento como documento. No computador, baixa o PDF quando o navegador não permite anexar automaticamente.
                    </span>
                  </span>
                </button>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => void compartilharOrcamento()}
          className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary hover:bg-xango-background"
        >
          <Share2 size={14} />
          Compartilhar
        </button>

        <button
            type="button"
            onClick={() => void carregarOrcamento()}
            className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary hover:bg-xango-background"
          >
            <RefreshCw size={14} />
            Atualizar
          </button>

          {orcamento.statusBanco === "ABERTO" && (
            <button
              type="button"
              onClick={() =>
                router.push(`/orcamentos/${orcamento.id}/editar`)
              }
              className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary hover:bg-xango-background"
            >
              <Pencil size={14} />
              Editar
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              router.push(`/orcamentos/modelos/novo?orcamento=${orcamento.id}`)
            }
            className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary hover:bg-xango-background"
          >
            <FileText size={14} />
            Salvar como modelo
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(`/orcamentos/novo?duplicarDe=${orcamento.id}`)
            }
            className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary hover:bg-xango-background"
          >
            <Copy size={14} />
            Duplicar
          </button>

          <button
            type="button"
            onClick={() => router.push("/orcamentos/novo")}
            className="flex items-center gap-2 rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white hover:bg-xango-primary-hover"
          >
            <Plus size={16} />
            Novo orçamento
          </button>
        </div>
      </div>

      {avisoCompartilhamento && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {avisoCompartilhamento}
        </div>
      )}

      {orcamento.vencido && (
        <div className="mb-5 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle size={19} className="mt-0.5 shrink-0" />
          <div>
            <strong>Este orçamento venceu em {formatarDataCurta(orcamento.validadeAte)}.</strong>{" "}
            {orcamento.statusBanco === "ABERTO"
              ? "Você pode editar e renovar a validade, ou duplicar para gerar uma nova cotação."
              : "Como já existe conversão, duplique o orçamento para gerar uma nova cotação dos itens restantes."}
          </div>
        </div>
      )}

      {orcamento.statusBanco !== "ABERTO" && (
        <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Este orçamento já possui conversão e ficou bloqueado para edição para
          preservar o histórico original. Para alterar a cotação, use
          <strong> Duplicar</strong>.
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-xl border border-xango-border bg-white p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-xango-background text-xango-primary">
            <FileText size={18} />
          </div>
          <p className="mt-3 text-2xl font-bold text-xango-text">
            {resumo.quantidade}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-xango-muted">
            Procedimentos
          </p>
        </div>

        <div className="rounded-xl border border-xango-border bg-white p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-xango-background text-xango-primary">
            <CheckCircle2 size={18} />
          </div>
          <p className="mt-3 text-2xl font-bold text-xango-text">
            {resumo.convertidos}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-xango-muted">
            Convertidos
          </p>
        </div>

        <div className="rounded-xl border border-xango-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
            Disponíveis
          </p>
          <p className="mt-3 text-2xl font-bold text-xango-text">
            {resumo.disponiveis}
          </p>
          <p className="mt-1 text-xs text-xango-muted">
            Ainda podem virar atendimento.
          </p>
        </div>

        <div className={`rounded-xl border bg-white p-4 ${orcamento.vencido ? "border-red-200" : "border-xango-border"}`}>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${orcamento.vencido ? "bg-red-50 text-red-600" : "bg-xango-background text-xango-primary"}`}>
            <CalendarDays size={18} />
          </div>
          <p className={`mt-3 text-lg font-bold ${orcamento.vencido ? "text-red-700" : "text-xango-text"}`}>
            {formatarDataCurta(orcamento.validadeAte)}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-xango-muted">
            {orcamento.vencido ? "Vencido" : `Validade • ${orcamento.validadeDias} dias`}
          </p>
        </div>

        <div className="rounded-xl border border-xango-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
            Valor total
          </p>
          <p className="mt-3 text-2xl font-bold text-xango-text">
            {moeda(resumo.total)}
          </p>
          <p className="mt-1 text-xs text-xango-muted">Valores congelados.</p>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-5">
          <section className="rounded-xl border border-xango-border bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-xango-background text-xango-primary">
                <UserRound size={19} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Paciente
                </p>
                <p className="mt-1 font-semibold text-xango-text">
                  {orcamento.nomePaciente}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-xango-text">
              {formatarTelefone(orcamento.telefonePaciente)}
            </p>

            <p className="mt-2 text-xs text-xango-muted">
              {orcamento.pacienteId
                ? "Vinculado ao cadastro de paciente."
                : "Orçamento criado sem cadastro completo do paciente."}
            </p>

            {!orcamento.pacienteId && resumo.disponiveis > 0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                Para converter este orçamento em atendimento, primeiro vincule
                um paciente cadastrado.
                {orcamento.statusBanco === "ABERTO" && (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/orcamentos/${orcamento.id}/editar`)
                    }
                    className="mt-2 block font-semibold text-amber-900 underline"
                  >
                    Editar e vincular paciente
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-xango-border bg-white p-5">
            <div className="flex items-center gap-2 text-xango-text">
              <CalendarDays size={17} className="text-xango-primary" />
              <h3 className="font-semibold">Histórico</h3>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div className="border-l-2 border-xango-primary pl-3">
                <p className="font-medium text-xango-text">Orçamento criado</p>
                <p className="mt-1 text-xs text-xango-muted">
                  {formatarData(orcamento.criadoEm)}
                  {orcamento.criadoPor?.nome ? ` • ${orcamento.criadoPor.nome}` : ""}
                </p>
              </div>

              {orcamento.historico?.filter((registro) => registro.acao !== "CRIADO").map((registro) => (
                <div key={registro.id} className="border-l-2 border-slate-200 pl-3">
                  <p className="font-medium text-xango-text">
                    {registro.descricao || registro.acao.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-xango-muted">
                    {formatarData(registro.criadoEm)}
                    {registro.usuario?.nome ? ` • ${registro.usuario.nome}` : ""}
                  </p>
                </div>
              ))}

              <div>
                <p className="text-xs text-xango-muted">Última atualização</p>
                <p className="mt-1 font-medium text-xango-text">
                  {formatarData(orcamento.atualizadoEm)}
                </p>
              </div>
            </div>
          </section>

          {orcamento.condicoesPagamento && (
            <section className="rounded-xl border border-xango-border bg-white p-5">
              <h3 className="font-semibold text-xango-text">Condições de pagamento</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-xango-muted">
                {orcamento.condicoesPagamento}
              </p>
            </section>
          )}

          {orcamento.observacoes && (
            <section className="rounded-xl border border-xango-border bg-white p-5">
              <h3 className="font-semibold text-xango-text">Observações</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-xango-muted">
                {orcamento.observacoes}
              </p>
            </section>
          )}
        </div>

        <div className="space-y-4">
          {resumo.disponiveis > 0 && !orcamento.vencido && (
            <section className="rounded-xl border border-xango-border bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-xango-text">
                    Converter em atendimento
                  </h3>
                  <p className="mt-1 text-xs text-xango-muted">
                    Selecione apenas os procedimentos que o paciente deseja
                    seguir agora. Os demais continuam disponíveis no orçamento.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={alternarTodosDisponiveis}
                  className="rounded-md border border-xango-border bg-white px-3 py-2 text-xs font-semibold text-xango-primary hover:bg-xango-background"
                >
                  {todosDisponiveisSelecionados
                    ? "Desmarcar todos"
                    : "Selecionar disponíveis"}
                </button>
              </div>

              {erroConversao && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  {erroConversao}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-xango-border pt-4">
                <p className="text-sm text-xango-muted">
                  <strong className="text-xango-text">
                    {selecionados.length}
                  </strong>{" "}
                  procedimento{selecionados.length === 1 ? "" : "s"} selecionado
                  {selecionados.length === 1 ? "" : "s"}
                </p>

                <button
                  type="button"
                  onClick={() => void converterSelecionados()}
                  disabled={
                    convertendo ||
                    selecionados.length === 0 ||
                    !orcamento.pacienteId
                  }
                  className="flex items-center gap-2 rounded-md bg-xango-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-xango-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {convertendo && <Loader2 size={16} className="animate-spin" />}
                  {convertendo
                    ? "Convertendo..."
                    : "Converter selecionados"}
                </button>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-xango-border bg-white">
            <div className="border-b border-xango-border px-5 py-4">
              <h3 className="font-semibold text-xango-text">
                Itens do orçamento
              </h3>
              <p className="mt-1 text-xs text-xango-muted">
                Clínica, unidade e valor registrados no momento da cotação.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-270 w-full text-left text-sm">
                <thead className="border-b border-xango-border bg-slate-50 text-xs uppercase tracking-wide text-xango-muted">
                  <tr>
                    <th className="w-12 px-4 py-3 text-center">Selecionar</th>
                    <th className="px-4 py-3">Procedimento</th>
                    <th className="px-4 py-3">Clínica / unidade</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Situação</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-xango-border">
                  {orcamento.itens.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4 text-center align-top">
                        {item.convertido ? (
                          <CheckCircle2
                            size={17}
                            className="mx-auto text-emerald-600"
                          />
                        ) : (
                          <input
                            type="checkbox"
                            checked={selecionados.includes(item.id)}
                            onChange={() => alternarItem(item.id)}
                            className="h-4 w-4 cursor-pointer accent-xango-primary"
                            aria-label={`Selecionar ${item.procedimentoNome}`}
                          />
                        )}
                      </td>

                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-xango-text">
                          {item.procedimentoNome}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <p className="flex items-center gap-1.5 font-medium text-xango-text">
                          <Building2 size={14} className="text-xango-muted" />
                          {item.clinicaNome || "Clínica não definida"}
                        </p>

                        {item.unidadeClinicaNome && (
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-xango-muted">
                            <MapPin size={13} />
                            {item.unidadeClinicaNome}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-xango-text">
                          {moeda(item.valorPaciente)}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        {item.convertido ? (
                          <div>
                            <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                              Convertido
                            </span>

                            {item.codigoVoucher && (
                              <p className="mt-1 text-xs text-xango-muted">
                                {item.codigoVoucher}
                              </p>
                            )}

                            {item.atendimentoId && (
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/atendimentos/${item.atendimentoId}`
                                  )
                                }
                                className="mt-2 flex items-center gap-1 text-xs font-semibold text-xango-primary hover:underline"
                              >
                                Abrir atendimento
                                <ExternalLink size={12} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                            Disponível
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
