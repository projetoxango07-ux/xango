-- CreateEnum
CREATE TYPE "TipoExameTerceirizacao" AS ENUM ('ECG', 'EEG', 'ESPIROMETRIA', 'MAPA', 'HOLTER');

-- CreateEnum
CREATE TYPE "StatusExameTerceirizacao" AS ENUM ('REALIZADO', 'ENVIADO_LAUDO', 'LAUDO_RECEBIDO', 'ENTREGUE', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoEquipamentoTerceirizacao" AS ENUM ('MAPA', 'HOLTER', 'ECG', 'EEG', 'ESPIROMETRO');

-- CreateTable
CREATE TABLE "TerceirizacaoProducao" (
    "id" SERIAL NOT NULL,
    "organizacaoId" INTEGER NOT NULL,
    "clinicaId" INTEGER NOT NULL,
    "unidadeClinicaId" INTEGER,
    "pacienteId" INTEGER,
    "nomePacienteDigitado" TEXT NOT NULL,
    "dataRealizacao" DATE NOT NULL,
    "criadoPorId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerceirizacaoProducao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerceirizacaoExame" (
    "id" SERIAL NOT NULL,
    "codigoInterno" TEXT NOT NULL,
    "producaoId" INTEGER NOT NULL,
    "tipoExame" "TipoExameTerceirizacao" NOT NULL,
    "procedimentoId" INTEGER,
    "executadoPorId" INTEGER NOT NULL,
    "status" "StatusExameTerceirizacao" NOT NULL DEFAULT 'REALIZADO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerceirizacaoExame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerceirizacaoEquipamento" (
    "id" SERIAL NOT NULL,
    "organizacaoId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoEquipamentoTerceirizacao" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerceirizacaoEquipamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerceirizacaoUsoEquipamento" (
    "id" SERIAL NOT NULL,
    "exameId" INTEGER NOT NULL,
    "equipamentoId" INTEGER NOT NULL,
    "instaladoEm" TIMESTAMP(3) NOT NULL,
    "retiradaPrevista" DATE,
    "retiradoEm" TIMESTAMP(3),
    "retiradoPorId" INTEGER,
    "descarregadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerceirizacaoUsoEquipamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TerceirizacaoProducao_organizacaoId_dataRealizacao_idx" ON "TerceirizacaoProducao"("organizacaoId", "dataRealizacao");

-- CreateIndex
CREATE INDEX "TerceirizacaoProducao_clinicaId_dataRealizacao_idx" ON "TerceirizacaoProducao"("clinicaId", "dataRealizacao");

-- CreateIndex
CREATE INDEX "TerceirizacaoProducao_pacienteId_dataRealizacao_idx" ON "TerceirizacaoProducao"("pacienteId", "dataRealizacao");

-- CreateIndex
CREATE UNIQUE INDEX "TerceirizacaoExame_codigoInterno_key" ON "TerceirizacaoExame"("codigoInterno");

-- CreateIndex
CREATE INDEX "TerceirizacaoExame_producaoId_idx" ON "TerceirizacaoExame"("producaoId");

-- CreateIndex
CREATE INDEX "TerceirizacaoExame_tipoExame_status_idx" ON "TerceirizacaoExame"("tipoExame", "status");

-- CreateIndex
CREATE INDEX "TerceirizacaoExame_executadoPorId_status_idx" ON "TerceirizacaoExame"("executadoPorId", "status");

-- CreateIndex
CREATE INDEX "TerceirizacaoEquipamento_organizacaoId_tipo_ativo_idx" ON "TerceirizacaoEquipamento"("organizacaoId", "tipo", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "TerceirizacaoEquipamento_organizacaoId_codigo_key" ON "TerceirizacaoEquipamento"("organizacaoId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "TerceirizacaoUsoEquipamento_exameId_key" ON "TerceirizacaoUsoEquipamento"("exameId");

-- CreateIndex
CREATE INDEX "TerceirizacaoUsoEquipamento_equipamentoId_descarregadoEm_idx" ON "TerceirizacaoUsoEquipamento"("equipamentoId", "descarregadoEm");

-- CreateIndex
CREATE INDEX "TerceirizacaoUsoEquipamento_retiradaPrevista_retiradoEm_idx" ON "TerceirizacaoUsoEquipamento"("retiradaPrevista", "retiradoEm");

-- AddForeignKey
ALTER TABLE "TerceirizacaoProducao" ADD CONSTRAINT "TerceirizacaoProducao_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerceirizacaoProducao" ADD CONSTRAINT "TerceirizacaoProducao_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerceirizacaoProducao" ADD CONSTRAINT "TerceirizacaoProducao_unidadeClinicaId_fkey" FOREIGN KEY ("unidadeClinicaId") REFERENCES "UnidadeClinica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerceirizacaoProducao" ADD CONSTRAINT "TerceirizacaoProducao_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerceirizacaoProducao" ADD CONSTRAINT "TerceirizacaoProducao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerceirizacaoExame" ADD CONSTRAINT "TerceirizacaoExame_producaoId_fkey" FOREIGN KEY ("producaoId") REFERENCES "TerceirizacaoProducao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerceirizacaoExame" ADD CONSTRAINT "TerceirizacaoExame_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "Procedimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerceirizacaoExame" ADD CONSTRAINT "TerceirizacaoExame_executadoPorId_fkey" FOREIGN KEY ("executadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerceirizacaoEquipamento" ADD CONSTRAINT "TerceirizacaoEquipamento_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerceirizacaoUsoEquipamento" ADD CONSTRAINT "TerceirizacaoUsoEquipamento_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES "TerceirizacaoExame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerceirizacaoUsoEquipamento" ADD CONSTRAINT "TerceirizacaoUsoEquipamento_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "TerceirizacaoEquipamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerceirizacaoUsoEquipamento" ADD CONSTRAINT "TerceirizacaoUsoEquipamento_retiradoPorId_fkey" FOREIGN KEY ("retiradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
