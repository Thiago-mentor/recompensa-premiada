"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/constants/routes";
import { BackButton } from "@/components/navigation/BackButton";
import {
  Home,
  ListChecks,
  Gamepad2,
  Trophy,
  User,
  Ticket,
  UserPlus,
} from "lucide-react";
import type { ReactNode } from "react";
import { DailyRewardModalHost } from "@/components/dailyReward/DailyRewardModalHost";

const nav = [
  { href: ROUTES.home, label: "Início", icon: Home },
  { href: ROUTES.missoes, label: "Missões", icon: ListChecks },
  { href: ROUTES.jogos, label: "Arena", icon: Gamepad2 },
  { href: ROUTES.ranking, label: "Ranking", icon: Trophy },
  { href: ROUTES.sorteios, label: "Sorteios", icon: Ticket },
  { href: ROUTES.convidar, label: "Convites", icon: UserPlus },
  { href: ROUTES.perfil, label: "Perfil", icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showBackButton = pathname !== ROUTES.home;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#040712] text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-48 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_58%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-56 bg-[radial-gradient(circle_at_bottom,rgba(217,70,239,0.16),transparent_62%)]"
      />
      <main className="relative z-10 mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-4 sm:px-5">
        {showBackButton ? (
          <div className="mb-4">
            <BackButton fallbackHref={ROUTES.home} />
          </div>
        ) : null}
        {children}
      </main>
      <DailyRewardModalHost />
      <nav
        className="fixed inset-x-0 bottom-0 z-40 px-2 pb-1 safe-area-pb sm:px-4"
        aria-label="Principal"
      >
        <div className="mx-auto max-w-xl overflow-hidden rounded-[1.7rem] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(3,8,20,0.96),rgba(5,10,22,0.92))] shadow-[0_0_42px_-18px_rgba(34,211,238,0.35)] backdrop-blur-xl">
          <div className="pointer-events-none h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
          <ul className="grid grid-cols-7 gap-0.5 px-1.5 py-2 sm:gap-1 sm:px-2">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <li key={href} className="min-w-0">
                  <Link
                    href={href}
                    className={cn(
                      "group flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-[1.15rem] border px-1.5 py-2 text-[9px] font-semibold leading-tight transition sm:min-h-[64px] sm:text-[10px]",
                      active
                        ? "border-cyan-400/25 bg-cyan-500/12 text-cyan-100 shadow-[0_0_26px_-12px_rgba(34,211,238,0.55)]"
                        : "border-transparent text-white/48 hover:border-white/10 hover:bg-white/[0.04] hover:text-white/82",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-2xl border transition",
                        active
                          ? "border-cyan-300/30 bg-cyan-400/12 text-cyan-100"
                          : "border-white/10 bg-white/[0.03] text-white/65 group-hover:text-white/85",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                    </span>
                    <span className="line-clamp-2 text-center">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </div>
  );
}
