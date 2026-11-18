BEGIN;
CREATE TYPE "ClassificacaoBonificacaoV3" AS ENUM ('NAO_CONFERIDO', 'ORIGINAL', 'REPETICAO');
CREATE TYPE "SituacaoFechamentoBonificacaoV3" AS ENUM ('FECHADO', 'APROVADO', 'PAGO', 'REABERTO');
ALTER TABLE "TerceirizacaoExame" ADD COLUMN "classificacaoBonificacaoV3" "ClassificacaoBonificacaoV3" NOT NULL DEFAULT 'NAO_CONFERIDO';
CREATE TABLE "RegraBonificacaoV3" (
 "id" SERIAL PRIMARY KEY, "organizacaoId" INTEGER NOT NULL, "funcionarioId" INTEGER NOT NULL,
 "tipoExame" "TipoExameTerceirizacao" NOT NULL, "valor" DECIMAL(14,2) NOT NULL,
 "inicioVigencia" DATE NOT NULL, "criadoPorId" INTEGER NOT NULL, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "RegraBonificacaoV3_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "RegraBonificacaoV3_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "RegraBonificacaoV3_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RegraBonificacaoV3_org_func_tipo_inicio_key" ON "RegraBonificacaoV3"("organizacaoId", "funcionarioId", "tipoExame", "inicioVigencia");
CREATE INDEX "RegraBonificacaoV3_organizacaoId_funcionarioId_tipoExame_idx" ON "RegraBonificacaoV3"("organizacaoId", "funcionarioId", "tipoExame");
CREATE TABLE "FechamentoBonificacaoV3" (
 "id" SERIAL PRIMARY KEY, "organizacaoId" INTEGER NOT NULL, "competencia" VARCHAR(7) NOT NULL,
 "situacao" "SituacaoFechamentoBonificacaoV3" NOT NULL DEFAULT 'FECHADO', "revisao" INTEGER NOT NULL DEFAULT 1,
 "vencimento" DATE NOT NULL, "feriadosLocais" TEXT[] DEFAULT ARRAY[]::TEXT[], "fechadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "aprovadoEm" TIMESTAMP(3), "pagoEm" DATE,
 CONSTRAINT "FechamentoBonificacaoV3_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FechamentoBonificacaoV3_organizacaoId_competencia_key" ON "FechamentoBonificacaoV3"("organizacaoId", "competencia");
CREATE TABLE "ItemBonificacaoV3" (
 "id" SERIAL PRIMARY KEY, "fechamentoId" INTEGER NOT NULL, "exameId" INTEGER NOT NULL,
 "funcionarioId" INTEGER NOT NULL, "regraId" INTEGER NOT NULL, "tipoExame" "TipoExameTerceirizacao" NOT NULL,
 "valor" DECIMAL(14,2) NOT NULL, "concluidoEm" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ItemBonificacaoV3_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES "FechamentoBonificacaoV3"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ItemBonificacaoV3_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES "TerceirizacaoExame"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ItemBonificacaoV3_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ItemBonificacaoV3_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "RegraBonificacaoV3"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ItemBonificacaoV3_exameId_key" ON "ItemBonificacaoV3"("exameId");
CREATE INDEX "ItemBonificacaoV3_fechamentoId_funcionarioId_idx" ON "ItemBonificacaoV3"("fechamentoId", "funcionarioId");
CREATE TABLE "EventoBonificacaoV3" (
 "id" SERIAL PRIMARY KEY, "organizacaoId" INTEGER NOT NULL, "fechamentoId" INTEGER, "exameId" INTEGER,
 "usuarioId" INTEGER NOT NULL, "acao" TEXT NOT NULL, "motivo" TEXT NOT NULL, "dados" JSONB,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "EventoBonificacaoV3_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "EventoBonificacaoV3_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES "FechamentoBonificacaoV3"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "EventoBonificacaoV3_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES "TerceirizacaoExame"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "EventoBonificacaoV3_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "EventoBonificacaoV3_organizacaoId_criadoEm_idx" ON "EventoBonificacaoV3"("organizacaoId", "criadoEm");
CREATE INDEX "EventoBonificacaoV3_fechamentoId_criadoEm_idx" ON "EventoBonificacaoV3"("fechamentoId", "criadoEm");
CREATE INDEX "EventoBonificacaoV3_exameId_criadoEm_idx" ON "EventoBonificacaoV3"("exameId", "criadoEm");
COMMIT;
