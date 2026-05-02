"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { GameCard, MatchHistoryList } from "@/modules/jogos";
import { GameCoverIllustration } from "@/modules/jogos/components/GameCoverIllustration";
import type { GameCatalogEntry } from "@/modules/jogos/core/gameRegistry";
import { ROUTES } from "@/lib/constants/routes";
import { useExperienceCatalogBuckets } from "@/hooks/useExperienceCatalogBuckets";
import {
  ArenaShell,
  fadeUpItem,
  staggerContainer,
  staggerItem,
} from "@/components/arena/ArenaShell";
import { cn } from "@/lib/utils/cn";
import { Gift, Gem, Swords, Trophy, Zap } from "lucide-react";

const linkBtn =
  "template-3d-button inline-flex min-h-[46px] items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-bold transition";

export function JogosHubClient() {
  const { arena: arenaCatalog } = useExperienceCatalogBuckets();
  const featuredGames = arenaCatalog.slice(0, 3);

  return (
    <ArenaShell className="template-3d-scene" maxWidth="max-w-6xl" padding="sm">
      <motion.div
        className="space-y-5 sm:space-y-6"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.header
          variants={fadeUpItem}
          className="relative overflow-hidden rounded-[1.7rem] border border-amber-300/24 bg-[radial-gradient(circle_at_14%_10%,rgba(251,191,36,0.2),transparent_32%),radial-gradient(circle_at_88%_18%,rgba(217,70,239,0.18),transparent_34%),linear-gradient(140deg,rgba(17,24,39,0.98),rgba(30,27,75,0.82)_48%,rgba(7,11,26,0.98))] p-4 shadow-[0_0_56px_-20px_rgba(251,191,36,0.38),0_26px_64px_-30px_rgba(0,0,0,0.82),inset_0_1px_0_rgba(255,255,255,0.1)] sm:p-6"
        >
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_18px,rgba(255,255,255,0.025)_18px,rgba(255,255,255,0.025)_19px)] opacity-70" />
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-fuchsia-400/15 blur-3xl" />
          <div className="relative grid gap-4">
            <div>
              <p className="casino-kicker text-amber-200/85">
                <Gem className="h-3.5 w-3.5" />
                Casino Arena
              </p>
              <h1 className="mt-2 max-w-[18rem] bg-gradient-to-r from-white via-amber-100 to-fuchsia-200 bg-clip-text text-3xl font-black leading-[0.95] tracking-tight text-transparent sm:max-w-none sm:text-4xl">
                Arena competitiva 3D
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/62 sm:text-base">
                Entre nos confrontos 1v1, busque vitórias semanais e dispute PR em mesas com visual premium.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Link
                  href={ROUTES.jogosFila}
                  className={cn(
                    linkBtn,
                    "border-amber-300/50 bg-[linear-gradient(180deg,rgba(251,191,36,0.24),rgba(146,64,14,0.34))] text-amber-50 shadow-[0_0_30px_-10px_rgba(251,191,36,0.55)] hover:border-amber-200/70",
                  )}
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Buscar duelo
                </Link>
                <Link
                  href={ROUTES.ranking}
                  className={cn(
                    linkBtn,
                    "border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-100 hover:border-fuchsia-300/55",
                  )}
                >
                  <Trophy className="mr-2 h-4 w-4" />
                  Ver ranking
                </Link>
              </div>
            </div>

            <div className="relative w-full rounded-[1.35rem] border border-white/10 bg-black/24 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_22px_42px_-26px_rgba(0,0,0,0.8)]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-[0.24em] text-white/45">
                  Mesas ativas
                </span>
                <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black text-emerald-100">
                  online
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {featuredGames.map((game) => (
                  <Link
                    key={game.id}
                    href={game.href}
                    className="group relative min-h-[82px] overflow-hidden rounded-[1rem] border border-white/10 bg-slate-950 shadow-[0_12px_22px_-16px_rgba(0,0,0,0.8)] sm:min-h-[104px]"
                    aria-label={`Abrir ${game.title}`}
                  >
                    <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-110">
                      <GameCardPreview gameId={game.id} />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                    <span className="absolute inset-x-1.5 bottom-1.5 truncate text-center text-[8px] font-black uppercase tracking-wide text-white sm:text-[9px]">
                      {game.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </motion.header>

        <motion.section variants={fadeUpItem} className="space-y-4 rounded-[1.6rem] border border-white/10 bg-black/18 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/28 bg-amber-500/10 text-amber-200 shadow-[0_0_22px_-10px_rgba(251,191,36,0.55)]">
              <Swords className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-lg font-black text-white">Mesas de confronto</h2>
                <p className="text-xs text-white/45">Escolha seu jogo e entre no matchmaking 1v1.</p>
              </div>
            </div>
            <span className="hidden rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-100/80 sm:inline-flex">
              {arenaCatalog.length} jogos
            </span>
          </div>

          <motion.div
            variants={staggerContainer}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
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
          <MatchHistoryList className="border-amber-300/14 bg-[linear-gradient(135deg,rgba(0,0,0,0.26),rgba(30,27,75,0.22))]" />
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

function GameCardPreview({ gameId }: { gameId: GameCatalogEntry["id"] }) {
  return <GameCoverIllustration gameId={gameId} />;
}
