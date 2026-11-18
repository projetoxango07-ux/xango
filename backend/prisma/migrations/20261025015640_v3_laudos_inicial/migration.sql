-- AlterTable
ALTER TABLE "TerceirizacaoExame" ADD COLUMN     "laudoDocumento" TEXT,
ADD COLUMN     "laudoEntregueEm" TIMESTAMP(3),
ADD COLUMN     "laudoEnviadoEm" TIMESTAMP(3),
ADD COLUMN     "laudoMeioEntrega" TEXT,
ADD COLUMN     "laudoNascimento" DATE,
ADD COLUMN     "laudoObservacoes" TEXT,
ADD COLUMN     "laudoRecebidoEm" TIMESTAMP(3),
ADD COLUMN     "laudoReferenciaEntrega" TEXT,
ADD COLUMN     "laudoTelemedicina" TEXT;

-- CreateTable
CREATE TABLE "TerceirizacaoEventoLaudo" (
    "id" SERIAL NOT NULL,
    "exameId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "acao" TEXT NOT NULL,
    "detalhes" TEXT,
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TerceirizacaoEventoLaudo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TerceirizacaoEventoLaudo_exameId_ocorridoEm_idx" ON "TerceirizacaoEventoLaudo"("exameId", "ocorridoEm");

-- CreateIndex
CREATE INDEX "TerceirizacaoEventoLaudo_usuarioId_ocorridoEm_idx" ON "TerceirizacaoEventoLaudo"("usuarioId", "ocorridoEm");

-- AddForeignKey
ALTER TABLE "TerceirizacaoEventoLaudo" ADD CONSTRAINT "TerceirizacaoEventoLaudo_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES "TerceirizacaoExame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerceirizacaoEventoLaudo" ADD CONSTRAINT "TerceirizacaoEventoLaudo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
