"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Bug,
  Camera,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  PlayCircle,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type Artigo = {
  id: string;
  titulo: string;
  categoria: string;
  resumo: string;
  conteudo: string[];
};

type Relato = {
  id: number;
  protocolo: string;
  titulo: string;
  descricao: string;
  status: "ABERTO" | "EM_ANALISE" | "RESOLVIDO";
  possuiScreenshot: boolean;
  criadoEm: string;
  usuario: { nome: string; email: string | null };
};

const artigos: Artigo[] = [
  { id: "primeiros-passos", titulo: "Primeiros passos no sistema", categoria: "Começando", resumo: "Conheça o Dashboard, a pesquisa global, notificações e os atalhos principais.", conteudo: ["Comece pelo Dashboard: ele mostra o que exige atenção no dia.", "Use Ctrl + K para abrir rapidamente a pesquisa global.", "O sino reúne pendências operacionais e financeiras conforme as permissões do seu perfil.", "O card Precisa de ajuda? sempre traz você de volta a esta Central de Ajuda."] },
  { id: "novo-atendimento", titulo: "Como iniciar um atendimento", categoria: "Atendimentos", resumo: "Fluxo básico para cadastrar o contato, selecionar procedimentos e gerar guias.", conteudo: ["Abra Novo Atendimento.", "Localize ou cadastre o paciente e confirme os dados necessários.", "Selecione os procedimentos, clínica, data/horário e valores.", "Salve as guias e acompanhe pagamento, agendamento e realização até a conclusão."] },
  { id: "orcamentos", titulo: "Criar e converter um orçamento", categoria: "Orçamentos", resumo: "Crie uma cotação sem agendar e converta somente os itens escolhidos pelo paciente.", conteudo: ["Um orçamento inicial pode ser criado com nome e telefone.", "Escolha procedimentos, clínica e valores.", "O orçamento pode ser duplicado e convertido parcialmente.", "Ao converter, os itens escolhidos passam a integrar o fluxo de atendimento e guias."] },
  { id: "guias", titulo: "Guias, pagamentos e realização", categoria: "Guias", resumo: "Entenda a sequência entre guia, pagamento, impressão e confirmação do atendimento.", conteudo: ["A guia concentra clínica, procedimentos, agendamento e situação financeira.", "Depois de quitada, o voucher pode ser impresso conforme as regras do sistema.", "Após a realização, confirme o atendimento para liberar o fluxo operacional seguinte.", "Use o histórico para conferir pagamentos, recibos e estornos."] },
  { id: "repasses", titulo: "Controle de repasses às clínicas", categoria: "Financeiro", resumo: "Veja como uma solicitação passa por análise, aprovação e pagamento.", conteudo: ["Somente guias elegíveis entram em uma solicitação de repasse.", "A solicitação segue para análise e pode ser aprovada ou recusada.", "Após o pagamento, registre data, forma e documentos quando disponíveis.", "Os relatórios financeiros ajudam a conferir os valores por período e clínica."] },
  { id: "relatorios", titulo: "Relatórios e exportações", categoria: "Relatórios", resumo: "Filtre dados operacionais, financeiros e de produção e exporte CSV/PDF.", conteudo: ["Escolha a área do relatório: Operacionais, Financeiros ou Produção.", "Aplique período e filtros antes de conferir os indicadores.", "Clique nas linhas para abrir o resumo lateral.", "Use Exportar CSV para planilhas ou Imprimir/PDF para relatórios fechados."] },
];

