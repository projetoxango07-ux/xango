"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, MapPin, Search, Stethoscope, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type OpcaoProcedimentoBusca = {
  clinicaId: number;
  clinicaNome: string;
  unidadeClinicaId: number | null;
  unidadeClinicaNome: string | null;
  localizacao: string | null;
  valorPaciente: number;
  uso: number;
};

type ResultadoBusca = {
  tipo:
    | "PACIENTE"
    | "GUIA"
    | "ORCAMENTO"
    | "CLINICA"
    | "ATENDIMENTO"
    | "PROCEDIMENTO";
  id: number;
  titulo: string;
  subtitulo: string;
  href: string;
  opcoes?: OpcaoProcedimentoBusca[];
};

type Notificacao = {
  id: string;
  titulo: string;
  descricao: string;
  href: string;
  prioridade: "ALTA" | "MEDIA" | "BAIXA";
  quantidade: number;
};

function perfilLabel(perfil: string) {
  if (perfil === "ADMINISTRADOR") return "Administrador";
  if (perfil === "DESENVOLVEDOR") return "Desenvolvedor";
  if (perfil === "GERENTE") return "Gerente";
  return "Atendente";
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return `${partes[0]?.[0] || "U"}${
    partes.length > 1 ? partes[partes.length - 1]?.[0] || "" : ""
  }`.toUpperCase();
}

