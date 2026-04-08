"use client";

import { Gift, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { GrantedChestSummary } from "@/types/chest";
import {
  CHEST_RARITY_LABEL,
  CHEST_SOURCE_LABEL,
  formatChestPlacement,
} from "@/utils/chest";

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
    <div
      className={cn(
        "rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3 text-sm shadow-[0_0_28px_-12px_rgba(251,191,36,0.45)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-400/10 text-amber-100">
          <Gift className="h-4 w-4" />
        </span>
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
    </div>
  );
}
