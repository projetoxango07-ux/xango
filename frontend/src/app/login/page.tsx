"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { dignaBrandStyle } from "@/lib/dignaBrand";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [inicial, setInicial] = useState<boolean | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [lembrar, setLembrar] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/auth/status`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.erro);
        setInicial(Boolean(d.configuracaoInicialNecessaria));
      })
      .catch(() =>
        setErro("Não foi possível conectar ao servidor do sistema.")
      );
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro("");

    if (inicial && senha !== confirmacao) {
      setErro("As senhas não conferem.");
      return;
    }

    try {
      setEnviando(true);

      const resposta = await fetch(
        `${API_URL}${inicial ? "/auth/configurar-inicial" : "/auth/login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(
            inicial ? { nome, email, senha } : { email, senha, lembrar }
          ),
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.erro || "Não foi possível entrar.");
      }

      if (!inicial && dados.usuario?.trocarSenhaNoProximoLogin) {
        router.replace("/trocar-senha?primeiro=1");
      } else {
        router.replace("/");
      }

      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main
      style={dignaBrandStyle}
      className="flex min-h-screen items-center justify-center bg-xango-sidebar p-6"
    >
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <p className="text-3xl font-black tracking-wide text-white">
            Digna Saúde
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
            Tecnologia Digna Conect
          </p>
        </div>

        <form
          onSubmit={enviar}
          className="rounded-2xl bg-white p-8 shadow-2xl"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-xango-primary">
            Acesso seguro
          </p>

          <h1 className="mt-2 text-2xl font-bold text-xango-text">
            {inicial ? "Configuração inicial" : "Entrar no sistema"}
          </h1>

          <p className="mt-2 text-sm text-xango-muted">
            {inicial
              ? "Crie o primeiro acesso de administrador."
              : "Use seu e-mail e senha para continuar."}
          </p>

          {params.get("expirada") && !inicial && (
            <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Sua sessão expirou. Entre novamente.
            </div>
          )}

          {erro && (
            <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {erro}
            </div>
          )}

          {inicial && (
            <label className="mt-6 block text-sm font-semibold text-xango-text">
              Nome
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
                className="mt-2 w-full rounded-md border border-xango-border px-3 py-3 outline-none focus:border-xango-primary"
                required
              />
            </label>
          )}

          <label
            className={`${
              inicial ? "mt-4" : "mt-6"
            } block text-sm font-semibold text-xango-text`}
          >
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="mt-2 w-full rounded-md border border-xango-border px-3 py-3 outline-none focus:border-xango-primary"
              required
            />
          </label>

          <label className="mt-4 block text-sm font-semibold text-xango-text">
            Senha
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete={inicial ? "new-password" : "current-password"}
              className="mt-2 w-full rounded-md border border-xango-border px-3 py-3 outline-none focus:border-xango-primary"
              required
            />
          </label>

          {inicial && (
            <label className="mt-4 block text-sm font-semibold text-xango-text">
              Confirmar senha
              <input
                type="password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                autoComplete="new-password"
                className="mt-2 w-full rounded-md border border-xango-border px-3 py-3 outline-none focus:border-xango-primary"
                required
              />
            </label>
          )}

          {!inicial && (
            <label className="mt-4 flex items-center gap-2 text-sm text-xango-muted">
              <input
                type="checkbox"
                checked={lembrar}
                onChange={(e) => setLembrar(e.target.checked)}
              />
              Manter conectado por 7 dias
            </label>
          )}

          <button
            type="submit"
            disabled={enviando || inicial === null}
            className="mt-6 w-full rounded-md bg-xango-primary px-4 py-3 font-semibold text-white transition hover:bg-xango-primary-hover disabled:opacity-50"
          >
            {enviando
              ? "Aguarde..."
              : inicial
                ? "Criar acesso e entrar"
                : "Entrar"}
          </button>

          {inicial && (
            <p className="mt-4 text-xs leading-5 text-xango-muted">
              A senha deve ter pelo menos 8 caracteres e conter letras e números.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}

function LoginLoading() {
  return (
    <main
      style={dignaBrandStyle}
      className="flex min-h-screen items-center justify-center bg-xango-sidebar p-6"
    >
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <p className="text-3xl font-black tracking-wide text-white">
            Digna Saúde
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
            Tecnologia Digna Conect
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 text-center shadow-2xl">
          <p className="text-sm text-xango-muted">Carregando acesso...</p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}
