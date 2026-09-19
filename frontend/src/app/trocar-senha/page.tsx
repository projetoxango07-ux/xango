"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

function TrocarSenhaContent() {
  const router = useRouter();
  const params = useSearchParams();
  const primeiro = params.get("primeiro") === "1";
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [validando, setValidando] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/auth/me`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => {
        if (r.status === 401) router.replace("/login");
      })
      .finally(() => setValidando(false));
  }, [router]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");

    if (novaSenha !== confirmacao) {
      setErro("As novas senhas não conferem.");
      return;
    }

    try {
      setSalvando(true);

      const r = await fetch(`${API_URL}/auth/trocar-senha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });

      const d = await r.json();

      if (!r.ok) {
        throw new Error(d.erro || "Não foi possível alterar a senha.");
      }

      router.replace("/");
      router.refresh();
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível alterar a senha."
      );
    } finally {
      setSalvando(false);
    }
  }

  if (validando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-xango-background text-xango-muted">
        Validando sessão...
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-xango-background p-6">
      <form
        onSubmit={salvar}
        className="w-full max-w-md rounded-xl border border-xango-border bg-white p-7 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-xango-text">
          {primeiro ? "Defina sua nova senha" : "Alterar senha"}
        </h1>

        <p className="mt-2 text-sm text-xango-muted">
          {primeiro
            ? "Por segurança, troque a senha temporária antes de usar o sistema."
            : "Informe sua senha atual e escolha uma nova senha."}
        </p>

        {erro && (
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        <label className="mt-6 block text-sm font-semibold">
          Senha atual
          <input
            type="password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            className="mt-2 w-full rounded-md border border-xango-border px-3 py-3"
            required
          />
        </label>

        <label className="mt-4 block text-sm font-semibold">
          Nova senha
          <input
            type="password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            className="mt-2 w-full rounded-md border border-xango-border px-3 py-3"
            required
          />
        </label>

        <label className="mt-4 block text-sm font-semibold">
          Confirmar nova senha
          <input
            type="password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            className="mt-2 w-full rounded-md border border-xango-border px-3 py-3"
            required
          />
        </label>

        <p className="mt-3 text-xs text-xango-muted">
          Mínimo de 8 caracteres, com letras e números.
        </p>

        <div className="mt-6 flex gap-3">
          {!primeiro && (
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-md border border-xango-border px-4 py-3 font-semibold"
            >
              Cancelar
            </button>
          )}

          <button
            disabled={salvando}
            className="flex-1 rounded-md bg-xango-primary px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Alterar senha"}
          </button>
        </div>
      </form>
    </main>
  );
}

function TrocarSenhaLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-xango-background text-xango-muted">
      Carregando...
    </main>
  );
}

export default function TrocarSenhaPage() {
  return (
    <Suspense fallback={<TrocarSenhaLoading />}>
      <TrocarSenhaContent />
    </Suspense>
  );
}
