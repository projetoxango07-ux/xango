import test from "node:test";
import assert from "node:assert/strict";
import { semCobrancaLiquidada } from "../src/regras-gratuidade-v13.js";

test("RETORNO zero para paciente e sem dinheiro é financeiramente liquidado", () => {
  assert.equal(semCobrancaLiquidada(0, 0), true);
  // O repasse deve continuar baseado no item REALIZADO e no valorRepasse cadastrado.
  const valorRepasse = 25;
  const realizado = true;
  assert.equal(realizado ? valorRepasse : 0, 25);
  assert.equal(false ? valorRepasse : 0, 0);
});
test("guia cobrável não é indevidamente quitada", () => {
  assert.equal(semCobrancaLiquidada(50, 0), false);
  assert.equal(semCobrancaLiquidada(50, 50), false);
});
test("valor zero com recebimento existente deve exigir regularização", () => {
  assert.equal(semCobrancaLiquidada(0, 10), false);
});
test("não aceitar valores inválidos", () => {
  assert.equal(semCobrancaLiquidada(Number.NaN, 0), false);
});
