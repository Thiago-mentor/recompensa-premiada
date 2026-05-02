"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { ROULETTE_DAILY_SPIN_PLACEMENT_ID } from "@/lib/constants/rewardedAds";
import { callFunction } from "@/services/callables/client";
import { formatFirebaseError } from "@/lib/firebase/errors";
import {
  processRouletteDailyAdDisplay,
  type RouletteAdDisplayResult,
} from "@/services/anuncios/rewardedAdService";
import type { GrantedChestSummary } from "@/types/chest";

export type RouletteSpinMode = "daily_ad" | "paid";

export type RouletteSpinResult = {
  ok: boolean;
  matchId?: string;
  rewardCoins?: number;
  rankingPoints?: number;
  normalizedScore?: number;
  spinMode?: RouletteSpinMode;
  roulettePrizeKind?: "coins" | "gems" | "rewardBalance" | "chest";
  chestRarity?: string | null;
  grantedChest?: GrantedChestSummary | null;
  chestNotGranted?: boolean;
  rewardGems?: number;
  rewardCash?: number;
  rouletteRewardAmount?: number;
  error?: string;
};

type ProcessRouletteSpinResponse = {
  ok: boolean;
  matchId: string;
  rewardCoins: number;
  rewardGems: number;
  rewardCash: number;
  rouletteRewardAmount: number;
  rankingPoints: number;
  normalizedScore: number;
  spinMode: RouletteSpinMode;
  roulettePrizeKind?: "coins" | "gems" | "rewardBalance" | "chest";
  chestRarity?: string | null;
  grantedChest?: GrantedChestSummary | null;
  chestNotGranted?: boolean;
};

async function processRouletteSpinOnServer(input: {
  mode: RouletteSpinMode;
  completionToken?: string;
}): Promise<RouletteSpinResult> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return { ok: false, error: "Faça login novamente." };

  try {
    const res = await callFunction<
      { mode: RouletteSpinMode; mockCompletionToken?: string; placementId?: string },
      ProcessRouletteSpinResponse
    >("processRouletteSpin", {
      mode: input.mode,
      mockCompletionToken: input.completionToken,
      placementId: ROULETTE_DAILY_SPIN_PLACEMENT_ID,
    });
    const d = res.data;
    return {
      ok: true,
      matchId: d.matchId,
      rewardCoins: d.rewardCoins,
      rankingPoints: d.rankingPoints,
      normalizedScore: d.normalizedScore,
      spinMode: d.spinMode,
      roulettePrizeKind: d.roulettePrizeKind,
      chestRarity: d.chestRarity ?? null,
      grantedChest: d.grantedChest ?? null,
      chestNotGranted: d.chestNotGranted,
      rewardGems: d.rewardGems,
      rewardCash: d.rewardCash,
      rouletteRewardAmount: d.rouletteRewardAmount,
    };
  } catch (error) {
    return { ok: false, error: formatFirebaseError(error) };
  }
}

export async function runRouletteDailyAdSpin(): Promise<RouletteSpinResult> {
  const ad: RouletteAdDisplayResult = await processRouletteDailyAdDisplay();
  if (ad.status !== "granted") {
    return { ok: false, error: ad.message };
  }
  return processRouletteSpinOnServer({
    mode: "daily_ad",
    completionToken: ad.completionToken,
  });
}

export async function runRoulettePaidSpin(): Promise<RouletteSpinResult> {
  return processRouletteSpinOnServer({ mode: "paid" });
}
