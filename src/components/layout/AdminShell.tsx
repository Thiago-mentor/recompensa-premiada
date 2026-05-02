"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/constants/routes";
import type { ReactNode } from "react";
import { BackButton } from "@/components/navigation/BackButton";
import { CasinoCard } from "@/components/cards/CasinoCard";
import { goldButtonLinkClassName } from "@/components/ui/Button";

const links = [
  { href: ROUTES.admin.dashboard, label: "Dashboard" },
  { href: ROUTES.admin.indicacoes, label: "Indicações" },
  { href: ROUTES.admin.jogos, label: "Arena" },
  { href: ROUTES.admin.usuarios, label: "Usuários" },
  { href: ROUTES.admin.rankings, label: "Rankings" },
  { href: ROUTES.admin.sorteios, label: "Sorteios" },
  { href: ROUTES.admin.quiz, label: "Quiz" },
  { href: ROUTES.admin.baus, label: "Baús" },
  { href: ROUTES.admin.missoes, label: "Missões" },
  { href: ROUTES.admin.recompensas, label: "Saque PIX" },
  { href: ROUTES.admin.configuracoes, label: "Configurações" },
  { href: ROUTES.admin.fraudes, label: "Fraudes" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showBackButton = pathname !== ROUTES.admin.dashboard;

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,rgba(88,28,135,0.22),transparent_45%),linear-gradient(180deg,#020617,#0f172a)] text-slate-100">
      <header className="sticky top-0 z-[100] border-b border-violet-400/20 bg-slate-950/95 shadow-[0_18px_44px_-28px_rgba(0,0,0,0.75),inset_0_-1px_0_rgba(255,255,255,0.06)] backdrop-blur">
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
                  "template-3d-button rounded-lg px-3 py-1.5 transition",
                  pathname === l.href
                    ? "border border-violet-300/25 bg-white/15 text-white shadow-[0_0_24px_-10px_rgba(167,139,250,0.5)]"
                    : "border border-transparent text-slate-400 hover:border-violet-300/20 hover:bg-white/[0.06] hover:text-white",
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
      <div className="template-3d-scene relative z-0 mx-auto max-w-6xl px-4 py-6">
        {showBackButton ? (
          <div className="mb-4">
            <BackButton fallbackHref={ROUTES.admin.dashboard} />
          </div>
        ) : null}
        <CasinoCard
          disableHud3d
          footer={
            <Link href={ROUTES.home} className={goldButtonLinkClassName()}>
              Abrir aplicativo
            </Link>
          }
        >
          {children}
        </CasinoCard>
      </div>
    </div>
  );
}
