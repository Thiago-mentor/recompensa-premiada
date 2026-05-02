"use client";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { ChestGrantNotice } from "@/components/chests/ChestGrantNotice";
import type { GrantedChestSummary } from "@/types/chest";
import { Trophy, Skull, Equal, X } from "lucide-react";

export type MatchResultKind = "vitoria" | "derrota" | "empate";

/** Substitui o par “Coins · +PR” quando o crédito é outra moeda (ex.: TICKET ou CASH na roleta). */
export type MatchModalPrimaryRewardSummary = {
  label: string;
  amount: number;
};

export function MatchResultModal({
  open,
  onClose,
  result,
  title,
  subtitle,
  rewardCoins,
  boostCoins,
  rankingPoints,
  grantedChest,
  hideRankingSummary,
  rewardSummaryPrimary,
  hidePrimaryRewardCard,
  presentation,
  error,
}: {
  open: boolean;
  onClose: () => void;
  result: MatchResultKind | null;
  title: string;
  subtitle?: string;
  rewardCoins?: number;
  boostCoins?: number;
  rankingPoints?: number;
  grantedChest?: GrantedChestSummary | null;
  /** Quando verdadeiro, não exibe o bloco “Ranking · +X pts”. Ex.: resultado do giro da roleta. */
  hideRankingSummary?: boolean;
  rewardSummaryPrimary?: MatchModalPrimaryRewardSummary;
  /** Esconde o card de valor (ex.: só baú ou só mensagem textual). */
  hidePrimaryRewardCard?: boolean;
  /** `roleta`: fundo e destaques alinhados à tela do giro (roxo/fúcsia/âmbar). Demais jogos: verde vitória legado. */
  presentation?: "default" | "roleta";
  error?: string | null;
}) {
  if (!open) return null;

  const showRanking = !hideRankingSummary;
  const primaryVisible = !hidePrimaryRewardCard;
  const primaryLabel = rewardSummaryPrimary?.label ?? "Coins";
  const primaryAmount = rewardSummaryPrimary ? rewardSummaryPrimary.amount : rewardCoins ?? 0;
  const isRouletteLook = presentation === "roleta";
  const primaryValueClass = isRouletteLook
    ? rewardSummaryPrimary?.label === "TICKET"
      ? "text-fuchsia-200"
      : rewardSummaryPrimary?.label === "CASH"
        ? "text-amber-200"
        : "text-orange-300"
    : rewardSummaryPrimary?.label === "TICKET"
      ? "text-sky-200"
      : rewardSummaryPrimary?.label === "CASH"
        ? "text-emerald-200"
        : "text-amber-200";
  const showRewardsGrid = primaryVisible || showRanking;
  const rewardsGridCols =
    primaryVisible && showRanking ? "grid-cols-2" : "grid-cols-1";

  const Icon =
    result === "vitoria" ? Trophy : result === "empate" ? Equal : Skull;
  const victorySurfaceDefault = "border-emerald-500/40 bg-emerald-950/90";
  const victorySurfaceRoulette = [
    "border-fuchsia-400/35 border-orange-400/30",
    "bg-[radial-gradient(circle_at_42%_-8%,rgba(217,70,239,0.28),transparent_52%),radial-gradient(circle_at_78%_108%,rgba(251,146,60,0.14),transparent_42%),linear-gradient(168deg,#1a0730_0%,#09051c_42%,#12081f_100%)]",
    "shadow-[0_0_46px_-12px_rgba(217,70,239,0.52),inset_0_1px_0_rgba(253,230,138,0.1)]",
  ].join(" ");
  const tone =
    result === "vitoria"
      ? isRouletteLook
        ? victorySurfaceRoulette
        : victorySurfaceDefault
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
              <div
                className={cn(
                  "rounded-xl p-2",
                  isRouletteLook
                    ? "bg-violet-600/22 ring-1 ring-orange-400/35"
                    : "bg-white/10",
                )}
              >
                <Icon className={cn("h-8 w-8", isRouletteLook ? "text-amber-200" : "text-white")} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{title}</h2>
                {subtitle ? (
                  <p
                    className={cn(
                      "text-sm",
                      isRouletteLook ? "text-violet-100/76" : "text-white/65",
                    )}
                  >
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>
            {showRewardsGrid ? (
              <div className={cn("mt-4 grid gap-2 text-sm", rewardsGridCols)}>
                {primaryVisible ? (
                  <div
                    className={cn(
                      "rounded-xl px-3 py-2 text-white/80",
                      isRouletteLook
                        ? "bg-black/35 ring-1 ring-fuchsia-500/22"
                        : "bg-black/20",
                    )}
                  >
                    {primaryLabel}
                    <div className={cn("text-lg font-semibold tabular-nums", primaryValueClass)}>
                      +{primaryAmount}
                    </div>
                    {!rewardSummaryPrimary && boostCoins != null && boostCoins > 0 ? (
                      <p className="mt-1 text-[11px] font-semibold text-amber-100/85">
                        boost +{boostCoins} PR
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {showRanking ? (
                  <div className="rounded-xl bg-black/20 px-3 py-2 text-white/80">
                    Ranking
                    <div className="text-lg font-semibold text-violet-200 tabular-nums">
                      +{rankingPoints ?? 0} pts
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
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
