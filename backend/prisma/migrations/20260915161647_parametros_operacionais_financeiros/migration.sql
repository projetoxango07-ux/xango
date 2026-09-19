-- AlterTable
ALTER TABLE "Organizacao" ADD COLUMN     "formasPagamentoHabilitadas" "FormaPagamento"[] DEFAULT ARRAY['PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'TRANSFERENCIA', 'OUTRO']::"FormaPagamento"[],
ADD COLUMN     "textoPadraoEstorno" TEXT,
ADD COLUMN     "textoPadraoRecibo" TEXT;
