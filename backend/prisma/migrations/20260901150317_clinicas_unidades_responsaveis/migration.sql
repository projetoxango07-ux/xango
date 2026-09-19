-- AlterTable
ALTER TABLE "Clinica" ADD COLUMN     "bairroFiscal" TEXT,
ADD COLUMN     "cepFiscal" TEXT,
ADD COLUMN     "cidadeFiscal" TEXT,
ADD COLUMN     "complementoFiscal" TEXT,
ADD COLUMN     "financeiroMesmoLegal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "logradouroFiscal" TEXT,
ADD COLUMN     "numeroFiscal" TEXT,
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "responsavelFinanceiroCargo" TEXT,
ADD COLUMN     "responsavelFinanceiroCpf" TEXT,
ADD COLUMN     "responsavelFinanceiroEmail" TEXT,
ADD COLUMN     "responsavelFinanceiroNome" TEXT,
ADD COLUMN     "responsavelFinanceiroTelefone" TEXT,
ADD COLUMN     "responsavelLegalCargo" TEXT,
ADD COLUMN     "responsavelLegalCpf" TEXT,
ADD COLUMN     "responsavelLegalEmail" TEXT,
ADD COLUMN     "responsavelLegalNome" TEXT,
ADD COLUMN     "responsavelLegalTelefone" TEXT,
ADD COLUMN     "ufFiscal" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- CreateTable
CREATE TABLE "UnidadeClinica" (
    "id" SERIAL NOT NULL,
    "clinicaId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "codigoPublico" TEXT,
    "usaEnderecoFiscal" BOOLEAN NOT NULL DEFAULT false,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnidadeClinica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnidadeClinica_codigoPublico_key" ON "UnidadeClinica"("codigoPublico");

-- CreateIndex
CREATE INDEX "UnidadeClinica_clinicaId_idx" ON "UnidadeClinica"("clinicaId");

-- AddForeignKey
ALTER TABLE "UnidadeClinica" ADD CONSTRAINT "UnidadeClinica_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
