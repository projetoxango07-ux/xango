-- AlterTable
ALTER TABLE "ItemGuia" ADD COLUMN     "confirmadaEm" TIMESTAMP(3),
ADD COLUMN     "confirmadaPorId" INTEGER,
ADD COLUMN     "realizadaEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RepasseItemProcedimento" (
    "id" SERIAL NOT NULL,
    "repasseItemId" INTEGER NOT NULL,
    "itemGuiaId" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepasseItemProcedimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepasseItemProcedimento_itemGuiaId_idx" ON "RepasseItemProcedimento"("itemGuiaId");

-- CreateIndex
CREATE UNIQUE INDEX "RepasseItemProcedimento_repasseItemId_itemGuiaId_key" ON "RepasseItemProcedimento"("repasseItemId", "itemGuiaId");

-- CreateIndex
CREATE INDEX "ItemGuia_confirmadaPorId_idx" ON "ItemGuia"("confirmadaPorId");

-- CreateIndex
CREATE INDEX "ItemGuia_realizadaEm_idx" ON "ItemGuia"("realizadaEm");

-- AddForeignKey
ALTER TABLE "ItemGuia" ADD CONSTRAINT "ItemGuia_confirmadaPorId_fkey" FOREIGN KEY ("confirmadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepasseItemProcedimento" ADD CONSTRAINT "RepasseItemProcedimento_repasseItemId_fkey" FOREIGN KEY ("repasseItemId") REFERENCES "RepasseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepasseItemProcedimento" ADD CONSTRAINT "RepasseItemProcedimento_itemGuiaId_fkey" FOREIGN KEY ("itemGuiaId") REFERENCES "ItemGuia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
