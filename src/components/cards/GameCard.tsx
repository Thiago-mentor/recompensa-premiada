"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { ArrowUpRight, Gamepad2, Gift, Zap } from "lucide-react";

const cardFrame =
  "relative flex flex-col overflow-hidden rounded-2xl border-2 border-white/10 bg-gradient-to-br from-slate-950/90 via-violet-950/30 to-slate-950/95 p-4 shadow-[0_0_28px_-10px_rgba(139,92,246,0.22)] transition-colors duration-300 hover:border-cyan-400/35 hover:shadow-[0_0_32px_-8px_rgba(34,211,238,0.28)]";

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
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-fuchsia-500/35 bg-fuchsia-500/10"
          whileHover={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 0.4 }}
        >
          <Gamepad2 className="h-4 w-4 text-fuchsia-200" />
        </motion.span>
        <span className="font-bold tracking-tight">{title}</span>
        </div>
        <ArrowUpRight className="h-4 w-4 text-white/35" />
      </div>
      <p className="text-xs leading-snug text-white/55">{subtitle}</p>
      {reward ? (
        <span className="inline-flex items-center gap-1 self-start rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-100/90">
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
          className="text-center text-[11px] font-bold uppercase tracking-wider text-cyan-300/90 underline-offset-4 hover:text-cyan-200 hover:underline"
        >
          Fila 1v1
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}>
      <Link href={href} className={cn("flex min-h-[9.75rem] flex-col gap-2 active:scale-[0.99]", cardFrame, className)}>
        {body}
        {subtitle.includes("1v1") ? (
          <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-cyan-300/80">
            <Zap className="h-3 w-3 text-amber-300" />
            PvP
          </span>
        ) : null}
      </Link>
    </motion.div>
  );
}
