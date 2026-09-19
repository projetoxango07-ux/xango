-- AlterTable
ALTER TABLE "Procedimento" ADD COLUMN     "referenciaId" INTEGER;

-- CreateTable
CREATE TABLE "ProcedimentoReferencia" (
    "id" SERIAL NOT NULL,
    "codigoTuss" TEXT NOT NULL,
    "nomeTuss" TEXT NOT NULL,
    "quantidadeCh" DECIMAL(12,4),
    "fonteCh" TEXT,
    "versaoReferencia" TEXT,
    "inicioVigencia" TIMESTAMP(3),
    "fimVigencia" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcedimentoReferencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcedimentoReferencia_codigoTuss_key" ON "ProcedimentoReferencia"("codigoTuss");

-- CreateIndex
CREATE INDEX "ProcedimentoReferencia_nomeTuss_idx" ON "ProcedimentoReferencia"("nomeTuss");

-- CreateIndex
CREATE INDEX "Procedimento_referenciaId_idx" ON "Procedimento"("referenciaId");

-- AddForeignKey
ALTER TABLE "Procedimento" ADD CONSTRAINT "Procedimento_referenciaId_fkey" FOREIGN KEY ("referenciaId") REFERENCES "ProcedimentoReferencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
