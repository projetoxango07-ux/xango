export type AcaoLoteV3 = "enviar" | "receber" | "entregar";
export type ItemLoteV3 = { id: number; corpo: Record<string, unknown> };
export type ResultadoLoteV3 = { id: number; ok: boolean; mensagem: string; incerto?: boolean };
export function destinoLaudoV3(exame: { producao: { clinica: { id: number }; unidadeClinica: { id: number } | null }; laudoUnidadeEntregaId: number | null }) {
  return `${exame.producao.clinica.id}:${exame.laudoUnidadeEntregaId ?? exame.producao.unidadeClinica?.id ?? "sem-unidade"}`;
}
export function podeSelecionarLaudoV3(exame: { status: string; executadoPorId: number; tipoExame: string; producao: { pacienteId: number | null }; usoEquipamento: { descarregadoEm: string | null } | null }, acao: AcaoLoteV3, usuarioId: number, admin: boolean) {
  if (acao === "receber") return exame.status === "ENVIADO_LAUDO";
  if (acao === "entregar") return exame.status === "LAUDO_RECEBIDO";
  return exame.status === "REALIZADO" && !!exame.producao.pacienteId && (admin || exame.executadoPorId === usuarioId) &&
    (!['MAPA','HOLTER'].includes(exame.tipoExame) || !!exame.usoEquipamento?.descarregadoEm);
}
export function parcelasValidasV3(forma: string, quantidade: number) {
  return Number.isInteger(quantidade) && quantidade >= 1 && quantidade <= 12 && (quantidade === 1 || /FATURAMENTO|PARCELAD|BOLETO/i.test(forma));
}
// Cada PATCH existente tem sua propria transacao, permissao, trilha e validacao de estado.
// Em falha de rede, o resultado pode ser incerto: parar e pedir consulta atualizada antes de repetir.
export async function registrarLoteLaudosV3(itens: ItemLoteV3[], enviar: (item: ItemLoteV3) => Promise<{ ok: boolean; mensagem: string }>, progresso: (n: number) => void = () => {}) {
  if (!itens.length || new Set(itens.map(i => i.id)).size !== itens.length) throw new Error("Seleção vazia ou duplicada.");
  const resultados: ResultadoLoteV3[] = [];
  for (const item of itens) {
    try {
      const r = await enviar(item);
      resultados.push({id:item.id,...r});
      progresso(resultados.length);
    } catch {
      resultados.push({id:item.id,ok:false,incerto:true,mensagem:"Comunicação interrompida. Confira o estado do exame antes de repetir."});
      break;
    }
  }
  return { resultados, naoProcessados: itens.slice(resultados.length).map(i=>i.id) };
}
