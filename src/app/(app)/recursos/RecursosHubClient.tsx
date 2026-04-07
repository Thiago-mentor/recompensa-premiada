"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { GameCard } from "@/modules/jogos";
import { ROUTES } from "@/lib/constants/routes";
import { useExperienceCatalogBuckets } from "@/hooks/useExperienceCatalogBuckets";
import {
  ArenaShell,
  fadeUpItem,
  staggerContainer,
  staggerItem,
} from "@/components/arena/ArenaShell";
import { cn } from "@/lib/utils/cn";
import { Coins, Gift, Home, Sparkles } from "lucide-react";

const linkBtn =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-bold transition";

export function RecursosHubClient() {
  const { utility: utilityCatalog } = useExperienceCatalogBuckets();

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
            Recursos do app
          </p>
          <h1 className="bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
            Bônus e utilidades
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/55">
            As experiências classificadas como recurso ficam aqui de forma separada. Elas continuam
            disponíveis para movimentar a economia, mas não aparecem como confrontos da arena.
          </p>
        </motion.header>

        {utilityCatalog.length > 0 ? (
          <motion.section variants={fadeUpItem} className="grid gap-4 sm:grid-cols-2">
            {utilityCatalog.slice(0, 2).map((resource) => (
              <div
                key={`feature-${resource.id}`}
                className={resource.id === "bau"
                  ? "rounded-[1.5rem] border border-amber-400/20 bg-amber-500/10 px-4 py-4"
                  : "rounded-[1.5rem] border border-cyan-400/20 bg-cyan-500/10 px-4 py-4"}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className={resource.id === "bau"
                        ? "text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100/75"
                        : "text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/75"}
                    >
                      {resource.title}
                    </p>
                    <p className="mt-1 text-sm text-white/60">
                      {resource.subtitle}
                    </p>
                  </div>
                  {resource.id === "bau" ? (
                    <Gift className="h-5 w-5 text-amber-200" />
                  ) : (
                    <Sparkles className="h-5 w-5 text-cyan-200" />
                  )}
                </div>
              </div>
            ))}
          </motion.section>
        ) : null}

        <motion.div
          variants={staggerContainer}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2"
        >
          {utilityCatalog.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-white/45 sm:col-span-2">
              Nenhum recurso está classificado nesta área no momento.
            </div>
          ) : (
            utilityCatalog.map((resource) => (
              <motion.div key={resource.id} variants={staggerItem} className="h-full min-h-0">
                <GameCard game={resource} />
              </motion.div>
            ))
          )}
        </motion.div>

        <motion.footer
          variants={fadeUpItem}
          className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:flex-wrap sm:items-center"
        >
          <Link
            href={ROUTES.carteira}
            className={cn(
              linkBtn,
              "border-cyan-400/35 bg-cyan-500/10 text-cyan-100 shadow-[0_0_20px_-6px_rgba(34,211,238,0.35)] hover:border-cyan-400/55 hover:bg-cyan-500/15",
            )}
          >
            <Coins className="mr-2 h-4 w-4" />
            Carteira
          </Link>
          <Link
            href={ROUTES.jogos}
            className={cn(
              linkBtn,
              "border-violet-400/35 bg-violet-500/10 text-violet-100 hover:border-violet-400/50 hover:bg-violet-500/15",
            )}
          >
            Arena competitiva
          </Link>
          <Link
            href={ROUTES.home}
            className={cn(
              linkBtn,
              "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white",
            )}
          >
            <Home className="mr-2 h-4 w-4" />
            Início
          </Link>
        </motion.footer>
      </motion.div>
    </ArenaShell>
  );
}
