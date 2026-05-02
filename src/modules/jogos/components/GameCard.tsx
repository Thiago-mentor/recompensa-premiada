"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Gift, Timer, Zap } from "lucide-react";
import type { GameCatalogEntry } from "../core/gameRegistry";
import { GameCoverIllustration } from "./GameCoverIllustration";

/** Moldura cassino 3D para o hub /jogos. */
const casinoShell =
  "template-3d-lift relative flex h-full flex-col overflow-hidden rounded-[1.45rem] border border-cyan-400/36 bg-[#050818] shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_12px_0_-7px_rgba(3,7,18,0.95),0_22px_54px_-20px_rgba(0,0,0,0.82),0_0_48px_-16px_rgba(34,211,238,0.28),0_0_66px_-22px_rgba(167,139,250,0.28),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-14px_24px_rgba(0,0,0,0.34)] transition-all duration-300 ease-out group-hover/card:border-amber-300/52 group-hover/card:shadow-[0_0_0_1px_rgba(251,191,36,0.18),0_14px_0_-7px_rgba(3,7,18,0.95),0_28px_62px_-22px_rgba(0,0,0,0.72),0_0_60px_-12px_rgba(251,191,36,0.36),0_0_74px_-18px_rgba(217,70,239,0.24)]";

function CardBackdrop({ className }: { className?: string }) {
  return (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_50%_-15%,rgba(251,191,36,0.16),transparent_32%),radial-gradient(circle_at_100%_8%,rgba(217,70,239,0.12),transparent_30%),linear-gradient(168deg,rgba(49,46,129,0.36)_0%,rgba(15,23,42,0.86)_42%,rgba(7,11,26,0.98)_100%)]",
          className,
        )}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.82] bg-[repeating-linear-gradient(90deg,transparent,transparent_12px,rgba(255,255,255,0.024)_12px,rgba(255,255,255,0.024)_13px),repeating-linear-gradient(0deg,transparent,transparent_18px,rgba(251,191,36,0.018)_18px,rgba(251,191,36,0.018)_19px)] mix-blend-soft-light"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-px h-[60%] rounded-t-[inherit] bg-[radial-gradient(ellipse_95%_85%_at_50%_-5%,rgba(251,191,36,0.16),transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_42%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent"
      />
    </>
  );
}

export function GameCard({
  game,
  className,
}: {
  game: GameCatalogEntry;
  className?: string;
}) {
  const cooldownLabel =
    game.cooldownSec >= 3600
      ? `${Math.round(game.cooldownSec / 3600)}h`
      : `${game.cooldownSec}s`;

  const isArena = game.experienceKind === "arena";

  return (
    <motion.div
      className={cn("group/card h-full", className)}
      initial={false}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
    >
      <div className={cn(casinoShell)}>
        <CardBackdrop />
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
          aria-hidden
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/7 via-transparent to-fuchsia-500/10" />
        </div>

        <Link
          href={game.href}
          className="relative z-10 flex min-h-0 flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b18] active:scale-[0.99]"
        >
          <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-black ring-1 ring-inset ring-white/10">
            <div
              className="absolute inset-0 transition-transform duration-500 ease-out group-hover/card:scale-[1.07]"
              aria-hidden
            >
              <GameCoverIllustration gameId={game.id} />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,transparent_0,transparent_42%,rgba(0,0,0,0.62)_100%)]" aria-hidden />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050818] via-slate-950/10 to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.45) 2px, rgba(0,0,0,0.45) 4px)",
              }}
              aria-hidden
            />
            <span
              className="absolute right-2 top-2 flex shrink-0 items-center gap-1 rounded-full border border-amber-300/50 bg-black/76 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_0_18px_-6px_rgba(251,191,36,0.72)] backdrop-blur-md"
            >
              <Timer className="h-3 w-3 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.55)]" />
              {cooldownLabel}
            </span>
            {game.highlightLabel ? (
              <span
                className={cn(
                  "absolute left-2 top-2 max-w-[58%] truncate rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_4px_14px_-4px_rgba(0,0,0,0.5)]",
                  isArena
                    ? "border-amber-400/38 bg-[linear-gradient(180deg,rgba(66,32,0,0.55),rgba(0,0,0,0.7))] text-amber-50"
                    : "border-cyan-400/35 bg-[linear-gradient(180deg,rgba(8,47,73,0.5),rgba(0,0,0,0.68))] text-cyan-100",
                )}
              >
                {game.highlightLabel}
              </span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-10 sm:px-4 sm:pb-4">
              <h2 className="text-balance text-xl font-black leading-tight tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] sm:text-2xl">
                {game.title}
              </h2>
            </div>
          </div>

          <div className="relative z-10 flex flex-1 flex-col gap-3 border-t border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.36),rgba(7,11,26,0.96))] p-4 sm:p-5">
            <p className="text-sm leading-relaxed text-white/62">{game.subtitle}</p>
            {isArena ? (
              <span className="template-3d-button mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/55 bg-[linear-gradient(180deg,rgba(251,191,36,0.24),rgba(146,64,14,0.34)_48%,rgba(15,23,42,0.96))] px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-amber-50 shadow-[0_0_30px_-8px_rgba(251,191,36,0.5),inset_0_1px_0_rgba(253,230,138,0.25),inset_0_-3px_10px_rgba(0,0,0,0.32)]">
                <Zap className="h-3.5 w-3.5 shrink-0 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.65)]" />
                1v1 · matchmaking
              </span>
            ) : (
              <span className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-xl border border-cyan-400/38 bg-[linear-gradient(180deg,rgba(8,51,68,0.45),rgba(15,23,42,0.9))] px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100 shadow-[0_0_22px_-8px_rgba(34,211,238,0.32),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-2px_6px_rgba(0,0,0,0.22)]">
                <Gift className="h-3.5 w-3.5 text-cyan-200 drop-shadow-[0_0_6px_rgba(34,211,238,0.45)]" />
                Recurso solo
              </span>
            )}
          </div>
        </Link>
      </div>
    </motion.div>
  );
}
