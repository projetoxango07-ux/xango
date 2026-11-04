-- V1.2: um caixa fisico por usuario, mantendo contas e movimentos antigos.
ALTER TABLE "ContaFinanceira"
  ADD COLUMN "responsavelCaixaId" INTEGER;

-- Vincula automaticamente somente contas historicas com um unico responsavel.
-- Caixas compartilhados permanecem sem vinculo e devem ser regularizados
-- administrativamente, sem misturar historicos de diferentes funcionarios.
WITH historico AS (
  SELECT "contaFinanceiraId", MIN("abertoPorId") AS usuario, COUNT(DISTINCT "abertoPorId") AS usuarios
  FROM "SessaoCaixa"
  GROUP BY "contaFinanceiraId"
), candidatos AS (
  SELECT conta.id, historico.usuario,
    ROW_NUMBER() OVER (PARTITION BY conta."organizacaoId", historico.usuario ORDER BY conta.id) AS ordem
  FROM "ContaFinanceira" conta JOIN historico ON historico."contaFinanceiraId" = conta.id
  WHERE conta.tipo = 'CAIXA' AND historico.usuarios = 1
)
UPDATE "ContaFinanceira" AS conta
SET "responsavelCaixaId" = candidatos.usuario
FROM candidatos
WHERE conta.id = candidatos.id AND candidatos.ordem = 1;

CREATE UNIQUE INDEX "ContaFinanceira_organizacaoId_responsavelCaixaId_key"
ON "ContaFinanceira"("organizacaoId", "responsavelCaixaId");

ALTER TABLE "ContaFinanceira" ADD CONSTRAINT "ContaFinanceira_responsavelCaixaId_fkey"
FOREIGN KEY ("responsavelCaixaId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integridade contra aberturas simultaneas por usuario ou conta.
CREATE UNIQUE INDEX "SessaoCaixa_um_caixa_aberto_por_usuario"
ON "SessaoCaixa" ("organizacaoId", "abertoPorId")
WHERE "status" = 'ABERTA';

CREATE UNIQUE INDEX "SessaoCaixa_uma_sessao_aberta_por_conta"
ON "SessaoCaixa" ("contaFinanceiraId")
WHERE "status" = 'ABERTA';
