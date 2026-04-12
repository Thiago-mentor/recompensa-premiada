"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { ArrowUpRight, Gamepad2, Gift, Zap } from "lucide-react";

const cardFrame =
  "game-panel-soft relative flex flex-col overflow-hidden rounded-[1.45rem] border border-cyan-400/15 p-4 transition duration-300 hover:border-cyan-300/35 hover:shadow-[0_0_36px_-10px_rgba(34,211,238,0.3)]";

export function GameCard({
  href,
  title,
  subtitle,
  reward,
  className,
  queueHref,
}: {
  href: string;
  title: string;
  subtitle: string;
  reward?: string;
  className?: string;
  queueHref?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2 text-white">
        <div className="flex items-center gap-2">
          <motion.span
            className="flex h-10 w-10 items-center justify-center rounded-[1rem] border border-fuchsia-400/25 bg-fuchsia-500/10 shadow-[0_0_22px_-14px_rgba(217,70,239,0.55)]"
            whileHover={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 0.4 }}
          >
            <Gamepad2 className="h-4 w-4 text-fuchsia-100" />
          </motion.span>
          <div>
            <p className="game-kicker text-fuchsia-200/72">Arena</p>
            <span className="font-black tracking-tight text-white">{title}</span>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-cyan-100/45" />
      </div>
      <p className="line-clamp-2 text-xs leading-snug text-white/58">{subtitle}</p>
      {reward ? (
        <span className="game-chip self-start border-emerald-400/20 bg-emerald-500/10 text-emerald-100/90">
          <Gift className="h-3 w-3" />
          {reward}
        </span>
      ) : null}
    </>
  );

  if (queueHref) {
    return (
      <motion.div
        className={cn("flex flex-col gap-2", className)}
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
      >
        <div className={cardFrame}>
          <Link href={href} className="group -m-1 flex min-h-[8.5rem] flex-col gap-2 rounded-xl p-1 active:scale-[0.99]">
            {body}
          </Link>
        </div>
        <Link
          href={queueHref}
          className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300/90 underline-offset-4 hover:text-cyan-200 hover:underline"
        >
          Fila 1v1
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}>
      <Link
        href={href}
        className={cn("flex min-h-[9.75rem] flex-col gap-2 active:scale-[0.99]", cardFrame, className)}
      >
        {body}
        {subtitle.includes("1v1") ? (
          <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-300/80">
            <Zap className="h-3 w-3 text-amber-300" />
            PvP
          </span>
        ) : null}
      </Link>
    </motion.div>
  );
}
