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
import { CasinoCard } from "@/components/cards/CasinoCard";
import { premiumHeroLinkClassName } from "@/components/ui/Button";

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
    <>
      <div className="template-3d-scene relative flex min-h-dvh flex-col overflow-x-hidden bg-[linear-gradient(180deg,#070B1A_0%,#0a1022_45%,#0F172A_100%)] text-white">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-0 h-56 bg-[radial-gradient(ellipse_90%_100%_at_50%_-20%,rgba(139,92,246,0.28),transparent_55%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-64 bg-[radial-gradient(ellipse_80%_90%_at_70%_110%,rgba(59,130,246,0.12),transparent_50%),radial-gradient(ellipse_60%_70%_at_10%_100%,rgba(236,72,153,0.1),transparent_48%)]"
        />
        <main className="relative z-10 mx-auto w-full max-w-xl flex-1 px-4 pb-44 pt-4 sm:px-5 sm:pb-40">
          {showBackButton ? (
            <div className="mb-4">
              <BackButton fallbackHref={ROUTES.home} />
            </div>
          ) : null}
          <div className="game-stage-3d w-full">
            <CasinoCard
              footer={
                pathname === ROUTES.home ? (
                  <Link href={ROUTES.jogos} className={premiumHeroLinkClassName()}>
                    Ir para a Arena
                  </Link>
                ) : undefined
              }
            >
              {children}
            </CasinoCard>
          </div>
        </main>
      </div>
      <DailyRewardModalHost />
      <nav
        className="pointer-events-auto fixed inset-x-0 bottom-0 z-[1000] isolate px-2 pb-1 safe-area-pb sm:px-4"
        aria-label="Principal"
      >
        <div className="pointer-events-auto relative z-[1001] mx-auto max-w-xl sm:px-0">
          <div className="pointer-events-auto overflow-hidden rounded-[1.7rem] border border-violet-500/35 bg-[linear-gradient(185deg,rgba(12,8,32,0.97),rgba(15,10,42,0.94),rgba(7,11,26,0.96))] shadow-[0_0_48px_-16px_rgba(139,92,246,0.45),0_0_64px_-24px_rgba(236,72,153,0.22),0_20px_50px_-12px_rgba(0,0,0,0.65),0_10px_0_-6px_rgba(6,4,18,0.95),inset_0_2px_5px_rgba(255,255,255,0.1),inset_0_-10px_18px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="pointer-events-none h-px bg-gradient-to-r from-transparent via-fuchsia-400/45 to-transparent" />
            <ul className="pointer-events-auto grid grid-cols-7 gap-0.5 px-1.5 py-2 sm:gap-1 sm:px-2">
              {nav.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <li key={href} className="pointer-events-auto min-w-0">
                    <Link
                      href={href}
                      className={cn(
                        "template-3d-button pointer-events-auto group flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-[1.15rem] border px-1.5 py-2 text-[9px] font-semibold leading-tight transition-transform duration-200 ease-out will-change-transform sm:min-h-[64px] sm:text-[10px] motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0.5 motion-safe:active:scale-[0.94]",
                        active
                          ? "border-fuchsia-400/35 bg-[linear-gradient(180deg,rgba(139,92,246,0.22),rgba(192,38,211,0.14))] text-fuchsia-50 shadow-[0_0_28px_-10px_rgba(217,70,239,0.55),0_0_36px_-14px_rgba(236,72,153,0.35)]"
                          : "border-transparent text-white/48 hover:border-violet-500/20 hover:bg-violet-500/[0.06] hover:text-white/85",
                      )}
                    >
                      <span
                        className={cn(
                          "template-3d-orb flex h-9 w-9 items-center justify-center rounded-2xl border transition-transform duration-200 ease-out motion-safe:active:scale-90",
                          active
                            ? "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100 shadow-[0_0_20px_-8px_rgba(236,72,153,0.5)]"
                            : "border-white/[0.08] bg-white/[0.03] text-violet-200/70 group-hover:border-fuchsia-400/25 group-hover:bg-fuchsia-500/10 group-hover:text-fuchsia-100/90",
                        )}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0 drop-shadow-[0_0_6px_rgba(167,139,250,0.35)]" />
                      </span>
                      <span className="line-clamp-2 text-center">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </nav>
    </>
  );
}
