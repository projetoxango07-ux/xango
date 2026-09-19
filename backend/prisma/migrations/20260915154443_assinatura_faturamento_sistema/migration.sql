-- CreateEnum
CREATE TYPE "StatusAssinaturaSistema" AS ENUM ('NAO_CONFIGURADA', 'ATIVA', 'EM_ATRASO', 'SUSPENSA', 'CANCELADA', 'ISENTA');

-- CreateEnum
CREATE TYPE "StatusFaturaSistema" AS ENUM ('ABERTA', 'PAGA', 'VENCIDA', 'CANCELADA');

-- AlterTable
ALTER TABLE "Organizacao" ADD COLUMN     "diaVencimentoMensalidadeSistema" INTEGER,
ADD COLUMN     "planoSistema" TEXT,
ADD COLUMN     "proximaCobrancaSistema" TIMESTAMP(3),
ADD COLUMN     "statusAssinaturaSistema" "StatusAssinaturaSistema" NOT NULL DEFAULT 'NAO_CONFIGURADA',
ADD COLUMN     "valorMensalidadeSistema" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "FaturaSistema" (
    "id" SERIAL NOT NULL,
    "codigoPublico" TEXT,
    "organizacaoId" INTEGER NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "status" "StatusFaturaSistema" NOT NULL DEFAULT 'ABERTA',
    "pagoEm" TIMESTAMP(3),
    "urlFatura" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaturaSistema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FaturaSistema_codigoPublico_key" ON "FaturaSistema"("codigoPublico");

-- CreateIndex
CREATE INDEX "FaturaSistema_organizacaoId_idx" ON "FaturaSistema"("organizacaoId");

-- CreateIndex
CREATE INDEX "FaturaSistema_status_idx" ON "FaturaSistema"("status");

-- CreateIndex
CREATE INDEX "FaturaSistema_vencimento_idx" ON "FaturaSistema"("vencimento");

-- CreateIndex
CREATE INDEX "FaturaSistema_competencia_idx" ON "FaturaSistema"("competencia");

-- AddForeignKey
ALTER TABLE "FaturaSistema" ADD CONSTRAINT "FaturaSistema_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
