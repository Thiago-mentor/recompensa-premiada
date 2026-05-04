"use client";

import { motion } from "framer-motion";
import { fadeUpItem } from "@/components/arena/ArenaShell";
import { cn } from "@/lib/utils/cn";

export type ClaGameHeaderAccent = "cyan" | "fuchsia" | "violet" | "amber";

const ACCENT_KICKER: Record<ClaGameHeaderAccent, string> = {
  cyan: "!text-cyan-300/85",
  fuchsia: "!text-fuchsia-300/80",
  violet: "!text-violet-300/80",
  amber: "!text-amber-200/80",
};

const ACCENT_TITLE: Record<ClaGameHeaderAccent, string> = {
  cyan: "from-white via-cyan-100 to-cyan-200",
  fuchsia: "from-white via-fuchsia-100 to-cyan-100",
  violet: "from-white via-violet-100 to-cyan-100",
  amber: "from-white via-amber-100 to-fuchsia-100",
};

const ACCENT_CORNER_TL: Record<ClaGameHeaderAccent, string> = {
  cyan: "border-cyan-400/45",
  fuchsia: "border-fuchsia-400/45",
  violet: "border-violet-400/45",
  amber: "border-amber-300/45",
};

const ACCENT_CORNER_BR: Record<ClaGameHeaderAccent, string> = {
  cyan: "border-cyan-400/30",
  fuchsia: "border-fuchsia-400/30",
  violet: "border-violet-400/30",
  amber: "border-amber-300/30",
};

/**
 * Cabeçalho compartilhado da área CLA — cantos tipo HUD, gradiente no título.
 */
export function ClaGameHeader({
  kicker,
  title,
  description,
  accent = "fuchsia",
}: {
  kicker: string;
  title: string;
  description: string;
  accent?: ClaGameHeaderAccent;
}) {
  return (
    <motion.header variants={fadeUpItem} className="relative space-y-2 px-1 pt-1">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -left-0.5 top-0 h-7 w-7 rounded-tl-lg border-l-2 border-t-2",
          ACCENT_CORNER_TL[accent],
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -bottom-1 right-0 h-6 w-6 rounded-br-lg border-b-2 border-r-2 opacity-70",
          ACCENT_CORNER_BR[accent],
        )}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-2 top-1.5 h-px w-20 max-w-[40%] bg-gradient-to-r from-transparent via-white/30 to-transparent sm:w-28"
      />
      <p className={cn("game-kicker", ACCENT_KICKER[accent])}>{kicker}</p>
      <h1
        className={cn(
          "bg-gradient-to-r bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl",
          ACCENT_TITLE[accent],
        )}
      >
        {title}
      </h1>
      <p className="text-sm leading-relaxed text-white/58">{description}</p>
    </motion.header>
  );
}
