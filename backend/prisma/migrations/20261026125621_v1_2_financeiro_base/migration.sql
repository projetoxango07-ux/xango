/*
  Warnings:

  - A unique constraint covering the columns `[despesaFinanceiraId]` on the table `MovimentacaoConta` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[retiradaSocioId]` on the table `MovimentacaoConta` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StatusParcelaReceber" AS ENUM ('PENDENTE', 'PARCIALMENTE_RECEBIDA', 'RECEBIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusSessaoCaixa" AS ENUM ('ABERTA', 'FECHADA');

-- CreateEnum
CREATE TYPE "NaturezaTransferenciaFinanceira" AS ENUM ('ENTRE_CONTAS', 'DEPOSITO');

-- CreateEnum
CREATE TYPE "TipoRetiradaSocio" AS ENUM ('PRO_LABORE', 'DISTRIBUICAO_LUCROS', 'ADIANTAMENTO', 'OUTRA');

-- AlterEnum
ALTER TYPE "FormaPagamento" ADD VALUE 'PIX_PARCELADO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrigemMovimentacaoConta" ADD VALUE 'DESPESA';
ALTER TYPE "OrigemMovimentacaoConta" ADD VALUE 'TRANSFERENCIA';
ALTER TYPE "OrigemMovimentacaoConta" ADD VALUE 'DEPOSITO';
ALTER TYPE "OrigemMovimentacaoConta" ADD VALUE 'RETIRADA_SOCIO';

-- AlterTable
ALTER TABLE "FormaRecebimento" ADD COLUMN     "baixaManualPorParcela" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permiteParcelamento" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MovimentacaoConta" ADD COLUMN     "despesaFinanceiraId" INTEGER,
ADD COLUMN     "retiradaSocioId" INTEGER,
ADD COLUMN     "sessaoCaixaId" INTEGER,
ADD COLUMN     "transferenciaId" INTEGER;

-- AlterTable
ALTER TABLE "Organizacao" ALTER COLUMN "formasPagamentoHabilitadas" SET DEFAULT ARRAY['PIX', 'PIX_PARCELADO', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO', 'TRANSFERENCIA', 'OUTRO']::"FormaPagamento"[];

-- AlterTable
ALTER TABLE "Pagamento" ADD COLUMN     "dataRecebimento" DATE,
ADD COLUMN     "parcelaReceberId" INTEGER,
ADD COLUMN     "registradoPorId" INTEGER;

-- CreateTable
CREATE TABLE "PlanoParcelamento" (
    "id" SERIAL NOT NULL,
    "organizacaoId" INTEGER NOT NULL,
    "guiaId" INTEGER NOT NULL,
    "formaRecebimentoId" INTEGER,
    "forma" "FormaPagamento" NOT NULL,
    "descricaoForma" TEXT,
    "valorTotal" DECIMAL(12,2) NOT NULL,
    "numeroParcelas" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacao" TEXT,
    "canceladoEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanoParcelamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelaReceber" (
    "id" SERIAL NOT NULL,
    "planoParcelamentoId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "vencimento" DATE NOT NULL,
    "valorPrevisto" DECIMAL(12,2) NOT NULL,
    "status" "StatusParcelaReceber" NOT NULL DEFAULT 'PENDENTE',
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParcelaReceber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoCaixa" (
    "id" SERIAL NOT NULL,
    "organizacaoId" INTEGER NOT NULL,
    "contaFinanceiraId" INTEGER NOT NULL,
    "dataMovimento" DATE NOT NULL,
    "status" "StatusSessaoCaixa" NOT NULL DEFAULT 'ABERTA',
    "saldoInicialInformado" DECIMAL(12,2) NOT NULL,
    "saldoFinalEsperado" DECIMAL(12,2),
    "saldoFinalContado" DECIMAL(12,2),
    "diferenca" DECIMAL(12,2),
    "abertoPorId" INTEGER NOT NULL,
    "fechadoPorId" INTEGER,
    "abertoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadoEm" TIMESTAMP(3),
    "observacaoAbertura" TEXT,
    "observacaoFechamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessaoCaixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DespesaFinanceira" (
    "id" SERIAL NOT NULL,
    "organizacaoId" INTEGER NOT NULL,
    "contaFinanceiraId" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT,
    "valor" DECIMAL(12,2) NOT NULL,
    "dataPagamento" DATE NOT NULL,
    "documentoReferencia" TEXT,
    "comprovanteReferencia" TEXT,
    "registradoPorId" INTEGER NOT NULL,
    "canceladaEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DespesaFinanceira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferenciaFinanceira" (
    "id" SERIAL NOT NULL,
    "organizacaoId" INTEGER NOT NULL,
    "contaOrigemId" INTEGER NOT NULL,
    "contaDestinoId" INTEGER NOT NULL,
    "natureza" "NaturezaTransferenciaFinanceira" NOT NULL DEFAULT 'ENTRE_CONTAS',
    "valor" DECIMAL(12,2) NOT NULL,
    "dataEfetiva" DATE NOT NULL,
    "descricao" TEXT,
    "comprovanteReferencia" TEXT,
    "registradoPorId" INTEGER NOT NULL,
    "canceladaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferenciaFinanceira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetiradaSocio" (
    "id" SERIAL NOT NULL,
    "organizacaoId" INTEGER NOT NULL,
    "contaFinanceiraId" INTEGER NOT NULL,
    "socioNome" TEXT NOT NULL,
    "tipo" "TipoRetiradaSocio" NOT NULL,
    "competencia" DATE,
    "valor" DECIMAL(12,2) NOT NULL,
    "dataEfetiva" DATE NOT NULL,
    "observacao" TEXT,
    "comprovanteReferencia" TEXT,
    "registradoPorId" INTEGER NOT NULL,
    "canceladaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetiradaSocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditoriaFinanceira" (
    "id" SERIAL NOT NULL,
    "organizacaoId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "entidade" TEXT NOT NULL,
    "registroId" INTEGER NOT NULL,
    "acao" TEXT NOT NULL,
    "motivo" TEXT,
    "dadosAnteriores" JSONB,
    "dadosNovos" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditoriaFinanceira_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanoParcelamento_organizacaoId_criadoEm_idx" ON "PlanoParcelamento"("organizacaoId", "criadoEm");

-- CreateIndex
CREATE INDEX "PlanoParcelamento_guiaId_idx" ON "PlanoParcelamento"("guiaId");

-- CreateIndex
CREATE INDEX "PlanoParcelamento_forma_ativo_idx" ON "PlanoParcelamento"("forma", "ativo");

-- CreateIndex
CREATE INDEX "ParcelaReceber_vencimento_status_idx" ON "ParcelaReceber"("vencimento", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelaReceber_planoParcelamentoId_numero_key" ON "ParcelaReceber"("planoParcelamentoId", "numero");

-- CreateIndex
CREATE INDEX "SessaoCaixa_organizacaoId_dataMovimento_idx" ON "SessaoCaixa"("organizacaoId", "dataMovimento");

-- CreateIndex
CREATE INDEX "SessaoCaixa_contaFinanceiraId_status_idx" ON "SessaoCaixa"("contaFinanceiraId", "status");

-- CreateIndex
CREATE INDEX "DespesaFinanceira_organizacaoId_dataPagamento_idx" ON "DespesaFinanceira"("organizacaoId", "dataPagamento");

-- CreateIndex
CREATE INDEX "DespesaFinanceira_contaFinanceiraId_dataPagamento_idx" ON "DespesaFinanceira"("contaFinanceiraId", "dataPagamento");

-- CreateIndex
CREATE INDEX "TransferenciaFinanceira_organizacaoId_dataEfetiva_idx" ON "TransferenciaFinanceira"("organizacaoId", "dataEfetiva");

-- CreateIndex
CREATE INDEX "TransferenciaFinanceira_contaOrigemId_dataEfetiva_idx" ON "TransferenciaFinanceira"("contaOrigemId", "dataEfetiva");

-- CreateIndex
CREATE INDEX "TransferenciaFinanceira_contaDestinoId_dataEfetiva_idx" ON "TransferenciaFinanceira"("contaDestinoId", "dataEfetiva");

-- CreateIndex
CREATE INDEX "RetiradaSocio_organizacaoId_dataEfetiva_idx" ON "RetiradaSocio"("organizacaoId", "dataEfetiva");

-- CreateIndex
CREATE INDEX "RetiradaSocio_contaFinanceiraId_dataEfetiva_idx" ON "RetiradaSocio"("contaFinanceiraId", "dataEfetiva");

-- CreateIndex
CREATE INDEX "RetiradaSocio_tipo_competencia_idx" ON "RetiradaSocio"("tipo", "competencia");

-- CreateIndex
CREATE INDEX "AuditoriaFinanceira_organizacaoId_criadoEm_idx" ON "AuditoriaFinanceira"("organizacaoId", "criadoEm");

-- CreateIndex
CREATE INDEX "AuditoriaFinanceira_entidade_registroId_idx" ON "AuditoriaFinanceira"("entidade", "registroId");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentacaoConta_despesaFinanceiraId_key" ON "MovimentacaoConta"("despesaFinanceiraId");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentacaoConta_retiradaSocioId_key" ON "MovimentacaoConta"("retiradaSocioId");

-- CreateIndex
CREATE INDEX "MovimentacaoConta_transferenciaId_idx" ON "MovimentacaoConta"("transferenciaId");

-- CreateIndex
CREATE INDEX "MovimentacaoConta_sessaoCaixaId_idx" ON "MovimentacaoConta"("sessaoCaixaId");

-- CreateIndex
CREATE INDEX "Pagamento_dataRecebimento_idx" ON "Pagamento"("dataRecebimento");

-- CreateIndex
CREATE INDEX "Pagamento_parcelaReceberId_idx" ON "Pagamento"("parcelaReceberId");

-- AddForeignKey
ALTER TABLE "MovimentacaoConta" ADD CONSTRAINT "MovimentacaoConta_despesaFinanceiraId_fkey" FOREIGN KEY ("despesaFinanceiraId") REFERENCES "DespesaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoConta" ADD CONSTRAINT "MovimentacaoConta_transferenciaId_fkey" FOREIGN KEY ("transferenciaId") REFERENCES "TransferenciaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoConta" ADD CONSTRAINT "MovimentacaoConta_retiradaSocioId_fkey" FOREIGN KEY ("retiradaSocioId") REFERENCES "RetiradaSocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoConta" ADD CONSTRAINT "MovimentacaoConta_sessaoCaixaId_fkey" FOREIGN KEY ("sessaoCaixaId") REFERENCES "SessaoCaixa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_parcelaReceberId_fkey" FOREIGN KEY ("parcelaReceberId") REFERENCES "ParcelaReceber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoParcelamento" ADD CONSTRAINT "PlanoParcelamento_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoParcelamento" ADD CONSTRAINT "PlanoParcelamento_guiaId_fkey" FOREIGN KEY ("guiaId") REFERENCES "Guia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoParcelamento" ADD CONSTRAINT "PlanoParcelamento_formaRecebimentoId_fkey" FOREIGN KEY ("formaRecebimentoId") REFERENCES "FormaRecebimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelaReceber" ADD CONSTRAINT "ParcelaReceber_planoParcelamentoId_fkey" FOREIGN KEY ("planoParcelamentoId") REFERENCES "PlanoParcelamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoCaixa" ADD CONSTRAINT "SessaoCaixa_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoCaixa" ADD CONSTRAINT "SessaoCaixa_contaFinanceiraId_fkey" FOREIGN KEY ("contaFinanceiraId") REFERENCES "ContaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoCaixa" ADD CONSTRAINT "SessaoCaixa_abertoPorId_fkey" FOREIGN KEY ("abertoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoCaixa" ADD CONSTRAINT "SessaoCaixa_fechadoPorId_fkey" FOREIGN KEY ("fechadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DespesaFinanceira" ADD CONSTRAINT "DespesaFinanceira_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DespesaFinanceira" ADD CONSTRAINT "DespesaFinanceira_contaFinanceiraId_fkey" FOREIGN KEY ("contaFinanceiraId") REFERENCES "ContaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DespesaFinanceira" ADD CONSTRAINT "DespesaFinanceira_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferenciaFinanceira" ADD CONSTRAINT "TransferenciaFinanceira_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferenciaFinanceira" ADD CONSTRAINT "TransferenciaFinanceira_contaOrigemId_fkey" FOREIGN KEY ("contaOrigemId") REFERENCES "ContaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferenciaFinanceira" ADD CONSTRAINT "TransferenciaFinanceira_contaDestinoId_fkey" FOREIGN KEY ("contaDestinoId") REFERENCES "ContaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferenciaFinanceira" ADD CONSTRAINT "TransferenciaFinanceira_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetiradaSocio" ADD CONSTRAINT "RetiradaSocio_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetiradaSocio" ADD CONSTRAINT "RetiradaSocio_contaFinanceiraId_fkey" FOREIGN KEY ("contaFinanceiraId") REFERENCES "ContaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetiradaSocio" ADD CONSTRAINT "RetiradaSocio_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaFinanceira" ADD CONSTRAINT "AuditoriaFinanceira_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaFinanceira" ADD CONSTRAINT "AuditoriaFinanceira_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
