"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  GraduationCap,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type Perfil = "ATENDENTE" | "GERENTE" | "ADMINISTRADOR" | "DESENVOLVEDOR";

type Usuario = {
  id: number;
  codigoPublico: string | null;
  nome: string;
  email: string | null;
  perfil: Perfil;
  ativo: boolean;
  ultimoLoginEm: string | null;
  trocarSenhaNoProximoLogin: boolean;
  usarPermissoesPersonalizadas: boolean;
  permissoes: string[];
  permissoesEfetivas: string[];
  tourGuiadoAtivo: boolean;
  modoAprendizAtivo: boolean;
};

type Grupo = {
  modulo: string;
  permissoes: string[];
};

type FormUsuario = {
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  senhaTemporaria: string;
  usarPermissoesPersonalizadas: boolean;
  permissoes: string[];
  tourGuiadoAtivo: boolean;
  modoAprendizAtivo: boolean;
};

const labels: Record<string, string> = {
  "dashboard.visualizar": "Visualizar dashboard",
  "atendimentos.visualizar": "Visualizar",
  "atendimentos.criar": "Criar",
  "atendimentos.editar": "Editar",
  "orcamentos.visualizar": "Visualizar",
  "orcamentos.criar": "Criar",
  "orcamentos.editar": "Editar",
  "orcamentos.converter": "Converter",
  "guias.visualizar": "Visualizar",
  "guias.editar": "Editar",
  "guias.confirmar": "Confirmar atendimento",
  "agenda.visualizar": "Visualizar",
  "pacientes.visualizar": "Visualizar",
  "pacientes.editar": "Editar",
  "clinicas.visualizar": "Visualizar",
  "clinicas.editar": "Editar",
  "procedimentos.visualizar": "Visualizar",
  "procedimentos.editar": "Editar",
  "financeiro.visualizar": "Visualizar",
  "financeiro.editar": "Editar",
  "relatorios.visualizar": "Visualizar",
  "configuracoes.visualizar": "Visualizar",
  "configuracoes.editar": "Editar",
  "usuarios.visualizar": "Visualizar",
  "usuarios.editar": "Editar",
};

function perfilLabel(perfil: Perfil) {
  if (perfil === "ATENDENTE") return "Atendente";
  if (perfil === "GERENTE") return "Gerente";
  if (perfil === "ADMINISTRADOR") return "Administrador";
  return "Desenvolvedor";
}

function formInicial(permissoes: string[] = []): FormUsuario {
  return {
    nome: "",
    email: "",
    perfil: "ATENDENTE",
    ativo: true,
    senhaTemporaria: "",
    usarPermissoesPersonalizadas: false,
    permissoes,
    tourGuiadoAtivo: false,
    modoAprendizAtivo: false,
  };
}

