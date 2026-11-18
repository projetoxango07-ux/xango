-- V3.0 - prazo, destino do laudo e titulo automatico, exclusivamente V3.
-- Nenhuma instrucao modifica as tabelas operacionais/financeiras da V1.
CREATE TYPE "MarcoPrazoLaudoV3" AS ENUM ('REALIZACAO', 'ENVIO');

ALTER TABLE "TerceirizacaoExame"
  ADD COLUMN "laudoUnidadeEntregaId" INTEGER,
  ADD COLUMN "laudoPrevisaoOriginal" DATE,
  ADD COLUMN "laudoPrevisaoEntrega" DATE,
  ADD COLUMN "laudoConvenio" TEXT,
  ADD COLUMN "laudoCategoriaAtendimento" TEXT,
  ADD COLUMN "laudoFormaPagamento" TEXT,
  ADD COLUMN "laudoValorBaseReal" DECIMAL(14,2),
  ADD COLUMN "financeiroPendenciaV3" TEXT;

-- Titulo da V3 guarda a data de competencia da realizacao, separada de criadoEm.
-- Nullable para preservar registros financeiros de teste anteriores.
ALTER TABLE "TituloFinanceiroV3" ADD COLUMN "dataCompetencia" DATE;

CREATE TABLE "ConfiguracaoLaudoV3" (
  "id" SERIAL NOT NULL,
  "organizacaoId" INTEGER NOT NULL,
  "clinicaId" INTEGER NOT NULL,
  "tipoExame" "TipoExameTerceirizacao" NOT NULL,
  "prazoDias" INTEGER NOT NULL,
  "marcoPrazo" "MarcoPrazoLaudoV3" NOT NULL DEFAULT 'REALIZACAO',
  "convenios" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "formasPagamento" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "diasVencimento" INTEGER NOT NULL DEFAULT 0,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConfiguracaoLaudoV3_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditoriaTituloV3" (
  "id" SERIAL NOT NULL,
  "tituloId" INTEGER NOT NULL,
  "usuarioId" INTEGER NOT NULL,
  "motivo" TEXT NOT NULL,
  "dadosAnteriores" JSONB NOT NULL,
  "dadosNovos" JSONB NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditoriaTituloV3_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfiguracaoLaudoV3_organizacaoId_clinicaId_tipoExame_key"
  ON "ConfiguracaoLaudoV3"("organizacaoId","clinicaId","tipoExame");
CREATE INDEX "ConfiguracaoLaudoV3_clinicaId_tipoExame_idx"
  ON "ConfiguracaoLaudoV3"("clinicaId","tipoExame");
CREATE INDEX "AuditoriaTituloV3_tituloId_criadoEm_idx"
  ON "AuditoriaTituloV3"("tituloId","criadoEm");

ALTER TABLE "ConfiguracaoLaudoV3" ADD CONSTRAINT "ConfiguracaoLaudoV3_organizacaoId_fkey"
  FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConfiguracaoLaudoV3" ADD CONSTRAINT "ConfiguracaoLaudoV3_clinicaId_fkey"
  FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerceirizacaoExame" ADD CONSTRAINT "TerceirizacaoExame_laudoUnidadeEntregaId_fkey"
  FOREIGN KEY ("laudoUnidadeEntregaId") REFERENCES "UnidadeClinica"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditoriaTituloV3" ADD CONSTRAINT "AuditoriaTituloV3_tituloId_fkey"
  FOREIGN KEY ("tituloId") REFERENCES "TituloFinanceiroV3"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditoriaTituloV3" ADD CONSTRAINT "AuditoriaTituloV3_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
