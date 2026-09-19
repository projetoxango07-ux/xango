-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "modoAprendizAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tourGuiadoAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tourPuladoHojeData" TEXT;

-- CreateTable
CREATE TABLE "TourPaginaUsuario" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "dataChave" TEXT NOT NULL,
    "pagina" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TourPaginaUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TourPaginaUsuario_usuarioId_dataChave_idx" ON "TourPaginaUsuario"("usuarioId", "dataChave");

-- CreateIndex
CREATE UNIQUE INDEX "TourPaginaUsuario_usuarioId_dataChave_pagina_key" ON "TourPaginaUsuario"("usuarioId", "dataChave", "pagina");

-- AddForeignKey
ALTER TABLE "TourPaginaUsuario" ADD CONSTRAINT "TourPaginaUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
