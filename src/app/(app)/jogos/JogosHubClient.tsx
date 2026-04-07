"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { GameCard, MatchHistoryList } from "@/modules/jogos";
import { ROUTES } from "@/lib/constants/routes";
import { useExperienceCatalogBuckets } from "@/hooks/useExperienceCatalogBuckets";
import {
  ArenaShell,
  fadeUpItem,
  staggerContainer,
  staggerItem,
} from "@/components/arena/ArenaShell";
import { cn } from "@/lib/utils/cn";
import { Gift, Swords, Trophy } from "lucide-react";

const linkBtn =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-bold transition";

export function JogosHubClient() {
  const { arena: arenaCatalog } = useExperienceCatalogBuckets();

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
            Arena premium
          </p>
          <h1 className="bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
            Arena competitiva
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/55">
            Aqui ficam apenas os confrontos competitivos do app. As experiências classificadas como
            recurso vivem em uma área própria.
          </p>
        </motion.header>

        <motion.section variants={fadeUpItem} className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-500/10 text-amber-200">
              <Swords className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">Confrontos</h2>
              <p className="text-xs text-white/45">Experiências competitivas que contam como jogo no app.</p>
            </div>
          </div>

          <motion.div
            variants={staggerContainer}
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
          >
            {arenaCatalog.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-white/45 sm:col-span-2 xl:col-span-3">
                Nenhum confronto está classificado como arena no momento.
              </div>
            ) : (
              arenaCatalog.map((g) => (
                <motion.div key={g.id} variants={staggerItem} className="h-full min-h-0">
                  <GameCard game={g} />
                </motion.div>
              ))
            )}
          </motion.div>
        </motion.section>

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
            href={ROUTES.recursos}
            className={cn(
              linkBtn,
              "border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:border-cyan-400/45 hover:bg-cyan-500/15",
            )}
          >
            <Gift className="mr-2 h-4 w-4" />
            Abrir recursos
          </Link>
          <Link
            href={ROUTES.carteira}
            className={cn(
              linkBtn,
              "border-amber-400/30 bg-amber-500/10 text-amber-100 hover:border-amber-400/45 hover:bg-amber-500/15",
            )}
          >
            <Trophy className="mr-2 h-4 w-4" />
            Carteira e prêmios
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
