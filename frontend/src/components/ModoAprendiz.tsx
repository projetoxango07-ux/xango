"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, GraduationCap, Target, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

type Passo = {
  titulo: string;
  texto: string;
  seletores?: string[];
};

type TourPagina = {
  nome: string;
  passos: Passo[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

function passo(titulo: string, texto: string, ...seletores: string[]): Passo {
  return { titulo, texto, seletores: seletores.filter(Boolean) };
}

function tourDaPagina(pathname: string): TourPagina {
  if (pathname === "/") {
    return {
      nome: "Dashboard",
      passos: [
        passo("Bem-vindo ao Tour Guiado", "Este tour apresenta os principais pontos desta tela. Você pode sair a qualquer momento e iniciar novamente quando quiser."),
        passo("Pesquisa global", "Use esta barra para localizar pacientes, procedimentos e preços, atendimentos, guias, orçamentos e clínicas. Ctrl + K leva o cursor direto para a pesquisa.", '[data-aprendiz="pesquisa-global"]'),
        passo("Novo atendimento", "Este botão inicia o fluxo principal quando um paciente entra em contato para orçamento, agendamento ou continuidade de um caso.", '[data-aprendiz="novo-atendimento"]'),
        passo("Notificações", "O sino reúne situações que exigem atenção, respeitando as permissões do perfil logado.", '[data-aprendiz="notificacoes"]'),
        passo("Resumo do dia", "Os cards mostram o que está acontecendo agora e levam você rapidamente para os pontos que precisam de ação.", '[data-aprendiz="resumo-dashboard"]'),
        passo("Fila de pendências", "Use esta área como lista de trabalho. Comece pelos itens atrasados ou críticos e avance pelas demais pendências.", '[data-aprendiz="fila-pendencias"]'),
        passo("Ajuda e treinamento", "A Central de Ajuda reúne artigos, vídeos, o Tour Guiado e o envio de problemas para suporte.", '[data-aprendiz="ajuda"]'),
      ],
    };
  }

  if (pathname.startsWith("/atendimentos/novo")) {
    return {
      nome: "Novo atendimento",
      passos: [
        passo("Novo atendimento", "Aqui você conduz o atendimento do início ao fim. O sistema organiza o trabalho em etapas para reduzir esquecimentos.", "main h1", "main h2", "main"),
        passo("Etapas do atendimento", "Acompanhe a etapa atual e avance somente quando os dados necessários estiverem completos.", "main > div > div:first-of-type", "main section:first-of-type"),
        passo("Paciente", "Comece localizando o paciente. Se ele ainda não existir, use Novo paciente para fazer o cadastro.", 'main input[placeholder*="nome"]', 'main input[placeholder*="CPF"]', "main section"),
        passo("Procedimentos", "Na etapa Procedimento, pesquise pelo nome ou sinônimo e selecione todos os exames ou consultas solicitados.", 'main input[placeholder*="procedimento"]', "main section"),
        passo("Clínica e agendamento", "Escolha a clínica ou unidade e depois defina data e horário, aguardando clínica ou ordem de chegada, conforme o caso.", "main section"),
        passo("Guias e pagamento", "Antes de concluir, confira as guias, valores, pagamentos e possíveis pendências financeiras.", "main section"),
        passo("Revisão", "Na etapa final, revise paciente, procedimentos, agendamentos e financeiro antes de encerrar o atendimento.", "main"),
      ],
    };
  }

  if (pathname.startsWith("/atendimentos/")) {
    return {
      nome: "Atendimento",
      passos: [
        passo("Atendimento em andamento", "Nesta tela você retoma um atendimento salvo e continua exatamente do ponto em que ele parou.", "main h1", "main h2", "main"),
        passo("Etapas", "Use as etapas para revisar ou continuar paciente, procedimentos, clínica, guias, pagamento e revisão.", "main section:first-of-type", "main"),
        passo("Histórico e situação atual", "Antes de alterar qualquer informação, confira o que já foi registrado e a situação financeira das guias.", "main section", "main"),
      ],
    };
  }

  if (pathname === "/atendimentos" || pathname.startsWith("/atendimentos?")) {
    return {
      nome: "Atendimentos",
      passos: [
        passo("Lista de atendimentos", "Aqui ficam os contatos e atendimentos já iniciados. Use esta tela para localizar, acompanhar e continuar casos.", "main h1", "main h2", "main"),
        passo("Pesquisa e filtros", "Use a pesquisa e os filtros para encontrar rapidamente um paciente ou atendimento específico.", 'main input[placeholder*="Pesquisar"]', 'main input[placeholder*="pesquisar"]', "main"),
        passo("Resultados", "Clique em um atendimento para abrir seus detalhes ou continuar o fluxo.", "main table", "main section"),
      ],
    };
  }

  if (pathname.startsWith("/orcamentos/novo")) {
    return {
      nome: "Novo orçamento",
      passos: [
        passo("Novo orçamento", "O orçamento permite informar valores antes do agendamento e pode ser convertido depois, inclusive parcialmente.", "main h1", "main h2", "main"),
        passo("Paciente", "Para um orçamento inicial, nome e telefone podem ser suficientes. Você também pode selecionar um paciente já cadastrado.", 'main input[placeholder*="nome"]', 'main input[placeholder*="CPF"]', "main section"),
        passo("Procedimentos e clínicas", "Adicione os procedimentos e escolha a clínica ou unidade correspondente. Os valores exibidos são os preços atuais.", 'main input[placeholder*="procedimento"]', "main section"),
        passo("Resumo", "Antes de salvar, confira a quantidade de procedimentos, validade e valor total do orçamento.", "main aside", "main"),
        passo("Salvar orçamento", "Ao salvar, os valores ficam congelados no orçamento para preservar o histórico do que foi apresentado ao paciente.", 'main button[type="submit"]', "main button"),
      ],
    };
  }

  if (pathname.startsWith("/orcamentos/")) {
    return {
      nome: "Orçamento",
      passos: [
        passo("Detalhes do orçamento", "Confira paciente, validade, itens e situação de conversão do orçamento.", "main h1", "main h2", "main"),
        passo("Itens", "Cada item mantém o procedimento, clínica e valor apresentados originalmente.", "main table", "main section"),
        passo("Ações", "Dependendo do status, você pode editar, duplicar, imprimir, compartilhar ou converter itens do orçamento.", "main button", "main"),
      ],
    };
  }

  if (pathname === "/orcamentos" || pathname.startsWith("/orcamentos?")) {
    return {
      nome: "Orçamentos",
      passos: [
        passo("Orçamentos", "Aqui você acompanha todos os orçamentos criados, inclusive abertos, parcialmente convertidos, encerrados ou vencidos.", "main h1", "main h2", "main"),
        passo("Pesquisa e filtros", "Filtre por situação, período ou paciente para localizar rapidamente um orçamento.", 'main input[placeholder*="Pesquisar"]', 'main input[placeholder*="pesquisar"]', "main"),
        passo("Lista", "Clique em uma linha para abrir os detalhes e acessar as ações disponíveis.", "main table", "main section"),
      ],
    };
  }

  if (pathname.startsWith("/guias/")) {
    return {
      nome: "Guia / Voucher",
      passos: [
        passo("Guia / Voucher", "Nesta tela você confere clínica, procedimentos, paciente, agendamento e situação financeira da guia.", "main h1", "main h2", "main"),
        passo("Dados da guia", "Confira com atenção os dados antes de registrar pagamento, imprimir ou confirmar realização.", "main section", "main"),
        passo("Ações", "As ações disponíveis dependem do status da guia e das permissões do seu perfil.", "main button", "main"),
      ],
    };
  }

  if (pathname === "/guias" || pathname.startsWith("/guias?")) {
    return {
      nome: "Guias",
      passos: [
        passo("Guias / Vouchers", "Aqui você acompanha pagamento, agendamento, realização e eventuais estornos das guias.", "main h1", "main h2", "main"),
        passo("Filtros", "Use status, período, paciente ou clínica para reduzir a lista e encontrar rapidamente o que precisa.", 'main input[placeholder*="Pesquisar"]', 'main input[placeholder*="pesquisar"]', "main"),
        passo("Lista de guias", "Clique em uma guia para abrir os detalhes. Priorize as que aparecem em situações de atenção.", "main table", "main section"),
      ],
    };
  }

  if (pathname.startsWith("/agenda")) {
    return {
      nome: "Agenda",
      passos: [
        passo("Agenda", "A agenda mostra os procedimentos previstos por data e ajuda a organizar confirmações e atendimentos do dia.", "main h1", "main h2", "main"),
        passo("Data e filtros", "Escolha a data e use os filtros disponíveis para conferir somente os agendamentos relevantes.", 'main input[type="date"]', "main"),
        passo("Agendamentos", "Clique em um item para acessar o atendimento ou a guia relacionada quando essa ação estiver disponível.", "main table", "main section"),
      ],
    };
  }

  if (pathname.startsWith("/pacientes/")) {
    return {
      nome: "Paciente",
      passos: [
        passo("Cadastro do paciente", "Aqui ficam os dados cadastrais e o histórico relacionado ao paciente.", "main h1", "main h2", "main"),
        passo("Dados e vínculos", "Confira dados pessoais, contatos, benefícios e vínculos antes de fazer alterações.", "main section", "main form", "main"),
        passo("Histórico", "Use o histórico para consultar atendimentos, guias e outras informações já registradas.", "main table", "main section"),
      ],
    };
  }

  if (pathname.startsWith("/pacientes")) {
    return {
      nome: "Pacientes",
      passos: [
        passo("Pacientes", "Esta é a base de pacientes da Digna Saúde. Use-a para localizar cadastros antes de criar um novo.", "main h1", "main h2", "main"),
        passo("Pesquisa", "Pesquise por nome, CPF ou telefone para evitar cadastros duplicados.", 'main input[placeholder*="Pesquisar"]', 'main input[placeholder*="CPF"]', "main"),
        passo("Lista", "Clique no paciente para consultar ou atualizar o cadastro e verificar o histórico.", "main table", "main section"),
      ],
    };
  }

  if (pathname.startsWith("/clinicas/")) {
    return {
      nome: "Clínica",
      passos: [
        passo("Cadastro da clínica", "Nesta área ficam dados cadastrais, unidades, contatos, contrato e regras de precificação da clínica.", "main h1", "main h2", "main"),
        passo("Unidades e contatos", "Confira a unidade correta e os responsáveis antes de alterar dados ou valores.", "main section", "main form", "main"),
        passo("Procedimentos e preços", "Os preços vinculados à clínica são usados em orçamento, atendimento e consulta rápida da Pesquisa Global.", "main table", "main section"),
      ],
    };
  }

  if (pathname.startsWith("/clinicas")) {
    return {
      nome: "Clínicas",
      passos: [
        passo("Clínicas parceiras", "Aqui ficam os prestadores e clínicas parceiras usados nos atendimentos e orçamentos.", "main h1", "main h2", "main"),
        passo("Pesquisa e filtros", "Localize por nome, documento, telefone, cidade ou situação cadastral.", 'main input[placeholder*="Pesquisar"]', 'main input[placeholder*="clínica"]', "main"),
        passo("Lista de clínicas", "Abra uma clínica para consultar unidades, procedimentos, preços, contrato e responsáveis.", "main table", "main section"),
      ],
    };
  }

  if (pathname.startsWith("/procedimentos")) {
    return {
      nome: "Procedimentos",
      passos: [
        passo("Procedimentos", "Esta base unifica os procedimentos usados no sistema, incluindo nomes oficiais, TUSS e sinônimos.", "main h1", "main h2", "main"),
        passo("Pesquisa", "Pesquise pelo nome principal ou por um sinônimo. Os aliases também alimentam a Pesquisa Global e o atendimento.", 'main input[placeholder*="Pesquisar"]', 'main input[placeholder*="procedimento"]', "main"),
        passo("Cadastro e referência", "Ao editar um procedimento, confira categoria, TUSS, CH, aliases e preparo para manter a base consistente.", "main table", "main section", "main"),
      ],
    };
  }

  if (pathname.startsWith("/financeiro")) {
    return {
      nome: "Financeiro",
      passos: [
        passo("Financeiro", "O Financeiro concentra recebimentos, estornos, valores a receber e repasses às clínicas, conforme sua permissão.", "main h1", "main h2", "main"),
        passo("Indicadores", "Use os indicadores para identificar rapidamente valores recebidos, pendentes e situações que exigem conferência.", "main section", "main"),
        passo("Repasses", "Acompanhe solicitações, análise, aprovação, recusa e pagamento dos repasses às clínicas.", "main table", "main section"),
      ],
    };
  }

  if (pathname.startsWith("/relatorios")) {
    return {
      nome: "Relatórios",
      passos: [
        passo("Relatórios", "Os relatórios estão separados em Operacionais, Financeiros e Produção.", "main h1", "main h2", "main"),
        passo("Filtros", "Defina período e filtros antes de analisar os indicadores ou exportar os dados.", 'main input[type="date"]', 'main input[placeholder*="Pesquisar"]', "main"),
        passo("Resultados", "Clique nas linhas quando houver painel de detalhes. Você também pode exportar CSV ou imprimir em PDF.", "main table", "main section"),
      ],
    };
  }

  if (pathname.startsWith("/configuracoes")) {
    return {
      nome: "Configurações",
      passos: [
        passo("Configurações", "Esta área controla parâmetros do sistema. As opções visíveis dependem das permissões do usuário.", "main h1", "main h2", "main"),
        passo("Parâmetros", "Altere somente o que for necessário. Algumas configurações afetam novos registros e fluxos operacionais.", "main section", "main form", "main"),
        passo("Salvar alterações", "Revise os valores antes de salvar, principalmente parâmetros financeiros e operacionais.", 'main button[type="submit"]', "main button", "main"),
      ],
    };
  }

  if (pathname.startsWith("/ajuda")) {
    return {
      nome: "Central de Ajuda",
      passos: [
        passo("Central de Ajuda", "Aqui ficam materiais de consulta e treinamento. O Tour Guiado apresenta cada tela diretamente no sistema.", "main h1", "main h2", "main"),
        passo("Pesquisar ajuda", "Pesquise artigos e materiais pelo assunto que você precisa revisar.", 'main input[placeholder*="Central de Ajuda"]', "main"),
        passo("Tutoriais", "Abra um tutorial para consultar o passo a passo de uma rotina específica.", "main section", "main"),
        passo("Informar um problema", "Quando encontrar um erro, envie uma descrição e, se possível, uma captura de tela para facilitar o suporte.", "main button", "main"),
      ],
    };
  }

  return {
    nome: "Esta página",
    passos: [
      passo("Tour desta tela", "Esta tela também faz parte do Tour Guiado. Comece pelo título e pela finalidade geral da página.", "main h1", "main h2", "main"),
      passo("Área de trabalho", "Use os campos, filtros, tabelas e ações disponíveis nesta página de acordo com a rotina que estiver executando.", "main section", "main form", "main table", "main"),
      passo("Ajuda", "Se precisar de mais detalhes, abra a Central de Ajuda pela barra lateral.", '[data-aprendiz="ajuda"]'),
    ],
  };
}

function chaveDoTour(pathname: string) {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/atendimentos/novo")) return "atendimento-novo";
  if (pathname.startsWith("/atendimentos/")) return "atendimento-detalhe";
  if (pathname.startsWith("/atendimentos")) return "atendimentos-lista";
  if (pathname.startsWith("/orcamentos/novo")) return "orcamento-novo";
  if (pathname.startsWith("/orcamentos/")) return "orcamento-detalhe";
  if (pathname.startsWith("/orcamentos")) return "orcamentos-lista";
  if (pathname.startsWith("/guias/")) return "guia-detalhe";
  if (pathname.startsWith("/guias")) return "guias-lista";
  if (pathname.startsWith("/agenda")) return "agenda";
  if (pathname.startsWith("/pacientes/")) return "paciente-detalhe";
  if (pathname.startsWith("/pacientes")) return "pacientes-lista";
  if (pathname.startsWith("/clinicas/")) return "clinica-detalhe";
  if (pathname.startsWith("/clinicas")) return "clinicas-lista";
  if (pathname.startsWith("/procedimentos")) return "procedimentos";
  if (pathname.startsWith("/financeiro")) return "financeiro";
  if (pathname.startsWith("/relatorios")) return "relatorios";
  if (pathname.startsWith("/configuracoes/usuarios")) return "configuracoes-usuarios";
  if (pathname.startsWith("/configuracoes/operacionais")) return "configuracoes-operacionais";
  if (pathname.startsWith("/configuracoes")) return "configuracoes";
  if (pathname.startsWith("/ajuda")) return "ajuda";

  const chave = pathname
    .split("/")
    .filter(Boolean)
    .slice(0, 2)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-");
  return chave || "pagina";
}

function primeiroElementoDisponivel(seletores?: string[]) {
  if (!seletores?.length) return null;
  for (const seletor of seletores) {
    try {
      const elementos = Array.from(document.querySelectorAll(seletor));
      const visivel = elementos.find((elemento) => elementoVisivel(elemento));
      if (visivel instanceof HTMLElement) return visivel;
    } catch {
      // Ignora seletor inválido e tenta o próximo.
    }
  }
  return null;
}

type OrientacaoAprendiz = {
  titulo: string;
  texto: string;
  dica?: string;
  seletores?: string[];
  textosAlvo?: string[];
};

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function elementoPorTexto(textos?: string[]) {
  if (!textos?.length) return null;
  const procurados = textos.map(normalizarTexto);
  const candidatos = Array.from(
    document.querySelectorAll(
      "main h1, main h2, main h3, main h4, main label, main button, main a, main [role='tab'], main [role='button']"
    )
  ).filter(elementoVisivel);

  const resolver = (elemento: HTMLElement) => {
    if (
      elemento.tagName === "BUTTON" ||
      elemento.tagName === "A" ||
      elemento.getAttribute("role") === "tab" ||
      elemento.getAttribute("role") === "button"
    ) {
      return elemento;
    }

    if (elemento.tagName === "LABEL") {
      const controle = elemento.querySelector("input, select, textarea, button");
      if (controle instanceof HTMLElement && elementoVisivel(controle)) return controle;
      return elemento;
    }

    return elemento.closest("section, form, article, aside") instanceof HTMLElement
      ? (elemento.closest("section, form, article, aside") as HTMLElement)
      : elemento;
  };

  // Primeiro tenta correspondência exata. Isso evita que, por exemplo,
  // “Configurações” destaque o título quando a orientação se refere a um botão/card.
  for (const alvo of procurados) {
    const exato = candidatos.find(
      (elemento) => normalizarTexto(elemento.textContent || "") === alvo
    );
    if (exato instanceof HTMLElement) return resolver(exato);
  }

  for (const alvo of procurados) {
    const parcial = candidatos.find((elemento) => {
      const texto = normalizarTexto(elemento.textContent || "");
      return texto && texto.includes(alvo);
    });
    if (parcial instanceof HTMLElement) return resolver(parcial);
  }

  return null;
}

function elementoDaOrientacao(orientacao: OrientacaoAprendiz | null) {
  if (!orientacao) return null;
  const porSeletor = primeiroElementoDisponivel(orientacao.seletores);
  if (porSeletor) return porSeletor;
  return elementoPorTexto(orientacao.textosAlvo);
}

function retanguloVisivelDoElemento(elemento: HTMLElement) {
  const retangulo = elemento.getBoundingClientRect();
  const larguraViewport = window.innerWidth || document.documentElement.clientWidth;
  const alturaViewport = window.innerHeight || document.documentElement.clientHeight;

  const estaVisivel =
    retangulo.width > 0 &&
    retangulo.height > 0 &&
    retangulo.bottom > 0 &&
    retangulo.right > 0 &&
    retangulo.top < alturaViewport &&
    retangulo.left < larguraViewport;

  return estaVisivel ? retangulo : null;
}

type TamanhoPainel = {
  width: number;
  height: number;
};

type PosicaoPainel = {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
};

function retangulosColidemComMargem(
  painel: { left: number; top: number; width: number; height: number },
  alvo: DOMRect,
  margem: number
) {
  return !(
    painel.left + painel.width + margem <= alvo.left ||
    painel.left >= alvo.right + margem ||
    painel.top + painel.height + margem <= alvo.top ||
    painel.top >= alvo.bottom + margem
  );
}

function posicaoInteligenteDoPainel(
  alvo: DOMRect | null,
  tamanho: TamanhoPainel,
  margemSeguranca = 24
): PosicaoPainel {
  if (typeof window === "undefined") {
    return { right: 20, bottom: 20 };
  }

  const larguraViewport = window.innerWidth || document.documentElement.clientWidth;
  const alturaViewport = window.innerHeight || document.documentElement.clientHeight;
  const margem = 20;
  const topoSeguro = larguraViewport >= 1024 ? 96 : margem;
  const esquerdaSegura = larguraViewport >= 1024 ? 280 : margem;
  const largura = Math.min(
    Math.max(tamanho.width || 380, 280),
    Math.max(280, larguraViewport - margem * 2)
  );
  const altura = Math.min(
    Math.max(tamanho.height || 90, 70),
    Math.max(70, alturaViewport - margem * 2)
  );

  const limitar = (valor: number, minimo: number, maximo: number) =>
    Math.min(Math.max(valor, minimo), Math.max(minimo, maximo));

  const direita = limitar(larguraViewport - largura - margem, margem, larguraViewport - largura - margem);
  const esquerda = limitar(esquerdaSegura, margem, larguraViewport - largura - margem);
  const baixo = limitar(alturaViewport - altura - margem, margem, alturaViewport - altura - margem);
  const cima = limitar(topoSeguro, margem, alturaViewport - altura - margem);

  const candidatos = [
    { left: direita, top: baixo, width: largura, height: altura },
    { left: direita, top: cima, width: largura, height: altura },
    { left: esquerda, top: baixo, width: largura, height: altura },
    { left: esquerda, top: cima, width: largura, height: altura },
  ];

  if (!alvo) {
    return { left: candidatos[0].left, top: candidatos[0].top };
  }

  const livre = candidatos.find(
    (candidato) => !retangulosColidemComMargem(candidato, alvo, margemSeguranca)
  );

  if (livre) {
    return { left: livre.left, top: livre.top };
  }

  const centroAlvoX = alvo.left + alvo.width / 2;
  const centroAlvoY = alvo.top + alvo.height / 2;
  const maisDistante = candidatos
    .map((candidato) => {
      const centroPainelX = candidato.left + candidato.width / 2;
      const centroPainelY = candidato.top + candidato.height / 2;
      const distancia =
        (centroPainelX - centroAlvoX) ** 2 +
        (centroPainelY - centroAlvoY) ** 2;
      return { candidato, distancia };
    })
    .sort((a, b) => b.distancia - a.distancia)[0]?.candidato;

  return maisDistante
    ? { left: maisDistante.left, top: maisDistante.top }
    : { right: margem, bottom: margem };
}

function orientacaoAprendizDoAtendimento(): OrientacaoAprendiz | null {
  const contexto = document.querySelector(
    '[data-aprendiz-atendimento="true"]'
  );

  if (!(contexto instanceof HTMLElement)) return null;

  const estado = contexto.dataset.aprendizEstado || "";
  const alvo = contexto.dataset.aprendizAlvo || "";
  const detalhe = contexto.dataset.aprendizDetalhe || "";
  const partes = detalhe.split("|");
  const item = partes[0] || "";
  const complemento = partes[1] || "";
  const seletores = alvo ? [alvo] : undefined;

  const criar = (
    titulo: string,
    texto: string,
    dica?: string
  ): OrientacaoAprendiz => ({
    titulo,
    texto,
    dica,
    seletores,
  });

  switch (estado) {
    case "carregando":
      return criar(
        "Preparando o atendimento",
        "Aguarde o carregamento dos dados antes de começar. O Modo Aprendiz vai indicar a próxima ação assim que a tela estiver pronta.",
        "Não é necessário clicar em nada enquanto o carregamento estiver em andamento."
      );

    case "erro":
      return criar(
        "Há um problema para continuar",
        detalhe || "O sistema encontrou um erro ao carregar os dados deste atendimento.",
        "Corrija a situação indicada ou recarregue a tela antes de seguir."
      );

    case "novo-paciente-nome":
      return criar(
        "Cadastre o nome do paciente",
        "Preencha o nome completo para iniciar o cadastro rápido.",
        "Depois o Modo Aprendiz seguirá automaticamente para os próximos campos obrigatórios."
      );

    case "novo-paciente-cpf":
      return criar(
        "Informe o CPF",
        "Agora preencha o CPF do paciente. Ele é usado para identificar o cadastro e evitar duplicidades.",
        "Confira os números antes de continuar."
      );

    case "novo-paciente-telefone":
      return criar(
        "Informe o telefone",
        "Preencha o telefone ou WhatsApp do paciente para concluir os dados mínimos deste cadastro rápido.",
        "A data de nascimento e o e-mail podem ser completados também nesta tela."
      );

    case "novo-paciente-salvar":
      return criar(
        "Salve o novo paciente",
        "Os dados mínimos estão preenchidos. Salve o paciente para vinculá-lo automaticamente a este atendimento.",
        "Após salvar, você volta ao fluxo normal e a orientação muda sozinha."
      );

    case "paciente-buscar":
      return criar(
        "Etapa 1 · Localize o paciente",
        "Pesquise por nome, CPF ou telefone. Se o paciente não existir, use o botão Novo paciente ao lado da pesquisa.",
        "Pesquisar antes de cadastrar ajuda a evitar pacientes duplicados."
      );

    case "paciente-cadastro-incompleto":
      return criar(
        "Complete o cadastro do paciente",
        `${item || "O paciente selecionado"} está com ${complemento || "0"}% do cadastro preenchido. Complete os dados agora para reduzir bloqueios nas próximas etapas.`,
        "Se precisar seguir momentaneamente, o atendimento continua disponível, mas confira o cadastro novamente antes da revisão final."
      );

    case "paciente-continuar":
      return criar(
        "Paciente confirmado",
        `${item || "O paciente"} está selecionado. Avance para informar os procedimentos solicitados.`,
        "Confira o nome e o CPF antes de continuar."
      );

    case "procedimento-buscar":
      return criar(
        "Etapa 2 · Adicione os procedimentos",
        "Pesquise pelo nome do exame ou consulta. A busca também reconhece os sinônimos cadastrados.",
        "Selecione todos os itens do pedido antes de avançar."
      );

    case "procedimento-continuar":
      return criar(
        "Confira os procedimentos selecionados",
        `${item || "Um ou mais"} procedimento(s) já foi(ram) selecionado(s). Se o pedido estiver completo, avance para clínica e agendamento.`,
        "Você ainda pode pesquisar e marcar outros procedimentos antes de continuar."
      );

    case "clinica-indisponivel":
      return criar(
        "Procedimento sem clínica disponível",
        `Não há clínica com preço disponível para ${item || "este procedimento"}. O atendimento não consegue avançar enquanto essa vinculação não existir.`,
        "Volte aos procedimentos se precisar retirar o item ou solicite a correção da tabela da clínica."
      );

    case "clinica-selecionar":
      return criar(
        "Etapa 3 · Escolha a clínica",
        `Selecione onde ${item || "o procedimento"} será realizado.`,
        "Compare a clínica correta antes de definir unidade e agendamento."
      );

    case "unidade-selecionar":
      return criar(
        "Escolha a unidade de atendimento",
        `Para ${item || "este procedimento"}, selecione a unidade correta${complemento ? ` da ${complemento}` : ""}.`,
        "A unidade pode alterar endereço e preço; confirme antes de continuar."
      );

    case "agendamento-tipo":
      return criar(
        "Defina como será o agendamento",
        `Escolha a situação de agendamento de ${item || "este procedimento"}: data e horário, aguardando clínica ou ordem de chegada.`,
        "Use Aguardando clínica somente quando a clínica ainda não confirmou a disponibilidade."
      );

    case "agendamento-data":
      return criar(
        "Informe a data do agendamento",
        `Defina a data confirmada para ${item || "este procedimento"}.`,
        "Depois informe também o horário."
      );

    case "agendamento-horario":
      return criar(
        "Informe o horário",
        `A data de ${item || "este procedimento"} já foi informada. Agora registre o horário confirmado pela clínica.`,
        "Confira se o horário corresponde à unidade selecionada."
      );

    case "agendamento-data-ordem":
      return criar(
        "Informe a data prevista",
        `${item || "Este procedimento"} será por ordem de chegada. Informe o dia em que o paciente deve comparecer.`,
        "Não é necessário preencher horário para ordem de chegada."
      );

    case "clinica-continuar":
      return criar(
        "Clínicas e agendamentos conferidos",
        "Todos os procedimentos têm clínica, unidade quando necessária e situação de agendamento definida. Avance para gerar e conferir as guias.",
        "Se algum item estiver como Aguardando clínica, a guia poderá ser salva, mas a revisão final ficará pendente até a confirmação."
      );

    case "guias-vazias":
      return criar(
        "Nenhuma guia disponível",
        "Ainda não há guia formada para este atendimento. Volte à etapa de clínica e agendamento e confira os procedimentos.",
        "Cada guia é agrupada pela clínica, unidade e condição de agendamento."
      );

    case "guia-beneficio-revisar":
      return criar(
        "Benefício precisa de revisão",
        `A guia da ${item || "clínica"} não pode ser salva porque o benefício ultrapassa o limite permitido para esta composição de valores.`,
        "Confira o benefício do paciente e a precificação antes de registrar pagamento."
      );

    case "guia-salvar":
      return criar(
        "Etapa 4 · Salve a guia",
        `A guia da ${item || "clínica"} ainda está em rascunho. Salve-a antes de registrar pagamentos ou documentos financeiros.`,
        "O salvamento congela os dados necessários para continuar o atendimento depois."
      );

    case "guia-estorno":
      return criar(
        "Resolva o estorno pendente",
        `A guia da ${item || "clínica"} possui valor recebido acima do valor atual. Registre o estorno necessário antes de continuar.`,
        "A revisão final só deve ser liberada quando não houver diferença financeira pendente."
      );

    case "guia-aguardando-clinica":
      return criar(
        "Aguardando confirmação da clínica",
        `A guia da ${item || "clínica"} está salva, mas ainda falta a clínica confirmar data ou horário. Salve o atendimento e retome quando houver retorno.`,
        "Quando você voltar e definir o agendamento, o Modo Aprendiz continuará do ponto correto."
      );

    case "guia-pagamento":
      return criar(
        "Registre o pagamento da guia",
        `A guia da ${item || "clínica"} está salva e ainda possui saldo. Abra o pagamento para registrar o valor recebido.`,
        "Pagamentos parciais são aceitos; se houver saldo depois, a orientação continuará nesta guia."
      );

    case "pagamento-forma":
      return criar(
        "Escolha a forma de pagamento",
        `Selecione como o pagamento da ${item || "guia"} foi recebido.`,
        "A forma escolhida ficará registrada no histórico financeiro."
      );

    case "pagamento-valor":
      return criar(
        "Informe o valor recebido",
        `Digite o valor recebido para a ${item || "guia"}.`,
        "O valor pode ser parcial, mas não pode ultrapassar o saldo da guia."
      );

    case "pagamento-valor-invalido":
      return criar(
        "Corrija o valor do pagamento",
        `O valor informado para a ${item || "guia"} é maior que o saldo disponível.`,
        "Informe somente o valor efetivamente recebido até o limite do saldo."
      );

    case "pagamento-confirmar":
      return criar(
        "Confirme o pagamento",
        `Forma e valor da ${item || "guia"} estão preenchidos. Confirme para registrar o recebimento.`,
        "Depois da confirmação, o saldo e a próxima orientação serão atualizados automaticamente."
      );

    case "estorno-forma":
      return criar(
        "Escolha a forma do estorno",
        `Selecione como o estorno da ${item || "guia"} será devolvido ao paciente.`,
        "Use a forma que corresponda ao procedimento financeiro realmente realizado."
      );

    case "estorno-valor":
      return criar(
        "Informe o valor do estorno",
        `Digite o valor que será estornado na ${item || "guia"}.`,
        "O valor não pode superar o total líquido disponível para estorno."
      );

    case "estorno-valor-invalido":
      return criar(
        "Corrija o valor do estorno",
        `O valor informado para a ${item || "guia"} ultrapassa o montante disponível para estorno.`,
        "Ajuste o valor antes de confirmar."
      );

    case "estorno-confirmar":
      return criar(
        "Confirme o estorno",
        `Os dados do estorno da ${item || "guia"} estão preenchidos. Confirme para registrar a devolução.`,
        "A observação é útil para deixar claro o motivo da operação."
      );

    case "guias-revisao":
      return criar(
        "Tudo pronto para a revisão",
        "As guias estão salvas, os agendamentos necessários estão definidos e não há saldo ou estorno bloqueando o fluxo. Abra a etapa Revisão.",
        "A revisão é a conferência final antes de sair do atendimento."
      );

    case "guias-continuar-depois":
      return criar(
        "Salve e retome depois",
        "Ainda existe uma condição que impede a revisão final. Salve o atendimento para preservar o que já foi feito e retome quando a pendência estiver resolvida.",
        "O atendimento continuará exatamente do ponto em que foi salvo."
      );

    case "revisao-cadastro-incompleto":
      return criar(
        "Revise o cadastro antes de encerrar",
        `${item || "O paciente"} ainda está com ${complemento || "0"}% do cadastro completo. Aproveite a revisão para completar os dados pendentes.`,
        "Depois de atualizar o cadastro, volte a esta revisão para a conferência final."
      );

    case "revisao-conferir":
      return criar(
        "Etapa 5 · Conferência final",
        "Revise paciente, guias, procedimentos, agendamentos e financeiro. Se encontrar algo incorreto, use os botões de conferência da própria revisão para voltar à etapa correspondente.",
        "Se tudo estiver correto, o atendimento já está registrado e você pode voltar para a lista de Atendimentos."
      );

    default:
      return null;
  }
}

function etapaAtivaDoAtendimento() {
  const botoes = Array.from(document.querySelectorAll("main button"));
  const etapas = [
    { chave: "paciente", textos: ["paciente"] },
    { chave: "procedimento", textos: ["procedimento"] },
    { chave: "clinica", textos: ["clinica / agendamento", "clinica/agendamento", "clinica e agendamento"] },
    { chave: "pagamento", textos: ["guias / pagamento", "guias/pagamento", "guias e pagamento"] },
    { chave: "revisao", textos: ["revisao"] },
  ];

  for (const botao of botoes) {
    if (!(botao instanceof HTMLElement)) continue;
    const texto = normalizarTexto(botao.textContent || "");
    const selecionado =
      botao.className.includes("bg-xango-primary") ||
      botao.getAttribute("aria-current") === "step" ||
      botao.getAttribute("data-state") === "active";
    if (!selecionado) continue;
    const etapa = etapas.find((item) => item.textos.some((alvo) => texto.includes(normalizarTexto(alvo))));
    if (etapa) return etapa.chave;
  }

  const cabecalhos = Array.from(document.querySelectorAll("main h2, main h3"))
    .filter((item) => item instanceof HTMLElement && item.offsetParent !== null)
    .map((item) => normalizarTexto(item.textContent || ""));

  if (cabecalhos.some((texto) => texto.includes("clinica e agendamento"))) return "clinica";
  if (cabecalhos.some((texto) => texto.includes("procedimento"))) return "procedimento";
  if (cabecalhos.some((texto) => texto.includes("revisao"))) return "revisao";
  if (cabecalhos.some((texto) => texto.includes("guia") || texto.includes("pagamento"))) return "pagamento";
  return "paciente";
}


function elementoVisivel(elemento: Element | null): elemento is HTMLElement {
  if (!(elemento instanceof HTMLElement)) return false;
  const estilo = window.getComputedStyle(elemento);
  if (estilo.display === "none" || estilo.visibility === "hidden") return false;
  return elemento.getClientRects().length > 0;
}

function elementosVisiveis(seletor: string) {
  try {
    return Array.from(document.querySelectorAll(seletor)).filter(elementoVisivel);
  } catch {
    return [] as HTMLElement[];
  }
}

function campoVisivel(seletor: string) {
  return elementosVisiveis(seletor).find(
    (item) =>
      item instanceof HTMLInputElement ||
      item instanceof HTMLSelectElement ||
      item instanceof HTMLTextAreaElement
  ) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | undefined;
}

function botaoVisivelPorTexto(...textos: string[]) {
  const alvos = textos.map(normalizarTexto);
  const botoes = elementosVisiveis("main button, main a, main [role='button']");
  return botoes.find((item) => {
    const texto = normalizarTexto(item.textContent || item.getAttribute("aria-label") || "");
    return alvos.some((alvo) => texto.includes(alvo));
  }) || null;
}

function textoPrincipal() {
  const main = document.querySelector("main");
  return normalizarTexto(main?.textContent || "");
}

function erroPrincipalVisivel() {
  const candidatos = elementosVisiveis(
    "main [role='alert'], main [class*='border-red-200'][class*='bg-red-50'], main [class*='border-red-300'][class*='bg-red-50']"
  );
  for (const elemento of candidatos) {
    // Botões de ação destrutiva (ex.: Recusar/Desativar) também usam vermelho,
    // mas não são mensagens de erro. Não devem alterar a orientação do Aprendiz.
    if (
      elemento.matches("button, a, [role='button']") ||
      elemento.closest("button, a, [role='button']")
    ) {
      continue;
    }
    const texto = (elemento.textContent || "").replace(/\s+/g, " ").trim();
    if (texto.length >= 4 && texto.length <= 450) return texto;
  }
  return "";
}

function estaCarregando() {
  const texto = textoPrincipal();
  return texto.includes("carregando") || texto.includes("atualizando repasses");
}

function selectPendentePorOpcao(textoOpcao: string) {
  const alvo = normalizarTexto(textoOpcao);
  const selects = elementosVisiveis("main select").filter(
    (item): item is HTMLSelectElement => item instanceof HTMLSelectElement
  );
  return selects.find((select) => {
    const possui = Array.from(select.options).some((opcao) =>
      normalizarTexto(opcao.textContent || "").includes(alvo)
    );
    return possui && !String(select.value || "").trim();
  }) || null;
}

function checkboxesVisiveis(seletor = "main input[type='checkbox']") {
  return elementosVisiveis(seletor).filter(
    (item): item is HTMLInputElement => item instanceof HTMLInputElement
  );
}

function quantidadeLinhasDeDados() {
  return elementosVisiveis("main tbody tr").filter((linha) => {
    const celulas = linha.querySelectorAll("td");
    if (celulas.length < 2) return false;
    const texto = normalizarTexto(linha.textContent || "");
    return !texto.includes("nenhum") && !texto.includes("carregando");
  }).length;
}

function botaoEstaAtivo(textoAlvo: string) {
  const alvo = normalizarTexto(textoAlvo);
  return elementosVisiveis("main button, main [role='tab']").some((item) => {
    const texto = normalizarTexto(item.textContent || "");
    if (!texto.includes(alvo)) return false;
    const classe = String(item.className || "");
    return (
      classe.includes("bg-xango-primary") ||
      (classe.includes("border-xango-primary") && classe.includes("text-xango-primary")) ||
      item.getAttribute("data-state") === "active" ||
      item.getAttribute("aria-selected") === "true"
    );
  });
}

function orientacaoAprendizDoOrcamento(pathname: string): OrientacaoAprendiz | null {
  if (!pathname.startsWith("/orcamentos")) return null;

  const erro = erroPrincipalVisivel();
  if (erro) {
    return {
      titulo: "Corrija a pendência do orçamento",
      texto: erro,
      dica: "A orientação volta ao fluxo normal assim que a pendência for corrigida.",
      seletores: ["main [role='alert'], main div[class*='border-red-200'][class*='bg-red-50'], main div[class*='border-red-300'][class*='bg-red-50']"],
    };
  }

  if (estaCarregando()) {
    return {
      titulo: "Carregando o orçamento",
      texto: "Aguarde os dados terminarem de carregar. O Modo Aprendiz identifica automaticamente a próxima ação.",
      dica: "Não é necessário recarregar a página enquanto o carregamento estiver ativo.",
      textosAlvo: ["Orçamento", "Orçamentos"],
    };
  }

  if (pathname.startsWith("/orcamentos/modelos")) {
    if (botaoVisivelPorTexto("Salvar modelo")) {
      return {
        titulo: "Revise e salve o modelo",
        texto: "Confira nome, categoria e procedimentos do modelo antes de salvar. Os modelos agilizam orçamentos recorrentes sem congelar preços antigos.",
        dica: "Ao usar um modelo depois, os preços são recalculados com a tabela atual.",
        textosAlvo: ["Salvar modelo"],
      };
    }
    return {
      titulo: "Use modelos para orçamentos recorrentes",
      texto: "Abra um modelo existente para editar ou aplicar, ou crie um novo quando a mesma combinação de procedimentos for usada com frequência.",
      dica: "Mantenha somente modelos realmente úteis para a equipe.",
      textosAlvo: ["Modelos", "Novo modelo"],
    };
  }

  const campoPacienteNovo = campoVisivel('main input[placeholder="Nome do paciente"]');
  const buscaPaciente = campoVisivel('main input[placeholder*="Pesquisar por nome, CPF ou telefone" i]');
  const buscaProcedimento = campoVisivel('main input[placeholder*="ultrassom rins" i]');
  const botaoTrocarPaciente = botaoVisivelPorTexto("Trocar paciente");

  if (campoPacienteNovo || buscaPaciente || buscaProcedimento) {
    if (campoPacienteNovo) {
      if (!campoPacienteNovo.value.trim()) {
        return {
          titulo: "Informe o nome do paciente",
          texto: "Para um orçamento sem cadastro completo, comece pelo nome do paciente.",
          dica: "Neste momento nome e telefone são suficientes; o cadastro completo será exigido na conversão.",
          seletores: ['main input[placeholder="Nome do paciente"]'],
        };
      }
      const telefone = campoVisivel('main input[placeholder*="99999-9999"]');
      const numeros = (telefone?.value || "").replace(/\D/g, "");
      if (telefone && numeros.length < 10) {
        return {
          titulo: "Informe o telefone",
          texto: "Preencha um telefone com DDD para que o orçamento possa ser identificado e retomado depois.",
          dica: "Confira o número antes de salvar.",
          seletores: ['main input[placeholder*="99999-9999"]'],
        };
      }
    } else if (buscaPaciente && !botaoTrocarPaciente) {
      return {
        titulo: "Selecione o paciente",
        texto: "Pesquise por nome, CPF ou telefone e escolha o cadastro correto. Se ele ainda não estiver cadastrado, use a opção Ainda não cadastrado.",
        dica: "Pesquisar antes evita orçamentos vinculados ao paciente errado.",
        seletores: ['main input[placeholder*="Pesquisar por nome, CPF ou telefone" i]'],
      };
    }

    const itensSelecionados = elementosVisiveis('main button[aria-label^="Remover "]').length;
    if (buscaProcedimento && itensSelecionados === 0) {
      return {
        titulo: "Adicione os procedimentos",
        texto: "Pesquise pelo nome, sinônimo ou código TUSS e adicione todos os itens solicitados pelo paciente.",
        dica: "Depois de adicionar, o sistema pedirá a clínica e a unidade de cada procedimento.",
        seletores: ['main input[placeholder*="ultrassom rins" i]'],
      };
    }

    if (selectPendentePorOpcao("Selecione a clínica")) {
      return {
        titulo: "Escolha a clínica de cada item",
        texto: "Há procedimento selecionado sem clínica definida. Escolha a opção correta antes de salvar o orçamento.",
        dica: "Compare o valor exibido e confirme se a clínica atende aquele procedimento.",
        seletores: ["main section select"],
        textosAlvo: ["Clínica"],
      };
    }

    if (selectPendentePorOpcao("Selecione a unidade")) {
      return {
        titulo: "Escolha a unidade",
        texto: "A clínica selecionada possui unidades. Defina o endereço correto para que o preço e a informação impressa fiquem certos.",
        dica: "A unidade pode ter preço específico.",
        textosAlvo: ["Unidade"],
      };
    }

    const salvar = botaoVisivelPorTexto("Salvar orçamento", "Salvar alterações", "Salvar nova cópia");
    if (salvar) {
      return {
        titulo: "Revise e salve o orçamento",
        texto: "Paciente, procedimentos e clínicas estão definidos. Confira validade, condições, valor total e então salve.",
        dica: "Os valores ficam congelados no momento do salvamento para preservar o histórico apresentado ao paciente.",
        textosAlvo: ["Salvar orçamento", "Salvar alterações", "Salvar nova cópia"],
      };
    }
  }

  if (textoPrincipal().includes("converter em atendimento")) {
    const vincular = botaoVisivelPorTexto("Editar e vincular paciente");
    if (vincular) {
      return {
        titulo: "Vincule o paciente antes de converter",
        texto: "Este orçamento ainda não está ligado a um cadastro completo. Vincule o paciente para liberar a conversão em atendimento.",
        dica: "CPF e demais dados obrigatórios serão validados no fluxo de atendimento.",
        textosAlvo: ["Editar e vincular paciente"],
      };
    }

    const caixas = checkboxesVisiveis('main input[type="checkbox"][aria-label^="Selecionar "]');
    if (caixas.length > 0 && !caixas.some((item) => item.checked)) {
      return {
        titulo: "Escolha o que será convertido agora",
        texto: "Marque somente os procedimentos que o paciente deseja seguir neste momento. Os demais continuarão disponíveis no orçamento.",
        dica: "A conversão parcial é permitida.",
        seletores: ['main input[type="checkbox"][aria-label^="Selecionar "]'],
      };
    }
    if (caixas.some((item) => item.checked)) {
      return {
        titulo: "Converta os itens selecionados",
        texto: "Os procedimentos desejados já estão marcados. Clique em Converter selecionados para abrir o atendimento com esses itens.",
        dica: "Os itens não selecionados permanecem no orçamento.",
        textosAlvo: ["Converter selecionados"],
      };
    }

    return {
      titulo: "Orçamento pronto para acompanhamento",
      texto: "Confira os itens, o histórico e as ações disponíveis. Você pode imprimir, compartilhar, duplicar ou criar um novo orçamento.",
      dica: "Orçamentos encerrados ou vencidos permanecem preservados no histórico.",
      textosAlvo: ["Itens do orçamento", "Duplicar"],
    };
  }

  const buscaLista = campoVisivel('main input[placeholder*="Código, paciente, telefone" i]');
  if (buscaLista) {
    if (buscaLista.value.trim() && quantidadeLinhasDeDados() > 0) {
      return {
        titulo: "Abra o orçamento localizado",
        texto: "A busca já encontrou resultados. Abra o orçamento correto para conferir os itens, editar, duplicar ou converter.",
        dica: "Confira o código e o paciente antes de entrar no registro.",
        textosAlvo: ["Orçamentos"],
        seletores: ["main tbody"],
      };
    }
    if (buscaLista.value.trim() && quantidadeLinhasDeDados() === 0) {
      return {
        titulo: "Ajuste a busca ou os filtros",
        texto: "Nenhum orçamento corresponde aos filtros atuais. Revise o texto pesquisado, período ou situação.",
        dica: "Você também pode limpar os filtros e pesquisar novamente.",
        seletores: ['main input[placeholder*="Código, paciente, telefone" i]'],
      };
    }
    return {
      titulo: "Localize ou crie um orçamento",
      texto: "Use a busca, período e situação para encontrar um orçamento existente. Para uma nova cotação, use Novo orçamento.",
      dica: "Os cards de situação também funcionam como filtros rápidos.",
      seletores: ['main input[placeholder*="Código, paciente, telefone" i]'],
    };
  }

  return null;
}

function orientacaoAprendizDasGuias(pathname: string): OrientacaoAprendiz | null {
  if (!pathname.startsWith("/guias")) return null;
  const erro = erroPrincipalVisivel();
  if (erro) {
    return {
      titulo: "Há uma pendência nesta guia",
      texto: erro,
      dica: "Resolva a mensagem indicada antes de continuar.",
      seletores: ["main [role='alert'], main div[class*='border-red-200'][class*='bg-red-50'], main div[class*='border-red-300'][class*='bg-red-50']"],
    };
  }
  if (estaCarregando()) {
    return {
      titulo: "Carregando guias",
      texto: "Aguarde a atualização da lista. A orientação será ajustada assim que os vouchers estiverem disponíveis.",
      textosAlvo: ["Guias"],
    };
  }

  const painel = elementosVisiveis("main aside.fixed, main aside[class*='fixed']")[0];
  if (painel) {
    const confirmar = botaoVisivelPorTexto("Confirmar atendimento realizado");
    if (confirmar) {
      const data = campoVisivel("main aside input[type='date']");
      if (data && !data.value) {
        return {
          titulo: "Informe a data da realização",
          texto: "A clínica informou que o procedimento foi realizado. Registre a data correta antes de confirmar.",
          dica: "Só confirme depois de receber a informação da clínica.",
          seletores: ["main aside input[type='date']"],
        };
      }
      return {
        titulo: "Confirme o atendimento realizado",
        texto: "A guia está quitada e a data da realização está preenchida. Confirme para registrar a execução do procedimento.",
        dica: "Na V2 esta confirmação será feita pela própria clínica parceira.",
        textosAlvo: ["Confirmar atendimento realizado"],
      };
    }

    if (normalizarTexto(painel.textContent || "").includes("atendimento confirmado")) {
      return {
        titulo: "Guia realizada e confirmada",
        texto: "A realização já foi registrada. Use Imprimir / reimprimir quando precisar do voucher ou Abra atendimento para consultar o histórico completo.",
        dica: "Não é necessário registrar nova confirmação.",
        textosAlvo: ["Imprimir / reimprimir", "Abrir atendimento"],
      };
    }

    return {
      titulo: "Confira a situação antes de agir",
      texto: "Revise agendamento, financeiro e status da guia. Se houver saldo, estorno ou agendamento pendente, abra o atendimento para resolver pelo fluxo principal.",
      dica: "O voucher deve refletir exatamente a situação registrada no atendimento.",
      textosAlvo: ["Abrir atendimento"],
    };
  }

  const busca = campoVisivel('main input[placeholder*="Pesquisar por voucher" i]');
  if (!busca && /^\/guias\/\d+/.test(pathname)) {
    return {
      titulo: "Confira os dados desta guia",
      texto: "Revise paciente, clínica, procedimentos, agendamento e financeiro. Execute somente as ações compatíveis com o status atual do voucher.",
      dica: "Quando precisar corrigir pagamento ou agendamento, abra o atendimento relacionado.",
      textosAlvo: ["Guia", "Voucher", "Abrir atendimento", "Imprimir"],
    };
  }
  if (busca) {
    if (busca.value.trim() && quantidadeLinhasDeDados() === 0) {
      return {
        titulo: "Nenhuma guia encontrada",
        texto: "Revise a busca ou troque o filtro de situação para localizar o voucher.",
        dica: "Você pode pesquisar por voucher, atendimento, paciente, CPF, clínica, unidade ou procedimento.",
        seletores: ['main input[placeholder*="Pesquisar por voucher" i]'],
      };
    }
    if (quantidadeLinhasDeDados() > 0) {
      return {
        titulo: "Abra a guia que precisa de ação",
        texto: "Clique na linha do voucher para conferir detalhes. Priorize guias com saldo, estorno pendente ou que aguardam confirmação.",
        dica: "Os filtros de situação reduzem rapidamente a lista.",
        seletores: ["main tbody"],
      };
    }
  }

  return {
    titulo: "Pesquise e filtre os vouchers",
    texto: "Use a pesquisa e os filtros de status para localizar a guia correta antes de abrir os detalhes.",
    dica: "Evite agir somente pelo nome do paciente; confirme também o código do voucher e a clínica.",
    seletores: ['main input[placeholder*="Pesquisar por voucher" i]'],
  };
}

function orientacaoAprendizDaAgenda(pathname: string): OrientacaoAprendiz | null {
  if (!pathname.startsWith("/agenda")) return null;
  const erro = erroPrincipalVisivel();
  if (erro) {
    return {
      titulo: "Não foi possível carregar a agenda",
      texto: erro,
      dica: "Use Atualizar depois de verificar a conexão ou corrigir a situação indicada.",
      textosAlvo: ["Atualizar"],
    };
  }
  if (estaCarregando()) {
    return {
      titulo: "Atualizando a agenda",
      texto: "Aguarde o carregamento dos procedimentos da data selecionada.",
      textosAlvo: ["Agenda"],
    };
  }

  const busca = campoVisivel('main input[placeholder*="Pesquisar paciente, telefone" i]');
  if (busca?.value.trim()) {
    const semResultado = textoPrincipal().includes("nenhum agendamento encontrado");
    if (semResultado) {
      return {
        titulo: "Ajuste a pesquisa ou a data",
        texto: "Não há agendamento correspondente à busca atual. Revise o termo pesquisado ou selecione outra data.",
        dica: "A busca aceita paciente, telefone, procedimento, clínica ou código.",
        seletores: ['main input[placeholder*="Pesquisar paciente, telefone" i]'],
      };
    }
    return {
      titulo: "Abra o agendamento encontrado",
      texto: "Clique no registro correto para abrir o atendimento completo e tratar a situação necessária.",
      dica: "Confira horário, paciente, procedimento, clínica e status antes de abrir.",
      textosAlvo: ["Agendamentos do dia"],
    };
  }

  if (textoPrincipal().includes("nenhum agendamento encontrado")) {
    return {
      titulo: "Escolha a data que deseja consultar",
      texto: "Não há procedimentos com os filtros atuais. Use Hoje, dia anterior, próximo dia ou o campo de data para navegar na agenda.",
      dica: "Depois que houver registros, clique em um deles para abrir o atendimento.",
      seletores: ['main input[type="date"]'],
    };
  }

  return {
    titulo: "Revise os agendamentos do dia",
    texto: "Comece pelas pendências e confirme os horários previstos. Quando precisar agir em um caso, clique no registro para abrir o atendimento correspondente.",
    dica: "A agenda é uma visão operacional; alterações de pagamento ou guia continuam sendo feitas no atendimento.",
    textosAlvo: ["Agendamentos do dia"],
  };
}

function orientacaoAprendizDosPacientes(pathname: string): OrientacaoAprendiz | null {
  if (!pathname.startsWith("/pacientes")) return null;

  const detalhe = /^\/pacientes\/\d+/.test(pathname);
  if (detalhe) {
    if (botaoVisivelPorTexto("Salvar cadastro")) {
      return {
        titulo: "Complete e salve o cadastro",
        texto: "Revise os dados do paciente e preencha as informações faltantes. Depois salve o cadastro para voltar à ficha.",
        dica: "CPF, telefone e os dados obrigatórios devem estar corretos antes da emissão de guia.",
        textosAlvo: ["Salvar cadastro"],
      };
    }

    const texto = textoPrincipal();
    if (texto.includes("cadastro incompleto") && botaoVisivelPorTexto("Editar cadastro")) {
      return {
        titulo: "Complete o cadastro antes de emitir guia",
        texto: "Este paciente possui dados obrigatórios pendentes. Use Editar cadastro e complete o que está indicado no aviso amarelo.",
        dica: "Enquanto o cadastro estiver incompleto, a impressão de guia pode ficar bloqueada.",
        textosAlvo: ["Editar cadastro"],
      };
    }

    if (botaoVisivelPorTexto("Novo atendimento")) {
      return {
        titulo: "Paciente localizado",
        texto: "Confira os dados cadastrais, vínculos, próximos agendamentos, saldo e histórico. Para iniciar um novo contato com este paciente, use Novo atendimento.",
        dica: "Se precisar corrigir dados pessoais, use Editar cadastro sem voltar para a lista.",
        textosAlvo: ["Novo atendimento"],
      };
    }

    return {
      titulo: "Revise a ficha do paciente",
      texto: "Confira dados pessoais, vínculos familiares, pendências e histórico antes de iniciar uma nova ação.",
      dica: "Abra um atendimento do histórico somente quando precisar continuar aquele caso específico.",
      textosAlvo: ["Histórico de atendimentos", "Familiares"],
    };
  }

  const busca = campoVisivel(
    'main input[placeholder*="Pesquisar por nome" i], main input[placeholder*="CPF" i]'
  );
  if (busca?.value.trim()) {
    return {
      titulo: "Abra o paciente correto",
      texto: "Confira nome, CPF e contato nos resultados e abra o cadastro existente quando encontrar a pessoa correta.",
      dica: "Criar outro cadastro para a mesma pessoa gera duplicidade e dificulta o histórico.",
      textosAlvo: ["Lista de pacientes"],
    };
  }

  return {
    titulo: "Evite cadastro duplicado",
    texto: "Pesquise primeiro por nome, CPF ou telefone. Abra o cadastro existente sempre que possível antes de criar um novo paciente.",
    dica: "Revise dados cadastrais e vínculos quando encontrar informações incompletas.",
    seletores: [
      'main input[placeholder*="Pesquisar por nome" i]',
      'main input[placeholder*="CPF" i]',
    ],
  };
}

function orientacaoAprendizDasClinicas(pathname: string): OrientacaoAprendiz | null {
  if (!pathname.startsWith("/clinicas")) return null;

  if (/^\/clinicas\/\d+\/editar/.test(pathname)) {
    const salvar = botaoVisivelPorTexto("Salvar alterações");
    if (salvar && !salvar.hasAttribute("disabled")) {
      return {
        titulo: "Revise e salve a clínica",
        texto: "Confira dados cadastrais, responsáveis, unidades e regras de atendimento antes de salvar as alterações.",
        dica: "Mudanças de endereço ou preço podem afetar novos atendimentos.",
        textosAlvo: ["Salvar alterações"],
      };
    }
    return {
      titulo: "Atualize somente o necessário",
      texto: "Revise os blocos da clínica e altere os dados que realmente precisam de atualização.",
      dica: "Confirme principalmente documento, contatos e unidades de atendimento.",
      seletores: ["main section", "main form"],
    };
  }

  if (/^\/clinicas\/\d+/.test(pathname)) {
    if (botaoVisivelPorTexto("Adicionar selecionados")) {
      return {
        titulo: "Escolha os procedimentos da clínica",
        texto: "Pesquise no catálogo, marque os procedimentos que devem entrar na tabela desta clínica e confirme em Adicionar selecionados.",
        dica: "Depois revise os valores e exceções por unidade.",
        textosAlvo: ["Adicionar selecionados"],
      };
    }
    if (botaoVisivelPorTexto("Importar selecionados")) {
      return {
        titulo: "Revise a importação antes de confirmar",
        texto: "Confira os procedimentos reconhecidos, valores e possíveis divergências antes de importar a tabela para a clínica.",
        dica: "Linhas com erro ou dúvida devem ser corrigidas antes da confirmação.",
        textosAlvo: ["Importar selecionados"],
      };
    }
    if (botaoVisivelPorTexto("Editar dados")) {
      return {
        titulo: "Confira a clínica selecionada",
        texto: "Revise unidades, contatos e principalmente Procedimentos e preços. Use Editar dados somente quando precisar alterar o cadastro da clínica.",
        dica: "Os valores desta tabela são usados nos novos orçamentos e atendimentos.",
        textosAlvo: ["Procedimentos e preços", "Unidades de atendimento", "Editar dados"],
      };
    }
  }

  const busca = campoVisivel('main input[placeholder*="Pesquisar" i], main input[placeholder*="clínica" i]');
  if (busca?.value.trim()) {
    return {
      titulo: "Abra a clínica correta",
      texto: "Confira nome, documento e unidade nos resultados e abra a clínica que deseja consultar ou alterar.",
      dica: "Evite cadastrar uma nova clínica antes de confirmar que ela ainda não existe.",
      textosAlvo: ["Clínicas"],
    };
  }

  return {
    titulo: "Localize a clínica parceira",
    texto: "Pesquise a clínica antes de criar ou alterar cadastros. Ao abrir uma clínica, você poderá revisar unidades, procedimentos, preços e responsáveis.",
    dica: "Confirme sempre a unidade correta quando a clínica possuir mais de um endereço.",
    seletores: ['main input[placeholder*="Pesquisar" i]', 'main input[placeholder*="clínica" i]'],
    textosAlvo: ["Clínicas"],
  };
}

function orientacaoAprendizDosProcedimentos(pathname: string): OrientacaoAprendiz | null {
  if (!pathname.startsWith("/procedimentos")) return null;

  const salvar = botaoVisivelPorTexto("Salvar procedimento", "Salvar mesmo assim");
  if (salvar) {
    const nome = campoVisivel('main input[placeholder*="nome" i]');
    if (nome && !nome.value.trim()) {
      return {
        titulo: "Informe o nome do procedimento",
        texto: "Preencha o nome principal e depois confira TUSS, categoria, CH, aliases e preparo.",
        dica: "Use a nomenclatura padronizada para facilitar buscas e evitar duplicidades.",
        seletores: ['main input[placeholder*="nome" i]'],
      };
    }
    return {
      titulo: "Revise antes de salvar o procedimento",
      texto: "Confira nome, TUSS, CH, categoria, aliases e preparo. Salve somente depois de confirmar que não existe outro procedimento equivalente.",
      dica: "Aliases bem definidos melhoram a Pesquisa Global e o atendimento.",
      textosAlvo: ["Salvar procedimento", "Salvar mesmo assim"],
    };
  }

  if (botaoVisivelPorTexto("Adicionar ao Catálogo Digna")) {
    return {
      titulo: "Confira a referência TUSS antes de adicionar",
      texto: "Revise a nomenclatura oficial, código TUSS, CH e nome que será usado no Catálogo Digna antes de adicionar a referência.",
      dica: "A Base Mestre ajuda a reduzir cadastros duplicados e nomes divergentes.",
      textosAlvo: ["Adicionar ao Catálogo Digna"],
    };
  }

  const painel = elementosVisiveis("main aside").find((item) =>
    normalizarTexto(item.textContent || "").includes("clinicas e precos")
  );
  if (painel) {
    return {
      titulo: "Revise o procedimento selecionado",
      texto: "Confira TUSS, CH, categoria, sinônimos, preços por clínica e preparo. Se encontrar algo incorreto, use Editar procedimento.",
      dica: "Os preços e aliases daqui aparecem no atendimento e na Pesquisa Global.",
      textosAlvo: ["Clínicas e preços", "Editar procedimento"],
    };
  }

  const busca = campoVisivel('main input[placeholder*="Nome, sinônimo" i], main input[placeholder*="TUSS" i]');
  if (busca?.value.trim()) {
    return {
      titulo: "Abra o procedimento para conferir os detalhes",
      texto: "Selecione o resultado correto para revisar TUSS, CH, aliases, preparo e preços por clínica.",
      dica: "Se não encontrar pelo nome principal, tente um sinônimo ou o código TUSS.",
      seletores: ["main tbody"],
      textosAlvo: ["PROCEDIMENTO"],
    };
  }

  return {
    titulo: "Pesquise antes de cadastrar",
    texto: "Procure pelo nome, sinônimo ou TUSS antes de criar um procedimento. Isso evita registros duplicados e melhora a consistência da base.",
    dica: "Depois de selecionar um resultado, o Modo Aprendiz passa a orientar a conferência do procedimento aberto.",
    seletores: [
      'main input[placeholder*="Nome, sinônimo" i]',
      'main input[placeholder*="TUSS" i]',
    ],
  };
}

function orientacaoAprendizDosRepasses(): OrientacaoAprendiz {
  const erro = erroPrincipalVisivel();
  if (erro) {
    return {
      titulo: "Corrija a pendência do repasse",
      texto: erro,
      dica: "Não avance para pagamento enquanto houver erro na operação.",
      seletores: ["main [role='alert'], main div[class*='border-red-200'][class*='bg-red-50'], main div[class*='border-red-300'][class*='bg-red-50']"],
    };
  }

  if (botaoVisivelPorTexto("Salvar pagamento")) {
    const data = campoVisivel("main .fixed input[type='date']");
    if (data && !data.value) {
      return {
        titulo: "Informe a data efetiva do pagamento",
        texto: "Registre a data em que o repasse realmente foi pago à clínica.",
        dica: "A data solicitada e a data efetiva podem ser diferentes.",
        seletores: ["main .fixed input[type='date']"],
      };
    }
    return {
      titulo: "Confira e salve o pagamento",
      texto: "Revise data e forma de pagamento. Comprovante e nota fiscal são opcionais nesta etapa e podem ser anexados depois.",
      dica: "Ao salvar, o repasse passa para o histórico de concluídos.",
      textosAlvo: ["Salvar pagamento"],
    };
  }

  if (botaoVisivelPorTexto("Fechar solicitação manual")) {
    if (selectPendentePorOpcao("Selecione a clínica")) {
      return {
        titulo: "Selecione a clínica",
        texto: "Escolha a clínica para listar as guias confirmadas disponíveis para uma solicitação manual de repasse.",
        dica: "Use este recurso administrativo somente para exceções.",
        seletores: ["main section select"],
        textosAlvo: ["Clínica"],
      };
    }
    const data = elementosVisiveis("main section input[type='date']").find(
      (item) => item instanceof HTMLInputElement && !item.value
    ) as HTMLInputElement | undefined;
    if (data) {
      return {
        titulo: "Defina a data solicitada para pagamento",
        texto: "Informe uma data dentro do limite permitido para esta solicitação de repasse.",
        dica: "O sistema respeita a janela operacional configurada.",
        seletores: ["main section input[type='date']"],
        textosAlvo: ["Data solicitada para pagamento"],
      };
    }
    const caixas = checkboxesVisiveis("main section input[type='checkbox']");
    if (caixas.length > 0 && !caixas.some((item) => item.checked)) {
      return {
        titulo: "Selecione as guias do repasse",
        texto: "Marque somente as guias confirmadas que devem fazer parte desta solicitação.",
        dica: "Confira paciente, voucher, data da confirmação e valor de repasse.",
        seletores: ["main section input[type='checkbox']"],
      };
    }
    return {
      titulo: "Crie a solicitação de repasse",
      texto: "Clínica, data e guias já estão definidas. Confira o valor total selecionado e crie a solicitação.",
      dica: "Ela entrará automaticamente em análise.",
      textosAlvo: ["Criar solicitação"],
    };
  }

  if (estaCarregando()) {
    return {
      titulo: "Atualizando repasses",
      texto: "Aguarde a fila terminar de carregar antes de analisar ou pagar solicitações.",
      textosAlvo: ["Repasses às clínicas"],
    };
  }

  const colocarAnalise = botaoVisivelPorTexto("Colocar em análise");
  if (colocarAnalise) {
    return {
      titulo: "Comece a análise do repasse",
      texto: "Há solicitação aguardando análise. Confira clínica, data solicitada, guias e valor; então coloque a solicitação em análise.",
      dica: "Abra Ver detalhes se precisar conferir os atendimentos vinculados.",
      textosAlvo: ["Colocar em análise"],
    };
  }

  const aprovar = botaoVisivelPorTexto("Aprovar repasse");
  if (aprovar) {
    return {
      titulo: "Decida a solicitação em análise",
      texto: "Revise os dados e documentos do repasse. Se estiver correto, aprove; se houver problema, recuse informando o motivo.",
      dica: "A aprovação libera a etapa de registro do pagamento.",
      textosAlvo: ["Aprovar repasse"],
    };
  }

  const registrar = botaoVisivelPorTexto("Registrar pagamento");
  if (registrar) {
    return {
      titulo: "Registre o pagamento aprovado",
      texto: "Este repasse já foi aprovado. Abra Registrar pagamento para informar a baixa financeira.",
      dica: "Confira o valor total antes de registrar a saída.",
      textosAlvo: ["Registrar pagamento"],
    };
  }

  if (textoPrincipal().includes("nenhum repasse pendente")) {
    return {
      titulo: "Fila de repasses em dia",
      texto: "Não há solicitação pendente exigindo ação. Use Histórico para consultar concluídos ou Nova solicitação manual somente quando houver uma exceção administrativa.",
      dica: "A rotina normal de solicitação será assumida pela clínica no Portal Parceiro da V2.",
      textosAlvo: ["Histórico", "Nova solicitação manual"],
    };
  }

  return {
    titulo: "Trabalhe a fila de repasses",
    texto: "Use a aba Pendentes como fila de trabalho. Analise primeiro solicitações novas, depois aprove ou recuse e registre o pagamento das aprovadas.",
    dica: "Busca, clínica e status ajudam a reduzir a fila.",
    textosAlvo: ["Fila de repasses pendentes"],
  };
}

function orientacaoAprendizDoFinanceiro(pathname: string): OrientacaoAprendiz | null {
  if (!pathname.startsWith("/financeiro")) return null;
  if (pathname.startsWith("/financeiro/repasses")) return orientacaoAprendizDosRepasses();

  const erro = erroPrincipalVisivel();
  if (erro) {
    return {
      titulo: "Não foi possível atualizar o Financeiro",
      texto: erro,
      dica: "Revise os filtros e use Atualizar depois de corrigir a situação.",
      textosAlvo: ["Atualizar"],
    };
  }
  if (estaCarregando()) {
    return {
      titulo: "Atualizando o Financeiro",
      texto: "Aguarde os recebimentos, estornos e repasses do período terminarem de carregar.",
      textosAlvo: ["Financeiro"],
    };
  }

  const busca = campoVisivel('main input[placeholder*="Paciente, clínica, voucher" i]');
  if (busca?.value.trim()) {
    return {
      titulo: "Confira os resultados filtrados",
      texto: "A busca está ativa. Revise movimentações, guias com saldo e repasses relacionados ao termo pesquisado.",
      dica: "Clique em um registro para abrir a guia ou o repasse correspondente.",
      textosAlvo: ["Movimentações do período"],
    };
  }

  const texto = textoPrincipal();
  if (texto.includes("guias a receber") && !texto.includes("nenhuma guia com saldo pendente")) {
    return {
      titulo: "Priorize as guias com saldo",
      texto: "Há guias a receber no período. Abra cada item para conferir o atendimento e resolver pagamento ou estorno pendente.",
      dica: "O card A receber leva diretamente para esta fila.",
      textosAlvo: ["Guias a receber"],
    };
  }

  if (texto.includes("repasses a pagar") && !texto.includes("nenhum repasse pendente no período")) {
    return {
      titulo: "Há repasses para tratar",
      texto: "Existem guias confirmadas com repasse pendente. Abra o item ou use Gerenciar repasses para seguir a análise e o pagamento.",
      dica: "Repasses ficam separados dos recebimentos dos pacientes.",
      textosAlvo: ["Repasses a pagar", "Gerenciar repasses"],
    };
  }

  return {
    titulo: "Confira o período financeiro",
    texto: "Defina o período e a clínica quando necessário. Use os cards para navegar entre recebimentos, estornos, valores a receber e repasses.",
    dica: "Mês atual restaura rapidamente o período padrão.",
    seletores: ['main input[type="date"]'],
  };
}

function orientacaoAprendizDosRelatorios(pathname: string): OrientacaoAprendiz | null {
  if (!pathname.startsWith("/relatorios")) return null;
  const erro = erroPrincipalVisivel();
  if (erro) {
    return {
      titulo: "Revise os filtros do relatório",
      texto: erro,
      dica: "Corrija a condição indicada e aplique novamente.",
      seletores: ["main [role='alert'], main div[class*='border-red-200'][class*='bg-red-50'], main div[class*='border-red-300'][class*='bg-red-50']"],
    };
  }
  if (estaCarregando()) {
    return {
      titulo: "Gerando os dados do relatório",
      texto: "Aguarde o carregamento antes de interpretar indicadores ou exportar informações.",
      textosAlvo: ["Relatórios"],
    };
  }

  const aba = botaoEstaAtivo("Financeiros")
    ? "financeiros"
    : botaoEstaAtivo("Produção")
      ? "produção"
      : "operacionais";
  const busca = elementosVisiveis("main input[placeholder]").find(
    (item) => item instanceof HTMLInputElement && item.placeholder && item.value.trim()
  ) as HTMLInputElement | undefined;

  if (busca && botaoVisivelPorTexto("Aplicar")) {
    return {
      titulo: `Aplique os filtros ${aba}`,
      texto: "Você alterou a busca. Clique em Aplicar para atualizar os indicadores e a tabela com os critérios atuais.",
      dica: "Confira também o período e os demais filtros da aba ativa.",
      textosAlvo: ["Aplicar"],
    };
  }

  if (quantidadeLinhasDeDados() > 0) {
    const subtipo = aba === "financeiros"
      ? (botaoEstaAtivo("Repasses às clínicas") ? "repasses às clínicas" : "recebimentos e estornos")
      : aba === "produção"
        ? (botaoEstaAtivo("Produção por procedimento") ? "produção por procedimento" : "produção por clínica")
        : (botaoEstaAtivo("Guias / Vouchers") ? "guias e vouchers" : "atendimentos");
    return {
      titulo: `Analise ${subtipo}`,
      texto: "Os dados do período estão carregados. Confira os indicadores e a tabela; quando precisar, use Exportar CSV ou Imprimir / PDF.",
      dica: "Antes de comparar números, confirme a aba e o período selecionados.",
      textosAlvo: [
        aba === "financeiros" ? "Recebimentos e estornos do período" :
        aba === "produção" ? "Produção por clínica" : "Atendimentos do período",
        "Exportar CSV",
      ],
    };
  }

  return {
    titulo: `Defina os filtros ${aba}`,
    texto: "Escolha o período e os filtros da aba ativa e clique em Aplicar. Os grupos Operacionais, Financeiros e Produção usam critérios próprios.",
    dica: "Limpar restaura os filtros padrão da seção atual.",
    seletores: ['main input[type="date"]'],
  };
}

function orientacaoAprendizDasConfiguracoes(pathname: string): OrientacaoAprendiz | null {
  if (!pathname.startsWith("/configuracoes")) return null;
  const erro = erroPrincipalVisivel();
  if (erro) {
    return {
      titulo: "Revise a configuração informada",
      texto: erro,
      dica: "Não salve enquanto houver uma validação pendente.",
      seletores: ["main [role='alert'], main div[class*='border-red-200'][class*='bg-red-50'], main div[class*='border-red-300'][class*='bg-red-50']"],
    };
  }

  if (pathname.startsWith("/configuracoes/usuarios")) {
    const salvarUsuario = botaoVisivelPorTexto("Salvar usuário");
    if (salvarUsuario) {
      const labels = elementosVisiveis("main label");
      const campoPorRotulo = (rotulo: string) => {
        const alvo = normalizarTexto(rotulo);
        for (const label of labels) {
          if (!normalizarTexto(label.textContent || "").includes(alvo)) continue;
          const campo = label.querySelector("input, select, textarea");
          if (campo instanceof HTMLInputElement || campo instanceof HTMLSelectElement || campo instanceof HTMLTextAreaElement) return campo;
        }
        return null;
      };
      const nome = campoPorRotulo("Nome");
      if (nome && !nome.value.trim()) {
        return {
          titulo: "Informe o nome do usuário",
          texto: "Preencha o nome do funcionário que terá acesso ao sistema.",
          dica: "Use um nome que facilite a identificação nos históricos e relatórios.",
          textosAlvo: ["Nome"],
        };
      }
      const email = campoPorRotulo("E-mail");
      if (email && !email.value.trim()) {
        return {
          titulo: "Informe o e-mail de acesso",
          texto: "Digite o e-mail que será usado no login do funcionário.",
          dica: "Confira o endereço antes de salvar.",
          textosAlvo: ["E-mail"],
        };
      }
      const senha = campoPorRotulo("Senha temporária");
      if (senha && !senha.value.trim()) {
        return {
          titulo: "Defina a senha temporária",
          texto: "Crie a senha inicial. O usuário deverá trocá-la no primeiro login quando essa regra estiver ativa.",
          dica: "Depois revise perfil, permissões e opções de treinamento.",
          textosAlvo: ["Senha temporária"],
        };
      }
      return {
        titulo: "Revise perfil, permissões e treinamento",
        texto: "Confira o perfil do usuário, permissões personalizadas e se Tour Guiado ou Modo Aprendiz devem ficar ativos. Depois salve o usuário.",
        dica: "Conceda somente os acessos necessários à função.",
        textosAlvo: ["Salvar usuário"],
      };
    }

    const novo = botaoVisivelPorTexto("Novo usuário");
    return {
      titulo: novo ? "Gerencie usuários e permissões" : "Consulte os usuários",
      texto: novo
        ? "Abra Novo usuário para cadastrar um funcionário ou use Editar em um usuário existente para ajustar perfil, permissões e treinamento."
        : "Seu perfil permite consultar os usuários desta organização. Abra os registros disponíveis conforme sua permissão.",
      dica: "Mudanças de acesso devem seguir a função real do funcionário.",
      textosAlvo: novo ? ["Novo usuário"] : ["Usuários e permissões"],
    };
  }

  if (pathname.startsWith("/configuracoes/assinatura")) {
    return {
      titulo: "Confira assinatura e faturamento",
      texto: "Revise o status da assinatura, plano e faturas. Esta área é administrativa e não interfere no fluxo diário de atendimento.",
      dica: "Faturas vencidas ou assinatura suspensa devem ser tratadas pela administração.",
      textosAlvo: ["Assinatura", "Faturas"],
    };
  }

  if (pathname.startsWith("/configuracoes/gerais") || pathname.startsWith("/configuracoes/operacionais")) {
    const salvar = botaoVisivelPorTexto("Salvar configurações");
    if (salvar && !salvar.hasAttribute("disabled")) {
      return {
        titulo: "Há alterações prontas para salvar",
        texto: "Revise os parâmetros modificados e clique em Salvar configurações quando tiver certeza.",
        dica: "Algumas mudanças passam a valer somente para novos registros.",
        textosAlvo: ["Salvar configurações"],
      };
    }
    return {
      titulo: "Revise os parâmetros antes de alterar",
      texto: "Estas configurações afetam regras operacionais, financeiras ou documentos. Revise os blocos abaixo, altere somente o necessário e confira o impacto antes de salvar.",
      dica: "Se nenhum valor foi modificado, o botão de salvar permanece indisponível.",
      seletores: [
        "main div.space-y-5:has(> section)",
        "main form",
        "main section",
      ],
    };
  }

  return {
    titulo: "Escolha a área de configuração",
    texto: "Entre apenas na seção que precisa ser ajustada: dados gerais, usuários e permissões, parâmetros operacionais/financeiros ou assinatura.",
    dica: "Configurações são administrativas; evite alterações durante um atendimento sem necessidade.",
    seletores: [
      'main div.grid:has(> a[href="/configuracoes/gerais"])',
      'main a[href="/configuracoes/gerais"]',
    ],
  };
}

function orientacaoAprendizDaPagina(pathname: string): OrientacaoAprendiz {
  if (pathname.startsWith("/atendimentos/novo") || /^\/atendimentos\/\d+/.test(pathname)) {
    const orientacaoDinamica = orientacaoAprendizDoAtendimento();
    if (orientacaoDinamica) return orientacaoDinamica;

    const etapa = etapaAtivaDoAtendimento();
    if (etapa === "procedimento") {
      return {
        titulo: "Etapa 2 · Procedimentos",
        texto: "Pesquise e selecione todos os exames ou consultas solicitados pelo paciente. Você pode usar o nome principal ou um sinônimo cadastrado.",
        dica: "Antes de continuar, confira se nenhum procedimento do pedido médico ficou de fora.",
        seletores: ['main input[placeholder*="procedimento" i]'],
        textosAlvo: ["Procedimento"],
      };
    }
    if (etapa === "clinica") {
      return {
        titulo: "Etapa 3 · Clínica e agendamento",
        texto: "Escolha a clínica e a unidade corretas para cada procedimento. Depois informe data e horário, aguardando clínica ou ordem de chegada.",
        dica: "Confira o valor e a unidade antes de avançar, principalmente quando uma clínica possui mais de um endereço.",
        textosAlvo: ["Clínica e agendamento"],
      };
    }
    if (etapa === "pagamento") {
      return {
        titulo: "Etapa 4 · Guias e pagamento",
        texto: "Confira as guias geradas, os valores de cada uma e registre o pagamento conforme o paciente for quitando os procedimentos.",
        dica: "Uma guia só deve seguir para realização quando as regras de pagamento estiverem atendidas.",
        textosAlvo: ["Guias / Pagamento", "Guias e pagamento", "Pagamento"],
      };
    }
    if (etapa === "revisao") {
      return {
        titulo: "Etapa 5 · Revisão",
        texto: "Faça a conferência final do paciente, procedimentos, clínicas, agendamentos e financeiro antes de encerrar o atendimento.",
        dica: "Use esta etapa como uma última checagem para evitar retrabalho depois.",
        textosAlvo: ["Revisão"],
      };
    }
    return {
      titulo: "Etapa 1 · Paciente",
      texto: "Localize primeiro o paciente pelo nome, CPF ou telefone. Se ele ainda não existir, use Novo paciente para fazer o cadastro.",
      dica: "Confirme que selecionou a pessoa correta antes de seguir para os procedimentos.",
      seletores: ['main input[placeholder*="nome" i]', 'main input[placeholder*="CPF" i]', 'main input[placeholder*="telefone" i]'],
      textosAlvo: ["Paciente"],
    };
  }

  const orientacaoOrcamento = orientacaoAprendizDoOrcamento(pathname);
  if (orientacaoOrcamento) return orientacaoOrcamento;

  const orientacaoGuias = orientacaoAprendizDasGuias(pathname);
  if (orientacaoGuias) return orientacaoGuias;

  const orientacaoAgenda = orientacaoAprendizDaAgenda(pathname);
  if (orientacaoAgenda) return orientacaoAgenda;

  const orientacaoPacientes = orientacaoAprendizDosPacientes(pathname);
  if (orientacaoPacientes) return orientacaoPacientes;

  const orientacaoClinicas = orientacaoAprendizDasClinicas(pathname);
  if (orientacaoClinicas) return orientacaoClinicas;

  const orientacaoProcedimentos = orientacaoAprendizDosProcedimentos(pathname);
  if (orientacaoProcedimentos) return orientacaoProcedimentos;

  const orientacaoFinanceiro = orientacaoAprendizDoFinanceiro(pathname);
  if (orientacaoFinanceiro) return orientacaoFinanceiro;

  const orientacaoRelatorios = orientacaoAprendizDosRelatorios(pathname);
  if (orientacaoRelatorios) return orientacaoRelatorios;

  const orientacaoConfiguracoes = orientacaoAprendizDasConfiguracoes(pathname);
  if (orientacaoConfiguracoes) return orientacaoConfiguracoes;

  if (pathname === "/") {
    return {
      titulo: "Comece pelo que precisa de ação",
      texto: "Use o Dashboard para organizar o dia. Priorize pendências críticas e agendamentos; a Pesquisa Global serve para localizar rapidamente pacientes, procedimentos e preços.",
      dica: "Os cards são clicáveis e levam diretamente para a área relacionada.",
      seletores: ['[data-aprendiz="resumo-dashboard"]'],
    };
  }

  if (pathname.startsWith("/atendimentos")) {
    return {
      titulo: "Localize e continue o atendimento",
      texto: "Pesquise o paciente ou use os filtros de status. Abra o atendimento correto para continuar exatamente de onde o fluxo parou.",
      dica: "Evite iniciar um novo atendimento se já houver um caso em andamento para o mesmo contato.",
      seletores: ['main input[placeholder*="Pesquisar" i]'],
      textosAlvo: ["Atendimentos"],
    };
  }

  if (pathname.startsWith("/orcamentos/novo")) {
    return {
      titulo: "Monte o orçamento com o paciente",
      texto: "Identifique o paciente, adicione os procedimentos e escolha a clínica de cada item. O preço mostrado será congelado quando o orçamento for salvo.",
      dica: "Nome e telefone bastam no orçamento inicial; complete o cadastro quando houver conversão em guia.",
      textosAlvo: ["Novo orçamento", "Paciente"],
    };
  }

  if (pathname.startsWith("/orcamentos")) {
    return {
      titulo: "Acompanhe o orçamento até a conversão",
      texto: "Use os filtros para localizar o orçamento e confira se ele está aberto, parcialmente convertido, encerrado ou vencido.",
      dica: "A conversão pode ser parcial; nem todos os itens precisam virar guia ao mesmo tempo.",
      seletores: ['main input[placeholder*="Pesquisar" i]'],
      textosAlvo: ["Orçamentos"],
    };
  }

  if (pathname.startsWith("/guias")) {
    return {
      titulo: "Confira situação da guia",
      texto: "Verifique pagamento, agendamento e realização antes de executar qualquer ação. Os botões disponíveis mudam conforme o status da guia.",
      dica: "Dê atenção especial a pagamentos parciais, estornos pendentes e guias aguardando confirmação.",
      textosAlvo: ["Guias", "Voucher"],
    };
  }

  if (pathname.startsWith("/agenda")) {
    return {
      titulo: "Organize os atendimentos do dia",
      texto: "Confira a data selecionada e os procedimentos previstos. Use a agenda para acompanhar confirmações e acessar os atendimentos relacionados.",
      dica: "Casos atrasados ou sem confirmação devem ser tratados antes dos demais quando aparecerem como pendência.",
      seletores: ['main input[type="date"]'],
      textosAlvo: ["Agenda"],
    };
  }

  if (pathname.startsWith("/pacientes")) {
    return {
      titulo: "Evite cadastro duplicado",
      texto: "Pesquise primeiro por nome, CPF ou telefone. Abra o cadastro existente sempre que possível antes de criar um novo paciente.",
      dica: "Revise dados cadastrais e vínculos quando encontrar informações incompletas.",
      seletores: ['main input[placeholder*="Pesquisar" i]', 'main input[placeholder*="CPF" i]'],
      textosAlvo: ["Pacientes"],
    };
  }

  if (pathname.startsWith("/clinicas")) {
    return {
      titulo: "Confira clínica, unidade e preços",
      texto: "Use esta área para validar dados da clínica e a tabela de procedimentos. Quando houver unidades, confirme qual endereço e preço pertencem a cada atendimento.",
      dica: "Alterações de preço afetam novos atendimentos; registros antigos preservam seus valores históricos.",
      textosAlvo: ["Clínicas", "Clínica"],
    };
  }

  if (pathname.startsWith("/procedimentos")) {
    return {
      titulo: "Mantenha a base de procedimentos consistente",
      texto: "Pesquise antes de cadastrar. Confira nome, TUSS, aliases, preparo e CH para evitar procedimentos duplicados ou difíceis de localizar.",
      dica: "Os aliases também são usados na Pesquisa Global e no fluxo de atendimento.",
      seletores: ['main input[placeholder*="Pesquisar" i]', 'main input[placeholder*="procedimento" i]'],
      textosAlvo: ["Procedimentos"],
    };
  }

  if (pathname.startsWith("/financeiro")) {
    return {
      titulo: "Trabalhe pelas pendências financeiras",
      texto: "Confira recebimentos, estornos e repasses. Comece pelos itens que precisam de conferência e depois avance para análise, aprovação e pagamento de repasses.",
      dica: "Os valores do Dashboard financeiro levam para estas rotinas.",
      textosAlvo: ["Financeiro", "Repasses"],
    };
  }

  if (pathname.startsWith("/relatorios")) {
    return {
      titulo: "Filtre antes de analisar",
      texto: "Escolha o grupo de relatório, defina o período e aplique os filtros. Depois você pode abrir detalhes, exportar CSV ou imprimir em PDF.",
      dica: "Operacionais, Financeiros e Produção têm filtros próprios; confira a aba ativa antes de interpretar os números.",
      seletores: ['main input[type="date"]'],
      textosAlvo: ["Relatórios"],
    };
  }

  if (pathname.startsWith("/configuracoes")) {
    return {
      titulo: "Altere configurações com atenção",
      texto: "As configurações podem afetar usuários e novos registros. Revise o que está sendo alterado antes de salvar.",
      dica: "Em Usuários e permissões você também controla Tour Guiado e Modo Aprendiz individualmente.",
      textosAlvo: ["Configurações", "Usuários"],
    };
  }

  if (pathname.startsWith("/ajuda")) {
    return {
      titulo: "Use a Central de Ajuda quando precisar revisar",
      texto: "Pesquise tutoriais, consulte materiais e use o Tour desta tela sempre que quiser rever a interface.",
      dica: "O Modo Aprendiz acompanha seu trabalho; a Central de Ajuda fica disponível para consultas mais detalhadas.",
      seletores: ['main input[placeholder*="Central de Ajuda" i]'],
      textosAlvo: ["Central de Ajuda"],
    };
  }

  return {
    titulo: "Orientação desta tela",
    texto: "Observe o título, os filtros e as ações disponíveis. O Modo Aprendiz permanece ativo enquanto seu perfil estiver em treinamento.",
    dica: "Se precisar rever a interface inteira, use Tour desta tela na barra lateral.",
    seletores: ["main"],
  };
}

export function ModoAprendiz() {
  const pathname = usePathname();
  const { recarregarUsuario } = useAuth();
  const [ativo, setAtivo] = useState(false);
  const [automatico, setAutomatico] = useState(false);
  const [passoAtual, setPassoAtual] = useState(0);
  const [retangulo, setRetangulo] = useState<DOMRect | null>(null);
  const [pausandoHoje, setPausandoHoje] = useState(false);
  const [modoAprendizAtivo, setModoAprendizAtivo] = useState(false);
  const [ajudaAprendizAberta, setAjudaAprendizAberta] = useState(true);
  const [orientacao, setOrientacao] = useState<OrientacaoAprendiz | null>(null);
  const [alvoAprendiz, setAlvoAprendiz] = useState<DOMRect | null>(null);
  const [destaqueAprendizAtivo, setDestaqueAprendizAtivo] = useState(false);
  const [passoTourTemAlvo, setPassoTourTemAlvo] = useState(false);
  const [encerrandoAprendiz, setEncerrandoAprendiz] = useState(false);
  const painelAprendizRef = useRef<HTMLDivElement | null>(null);
  const painelTourRef = useRef<HTMLDivElement | null>(null);
  const [tamanhoPainelAprendiz, setTamanhoPainelAprendiz] = useState<TamanhoPainel>({
    width: 384,
    height: 90,
  });
  const [tamanhoPainelTour, setTamanhoPainelTour] = useState<TamanhoPainel>({
    width: 380,
    height: 250,
  });

  const tour = useMemo(() => tourDaPagina(pathname), [pathname]);
  const passos = tour.passos;
  const chavePagina = useMemo(() => chaveDoTour(pathname), [pathname]);

  useEffect(() => {
    let cancelado = false;

    const timerReset = window.setTimeout(() => {
      if (cancelado) return;
      setAtivo(false);
      setAutomatico(false);
      setPassoAtual(0);
      setRetangulo(null);
      setAlvoAprendiz(null);
      setDestaqueAprendizAtivo(false);
      setPassoTourTemAlvo(false);
      setAjudaAprendizAberta(true);
    }, 0);

    const verificarAutomatico = async () => {
      try {
        const resposta = await fetch(`${API_URL}/treinamento/tour/verificar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pagina: chavePagina }),
          cache: "no-store",
        });
        if (!resposta.ok) return;
        const dados = await resposta.json();
        if (cancelado) return;
        setModoAprendizAtivo(dados.modoAprendizAtivo === true);
        if (dados.mostrar === true) {
          setPassoAtual(0);
          setAutomatico(true);
          setAtivo(true);
        }
      } catch {
        // O Tour manual e o tutor permanecem disponíveis quando a API estiver momentaneamente indisponível.
      }
    };

    const timer = window.setTimeout(() => void verificarAutomatico(), 220);

    const ativarManual = () => {
      setPassoAtual(0);
      setAutomatico(false);
      setAtivo(true);
    };

    const desativar = () => {
      setAtivo(false);
      setAutomatico(false);
      setRetangulo(null);
    };

    window.addEventListener("digna:ativar-tour", ativarManual);
    window.addEventListener("digna:desativar-tour", desativar);
    window.addEventListener("digna:ativar-aprendiz", ativarManual);
    window.addEventListener("digna:desativar-aprendiz", desativar);

    return () => {
      cancelado = true;
      window.clearTimeout(timerReset);
      window.clearTimeout(timer);
      window.removeEventListener("digna:ativar-tour", ativarManual);
      window.removeEventListener("digna:desativar-tour", desativar);
      window.removeEventListener("digna:ativar-aprendiz", ativarManual);
      window.removeEventListener("digna:desativar-aprendiz", desativar);
    };
  }, [chavePagina, pathname]);

  useEffect(() => {
    if (!modoAprendizAtivo || ativo) return;

    let cancelado = false;
    let timer: number | null = null;

    const atualizar = () => {
      if (cancelado) return;
      const proxima = orientacaoAprendizDaPagina(pathname);
      setOrientacao((atual) => {
        if (
          atual?.titulo === proxima.titulo &&
          atual?.texto === proxima.texto &&
          atual?.dica === proxima.dica &&
          (atual?.seletores || []).join("|") === (proxima.seletores || []).join("|") &&
          (atual?.textosAlvo || []).join("|") === (proxima.textosAlvo || []).join("|")
        ) {
          return atual;
        }
        return proxima;
      });
    };

    atualizar();
    const observador = new MutationObserver(() => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(atualizar, 120);
    });
    observador.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "class",
        "aria-current",
        "data-state",
        "data-aprendiz-estado",
        "data-aprendiz-alvo",
        "data-aprendiz-detalhe",
      ],
    });
    const atualizarDepoisDeInteracao = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(atualizar, 40);
    };

    document.addEventListener("input", atualizarDepoisDeInteracao, true);
    document.addEventListener("change", atualizarDepoisDeInteracao, true);
    document.addEventListener("click", atualizarDepoisDeInteracao, true);

    const intervalo = window.setInterval(atualizar, 700);

    return () => {
      cancelado = true;
      observador.disconnect();
      document.removeEventListener("input", atualizarDepoisDeInteracao, true);
      document.removeEventListener("change", atualizarDepoisDeInteracao, true);
      document.removeEventListener("click", atualizarDepoisDeInteracao, true);
      window.clearInterval(intervalo);
      if (timer) window.clearTimeout(timer);
    };
  }, [ativo, modoAprendizAtivo, pathname]);

  useEffect(() => {
    if (!ativo) {
      const timer = window.setTimeout(() => {
        setRetangulo(null);
        setPassoTourTemAlvo(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const elemento = primeiroElementoDisponivel(passos[passoAtual]?.seletores);

    if (!elemento) {
      const timer = window.setTimeout(() => {
        setRetangulo(null);
        setPassoTourTemAlvo(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const timerAlvo = window.setTimeout(() => setPassoTourTemAlvo(true), 0);
    elemento.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    let quadro = 0;
    const atualizarRetangulo = () => {
      window.cancelAnimationFrame(quadro);
      quadro = window.requestAnimationFrame(() => {
        setRetangulo(retanguloVisivelDoElemento(elemento));
      });
    };

    atualizarRetangulo();
    const timer = window.setTimeout(atualizarRetangulo, 180);
    const observadorTamanho = new ResizeObserver(atualizarRetangulo);
    observadorTamanho.observe(elemento);
    window.addEventListener("resize", atualizarRetangulo);
    window.addEventListener("scroll", atualizarRetangulo, true);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(timerAlvo);
      window.cancelAnimationFrame(quadro);
      observadorTamanho.disconnect();
      window.removeEventListener("resize", atualizarRetangulo);
      window.removeEventListener("scroll", atualizarRetangulo, true);
    };
  }, [ativo, passoAtual, passos]);

  useEffect(() => {
    if (ativo || !modoAprendizAtivo) {
      const timer = window.setTimeout(() => setAlvoAprendiz(null), 0);
      return () => window.clearTimeout(timer);
    }

    const elemento = elementoDaOrientacao(orientacao);
    if (!elemento) {
      const timer = window.setTimeout(() => {
        setAlvoAprendiz(null);
        if (destaqueAprendizAtivo) setDestaqueAprendizAtivo(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let quadro = 0;
    const atualizar = () => {
      window.cancelAnimationFrame(quadro);
      quadro = window.requestAnimationFrame(() => {
        setAlvoAprendiz(retanguloVisivelDoElemento(elemento));
      });
    };

    atualizar();
    const observadorTamanho = new ResizeObserver(atualizar);
    observadorTamanho.observe(elemento);
    window.addEventListener("resize", atualizar);
    window.addEventListener("scroll", atualizar, true);

    return () => {
      window.cancelAnimationFrame(quadro);
      observadorTamanho.disconnect();
      window.removeEventListener("resize", atualizar);
      window.removeEventListener("scroll", atualizar, true);
    };
  }, [destaqueAprendizAtivo, ativo, modoAprendizAtivo, orientacao]);

  useEffect(() => {
    if (ativo || !modoAprendizAtivo) return;
    const painel = painelAprendizRef.current;
    if (!painel) return;

    let quadro = 0;
    const medir = () => {
      window.cancelAnimationFrame(quadro);
      quadro = window.requestAnimationFrame(() => {
        const ret = painel.getBoundingClientRect();
        setTamanhoPainelAprendiz((atual) => {
          const width = Math.round(ret.width);
          const height = Math.round(ret.height);
          if (atual.width === width && atual.height === height) return atual;
          return { width, height };
        });
      });
    };

    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(painel);
    window.addEventListener("resize", medir);

    return () => {
      window.cancelAnimationFrame(quadro);
      observador.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [ativo, modoAprendizAtivo, ajudaAprendizAberta, orientacao]);

  useEffect(() => {
    if (!ativo) return;
    const painel = painelTourRef.current;
    if (!painel) return;

    let quadro = 0;
    const medir = () => {
      window.cancelAnimationFrame(quadro);
      quadro = window.requestAnimationFrame(() => {
        const ret = painel.getBoundingClientRect();
        setTamanhoPainelTour((atual) => {
          const width = Math.round(ret.width);
          const height = Math.round(ret.height);
          if (atual.width === width && atual.height === height) return atual;
          return { width, height };
        });
      });
    };

    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(painel);
    window.addEventListener("resize", medir);

    return () => {
      window.cancelAnimationFrame(quadro);
      observador.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [ativo, passoAtual]);

  const posicaoPainelAprendiz = posicaoInteligenteDoPainel(
    alvoAprendiz,
    tamanhoPainelAprendiz
  );
  const posicaoPainelTour = posicaoInteligenteDoPainel(retangulo, tamanhoPainelTour);

  async function encerrarModoAprendiz() {
    const confirmar = window.confirm("Deseja encerrar o Modo Aprendiz para o seu usuário?");
    if (!confirmar) return;
    try {
      setEncerrandoAprendiz(true);
      const resposta = await fetch(`${API_URL}/treinamento/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modoAprendizAtivo: false }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        window.alert(dados.erro || "Não foi possível encerrar o Modo Aprendiz.");
        return;
      }
      setModoAprendizAtivo(false);
      setAlvoAprendiz(null);
      setDestaqueAprendizAtivo(false);
      await recarregarUsuario();
    } finally {
      setEncerrandoAprendiz(false);
    }
  }

  if (!ativo && modoAprendizAtivo) {
    return (
      <>
        {destaqueAprendizAtivo && alvoAprendiz && (
          <div
            className="pointer-events-none fixed z-40 rounded-xl border-4 border-digna-green shadow-lg"
            style={{
              left: alvoAprendiz.left,
              top: alvoAprendiz.top,
              width: alvoAprendiz.width,
              height: alvoAprendiz.height,
              boxSizing: "border-box",
            }}
          />
        )}

        <div
          ref={painelAprendizRef}
          className="fixed z-40 w-96 max-w-[calc(100vw-40px)] overflow-hidden rounded-2xl border border-digna-green/70 bg-white shadow-2xl transition-[left,top] duration-200 ease-out"
          style={posicaoPainelAprendiz}
        >
          <button
            type="button"
            onClick={() => setAjudaAprendizAberta((valor) => !valor)}
            className="flex w-full items-center gap-3 p-4 text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-100 text-lime-800">
              <GraduationCap size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-lime-700">
                Modo Aprendiz · acompanhando seu trabalho
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-xango-text">
                {orientacao?.titulo || tour.nome}
              </p>
            </div>
            <ChevronDown
              size={18}
              className={`shrink-0 text-xango-primary transition ${ajudaAprendizAberta ? "rotate-180" : ""}`}
            />
          </button>

          {ajudaAprendizAberta && (
            <div className="border-t border-xango-border px-4 pb-4 pt-3">
              <p className="text-sm leading-6 text-xango-text">
                {orientacao?.texto || "Use esta tela normalmente. O Modo Aprendiz acompanha o fluxo e atualiza a orientação conforme você trabalha."}
              </p>

              {orientacao?.dica && (
                <div className="mt-3 rounded-lg bg-xango-background px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-xango-primary">Dica</p>
                  <p className="mt-1 text-xs leading-5 text-xango-muted">{orientacao.dica}</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const elemento = elementoDaOrientacao(orientacao);
                    if (!elemento) {
                      setAlvoAprendiz(null);
                      setDestaqueAprendizAtivo(false);
                      return;
                    }
                    setDestaqueAprendizAtivo(true);
                    elemento.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                  }}
                  className="inline-flex items-center gap-2 rounded-md bg-xango-primary px-3 py-2 text-xs font-semibold text-white hover:bg-xango-primary-hover"
                >
                  <Target size={14} /> Mostrar onde
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPassoAtual(0);
                    setAutomatico(false);
                    setAtivo(true);
                    setAlvoAprendiz(null);
                    setDestaqueAprendizAtivo(false);
                  }}
                  className="rounded-md border border-xango-border px-3 py-2 text-xs font-semibold text-xango-primary hover:bg-xango-background"
                >
                  Tour desta tela
                </button>
                {destaqueAprendizAtivo && (
                  <button
                    type="button"
                    onClick={() => {
                      setAlvoAprendiz(null);
                      setDestaqueAprendizAtivo(false);
                    }}
                    className="rounded-md border border-xango-border px-3 py-2 text-xs font-semibold text-xango-muted hover:bg-xango-background"
                  >
                    Remover destaque
                  </button>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-xango-border pt-3">
                <p className="text-[11px] text-xango-muted">A orientação muda automaticamente conforme a etapa do trabalho.</p>
                <button
                  type="button"
                  disabled={encerrandoAprendiz}
                  onClick={() => void encerrarModoAprendiz()}
                  className="ml-3 shrink-0 text-[11px] font-semibold text-xango-muted hover:text-red-600 disabled:opacity-50"
                >
                  {encerrandoAprendiz ? "Encerrando..." : "Encerrar modo"}
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  if (!ativo) return null;

  const indiceSeguro = Math.min(passoAtual, passos.length - 1);
  const atual = passos[indiceSeguro];
  const ultimo = indiceSeguro >= passos.length - 1;

  function encerrar() {
    setAtivo(false);
    setAutomatico(false);
    setRetangulo(null);
    setPassoTourTemAlvo(false);
  }

  async function pularPorHoje() {
    try {
      setPausandoHoje(true);
      const resposta = await fetch(`${API_URL}/treinamento/tour/pular-hoje`, {
        method: "POST",
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        window.alert(dados.erro || "Não foi possível pausar o Tour Guiado hoje.");
        return;
      }
      encerrar();
    } finally {
      setPausandoHoje(false);
    }
  }

  return (
    <>
      {retangulo && (
        <div
          className="pointer-events-none fixed z-50 rounded-xl border-4 border-digna-green"
          style={{
            left: retangulo.left,
            top: retangulo.top,
            width: retangulo.width,
            height: retangulo.height,
            boxSizing: "border-box",
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.18)",
          }}
        />
      )}

      {!retangulo && !passoTourTemAlvo && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-slate-900/10" />
      )}

      <div
        ref={painelTourRef}
        className="fixed z-50 w-95 max-w-[calc(100vw-40px)] rounded-2xl border border-xango-border bg-white p-5 shadow-2xl transition-[left,top] duration-200 ease-out"
        style={posicaoPainelTour}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-xango-primary text-white">
              <GraduationCap size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-xango-primary">
                Tour Guiado • {tour.nome}
                {automatico ? " • automático" : ""}
              </p>
              <h3 className="mt-1 font-semibold text-xango-text">{atual.titulo}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={encerrar}
            className="rounded-md p-1 text-xango-muted hover:bg-xango-background"
            title="Sair do Tour Guiado"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-xango-muted">{atual.texto}</p>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <span className="block text-xs text-xango-muted">
              {indiceSeguro + 1} de {passos.length}
            </span>
            {automatico && (
              <button
                type="button"
                disabled={pausandoHoje}
                onClick={() => void pularPorHoje()}
                className="mt-2 text-[11px] font-semibold text-xango-primary hover:underline disabled:opacity-50"
              >
                {pausandoHoje ? "Pausando..." : "Pular tours por hoje"}
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {indiceSeguro > 0 && (
              <button
                type="button"
                onClick={() => setPassoAtual((valor) => Math.max(0, valor - 1))}
                className="rounded-md border border-xango-border px-3 py-2 text-xs font-semibold text-xango-text hover:bg-xango-background"
              >
                Voltar
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (ultimo) {
                  encerrar();
                  return;
                }
                setPassoAtual((valor) => Math.min(passos.length - 1, valor + 1));
              }}
              className="rounded-md bg-xango-primary px-4 py-2 text-xs font-semibold text-white hover:bg-xango-primary-hover"
            >
              {ultimo ? "Concluir" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
