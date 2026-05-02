"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { ArrowUpRight, Gamepad2, Gift, Zap } from "lucide-react";

/** Carcaça estilo cassino: pinstripe, bisel cyan/roxo, sombra 3D — sem perspective (hit-testing). */
const casinoShell =
  "template-3d-lift relative flex flex-col overflow-hidden rounded-[1.35rem] border border-cyan-400/38 bg-[#070b18] p-4 shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_10px_0_-6px_rgba(4,8,22,0.95),0_18px_42px_-18px_rgba(0,0,0,0.72),0_0_44px_-14px_rgba(34,211,238,0.24),0_0_52px_-18px_rgba(167,139,250,0.18),inset_0_1px_0_rgba(255,255,255,0.11),inset_0_-12px_22px_rgba(0,0,0,0.32)] transition-all duration-300 ease-out hover:border-cyan-300/55 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_10px_0_-6px_rgba(4,8,22,0.95),0_22px_52px_-18px_rgba(0,0,0,0.66),0_0_56px_-12px_rgba(34,211,238,0.35),0_0_64px_-16px_rgba(192,38,211,0.2)]";

function CardBackdrop({ className }: { className?: string }) {
  return (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(168deg,rgba(49,46,129,0.35)_0%,rgba(15,23,42,0.78)_42%,rgba(7,11,26,0.96)_100%)]",
          className,
        )}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.85] bg-[repeating-linear-gradient(90deg,transparent,transparent_12px,rgba(255,255,255,0.025)_12px,rgba(255,255,255,0.025)_13px)] mix-blend-soft-light"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-px h-[55%] rounded-t-[inherit] bg-[radial-gradient(ellipse_95%_85%_at_50%_-5%,rgba(139,92,246,0.22),transparent_62%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent"
      />
    </>
  );
}

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
      <div className="relative z-10 flex items-start justify-between gap-2 text-white">
        <div className="flex min-w-0 items-start gap-2.5">
          <motion.span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.05rem] border border-violet-400/50 bg-[linear-gradient(155deg,rgba(139,92,246,0.55)_0%,rgba(76,29,149,0.45)_50%,rgba(49,46,129,0.55)_100%)] shadow-[0_0_28px_-8px_rgba(139,92,246,0.6),inset_0_2px_6px_rgba(255,255,255,0.18),inset_0_-2px_6px_rgba(0,0,0,0.25)]"
            whileHover={{ rotate: [0, -4, 4, 0] }}
            transition={{ duration: 0.45 }}
          >
            <Gamepad2 className="h-[1.1rem] w-[1.1rem] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]" />
          </motion.span>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-cyan-300/92 drop-shadow-[0_0_12px_rgba(34,211,238,0.4)]">
              Arena
            </p>
            <span className="mt-0.5 block font-black leading-snug tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)] sm:text-[15px]">
              {title}
            </span>
          </div>
        </div>
        <ArrowUpRight
          className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.55)] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden
        />
      </div>
      <p className="relative z-10 line-clamp-2 text-xs leading-relaxed text-white/55">{subtitle}</p>
      {reward ? (
        <span className="relative z-10 mt-0.5 inline-flex w-fit items-center gap-1.5 self-start rounded-full border border-violet-400/45 bg-[linear-gradient(180deg,rgba(88,28,135,0.38),rgba(15,23,42,0.88))] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-violet-100 shadow-[0_0_22px_-8px_rgba(139,92,246,0.45),inset_0_1px_0_rgba(255,255,255,0.12)]">
          <Gift className="h-3 w-3 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]" aria-hidden />
          {reward}
        </span>
      ) : null}
    </>
  );

  const pvp =
    subtitle.includes("1v1") || subtitle.toLowerCase().includes("pvp") ? (
      <span className="relative z-10 mt-auto inline-flex w-fit items-center gap-1 rounded-lg border border-cyan-400/30 bg-[linear-gradient(180deg,rgba(8,51,68,0.45),rgba(15,23,42,0.85))] px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200 shadow-[0_0_18px_-8px_rgba(34,211,238,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <Zap className="h-3 w-3 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.55)]" aria-hidden />
        PvP
      </span>
    ) : null;

  if (queueHref) {
    return (
      <motion.div
        className={cn("flex flex-col gap-2", className)}
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
      >
        <div className={cn(casinoShell, "min-h-[8.75rem]")}>
          <CardBackdrop />
          <Link
            href={href}
            className="relative z-10 -m-1 flex min-h-[8.25rem] flex-col gap-2 rounded-xl p-1 active:scale-[0.99]"
          >
            {body}
            {pvp}
          </Link>
        </div>
        <Link
          href={queueHref}
          className="text-center text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300/95 drop-shadow-[0_0_12px_rgba(34,211,238,0.35)] underline-offset-4 hover:text-cyan-200 hover:underline"
        >
          Fila 1v1
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
    >
      <Link
        href={href}
        className={cn("group flex min-h-[10rem] flex-col gap-2 active:scale-[0.99]", casinoShell)}
      >
        <CardBackdrop />
        {body}
        {pvp}
      </Link>
    </motion.div>
  );
}
