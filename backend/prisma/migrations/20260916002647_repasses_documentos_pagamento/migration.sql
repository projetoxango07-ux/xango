-- CreateEnum
CREATE TYPE "FormaPagamentoRepasse" AS ENUM ('PIX', 'TRANSFERENCIA', 'BOLETO', 'DINHEIRO', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoDocumentoRepasse" AS ENUM ('COMPROVANTE_PAGAMENTO', 'NOTA_FISCAL_SERVICO');

-- AlterTable
ALTER TABLE "Repasse" ADD COLUMN     "dataPagamentoEfetivo" TIMESTAMP(3),
ADD COLUMN     "formaPagamento" "FormaPagamentoRepasse",
ADD COLUMN     "observacaoPagamento" TEXT;

-- CreateTable
CREATE TABLE "DocumentoRepasse" (
    "id" SERIAL NOT NULL,
    "repasseId" INTEGER NOT NULL,
    "tipo" "TipoDocumentoRepasse" NOT NULL,
    "nomeOriginal" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "conteudo" BYTEA NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "enviadoPorId" INTEGER,
    "desativadoEm" TIMESTAMP(3),
    "desativadoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoRepasse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentoRepasse_repasseId_idx" ON "DocumentoRepasse"("repasseId");

-- CreateIndex
CREATE INDEX "DocumentoRepasse_tipo_idx" ON "DocumentoRepasse"("tipo");

-- CreateIndex
CREATE INDEX "DocumentoRepasse_ativo_idx" ON "DocumentoRepasse"("ativo");

-- AddForeignKey
ALTER TABLE "DocumentoRepasse" ADD CONSTRAINT "DocumentoRepasse_repasseId_fkey" FOREIGN KEY ("repasseId") REFERENCES "Repasse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoRepasse" ADD CONSTRAINT "DocumentoRepasse_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoRepasse" ADD CONSTRAINT "DocumentoRepasse_desativadoPorId_fkey" FOREIGN KEY ("desativadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
