-- AlterTable
ALTER TABLE "Procedimento" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];
