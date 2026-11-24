-- V1.3: documentos médicos privados; não interfere nos dados financeiros.
CREATE TABLE "PedidoMedico" (
    "id" SERIAL NOT NULL,
    "organizacaoId" INTEGER NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "atendimentoId" INTEGER NOT NULL,
    "nomeOriginal" VARCHAR(180) NOT NULL,
    "mimeType" VARCHAR(40) NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "conteudo" BYTEA NOT NULL,
    "enviadoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removidoEm" TIMESTAMP(3),
    "removidoPorId" INTEGER,
    CONSTRAINT "PedidoMedico_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PedidoMedico_organizacaoId_pacienteId_criadoEm_idx"
  ON "PedidoMedico"("organizacaoId","pacienteId","criadoEm");
CREATE INDEX "PedidoMedico_organizacaoId_atendimentoId_criadoEm_idx"
  ON "PedidoMedico"("organizacaoId","atendimentoId","criadoEm");
ALTER TABLE "PedidoMedico" ADD CONSTRAINT "PedidoMedico_organizacaoId_fkey"
  FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PedidoMedico" ADD CONSTRAINT "PedidoMedico_pacienteId_fkey"
  FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PedidoMedico" ADD CONSTRAINT "PedidoMedico_atendimentoId_fkey"
  FOREIGN KEY ("atendimentoId") REFERENCES "Atendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PedidoMedico" ADD CONSTRAINT "PedidoMedico_enviadoPorId_fkey"
  FOREIGN KEY ("enviadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
