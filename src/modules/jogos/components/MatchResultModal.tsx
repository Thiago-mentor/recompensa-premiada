"use client";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { ChestGrantNotice } from "@/components/chests/ChestGrantNotice";
import type { GrantedChestSummary } from "@/types/chest";
import { Trophy, Skull, Equal, X } from "lucide-react";

export type MatchResultKind = "vitoria" | "derrota" | "empate";

export function MatchResultModal({
  open,
  onClose,
  result,
  title,
  subtitle,
  rewardCoins,
  rankingPoints,
  grantedChest,
  error,
}: {
  open: boolean;
  onClose: () => void;
  result: MatchResultKind | null;
  title: string;
  subtitle?: string;
  rewardCoins?: number;
  rankingPoints?: number;
  grantedChest?: GrantedChestSummary | null;
  error?: string | null;
}) {
  if (!open) return null;

  const Icon =
    result === "vitoria" ? Trophy : result === "empate" ? Equal : Skull;
  const tone =
    result === "vitoria"
      ? "border-emerald-500/40 bg-emerald-950/90"
      : result === "empate"
        ? "border-amber-500/40 bg-amber-950/80"
        : "border-rose-500/40 bg-rose-950/80";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full max-w-md rounded-2xl border p-6 shadow-2xl",
          error ? "border-red-500/40 bg-slate-900/95" : tone,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
        {error ? (
          <p className="pr-8 text-sm text-red-200">{error}</p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-xl bg-white/10 p-2">
                <Icon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{title}</h2>
                {subtitle ? (
                  <p className="text-sm text-white/65">{subtitle}</p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-black/20 px-3 py-2 text-white/80">
                Coins
                <div className="text-lg font-semibold text-amber-200">
                  +{rewardCoins ?? 0}
                </div>
              </div>
              <div className="rounded-xl bg-black/20 px-3 py-2 text-white/80">
                Ranking
                <div className="text-lg font-semibold text-violet-200">
                  +{rankingPoints ?? 0} pts
                </div>
              </div>
            </div>
            {grantedChest ? (
              <ChestGrantNotice
                grantedChest={grantedChest}
                label="Baú liberado nesta partida"
                className="mt-4"
              />
            ) : null}
          </>
        )}
        <Button className="mt-6 w-full" variant="secondary" onClick={onClose}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