export default function AjudaPage() {
  const { usuario } = useAuth();
  const [busca, setBusca] = useState("");
  const [artigoSelecionado, setArtigoSelecionado] = useState<Artigo | null>(null);
  const [modalProblema, setModalProblema] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [screenshotDataUrl, setScreenshotDataUrl] = useState("");
  const [capturando, setCapturando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [relatos, setRelatos] = useState<Relato[]>([]);

  const podeVerRelatos = usuario.perfil === "ADMINISTRADOR" || usuario.perfil === "DESENVOLVEDOR";

  const artigosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return artigos;
    return artigos.filter((artigo) => [artigo.titulo, artigo.categoria, artigo.resumo, ...artigo.conteudo].join(" ").toLowerCase().includes(termo));
  }, [busca]);

  async function carregarRelatos() {
    if (!podeVerRelatos) return;
    try {
      const resposta = await fetch(`${API_URL}/suporte/problemas`, { cache: "no-store" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Erro ao carregar relatos.");
      setRelatos(Array.isArray(dados.relatos) ? dados.relatos : []);
    } catch (erro) {
      console.error("Erro ao carregar relatos:", erro);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void carregarRelatos(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function iniciarTourGuiado() {
    window.dispatchEvent(new Event("digna:ativar-tour"));
  }

  async function capturarTela() {
    try {
      setCapturando(true);
      setMensagem("");
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setMensagem("Este navegador não permite captura de tela automática. Você ainda pode enviar o relato sem print.");
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const contexto = canvas.getContext("2d");
      if (!contexto) throw new Error("Não foi possível preparar a captura.");
      contexto.drawImage(video, 0, 0, canvas.width, canvas.height);
      stream.getTracks().forEach((track) => track.stop());
      setScreenshotDataUrl(canvas.toDataURL("image/png", 0.9));
      setMensagem("Captura adicionada ao relato.");
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === "NotAllowedError") {
        setMensagem("Captura cancelada. O relato pode ser enviado sem print.");
      } else {
        setMensagem("Não foi possível capturar a tela. O relato pode ser enviado sem print.");
      }
    } finally {
      setCapturando(false);
    }
  }

  async function enviarProblema() {
    if (descricao.trim().length < 5) {
      setMensagem("Descreva o problema com um pouco mais de detalhes.");
      return;
    }
    try {
      setEnviando(true);
      setMensagem("");
      const resposta = await fetch(`${API_URL}/suporte/problemas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim() || "Problema informado pelo usuário",
          descricao: descricao.trim(),
          pagina: document.title,
          rota: window.location.href,
          navegador: navigator.userAgent,
          screenshotDataUrl: screenshotDataUrl || null,
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível enviar o relato.");
      setMensagem(`Relato enviado com sucesso. Protocolo ${dados.protocolo}.`);
      setTitulo("");
      setDescricao("");
      setScreenshotDataUrl("");
      await carregarRelatos();
    } catch (erro) {
      setMensagem(erro instanceof Error ? erro.message : "Não foi possível enviar o relato.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-xango-accent">Treinamento e suporte</p><h2 className="mt-1 text-2xl font-bold text-xango-text">Central de Ajuda</h2><p className="mt-1 text-sm text-xango-muted">Artigos, imagens, vídeos de treinamento e suporte para a equipe de {usuario.organizacao.nomeFantasia}.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={iniciarTourGuiado} className="flex items-center gap-2 rounded-md bg-xango-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-xango-primary-hover"><GraduationCap size={17} />Iniciar Tour Guiado</button>
          <button type="button" onClick={() => { setModalProblema(true); setMensagem(""); }} className="flex items-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"><Bug size={17} />Informar um problema</button>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div>
          <div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-xango-muted" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar na Central de Ajuda..." className="w-full rounded-xl border border-xango-border bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-xango-primary" /></div>

          <section className="mt-5 grid gap-4 md:grid-cols-2">
            {artigosFiltrados.map((artigo) => (
              <button key={artigo.id} type="button" onClick={() => setArtigoSelecionado(artigo)} className="rounded-xl border border-xango-border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-xango-background text-xango-primary"><BookOpen size={19} /></div><span className="rounded-full bg-xango-background px-2.5 py-1 text-[10px] font-semibold text-xango-primary">{artigo.categoria}</span></div>
                <h3 className="mt-4 font-semibold text-xango-text">{artigo.titulo}</h3><p className="mt-2 text-sm leading-6 text-xango-muted">{artigo.resumo}</p><p className="mt-4 flex items-center gap-1 text-xs font-semibold text-xango-primary">Abrir tutorial <ChevronRight size={14} /></p>
              </button>
            ))}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-xango-border bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><PlayCircle className="text-xango-primary" size={22} /><div><h3 className="font-semibold text-xango-text">Vídeos de treinamento</h3><p className="text-xs text-xango-muted">Biblioteca preparada para conteúdos da equipe.</p></div></div><div className="mt-4 rounded-lg border border-dashed border-xango-border bg-xango-background p-5 text-center"><PlayCircle size={28} className="mx-auto text-xango-muted" /><p className="mt-2 text-sm font-medium text-xango-text">Nenhum vídeo publicado ainda</p><p className="mt-1 text-xs leading-5 text-xango-muted">Os vídeos poderão ser organizados por módulo e assunto.</p></div></section>
          <section className="rounded-xl border border-xango-border bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><ImageIcon className="text-xango-primary" size={22} /><div><h3 className="font-semibold text-xango-text">Guias com imagens</h3><p className="text-xs text-xango-muted">Passo a passo visual para rotinas da equipe.</p></div></div><p className="mt-4 text-sm leading-6 text-xango-muted">A estrutura da Central de Ajuda já separa artigos, imagens e vídeos do Tour Guiado, que apresenta os principais recursos diretamente dentro de cada tela.</p></section>
        </aside>
      </div>

      {podeVerRelatos && relatos.length > 0 && (
        <section className="mt-6 rounded-xl border border-xango-border bg-white p-5 shadow-sm">
          <div><h3 className="font-semibold text-xango-text">Relatos de problema recentes</h3><p className="mt-1 text-xs text-xango-muted">Visível para administrador e desenvolvedor.</p></div>
          <div className="mt-4 divide-y divide-xango-border">
            {relatos.slice(0, 10).map((relato) => (
              <div key={relato.id} className="grid gap-2 py-4 md:grid-cols-[120px_1fr_160px_110px] md:items-start">
                <div><p className="text-xs font-semibold text-xango-primary">{relato.protocolo}</p><p className="mt-1 text-[10px] text-xango-muted">{new Date(relato.criadoEm).toLocaleString("pt-BR")}</p></div>
                <div><p className="text-sm font-semibold text-xango-text">{relato.titulo}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-xango-muted">{relato.descricao}</p><p className="mt-1 text-[10px] text-xango-muted">Enviado por {relato.usuario.nome}</p></div>
                <div>{relato.possuiScreenshot ? <a href={`${API_URL}/suporte/problemas/${relato.id}/screenshot`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-xango-primary hover:underline">Abrir captura de tela</a> : <span className="text-xs text-xango-muted">Sem captura</span>}</div>
                <span className="rounded-full bg-xango-background px-2.5 py-1 text-center text-[10px] font-semibold text-xango-primary">{relato.status.replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {artigoSelecionado && (
        <>
          <button type="button" aria-label="Fechar artigo" onClick={() => setArtigoSelecionado(null)} className="fixed inset-0 z-40 bg-slate-900/25" />
          <aside className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-xl overflow-y-auto border-l border-xango-border bg-white p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><span className="rounded-full bg-xango-background px-2.5 py-1 text-[10px] font-semibold text-xango-primary">{artigoSelecionado.categoria}</span><h3 className="mt-3 text-2xl font-bold text-xango-text">{artigoSelecionado.titulo}</h3><p className="mt-2 text-sm leading-6 text-xango-muted">{artigoSelecionado.resumo}</p></div><button type="button" onClick={() => setArtigoSelecionado(null)} className="rounded-md p-2 text-xango-muted hover:bg-xango-background"><X size={18} /></button></div>
            <div className="mt-7 space-y-4">{artigoSelecionado.conteudo.map((item, indice) => <div key={item} className="flex gap-3"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-xango-primary text-xs font-bold text-white">{indice + 1}</div><p className="pt-0.5 text-sm leading-6 text-xango-text">{item}</p></div>)}</div>
          </aside>
        </>
      )}

      {modalProblema && (
        <>
          <button type="button" aria-label="Fechar relato" onClick={() => setModalProblema(false)} className="fixed inset-0 z-40 bg-slate-900/30" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-5 pointer-events-none">
            <div className="pointer-events-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-xango-border bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-red-600">Suporte</p><h3 className="mt-1 text-xl font-bold text-xango-text">Informar um problema</h3><p className="mt-1 text-sm text-xango-muted">Descreva o erro e, se ajudar, capture a tela antes de enviar.</p></div><button type="button" onClick={() => setModalProblema(false)} className="rounded-md p-2 text-xango-muted hover:bg-xango-background"><X size={18} /></button></div>
              <label className="mt-5 block text-sm font-semibold text-xango-text">Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: não consegui confirmar uma guia" className="mt-2 w-full rounded-md border border-xango-border px-3 py-2.5 text-sm outline-none focus:border-xango-primary" /></label>
              <label className="mt-4 block text-sm font-semibold text-xango-text">O que aconteceu?<textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={5} placeholder="Conte o que você estava fazendo, o que apareceu na tela e o que esperava que acontecesse." className="mt-2 w-full resize-y rounded-md border border-xango-border px-3 py-2.5 text-sm leading-6 outline-none focus:border-xango-primary" /></label>
              <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void capturarTela()} disabled={capturando} className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2.5 text-sm font-semibold text-xango-primary hover:bg-xango-background disabled:opacity-50">{capturando ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}Capturar tela</button>{screenshotDataUrl && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={15} />Print anexado</span>}{screenshotDataUrl && <button type="button" onClick={() => setScreenshotDataUrl("")} className="text-xs font-semibold text-red-700 hover:underline">Remover print</button>}</div>
              {screenshotDataUrl && <div role="img" aria-label="Prévia da captura de tela" className="mt-4 h-56 w-full rounded-lg border border-xango-border bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${screenshotDataUrl})` }} />}
              {mensagem && <div className="mt-4 rounded-md border border-xango-border bg-xango-background px-3 py-2 text-sm text-xango-text">{mensagem}</div>}
              <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setModalProblema(false)} className="rounded-md border border-xango-border px-4 py-2.5 text-sm font-semibold text-xango-text hover:bg-xango-background">Fechar</button><button type="button" onClick={() => void enviarProblema()} disabled={enviando} className="rounded-md bg-xango-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-xango-primary-hover disabled:opacity-50">{enviando ? "Enviando..." : "Enviar relato"}</button></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
