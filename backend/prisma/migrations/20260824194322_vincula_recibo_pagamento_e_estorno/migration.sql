/*
  Warnings:

  - A unique constraint covering the columns `[pagamentoId]` on the table `ReciboPagamento` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Estorno" ADD COLUMN     "pagamentoId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ReciboPagamento_pagamentoId_key" ON "ReciboPagamento"("pagamentoId");

-- AddForeignKey
ALTER TABLE "Estorno" ADD CONSTRAINT "Estorno_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
