-- CreateTable
CREATE TABLE "PrecoProcedimentoUnidade" (
    "id" SERIAL NOT NULL,
    "unidadeClinicaId" INTEGER NOT NULL,
    "procedimentoId" INTEGER NOT NULL,
    "valorPaciente" DECIMAL(10,2) NOT NULL,
    "valorRepasse" DECIMAL(10,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecoProcedimentoUnidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrecoProcedimentoUnidade_unidadeClinicaId_idx" ON "PrecoProcedimentoUnidade"("unidadeClinicaId");

-- CreateIndex
CREATE INDEX "PrecoProcedimentoUnidade_procedimentoId_idx" ON "PrecoProcedimentoUnidade"("procedimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "PrecoProcedimentoUnidade_unidadeClinicaId_procedimentoId_key" ON "PrecoProcedimentoUnidade"("unidadeClinicaId", "procedimentoId");

-- AddForeignKey
ALTER TABLE "PrecoProcedimentoUnidade" ADD CONSTRAINT "PrecoProcedimentoUnidade_unidadeClinicaId_fkey" FOREIGN KEY ("unidadeClinicaId") REFERENCES "UnidadeClinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoProcedimentoUnidade" ADD CONSTRAINT "PrecoProcedimentoUnidade_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "Procedimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
