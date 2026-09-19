"use client";

import Link from "next/link";
import {
  Building2,
  ChevronRight,
  KeyRound,
  Receipt,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function ConfiguracoesPage() {
  const { temPermissao } = useAuth();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-xango-text">
          Configurações
        </h2>
        <p className="mt-1 text-sm text-xango-muted">
          Dados da organização, parâmetros operacionais e controle de acesso.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {temPermissao("configuracoes.visualizar") && (
          <Link
            href="/configuracoes/gerais"
            className="group rounded-xl border border-xango-border bg-white p-5 transition hover:border-xango-primary hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-xango-background p-3 text-xango-primary">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-xango-text">
                    Organização e parâmetros
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-xango-muted">
                    Dados da Digna, validade padrão de orçamentos e vouchers e
                    condições comerciais.
                  </p>
                </div>
              </div>
              <ChevronRight
                size={18}
                className="mt-1 shrink-0 text-xango-muted transition group-hover:text-xango-primary"
              />
            </div>
          </Link>
        )}

        {temPermissao("configuracoes.visualizar") && (
          <Link
            href="/configuracoes/assinatura"
            className="group rounded-xl border border-xango-border bg-white p-5 transition hover:border-xango-primary hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-xango-background p-3 text-xango-primary">
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-xango-text">
                    Plano e faturamento do sistema
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-xango-muted">
                    Consulte plano, mensalidade, vencimento, situação da
                    assinatura e faturas do Digna Conect.
                  </p>
                </div>
              </div>
              <ChevronRight
                size={18}
                className="mt-1 shrink-0 text-xango-muted transition group-hover:text-xango-primary"
              />
            </div>
          </Link>
        )}

        {temPermissao("usuarios.visualizar") && (
          <Link
            href="/configuracoes/usuarios"
            className="group rounded-xl border border-xango-border bg-white p-5 transition hover:border-xango-primary hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-xango-background p-3 text-xango-primary">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-xango-text">
                    Usuários e permissões
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-xango-muted">
                    Acessos, perfis, senhas, bloqueios e permissões por módulo.
                  </p>
                </div>
              </div>
              <ChevronRight
                size={18}
                className="mt-1 shrink-0 text-xango-muted transition group-hover:text-xango-primary"
              />
            </div>
          </Link>
        )}

        <Link
          href="/trocar-senha"
          className="group rounded-xl border border-xango-border bg-white p-5 transition hover:border-xango-primary hover:shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-xango-background p-3 text-xango-primary">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-xango-text">Minha senha</h3>
                <p className="mt-1 text-sm leading-5 text-xango-muted">
                  Altere a senha do usuário que está conectado ao sistema.
                </p>
              </div>
            </div>
            <ChevronRight
              size={18}
              className="mt-1 shrink-0 text-xango-muted transition group-hover:text-xango-primary"
            />
          </div>
        </Link>

        {temPermissao("configuracoes.visualizar") && (
          <Link
            href="/configuracoes/operacionais"
            className="group rounded-xl border border-xango-border bg-white p-5 transition hover:border-xango-primary hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-xango-background p-3 text-xango-primary">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-xango-text">
                    Parâmetros operacionais e financeiros
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-xango-muted">
                    Formas de pagamento, numeração de recibos e estornos e
                    textos padrão dos documentos financeiros.
                  </p>
                </div>
              </div>
              <ChevronRight
                size={18}
                className="mt-1 shrink-0 text-xango-muted transition group-hover:text-xango-primary"
              />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
