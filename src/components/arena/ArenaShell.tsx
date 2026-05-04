"use client";

import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.06,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 30 },
  },
};

export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 420, damping: 32 },
  },
};

type ArenaShellProps = {
  children: ReactNode;
  className?: string;
  /** padding interno do painel */
  padding?: "none" | "sm" | "md";
  maxWidth?: string;
  /**
   * Cantos cyan + friso superior no painel. Desligue quando o conteúdo já traz HUD próprio
   * (ex.: cabeçalhos CLA), para evitar cantos duplicados ou cores misturadas.
   */
  hudFrame?: boolean;
};

const paddingMap = {
  none: "",
  sm: "p-4 sm:p-5",
  md: "p-5 sm:p-7",
};

/**
 * Moldura visual compartilhada (hub jogos, blocos da home) — alinhada às telas sala/fila.
 */
export function ArenaShell({
  children,
  className,
  padding = "md",
  maxWidth = "max-w-4xl",
  hudFrame = true,
}: ArenaShellProps) {
  return (
    <div className={cn("relative mx-auto w-full", maxWidth, className)}>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-2 rounded-[2rem] opacity-60 blur-3xl"
        style={{
          background:
            "linear-gradient(135deg, rgb(34 211 238 / 0.22), rgb(139 92 246 / 0.26), rgb(217 70 239 / 0.16))",
        }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 0.5, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      <div className="game-panel rounded-[1.95rem] border-cyan-400/20 shadow-[0_0_58px_-16px_rgba(34,211,238,0.24)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        {hudFrame ? (
          <>
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
            <div className="pointer-events-none absolute left-4 top-4 h-4 w-4 border-l border-t border-cyan-300/45" />
            <div className="pointer-events-none absolute right-4 top-4 h-4 w-4 border-r border-t border-cyan-300/45" />
            <div className="pointer-events-none absolute bottom-4 left-4 h-4 w-4 border-b border-l border-cyan-300/35" />
            <div className="pointer-events-none absolute bottom-4 right-4 h-4 w-4 border-b border-r border-cyan-300/35" />
          </>
        ) : null}
        <div className={cn("relative", paddingMap[padding])}>{children}</div>
      </div>
    </div>
  );
}
