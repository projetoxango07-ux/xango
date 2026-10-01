-- AlterTable
ALTER TABLE "Paciente" ALTER COLUMN "cpf" DROP NOT NULL,
ALTER COLUMN "telefone" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PacienteImportacaoLegada" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "sistema" TEXT NOT NULL,
    "chaveExterna" TEXT NOT NULL,
    "dadosOriginais" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PacienteImportacaoLegada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PacienteImportacaoLegada_pacienteId_idx" ON "PacienteImportacaoLegada"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "PacienteImportacaoLegada_sistema_chaveExterna_key" ON "PacienteImportacaoLegada"("sistema", "chaveExterna");

-- AddForeignKey
ALTER TABLE "PacienteImportacaoLegada" ADD CONSTRAINT "PacienteImportacaoLegada_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
