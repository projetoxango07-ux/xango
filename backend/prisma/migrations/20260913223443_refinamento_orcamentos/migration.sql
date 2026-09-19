-- AlterTable
ALTER TABLE "ModeloOrcamento" ADD COLUMN     "favorito" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalUsos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultimoUsoEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Orcamento" ADD COLUMN     "condicoesPagamento" TEXT,
ADD COLUMN     "validadeAte" TIMESTAMP(3),
ADD COLUMN     "validadeDias" INTEGER NOT NULL DEFAULT 15;

-- CreateTable
CREATE TABLE "HistoricoOrcamento" (
    "id" SERIAL NOT NULL,
    "orcamentoId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "acao" TEXT NOT NULL,
    "descricao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoOrcamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricoOrcamento_orcamentoId_idx" ON "HistoricoOrcamento"("orcamentoId");

-- CreateIndex
CREATE INDEX "HistoricoOrcamento_usuarioId_idx" ON "HistoricoOrcamento"("usuarioId");

-- CreateIndex
CREATE INDEX "HistoricoOrcamento_acao_idx" ON "HistoricoOrcamento"("acao");

-- CreateIndex
CREATE INDEX "HistoricoOrcamento_criadoEm_idx" ON "HistoricoOrcamento"("criadoEm");

-- CreateIndex
CREATE INDEX "ModeloOrcamento_favorito_idx" ON "ModeloOrcamento"("favorito");

-- CreateIndex
CREATE INDEX "ModeloOrcamento_totalUsos_idx" ON "ModeloOrcamento"("totalUsos");

-- CreateIndex
CREATE INDEX "Orcamento_validadeAte_idx" ON "Orcamento"("validadeAte");

-- AddForeignKey
ALTER TABLE "HistoricoOrcamento" ADD CONSTRAINT "HistoricoOrcamento_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoOrcamento" ADD CONSTRAINT "HistoricoOrcamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
