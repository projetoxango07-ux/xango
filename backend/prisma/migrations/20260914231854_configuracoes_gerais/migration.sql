-- AlterTable
ALTER TABLE "Organizacao" ADD COLUMN     "condicoesPagamentoOrcamentoPadrao" TEXT,
ADD COLUMN     "validadeGuiaMesesPadrao" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "validadeOrcamentoDiasPadrao" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "whatsapp" TEXT;
