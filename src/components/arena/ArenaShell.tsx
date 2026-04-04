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
}: ArenaShellProps) {
  return (
    <div className={cn("relative mx-auto w-full", maxWidth, className)}>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-[1.85rem] opacity-50 blur-2xl"
        style={{
          background:
            "linear-gradient(135deg, rgb(34 211 238 / 0.18), rgb(139 92 246 / 0.22), rgb(217 70 239 / 0.12))",
        }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 0.5, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-slate-950/95 via-violet-950/25 to-slate-950 shadow-[0_0_56px_-14px_rgba(34,211,238,0.2)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className={cn("relative", paddingMap[padding])}>{children}</div>
      </div>
    </div>
  );
}
