-- Financeiro: contas, formas de recebimento personalizadas e roteamento padrão editável.

CREATE TYPE "TipoContaFinanceira" AS ENUM ('BANCO', 'CARTEIRA_DIGITAL', 'CAIXA', 'OUTRO');
CREATE TYPE "TipoMovimentacaoConta" AS ENUM ('ENTRADA', 'SAIDA');
CREATE TYPE "OrigemMovimentacaoConta" AS ENUM ('PAGAMENTO', 'ESTORNO', 'REPASSE', 'AJUSTE');

CREATE TABLE "ContaFinanceira" (
  "id" SERIAL NOT NULL,
  "organizacaoId" INTEGER NOT NULL,
  "nome" TEXT NOT NULL,
  "tipo" "TipoContaFinanceira" NOT NULL DEFAULT 'BANCO',
  "saldoInicial" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "saldoInicialEm" TIMESTAMP(3),
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContaFinanceira_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FormaRecebimento" (
  "id" SERIAL NOT NULL,
  "organizacaoId" INTEGER NOT NULL,
  "nome" TEXT NOT NULL,
  "forma" "FormaPagamento" NOT NULL,
  "operadoraId" INTEGER,
  "contaPadraoId" INTEGER,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FormaRecebimento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TarifaFormaRecebimento" (
  "id" SERIAL NOT NULL,
  "formaRecebimentoId" INTEGER NOT NULL,
  "parcelas" INTEGER NOT NULL DEFAULT 1,
  "percentual" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "fixa" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TarifaFormaRecebimento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContaPadraoRepasse" (
  "id" SERIAL NOT NULL,
  "organizacaoId" INTEGER NOT NULL,
  "forma" "FormaPagamentoRepasse" NOT NULL,
  "contaFinanceiraId" INTEGER NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContaPadraoRepasse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MovimentacaoConta" (
  "id" SERIAL NOT NULL,
  "organizacaoId" INTEGER NOT NULL,
  "contaFinanceiraId" INTEGER NOT NULL,
  "tipo" "TipoMovimentacaoConta" NOT NULL,
  "origem" "OrigemMovimentacaoConta" NOT NULL,
  "valor" DECIMAL(12,2) NOT NULL,
  "descricao" TEXT,
  "dataMovimentacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pagamentoId" INTEGER,
  "estornoId" INTEGER,
  "repasseId" INTEGER,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MovimentacaoConta_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Pagamento"
ADD COLUMN "formaRecebimentoId" INTEGER,
ADD COLUMN "contaFinanceiraId" INTEGER,
ADD COLUMN "formaRecebimentoNome" TEXT,
ADD COLUMN "operadoraNome" TEXT,
ADD COLUMN "contaFinanceiraNome" TEXT,
ADD COLUMN "contaPadraoIdSnapshot" INTEGER,
ADD COLUMN "contaAlteradaManualmente" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Repasse"
ADD COLUMN "contaFinanceiraId" INTEGER,
ADD COLUMN "contaFinanceiraNome" TEXT,
ADD COLUMN "contaPadraoIdSnapshot" INTEGER,
ADD COLUMN "contaAlteradaManualmente" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "ContaFinanceira_organizacaoId_nome_key"
ON "ContaFinanceira"("organizacaoId", "nome");
CREATE INDEX "ContaFinanceira_organizacaoId_ativo_idx"
ON "ContaFinanceira"("organizacaoId", "ativo");

CREATE UNIQUE INDEX "FormaRecebimento_organizacaoId_nome_key"
ON "FormaRecebimento"("organizacaoId", "nome");
CREATE INDEX "FormaRecebimento_organizacaoId_forma_ativo_idx"
ON "FormaRecebimento"("organizacaoId", "forma", "ativo");
CREATE INDEX "FormaRecebimento_operadoraId_idx"
ON "FormaRecebimento"("operadoraId");
CREATE INDEX "FormaRecebimento_contaPadraoId_idx"
ON "FormaRecebimento"("contaPadraoId");

CREATE UNIQUE INDEX "TarifaFormaRecebimento_formaRecebimentoId_parcelas_key"
ON "TarifaFormaRecebimento"("formaRecebimentoId", "parcelas");
CREATE INDEX "TarifaFormaRecebimento_parcelas_idx"
ON "TarifaFormaRecebimento"("parcelas");

CREATE UNIQUE INDEX "ContaPadraoRepasse_organizacaoId_forma_key"
ON "ContaPadraoRepasse"("organizacaoId", "forma");
CREATE INDEX "ContaPadraoRepasse_contaFinanceiraId_idx"
ON "ContaPadraoRepasse"("contaFinanceiraId");

CREATE UNIQUE INDEX "MovimentacaoConta_pagamentoId_key" ON "MovimentacaoConta"("pagamentoId");
CREATE UNIQUE INDEX "MovimentacaoConta_estornoId_key" ON "MovimentacaoConta"("estornoId");
CREATE UNIQUE INDEX "MovimentacaoConta_repasseId_key" ON "MovimentacaoConta"("repasseId");
CREATE INDEX "MovimentacaoConta_organizacaoId_dataMovimentacao_idx"
ON "MovimentacaoConta"("organizacaoId", "dataMovimentacao");
CREATE INDEX "MovimentacaoConta_contaFinanceiraId_dataMovimentacao_idx"
ON "MovimentacaoConta"("contaFinanceiraId", "dataMovimentacao");
CREATE INDEX "MovimentacaoConta_tipo_origem_idx"
ON "MovimentacaoConta"("tipo", "origem");

CREATE INDEX "Pagamento_formaRecebimentoId_idx" ON "Pagamento"("formaRecebimentoId");
CREATE INDEX "Pagamento_contaFinanceiraId_idx" ON "Pagamento"("contaFinanceiraId");
CREATE INDEX "Repasse_contaFinanceiraId_idx" ON "Repasse"("contaFinanceiraId");

ALTER TABLE "ContaFinanceira"
ADD CONSTRAINT "ContaFinanceira_organizacaoId_fkey"
FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FormaRecebimento"
ADD CONSTRAINT "FormaRecebimento_organizacaoId_fkey"
FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "FormaRecebimento_operadoraId_fkey"
FOREIGN KEY ("operadoraId") REFERENCES "OperadoraPagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "FormaRecebimento_contaPadraoId_fkey"
FOREIGN KEY ("contaPadraoId") REFERENCES "ContaFinanceira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TarifaFormaRecebimento"
ADD CONSTRAINT "TarifaFormaRecebimento_formaRecebimentoId_fkey"
FOREIGN KEY ("formaRecebimentoId") REFERENCES "FormaRecebimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContaPadraoRepasse"
ADD CONSTRAINT "ContaPadraoRepasse_organizacaoId_fkey"
FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "ContaPadraoRepasse_contaFinanceiraId_fkey"
FOREIGN KEY ("contaFinanceiraId") REFERENCES "ContaFinanceira"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Pagamento"
ADD CONSTRAINT "Pagamento_formaRecebimentoId_fkey"
FOREIGN KEY ("formaRecebimentoId") REFERENCES "FormaRecebimento"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "Pagamento_contaFinanceiraId_fkey"
FOREIGN KEY ("contaFinanceiraId") REFERENCES "ContaFinanceira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Repasse"
ADD CONSTRAINT "Repasse_contaFinanceiraId_fkey"
FOREIGN KEY ("contaFinanceiraId") REFERENCES "ContaFinanceira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MovimentacaoConta"
ADD CONSTRAINT "MovimentacaoConta_organizacaoId_fkey"
FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "MovimentacaoConta_contaFinanceiraId_fkey"
FOREIGN KEY ("contaFinanceiraId") REFERENCES "ContaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "MovimentacaoConta_pagamentoId_fkey"
FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "MovimentacaoConta_estornoId_fkey"
FOREIGN KEY ("estornoId") REFERENCES "Estorno"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "MovimentacaoConta_repasseId_fkey"
FOREIGN KEY ("repasseId") REFERENCES "Repasse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cada operadora já cadastrada recebe uma conta homônima como ponto de partida.
INSERT INTO "ContaFinanceira" ("organizacaoId", "nome", "tipo", "saldoInicial", "ativo")
SELECT op."organizacaoId", op."nome", 'CARTEIRA_DIGITAL'::"TipoContaFinanceira", 0, op."ativo"
FROM "OperadoraPagamento" op
ON CONFLICT ("organizacaoId", "nome") DO NOTHING;

-- Formas básicas ficam disponíveis mesmo antes da configuração de contas.
INSERT INTO "FormaRecebimento" ("organizacaoId", "nome", "forma", "ativo")
SELECT o."id", v.nome, v.forma::"FormaPagamento", true
FROM "Organizacao" o
CROSS JOIN (VALUES
  ('PIX', 'PIX'),
  ('Dinheiro', 'DINHEIRO'),
  ('Cartão de crédito', 'CARTAO_CREDITO'),
  ('Cartão de débito', 'CARTAO_DEBITO'),
  ('Boleto', 'BOLETO'),
  ('Transferência', 'TRANSFERENCIA'),
  ('Outro', 'OUTRO')
) AS v(nome, forma)
ON CONFLICT ("organizacaoId", "nome") DO NOTHING;

-- Converte as tarifas da primeira versão em formas personalizadas por operadora.
INSERT INTO "FormaRecebimento" (
  "organizacaoId", "nome", "forma", "operadoraId", "contaPadraoId", "ativo"
)
SELECT DISTINCT
  op."organizacaoId",
  CASE tp."forma"
    WHEN 'PIX' THEN 'PIX - ' || op."nome"
    WHEN 'DINHEIRO' THEN 'Dinheiro - ' || op."nome"
    WHEN 'CARTAO_CREDITO' THEN 'Crédito - ' || op."nome"
    WHEN 'CARTAO_DEBITO' THEN 'Débito - ' || op."nome"
    WHEN 'BOLETO' THEN 'Boleto - ' || op."nome"
    WHEN 'TRANSFERENCIA' THEN 'Transferência - ' || op."nome"
    ELSE 'Outro - ' || op."nome"
  END,
  tp."forma",
  op."id",
  cf."id",
  op."ativo"
FROM "TarifaPagamento" tp
JOIN "OperadoraPagamento" op ON op."id" = tp."operadoraId"
LEFT JOIN "ContaFinanceira" cf
  ON cf."organizacaoId" = op."organizacaoId" AND cf."nome" = op."nome"
ON CONFLICT ("organizacaoId", "nome") DO NOTHING;

INSERT INTO "TarifaFormaRecebimento" (
  "formaRecebimentoId", "parcelas", "percentual", "fixa", "ativo"
)
SELECT
  fr."id",
  tp."parcelas",
  tp."percentual",
  tp."fixa",
  tp."ativo"
FROM "TarifaPagamento" tp
JOIN "OperadoraPagamento" op ON op."id" = tp."operadoraId"
JOIN "FormaRecebimento" fr
  ON fr."organizacaoId" = op."organizacaoId"
 AND fr."operadoraId" = op."id"
 AND fr."forma" = tp."forma"
ON CONFLICT ("formaRecebimentoId", "parcelas") DO UPDATE SET
  "percentual" = EXCLUDED."percentual",
  "fixa" = EXCLUDED."fixa",
  "ativo" = EXCLUDED."ativo";

-- Liga pagamentos existentes a uma forma de recebimento quando for possível.
UPDATE "Pagamento" p
SET
  "formaRecebimentoId" = fr."id",
  "formaRecebimentoNome" = fr."nome",
  "operadoraNome" = op."nome",
  "contaFinanceiraId" = fr."contaPadraoId",
  "contaFinanceiraNome" = cf."nome",
  "contaPadraoIdSnapshot" = fr."contaPadraoId"
FROM "FormaRecebimento" fr
LEFT JOIN "OperadoraPagamento" op ON op."id" = fr."operadoraId"
LEFT JOIN "ContaFinanceira" cf ON cf."id" = fr."contaPadraoId"
WHERE p."operadoraId" IS NOT NULL
  AND fr."operadoraId" = p."operadoraId"
  AND fr."forma" = p."forma"
  AND p."formaRecebimentoId" IS NULL;

UPDATE "Pagamento" p
SET
  "formaRecebimentoId" = fr."id",
  "formaRecebimentoNome" = fr."nome"
FROM "Guia" g, "FormaRecebimento" fr
WHERE g."id" = p."guiaId"
  AND g."organizacaoId" IS NOT NULL
  AND fr."organizacaoId" = g."organizacaoId"
  AND fr."forma" = p."forma"
  AND fr."operadoraId" IS NULL
  AND p."formaRecebimentoId" IS NULL;