export default function UsuariosPage() {
  const { usuario: logado, temPermissao, recarregarUsuario } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [padrao, setPadrao] = useState<Record<Perfil, string[]>>(
    {} as Record<Perfil, string[]>
  );
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<FormUsuario>(formInicial());

  const podeEditar = temPermissao("usuarios.editar");

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");
      const resposta = await fetch(`${API_URL}/usuarios`, { cache: "no-store" });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Erro ao carregar usuários.");
      }
      setUsuarios(dados.usuarios || []);
      setGrupos(dados.gruposPermissoes || []);
      setPadrao(dados.permissoesPadraoPorPerfil || {});
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar usuários.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  function novo() {
    setEditando(null);
    setForm(formInicial([...(padrao.ATENDENTE || [])]));
    setModal(true);
  }

  function editar(usuario: Usuario) {
    setEditando(usuario);
    setForm({
      nome: usuario.nome,
      email: usuario.email || "",
      perfil: usuario.perfil,
      ativo: usuario.ativo,
      senhaTemporaria: "",
      usarPermissoesPersonalizadas: usuario.usarPermissoesPersonalizadas,
      permissoes: usuario.usarPermissoesPersonalizadas
        ? usuario.permissoes
        : [...(padrao[usuario.perfil] || [])],
      tourGuiadoAtivo: usuario.tourGuiadoAtivo,
      modoAprendizAtivo: usuario.modoAprendizAtivo,
    });
    setModal(true);
  }

  function alterarPerfil(perfil: Perfil) {
    setForm((atual) => ({
      ...atual,
      perfil,
      permissoes: atual.usarPermissoesPersonalizadas
        ? atual.permissoes
        : [...(padrao[perfil] || [])],
    }));
  }

  function alternarPermissao(permissao: string) {
    setForm((atual) => ({
      ...atual,
      permissoes: atual.permissoes.includes(permissao)
        ? atual.permissoes.filter((item) => item !== permissao)
        : [...atual.permissoes, permissao],
    }));
  }

  async function salvar() {
    try {
      setSalvando(true);
      setErro("");
      const url = editando
        ? `${API_URL}/usuarios/${editando.id}`
        : `${API_URL}/usuarios`;
      const resposta = await fetch(url, {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Não foi possível salvar.");
      }
      setModal(false);
      await carregar();
      if (editando?.id === logado.id) {
        await recarregarUsuario();
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function redefinir(usuario: Usuario) {
    const nova = window.prompt(`Nova senha temporária para ${usuario.nome}:`);
    if (!nova) return;

    const resposta = await fetch(`${API_URL}/usuarios/${usuario.id}/redefinir-senha`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ novaSenha: nova }),
    });
    const dados = await resposta.json();
    if (!resposta.ok) {
      setErro(dados.erro || "Não foi possível redefinir a senha.");
      return;
    }

    window.alert("Senha redefinida. O usuário deverá trocá-la no próximo login.");
    await carregar();
  }

  const totalAtivos = useMemo(
    () => usuarios.filter((usuario) => usuario.ativo).length,
    [usuarios]
  );

  if (carregando) {
    return (
      <div className="py-16 text-center text-xango-muted">Carregando usuários...</div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href="/configuracoes"
            aria-label="Voltar para configurações"
            className="mt-0.5 rounded-md border border-xango-border bg-white p-2 text-xango-primary transition hover:bg-xango-background"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="text-2xl font-semibold">Usuários e permissões</h2>
            <p className="mt-1 text-sm text-xango-muted">
              {totalAtivos} usuário(s) ativo(s) em {logado.organizacao.nomeFantasia}.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void carregar()}
            className="flex items-center gap-2 rounded-md border border-xango-border bg-white px-3 py-2 text-sm"
          >
            <RefreshCw size={15} />
            Atualizar
          </button>

          {podeEditar && (
            <button
              type="button"
              onClick={novo}
              className="flex items-center gap-2 rounded-md bg-xango-primary px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus size={16} />
              Novo usuário
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-xango-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-xango-muted">
            <tr>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Treinamento</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Último login</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-xango-border">
            {usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-xango-background p-2 text-xango-primary">
                      <UserRound size={17} />
                    </div>
                    <div>
                      <p className="font-semibold">
                        {usuario.nome}
                        {usuario.id === logado.id ? " (você)" : ""}
                      </p>
                      <p className="text-xs text-xango-muted">
                        {usuario.email} {usuario.codigoPublico ? `• ${usuario.codigoPublico}` : ""}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-4">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                    {perfilLabel(usuario.perfil)}
                  </span>
                  {usuario.usarPermissoesPersonalizadas && (
                    <p className="mt-1 text-[11px] text-xango-accent">
                      Permissões personalizadas
                    </p>
                  )}
                </td>

                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {usuario.tourGuiadoAtivo && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-800">
                        <GraduationCap size={12} />
                        Tour automático
                      </span>
                    )}
                    {usuario.modoAprendizAtivo && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-lime-100 px-2.5 py-1 text-[11px] font-semibold text-lime-800">
                        <Sparkles size={12} />
                        Modo Aprendiz
                      </span>
                    )}
                    {!usuario.tourGuiadoAtivo && !usuario.modoAprendizAtivo && (
                      <span className="text-xs text-xango-muted">Desativado</span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      usuario.ativo
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {usuario.ativo ? "Ativo" : "Inativo"}
                  </span>
                  {usuario.trocarSenhaNoProximoLogin && (
                    <p className="mt-1 text-[11px] text-amber-700">
                      Troca de senha pendente
                    </p>
                  )}
                </td>

                <td className="px-4 py-4 text-xango-muted">
                  {usuario.ultimoLoginEm
                    ? new Date(usuario.ultimoLoginEm).toLocaleString("pt-BR")
                    : "Nunca"}
                </td>

                <td className="px-4 py-4 text-right">
                  {podeEditar && (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => editar(usuario)}
                        className="rounded-md border border-xango-border px-3 py-2 text-xs font-semibold"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void redefinir(usuario)}
                        className="rounded-md border border-xango-border px-3 py-2 text-xs font-semibold"
                      >
                        Redefinir senha
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setModal(false)}
            className="fixed inset-0 z-40 bg-black/30"
          />

          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-xango-border pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-xango-muted">
                  Acesso ao sistema
                </p>
                <h3 className="mt-1 text-xl font-semibold">
                  {editando ? "Editar usuário" : "Novo usuário"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModal(false)}
                className="rounded-md border border-xango-border p-2"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Nome
                <input
                  value={form.nome}
                  onChange={(event) =>
                    setForm((atual) => ({ ...atual, nome: event.target.value }))
                  }
                  className="mt-2 w-full rounded-md border border-xango-border px-3 py-2.5"
                />
              </label>

              <label className="text-sm font-semibold">
                E-mail
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((atual) => ({ ...atual, email: event.target.value }))
                  }
                  className="mt-2 w-full rounded-md border border-xango-border px-3 py-2.5"
                />
              </label>

              <label className="text-sm font-semibold">
                Perfil
                <select
                  value={form.perfil}
                  onChange={(event) => alterarPerfil(event.target.value as Perfil)}
                  className="mt-2 w-full rounded-md border border-xango-border px-3 py-2.5"
                >
                  <option value="ATENDENTE">Atendente</option>
                  <option value="GERENTE">Gerente</option>
                  <option value="ADMINISTRADOR">Administrador</option>
                  <option value="DESENVOLVEDOR">Desenvolvedor</option>
                </select>
              </label>

              {!editando && (
                <label className="text-sm font-semibold">
                  Senha temporária
                  <input
                    type="password"
                    value={form.senhaTemporaria}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        senhaTemporaria: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-md border border-xango-border px-3 py-2.5"
                  />
                  <span className="mt-1 block text-xs font-normal text-xango-muted">
                    Será obrigatória a troca no primeiro login.
                  </span>
                </label>
              )}
            </div>

            {editando && (
              <label className="mt-5 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(event) =>
                    setForm((atual) => ({ ...atual, ativo: event.target.checked }))
                  }
                />
                Usuário ativo
              </label>
            )}

            <div className="mt-6 rounded-lg border border-xango-border p-4">
              <div className="flex items-start gap-3">
                <GraduationCap className="mt-0.5 text-xango-primary" size={20} />
                <div className="flex-1">
                  <p className="font-semibold">Treinamento do usuário</p>
                  <p className="mt-1 text-xs leading-5 text-xango-muted">
                    Os dois recursos são independentes. O Tour apresenta cada tela na
                    primeira visita do dia; o Modo Aprendiz permanece ligado para o
                    acompanhamento contextual do funcionário.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label
                  className={`cursor-pointer rounded-lg border p-4 transition ${
                    form.tourGuiadoAtivo
                      ? "border-xango-primary bg-violet-50"
                      : "border-xango-border bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.tourGuiadoAtivo}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          tourGuiadoAtivo: event.target.checked,
                        }))
                      }
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold">Tour Guiado automático</p>
                      <p className="mt-1 text-xs leading-5 text-xango-muted">
                        Abre automaticamente uma vez por dia em cada tipo de tela visitada.
                      </p>
                    </div>
                  </div>
                </label>

                <label
                  className={`cursor-pointer rounded-lg border p-4 transition ${
                    form.modoAprendizAtivo
                      ? "border-digna-green bg-lime-50"
                      : "border-xango-border bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.modoAprendizAtivo}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          modoAprendizAtivo: event.target.checked,
                        }))
                      }
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold">Modo Aprendiz</p>
                      <p className="mt-1 text-xs leading-5 text-xango-muted">
                        Mantém o funcionário em treinamento contínuo entre os logins.
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-xango-border p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 text-xango-primary" size={20} />
                <div className="flex-1">
                  <p className="font-semibold">Permissões</p>
                  <p className="mt-1 text-xs text-xango-muted">
                    Por padrão, o perfil define as permissões. Ative a personalização
                    apenas quando precisar de uma exceção.
                  </p>
                  <label className="mt-3 flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={form.usarPermissoesPersonalizadas}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          usarPermissoesPersonalizadas: event.target.checked,
                          permissoes: [...(padrao[atual.perfil] || [])],
                        }))
                      }
                    />
                    Usar permissões personalizadas
                  </label>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {grupos.map((grupo) => (
                  <div key={grupo.modulo}>
                    <p className="text-xs font-bold uppercase tracking-wide text-xango-muted">
                      {grupo.modulo}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {grupo.permissoes.map((permissao) => (
                        <label
                          key={permissao}
                          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                            form.permissoes.includes(permissao)
                              ? "border-xango-primary bg-xango-background"
                              : "border-xango-border"
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={!form.usarPermissoesPersonalizadas}
                            checked={form.permissoes.includes(permissao)}
                            onChange={() => alternarPermissao(permissao)}
                          />
                          {labels[permissao] || permissao}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-xango-border pt-5">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="rounded-md border border-xango-border px-4 py-2.5 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => void salvar()}
                className="rounded-md bg-xango-primary px-5 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar usuário"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
