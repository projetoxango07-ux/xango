-- Financeiro: pagamento misto, parcelamento e tarifas por operadora.

ALTER TYPE "FormaPagamento" ADD VALUE IF NOT EXISTS 'BOLETO';

ALTER TABLE "Organizacao"
ALTER COLUMN "formasPagamentoHabilitadas"
SET DEFAULT ARRAY[
  'PIX'::"FormaPagamento",
  'DINHEIRO'::"FormaPagamento",
  'CARTAO_CREDITO'::"FormaPagamento",
  'CARTAO_DEBITO'::"FormaPagamento",
  'BOLETO'::"FormaPagamento",
  'TRANSFERENCIA'::"FormaPagamento",
  'OUTRO'::"FormaPagamento"
];

-- Habilita boleto nas organizações já existentes uma única vez nesta migração.
UPDATE "Organizacao"
SET "formasPagamentoHabilitadas" = array_append(
  "formasPagamentoHabilitadas",
  'BOLETO'::"FormaPagamento"
)
WHERE NOT (
  'BOLETO'::"FormaPagamento" = ANY("formasPagamentoHabilitadas")
);

CREATE TABLE "OperadoraPagamento" (
  "id" SERIAL NOT NULL,
  "organizacaoId" INTEGER NOT NULL,
  "nome" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperadoraPagamento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TarifaPagamento" (
  "id" SERIAL NOT NULL,
  "operadoraId" INTEGER NOT NULL,
  "forma" "FormaPagamento" NOT NULL,
  "parcelas" INTEGER NOT NULL DEFAULT 1,
  "percentual" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "fixa" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TarifaPagamento_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Pagamento"
ADD COLUMN "operadoraId" INTEGER,
ADD COLUMN "parcelas" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "taxaPercentualAplicada" DECIMAL(7,4),
ADD COLUMN "taxaFixaAplicada" DECIMAL(10,2),
ADD COLUMN "valorTarifa" DECIMAL(10,2),
ADD COLUMN "valorLiquido" DECIMAL(10,2);

CREATE UNIQUE INDEX "OperadoraPagamento_organizacaoId_nome_key"
ON "OperadoraPagamento"("organizacaoId", "nome");

CREATE INDEX "OperadoraPagamento_organizacaoId_ativo_idx"
ON "OperadoraPagamento"("organizacaoId", "ativo");

CREATE UNIQUE INDEX "TarifaPagamento_operadoraId_forma_parcelas_key"
ON "TarifaPagamento"("operadoraId", "forma", "parcelas");

CREATE INDEX "TarifaPagamento_forma_parcelas_idx"
ON "TarifaPagamento"("forma", "parcelas");

CREATE INDEX "Pagamento_operadoraId_idx"
ON "Pagamento"("operadoraId");

CREATE INDEX "Pagamento_forma_parcelas_idx"
ON "Pagamento"("forma", "parcelas");

ALTER TABLE "OperadoraPagamento"
ADD CONSTRAINT "OperadoraPagamento_organizacaoId_fkey"
FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TarifaPagamento"
ADD CONSTRAINT "TarifaPagamento_operadoraId_fkey"
FOREIGN KEY ("operadoraId") REFERENCES "OperadoraPagamento"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Pagamento"
ADD CONSTRAINT "Pagamento_operadoraId_fkey"
FOREIGN KEY ("operadoraId") REFERENCES "OperadoraPagamento"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
