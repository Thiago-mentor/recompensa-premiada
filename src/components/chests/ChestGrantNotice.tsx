"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/constants/routes";
import type { ChestRarity, GrantedChestSummary } from "@/types/chest";
import {
  CHEST_RARITY_LABEL,
  CHEST_SOURCE_LABEL,
  formatChestPlacement,
} from "@/utils/chest";

const CHEST_RARITY_STYLE: Record<
  ChestRarity,
  {
    shell: string;
    lid: string;
    lock: string;
    glow: string;
    border: string;
    text: string;
  }
> = {
  comum: {
    shell: "from-amber-700 via-yellow-600 to-amber-900",
    lid: "from-yellow-300 via-amber-400 to-amber-700",
    lock: "bg-yellow-200 text-amber-950",
    glow: "bg-amber-300/35",
    border: "border-amber-300/30",
    text: "text-amber-100",
  },
  raro: {
    shell: "from-cyan-700 via-sky-500 to-blue-950",
    lid: "from-cyan-200 via-sky-400 to-blue-700",
    lock: "bg-cyan-100 text-cyan-950",
    glow: "bg-cyan-300/35",
    border: "border-cyan-300/35",
    text: "text-cyan-100",
  },
  epico: {
    shell: "from-fuchsia-800 via-violet-600 to-indigo-950",
    lid: "from-fuchsia-300 via-violet-400 to-purple-800",
    lock: "bg-fuchsia-100 text-fuchsia-950",
    glow: "bg-fuchsia-300/35",
    border: "border-fuchsia-300/35",
    text: "text-fuchsia-100",
  },
  lendario: {
    shell: "from-orange-700 via-amber-500 to-yellow-950",
    lid: "from-yellow-100 via-amber-300 to-orange-600",
    lock: "bg-yellow-50 text-orange-950",
    glow: "bg-yellow-200/45",
    border: "border-yellow-200/45",
    text: "text-yellow-100",
  },
};

export function ChestGrantNotice({
  grantedChest,
  label = "Baú enviado ao seu hub",
  className,
}: {
  grantedChest: GrantedChestSummary | null | undefined;
  label?: string;
  className?: string;
}) {
  if (!grantedChest) return null;

  return (
    <Link
      href={`${ROUTES.recursos}/bau`}
      aria-label={`Abrir hub do baú ${CHEST_RARITY_LABEL[grantedChest.rarity]}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border border-amber-400/25 bg-[radial-gradient(circle_at_12%_20%,rgba(251,191,36,0.18),transparent_34%),linear-gradient(135deg,rgba(120,53,15,0.22),rgba(15,23,42,0.82))] p-3 text-sm shadow-[0_0_28px_-12px_rgba(251,191,36,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-amber-300/45 hover:brightness-110",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_34%,rgba(251,191,36,0.08))]" />
      <div className="flex items-start gap-3">
        <ChestPrizeIllustration rarity={grantedChest.rarity} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-100/75">
            {label}
          </p>
          <p className="mt-1 font-semibold text-white">
            Baú {CHEST_RARITY_LABEL[grantedChest.rarity]} conquistado
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/85">
            {formatChestPlacement(grantedChest)} · origem{" "}
            {CHEST_SOURCE_LABEL[grantedChest.source].toLowerCase()}
          </p>
        </div>
        <Sparkles className="mt-1 h-4 w-4 shrink-0 text-amber-200/80" />
      </div>
    </Link>
  );
}

function ChestPrizeIllustration({ rarity }: { rarity: ChestRarity }) {
  const style = CHEST_RARITY_STYLE[rarity];

  return (
    <span
      className={cn(
        "relative mt-0.5 inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border bg-black/20 shadow-[0_12px_24px_-12px_rgba(0,0,0,0.8)]",
        style.border,
      )}
      aria-hidden
    >
      <span className={cn("absolute inset-1 rounded-2xl blur-md", style.glow)} />
      <span className="relative block h-11 w-12">
        <span
          className={cn(
            "absolute left-1 top-0 h-5 w-10 rounded-t-xl border border-white/25 bg-gradient-to-b shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
            style.lid,
          )}
        />
        <span
          className={cn(
            "absolute bottom-0 left-0 h-8 w-12 rounded-b-xl rounded-t-md border border-black/25 bg-gradient-to-br shadow-[inset_0_2px_0_rgba(255,255,255,0.18),inset_0_-6px_10px_rgba(0,0,0,0.26)]",
            style.shell,
          )}
        />
        <span className="absolute left-1/2 top-4 h-7 w-1 -translate-x-1/2 rounded-full bg-black/18" />
        <span className="absolute left-0 top-5 h-1.5 w-12 rounded-full bg-black/20" />
        <span
          className={cn(
            "absolute left-1/2 top-5 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-md border border-white/40 text-[9px] font-black shadow-[0_0_10px_rgba(255,255,255,0.18)]",
            style.lock,
          )}
        >
          ★
        </span>
      </span>
      <span
        className={cn(
          "absolute -bottom-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide",
          style.text,
        )}
      >
        {CHEST_RARITY_LABEL[rarity]}
      </span>
    </span>
  );
}
