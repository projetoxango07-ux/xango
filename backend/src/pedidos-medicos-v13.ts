import type { Express, Request, Response } from "express";
import multer from "multer";
import { createHash } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client.js";

const LIMITE_BYTES = 8 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: LIMITE_BYTES, files: 1, fields: 0 } }).single("arquivo");

type Contexto = { organizacaoId: () => number; usuarioId: () => number };
function idNumerico(v: unknown) { const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? n : null; }
function arquivoValido(nome: string, dados: Buffer): string | null {
  const extensao = nome.toLowerCase().split(".").pop();
  if (extensao === "pdf" && dados.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (["jpg", "jpeg"].includes(extensao || "") && dados.length > 3 && dados[0] === 255 && dados[1] === 216 && dados[2] === 255) return "image/jpeg";
  if (extensao === "png" && dados.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  return null;
}
function nomeSeguro(nome: string) {
  return nome.replace(/[/\\\x00-\x1F\x7F]/g, "_").slice(0, 180) || "pedido-medico";
}
function metadata(d: { id: number; atendimentoId: number; nomeOriginal: string; mimeType: string; tamanhoBytes: number; criadoEm: Date; enviadoPorId: number | null }) {
  return { id: d.id, atendimentoId: d.atendimentoId, nomeOriginal: d.nomeOriginal,
    mimeType: d.mimeType, tamanhoBytes: d.tamanhoBytes, criadoEm: d.criadoEm, enviadoPorId: d.enviadoPorId };
}

export function registrarRotasPedidosMedicosV13(app: Express, prisma: PrismaClient, contexto: Contexto) {
  const acharAtendimento = (id: number) => prisma.atendimento.findFirst({
    where: { id, organizacaoId: contexto.organizacaoId() },
    select: { id: true, pacienteId: true, organizacaoId: true, codigoPublico: true },
  });

  app.get("/atendimentos/:id/pedidos-medicos", async (req, res) => {
    const id = idNumerico(req.params.id);
    if (!id) return res.status(400).json({ erro: "Atendimento inválido." });
    try {
      if (!await acharAtendimento(id)) return res.status(404).json({ erro: "Atendimento não encontrado." });
      const lista = await prisma.pedidoMedico.findMany({
        where: { atendimentoId: id, organizacaoId: contexto.organizacaoId(), removidoEm: null },
        select: { id: true, atendimentoId: true, nomeOriginal: true, mimeType: true,
          tamanhoBytes: true, criadoEm: true, enviadoPorId: true },
        orderBy: { criadoEm: "desc" }, take: 100,
      });
      res.setHeader("Cache-Control", "private, no-store");
      return res.json(lista.map(metadata));
    } catch (e) { console.error("Erro ao listar pedidos:", e); return res.status(500).json({ erro: "Não foi possível listar pedidos médicos." }); }
  });

  app.get("/pacientes/:id/pedidos-medicos", async (req, res) => {
    const id = idNumerico(req.params.id);
    if (!id) return res.status(400).json({ erro: "Paciente inválido." });
    try {
      const paciente = await prisma.paciente.findUnique({ where: { id }, select: { id: true } });
      if (!paciente) return res.status(404).json({ erro: "Paciente não encontrado." });
      const lista = await prisma.pedidoMedico.findMany({
        where: { pacienteId: id, organizacaoId: contexto.organizacaoId(), removidoEm: null,
          atendimento: { organizacaoId: contexto.organizacaoId() } },
        select: { id: true, atendimentoId: true, nomeOriginal: true, mimeType: true,
          tamanhoBytes: true, criadoEm: true, enviadoPorId: true,
          atendimento: { select: { codigoPublico: true } } },
        orderBy: { criadoEm: "desc" }, take: 100,
      });
      res.setHeader("Cache-Control", "private, no-store");
      return res.json(lista.map((d) => ({ ...metadata(d), atendimentoCodigo: d.atendimento.codigoPublico })));
    } catch (e) { console.error("Erro ao listar pedidos do paciente:", e); return res.status(500).json({ erro: "Não foi possível consultar os pedidos médicos." }); }
  });

  app.post("/atendimentos/:id/pedidos-medicos", (req: Request, res: Response) => {
    upload(req, res, async (erro: unknown) => {
      if (erro) return res.status(400).json({ erro: erro instanceof multer.MulterError && erro.code === "LIMIT_FILE_SIZE"
        ? "Cada arquivo pode ter no máximo 8 MB." : "Arquivo inválido ou maior que o permitido." });
      const id = idNumerico(req.params.id);
      if (!id) return res.status(400).json({ erro: "Atendimento inválido." });
      if (!req.file?.buffer?.length) return res.status(400).json({ erro: "Selecione um arquivo." });
      const nome = nomeSeguro(req.file.originalname);
      const mimeType = arquivoValido(nome, req.file.buffer);
      if (!mimeType) return res.status(400).json({ erro: "Envie PDF, JPG ou PNG válido." });
      try {
        const atendimento = await acharAtendimento(id);
        if (!atendimento) return res.status(404).json({ erro: "Atendimento não encontrado." });
        const total = await prisma.pedidoMedico.count({ where: { atendimentoId: id, organizacaoId: contexto.organizacaoId(), removidoEm: null } });
        if (total >= 25) return res.status(409).json({ erro: "Limite de 25 pedidos por atendimento." });
        const sha256 = createHash("sha256").update(req.file.buffer).digest("hex");
        const existente = await prisma.pedidoMedico.findFirst({ where: { atendimentoId: id, organizacaoId: contexto.organizacaoId(), sha256, removidoEm: null } });
        if (existente) return res.status(409).json({ erro: "Este arquivo já foi anexado ao atendimento." });
        const salvo = await prisma.pedidoMedico.create({ data: {
          atendimentoId: atendimento.id, pacienteId: atendimento.pacienteId,
          organizacaoId: contexto.organizacaoId(), enviadoPorId: contexto.usuarioId(),
          nomeOriginal: nome, mimeType, tamanhoBytes: req.file.buffer.length,
          sha256, conteudo: new Uint8Array(req.file.buffer),
        } });
        res.setHeader("Cache-Control", "private, no-store");
        return res.status(201).json(metadata(salvo));
      } catch (e) { console.error("Erro ao anexar pedido:", e); return res.status(500).json({ erro: "Não foi possível salvar o pedido médico." }); }
    });
  });

  app.get("/atendimentos/:id/pedidos-medicos/:pedidoId/arquivo", async (req, res) => {
    const id = idNumerico(req.params.id);
    const pedidoId = idNumerico(req.params.pedidoId);
    if (!id || !pedidoId) return res.status(400).json({ erro: "Documento inválido." });
    try {
      const registro = await prisma.pedidoMedico.findFirst({ where: {
        id: pedidoId, atendimentoId: id, organizacaoId: contexto.organizacaoId(), removidoEm: null,
        atendimento: { organizacaoId: contexto.organizacaoId() },
      } });
      if (!registro) return res.status(404).json({ erro: "Documento não encontrado." });
      const inline = req.query.visualizar === "1";
      res.setHeader("Content-Type", registro.mimeType);
      res.setHeader("Content-Length", registro.tamanhoBytes);
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "sandbox");
      // O nome original não é interpolado no cabeçalho, evitando header injection.
      res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="pedido-medico.${registro.mimeType === "application/pdf" ? "pdf" : registro.mimeType === "image/png" ? "png" : "jpg"}"`);
      return res.end(Buffer.from(registro.conteudo));
    } catch (e) { console.error("Erro ao baixar pedido:", e); return res.status(500).json({ erro: "Não foi possível abrir o documento." }); }
  });

  app.delete("/atendimentos/:id/pedidos-medicos/:pedidoId", async (req, res) => {
    const id = idNumerico(req.params.id), pedidoId = idNumerico(req.params.pedidoId);
    if (!id || !pedidoId) return res.status(400).json({ erro: "Documento inválido." });
    try {
      const resultado = await prisma.pedidoMedico.updateMany({
        where: { id: pedidoId, atendimentoId: id, organizacaoId: contexto.organizacaoId(), removidoEm: null,
          atendimento: { organizacaoId: contexto.organizacaoId() } },
        data: { removidoEm: new Date(), removidoPorId: contexto.usuarioId() },
      });
      if (!resultado.count) return res.status(404).json({ erro: "Documento não encontrado." });
      return res.json({ removido: true });
    } catch (e) { console.error("Erro ao remover pedido:", e); return res.status(500).json({ erro: "Não foi possível remover o pedido." }); }
  });
}
