"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Gift, Timer, Zap } from "lucide-react";
import type { GameCatalogEntry } from "../core/gameRegistry";
import { GameCoverIllustration } from "./GameCoverIllustration";

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

  return (
    <motion.div
      className={cn("group/card h-full", className)}
      initial={false}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
    >
      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-2xl border-2 border-white/10",
          "bg-slate-950/90 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.85)] transition-[border-color,box-shadow] duration-300",
          "group-hover/card:border-cyan-400/45 group-hover/card:shadow-[0_20px_50px_-10px_rgba(34,211,238,0.22)]",
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
          aria-hidden
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-transparent to-fuchsia-500/10" />
        </div>

        <Link
          href={game.href}
          className="relative flex min-h-0 flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 active:scale-[0.99]"
        >
          <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-black">
            <div
              className="absolute inset-0 transition-transform duration-500 ease-out group-hover/card:scale-[1.04]"
              aria-hidden
            >
              <GameCoverIllustration gameId={game.id} />
            </div>
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)",
              }}
              aria-hidden
            />
            <span className="absolute right-2 top-2 flex shrink-0 items-center gap-1 rounded-lg border border-white/20 bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-100 backdrop-blur-sm">
              <Timer className="h-3 w-3 text-cyan-300" />
              {cooldownLabel}
            </span>
            {game.highlightLabel ? (
              <span className="absolute left-2 top-2 rounded-lg border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/70 backdrop-blur-sm">
                {game.highlightLabel}
              </span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-8 sm:px-4 sm:pb-4">
              <h2 className="text-balance text-lg font-black leading-tight tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] sm:text-xl">
                {game.title}
              </h2>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2.5 p-4 sm:p-5">
            <p className="text-sm leading-relaxed text-white/60">{game.subtitle}</p>
            {game.experienceKind === "arena" ? (
              <span className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-200/95">
                <Zap className="h-3.5 w-3.5 text-amber-300" />
                1v1 · matchmaking
              </span>
            ) : (
              <span className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-100/85">
                <Gift className="h-3.5 w-3.5 text-cyan-200" />
                Recurso solo
              </span>
            )}
          </div>
        </Link>
      </div>
    </motion.div>
  );
}
