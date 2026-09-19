-- CreateEnum
CREATE TYPE "StatusOrcamento" AS ENUM ('ABERTO', 'PARCIALMENTE_CONVERTIDO', 'ENCERRADO');

-- CreateTable
CREATE TABLE "Orcamento" (
    "id" SERIAL NOT NULL,
    "codigoPublico" TEXT,
    "organizacaoId" INTEGER,
    "criadoPorId" INTEGER,
    "pacienteId" INTEGER,
    "nomePaciente" TEXT NOT NULL,
    "telefonePaciente" TEXT NOT NULL,
    "status" "StatusOrcamento" NOT NULL DEFAULT 'ABERTO',
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemOrcamento" (
    "id" SERIAL NOT NULL,
    "orcamentoId" INTEGER NOT NULL,
    "procedimentoId" INTEGER NOT NULL,
    "clinicaId" INTEGER,
    "unidadeClinicaId" INTEGER,
    "valorPaciente" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valorRepasse" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "itemGuiaId" INTEGER,
    "convertidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemOrcamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Orcamento_codigoPublico_key" ON "Orcamento"("codigoPublico");

-- CreateIndex
CREATE INDEX "Orcamento_organizacaoId_idx" ON "Orcamento"("organizacaoId");

-- CreateIndex
CREATE INDEX "Orcamento_pacienteId_idx" ON "Orcamento"("pacienteId");

-- CreateIndex
CREATE INDEX "Orcamento_status_idx" ON "Orcamento"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ItemOrcamento_itemGuiaId_key" ON "ItemOrcamento"("itemGuiaId");

-- CreateIndex
CREATE INDEX "ItemOrcamento_orcamentoId_idx" ON "ItemOrcamento"("orcamentoId");

-- CreateIndex
CREATE INDEX "ItemOrcamento_procedimentoId_idx" ON "ItemOrcamento"("procedimentoId");

-- CreateIndex
CREATE INDEX "ItemOrcamento_clinicaId_idx" ON "ItemOrcamento"("clinicaId");

-- CreateIndex
CREATE INDEX "ItemOrcamento_unidadeClinicaId_idx" ON "ItemOrcamento"("unidadeClinicaId");

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOrcamento" ADD CONSTRAINT "ItemOrcamento_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOrcamento" ADD CONSTRAINT "ItemOrcamento_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "Procedimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOrcamento" ADD CONSTRAINT "ItemOrcamento_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOrcamento" ADD CONSTRAINT "ItemOrcamento_unidadeClinicaId_fkey" FOREIGN KEY ("unidadeClinicaId") REFERENCES "UnidadeClinica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOrcamento" ADD CONSTRAINT "ItemOrcamento_itemGuiaId_fkey" FOREIGN KEY ("itemGuiaId") REFERENCES "ItemGuia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
