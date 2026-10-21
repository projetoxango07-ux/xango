-- CreateEnum
CREATE TYPE "SexoBiologicoPaciente" AS ENUM ('MASCULINO', 'FEMININO', 'INTERSEXO', 'NAO_INFORMADO');

-- CreateEnum
CREATE TYPE "GeneroPaciente" AS ENUM ('HOMEM', 'MULHER', 'NAO_BINARIO', 'OUTRO', 'PREFERE_NAO_INFORMAR');

-- CreateEnum
CREATE TYPE "MultiplicidadeProcedimento" AS ENUM ('UNICO', 'QUANTIDADE', 'DETALHADO');

-- DropIndex
DROP INDEX "ItemModeloOrcamento_modeloId_procedimentoId_key";

-- AlterTable
ALTER TABLE "ItemGuia" ADD COLUMN     "detalhamento" TEXT,
ADD COLUMN     "quantidade" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ItemModeloOrcamento" ADD COLUMN     "detalhamento" TEXT,
ADD COLUMN     "quantidade" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ItemOrcamento" ADD COLUMN     "detalhamento" TEXT,
ADD COLUMN     "quantidade" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Paciente" ADD COLUMN     "genero" "GeneroPaciente",
ADD COLUMN     "generoDescricao" TEXT,
ADD COLUMN     "sexoBiologico" "SexoBiologicoPaciente" NOT NULL DEFAULT 'NAO_INFORMADO';

-- AlterTable
ALTER TABLE "Procedimento" ADD COLUMN     "multiplicidade" "MultiplicidadeProcedimento" NOT NULL DEFAULT 'UNICO';

-- CreateTable
CREATE TABLE "ProcedimentoEquivalenciaHistorica" (
    "id" SERIAL NOT NULL,
    "codigoTussHistorico" TEXT NOT NULL,
    "nomeHistorico" TEXT,
    "referenciaAtualId" INTEGER NOT NULL,
    "fonte" TEXT,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcedimentoEquivalenciaHistorica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcedimentoEquivalenciaHistorica_codigoTussHistorico_key" ON "ProcedimentoEquivalenciaHistorica"("codigoTussHistorico");

-- CreateIndex
CREATE INDEX "ProcedimentoEquivalenciaHistorica_referenciaAtualId_idx" ON "ProcedimentoEquivalenciaHistorica"("referenciaAtualId");

-- CreateIndex
CREATE INDEX "ProcedimentoEquivalenciaHistorica_ativo_idx" ON "ProcedimentoEquivalenciaHistorica"("ativo");

-- CreateIndex
CREATE INDEX "ItemModeloOrcamento_modeloId_procedimentoId_idx" ON "ItemModeloOrcamento"("modeloId", "procedimentoId");

-- AddForeignKey
ALTER TABLE "ProcedimentoEquivalenciaHistorica" ADD CONSTRAINT "ProcedimentoEquivalenciaHistorica_referenciaAtualId_fkey" FOREIGN KEY ("referenciaAtualId") REFERENCES "ProcedimentoReferencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
