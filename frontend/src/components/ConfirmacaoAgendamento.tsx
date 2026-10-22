"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";

type ItemConfirmacao = {
  id: number;
  status: string;
  quantidade?: number;
  detalhamento?: string | null;
  tipoAgendamento: "HORARIO" | "ORDEM_CHEGADA" | null;
  dataAgendamento: string | null;
  horarioAgendamento: string | null;
  procedimento: { nome: string; categoria?: string | null };
};

type GuiaConfirmacao = {
  id: number;
  codigoPublico: string | null;
  status: string;
  valorFinal: string | number;
  atendimento: { paciente: { nome: string; telefone: string | null } };
  clinica: { nome: string; tipoEstabelecimento?: string | null };
  unidadeClinica: {
    nome: string;
    logradouro?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
  } | null;
  itens: ItemConfirmacao[];
  pagamentos: { valor: string | number }[];
  estornos: { valor: string | number }[];
};

const real = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => {
  // Datas de agendamento são armazenadas às 12h para evitar deslocamento de fuso.
  const d = iso.slice(0, 10).split("-");
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : iso;
};
const telefoneWhatsApp = (valor: string | null) => {
  const digits = String(valor || "").replace(/\D/g, "");
  const nacional = digits.startsWith("55") && [12,13].includes(digits.length) ? digits.slice(2) : digits;
  return [10,11].includes(nacional.length) ? `55${nacional}` : null;
};
const semAcento = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

function procedimentosResumidos(itens: ItemConfirmacao[], laboratorio: boolean) {
  const nomes: string[] = [];
  let examesLaboratoriais = false;
  for (const item of itens) {
    const categoria = semAcento(item.procedimento.categoria || "");
    const ehLaboratorial = laboratorio || /ANALISES CLINICAS|LABORATOR|PATOLOGIA CLINICA|BIOQUIMICA|HEMATOLOGIA/.test(categoria);
    if (ehLaboratorial) { examesLaboratoriais = true; continue; }
    const qtd = Math.max(1, Number(item.quantidade || 1));
    const desc = item.detalhamento?.trim();
    nomes.push(`${item.procedimento.nome}${qtd > 1 ? ` (quantidade: ${qtd})` : ""}${desc ? ` — ${desc.replace(/[\n;]+/g, ", ")}` : ""}`);
  }
  if (examesLaboratoriais) nomes.unshift("Exames laboratoriais");
  return nomes;
}

function criarMensagem(guia: GuiaConfirmacao): string {
  const paciente = guia.atendimento.paciente;
  const primeiroNome = paciente.nome.trim().split(/\s+/)[0] || paciente.nome;
  const ativos = guia.itens.filter(i => i.status !== "CANCELADO" && i.dataAgendamento);
  const grupos = new Map<string, ItemConfirmacao[]>();
  for (const item of ativos) {
    const chave = [item.dataAgendamento!.slice(0, 10), item.tipoAgendamento, item.horarioAgendamento || ""].join("|");
    const lista = grupos.get(chave) || [];
    lista.push(item);
    grupos.set(chave, lista);
  }
  const laboratorio = guia.clinica.tipoEstabelecimento === "LABORATORIO_ANALISES_CLINICAS";
  const linhas: string[] = [
    `Olá, ${primeiroNome}! 😊`, "",
    "Seu agendamento pela *Digna Saúde* foi realizado:", "",
    `🏥 *Clínica:* ${guia.clinica.nome}`,
  ];
  if (guia.unidadeClinica) {
    const u = guia.unidadeClinica;
    linhas.push(`📍 *Unidade:* ${u.nome}`);
    const endereco = [u.logradouro && [u.logradouro, u.numero].filter(Boolean).join(", "), u.bairro, u.cidade && [u.cidade, u.uf].filter(Boolean).join("/")].filter(Boolean).join(" — ");
    if (endereco) linhas.push(`📍 *Endereço:* ${endereco}`);
  }
  for (const grupo of grupos.values()) {
    const primeiro = grupo[0];
    linhas.push("", `📋 *Procedimento(s):* ${procedimentosResumidos(grupo, laboratorio).join("; ")}`);
    linhas.push(`📅 *Data:* ${dataBR(primeiro.dataAgendamento!)}`);
    linhas.push(primeiro.tipoAgendamento === "ORDEM_CHEGADA"
      ? "🕒 *Atendimento por ordem de chegada*"
      : `🕒 *Horário:* ${primeiro.horarioAgendamento || "A confirmar com a clínica"}`);
  }
  const pago = Math.max(0, guia.pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0)
    - guia.estornos.reduce((s, e) => s + Number(e.valor || 0), 0));
  const total = Number(guia.valorFinal || 0);
  const saldo = Math.max(0, total - pago);
  linhas.push("", `💳 *Pagamento à Digna Saúde:* ${saldo <= 0.009 ? "Confirmado" : pago > 0 ? `Parcial — saldo pendente de ${real(saldo)}` : `Pendente — ${real(saldo)}`}.`);
  linhas.push("A clínica não deverá cobrar novamente os valores já pagos à Digna.");
  linhas.push("", "Leve documento de identificação, pedido médico e sua guia de atendimento.", "", "*Equipe Digna Saúde* 💙");
  return linhas.join("\n");
}

