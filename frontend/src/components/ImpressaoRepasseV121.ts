/** Impressão V1.2.1: por solicitação, uma linha por guia, sem duplicar recebimentos. */
type Linha = {
  guiaId: number;
  voucher: string;
  paciente: string;
  cpf: string | null;
  procedimentos: string[];
  valorGuia: number;
  valorRecebidoGuia: number | null;
  valorRepasse: number;
};
type Demonstrativo = {
  codigoPublico: string;
  clinica: string;
  status: string;
  solicitadoEm: string;
  solicitadoPor: string | null;
  dataPagamentoSolicitada: string | null;
  observacoes: string | null;
  linhas: Linha[];
  totais: { quantidadeGuias: number; valorGuias: number; valorRecebido: number | null; valorRepasse: number };
};

function seguro(valor: unknown) {
  return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function moeda(valor: number | null) {
  return valor === null ? "Restrito" : Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dia(valor: string | null) {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Abre a janela sincronamente com o clique, evitando bloqueador de pop-ups. */
export async function abrirImpressaoRepasseV121(repasseId: number, apiUrl: string) {
  const janela = window.open("", "_blank", "width=1200,height=850");
  if (!janela) {
    alert("Libere as janelas pop-up para imprimir a solicitação de repasse.");
    return;
  }
  janela.document.write("<title>Preparando solicitação...</title><p>Carregando demonstrativo...</p>");
  try {
    const resposta = await fetch(`${apiUrl}/financeiro/repasses/${repasseId}/impressao`, { cache: "no-store", credentials: "include" });
    const dados = await resposta.json() as Demonstrativo & { erro?: string };
    if (!resposta.ok) throw new Error(dados.erro || "Não foi possível consultar a solicitação.");
    const colunas = [
      { id: "voucher", titulo: "Voucher", padrao: true },
      { id: "paciente", titulo: "Paciente", padrao: true },
      { id: "cpf", titulo: "CPF", padrao: false },
      { id: "procedimentos", titulo: "Exames", padrao: true },
      { id: "valorGuia", titulo: "Valor total da guia", padrao: false },
      ...(dados.totais.valorRecebido === null ? [] : [{ id: "recebido", titulo: "Recebido na guia (total)", padrao: false }]),
      { id: "repasse", titulo: "Valor do repasse", padrao: true },
    ];
    const coluna = (id: string, conteudo: string, cabecalho = false) =>
      `<${cabecalho ? "th" : "td"} class="c-${id}${["valorGuia", "recebido", "repasse"].includes(id) ? " numero" : ""}">${conteudo}</${cabecalho ? "th" : "td"}>`;
    const cabecalho = colunas.map(c => coluna(c.id, seguro(c.titulo), true)).join("");
    const linhas = dados.linhas.map(item => `<tr>
      ${coluna("voucher", seguro(item.voucher))}
      ${coluna("paciente", seguro(item.paciente))}
      ${coluna("cpf", seguro(item.cpf || "—"))}
      ${coluna("procedimentos", seguro(item.procedimentos.join(" • ")))}
      ${coluna("valorGuia", moeda(item.valorGuia))}
      ${dados.totais.valorRecebido === null ? "" : coluna("recebido", moeda(item.valorRecebidoGuia))}
      ${coluna("repasse", `<strong>${moeda(item.valorRepasse)}</strong>`)}
    </tr>`).join("");
    const totais = [
      coluna("voucher", `<strong>TOTAL (${dados.totais.quantidadeGuias} guias)</strong>`),
      coluna("paciente", ""), coluna("cpf", ""), coluna("procedimentos", ""),
      coluna("valorGuia", `<strong>${moeda(dados.totais.valorGuias)}</strong>`),
      ...(dados.totais.valorRecebido === null ? [] : [coluna("recebido", `<strong>${moeda(dados.totais.valorRecebido)}</strong>`)]),
      coluna("repasse", `<strong>${moeda(dados.totais.valorRepasse)}</strong>`),
    ].join("");
    const classesIniciais = colunas.filter(c => !c.padrao).map(c => `esconder-${c.id}`).join(" ");
    const controles = colunas.map(c => `<label><input type="checkbox" data-coluna="${c.id}" ${c.padrao ? "checked" : ""}> ${seguro(c.titulo)}</label>`).join("");
    const cssColunas = colunas.map(c => `.esconder-${c.id} .c-${c.id}{display:none}`).join("\n");
    janela.document.open();
    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${seguro(dados.codigoPublico)} — Solicitação de repasse</title>
    <style>
      :root{font-family:Arial,Helvetica,sans-serif;color:#17213a}body{margin:0;padding:22px;background:#f8fafc}
      .folha{background:white;max-width:1230px;margin:auto;padding:24px;box-shadow:0 2px 14px #0001}
      .ferramentas{max-width:1230px;margin:0 auto 14px;padding:16px;background:white;border:1px solid #ddd;border-radius:8px}
      .controles{display:flex;flex-wrap:wrap;gap:12px;padding:10px 0}label{font-size:12px;white-space:nowrap}
      button{background:#5b21b6;color:white;border:0;border-radius:6px;padding:10px 15px;cursor:pointer;font-weight:bold}
      h1{font-size:20px;margin:4px 0 12px}h2{font-size:14px;margin:0 0 9px}p{margin:4px 0}
      .marca{font-size:12px;color:#5b21b6;font-weight:bold;letter-spacing:.08em}
      .info{display:flex;flex-wrap:wrap;gap:12px 24px;border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:12px 0;margin-bottom:14px;font-size:12px}
      .info b{display:block;margin-bottom:3px;color:#64748b;font-size:10px;text-transform:uppercase}
      table{width:100%;border-collapse:collapse;font-size:11px;table-layout:auto}
      th{text-align:left;background:#ede9fe;color:#3b0764;padding:9px 8px;white-space:normal}
      td{padding:9px 8px;vertical-align:top;border-bottom:1px solid #e5e7eb;overflow-wrap:anywhere}
      tr:nth-child(even){background:#fafafa}tfoot td{border-top:2px solid #5b21b6;background:#f5f3ff}
      .numero{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
      .aviso{font-size:10px;color:#64748b;margin-top:16px;line-height:1.5}
      ${cssColunas}
      @media print{body{padding:0;background:white}.folha{padding:0;box-shadow:none;max-width:none}.ferramentas{display:none}thead{display:table-header-group}tfoot{display:table-row-group}tr{break-inside:avoid}th,td{padding:6px 5px} @page{size:A4 landscape;margin:12mm}}
    </style></head><body class="${classesIniciais}">
    <section class="ferramentas"><strong>Colunas do demonstrativo</strong><p style="font-size:12px;color:#64748b">Marque apenas os dados apropriados ao destinatário. Valores internos ficam ocultos inicialmente.</p><div class="controles">${controles}</div><button id="imprimir">Imprimir / salvar PDF</button></section>
    <main class="folha"><div class="marca">DIGNA SAÚDE · CONTROLE DE REPASSES</div><h1>Solicitação ${seguro(dados.codigoPublico)}</h1>
    <div class="info">
      <div><b>Clínica</b>${seguro(dados.clinica)}</div>
      <div><b>Situação</b>${seguro(dados.status)}</div>
      <div><b>Solicitada em</b>${seguro(dia(dados.solicitadoEm))}</div>
      <div><b>Pagamento solicitado</b>${seguro(dia(dados.dataPagamentoSolicitada))}</div>
      <div><b>Solicitado por</b>${seguro(dados.solicitadoPor || "—")}</div>
    </div>
    <h2>Guias incluídas na solicitação</h2><table><thead><tr>${cabecalho}</tr></thead><tbody>${linhas}</tbody><tfoot><tr>${totais}</tr></tfoot></table>
    <p class="aviso">${dados.observacoes ? `Observações: ${seguro(dados.observacoes)}. ` : ""}A coluna “Recebido na guia (total)” corresponde ao total líquido efetivamente pago pelo paciente à Digna, em toda a guia (e não apenas aos procedimentos deste repasse). O valor pode mudar após novas baixas/estornos; a emissão reflete a situação na data da consulta. Solicitação de repasse não equivale a pagamento efetuado. Gerado em ${seguro(new Date().toLocaleString("pt-BR"))}.</p>
    </main><script>
      document.querySelectorAll("input[data-coluna]").forEach(function(c){c.addEventListener("change",function(){document.body.classList.toggle("esconder-" + c.dataset.coluna,!c.checked)})});
      document.getElementById("imprimir").addEventListener("click",function(){window.print()});
    </script></body></html>`);
    janela.document.close();
  } catch (erro) {
    janela.document.open();
    janela.document.write(`<p style="font-family:Arial;padding:24px">${seguro(erro instanceof Error ? erro.message : "Falha ao carregar demonstrativo.")}</p>`);
    janela.document.close();
  }
}
