/*
  Warnings:

  - A unique constraint covering the columns `[codigoPublico]` on the table `Atendimento` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[codigoPublico]` on the table `Guia` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[codigoPublico]` on the table `Paciente` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[codigoPublico]` on the table `Usuario` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StatusRecibo" AS ENUM ('ATIVO', 'PARCIALMENTE_ESTORNADO', 'ESTORNADO', 'CANCELADO');

-- AlterTable
ALTER TABLE "Atendimento" ADD COLUMN     "codigoPublico" TEXT;

-- AlterTable
ALTER TABLE "Guia" ADD COLUMN     "codigoPublico" TEXT;

-- AlterTable
ALTER TABLE "Paciente" ADD COLUMN     "codigoPublico" TEXT;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "codigoPublico" TEXT;

-- CreateTable
CREATE TABLE "SerieRecibo" (
    "id" SERIAL NOT NULL,
    "organizacaoId" INTEGER NOT NULL,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 100000,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SerieRecibo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recibo" (
    "id" SERIAL NOT NULL,
    "codigoPublico" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "organizacaoId" INTEGER NOT NULL,
    "guiaId" INTEGER NOT NULL,
    "emitidoPorId" INTEGER,
    "status" "StatusRecibo" NOT NULL DEFAULT 'ATIVO',
    "valorRecebido" DECIMAL(10,2) NOT NULL,
    "valorEstornado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nomePaciente" TEXT NOT NULL,
    "cpfPaciente" TEXT NOT NULL,
    "nomeClinica" TEXT NOT NULL,
    "documentoClinica" TEXT,
    "nomeOrganizacao" TEXT NOT NULL,
    "documentoOrganizacao" TEXT,
    "descricaoProcedimentos" TEXT NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recibo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReciboPagamento" (
    "reciboId" INTEGER NOT NULL,
    "pagamentoId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReciboPagamento_pkey" PRIMARY KEY ("reciboId","pagamentoId")
);

-- CreateIndex
CREATE UNIQUE INDEX "SerieRecibo_organizacaoId_key" ON "SerieRecibo"("organizacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Recibo_codigoPublico_key" ON "Recibo"("codigoPublico");

-- CreateIndex
CREATE UNIQUE INDEX "Recibo_organizacaoId_ano_numero_key" ON "Recibo"("organizacaoId", "ano", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Atendimento_codigoPublico_key" ON "Atendimento"("codigoPublico");

-- CreateIndex
CREATE UNIQUE INDEX "Guia_codigoPublico_key" ON "Guia"("codigoPublico");

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_codigoPublico_key" ON "Paciente"("codigoPublico");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_codigoPublico_key" ON "Usuario"("codigoPublico");

-- AddForeignKey
ALTER TABLE "SerieRecibo" ADD CONSTRAINT "SerieRecibo_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recibo" ADD CONSTRAINT "Recibo_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recibo" ADD CONSTRAINT "Recibo_guiaId_fkey" FOREIGN KEY ("guiaId") REFERENCES "Guia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recibo" ADD CONSTRAINT "Recibo_emitidoPorId_fkey" FOREIGN KEY ("emitidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReciboPagamento" ADD CONSTRAINT "ReciboPagamento_reciboId_fkey" FOREIGN KEY ("reciboId") REFERENCES "Recibo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReciboPagamento" ADD CONSTRAINT "ReciboPagamento_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
