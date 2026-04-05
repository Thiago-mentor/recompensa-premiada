"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { GameCard, MatchHistoryList, GAME_CATALOG } from "@/modules/jogos";
import { ROUTES } from "@/lib/constants/routes";
import {
  ArenaShell,
  fadeUpItem,
  staggerContainer,
  staggerItem,
} from "@/components/arena/ArenaShell";
import { cn } from "@/lib/utils/cn";

const linkBtn =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-bold transition";

export function JogosHubClient() {
  return (
    <ArenaShell>
      <motion.div
        className="space-y-6"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.header variants={fadeUpItem} className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-300/75">
            Arena multiplayer
          </p>
          <h1 className="bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
            Minijogos
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/55">
            PvP entra direto na fila (matchmaking ao vivo). Roleta e baú são solo no servidor. Ranking e
            missões <code className="rounded bg-white/10 px-1 text-xs text-cyan-200/80">play_match</code>{" "}
            seguem valendo.
          </p>
        </motion.header>

        <motion.div
          variants={staggerContainer}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          {GAME_CATALOG.map((g) => (
            <motion.div key={g.id} variants={staggerItem} className="h-full min-h-0">
              <GameCard game={g} />
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={fadeUpItem}>
          <MatchHistoryList />
        </motion.div>

        <motion.footer
          variants={fadeUpItem}
          className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:flex-wrap sm:items-center"
        >
          <Link
            href={ROUTES.jogosFila}
            className={cn(
              linkBtn,
              "border-cyan-400/35 bg-cyan-500/10 text-cyan-100 shadow-[0_0_20px_-6px_rgba(34,211,238,0.35)] hover:border-cyan-400/55 hover:bg-cyan-500/15",
            )}
          >
            Fila 1v1 (escolher modo)
          </Link>
          <Link
            href={ROUTES.ranking}
            className={cn(
              linkBtn,
              "border-violet-400/35 bg-violet-500/10 text-violet-100 hover:border-violet-400/50 hover:bg-violet-500/15",
            )}
          >
            Ver ranking
          </Link>
          <Link
            href={ROUTES.home}
            className={cn(
              linkBtn,
              "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white",
            )}
          >
            ← Início
          </Link>
        </motion.footer>
      </motion.div>
    </ArenaShell>
  );
}
