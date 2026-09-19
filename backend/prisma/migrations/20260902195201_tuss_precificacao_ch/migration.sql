/*
  Warnings:

  - A unique constraint covering the columns `[codigoTuss]` on the table `Procedimento` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TipoEstabelecimentoClinica" AS ENUM ('CLINICA', 'LABORATORIO_ANALISES_CLINICAS');

-- CreateEnum
CREATE TYPE "TipoPrecificacaoClinica" AS ENUM ('INDIVIDUAL', 'CH');

-- CreateEnum
CREATE TYPE "ModoPrecoProcedimento" AS ENUM ('FIXO', 'CH');

-- AlterTable
ALTER TABLE "Clinica" ADD COLUMN     "tipoEstabelecimento" "TipoEstabelecimentoClinica" NOT NULL DEFAULT 'CLINICA',
ADD COLUMN     "tipoPrecificacao" "TipoPrecificacaoClinica" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN     "valorChPaciente" DECIMAL(12,4),
ADD COLUMN     "valorChRepasse" DECIMAL(12,4);

-- AlterTable
ALTER TABLE "PrecoProcedimentoClinica" ADD COLUMN     "modoPreco" "ModoPrecoProcedimento" NOT NULL DEFAULT 'FIXO';

-- AlterTable
ALTER TABLE "Procedimento" ADD COLUMN     "codigoTuss" TEXT,
ADD COLUMN     "nomeTuss" TEXT,
ADD COLUMN     "quantidadeCh" DECIMAL(12,4);

-- CreateIndex
CREATE UNIQUE INDEX "Procedimento_codigoTuss_key" ON "Procedimento"("codigoTuss");
