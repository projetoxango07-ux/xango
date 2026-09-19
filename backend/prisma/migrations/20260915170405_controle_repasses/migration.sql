/*
  Warnings:

  - A unique constraint covering the columns `[codigoPublico]` on the table `Repasse` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "OrigemRepasse" AS ENUM ('INTERNO', 'PORTAL_PARCEIRO');

-- AlterTable
ALTER TABLE "Repasse" ADD COLUMN     "aprovadoEm" TIMESTAMP(3),
ADD COLUMN     "aprovadoPorId" INTEGER,
ADD COLUMN     "codigoPublico" TEXT,
ADD COLUMN     "dataPagamentoSolicitada" TIMESTAMP(3),
ADD COLUMN     "emAnaliseEm" TIMESTAMP(3),
ADD COLUMN     "motivoRecusa" TEXT,
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "organizacaoId" INTEGER,
ADD COLUMN     "origem" "OrigemRepasse" NOT NULL DEFAULT 'INTERNO',
ADD COLUMN     "pagoPorId" INTEGER,
ADD COLUMN     "recusadoEm" TIMESTAMP(3),
ADD COLUMN     "recusadoPorId" INTEGER,
ADD COLUMN     "solicitadoPorId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Repasse_codigoPublico_key" ON "Repasse"("codigoPublico");

-- CreateIndex
CREATE INDEX "Repasse_organizacaoId_idx" ON "Repasse"("organizacaoId");

-- CreateIndex
CREATE INDEX "Repasse_clinicaId_idx" ON "Repasse"("clinicaId");

-- CreateIndex
CREATE INDEX "Repasse_status_idx" ON "Repasse"("status");

-- CreateIndex
CREATE INDEX "Repasse_dataPagamentoSolicitada_idx" ON "Repasse"("dataPagamentoSolicitada");

-- AddForeignKey
ALTER TABLE "Repasse" ADD CONSTRAINT "Repasse_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repasse" ADD CONSTRAINT "Repasse_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repasse" ADD CONSTRAINT "Repasse_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repasse" ADD CONSTRAINT "Repasse_recusadoPorId_fkey" FOREIGN KEY ("recusadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repasse" ADD CONSTRAINT "Repasse_pagoPorId_fkey" FOREIGN KEY ("pagoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
