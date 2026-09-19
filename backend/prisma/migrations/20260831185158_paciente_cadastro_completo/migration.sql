-- CreateEnum
CREATE TYPE "TipoVinculoFamiliar" AS ENUM ('PAI', 'MAE', 'FILHO', 'FILHA', 'IRMAO', 'IRMA', 'AVO', 'AVO_FEMININO', 'NETO', 'NETA', 'MARIDO', 'ESPOSA', 'COMPANHEIRO', 'COMPANHEIRA', 'RESPONSAVEL', 'DEPENDENTE', 'OUTRO');

-- AlterTable
ALTER TABLE "Paciente" ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "complementoEndereco" TEXT,
ADD COLUMN     "criadoPorId" INTEGER,
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "nomeMae" TEXT,
ADD COLUMN     "nomeSocial" TEXT,
ADD COLUMN     "numeroEndereco" TEXT,
ADD COLUMN     "responsavelLegalCpf" TEXT,
ADD COLUMN     "responsavelLegalEhMae" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "responsavelLegalNome" TEXT,
ADD COLUMN     "responsavelLegalParentesco" TEXT,
ADD COLUMN     "responsavelLegalTelefone" TEXT,
ADD COLUMN     "rg" TEXT,
ADD COLUMN     "telefoneSecundario" TEXT,
ADD COLUMN     "uf" TEXT;

-- CreateTable
CREATE TABLE "VinculoFamiliar" (
    "id" SERIAL NOT NULL,
    "pacienteOrigemId" INTEGER NOT NULL,
    "pacienteDestinoId" INTEGER NOT NULL,
    "tipo" "TipoVinculoFamiliar" NOT NULL,
    "removivel" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "encerradoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VinculoFamiliar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VinculoFamiliar_pacienteOrigemId_idx" ON "VinculoFamiliar"("pacienteOrigemId");

-- CreateIndex
CREATE INDEX "VinculoFamiliar_pacienteDestinoId_idx" ON "VinculoFamiliar"("pacienteDestinoId");

-- CreateIndex
CREATE UNIQUE INDEX "VinculoFamiliar_pacienteOrigemId_pacienteDestinoId_tipo_key" ON "VinculoFamiliar"("pacienteOrigemId", "pacienteDestinoId", "tipo");

-- AddForeignKey
ALTER TABLE "Paciente" ADD CONSTRAINT "Paciente_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoFamiliar" ADD CONSTRAINT "VinculoFamiliar_pacienteOrigemId_fkey" FOREIGN KEY ("pacienteOrigemId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoFamiliar" ADD CONSTRAINT "VinculoFamiliar_pacienteDestinoId_fkey" FOREIGN KEY ("pacienteDestinoId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
