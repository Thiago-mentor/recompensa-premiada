"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { ROULETTE_DAILY_SPIN_PLACEMENT_ID } from "@/lib/constants/rewardedAds";
import { callFunction } from "@/services/callables/client";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { admobAndroidSsvEnabled, isNativeAndroidPlatform } from "@/lib/anuncios/admobConfig";
import { rewardedAdMockEnabled } from "@/lib/firebase/config";
import { prepareRewardedAdSessionCallable, waitForRewardedAdSessionResult } from "@/services/anuncios/rewardedAdSessionService";
import { showNativeRewardedAd } from "@/services/anuncios/nativeAdMobService";
import {
  processRouletteDailyAdDisplay,
  type RewardedAdFlowOptions,
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
  rewardSaldo?: number;
  rouletteRewardAmount?: number;
  error?: string;
};

type ProcessRouletteSpinResponse = {
  ok: boolean;
  matchId: string;
  rewardCoins: number;
  rewardGems: number;
  rewardSaldo: number;
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
  rewardedAdSessionId?: string;
}): Promise<RouletteSpinResult> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return { ok: false, error: "Faça login novamente." };

  try {
    const res = await callFunction<
      { mode: RouletteSpinMode; mockCompletionToken?: string; rewardedAdSessionId?: string; placementId?: string },
      ProcessRouletteSpinResponse
    >("processRouletteSpin", {
      mode: input.mode,
      mockCompletionToken: input.completionToken,
      rewardedAdSessionId: input.rewardedAdSessionId,
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
      rewardSaldo: d.rewardSaldo,
      rouletteRewardAmount: d.rouletteRewardAmount,
    };
  } catch (error) {
    return { ok: false, error: formatFirebaseError(error) };
  }
}

export async function runRouletteDailyAdSpin(
  options?: RewardedAdFlowOptions,
): Promise<RouletteSpinResult> {
  if (isNativeAndroidPlatform() && admobAndroidSsvEnabled && !rewardedAdMockEnabled) {
    const prepared = await prepareRewardedAdSessionCallable(ROULETTE_DAILY_SPIN_PLACEMENT_ID);
    if (!prepared.ok) return { ok: false, error: prepared.error };
    const nativeResult = await showNativeRewardedAd(ROULETTE_DAILY_SPIN_PLACEMENT_ID, {
      ssvUserId: prepared.userId,
      ssvCustomData: prepared.customData,
    });
    if (nativeResult.status !== "granted") {
      return { ok: false, error: nativeResult.status === "skipped" ? "Anúncio não concluído." : nativeResult.reason };
    }
    const session = await waitForRewardedAdSessionResult(prepared.sessionId, { timeoutMs: 15000, intervalMs: 1000 });
    if (!session.ok) return { ok: false, error: session.error };
    if (session.status !== "rewarded") {
      return { ok: false, error: session.status === "invalid" ? (session.errorReason || "Anúncio rejeitado pelo AdMob.") : "Anúncio concluído. A confirmação do AdMob ainda está pendente." };
    }
    return processRouletteSpinOnServer({ mode: "daily_ad", rewardedAdSessionId: prepared.sessionId });
  }
  const ad: RouletteAdDisplayResult = await processRouletteDailyAdDisplay(options);
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
