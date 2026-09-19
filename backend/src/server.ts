import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import * as XLSX from "xlsx";
import { randomInt, randomUUID, randomBytes, createHash, timingSafeEqual, scryptSync } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

const app = express();
const PORT = 3333;

const uploadPlanilha = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const nome = file.originalname.toLowerCase();

    if (!nome.endsWith(".xlsx") && !nome.endsWith(".xls")) {
      callback(new Error("Envie um arquivo Excel .xlsx ou .xls."));
      return;
    }

    callback(null, true);
  },
});

const uploadDocumentosRepasse = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 2,
  },
  fileFilter: (_req, file, callback) => {
    const nome = file.originalname.toLowerCase();
    const extensoesPermitidas = [".pdf", ".jpg", ".jpeg", ".png", ".xml"];

    if (!extensoesPermitidas.some((extensao) => nome.endsWith(extensao))) {
      callback(new Error("Envie PDF, JPG, PNG ou XML."));
      return;
    }

    callback(null, true);
  },
}).fields([
  { name: "comprovante", maxCount: 1 },
  { name: "notaFiscal", maxCount: 1 },
]);

// Fallback usado apenas em rotinas de manutenção executadas fora de uma requisição autenticada.
// As operações normais passam a usar o usuário e a organização da sessão atual.
const ORGANIZACAO_SISTEMA_FALLBACK_ID = 1;
const USUARIO_SISTEMA_FALLBACK_ID = 2;

type ContextoAutenticacao = {
  usuarioId: number;
  organizacaoId: number;
};

const contextoAutenticacao = new AsyncLocalStorage<ContextoAutenticacao>();

function usuarioAtualId() {
  return contextoAutenticacao.getStore()?.usuarioId ?? USUARIO_SISTEMA_FALLBACK_ID;
}

function organizacaoAtualId() {
  return contextoAutenticacao.getStore()?.organizacaoId ?? ORGANIZACAO_SISTEMA_FALLBACK_ID;
}

const VALIDADE_ORCAMENTO_PADRAO_DIAS = 15;
const CONDICOES_PAGAMENTO_PADRAO =
  "Consulte a equipe Digna Saúde sobre as formas e condições de pagamento disponíveis.";
const VALIDADE_GUIA_PADRAO_MESES = 6;

function normalizarValidadeGuiaMeses(valor: unknown) {
  const meses = Number(valor);
  return Number.isInteger(meses) && meses >= 1 && meses <= 60
    ? meses
    : VALIDADE_GUIA_PADRAO_MESES;
}

function calcularValidadeGuia(
  dataBase = new Date(),
  meses = VALIDADE_GUIA_PADRAO_MESES
) {
  const validade = new Date(dataBase);
  validade.setMonth(validade.getMonth() + normalizarValidadeGuiaMeses(meses));
  return validade;
}

async function obterConfiguracoesOrganizacaoAtual() {
  const organizacao = await prisma.organizacao.findUnique({
    where: { id: organizacaoAtualId() },
    select: {
      id: true,
      nomeFantasia: true,
      razaoSocial: true,
      documento: true,
      telefone: true,
      whatsapp: true,
      email: true,
      endereco: true,
      validadeOrcamentoDiasPadrao: true,
      condicoesPagamentoOrcamentoPadrao: true,
      validadeGuiaMesesPadrao: true,
      formasPagamentoHabilitadas: true,
      textoPadraoRecibo: true,
      textoPadraoEstorno: true,
    },
  });

  if (!organizacao) {
    throw new Error("ORGANIZACAO_NAO_ENCONTRADA");
  }

  return organizacao;
}

function dataCodigo(data = new Date()) {
  const ano = String(data.getFullYear()).slice(-2);
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${ano}${mes}${dia}`;
}

function blocoAleatorioNumerico(tamanho = 6) {
  let codigo = "";

  for (let i = 0; i < tamanho; i += 1) {
    codigo += String(randomInt(0, 10));
  }

  return codigo;
}

function blocoAleatorioAlfanumerico(tamanho = 6) {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "";

  for (let i = 0; i < tamanho; i += 1) {
    codigo += caracteres[randomInt(0, caracteres.length)];
  }

  return codigo;
}

async function gerarCodigoPublicoUnico(
  tipo: "PAC" | "USR" | "ATD" | "VCH" | "ORC"
) {
  for (let tentativa = 0; tentativa < 30; tentativa += 1) {
    const codigo =
      tipo === "ATD" || tipo === "VCH" || tipo === "ORC"
        ? `${tipo}-${dataCodigo()}-${blocoAleatorioNumerico(6)}`
        : `${tipo}-${blocoAleatorioAlfanumerico(6)}`;

    const existente =
      tipo === "PAC"
        ? await prisma.paciente.findUnique({
            where: { codigoPublico: codigo },
            select: { id: true },
          })
        : tipo === "USR"
          ? await prisma.usuario.findUnique({
              where: { codigoPublico: codigo },
              select: { id: true },
            })
          : tipo === "ATD"
            ? await prisma.atendimento.findUnique({
                where: { codigoPublico: codigo },
                select: { id: true },
              })
            : tipo === "ORC"
              ? await prisma.orcamento.findUnique({
                  where: { codigoPublico: codigo },
                  select: { id: true },
                })
              : await prisma.guia.findUnique({
                  where: { codigoPublico: codigo },
                  select: { id: true },
                });

    if (!existente) {
      return codigo;
    }
  }

  throw new Error(`Não foi possível gerar código público único para ${tipo}.`);
}

async function garantirCodigosPublicosBase() {
  const usuarioPadrao = await prisma.usuario.findUnique({
    where: { id: usuarioAtualId() },
    select: { id: true, codigoPublico: true },
  });

  if (usuarioPadrao && !usuarioPadrao.codigoPublico) {
    await prisma.usuario.update({
      where: { id: usuarioPadrao.id },
      data: { codigoPublico: await gerarCodigoPublicoUnico("USR") },
    });
  }

  const pacientesSemCodigo = await prisma.paciente.findMany({
    where: {
      OR: [
        { codigoPublico: null },
        { codigoPublico: "" },
      ],
    },
    select: {
      id: true,
    },
  });

  for (const paciente of pacientesSemCodigo) {
    await prisma.paciente.update({
      where: { id: paciente.id },
      data: {
        codigoPublico: await gerarCodigoPublicoUnico("PAC"),
      },
    });
  }

  const atendimentosSemCodigo = await prisma.atendimento.findMany({
    where: {
      OR: [
        { codigoPublico: null },
        { codigoPublico: "" },
      ],
    },
    select: {
      id: true,
    },
  });

  for (const atendimento of atendimentosSemCodigo) {
    await prisma.atendimento.update({
      where: { id: atendimento.id },
      data: {
        codigoPublico: await gerarCodigoPublicoUnico("ATD"),
      },
    });
  }

  const orcamentosSemCodigo = await prisma.orcamento.findMany({
    where: {
      OR: [
        { codigoPublico: null },
        { codigoPublico: "" },
      ],
    },
    select: {
      id: true,
    },
  });

  for (const orcamento of orcamentosSemCodigo) {
    await prisma.orcamento.update({
      where: { id: orcamento.id },
      data: {
        codigoPublico: await gerarCodigoPublicoUnico("ORC"),
      },
    });
  }

  const guiasSemCodigo = await prisma.guia.findMany({
    where: {
      OR: [
        { codigoPublico: null },
        { codigoPublico: "" },
      ],
    },
    select: {
      id: true,
    },
  });

  for (const guia of guiasSemCodigo) {
    await prisma.guia.update({
      where: { id: guia.id },
      data: {
        codigoPublico: await gerarCodigoPublicoUnico("VCH"),
      },
    });
  }
}

const COOKIE_SESSAO = "digna_session";
const DURACAO_SESSAO_PADRAO_MS = 12 * 60 * 60 * 1000;
const DURACAO_SESSAO_LEMBRAR_MS = 7 * 24 * 60 * 60 * 1000;

const PERMISSOES_DISPONIVEIS = [
  "dashboard.visualizar",
  "atendimentos.visualizar",
  "atendimentos.criar",
  "atendimentos.editar",
  "orcamentos.visualizar",
  "orcamentos.criar",
  "orcamentos.editar",
  "orcamentos.converter",
  "guias.visualizar",
  "guias.editar",
  "guias.confirmar",
  "agenda.visualizar",
  "pacientes.visualizar",
  "pacientes.editar",
  "clinicas.visualizar",
  "clinicas.editar",
  "procedimentos.visualizar",
  "procedimentos.editar",
  "financeiro.visualizar",
  "financeiro.editar",
  "relatorios.visualizar",
  "configuracoes.visualizar",
  "configuracoes.editar",
  "usuarios.visualizar",
  "usuarios.editar",
] as const;

type Permissao = (typeof PERMISSOES_DISPONIVEIS)[number];

type UsuarioAutenticado = {
  id: number;
  codigoPublico: string | null;
  nome: string;
  email: string | null;
  perfil: "ATENDENTE" | "GERENTE" | "ADMINISTRADOR" | "DESENVOLVEDOR";
  ativo: boolean;
  trocarSenhaNoProximoLogin: boolean;
  usarPermissoesPersonalizadas: boolean;
  permissoes: string[];
  tourGuiadoAtivo: boolean;
  modoAprendizAtivo: boolean;
  tourPuladoHojeData: string | null;
  organizacaoId: number;
  organizacao: {
    id: number;
    nomeFantasia: string;
  };
};

type RequestComUsuario = express.Request & {
  usuarioAutenticado?: UsuarioAutenticado;
};

const PERMISSOES_POR_PERFIL: Record<UsuarioAutenticado["perfil"], Permissao[]> = {
  ATENDENTE: [
    "dashboard.visualizar",
    "atendimentos.visualizar",
    "atendimentos.criar",
    "atendimentos.editar",
    "orcamentos.visualizar",
    "orcamentos.criar",
    "orcamentos.editar",
    "orcamentos.converter",
    "guias.visualizar",
    "guias.editar",
    "agenda.visualizar",
    "pacientes.visualizar",
    "pacientes.editar",
    "clinicas.visualizar",
    "procedimentos.visualizar",
  ],
  GERENTE: [
    "dashboard.visualizar",
    "atendimentos.visualizar",
    "atendimentos.criar",
    "atendimentos.editar",
    "orcamentos.visualizar",
    "orcamentos.criar",
    "orcamentos.editar",
    "orcamentos.converter",
    "guias.visualizar",
    "guias.editar",
    "guias.confirmar",
    "agenda.visualizar",
    "pacientes.visualizar",
    "pacientes.editar",
    "clinicas.visualizar",
    "clinicas.editar",
    "procedimentos.visualizar",
    "procedimentos.editar",
    "financeiro.visualizar",
    "financeiro.editar",
    "relatorios.visualizar",
  ],
  ADMINISTRADOR: [...PERMISSOES_DISPONIVEIS],
  DESENVOLVEDOR: [...PERMISSOES_DISPONIVEIS],
};

const GRUPOS_PERMISSOES = [
  { modulo: "Dashboard", permissoes: ["dashboard.visualizar"] },
  { modulo: "Atendimentos", permissoes: ["atendimentos.visualizar", "atendimentos.criar", "atendimentos.editar"] },
  { modulo: "Orçamentos", permissoes: ["orcamentos.visualizar", "orcamentos.criar", "orcamentos.editar", "orcamentos.converter"] },
  { modulo: "Guias", permissoes: ["guias.visualizar", "guias.editar", "guias.confirmar"] },
  { modulo: "Agenda", permissoes: ["agenda.visualizar"] },
  { modulo: "Pacientes", permissoes: ["pacientes.visualizar", "pacientes.editar"] },
  { modulo: "Clínicas", permissoes: ["clinicas.visualizar", "clinicas.editar"] },
  { modulo: "Procedimentos", permissoes: ["procedimentos.visualizar", "procedimentos.editar"] },
  { modulo: "Financeiro", permissoes: ["financeiro.visualizar", "financeiro.editar"] },
  { modulo: "Relatórios", permissoes: ["relatorios.visualizar"] },
  { modulo: "Configurações", permissoes: ["configuracoes.visualizar", "configuracoes.editar"] },
  { modulo: "Usuários", permissoes: ["usuarios.visualizar", "usuarios.editar"] },
];

function permissoesEfetivas(usuario: Pick<UsuarioAutenticado, "perfil" | "usarPermissoesPersonalizadas" | "permissoes">) {
  if (usuario.usarPermissoesPersonalizadas) {
    return usuario.permissoes.filter((p): p is Permissao =>
      PERMISSOES_DISPONIVEIS.includes(p as Permissao)
    );
  }

  return PERMISSOES_POR_PERFIL[usuario.perfil] || [];
}

function possuiPermissao(usuario: UsuarioAutenticado, permissao: Permissao) {
  return permissoesEfetivas(usuario).includes(permissao);
}

function normalizarEmail(valor: unknown) {
  return String(valor || "").trim().toLowerCase();
}

function validarSenha(senha: string) {
  if (senha.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if (!/[A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/i.test(senha) || !/[0-9]/.test(senha)) {
    return "A senha deve conter letras e números.";
  }
  return null;
}

function gerarHashSenha(senha: string) {
  const salt = randomBytes(16).toString("hex");
  const derivada = scryptSync(senha, salt, 64);
  return `scrypt$${salt}$${derivada.toString("hex")}`;
}

function verificarSenha(senha: string, armazenada: string | null) {
  if (!armazenada) return false;
  const [algoritmo, salt, hashHex] = armazenada.split("$");
  if (algoritmo !== "scrypt" || !salt || !hashHex) return false;

  try {
    const esperado = Buffer.from(hashHex, "hex");
    const obtido = scryptSync(senha, salt, esperado.length);
    return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
  } catch {
    return false;
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function chaveDataHojeSaoPaulo() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const mapa = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${mapa.year}-${mapa.month}-${mapa.day}`;
}

function paginaTreinamentoValida(valor: unknown) {
  const pagina = String(valor || "").trim().toLowerCase();
  if (!pagina || pagina.length > 100 || !/^[a-z0-9:_-]+$/.test(pagina)) return null;
  return pagina;
}

function lerCookies(req: express.Request) {
  const cabecalho = req.headers.cookie || "";
  return Object.fromEntries(
    cabecalho
      .split(";")
      .map((parte) => parte.trim())
      .filter(Boolean)
      .map((parte) => {
        const indice = parte.indexOf("=");
        if (indice < 0) return [parte, ""];
        return [parte.slice(0, indice), decodeURIComponent(parte.slice(indice + 1))];
      })
  ) as Record<string, string>;
}

function definirCookieSessao(res: express.Response, token: string, duracaoMs: number) {
  const seguro = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = Math.floor(duracaoMs / 1000);
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_SESSAO}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${seguro}`
  );
}

function limparCookieSessao(res: express.Response) {
  const seguro = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_SESSAO}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${seguro}`
  );
}

async function criarSessao(usuarioId: number, lembrar: boolean) {
  const duracao = lembrar ? DURACAO_SESSAO_LEMBRAR_MS : DURACAO_SESSAO_PADRAO_MS;
  const token = randomBytes(48).toString("base64url");
  const tokenHash = hashToken(token);
  const expiraEm = new Date(Date.now() + duracao);

  await prisma.sessaoUsuario.create({
    data: { tokenHash, usuarioId, expiraEm },
  });

  return { token, duracao };
}

function usuarioParaResposta(usuario: UsuarioAutenticado) {
  return {
    id: usuario.id,
    codigoPublico: usuario.codigoPublico,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    ativo: usuario.ativo,
    trocarSenhaNoProximoLogin: usuario.trocarSenhaNoProximoLogin,
    usarPermissoesPersonalizadas: usuario.usarPermissoesPersonalizadas,
    permissoes: usuario.permissoes,
    permissoesEfetivas: permissoesEfetivas(usuario),
    tourGuiadoAtivo: usuario.tourGuiadoAtivo,
    modoAprendizAtivo: usuario.modoAprendizAtivo,
    organizacaoId: usuario.organizacaoId,
    organizacao: usuario.organizacao,
  };
}

async function autenticarObrigatorio(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const token = lerCookies(req)[COOKIE_SESSAO];

    if (!token) {
      return res.status(401).json({ erro: "Sessão não encontrada." });
    }

    const sessao = await prisma.sessaoUsuario.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        usuario: {
          include: {
            organizacao: { select: { id: true, nomeFantasia: true } },
          },
        },
      },
    });

    if (!sessao || sessao.expiraEm <= new Date() || !sessao.usuario.ativo) {
      if (sessao) {
        await prisma.sessaoUsuario.delete({ where: { id: sessao.id } }).catch(() => undefined);
      }
      limparCookieSessao(res);
      return res.status(401).json({ erro: "Sessão expirada ou usuário inativo." });
    }

    const usuario = sessao.usuario as UsuarioAutenticado;
    (req as RequestComUsuario).usuarioAutenticado = usuario;

    if (Date.now() - sessao.ultimoUsoEm.getTime() > 5 * 60 * 1000) {
      await prisma.sessaoUsuario.update({
        where: { id: sessao.id },
        data: { ultimoUsoEm: new Date() },
      }).catch(() => undefined);
    }

    contextoAutenticacao.run(
      { usuarioId: usuario.id, organizacaoId: usuario.organizacaoId },
      () => next()
    );
  } catch (erro) {
    console.error("Erro ao validar sessão:", erro);
    return res.status(500).json({ erro: "Não foi possível validar a sessão." });
  }
}

function permissaoDaRota(req: express.Request): Permissao | null {
  const caminho = req.path;
  const leitura = req.method === "GET" || req.method === "HEAD";

  if (caminho.startsWith("/usuarios")) return leitura ? "usuarios.visualizar" : "usuarios.editar";
  if (caminho.startsWith("/orcamentos") || caminho.startsWith("/modelos-orcamento")) {
    if (caminho.includes("/converter")) return "orcamentos.converter";
    if (leitura) return "orcamentos.visualizar";
    if (req.method === "POST") return "orcamentos.criar";
    return "orcamentos.editar";
  }
  if (caminho.startsWith("/atendimentos")) {
    if (leitura) return "atendimentos.visualizar";
    if (req.method === "POST") return "atendimentos.criar";
    return "atendimentos.editar";
  }
  if (caminho.startsWith("/guias") || caminho.startsWith("/recibos") || caminho.startsWith("/estornos")) {
    if (caminho.includes("confirm")) return "guias.confirmar";
    return leitura ? "guias.visualizar" : "guias.editar";
  }
  if (caminho.startsWith("/agenda")) return "agenda.visualizar";
  if (caminho.startsWith("/pacientes")) return leitura ? "pacientes.visualizar" : "pacientes.editar";
  if (caminho.startsWith("/clinicas")) return leitura ? "clinicas.visualizar" : "clinicas.editar";
  if (caminho.startsWith("/procedimentos")) return leitura ? "procedimentos.visualizar" : "procedimentos.editar";
  if (caminho.startsWith("/financeiro")) return leitura ? "financeiro.visualizar" : "financeiro.editar";
  if (caminho.startsWith("/relatorios")) return "relatorios.visualizar";
  if (caminho.startsWith("/configuracoes")) return leitura ? "configuracoes.visualizar" : "configuracoes.editar";
  return null;
}

function autorizarRota(req: express.Request, res: express.Response, next: express.NextFunction) {
  const usuario = (req as RequestComUsuario).usuarioAutenticado;
  if (!usuario) return res.status(401).json({ erro: "Usuário não autenticado." });

  const permissao = permissaoDaRota(req);
  if (permissao && !possuiPermissao(usuario, permissao)) {
    return res.status(403).json({
      erro: "Você não possui permissão para realizar esta ação.",
      permissaoNecessaria: permissao,
    });
  }

  next();
}

function corsPermitido(origin: string | undefined, callback: (erro: Error | null, permitir?: boolean) => void) {
  if (!origin) return callback(null, true);
  const configurada = process.env.FRONTEND_URL;
  if (configurada && origin === configurada) return callback(null, true);
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
  return callback(new Error("Origem não permitida pelo CORS."));
}

app.use(cors({ origin: corsPermitido, credentials: true }));
// Limite maior apenas para as seleções da importação Excel.
app.use("/clinicas/:id/precos/importar-excel/confirmar", express.json({ limit: "2mb" }));
// Relatos de problema podem incluir uma captura de tela em base64.
app.use("/suporte/problemas", express.json({ limit: "6mb" }));
app.use(express.json());

// ======================================================
// AUTENTICAÇÃO - ROTAS PÚBLICAS
// ======================================================

app.get("/auth/status", async (_req, res) => {
  try {
    const usuariosComSenha = await prisma.usuario.count({ where: { senhaHash: { not: null } } });
    return res.json({ configuracaoInicialNecessaria: usuariosComSenha === 0 });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ erro: "Não foi possível verificar a configuração de acesso." });
  }
});

app.post("/auth/configurar-inicial", async (req, res) => {
  try {
    const jaConfigurado = await prisma.usuario.count({ where: { senhaHash: { not: null } } });
    if (jaConfigurado > 0) {
      return res.status(409).json({ erro: "A configuração inicial já foi concluída." });
    }

    const nome = String(req.body?.nome || "").trim();
    const email = normalizarEmail(req.body?.email);
    const senha = String(req.body?.senha || "");
    const erroSenha = validarSenha(senha);

    if (!nome || !email || !email.includes("@")) {
      return res.status(400).json({ erro: "Informe nome e e-mail válidos." });
    }
    if (erroSenha) return res.status(400).json({ erro: erroSenha });

    let organizacao = await prisma.organizacao.findFirst({ where: { ativo: true }, orderBy: { id: "asc" } });
    if (!organizacao) {
      organizacao = await prisma.organizacao.create({ data: { nomeFantasia: "Digna Saúde" } });
    }

    let usuario = await prisma.usuario.findUnique({ where: { id: USUARIO_SISTEMA_FALLBACK_ID } });
    if (!usuario) {
      usuario = await prisma.usuario.findFirst({ where: { ativo: true }, orderBy: { id: "asc" } });
    }

    if (usuario) {
      usuario = await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          nome,
          email,
          senhaHash: gerarHashSenha(senha),
          perfil: "ADMINISTRADOR",
          ativo: true,
          trocarSenhaNoProximoLogin: false,
          organizacaoId: organizacao.id,
          codigoPublico: usuario.codigoPublico || await gerarCodigoPublicoUnico("USR"),
        },
      });
    } else {
      usuario = await prisma.usuario.create({
        data: {
          codigoPublico: await gerarCodigoPublicoUnico("USR"),
          nome,
          email,
          senhaHash: gerarHashSenha(senha),
          perfil: "ADMINISTRADOR",
          ativo: true,
          trocarSenhaNoProximoLogin: false,
          organizacaoId: organizacao.id,
        },
      });
    }

    const sessao = await criarSessao(usuario.id, false);
    definirCookieSessao(res, sessao.token, sessao.duracao);
    return res.status(201).json({ ok: true });
  } catch (erro: any) {
    console.error(erro);
    if (erro?.code === "P2002") return res.status(409).json({ erro: "Este e-mail já está em uso." });
    return res.status(500).json({ erro: "Não foi possível concluir a configuração inicial." });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const email = normalizarEmail(req.body?.email);
    const senha = String(req.body?.senha || "");
    const lembrar = req.body?.lembrar === true;

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { organizacao: { select: { id: true, nomeFantasia: true } } },
    });

    if (!usuario || !verificarSenha(senha, usuario.senhaHash)) {
      return res.status(401).json({ erro: "E-mail ou senha inválidos." });
    }

    if (!usuario.ativo) {
      return res.status(403).json({
        erro: "Usuário bloqueado. Entre em contato com um administrador do sistema.",
      });
    }

    await prisma.sessaoUsuario.deleteMany({
      where: { OR: [{ expiraEm: { lt: new Date() } }, { usuarioId: usuario.id, expiraEm: { lt: new Date() } }] },
    }).catch(() => undefined);

    const sessao = await criarSessao(usuario.id, lembrar);
    await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoLoginEm: new Date() } });
    definirCookieSessao(res, sessao.token, sessao.duracao);

    return res.json({ usuario: usuarioParaResposta(usuario as UsuarioAutenticado) });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ erro: "Não foi possível entrar no sistema." });
  }
});

// ======================================================
// AUTENTICAÇÃO - ROTAS COM SESSÃO
// ======================================================

app.get("/auth/me", autenticarObrigatorio, async (req, res) => {
  const usuario = (req as RequestComUsuario).usuarioAutenticado!;
  return res.json({ usuario: usuarioParaResposta(usuario) });
});

app.post("/auth/logout", autenticarObrigatorio, async (req, res) => {
  const token = lerCookies(req)[COOKIE_SESSAO];
  if (token) {
    await prisma.sessaoUsuario.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => undefined);
  }
  limparCookieSessao(res);
  return res.json({ ok: true });
});

app.post("/auth/trocar-senha", autenticarObrigatorio, async (req, res) => {
  try {
    const usuarioAuth = (req as RequestComUsuario).usuarioAutenticado!;
    const senhaAtual = String(req.body?.senhaAtual || "");
    const novaSenha = String(req.body?.novaSenha || "");
    const erroSenha = validarSenha(novaSenha);
    if (erroSenha) return res.status(400).json({ erro: erroSenha });

    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioAuth.id } });
    if (!usuario || !verificarSenha(senhaAtual, usuario.senhaHash)) {
      return res.status(400).json({ erro: "A senha atual está incorreta." });
    }

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { senhaHash: gerarHashSenha(novaSenha), trocarSenhaNoProximoLogin: false },
    });

    await prisma.sessaoUsuario.deleteMany({
      where: { usuarioId: usuario.id, tokenHash: { not: hashToken(lerCookies(req)[COOKIE_SESSAO] || "") } },
    });

    return res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ erro: "Não foi possível alterar a senha." });
  }
});

// Daqui em diante toda a API exige uma sessão válida e aplica permissões.
app.use(autenticarObrigatorio);
app.use(autorizarRota);

// ======================================================
// TREINAMENTO DO USUÁRIO
// ======================================================

app.get("/treinamento/status", async (req, res) => {
  try {
    const autenticado = (req as RequestComUsuario).usuarioAutenticado!;
    const usuario = await prisma.usuario.findUnique({
      where: { id: autenticado.id },
      select: { tourGuiadoAtivo: true, modoAprendizAtivo: true, tourPuladoHojeData: true },
    });
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });

    return res.json({
      tourGuiadoAtivo: usuario.tourGuiadoAtivo,
      modoAprendizAtivo: usuario.modoAprendizAtivo,
      tourPuladoHoje: usuario.tourPuladoHojeData === chaveDataHojeSaoPaulo(),
    });
  } catch (erro) {
    console.error("Erro ao carregar treinamento do usuário:", erro);
    return res.status(500).json({ erro: "Não foi possível carregar as preferências de treinamento." });
  }
});

app.post("/treinamento/tour/verificar", async (req, res) => {
  try {
    const autenticado = (req as RequestComUsuario).usuarioAutenticado!;
    const pagina = paginaTreinamentoValida(req.body?.pagina);
    if (!pagina) return res.status(400).json({ erro: "Página de treinamento inválida." });

    const dataChave = chaveDataHojeSaoPaulo();
    const usuario = await prisma.usuario.findUnique({
      where: { id: autenticado.id },
      select: { tourGuiadoAtivo: true, modoAprendizAtivo: true, tourPuladoHojeData: true },
    });
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });

    if (!usuario.tourGuiadoAtivo || usuario.tourPuladoHojeData === dataChave) {
      return res.json({ mostrar: false, dataChave, modoAprendizAtivo: usuario.modoAprendizAtivo });
    }

    const existente = await prisma.tourPaginaUsuario.findUnique({
      where: { usuarioId_dataChave_pagina: { usuarioId: autenticado.id, dataChave, pagina } },
      select: { id: true },
    });
    if (existente) {
      return res.json({ mostrar: false, dataChave, modoAprendizAtivo: usuario.modoAprendizAtivo });
    }

    await prisma.tourPaginaUsuario.create({
      data: { usuarioId: autenticado.id, dataChave, pagina },
    });

    // Limpeza simples para não acumular histórico diário indefinidamente.
    await prisma.tourPaginaUsuario.deleteMany({
      where: { usuarioId: autenticado.id, dataChave: { lt: dataChave.slice(0, 4) + "-01-01" } },
    }).catch(() => undefined);

    return res.json({ mostrar: true, dataChave, modoAprendizAtivo: usuario.modoAprendizAtivo });
  } catch (erro: any) {
    // Corrida entre duas renderizações da mesma tela: considera como já exibido.
    if (erro?.code === "P2002") {
      const autenticado = (req as RequestComUsuario).usuarioAutenticado!;
      const usuario = await prisma.usuario.findUnique({
        where: { id: autenticado.id },
        select: { modoAprendizAtivo: true },
      });
      return res.json({
        mostrar: false,
        dataChave: chaveDataHojeSaoPaulo(),
        modoAprendizAtivo: usuario?.modoAprendizAtivo === true,
      });
    }
    console.error("Erro ao verificar Tour Guiado:", erro);
    return res.status(500).json({ erro: "Não foi possível verificar o Tour Guiado." });
  }
});

app.post("/treinamento/tour/pular-hoje", async (req, res) => {
  try {
    const autenticado = (req as RequestComUsuario).usuarioAutenticado!;
    const dataChave = chaveDataHojeSaoPaulo();
    await prisma.usuario.update({
      where: { id: autenticado.id },
      data: { tourPuladoHojeData: dataChave },
    });
    return res.json({ ok: true, dataChave });
  } catch (erro) {
    console.error("Erro ao pausar Tour Guiado:", erro);
    return res.status(500).json({ erro: "Não foi possível pausar o Tour Guiado hoje." });
  }
});

app.patch("/treinamento/me", async (req, res) => {
  try {
    const autenticado = (req as RequestComUsuario).usuarioAutenticado!;
    if (req.body?.modoAprendizAtivo !== false) {
      return res.status(400).json({ erro: "O próprio usuário pode apenas encerrar o Modo Aprendiz. A ativação é feita por um administrador." });
    }

    await prisma.usuario.update({
      where: { id: autenticado.id },
      data: { modoAprendizAtivo: false },
    });
    return res.json({ ok: true, modoAprendizAtivo: false });
  } catch (erro) {
    console.error("Erro ao encerrar Modo Aprendiz:", erro);
    return res.status(500).json({ erro: "Não foi possível encerrar o Modo Aprendiz." });
  }
});

// ======================================================
// USUÁRIOS E PERMISSÕES
// ======================================================

app.get("/usuarios", async (_req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: { organizacaoId: organizacaoAtualId() },
      include: { organizacao: { select: { id: true, nomeFantasia: true } } },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    });

    return res.json({
      usuarios: usuarios.map((u) => ({
        id: u.id,
        codigoPublico: u.codigoPublico,
        nome: u.nome,
        email: u.email,
        perfil: u.perfil,
        ativo: u.ativo,
        ultimoLoginEm: u.ultimoLoginEm,
        trocarSenhaNoProximoLogin: u.trocarSenhaNoProximoLogin,
        usarPermissoesPersonalizadas: u.usarPermissoesPersonalizadas,
        permissoes: u.permissoes,
        permissoesEfetivas: permissoesEfetivas(u as UsuarioAutenticado),
        tourGuiadoAtivo: u.tourGuiadoAtivo,
        modoAprendizAtivo: u.modoAprendizAtivo,
      })),
      permissoesDisponiveis: PERMISSOES_DISPONIVEIS,
      gruposPermissoes: GRUPOS_PERMISSOES,
      permissoesPadraoPorPerfil: PERMISSOES_POR_PERFIL,
    });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ erro: "Não foi possível carregar os usuários." });
  }
});

app.post("/usuarios", async (req, res) => {
  try {
    const nome = String(req.body?.nome || "").trim();
    const email = normalizarEmail(req.body?.email);
    const perfil = String(req.body?.perfil || "ATENDENTE") as UsuarioAutenticado["perfil"];
    const senhaTemporaria = String(req.body?.senhaTemporaria || "");
    const usarPersonalizadas = req.body?.usarPermissoesPersonalizadas === true;
    const permissoes = Array.isArray(req.body?.permissoes)
      ? req.body.permissoes.filter((p: unknown) => PERMISSOES_DISPONIVEIS.includes(String(p) as Permissao))
      : [];
    const tourGuiadoAtivo = req.body?.tourGuiadoAtivo === true;
    const modoAprendizAtivo = req.body?.modoAprendizAtivo === true;

    if (!nome || !email || !email.includes("@")) return res.status(400).json({ erro: "Informe nome e e-mail válidos." });
    if (!PERMISSOES_POR_PERFIL[perfil]) return res.status(400).json({ erro: "Perfil inválido." });
    const erroSenha = validarSenha(senhaTemporaria);
    if (erroSenha) return res.status(400).json({ erro: erroSenha });

    const usuario = await prisma.usuario.create({
      data: {
        codigoPublico: await gerarCodigoPublicoUnico("USR"),
        nome,
        email,
        perfil,
        ativo: true,
        senhaHash: gerarHashSenha(senhaTemporaria),
        trocarSenhaNoProximoLogin: true,
        usarPermissoesPersonalizadas: usarPersonalizadas,
        permissoes,
        tourGuiadoAtivo,
        modoAprendizAtivo,
        organizacaoId: organizacaoAtualId(),
      },
    });

    return res.status(201).json({ id: usuario.id, codigoPublico: usuario.codigoPublico });
  } catch (erro: any) {
    console.error(erro);
    if (erro?.code === "P2002") return res.status(409).json({ erro: "Este e-mail já está em uso." });
    return res.status(500).json({ erro: "Não foi possível criar o usuário." });
  }
});

app.patch("/usuarios/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ erro: "Usuário inválido." });

    const atual = (req as RequestComUsuario).usuarioAutenticado!;
    const alvo = await prisma.usuario.findFirst({ where: { id, organizacaoId: organizacaoAtualId() } });
    if (!alvo) return res.status(404).json({ erro: "Usuário não encontrado." });

    const nome = req.body?.nome === undefined ? alvo.nome : String(req.body.nome).trim();
    const email = req.body?.email === undefined ? alvo.email : normalizarEmail(req.body.email);
    const perfil = (req.body?.perfil === undefined ? alvo.perfil : String(req.body.perfil)) as UsuarioAutenticado["perfil"];
    const ativo = req.body?.ativo === undefined ? alvo.ativo : req.body.ativo === true;
    const usarPersonalizadas = req.body?.usarPermissoesPersonalizadas === undefined
      ? alvo.usarPermissoesPersonalizadas
      : req.body.usarPermissoesPersonalizadas === true;
    const permissoes = req.body?.permissoes === undefined
      ? alvo.permissoes
      : Array.isArray(req.body.permissoes)
        ? req.body.permissoes.filter((p: unknown) => PERMISSOES_DISPONIVEIS.includes(String(p) as Permissao))
        : [];
    const tourGuiadoAtivo = req.body?.tourGuiadoAtivo === undefined
      ? alvo.tourGuiadoAtivo
      : req.body.tourGuiadoAtivo === true;
    const modoAprendizAtivo = req.body?.modoAprendizAtivo === undefined
      ? alvo.modoAprendizAtivo
      : req.body.modoAprendizAtivo === true;

    if (!nome || !email || !String(email).includes("@")) return res.status(400).json({ erro: "Informe nome e e-mail válidos." });
    if (!PERMISSOES_POR_PERFIL[perfil]) return res.status(400).json({ erro: "Perfil inválido." });
    if (id === atual.id && !ativo) return res.status(400).json({ erro: "Você não pode desativar o próprio usuário." });

    const rebaixandoAdministrador =
      (alvo.perfil === "ADMINISTRADOR" || alvo.perfil === "DESENVOLVEDOR") &&
      (!ativo || (perfil !== "ADMINISTRADOR" && perfil !== "DESENVOLVEDOR"));
    if (rebaixandoAdministrador) {
      const totalAdmins = await prisma.usuario.count({
        where: { organizacaoId: organizacaoAtualId(), ativo: true, perfil: { in: ["ADMINISTRADOR", "DESENVOLVEDOR"] } },
      });
      if (totalAdmins <= 1) return res.status(400).json({ erro: "A organização precisa manter pelo menos um administrador ativo." });
    }

    await prisma.usuario.update({
      where: { id },
      data: {
        nome,
        email,
        perfil,
        ativo,
        usarPermissoesPersonalizadas: usarPersonalizadas,
        permissoes,
        tourGuiadoAtivo,
        modoAprendizAtivo,
        ...(!alvo.tourGuiadoAtivo && tourGuiadoAtivo ? { tourPuladoHojeData: null } : {}),
      },
    });

    if (!alvo.tourGuiadoAtivo && tourGuiadoAtivo) {
      await prisma.tourPaginaUsuario.deleteMany({
        where: { usuarioId: id, dataChave: chaveDataHojeSaoPaulo() },
      });
    }

    if (!ativo) await prisma.sessaoUsuario.deleteMany({ where: { usuarioId: id } });
    return res.json({ ok: true });
  } catch (erro: any) {
    console.error(erro);
    if (erro?.code === "P2002") return res.status(409).json({ erro: "Este e-mail já está em uso." });
    return res.status(500).json({ erro: "Não foi possível atualizar o usuário." });
  }
});

app.post("/usuarios/:id/redefinir-senha", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const novaSenha = String(req.body?.novaSenha || "");
    const erroSenha = validarSenha(novaSenha);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ erro: "Usuário inválido." });
    if (erroSenha) return res.status(400).json({ erro: erroSenha });

    const alvo = await prisma.usuario.findFirst({ where: { id, organizacaoId: organizacaoAtualId() } });
    if (!alvo) return res.status(404).json({ erro: "Usuário não encontrado." });

    await prisma.usuario.update({
      where: { id },
      data: { senhaHash: gerarHashSenha(novaSenha), trocarSenhaNoProximoLogin: true },
    });
    await prisma.sessaoUsuario.deleteMany({ where: { usuarioId: id } });
    return res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ erro: "Não foi possível redefinir a senha." });
  }
});


// ======================================================
// CONFIGURAÇÕES GERAIS DA ORGANIZAÇÃO
// ======================================================

app.get("/preferencias/orcamento", async (_req, res) => {
  try {
    const organizacao = await obterConfiguracoesOrganizacaoAtual();

    return res.json({
      validadeDiasPadrao: normalizarValidadeDias(
        organizacao.validadeOrcamentoDiasPadrao
      ),
      condicoesPagamentoPadrao:
        organizacao.condicoesPagamentoOrcamentoPadrao?.trim() ||
        CONDICOES_PAGAMENTO_PADRAO,
    });
  } catch (erro) {
    console.error("Erro ao carregar preferências de orçamento:", erro);
    return res.status(500).json({
      erro: "Não foi possível carregar as preferências de orçamento.",
    });
  }
});

app.get("/configuracoes/gerais", async (_req, res) => {
  try {
    const organizacao = await obterConfiguracoesOrganizacaoAtual();

    return res.json({
      organizacao: {
        id: organizacao.id,
        nomeFantasia: organizacao.nomeFantasia,
        razaoSocial: organizacao.razaoSocial,
        documento: organizacao.documento,
        telefone: organizacao.telefone,
        whatsapp: organizacao.whatsapp,
        email: organizacao.email,
        endereco: organizacao.endereco,
      },
      orcamentos: {
        validadeDiasPadrao: normalizarValidadeDias(
          organizacao.validadeOrcamentoDiasPadrao
        ),
        condicoesPagamentoPadrao:
          organizacao.condicoesPagamentoOrcamentoPadrao?.trim() ||
          CONDICOES_PAGAMENTO_PADRAO,
      },
      guias: {
        validadeMesesPadrao:
          Number.isInteger(organizacao.validadeGuiaMesesPadrao) &&
          organizacao.validadeGuiaMesesPadrao >= 1 &&
          organizacao.validadeGuiaMesesPadrao <= 60
            ? organizacao.validadeGuiaMesesPadrao
            : VALIDADE_GUIA_PADRAO_MESES,
      },
    });
  } catch (erro) {
    console.error("Erro ao carregar configurações gerais:", erro);
    return res.status(500).json({
      erro: "Não foi possível carregar as configurações gerais.",
    });
  }
});

app.patch("/configuracoes/gerais", async (req, res) => {
  try {
    const atual = await obterConfiguracoesOrganizacaoAtual();

    const nomeFantasia = String(
      req.body?.nomeFantasia ?? atual.nomeFantasia ?? ""
    ).trim();
    const razaoSocial =
      String(req.body?.razaoSocial ?? atual.razaoSocial ?? "").trim() || null;
    const documento =
      String(req.body?.documento ?? atual.documento ?? "")
        .replace(/\D/g, "") || null;
    const telefone =
      String(req.body?.telefone ?? atual.telefone ?? "").trim() || null;
    const whatsapp =
      String(req.body?.whatsapp ?? atual.whatsapp ?? "").trim() || null;
    const email =
      String(req.body?.email ?? atual.email ?? "").trim().toLowerCase() || null;
    const endereco =
      String(req.body?.endereco ?? atual.endereco ?? "").trim() || null;

    const validadeOrcamentoDiasPadrao = Number(
      req.body?.validadeOrcamentoDiasPadrao ??
        atual.validadeOrcamentoDiasPadrao
    );
    const condicoesPagamentoOrcamentoPadrao =
      String(
        req.body?.condicoesPagamentoOrcamentoPadrao ??
          atual.condicoesPagamentoOrcamentoPadrao ??
          ""
      ).trim() || null;
    const validadeGuiaMesesPadrao = Number(
      req.body?.validadeGuiaMesesPadrao ?? atual.validadeGuiaMesesPadrao
    );

    if (!nomeFantasia) {
      return res.status(400).json({ erro: "Informe o nome fantasia." });
    }
    if (nomeFantasia.length > 150) {
      return res.status(400).json({
        erro: "O nome fantasia pode ter no máximo 150 caracteres.",
      });
    }
    if (razaoSocial && razaoSocial.length > 200) {
      return res.status(400).json({
        erro: "A razão social pode ter no máximo 200 caracteres.",
      });
    }
    if (documento && ![11, 14].includes(documento.length)) {
      return res.status(400).json({
        erro: "Informe um CPF ou CNPJ válido, com 11 ou 14 dígitos.",
      });
    }
    if (email && (!email.includes("@") || email.length > 200)) {
      return res.status(400).json({ erro: "Informe um e-mail válido." });
    }
    if (telefone && telefone.length > 30) {
      return res.status(400).json({ erro: "O telefone informado é muito longo." });
    }
    if (whatsapp && whatsapp.length > 30) {
      return res.status(400).json({ erro: "O WhatsApp informado é muito longo." });
    }
    if (endereco && endereco.length > 500) {
      return res.status(400).json({
        erro: "O endereço pode ter no máximo 500 caracteres.",
      });
    }
    if (
      !Number.isInteger(validadeOrcamentoDiasPadrao) ||
      validadeOrcamentoDiasPadrao < 1 ||
      validadeOrcamentoDiasPadrao > 365
    ) {
      return res.status(400).json({
        erro: "A validade padrão do orçamento deve ficar entre 1 e 365 dias.",
      });
    }
    if (
      condicoesPagamentoOrcamentoPadrao &&
      condicoesPagamentoOrcamentoPadrao.length > 1000
    ) {
      return res.status(400).json({
        erro: "As condições de pagamento podem ter no máximo 1000 caracteres.",
      });
    }
    if (
      !Number.isInteger(validadeGuiaMesesPadrao) ||
      validadeGuiaMesesPadrao < 1 ||
      validadeGuiaMesesPadrao > 60
    ) {
      return res.status(400).json({
        erro: "A validade padrão das guias deve ficar entre 1 e 60 meses.",
      });
    }

    const organizacao = await prisma.organizacao.update({
      where: { id: organizacaoAtualId() },
      data: {
        nomeFantasia,
        razaoSocial,
        documento,
        telefone,
        whatsapp,
        email,
        endereco,
        validadeOrcamentoDiasPadrao,
        condicoesPagamentoOrcamentoPadrao,
        validadeGuiaMesesPadrao,
      },
    });

    return res.json({
      ok: true,
      organizacao: {
        id: organizacao.id,
        nomeFantasia: organizacao.nomeFantasia,
      },
    });
  } catch (erro: any) {
    console.error("Erro ao salvar configurações gerais:", erro);
    if (erro?.code === "P2002") {
      return res.status(409).json({
        erro: "Este CPF/CNPJ já está vinculado a outra organização.",
      });
    }
    return res.status(500).json({
      erro: "Não foi possível salvar as configurações gerais.",
    });
  }
});

// ======================================================
// PARÂMETROS OPERACIONAIS E FINANCEIROS
// ======================================================

const FORMAS_PAGAMENTO_CONFIGURAVEIS = [
  "PIX",
  "DINHEIRO",
  "CARTAO_CREDITO",
  "CARTAO_DEBITO",
  "TRANSFERENCIA",
  "OUTRO",
] as const;

type FormaPagamentoConfiguravel =
  (typeof FORMAS_PAGAMENTO_CONFIGURAVEIS)[number];

const ROTULOS_FORMAS_PAGAMENTO: Record<FormaPagamentoConfiguravel, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_DEBITO: "Cartão de débito",
  TRANSFERENCIA: "Transferência",
  OUTRO: "Outro",
};

function normalizarFormasPagamentoConfiguradas(valor: unknown) {
  const recebidas = Array.isArray(valor) ? valor.map(String) : [];
  return FORMAS_PAGAMENTO_CONFIGURAVEIS.filter((forma) =>
    recebidas.includes(forma)
  );
}

async function obterNumeracaoFinanceiraAtual() {
  const organizacaoId = organizacaoAtualId();

  const [serieRecibo, serieEstorno, maiorRecibo, maiorEstorno] =
    await Promise.all([
      prisma.serieRecibo.findUnique({
        where: { organizacaoId },
        select: { ultimoNumero: true },
      }),
      prisma.serieEstorno.findUnique({
        where: { organizacaoId },
        select: { ultimoNumero: true },
      }),
      prisma.recibo.aggregate({
        where: { organizacaoId },
        _max: { numero: true },
      }),
      prisma.estorno.aggregate({
        where: { organizacaoId },
        _max: { numero: true },
      }),
    ]);

  const ultimoRecibo = Math.max(
    100000,
    Number(serieRecibo?.ultimoNumero || 0),
    Number(maiorRecibo._max.numero || 0)
  );
  const ultimoEstorno = Math.max(
    100000,
    Number(serieEstorno?.ultimoNumero || 0),
    Number(maiorEstorno._max.numero || 0)
  );

  return {
    proximoNumeroRecibo: ultimoRecibo + 1,
    proximoNumeroEstorno: ultimoEstorno + 1,
  };
}

// Endpoint leve para os próximos módulos consumirem as preferências sem
// precisar carregar a tela administrativa de Configurações.
app.get("/preferencias/financeiro", async (_req, res) => {
  try {
    const organizacao = await obterConfiguracoesOrganizacaoAtual();
    const formas = normalizarFormasPagamentoConfiguradas(
      organizacao.formasPagamentoHabilitadas
    );

    return res.json({
      formasPagamentoHabilitadas:
        formas.length > 0 ? formas : [...FORMAS_PAGAMENTO_CONFIGURAVEIS],
      formasPagamento: FORMAS_PAGAMENTO_CONFIGURAVEIS.map((codigo) => ({
        codigo,
        label: ROTULOS_FORMAS_PAGAMENTO[codigo],
      })),
      textoPadraoRecibo: organizacao.textoPadraoRecibo || "",
      textoPadraoEstorno: organizacao.textoPadraoEstorno || "",
    });
  } catch (erro) {
    console.error("Erro ao carregar preferências financeiras:", erro);
    return res.status(500).json({
      erro: "Não foi possível carregar as preferências financeiras.",
    });
  }
});

app.get("/configuracoes/operacionais", async (_req, res) => {
  try {
    const organizacao = await obterConfiguracoesOrganizacaoAtual();
    const numeracao = await obterNumeracaoFinanceiraAtual();
    const formas = normalizarFormasPagamentoConfiguradas(
      organizacao.formasPagamentoHabilitadas
    );

    return res.json({
      formasPagamentoDisponiveis: FORMAS_PAGAMENTO_CONFIGURAVEIS.map(
        (codigo) => ({
          codigo,
          label: ROTULOS_FORMAS_PAGAMENTO[codigo],
        })
      ),
      formasPagamentoHabilitadas:
        formas.length > 0 ? formas : [...FORMAS_PAGAMENTO_CONFIGURAVEIS],
      numeracao,
      documentos: {
        textoPadraoRecibo: organizacao.textoPadraoRecibo || "",
        textoPadraoEstorno: organizacao.textoPadraoEstorno || "",
      },
    });
  } catch (erro) {
    console.error("Erro ao carregar parâmetros operacionais:", erro);
    return res.status(500).json({
      erro: "Não foi possível carregar os parâmetros operacionais e financeiros.",
    });
  }
});

app.patch("/configuracoes/operacionais", async (req, res) => {
  try {
    const atual = await obterConfiguracoesOrganizacaoAtual();

    const formasRecebidas =
      req.body?.formasPagamentoHabilitadas === undefined
        ? normalizarFormasPagamentoConfiguradas(
            atual.formasPagamentoHabilitadas
          )
        : normalizarFormasPagamentoConfiguradas(
            req.body.formasPagamentoHabilitadas
          );

    if (formasRecebidas.length === 0) {
      return res.status(400).json({
        erro: "Mantenha ao menos uma forma de pagamento habilitada.",
      });
    }

    const textoPadraoRecibo =
      String(req.body?.textoPadraoRecibo ?? atual.textoPadraoRecibo ?? "").trim() ||
      null;
    const textoPadraoEstorno =
      String(req.body?.textoPadraoEstorno ?? atual.textoPadraoEstorno ?? "").trim() ||
      null;

    if (textoPadraoRecibo && textoPadraoRecibo.length > 2000) {
      return res.status(400).json({
        erro: "O texto padrão do recibo pode ter no máximo 2.000 caracteres.",
      });
    }
    if (textoPadraoEstorno && textoPadraoEstorno.length > 2000) {
      return res.status(400).json({
        erro: "O texto padrão do estorno pode ter no máximo 2.000 caracteres.",
      });
    }

    const numeracaoAtual = await obterNumeracaoFinanceiraAtual();
    const proximoNumeroRecibo = Number(
      req.body?.proximoNumeroRecibo ?? numeracaoAtual.proximoNumeroRecibo
    );
    const proximoNumeroEstorno = Number(
      req.body?.proximoNumeroEstorno ?? numeracaoAtual.proximoNumeroEstorno
    );

    for (const [valor, titulo] of [
      [proximoNumeroRecibo, "recibo"],
      [proximoNumeroEstorno, "estorno"],
    ] as const) {
      if (!Number.isInteger(valor) || valor < 1 || valor > 999999999) {
        return res.status(400).json({
          erro: `Informe um próximo número de ${titulo} válido.`,
        });
      }
    }

    // A sequência pode avançar, mas nunca retroceder. Isso protege códigos já
    // emitidos e evita colisão com a restrição única dos documentos.
    if (proximoNumeroRecibo < numeracaoAtual.proximoNumeroRecibo) {
      return res.status(400).json({
        erro: `O próximo recibo não pode ser menor que ${numeracaoAtual.proximoNumeroRecibo}.`,
      });
    }
    if (proximoNumeroEstorno < numeracaoAtual.proximoNumeroEstorno) {
      return res.status(400).json({
        erro: `O próximo estorno não pode ser menor que ${numeracaoAtual.proximoNumeroEstorno}.`,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.organizacao.update({
        where: { id: organizacaoAtualId() },
        data: {
          formasPagamentoHabilitadas: formasRecebidas,
          textoPadraoRecibo,
          textoPadraoEstorno,
        },
      });

      await tx.serieRecibo.upsert({
        where: { organizacaoId: organizacaoAtualId() },
        create: {
          organizacaoId: organizacaoAtualId(),
          ultimoNumero: proximoNumeroRecibo - 1,
        },
        update: { ultimoNumero: proximoNumeroRecibo - 1 },
      });

      await tx.serieEstorno.upsert({
        where: { organizacaoId: organizacaoAtualId() },
        create: {
          organizacaoId: organizacaoAtualId(),
          ultimoNumero: proximoNumeroEstorno - 1,
        },
        update: { ultimoNumero: proximoNumeroEstorno - 1 },
      });
    });

    return res.json({
      ok: true,
      formasPagamentoHabilitadas: formasRecebidas,
      numeracao: {
        proximoNumeroRecibo,
        proximoNumeroEstorno,
      },
    });
  } catch (erro) {
    console.error("Erro ao salvar parâmetros operacionais:", erro);
    return res.status(500).json({
      erro: "Não foi possível salvar os parâmetros operacionais e financeiros.",
    });
  }
});

// ======================================================
// ASSINATURA E FATURAMENTO DO DIGNA CONECT
// ======================================================

app.get("/configuracoes/assinatura", async (_req, res) => {
  try {
    const organizacao = await prisma.organizacao.findUnique({
      where: { id: organizacaoAtualId() },
      select: {
        id: true,
        nomeFantasia: true,
        planoSistema: true,
        valorMensalidadeSistema: true,
        diaVencimentoMensalidadeSistema: true,
        statusAssinaturaSistema: true,
        proximaCobrancaSistema: true,
        faturasSistema: {
          orderBy: [{ vencimento: "desc" }, { id: "desc" }],
          take: 36,
          select: {
            id: true,
            codigoPublico: true,
            competencia: true,
            valor: true,
            vencimento: true,
            status: true,
            pagoEm: true,
            urlFatura: true,
            observacoes: true,
            criadoEm: true,
          },
        },
      },
    });

    if (!organizacao) {
      return res.status(404).json({ erro: "Organização não encontrada." });
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const faturas = organizacao.faturasSistema.map((fatura) => {
      const vencidaAutomaticamente =
        fatura.status === "ABERTA" && fatura.vencimento < hoje;
      const statusVisual = vencidaAutomaticamente ? "VENCIDA" : fatura.status;

      return {
        id: fatura.id,
        codigoPublico: fatura.codigoPublico,
        competencia: fatura.competencia,
        valor: Number(fatura.valor),
        vencimento: fatura.vencimento,
        status: statusVisual,
        statusBanco: fatura.status,
        pagoEm: fatura.pagoEm,
        urlFatura: fatura.urlFatura,
        observacoes: fatura.observacoes,
        criadoEm: fatura.criadoEm,
      };
    });

    const possuiFaturaVencida = faturas.some(
      (fatura) => fatura.status === "VENCIDA"
    );

    const statusAssinaturaVisual =
      ["SUSPENSA", "CANCELADA", "ISENTA", "NAO_CONFIGURADA"].includes(
        organizacao.statusAssinaturaSistema
      )
        ? organizacao.statusAssinaturaSistema
        : possuiFaturaVencida
          ? "EM_ATRASO"
          : organizacao.statusAssinaturaSistema;

    const totalPendente = faturas
      .filter((fatura) => ["ABERTA", "VENCIDA"].includes(fatura.status))
      .reduce((total, fatura) => total + fatura.valor, 0);

    return res.json({
      organizacao: {
        id: organizacao.id,
        nomeFantasia: organizacao.nomeFantasia,
      },
      assinatura: {
        plano: organizacao.planoSistema,
        valorMensalidade:
          organizacao.valorMensalidadeSistema === null
            ? null
            : Number(organizacao.valorMensalidadeSistema),
        diaVencimento: organizacao.diaVencimentoMensalidadeSistema,
        status: statusAssinaturaVisual,
        statusBanco: organizacao.statusAssinaturaSistema,
        proximaCobrancaEm: organizacao.proximaCobrancaSistema,
        totalPendente,
      },
      faturas,
      administracao: {
        somenteLeitura: true,
        mensagem:
          "Plano, mensalidade, pagamentos e suspensão são administrados pelo perfil Desenvolvedor do Digna Conect.",
      },
    });
  } catch (erro) {
    console.error("Erro ao carregar assinatura do sistema:", erro);
    return res.status(500).json({
      erro: "Não foi possível carregar a assinatura e as faturas do sistema.",
    });
  }
});

function mapearFormaPagamento(
  forma: string | undefined
):
  | "PIX"
  | "DINHEIRO"
  | "CARTAO_CREDITO"
  | "CARTAO_DEBITO"
  | "TRANSFERENCIA"
  | "OUTRO" {
  const valor = (forma || "").toLowerCase();

  if (valor === "pix") return "PIX";
  if (valor === "dinheiro") return "DINHEIRO";
  if (valor === "credito") return "CARTAO_CREDITO";
  if (valor === "debito") return "CARTAO_DEBITO";
  if (valor === "transferencia") return "TRANSFERENCIA";

  return "OUTRO";
}

function calcularStatusGuia(
  statusRecebido: string | undefined,
  valorFinal: number,
  valorPago: number,
  valorEstornado: number
):
  | "RASCUNHO"
  | "AGUARDANDO_PAGAMENTO"
  | "PARCIALMENTE_PAGA"
  | "PAGA"
  | "ESTORNO_PENDENTE"
  | "CANCELADA" {
  if (statusRecebido === "CANCELADA") {
    return "CANCELADA";
  }

  if (statusRecebido === "RASCUNHO") {
    return "RASCUNHO";
  }

  const pagoLiquido = Math.max(valorPago - valorEstornado, 0);

  if (pagoLiquido > valorFinal) {
    return "ESTORNO_PENDENTE";
  }

  if (valorFinal > 0 && pagoLiquido >= valorFinal) {
    return "PAGA";
  }

  if (pagoLiquido > 0) {
    return "PARCIALMENTE_PAGA";
  }

  if (statusRecebido === "AGUARDANDO_PAGAMENTO") {
    return "AGUARDANDO_PAGAMENTO";
  }

  if (statusRecebido === "PARCIALMENTE_PAGA") {
    return "PARCIALMENTE_PAGA";
  }

  if (statusRecebido === "PAGA") {
    return "PAGA";
  }

  if (statusRecebido === "ESTORNO_PENDENTE") {
    return "ESTORNO_PENDENTE";
  }

  return "AGUARDANDO_PAGAMENTO";
}



async function registrarEstornoVinculado(
  tx: any,
  guiaId: number,
  valorSolicitado: number,
  forma:
    | "PIX"
    | "DINHEIRO"
    | "CARTAO_CREDITO"
    | "CARTAO_DEBITO"
    | "TRANSFERENCIA"
    | "OUTRO",
  motivo: string
) {
  let restante = Number(valorSolicitado) || 0;

  if (restante <= 0) {
    return [];
  }

  const guia = await tx.guia.findUnique({
    where: { id: guiaId },
    select: {
      organizacaoId: true,
      geradaPorId: true,
    },
  });

  if (!guia) {
    throw new Error("GUIA_NAO_ENCONTRADA");
  }

  const organizacaoId =
    guia.organizacaoId || organizacaoAtualId();

  const emitidoPorId =
    guia.geradaPorId || usuarioAtualId();

  const pagamentos = await tx.pagamento.findMany({
    where: {
      guiaId,
    },
    include: {
      estornos: true,
      recibos: {
        include: {
          recibo: true,
        },
      },
    },
    orderBy: {
      id: "desc",
    },
  });

  const estornosCriados = [];

  for (const pagamento of pagamentos) {
    if (restante <= 0) {
      break;
    }

    const totalEstornadoPagamento = pagamento.estornos.reduce(
      (total: number, estorno: { valor: unknown }) =>
        total + Number(estorno.valor),
      0
    );

    const disponivelParaEstorno = Math.max(
      Number(pagamento.valor) - totalEstornadoPagamento,
      0
    );

    if (disponivelParaEstorno <= 0) {
      continue;
    }

    const valorAplicado = Math.min(
      restante,
      disponivelParaEstorno
    );

    const numero = await proximoNumeroEstorno(
      tx,
      organizacaoId
    );

    const ano = new Date().getFullYear();
    const codigoPublico =
      `EST-${ano}-${String(numero).padStart(6, "0")}`;

    const estornoCriado = await tx.estorno.create({
      data: {
        codigoPublico,
        numero,
        ano,
        organizacaoId,
        emitidoPorId,
        guiaId,
        pagamentoId: pagamento.id,
        valor: valorAplicado,
        forma,
        motivo,
      },
    });

    estornosCriados.push(estornoCriado);

    const vinculoRecibo = pagamento.recibos[0];

    if (vinculoRecibo?.recibo) {
      const novoTotalEstornado =
        totalEstornadoPagamento + valorAplicado;

      await tx.recibo.update({
        where: {
          id: vinculoRecibo.recibo.id,
        },
        data: {
          valorEstornado: novoTotalEstornado,
          status:
            novoTotalEstornado >= Number(pagamento.valor)
              ? "ESTORNADO"
              : "PARCIALMENTE_ESTORNADO",
        },
      });
    }

    restante -= valorAplicado;
  }

  if (restante > 0.009) {
    throw new Error("ESTORNO_SUPERIOR_AO_PAGO");
  }

  return estornosCriados;
}


async function recalcularStatusFinanceiroGuia(tx: any, guiaId: number) {
  const guia = await tx.guia.findUnique({
    where: { id: guiaId },
    include: {
      itens: true,
      pagamentos: true,
      estornos: true,
    },
  });

  if (!guia) {
    throw new Error("GUIA_NAO_ENCONTRADA");
  }

  const possuiItemAtivo = guia.itens.some(
    (item: { status: string }) => item.status !== "CANCELADO"
  );

  const totalPago = guia.pagamentos.reduce(
    (total: number, pagamento: { valor: unknown }) =>
      total + Number(pagamento.valor),
    0
  );

  const totalEstornado = guia.estornos.reduce(
    (total: number, estorno: { valor: unknown }) =>
      total + Number(estorno.valor),
    0
  );

  const pagoLiquido = Math.max(totalPago - totalEstornado, 0);
  const valorFinal = Number(guia.valorFinal);

  let status:
    | "RASCUNHO"
    | "AGUARDANDO_PAGAMENTO"
    | "PARCIALMENTE_PAGA"
    | "PAGA"
    | "ESTORNO_PENDENTE"
    | "CANCELADA";

  if (!possuiItemAtivo && pagoLiquido > 0) {
      status = "ESTORNO_PENDENTE";
    } else if (!possuiItemAtivo) {
      status = "CANCELADA";
    } else if (pagoLiquido > valorFinal) {
      status = "ESTORNO_PENDENTE";
    } else if (valorFinal > 0 && pagoLiquido >= valorFinal) {
      status = "PAGA";
    } else if (pagoLiquido > 0) {
      status = "PARCIALMENTE_PAGA";
    } else {
      status = "AGUARDANDO_PAGAMENTO";
    }

  await tx.guia.update({
    where: { id: guiaId },
    data: { status },
  });

  return {
    status,
    totalPago,
    totalEstornado,
    pagoLiquido,
    saldo: Math.max(valorFinal - pagoLiquido, 0),
  };
}

async function proximoNumeroEstorno(
  tx: any,
  organizacaoId: number
) {
  const serie = await tx.serieEstorno.upsert({
    where: {
      organizacaoId,
    },
    create: {
      organizacaoId,
      ultimoNumero: 100001,
    },
    update: {
      ultimoNumero: {
        increment: 1,
      },
    },
  });

  return serie.ultimoNumero;
}


function limitesDataSaoPaulo(data = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);

  const ano = partes.find((parte) => parte.type === "year")?.value || "1970";
  const mes = partes.find((parte) => parte.type === "month")?.value || "01";
  const dia = partes.find((parte) => parte.type === "day")?.value || "01";

  const inicioDia = new Date(`${ano}-${mes}-${dia}T00:00:00-03:00`);
  const fimDia = new Date(`${ano}-${mes}-${dia}T23:59:59.999-03:00`);
  const inicioMes = new Date(`${ano}-${mes}-01T00:00:00-03:00`);

  const proximoMes =
    Number(mes) === 12
      ? `${Number(ano) + 1}-01-01`
      : `${ano}-${String(Number(mes) + 1).padStart(2, "0")}-01`;

  const fimMes = new Date(
    new Date(`${proximoMes}T00:00:00-03:00`).getTime() - 1
  );

  return {
    ano: Number(ano),
    mes: Number(mes),
    dia: Number(dia),
    inicioDia,
    fimDia,
    inicioMes,
    fimMes,
  };
}

function statusOperacionalDashboard(atendimento: any) {
  if (atendimento.status === "CANCELADO") {
    return "Cancelado";
  }

  if (atendimento.status === "CONCLUIDO") {
    return "Concluído";
  }

  const guiasAtivas = (atendimento.guias || []).filter(
    (guia: any) =>
      guia.status !== "CANCELADA" &&
      (guia.itens || []).some(
        (item: any) => item.status !== "CANCELADO"
      )
  );

  if (guiasAtivas.length === 0) {
    return "Em andamento";
  }

  if (
    guiasAtivas.some(
      (guia: any) => guia.status === "ESTORNO_PENDENTE"
    )
  ) {
    return "Estorno pendente";
  }

  const possuiAgendamentoPendente = guiasAtivas.some(
    (guia: any) =>
      (guia.itens || [])
        .filter((item: any) => item.status !== "CANCELADO")
        .some((item: any) => !item.dataAgendamento)
  );

  if (possuiAgendamentoPendente) {
    return "Aguardando agendamento";
  }

  if (
    guiasAtivas.some(
      (guia: any) => guia.status === "PARCIALMENTE_PAGA"
    )
  ) {
    return "Parcialmente pago";
  }

  if (
    guiasAtivas.some(
      (guia: any) =>
        guia.status === "AGUARDANDO_PAGAMENTO" ||
        guia.status === "RASCUNHO"
    )
  ) {
    return "Aguardando pagamento";
  }

  if (
    guiasAtivas.every(
      (guia: any) => guia.status === "PAGA"
    )
  ) {
    return "Pago e agendado";
  }

  return "Em andamento";
}

function textoAtualizacaoDashboard(data: Date | string) {
  const agora = Date.now();
  const momento = new Date(data).getTime();
  const minutos = Math.floor((agora - momento) / 60000);

  if (minutos < 1) return "Agora";
  if (minutos < 60) return `Há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Há ${horas} h`;

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(data));
}

// ======================================================
// TESTE DA API
// ======================================================

app.get("/", (_req, res) => {
  res.json({
    sistema: "Digna Conect",
    api: "online",
  });
});



// ======================================================
// PESQUISA GLOBAL, NOTIFICAÇÕES E SUPORTE
// ======================================================

app.get("/busca-global", async (req, res) => {
  try {
    const usuario = (req as RequestComUsuario).usuarioAutenticado!;
    const termo = String(req.query.q || "").trim();

    if (termo.length < 2) {
      return res.json({ resultados: [] });
    }

    const termoNumerico = termo.replace(/\D/g, "");
    const idExato = /^\d+$/.test(termo) ? Number(termo) : null;
    const limitePorGrupo = 6;

    type OpcaoProcedimentoBusca = {
      clinicaId: number;
      clinicaNome: string;
      unidadeClinicaId: number | null;
      unidadeClinicaNome: string | null;
      localizacao: string | null;
      valorPaciente: number;
      uso: number;
    };

    const resultados: Array<{
      tipo:
        | "PACIENTE"
        | "GUIA"
        | "ORCAMENTO"
        | "CLINICA"
        | "ATENDIMENTO"
        | "PROCEDIMENTO";
      id: number;
      titulo: string;
      subtitulo: string;
      href: string;
      opcoes?: OpcaoProcedimentoBusca[];
    }> = [];

    if (possuiPermissao(usuario, "pacientes.visualizar")) {
      const pacientes = await prisma.paciente.findMany({
        where: {
          OR: [
            { nome: { contains: termo, mode: "insensitive" } },
            { nomeSocial: { contains: termo, mode: "insensitive" } },
            ...(termoNumerico
              ? [
                  { cpf: { contains: termoNumerico } },
                  { telefone: { contains: termoNumerico } },
                ]
              : []),
            ...(idExato ? [{ id: idExato }] : []),
            { codigoPublico: { contains: termo, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          codigoPublico: true,
          nome: true,
          nomeSocial: true,
          cpf: true,
          telefone: true,
        },
        orderBy: { atualizadoEm: "desc" },
        take: limitePorGrupo,
      });

      for (const paciente of pacientes) {
        resultados.push({
          tipo: "PACIENTE",
          id: paciente.id,
          titulo: paciente.nomeSocial || paciente.nome,
          subtitulo: [paciente.codigoPublico, paciente.cpf, paciente.telefone]
            .filter(Boolean)
            .join(" • "),
          href: `/pacientes/${paciente.id}`,
        });
      }
    }

    if (possuiPermissao(usuario, "guias.visualizar")) {
      const guias = await prisma.guia.findMany({
        where: {
          AND: [
            {
              OR: [
                { organizacaoId: organizacaoAtualId() },
                { organizacaoId: null },
              ],
            },
            {
              OR: [
                { codigoPublico: { contains: termo, mode: "insensitive" } },
                { atendimento: { codigoPublico: { contains: termo, mode: "insensitive" } } },
                { atendimento: { paciente: { nome: { contains: termo, mode: "insensitive" } } } },
                ...(termoNumerico
                  ? [
                      { atendimento: { paciente: { cpf: { contains: termoNumerico } } } },
                    ]
                  : []),
                ...(idExato ? [{ id: idExato }] : []),
              ],
            },
          ],
        },
        include: {
          clinica: { select: { nome: true } },
          atendimento: {
            include: {
              paciente: { select: { nome: true, cpf: true } },
            },
          },
        },
        orderBy: { atualizadoEm: "desc" },
        take: limitePorGrupo,
      });

      for (const guia of guias) {
        resultados.push({
          tipo: "GUIA",
          id: guia.id,
          titulo: guia.codigoPublico || `Guia #${guia.id}`,
          subtitulo: `${guia.atendimento.paciente.nome} • ${guia.clinica.nome}`,
          href: `/guias/${guia.id}`,
        });
      }
    }

    if (possuiPermissao(usuario, "orcamentos.visualizar")) {
      const orcamentos = await prisma.orcamento.findMany({
        where: {
          AND: [
            {
              OR: [
                { organizacaoId: organizacaoAtualId() },
                { organizacaoId: null },
              ],
            },
            {
              OR: [
                { codigoPublico: { contains: termo, mode: "insensitive" } },
                { nomePaciente: { contains: termo, mode: "insensitive" } },
                { telefonePaciente: { contains: termoNumerico || termo } },
                ...(idExato ? [{ id: idExato }] : []),
              ],
            },
          ],
        },
        select: {
          id: true,
          codigoPublico: true,
          nomePaciente: true,
          telefonePaciente: true,
          status: true,
        },
        orderBy: { atualizadoEm: "desc" },
        take: limitePorGrupo,
      });

      for (const orcamento of orcamentos) {
        resultados.push({
          tipo: "ORCAMENTO",
          id: orcamento.id,
          titulo: orcamento.codigoPublico || `Orçamento #${orcamento.id}`,
          subtitulo: `${orcamento.nomePaciente} • ${orcamento.telefonePaciente}`,
          href: `/orcamentos/${orcamento.id}`,
        });
      }
    }

    if (possuiPermissao(usuario, "procedimentos.visualizar")) {
      // A busca por procedimentos é feita em duas etapas. Primeiro carregamos apenas
      // os campos leves do catálogo para localizar nome, sinônimos e TUSS. Depois
      // buscamos preços e uso somente para os poucos resultados exibidos.
      const catalogoProcedimentos = await prisma.procedimento.findMany({
        where: { ativo: true },
        select: {
          id: true,
          nome: true,
          categoria: true,
          aliases: true,
          codigoTuss: true,
          nomeTuss: true,
          referencia: {
            select: {
              codigoTuss: true,
              nomeTuss: true,
            },
          },
        },
        orderBy: { nome: "asc" },
      });

      const termoProcedimento = normalizarTextoProcedimento(termo);

      const candidatos = termoProcedimento
        ? catalogoProcedimentos
        .map((procedimento) => {
          const nomes = [
            procedimento.nome,
            ...procedimento.aliases,
            procedimento.nomeTuss,
            procedimento.referencia?.nomeTuss,
          ]
            .filter(Boolean)
            .map((valor) => normalizarTextoProcedimento(valor));

          const codigos = [
            procedimento.codigoTuss,
            procedimento.referencia?.codigoTuss,
          ]
            .filter(Boolean)
            .map((valor) => normalizarTextoProcedimento(valor));

          const categoria = normalizarTextoProcedimento(procedimento.categoria);

          let pontuacao = Number.POSITIVE_INFINITY;

          if (nomes.some((nome) => nome === termoProcedimento)) pontuacao = 0;
          else if (nomes.some((nome) => nome.startsWith(termoProcedimento))) pontuacao = 1;
          else if (codigos.some((codigo) => codigo.includes(termoProcedimento))) pontuacao = 1;
          else if (nomes.some((nome) => nome.includes(termoProcedimento))) pontuacao = 2;
          else if (categoria.includes(termoProcedimento)) pontuacao = 3;

          return { procedimento, pontuacao };
        })
        .filter((registro) => Number.isFinite(registro.pontuacao))
        .sort((a, b) =>
          a.pontuacao !== b.pontuacao
            ? a.pontuacao - b.pontuacao
            : a.procedimento.nome.localeCompare(b.procedimento.nome, "pt-BR")
        )
        .slice(0, limitePorGrupo)
        .map((registro) => registro.procedimento)
        : [];

      if (candidatos.length > 0) {
        const ids = candidatos.map((procedimento) => procedimento.id);

        const [precosBase, precosUnidade, itensHistorico] = await Promise.all([
          prisma.precoProcedimentoClinica.findMany({
            where: {
              procedimentoId: { in: ids },
              ativo: true,
              clinica: { ativo: true },
            },
            select: {
              procedimentoId: true,
              clinicaId: true,
              valorPaciente: true,
              clinica: {
                select: {
                  id: true,
                  nome: true,
                  endereco: true,
                  cidadeFiscal: true,
                  ufFiscal: true,
                  unidades: {
                    where: { ativo: true },
                    select: {
                      id: true,
                      nome: true,
                      cidade: true,
                      uf: true,
                    },
                    orderBy: { nome: "asc" },
                  },
                },
              },
            },
          }),
          prisma.precoProcedimentoUnidade.findMany({
            where: {
              procedimentoId: { in: ids },
              ativo: true,
              unidadeClinica: {
                ativo: true,
                clinica: { ativo: true },
              },
            },
            select: {
              procedimentoId: true,
              unidadeClinicaId: true,
              valorPaciente: true,
            },
          }),
          prisma.itemGuia.findMany({
            where: {
              procedimentoId: { in: ids },
              status: { not: "CANCELADO" },
              guia: {
                OR: [
                  { organizacaoId: organizacaoAtualId() },
                  { organizacaoId: null },
                ],
                status: { not: "CANCELADA" },
              },
            },
            select: {
              procedimentoId: true,
              guia: {
                select: {
                  clinicaId: true,
                  unidadeClinicaId: true,
                },
              },
            },
          }),
        ]);

        const usoClinica = new Map<string, number>();
        const usoUnidade = new Map<string, number>();

        for (const item of itensHistorico) {
          const chaveClinica = `${item.procedimentoId}:${item.guia.clinicaId}`;
          usoClinica.set(chaveClinica, (usoClinica.get(chaveClinica) || 0) + 1);

          if (item.guia.unidadeClinicaId) {
            const chaveUnidade = `${item.procedimentoId}:${item.guia.clinicaId}:${item.guia.unidadeClinicaId}`;
            usoUnidade.set(chaveUnidade, (usoUnidade.get(chaveUnidade) || 0) + 1);
          }
        }

        const precoUnidadePorChave = new Map<string, number>();
        for (const preco of precosUnidade) {
          precoUnidadePorChave.set(
            `${preco.procedimentoId}:${preco.unidadeClinicaId}`,
            Number(preco.valorPaciente)
          );
        }

        for (const procedimento of candidatos) {
          const opcoes: OpcaoProcedimentoBusca[] = [];
          const basesDoProcedimento = precosBase.filter(
            (preco) => preco.procedimentoId === procedimento.id
          );

          for (const preco of basesDoProcedimento) {
            const unidades = preco.clinica.unidades || [];
            const usoTotalClinica =
              usoClinica.get(`${procedimento.id}:${preco.clinicaId}`) || 0;

            if (unidades.length === 0) {
              const localizacaoFiscal = [
                preco.clinica.cidadeFiscal,
                preco.clinica.ufFiscal,
              ]
                .filter(Boolean)
                .join("/");

              opcoes.push({
                clinicaId: preco.clinicaId,
                clinicaNome: preco.clinica.nome,
                unidadeClinicaId: null,
                unidadeClinicaNome: null,
                localizacao: localizacaoFiscal || preco.clinica.endereco || null,
                valorPaciente: Number(preco.valorPaciente),
                uso: usoTotalClinica,
              });
              continue;
            }

            for (const unidade of unidades) {
              const chaveUnidade = `${procedimento.id}:${preco.clinicaId}:${unidade.id}`;
              const usoEspecifico = usoUnidade.get(chaveUnidade) || 0;
              const localizacao = [unidade.cidade, unidade.uf]
                .filter(Boolean)
                .join("/");

              opcoes.push({
                clinicaId: preco.clinicaId,
                clinicaNome: preco.clinica.nome,
                unidadeClinicaId: unidade.id,
                unidadeClinicaNome: unidade.nome,
                localizacao: localizacao || null,
                valorPaciente:
                  precoUnidadePorChave.get(`${procedimento.id}:${unidade.id}`) ??
                  Number(preco.valorPaciente),
                uso: usoEspecifico > 0 ? usoEspecifico : usoTotalClinica,
              });
            }
          }

          opcoes.sort((a, b) => {
            if (a.uso !== b.uso) return b.uso - a.uso;
            if (a.valorPaciente !== b.valorPaciente) {
              return a.valorPaciente - b.valorPaciente;
            }
            const clinica = a.clinicaNome.localeCompare(b.clinicaNome, "pt-BR");
            if (clinica !== 0) return clinica;
            return (a.unidadeClinicaNome || "").localeCompare(
              b.unidadeClinicaNome || "",
              "pt-BR"
            );
          });

          const codigoTuss =
            procedimento.referencia?.codigoTuss || procedimento.codigoTuss;

          resultados.push({
            tipo: "PROCEDIMENTO",
            id: procedimento.id,
            titulo: procedimento.nome,
            subtitulo: [
              procedimento.categoria,
              codigoTuss ? `TUSS ${codigoTuss}` : null,
            ]
              .filter(Boolean)
              .join(" • "),
            href: "/procedimentos",
            opcoes,
          });
        }
      }
    }

    if (possuiPermissao(usuario, "clinicas.visualizar")) {
      const clinicas = await prisma.clinica.findMany({
        where: {
          OR: [
            { nome: { contains: termo, mode: "insensitive" } },
            { razaoSocial: { contains: termo, mode: "insensitive" } },
            { documento: { contains: termoNumerico || termo } },
            { telefone: { contains: termoNumerico || termo } },
            ...(idExato ? [{ id: idExato }] : []),
          ],
        },
        select: {
          id: true,
          nome: true,
          documento: true,
          telefone: true,
        },
        orderBy: { nome: "asc" },
        take: limitePorGrupo,
      });

      for (const clinica of clinicas) {
        resultados.push({
          tipo: "CLINICA",
          id: clinica.id,
          titulo: clinica.nome,
          subtitulo: [clinica.documento, clinica.telefone].filter(Boolean).join(" • "),
          href: `/clinicas/${clinica.id}`,
        });
      }
    }

    if (possuiPermissao(usuario, "atendimentos.visualizar")) {
      const atendimentos = await prisma.atendimento.findMany({
        where: {
          AND: [
            {
              OR: [
                { organizacaoId: organizacaoAtualId() },
                { organizacaoId: null },
              ],
            },
            {
              OR: [
                { codigoPublico: { contains: termo, mode: "insensitive" } },
                { paciente: { nome: { contains: termo, mode: "insensitive" } } },
                ...(termoNumerico
                  ? [
                      { paciente: { cpf: { contains: termoNumerico } } },
                      { paciente: { telefone: { contains: termoNumerico } } },
                    ]
                  : []),
                ...(idExato ? [{ id: idExato }] : []),
              ],
            },
          ],
        },
        include: {
          paciente: { select: { nome: true, cpf: true } },
        },
        orderBy: { atualizadoEm: "desc" },
        take: limitePorGrupo,
      });

      for (const atendimento of atendimentos) {
        resultados.push({
          tipo: "ATENDIMENTO",
          id: atendimento.id,
          titulo: atendimento.codigoPublico || `Atendimento #${atendimento.id}`,
          subtitulo: `${atendimento.paciente.nome} • ${atendimento.status.replaceAll("_", " ")}`,
          href: `/atendimentos/${atendimento.id}`,
        });
      }
    }

    return res.json({
      resultados: resultados.slice(0, 30),
    });
  } catch (erro) {
    console.error("Erro na pesquisa global:", erro);
    return res.status(500).json({ erro: "Não foi possível realizar a pesquisa global." });
  }
});

app.get("/notificacoes", async (req, res) => {
  try {
    const usuario = (req as RequestComUsuario).usuarioAutenticado!;
    const { inicioDia } = limitesDataSaoPaulo();

    const atendimentos = await prisma.atendimento.findMany({
      where: {
        OR: [
          { organizacaoId: organizacaoAtualId() },
          { organizacaoId: null },
        ],
      },
      include: {
        guias: {
          include: {
            itens: true,
          },
        },
      },
      orderBy: { atualizadoEm: "desc" },
    });

    const ativos = atendimentos
      .map((atendimento) => ({
        atendimento,
        status: statusOperacionalDashboard(atendimento),
      }))
      .filter(({ status }) => status !== "Cancelado" && status !== "Concluído");

    const aguardandoAgendamento = ativos.filter(
      ({ status }) => status === "Aguardando agendamento"
    ).length;

    const guiasPagamento = await prisma.guia.count({
      where: {
        OR: [
          { organizacaoId: organizacaoAtualId() },
          { organizacaoId: null },
        ],
        status: { in: ["AGUARDANDO_PAGAMENTO", "PARCIALMENTE_PAGA"] },
      },
    });

    const estornosPendentes = await prisma.guia.count({
      where: {
        OR: [
          { organizacaoId: organizacaoAtualId() },
          { organizacaoId: null },
        ],
        status: "ESTORNO_PENDENTE",
      },
    });

    const itensAtrasados = await prisma.itemGuia.count({
      where: {
        status: { notIn: ["CANCELADO", "REALIZADO"] },
        dataAgendamento: { lt: inicioDia },
        guia: {
          OR: [
            { organizacaoId: organizacaoAtualId() },
            { organizacaoId: null },
          ],
          status: { not: "CANCELADA" },
        },
      },
    });

    const notificacoes: Array<{
      id: string;
      titulo: string;
      descricao: string;
      href: string;
      prioridade: "ALTA" | "MEDIA" | "BAIXA";
      quantidade: number;
    }> = [];

    if (itensAtrasados > 0) {
      notificacoes.push({
        id: "agendamentos-atrasados",
        titulo: "Agendamentos atrasados",
        descricao: `${itensAtrasados} procedimento(s) têm data anterior a hoje e ainda não foram realizados.`,
        href: "/?secao=pendencias",
        prioridade: "ALTA",
        quantidade: itensAtrasados,
      });
    }

    if (estornosPendentes > 0) {
      notificacoes.push({
        id: "estornos-pendentes",
        titulo: "Estornos pendentes",
        descricao: `${estornosPendentes} guia(s) precisam de conferência de estorno.`,
        href: "/guias",
        prioridade: "ALTA",
        quantidade: estornosPendentes,
      });
    }

    if (aguardandoAgendamento > 0) {
      notificacoes.push({
        id: "aguardando-agendamento",
        titulo: "Aguardando agendamento",
        descricao: `${aguardandoAgendamento} atendimento(s) ainda precisam de data ou horário.`,
        href: "/atendimentos",
        prioridade: "MEDIA",
        quantidade: aguardandoAgendamento,
      });
    }

    if (guiasPagamento > 0) {
      notificacoes.push({
        id: "aguardando-pagamento",
        titulo: "Guias aguardando pagamento",
        descricao: `${guiasPagamento} guia(s) ainda não estão integralmente quitadas.`,
        href: "/guias",
        prioridade: "MEDIA",
        quantidade: guiasPagamento,
      });
    }

    if (possuiPermissao(usuario, "financeiro.visualizar")) {
      const repassesPendentes = await prisma.repasse.count({
        where: {
          OR: [
            { organizacaoId: organizacaoAtualId() },
            { organizacaoId: null },
          ],
          status: { in: ["SOLICITADO", "EM_ANALISE", "APROVADO"] },
        },
      });

      if (repassesPendentes > 0) {
        notificacoes.push({
          id: "repasses-pendentes",
          titulo: "Repasses pendentes",
          descricao: `${repassesPendentes} solicitação(ões) de repasse exigem acompanhamento.`,
          href: "/financeiro/repasses",
          prioridade: "MEDIA",
          quantidade: repassesPendentes,
        });
      }
    }

    return res.json({
      total: notificacoes.length,
      notificacoes,
      atualizadoEm: new Date().toISOString(),
    });
  } catch (erro) {
    console.error("Erro ao carregar notificações:", erro);
    return res.status(500).json({ erro: "Não foi possível carregar as notificações." });
  }
});

app.post("/suporte/problemas", async (req, res) => {
  try {
    const usuario = (req as RequestComUsuario).usuarioAutenticado!;
    const titulo = String(req.body?.titulo || "Problema informado pelo usuário").trim().slice(0, 180);
    const descricao = String(req.body?.descricao || "").trim();
    const pagina = String(req.body?.pagina || "").trim().slice(0, 500) || null;
    const rota = String(req.body?.rota || "").trim().slice(0, 500) || null;
    const navegador = String(req.body?.navegador || "").trim().slice(0, 1000) || null;
    const screenshotDataUrl = typeof req.body?.screenshotDataUrl === "string"
      ? req.body.screenshotDataUrl
      : "";

    if (descricao.length < 5) {
      return res.status(400).json({ erro: "Descreva o problema com um pouco mais de detalhes." });
    }

    let screenshot: Uint8Array<ArrayBuffer> | null = null;
    let screenshotMime: string | null = null;

    if (screenshotDataUrl) {
      const correspondencia = screenshotDataUrl.match(
        /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/
      );

      if (!correspondencia) {
        return res.status(400).json({ erro: "A captura de tela enviada não é válida." });
      }

      screenshotMime = correspondencia[1];
      const screenshotBuffer = Buffer.from(correspondencia[2], "base64");
      screenshot = Uint8Array.from(screenshotBuffer);

      if (screenshot.length > 3 * 1024 * 1024) {
        return res.status(413).json({ erro: "A captura de tela deve ter no máximo 3 MB." });
      }
    }

    const relato = await prisma.relatoProblema.create({
      data: {
        organizacaoId: usuario.organizacaoId,
        usuarioId: usuario.id,
        titulo: titulo || "Problema informado pelo usuário",
        descricao,
        pagina,
        rota,
        navegador,
        screenshotMime,
        screenshot,
      },
      select: {
        id: true,
        status: true,
        criadoEm: true,
      },
    });

    return res.status(201).json({
      id: relato.id,
      protocolo: `PRB-${String(relato.id).padStart(6, "0")}`,
      status: relato.status,
      criadoEm: relato.criadoEm,
    });
  } catch (erro) {
    console.error("Erro ao registrar problema:", erro);
    return res.status(500).json({ erro: "Não foi possível enviar o relato do problema." });
  }
});

app.get("/suporte/problemas", async (req, res) => {
  try {
    const usuario = (req as RequestComUsuario).usuarioAutenticado!;

    if (usuario.perfil !== "ADMINISTRADOR" && usuario.perfil !== "DESENVOLVEDOR") {
      return res.status(403).json({ erro: "Apenas administrador ou desenvolvedor pode consultar os relatos." });
    }

    const relatos = await prisma.relatoProblema.findMany({
      where: {
        organizacaoId: usuario.organizacaoId,
      },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
      orderBy: { criadoEm: "desc" },
      take: 50,
    });

    return res.json({
      relatos: relatos.map((relato) => ({
        id: relato.id,
        protocolo: `PRB-${String(relato.id).padStart(6, "0")}`,
        titulo: relato.titulo,
        descricao: relato.descricao,
        pagina: relato.pagina,
        rota: relato.rota,
        navegador: relato.navegador,
        status: relato.status,
        possuiScreenshot: Boolean(relato.screenshot),
        criadoEm: relato.criadoEm,
        atualizadoEm: relato.atualizadoEm,
        usuario: relato.usuario,
      })),
    });
  } catch (erro) {
    console.error("Erro ao listar relatos de problema:", erro);
    return res.status(500).json({ erro: "Não foi possível carregar os relatos." });
  }
});

app.get("/suporte/problemas/:id/screenshot", async (req, res) => {
  try {
    const usuario = (req as RequestComUsuario).usuarioAutenticado!;
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "Relato inválido." });
    }

    const relato = await prisma.relatoProblema.findFirst({
      where: {
        id,
        organizacaoId: usuario.organizacaoId,
      },
      select: {
        usuarioId: true,
        screenshot: true,
        screenshotMime: true,
      },
    });

    if (!relato || !relato.screenshot || !relato.screenshotMime) {
      return res.status(404).json({ erro: "Captura de tela não encontrada." });
    }

    const podeVisualizar =
      usuario.id === relato.usuarioId ||
      usuario.perfil === "ADMINISTRADOR" ||
      usuario.perfil === "DESENVOLVEDOR";

    if (!podeVisualizar) {
      return res.status(403).json({ erro: "Você não possui acesso a esta captura." });
    }

    res.setHeader("Content-Type", relato.screenshotMime);
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.send(Buffer.from(relato.screenshot));
  } catch (erro) {
    console.error("Erro ao abrir captura de problema:", erro);
    return res.status(500).json({ erro: "Não foi possível abrir a captura de tela." });
  }
});

// ======================================================
// DASHBOARD - DADOS REAIS
// ======================================================

app.get("/dashboard", async (req, res) => {
  try {
    const usuario = (req as RequestComUsuario).usuarioAutenticado!;
    const podeVerFinanceiro = possuiPermissao(usuario, "financeiro.visualizar");

    const {
      mes,
      dia,
      inicioDia,
      fimDia,
      inicioMes,
      fimMes,
    } = limitesDataSaoPaulo();

    const [
      atendimentos,
      pagamentosHoje,
      pagamentosMes,
      estornosHoje,
      estornosMes,
      itensAgendaHoje,
      pacientesComNascimento,
      itensAtrasados,
      repassesPendentes,
      guiasAguardandoPagamento,
      guiasEstornoPendente,
    ] = await Promise.all([
      prisma.atendimento.findMany({
        where: {
          OR: [
            { organizacaoId: organizacaoAtualId() },
            { organizacaoId: null },
          ],
        },
        include: {
          paciente: true,
          guias: {
            include: {
              clinica: true,
              itens: {
                include: {
                  procedimento: true,
                },
              },
            },
          },
        },
        orderBy: {
          atualizadoEm: "desc",
        },
      }),

      podeVerFinanceiro
        ? prisma.pagamento.findMany({
            where: {
              criadoEm: {
                gte: inicioDia,
                lte: fimDia,
              },
              guia: {
                OR: [
                  { organizacaoId: organizacaoAtualId() },
                  { organizacaoId: null },
                ],
              },
            },
            select: {
              valor: true,
            },
          })
        : Promise.resolve([]),

      podeVerFinanceiro
        ? prisma.pagamento.findMany({
            where: {
              criadoEm: {
                gte: inicioMes,
                lte: fimMes,
              },
              guia: {
                OR: [
                  { organizacaoId: organizacaoAtualId() },
                  { organizacaoId: null },
                ],
              },
            },
            select: {
              valor: true,
            },
          })
        : Promise.resolve([]),

      podeVerFinanceiro
        ? prisma.estorno.findMany({
            where: {
              criadoEm: {
                gte: inicioDia,
                lte: fimDia,
              },
              organizacaoId: organizacaoAtualId(),
            },
            select: {
              valor: true,
            },
          })
        : Promise.resolve([]),

      podeVerFinanceiro
        ? prisma.estorno.findMany({
            where: {
              criadoEm: {
                gte: inicioMes,
                lte: fimMes,
              },
              organizacaoId: organizacaoAtualId(),
            },
            select: {
              valor: true,
            },
          })
        : Promise.resolve([]),

      prisma.itemGuia.findMany({
        where: {
          status: {
            not: "CANCELADO",
          },
          dataAgendamento: {
            gte: inicioDia,
            lte: fimDia,
          },
          guia: {
            OR: [
              { organizacaoId: organizacaoAtualId() },
              { organizacaoId: null },
            ],
            status: {
              not: "CANCELADA",
            },
          },
        },
        include: {
          procedimento: true,
          guia: {
            include: {
              clinica: true,
              atendimento: {
                include: {
                  paciente: true,
                },
              },
            },
          },
        },
        orderBy: [
          {
            horarioAgendamento: "asc",
          },
          {
            id: "asc",
          },
        ],
      }),

      prisma.paciente.findMany({
        where: {
          dataNascimento: {
            not: null,
          },
        },
        select: {
          id: true,
          codigoPublico: true,
          nome: true,
          dataNascimento: true,
        },
        orderBy: {
          nome: "asc",
        },
      }),

      prisma.itemGuia.findMany({
        where: {
          status: { notIn: ["CANCELADO", "REALIZADO"] },
          dataAgendamento: { lt: inicioDia },
          guia: {
            OR: [
              { organizacaoId: organizacaoAtualId() },
              { organizacaoId: null },
            ],
            status: { not: "CANCELADA" },
          },
        },
        include: {
          procedimento: { select: { nome: true } },
          guia: {
            include: {
              clinica: { select: { nome: true } },
              atendimento: {
                include: {
                  paciente: { select: { nome: true } },
                },
              },
            },
          },
        },
        orderBy: { dataAgendamento: "asc" },
        take: 20,
      }),

      podeVerFinanceiro
        ? prisma.repasse.findMany({
            where: {
              OR: [
                { organizacaoId: organizacaoAtualId() },
                { organizacaoId: null },
              ],
              status: { in: ["SOLICITADO", "EM_ANALISE", "APROVADO"] },
            },
            select: {
              id: true,
              valorTotal: true,
              status: true,
            },
          })
        : Promise.resolve([]),

      // Usa exatamente a mesma regra da Central de Notificações para evitar
      // divergência entre o sino e os indicadores do Dashboard.
      prisma.guia.count({
        where: {
          OR: [
            { organizacaoId: organizacaoAtualId() },
            { organizacaoId: null },
          ],
          status: { in: ["AGUARDANDO_PAGAMENTO", "PARCIALMENTE_PAGA"] },
        },
      }),

      prisma.guia.count({
        where: {
          OR: [
            { organizacaoId: organizacaoAtualId() },
            { organizacaoId: null },
          ],
          status: "ESTORNO_PENDENTE",
        },
      }),
    ]);

    const atendimentosComStatus = atendimentos.map(
      (atendimento) => ({
        atendimento,
        status: statusOperacionalDashboard(atendimento),
      })
    );

    const ativos = atendimentosComStatus.filter(
      ({ status }) =>
        status !== "Cancelado" &&
        status !== "Concluído"
    );

    const aguardandoAgendamento = ativos.filter(
      ({ status }) => status === "Aguardando agendamento"
    ).length;

    // Estes dois indicadores são contagens de GUIAS, não de atendimentos.
    // A mesma regra é usada em /notificacoes.
    const aguardandoPagamento = guiasAguardandoPagamento;

    const agendados = ativos.filter(
      ({ status }) => status === "Pago e agendado"
    ).length;

    const estornosPendentes = guiasEstornoPendente;

    const concluidos = atendimentosComStatus.filter(
      ({ status }) => status === "Concluído"
    ).length;

    const totalPagamentosHoje = pagamentosHoje.reduce(
      (total, pagamento) => total + Number(pagamento.valor),
      0
    );

    const totalPagamentosMes = pagamentosMes.reduce(
      (total, pagamento) => total + Number(pagamento.valor),
      0
    );

    const totalEstornosHoje = estornosHoje.reduce(
      (total, estorno) => total + Number(estorno.valor),
      0
    );

    const totalEstornosMes = estornosMes.reduce(
      (total, estorno) => total + Number(estorno.valor),
      0
    );

    const recebidoHoje = podeVerFinanceiro
      ? Math.max(totalPagamentosHoje - totalEstornosHoje, 0)
      : 0;

    const recebidoMes = podeVerFinanceiro
      ? Math.max(totalPagamentosMes - totalEstornosMes, 0)
      : 0;

    const repassesPendentesQuantidade = repassesPendentes.length;
    const repassesPendentesValor = repassesPendentes.reduce(
      (total, repasse) => total + Number(repasse.valorTotal),
      0
    );

    const atrasados = itensAtrasados.length;
    const pendenciasCriticas =
      estornosPendentes +
      atrasados +
      (podeVerFinanceiro ? repassesPendentesQuantidade : 0);

    const atendimentosRecentes = ativos
      .slice(0, 8)
      .map(({ atendimento, status }) => {
        const guiasAtivas = atendimento.guias.filter(
          (guia) =>
            guia.status !== "CANCELADA" &&
            guia.itens.some(
              (item) => item.status !== "CANCELADO"
            )
        );

        const procedimentos = [
          ...new Set(
            guiasAtivas.flatMap((guia) =>
              guia.itens
                .filter(
                  (item) => item.status !== "CANCELADO"
                )
                .map((item) => item.procedimento.nome)
            )
          ),
        ];

        const clinicas = [
          ...new Set(
            guiasAtivas.map((guia) => guia.clinica.nome)
          ),
        ];

        return {
          id: atendimento.id,
          codigoPublico:
            atendimento.codigoPublico || "Código pendente",
          paciente: atendimento.paciente.nome,
          procedimento:
            procedimentos.join(", ") || "Nenhum procedimento",
          clinica:
            clinicas.join(", ") || "Não definida",
          status,
          atualizado:
            textoAtualizacaoDashboard(atendimento.atualizadoEm),
        };
      });

    const agendaHoje = itensAgendaHoje.map((item) => {
      const atendimento = item.guia.atendimento;

      const status = statusOperacionalDashboard({
        ...atendimento,
        guias: atendimentos.find(
          (registro) => registro.id === atendimento.id
        )?.guias || [item.guia],
      });

      return {
        itemGuiaId: item.id,
        atendimentoId: atendimento.id,
        codigoPublico:
          atendimento.codigoPublico || "Código pendente",
        horario:
          item.tipoAgendamento === "ORDEM_CHEGADA"
            ? "Ordem"
            : item.horarioAgendamento || "--:--",
        paciente: atendimento.paciente.nome,
        procedimento: item.procedimento.nome,
        clinica: item.guia.clinica.nome,
        status,
      };
    });

    const aniversariantesHoje = pacientesComNascimento
      .filter((paciente) => {
        if (!paciente.dataNascimento) {
          return false;
        }

        const dataNascimento = new Date(
          paciente.dataNascimento
        );

        return (
          dataNascimento.getUTCMonth() + 1 === mes &&
          dataNascimento.getUTCDate() === dia
        );
      })
      .slice(0, 8)
      .map((paciente) => ({
        id: paciente.id,
        codigoPublico: paciente.codigoPublico,
        nome: paciente.nome,
        tipo: "Paciente",
      }));

    const atrasadosDetalhes = itensAtrasados.slice(0, 8).map((item) => ({
      id: item.id,
      atendimentoId: item.guia.atendimento.id,
      codigoPublico: item.guia.atendimento.codigoPublico || "Código pendente",
      paciente: item.guia.atendimento.paciente.nome,
      procedimento: item.procedimento.nome,
      clinica: item.guia.clinica.nome,
      dataAgendamento: item.dataAgendamento,
      horarioAgendamento: item.horarioAgendamento,
    }));

    return res.json({
      geradoEm: new Date().toISOString(),
      financeiroVisivel: podeVerFinanceiro,

      resumo: {
        atendimentosAtivos: ativos.length,
        aguardandoAgendamento,
        aguardandoPagamento,
        agendados,
        pendencias: estornosPendentes,
        pendenciasCriticas,
        atrasados,
        concluidos,
        agendamentosHoje: agendaHoje.length,
        recebidoHoje,
        recebidoMes,
        repassesPendentesQuantidade,
        repassesPendentesValor,
      },

      atendimentosRecentes,
      agendaHoje,
      aniversariantesHoje,
      atrasadosDetalhes,
    });
  } catch (erro) {
    console.error(
      "Erro ao carregar dashboard:",
      erro
    );

    return res.status(500).json({
      erro: "Não foi possível carregar os dados do dashboard.",
    });
  }
});


// ======================================================
// AGENDA - CONSULTA POR DATA
// ======================================================

app.get("/agenda", async (req, res) => {
  try {
    const dataRecebida =
      typeof req.query.data === "string"
        ? req.query.data
        : "";

    const dataValida =
      /^\d{4}-\d{2}-\d{2}$/.test(dataRecebida);

    if (!dataValida) {
      return res.status(400).json({
        erro: "Informe a data no formato AAAA-MM-DD.",
      });
    }

    const inicioDia = new Date(
      `${dataRecebida}T00:00:00-03:00`
    );

    const fimDia = new Date(
      `${dataRecebida}T23:59:59.999-03:00`
    );

    const itens = await prisma.itemGuia.findMany({
      where: {
        status: {
          not: "CANCELADO",
        },
        dataAgendamento: {
          gte: inicioDia,
          lte: fimDia,
        },
        guia: {
          OR: [
            { organizacaoId: organizacaoAtualId() },
            { organizacaoId: null },
          ],
          status: {
            not: "CANCELADA",
          },
        },
      },
      include: {
        procedimento: true,
        guia: {
          include: {
            clinica: true,
            unidadeClinica: true,
            pagamentos: true,
            estornos: true,
            atendimento: {
              include: {
                paciente: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          horarioAgendamento: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

    const atendimentosIds = [
      ...new Set(
        itens.map(
          (item) => item.guia.atendimento.id
        )
      ),
    ];

    const atendimentosCompletos =
      atendimentosIds.length > 0
        ? await prisma.atendimento.findMany({
            where: {
              id: {
                in: atendimentosIds,
              },
            },
            include: {
              paciente: true,
              guias: {
                include: {
                  clinica: true,
                  unidadeClinica: true,
                  itens: {
                    include: {
                      procedimento: true,
                    },
                  },
                },
              },
            },
          })
        : [];

    const statusPorAtendimento = new Map(
      atendimentosCompletos.map((atendimento) => [
        atendimento.id,
        statusOperacionalDashboard(atendimento),
      ])
    );

    const registros = itens.map((item) => {
      const atendimento = item.guia.atendimento;

      const totalPago = item.guia.pagamentos.reduce(
        (total, pagamento) =>
          total + Number(pagamento.valor),
        0
      );

      const totalEstornado =
        item.guia.estornos.reduce(
          (total, estorno) =>
            total + Number(estorno.valor),
          0
        );

      const valorFinal = Number(
        item.guia.valorFinal
      );

      const pagoLiquido = Math.max(
        totalPago - totalEstornado,
        0
      );

      return {
        itemGuiaId: item.id,
        atendimentoId: atendimento.id,
        atendimentoCodigo:
          atendimento.codigoPublico ||
          "Código pendente",
        guiaId: item.guia.id,
        guiaCodigo:
          item.guia.codigoPublico ||
          "Código pendente",

        paciente: {
          id: atendimento.paciente.id,
          codigoPublico:
            atendimento.paciente.codigoPublico,
          nome: atendimento.paciente.nome,
          telefone: atendimento.paciente.telefone,
        },

        procedimento: {
          id: item.procedimento.id,
          nome: item.procedimento.nome,
        },

        clinica: {
          id: item.guia.clinica.id,
          nome: item.guia.clinica.nome,
        },

        unidade: item.guia.unidadeClinica
          ? {
              id: item.guia.unidadeClinica.id,
              nome: item.guia.unidadeClinica.nome,
              logradouro: item.guia.unidadeClinica.logradouro,
              numero: item.guia.unidadeClinica.numero,
              complemento: item.guia.unidadeClinica.complemento,
              bairro: item.guia.unidadeClinica.bairro,
              cidade: item.guia.unidadeClinica.cidade,
              uf: item.guia.unidadeClinica.uf,
            }
          : null,

        tipoAgendamento:
          item.tipoAgendamento,
        dataAgendamento:
          item.dataAgendamento,
        horarioAgendamento:
          item.horarioAgendamento,

        statusItem: item.status,
        statusGuia: item.guia.status,
        statusAtendimento:
          statusPorAtendimento.get(
            atendimento.id
          ) || "Em andamento",

        financeiro: {
          valorFinal,
          totalPago,
          totalEstornado,
          pagoLiquido,
          saldo: Math.max(
            valorFinal - pagoLiquido,
            0
          ),
        },
      };
    });

    const resumo = {
      total: registros.length,
      horarioMarcado: registros.filter(
        (registro) =>
          registro.tipoAgendamento ===
          "HORARIO"
      ).length,
      ordemChegada: registros.filter(
        (registro) =>
          registro.tipoAgendamento ===
          "ORDEM_CHEGADA"
      ).length,
      pagosAgendados: registros.filter(
        (registro) =>
          registro.statusAtendimento ===
          "Pago e agendado"
      ).length,
      pendencias: registros.filter(
        (registro) =>
          registro.statusAtendimento ===
            "Estorno pendente" ||
          registro.statusAtendimento ===
            "Aguardando pagamento"
      ).length,
    };

    return res.json({
      data: dataRecebida,
      resumo,
      registros,
    });
  } catch (erro) {
    console.error(
      "Erro ao carregar agenda:",
      erro
    );

    return res.status(500).json({
      erro: "Não foi possível carregar a agenda.",
    });
  }
});


// ======================================================
// CLÍNICAS
// ======================================================

function limparTextoOpcional(valor: unknown) {
  return typeof valor === "string" && valor.trim()
    ? valor.trim()
    : null;
}

function limparDocumento(valor: unknown) {
  return typeof valor === "string"
    ? valor.replace(/\D/g, "")
    : "";
}

function dadosClinicaRecebidos(body: any) {
  const financeiroMesmoLegal = Boolean(body.financeiroMesmoLegal);

  return {
    nome: String(body.nome || "").trim(),
    razaoSocial: limparTextoOpcional(body.razaoSocial),
    documento: limparDocumento(body.documento) || null,
    telefone: limparDocumento(body.telefone) || null,
    whatsapp: limparDocumento(body.whatsapp) || null,
    email: limparTextoOpcional(body.email)?.toLowerCase() || null,

    cepFiscal: limparDocumento(body.cepFiscal) || null,
    logradouroFiscal: limparTextoOpcional(body.logradouroFiscal),
    numeroFiscal: limparTextoOpcional(body.numeroFiscal),
    complementoFiscal: limparTextoOpcional(body.complementoFiscal),
    bairroFiscal: limparTextoOpcional(body.bairroFiscal),
    cidadeFiscal: limparTextoOpcional(body.cidadeFiscal),
    ufFiscal: limparTextoOpcional(body.ufFiscal)?.toUpperCase() || null,

    responsavelLegalNome:
      limparTextoOpcional(body.responsavelLegalNome)?.toUpperCase() || null,
    responsavelLegalCpf:
      limparDocumento(body.responsavelLegalCpf) || null,
    responsavelLegalCargo:
      limparTextoOpcional(body.responsavelLegalCargo),
    responsavelLegalTelefone:
      limparDocumento(body.responsavelLegalTelefone) || null,
    responsavelLegalEmail:
      limparTextoOpcional(body.responsavelLegalEmail)?.toLowerCase() || null,

    financeiroMesmoLegal,

    responsavelFinanceiroNome: financeiroMesmoLegal
      ? limparTextoOpcional(body.responsavelLegalNome)?.toUpperCase() || null
      : limparTextoOpcional(body.responsavelFinanceiroNome)?.toUpperCase() || null,

    responsavelFinanceiroCpf: financeiroMesmoLegal
      ? limparDocumento(body.responsavelLegalCpf) || null
      : limparDocumento(body.responsavelFinanceiroCpf) || null,

    responsavelFinanceiroCargo: financeiroMesmoLegal
      ? limparTextoOpcional(body.responsavelLegalCargo)
      : limparTextoOpcional(body.responsavelFinanceiroCargo),

    responsavelFinanceiroTelefone: financeiroMesmoLegal
      ? limparDocumento(body.responsavelLegalTelefone) || null
      : limparDocumento(body.responsavelFinanceiroTelefone) || null,

    responsavelFinanceiroEmail: financeiroMesmoLegal
      ? limparTextoOpcional(body.responsavelLegalEmail)?.toLowerCase() || null
      : limparTextoOpcional(body.responsavelFinanceiroEmail)?.toLowerCase() || null,

    tipoEstabelecimento:
      body.tipoEstabelecimento === "LABORATORIO_ANALISES_CLINICAS"
        ? ("LABORATORIO_ANALISES_CLINICAS" as const)
        : ("CLINICA" as const),

    tipoPrecificacao:
      body.tipoPrecificacao === "CH"
        ? ("CH" as const)
        : ("INDIVIDUAL" as const),

    valorChRepasse:
      body.valorChRepasse === null || body.valorChRepasse === undefined || body.valorChRepasse === ""
        ? null
        : numeroFinanceiro(body.valorChRepasse),

    valorChPaciente:
      body.valorChPaciente === null || body.valorChPaciente === undefined || body.valorChPaciente === ""
        ? null
        : numeroFinanceiro(body.valorChPaciente),

    observacoes: limparTextoOpcional(body.observacoes),
  };
}

function dadosUnidadeRecebidos(
  unidade: any,
  fiscal: {
    cepFiscal: string | null;
    logradouroFiscal: string | null;
    numeroFiscal: string | null;
    complementoFiscal: string | null;
    bairroFiscal: string | null;
    cidadeFiscal: string | null;
    ufFiscal: string | null;
  }
) {
  const usaEnderecoFiscal = Boolean(unidade.usaEnderecoFiscal);

  return {
    nome: String(unidade.nome || "").trim(),
    usaEnderecoFiscal,

    cep: usaEnderecoFiscal
      ? fiscal.cepFiscal
      : limparDocumento(unidade.cep) || null,
    logradouro: usaEnderecoFiscal
      ? fiscal.logradouroFiscal
      : limparTextoOpcional(unidade.logradouro),
    numero: usaEnderecoFiscal
      ? fiscal.numeroFiscal
      : limparTextoOpcional(unidade.numero),
    complemento: usaEnderecoFiscal
      ? fiscal.complementoFiscal
      : limparTextoOpcional(unidade.complemento),
    bairro: usaEnderecoFiscal
      ? fiscal.bairroFiscal
      : limparTextoOpcional(unidade.bairro),
    cidade: usaEnderecoFiscal
      ? fiscal.cidadeFiscal
      : limparTextoOpcional(unidade.cidade),
    uf: usaEnderecoFiscal
      ? fiscal.ufFiscal
      : limparTextoOpcional(unidade.uf)?.toUpperCase() || null,

    telefone: limparDocumento(unidade.telefone) || null,
    whatsapp: limparDocumento(unidade.whatsapp) || null,
    email: limparTextoOpcional(unidade.email)?.toLowerCase() || null,
  };
}

// Mantém esta rota enxuta porque ela já é usada pelo fluxo de atendimento.
app.get("/clinicas", async (_req, res) => {
  try {
    const clinicas = await prisma.clinica.findMany({
      where: {
        ativo: true,
      },
      include: {
        unidades: {
          where: {
            ativo: true,
          },
          orderBy: {
            nome: "asc",
          },
        },
        precos: {
          where: {
            ativo: true,
          },
          include: {
            procedimento: true,
          },
        },
      },
      orderBy: {
        nome: "asc",
      },
    });

    return res.json(clinicas);
  } catch (erro) {
    console.error("Erro ao carregar clínicas:", erro);

    return res.status(500).json({
      erro: "Não foi possível carregar as clínicas.",
    });
  }
});

// Lista administrativa, incluindo clínicas inativas.
app.get("/clinicas/resumo", async (_req, res) => {
  try {
    const clinicas = await prisma.clinica.findMany({
      include: {
        unidades: {
          orderBy: {
            nome: "asc",
          },
        },
        precos: {
          where: {
            ativo: true,
          },
          select: {
            id: true,
          },
        },
        _count: {
          select: {
            guias: true,
            repasses: true,
          },
        },
      },
      orderBy: {
        nome: "asc",
      },
    });

    const resultado = clinicas.map((clinica) => {
      const unidadesAtivas = clinica.unidades.filter(
        (unidade) => unidade.ativo
      );

      return {
        id: clinica.id,
        nome: clinica.nome,
        razaoSocial: clinica.razaoSocial,
        documento: clinica.documento,
        telefone: clinica.telefone,
        whatsapp: clinica.whatsapp,
        email: clinica.email,
        cidadeFiscal: clinica.cidadeFiscal,
        ufFiscal: clinica.ufFiscal,
        ativo: clinica.ativo,
        totalUnidades: clinica.unidades.length,
        unidadesAtivas: unidadesAtivas.length,
        totalProcedimentos: clinica.precos.length,
        totalGuias: clinica._count.guias,
        totalRepasses: clinica._count.repasses,
        criadoEm: clinica.criadoEm,
        atualizadoEm: clinica.atualizadoEm,
      };
    });

    return res.json(resultado);
  } catch (erro) {
    console.error("Erro ao carregar resumo de clínicas:", erro);

    return res.status(500).json({
      erro: "Não foi possível carregar as clínicas.",
    });
  }
});

app.get("/clinicas/:id", async (req, res) => {
  try {
    const clinicaId = Number(req.params.id);

    if (!Number.isInteger(clinicaId) || clinicaId <= 0) {
      return res.status(400).json({
        erro: "Clínica inválida.",
      });
    }

    const { inicioMes, fimMes } = limitesDataSaoPaulo();

    const [clinica, guiasMes, repassesPendentes] = await Promise.all([
      prisma.clinica.findUnique({
        where: {
          id: clinicaId,
        },
        include: {
          unidades: {
            orderBy: [
              {
                ativo: "desc",
              },
              {
                nome: "asc",
              },
            ],
          },
          precos: {
            include: {
              procedimento: true,
            },
            orderBy: {
              procedimento: {
                nome: "asc",
              },
            },
          },
          _count: {
            select: {
              guias: true,
              repasses: true,
            },
          },
        },
      }),

      prisma.guia.count({
        where: {
          clinicaId,
          criadoEm: {
            gte: inicioMes,
            lte: fimMes,
          },
          status: {
            not: "CANCELADA",
          },
        },
      }),

      prisma.repasse.findMany({
        where: {
          clinicaId,
          status: {
            in: [
              "DISPONIVEL",
              "SOLICITADO",
              "EM_ANALISE",
              "APROVADO",
            ],
          },
        },
        select: {
          valorTotal: true,
        },
      }),
    ]);

    if (!clinica) {
      return res.status(404).json({
        erro: "Clínica não encontrada.",
      });
    }

    const valorRepassePendente = repassesPendentes.reduce(
      (total, repasse) => total + Number(repasse.valorTotal),
      0
    );

    return res.json({
      ...clinica,
      resumoClinica: {
        guiasMes,
        valorRepassePendente,
      },
    });
  } catch (erro) {
    console.error("Erro ao carregar ficha da clínica:", erro);

    return res.status(500).json({
      erro: "Não foi possível carregar a ficha da clínica.",
    });
  }
});

app.post("/clinicas", async (req, res) => {
  try {
    const dados = dadosClinicaRecebidos(req.body);

    if (!dados.nome) {
      return res.status(400).json({
        erro: "Nome fantasia é obrigatório.",
      });
    }

    if (!dados.documento) {
      return res.status(400).json({
        erro: "CNPJ/CPF é obrigatório.",
      });
    }

    const documentoExistente = await prisma.clinica.findUnique({
      where: {
        documento: dados.documento,
      },
      select: {
        id: true,
        nome: true,
      },
    });

    if (documentoExistente) {
      return res.status(409).json({
        erro: "Já existe uma clínica cadastrada com este CNPJ/CPF.",
        clinica: documentoExistente,
      });
    }

    const unidadesRecebidas = Array.isArray(req.body.unidades)
      ? req.body.unidades
      : [];

    if (unidadesRecebidas.length === 0) {
      return res.status(400).json({
        erro: "Cadastre pelo menos uma unidade de atendimento.",
      });
    }

    for (const unidade of unidadesRecebidas) {
      if (!String(unidade?.nome || "").trim()) {
        return res.status(400).json({
          erro: "Todas as unidades precisam ter um nome.",
        });
      }
    }

    const clinica = await prisma.$transaction(async (tx) => {
      const novaClinica = await tx.clinica.create({
        data: {
          ...dados,
          ativo: true,
        },
      });

      for (const unidadeRecebida of unidadesRecebidas) {
        const unidade = dadosUnidadeRecebidos(
          unidadeRecebida,
          dados
        );

        await tx.unidadeClinica.create({
          data: {
            clinicaId: novaClinica.id,
            ...unidade,
            ativo: true,
          },
        });
      }

      return tx.clinica.findUnique({
        where: {
          id: novaClinica.id,
        },
        include: {
          unidades: {
            orderBy: {
              nome: "asc",
            },
          },
        },
      });
    });

    return res.status(201).json(clinica);
  } catch (erro) {
    console.error("Erro ao cadastrar clínica:", erro);

    return res.status(500).json({
      erro: "Não foi possível cadastrar a clínica.",
    });
  }
});

app.patch("/clinicas/:id", async (req, res) => {
  try {
    const clinicaId = Number(req.params.id);

    if (!Number.isInteger(clinicaId) || clinicaId <= 0) {
      return res.status(400).json({
        erro: "Clínica inválida.",
      });
    }

    const atual = await prisma.clinica.findUnique({
      where: {
        id: clinicaId,
      },
    });

    if (!atual) {
      return res.status(404).json({
        erro: "Clínica não encontrada.",
      });
    }

    const dados = dadosClinicaRecebidos(req.body);

    if (!dados.nome) {
      return res.status(400).json({
        erro: "Nome fantasia é obrigatório.",
      });
    }

    if (!dados.documento) {
      return res.status(400).json({
        erro: "CNPJ/CPF é obrigatório.",
      });
    }

    const documentoExistente = await prisma.clinica.findFirst({
      where: {
        documento: dados.documento,
        id: {
          not: clinicaId,
        },
      },
      select: {
        id: true,
        nome: true,
      },
    });

    if (documentoExistente) {
      return res.status(409).json({
        erro: "Já existe outra clínica cadastrada com este CNPJ/CPF.",
        clinica: documentoExistente,
      });
    }

    const clinica = await prisma.clinica.update({
      where: {
        id: clinicaId,
      },
      data: {
        ...dados,
        // Enquanto as telas antigas ainda não enviam estes campos, preservamos
        // a configuração já existente da clínica.
        tipoEstabelecimento:
          req.body.tipoEstabelecimento !== undefined
            ? dados.tipoEstabelecimento
            : atual.tipoEstabelecimento,
        tipoPrecificacao:
          req.body.tipoPrecificacao !== undefined
            ? dados.tipoPrecificacao
            : atual.tipoPrecificacao,
        valorChRepasse:
          req.body.valorChRepasse !== undefined
            ? dados.valorChRepasse
            : atual.valorChRepasse,
        valorChPaciente:
          req.body.valorChPaciente !== undefined
            ? dados.valorChPaciente
            : atual.valorChPaciente,
        ativo:
          typeof req.body.ativo === "boolean"
            ? req.body.ativo
            : atual.ativo,
      },
      include: {
        unidades: {
          orderBy: [
            {
              ativo: "desc",
            },
            {
              nome: "asc",
            },
          ],
        },
      },
    });

    return res.json(clinica);
  } catch (erro) {
    console.error("Erro ao atualizar clínica:", erro);

    return res.status(500).json({
      erro: "Não foi possível atualizar a clínica.",
    });
  }
});

app.post("/clinicas/:id/unidades", async (req, res) => {
  try {
    const clinicaId = Number(req.params.id);

    if (!Number.isInteger(clinicaId) || clinicaId <= 0) {
      return res.status(400).json({
        erro: "Clínica inválida.",
      });
    }

    const clinica = await prisma.clinica.findUnique({
      where: {
        id: clinicaId,
      },
    });

    if (!clinica) {
      return res.status(404).json({
        erro: "Clínica não encontrada.",
      });
    }

    if (!String(req.body.nome || "").trim()) {
      return res.status(400).json({
        erro: "Nome da unidade é obrigatório.",
      });
    }

    const unidade = dadosUnidadeRecebidos(req.body, {
      cepFiscal: clinica.cepFiscal,
      logradouroFiscal: clinica.logradouroFiscal,
      numeroFiscal: clinica.numeroFiscal,
      complementoFiscal: clinica.complementoFiscal,
      bairroFiscal: clinica.bairroFiscal,
      cidadeFiscal: clinica.cidadeFiscal,
      ufFiscal: clinica.ufFiscal,
    });

    const criada = await prisma.unidadeClinica.create({
      data: {
        clinicaId,
        ...unidade,
        ativo: true,
      },
    });

    return res.status(201).json(criada);
  } catch (erro) {
    console.error("Erro ao cadastrar unidade:", erro);

    return res.status(500).json({
      erro: "Não foi possível cadastrar a unidade.",
    });
  }
});

app.patch("/clinicas/:id/unidades/:unidadeId", async (req, res) => {
  try {
    const clinicaId = Number(req.params.id);
    const unidadeId = Number(req.params.unidadeId);

    if (
      !Number.isInteger(clinicaId) ||
      clinicaId <= 0 ||
      !Number.isInteger(unidadeId) ||
      unidadeId <= 0
    ) {
      return res.status(400).json({
        erro: "Clínica ou unidade inválida.",
      });
    }

    const [clinica, unidadeAtual] = await Promise.all([
      prisma.clinica.findUnique({
        where: {
          id: clinicaId,
        },
      }),
      prisma.unidadeClinica.findFirst({
        where: {
          id: unidadeId,
          clinicaId,
        },
      }),
    ]);

    if (!clinica) {
      return res.status(404).json({
        erro: "Clínica não encontrada.",
      });
    }

    if (!unidadeAtual) {
      return res.status(404).json({
        erro: "Unidade não encontrada.",
      });
    }

    if (!String(req.body.nome || "").trim()) {
      return res.status(400).json({
        erro: "Nome da unidade é obrigatório.",
      });
    }

    const unidade = dadosUnidadeRecebidos(req.body, {
      cepFiscal: clinica.cepFiscal,
      logradouroFiscal: clinica.logradouroFiscal,
      numeroFiscal: clinica.numeroFiscal,
      complementoFiscal: clinica.complementoFiscal,
      bairroFiscal: clinica.bairroFiscal,
      cidadeFiscal: clinica.cidadeFiscal,
      ufFiscal: clinica.ufFiscal,
    });

    const atualizada = await prisma.unidadeClinica.update({
      where: {
        id: unidadeId,
      },
      data: {
        ...unidade,
        ativo:
          typeof req.body.ativo === "boolean"
            ? req.body.ativo
            : unidadeAtual.ativo,
      },
    });

    return res.json(atualizada);
  } catch (erro) {
    console.error("Erro ao atualizar unidade:", erro);

    return res.status(500).json({
      erro: "Não foi possível atualizar a unidade.",
    });
  }
});

app.patch(
  "/clinicas/:id/unidades/:unidadeId/status",
  async (req, res) => {
    try {
      const clinicaId = Number(req.params.id);
      const unidadeId = Number(req.params.unidadeId);

      if (
        !Number.isInteger(clinicaId) ||
        clinicaId <= 0 ||
        !Number.isInteger(unidadeId) ||
        unidadeId <= 0
      ) {
        return res.status(400).json({
          erro: "Clínica ou unidade inválida.",
        });
      }

      if (typeof req.body.ativo !== "boolean") {
        return res.status(400).json({
          erro: "Informe o status da unidade.",
        });
      }

      const unidade = await prisma.unidadeClinica.findFirst({
        where: {
          id: unidadeId,
          clinicaId,
        },
      });

      if (!unidade) {
        return res.status(404).json({
          erro: "Unidade não encontrada.",
        });
      }

      const atualizada = await prisma.unidadeClinica.update({
        where: {
          id: unidadeId,
        },
        data: {
          ativo: req.body.ativo,
        },
      });

      return res.json(atualizada);
    } catch (erro) {
      console.error("Erro ao alterar status da unidade:", erro);

      return res.status(500).json({
        erro: "Não foi possível alterar o status da unidade.",
      });
    }
  }
);

// ======================================================
// PROCEDIMENTOS E PREÇOS
// ======================================================

function numeroFinanceiro(valor: unknown) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : NaN;
  if (typeof valor !== "string") return NaN;
  const limpo = valor.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  if (!limpo) return NaN;
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  return Number(normalizado);
}

function arredondarDinheiro(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function normalizarCabecalhoPlanilha(valor: unknown) {
  return String(valor || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function encontrarColunaPlanilha(
  cabecalhos: string[],
  possibilidades: string[]
) {
  const possibilidadesNormalizadas = possibilidades.map(
    normalizarCabecalhoPlanilha
  );

  return cabecalhos.findIndex((cabecalho) =>
    possibilidadesNormalizadas.includes(
      normalizarCabecalhoPlanilha(cabecalho)
    )
  );
}

function textoCelulaPlanilha(valor: unknown) {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
}

function numeroCelulaPlanilha(valor: unknown) {
  if (
    valor === null ||
    valor === undefined ||
    String(valor).trim() === ""
  ) {
    return null;
  }

  const numero = numeroFinanceiro(valor);

  return Number.isFinite(numero) ? numero : null;
}

function calcularMargens(valorPaciente: number, valorRepasse: number) {
  const margemReais = arredondarDinheiro(valorPaciente - valorRepasse);
  const margemPercentual = valorPaciente !== 0
    ? Math.round(((margemReais / valorPaciente) * 100 + Number.EPSILON) * 100) / 100
    : 0;
  return { margemReais, margemPercentual };
}

function calcularPrecoPorCampo(body: any) {
  const campoAlterado = String(body.campoAlterado || "");
  let valorPaciente = numeroFinanceiro(body.valorPaciente);
  let valorRepasse = numeroFinanceiro(body.valorRepasse);

  if (!Number.isFinite(valorRepasse) || valorRepasse < 0) {
    throw new Error("REPASSE_INVALIDO");
  }

  if (campoAlterado === "margemReais") {
    const margemReais = numeroFinanceiro(body.margemReais);
    if (!Number.isFinite(margemReais)) throw new Error("MARGEM_INVALIDA");
    valorPaciente = arredondarDinheiro(valorRepasse + margemReais);
  } else if (campoAlterado === "margemPercentual") {
    const margemPercentual = numeroFinanceiro(body.margemPercentual);
    if (!Number.isFinite(margemPercentual) || margemPercentual >= 100) {
      throw new Error("MARGEM_PERCENTUAL_INVALIDA");
    }
    valorPaciente = arredondarDinheiro(valorRepasse / (1 - margemPercentual / 100));
  }

  if (!Number.isFinite(valorPaciente) || valorPaciente < 0) {
    throw new Error("VALOR_PACIENTE_INVALIDO");
  }

  valorPaciente = arredondarDinheiro(valorPaciente);
  valorRepasse = arredondarDinheiro(valorRepasse);
  return { valorPaciente, valorRepasse, ...calcularMargens(valorPaciente, valorRepasse) };
}


function textoProcedimentoMaiusculo(valor: unknown) {
  return String(valor || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
}

function normalizarTextoProcedimento(valor: unknown) {
  return textoProcedimentoMaiusculo(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\bULTRASSONOGRAFIA\b/g, " USG ")
    .replace(/\bULTRASSOM\b/g, " USG ")
    .replace(/\bUS\b/g, " USG ")
    .replace(/\bVIAS URINARIAS\b/g, " VIAS ")
    .replace(/\s+/g, " ")
    .trim();
}

function termosProcedimento(valor: unknown) {
  return new Set(
    normalizarTextoProcedimento(valor)
      .split(" ")
      .filter((termo) => termo.length > 1)
  );
}

function similaridadeProcedimento(a: unknown, b: unknown) {
  const na = normalizarTextoProcedimento(a);
  const nb = normalizarTextoProcedimento(b);

  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ta = termosProcedimento(a);
  const tb = termosProcedimento(b);

  // Evita falsos positivos com termos genéricos/curtos como
  // CARDIO x ELETROCARDIOGRAMA ou ECO x ECOCARDIOGRAMA.
  if (ta.size === 1 || tb.size === 1) {
    return 0;
  }

  const intersecao = [...ta].filter((termo) => tb.has(termo)).length;
  const uniao = new Set([...ta, ...tb]).size;

  if (!uniao) return 0;

  const jaccard = intersecao / uniao;
  const coberturaMenor = intersecao / Math.min(ta.size, tb.size);

  // Dá peso maior quando os dois nomes compartilham vários termos relevantes,
  // sem considerar mera substring dentro de uma palavra.
  return Math.max(jaccard, coberturaMenor * 0.9);
}



app.get("/referencias-procedimentos", async (req, res) => {
  try {
    const busca = String(req.query.busca || "").trim();
    const limiteRecebido = Number(req.query.limite || 50);
    const limite = Number.isFinite(limiteRecebido)
      ? Math.min(Math.max(Math.trunc(limiteRecebido), 1), 200)
      : 50;

    const referencias = await prisma.procedimentoReferencia.findMany({
      where: {
        ativo: true,
        ...(busca
          ? {
              OR: [
                { codigoTuss: { contains: busca } },
                { nomeTuss: { contains: busca, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ nomeTuss: "asc" }],
      take: limite,
    });

    return res.json(
      referencias.map((referencia) => ({
        ...referencia,
        quantidadeCh:
          referencia.quantidadeCh === null
            ? null
            : Number(referencia.quantidadeCh),
      }))
    );
  } catch (erro) {
    console.error("Erro ao pesquisar base de referência:", erro);
    return res.status(500).json({
      erro: "Não foi possível pesquisar a base de referência.",
    });
  }
});

app.post("/referencias-procedimentos/importar", async (req, res) => {
  try {
    const registros: unknown[] = Array.isArray(req.body.registros)
      ? req.body.registros
      : [];

    if (registros.length === 0) {
      return res.status(400).json({
        erro: "Envie ao menos um registro para importação.",
      });
    }

    if (registros.length > 10000) {
      return res.status(400).json({
        erro: "O lote pode ter no máximo 10.000 registros.",
      });
    }

    let processados = 0;
    let ignorados = 0;

    for (const item of registros) {
      if (!item || typeof item !== "object") {
        ignorados += 1;
        continue;
      }

      const registro = item as Record<string, unknown>;
      const codigoTuss =
        String(registro.codigoTuss || "").replace(/\D/g, "") || "";
      const nomeTuss = textoProcedimentoMaiusculo(registro.nomeTuss);

      if (!codigoTuss || !nomeTuss) {
        ignorados += 1;
        continue;
      }

      const chRecebido =
        registro.quantidadeCh === null ||
        registro.quantidadeCh === undefined ||
        registro.quantidadeCh === ""
          ? null
          : numeroFinanceiro(registro.quantidadeCh);

      const quantidadeCh =
        chRecebido !== null &&
        Number.isFinite(chRecebido) &&
        chRecebido >= 0
          ? chRecebido
          : null;

      await prisma.procedimentoReferencia.upsert({
        where: { codigoTuss },
        create: {
          codigoTuss,
          nomeTuss,
          quantidadeCh,
          fonteCh: String(registro.fonteCh || "").trim() || null,
          versaoReferencia:
            String(registro.versaoReferencia || "").trim() || null,
          ativo: registro.ativo === false ? false : true,
        },
        update: {
          nomeTuss,
          quantidadeCh,
          fonteCh: String(registro.fonteCh || "").trim() || null,
          versaoReferencia:
            String(registro.versaoReferencia || "").trim() || null,
          ativo: registro.ativo === false ? false : true,
        },
      });

      processados += 1;
    }

    return res.json({ processados, ignorados });
  } catch (erro) {
    console.error("Erro ao importar base de referência:", erro);
    return res.status(500).json({
      erro: "Não foi possível importar a base de referência.",
    });
  }
});

app.put("/procedimentos/:id/referencia", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const referenciaId =
      req.body.referenciaId === null || req.body.referenciaId === ""
        ? null
        : Number(req.body.referenciaId);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "Procedimento inválido." });
    }

    if (
      referenciaId !== null &&
      (!Number.isInteger(referenciaId) || referenciaId <= 0)
    ) {
      return res.status(400).json({ erro: "Referência inválida." });
    }

    const procedimento = await prisma.procedimento.findUnique({
      where: { id },
      select: { id: true, nome: true },
    });

    if (!procedimento) {
      return res.status(404).json({ erro: "Procedimento não encontrado." });
    }

    if (referenciaId !== null) {
      const referencia = await prisma.procedimentoReferencia.findUnique({
        where: { id: referenciaId },
      });

      if (!referencia || !referencia.ativo) {
        return res.status(404).json({
          erro: "Referência TUSS não encontrada ou inativa.",
        });
      }

      const jaVinculado = await prisma.procedimento.findFirst({
        where: {
          referenciaId,
          id: { not: id },
          ativo: true,
        },
        select: { id: true, nome: true },
      });

      if (jaVinculado) {
        return res.status(409).json({
          erro: `A referência TUSS já está vinculada ao procedimento "${jaVinculado.nome}".`,
          tipo: "TUSS_JA_VINCULADA",
          procedimento: jaVinculado,
        });
      }
    }

    const atualizado = await prisma.procedimento.update({
      where: { id },
      data: { referenciaId },
      include: { referencia: true },
    });

    return res.json({
      ...atualizado,
      referencia: atualizado.referencia
        ? {
            ...atualizado.referencia,
            quantidadeCh:
              atualizado.referencia.quantidadeCh === null
                ? null
                : Number(atualizado.referencia.quantidadeCh),
          }
        : null,
    });
  } catch (erro) {
    console.error("Erro ao vincular referência TUSS:", erro);
    return res.status(500).json({
      erro: "Não foi possível vincular a referência TUSS.",
    });
  }
});

app.get("/procedimentos/catalogo", async (_req, res) => {
  try {
    const procedimentos = await prisma.procedimento.findMany({
      include: {
        referencia: true,
        precos: {
          include: {
            clinica: {
              select: {
                id: true,
                nome: true,
                ativo: true,
                tipoEstabelecimento: true,
                tipoPrecificacao: true,
                valorChRepasse: true,
                valorChPaciente: true,
                unidades: {
                  where: { ativo: true },
                  orderBy: { nome: "asc" },
                  select: {
                    id: true,
                    nome: true,
                    cidade: true,
                    uf: true,
                  },
                },
              },
            },
          },
        },
        precosUnidade: {
          include: {
            unidadeClinica: {
              select: {
                id: true,
                nome: true,
                clinicaId: true,
                cidade: true,
                uf: true,
                ativo: true,
                clinica: {
                  select: {
                    id: true,
                    nome: true,
                    ativo: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { nome: "asc" },
    });

    return res.json(
      procedimentos.map((procedimento) => ({
        ...procedimento,
        codigoTuss: procedimento.referencia?.codigoTuss ?? procedimento.codigoTuss,
        nomeTuss: procedimento.referencia?.nomeTuss ?? procedimento.nomeTuss,
        quantidadeCh:
          procedimento.referencia?.quantidadeCh !== null &&
          procedimento.referencia?.quantidadeCh !== undefined
            ? Number(procedimento.referencia.quantidadeCh)
            : procedimento.quantidadeCh === null
              ? null
              : Number(procedimento.quantidadeCh),
        referencia: procedimento.referencia
          ? {
              ...procedimento.referencia,
              quantidadeCh:
                procedimento.referencia.quantidadeCh === null
                  ? null
                  : Number(procedimento.referencia.quantidadeCh),
            }
          : null,
        precos: procedimento.precos.map((preco) => ({
          ...preco,
          valorPaciente: Number(preco.valorPaciente),
          valorRepasse: Number(preco.valorRepasse),
          margemReais:
            Number(preco.valorPaciente) - Number(preco.valorRepasse),
          margemPercentual:
            Number(preco.valorPaciente) > 0
              ? ((Number(preco.valorPaciente) -
                  Number(preco.valorRepasse)) /
                  Number(preco.valorPaciente)) *
                100
              : 0,
          clinica: {
            ...preco.clinica,
            valorChRepasse:
              preco.clinica.valorChRepasse === null
                ? null
                : Number(preco.clinica.valorChRepasse),
            valorChPaciente:
              preco.clinica.valorChPaciente === null
                ? null
                : Number(preco.clinica.valorChPaciente),
          },
        })),
        precosUnidade: procedimento.precosUnidade.map((preco) => ({
          ...preco,
          valorPaciente: Number(preco.valorPaciente),
          valorRepasse: Number(preco.valorRepasse),
          margemReais:
            Number(preco.valorPaciente) - Number(preco.valorRepasse),
          margemPercentual:
            Number(preco.valorPaciente) > 0
              ? ((Number(preco.valorPaciente) -
                  Number(preco.valorRepasse)) /
                  Number(preco.valorPaciente)) *
                100
              : 0,
        })),
      }))
    );
  } catch (erro) {
    console.error("Erro ao carregar catálogo de procedimentos:", erro);
    return res.status(500).json({
      erro: "Não foi possível carregar o catálogo de procedimentos.",
    });
  }
});

app.get("/procedimentos", async (_req, res) => {
  try {
    const procedimentos = await prisma.procedimento.findMany({
      where: { ativo: true },
      include: {
        referencia: true,
        precos: { where: { ativo: true }, include: { clinica: true } },
      },
      orderBy: { nome: "asc" },
    });
    res.json(procedimentos);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Não foi possível carregar os procedimentos." });
  }
});

app.post("/procedimentos/da-referencia", async (req, res) => {
  try {
    const referenciaId = Number(req.body.referenciaId);
    if (!Number.isInteger(referenciaId) || referenciaId <= 0) {
      return res.status(400).json({ erro: "Referência TUSS inválida." });
    }
    const referencia = await prisma.procedimentoReferencia.findUnique({ where: { id: referenciaId } });
    if (!referencia || !referencia.ativo) {
      return res.status(404).json({ erro: "Referência TUSS não encontrada ou inativa." });
    }
    const existente = await prisma.procedimento.findFirst({
      where: { referenciaId, ativo: true },
      select: { id: true, nome: true },
    });
    if (existente) {
      return res.status(409).json({ erro: `Esta referência TUSS já está vinculada a "${existente.nome}".` });
    }
    const nome = textoProcedimentoMaiusculo(req.body.nome) || referencia.nomeTuss;
    const criado = await prisma.procedimento.create({
      data: {
        nome,
        categoria: textoProcedimentoMaiusculo(req.body.categoria) || null,
        aliases: Array.from(
          new Set<string>(
            (Array.isArray(req.body.aliases) ? req.body.aliases : [])
              .map((alias: unknown) => textoProcedimentoMaiusculo(alias))
              .filter((alias: string) => Boolean(alias) && alias !== nome)
          )
        ),
        preparo: String(req.body.preparo || "").trim() || null,
        referenciaId,
        ativo: true,
      },
      include: { referencia: true },
    });
    return res.status(201).json(criado);
  } catch (erro) {
    console.error("Erro ao adicionar procedimento da Base Mestre:", erro);
    return res.status(500).json({ erro: "Não foi possível adicionar o procedimento." });
  }
});

app.post("/procedimentos", async (req, res) => {
  try {
    const nome = textoProcedimentoMaiusculo(req.body.nome);
    const categoria = textoProcedimentoMaiusculo(req.body.categoria) || null;
    const preparo = String(req.body.preparo || "").trim() || null;
    const codigoTuss = String(req.body.codigoTuss || "").replace(/\D/g, "") || null;
    const nomeTuss = textoProcedimentoMaiusculo(req.body.nomeTuss) || null;
    const quantidadeChRecebida =
      req.body.quantidadeCh === null || req.body.quantidadeCh === undefined || req.body.quantidadeCh === ""
        ? null
        : numeroFinanceiro(req.body.quantidadeCh);
    const quantidadeCh =
      quantidadeChRecebida !== null && Number.isFinite(quantidadeChRecebida) && quantidadeChRecebida >= 0
        ? quantidadeChRecebida
        : null;

    const aliasesRecebidos: unknown[] = Array.isArray(req.body.aliases)
      ? req.body.aliases
      : [];

    const aliases: string[] = Array.from(
      new Set<string>(
        aliasesRecebidos
          .map((alias: unknown) => textoProcedimentoMaiusculo(alias))
          .filter((alias: string) => Boolean(alias) && alias !== nome)
      )
    );

    if (!nome) {
      return res.status(400).json({ erro: "Informe o nome do procedimento." });
    }

    const procedimentosExistentes = await prisma.procedimento.findMany({
      select: {
        id: true,
        nome: true,
        aliases: true,
        ativo: true,
      },
    });

    const candidatos = procedimentosExistentes
      .map((procedimento) => {
        const nomes = [procedimento.nome, ...procedimento.aliases];

        const comparacoes: number[] = [
          ...nomes.map((nomeExistente) =>
            similaridadeProcedimento(nome, nomeExistente)
          ),
        ];

        for (const aliasNovo of aliases) {
          const aliasNormalizado = normalizarTextoProcedimento(aliasNovo);

          for (const nomeExistente of nomes) {
            const existenteNormalizado = normalizarTextoProcedimento(nomeExistente);

            // Alias idêntico é forte indício de duplicidade.
            if (
              aliasNormalizado &&
              aliasNormalizado === existenteNormalizado
            ) {
              comparacoes.push(1);
              continue;
            }

            // Para aliases diferentes, só usamos a comparação por termos.
            // Termos isolados/genéricos não geram alerta.
            comparacoes.push(
              similaridadeProcedimento(aliasNovo, nomeExistente)
            );
          }
        }

        const maiorSimilaridade =
          comparacoes.length > 0 ? Math.max(...comparacoes) : 0;

        return {
          id: procedimento.id,
          nome: procedimento.nome,
          aliases: procedimento.aliases,
          ativo: procedimento.ativo,
          similaridade: maiorSimilaridade,
        };
      })
      .filter((procedimento) => procedimento.similaridade >= 0.72)
      .sort((a, b) => b.similaridade - a.similaridade);

    const duplicadoConfirmado = candidatos.find(
      (procedimento) => procedimento.similaridade >= 0.98
    );

    if (duplicadoConfirmado) {
      return res.status(409).json({
        erro: "Este procedimento já parece estar cadastrado.",
        tipo: "DUPLICIDADE",
        candidato: duplicadoConfirmado,
      });
    }

    if (candidatos.length > 0 && req.body.confirmarMesmoAssim !== true) {
      return res.status(409).json({
        erro: "Encontramos um procedimento possivelmente equivalente.",
        tipo: "POSSIVEL_DUPLICIDADE",
        candidatos: candidatos.slice(0, 5),
      });
    }

    if (codigoTuss) {
      const tussExistente = await prisma.procedimento.findUnique({
        where: { codigoTuss },
        select: { id: true, nome: true, codigoTuss: true, ativo: true },
      });
      if (tussExistente) {
        return res.status(409).json({
          erro: "Este código TUSS já está vinculado a outro procedimento.",
          tipo: "TUSS_DUPLICADA",
          candidato: tussExistente,
        });
      }
    }

    const procedimento = await prisma.procedimento.create({
      data: {
        nome,
        categoria,
        preparo,
        aliases,
        codigoTuss,
        nomeTuss,
        quantidadeCh,
        ativo: true,
      },
    });

    return res.status(201).json(procedimento);
  } catch (erro) {
    console.error("Erro ao criar procedimento:", erro);
    return res.status(500).json({ erro: "Não foi possível criar o procedimento." });
  }
});

app.patch("/procedimentos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "Procedimento inválido." });
    }

    const atual = await prisma.procedimento.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        categoria: true,
        preparo: true,
        aliases: true,
        codigoTuss: true,
        nomeTuss: true,
        quantidadeCh: true,
        ativo: true,
      },
    });

    if (!atual) {
      return res.status(404).json({ erro: "Procedimento não encontrado." });
    }

    const nome =
      req.body.nome !== undefined
        ? textoProcedimentoMaiusculo(req.body.nome)
        : atual.nome;

    const categoria =
      req.body.categoria !== undefined
        ? textoProcedimentoMaiusculo(req.body.categoria) || null
        : atual.categoria;

    const preparo =
      req.body.preparo !== undefined
        ? String(req.body.preparo || "").trim() || null
        : atual.preparo;

    const codigoTuss =
      req.body.codigoTuss !== undefined
        ? String(req.body.codigoTuss || "").replace(/\D/g, "") || null
        : atual.codigoTuss;

    const nomeTuss =
      req.body.nomeTuss !== undefined
        ? textoProcedimentoMaiusculo(req.body.nomeTuss) || null
        : atual.nomeTuss;

    const quantidadeCh =
      req.body.quantidadeCh !== undefined
        ? req.body.quantidadeCh === null || req.body.quantidadeCh === ""
          ? null
          : numeroFinanceiro(req.body.quantidadeCh)
        : atual.quantidadeCh === null
          ? null
          : Number(atual.quantidadeCh);

    if (quantidadeCh !== null && (!Number.isFinite(quantidadeCh) || quantidadeCh < 0)) {
      return res.status(400).json({ erro: "Quantidade de CH inválida." });
    }

    const aliasesRecebidos: unknown[] = Array.isArray(req.body.aliases)
      ? req.body.aliases
      : atual.aliases;

    const aliases: string[] = Array.from(
      new Set<string>(
        aliasesRecebidos
          .map((alias: unknown) => textoProcedimentoMaiusculo(alias))
          .filter((alias: string) => Boolean(alias) && alias !== nome)
      )
    );

    if (!nome) {
      return res.status(400).json({ erro: "Informe o nome do procedimento." });
    }

    const outros = await prisma.procedimento.findMany({
      where: { id: { not: id } },
      select: {
        id: true,
        nome: true,
        aliases: true,
        ativo: true,
      },
    });

    const candidatos = outros
      .map((procedimento) => {
        const nomes = [procedimento.nome, ...procedimento.aliases];
        const comparacoes: number[] = [
          ...nomes.map((nomeExistente) =>
            similaridadeProcedimento(nome, nomeExistente)
          ),
        ];

        for (const aliasNovo of aliases) {
          const aliasNormalizado = normalizarTextoProcedimento(aliasNovo);

          for (const nomeExistente of nomes) {
            const existenteNormalizado =
              normalizarTextoProcedimento(nomeExistente);

            if (
              aliasNormalizado &&
              aliasNormalizado === existenteNormalizado
            ) {
              comparacoes.push(1);
              continue;
            }

            comparacoes.push(
              similaridadeProcedimento(aliasNovo, nomeExistente)
            );
          }
        }

        const maiorSimilaridade =
          comparacoes.length > 0 ? Math.max(...comparacoes) : 0;

        return {
          id: procedimento.id,
          nome: procedimento.nome,
          aliases: procedimento.aliases,
          ativo: procedimento.ativo,
          similaridade: maiorSimilaridade,
        };
      })
      .filter((procedimento) => procedimento.similaridade >= 0.72)
      .sort((a, b) => b.similaridade - a.similaridade);

    const duplicadoConfirmado = candidatos.find(
      (procedimento) => procedimento.similaridade >= 0.98
    );

    if (duplicadoConfirmado) {
      return res.status(409).json({
        erro: "Já existe outro procedimento equivalente.",
        tipo: "DUPLICIDADE",
        candidato: duplicadoConfirmado,
      });
    }

    if (candidatos.length > 0 && req.body.confirmarMesmoAssim !== true) {
      return res.status(409).json({
        erro: "Encontramos outro procedimento possivelmente equivalente.",
        tipo: "POSSIVEL_DUPLICIDADE",
        candidatos: candidatos.slice(0, 5),
      });
    }

    if (codigoTuss) {
      const tussExistente = await prisma.procedimento.findFirst({
        where: { codigoTuss, id: { not: id } },
        select: { id: true, nome: true, codigoTuss: true, ativo: true },
      });
      if (tussExistente) {
        return res.status(409).json({
          erro: "Este código TUSS já está vinculado a outro procedimento.",
          tipo: "TUSS_DUPLICADA",
          candidato: tussExistente,
        });
      }
    }

    const procedimento = await prisma.procedimento.update({
      where: { id },
      data: {
        nome,
        categoria,
        preparo,
        aliases,
        codigoTuss,
        nomeTuss,
        quantidadeCh,
      },
    });

    return res.json(procedimento);
  } catch (erro) {
    console.error("Erro ao editar procedimento:", erro);
    return res.status(500).json({ erro: "Não foi possível editar o procedimento." });
  }
});

app.delete("/procedimentos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "Procedimento inválido." });
    }

    const procedimento = await prisma.procedimento.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        ativo: true,
      },
    });

    if (!procedimento) {
      return res.status(404).json({ erro: "Procedimento não encontrado." });
    }

    // Exclusão lógica: preserva guias, preços e histórico já vinculados.
    await prisma.$transaction([
      prisma.procedimento.update({
        where: { id },
        data: { ativo: false },
      }),
      prisma.precoProcedimentoClinica.updateMany({
        where: { procedimentoId: id },
        data: { ativo: false },
      }),
      prisma.precoProcedimentoUnidade.updateMany({
        where: { procedimentoId: id },
        data: { ativo: false },
      }),
    ]);

    return res.json({
      ok: true,
      mensagem: "Procedimento excluído do catálogo ativo.",
    });
  } catch (erro) {
    console.error("Erro ao excluir procedimento:", erro);
    return res.status(500).json({ erro: "Não foi possível excluir o procedimento." });
  }
});


app.put("/clinicas/:id/precificacao", async (req, res) => {
  try {
    const clinicaId = Number(req.params.id);
    if (!Number.isInteger(clinicaId) || clinicaId <= 0) {
      return res.status(400).json({ erro: "Clínica inválida." });
    }

    const atual = await prisma.clinica.findUnique({ where: { id: clinicaId } });
    if (!atual) return res.status(404).json({ erro: "Clínica não encontrada." });

    const tipoEstabelecimento =
      req.body.tipoEstabelecimento === "LABORATORIO_ANALISES_CLINICAS"
        ? "LABORATORIO_ANALISES_CLINICAS"
        : "CLINICA";
    const tipoPrecificacao = req.body.tipoPrecificacao === "CH" ? "CH" : "INDIVIDUAL";

    const valorChRepasse =
      req.body.valorChRepasse === null || req.body.valorChRepasse === undefined || req.body.valorChRepasse === ""
        ? null
        : numeroFinanceiro(req.body.valorChRepasse);
    const valorChPaciente =
      req.body.valorChPaciente === null || req.body.valorChPaciente === undefined || req.body.valorChPaciente === ""
        ? null
        : numeroFinanceiro(req.body.valorChPaciente);

    if (tipoPrecificacao === "CH") {
      if (
        valorChRepasse === null || valorChPaciente === null ||
        !Number.isFinite(valorChRepasse) || !Number.isFinite(valorChPaciente) ||
        valorChRepasse < 0 || valorChPaciente < 0
      ) {
        return res.status(400).json({ erro: "Informe valores de CH válidos para repasse e paciente." });
      }
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const clinica = await tx.clinica.update({
        where: { id: clinicaId },
        data: { tipoEstabelecimento, tipoPrecificacao, valorChRepasse, valorChPaciente },
      });

      if (tipoPrecificacao === "CH" && valorChRepasse !== null && valorChPaciente !== null) {
        const precosCh = await tx.precoProcedimentoClinica.findMany({
          where: { clinicaId, modoPreco: "CH" },
          include: {
            procedimento: {
              select: {
                quantidadeCh: true,
                referencia: {
                  select: { quantidadeCh: true },
                },
              },
            },
          },
        });

        for (const preco of precosCh) {
          const quantidadeCh =
            preco.procedimento.referencia?.quantidadeCh ??
            preco.procedimento.quantidadeCh;

          if (quantidadeCh === null) continue;
          const ch = Number(quantidadeCh);
          await tx.precoProcedimentoClinica.update({
            where: { id: preco.id },
            data: {
              valorRepasse: arredondarDinheiro(ch * valorChRepasse),
              valorPaciente: arredondarDinheiro(ch * valorChPaciente),
            },
          });
        }
      }

      return clinica;
    });

    return res.json(resultado);
  } catch (erro) {
    console.error("Erro ao configurar precificação da clínica:", erro);
    return res.status(500).json({ erro: "Não foi possível salvar a precificação da clínica." });
  }
});

app.get("/clinicas/:id/precos", async (req, res) => {
  try {
    const clinicaId = Number(req.params.id);
    if (!Number.isInteger(clinicaId) || clinicaId <= 0) return res.status(400).json({ erro: "Clínica inválida." });
    const clinica = await prisma.clinica.findUnique({ where: { id: clinicaId }, select: { id: true, nome: true, tipoEstabelecimento: true, tipoPrecificacao: true, valorChRepasse: true, valorChPaciente: true } });
    if (!clinica) return res.status(404).json({ erro: "Clínica não encontrada." });
    const precos = await prisma.precoProcedimentoClinica.findMany({
      where: { clinicaId },
      include: {
        procedimento: {
          include: { referencia: true },
        },
      },
      orderBy: { procedimento: { nome: "asc" } },
    });
    return res.json({ clinica, precos: precos.map((p) => ({ ...p, valorPaciente: Number(p.valorPaciente), valorRepasse: Number(p.valorRepasse), ...calcularMargens(Number(p.valorPaciente), Number(p.valorRepasse)) })) });
  } catch (erro) {
    console.error("Erro ao carregar preços da clínica:", erro);
    return res.status(500).json({ erro: "Não foi possível carregar a tabela de preços." });
  }
});

app.put("/clinicas/:id/precos/:procedimentoId", async (req, res) => {
  try {
    const clinicaId = Number(req.params.id);
    const procedimentoId = Number(req.params.procedimentoId);
    if (![clinicaId, procedimentoId].every((id) => Number.isInteger(id) && id > 0)) return res.status(400).json({ erro: "Clínica ou procedimento inválido." });
    const [clinica, procedimento] = await Promise.all([prisma.clinica.findUnique({ where: { id: clinicaId }, select: { id: true } }), prisma.procedimento.findUnique({ where: { id: procedimentoId }, select: { id: true, nome: true } })]);
    if (!clinica || !procedimento) return res.status(404).json({ erro: "Clínica ou procedimento não encontrado." });
    const usarCh = req.body.usarCh === true;
    let calculado: { valorPaciente: number; valorRepasse: number };
    let modoPreco: "FIXO" | "CH" = "FIXO";

    if (usarCh) {
      const clinicaCompleta = await prisma.clinica.findUnique({
        where: { id: clinicaId },
        select: { tipoPrecificacao: true, valorChRepasse: true, valorChPaciente: true },
      });
      const procedimentoCompleto = await prisma.procedimento.findUnique({
        where: { id: procedimentoId },
        select: {
          quantidadeCh: true,
          referencia: {
            select: { quantidadeCh: true },
          },
        },
      });

      if (
        clinicaCompleta?.tipoPrecificacao !== "CH" ||
        clinicaCompleta.valorChRepasse === null ||
        clinicaCompleta.valorChPaciente === null
      ) {
        return res.status(400).json({ erro: "Configure os valores de CH desta clínica antes de usar preço por CH." });
      }
      const quantidadeCh =
        procedimentoCompleto?.referencia?.quantidadeCh ??
        procedimentoCompleto?.quantidadeCh ??
        null;

      if (quantidadeCh === null) {
        return res.status(400).json({
          erro: "Este procedimento ainda não possui CH na Base Mestre/AMB-92.",
        });
      }

      const ch = Number(quantidadeCh);
      calculado = {
        valorRepasse: arredondarDinheiro(ch * Number(clinicaCompleta.valorChRepasse)),
        valorPaciente: arredondarDinheiro(ch * Number(clinicaCompleta.valorChPaciente)),
      };
      modoPreco = "CH";
    } else {
      calculado = calcularPrecoPorCampo(req.body);
    }

    const ativo = typeof req.body.ativo === "boolean" ? req.body.ativo : true;
    const preco = await prisma.precoProcedimentoClinica.upsert({
      where: { clinicaId_procedimentoId: { clinicaId, procedimentoId } },
      create: { clinicaId, procedimentoId, valorPaciente: calculado.valorPaciente, valorRepasse: calculado.valorRepasse, modoPreco, ativo },
      update: { valorPaciente: calculado.valorPaciente, valorRepasse: calculado.valorRepasse, modoPreco, ativo },
      include: { procedimento: true },
    });
    return res.json({ ...preco, valorPaciente: Number(preco.valorPaciente), valorRepasse: Number(preco.valorRepasse), ...calcularMargens(Number(preco.valorPaciente), Number(preco.valorRepasse)) });
  } catch (erro) {
    console.error("Erro ao salvar preço:", erro);
    const codigo = erro instanceof Error ? erro.message : "";
    if (["REPASSE_INVALIDO", "MARGEM_INVALIDA", "MARGEM_PERCENTUAL_INVALIDA", "VALOR_PACIENTE_INVALIDO"].includes(codigo)) return res.status(400).json({ erro: "Valores inválidos para o procedimento.", codigo });
    return res.status(500).json({ erro: "Não foi possível salvar o preço." });
  }
});

app.post("/clinicas/:id/precos/lote", async (req, res) => {
  try {
    const clinicaId = Number(req.params.id);
    const procedimentoIds: number[] = Array.isArray(req.body.procedimentoIds)
      ? Array.from(
          new Set<number>(
            req.body.procedimentoIds
              .map((id: unknown) => Number(id))
              .filter((id: number) => Number.isInteger(id) && id > 0)
          )
        )
      : [];
    if (!Number.isInteger(clinicaId) || clinicaId <= 0 || procedimentoIds.length === 0) return res.status(400).json({ erro: "Selecione pelo menos um procedimento." });
    const operacao = String(req.body.operacao || "");
    const valor = numeroFinanceiro(req.body.valor);
    if (!Number.isFinite(valor)) return res.status(400).json({ erro: "Informe um valor válido." });
    const permitidas = ["VALOR_PACIENTE_FIXO", "VALOR_PACIENTE_REAIS", "VALOR_PACIENTE_PERCENTUAL", "REPASSE_FIXO", "REPASSE_REAIS", "REPASSE_PERCENTUAL", "MARGEM_REAIS", "MARGEM_PERCENTUAL"];
    if (!permitidas.includes(operacao)) return res.status(400).json({ erro: "Operação em lote inválida." });
    const atuais = await prisma.precoProcedimentoClinica.findMany({ where: { clinicaId, procedimentoId: { in: procedimentoIds } } });
    if (atuais.length !== procedimentoIds.length) return res.status(400).json({ erro: "Todos os procedimentos selecionados precisam estar na tabela da clínica." });
    const alteracoes = atuais.map((preco) => {
      let vp = Number(preco.valorPaciente); let vr = Number(preco.valorRepasse);
      if (operacao === "VALOR_PACIENTE_FIXO") vp = valor;
      if (operacao === "VALOR_PACIENTE_REAIS") vp += valor;
      if (operacao === "VALOR_PACIENTE_PERCENTUAL") vp *= 1 + valor / 100;
      if (operacao === "REPASSE_FIXO") vr = valor;
      if (operacao === "REPASSE_REAIS") vr += valor;
      if (operacao === "REPASSE_PERCENTUAL") vr *= 1 + valor / 100;
      if (operacao === "MARGEM_REAIS") vp = vr + valor;
      if (operacao === "MARGEM_PERCENTUAL") { if (valor >= 100) throw new Error("MARGEM_PERCENTUAL_INVALIDA"); vp = vr / (1 - valor / 100); }
      vp = arredondarDinheiro(vp); vr = arredondarDinheiro(vr);
      if (vp < 0 || vr < 0) throw new Error("VALOR_NEGATIVO");
      return { id: preco.id, valorPaciente: vp, valorRepasse: vr };
    });
    await prisma.$transaction(alteracoes.map((a) => prisma.precoProcedimentoClinica.update({ where: { id: a.id }, data: { valorPaciente: a.valorPaciente, valorRepasse: a.valorRepasse } })));
    return res.json({ atualizados: alteracoes.length });
  } catch (erro) {
    console.error("Erro na alteração em lote:", erro);
    const codigo = erro instanceof Error ? erro.message : "";
    if (["MARGEM_PERCENTUAL_INVALIDA", "VALOR_NEGATIVO"].includes(codigo)) return res.status(400).json({ erro: "A alteração produziria valores inválidos.", codigo });
    return res.status(500).json({ erro: "Não foi possível alterar os preços em lote." });
  }
});

app.post("/clinicas/:id/precos/importar", async (req, res) => {
  try {
    const clinicaDestinoId = Number(req.params.id);
    const clinicaOrigemId = Number(req.body.clinicaOrigemId);
    const procedimentoIds: number[] | null = Array.isArray(req.body.procedimentoIds)
      ? Array.from(
          new Set<number>(
            req.body.procedimentoIds
              .map((id: unknown) => Number(id))
              .filter((id: number) => Number.isInteger(id) && id > 0)
          )
        )
      : null;
    const substituirExistentes = Boolean(req.body.substituirExistentes);
    if (![clinicaDestinoId, clinicaOrigemId].every((id) => Number.isInteger(id) && id > 0) || clinicaDestinoId === clinicaOrigemId) return res.status(400).json({ erro: "Clínicas de origem e destino inválidas." });
    const origem = await prisma.precoProcedimentoClinica.findMany({ where: { clinicaId: clinicaOrigemId, ...(procedimentoIds ? { procedimentoId: { in: procedimentoIds } } : {}) }, include: { procedimento: true } });
    if (origem.length === 0) return res.status(400).json({ erro: "A clínica de origem não possui os procedimentos selecionados." });
    const existentes = await prisma.precoProcedimentoClinica.findMany({ where: { clinicaId: clinicaDestinoId, procedimentoId: { in: origem.map((p) => p.procedimentoId) } }, select: { procedimentoId: true } });
    const idsExistentes = new Set(existentes.map((p) => p.procedimentoId));
    let criados = 0; let substituidos = 0; let mantidos = 0;
    await prisma.$transaction(async (tx) => {
      for (const preco of origem) {
        if (idsExistentes.has(preco.procedimentoId) && !substituirExistentes) { mantidos += 1; continue; }
        await tx.precoProcedimentoClinica.upsert({ where: { clinicaId_procedimentoId: { clinicaId: clinicaDestinoId, procedimentoId: preco.procedimentoId } }, create: { clinicaId: clinicaDestinoId, procedimentoId: preco.procedimentoId, valorPaciente: preco.valorPaciente, valorRepasse: preco.valorRepasse, ativo: preco.ativo }, update: { valorPaciente: preco.valorPaciente, valorRepasse: preco.valorRepasse, ativo: preco.ativo } });
        if (idsExistentes.has(preco.procedimentoId)) substituidos += 1; else criados += 1;
      }
    });
    return res.json({ totalOrigem: origem.length, criados, substituidos, mantidos });
  } catch (erro) {
    console.error("Erro ao importar tabela de preços:", erro);
    return res.status(500).json({ erro: "Não foi possível importar a tabela de preços." });
  }
});

// Prévia temporária: nenhuma gravação ocorre até a confirmação.
// Adequado ao processo único da V1. Reiniciar a API exige analisar novamente.
// Ao implantar várias instâncias, mover este armazenamento para um serviço compartilhado.
type RegistroImportacaoExcel = {
  linha: number;
  informado: { tuss: string | null; procedimento: string | null; valorRepasse: number | null; valorPaciente: number | null };
  correspondencia: { tipo: string; similaridade: number };
  procedimento: { id: number | null; nome: string; aliases: string[]; tuss: string | null; nomeTuss: string | null; ch: number | null; fonteCh: string | null; origem: string; referenciaId: number | null } | null;
  jaCadastradoNaClinica: boolean;
  precoAtual: unknown;
  valores: { valorRepasse: number | null; valorPaciente: number | null; origem: string };
  status: string;
  erros: string[];
};
type ResultadoImportacaoExcel = {
  selecionados: number; criados: number; substituidos: number; mantidos: number;
  reativados: number; procedimentosCriados: number; porCh: number; fixos: number;
};
type SessaoImportacaoExcel = {
  clinicaId: number;
  expiraEm: number;
  registros: RegistroImportacaoExcel[];
  precos: Map<number, { id: number; atualizadoEm: string }>;
  configuracaoCh: string;
  vinculosManuais?: Map<string, { registro: RegistroImportacaoExcel; precoSnapshot: { id: number; atualizadoEm: string } | null }>;
  processando: boolean;
  resultado?: ResultadoImportacaoExcel;
  assinaturaPedido?: string;
};
const sessoesImportacaoExcel = new Map<string, SessaoImportacaoExcel>();
const VALIDADE_PREVIA_EXCEL = 30 * 60 * 1000;
const MAX_LINHAS_EXCEL = 10000;

function limparSessoesImportacaoExcel() {
  for (const [token, sessao] of sessoesImportacaoExcel) {
    if (!sessao.processando && sessao.expiraEm <= Date.now()) sessoesImportacaoExcel.delete(token);
  }
}
setInterval(limparSessoesImportacaoExcel, 60000).unref();

function configuracaoChExcel(clinica: { tipoPrecificacao: string; valorChPaciente: unknown; valorChRepasse: unknown }) {
  return JSON.stringify([clinica.tipoPrecificacao, String(clinica.valorChPaciente), String(clinica.valorChRepasse)]);
}

class ErroImportacaoExcel extends Error {
  constructor(public statusHttp: number, mensagem: string) { super(mensagem); }
}

function receberPlanilhaExcel(req: express.Request, res: express.Response, next: express.NextFunction) {
  uploadPlanilha.single("arquivo")(req, res, (erro: unknown) => {
    if (erro) {
      return res.status(400).json({ erro: erro instanceof multer.MulterError && erro.code === "LIMIT_FILE_SIZE"
        ? "A planilha deve ter no máximo 10 MB."
        : erro instanceof Error ? erro.message : "Não foi possível receber a planilha." });
    }
    next();
  });
}

function validarValoresExcel(valorPaciente: number | null, valorRepasse: number | null, linha: number) {
  if (valorPaciente === null || valorRepasse === null ||
      !Number.isFinite(valorPaciente) || !Number.isFinite(valorRepasse) ||
      valorPaciente < 0 || valorRepasse < 0 || valorPaciente > 99999999.99 || valorRepasse > 99999999.99) {
    throw new ErroImportacaoExcel(400, `Linha ${linha}: informe preços completos, não negativos e de até R$ 99.999.999,99.`);
  }
  if (valorRepasse > valorPaciente) throw new ErroImportacaoExcel(400, `Linha ${linha}: o repasse é maior que o valor do paciente.`);
  return { valorPaciente: arredondarDinheiro(valorPaciente), valorRepasse: arredondarDinheiro(valorRepasse) };
}

type CandidatoVinculoExcel = {
  origem: "CATALOGO" | "BASE_MESTRE";
  id: number;
  nome: string;
  tuss: string | null;
  ch: number | null;
  aliases: string[];
};

function obterSessaoExcelParaVinculo(clinicaId: number, previewId: unknown) {
  limparSessoesImportacaoExcel();
  if (!Number.isSafeInteger(clinicaId) || clinicaId <= 0 || typeof previewId !== "string") {
    throw new ErroImportacaoExcel(400, "Informe uma clínica e uma prévia válidas.");
  }
  const sessao = sessoesImportacaoExcel.get(previewId);
  if (!sessao || sessao.clinicaId !== clinicaId) throw new ErroImportacaoExcel(410, "A prévia expirou ou não está disponível. Analise novamente.");
  if (sessao.processando || sessao.resultado) throw new ErroImportacaoExcel(409, "Esta prévia já está em importação ou foi concluída. Analise novamente para alterar a seleção.");
  return sessao;
}

app.get("/clinicas/:id/precos/importar-excel/buscar", async (req, res) => {
  try {
    obterSessaoExcelParaVinculo(Number(req.params.id), req.query.previewId);
    const busca = typeof req.query.busca === "string" ? req.query.busca.trim() : "";
    const normalizada = normalizarTextoProcedimento(busca);
    if (normalizada.length < 2 || busca.length > 200) throw new ErroImportacaoExcel(400, "Digite de 2 a 200 caracteres para buscar por nome, sinônimo ou TUSS.");
    const [catalogo, referencias] = await Promise.all([
      prisma.procedimento.findMany({ where: { ativo: true }, select: {
        id: true, nome: true, aliases: true, codigoTuss: true, quantidadeCh: true,
        referencia: { select: { id: true, codigoTuss: true, quantidadeCh: true } },
      } }),
      prisma.procedimentoReferencia.findMany({ where: { ativo: true }, select: { id: true, nomeTuss: true, codigoTuss: true, quantidadeCh: true } }),
    ]);
    const tussNoCatalogo = new Set(catalogo.flatMap((p) => [p.codigoTuss, p.referencia?.codigoTuss].filter((codigo): codigo is string => Boolean(codigo))));
    const candidatos: CandidatoVinculoExcel[] = [
      ...catalogo.map((p): CandidatoVinculoExcel => ({ origem: "CATALOGO", id: p.id, nome: p.nome, aliases: p.aliases,
        tuss: p.referencia?.codigoTuss ?? p.codigoTuss, ch: (p.referencia?.quantidadeCh ?? p.quantidadeCh) == null ? null : Number(p.referencia?.quantidadeCh ?? p.quantidadeCh) })),
      ...referencias.filter((r) => !tussNoCatalogo.has(r.codigoTuss)).map((r): CandidatoVinculoExcel => ({ origem: "BASE_MESTRE", id: r.id, nome: r.nomeTuss, aliases: [], tuss: r.codigoTuss, ch: r.quantidadeCh === null ? null : Number(r.quantidadeCh) })),
    ];
    const termos = normalizada.split(" ");
    const encontrados = candidatos.map((candidato) => {
      const nomes = [candidato.nome, ...candidato.aliases].map(normalizarTextoProcedimento);
      const pontos = candidato.tuss === busca ? 4 : nomes.includes(normalizada) ? 3 :
        candidato.tuss?.includes(busca) ? 2 : nomes.some((nome) => termos.every((termo) => nome.includes(termo))) ? 1 : 0;
      return { candidato, pontos };
    }).filter((item) => item.pontos > 0).sort((a, b) => b.pontos - a.pontos || a.candidato.nome.localeCompare(b.candidato.nome, "pt-BR"));
    return res.json({ total: encontrados.length, candidatos: encontrados.slice(0, 50).map((item) => item.candidato) });
  } catch (erro) {
    if (erro instanceof ErroImportacaoExcel) return res.status(erro.statusHttp).json({ erro: erro.message });
    console.error("Erro ao buscar vínculo para Excel:", erro);
    return res.status(500).json({ erro: "Não foi possível buscar os procedimentos. Tente novamente." });
  }
});

app.post("/clinicas/:id/precos/importar-excel/vincular", async (req, res) => {
  try {
    const clinicaId = Number(req.params.id);
    const body = req.body as { previewId?: unknown; linha?: unknown; origem?: unknown; id?: unknown; confirmarTussDivergente?: unknown } | undefined;
    const sessao = obterSessaoExcelParaVinculo(clinicaId, body?.previewId);
    if (!body || typeof body.linha !== "number" || !Number.isSafeInteger(body.linha) ||
        typeof body.id !== "number" || !Number.isSafeInteger(body.id) || body.id <= 0 ||
        !["CATALOGO", "BASE_MESTRE"].includes(String(body.origem))) throw new ErroImportacaoExcel(400, "Selecione uma linha e um procedimento válidos.");
    const original = sessao.registros.find((r) => r.linha === body.linha);
    if (!original) throw new ErroImportacaoExcel(400, "A linha não pertence a esta prévia.");
    const clinica = await prisma.clinica.findUnique({ where: { id: clinicaId } });
    if (!clinica || !clinica.ativo) throw new ErroImportacaoExcel(409, "A clínica não existe ou está inativa.");
    if (configuracaoChExcel(clinica) !== sessao.configuracaoCh) throw new ErroImportacaoExcel(409, "A precificação da clínica mudou. Analise novamente antes de escolher o vínculo.");
    let procedimento = body.origem === "CATALOGO"
      ? await prisma.procedimento.findUnique({ where: { id: body.id }, include: { referencia: true } })
      : null;
    const referencia = body.origem === "BASE_MESTRE"
      ? await prisma.procedimentoReferencia.findUnique({ where: { id: body.id } })
      : null;
    if (body.origem === "BASE_MESTRE") {
      if (!referencia?.ativo) throw new ErroImportacaoExcel(404, "Referência não encontrada ou inativa.");
      const existentes = await prisma.procedimento.findMany({ where: { OR: [{ referenciaId: referencia.id }, { codigoTuss: referencia.codigoTuss }] }, include: { referencia: true } });
      if (existentes.length > 1) throw new ErroImportacaoExcel(409, "Há mais de um procedimento para este TUSS. Revise o catálogo.");
      procedimento = existentes[0] ?? null;
      if (procedimento && (!procedimento.ativo || (procedimento.referenciaId !== null && procedimento.referenciaId !== referencia.id))) {
        throw new ErroImportacaoExcel(409, "O procedimento vinculado está inativo ou possui outra referência. Revise o catálogo.");
      }
    } else if (!procedimento?.ativo) throw new ErroImportacaoExcel(404, "Procedimento não encontrado ou inativo.");
    const ch = procedimento?.referencia?.quantidadeCh ?? procedimento?.quantidadeCh ?? referencia?.quantidadeCh ?? null;
    const escolhido: NonNullable<RegistroImportacaoExcel["procedimento"]> = procedimento
      ? { id: procedimento.id, nome: procedimento.nome, aliases: procedimento.aliases,
          tuss: procedimento.referencia?.codigoTuss ?? procedimento.codigoTuss,
          nomeTuss: procedimento.referencia?.nomeTuss ?? procedimento.nomeTuss,
          ch: ch === null ? null : Number(ch), fonteCh: procedimento.referencia?.fonteCh ?? null,
          origem: "CATALOGO", referenciaId: procedimento.referenciaId }
      : { id: null, nome: referencia!.nomeTuss, aliases: [], tuss: referencia!.codigoTuss, nomeTuss: referencia!.nomeTuss,
          ch: ch === null ? null : Number(ch), fonteCh: referencia!.fonteCh, origem: "BASE_MESTRE", referenciaId: referencia!.id };
    if (original.informado.tuss && original.informado.tuss !== escolhido.tuss && body.confirmarTussDivergente !== true) {
      throw new ErroImportacaoExcel(409, "O TUSS escolhido difere do informado na planilha. Confirme essa diferença antes de vincular.");
    }
    // Conserva os erros de leitura/valores; retira apenas os que uma escolha manual resolve.
    const erros = original.erros.filter((erro) => ![
      "Informe os dois preços na planilha ou configure CH para o procedimento e a clínica.",
      "O TUSS informado diverge da correspondência por nome. Corrija a planilha antes de importar.",
      "Informe o procedimento ou o código TUSS.",
    ].includes(erro));
    let { valorPaciente, valorRepasse } = original.informado;
    let origemValores = "PLANILHA";
    if (valorPaciente === null && valorRepasse === null && clinica.tipoPrecificacao === "CH" && ch !== null &&
        clinica.valorChPaciente !== null && clinica.valorChRepasse !== null) {
      valorPaciente = arredondarDinheiro(Number(ch) * Number(clinica.valorChPaciente));
      valorRepasse = arredondarDinheiro(Number(ch) * Number(clinica.valorChRepasse));
      origemValores = "CH";
    }
    try { validarValoresExcel(valorPaciente, valorRepasse, original.linha); }
    catch (erro) { if (erro instanceof ErroImportacaoExcel) erros.push(erro.message); else throw erro; }
    if (valorPaciente === null || valorRepasse === null) origemValores = "INCOMPLETO";
    const precoAtual = procedimento ? await prisma.precoProcedimentoClinica.findUnique({ where: { clinicaId_procedimentoId: { clinicaId, procedimentoId: procedimento.id } } }) : null;
    const registro: RegistroImportacaoExcel = { ...original, procedimento: escolhido, correspondencia: { tipo: "MANUAL", similaridade: 100 },
      valores: { valorPaciente, valorRepasse, origem: origemValores },
      status: erros.length ? "ERRO" : "PRONTO", erros: [...new Set(erros)], jaCadastradoNaClinica: Boolean(precoAtual),
      precoAtual: precoAtual ? { valorPaciente: Number(precoAtual.valorPaciente), valorRepasse: Number(precoAtual.valorRepasse), modoPreco: precoAtual.modoPreco, ativo: precoAtual.ativo } : null };
    // Cada escolha é imutável e identificada: outra aba não muda o que será confirmado.
    obterSessaoExcelParaVinculo(clinicaId, body.previewId);
    const totalEmMemoria = [...sessoesImportacaoExcel.values()].reduce((total, s) => total + s.registros.length + (s.vinculosManuais?.size ?? 0), 0);
    if (totalEmMemoria >= 50000) throw new ErroImportacaoExcel(429, "Há muitas prévias abertas. Aguarde alguns minutos antes de tentar novamente.");
    const vinculoId = randomUUID();
    if (!sessao.vinculosManuais) sessao.vinculosManuais = new Map();
    sessao.vinculosManuais.set(vinculoId, { registro, precoSnapshot: precoAtual ? { id: precoAtual.id, atualizadoEm: precoAtual.atualizadoEm.toISOString() } : null });
    return res.json({ vinculoId, registro });
  } catch (erro) {
    if (erro instanceof ErroImportacaoExcel) return res.status(erro.statusHttp).json({ erro: erro.message });
    console.error("Erro ao escolher procedimento na prévia Excel:", erro);
    return res.status(500).json({ erro: "Não foi possível aplicar o vínculo à prévia. Tente novamente." });
  }
});

app.post("/clinicas/:id/precos/importar-excel/confirmar", async (req, res) => {
  let sessaoEmExecucao: SessaoImportacaoExcel | undefined;
  try {
    const clinicaId = Number(req.params.id);
    const body = req.body as { previewId?: unknown; substituirExistentes?: unknown; registros?: unknown } | undefined;
    if (!Number.isSafeInteger(clinicaId) || clinicaId <= 0 || !body ||
        typeof body.previewId !== "string" || typeof body.substituirExistentes !== "boolean" ||
        !Array.isArray(body.registros) || body.registros.length === 0 || body.registros.length > MAX_LINHAS_EXCEL) {
      throw new ErroImportacaoExcel(400, "Envie uma prévia válida, a regra de preços existentes e os registros selecionados.");
    }
    limparSessoesImportacaoExcel();
    const sessao = sessoesImportacaoExcel.get(body.previewId);
    if (!sessao || sessao.clinicaId !== clinicaId) {
      throw new ErroImportacaoExcel(410, "Esta prévia expirou ou não está mais disponível. Analise a planilha novamente.");
    }
    const registros = body.registros.map((valor: unknown) => {
      if (!valor || typeof valor !== "object") throw new ErroImportacaoExcel(400, "Seleção inválida.");
      const item = valor as Record<string, unknown>;
      if (typeof item.linha !== "number" || !Number.isSafeInteger(item.linha) ||
          !["CH", "FIXO"].includes(String(item.modoPreco)) || typeof item.confirmarSugestao !== "boolean") {
        throw new ErroImportacaoExcel(400, "Linha, modo de preço ou confirmação de sugestão inválidos.");
      }
      let novoProcedimento: { nome: string; confirmado: true } | undefined;
      if (item.novoProcedimento !== undefined) {
        if (!item.novoProcedimento || typeof item.novoProcedimento !== "object") {
          throw new ErroImportacaoExcel(400, `Linha ${item.linha}: dados do novo procedimento inválidos.`);
        }
        const novo = item.novoProcedimento as Record<string, unknown>;
        const nome = typeof novo.nome === "string" ? textoProcedimentoMaiusculo(novo.nome) : "";
        if (novo.confirmado !== true || nome.length < 2 || nome.length > 200 || !/[\p{L}\p{N}]/u.test(nome)) {
          throw new ErroImportacaoExcel(400, `Linha ${item.linha}: revise o nome (2 a 200 caracteres) e confirme a criação do novo procedimento.`);
        }
        novoProcedimento = { nome, confirmado: true };
      }
      if (item.vinculoManualId !== undefined && (typeof item.vinculoManualId !== "string" || item.vinculoManualId.length > 100 || novoProcedimento)) {
        throw new ErroImportacaoExcel(400, `Linha ${item.linha}: vínculo manual inválido ou combinado com novo cadastro.`);
      }
      return { linha: item.linha, modoPreco: item.modoPreco as "CH" | "FIXO", confirmarSugestao: item.confirmarSugestao,
        ...(novoProcedimento ? { novoProcedimento } : {}),
        ...(typeof item.vinculoManualId === "string" ? { vinculoManualId: item.vinculoManualId } : {}) };
    }).sort((a, b) => a.linha - b.linha);
    if (new Set(registros.map((r) => r.linha)).size !== registros.length) {
      throw new ErroImportacaoExcel(400, "Uma mesma linha foi selecionada mais de uma vez.");
    }
    const assinaturaPedido = JSON.stringify({ substituirExistentes: body.substituirExistentes, registros });
    if (sessao.resultado) {
      if (sessao.assinaturaPedido !== assinaturaPedido) throw new ErroImportacaoExcel(409, "Esta prévia já foi importada. Analise novamente para uma nova seleção.");
      return res.json({ ...sessao.resultado, repeticao: true });
    }
    if (sessao.processando) throw new ErroImportacaoExcel(409, "A importação desta prévia já está em andamento. Aguarde e tente novamente para consultar o resultado.");
    const porLinha = new Map(sessao.registros.map((r) => [r.linha, r]));
    const escolhidos = registros.map((item) => {
      const vinculoManual = item.vinculoManualId ? sessao.vinculosManuais?.get(item.vinculoManualId) : undefined;
      if (item.vinculoManualId !== undefined && (!vinculoManual || vinculoManual.registro.linha !== item.linha)) {
        throw new ErroImportacaoExcel(400, `Linha ${item.linha}: vínculo manual não pertence à linha ou à prévia.`);
      }
      const registro = vinculoManual?.registro ?? porLinha.get(item.linha);
      if (!registro || registro.erros.length) {
        throw new ErroImportacaoExcel(400, `Linha ${item.linha}: registro não disponível para importação. Corrija a planilha e analise novamente.`);
      }
      if (item.novoProcedimento) {
        if (registro.status !== "NAO_ENCONTRADO" || registro.procedimento) {
          throw new ErroImportacaoExcel(400, `Linha ${item.linha}: já existe uma correspondência. Revise o procedimento identificado; não crie outro.`);
        }
        if (registro.informado.tuss) {
          throw new ErroImportacaoExcel(400, `Linha ${item.linha}: o TUSS informado não foi localizado. Corrija o código ou retire-o da planilha para cadastrar sem TUSS.`);
        }
        if (item.modoPreco !== "FIXO") {
          throw new ErroImportacaoExcel(400, `Linha ${item.linha}: um novo procedimento sem referência deve usar os preços fixos da planilha.`);
        }
        validarValoresExcel(registro.informado.valorPaciente, registro.informado.valorRepasse, item.linha);
      } else if (!registro.procedimento || !["PRONTO", "CONFERIR"].includes(registro.status)) {
        throw new ErroImportacaoExcel(400, `Linha ${item.linha}: revise e confirme o cadastro como novo procedimento, ou corrija a planilha.`);
      }
      if (registro.status === "CONFERIR" && !item.confirmarSugestao) {
        throw new ErroImportacaoExcel(400, `Linha ${item.linha}: revise e confirme individualmente a sugestão.`);
      }
      return { ...item, registro, procedimento: registro.procedimento, vinculoManual };
    });
    sessao.processando = true;
    sessaoEmExecucao = sessao;
    const resultado = await prisma.$transaction(async (tx) => {
      // Serializa a criação operacional entre importações, inclusive de clínicas distintas.
      // A consulta de bloqueio não retorna o tipo PostgreSQL void ao Prisma.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(846231, 1)`;
      const clinica = await tx.clinica.findUnique({ where: { id: clinicaId } });
      if (!clinica || !clinica.ativo) throw new ErroImportacaoExcel(409, "A clínica não existe ou está inativa.");
      const contagem: ResultadoImportacaoExcel = { selecionados: escolhidos.length, criados: 0, substituidos: 0, mantidos: 0, reativados: 0, procedimentosCriados: 0, porCh: 0, fixos: 0 };
      const procedimentosDoLote = new Set<number>();
      const nomesCatalogo = await tx.procedimento.findMany({ select: { nome: true, aliases: true } });
      const referenciasParaNovos = escolhidos.some((item) => item.novoProcedimento)
        ? await tx.procedimentoReferencia.findMany({ select: { nomeTuss: true, codigoTuss: true } })
        : [];
      for (const item of escolhidos) {
        let esperado = item.procedimento;
        let procedimento = esperado?.origem === "CATALOGO" && esperado.id
          ? await tx.procedimento.findUnique({ where: { id: esperado.id }, include: { referencia: true } })
          : null;
        if (item.novoProcedimento) {
          const nome = item.novoProcedimento.nome;
          // Inclui nomes e sinônimos de procedimentos ativos e inativos e itens
          // criados anteriormente neste lote. Nunca ignora um cadastro antigo.
          const candidatos = nomesCatalogo.filter((p) => [p.nome, ...p.aliases].some((existente) =>
            normalizarTextoProcedimento(nome) === normalizarTextoProcedimento(existente) ||
            similaridadeProcedimento(nome, existente) >= 0.72
          ));
          if (candidatos.length) {
            throw new ErroImportacaoExcel(409, `Linha ${item.linha}: possível duplicidade com ${candidatos.slice(0, 3).map((p) => `"${p.nome}"`).join(", ")}. Revise o nome ou o catálogo antes de importar. Nenhum item deste lote foi gravado.`);
          }
          const referenciaPorNome = referenciasParaNovos.find((r) =>
            normalizarTextoProcedimento(r.nomeTuss) === normalizarTextoProcedimento(nome)
          );
          if (referenciaPorNome) {
            throw new ErroImportacaoExcel(409, `Linha ${item.linha}: este nome já consta na Base Mestre (TUSS ${referenciaPorNome.codigoTuss}). Atualize a planilha com esse código e analise novamente.`);
          }
          procedimento = await tx.procedimento.create({
            data: { nome, aliases: [], referenciaId: null, codigoTuss: null, quantidadeCh: null, ativo: true },
            include: { referencia: true },
          });
          nomesCatalogo.push({ nome: procedimento.nome, aliases: procedimento.aliases });
          contagem.procedimentosCriados += 1;
          esperado = { id: procedimento.id, nome, aliases: [], tuss: null, nomeTuss: null, ch: null, fonteCh: null, origem: "CATALOGO", referenciaId: null };
        }
        if (!esperado) throw new ErroImportacaoExcel(400, `Linha ${item.linha}: procedimento não identificado.`);
        if (esperado.origem === "BASE_MESTRE") {
          if (!esperado.referenciaId) throw new ErroImportacaoExcel(400, `Linha ${item.linha}: referência TUSS inválida.`);
          const referencia = await tx.procedimentoReferencia.findUnique({ where: { id: esperado.referenciaId } });
          if (!referencia || !referencia.ativo || referencia.codigoTuss !== esperado.tuss || referencia.nomeTuss !== esperado.nome) {
            throw new ErroImportacaoExcel(409, `Linha ${item.linha}: a Base Mestre mudou. Analise novamente.`);
          }
          const existentes = await tx.procedimento.findMany({
            where: { OR: [{ referenciaId: referencia.id }, { codigoTuss: referencia.codigoTuss }] },
            include: { referencia: true },
          });
          if (existentes.length > 1) throw new ErroImportacaoExcel(409, `Linha ${item.linha}: há mais de um procedimento para este TUSS. Revise o catálogo.`);
          procedimento = existentes[0] ?? null;
          if (procedimento && (!procedimento.ativo || (procedimento.referenciaId !== null && procedimento.referenciaId !== referencia.id))) {
            throw new ErroImportacaoExcel(409, `Linha ${item.linha}: o procedimento existente está inativo ou tem outra referência. Revise o catálogo.`);
          }
          if (!procedimento) {
            // Não cria um segundo operacional quando o nome/sinônimo já existe sem TUSS.
            if (nomesCatalogo.some((p) => [p.nome, ...p.aliases].some((nome) => normalizarTextoProcedimento(nome) === normalizarTextoProcedimento(referencia.nomeTuss)))) {
              throw new ErroImportacaoExcel(409, `Linha ${item.linha}: já existe nome ou sinônimo equivalente no catálogo. Vincule a referência TUSS antes de importar.`);
            }
            procedimento = await tx.procedimento.create({
              data: { nome: textoProcedimentoMaiusculo(referencia.nomeTuss), referenciaId: referencia.id, aliases: [], ativo: true },
              include: { referencia: true },
            });
            nomesCatalogo.push({ nome: procedimento.nome, aliases: procedimento.aliases });
            contagem.procedimentosCriados += 1;
          }
        }
        if (!procedimento || !procedimento.ativo) throw new ErroImportacaoExcel(409, `Linha ${item.linha}: procedimento ausente ou inativo. Analise novamente.`);
        const tussAtual = procedimento.referencia?.codigoTuss ?? procedimento.codigoTuss;
        if (tussAtual !== esperado.tuss || (esperado.origem === "CATALOGO" && procedimento.nome !== esperado.nome)) {
          throw new ErroImportacaoExcel(409, `Linha ${item.linha}: o procedimento foi alterado. Analise novamente.`);
        }
        if (procedimentosDoLote.has(procedimento.id)) throw new ErroImportacaoExcel(400, `Linha ${item.linha}: o procedimento aparece em mais de uma linha selecionada. Selecione apenas uma.`);
        procedimentosDoLote.add(procedimento.id);
        const precoAtual = await tx.precoProcedimentoClinica.findUnique({
          where: { clinicaId_procedimentoId: { clinicaId, procedimentoId: procedimento.id } },
        });
        // Manter também preserva vínculos inativos: nenhuma reativação silenciosa.
        if (precoAtual && !body.substituirExistentes) { contagem.mantidos += 1; continue; }
        const precoDaPrevia = item.vinculoManual ? item.vinculoManual.precoSnapshot : sessao.precos.get(procedimento.id);
        if ((precoAtual && (!precoDaPrevia || precoAtual.id !== precoDaPrevia.id || precoAtual.atualizadoEm.toISOString() !== precoDaPrevia.atualizadoEm)) || (!precoAtual && precoDaPrevia)) {
          throw new ErroImportacaoExcel(409, `Linha ${item.linha}: os preços da clínica mudaram após a prévia. Analise novamente para substituir.`);
        }
        let valores;
        if (item.modoPreco === "CH") {
          const ch = procedimento.referencia?.quantidadeCh ?? procedimento.quantidadeCh;
          if (clinica.tipoPrecificacao !== "CH" || clinica.valorChPaciente === null || clinica.valorChRepasse === null || ch === null || Number(ch) < 0 ||
              Number(clinica.valorChPaciente) < 0 || Number(clinica.valorChRepasse) < 0) {
            throw new ErroImportacaoExcel(400, `Linha ${item.linha}: configure o CH da clínica e do procedimento ou utilize preços fixos completos.`);
          }
          if (configuracaoChExcel(clinica) !== sessao.configuracaoCh || Number(ch) !== esperado.ch) {
            throw new ErroImportacaoExcel(409, `Linha ${item.linha}: o CH mudou após a prévia. Analise novamente.`);
          }
          valores = validarValoresExcel(Number(ch) * Number(clinica.valorChPaciente), Number(ch) * Number(clinica.valorChRepasse), item.linha);
        } else {
          valores = validarValoresExcel(item.registro.informado.valorPaciente, item.registro.informado.valorRepasse, item.linha);
        }
        await tx.precoProcedimentoClinica.upsert({
          where: { clinicaId_procedimentoId: { clinicaId, procedimentoId: procedimento.id } },
          create: { clinicaId, procedimentoId: procedimento.id, ...valores, modoPreco: item.modoPreco, ativo: true },
          update: { ...valores, modoPreco: item.modoPreco, ativo: true },
        });
        if (precoAtual) { contagem.substituidos += 1; if (!precoAtual.ativo) contagem.reativados += 1; }
        else contagem.criados += 1;
        if (item.modoPreco === "CH") contagem.porCh += 1; else contagem.fixos += 1;
      }
      return contagem;
    }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 120000 });
    sessao.resultado = resultado;
    sessao.assinaturaPedido = assinaturaPedido;
    sessao.expiraEm = Date.now() + VALIDADE_PREVIA_EXCEL;
    return res.json(resultado);
  } catch (erro) {
    if (erro instanceof ErroImportacaoExcel) return res.status(erro.statusHttp).json({ erro: erro.message });
    console.error("Erro ao confirmar importação Excel:", erro);
    const codigo = erro && typeof erro === "object" && "code" in erro ? erro.code : null;
    if (codigo === "P2034" || codigo === "P2002") return res.status(409).json({ erro: "Houve outra alteração simultânea. Nenhum item deste lote foi gravado. Analise novamente." });
    return res.status(500).json({ erro: "Não foi possível concluir a importação. Tente confirmar novamente com a mesma seleção para consultar ou concluir o resultado." });
  } finally {
    if (sessaoEmExecucao) sessaoEmExecucao.processando = false;
  }
});

app.post(
  "/clinicas/:id/precos/importar-excel/preview",
  receberPlanilhaExcel,
  async (req, res) => {
    try {
      const clinicaId = Number(req.params.id);

      if (!Number.isInteger(clinicaId) || clinicaId <= 0) {
        return res.status(400).json({
          erro: "Clínica inválida.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          erro: "Selecione uma planilha Excel.",
        });
      }

      const clinica = await prisma.clinica.findUnique({
        where: {
          id: clinicaId,
        },
        select: {
          id: true,
          nome: true,
          tipoPrecificacao: true,
          valorChRepasse: true,
          valorChPaciente: true,
          precos: {
            select: {
              id: true,
              atualizadoEm: true,
              ativo: true,
              modoPreco: true,
              procedimentoId: true,
              valorPaciente: true,
              valorRepasse: true,
            },
          },
        },
      });

      if (!clinica) {
        return res.status(404).json({
          erro: "Clínica não encontrada.",
        });
      }

      const workbook = XLSX.read(req.file.buffer, {
        type: "buffer",
        cellDates: false,
      });

      const nomeAba = workbook.SheetNames[0];

      if (!nomeAba) {
        return res.status(400).json({
          erro: "A planilha não possui nenhuma aba.",
        });
      }

      const sheet = workbook.Sheets[nomeAba];

      const linhas = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
        raw: true,
      });

      if (linhas.length > MAX_LINHAS_EXCEL + 1) {
        return res.status(400).json({ erro: "A planilha pode ter no máximo 10.000 linhas de dados. Divida o arquivo em partes." });
      }
      if (linhas.length < 2) {
        return res.status(400).json({
          erro: "A planilha está vazia ou não possui registros.",
        });
      }

      const cabecalhos = (linhas[0] || []).map((valor) =>
        textoCelulaPlanilha(valor)
      );

      const indiceTuss = encontrarColunaPlanilha(cabecalhos, [
        "TUSS",
        "CODIGO TUSS",
        "CÓDIGO TUSS",
        "COD TUSS",
      ]);

      const indiceProcedimento = encontrarColunaPlanilha(cabecalhos, [
        "PROCEDIMENTO",
        "EXAME",
        "NOME PROCEDIMENTO",
        "NOME DO PROCEDIMENTO",
        "DESCRICAO",
        "DESCRIÇÃO",
      ]);

      const indiceRepasse = encontrarColunaPlanilha(cabecalhos, [
        "VALOR REPASSE",
        "REPASSE",
        "CUSTO",
        "VALOR CLINICA",
        "VALOR CLÍNICA",
      ]);

      const indicePaciente = encontrarColunaPlanilha(cabecalhos, [
        "VALOR PACIENTE",
        "VALOR VENDA",
        "PRECO PACIENTE",
        "PREÇO PACIENTE",
        "PRECO",
        "PREÇO",
      ]);

      if (indiceTuss < 0 && indiceProcedimento < 0) {
        return res.status(400).json({
          erro:
            'A planilha precisa ter pelo menos a coluna "PROCEDIMENTO" ou "TUSS".',
          cabecalhosEncontrados: cabecalhos,
        });
      }
      const procedimentos = await prisma.procedimento.findMany({
        where: {
          ativo: true,
        },
        select: {
          id: true,
          nome: true,
          aliases: true,
          codigoTuss: true,
          quantidadeCh: true,
          referencia: {
            select: {
              id: true,
              codigoTuss: true,
              nomeTuss: true,
              quantidadeCh: true,
              fonteCh: true,
            },
          },
        },
        orderBy: {
          nome: "asc",
        },
      });

            const referenciasTuss = await prisma.procedimentoReferencia.findMany({
        where: {
          ativo: true,
        },
        select: {
          id: true,
          codigoTuss: true,
          nomeTuss: true,
          quantidadeCh: true,
          fonteCh: true,
        },
        orderBy: {
          nomeTuss: "asc",
        },
      });

      const precosAtuais = new Map(
        clinica.precos.map((preco) => [
          preco.procedimentoId,
          {
            ativo: preco.ativo,
            modoPreco: preco.modoPreco,
            valorPaciente: Number(preco.valorPaciente),
            valorRepasse: Number(preco.valorRepasse),
          },
        ])
      );

      const registros = [];

      for (let indiceLinha = 1; indiceLinha < linhas.length; indiceLinha++) {
        const linha = linhas[indiceLinha] || [];

        const nomeInformado =
          indiceProcedimento >= 0
            ? textoCelulaPlanilha(linha[indiceProcedimento])
            : "";

        const tussInformado =
          indiceTuss >= 0
            ? textoCelulaPlanilha(linha[indiceTuss]).replace(/\D/g, "")
            : "";

        const repasseInformado =
          indiceRepasse >= 0
            ? numeroCelulaPlanilha(linha[indiceRepasse])
            : null;

        const pacienteInformado =
          indicePaciente >= 0
            ? numeroCelulaPlanilha(linha[indicePaciente])
            : null;

        if (
          !nomeInformado &&
          !tussInformado &&
          (indiceRepasse < 0 || !textoCelulaPlanilha(linha[indiceRepasse])) &&
          (indicePaciente < 0 || !textoCelulaPlanilha(linha[indicePaciente]))
        ) {
          continue;
        }

        let procedimentoEncontrado:
          | (typeof procedimentos)[number]
          | null = null;
        
        let referenciaEncontrada:
          | (typeof referenciasTuss)[number]
          | null = null;

        let tipoCorrespondencia:
          | "TUSS"
          | "NOME"
          | "ALIAS"
          | "SUGESTAO"
          | "NAO_ENCONTRADO" = "NAO_ENCONTRADO";

        let similaridade = 0;

                if (tussInformado) {
          procedimentoEncontrado =
            procedimentos.find(
              (procedimento) =>
                procedimento.referencia?.codigoTuss === tussInformado ||
                procedimento.codigoTuss === tussInformado
            ) || null;

          if (procedimentoEncontrado) {
            tipoCorrespondencia = "TUSS";
            similaridade = 1;
          } else {
            referenciaEncontrada =
              referenciasTuss.find(
                (referencia) =>
                  referencia.codigoTuss === tussInformado
              ) || null;

            if (referenciaEncontrada) {
              tipoCorrespondencia = "TUSS";
              similaridade = 1;
            }
          }
        }

        // 2. Procura primeiro pelo nome ou sinônimo exato
        // no catálogo já criado da Digna.
        if (
          !procedimentoEncontrado &&
          !referenciaEncontrada &&
          nomeInformado
        ) {
          const nomeNormalizado =
            normalizarTextoProcedimento(nomeInformado);

          for (const procedimento of procedimentos) {
            if (
              normalizarTextoProcedimento(procedimento.nome) ===
              nomeNormalizado
            ) {
              procedimentoEncontrado = procedimento;
              tipoCorrespondencia = "NOME";
              similaridade = 1;
              break;
            }

            const aliasEncontrado = procedimento.aliases.some(
              (alias) =>
                normalizarTextoProcedimento(alias) ===
                nomeNormalizado
            );

            if (aliasEncontrado) {
              procedimentoEncontrado = procedimento;
              tipoCorrespondencia = "ALIAS";
              similaridade = 1;
              break;
            }
          }
        }

        // 3. Se ainda não encontrou, procura na Base Mestre TUSS.
        if (
          !procedimentoEncontrado &&
          !referenciaEncontrada &&
          nomeInformado
        ) {
          const nomeNormalizado =
            normalizarTextoProcedimento(nomeInformado);

          // Primeiro tenta nome oficial exatamente igual.
          referenciaEncontrada =
            referenciasTuss.find(
              (referencia) =>
                normalizarTextoProcedimento(referencia.nomeTuss) ===
                nomeNormalizado
            ) || null;

          if (referenciaEncontrada) {
            tipoCorrespondencia = "NOME";
            similaridade = 1;
          } else {
            const termosBusca = nomeNormalizado
              .split(" ")
              .filter(Boolean);

            // Nomes curtos de uma palavra:
            // GLICOSE, CREATININA, TSH etc.
            if (termosBusca.length === 1) {
              const termo = termosBusca[0];

              const candidatosPalavra =
                referenciasTuss
                  .filter((referencia) => {
                    const nomeReferencia =
                      normalizarTextoProcedimento(
                        referencia.nomeTuss
                      );

                    return nomeReferencia
                      .split(" ")
                      .includes(termo);
                  })
                  .sort((a, b) => {
                    const nomeA =
                      normalizarTextoProcedimento(
                        a.nomeTuss
                      );

                    const nomeB =
                      normalizarTextoProcedimento(
                        b.nomeTuss
                      );

                    return nomeA.length - nomeB.length;
                  });

              if (candidatosPalavra.length > 0) {
                referenciaEncontrada =
                  candidatosPalavra[0];

                similaridade = 0.8;
                tipoCorrespondencia = "SUGESTAO";
              }
            } else {
              const candidatosReferencia =
                referenciasTuss
                  .map((referencia) => ({
                    referencia,
                    similaridade:
                      similaridadeProcedimento(
                        nomeInformado,
                        referencia.nomeTuss
                      ),
                  }))
                  .filter(
                    (registro) =>
                      registro.similaridade >= 0.72
                  )
                  .sort(
                    (a, b) =>
                      b.similaridade -
                      a.similaridade
                  );

              if (candidatosReferencia.length > 0) {
                referenciaEncontrada =
                  candidatosReferencia[0].referencia;

                similaridade =
                  candidatosReferencia[0].similaridade;

                tipoCorrespondencia = "SUGESTAO";
              }
            }
          }
        }

        // 4. Última tentativa: similaridade com procedimentos
        // já existentes no catálogo Digna.
        if (
          !procedimentoEncontrado &&
          !referenciaEncontrada &&
          nomeInformado
        ) {
          const candidatos = procedimentos
            .map((procedimento) => {
              const nomes = [
                procedimento.nome,
                ...procedimento.aliases,
              ];

              const maiorSimilaridade = Math.max(
                ...nomes.map((nome) =>
                  similaridadeProcedimento(
                    nomeInformado,
                    nome
                  )
                )
              );

              return {
                procedimento,
                similaridade: maiorSimilaridade,
              };
            })
            .filter(
              (registro) =>
                registro.similaridade >= 0.72
            )
            .sort(
              (a, b) =>
                b.similaridade -
                a.similaridade
            );

          if (candidatos.length > 0) {
            procedimentoEncontrado =
              candidatos[0].procedimento;

            similaridade =
              candidatos[0].similaridade;

            tipoCorrespondencia = "SUGESTAO";
          }
        }
        
        const ch =
          procedimentoEncontrado?.referencia?.quantidadeCh ??
          procedimentoEncontrado?.quantidadeCh ??
          referenciaEncontrada?.quantidadeCh ??
          null;

        let valorRepasse = repasseInformado;
        let valorPaciente = pacienteInformado;
        let origemValores:
          | "PLANILHA"
          | "CH"
          | "INCOMPLETO" = "INCOMPLETO";

        if (
          (procedimentoEncontrado || referenciaEncontrada) &&
          clinica.tipoPrecificacao === "CH" &&
          ch !== null &&
          clinica.valorChRepasse !== null &&
          clinica.valorChPaciente !== null &&
          repasseInformado === null &&
          pacienteInformado === null
        ) {
          valorRepasse = arredondarDinheiro(
            Number(ch) * Number(clinica.valorChRepasse)
          );

          valorPaciente = arredondarDinheiro(
            Number(ch) * Number(clinica.valorChPaciente)
          );

          origemValores = "CH";
        } else if (
          repasseInformado !== null ||
          pacienteInformado !== null
        ) {
          origemValores = "PLANILHA";
        }

        const precoAtual = procedimentoEncontrado
          ? precosAtuais.get(procedimentoEncontrado.id) || null
          : null;

        const erros: string[] = [];
        for (const [indice, titulo] of [[indicePaciente, "paciente"], [indiceRepasse, "repasse"]] as const) {
          if (indice >= 0 && textoCelulaPlanilha(linha[indice]) && numeroCelulaPlanilha(linha[indice]) === null) {
            erros.push(`Valor de ${titulo} inválido na planilha.`);
          }
        }
        if (procedimentoEncontrado || referenciaEncontrada) {
          if (valorPaciente === null || valorRepasse === null) erros.push("Informe os dois preços na planilha ou configure CH para o procedimento e a clínica.");
        }
        if ([valorPaciente, valorRepasse].some((v) => v !== null && (!Number.isFinite(v) || v < 0 || v > 99999999.99))) {
          erros.push("Os preços devem estar entre zero e R$ 99.999.999,99.");
        }
        const tussEncontrado = procedimentoEncontrado?.referencia?.codigoTuss ?? procedimentoEncontrado?.codigoTuss ?? referenciaEncontrada?.codigoTuss;
        if (tussInformado && (procedimentoEncontrado || referenciaEncontrada) && tussInformado !== (tussEncontrado ?? "")) {
          erros.push("O TUSS informado diverge da correspondência por nome. Corrija a planilha antes de importar.");
        }

        if (!nomeInformado && !tussInformado) {
          erros.push(
            "Informe o procedimento ou o código TUSS."
          );
        }

        if (
          valorPaciente !== null &&
          valorRepasse !== null &&
          valorRepasse > valorPaciente
        ) {
          erros.push(
            "Repasse é maior que o valor do paciente."
          );
        }

        registros.push({
          linha: indiceLinha + 1,

          informado: {
            tuss: tussInformado || null,
            procedimento: nomeInformado || null,
            valorRepasse: repasseInformado,
            valorPaciente: pacienteInformado,
          },

          correspondencia: {
            tipo: tipoCorrespondencia,
            similaridade:
              Math.round(similaridade * 10000) / 100,
          },

          procedimento: procedimentoEncontrado
          ? {
              id: procedimentoEncontrado.id,
              nome: procedimentoEncontrado.nome,
              aliases: procedimentoEncontrado.aliases,
              tuss:
                procedimentoEncontrado.referencia?.codigoTuss ||
                procedimentoEncontrado.codigoTuss ||
                null,
              nomeTuss:
                procedimentoEncontrado.referencia?.nomeTuss || null,
              ch:
                ch === null ? null : Number(ch),
              fonteCh:
                procedimentoEncontrado.referencia?.fonteCh || null,
              origem: "CATALOGO",
              referenciaId:
                procedimentoEncontrado.referencia?.id || null,
            }
          : referenciaEncontrada
            ? {
                id: null,
                nome: referenciaEncontrada.nomeTuss,
                aliases: [],
                tuss: referenciaEncontrada.codigoTuss,
                nomeTuss: referenciaEncontrada.nomeTuss,
                ch:
                  ch === null ? null : Number(ch),
                fonteCh: referenciaEncontrada.fonteCh,
                origem: "BASE_MESTRE",
                referenciaId: referenciaEncontrada.id,
              }
            : null,

          valores: {
            valorRepasse,
            valorPaciente,
            origem: origemValores,
          },

          jaCadastradoNaClinica:
            Boolean(precoAtual),

          precoAtual,

          status:
            erros.length > 0
              ? "ERRO"
              : tipoCorrespondencia === "NAO_ENCONTRADO"
                ? "NAO_ENCONTRADO"
                : tipoCorrespondencia === "SUGESTAO"
                  ? "CONFERIR"
                  : "PRONTO",

          erros,
        });
      }

      const resumo = {
        total: registros.length,
        prontos: registros.filter(
          (registro) => registro.status === "PRONTO"
        ).length,
        conferir: registros.filter(
          (registro) => registro.status === "CONFERIR"
        ).length,
        naoEncontrados: registros.filter(
          (registro) => registro.status === "NAO_ENCONTRADO"
        ).length,
        erros: registros.filter(
          (registro) => registro.status === "ERRO"
        ).length,
        jaCadastrados: registros.filter(
          (registro) => registro.jaCadastradoNaClinica
        ).length,
        calculadosPorCh: registros.filter(
          (registro) => registro.valores.origem === "CH"
        ).length,
      };

      limparSessoesImportacaoExcel();
      const totalEmMemoria = [...sessoesImportacaoExcel.values()].reduce((total, sessao) => total + sessao.registros.length + (sessao.vinculosManuais?.size ?? 0), 0);
      if (sessoesImportacaoExcel.size >= 40 || totalEmMemoria + registros.length > 50000) {
        return res.status(429).json({ erro: "Há muitas prévias abertas. Aguarde alguns minutos antes de analisar novamente." });
      }
      const previewId = randomUUID();
      const expiraEm = Date.now() + VALIDADE_PREVIA_EXCEL;
      sessoesImportacaoExcel.set(previewId, {
        clinicaId, expiraEm, registros, processando: false,
        configuracaoCh: configuracaoChExcel(clinica),
        precos: new Map(clinica.precos.map((preco) => [preco.procedimentoId, { id: preco.id, atualizadoEm: preco.atualizadoEm.toISOString() }])),
      });
      return res.json({
        previewId,
        expiraEm: new Date(expiraEm).toISOString(),
        arquivo: req.file.originalname,
        aba: nomeAba,
        clinica: {
          id: clinica.id,
          nome: clinica.nome,
          tipoPrecificacao: clinica.tipoPrecificacao,
          valorChPaciente: clinica.valorChPaciente === null ? null : Number(clinica.valorChPaciente),
          valorChRepasse: clinica.valorChRepasse === null ? null : Number(clinica.valorChRepasse),
        },
        resumo,
        registros,
      });
    } catch (erro) {
      console.error(
        "Erro ao pré-validar planilha de preços:",
        erro
      );

      return res.status(500).json({
        erro:
          erro instanceof Error
            ? erro.message
            : "Não foi possível ler a planilha.",
      });
    }
  }
);

app.get("/clinicas/:id/unidades/:unidadeId/precos", async (req, res) => {
  try {
    const clinicaId = Number(req.params.id); const unidadeId = Number(req.params.unidadeId);
    const unidade = await prisma.unidadeClinica.findFirst({ where: { id: unidadeId, clinicaId }, include: { precosEspecificos: true } });
    if (!unidade) return res.status(404).json({ erro: "Unidade não encontrada." });
    const base = await prisma.precoProcedimentoClinica.findMany({ where: { clinicaId, ativo: true }, include: { procedimento: true }, orderBy: { procedimento: { nome: "asc" } } });
    const excecoes = new Map(unidade.precosEspecificos.map((p) => [p.procedimentoId, p]));
    return res.json({ unidade: { id: unidade.id, nome: unidade.nome }, precos: base.map((p) => { const e = excecoes.get(p.procedimentoId); const vp = Number(e?.valorPaciente ?? p.valorPaciente); const vr = Number(e?.valorRepasse ?? p.valorRepasse); return { procedimento: p.procedimento, valorPaciente: vp, valorRepasse: vr, ...calcularMargens(vp, vr), origem: e ? "UNIDADE" : "CLINICA", excecaoId: e?.id || null, ativo: e ? e.ativo : p.ativo }; }) });
  } catch (erro) { console.error("Erro ao carregar preços da unidade:", erro); return res.status(500).json({ erro: "Não foi possível carregar os preços da unidade." }); }
});

app.put("/clinicas/:id/unidades/:unidadeId/precos/:procedimentoId", async (req, res) => {
  try {
    const clinicaId = Number(req.params.id); const unidadeId = Number(req.params.unidadeId); const procedimentoId = Number(req.params.procedimentoId);
    const unidade = await prisma.unidadeClinica.findFirst({ where: { id: unidadeId, clinicaId }, select: { id: true } });
    const base = await prisma.precoProcedimentoClinica.findUnique({ where: { clinicaId_procedimentoId: { clinicaId, procedimentoId } } });
    if (!unidade || !base) return res.status(404).json({ erro: "Unidade ou preço-base não encontrado." });
    const calculado = calcularPrecoPorCampo(req.body);
    const preco = await prisma.precoProcedimentoUnidade.upsert({ where: { unidadeClinicaId_procedimentoId: { unidadeClinicaId: unidadeId, procedimentoId } }, create: { unidadeClinicaId: unidadeId, procedimentoId, valorPaciente: calculado.valorPaciente, valorRepasse: calculado.valorRepasse, ativo: typeof req.body.ativo === "boolean" ? req.body.ativo : true }, update: { valorPaciente: calculado.valorPaciente, valorRepasse: calculado.valorRepasse, ...(typeof req.body.ativo === "boolean" ? { ativo: req.body.ativo } : {}) } });
    return res.json({ ...preco, valorPaciente: Number(preco.valorPaciente), valorRepasse: Number(preco.valorRepasse), ...calcularMargens(Number(preco.valorPaciente), Number(preco.valorRepasse)), origem: "UNIDADE" });
  } catch (erro) { console.error("Erro ao salvar preço específico da unidade:", erro); return res.status(400).json({ erro: "Não foi possível salvar o preço específico da unidade." }); }
});

app.delete("/clinicas/:id/unidades/:unidadeId/precos/:procedimentoId", async (req, res) => {
  try {
    const clinicaId = Number(req.params.id); const unidadeId = Number(req.params.unidadeId); const procedimentoId = Number(req.params.procedimentoId);
    const unidade = await prisma.unidadeClinica.findFirst({ where: { id: unidadeId, clinicaId }, select: { id: true } });
    if (!unidade) return res.status(404).json({ erro: "Unidade não encontrada." });
    await prisma.precoProcedimentoUnidade.deleteMany({ where: { unidadeClinicaId: unidadeId, procedimentoId } });
    return res.json({ ok: true, origem: "CLINICA" });
  } catch (erro) { console.error("Erro ao restaurar preço-base da unidade:", erro); return res.status(500).json({ erro: "Não foi possível restaurar o preço-base." }); }
});

// ======================================================
// PACIENTES
// ======================================================


// ======================================================
// PACIENTES - VISÃO OPERACIONAL
// ======================================================

app.get("/pacientes/resumo", async (_req, res) => {
  try {
    const agora = new Date();

    const pacientes = await prisma.paciente.findMany({
      include: {
        empresa: true,
        atendimentos: {
          orderBy: {
            criadoEm: "desc",
          },
          include: {
            guias: {
              include: {
                itens: {
                  include: {
                    procedimento: true,
                  },
                },
                pagamentos: true,
                estornos: true,
              },
            },
          },
        },
      },
      orderBy: {
        nome: "asc",
      },
    });

    const resultado = pacientes.map((paciente) => {
      const atendimentosValidos = paciente.atendimentos.filter(
        (atendimento) =>
          atendimento.organizacaoId === organizacaoAtualId() ||
          atendimento.organizacaoId === null
      );

      const ultimoAtendimento = atendimentosValidos[0] || null;

      const agendamentosFuturos = atendimentosValidos
        .flatMap((atendimento) =>
          atendimento.guias
            .filter((guia) => guia.status !== "CANCELADA")
            .flatMap((guia) =>
              guia.itens
                .filter(
                  (item) =>
                    item.status !== "CANCELADO" &&
                    item.dataAgendamento &&
                    item.dataAgendamento >= agora
                )
                .map((item) => ({
                  atendimentoId: atendimento.id,
                  atendimentoCodigo:
                    atendimento.codigoPublico || "Código pendente",
                  dataAgendamento: item.dataAgendamento,
                  horarioAgendamento: item.horarioAgendamento,
                  tipoAgendamento: item.tipoAgendamento,
                  procedimento: item.procedimento.nome,
                }))
            )
        )
        .sort(
          (a, b) =>
            new Date(a.dataAgendamento!).getTime() -
            new Date(b.dataAgendamento!).getTime()
        );

      const proximoAgendamento =
        agendamentosFuturos[0] || null;

      let possuiPendenciaFinanceira = false;
      let saldoPendente = 0;

      for (const atendimento of atendimentosValidos) {
        for (const guia of atendimento.guias) {
          if (guia.status === "CANCELADA") {
            continue;
          }

          const possuiItemAtivo = guia.itens.some(
            (item) => item.status !== "CANCELADO"
          );

          if (!possuiItemAtivo) {
            continue;
          }

          const valorFinal = Number(guia.valorFinal);

          const totalPago = guia.pagamentos.reduce(
            (total, pagamento) =>
              total + Number(pagamento.valor),
            0
          );

          const totalEstornado = guia.estornos.reduce(
            (total, estorno) =>
              total + Number(estorno.valor),
            0
          );

          const pagoLiquido = Math.max(
            totalPago - totalEstornado,
            0
          );

          const saldo = Math.max(
            valorFinal - pagoLiquido,
            0
          );

          if (
            saldo > 0 ||
            guia.status === "ESTORNO_PENDENTE"
          ) {
            possuiPendenciaFinanceira = true;
            saldoPendente += saldo;
          }
        }
      }

      const cadastro = cadastroPaciente(paciente);
      const percentualCadastro = cadastro.percentual;

      return {
        id: paciente.id,
        codigoPublico: paciente.codigoPublico,
        nome: paciente.nome,
        cpf: paciente.cpf,
        telefone: paciente.telefone,
        email: paciente.email,
        dataNascimento: paciente.dataNascimento,
        beneficioAtivo: paciente.beneficioAtivo,
        empresa: paciente.empresa
          ? {
              id: paciente.empresa.id,
              nome: paciente.empresa.nome,
            }
          : null,
        criadoEm: paciente.criadoEm,
        atualizadoEm: paciente.atualizadoEm,
        cadastro: {
          percentual: percentualCadastro,
          completo: percentualCadastro === 100,
        },
        totalAtendimentos: atendimentosValidos.length,
        ultimoAtendimento: ultimoAtendimento
          ? {
              id: ultimoAtendimento.id,
              codigoPublico:
                ultimoAtendimento.codigoPublico ||
                "Código pendente",
              criadoEm: ultimoAtendimento.criadoEm,
              status:
                statusOperacionalDashboard(ultimoAtendimento),
            }
          : null,
        proximoAgendamento,
        financeiro: {
          possuiPendencia: possuiPendenciaFinanceira,
          saldoPendente,
        },
      };
    });

    return res.json(resultado);
  } catch (erro) {
    console.error(
      "Erro ao carregar visão de pacientes:",
      erro
    );

    return res.status(500).json({
      erro: "Não foi possível carregar os pacientes.",
    });
  }
});

app.get("/pacientes", async (_req, res) => {
  try {
    const pacientes = await prisma.paciente.findMany({
      include: {
        empresa: true,
      },
      orderBy: {
        nome: "asc",
      },
    });

    res.json(pacientes);
  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Não foi possível carregar os pacientes.",
    });
  }
});


function cadastroPaciente(paciente: any) {
  const obrigatorios: Array<[string, boolean]> = [
    ["Nome completo", Boolean(paciente.nome?.trim())],
    ["CPF", Boolean(paciente.cpf?.trim())],
    ["RG", Boolean(paciente.rg?.trim())],
    ["Data de nascimento", Boolean(paciente.dataNascimento)],
    ["Telefone", Boolean(paciente.telefone?.trim())],
    ["Nome da mãe", Boolean(paciente.nomeMae?.trim())],
    ["CEP", Boolean(paciente.cep?.trim())],
    ["Logradouro", Boolean(paciente.logradouro?.trim())],
    ["Número", Boolean(paciente.numeroEndereco?.trim())],
    ["Bairro", Boolean(paciente.bairro?.trim())],
    ["Cidade", Boolean(paciente.cidade?.trim())],
    ["UF", Boolean(paciente.uf?.trim())],
  ];

  let menor = false;
  if (paciente.dataNascimento) {
    const nascimento = new Date(paciente.dataNascimento);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
    menor = idade < 18;
  }

  if (menor) {
    obrigatorios.push([
      "Responsável legal",
      paciente.responsavelLegalEhMae ||
        Boolean(
          paciente.responsavelLegalNome?.trim() &&
          paciente.responsavelLegalCpf?.trim() &&
          paciente.responsavelLegalTelefone?.trim()
        ),
    ]);
  }

  const faltantes = obrigatorios.filter(([, ok]) => !ok).map(([nome]) => nome);
  const preenchidos = obrigatorios.length - faltantes.length;
  return {
    percentual: Math.round((preenchidos / obrigatorios.length) * 100),
    completo: faltantes.length === 0,
    faltantes,
    menor,
  };
}

const vinculoInverso: Record<string, string> = {
  PAI: "FILHO", MAE: "FILHO", FILHO: "PAI", FILHA: "PAI",
  IRMAO: "IRMAO", IRMA: "IRMA", AVO: "NETO", AVO_FEMININO: "NETO",
  NETO: "AVO", NETA: "AVO", MARIDO: "ESPOSA", ESPOSA: "MARIDO",
  COMPANHEIRO: "COMPANHEIRA", COMPANHEIRA: "COMPANHEIRO",
  RESPONSAVEL: "DEPENDENTE", DEPENDENTE: "RESPONSAVEL", OUTRO: "OUTRO",
};

function vinculoRemovivel(tipo: string) {
  return ["MARIDO", "ESPOSA", "COMPANHEIRO", "COMPANHEIRA"].includes(tipo);
}

// ======================================================
// PACIENTE - FICHA COMPLETA
// ======================================================

app.get("/pacientes/:id", async (req, res) => {
  try {
    const pacienteId = Number(req.params.id);
    if (!Number.isInteger(pacienteId) || pacienteId <= 0) return res.status(400).json({ erro: "Paciente inválido." });

    const paciente = await prisma.paciente.findUnique({
      where: { id: pacienteId },
      include: {
        empresa: true,
        criadoPor: { select: { id: true, nome: true } },
        vinculosComoOrigem: { where: { ativo: true }, include: { pacienteDestino: true }, orderBy: { criadoEm: "asc" } },
        atendimentos: {
          where: { OR: [{ organizacaoId: organizacaoAtualId() }, { organizacaoId: null }] },
          orderBy: { criadoEm: "desc" },
          include: { guias: { include: { clinica: true, itens: { include: { procedimento: true } }, pagamentos: true, estornos: true } } },
        },
      },
    });
    if (!paciente) return res.status(404).json({ erro: "Paciente não encontrado." });

    const agora = new Date();
    const atendimentos = paciente.atendimentos.map((atendimento) => ({
      id: atendimento.id,
      codigoPublico: atendimento.codigoPublico || "Código pendente",
      criadoEm: atendimento.criadoEm,
      status: statusOperacionalDashboard(atendimento),
      guias: atendimento.guias.map((guia) => {
        const totalPago = guia.pagamentos.reduce((t, p) => t + Number(p.valor), 0);
        const totalEstornado = guia.estornos.reduce((t, e) => t + Number(e.valor), 0);
        const pagoLiquido = Math.max(totalPago - totalEstornado, 0);
        const valorFinal = Number(guia.valorFinal);
        return {
          id: guia.id, codigoPublico: guia.codigoPublico || "Código pendente", status: guia.status,
          clinica: { id: guia.clinica.id, nome: guia.clinica.nome }, valorFinal, pagoLiquido,
          saldo: Math.max(valorFinal - pagoLiquido, 0),
          itens: guia.itens.map((item) => ({ id: item.id, status: item.status, procedimento: { id: item.procedimento.id, nome: item.procedimento.nome }, tipoAgendamento: item.tipoAgendamento, dataAgendamento: item.dataAgendamento, horarioAgendamento: item.horarioAgendamento })),
        };
      }),
    }));

    const agendamentosFuturos = atendimentos.flatMap((a) => a.guias.flatMap((g) => g.itens.filter((i) => i.status !== "CANCELADO" && i.dataAgendamento && new Date(i.dataAgendamento) >= agora).map((i) => ({ atendimentoId: a.id, atendimentoCodigo: a.codigoPublico, guiaId: g.id, guiaCodigo: g.codigoPublico, clinica: g.clinica.nome, procedimento: i.procedimento.nome, tipoAgendamento: i.tipoAgendamento, dataAgendamento: i.dataAgendamento, horarioAgendamento: i.horarioAgendamento })))).sort((a,b) => new Date(a.dataAgendamento!).getTime()-new Date(b.dataAgendamento!).getTime());

    let saldoPendente = 0; let possuiEstornoPendente = false;
    for (const a of atendimentos) for (const g of a.guias) if (g.status !== "CANCELADA") { saldoPendente += g.saldo; if (g.status === "ESTORNO_PENDENTE") possuiEstornoPendente = true; }

    return res.json({
      id: paciente.id, codigoPublico: paciente.codigoPublico, nome: paciente.nome, nomeSocial: paciente.nomeSocial,
      cpf: paciente.cpf, rg: paciente.rg, telefone: paciente.telefone, telefoneSecundario: paciente.telefoneSecundario,
      email: paciente.email, dataNascimento: paciente.dataNascimento, nomeMae: paciente.nomeMae,
      cep: paciente.cep, logradouro: paciente.logradouro, numeroEndereco: paciente.numeroEndereco,
      complementoEndereco: paciente.complementoEndereco, bairro: paciente.bairro, cidade: paciente.cidade, uf: paciente.uf,
      responsavelLegalEhMae: paciente.responsavelLegalEhMae, responsavelLegalNome: paciente.responsavelLegalNome,
      responsavelLegalCpf: paciente.responsavelLegalCpf, responsavelLegalTelefone: paciente.responsavelLegalTelefone,
      responsavelLegalParentesco: paciente.responsavelLegalParentesco,
      beneficioAtivo: paciente.beneficioAtivo, empresa: paciente.empresa ? { id: paciente.empresa.id, nome: paciente.empresa.nome } : null,
      criadoPor: paciente.criadoPor, criadoEm: paciente.criadoEm, atualizadoEm: paciente.atualizadoEm,
      cadastro: cadastroPaciente(paciente),
      familiares: paciente.vinculosComoOrigem.map((v) => ({ id: v.id, tipo: v.tipo, removivel: v.removivel, paciente: { id: v.pacienteDestino.id, codigoPublico: v.pacienteDestino.codigoPublico, nome: v.pacienteDestino.nome, nomeSocial: v.pacienteDestino.nomeSocial, cpf: v.pacienteDestino.cpf } })),
      resumo: { totalAtendimentos: atendimentos.length, totalGuias: atendimentos.reduce((t,a)=>t+a.guias.length,0), proximosAgendamentos: agendamentosFuturos.length, saldoPendente, possuiEstornoPendente },
      proximoAgendamento: agendamentosFuturos[0] || null, agendamentosFuturos, atendimentos,
    });
  } catch (erro) { console.error("Erro ao carregar ficha do paciente:", erro); return res.status(500).json({ erro: "Não foi possível carregar a ficha do paciente." }); }
});

app.patch("/pacientes/:id", async (req, res) => {
  try {
    const pacienteId = Number(req.params.id);
    const b = req.body;
    if (!Number.isInteger(pacienteId) || pacienteId <= 0) return res.status(400).json({ erro: "Paciente inválido." });
    if (!b.nome?.trim() || !b.cpf?.trim() || !b.telefone?.trim()) return res.status(400).json({ erro: "Nome, CPF e telefone são obrigatórios." });
    const cpf = b.cpf.replace(/\D/g, "");
    const duplicado = await prisma.paciente.findFirst({ where: { cpf, id: { not: pacienteId } } });
    if (duplicado) return res.status(409).json({ erro: "Já existe outro paciente cadastrado com este CPF." });
    const limpa = (v: unknown) => typeof v === "string" && v.trim() ? v.trim() : null;
    const paciente = await prisma.paciente.update({ where: { id: pacienteId }, data: {
      nome: b.nome.trim().replace(/\s+/g," ").toUpperCase(), nomeSocial: limpa(b.nomeSocial), cpf,
      rg: limpa(b.rg), telefone: b.telefone.replace(/\D/g,""), telefoneSecundario: limpa(b.telefoneSecundario)?.replace(/\D/g,""),
      email: limpa(b.email)?.toLowerCase(), dataNascimento: b.dataNascimento ? new Date(`${b.dataNascimento}T12:00:00`) : null,
      nomeMae: limpa(b.nomeMae)?.toUpperCase(), cep: limpa(b.cep)?.replace(/\D/g,""), logradouro: limpa(b.logradouro),
      numeroEndereco: limpa(b.numeroEndereco), complementoEndereco: limpa(b.complementoEndereco), bairro: limpa(b.bairro),
      cidade: limpa(b.cidade), uf: limpa(b.uf)?.toUpperCase(), responsavelLegalEhMae: Boolean(b.responsavelLegalEhMae),
      responsavelLegalNome: b.responsavelLegalEhMae ? null : limpa(b.responsavelLegalNome)?.toUpperCase(),
      responsavelLegalCpf: b.responsavelLegalEhMae ? null : limpa(b.responsavelLegalCpf)?.replace(/\D/g,""),
      responsavelLegalTelefone: b.responsavelLegalEhMae ? null : limpa(b.responsavelLegalTelefone)?.replace(/\D/g,""),
      responsavelLegalParentesco: b.responsavelLegalEhMae ? "MÃE" : limpa(b.responsavelLegalParentesco),
    }});
    return res.json({ paciente, cadastro: cadastroPaciente(paciente) });
  } catch (erro) { console.error("Erro ao atualizar paciente:", erro); return res.status(500).json({ erro: "Não foi possível atualizar o paciente." }); }
});

app.post("/pacientes/:id/familiares", async (req, res) => {
  try {
    const origemId = Number(req.params.id); const destinoId = Number(req.body.pacienteId); const tipo = String(req.body.tipo || "");
    if (!origemId || !destinoId || origemId === destinoId) return res.status(400).json({ erro: "Vínculo familiar inválido." });
    if (!vinculoInverso[tipo]) return res.status(400).json({ erro: "Tipo de vínculo inválido." });
    const [origem,destino] = await Promise.all([prisma.paciente.findUnique({where:{id:origemId}}), prisma.paciente.findUnique({where:{id:destinoId}})]);
    if (!origem || !destino) return res.status(404).json({ erro: "Paciente não encontrado." });
    const inverso = vinculoInverso[tipo];
    await prisma.$transaction(async (tx) => {
      await tx.vinculoFamiliar.upsert({ where: { pacienteOrigemId_pacienteDestinoId_tipo: { pacienteOrigemId: origemId, pacienteDestinoId: destinoId, tipo: tipo as any } }, update: { ativo: true, encerradoEm: null, removivel: vinculoRemovivel(tipo) }, create: { pacienteOrigemId: origemId, pacienteDestinoId: destinoId, tipo: tipo as any, removivel: vinculoRemovivel(tipo) } });
      await tx.vinculoFamiliar.upsert({ where: { pacienteOrigemId_pacienteDestinoId_tipo: { pacienteOrigemId: destinoId, pacienteDestinoId: origemId, tipo: inverso as any } }, update: { ativo: true, encerradoEm: null, removivel: vinculoRemovivel(inverso) }, create: { pacienteOrigemId: destinoId, pacienteDestinoId: origemId, tipo: inverso as any, removivel: vinculoRemovivel(inverso) } });
    });
    return res.status(201).json({ ok: true });
  } catch (erro) { console.error("Erro ao vincular familiar:", erro); return res.status(500).json({ erro: "Não foi possível criar o vínculo familiar." }); }
});

app.delete("/pacientes/:id/familiares/:vinculoId", async (req, res) => {
  try {
    const pacienteId = Number(req.params.id); const vinculoId = Number(req.params.vinculoId);
    const vinculo = await prisma.vinculoFamiliar.findFirst({ where: { id: vinculoId, pacienteOrigemId: pacienteId }, include: { pacienteDestino: true } });
    if (!vinculo) return res.status(404).json({ erro: "Vínculo não encontrado." });
    if (!vinculo.removivel) return res.status(403).json({ erro: "Este vínculo familiar é permanente e não pode ser retirado." });
    const inverso = vinculoInverso[vinculo.tipo];
    await prisma.$transaction([
      prisma.vinculoFamiliar.update({ where: { id: vinculo.id }, data: { ativo: false, encerradoEm: new Date() } }),
      prisma.vinculoFamiliar.updateMany({ where: { pacienteOrigemId: vinculo.pacienteDestinoId, pacienteDestinoId: pacienteId, tipo: inverso as any, ativo: true }, data: { ativo: false, encerradoEm: new Date() } }),
    ]);
    return res.json({ ok: true });
  } catch (erro) { console.error("Erro ao encerrar vínculo:", erro); return res.status(500).json({ erro: "Não foi possível encerrar o vínculo." }); }
});

// ======================================================
// CADASTRAR PACIENTE
// ======================================================
app.post("/pacientes", async (req, res) => {
  try {
    const { nome, cpf, telefone, email, dataNascimento } = req.body;
    if (!nome?.trim() || !cpf?.trim() || !telefone?.trim()) return res.status(400).json({ erro: "Nome, CPF e telefone são obrigatórios." });
    const cpfLimpo = cpf.replace(/\D/g, ""); const telefoneLimpo = telefone.replace(/\D/g, "");
    const pacienteExistente = await prisma.paciente.findUnique({ where: { cpf: cpfLimpo } });
    if (pacienteExistente) return res.status(409).json({ erro: "Já existe um paciente cadastrado com este CPF." });
    const codigoPublico = await gerarCodigoPublicoUnico("PAC");
    const paciente = await prisma.paciente.create({ data: { codigoPublico, nome: nome.trim().replace(/\s+/g," ").toUpperCase(), cpf: cpfLimpo, telefone: telefoneLimpo, email: email?.trim() ? email.trim().toLowerCase() : null, dataNascimento: dataNascimento ? new Date(`${dataNascimento}T12:00:00`) : null, beneficioAtivo: false } });
    return res.status(201).json(paciente);
  } catch (erro) { console.error("Erro ao cadastrar paciente:", erro); return res.status(500).json({ erro: "Não foi possível cadastrar o paciente." }); }
});

// ======================================================
// CRIAR ATENDIMENTO COMPLETO
// ======================================================

app.post("/atendimentos", async (req, res) => {
  try {
    const {
      pacienteId,
      etapaAtual,
      guias = [],
    } = req.body;

    if (!pacienteId) {
      return res.status(400).json({
        erro: "Paciente é obrigatório.",
      });
    }

    const paciente = await prisma.paciente.findUnique({
      where: {
        id: Number(pacienteId),
      },
    });

    if (!paciente) {
      return res.status(404).json({
        erro: "Paciente não encontrado.",
      });
    }

    const codigoPublicoAtendimento =
      await gerarCodigoPublicoUnico("ATD");
    const configuracoesOrganizacao = await obterConfiguracoesOrganizacaoAtual();
    const validadeGuiaMesesPadrao = normalizarValidadeGuiaMeses(
      configuracoesOrganizacao.validadeGuiaMesesPadrao
    );

    const atendimento = await prisma.$transaction(async (tx) => {
      const novoAtendimento = await tx.atendimento.create({
        data: {
          codigoPublico: codigoPublicoAtendimento,
          pacienteId: Number(pacienteId),
          organizacaoId: organizacaoAtualId(),
          criadoPorId: usuarioAtualId(),
          etapaAtual: Number(etapaAtual) || 1,
          status: "EM_ANDAMENTO",
        },
      });

      for (const guiaRecebida of guias) {
        const valorFinal = Number(guiaRecebida.valorFinal) || 0;
        const valorPago = Number(guiaRecebida.valorPago) || 0;
        const valorEstornado = Number(guiaRecebida.valorEstornado) || 0;

        const statusCalculado = calcularStatusGuia(
          guiaRecebida.status,
          valorFinal,
          valorPago,
          valorEstornado
        );

        const codigoPublicoGuia =
          await gerarCodigoPublicoUnico("VCH");

        const clinicaIdGuia = Number(guiaRecebida.clinicaId);
        const unidadeClinicaIdGuia = guiaRecebida.unidadeClinicaId
          ? Number(guiaRecebida.unidadeClinicaId)
          : null;

        if (unidadeClinicaIdGuia) {
          const unidadeValida = await tx.unidadeClinica.findFirst({
            where: {
              id: unidadeClinicaIdGuia,
              clinicaId: clinicaIdGuia,
              ativo: true,
            },
            select: { id: true },
          });

          if (!unidadeValida) {
            throw new Error("UNIDADE_CLINICA_INVALIDA");
          }
        }

        const guia = await tx.guia.create({
          data: {
            codigoPublico: codigoPublicoGuia,
            atendimentoId: novoAtendimento.id,
            clinicaId: clinicaIdGuia,
            unidadeClinicaId: unidadeClinicaIdGuia,
            organizacaoId: organizacaoAtualId(),
            geradaPorId: usuarioAtualId(),

            status: statusCalculado,

            subtotal: Number(guiaRecebida.subtotal) || 0,
            desconto: Number(guiaRecebida.desconto) || 0,
            beneficio: Number(guiaRecebida.beneficio) || 0,
            valorFinal,

            emitidaEm: new Date(),
            validadeAte: calcularValidadeGuia(new Date(), validadeGuiaMesesPadrao),
          },
        });

        for (const item of guiaRecebida.itens || []) {
          await tx.itemGuia.create({
            data: {
              guiaId: guia.id,
              procedimentoId: Number(item.procedimentoId),

              status: item.cancelado
                ? "CANCELADO"
                : "ATIVO",

              valorPaciente: Number(item.valorPaciente) || 0,
              valorRepasse: Number(item.valorRepasse) || 0,

              tipoAgendamento:
                item.tipoAgendamento === "horario"
                  ? "HORARIO"
                  : item.tipoAgendamento === "ordem"
                    ? "ORDEM_CHEGADA"
                    : null,

              dataAgendamento: item.dataAgendamento
                ? new Date(`${item.dataAgendamento}T12:00:00`)
                : null,

              horarioAgendamento:
                item.horarioAgendamento || null,

              canceladoEm: item.cancelado
                ? new Date()
                : null,

              motivoCancelamento: item.cancelado
                ? "Cancelado durante o atendimento"
                : null,
            },
          });
        }

        const todosItensCancelados =
          (guiaRecebida.itens || []).length > 0 &&
          (guiaRecebida.itens || []).every(
            (item: { cancelado?: boolean }) => !!item.cancelado
          );

        if (valorPago > 0 && todosItensCancelados) {
          throw new Error("PAGAMENTO_GUIA_CANCELADA");
        }

        if (valorPago > 0) {
          await tx.pagamento.create({
            data: {
              guiaId: guia.id,
              valor: valorPago,
              forma: mapearFormaPagamento(guiaRecebida.formaPagamento),
              observacao:
                guiaRecebida.observacaoPagamento ||
                "Pagamento registrado durante criação inicial do atendimento.",
            },
          });
        }

        if (valorEstornado > 0) {
          await registrarEstornoVinculado(
            tx,
            guia.id,
            valorEstornado,
            mapearFormaPagamento(guiaRecebida.formaEstorno),
            guiaRecebida.observacaoEstorno ||
              "Estorno registrado durante criação inicial do atendimento."
          );
        }
      }

      return tx.atendimento.findUnique({
        where: {
          id: novoAtendimento.id,
        },
        include: {
          paciente: true,
          guias: {
            include: {
              clinica: true,
              unidadeClinica: true,
              itens: {
                include: {
                  procedimento: true,
                },
              },
              pagamentos: true,
              estornos: true,
            },
          },
        },
      });
    });

    return res.status(201).json(atendimento);
  } catch (erro) {
    console.error("Erro ao criar atendimento:", erro);

    if (
      erro instanceof Error &&
      erro.message === "PAGAMENTO_GUIA_CANCELADA"
    ) {
      return res.status(400).json({
        erro: "Não é permitido registrar pagamento em uma guia com todos os procedimentos cancelados.",
      });
    }

    if (
      erro instanceof Error &&
      erro.message === "ESTORNO_SUPERIOR_AO_PAGO"
    ) {
      return res.status(400).json({
        erro: "O valor do estorno não pode ser maior que o total disponível para estorno.",
      });
    }

    if (
      erro instanceof Error &&
      erro.message === "UNIDADE_CLINICA_INVALIDA"
    ) {
      return res.status(400).json({
        erro: "A unidade selecionada não pertence à clínica ou está inativa.",
      });
    }

    return res.status(500).json({
      erro: "Não foi possível salvar o atendimento.",
    });
  }
});

// ======================================================
// ATUALIZAR ATENDIMENTO EXISTENTE
// ======================================================

app.put("/atendimentos/:id", async (req, res) => {
  try {
    const atendimentoId = Number(req.params.id);

    if (!atendimentoId) {
      return res.status(400).json({
        erro: "ID do atendimento inválido.",
      });
    }

    const {
      pacienteId,
      etapaAtual,
      guias = [],
    } = req.body;

    const atendimentoExistente =
      await prisma.atendimento.findUnique({
        where: {
          id: atendimentoId,
        },
        include: {
          guias: {
            include: {
              itens: true,
              pagamentos: true,
              estornos: true,
            },
          },
        },
      });

    if (!atendimentoExistente) {
      return res.status(404).json({
        erro: "Atendimento não encontrado.",
      });
    }

    if (atendimentoExistente.status === "CANCELADO") {
      return res.status(409).json({
        erro: "Este atendimento está cancelado e não pode mais ser alterado.",
      });
    }

    const configuracoesOrganizacao = await obterConfiguracoesOrganizacaoAtual();
    const validadeGuiaMesesPadrao = normalizarValidadeGuiaMeses(
      configuracoesOrganizacao.validadeGuiaMesesPadrao
    );

    const atendimentoAtualizado =
      await prisma.$transaction(async (tx) => {
        const codigoPublicoAtendimento =
          atendimentoExistente.codigoPublico ||
          (await gerarCodigoPublicoUnico("ATD"));

        await tx.atendimento.update({
          where: {
            id: atendimentoId,
          },
          data: {
            codigoPublico: codigoPublicoAtendimento,

            pacienteId: pacienteId
              ? Number(pacienteId)
              : atendimentoExistente.pacienteId,

            organizacaoId:
              atendimentoExistente.organizacaoId || organizacaoAtualId(),

            criadoPorId:
              atendimentoExistente.criadoPorId || usuarioAtualId(),

            etapaAtual:
              Number(etapaAtual) ||
              atendimentoExistente.etapaAtual,
          },
        });

        const guiasUtilizadas = new Set<number>();

        for (const guiaRecebida of guias) {
          const clinicaId =
            Number(guiaRecebida.clinicaId);
          const unidadeClinicaId = guiaRecebida.unidadeClinicaId
            ? Number(guiaRecebida.unidadeClinicaId)
            : null;

          if (unidadeClinicaId) {
            const unidadeValida = await tx.unidadeClinica.findFirst({
              where: {
                id: unidadeClinicaId,
                clinicaId,
                ativo: true,
              },
              select: { id: true },
            });

            if (!unidadeValida) {
              throw new Error("UNIDADE_CLINICA_INVALIDA");
            }
          }

          // Reaproveita somente a guia da mesma clínica e da mesma unidade.
          const guiaExistente =
            atendimentoExistente.guias.find(
              (guia) =>
                guia.clinicaId === clinicaId &&
                (guia.unidadeClinicaId || null) === unidadeClinicaId &&
                !guiasUtilizadas.has(guia.id)
            );

          let guiaId: number;

          if (guiaExistente) {
            guiaId = guiaExistente.id;
            guiasUtilizadas.add(guiaExistente.id);

            const codigoPublicoGuia =
              guiaExistente.codigoPublico ||
              (await gerarCodigoPublicoUnico("VCH"));

            await tx.guia.update({
              where: {
                id: guiaExistente.id,
              },
              data: {
                codigoPublico: codigoPublicoGuia,

                clinicaId,
                unidadeClinicaId,

                organizacaoId:
                  guiaExistente.organizacaoId || organizacaoAtualId(),

                geradaPorId:
                  guiaExistente.geradaPorId || usuarioAtualId(),

                emitidaEm:
                  guiaExistente.emitidaEm || new Date(),

                validadeAte:
                  guiaExistente.validadeAte ||
                  calcularValidadeGuia(new Date(), validadeGuiaMesesPadrao),

                status: calcularStatusGuia(
                  guiaRecebida.status,
                  Number(guiaRecebida.valorFinal) || 0,
                  Number(guiaRecebida.valorPago) || 0,
                  Number(guiaRecebida.valorEstornado) || 0
                ),

                subtotal:
                  Number(guiaRecebida.subtotal) || 0,

                desconto:
                  Number(guiaRecebida.desconto) || 0,

                beneficio:
                  Number(guiaRecebida.beneficio) || 0,

                valorFinal:
                  Number(guiaRecebida.valorFinal) || 0,
              },
            });

            const procedimentosRecebidos =
              new Set<number>();

            for (const item of guiaRecebida.itens || []) {
              const procedimentoId =
                Number(item.procedimentoId);

              procedimentosRecebidos.add(
                procedimentoId
              );

              const itemExistente =
                guiaExistente.itens.find(
                  (itemBanco) =>
                    itemBanco.procedimentoId ===
                    procedimentoId
                );

              const dadosItem = {
                status: item.cancelado
                  ? ("CANCELADO" as const)
                  : ("ATIVO" as const),

                valorPaciente:
                  Number(item.valorPaciente) || 0,

                valorRepasse:
                  Number(item.valorRepasse) || 0,

                tipoAgendamento:
                  item.tipoAgendamento === "horario"
                    ? ("HORARIO" as const)
                    : item.tipoAgendamento === "ordem"
                      ? ("ORDEM_CHEGADA" as const)
                      : null,

                dataAgendamento:
                  item.dataAgendamento
                    ? new Date(
                        `${item.dataAgendamento}T12:00:00`
                      )
                    : null,

                horarioAgendamento:
                  item.horarioAgendamento || null,

                canceladoEm: item.cancelado
                  ? new Date()
                  : null,

                motivoCancelamento:
                  item.cancelado
                    ? "Cancelado durante o atendimento"
                    : null,
              };

              if (itemExistente) {
                await tx.itemGuia.update({
                  where: {
                    id: itemExistente.id,
                  },
                  data: dadosItem,
                });
              } else {
                await tx.itemGuia.create({
                  data: {
                    guiaId,
                    procedimentoId,
                    ...dadosItem,
                  },
                });
              }
            }

            // Procedimentos que existiam e não vieram mais
            // não são apagados: ficam cancelados.
            for (const itemBanco of guiaExistente.itens) {
              if (
                !procedimentosRecebidos.has(
                  itemBanco.procedimentoId
                )
              ) {
                await tx.itemGuia.update({
                  where: {
                    id: itemBanco.id,
                  },
                  data: {
                    status: "CANCELADO",
                    canceladoEm: new Date(),
                    motivoCancelamento:
                      "Removido durante alteração do atendimento",
                  },
                });
              }
            }

            // Pagamento recebido pelo frontend é o TOTAL.
            // Criamos somente a diferença ainda não registrada.
            const totalPagoBanco =
              guiaExistente.pagamentos.reduce(
                (total, pagamento) =>
                  total + Number(pagamento.valor),
                0
              );

            const totalPagoTela =
              Number(guiaRecebida.valorPago) || 0;

            const diferencaPagamento =
              totalPagoTela - totalPagoBanco;

            const todosItensCancelados =
              (guiaRecebida.itens || []).length > 0 &&
              (guiaRecebida.itens || []).every(
                (item: { cancelado?: boolean }) => !!item.cancelado
              );

            if (diferencaPagamento > 0 && todosItensCancelados) {
              throw new Error("PAGAMENTO_GUIA_CANCELADA");
            }

            if (diferencaPagamento > 0) {
              await tx.pagamento.create({
                data: {
                  guiaId,
                  valor: diferencaPagamento,
                  forma: mapearFormaPagamento(guiaRecebida.formaPagamento),
                  observacao:
                    guiaRecebida.observacaoPagamento ||
                    "Pagamento acrescentado durante atualização do atendimento.",
                },
              });
            }

            const totalEstornadoBanco =
              guiaExistente.estornos.reduce(
                (total, estorno) =>
                  total + Number(estorno.valor),
                0
              );

            const totalEstornadoTela =
              Number(
                guiaRecebida.valorEstornado
              ) || 0;

            const diferencaEstorno =
              totalEstornadoTela -
              totalEstornadoBanco;

            if (diferencaEstorno > 0) {
              await registrarEstornoVinculado(
                tx,
                guiaId,
                diferencaEstorno,
                mapearFormaPagamento(guiaRecebida.formaEstorno),
                guiaRecebida.observacaoEstorno ||
                  "Estorno acrescentado durante atualização do atendimento."
              );
            }

            // Recalcula o status financeiro após qualquer alteração na guia
            await recalcularStatusFinanceiroGuia(
                        tx,
              guiaId
            );

            } else {  

            // Guia nova dentro de atendimento existente.
            const codigoPublicoNovaGuia =
              await gerarCodigoPublicoUnico("VCH");

            const novaGuia = await tx.guia.create({
              data: {
                codigoPublico: codigoPublicoNovaGuia,
                atendimentoId,
                clinicaId,
                unidadeClinicaId,
                organizacaoId: organizacaoAtualId(),
                geradaPorId: usuarioAtualId(),
                emitidaEm: new Date(),
                validadeAte: calcularValidadeGuia(new Date(), validadeGuiaMesesPadrao),

                status: calcularStatusGuia(
                  guiaRecebida.status,
                  Number(guiaRecebida.valorFinal) || 0,
                  Number(guiaRecebida.valorPago) || 0,
                  Number(guiaRecebida.valorEstornado) || 0
                ),

                subtotal:
                  Number(guiaRecebida.subtotal) || 0,

                desconto:
                  Number(guiaRecebida.desconto) || 0,

                beneficio:
                  Number(guiaRecebida.beneficio) || 0,

                valorFinal:
                  Number(guiaRecebida.valorFinal) || 0,
              },
            });

            guiaId = novaGuia.id;
            guiasUtilizadas.add(novaGuia.id);

            for (const item of guiaRecebida.itens || []) {
              await tx.itemGuia.create({
                data: {
                  guiaId,
                  procedimentoId:
                    Number(item.procedimentoId),

                  status: item.cancelado
                    ? "CANCELADO"
                    : "ATIVO",

                  valorPaciente:
                    Number(item.valorPaciente) || 0,

                  valorRepasse:
                    Number(item.valorRepasse) || 0,

                  tipoAgendamento:
                    item.tipoAgendamento === "horario"
                      ? "HORARIO"
                      : item.tipoAgendamento === "ordem"
                        ? "ORDEM_CHEGADA"
                        : null,

                  dataAgendamento:
                    item.dataAgendamento
                      ? new Date(
                          `${item.dataAgendamento}T12:00:00`
                        )
                      : null,

                  horarioAgendamento:
                    item.horarioAgendamento || null,

                  canceladoEm: item.cancelado
                    ? new Date()
                    : null,

                  motivoCancelamento:
                    item.cancelado
                      ? "Cancelado durante o atendimento"
                      : null,
                },
              });
            }

            const valorPago =
              Number(guiaRecebida.valorPago) || 0;

            const todosItensCanceladosNovaGuia =
              (guiaRecebida.itens || []).length > 0 &&
              (guiaRecebida.itens || []).every(
                (item: { cancelado?: boolean }) => !!item.cancelado
              );

            if (valorPago > 0 && todosItensCanceladosNovaGuia) {
              throw new Error("PAGAMENTO_GUIA_CANCELADA");
            }

            if (valorPago > 0) {
              await tx.pagamento.create({
                data: {
                  guiaId,
                  valor: valorPago,
                  forma: mapearFormaPagamento(guiaRecebida.formaPagamento),
                  observacao:
                    guiaRecebida.observacaoPagamento ||
                    "Pagamento registrado durante atualização do atendimento.",
                },
              });
            }

            const valorEstornado =
              Number(
                guiaRecebida.valorEstornado
              ) || 0;

            if (valorEstornado > 0) {
              await registrarEstornoVinculado(
                tx,
                guiaId,
                valorEstornado,
                mapearFormaPagamento(guiaRecebida.formaEstorno),
                guiaRecebida.observacaoEstorno ||
                  "Estorno registrado durante atualização do atendimento."
              );
            }
          }
        }

        // Guias antigas que desapareceram da tela não são excluídas.
        // São mantidas no histórico como canceladas.
        for (const guiaBanco of atendimentoExistente.guias) {
          if (!guiasUtilizadas.has(guiaBanco.id)) {
            await tx.guia.update({
              where: {
                id: guiaBanco.id,
              },
              data: {
                status: "CANCELADA",
              },
            });

            await tx.itemGuia.updateMany({
              where: {
                guiaId: guiaBanco.id,
                status: {
                  not: "CANCELADO",
                },
              },
              data: {
                status: "CANCELADO",
                canceladoEm: new Date(),
                motivoCancelamento:
                  "Guia cancelada durante alteração do atendimento",
              },
            });
          }
        }

        return tx.atendimento.findUnique({
          where: {
            id: atendimentoId,
          },
          include: {
            paciente: {
              include: {
                empresa: true,
              },
            },
            guias: {
              include: {
                clinica: true,
              unidadeClinica: true,
                itens: {
                  include: {
                    procedimento: true,
                  },
                },
                pagamentos: true,
                estornos: true,
              },
            },
          },
        });
      });

    return res.json(atendimentoAtualizado);
  } catch (erro) {
    console.error(
      "Erro ao atualizar atendimento:",
      erro
    );

    if (
      erro instanceof Error &&
      erro.message === "PAGAMENTO_GUIA_CANCELADA"
    ) {
      return res.status(400).json({
        erro: "Não é permitido registrar pagamento em uma guia com todos os procedimentos cancelados.",
      });
    }

    if (
      erro instanceof Error &&
      erro.message === "ESTORNO_SUPERIOR_AO_PAGO"
    ) {
      return res.status(400).json({
        erro: "O valor do estorno não pode ser maior que o total disponível para estorno.",
      });
    }

    if (
      erro instanceof Error &&
      erro.message === "UNIDADE_CLINICA_INVALIDA"
    ) {
      return res.status(400).json({
        erro: "A unidade selecionada não pertence à clínica ou está inativa.",
      });
    }

    return res.status(500).json({
      erro: "Não foi possível atualizar o atendimento.",
    });
  }
});

// ======================================================
// CANCELAR ATENDIMENTO
// ======================================================

app.post("/atendimentos/:id/cancelar", async (req, res) => {
  try {
    const atendimentoId = Number(req.params.id);
    const motivo =
      typeof req.body?.motivo === "string"
        ? req.body.motivo.trim()
        : "";

    if (!Number.isInteger(atendimentoId) || atendimentoId <= 0) {
      return res.status(400).json({ erro: "Atendimento inválido." });
    }

    if (motivo.length < 3) {
      return res.status(400).json({
        erro: "Informe o motivo do cancelamento.",
      });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const atendimento = await tx.atendimento.findUnique({
        where: { id: atendimentoId },
        include: {
          guias: {
            include: {
              itens: true,
              pagamentos: true,
              estornos: true,
            },
          },
        },
      });

      if (!atendimento) {
        throw new Error("ATENDIMENTO_NAO_ENCONTRADO");
      }

      if (atendimento.status === "CANCELADO") {
        throw new Error("ATENDIMENTO_JA_CANCELADO");
      }

      if (atendimento.status === "CONCLUIDO") {
        throw new Error("ATENDIMENTO_CONCLUIDO");
      }

      const possuiSaldoPago = atendimento.guias.some((guia) => {
        const totalPago = guia.pagamentos.reduce(
          (total, pagamento) => total + Number(pagamento.valor),
          0
        );
        const totalEstornado = guia.estornos.reduce(
          (total, estorno) => total + Number(estorno.valor),
          0
        );
        return totalPago - totalEstornado > 0.009;
      });

      if (possuiSaldoPago) {
        throw new Error("ATENDIMENTO_COM_VALOR_PAGO");
      }

      const agora = new Date();

      for (const guia of atendimento.guias) {
        await tx.itemGuia.updateMany({
          where: {
            guiaId: guia.id,
            status: { not: "CANCELADO" },
          },
          data: {
            status: "CANCELADO",
            canceladoEm: agora,
            motivoCancelamento: motivo,
          },
        });

        await tx.guia.update({
          where: { id: guia.id },
          data: { status: "CANCELADA" },
        });
      }

      return tx.atendimento.update({
        where: { id: atendimentoId },
        data: {
          status: "CANCELADO",
          canceladoEm: agora,
          motivoCancelamento: motivo,
        },
        include: {
          paciente: true,
          guias: {
            include: {
              clinica: true,
              unidadeClinica: true,
              itens: { include: { procedimento: true } },
            },
          },
        },
      });
    });

    return res.json(resultado);
  } catch (erro) {
    console.error("Erro ao cancelar atendimento:", erro);

    const codigo = erro instanceof Error ? erro.message : "";

    if (codigo === "ATENDIMENTO_NAO_ENCONTRADO") {
      return res.status(404).json({ erro: "Atendimento não encontrado." });
    }
    if (codigo === "ATENDIMENTO_JA_CANCELADO") {
      return res.status(409).json({ erro: "Este atendimento já está cancelado." });
    }
    if (codigo === "ATENDIMENTO_CONCLUIDO") {
      return res.status(409).json({
        erro: "Um atendimento concluído não pode ser cancelado por esta ação.",
      });
    }
    if (codigo === "ATENDIMENTO_COM_VALOR_PAGO") {
      return res.status(409).json({
        erro: "Este atendimento possui valor recebido. Registre os estornos necessários antes de cancelar o atendimento.",
      });
    }

    return res.status(500).json({
      erro: "Não foi possível cancelar o atendimento.",
    });
  }
});

// ======================================================
// ORÇAMENTOS - V1
// ======================================================

async function validarItemOrcamentoRecebido(itemRecebido: any) {
  const procedimentoId = Number(itemRecebido?.procedimentoId);
  const clinicaId = Number(itemRecebido?.clinicaId);
  const unidadeClinicaId =
    itemRecebido?.unidadeClinicaId === null ||
    itemRecebido?.unidadeClinicaId === undefined ||
    itemRecebido?.unidadeClinicaId === ""
      ? null
      : Number(itemRecebido.unidadeClinicaId);

  if (!Number.isInteger(procedimentoId) || procedimentoId <= 0) {
    throw new Error("PROCEDIMENTO_INVALIDO");
  }

  if (!Number.isInteger(clinicaId) || clinicaId <= 0) {
    throw new Error("CLINICA_INVALIDA");
  }

  if (
    unidadeClinicaId !== null &&
    (!Number.isInteger(unidadeClinicaId) || unidadeClinicaId <= 0)
  ) {
    throw new Error("UNIDADE_INVALIDA");
  }

  const [procedimento, precoBase] = await Promise.all([
    prisma.procedimento.findFirst({
      where: {
        id: procedimentoId,
        ativo: true,
      },
      select: {
        id: true,
        nome: true,
      },
    }),
    prisma.precoProcedimentoClinica.findFirst({
      where: {
        clinicaId,
        procedimentoId,
        ativo: true,
        clinica: {
          ativo: true,
        },
      },
      select: {
        valorPaciente: true,
        valorRepasse: true,
      },
    }),
  ]);

  if (!procedimento) {
    throw new Error("PROCEDIMENTO_INATIVO");
  }

  if (!precoBase) {
    const erro = new Error("PRECO_CLINICA_INDISPONIVEL");
    (erro as any).procedimentoNome = procedimento.nome;
    throw erro;
  }

  let valorPaciente = Number(precoBase.valorPaciente);
  let valorRepasse = Number(precoBase.valorRepasse);

  if (unidadeClinicaId !== null) {
    const unidade = await prisma.unidadeClinica.findFirst({
      where: {
        id: unidadeClinicaId,
        clinicaId,
        ativo: true,
      },
      select: {
        id: true,
      },
    });

    if (!unidade) {
      throw new Error("UNIDADE_NAO_PERTENCE_CLINICA");
    }

    const precoUnidade = await prisma.precoProcedimentoUnidade.findFirst({
      where: {
        unidadeClinicaId,
        procedimentoId,
        ativo: true,
      },
      select: {
        valorPaciente: true,
        valorRepasse: true,
      },
    });

    if (precoUnidade) {
      valorPaciente = Number(precoUnidade.valorPaciente);
      valorRepasse = Number(precoUnidade.valorRepasse);
    }
  }

  return {
    procedimentoId,
    clinicaId,
    unidadeClinicaId,
    valorPaciente,
    valorRepasse,
  };
}

function respostaErroItemOrcamento(erro: unknown, res: any) {
  const codigo = erro instanceof Error ? erro.message : "";

  if (codigo === "PROCEDIMENTO_INVALIDO") {
    return res.status(400).json({
      erro: "Há um procedimento inválido no orçamento.",
    });
  }

  if (codigo === "CLINICA_INVALIDA") {
    return res.status(400).json({
      erro: "Selecione a clínica de todos os procedimentos.",
    });
  }

  if (codigo === "UNIDADE_INVALIDA") {
    return res.status(400).json({
      erro: "Unidade de clínica inválida.",
    });
  }

  if (codigo === "PROCEDIMENTO_INATIVO") {
    return res.status(404).json({
      erro: "Um dos procedimentos não existe ou está inativo.",
    });
  }

  if (codigo === "PRECO_CLINICA_INDISPONIVEL") {
    return res.status(409).json({
      erro: `A clínica selecionada não possui preço ativo para ${(erro as any)?.procedimentoNome || "o procedimento"}.`,
    });
  }

  if (codigo === "UNIDADE_NAO_PERTENCE_CLINICA") {
    return res.status(409).json({
      erro: "A unidade selecionada não pertence à clínica ou está inativa.",
    });
  }

  return null;
}

async function resolverPacienteDoOrcamento(body: any) {
  const pacienteIdRecebido =
    body.pacienteId === null ||
    body.pacienteId === undefined ||
    body.pacienteId === ""
      ? null
      : Number(body.pacienteId);

  if (
    pacienteIdRecebido !== null &&
    (!Number.isInteger(pacienteIdRecebido) || pacienteIdRecebido <= 0)
  ) {
    throw new Error("PACIENTE_INVALIDO");
  }

  let paciente:
    | {
        id: number;
        nome: string;
        telefone: string;
      }
    | null = null;

  if (pacienteIdRecebido !== null) {
    paciente = await prisma.paciente.findUnique({
      where: {
        id: pacienteIdRecebido,
      },
      select: {
        id: true,
        nome: true,
        telefone: true,
      },
    });

    if (!paciente) {
      throw new Error("PACIENTE_NAO_ENCONTRADO");
    }
  }

  const nomePaciente = paciente
    ? paciente.nome
    : String(body.nomePaciente || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleUpperCase("pt-BR");

  const telefonePaciente = String(
    paciente ? paciente.telefone : body.telefonePaciente || ""
  ).replace(/\D/g, "");

  if (!nomePaciente || nomePaciente.length < 2) {
    throw new Error("NOME_PACIENTE_INVALIDO");
  }

  if (telefonePaciente.length < 10 || telefonePaciente.length > 11) {
    throw new Error("TELEFONE_PACIENTE_INVALIDO");
  }

  return {
    paciente,
    pacienteId: paciente?.id || null,
    nomePaciente,
    telefonePaciente,
  };
}

function respostaErroPacienteOrcamento(erro: unknown, res: any) {
  const codigo = erro instanceof Error ? erro.message : "";

  if (codigo === "PACIENTE_INVALIDO") {
    return res.status(400).json({ erro: "Paciente inválido." });
  }

  if (codigo === "PACIENTE_NAO_ENCONTRADO") {
    return res.status(404).json({ erro: "Paciente não encontrado." });
  }

  if (codigo === "NOME_PACIENTE_INVALIDO") {
    return res.status(400).json({ erro: "Informe o nome do paciente." });
  }

  if (codigo === "TELEFONE_PACIENTE_INVALIDO") {
    return res.status(400).json({
      erro: "Informe um telefone válido com DDD.",
    });
  }

  return null;
}

// ======================================================
// MODELOS DE ORÇAMENTO
// ======================================================

function normalizarNomeModeloOrcamento(valor: unknown) {
  return String(valor || "").trim().replace(/\s+/g, " ");
}

function normalizarValidadeDias(
  valor: unknown,
  padrao = VALIDADE_ORCAMENTO_PADRAO_DIAS
) {
  const padraoValido =
    Number.isInteger(padrao) && padrao >= 1 && padrao <= 365
      ? padrao
      : VALIDADE_ORCAMENTO_PADRAO_DIAS;
  const dias = Number(valor);

  if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
    return padraoValido;
  }

  return dias;
}

function calcularValidadeOrcamento(
  dataBase = new Date(),
  dias = VALIDADE_ORCAMENTO_PADRAO_DIAS
) {
  const validade = new Date(dataBase);
  validade.setDate(validade.getDate() + dias);
  validade.setHours(23, 59, 59, 999);
  return validade;
}

function validadeEfetivaOrcamento(orcamento: any) {
  if (orcamento.validadeAte) {
    return new Date(orcamento.validadeAte);
  }

  return calcularValidadeOrcamento(
    new Date(orcamento.criadoEm),
    normalizarValidadeDias(orcamento.validadeDias)
  );
}

function orcamentoEstaVencido(orcamento: any) {
  if (orcamento.status === "ENCERRADO") return false;
  return validadeEfetivaOrcamento(orcamento).getTime() < Date.now();
}

function statusVisualOrcamento(orcamento: any) {
  return orcamentoEstaVencido(orcamento) ? "VENCIDO" : orcamento.status;
}

function formatarDataHistorico(data: Date | string | null | undefined) {
  if (!data) return "";
  return new Date(data).toLocaleDateString("pt-BR");
}

async function registrarHistoricoOrcamento(
  tx: any,
  orcamentoId: number,
  acao: string,
  descricao: string
) {
  await tx.historicoOrcamento.create({
    data: {
      orcamentoId,
      usuarioId: usuarioAtualId(),
      acao,
      descricao,
    },
  });
}

async function validarItensModeloOrcamento(itensRecebidos: any[]) {
  if (!Array.isArray(itensRecebidos) || itensRecebidos.length === 0) {
    throw new Error("MODELO_SEM_ITENS");
  }

  if (itensRecebidos.length > 100) {
    throw new Error("MODELO_MUITOS_ITENS");
  }

  const procedimentosUsados = new Set<number>();
  const itens: Array<{
    procedimentoId: number;
    clinicaId: number | null;
    unidadeClinicaId: number | null;
  }> = [];

  for (const recebido of itensRecebidos) {
    const procedimentoId = Number(recebido?.procedimentoId);
    const clinicaId =
      recebido?.clinicaId === null ||
      recebido?.clinicaId === undefined ||
      recebido?.clinicaId === ""
        ? null
        : Number(recebido.clinicaId);
    const unidadeClinicaId =
      recebido?.unidadeClinicaId === null ||
      recebido?.unidadeClinicaId === undefined ||
      recebido?.unidadeClinicaId === ""
        ? null
        : Number(recebido.unidadeClinicaId);

    if (!Number.isInteger(procedimentoId) || procedimentoId <= 0) {
      throw new Error("MODELO_PROCEDIMENTO_INVALIDO");
    }

    if (procedimentosUsados.has(procedimentoId)) {
      throw new Error("MODELO_PROCEDIMENTO_DUPLICADO");
    }
    procedimentosUsados.add(procedimentoId);

    const procedimento = await prisma.procedimento.findFirst({
      where: { id: procedimentoId, ativo: true },
      select: { id: true, nome: true },
    });
    if (!procedimento) throw new Error("MODELO_PROCEDIMENTO_INATIVO");

    if (clinicaId !== null) {
      if (!Number.isInteger(clinicaId) || clinicaId <= 0) {
        throw new Error("MODELO_CLINICA_INVALIDA");
      }

      const preco = await prisma.precoProcedimentoClinica.findFirst({
        where: {
          clinicaId,
          procedimentoId,
          ativo: true,
          clinica: { ativo: true },
        },
        select: { id: true },
      });
      if (!preco) throw new Error("MODELO_CLINICA_SEM_PRECO");
    }

    if (unidadeClinicaId !== null) {
      if (clinicaId === null) throw new Error("MODELO_UNIDADE_SEM_CLINICA");
      if (!Number.isInteger(unidadeClinicaId) || unidadeClinicaId <= 0) {
        throw new Error("MODELO_UNIDADE_INVALIDA");
      }

      const unidade = await prisma.unidadeClinica.findFirst({
        where: { id: unidadeClinicaId, clinicaId, ativo: true },
        select: { id: true },
      });
      if (!unidade) throw new Error("MODELO_UNIDADE_INVALIDA");
    }

    itens.push({ procedimentoId, clinicaId, unidadeClinicaId });
  }

  return itens;
}

function mensagemErroModeloOrcamento(erro: unknown) {
  const codigo = erro instanceof Error ? erro.message : "";
  const mensagens: Record<string, string> = {
    MODELO_SEM_ITENS: "Adicione ao menos um procedimento ao modelo.",
    MODELO_MUITOS_ITENS: "Um modelo pode ter no máximo 100 procedimentos.",
    MODELO_PROCEDIMENTO_INVALIDO: "Há um procedimento inválido no modelo.",
    MODELO_PROCEDIMENTO_DUPLICADO:
      "O mesmo procedimento não pode aparecer duas vezes no modelo.",
    MODELO_PROCEDIMENTO_INATIVO:
      "Um dos procedimentos não existe ou está inativo.",
    MODELO_CLINICA_INVALIDA: "Há uma clínica inválida no modelo.",
    MODELO_CLINICA_SEM_PRECO:
      "A clínica preferencial não possui preço ativo para um dos procedimentos.",
    MODELO_UNIDADE_SEM_CLINICA:
      "Selecione a clínica antes de definir uma unidade preferencial.",
    MODELO_UNIDADE_INVALIDA:
      "Há uma unidade inválida ou que não pertence à clínica escolhida.",
  };
  return mensagens[codigo] || null;
}

function modeloOrcamentoJson(modelo: any) {
  return {
    id: modelo.id,
    nome: modelo.nome,
    categoria: modelo.categoria,
    descricao: modelo.descricao,
    ativo: modelo.ativo,
    favorito: Boolean(modelo.favorito),
    totalUsos: Number(modelo.totalUsos || 0),
    ultimoUsoEm: modelo.ultimoUsoEm,
    criadoEm: modelo.criadoEm,
    atualizadoEm: modelo.atualizadoEm,
    criadoPor: modelo.criadoPor
      ? { id: modelo.criadoPor.id, nome: modelo.criadoPor.nome }
      : null,
    itens: (modelo.itens || []).map((item: any) => ({
      id: item.id,
      procedimentoId: item.procedimentoId,
      procedimentoNome: item.procedimento?.nome || "",
      procedimentoAtivo: Boolean(item.procedimento?.ativo),
      clinicaId: item.clinicaId,
      clinicaNome: item.clinica?.nome || null,
      clinicaAtiva: item.clinica ? Boolean(item.clinica.ativo) : null,
      unidadeClinicaId: item.unidadeClinicaId,
      unidadeClinicaNome: item.unidadeClinica?.nome || null,
      unidadeAtiva: item.unidadeClinica
        ? Boolean(item.unidadeClinica.ativo)
        : null,
    })),
  };
}

app.get("/modelos-orcamento", async (_req, res) => {
  try {
    const modelos = await prisma.modeloOrcamento.findMany({
      where: { organizacaoId: organizacaoAtualId() },
      include: {
        criadoPor: true,
        itens: {
          include: { procedimento: true, clinica: true, unidadeClinica: true },
          orderBy: { id: "asc" },
        },
      },
      orderBy: [
        { favorito: "desc" },
        { ativo: "desc" },
        { totalUsos: "desc" },
        { nome: "asc" },
      ],
    });
    return res.json(modelos.map(modeloOrcamentoJson));
  } catch (erro) {
    console.error("Erro ao listar modelos de orçamento:", erro);
    return res
      .status(500)
      .json({ erro: "Não foi possível carregar os modelos de orçamento." });
  }
});

app.get("/modelos-orcamento/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "Modelo inválido." });
    }

    const modelo = await prisma.modeloOrcamento.findFirst({
      where: { id, organizacaoId: organizacaoAtualId() },
      include: {
        criadoPor: true,
        itens: {
          include: { procedimento: true, clinica: true, unidadeClinica: true },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!modelo) {
      return res.status(404).json({ erro: "Modelo de orçamento não encontrado." });
    }
    return res.json(modeloOrcamentoJson(modelo));
  } catch (erro) {
    console.error("Erro ao carregar modelo de orçamento:", erro);
    return res
      .status(500)
      .json({ erro: "Não foi possível carregar o modelo de orçamento." });
  }
});

app.post("/modelos-orcamento", async (req, res) => {
  try {
    const nome = normalizarNomeModeloOrcamento(req.body.nome);
    if (nome.length < 2 || nome.length > 120) {
      return res
        .status(400)
        .json({ erro: "Informe um nome entre 2 e 120 caracteres." });
    }
    const categoria = normalizarNomeModeloOrcamento(req.body.categoria) || null;
    const descricao = String(req.body.descricao || "").trim() || null;
    const itens = await validarItensModeloOrcamento(req.body.itens);

    const modelo = await prisma.modeloOrcamento.create({
      data: {
        nome,
        categoria,
        descricao,
        ativo: req.body.ativo === false ? false : true,
        favorito: req.body.favorito === true,
        organizacaoId: organizacaoAtualId(),
        criadoPorId: usuarioAtualId(),
        itens: { create: itens },
      },
      include: {
        criadoPor: true,
        itens: {
          include: { procedimento: true, clinica: true, unidadeClinica: true },
          orderBy: { id: "asc" },
        },
      },
    });
    return res.status(201).json(modeloOrcamentoJson(modelo));
  } catch (erro) {
    const mensagem = mensagemErroModeloOrcamento(erro);
    if (mensagem) return res.status(400).json({ erro: mensagem });
    console.error("Erro ao criar modelo de orçamento:", erro);
    return res
      .status(500)
      .json({ erro: "Não foi possível criar o modelo de orçamento." });
  }
});

app.put("/modelos-orcamento/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "Modelo inválido." });
    }

    const existente = await prisma.modeloOrcamento.findFirst({
      where: { id, organizacaoId: organizacaoAtualId() },
      select: { id: true },
    });
    if (!existente) {
      return res.status(404).json({ erro: "Modelo de orçamento não encontrado." });
    }

    const nome = normalizarNomeModeloOrcamento(req.body.nome);
    if (nome.length < 2 || nome.length > 120) {
      return res
        .status(400)
        .json({ erro: "Informe um nome entre 2 e 120 caracteres." });
    }
    const categoria = normalizarNomeModeloOrcamento(req.body.categoria) || null;
    const descricao = String(req.body.descricao || "").trim() || null;
    const itens = await validarItensModeloOrcamento(req.body.itens);

    const modelo = await prisma.$transaction(async (tx) => {
      await tx.itemModeloOrcamento.deleteMany({ where: { modeloId: id } });
      return tx.modeloOrcamento.update({
        where: { id },
        data: {
          nome,
          categoria,
          descricao,
          ativo: req.body.ativo === false ? false : true,
          favorito: req.body.favorito === true,
          itens: { create: itens },
        },
        include: {
          criadoPor: true,
          itens: {
            include: {
              procedimento: true,
              clinica: true,
              unidadeClinica: true,
            },
            orderBy: { id: "asc" },
          },
        },
      });
    });
    return res.json(modeloOrcamentoJson(modelo));
  } catch (erro) {
    const mensagem = mensagemErroModeloOrcamento(erro);
    if (mensagem) return res.status(400).json({ erro: mensagem });
    console.error("Erro ao atualizar modelo de orçamento:", erro);
    return res
      .status(500)
      .json({ erro: "Não foi possível atualizar o modelo de orçamento." });
  }
});

app.patch("/modelos-orcamento/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "Modelo inválido." });
    }
    if (typeof req.body.ativo !== "boolean") {
      return res.status(400).json({ erro: "Informe o novo status do modelo." });
    }

    const existente = await prisma.modeloOrcamento.findFirst({
      where: { id, organizacaoId: organizacaoAtualId() },
      select: { id: true },
    });
    if (!existente) {
      return res.status(404).json({ erro: "Modelo de orçamento não encontrado." });
    }

    const atualizado = await prisma.modeloOrcamento.update({
      where: { id },
      data: { ativo: req.body.ativo },
    });
    return res.json({ id: atualizado.id, ativo: atualizado.ativo });
  } catch (erro) {
    console.error("Erro ao alterar status do modelo:", erro);
    return res
      .status(500)
      .json({ erro: "Não foi possível alterar o status do modelo." });
  }
});

app.patch("/modelos-orcamento/:id/favorito", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "Modelo inválido." });
    }
    if (typeof req.body.favorito !== "boolean") {
      return res.status(400).json({ erro: "Informe se o modelo é favorito." });
    }

    const existente = await prisma.modeloOrcamento.findFirst({
      where: { id, organizacaoId: organizacaoAtualId() },
      select: { id: true },
    });
    if (!existente) {
      return res.status(404).json({ erro: "Modelo de orçamento não encontrado." });
    }

    const atualizado = await prisma.modeloOrcamento.update({
      where: { id },
      data: { favorito: req.body.favorito },
    });
    return res.json({ id: atualizado.id, favorito: atualizado.favorito });
  } catch (erro) {
    console.error("Erro ao favoritar modelo:", erro);
    return res
      .status(500)
      .json({ erro: "Não foi possível alterar o favorito do modelo." });
  }
});

// ======================================================
// LISTAR ORÇAMENTOS
// ======================================================

app.get("/orcamentos", async (_req, res) => {
  try {
    const orcamentos = await prisma.orcamento.findMany({
      where: {
        OR: [
          { organizacaoId: organizacaoAtualId() },
          { organizacaoId: null },
        ],
      },
      include: {
        paciente: true,
        itens: {
          include: {
            procedimento: true,
            clinica: true,
            unidadeClinica: true,
          },
          orderBy: { id: "asc" },
        },
      },
      orderBy: { atualizadoEm: "desc" },
    });

    const resultado = orcamentos.map((orcamento) => {
      const validadeAte = validadeEfetivaOrcamento(orcamento);
      const vencido = orcamentoEstaVencido(orcamento);

      return {
        id: orcamento.id,
        codigoPublico: orcamento.codigoPublico,
        pacienteId: orcamento.pacienteId,
        nomePaciente: orcamento.nomePaciente,
        telefonePaciente: orcamento.telefonePaciente,
        status: statusVisualOrcamento(orcamento),
        statusBanco: orcamento.status,
        vencido,
        validadeDias: normalizarValidadeDias(orcamento.validadeDias),
        validadeAte,
        condicoesPagamento:
          orcamento.condicoesPagamento || CONDICOES_PAGAMENTO_PADRAO,
        criadoEm: orcamento.criadoEm,
        atualizadoEm: orcamento.atualizadoEm,
        itens: orcamento.itens.map((item) => ({
          id: item.id,
          procedimentoId: item.procedimentoId,
          procedimentoNome: item.procedimento.nome,
          clinicaId: item.clinicaId,
          clinicaNome: item.clinica?.nome || null,
          unidadeClinicaId: item.unidadeClinicaId,
          unidadeClinicaNome: item.unidadeClinica?.nome || null,
          valorPaciente: Number(item.valorPaciente),
          convertido: Boolean(item.itemGuiaId),
        })),
      };
    });

    return res.json(resultado);
  } catch (erro) {
    console.error("Erro ao carregar orçamentos:", erro);
    return res
      .status(500)
      .json({ erro: "Não foi possível carregar os orçamentos." });
  }
});

// ======================================================
// CRIAR ORÇAMENTO
// ======================================================

app.post("/orcamentos", async (req, res) => {
  try {
    let dadosPaciente;

    try {
      dadosPaciente = await resolverPacienteDoOrcamento(req.body);
    } catch (erro) {
      const resposta = respostaErroPacienteOrcamento(erro, res);
      if (resposta) return resposta;
      throw erro;
    }

    const itensRecebidos = Array.isArray(req.body.itens) ? req.body.itens : [];

    if (itensRecebidos.length === 0) {
      return res
        .status(400)
        .json({ erro: "Adicione ao menos um procedimento ao orçamento." });
    }

    if (itensRecebidos.length > 100) {
      return res
        .status(400)
        .json({ erro: "Um orçamento pode ter no máximo 100 procedimentos." });
    }

    const configuracoesOrganizacao = await obterConfiguracoesOrganizacaoAtual();
    const validadePadraoOrganizacao = normalizarValidadeDias(
      configuracoesOrganizacao.validadeOrcamentoDiasPadrao
    );
    const condicoesPadraoOrganizacao =
      configuracoesOrganizacao.condicoesPagamentoOrcamentoPadrao?.trim() ||
      CONDICOES_PAGAMENTO_PADRAO;

    const observacoes = String(req.body.observacoes || "").trim() || null;
    const validadeDias = normalizarValidadeDias(
      req.body.validadeDias,
      validadePadraoOrganizacao
    );
    const validadeAte = calcularValidadeOrcamento(new Date(), validadeDias);
    const condicoesPagamento =
      String(req.body.condicoesPagamento || "").trim() ||
      condicoesPadraoOrganizacao;

    if (condicoesPagamento.length > 1000) {
      return res.status(400).json({
        erro: "As condições de pagamento podem ter no máximo 1000 caracteres.",
      });
    }

    const idsProcedimentos = new Set<number>();
    const itensValidados: Array<{
      procedimentoId: number;
      clinicaId: number;
      unidadeClinicaId: number | null;
      valorPaciente: number;
      valorRepasse: number;
    }> = [];

    for (const itemRecebido of itensRecebidos) {
      let itemValidado;

      try {
        itemValidado = await validarItemOrcamentoRecebido(itemRecebido);
      } catch (erro) {
        const resposta = respostaErroItemOrcamento(erro, res);
        if (resposta) return resposta;
        throw erro;
      }

      if (idsProcedimentos.has(itemValidado.procedimentoId)) {
        return res.status(409).json({
          erro: "O mesmo procedimento não pode aparecer duas vezes no mesmo orçamento.",
        });
      }

      idsProcedimentos.add(itemValidado.procedimentoId);
      itensValidados.push(itemValidado);
    }

    const modeloIdRecebido = Number(req.body.modeloId);
    const modeloId =
      Number.isInteger(modeloIdRecebido) && modeloIdRecebido > 0
        ? modeloIdRecebido
        : null;

    if (modeloId) {
      const modelo = await prisma.modeloOrcamento.findFirst({
        where: {
          id: modeloId,
          organizacaoId: organizacaoAtualId(),
          ativo: true,
        },
        select: { id: true },
      });
      if (!modelo) {
        return res.status(409).json({
          erro: "O modelo usado neste orçamento não existe mais ou está inativo.",
        });
      }
    }

    const codigoPublico = await gerarCodigoPublicoUnico("ORC");

    const orcamento = await prisma.$transaction(async (tx) => {
      const criado = await tx.orcamento.create({
        data: {
          codigoPublico,
          organizacaoId: organizacaoAtualId(),
          criadoPorId: usuarioAtualId(),
          pacienteId: dadosPaciente.pacienteId,
          nomePaciente: dadosPaciente.nomePaciente,
          telefonePaciente: dadosPaciente.telefonePaciente,
          observacoes,
          validadeDias,
          validadeAte,
          condicoesPagamento,
          status: "ABERTO",
          itens: { create: itensValidados },
        },
        include: {
          paciente: true,
          criadoPor: true,
          itens: {
            include: {
              procedimento: true,
              clinica: true,
              unidadeClinica: true,
            },
            orderBy: { id: "asc" },
          },
        },
      });

      await registrarHistoricoOrcamento(
        tx,
        criado.id,
        "CRIADO",
        `Orçamento criado com ${criado.itens.length} procedimento${
          criado.itens.length === 1 ? "" : "s"
        }. Validade até ${formatarDataHistorico(validadeAte)}.`
      );

      if (modeloId) {
        await tx.modeloOrcamento.update({
          where: { id: modeloId },
          data: {
            totalUsos: { increment: 1 },
            ultimoUsoEm: new Date(),
          },
        });
      }

      return criado;
    });

    return res.status(201).json({
      id: orcamento.id,
      codigoPublico: orcamento.codigoPublico,
      pacienteId: orcamento.pacienteId,
      nomePaciente: orcamento.nomePaciente,
      telefonePaciente: orcamento.telefonePaciente,
      status: orcamento.status,
      vencido: false,
      validadeDias: orcamento.validadeDias,
      validadeAte: orcamento.validadeAte,
      condicoesPagamento: orcamento.condicoesPagamento,
      observacoes: orcamento.observacoes,
      criadoEm: orcamento.criadoEm,
      atualizadoEm: orcamento.atualizadoEm,
      criadoPor: orcamento.criadoPor
        ? { id: orcamento.criadoPor.id, nome: orcamento.criadoPor.nome }
        : null,
      itens: orcamento.itens.map((item) => ({
        id: item.id,
        procedimentoId: item.procedimentoId,
        procedimentoNome: item.procedimento.nome,
        clinicaId: item.clinicaId,
        clinicaNome: item.clinica?.nome || null,
        unidadeClinicaId: item.unidadeClinicaId,
        unidadeClinicaNome: item.unidadeClinica?.nome || null,
        valorPaciente: Number(item.valorPaciente),
        valorRepasse: Number(item.valorRepasse),
        convertido: Boolean(item.itemGuiaId),
        convertidoEm: item.convertidoEm,
      })),
    });
  } catch (erro) {
    console.error("Erro ao criar orçamento:", erro);
    return res.status(500).json({ erro: "Não foi possível criar o orçamento." });
  }
});

// ======================================================
// BUSCAR ORÇAMENTO POR ID
// ======================================================

app.get("/orcamentos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "ID do orçamento inválido." });
    }

    const orcamento = await prisma.orcamento.findFirst({
      where: {
        id,
        OR: [
          { organizacaoId: organizacaoAtualId() },
          { organizacaoId: null },
        ],
      },
      include: {
        paciente: true,
        criadoPor: true,
        organizacao: true,
        historico: {
          include: { usuario: true },
          orderBy: { criadoEm: "desc" },
        },
        itens: {
          include: {
            procedimento: true,
            clinica: true,
            unidadeClinica: true,
            itemGuia: { include: { guia: true } },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!orcamento) {
      return res.status(404).json({ erro: "Orçamento não encontrado." });
    }

    const organizacao =
      orcamento.organizacao ||
      (await prisma.organizacao.findUnique({
        where: { id: organizacaoAtualId() },
      }));
    const validadeAte = validadeEfetivaOrcamento(orcamento);
    const vencido = orcamentoEstaVencido(orcamento);

    return res.json({
      id: orcamento.id,
      codigoPublico: orcamento.codigoPublico,
      pacienteId: orcamento.pacienteId,
      nomePaciente: orcamento.nomePaciente,
      telefonePaciente: orcamento.telefonePaciente,
      status: statusVisualOrcamento(orcamento),
      statusBanco: orcamento.status,
      vencido,
      validadeDias: normalizarValidadeDias(orcamento.validadeDias),
      validadeAte,
      condicoesPagamento:
        orcamento.condicoesPagamento || CONDICOES_PAGAMENTO_PADRAO,
      observacoes: orcamento.observacoes,
      criadoEm: orcamento.criadoEm,
      atualizadoEm: orcamento.atualizadoEm,
      criadoPor: orcamento.criadoPor
        ? { id: orcamento.criadoPor.id, nome: orcamento.criadoPor.nome }
        : null,
      organizacao: organizacao
        ? {
            id: organizacao.id,
            nomeFantasia: organizacao.nomeFantasia,
            razaoSocial: organizacao.razaoSocial,
            documento: organizacao.documento,
            telefone: organizacao.telefone,
            email: organizacao.email,
            endereco: organizacao.endereco,
          }
        : null,
      historico: orcamento.historico.map((registro) => ({
        id: registro.id,
        acao: registro.acao,
        descricao: registro.descricao,
        criadoEm: registro.criadoEm,
        usuario: registro.usuario
          ? { id: registro.usuario.id, nome: registro.usuario.nome }
          : null,
      })),
      itens: orcamento.itens.map((item) => ({
        id: item.id,
        procedimentoId: item.procedimentoId,
        procedimentoNome: item.procedimento.nome,
        clinicaId: item.clinicaId,
        clinicaNome: item.clinica?.nome || null,
        unidadeClinicaId: item.unidadeClinicaId,
        unidadeClinicaNome: item.unidadeClinica?.nome || null,
        valorPaciente: Number(item.valorPaciente),
        valorRepasse: Number(item.valorRepasse),
        convertido: Boolean(item.itemGuiaId),
        convertidoEm: item.convertidoEm,
        itemGuiaId: item.itemGuiaId,
        guiaId: item.itemGuia?.guiaId || null,
        atendimentoId: item.itemGuia?.guia.atendimentoId || null,
        codigoVoucher: item.itemGuia?.guia.codigoPublico || null,
      })),
    });
  } catch (erro) {
    console.error("Erro ao carregar orçamento:", erro);
    return res.status(500).json({ erro: "Não foi possível carregar o orçamento." });
  }
});

// ======================================================
// EDITAR ORÇAMENTO ABERTO
// ======================================================

app.put("/orcamentos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "ID do orçamento inválido." });
    }

    const existente = await prisma.orcamento.findFirst({
      where: {
        id,
        OR: [
          { organizacaoId: organizacaoAtualId() },
          { organizacaoId: null },
        ],
      },
      include: { itens: true },
    });

    if (!existente) {
      return res.status(404).json({ erro: "Orçamento não encontrado." });
    }

    if (
      existente.status !== "ABERTO" ||
      existente.itens.some((item) => item.itemGuiaId !== null)
    ) {
      return res.status(409).json({
        erro: "Após a primeira conversão, o orçamento fica bloqueado para edição. Duplique-o para criar uma nova cotação.",
      });
    }

    let dadosPaciente;

    try {
      dadosPaciente = await resolverPacienteDoOrcamento(req.body);
    } catch (erro) {
      const resposta = respostaErroPacienteOrcamento(erro, res);
      if (resposta) return resposta;
      throw erro;
    }

    const itensRecebidos = Array.isArray(req.body.itens) ? req.body.itens : [];

    if (itensRecebidos.length === 0) {
      return res
        .status(400)
        .json({ erro: "Adicione ao menos um procedimento ao orçamento." });
    }

    if (itensRecebidos.length > 100) {
      return res
        .status(400)
        .json({ erro: "Um orçamento pode ter no máximo 100 procedimentos." });
    }

    const existentesPorId = new Map(existente.itens.map((item) => [item.id, item]));
    const idsProcedimentos = new Set<number>();
    const itensValidados: Array<{
      procedimentoId: number;
      clinicaId: number;
      unidadeClinicaId: number | null;
      valorPaciente: number;
      valorRepasse: number;
    }> = [];

    for (const itemRecebido of itensRecebidos) {
      let itemValidado;

      try {
        itemValidado = await validarItemOrcamentoRecebido(itemRecebido);
      } catch (erro) {
        const resposta = respostaErroItemOrcamento(erro, res);
        if (resposta) return resposta;
        throw erro;
      }

      if (idsProcedimentos.has(itemValidado.procedimentoId)) {
        return res.status(409).json({
          erro: "O mesmo procedimento não pode aparecer duas vezes no mesmo orçamento.",
        });
      }
      idsProcedimentos.add(itemValidado.procedimentoId);

      const itemId = Number(itemRecebido?.id);
      const itemAnterior = Number.isInteger(itemId)
        ? existentesPorId.get(itemId)
        : undefined;

      if (Number.isInteger(itemId) && !itemAnterior) {
        return res
          .status(400)
          .json({ erro: "Um dos itens não pertence a este orçamento." });
      }

      if (
        itemAnterior &&
        itemAnterior.procedimentoId === itemValidado.procedimentoId &&
        itemAnterior.clinicaId === itemValidado.clinicaId &&
        itemAnterior.unidadeClinicaId === itemValidado.unidadeClinicaId
      ) {
        itemValidado.valorPaciente = Number(itemAnterior.valorPaciente);
        itemValidado.valorRepasse = Number(itemAnterior.valorRepasse);
      }

      itensValidados.push(itemValidado);
    }

    const observacoes = String(req.body.observacoes || "").trim() || null;
    const validadeDias = normalizarValidadeDias(req.body.validadeDias);
    const renovarValidade = req.body.renovarValidade === true;
    const validadeMudou = validadeDias !== normalizarValidadeDias(existente.validadeDias);
    const validadeAte =
      renovarValidade || validadeMudou || !existente.validadeAte
        ? calcularValidadeOrcamento(new Date(), validadeDias)
        : existente.validadeAte;
    const condicoesPagamento =
      String(req.body.condicoesPagamento || "").trim() ||
      CONDICOES_PAGAMENTO_PADRAO;

    if (condicoesPagamento.length > 1000) {
      return res.status(400).json({
        erro: "As condições de pagamento podem ter no máximo 1000 caracteres.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.orcamento.update({
        where: { id },
        data: {
          pacienteId: dadosPaciente.pacienteId,
          nomePaciente: dadosPaciente.nomePaciente,
          telefonePaciente: dadosPaciente.telefonePaciente,
          observacoes,
          validadeDias,
          validadeAte,
          condicoesPagamento,
          status: "ABERTO",
        },
      });

      await tx.itemOrcamento.deleteMany({
        where: { orcamentoId: id, itemGuiaId: null },
      });

      await tx.itemOrcamento.createMany({
        data: itensValidados.map((item) => ({ orcamentoId: id, ...item })),
      });

      await registrarHistoricoOrcamento(
        tx,
        id,
        "EDITADO",
        `Orçamento atualizado com ${itensValidados.length} procedimento${
          itensValidados.length === 1 ? "" : "s"
        }. Validade até ${formatarDataHistorico(validadeAte)}.`
      );
    });

    return res.json({ id, mensagem: "Orçamento atualizado com sucesso." });
  } catch (erro) {
    console.error("Erro ao atualizar orçamento:", erro);
    return res
      .status(500)
      .json({ erro: "Não foi possível atualizar o orçamento." });
  }
});

// ======================================================
// CONVERTER ITENS DO ORÇAMENTO EM ATENDIMENTO
// ======================================================

app.post("/orcamentos/:id/converter", async (req, res) => {
  try {
    const orcamentoId = Number(req.params.id);

    if (!Number.isInteger(orcamentoId) || orcamentoId <= 0) {
      return res.status(400).json({ erro: "ID do orçamento inválido." });
    }

    const itemIdsRecebidos: number[] = Array.isArray(req.body.itemIds)
      ? (req.body.itemIds as unknown[]).map((valor) => Number(valor))
      : [];

    const itemIds: number[] = Array.from(
      new Set<number>(itemIdsRecebidos)
    ).filter((valor: number) => Number.isInteger(valor) && valor > 0);

    if (itemIds.length === 0) {
      return res
        .status(400)
        .json({ erro: "Selecione ao menos um procedimento para converter." });
    }

    if (itemIds.length !== itemIdsRecebidos.length) {
      return res.status(400).json({
        erro: "A seleção contém um item inválido ou repetido.",
      });
    }

    const orcamento = await prisma.orcamento.findFirst({
      where: {
        id: orcamentoId,
        OR: [
          { organizacaoId: organizacaoAtualId() },
          { organizacaoId: null },
        ],
      },
      include: {
        paciente: true,
        itens: { orderBy: { id: "asc" } },
      },
    });

    if (!orcamento) {
      return res.status(404).json({ erro: "Orçamento não encontrado." });
    }

    if (orcamentoEstaVencido(orcamento)) {
      return res.status(409).json({
        erro: "Este orçamento está vencido. Renove a validade se ele ainda estiver aberto ou duplique-o para gerar uma nova cotação.",
        tipo: "ORCAMENTO_VENCIDO",
      });
    }

    if (!orcamento.pacienteId || !orcamento.paciente) {
      return res.status(409).json({
        erro: "Antes de converter, edite o orçamento e vincule-o a um paciente cadastrado.",
        tipo: "PACIENTE_NAO_VINCULADO",
      });
    }

    const itensSelecionados = orcamento.itens.filter((item) =>
      itemIds.includes(item.id)
    );

    if (itensSelecionados.length !== itemIds.length) {
      return res.status(400).json({
        erro: "Um dos itens selecionados não pertence a este orçamento.",
      });
    }

    const jaConvertido = itensSelecionados.find(
      (item) => item.itemGuiaId !== null
    );

    if (jaConvertido) {
      return res.status(409).json({
        erro: "Um dos procedimentos selecionados já foi convertido.",
      });
    }

    if (
      itensSelecionados.some(
        (item) => !item.clinicaId || Number(item.clinicaId) <= 0
      )
    ) {
      return res.status(409).json({
        erro: "Todos os itens selecionados precisam possuir uma clínica definida.",
      });
    }

    const grupos = new Map<
      string,
      {
        clinicaId: number;
        unidadeClinicaId: number | null;
        itens: typeof itensSelecionados;
      }
    >();

    for (const item of itensSelecionados) {
      const clinicaId = Number(item.clinicaId);
      const unidadeClinicaId = item.unidadeClinicaId
        ? Number(item.unidadeClinicaId)
        : null;
      const chave = `${clinicaId}:${unidadeClinicaId || 0}`;
      const grupo = grupos.get(chave);

      if (grupo) {
        grupo.itens.push(item);
      } else {
        grupos.set(chave, {
          clinicaId,
          unidadeClinicaId,
          itens: [item],
        });
      }
    }

    const codigoPublicoAtendimento = await gerarCodigoPublicoUnico("ATD");
    const gruposComCodigo = [] as Array<{
      clinicaId: number;
      unidadeClinicaId: number | null;
      itens: typeof itensSelecionados;
      codigoPublicoGuia: string;
    }>;

    for (const grupo of grupos.values()) {
      gruposComCodigo.push({
        ...grupo,
        codigoPublicoGuia: await gerarCodigoPublicoUnico("VCH"),
      });
    }

    const configuracoesOrganizacao = await obterConfiguracoesOrganizacaoAtual();
    const validadeGuiaMesesPadrao = normalizarValidadeGuiaMeses(
      configuracoesOrganizacao.validadeGuiaMesesPadrao
    );
    const convertidoEm = new Date();

    const resultado = await prisma.$transaction(async (tx) => {
      const atendimento = await tx.atendimento.create({
        data: {
          codigoPublico: codigoPublicoAtendimento,
          pacienteId: orcamento.pacienteId!,
          organizacaoId: organizacaoAtualId(),
          criadoPorId: usuarioAtualId(),
          status: "EM_ANDAMENTO",
          etapaAtual: 3,
        },
      });

      for (const grupo of gruposComCodigo) {
        const subtotal = grupo.itens.reduce(
          (total, item) => total + Number(item.valorPaciente),
          0
        );

        const guia = await tx.guia.create({
          data: {
            codigoPublico: grupo.codigoPublicoGuia,
            atendimentoId: atendimento.id,
            clinicaId: grupo.clinicaId,
            unidadeClinicaId: grupo.unidadeClinicaId,
            organizacaoId: organizacaoAtualId(),
            geradaPorId: usuarioAtualId(),
            status: "RASCUNHO",
            subtotal,
            desconto: 0,
            beneficio: 0,
            valorFinal: subtotal,
            emitidaEm: convertidoEm,
            validadeAte: calcularValidadeGuia(convertidoEm, validadeGuiaMesesPadrao),
          },
        });

        for (const itemOrcamento of grupo.itens) {
          const itemGuia = await tx.itemGuia.create({
            data: {
              guiaId: guia.id,
              procedimentoId: itemOrcamento.procedimentoId,
              status: "ATIVO",
              valorPaciente: itemOrcamento.valorPaciente,
              valorRepasse: itemOrcamento.valorRepasse,
              tipoAgendamento: null,
              dataAgendamento: null,
              horarioAgendamento: null,
            },
          });

          const atualizado = await tx.itemOrcamento.updateMany({
            where: {
              id: itemOrcamento.id,
              orcamentoId,
              itemGuiaId: null,
            },
            data: {
              itemGuiaId: itemGuia.id,
              convertidoEm,
            },
          });

          if (atualizado.count !== 1) {
            throw new Error("ITEM_ORCAMENTO_JA_CONVERTIDO");
          }
        }
      }

      const quantidadeConvertida = await tx.itemOrcamento.count({
        where: { orcamentoId, itemGuiaId: { not: null } },
      });
      const quantidadeTotal = await tx.itemOrcamento.count({
        where: { orcamentoId },
      });

      const statusOrcamento =
        quantidadeConvertida >= quantidadeTotal
          ? "ENCERRADO"
          : "PARCIALMENTE_CONVERTIDO";

      await tx.orcamento.update({
        where: { id: orcamentoId },
        data: { status: statusOrcamento },
      });

      await registrarHistoricoOrcamento(
        tx,
        orcamentoId,
        statusOrcamento === "ENCERRADO"
          ? "CONVERTIDO_TOTAL"
          : "CONVERTIDO_PARCIAL",
        `${itensSelecionados.length} procedimento${
          itensSelecionados.length === 1 ? "" : "s"
        } convertido${itensSelecionados.length === 1 ? "" : "s"} no atendimento ${
          atendimento.codigoPublico || `#${atendimento.id}`
        }.`
      );

      return {
        atendimentoId: atendimento.id,
        codigoPublicoAtendimento: atendimento.codigoPublico,
        statusOrcamento,
        itensConvertidos: itensSelecionados.length,
      };
    });

    return res.status(201).json(resultado);
  } catch (erro) {
    if (
      erro instanceof Error &&
      erro.message === "ITEM_ORCAMENTO_JA_CONVERTIDO"
    ) {
      return res.status(409).json({
        erro: "Um dos procedimentos foi convertido por outro processo. Atualize o orçamento e tente novamente.",
      });
    }

    console.error("Erro ao converter orçamento:", erro);
    return res.status(500).json({
      erro: "Não foi possível converter o orçamento em atendimento.",
    });
  }
});


// ======================================================
// LISTAR ATENDIMENTOS
// ======================================================

app.get("/atendimentos", async (_req, res) => {
  try {
    const atendimentos = await prisma.atendimento.findMany({
      include: {
        paciente: true,
        guias: {
          include: {
            clinica: true,
            confirmadaPor: true,
            itens: {
              include: {
                procedimento: true,
              },
            },
          },
        },
      },
      orderBy: {
        atualizadoEm: "desc",
      },
    });

    return res.json(atendimentos);
  } catch (erro) {
    console.error("Erro ao carregar atendimentos:", erro);

    return res.status(500).json({
      erro: "Não foi possível carregar os atendimentos.",
    });
  }
});

// ======================================================
// BUSCAR ATENDIMENTO POR ID
// ======================================================

app.get("/atendimentos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        erro: "ID do atendimento inválido.",
      });
    }

    const atendimento = await prisma.atendimento.findUnique({
      where: {
        id,
      },
      include: {
        paciente: {
          include: {
            empresa: true,
          },
        },
        guias: {
          include: {
            clinica: true,
            unidadeClinica: true,
            confirmadaPor: true,
            itens: {
              include: {
                procedimento: true,
              },
            },
            pagamentos: true,
            estornos: true,
          },
        },
      },
    });

    if (!atendimento) {
      return res.status(404).json({
        erro: "Atendimento não encontrado.",
      });
    }

    return res.json(atendimento);
  } catch (erro) {
    console.error("Erro ao carregar atendimento:", erro);

    return res.status(500).json({
      erro: "Não foi possível carregar o atendimento.",
    });
  }
});


// ======================================================
// LISTAR GUIAS - CONSULTA OPERACIONAL
// ======================================================

app.get("/guias", async (_req, res) => {
  try {
    const guias = await prisma.guia.findMany({
      where: {
        OR: [
          { organizacaoId: organizacaoAtualId() },
          { organizacaoId: null },
        ],
      },
      include: {
        clinica: true,
        unidadeClinica: true,
        atendimento: {
          include: {
            paciente: true,
          },
        },
        itens: {
          include: {
            procedimento: true,
          },
          orderBy: { id: "asc" },
        },
        pagamentos: {
          orderBy: { criadoEm: "asc" },
        },
        estornos: {
          orderBy: { criadoEm: "asc" },
        },
      },
      orderBy: {
        atualizadoEm: "desc",
      },
    });

    const registros = guias.map((guia) => {
      const itensAtivos = guia.itens.filter(
        (item) => item.status !== "CANCELADO"
      );

      const totalPago = guia.pagamentos.reduce(
        (total, pagamento) => total + Number(pagamento.valor),
        0
      );

      const totalEstornado = guia.estornos.reduce(
        (total, estorno) => total + Number(estorno.valor),
        0
      );

      const pagoLiquido = Math.max(totalPago - totalEstornado, 0);
      const valorFinal = Number(guia.valorFinal);

      const agendamentos = itensAtivos.map((item) => ({
        itemGuiaId: item.id,
        procedimentoId: item.procedimento.id,
        procedimento: item.procedimento.nome,
        tipoAgendamento: item.tipoAgendamento,
        dataAgendamento: item.dataAgendamento,
        horarioAgendamento: item.horarioAgendamento,
      }));

      return {
        id: guia.id,
        codigoPublico: guia.codigoPublico,
        status: guia.status,
        criadoEm: guia.criadoEm,
        atualizadoEm: guia.atualizadoEm,
        emitidaEm: guia.emitidaEm,
        validadeAte: guia.validadeAte,
        confirmadaEm: guia.confirmadaEm,
        realizadaEm: guia.realizadaEm,

        atendimento: {
          id: guia.atendimento.id,
          codigoPublico: guia.atendimento.codigoPublico,
          status: guia.atendimento.status,
        },

        paciente: {
          id: guia.atendimento.paciente.id,
          codigoPublico: guia.atendimento.paciente.codigoPublico,
          nome: guia.atendimento.paciente.nome,
          cpf: guia.atendimento.paciente.cpf,
          telefone: guia.atendimento.paciente.telefone,
        },

        clinica: {
          id: guia.clinica.id,
          nome: guia.clinica.nome,
        },

        unidade: guia.unidadeClinica
          ? {
              id: guia.unidadeClinica.id,
              nome: guia.unidadeClinica.nome,
              logradouro: guia.unidadeClinica.logradouro,
              numero: guia.unidadeClinica.numero,
              complemento: guia.unidadeClinica.complemento,
              bairro: guia.unidadeClinica.bairro,
              cidade: guia.unidadeClinica.cidade,
              uf: guia.unidadeClinica.uf,
            }
          : null,

        procedimentos: itensAtivos.map((item) => ({
          id: item.procedimento.id,
          nome: item.procedimento.nome,
          valorPaciente: Number(item.valorPaciente),
          valorRepasse: Number(item.valorRepasse),
        })),

        itensCancelados: guia.itens
          .filter((item) => item.status === "CANCELADO")
          .map((item) => ({
            id: item.id,
            procedimento: item.procedimento.nome,
            motivoCancelamento: item.motivoCancelamento,
          })),

        agendamentos,

        financeiro: {
          subtotal: Number(guia.subtotal),
          desconto: Number(guia.desconto),
          beneficio: Number(guia.beneficio),
          valorFinal,
          totalPago,
          totalEstornado,
          pagoLiquido,
          saldo: Math.max(valorFinal - pagoLiquido, 0),
        },

        podeImprimir:
          guia.status === "PAGA" &&
          itensAtivos.length > 0 &&
          pagoLiquido >= valorFinal,
      };
    });

    return res.json(registros);
  } catch (erro) {
    console.error("Erro ao carregar guias:", erro);

    return res.status(500).json({
      erro: "Não foi possível carregar as guias.",
    });
  }
});

// ======================================================
// BUSCAR GUIA POR ID - IMPRESSÃO
// ======================================================

app.get("/guias/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        erro: "ID da guia inválido.",
      });
    }

    const guia = await prisma.guia.findUnique({
      where: { id },
      include: {
        clinica: true,
        unidadeClinica: true,
        organizacao: true,
        geradaPor: true,
        confirmadaPor: true,
        atendimento: {
          include: {
            paciente: {
              include: {
                empresa: true,
              },
            },
          },
        },
        itens: {
          include: {
            procedimento: true,
          },
          orderBy: { id: "asc" },
        },
        pagamentos: {
          orderBy: { id: "asc" },
        },
        estornos: {
          orderBy: { id: "asc" },
        },
      },
    });

    if (!guia) {
      return res.status(404).json({
        erro: "Guia não encontrada.",
      });
    }

    let organizacao = guia.organizacao;
    let geradaPor = guia.geradaPor;

    if (!organizacao) {
      organizacao = await prisma.organizacao.findUnique({
        where: { id: organizacaoAtualId() },
      });
    }

    if (!geradaPor) {
      geradaPor = await prisma.usuario.findUnique({
        where: { id: usuarioAtualId() },
      });
    }

    const situacaoCadastroPaciente = cadastroPaciente(
      guia.atendimento.paciente
    );

    const itensAtivos = guia.itens.filter(
      (item) => item.status !== "CANCELADO"
    );

    const totalPago = guia.pagamentos.reduce(
      (total, pagamento) => total + Number(pagamento.valor),
      0
    );

    const totalEstornado = guia.estornos.reduce(
      (total, estorno) => total + Number(estorno.valor),
      0
    );

    const pagoLiquido = Math.max(totalPago - totalEstornado, 0);
    const motivosBloqueio: string[] = [];

    if (itensAtivos.length === 0) {
      motivosBloqueio.push("A guia não possui procedimentos ativos.");
    }

    if (guia.status === "ESTORNO_PENDENTE") {
      motivosBloqueio.push("Existe estorno pendente nesta guia.");
    } else if (
      guia.status !== "PAGA" ||
      pagoLiquido < Number(guia.valorFinal)
    ) {
      motivosBloqueio.push(
        "O pagamento total da guia ainda não foi concluído."
      );
    }

    if (!situacaoCadastroPaciente.completo) {
      motivosBloqueio.push(
        `Cadastro do paciente incompleto: ${situacaoCadastroPaciente.faltantes.join(", ")}.`
      );
    }

    return res.json({
      ...guia,
      organizacao,
      geradaPor,
      elegibilidadeImpressao: {
        podeImprimir: motivosBloqueio.length === 0,
        motivos: motivosBloqueio,
        cadastroPaciente: situacaoCadastroPaciente,
      },
    });
  } catch (erro) {
    console.error("Erro ao carregar guia:", erro);

    return res.status(500).json({
      erro: "Não foi possível carregar a guia.",
    });
  }
});


// ======================================================
// CONFIRMAÇÃO DE REALIZAÇÃO DA GUIA
// ======================================================

app.post("/guias/:id/confirmar-realizacao", async (req, res) => {
  try {
    const guiaId = Number(req.params.id);

    if (!guiaId) {
      return res.status(400).json({
        erro: "ID da guia inválido.",
      });
    }

    const usuarioId = usuarioAtualId();

    const realizadaEmInformada = req.body?.realizadaEm
      ? new Date(req.body.realizadaEm)
      : new Date();

    if (Number.isNaN(realizadaEmInformada.getTime())) {
      return res.status(400).json({
        erro: "Data de realização inválida.",
      });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const guia = await tx.guia.findUnique({
        where: { id: guiaId },
        include: {
          itens: true,
          pagamentos: true,
          estornos: true,
        },
      });

      if (!guia) {
        throw new Error("GUIA_NAO_ENCONTRADA");
      }

      if (guia.confirmadaEm) {
        throw new Error("GUIA_JA_CONFIRMADA");
      }

      const itensAtivos = guia.itens.filter(
        (item) => item.status !== "CANCELADO"
      );

      if (itensAtivos.length === 0) {
        throw new Error("GUIA_SEM_ITENS_ATIVOS");
      }

      const totalPago = guia.pagamentos.reduce(
        (total, pagamento) => total + Number(pagamento.valor),
        0
      );

      const totalEstornado = guia.estornos.reduce(
        (total, estorno) => total + Number(estorno.valor),
        0
      );

      const pagoLiquido = Math.max(
        totalPago - totalEstornado,
        0
      );

      const valorFinal = Number(guia.valorFinal);

      if (
        guia.status !== "PAGA" ||
        pagoLiquido + 0.009 < valorFinal
      ) {
        throw new Error("GUIA_NAO_QUITADA");
      }

      await tx.itemGuia.updateMany({
        where: {
          guiaId,
          status: "ATIVO",
        },
        data: {
          status: "REALIZADO",
        },
      });

      const agora = new Date();

      const guiaConfirmada = await tx.guia.update({
        where: { id: guiaId },
        data: {
          confirmadaPorId: usuarioId,
          confirmadaEm: agora,
          realizadaEm: realizadaEmInformada,
        },
        include: {
          clinica: true,
          confirmadaPor: true,
          itens: {
            include: {
              procedimento: true,
            },
          },
        },
      });

      const guiasDoAtendimento = await tx.guia.findMany({
        where: {
          atendimentoId: guia.atendimentoId,
        },
        include: {
          itens: true,
        },
      });

      const guiasConsideradas = guiasDoAtendimento.filter(
        (guiaAtendimento) =>
          guiaAtendimento.status !== "CANCELADA"
      );

      const todasRealizadas =
        guiasConsideradas.length > 0 &&
        guiasConsideradas.every((guiaAtendimento) => {
          const itensNaoCancelados =
            guiaAtendimento.itens.filter(
              (item) => item.status !== "CANCELADO"
            );

          return (
            itensNaoCancelados.length > 0 &&
            itensNaoCancelados.every(
              (item) => item.status === "REALIZADO"
            )
          );
        });

      if (todasRealizadas) {
        await tx.atendimento.update({
          where: {
            id: guia.atendimentoId,
          },
          data: {
            status: "CONCLUIDO",
            etapaAtual: 5,
          },
        });
      }

      return {
        guia: guiaConfirmada,
        atendimentoConcluido: todasRealizadas,
      };
    });

    return res.json(resultado);
  } catch (erro) {
    console.error(
      "Erro ao confirmar realização da guia:",
      erro
    );

    if (
      erro instanceof Error &&
      erro.message === "GUIA_NAO_ENCONTRADA"
    ) {
      return res.status(404).json({
        erro: "Guia não encontrada.",
      });
    }

    if (
      erro instanceof Error &&
      erro.message === "GUIA_JA_CONFIRMADA"
    ) {
      return res.status(400).json({
        erro: "Esta guia já teve a realização confirmada.",
      });
    }

    if (
      erro instanceof Error &&
      erro.message === "GUIA_SEM_ITENS_ATIVOS"
    ) {
      return res.status(400).json({
        erro: "A guia não possui procedimentos ativos para confirmar.",
      });
    }

    if (
      erro instanceof Error &&
      erro.message === "GUIA_NAO_QUITADA"
    ) {
      return res.status(400).json({
        erro: "A realização só pode ser confirmada após a quitação integral da guia.",
      });
    }

    return res.status(500).json({
      erro: "Não foi possível confirmar a realização da guia.",
    });
  }
});

// ======================================================
// MOVIMENTAÇÕES FINANCEIRAS IMEDIATAS
// ======================================================

app.post("/guias/:id/pagamentos", async (req, res) => {
  try {
    const guiaId = Number(req.params.id);
    const valor = Number(req.body?.valor) || 0;
    const forma = mapearFormaPagamento(req.body?.forma);
    const observacao =
      String(req.body?.observacao || "").trim() || null;

    if (!guiaId) {
      return res.status(400).json({
        erro: "ID da guia inválido.",
      });
    }

    if (valor <= 0) {
      return res.status(400).json({
        erro: "Informe um valor de pagamento válido.",
      });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const guia = await tx.guia.findUnique({
        where: { id: guiaId },
        include: {
          itens: true,
          pagamentos: true,
          estornos: true,
        },
      });

      if (!guia) {
        throw new Error("GUIA_NAO_ENCONTRADA");
      }

      if (
        guia.itens.length > 0 &&
        guia.itens.every((item) => item.status === "CANCELADO")
      ) {
        throw new Error("PAGAMENTO_GUIA_CANCELADA");
      }

      const totalPago = guia.pagamentos.reduce(
        (total, pagamento) =>
          total + Number(pagamento.valor),
        0
      );

      const totalEstornado = guia.estornos.reduce(
        (total, estorno) =>
          total + Number(estorno.valor),
        0
      );

      const pagoLiquido = Math.max(
        totalPago - totalEstornado,
        0
      );

      const saldo = Math.max(
        Number(guia.valorFinal) - pagoLiquido,
        0
      );

      if (valor > saldo + 0.009) {
        throw new Error("PAGAMENTO_SUPERIOR_AO_SALDO");
      }

      const pagamento = await tx.pagamento.create({
        data: {
          guiaId,
          valor,
          forma,
          observacao,
        },
      });

      const financeiro =
        await recalcularStatusFinanceiroGuia(
          tx,
          guiaId
        );

      return {
        pagamento,
        financeiro,
      };
    });

    return res.status(201).json(resultado);
  } catch (erro) {
    console.error("Erro ao registrar pagamento:", erro);

    if (
      erro instanceof Error &&
      erro.message === "GUIA_NAO_ENCONTRADA"
    ) {
      return res.status(404).json({
        erro: "Guia não encontrada.",
      });
    }

    if (
      erro instanceof Error &&
      erro.message === "PAGAMENTO_GUIA_CANCELADA"
    ) {
      return res.status(400).json({
        erro: "Não é permitido registrar pagamento em uma guia cancelada.",
      });
    }

    if (
      erro instanceof Error &&
      erro.message === "PAGAMENTO_SUPERIOR_AO_SALDO"
    ) {
      return res.status(400).json({
        erro: "O pagamento não pode ser maior que o saldo pendente da guia.",
      });
    }

    return res.status(500).json({
      erro: "Não foi possível registrar o pagamento.",
    });
  }
});

app.post("/guias/:id/estornos", async (req, res) => {
  try {
    const guiaId = Number(req.params.id);
    const valor = Number(req.body?.valor) || 0;
    const forma = mapearFormaPagamento(req.body?.forma);
    const motivo =
      String(req.body?.motivo || "").trim() ||
      "Estorno registrado no atendimento.";

    if (!guiaId) {
      return res.status(400).json({
        erro: "ID da guia inválido.",
      });
    }

    if (valor <= 0) {
      return res.status(400).json({
        erro: "Informe um valor de estorno válido.",
      });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const guia = await tx.guia.findUnique({
        where: { id: guiaId },
        include: {
          pagamentos: true,
          estornos: true,
        },
      });

      if (!guia) {
        throw new Error("GUIA_NAO_ENCONTRADA");
      }

      const totalPago = guia.pagamentos.reduce(
        (total, pagamento) =>
          total + Number(pagamento.valor),
        0
      );

      const totalEstornado = guia.estornos.reduce(
        (total, estorno) =>
          total + Number(estorno.valor),
        0
      );

      const disponivel = Math.max(
        totalPago - totalEstornado,
        0
      );

      if (valor > disponivel + 0.009) {
        throw new Error("ESTORNO_SUPERIOR_AO_PAGO");
      }

      const estornos = await registrarEstornoVinculado(
        tx,
        guiaId,
        valor,
        forma,
        motivo
      );

      const financeiro =
        await recalcularStatusFinanceiroGuia(
          tx,
          guiaId
        );

      return {
        estornos,
        financeiro,
      };
    });

    return res.status(201).json(resultado);
  } catch (erro) {
    console.error("Erro ao registrar estorno:", erro);

    if (
      erro instanceof Error &&
      erro.message === "GUIA_NAO_ENCONTRADA"
    ) {
      return res.status(404).json({
        erro: "Guia não encontrada.",
      });
    }

    if (
      erro instanceof Error &&
      erro.message === "ESTORNO_SUPERIOR_AO_PAGO"
    ) {
      return res.status(400).json({
        erro: "O estorno não pode ser maior que o valor líquido recebido.",
      });
    }

    return res.status(500).json({
      erro: "Não foi possível registrar o estorno.",
    });
  }
});


app.get("/estornos/:codigo", async (req, res) => {
  try {
    const codigo = String(req.params.codigo || "").trim();

    if (!codigo) {
      return res.status(400).json({
        erro: "Código do estorno inválido.",
      });
    }

    const estorno = await prisma.estorno.findUnique({
      where: {
        codigoPublico: codigo,
      },
      include: {
        organizacao: true,
        emitidoPor: true,
        pagamento: {
          include: {
            recibos: {
              include: {
                recibo: true,
              },
            },
          },
        },
        guia: {
          include: {
            clinica: true,
            organizacao: true,
            geradaPor: true,
            atendimento: {
              include: {
                paciente: true,
              },
            },
            itens: {
              include: {
                procedimento: true,
              },
            },
          },
        },
      },
    });

    if (!estorno) {
      return res.status(404).json({
        erro: "Estorno não encontrado.",
      });
    }

    return res.json(estorno);
  } catch (erro) {
    console.error("Erro ao carregar estorno:", erro);

    return res.status(500).json({
      erro: "Não foi possível carregar o comprovante de estorno.",
    });
  }
});

app.get("/atendimentos/:id/documentos-financeiros", async (req, res) => {
  try {
    const atendimentoId = Number(req.params.id);

    if (!atendimentoId) {
      return res.status(400).json({
        erro: "ID do atendimento inválido.",
      });
    }

    const atendimento = await prisma.atendimento.findUnique({
      where: {
        id: atendimentoId,
      },
      include: {
        paciente: true,
        guias: {
          include: {
            clinica: true,
            recibos: {
              include: {
                pagamentos: {
                  include: {
                    pagamento: true,
                  },
                },
              },
              orderBy: {
                emitidoEm: "asc",
              },
            },
            estornos: {
              include: {
                pagamento: {
                  include: {
                    recibos: {
                      include: {
                        recibo: true,
                      },
                    },
                  },
                },
                emitidoPor: true,
              },
              orderBy: {
                criadoEm: "asc",
              },
            },
          },
        },
      },
    });

    if (!atendimento) {
      return res.status(404).json({
        erro: "Atendimento não encontrado.",
      });
    }

    const recibos = atendimento.guias.flatMap((guia) =>
      guia.recibos.map((recibo) => ({
        id: recibo.id,
        codigoPublico: recibo.codigoPublico,
        status: recibo.status,
        valorRecebido: recibo.valorRecebido,
        valorEstornado: recibo.valorEstornado,
        emitidoEm: recibo.emitidoEm,
        guiaId: guia.id,
        codigoVoucher: guia.codigoPublico,
        clinica: guia.clinica.nome,
        pagamentos: recibo.pagamentos.map((vinculo) => ({
          id: vinculo.pagamento.id,
          valor: vinculo.pagamento.valor,
          forma: vinculo.pagamento.forma,
          criadoEm: vinculo.pagamento.criadoEm,
        })),
      }))
    );

    const estornos = atendimento.guias.flatMap((guia) =>
      guia.estornos.map((estorno) => {
        const reciboRelacionado =
          estorno.pagamento?.recibos?.[0]?.recibo || null;

        return {
          id: estorno.id,
          codigoPublico: estorno.codigoPublico,
          valor: estorno.valor,
          forma: estorno.forma,
          motivo: estorno.motivo,
          criadoEm: estorno.criadoEm,
          guiaId: guia.id,
          codigoVoucher: guia.codigoPublico,
          clinica: guia.clinica.nome,
          reciboRelacionado: reciboRelacionado
            ? {
                codigoPublico:
                  reciboRelacionado.codigoPublico,
                status:
                  reciboRelacionado.status,
              }
            : null,
          emitidoPor: estorno.emitidoPor
            ? {
                nome: estorno.emitidoPor.nome,
                codigoPublico:
                  estorno.emitidoPor.codigoPublico,
              }
            : null,
        };
      })
    );

    return res.json({
      atendimento: {
        id: atendimento.id,
        codigoPublico: atendimento.codigoPublico,
        paciente: {
          id: atendimento.paciente.id,
          codigoPublico:
            atendimento.paciente.codigoPublico,
          nome: atendimento.paciente.nome,
          cpf: atendimento.paciente.cpf,
        },
      },
      recibos,
      estornos,
    });
  } catch (erro) {
    console.error(
      "Erro ao carregar documentos financeiros:",
      erro
    );

    return res.status(500).json({
      erro: "Não foi possível carregar os documentos financeiros.",
    });
  }
});

// ======================================================
// RECIBOS
// ======================================================

app.post("/guias/:id/recibo", async (req, res) => {
  try {
    const guiaId = Number(req.params.id);

    if (!guiaId) {
      return res.status(400).json({
        erro: "ID da guia inválido.",
      });
    }

    const guia = await prisma.guia.findUnique({
      where: { id: guiaId },
      include: {
        organizacao: true,
        geradaPor: true,
        clinica: true,
        atendimento: {
          include: {
            paciente: true,
          },
        },
        itens: {
          include: {
            procedimento: true,
          },
        },
        pagamentos: {
          include: {
            recibos: true,
            estornos: true,
          },
          orderBy: {
            id: "asc",
          },
        },
        estornos: true,
        recibos: {
          include: {
            pagamentos: {
              include: {
                pagamento: true,
              },
            },
          },
          orderBy: {
            id: "desc",
          },
        },
      },
    });

    if (!guia) {
      return res.status(404).json({
        erro: "Guia não encontrada.",
      });
    }

    const organizacao =
      guia.organizacao ||
      (await prisma.organizacao.findUnique({
        where: { id: organizacaoAtualId() },
      }));

    if (!organizacao) {
      return res.status(400).json({
        erro: "Organização responsável não encontrada.",
      });
    }

    const pagamentoSemRecibo = guia.pagamentos.find(
      (pagamento) => pagamento.recibos.length === 0
    );

    if (!pagamentoSemRecibo) {
      const reciboExistente = guia.recibos[0];

      if (reciboExistente) {
        return res.json(reciboExistente);
      }

      return res.status(400).json({
        erro: "Não existem pagamentos disponíveis para emissão de recibo.",
      });
    }

    const valorRecebido = Number(pagamentoSemRecibo.valor);

    const valorJaEstornado = pagamentoSemRecibo.estornos.reduce(
      (total, estorno) => total + Number(estorno.valor),
      0
    );

    const statusInicialRecibo =
      valorJaEstornado >= valorRecebido
        ? "ESTORNADO"
        : valorJaEstornado > 0
          ? "PARCIALMENTE_ESTORNADO"
          : "ATIVO";

    if (valorRecebido <= 0) {
      return res.status(400).json({
        erro: "Não existe valor recebido para emissão de recibo.",
      });
    }

    const procedimentos = guia.itens
      .filter((item) => item.status !== "CANCELADO")
      .map((item) => item.procedimento.nome)
      .join(" | ");

    const agora = new Date();
    const ano = agora.getFullYear();

    const recibo = await prisma.$transaction(async (tx) => {
      const serie = await tx.serieRecibo.upsert({
        where: {
          organizacaoId: organizacao.id,
        },
        create: {
          organizacaoId: organizacao.id,
          ultimoNumero: 100001,
        },
        update: {
          ultimoNumero: {
            increment: 1,
          },
        },
      });

      const numero = serie.ultimoNumero;
      const codigoPublico =
        `REC-${ano}-${String(numero).padStart(6, "0")}`;

      return tx.recibo.create({
        data: {
          codigoPublico,
          numero,
          ano,
          organizacaoId: organizacao.id,
          guiaId: guia.id,
          emitidoPorId: guia.geradaPorId || usuarioAtualId(),
          status: statusInicialRecibo,
          valorRecebido,
          valorEstornado: valorJaEstornado,

          nomePaciente: guia.atendimento.paciente.nome,
          cpfPaciente: guia.atendimento.paciente.cpf,
          nomeClinica: guia.clinica.nome,
          documentoClinica: guia.clinica.documento,
          nomeOrganizacao: organizacao.nomeFantasia,
          documentoOrganizacao: organizacao.documento,
          descricaoProcedimentos:
            procedimentos || "Procedimentos não informados",

          pagamentos: {
            create: {
              pagamentoId: pagamentoSemRecibo.id,
            },
          },
        },
        include: {
          organizacao: true,
          guia: true,
          emitidoPor: true,
          pagamentos: {
            include: {
              pagamento: true,
            },
          },
        },
      });
    });

    return res.status(201).json(recibo);
  } catch (erro) {
    console.error("Erro ao emitir recibo:", erro);

    return res.status(500).json({
      erro: "Não foi possível emitir o recibo.",
    });
  }
});

app.get("/recibos/:codigo", async (req, res) => {
  try {
    const codigo = String(req.params.codigo || "").trim();

    const recibo = await prisma.recibo.findUnique({
      where: {
        codigoPublico: codigo,
      },
      include: {
        organizacao: true,
        emitidoPor: true,
        pagamentos: {
          include: {
            pagamento: true,
          },
        },
        guia: {
          include: {
            clinica: true,
            atendimento: {
              include: {
                paciente: true,
              },
            },
            itens: {
              include: {
                procedimento: true,
              },
            },
            estornos: true,
          },
        },
      },
    });

    if (!recibo) {
      return res.status(404).json({
        erro: "Recibo não encontrado.",
      });
    }

    return res.json(recibo);
  } catch (erro) {
    console.error("Erro ao carregar recibo:", erro);

    return res.status(500).json({
      erro: "Não foi possível carregar o recibo.",
    });
  }
});


// ======================================================
// FINANCEIRO - VISÃO GERAL V1
// ======================================================

function inicioFimPeriodoFinanceiro(valorInicio: unknown, valorFim: unknown) {
  const formato = /^\d{4}-\d{2}-\d{2}$/;
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const ultimoDia = String(new Date(ano, agora.getMonth() + 1, 0).getDate()).padStart(2, "0");

  const inicioTexto = formato.test(String(valorInicio || ""))
    ? String(valorInicio)
    : `${ano}-${mes}-01`;
  const fimTexto = formato.test(String(valorFim || ""))
    ? String(valorFim)
    : `${ano}-${mes}-${ultimoDia}`;

  const inicio = new Date(`${inicioTexto}T00:00:00-03:00`);
  const fim = new Date(`${fimTexto}T23:59:59.999-03:00`);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || inicio > fim) {
    throw new Error("PERIODO_FINANCEIRO_INVALIDO");
  }

  const maximo = 370 * 24 * 60 * 60 * 1000;
  if (fim.getTime() - inicio.getTime() > maximo) {
    throw new Error("PERIODO_FINANCEIRO_MUITO_LONGO");
  }

  return { inicio, fim, inicioTexto, fimTexto };
}

function dentroDoPeriodoFinanceiro(data: Date | null | undefined, inicio: Date, fim: Date) {
  if (!data) return false;
  const tempo = data.getTime();
  return tempo >= inicio.getTime() && tempo <= fim.getTime();
}

function rotuloFormaPagamentoFinanceiro(forma: string) {
  const rotulos: Record<string, string> = {
    PIX: "Pix",
    DINHEIRO: "Dinheiro",
    CARTAO_CREDITO: "Cartão de crédito",
    CARTAO_DEBITO: "Cartão de débito",
    TRANSFERENCIA: "Transferência",
    OUTRO: "Outro",
  };
  return rotulos[forma] || forma.replaceAll("_", " ");
}

app.get("/financeiro/resumo", async (req, res) => {
  try {
    const { inicio, fim, inicioTexto, fimTexto } = inicioFimPeriodoFinanceiro(
      req.query.inicio,
      req.query.fim
    );

    const clinicaIdRecebida = req.query.clinicaId ? Number(req.query.clinicaId) : null;
    if (clinicaIdRecebida !== null && (!Number.isInteger(clinicaIdRecebida) || clinicaIdRecebida <= 0)) {
      return res.status(400).json({ erro: "Clínica inválida." });
    }

    const organizacaoId = organizacaoAtualId();

    const [guias, clinicas] = await Promise.all([
      prisma.guia.findMany({
        where: {
          AND: [
            {
              OR: [
                { organizacaoId },
                { organizacaoId: null },
              ],
            },
            ...(clinicaIdRecebida ? [{ clinicaId: clinicaIdRecebida }] : []),
          ],
        },
        include: {
          clinica: { select: { id: true, nome: true } },
          atendimento: {
            include: {
              paciente: {
                select: {
                  id: true,
                  codigoPublico: true,
                  nome: true,
                  cpf: true,
                },
              },
            },
          },
          itens: {
            select: {
              id: true,
              status: true,
              valorRepasse: true,
            },
          },
          pagamentos: {
            orderBy: { criadoEm: "asc" },
          },
          estornos: {
            orderBy: { criadoEm: "asc" },
          },
          repasses: {
            include: {
              repasse: {
                select: {
                  id: true,
                  status: true,
                  pagoEm: true,
                  solicitadoEm: true,
                },
              },
            },
          },
        },
        orderBy: { criadoEm: "desc" },
      }),
      prisma.clinica.findMany({
        where: { ativo: true },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      }),
    ]);

    let recebidoBruto = 0;
    let totalEstornos = 0;
    const movimentacoes: Array<{
      id: string;
      tipo: "RECEBIMENTO" | "ESTORNO";
      data: Date;
      valor: number;
      forma: string;
      formaLabel: string;
      observacao: string | null;
      guiaId: number;
      codigoVoucher: string | null;
      pacienteId: number;
      paciente: string;
      clinicaId: number;
      clinica: string;
    }> = [];

    const guiasAReceber: Array<{
      guiaId: number;
      codigoVoucher: string | null;
      pacienteId: number;
      paciente: string;
      clinicaId: number;
      clinica: string;
      valorFinal: number;
      pagoLiquido: number;
      saldo: number;
      criadoEm: Date;
      status: string;
    }> = [];

    const repassesAPagar: Array<{
      guiaId: number;
      codigoVoucher: string | null;
      pacienteId: number;
      paciente: string;
      clinicaId: number;
      clinica: string;
      confirmadoEm: Date;
      valorPrevisto: number;
      valorPago: number;
      saldo: number;
      statusRepasse: string | null;
    }> = [];

    for (const guia of guias) {
      const paciente = guia.atendimento.paciente;

      for (const pagamento of guia.pagamentos) {
        if (!dentroDoPeriodoFinanceiro(pagamento.criadoEm, inicio, fim)) continue;
        const valor = Number(pagamento.valor);
        recebidoBruto += valor;
        movimentacoes.push({
          id: `PAG-${pagamento.id}`,
          tipo: "RECEBIMENTO",
          data: pagamento.criadoEm,
          valor,
          forma: pagamento.forma,
          formaLabel: rotuloFormaPagamentoFinanceiro(pagamento.forma),
          observacao: pagamento.observacao,
          guiaId: guia.id,
          codigoVoucher: guia.codigoPublico,
          pacienteId: paciente.id,
          paciente: paciente.nome,
          clinicaId: guia.clinica.id,
          clinica: guia.clinica.nome,
        });
      }

      for (const estorno of guia.estornos) {
        if (!dentroDoPeriodoFinanceiro(estorno.criadoEm, inicio, fim)) continue;
        const valor = Number(estorno.valor);
        totalEstornos += valor;
        movimentacoes.push({
          id: `EST-${estorno.id}`,
          tipo: "ESTORNO",
          data: estorno.criadoEm,
          valor,
          forma: estorno.forma,
          formaLabel: rotuloFormaPagamentoFinanceiro(estorno.forma),
          observacao: estorno.motivo,
          guiaId: guia.id,
          codigoVoucher: guia.codigoPublico,
          pacienteId: paciente.id,
          paciente: paciente.nome,
          clinicaId: guia.clinica.id,
          clinica: guia.clinica.nome,
        });
      }

      const totalPagoGuia = guia.pagamentos.reduce(
        (total, pagamento) => total + Number(pagamento.valor),
        0
      );
      const totalEstornadoGuia = guia.estornos.reduce(
        (total, estorno) => total + Number(estorno.valor),
        0
      );
      const pagoLiquidoGuia = Math.max(totalPagoGuia - totalEstornadoGuia, 0);
      const valorFinal = Number(guia.valorFinal);
      const saldoGuia = Math.max(valorFinal - pagoLiquidoGuia, 0);

      if (
        dentroDoPeriodoFinanceiro(guia.criadoEm, inicio, fim) &&
        guia.status !== "CANCELADA" &&
        saldoGuia > 0.009
      ) {
        guiasAReceber.push({
          guiaId: guia.id,
          codigoVoucher: guia.codigoPublico,
          pacienteId: paciente.id,
          paciente: paciente.nome,
          clinicaId: guia.clinica.id,
          clinica: guia.clinica.nome,
          valorFinal,
          pagoLiquido: pagoLiquidoGuia,
          saldo: saldoGuia,
          criadoEm: guia.criadoEm,
          status: guia.status,
        });
      }

      const confirmadoEm = guia.confirmadaEm || guia.realizadaEm;
      if (confirmadoEm && dentroDoPeriodoFinanceiro(confirmadoEm, inicio, fim)) {
        const valorPrevisto = guia.itens
          .filter((item) => item.status !== "CANCELADO")
          .reduce((total, item) => total + Number(item.valorRepasse), 0);

        const valorRepassePago = guia.repasses
          .filter((item) => item.repasse.status === "PAGO")
          .reduce((total, item) => total + Number(item.valor), 0);

        const saldoRepasse = Math.max(valorPrevisto - valorRepassePago, 0);
        const repasseAberto = guia.repasses.find((item) => !["PAGO", "RECUSADO"].includes(item.repasse.status));

        if (saldoRepasse > 0.009) {
          repassesAPagar.push({
            guiaId: guia.id,
            codigoVoucher: guia.codigoPublico,
            pacienteId: paciente.id,
            paciente: paciente.nome,
            clinicaId: guia.clinica.id,
            clinica: guia.clinica.nome,
            confirmadoEm,
            valorPrevisto,
            valorPago: valorRepassePago,
            saldo: saldoRepasse,
            statusRepasse: repasseAberto?.repasse.status || null,
          });
        }
      }
    }

    movimentacoes.sort((a, b) => b.data.getTime() - a.data.getTime());
    guiasAReceber.sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
    repassesAPagar.sort((a, b) => b.confirmadoEm.getTime() - a.confirmadoEm.getTime());

    const valorAReceber = guiasAReceber.reduce((total, guia) => total + guia.saldo, 0);
    const valorRepassesAPagar = repassesAPagar.reduce((total, guia) => total + guia.saldo, 0);

    return res.json({
      periodo: { inicio: inicioTexto, fim: fimTexto },
      filtro: { clinicaId: clinicaIdRecebida },
      resumo: {
        recebidoBruto,
        estornos: totalEstornos,
        recebidoLiquido: recebidoBruto - totalEstornos,
        aReceber: valorAReceber,
        repassesAPagar: valorRepassesAPagar,
        quantidadeRecebimentos: movimentacoes.filter((item) => item.tipo === "RECEBIMENTO").length,
        quantidadeEstornos: movimentacoes.filter((item) => item.tipo === "ESTORNO").length,
        quantidadeGuiasAReceber: guiasAReceber.length,
        quantidadeRepassesAPagar: repassesAPagar.length,
      },
      clinicas,
      movimentacoes: movimentacoes.slice(0, 150),
      guiasAReceber: guiasAReceber.slice(0, 100),
      repassesAPagar: repassesAPagar.slice(0, 100),
      limites: {
        movimentacoes: 150,
        guiasAReceber: 100,
        repassesAPagar: 100,
      },
    });
  } catch (erro) {
    console.error("Erro ao carregar resumo financeiro:", erro);

    if (erro instanceof Error && erro.message === "PERIODO_FINANCEIRO_INVALIDO") {
      return res.status(400).json({ erro: "Informe um período financeiro válido." });
    }
    if (erro instanceof Error && erro.message === "PERIODO_FINANCEIRO_MUITO_LONGO") {
      return res.status(400).json({ erro: "O período financeiro pode ter no máximo 370 dias." });
    }

    return res.status(500).json({
      erro: "Não foi possível carregar o painel financeiro.",
    });
  }
});


// ======================================================
// FINANCEIRO - CONTROLE DE REPASSES V1
// Base preparada para o futuro Portal Parceiro (V2).
// ======================================================

function dataIsoSaoPaulo(data = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);

  const ano = partes.find((parte) => parte.type === "year")?.value || "1970";
  const mes = partes.find((parte) => parte.type === "month")?.value || "01";
  const dia = partes.find((parte) => parte.type === "day")?.value || "01";
  return `${ano}-${mes}-${dia}`;
}

function adicionarDiasIso(dataIso: string, dias: number) {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias, 12, 0, 0));
  return data.toISOString().slice(0, 10);
}

function dataRepasseRecebida(valor: unknown) {
  const texto = String(valor || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const data = new Date(`${texto}T12:00:00-03:00`);
  return Number.isNaN(data.getTime()) ? null : { texto, data };
}

async function gerarCodigoPublicoRepasse() {
  for (let tentativa = 0; tentativa < 30; tentativa += 1) {
    const codigo = `REP-${dataCodigo()}-${blocoAleatorioNumerico(6)}`;
    const existente = await prisma.repasse.findUnique({
      where: { codigoPublico: codigo },
      select: { id: true },
    });
    if (!existente) return codigo;
  }
  throw new Error("Não foi possível gerar código público único para o repasse.");
}

function rotuloStatusRepasse(status: string) {
  const mapa: Record<string, string> = {
    DISPONIVEL: "Disponível",
    SOLICITADO: "Solicitado",
    EM_ANALISE: "Em análise",
    APROVADO: "Aprovado",
    PAGO: "Pago",
    RECUSADO: "Recusado",
  };
  return mapa[status] || status.replaceAll("_", " ");
}

function rotuloFormaPagamentoRepasse(forma: string | null) {
  const mapa: Record<string, string> = {
    PIX: "PIX",
    TRANSFERENCIA: "Transferência / TED / DOC",
    BOLETO: "Boleto",
    DINHEIRO: "Dinheiro",
    OUTRO: "Outro",
  };
  return forma ? mapa[forma] || forma.replaceAll("_", " ") : null;
}

function percentualDocumentacaoRepasse(documentos: Array<{ tipo: string }>) {
  const tipos = new Set(documentos.map((documento) => documento.tipo));
  let percentual = 0;
  if (tipos.has("COMPROVANTE_PAGAMENTO")) percentual += 50;
  if (tipos.has("NOTA_FISCAL_SERVICO")) percentual += 50;
  return percentual;
}

function arquivosRecebidosRepasse(req: express.Request) {
  const arquivos = (req.files || {}) as Record<string, any[]>;
  return {
    comprovante: arquivos.comprovante?.[0] || null,
    notaFiscal: arquivos.notaFiscal?.[0] || null,
  };
}

async function salvarDocumentoRepasse(
  tx: any,
  repasseId: number,
  tipo: "COMPROVANTE_PAGAMENTO" | "NOTA_FISCAL_SERVICO",
  arquivo: any,
  usuarioId: number
) {
  const agora = new Date();

  await tx.documentoRepasse.updateMany({
    where: {
      repasseId,
      tipo,
      ativo: true,
    },
    data: {
      ativo: false,
      desativadoEm: agora,
      desativadoPorId: usuarioId,
    },
  });

  return tx.documentoRepasse.create({
    data: {
      repasseId,
      tipo,
      nomeOriginal: String(arquivo.originalname || "documento"),
      mimeType: String(arquivo.mimetype || "application/octet-stream"),
      tamanhoBytes: Number(arquivo.size || arquivo.buffer?.length || 0),
      conteudo: arquivo.buffer,
      ativo: true,
      enviadoPorId: usuarioId,
    },
  });
}

function erroUploadDocumentoRepasse(erro: unknown) {
  if (erro instanceof multer.MulterError) {
    if (erro.code === "LIMIT_FILE_SIZE") {
      return "Cada arquivo pode ter no máximo 10 MB.";
    }
    if (erro.code === "LIMIT_FILE_COUNT") {
      return "Envie no máximo um comprovante e uma nota fiscal por vez.";
    }
    return "Não foi possível receber os documentos do repasse.";
  }

  return erro instanceof Error
    ? erro.message
    : "Não foi possível receber os documentos do repasse.";
}

app.get("/financeiro/repasses", async (req, res) => {
  try {
    const organizacaoId = organizacaoAtualId();
    const clinicaId = req.query.clinicaId ? Number(req.query.clinicaId) : null;
    const status = String(req.query.status || "TODOS").trim().toUpperCase();
    const visao = String(req.query.visao || "PENDENTES").trim().toUpperCase();
    const busca = String(req.query.busca || "").trim().slice(0, 120);
    const pagina = Math.max(Number(req.query.pagina) || 1, 1);
    const porPagina = Math.min(Math.max(Number(req.query.porPagina) || 25, 10), 50);
    const statusValidos = ["TODOS", "SOLICITADO", "EM_ANALISE", "APROVADO", "PAGO", "RECUSADO"];

    if (clinicaId !== null && (!Number.isInteger(clinicaId) || clinicaId <= 0)) {
      return res.status(400).json({ erro: "Clínica inválida." });
    }
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ erro: "Status de repasse inválido." });
    }
    if (!["PENDENTES", "HISTORICO"].includes(visao)) {
      return res.status(400).json({ erro: "Visualização de repasses inválida." });
    }

    const statusDaVisao = visao === "HISTORICO"
      ? ["PAGO", "RECUSADO"]
      : ["SOLICITADO", "EM_ANALISE", "APROVADO"];

    const filtrosRepasse: any[] = [
      { OR: [{ organizacaoId }, { organizacaoId: null }] },
      { status: { in: statusDaVisao } },
    ];

    if (clinicaId) filtrosRepasse.push({ clinicaId });
    if (status !== "TODOS") filtrosRepasse.push({ status });
    if (busca) {
      const buscaNumerica = busca.replace(/\D/g, "");
      const opcoesBusca: any[] = [
        { codigoPublico: { contains: busca, mode: "insensitive" } },
        { clinica: { nome: { contains: busca, mode: "insensitive" } } },
        {
          itens: {
            some: {
              guia: {
                codigoPublico: { contains: busca, mode: "insensitive" },
              },
            },
          },
        },
        {
          itens: {
            some: {
              guia: {
                atendimento: {
                  paciente: {
                    nome: { contains: busca, mode: "insensitive" },
                  },
                },
              },
            },
          },
        },
      ];

      if (buscaNumerica) {
        opcoesBusca.push({
          itens: {
            some: {
              guia: {
                atendimento: {
                  paciente: { cpf: { contains: buscaNumerica } },
                },
              },
            },
          },
        });
      }

      filtrosRepasse.push({ OR: opcoesBusca });
    }

    const whereRepasses: any = { AND: filtrosRepasse };

    const [clinicas, guiasConfirmadas, repasses, totalRepasses] = await Promise.all([
      prisma.clinica.findMany({
        where: { ativo: true },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      }),
      prisma.guia.findMany({
        where: {
          AND: [
            { OR: [{ organizacaoId }, { organizacaoId: null }] },
            { status: { not: "CANCELADA" } },
            { OR: [{ confirmadaEm: { not: null } }, { realizadaEm: { not: null } }] },
          ],
        },
        include: {
          clinica: { select: { id: true, nome: true } },
          atendimento: {
            include: {
              paciente: { select: { id: true, nome: true, cpf: true, codigoPublico: true } },
            },
          },
          itens: {
            select: { id: true, status: true, valorRepasse: true },
          },
          repasses: {
            include: { repasse: { select: { id: true, status: true, codigoPublico: true } } },
          },
        },
        orderBy: [{ confirmadaEm: "desc" }, { realizadaEm: "desc" }, { criadoEm: "desc" }],
        take: 500,
      }),
      prisma.repasse.findMany({
        where: whereRepasses,
        include: {
          clinica: { select: { id: true, nome: true } },
          solicitadoPor: { select: { id: true, nome: true } },
          aprovadoPor: { select: { id: true, nome: true } },
          recusadoPor: { select: { id: true, nome: true } },
          pagoPor: { select: { id: true, nome: true } },
          documentos: {
            where: { ativo: true },
            select: {
              id: true,
              tipo: true,
              nomeOriginal: true,
              mimeType: true,
              tamanhoBytes: true,
              criadoEm: true,
              enviadoPor: { select: { nome: true } },
            },
            orderBy: { criadoEm: "desc" },
          },
          itens: {
            include: {
              guia: {
                include: {
                  atendimento: {
                    include: { paciente: { select: { id: true, nome: true } } },
                  },
                },
              },
            },
          },
        },
        orderBy: visao === "HISTORICO"
          ? [{ atualizadoEm: "desc" }]
          : [{ dataPagamentoSolicitada: "asc" }, { solicitadoEm: "asc" }],
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      prisma.repasse.count({ where: whereRepasses }),
    ]);

    const disponiveis = guiasConfirmadas.flatMap((guia) => {
      const possuiRepasseAtivo = guia.repasses.some(
        (item) => item.repasse.status !== "RECUSADO"
      );
      if (possuiRepasseAtivo) return [];

      const valorRepasse = guia.itens
        .filter((item) => item.status !== "CANCELADO")
        .reduce((total, item) => total + Number(item.valorRepasse), 0);

      if (valorRepasse <= 0.009) return [];

      return [{
        guiaId: guia.id,
        codigoVoucher: guia.codigoPublico,
        pacienteId: guia.atendimento.paciente.id,
        paciente: guia.atendimento.paciente.nome,
        clinicaId: guia.clinica.id,
        clinica: guia.clinica.nome,
        confirmadoEm: guia.confirmadaEm || guia.realizadaEm || guia.criadoEm,
        valorRepasse,
      }];
    });

    const lista = repasses.map((repasse) => ({
      id: repasse.id,
      codigoPublico: repasse.codigoPublico || `REP-${repasse.id}`,
      clinicaId: repasse.clinica.id,
      clinica: repasse.clinica.nome,
      status: repasse.status,
      statusLabel: rotuloStatusRepasse(repasse.status),
      origem: repasse.origem,
      valorTotal: Number(repasse.valorTotal),
      dataPagamentoSolicitada: repasse.dataPagamentoSolicitada,
      solicitadoEm: repasse.solicitadoEm,
      emAnaliseEm: repasse.emAnaliseEm,
      aprovadoEm: repasse.aprovadoEm,
      recusadoEm: repasse.recusadoEm,
      pagoEm: repasse.pagoEm,
      dataPagamentoEfetivo: repasse.dataPagamentoEfetivo,
      formaPagamento: repasse.formaPagamento,
      formaPagamentoLabel: rotuloFormaPagamentoRepasse(repasse.formaPagamento),
      observacaoPagamento: repasse.observacaoPagamento,
      motivoRecusa: repasse.motivoRecusa,
      observacoes: repasse.observacoes,
      solicitadoPor: repasse.solicitadoPor?.nome || null,
      aprovadoPor: repasse.aprovadoPor?.nome || null,
      recusadoPor: repasse.recusadoPor?.nome || null,
      pagoPor: repasse.pagoPor?.nome || null,
      quantidadeGuias: repasse.itens.length,
      percentualDocumentacao: percentualDocumentacaoRepasse(repasse.documentos),
      documentos: repasse.documentos.map((documento) => ({
        id: documento.id,
        tipo: documento.tipo,
        nomeOriginal: documento.nomeOriginal,
        mimeType: documento.mimeType,
        tamanhoBytes: documento.tamanhoBytes,
        criadoEm: documento.criadoEm,
        enviadoPor: documento.enviadoPor?.nome || null,
      })),
      itens: repasse.itens.map((item) => ({
        id: item.id,
        guiaId: item.guia.id,
        atendimentoId: item.guia.atendimento.id,
        codigoVoucher: item.guia.codigoPublico,
        codigoAtendimento: item.guia.atendimento.codigoPublico,
        paciente: item.guia.atendimento.paciente.nome,
        valor: Number(item.valor),
        confirmadoEm: item.guia.confirmadaEm || item.guia.realizadaEm || item.guia.criadoEm,
      })),
    }));

    const todosRepassesOrganizacao = await prisma.repasse.findMany({
      where: { OR: [{ organizacaoId }, { organizacaoId: null }] },
      select: { status: true, valorTotal: true },
    });

    const soma = (statuses: string[]) =>
      todosRepassesOrganizacao
        .filter((repasse) => statuses.includes(repasse.status))
        .reduce((total, repasse) => total + Number(repasse.valorTotal), 0);

    return res.json({
      clinicas,
      limitesDataPagamento: {
        minimo: adicionarDiasIso(dataIsoSaoPaulo(), 1),
        maximo: adicionarDiasIso(dataIsoSaoPaulo(), 7),
      },
      resumo: {
        disponivel: disponiveis.reduce((total, guia) => total + guia.valorRepasse, 0),
        quantidadeDisponivel: disponiveis.length,
        emSolicitacao: soma(["SOLICITADO", "EM_ANALISE"]),
        aprovado: soma(["APROVADO"]),
        pago: soma(["PAGO"]),
      },
      guiasDisponiveis: disponiveis,
      repasses: lista,
      paginacao: {
        pagina,
        porPagina,
        total: totalRepasses,
        totalPaginas: Math.max(Math.ceil(totalRepasses / porPagina), 1),
      },
    });
  } catch (erro) {
    console.error("Erro ao carregar repasses:", erro);
    return res.status(500).json({ erro: "Não foi possível carregar o controle de repasses." });
  }
});

app.get("/financeiro/repasses/itens/:itemId/atendimento", async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ erro: "Item de repasse inválido." });
    }

    const organizacaoId = organizacaoAtualId();
    const item = await prisma.repasseItem.findFirst({
      where: {
        id: itemId,
        repasse: { OR: [{ organizacaoId }, { organizacaoId: null }] },
      },
      include: {
        repasse: {
          include: { clinica: { select: { id: true, nome: true } } },
        },
        guia: {
          include: {
            clinica: { select: { id: true, nome: true } },
            unidadeClinica: true,
            atendimento: {
              include: {
                paciente: true,
              },
            },
            itens: {
              include: { procedimento: true },
              orderBy: { id: "asc" },
            },
            pagamentos: true,
            estornos: true,
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ erro: "Atendimento do repasse não encontrado." });
    }

    const totalPago = item.guia.pagamentos.reduce(
      (total, pagamento) => total + Number(pagamento.valor),
      0
    );
    const totalEstornado = item.guia.estornos.reduce(
      (total, estorno) => total + Number(estorno.valor),
      0
    );
    const pagoLiquido = Math.max(totalPago - totalEstornado, 0);

    return res.json({
      repasse: {
        id: item.repasse.id,
        codigoPublico: item.repasse.codigoPublico || `REP-${item.repasse.id}`,
        status: item.repasse.status,
        statusLabel: rotuloStatusRepasse(item.repasse.status),
        clinica: item.repasse.clinica.nome,
        valorItem: Number(item.valor),
      },
      atendimento: {
        id: item.guia.atendimento.id,
        codigoPublico: item.guia.atendimento.codigoPublico,
        status: item.guia.atendimento.status,
        etapaAtual: item.guia.atendimento.etapaAtual,
        criadoEm: item.guia.atendimento.criadoEm,
        paciente: {
          id: item.guia.atendimento.paciente.id,
          codigoPublico: item.guia.atendimento.paciente.codigoPublico,
          nome: item.guia.atendimento.paciente.nome,
          cpf: item.guia.atendimento.paciente.cpf,
          telefone: item.guia.atendimento.paciente.telefone,
          email: item.guia.atendimento.paciente.email,
        },
      },
      guia: {
        id: item.guia.id,
        codigoPublico: item.guia.codigoPublico,
        status: item.guia.status,
        clinica: item.guia.clinica.nome,
        unidade: item.guia.unidadeClinica
          ? {
              id: item.guia.unidadeClinica.id,
              nome: item.guia.unidadeClinica.nome,
              cidade: item.guia.unidadeClinica.cidade,
              uf: item.guia.unidadeClinica.uf,
            }
          : null,
        confirmadaEm: item.guia.confirmadaEm,
        realizadaEm: item.guia.realizadaEm,
        emitidaEm: item.guia.emitidaEm,
        validadeAte: item.guia.validadeAte,
        financeiro: {
          subtotal: Number(item.guia.subtotal),
          desconto: Number(item.guia.desconto),
          beneficio: Number(item.guia.beneficio),
          valorFinal: Number(item.guia.valorFinal),
          totalPago,
          totalEstornado,
          pagoLiquido,
          saldo: Math.max(Number(item.guia.valorFinal) - pagoLiquido, 0),
          valorRepasse: Number(item.valor),
        },
        procedimentos: item.guia.itens.map((guiaItem) => ({
          id: guiaItem.id,
          status: guiaItem.status,
          procedimento: guiaItem.procedimento.nome,
          valorPaciente: Number(guiaItem.valorPaciente),
          valorRepasse: Number(guiaItem.valorRepasse),
          tipoAgendamento: guiaItem.tipoAgendamento,
          dataAgendamento: guiaItem.dataAgendamento,
          horarioAgendamento: guiaItem.horarioAgendamento,
          motivoCancelamento: guiaItem.motivoCancelamento,
        })),
      },
    });
  } catch (erro) {
    console.error("Erro ao carregar atendimento para análise do repasse:", erro);
    return res.status(500).json({ erro: "Não foi possível carregar os detalhes do atendimento." });
  }
});

app.get("/financeiro/repasses/:id/documentos/:documentoId", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const documentoId = Number(req.params.documentoId);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(documentoId) || documentoId <= 0) {
      return res.status(400).json({ erro: "Documento inválido." });
    }

    const organizacaoId = organizacaoAtualId();
    const documento = await prisma.documentoRepasse.findFirst({
      where: {
        id: documentoId,
        repasseId: id,
        repasse: { OR: [{ organizacaoId }, { organizacaoId: null }] },
      },
      select: {
        id: true,
        nomeOriginal: true,
        mimeType: true,
        conteudo: true,
      },
    });

    if (!documento) {
      return res.status(404).json({ erro: "Documento não encontrado." });
    }

    const nomeSeguro = documento.nomeOriginal
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/[\r\n"]/g, "_");
    res.setHeader("Content-Type", documento.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${nomeSeguro}"; filename*=UTF-8''${encodeURIComponent(documento.nomeOriginal)}`
    );
    return res.send(Buffer.from(documento.conteudo));
  } catch (erro) {
    console.error("Erro ao abrir documento do repasse:", erro);
    return res.status(500).json({ erro: "Não foi possível abrir o documento." });
  }
});

app.post("/financeiro/repasses", async (req, res) => {
  try {
    const guiaIds: number[] = Array.isArray(req.body?.guiaIds)
      ? Array.from(
          new Set<number>(
            req.body.guiaIds
              .map((id: unknown) => Number(id))
              .filter((id: number) => Number.isInteger(id) && id > 0)
          )
        )
      : [];

    if (guiaIds.length === 0 || guiaIds.length > 100) {
      return res.status(400).json({ erro: "Selecione entre 1 e 100 guias para o repasse." });
    }

    const dataPagamento = dataRepasseRecebida(req.body?.dataPagamentoSolicitada);
    if (!dataPagamento) {
      return res.status(400).json({ erro: "Informe uma data válida para o pagamento solicitado." });
    }

    const hoje = dataIsoSaoPaulo();
    const minimo = adicionarDiasIso(hoje, 1);
    const maximo = adicionarDiasIso(hoje, 7);
    if (dataPagamento.texto < minimo || dataPagamento.texto > maximo) {
      return res.status(400).json({
        erro: `A data solicitada deve ficar entre ${minimo.split("-").reverse().join("/")} e ${maximo.split("-").reverse().join("/")}.`,
      });
    }

    const organizacaoId = organizacaoAtualId();
    const guias = await prisma.guia.findMany({
      where: {
        id: { in: guiaIds },
        OR: [{ organizacaoId }, { organizacaoId: null }],
      },
      include: {
        clinica: { select: { id: true, nome: true } },
        itens: { select: { status: true, valorRepasse: true } },
        repasses: { include: { repasse: { select: { id: true, status: true } } } },
      },
    });

    if (guias.length !== guiaIds.length) {
      return res.status(404).json({ erro: "Uma ou mais guias selecionadas não foram encontradas." });
    }

    const clinicaId = guias[0].clinicaId;
    if (guias.some((guia) => guia.clinicaId !== clinicaId)) {
      return res.status(400).json({ erro: "Um repasse só pode conter guias da mesma clínica." });
    }

    const itensRepasse: Array<{ guiaId: number; valor: number }> = [];
    for (const guia of guias) {
      if (!guia.confirmadaEm && !guia.realizadaEm) {
        return res.status(409).json({ erro: `A guia ${guia.codigoPublico || guia.id} ainda não foi confirmada pela clínica.` });
      }
      if (guia.status === "CANCELADA") {
        return res.status(409).json({ erro: `A guia ${guia.codigoPublico || guia.id} está cancelada.` });
      }
      if (guia.repasses.some((item) => item.repasse.status !== "RECUSADO")) {
        return res.status(409).json({ erro: `A guia ${guia.codigoPublico || guia.id} já pertence a um repasse em andamento ou pago.` });
      }

      const valor = guia.itens
        .filter((item) => item.status !== "CANCELADO")
        .reduce((total, item) => total + Number(item.valorRepasse), 0);
      if (valor <= 0.009) {
        return res.status(409).json({ erro: `A guia ${guia.codigoPublico || guia.id} não possui valor de repasse disponível.` });
      }
      itensRepasse.push({ guiaId: guia.id, valor });
    }

    const valorTotal = itensRepasse.reduce((total, item) => total + item.valor, 0);
    const codigoPublico = await gerarCodigoPublicoRepasse();
    const observacoes = String(req.body?.observacoes || "").trim().slice(0, 2000) || null;
    const agora = new Date();

    const criado = await prisma.repasse.create({
      data: {
        codigoPublico,
        organizacaoId,
        clinicaId,
        status: "EM_ANALISE",
        origem: "INTERNO",
        valorTotal,
        dataPagamentoSolicitada: dataPagamento.data,
        solicitadoPorId: usuarioAtualId(),
        emAnaliseEm: agora,
        observacoes,
        itens: {
          create: itensRepasse.map((item) => ({
            guiaId: item.guiaId,
            valor: item.valor,
          })),
        },
      },
      include: { clinica: { select: { nome: true } } },
    });

    return res.status(201).json({
      id: criado.id,
      codigoPublico: criado.codigoPublico,
      status: criado.status,
      clinica: criado.clinica.nome,
      valorTotal: Number(criado.valorTotal),
    });
  } catch (erro) {
    console.error("Erro ao criar repasse:", erro);
    return res.status(500).json({ erro: "Não foi possível criar a solicitação de repasse." });
  }
});

app.patch("/financeiro/repasses/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "Repasse inválido." });
    }

    const destino = String(req.body?.status || "").trim().toUpperCase();
    if (!["EM_ANALISE", "APROVADO", "RECUSADO"].includes(destino)) {
      return res.status(400).json({ erro: "Novo status de repasse inválido." });
    }

    const organizacaoId = organizacaoAtualId();
    const repasse = await prisma.repasse.findFirst({
      where: { id, OR: [{ organizacaoId }, { organizacaoId: null }] },
    });
    if (!repasse) {
      return res.status(404).json({ erro: "Repasse não encontrado." });
    }

    const transicoes: Record<string, string[]> = {
      SOLICITADO: ["EM_ANALISE", "APROVADO", "RECUSADO"],
      EM_ANALISE: ["APROVADO", "RECUSADO"],
      APROVADO: [],
      PAGO: [],
      RECUSADO: [],
      DISPONIVEL: ["SOLICITADO"],
    };

    if (!(transicoes[repasse.status] || []).includes(destino)) {
      return res.status(409).json({
        erro: `Não é possível alterar o repasse de ${rotuloStatusRepasse(repasse.status)} para ${rotuloStatusRepasse(destino)}.`,
      });
    }

    const agora = new Date();
    const usuarioId = usuarioAtualId();
    const motivoRecusa = String(req.body?.motivoRecusa || "").trim().slice(0, 500);
    if (destino === "RECUSADO" && motivoRecusa.length < 3) {
      return res.status(400).json({ erro: "Informe o motivo da recusa." });
    }

    const data: Record<string, unknown> = { status: destino };
    if (destino === "EM_ANALISE") data.emAnaliseEm = agora;
    if (destino === "APROVADO") {
      data.aprovadoEm = agora;
      data.aprovadoPorId = usuarioId;
    }
    if (destino === "RECUSADO") {
      data.recusadoEm = agora;
      data.recusadoPorId = usuarioId;
      data.motivoRecusa = motivoRecusa;
    }

    const atualizado = await prisma.repasse.update({
      where: { id },
      data: data as any,
      include: { clinica: { select: { nome: true } } },
    });

    return res.json({
      id: atualizado.id,
      codigoPublico: atualizado.codigoPublico,
      status: atualizado.status,
      clinica: atualizado.clinica.nome,
      valorTotal: Number(atualizado.valorTotal),
    });
  } catch (erro) {
    console.error("Erro ao atualizar repasse:", erro);
    return res.status(500).json({ erro: "Não foi possível atualizar o repasse." });
  }
});

app.post("/financeiro/repasses/:id/pagamento", (req, res) => {
  uploadDocumentosRepasse(req, res, async (erro: unknown) => {
    if (erro) {
      return res.status(400).json({ erro: erroUploadDocumentoRepasse(erro) });
    }

    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ erro: "Repasse inválido." });
      }

      const dataPagamento = dataRepasseRecebida(req.body?.dataPagamento);
      if (!dataPagamento) {
        return res.status(400).json({ erro: "Informe a data efetiva do pagamento." });
      }

      const formaPagamento = String(req.body?.formaPagamento || "").trim().toUpperCase();
      const formasValidas = ["PIX", "TRANSFERENCIA", "BOLETO", "DINHEIRO", "OUTRO"];
      if (!formasValidas.includes(formaPagamento)) {
        return res.status(400).json({ erro: "Informe a forma de pagamento do repasse." });
      }

      const observacaoPagamento = String(req.body?.observacaoPagamento || "").trim().slice(0, 2000) || null;
      const organizacaoId = organizacaoAtualId();
      const usuarioId = usuarioAtualId();
      const repasse = await prisma.repasse.findFirst({
        where: { id, OR: [{ organizacaoId }, { organizacaoId: null }] },
      });

      if (!repasse) {
        return res.status(404).json({ erro: "Repasse não encontrado." });
      }
      if (!["APROVADO", "PAGO"].includes(repasse.status)) {
        return res.status(409).json({ erro: "O repasse precisa estar aprovado para registrar o pagamento." });
      }

      const arquivos = arquivosRecebidosRepasse(req);
      const agora = new Date();

      await prisma.$transaction(async (tx) => {
        const dadosAtualizacao: any = {
          dataPagamentoEfetivo: dataPagamento.data,
          formaPagamento: formaPagamento as any,
          observacaoPagamento,
        };

        if (repasse.status === "APROVADO") {
          dadosAtualizacao.status = "PAGO";
          dadosAtualizacao.pagoEm = agora;
          dadosAtualizacao.pagoPorId = usuarioId;
        }

        await tx.repasse.update({
          where: { id },
          data: dadosAtualizacao,
        });

        if (arquivos.comprovante) {
          await salvarDocumentoRepasse(
            tx,
            id,
            "COMPROVANTE_PAGAMENTO",
            arquivos.comprovante,
            usuarioId
          );
        }
        if (arquivos.notaFiscal) {
          await salvarDocumentoRepasse(
            tx,
            id,
            "NOTA_FISCAL_SERVICO",
            arquivos.notaFiscal,
            usuarioId
          );
        }
      });

      return res.json({
        id,
        status: "PAGO",
        mensagem: repasse.status === "PAGO"
          ? "Dados do pagamento atualizados com sucesso."
          : "Pagamento do repasse registrado com sucesso.",
      });
    } catch (erroInterno) {
      console.error("Erro ao registrar pagamento do repasse:", erroInterno);
      return res.status(500).json({ erro: "Não foi possível registrar o pagamento do repasse." });
    }
  });
});

app.post("/financeiro/repasses/:id/documentos", (req, res) => {
  uploadDocumentosRepasse(req, res, async (erro: unknown) => {
    if (erro) {
      return res.status(400).json({ erro: erroUploadDocumentoRepasse(erro) });
    }

    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ erro: "Repasse inválido." });
      }

      const organizacaoId = organizacaoAtualId();
      const repasse = await prisma.repasse.findFirst({
        where: { id, OR: [{ organizacaoId }, { organizacaoId: null }] },
        select: { id: true, status: true },
      });
      if (!repasse) {
        return res.status(404).json({ erro: "Repasse não encontrado." });
      }
      if (repasse.status === "RECUSADO") {
        return res.status(409).json({ erro: "Não é permitido anexar documentos a um repasse recusado." });
      }

      const arquivos = arquivosRecebidosRepasse(req);
      if (!arquivos.comprovante && !arquivos.notaFiscal) {
        return res.status(400).json({ erro: "Selecione ao menos um documento para anexar." });
      }

      const usuarioId = usuarioAtualId();
      await prisma.$transaction(async (tx) => {
        if (arquivos.comprovante) {
          await salvarDocumentoRepasse(
            tx,
            id,
            "COMPROVANTE_PAGAMENTO",
            arquivos.comprovante,
            usuarioId
          );
        }
        if (arquivos.notaFiscal) {
          await salvarDocumentoRepasse(
            tx,
            id,
            "NOTA_FISCAL_SERVICO",
            arquivos.notaFiscal,
            usuarioId
          );
        }
      });

      return res.json({ mensagem: "Documentos do repasse atualizados com sucesso." });
    } catch (erroInterno) {
      console.error("Erro ao anexar documentos do repasse:", erroInterno);
      return res.status(500).json({ erro: "Não foi possível anexar os documentos do repasse." });
    }
  });
});

app.delete("/financeiro/repasses/:id/documentos/:documentoId", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const documentoId = Number(req.params.documentoId);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(documentoId) || documentoId <= 0) {
      return res.status(400).json({ erro: "Documento inválido." });
    }

    const organizacaoId = organizacaoAtualId();
    const documento = await prisma.documentoRepasse.findFirst({
      where: {
        id: documentoId,
        repasseId: id,
        ativo: true,
        repasse: { OR: [{ organizacaoId }, { organizacaoId: null }] },
      },
      select: { id: true },
    });

    if (!documento) {
      return res.status(404).json({ erro: "Documento ativo não encontrado." });
    }

    await prisma.documentoRepasse.update({
      where: { id: documentoId },
      data: {
        ativo: false,
        desativadoEm: new Date(),
        desativadoPorId: usuarioAtualId(),
      },
    });

    return res.json({ mensagem: "Documento removido do repasse. O registro foi preservado para auditoria." });
  } catch (erro) {
    console.error("Erro ao remover documento do repasse:", erro);
    return res.status(500).json({ erro: "Não foi possível remover o documento do repasse." });
  }
});




// ======================================================
// RELATÓRIOS - ETAPA 9.1 - OPERACIONAIS
// Atendimentos + Guias/Vouchers
// ======================================================

const STATUS_ATENDIMENTO_RELATORIO = new Set([
  "TODOS",
  "EM_ANDAMENTO",
  "AGUARDANDO_PAGAMENTO",
  "PARCIALMENTE_PAGO",
  "CONCLUIDO",
  "CANCELADO",
]);

const STATUS_GUIA_RELATORIO = new Set([
  "TODOS",
  "RASCUNHO",
  "AGUARDANDO_PAGAMENTO",
  "PARCIALMENTE_PAGA",
  "PAGA",
  "ESTORNO_PENDENTE",
  "CANCELADA",
]);

const STATUS_REALIZACAO_RELATORIO = new Set([
  "TODOS",
  "AGUARDANDO",
  "PARCIAL",
  "REALIZADO",
  "CANCELADO",
]);

function statusRealizacaoGuiaRelatorio(
  itens: Array<{ status: string }>
): "AGUARDANDO" | "PARCIAL" | "REALIZADO" | "CANCELADO" {
  const ativos = itens.filter((item) => item.status !== "CANCELADO");
  if (ativos.length === 0) return "CANCELADO";

  const realizados = ativos.filter((item) => item.status === "REALIZADO").length;
  if (realizados === 0) return "AGUARDANDO";
  if (realizados === ativos.length) return "REALIZADO";
  return "PARCIAL";
}

function dataAgendamentoGuiaRelatorio(
  itens: Array<{ dataAgendamento: Date | null }>
) {
  const datas = itens
    .map((item) => item.dataAgendamento)
    .filter((data): data is Date => !!data)
    .sort((a, b) => a.getTime() - b.getTime());
  return datas[0] || null;
}

app.get("/relatorios/operacionais", async (req, res) => {
  try {
    const { inicio, fim, inicioTexto, fimTexto } = inicioFimPeriodoFinanceiro(
      req.query.inicio,
      req.query.fim
    );

    const organizacaoId = organizacaoAtualId();
    const busca = String(req.query.busca || "").trim().slice(0, 120);
    const clinicaId = req.query.clinicaId ? Number(req.query.clinicaId) : null;
    const atendenteId = req.query.atendenteId ? Number(req.query.atendenteId) : null;
    const statusAtendimento = String(req.query.statusAtendimento || "TODOS").trim().toUpperCase();
    const statusGuia = String(req.query.statusGuia || "TODOS").trim().toUpperCase();
    const statusRealizacao = String(req.query.statusRealizacao || "TODOS").trim().toUpperCase();
    const dataGuia = String(req.query.dataGuia || "CRIACAO").trim().toUpperCase();

    if (clinicaId !== null && (!Number.isInteger(clinicaId) || clinicaId <= 0)) {
      return res.status(400).json({ erro: "Clínica inválida." });
    }
    if (atendenteId !== null && (!Number.isInteger(atendenteId) || atendenteId <= 0)) {
      return res.status(400).json({ erro: "Atendente inválido." });
    }
    if (!STATUS_ATENDIMENTO_RELATORIO.has(statusAtendimento)) {
      return res.status(400).json({ erro: "Status de atendimento inválido." });
    }
    if (!STATUS_GUIA_RELATORIO.has(statusGuia)) {
      return res.status(400).json({ erro: "Status de guia inválido." });
    }
    if (!STATUS_REALIZACAO_RELATORIO.has(statusRealizacao)) {
      return res.status(400).json({ erro: "Status de realização inválido." });
    }
    if (!["CRIACAO", "AGENDAMENTO"].includes(dataGuia)) {
      return res.status(400).json({ erro: "Tipo de data da guia inválido." });
    }

    const escopoOrganizacao = {
      OR: [{ organizacaoId }, { organizacaoId: null }],
    };

    const whereAtendimento: any = {
      AND: [
        escopoOrganizacao,
        { criadoEm: { gte: inicio, lte: fim } },
      ],
    };

    if (statusAtendimento !== "TODOS") {
      whereAtendimento.AND.push({ status: statusAtendimento });
    }
    if (atendenteId) {
      whereAtendimento.AND.push({ criadoPorId: atendenteId });
    }
    if (clinicaId) {
      whereAtendimento.AND.push({ guias: { some: { clinicaId } } });
    }
    if (busca) {
      whereAtendimento.AND.push({
        OR: [
          { codigoPublico: { contains: busca, mode: "insensitive" } },
          { paciente: { nome: { contains: busca, mode: "insensitive" } } },
          { paciente: { cpf: { contains: busca } } },
          { paciente: { telefone: { contains: busca } } },
        ],
      });
    }

    const whereGuia: any = {
      AND: [escopoOrganizacao],
    };

    if (dataGuia === "AGENDAMENTO") {
      whereGuia.AND.push({
        itens: {
          some: {
            dataAgendamento: { gte: inicio, lte: fim },
          },
        },
      });
    } else {
      whereGuia.AND.push({ criadoEm: { gte: inicio, lte: fim } });
    }

    if (statusGuia !== "TODOS") {
      whereGuia.AND.push({ status: statusGuia });
    }
    if (clinicaId) {
      whereGuia.AND.push({ clinicaId });
    }
    if (atendenteId) {
      whereGuia.AND.push({ geradaPorId: atendenteId });
    }
    if (busca) {
      whereGuia.AND.push({
        OR: [
          { codigoPublico: { contains: busca, mode: "insensitive" } },
          { atendimento: { codigoPublico: { contains: busca, mode: "insensitive" } } },
          { atendimento: { paciente: { nome: { contains: busca, mode: "insensitive" } } } },
          { atendimento: { paciente: { cpf: { contains: busca } } } },
          { clinica: { nome: { contains: busca, mode: "insensitive" } } },
          { itens: { some: { procedimento: { nome: { contains: busca, mode: "insensitive" } } } } },
        ],
      });
    }

    const [atendimentosBanco, guiasBanco, clinicas, atendentes] = await Promise.all([
      prisma.atendimento.findMany({
        where: whereAtendimento,
        include: {
          paciente: {
            select: {
              id: true,
              codigoPublico: true,
              nome: true,
              cpf: true,
              telefone: true,
            },
          },
          criadoPor: {
            select: { id: true, nome: true },
          },
          guias: {
            include: {
              pagamentos: { select: { valor: true } },
              estornos: { select: { valor: true } },
            },
          },
        },
        orderBy: { criadoEm: "desc" },
      }),
      prisma.guia.findMany({
        where: whereGuia,
        include: {
          atendimento: {
            include: {
              paciente: {
                select: {
                  id: true,
                  codigoPublico: true,
                  nome: true,
                  cpf: true,
                  telefone: true,
                },
              },
            },
          },
          clinica: { select: { id: true, nome: true } },
          unidadeClinica: { select: { id: true, nome: true } },
          geradaPor: { select: { id: true, nome: true } },
          itens: {
            include: {
              procedimento: { select: { id: true, nome: true, categoria: true } },
            },
            orderBy: { id: "asc" },
          },
          pagamentos: { select: { valor: true } },
          estornos: { select: { valor: true } },
        },
        orderBy: { criadoEm: "desc" },
      }),
      prisma.clinica.findMany({
        where: { ativo: true },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      }),
      prisma.usuario.findMany({
        where: { organizacaoId, ativo: true },
        select: { id: true, nome: true, perfil: true },
        orderBy: { nome: "asc" },
      }),
    ]);

    const atendimentos = atendimentosBanco.map((atendimento) => {
      const guiasAtivas = atendimento.guias.filter((guia) => guia.status !== "CANCELADA");
      const valorGuias = guiasAtivas.reduce((total, guia) => total + Number(guia.valorFinal), 0);
      const recebidoBruto = atendimento.guias.reduce(
        (total, guia) => total + guia.pagamentos.reduce((subtotal, pagamento) => subtotal + Number(pagamento.valor), 0),
        0
      );
      const estornos = atendimento.guias.reduce(
        (total, guia) => total + guia.estornos.reduce((subtotal, estorno) => subtotal + Number(estorno.valor), 0),
        0
      );
      const recebidoLiquido = Math.max(recebidoBruto - estornos, 0);
      const saldo = Math.max(valorGuias - recebidoLiquido, 0);

      return {
        id: atendimento.id,
        codigoPublico: atendimento.codigoPublico,
        status: atendimento.status,
        etapaAtual: atendimento.etapaAtual,
        criadoEm: atendimento.criadoEm,
        atualizadoEm: atendimento.atualizadoEm,
        canceladoEm: atendimento.canceladoEm,
        motivoCancelamento: atendimento.motivoCancelamento,
        paciente: atendimento.paciente,
        atendente: atendimento.criadoPor,
        quantidadeGuias: atendimento.guias.length,
        quantidadeGuiasAtivas: guiasAtivas.length,
        valorGuias,
        recebidoLiquido,
        saldo,
      };
    });

    let guias = guiasBanco.map((guia) => {
      const totalPago = guia.pagamentos.reduce((total, pagamento) => total + Number(pagamento.valor), 0);
      const totalEstornado = guia.estornos.reduce((total, estorno) => total + Number(estorno.valor), 0);
      const pagoLiquido = Math.max(totalPago - totalEstornado, 0);
      const valorFinal = Number(guia.valorFinal);
      const saldo = Math.max(valorFinal - pagoLiquido, 0);
      const itensAtivos = guia.itens.filter((item) => item.status !== "CANCELADO");
      const valorRepasse = itensAtivos.reduce((total, item) => total + Number(item.valorRepasse), 0);
      const realizacao = statusRealizacaoGuiaRelatorio(guia.itens);

      return {
        id: guia.id,
        codigoPublico: guia.codigoPublico,
        status: guia.status,
        realizacao,
        criadoEm: guia.criadoEm,
        emitidaEm: guia.emitidaEm,
        validadeAte: guia.validadeAte,
        confirmadaEm: guia.confirmadaEm,
        realizadaEm: guia.realizadaEm,
        dataAgendamento: dataAgendamentoGuiaRelatorio(guia.itens),
        atendimentoId: guia.atendimentoId,
        codigoAtendimento: guia.atendimento.codigoPublico,
        paciente: guia.atendimento.paciente,
        clinica: guia.clinica,
        unidade: guia.unidadeClinica,
        atendente: guia.geradaPor,
        procedimentos: itensAtivos.map((item) => ({
          id: item.procedimento.id,
          nome: item.procedimento.nome,
          categoria: item.procedimento.categoria,
          status: item.status,
          valorPaciente: Number(item.valorPaciente),
          valorRepasse: Number(item.valorRepasse),
        })),
        valorFinal,
        recebidoBruto: totalPago,
        estornos: totalEstornado,
        recebidoLiquido: pagoLiquido,
        saldo,
        valorRepasse,
      };
    });

    if (statusRealizacao !== "TODOS") {
      guias = guias.filter((guia) => guia.realizacao === statusRealizacao);
    }

    const resumoAtendimentos = {
      total: atendimentos.length,
      concluidos: atendimentos.filter((item) => item.status === "CONCLUIDO").length,
      cancelados: atendimentos.filter((item) => item.status === "CANCELADO").length,
      emAndamento: atendimentos.filter((item) => !["CONCLUIDO", "CANCELADO"].includes(item.status)).length,
      valorGuias: atendimentos.reduce((total, item) => total + item.valorGuias, 0),
      recebidoLiquido: atendimentos.reduce((total, item) => total + item.recebidoLiquido, 0),
      saldo: atendimentos.reduce((total, item) => total + item.saldo, 0),
    };

    const resumoGuias = {
      total: guias.length,
      realizadas: guias.filter((item) => item.realizacao === "REALIZADO").length,
      aguardandoRealizacao: guias.filter((item) => item.realizacao === "AGUARDANDO").length,
      canceladas: guias.filter((item) => item.status === "CANCELADA" || item.realizacao === "CANCELADO").length,
      valorCobrado: guias.reduce((total, item) => total + item.valorFinal, 0),
      recebidoLiquido: guias.reduce((total, item) => total + item.recebidoLiquido, 0),
      saldo: guias.reduce((total, item) => total + item.saldo, 0),
      repassePrevisto: guias.reduce((total, item) => total + item.valorRepasse, 0),
    };

    return res.json({
      periodo: { inicio: inicioTexto, fim: fimTexto },
      filtros: {
        busca,
        clinicaId,
        atendenteId,
        statusAtendimento,
        statusGuia,
        statusRealizacao,
        dataGuia,
      },
      opcoes: { clinicas, atendentes },
      resumo: {
        atendimentos: resumoAtendimentos,
        guias: resumoGuias,
      },
      atendimentos,
      guias,
    });
  } catch (erro) {
    console.error("Erro ao carregar relatórios operacionais:", erro);

    if (erro instanceof Error && erro.message === "PERIODO_FINANCEIRO_INVALIDO") {
      return res.status(400).json({ erro: "Informe um período válido." });
    }
    if (erro instanceof Error && erro.message === "PERIODO_FINANCEIRO_MUITO_LONGO") {
      return res.status(400).json({ erro: "O período pode ter no máximo 370 dias." });
    }

    return res.status(500).json({
      erro: "Não foi possível carregar os relatórios operacionais.",
    });
  }
});



// ======================================================
// RELATÓRIOS - ETAPA 9.2 - FINANCEIROS
// Recebimentos/Estornos + Repasses às clínicas
// ======================================================

const TIPO_MOVIMENTACAO_RELATORIO = new Set([
  "TODOS",
  "RECEBIMENTO",
  "ESTORNO",
]);

const STATUS_REPASSE_RELATORIO = new Set([
  "TODOS",
  "SOLICITADO",
  "EM_ANALISE",
  "APROVADO",
  "PAGO",
  "RECUSADO",
]);

const DATA_REPASSE_RELATORIO = new Set([
  "SOLICITACAO",
  "PAGAMENTO_SOLICITADO",
  "PAGAMENTO_EFETIVO",
]);

app.get("/relatorios/financeiros", async (req, res) => {
  try {
    const { inicio, fim, inicioTexto, fimTexto } = inicioFimPeriodoFinanceiro(
      req.query.inicio,
      req.query.fim
    );

    const organizacaoId = organizacaoAtualId();
    const busca = String(req.query.busca || "").trim().slice(0, 120);
    const clinicaId = req.query.clinicaId ? Number(req.query.clinicaId) : null;
    const tipoMovimentacao = String(req.query.tipoMovimentacao || "TODOS")
      .trim()
      .toUpperCase();
    const formaPagamento = String(req.query.formaPagamento || "TODAS")
      .trim()
      .toUpperCase();
    const statusRepasse = String(req.query.statusRepasse || "TODOS")
      .trim()
      .toUpperCase();
    const dataRepasse = String(req.query.dataRepasse || "SOLICITACAO")
      .trim()
      .toUpperCase();
    const formaRepasse = String(req.query.formaRepasse || "TODAS")
      .trim()
      .toUpperCase();

    if (clinicaId !== null && (!Number.isInteger(clinicaId) || clinicaId <= 0)) {
      return res.status(400).json({ erro: "Clínica inválida." });
    }
    if (!TIPO_MOVIMENTACAO_RELATORIO.has(tipoMovimentacao)) {
      return res.status(400).json({ erro: "Tipo de movimentação inválido." });
    }
    if (!STATUS_REPASSE_RELATORIO.has(statusRepasse)) {
      return res.status(400).json({ erro: "Status de repasse inválido." });
    }
    if (!DATA_REPASSE_RELATORIO.has(dataRepasse)) {
      return res.status(400).json({ erro: "Tipo de período do repasse inválido." });
    }

    const escopoOrganizacao = {
      OR: [{ organizacaoId }, { organizacaoId: null }],
    };

    const whereGuias: any = {
      AND: [
        escopoOrganizacao,
        ...(clinicaId ? [{ clinicaId }] : []),
      ],
    };

    const filtrosRepasse: any[] = [escopoOrganizacao];
    if (clinicaId) filtrosRepasse.push({ clinicaId });
    if (statusRepasse !== "TODOS") filtrosRepasse.push({ status: statusRepasse });
    if (formaRepasse !== "TODAS") filtrosRepasse.push({ formaPagamento: formaRepasse });

    if (dataRepasse === "PAGAMENTO_EFETIVO") {
      filtrosRepasse.push({ dataPagamentoEfetivo: { gte: inicio, lte: fim } });
    } else if (dataRepasse === "PAGAMENTO_SOLICITADO") {
      filtrosRepasse.push({ dataPagamentoSolicitada: { gte: inicio, lte: fim } });
    } else {
      filtrosRepasse.push({ solicitadoEm: { gte: inicio, lte: fim } });
    }

    if (busca) {
      const buscaNumerica = busca.replace(/\D/g, "");
      const opcoesBusca: any[] = [
        { codigoPublico: { contains: busca, mode: "insensitive" } },
        { clinica: { nome: { contains: busca, mode: "insensitive" } } },
        {
          itens: {
            some: {
              guia: {
                codigoPublico: { contains: busca, mode: "insensitive" },
              },
            },
          },
        },
        {
          itens: {
            some: {
              guia: {
                atendimento: {
                  paciente: {
                    nome: { contains: busca, mode: "insensitive" },
                  },
                },
              },
            },
          },
        },
      ];
      if (buscaNumerica) {
        opcoesBusca.push({
          itens: {
            some: {
              guia: {
                atendimento: {
                  paciente: { cpf: { contains: buscaNumerica } },
                },
              },
            },
          },
        });
      }
      filtrosRepasse.push({ OR: opcoesBusca });
    }

    const [guiasBanco, repassesBanco, clinicas] = await Promise.all([
      prisma.guia.findMany({
        where: whereGuias,
        include: {
          clinica: { select: { id: true, nome: true } },
          atendimento: {
            include: {
              paciente: {
                select: {
                  id: true,
                  codigoPublico: true,
                  nome: true,
                  cpf: true,
                  telefone: true,
                },
              },
            },
          },
          pagamentos: { orderBy: { criadoEm: "asc" } },
          estornos: { orderBy: { criadoEm: "asc" } },
        },
        orderBy: { criadoEm: "desc" },
      }),
      prisma.repasse.findMany({
        where: { AND: filtrosRepasse },
        include: {
          clinica: { select: { id: true, nome: true } },
          solicitadoPor: { select: { id: true, nome: true } },
          aprovadoPor: { select: { id: true, nome: true } },
          recusadoPor: { select: { id: true, nome: true } },
          pagoPor: { select: { id: true, nome: true } },
          documentos: {
            where: { ativo: true },
            select: {
              id: true,
              tipo: true,
              nomeOriginal: true,
              mimeType: true,
              tamanhoBytes: true,
              criadoEm: true,
              enviadoPor: { select: { nome: true } },
            },
            orderBy: { criadoEm: "desc" },
          },
          itens: {
            include: {
              guia: {
                include: {
                  atendimento: {
                    include: {
                      paciente: {
                        select: {
                          id: true,
                          nome: true,
                          cpf: true,
                          telefone: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { solicitadoEm: "desc" },
      }),
      prisma.clinica.findMany({
        where: { ativo: true },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      }),
    ]);

    type MovimentacaoRelatorio = {
      id: string;
      tipo: "RECEBIMENTO" | "ESTORNO";
      data: Date;
      valor: number;
      forma: string;
      formaLabel: string;
      observacao: string | null;
      guiaId: number;
      codigoVoucher: string | null;
      atendimentoId: number;
      codigoAtendimento: string | null;
      pacienteId: number;
      paciente: string;
      cpf: string;
      telefone: string;
      clinicaId: number;
      clinica: string;
    };

    let movimentacoes: MovimentacaoRelatorio[] = [];

    for (const guia of guiasBanco) {
      const paciente = guia.atendimento.paciente;

      for (const pagamento of guia.pagamentos) {
        if (!dentroDoPeriodoFinanceiro(pagamento.criadoEm, inicio, fim)) continue;
        movimentacoes.push({
          id: `PAG-${pagamento.id}`,
          tipo: "RECEBIMENTO",
          data: pagamento.criadoEm,
          valor: Number(pagamento.valor),
          forma: pagamento.forma,
          formaLabel: rotuloFormaPagamentoFinanceiro(pagamento.forma),
          observacao: pagamento.observacao,
          guiaId: guia.id,
          codigoVoucher: guia.codigoPublico,
          atendimentoId: guia.atendimento.id,
          codigoAtendimento: guia.atendimento.codigoPublico,
          pacienteId: paciente.id,
          paciente: paciente.nome,
          cpf: paciente.cpf,
          telefone: paciente.telefone,
          clinicaId: guia.clinica.id,
          clinica: guia.clinica.nome,
        });
      }

      for (const estorno of guia.estornos) {
        if (!dentroDoPeriodoFinanceiro(estorno.criadoEm, inicio, fim)) continue;
        movimentacoes.push({
          id: `EST-${estorno.id}`,
          tipo: "ESTORNO",
          data: estorno.criadoEm,
          valor: Number(estorno.valor),
          forma: estorno.forma,
          formaLabel: rotuloFormaPagamentoFinanceiro(estorno.forma),
          observacao: estorno.motivo,
          guiaId: guia.id,
          codigoVoucher: guia.codigoPublico,
          atendimentoId: guia.atendimento.id,
          codigoAtendimento: guia.atendimento.codigoPublico,
          pacienteId: paciente.id,
          paciente: paciente.nome,
          cpf: paciente.cpf,
          telefone: paciente.telefone,
          clinicaId: guia.clinica.id,
          clinica: guia.clinica.nome,
        });
      }
    }

    if (formaPagamento !== "TODAS") {
      movimentacoes = movimentacoes.filter((item) => item.forma === formaPagamento);
    }
    if (busca) {
      const termo = busca.toLocaleLowerCase("pt-BR");
      const numerico = busca.replace(/\D/g, "");
      movimentacoes = movimentacoes.filter((item) => {
        const campos = [
          item.id,
          item.codigoVoucher || "",
          item.codigoAtendimento || "",
          item.paciente,
          item.cpf,
          item.clinica,
          item.formaLabel,
          item.observacao || "",
        ].join(" ").toLocaleLowerCase("pt-BR");
        return campos.includes(termo) || (!!numerico && item.cpf.includes(numerico));
      });
    }

    movimentacoes.sort((a, b) => b.data.getTime() - a.data.getTime());

    const movimentacoesResumo = [...movimentacoes];
    const recebidoBruto = movimentacoesResumo
      .filter((item) => item.tipo === "RECEBIMENTO")
      .reduce((total, item) => total + item.valor, 0);
    const estornos = movimentacoesResumo
      .filter((item) => item.tipo === "ESTORNO")
      .reduce((total, item) => total + item.valor, 0);

    if (tipoMovimentacao !== "TODOS") {
      movimentacoes = movimentacoes.filter((item) => item.tipo === tipoMovimentacao);
    }

    const repasses = repassesBanco.map((repasse) => ({
      id: repasse.id,
      codigoPublico: repasse.codigoPublico || `REP-${repasse.id}`,
      clinicaId: repasse.clinica.id,
      clinica: repasse.clinica.nome,
      status: repasse.status,
      statusLabel: rotuloStatusRepasse(repasse.status),
      origem: repasse.origem,
      valorTotal: Number(repasse.valorTotal),
      dataPagamentoSolicitada: repasse.dataPagamentoSolicitada,
      solicitadoEm: repasse.solicitadoEm,
      emAnaliseEm: repasse.emAnaliseEm,
      aprovadoEm: repasse.aprovadoEm,
      recusadoEm: repasse.recusadoEm,
      pagoEm: repasse.pagoEm,
      dataPagamentoEfetivo: repasse.dataPagamentoEfetivo,
      formaPagamento: repasse.formaPagamento,
      formaPagamentoLabel: rotuloFormaPagamentoRepasse(repasse.formaPagamento),
      observacaoPagamento: repasse.observacaoPagamento,
      motivoRecusa: repasse.motivoRecusa,
      observacoes: repasse.observacoes,
      solicitadoPor: repasse.solicitadoPor?.nome || null,
      aprovadoPor: repasse.aprovadoPor?.nome || null,
      recusadoPor: repasse.recusadoPor?.nome || null,
      pagoPor: repasse.pagoPor?.nome || null,
      quantidadeGuias: repasse.itens.length,
      percentualDocumentacao:
        repasse.status === "PAGO"
          ? percentualDocumentacaoRepasse(repasse.documentos)
          : null,
      documentos:
        repasse.status === "PAGO"
          ? repasse.documentos.map((documento) => ({
              id: documento.id,
              tipo: documento.tipo,
              nomeOriginal: documento.nomeOriginal,
              mimeType: documento.mimeType,
              tamanhoBytes: documento.tamanhoBytes,
              criadoEm: documento.criadoEm,
              enviadoPor: documento.enviadoPor?.nome || null,
            }))
          : [],
      itens: repasse.itens.map((item) => ({
        id: item.id,
        guiaId: item.guia.id,
        atendimentoId: item.guia.atendimento.id,
        codigoVoucher: item.guia.codigoPublico,
        codigoAtendimento: item.guia.atendimento.codigoPublico,
        pacienteId: item.guia.atendimento.paciente.id,
        paciente: item.guia.atendimento.paciente.nome,
        cpf: item.guia.atendimento.paciente.cpf,
        telefone: item.guia.atendimento.paciente.telefone,
        valor: Number(item.valor),
        confirmadoEm:
          item.guia.confirmadaEm || item.guia.realizadaEm || item.guia.criadoEm,
      })),
    }));

    const repassesPendentes = repasses.filter((item) =>
      ["SOLICITADO", "EM_ANALISE", "APROVADO"].includes(item.status)
    );
    const repassesPagos = repasses.filter((item) => item.status === "PAGO");
    const repassesRecusados = repasses.filter((item) => item.status === "RECUSADO");

    const formasPagamento = Array.from(
      new Map(
        movimentacoes.map((item) => [item.forma, item.formaLabel] as const)
      ).entries()
    ).map(([codigo, label]) => ({ codigo, label }));

    return res.json({
      periodo: { inicio: inicioTexto, fim: fimTexto },
      filtros: {
        busca,
        clinicaId,
        tipoMovimentacao,
        formaPagamento,
        statusRepasse,
        dataRepasse,
        formaRepasse,
      },
      opcoes: {
        clinicas,
        formasPagamento,
      },
      resumo: {
        movimentacoes: {
          total: movimentacoesResumo.length,
          quantidadeRecebimentos: movimentacoesResumo.filter((item) => item.tipo === "RECEBIMENTO").length,
          quantidadeEstornos: movimentacoesResumo.filter((item) => item.tipo === "ESTORNO").length,
          recebidoBruto,
          estornos,
          recebidoLiquido: recebidoBruto - estornos,
        },
        repasses: {
          total: repasses.length,
          valorTotal: repasses.reduce((total, item) => total + item.valorTotal, 0),
          pendentes: repassesPendentes.length,
          valorPendente: repassesPendentes.reduce((total, item) => total + item.valorTotal, 0),
          pagos: repassesPagos.length,
          valorPago: repassesPagos.reduce((total, item) => total + item.valorTotal, 0),
          recusados: repassesRecusados.length,
          valorRecusado: repassesRecusados.reduce((total, item) => total + item.valorTotal, 0),
          documentacaoCompleta: repassesPagos.filter((item) => item.percentualDocumentacao === 100).length,
        },
      },
      movimentacoes,
      repasses,
    });
  } catch (erro) {
    console.error("Erro ao carregar relatórios financeiros:", erro);

    if (erro instanceof Error && erro.message === "PERIODO_FINANCEIRO_INVALIDO") {
      return res.status(400).json({ erro: "Informe um período válido." });
    }
    if (erro instanceof Error && erro.message === "PERIODO_FINANCEIRO_MUITO_LONGO") {
      return res.status(400).json({ erro: "O período pode ter no máximo 370 dias." });
    }

    return res.status(500).json({
      erro: "Não foi possível carregar os relatórios financeiros.",
    });
  }
});


// ======================================================
// RELATÓRIOS - PRODUÇÃO POR CLÍNICA E PROCEDIMENTO
// ======================================================
app.get("/relatorios/producao", async (req, res) => {
  try {
    const { inicio, fim, inicioTexto, fimTexto } = inicioFimPeriodoFinanceiro(
      req.query.inicio,
      req.query.fim
    );

    const organizacaoId = organizacaoAtualId();
    const busca = String(req.query.busca || "").trim().slice(0, 120);
    const clinicaId = req.query.clinicaId ? Number(req.query.clinicaId) : null;
    const procedimentoId = req.query.procedimentoId
      ? Number(req.query.procedimentoId)
      : null;

    if (clinicaId !== null && (!Number.isInteger(clinicaId) || clinicaId <= 0)) {
      return res.status(400).json({ erro: "Clínica inválida." });
    }
    if (
      procedimentoId !== null &&
      (!Number.isInteger(procedimentoId) || procedimentoId <= 0)
    ) {
      return res.status(400).json({ erro: "Procedimento inválido." });
    }

    const whereItens: any = {
      status: "REALIZADO",
      guia: {
        OR: [{ organizacaoId }, { organizacaoId: null }],
        status: { not: "CANCELADA" },
        realizadaEm: { gte: inicio, lte: fim },
        ...(clinicaId ? { clinicaId } : {}),
      },
      ...(procedimentoId ? { procedimentoId } : {}),
    };

    if (busca) {
      const buscaNumerica = busca.replace(/\D/g, "");
      const opcoesBusca: any[] = [
        { procedimento: { nome: { contains: busca, mode: "insensitive" } } },
        { procedimento: { categoria: { contains: busca, mode: "insensitive" } } },
        { guia: { codigoPublico: { contains: busca, mode: "insensitive" } } },
        { guia: { clinica: { nome: { contains: busca, mode: "insensitive" } } } },
        {
          guia: {
            atendimento: {
              codigoPublico: { contains: busca, mode: "insensitive" },
            },
          },
        },
        {
          guia: {
            atendimento: {
              paciente: { nome: { contains: busca, mode: "insensitive" } },
            },
          },
        },
      ];

      if (buscaNumerica) {
        opcoesBusca.push({
          guia: {
            atendimento: {
              paciente: { cpf: { contains: buscaNumerica } },
            },
          },
        });
      }

      whereItens.OR = opcoesBusca;
    }

    const [itensBanco, clinicasOpcoes, procedimentosOpcoes] = await Promise.all([
      prisma.itemGuia.findMany({
        where: whereItens,
        include: {
          procedimento: {
            select: {
              id: true,
              nome: true,
              categoria: true,
            },
          },
          guia: {
            select: {
              id: true,
              codigoPublico: true,
              realizadaEm: true,
              confirmadaEm: true,
              criadoEm: true,
              subtotal: true,
              valorFinal: true,
              clinica: {
                select: { id: true, nome: true },
              },
              unidadeClinica: {
                select: { id: true, nome: true },
              },
              atendimento: {
                select: {
                  id: true,
                  codigoPublico: true,
                  paciente: {
                    select: {
                      id: true,
                      nome: true,
                      cpf: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { id: "desc" },
      }),
      prisma.clinica.findMany({
        where: { ativo: true },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      }),
      prisma.procedimento.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, categoria: true },
        orderBy: { nome: "asc" },
      }),
    ]);

    type GuiaResumoProducao = {
      guiaId: number;
      codigoVoucher: string | null;
      atendimentoId: number;
      codigoAtendimento: string | null;
      pacienteId: number;
      paciente: string;
      cpf: string;
      clinicaId: number;
      clinica: string;
      unidade: string | null;
      realizadoEm: Date | null;
      procedimentoId: number;
      procedimento: string;
      valorPaciente: number;
      valorRepasse: number;
    };

    type ClinicaAcumulada = {
      id: number;
      nome: string;
      atendimentos: Set<number>;
      guias: Set<number>;
      pacientes: Set<number>;
      quantidadeProcedimentos: number;
      valorPaciente: number;
      valorRepasse: number;
      procedimentos: Map<
        number,
        {
          id: number;
          nome: string;
          categoria: string | null;
          quantidade: number;
          valorPaciente: number;
          valorRepasse: number;
        }
      >;
      ultimasGuias: GuiaResumoProducao[];
    };

    type ProcedimentoAcumulado = {
      id: number;
      nome: string;
      categoria: string | null;
      clinicas: Set<number>;
      atendimentos: Set<number>;
      guias: Set<number>;
      pacientes: Set<number>;
      quantidade: number;
      valorPaciente: number;
      valorRepasse: number;
      clinicasDetalhe: Map<
        number,
        {
          id: number;
          nome: string;
          quantidade: number;
          valorPaciente: number;
          valorRepasse: number;
        }
      >;
      ultimasGuias: GuiaResumoProducao[];
    };

    const clinicasMap = new Map<number, ClinicaAcumulada>();
    const procedimentosMap = new Map<number, ProcedimentoAcumulado>();

    let valorPacienteTotal = 0;
    let valorRepasseTotal = 0;
    const atendimentosTotal = new Set<number>();
    const guiasTotal = new Set<number>();
    const pacientesTotal = new Set<number>();

    for (const item of itensBanco) {
      const guia = item.guia;
      const valorPacienteBase = Number(item.valorPaciente) || 0;
      const subtotalGuia = Number(guia.subtotal) || 0;
      const valorFinalGuia = Number(guia.valorFinal) || 0;
      const fatorDesconto = subtotalGuia > 0 ? valorFinalGuia / subtotalGuia : 1;
      const valorPaciente = valorPacienteBase * fatorDesconto;
      const valorRepasse = Number(item.valorRepasse) || 0;
      const procedimento = item.procedimento;
      const paciente = guia.atendimento.paciente;

      valorPacienteTotal += valorPaciente;
      valorRepasseTotal += valorRepasse;
      atendimentosTotal.add(guia.atendimento.id);
      guiasTotal.add(guia.id);
      pacientesTotal.add(paciente.id);

      const detalheGuia: GuiaResumoProducao = {
        guiaId: guia.id,
        codigoVoucher: guia.codigoPublico,
        atendimentoId: guia.atendimento.id,
        codigoAtendimento: guia.atendimento.codigoPublico,
        pacienteId: paciente.id,
        paciente: paciente.nome,
        cpf: paciente.cpf,
        clinicaId: guia.clinica.id,
        clinica: guia.clinica.nome,
        unidade: guia.unidadeClinica?.nome || null,
        realizadoEm: guia.realizadaEm || guia.confirmadaEm || guia.criadoEm,
        procedimentoId: procedimento.id,
        procedimento: procedimento.nome,
        valorPaciente,
        valorRepasse,
      };

      let clinica = clinicasMap.get(guia.clinica.id);
      if (!clinica) {
        clinica = {
          id: guia.clinica.id,
          nome: guia.clinica.nome,
          atendimentos: new Set<number>(),
          guias: new Set<number>(),
          pacientes: new Set<number>(),
          quantidadeProcedimentos: 0,
          valorPaciente: 0,
          valorRepasse: 0,
          procedimentos: new Map(),
          ultimasGuias: [],
        };
        clinicasMap.set(clinica.id, clinica);
      }

      clinica.atendimentos.add(guia.atendimento.id);
      clinica.guias.add(guia.id);
      clinica.pacientes.add(paciente.id);
      clinica.quantidadeProcedimentos += 1;
      clinica.valorPaciente += valorPaciente;
      clinica.valorRepasse += valorRepasse;
      clinica.ultimasGuias.push(detalheGuia);

      const procNaClinica = clinica.procedimentos.get(procedimento.id) || {
        id: procedimento.id,
        nome: procedimento.nome,
        categoria: procedimento.categoria,
        quantidade: 0,
        valorPaciente: 0,
        valorRepasse: 0,
      };
      procNaClinica.quantidade += 1;
      procNaClinica.valorPaciente += valorPaciente;
      procNaClinica.valorRepasse += valorRepasse;
      clinica.procedimentos.set(procedimento.id, procNaClinica);

      let proc = procedimentosMap.get(procedimento.id);
      if (!proc) {
        proc = {
          id: procedimento.id,
          nome: procedimento.nome,
          categoria: procedimento.categoria,
          clinicas: new Set<number>(),
          atendimentos: new Set<number>(),
          guias: new Set<number>(),
          pacientes: new Set<number>(),
          quantidade: 0,
          valorPaciente: 0,
          valorRepasse: 0,
          clinicasDetalhe: new Map(),
          ultimasGuias: [],
        };
        procedimentosMap.set(proc.id, proc);
      }

      proc.clinicas.add(guia.clinica.id);
      proc.atendimentos.add(guia.atendimento.id);
      proc.guias.add(guia.id);
      proc.pacientes.add(paciente.id);
      proc.quantidade += 1;
      proc.valorPaciente += valorPaciente;
      proc.valorRepasse += valorRepasse;
      proc.ultimasGuias.push(detalheGuia);

      const clinicaNoProc = proc.clinicasDetalhe.get(guia.clinica.id) || {
        id: guia.clinica.id,
        nome: guia.clinica.nome,
        quantidade: 0,
        valorPaciente: 0,
        valorRepasse: 0,
      };
      clinicaNoProc.quantidade += 1;
      clinicaNoProc.valorPaciente += valorPaciente;
      clinicaNoProc.valorRepasse += valorRepasse;
      proc.clinicasDetalhe.set(guia.clinica.id, clinicaNoProc);
    }

    const percentualMargem = (valorPaciente: number, diferenca: number) =>
      valorPaciente > 0 ? (diferenca / valorPaciente) * 100 : 0;

    const clinicas = Array.from(clinicasMap.values())
      .map((item) => {
        const diferenca = item.valorPaciente - item.valorRepasse;
        const procedimentos = Array.from(item.procedimentos.values())
          .map((proc) => ({
            ...proc,
            diferenca: proc.valorPaciente - proc.valorRepasse,
          }))
          .sort(
            (a, b) =>
              b.quantidade - a.quantidade || b.valorPaciente - a.valorPaciente
          );

        const ultimasGuias = item.ultimasGuias
          .sort(
            (a, b) =>
              (b.realizadoEm?.getTime() || 0) -
              (a.realizadoEm?.getTime() || 0)
          )
          .slice(0, 12);

        return {
          id: item.id,
          nome: item.nome,
          quantidadeAtendimentos: item.atendimentos.size,
          quantidadeGuias: item.guias.size,
          quantidadePacientes: item.pacientes.size,
          quantidadeProcedimentos: item.quantidadeProcedimentos,
          valorPaciente: item.valorPaciente,
          valorRepasse: item.valorRepasse,
          diferenca,
          margemPercentual: percentualMargem(item.valorPaciente, diferenca),
          procedimentos,
          ultimasGuias,
        };
      })
      .sort(
        (a, b) =>
          b.quantidadeProcedimentos - a.quantidadeProcedimentos ||
          b.valorPaciente - a.valorPaciente
      );

    const procedimentos = Array.from(procedimentosMap.values())
      .map((item) => {
        const diferenca = item.valorPaciente - item.valorRepasse;
        const clinicasDetalhe = Array.from(item.clinicasDetalhe.values())
          .map((clinica) => ({
            ...clinica,
            diferenca: clinica.valorPaciente - clinica.valorRepasse,
          }))
          .sort(
            (a, b) =>
              b.quantidade - a.quantidade || b.valorPaciente - a.valorPaciente
          );

        const ultimasGuias = item.ultimasGuias
          .sort(
            (a, b) =>
              (b.realizadoEm?.getTime() || 0) -
              (a.realizadoEm?.getTime() || 0)
          )
          .slice(0, 12);

        return {
          id: item.id,
          nome: item.nome,
          categoria: item.categoria,
          quantidadeClinicas: item.clinicas.size,
          quantidadeAtendimentos: item.atendimentos.size,
          quantidadeGuias: item.guias.size,
          quantidadePacientes: item.pacientes.size,
          quantidade: item.quantidade,
          valorPaciente: item.valorPaciente,
          valorRepasse: item.valorRepasse,
          diferenca,
          margemPercentual: percentualMargem(item.valorPaciente, diferenca),
          clinicas: clinicasDetalhe,
          ultimasGuias,
        };
      })
      .sort(
        (a, b) =>
          b.quantidade - a.quantidade || b.valorPaciente - a.valorPaciente
      );

    const diferencaTotal = valorPacienteTotal - valorRepasseTotal;

    return res.json({
      periodo: { inicio: inicioTexto, fim: fimTexto },
      filtros: {
        busca,
        clinicaId,
        procedimentoId,
      },
      opcoes: {
        clinicas: clinicasOpcoes,
        procedimentos: procedimentosOpcoes,
      },
      resumo: {
        clinicas: clinicas.length,
        procedimentos: procedimentos.length,
        quantidadeRealizada: itensBanco.length,
        atendimentos: atendimentosTotal.size,
        guias: guiasTotal.size,
        pacientes: pacientesTotal.size,
        valorPaciente: valorPacienteTotal,
        valorRepasse: valorRepasseTotal,
        diferenca: diferencaTotal,
        margemPercentual: percentualMargem(valorPacienteTotal, diferencaTotal),
      },
      clinicas,
      procedimentos,
    });
  } catch (erro) {
    console.error("Erro ao carregar relatórios de produção:", erro);

    if (erro instanceof Error && erro.message === "PERIODO_FINANCEIRO_INVALIDO") {
      return res.status(400).json({ erro: "Informe um período válido." });
    }
    if (
      erro instanceof Error &&
      erro.message === "PERIODO_FINANCEIRO_MUITO_LONGO"
    ) {
      return res.status(400).json({ erro: "O período pode ter no máximo 370 dias." });
    }

    return res.status(500).json({
      erro: "Não foi possível carregar os relatórios de produção.",
    });
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 Digna Conect API rodando em http://localhost:${PORT}`);

  try {
    await garantirCodigosPublicosBase();
    await prisma.sessaoUsuario.deleteMany({ where: { expiraEm: { lt: new Date() } } });
  } catch (erro) {
    console.error(
      "Não foi possível garantir os códigos públicos iniciais:",
      erro
    );
  }
});