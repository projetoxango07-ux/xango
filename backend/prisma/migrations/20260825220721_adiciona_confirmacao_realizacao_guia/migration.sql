-- AlterTable
ALTER TABLE "Guia" ADD COLUMN     "confirmadaEm" TIMESTAMP(3),
ADD COLUMN     "confirmadaPorId" INTEGER,
ADD COLUMN     "realizadaEm" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Guia" ADD CONSTRAINT "Guia_confirmadaPorId_fkey" FOREIGN KEY ("confirmadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
