"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/constants/routes";
import type { ReactNode } from "react";
import { BackButton } from "@/components/navigation/BackButton";

const links = [
  { href: ROUTES.admin.dashboard, label: "Dashboard" },
  { href: ROUTES.admin.indicacoes, label: "Indicações" },
  { href: ROUTES.admin.jogos, label: "Arena" },
  { href: ROUTES.admin.usuarios, label: "Usuários" },
  { href: ROUTES.admin.rankings, label: "Rankings" },
  { href: ROUTES.admin.quiz, label: "Quiz" },
  { href: ROUTES.admin.recompensas, label: "Saque PIX" },
  { href: ROUTES.admin.configuracoes, label: "Configurações" },
  { href: ROUTES.admin.fraudes, label: "Fraudes" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showBackButton = pathname !== ROUTES.admin.dashboard;

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <Link href={ROUTES.admin.dashboard} className="font-bold text-white">
            Admin · Recompensa Premiada
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 transition",
                  pathname === l.href ? "bg-white/15 text-white" : "text-slate-400 hover:text-white",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <Link
            href={ROUTES.home}
            className="ml-auto text-sm text-violet-300 hover:underline"
          >
            Voltar ao app
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {showBackButton ? (
          <div className="mb-4">
            <BackButton fallbackHref={ROUTES.admin.dashboard} />
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
