-- AlterTable
ALTER TABLE "Clinica" ADD COLUMN     "parceriaAgendamentos" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "parceriaTerceirizacao" BOOLEAN NOT NULL DEFAULT false;
