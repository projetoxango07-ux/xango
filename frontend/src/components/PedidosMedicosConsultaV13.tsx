"use client";

import { useEffect, useState } from "react";
import { Download, Eye, FileText } from "lucide-react";
import { enviarPedidoMedicoV13 } from "./PedidosMedicosV13";

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:3333";

type Documento = {
  id: number;
  atendimentoId: number;
  nomeOriginal: string;
  mimeType: string;
  tamanhoBytes: number;
  criadoEm: string;
};

type Estado = "carregando" | "pronto" | "erro";

async function erroDaApi(resposta: Response): Promise<string> {
  try {
    const dados = await resposta.json();
    return typeof dados.erro === "string" ? dados.erro : "Não foi possível consultar os pedidos médicos.";
  } catch {
    return "Não foi possível consultar os pedidos médicos.";
  }
}

function tipoArquivo(documento: Documento): string {
  if (documento.mimeType === "application/pdf") return "PDF";
  if (documento.mimeType === "image/jpeg") return "Imagem JPG";
  if (documento.mimeType === "image/png") return "Imagem PNG";
  return "Arquivo";
}

function dataEnvio(valor: string): string {
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? "Data não informada"
    : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Consulta apenas os documentos do atendimento informado.
 * Sem URLs públicas: cada arquivo é obtido com cookie de sessão e autorização da API.
 * Permite inclusão nos painéis laterais, sem exclusão de arquivos.
 */
export function PedidosMedicosConsultaV13({ atendimentoId }: { atendimentoId: number }) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [estado, setEstado] = useState<Estado>("carregando");
  const [erro, setErro] = useState("");
  const [abrindoId, setAbrindoId] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [atualizacao, setAtualizacao] = useState(0);
  const [erroEnvio, setErroEnvio] = useState("");
  const [avisoEnvio, setAvisoEnvio] = useState("");

  useEffect(() => {
    const controle = new AbortController();
    setDocumentos([]);
    setErro("");
    setEstado("carregando");
    fetch(`${API}/atendimentos/${atendimentoId}/pedidos-medicos`, {
      credentials: "include",
      cache: "no-store",
      signal: controle.signal,
    })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error(await erroDaApi(resposta));
        const dados: unknown = await resposta.json();
        if (!Array.isArray(dados)) throw new Error("Resposta inválida ao consultar pedidos médicos.");
        return dados as Documento[];
      })
      .then((dados) => {
        if (controle.signal.aborted) return;
        setDocumentos(dados);
        setEstado("pronto");
      })
      .catch((e: unknown) => {
        if (controle.signal.aborted) return;
        setErro(e instanceof Error ? e.message : "Erro na consulta dos pedidos médicos.");
        setEstado("erro");
      });
    return () => controle.abort();
  }, [atendimentoId, atualizacao]);

  async function anexarArquivos(arquivos: File[]) {
    if (arquivos.length === 0 || enviando) return;
    setEnviando(true);
    setErroEnvio("");
    setAvisoEnvio("");
    let sucesso = 0;
    const falhas: string[] = [];
    try {
      for (const arquivo of arquivos) {
        try {
          await enviarPedidoMedicoV13(atendimentoId, arquivo);
          sucesso++;
        } catch (e) {
          falhas.push(`${arquivo.name}: ${e instanceof Error ? e.message : "Falha ao anexar."}`);
        }
      }
      if (sucesso > 0) {
        setAvisoEnvio(`${sucesso} pedido(s) médico(s) anexado(s) com sucesso.`);
        setAtualizacao((atual) => atual + 1);
      }
      if (falhas.length > 0) setErroEnvio(falhas.join(" | "));
    } finally {
      setEnviando(false);
    }
  }
  async function abrirArquivo(documento: Documento, visualizar: boolean) {
    if (abrindoId !== null) return;
    setAbrindoId(documento.id);
    setErro("");

    // Abrir a aba diretamente no clique evita bloqueadores de pop-up após o await.
    const aba = visualizar ? window.open("about:blank", "_blank") : null;
    if (aba) {
      aba.opener = null;
      aba.document.title = "Abrindo pedido médico...";
    }
    try {
      const resposta = await fetch(
        `${API}/atendimentos/${documento.atendimentoId}/pedidos-medicos/${documento.id}/arquivo${visualizar ? "?visualizar=1" : ""}`,
        { credentials: "include", cache: "no-store" }
      );
      if (!resposta.ok) throw new Error(await erroDaApi(resposta));
      const arquivo = await resposta.blob();
      const url = URL.createObjectURL(arquivo);
      if (visualizar && aba) {
        aba.location.replace(url);
      } else {
        // Se o navegador bloquear a aba, oferece o download sem expor o arquivo publicamente.
        const link = document.createElement("a");
        link.href = url;
        link.download = documento.nomeOriginal || `pedido-medico-${documento.id}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        if (visualizar) setErro("O navegador bloqueou a prévia. O arquivo foi disponibilizado para download.");
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
    } catch (e) {
      if (aba && !aba.closed) aba.close();
      setErro(e instanceof Error ? e.message : "Não foi possível abrir o arquivo.");
    } finally {
      setAbrindoId(null);
    }
  }

  return (
    <section className="rounded-lg border border-xango-border bg-white p-4" aria-label="Pedidos médicos do atendimento">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xango-primary">
          <FileText size={16} aria-hidden="true" />
          <h4 className="text-xs font-semibold uppercase tracking-wide">Pedidos médicos</h4>
        </div>
        {estado === "pronto" && (
          <span className="text-xs text-xango-muted">{documentos.length} {documentos.length === 1 ? "arquivo" : "arquivos"}</span>
        )}
      </div>

      <label className={`mt-3 flex cursor-pointer items-center justify-center rounded-md border border-xango-primary px-3 py-2 text-sm font-semibold text-xango-primary ${enviando ? "cursor-wait opacity-50" : "hover:bg-xango-background"}`}>
        {enviando ? "Enviando pedido..." : "+ Anexar pedido médico"}
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          aria-label="Anexar pedido médico"
          className="sr-only"
          disabled={enviando}
          onChange={(evento) => {
            const arquivos = Array.from(evento.currentTarget.files ?? []);
            evento.currentTarget.value = "";
            void anexarArquivos(arquivos);
          }}
        />
      </label>
      {avisoEnvio && <p role="status" className="mt-2 text-xs text-emerald-800">{avisoEnvio}</p>}
      {erroEnvio && <p role="alert" className="mt-2 text-xs text-red-700">{erroEnvio}</p>}
      {estado === "carregando" && <p role="status" className="mt-3 text-xs text-xango-muted">Carregando pedidos médicos...</p>}
      {estado === "erro" && <p role="alert" className="mt-3 text-xs text-red-700">{erro}</p>}
      {estado === "pronto" && documentos.length === 0 && (
        <p className="mt-3 text-sm text-xango-muted">Nenhum pedido médico anexado.</p>
      )}
      {estado === "pronto" && documentos.length > 0 && (
        <div className="mt-3 space-y-3">
          {documentos.map((pedido) => (
            <div key={pedido.id} className="rounded-md border border-xango-border bg-xango-background/30 p-3">
              <p className="break-all text-sm font-semibold text-xango-text">{pedido.nomeOriginal}</p>
              <p className="mt-1 text-xs text-xango-muted">{tipoArquivo(pedido)} · Enviado em {dataEnvio(pedido.criadoEm)}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={abrindoId !== null}
                  onClick={() => void abrirArquivo(pedido, true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-xango-primary hover:underline disabled:opacity-40"
                ><Eye size={14} aria-hidden="true" /> Visualizar</button>
                <button
                  type="button"
                  disabled={abrindoId !== null}
                  onClick={() => void abrirArquivo(pedido, false)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-xango-primary hover:underline disabled:opacity-40"
                ><Download size={14} aria-hidden="true" /> Baixar</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {estado === "pronto" && erro && <p role="alert" className="mt-3 text-xs text-amber-700">{erro}</p>}
    </section>
  );
}
