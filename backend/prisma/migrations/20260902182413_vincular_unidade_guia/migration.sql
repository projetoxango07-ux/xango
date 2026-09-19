-- AlterTable
ALTER TABLE "Guia" ADD COLUMN     "unidadeClinicaId" INTEGER;

-- CreateIndex
CREATE INDEX "Guia_unidadeClinicaId_idx" ON "Guia"("unidadeClinicaId");

-- AddForeignKey
ALTER TABLE "Guia" ADD CONSTRAINT "Guia_unidadeClinicaId_fkey" FOREIGN KEY ("unidadeClinicaId") REFERENCES "UnidadeClinica"("id") ON DELETE SET NULL ON UPDATE CASCADE;
