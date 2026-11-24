/** Guia isenta não recebe pagamento fictício; o status técnico PAGA significa
 * obrigação do paciente liquidada. A interface distingue 'Sem cobrança'.
 * Em guias com pagamento antigo, o excedente requer estorno formal. */
export function semCobrancaLiquidada(valorFinal: number, recebidoLiquido: number): boolean {
  return Number.isFinite(valorFinal) && Number.isFinite(recebidoLiquido) &&
    Math.abs(valorFinal) < 0.005 && Math.abs(recebidoLiquido) < 0.005;
}
