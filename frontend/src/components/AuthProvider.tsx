"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type Perfil = "ATENDENTE" | "GERENTE" | "ADMINISTRADOR" | "DESENVOLVEDOR";

export type UsuarioLogado = {
  id: number;
  codigoPublico: string | null;
  nome: string;
  email: string | null;
  perfil: Perfil;
  ativo: boolean;
  trocarSenhaNoProximoLogin: boolean;
  usarPermissoesPersonalizadas: boolean;
  permissoes: string[];
  permissoesEfetivas: string[];
  tourGuiadoAtivo: boolean;
  modoAprendizAtivo: boolean;
  organizacaoId: number;
  organizacao: { id: number; nomeFantasia: string };
};

type AuthContextValue = {
  usuario: UsuarioLogado;
  temPermissao: (permissao: string) => boolean;
  recarregarUsuario: () => Promise<void>;
  sair: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function instalarFetchAutenticado() {
  const w = window as typeof window & {
    __dignaOriginalFetch?: typeof window.fetch;
    __dignaFetchInstalado?: boolean;
  };

  if (!w.__dignaOriginalFetch) w.__dignaOriginalFetch = window.fetch.bind(window);
  if (w.__dignaFetchInstalado) return w.__dignaOriginalFetch;

  const original = w.__dignaOriginalFetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const ehApi = url.startsWith(API_URL);
    const resposta = await original(input, ehApi ? { ...init, credentials: "include" } : init);

    if (ehApi && resposta.status === 401 && !url.includes("/auth/")) {
      window.location.assign("/login?expirada=1");
    }

    return resposta;
  };

  w.__dignaFetchInstalado = true;
  return original;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregarUsuario() {
    setErro("");
    const original = instalarFetchAutenticado();
    const resposta = await original(`${API_URL}/auth/me`, { credentials: "include", cache: "no-store" });
    if (resposta.status === 401) {
      router.replace("/login");
      return;
    }
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || "Não foi possível validar sua sessão.");
    const atual: UsuarioLogado = dados.usuario;
    if (atual.trocarSenhaNoProximoLogin) {
      router.replace("/trocar-senha?primeiro=1");
      return;
    }
    setUsuario(atual);
  }

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        await carregarUsuario();
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar o usuário.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valor = useMemo<AuthContextValue | null>(() => {
    if (!usuario) return null;
    return {
      usuario,
      temPermissao: (permissao) => usuario.permissoesEfetivas.includes(permissao),
      recarregarUsuario: carregarUsuario,
      sair: async () => {
        await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined);
        window.location.assign("/login");
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  if (carregando || !valor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-xango-background p-6 text-sm text-xango-muted">
        {erro || "Validando acesso ao sistema..."}
      </div>
    );
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return contexto;
}