export default function ConfirmacaoAgendamento({ guia }: { guia: GuiaConfirmacao }) {
  const itensAgendados = guia.itens.filter(i => i.status !== "CANCELADO" && i.dataAgendamento);
  const pendentes = guia.itens.filter(i => i.status !== "CANCELADO" && !i.dataAgendamento).length;
  const bloqueado = ["CANCELADA", "ESTORNO_PENDENTE"].includes(guia.status);
  const modelo = useMemo(() => criarMensagem(guia), [guia]);
  const [textoEditado, setTextoEditado] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const texto = textoEditado ?? modelo;
  const numero = telefoneWhatsApp(guia.atendimento.paciente.telefone);
  if (itensAgendados.length === 0 || bloqueado) return (
    <section id="confirmacao-agendamento" className="rounded-lg border border-xango-border bg-white p-5">
      <h3 className="flex items-center gap-2 font-semibold text-xango-primary"><MessageCircle size={18} /> Confirmação por WhatsApp</h3>
      <p className="mt-2 text-sm text-amber-700">{bloqueado ? "Guia cancelada ou com estorno pendente. Resolva a situação antes de enviar confirmações." : "Nenhum procedimento possui data de agendamento definida. Registre o agendamento para liberar a mensagem."}</p>
    </section>
  );
  async function copiar() {
    let sucesso = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(texto); sucesso = true; } } catch { /* usa alternativa */ }
    if (!sucesso) {
      const campo = document.createElement("textarea");
      campo.value = texto; campo.style.position = "fixed"; campo.style.left = "-9999px";
      document.body.appendChild(campo);
      try { campo.focus(); campo.select(); sucesso = document.execCommand("copy"); }
      catch { sucesso = false; }
      finally { campo.remove(); }
    }
    setFeedback(sucesso ? "Mensagem copiada!" : "Não foi possível copiar. Verifique a permissão do navegador.");
  }
  function abrirWhatsApp() {
    if (!numero) return;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  }
  return (
    <section id="confirmacao-agendamento" className="rounded-lg border border-xango-border bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 font-semibold text-xango-primary"><MessageCircle size={18} /> Confirmação de agendamento por WhatsApp</h3>
      <p className="mt-2 text-sm text-xango-muted">Confira a mensagem antes de compartilhar. Nenhum envio é automático.</p>
      {pendentes > 0 && <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">Atenção: {pendentes} procedimento(s) ainda sem data e não incluído(s) nesta mensagem.</p>}
      <textarea aria-label="Mensagem de confirmação" value={texto} onChange={e => { setTextoEditado(e.target.value); setFeedback(""); }} rows={13} maxLength={4000} className="mt-4 w-full rounded-md border border-xango-border bg-white p-3 text-sm leading-6 outline-none focus:border-xango-primary" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void copiar()} className="flex items-center gap-2 rounded-md border border-xango-border px-4 py-2 text-sm font-semibold"><Copy size={16} /> Copiar</button>
        <button type="button" onClick={abrirWhatsApp} disabled={!numero} className="flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><ExternalLink size={16} /> Abrir WhatsApp</button>
        {feedback && <p role="status" className="flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check size={14} />{feedback}</p>}
        {!numero && <p className="text-xs text-amber-700">Paciente sem telefone válido; use Copiar.</p>}
      </div>
      <p className="mt-3 text-xs text-xango-muted">Confirme que o paciente aceita receber mensagens e que data, horário, procedimentos e situação financeira estão corretos.</p>
    </section>
  );
}
