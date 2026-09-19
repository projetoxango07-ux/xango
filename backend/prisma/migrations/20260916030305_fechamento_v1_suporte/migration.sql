-- CreateEnum
CREATE TYPE "StatusRelatoProblema" AS ENUM ('ABERTO', 'EM_ANALISE', 'RESOLVIDO');

-- CreateTable
CREATE TABLE "RelatoProblema" (
    "id" SERIAL NOT NULL,
    "organizacaoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "pagina" TEXT,
    "rota" TEXT,
    "navegador" TEXT,
    "screenshotMime" TEXT,
    "screenshot" BYTEA,
    "status" "StatusRelatoProblema" NOT NULL DEFAULT 'ABERTO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelatoProblema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RelatoProblema_organizacaoId_idx" ON "RelatoProblema"("organizacaoId");

-- CreateIndex
CREATE INDEX "RelatoProblema_usuarioId_idx" ON "RelatoProblema"("usuarioId");

-- CreateIndex
CREATE INDEX "RelatoProblema_status_idx" ON "RelatoProblema"("status");

-- CreateIndex
CREATE INDEX "RelatoProblema_criadoEm_idx" ON "RelatoProblema"("criadoEm");

-- AddForeignKey
ALTER TABLE "RelatoProblema" ADD CONSTRAINT "RelatoProblema_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatoProblema" ADD CONSTRAINT "RelatoProblema_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