function tipoLabel(tipo: ResultadoBusca["tipo"]) {
  if (tipo === "PACIENTE") return "Paciente";
  if (tipo === "GUIA") return "Guia / Voucher";
  if (tipo === "ORCAMENTO") return "Orçamento";
  if (tipo === "CLINICA") return "Clínica";
  if (tipo === "PROCEDIMENTO") return "Procedimento";
  return "Atendimento";
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function nomeOpcao(opcao: OpcaoProcedimentoBusca) {
  return opcao.unidadeClinicaNome
    ? `${opcao.clinicaNome} · ${opcao.unidadeClinicaNome}`
    : opcao.clinicaNome;
}

export function Header() {
  const router = useRouter();
  const { usuario, temPermissao, sair } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
  const [procedimentoAberto, setProcedimentoAberto] =
    useState<ResultadoBusca | null>(null);
  const [opcaoProcedimento, setOpcaoProcedimento] =
    useState<OpcaoProcedimentoBusca | null>(null);
  const inputBusca = useRef<HTMLInputElement | null>(null);

  const resumoOpcoesProcedimento = useMemo(() => {
    if (!procedimentoAberto?.opcoes?.length) return "";
    return procedimentoAberto.opcoes
      .slice(0, 3)
      .map((opcao) => `${nomeOpcao(opcao)} — ${moeda(opcao.valorPaciente)}`)
      .join("  |  ");
  }, [procedimentoAberto]);

  async function lerJsonSeguro(resposta: Response) {
    const tipo = resposta.headers.get("content-type") || "";
    if (!tipo.includes("application/json")) {
      const texto = await resposta.text();
      throw new Error(
        `A API respondeu em formato inesperado (${resposta.status}). ${texto.slice(0, 120)}`
      );
    }
    return resposta.json();
  }

  async function carregarNotificacoes() {
    try {
      const resposta = await fetch(`${API_URL}/notificacoes`, {
        cache: "no-store",
      });
      const dados = await lerJsonSeguro(resposta);
      if (!resposta.ok) {
        throw new Error(dados.erro || "Erro ao carregar notificações.");
      }
      setNotificacoes(
        Array.isArray(dados.notificacoes) ? dados.notificacoes : []
      );
    } catch (erro) {
      // Uma falha de notificações não deve derrubar o restante do sistema.
      console.error("Erro ao carregar notificações:", erro);
      setNotificacoes([]);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void carregarNotificacoes(), 0);
    const aoAtalho = (evento: KeyboardEvent) => {
      if (
        (evento.ctrlKey || evento.metaKey) &&
        evento.key.toLowerCase() === "k"
      ) {
        evento.preventDefault();
        inputBusca.current?.focus();
        setBuscaAberta(true);
      }
    };
    window.addEventListener("keydown", aoAtalho);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", aoAtalho);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) return;

    const timer = window.setTimeout(async () => {
      try {
        setBuscando(true);
        const resposta = await fetch(
          `${API_URL}/busca-global?q=${encodeURIComponent(termo)}`,
          { cache: "no-store" }
        );
        const dados = await lerJsonSeguro(resposta);
        if (!resposta.ok) throw new Error(dados.erro || "Erro na pesquisa.");
        setResultados(
          Array.isArray(dados.resultados) ? dados.resultados : []
        );
      } catch (erro) {
        console.error("Erro na pesquisa global:", erro);
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [busca]);

  function abrirResultado(resultado: ResultadoBusca) {
    setBuscaAberta(false);

    if (resultado.tipo === "PROCEDIMENTO") {
      setProcedimentoAberto(resultado);
      setOpcaoProcedimento(null);
      return;
    }

    setBusca("");
    setResultados([]);
    router.push(resultado.href);
  }

  function fecharProcedimento() {
    setProcedimentoAberto(null);
    setOpcaoProcedimento(null);
  }

  function abrirFluxoProcedimento(destino: "orcamento" | "atendimento") {
    if (!procedimentoAberto || !opcaoProcedimento) return;

    const parametros = new URLSearchParams({
      procedimentoId: String(procedimentoAberto.id),
      clinicaId: String(opcaoProcedimento.clinicaId),
    });

    if (opcaoProcedimento.unidadeClinicaId) {
      parametros.set(
        "unidadeClinicaId",
        String(opcaoProcedimento.unidadeClinicaId)
      );
    }

    setBusca("");
    setResultados([]);
    fecharProcedimento();

    router.push(
      destino === "orcamento"
        ? `/orcamentos/novo?${parametros.toString()}`
        : `/atendimentos/novo?${parametros.toString()}`
    );
  }

  function abrirNotificacao(notificacao: Notificacao) {
    setNotificacoesAbertas(false);
    router.push(notificacao.href);
  }

  return (
    <>
      <header className="relative z-40 flex h-20 items-center gap-6 border-b border-xango-border bg-white px-6">
        <div className="flex flex-1 justify-center">
          <div
            className="relative w-full max-w-2xl"
            data-aprendiz="pesquisa-global"
          >
            <Search
              size={17}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xango-muted"
            />
            <input
              ref={inputBusca}
              type="text"
              value={busca}
              onChange={(e) => {
                const valor = e.target.value;
                setBusca(valor);
                setBuscaAberta(true);
                if (valor.trim().length < 2) {
                  setResultados([]);
                  setBuscando(false);
                }
              }}
              onFocus={() => setBuscaAberta(true)}
              placeholder="Pesquisar paciente, procedimento, guia, orçamento, clínica, atendimento..."
              className="w-full rounded-md border border-xango-border bg-white py-3 pl-11 pr-20 text-sm text-xango-text outline-none transition placeholder:text-xango-muted focus:border-xango-primary focus:ring-2 focus:ring-xango-primary/10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-xango-border bg-xango-background px-2 py-1 text-xs text-xango-muted">
              Ctrl + K
            </span>

            {buscaAberta && busca.trim().length >= 2 && (
              <>
                <button
                  type="button"
                  aria-label="Fechar pesquisa"
                  onClick={() => setBuscaAberta(false)}
                  className="fixed inset-0 z-30 cursor-default"
                />
                <div className="absolute left-0 right-0 z-40 mt-2 max-h-115 overflow-auto rounded-xl border border-xango-border bg-white p-2 shadow-xl">
                  {buscando && (
                    <p className="px-3 py-5 text-center text-sm text-xango-muted">
                      Pesquisando...
                    </p>
                  )}
                  {!buscando && resultados.length === 0 && (
                    <p className="px-3 py-5 text-center text-sm text-xango-muted">
                      Nenhum resultado encontrado.
                    </p>
                  )}
                  {!buscando &&
                    resultados.map((resultado) => {
                      const opcoesRapidas = resultado.opcoes || [];
                      const resumoRapido = opcoesRapidas
                        .slice(0, 3)
                        .map(
                          (opcao) =>
                            `${nomeOpcao(opcao)} — ${moeda(opcao.valorPaciente)}`
                        )
                        .join("  |  ");
                      const excedentes = Math.max(opcoesRapidas.length - 3, 0);

                      return (
                        <button
                          key={`${resultado.tipo}-${resultado.id}`}
                          type="button"
                          onClick={() => abrirResultado(resultado)}
                          className="flex w-full items-start justify-between gap-4 rounded-lg px-3 py-3 text-left transition hover:bg-xango-background"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-xango-text">
                              {resultado.titulo}
                            </p>

                            {resultado.tipo === "PROCEDIMENTO" &&
                            resumoRapido ? (
                              <p className="mt-1 truncate text-xs text-xango-muted">
                                {resumoRapido}
                                {excedentes > 0
                                  ? `  |  +${excedentes} ${
                                      excedentes === 1 ? "opção" : "opções"
                                    }`
                                  : ""}
                              </p>
                            ) : (
                              <p className="mt-1 truncate text-xs text-xango-muted">
                                {resultado.subtitulo ||
                                  (resultado.tipo === "PROCEDIMENTO"
                                    ? "Sem preço ativo no momento"
                                    : "")}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 rounded-full bg-xango-background px-2 py-1 text-[10px] font-semibold text-xango-primary">
                            {tipoLabel(resultado.tipo)}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {temPermissao("atendimentos.criar") && (
            <Link
              href="/atendimentos/novo"
              data-aprendiz="novo-atendimento"
              className="rounded-md bg-xango-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-xango-primary-hover"
            >
              + Novo Atendimento
            </Link>
          )}

          <div className="relative" data-aprendiz="notificacoes">
            <button
              type="button"
              onClick={() => {
                setNotificacoesAbertas((v) => !v);
                setMenuAberto(false);
                if (!notificacoesAbertas) void carregarNotificacoes();
              }}
              className="relative rounded-md border border-xango-border bg-white p-3 text-xango-text transition hover:bg-xango-background"
              title="Notificações"
            >
              <Bell size={18} />
              {notificacoes.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-digna-green px-1 text-[10px] font-bold text-xango-sidebar">
                  {notificacoes.length > 99 ? "99+" : notificacoes.length}
                </span>
              )}
            </button>

            {notificacoesAbertas && (
              <>
                <button
                  aria-label="Fechar notificações"
                  type="button"
                  onClick={() => setNotificacoesAbertas(false)}
                  className="fixed inset-0 z-30 cursor-default"
                />
                <div className="absolute right-0 z-40 mt-2 w-96 max-w-[90vw] overflow-hidden rounded-xl border border-xango-border bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-xango-border px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-xango-text">
                        Notificações
                      </p>
                      <p className="text-[11px] text-xango-muted">
                        Pendências que exigem atenção.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void carregarNotificacoes()}
                      className="text-xs font-semibold text-xango-primary hover:underline"
                    >
                      Atualizar
                    </button>
                  </div>
                  <div className="max-h-105 overflow-auto p-2">
                    {notificacoes.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-xango-muted">
                        Nenhuma pendência importante no momento.
                      </p>
                    ) : (
                      notificacoes.map((notificacao) => (
                        <button
                          key={notificacao.id}
                          type="button"
                          onClick={() => abrirNotificacao(notificacao)}
                          className="w-full rounded-lg px-3 py-3 text-left transition hover:bg-xango-background"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-xango-text">
                                {notificacao.titulo}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-xango-muted">
                                {notificacao.descricao}
                              </p>
                            </div>
                            <span
                              className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                                notificacao.prioridade === "ALTA"
                                  ? "bg-red-500"
                                  : notificacao.prioridade === "MEDIA"
                                    ? "bg-amber-500"
                                    : "bg-slate-400"
                              }`}
                            />
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuAberto((v) => !v)}
              className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-xango-background"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-xango-primary font-semibold text-white">
                {iniciais(usuario.nome)}
              </div>
              <div className="hidden text-left lg:block">
                <p className="text-sm font-semibold text-xango-text">
                  {usuario.nome}
                </p>
                <p className="text-xs text-xango-muted">
                  {perfilLabel(usuario.perfil)}
                </p>
              </div>
              <span className="text-xango-muted">⌄</span>
            </button>

            {menuAberto && (
              <>
                <button
                  aria-label="Fechar menu"
                  type="button"
                  onClick={() => setMenuAberto(false)}
                  className="fixed inset-0 z-30 cursor-default"
                />
                <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-lg border border-xango-border bg-white shadow-xl">
                  <div className="border-b border-xango-border px-4 py-3">
                    <p className="text-sm font-semibold text-xango-text">
                      {usuario.nome}
                    </p>
                    <p className="mt-0.5 text-xs text-xango-muted">
                      {usuario.email}
                    </p>
                    <p className="mt-1 text-xs text-xango-muted">
                      {usuario.organizacao.nomeFantasia}
                    </p>
                  </div>
                  <Link
                    href="/ajuda"
                    onClick={() => setMenuAberto(false)}
                    className="block px-4 py-3 text-sm text-xango-text hover:bg-xango-background"
                  >
                    Central de Ajuda
                  </Link>
                  <Link
                    href="/trocar-senha"
                    onClick={() => setMenuAberto(false)}
                    className="block px-4 py-3 text-sm text-xango-text hover:bg-xango-background"
                  >
                    Alterar senha
                  </Link>
                  {temPermissao("usuarios.visualizar") && (
                    <Link
                      href="/configuracoes/usuarios"
                      onClick={() => setMenuAberto(false)}
                      className="block px-4 py-3 text-sm text-xango-text hover:bg-xango-background"
                    >
                      Usuários e permissões
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void sair()}
                    className="w-full border-t border-xango-border px-4 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {procedimentoAberto && (
        <>
          <button
            type="button"
            aria-label="Fechar detalhes do procedimento"
            onClick={fecharProcedimento}
            className="fixed inset-0 z-50 bg-black/25"
          />

          <aside className="fixed right-0 top-0 z-60 flex h-screen w-full max-w-lg flex-col border-l border-xango-border bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-xango-border px-6 py-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xango-primary">
                  <Stethoscope size={18} />
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    Consulta rápida de preço
                  </p>
                </div>
                <h2 className="mt-2 text-xl font-bold text-xango-text">
                  {procedimentoAberto.titulo}
                </h2>
                {procedimentoAberto.subtitulo && (
                  <p className="mt-1 text-sm text-xango-muted">
                    {procedimentoAberto.subtitulo}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={fecharProcedimento}
                className="rounded-md border border-xango-border p-2 text-xango-muted transition hover:bg-xango-background hover:text-xango-text"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-sm font-semibold text-xango-text">
                Selecione a clínica / unidade
              </p>
              <p className="mt-1 text-xs leading-5 text-xango-muted">
                As opções mais utilizadas aparecem primeiro. O valor exibido é o
                valor atual para o paciente.
              </p>

              <div className="mt-4 space-y-2">
                {(procedimentoAberto.opcoes || []).map((opcao) => {
                  const selecionada =
                    opcaoProcedimento?.clinicaId === opcao.clinicaId &&
                    opcaoProcedimento?.unidadeClinicaId ===
                      opcao.unidadeClinicaId;

                  return (
                    <button
                      key={`${opcao.clinicaId}-${opcao.unidadeClinicaId || 0}`}
                      type="button"
                      onClick={() => setOpcaoProcedimento(opcao)}
                      className={`w-full rounded-lg border p-4 text-left transition ${
                        selecionada
                          ? "border-xango-primary bg-xango-background ring-1 ring-xango-primary/15"
                          : "border-xango-border bg-white hover:border-xango-primary/40 hover:bg-xango-background/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-xango-text">
                            {opcao.clinicaNome}
                          </p>
                          {opcao.unidadeClinicaNome && (
                            <p className="mt-1 text-xs font-medium text-xango-primary">
                              {opcao.unidadeClinicaNome}
                            </p>
                          )}
                          {opcao.localizacao && (
                            <p className="mt-2 flex items-center gap-1 text-xs text-xango-muted">
                              <MapPin size={13} className="shrink-0" />
                              <span className="truncate">{opcao.localizacao}</span>
                            </p>
                          )}
                        </div>
                        <p className="shrink-0 text-base font-bold text-xango-primary">
                          {moeda(opcao.valorPaciente)}
                        </p>
                      </div>
                    </button>
                  );
                })}

                {(procedimentoAberto.opcoes || []).length === 0 && (
                  <div className="rounded-lg border border-xango-border bg-xango-background p-5 text-sm text-xango-muted">
                    Este procedimento está cadastrado, mas não possui clínica com
                    preço ativo no momento.
                  </div>
                )}
              </div>

              {resumoOpcoesProcedimento && (
                <p className="mt-5 text-[11px] leading-5 text-xango-muted">
                  Informação rápida: {resumoOpcoesProcedimento}
                </p>
              )}
            </div>

            <div className="border-t border-xango-border bg-white px-6 py-5">
              {!opcaoProcedimento &&
                (procedimentoAberto.opcoes || []).length > 0 && (
                  <p className="mb-3 text-xs text-xango-muted">
                    Selecione uma clínica / unidade para liberar as ações.
                  </p>
                )}

              <div className="grid gap-3 sm:grid-cols-2">
                {temPermissao("orcamentos.criar") && (
                  <button
                    type="button"
                    disabled={!opcaoProcedimento}
                    onClick={() => abrirFluxoProcedimento("orcamento")}
                    className="rounded-md border border-xango-primary px-4 py-3 text-sm font-semibold text-xango-primary transition enabled:hover:bg-xango-background disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Novo orçamento
                  </button>
                )}

                {temPermissao("atendimentos.criar") && (
                  <button
                    type="button"
                    disabled={!opcaoProcedimento}
                    onClick={() => abrirFluxoProcedimento("atendimento")}
                    className="rounded-md bg-xango-primary px-4 py-3 text-sm font-semibold text-white transition enabled:hover:bg-xango-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Novo atendimento
                  </button>
                )}
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
