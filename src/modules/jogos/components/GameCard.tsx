"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Gamepad2, Timer, Zap } from "lucide-react";
import type { GameCatalogEntry } from "../core/gameRegistry";

export function GameCard({
  game,
  className,
}: {
  game: GameCatalogEntry;
  className?: string;
}) {
  return (
    <motion.div
      className={cn("group/card h-full", className)}
      initial={false}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-2xl border-2 border-white/10",
          "bg-gradient-to-br from-slate-950/90 via-violet-950/35 to-slate-950/95",
          "shadow-[0_0_32px_-10px_rgba(139,92,246,0.25)] transition-colors duration-300",
          "group-hover/card:border-cyan-400/40 group-hover/card:shadow-[0_0_36px_-8px_rgba(34,211,238,0.3)]",
        )}
      >
        <span
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl transition-opacity group-hover/card:opacity-100 opacity-60"
          aria-hidden
        />
        <Link
          href={game.href}
          className="relative flex flex-1 flex-col gap-3 p-4 active:scale-[0.99] sm:p-5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 text-white">
              <motion.span
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200"
                whileHover={{ rotate: [0, -6, 6, 0], transition: { duration: 0.45 } }}
              >
                <Gamepad2 className="h-5 w-5" />
              </motion.span>
              <span className="font-bold leading-tight tracking-tight">{game.title}</span>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-200/80">
              <Timer className="h-3 w-3" />
              {game.cooldownSec >= 3600
                ? `${Math.round(game.cooldownSec / 3600)}h`
                : `${game.cooldownSec}s`}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-white/55">{game.subtitle}</p>
          {game.multiplayerReady ? (
            <span className="mt-auto inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-300/90">
              <Zap className="h-3.5 w-3.5 text-amber-300" />
              1v1 · matchmaking
            </span>
          ) : (
            <span className="mt-auto text-[10px] font-semibold uppercase tracking-wider text-white/35">
              Solo
            </span>
          )}
        </Link>
      </div>
    </motion.div>
  );
}
