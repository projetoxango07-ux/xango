/*
  Warnings:

  - A unique constraint covering the columns `[codigoPublico]` on the table `Estorno` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizacaoId,ano,numero]` on the table `Estorno` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Estorno" ADD COLUMN     "ano" INTEGER,
ADD COLUMN     "codigoPublico" TEXT,
ADD COLUMN     "emitidoPorId" INTEGER,
ADD COLUMN     "numero" INTEGER,
ADD COLUMN     "organizacaoId" INTEGER;

-- CreateTable
CREATE TABLE "SerieEstorno" (
    "id" SERIAL NOT NULL,
    "organizacaoId" INTEGER NOT NULL,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 100000,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SerieEstorno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SerieEstorno_organizacaoId_key" ON "SerieEstorno"("organizacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Estorno_codigoPublico_key" ON "Estorno"("codigoPublico");

-- CreateIndex
CREATE UNIQUE INDEX "Estorno_organizacaoId_ano_numero_key" ON "Estorno"("organizacaoId", "ano", "numero");

-- AddForeignKey
ALTER TABLE "Estorno" ADD CONSTRAINT "Estorno_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estorno" ADD CONSTRAINT "Estorno_emitidoPorId_fkey" FOREIGN KEY ("emitidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerieEstorno" ADD CONSTRAINT "SerieEstorno_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
