-- CreateEnum
CREATE TYPE "MetodoCalculoFinanceiroV3" AS ENUM ('FIXO', 'PERCENTUAL');

-- CreateEnum
CREATE TYPE "NaturezaTituloFinanceiroV3" AS ENUM ('A_RECEBER', 'A_PAGAR');

-- CreateTable
CREATE TABLE "RegraFinanceiraV3" (
    "id" SERIAL NOT NULL,
    "organizacaoId" INTEGER NOT NULL,
    "clinicaId" INTEGER NOT NULL,
    "tipoExame" "TipoExameTerceirizacao" NOT NULL,
    "convenio" TEXT NOT NULL DEFAULT '',
    "categoriaAtendimento" TEXT NOT NULL DEFAULT '',
    "metodo" "MetodoCalculoFinanceiroV3" NOT NULL,
    "valorFixo" DECIMAL(14,2),
    "percentual" DECIMAL(7,4),
    "valorBaseReferencia" DECIMAL(14,2),
    "inicioVigencia" DATE NOT NULL,
    "fimVigencia" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "criadoPorId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegraFinanceiraV3_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TituloFinanceiroV3" (
    "id" SERIAL NOT NULL,
    "organizacaoId" INTEGER NOT NULL,
    "clinicaId" INTEGER NOT NULL,
    "exameId" INTEGER NOT NULL,
    "regraId" INTEGER,
    "natureza" "NaturezaTituloFinanceiroV3" NOT NULL DEFAULT 'A_RECEBER',
    "convenio" TEXT NOT NULL DEFAULT '',
    "categoriaAtendimento" TEXT NOT NULL DEFAULT '',
    "formaPagamentoOrigem" TEXT,
    "valorBaseReferencia" DECIMAL(14,2),
    "percentualAplicado" DECIMAL(7,4),
    "valorDevido" DECIMAL(14,2) NOT NULL,
    "observacoes" TEXT,
    "canceladoEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "criadoPorId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TituloFinanceiroV3_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelaFinanceiraV3" (
    "id" SERIAL NOT NULL,
    "tituloId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "vencimento" DATE NOT NULL,
    "valorPrevisto" DECIMAL(14,2) NOT NULL,
    "canceladaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParcelaFinanceiraV3_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaixaFinanceiraV3" (
    "id" SERIAL NOT NULL,
    "parcelaId" INTEGER NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "dataEfetiva" DATE NOT NULL,
    "formaPagamento" TEXT,
    "referencia" TEXT,
    "observacoes" TEXT,
    "registradoPorId" INTEGER NOT NULL,
    "estornadoEm" TIMESTAMP(3),
    "estornadoPorId" INTEGER,
    "motivoEstorno" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BaixaFinanceiraV3_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegraFinanceiraV3_organizacaoId_clinicaId_tipoExame_ativo_idx" ON "RegraFinanceiraV3"("organizacaoId", "clinicaId", "tipoExame", "ativo");

-- CreateIndex
CREATE INDEX "RegraFinanceiraV3_clinicaId_inicioVigencia_fimVigencia_idx" ON "RegraFinanceiraV3"("clinicaId", "inicioVigencia", "fimVigencia");

-- CreateIndex
CREATE INDEX "TituloFinanceiroV3_organizacaoId_clinicaId_natureza_idx" ON "TituloFinanceiroV3"("organizacaoId", "clinicaId", "natureza");

-- CreateIndex
CREATE INDEX "TituloFinanceiroV3_regraId_idx" ON "TituloFinanceiroV3"("regraId");

-- CreateIndex
CREATE UNIQUE INDEX "TituloFinanceiroV3_exameId_natureza_key" ON "TituloFinanceiroV3"("exameId", "natureza");

-- CreateIndex
CREATE INDEX "ParcelaFinanceiraV3_vencimento_idx" ON "ParcelaFinanceiraV3"("vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelaFinanceiraV3_tituloId_numero_key" ON "ParcelaFinanceiraV3"("tituloId", "numero");

-- CreateIndex
CREATE INDEX "BaixaFinanceiraV3_parcelaId_dataEfetiva_idx" ON "BaixaFinanceiraV3"("parcelaId", "dataEfetiva");

-- CreateIndex
CREATE INDEX "BaixaFinanceiraV3_dataEfetiva_estornadoEm_idx" ON "BaixaFinanceiraV3"("dataEfetiva", "estornadoEm");

-- AddForeignKey
ALTER TABLE "RegraFinanceiraV3" ADD CONSTRAINT "RegraFinanceiraV3_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegraFinanceiraV3" ADD CONSTRAINT "RegraFinanceiraV3_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegraFinanceiraV3" ADD CONSTRAINT "RegraFinanceiraV3_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TituloFinanceiroV3" ADD CONSTRAINT "TituloFinanceiroV3_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TituloFinanceiroV3" ADD CONSTRAINT "TituloFinanceiroV3_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TituloFinanceiroV3" ADD CONSTRAINT "TituloFinanceiroV3_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES "TerceirizacaoExame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TituloFinanceiroV3" ADD CONSTRAINT "TituloFinanceiroV3_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "RegraFinanceiraV3"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TituloFinanceiroV3" ADD CONSTRAINT "TituloFinanceiroV3_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelaFinanceiraV3" ADD CONSTRAINT "ParcelaFinanceiraV3_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "TituloFinanceiroV3"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaixaFinanceiraV3" ADD CONSTRAINT "BaixaFinanceiraV3_parcelaId_fkey" FOREIGN KEY ("parcelaId") REFERENCES "ParcelaFinanceiraV3"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaixaFinanceiraV3" ADD CONSTRAINT "BaixaFinanceiraV3_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaixaFinanceiraV3" ADD CONSTRAINT "BaixaFinanceiraV3_estornadoPorId_fkey" FOREIGN KEY ("estornadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
