-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "permissoes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "senhaHash" TEXT,
ADD COLUMN     "trocarSenhaNoProximoLogin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ultimoLoginEm" TIMESTAMP(3),
ADD COLUMN     "usarPermissoesPersonalizadas" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SessaoUsuario" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "ultimoUsoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessaoUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessaoUsuario_tokenHash_key" ON "SessaoUsuario"("tokenHash");

-- CreateIndex
CREATE INDEX "SessaoUsuario_usuarioId_idx" ON "SessaoUsuario"("usuarioId");

-- CreateIndex
CREATE INDEX "SessaoUsuario_expiraEm_idx" ON "SessaoUsuario"("expiraEm");

-- AddForeignKey
ALTER TABLE "SessaoUsuario" ADD CONSTRAINT "SessaoUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
