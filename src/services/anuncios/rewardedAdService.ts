"use client";

import { admobAndroidSsvEnabled, isNativeAndroidPlatform } from "@/lib/anuncios/admobConfig";
import { rewardedAdMockEnabled } from "@/lib/firebase/config";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { ChestActionSnapshot } from "@/types/chest";
import {
  PPT_DUEL_CHARGES_PER_AD,
  PPT_PVP_DUELS_PLACEMENT_ID,
} from "@/lib/constants/pptPvp";
import {
  QUIZ_DUEL_CHARGES_PER_AD,
  QUIZ_PVP_DUELS_PLACEMENT_ID,
} from "@/lib/constants/quizPvp";
import {
  REACTION_DUEL_CHARGES_PER_AD,
  REACTION_PVP_DUELS_PLACEMENT_ID,
} from "@/lib/constants/reactionPvp";
import {
  CHEST_SPEEDUP_PLACEMENT_ID,
  HOME_REWARDED_PLACEMENT_ID,
  RAFFLE_NUMBER_PLACEMENT_ID,
  ROULETTE_DAILY_SPIN_PLACEMENT_ID,
  type RewardedAdPlacementId,
} from "@/lib/constants/rewardedAds";
import {
  prepareRewardedAdSessionCallable,
  waitForRewardedAdSessionResult,
} from "@/services/anuncios/rewardedAdSessionService";
import { showNativeRewardedAd } from "@/services/anuncios/nativeAdMobService";
import { callFunction } from "@/services/callables/client";
import { formatFirebaseError } from "@/lib/firebase/errors";

export type RewardedAdResult =
  | { status: "granted"; coins: number; completionToken?: string }
  | { status: "skipped" }
  | { status: "failed"; reason: string };

/**
 * Simula conclusão de anúncio recompensado (dev / web).
 */
export async function simulateRewardedAd(): Promise<RewardedAdResult> {
  if (!rewardedAdMockEnabled) {
    return { status: "failed", reason: "Mock desabilitado neste ambiente." };
  }
  await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
  const roll = Math.random();
  if (roll < 0.08) return { status: "skipped" };
  if (roll < 0.12) return { status: "failed", reason: "sem inventário (simulado)" };
  return { status: "granted", coins: 0 };
}

function createMockCompletionToken(): string {
  return `mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function displayFailureMessage(result: Exclude<RewardedAdResult, { status: "granted"; coins: number }>): string {
  return result.status === "skipped"
    ? "Anúncio não concluído."
    : result.reason || "Tente novamente.";
}

async function runRewardedAdDisplay(
  placementId: RewardedAdPlacementId,
): Promise<RewardedAdResult> {
  if (isNativeAndroidPlatform() && !rewardedAdMockEnabled) {
    const nativeResult = await showNativeRewardedAd(placementId);
    if (nativeResult.status === "granted") {
      return { status: "granted", coins: 0, completionToken: nativeResult.completionToken };
    }
    if (nativeResult.status === "skipped") {
      return nativeResult;
    }
    return { status: "failed", reason: nativeResult.reason };
  }
  return simulateRewardedAd();
}

async function runRewardedAdSsvFlow(
  placementId: RewardedAdPlacementId,
): Promise<
  | ({
      ok: true;
      pending?: boolean;
      coins: number;
      boostCoins: number;
      gems: number;
      rewardBalance: number;
      pptPvPDuelsAdded: number;
      pptPvPDuelsRemaining: number;
      quizPvPDuelsAdded: number;
      quizPvPDuelsRemaining: number;
      reactionPvPDuelsAdded: number;
      reactionPvPDuelsRemaining: number;
    } & { message: string })
  | { ok: false; message: string }
> {
  if (!isNativeAndroidPlatform() || rewardedAdMockEnabled || !admobAndroidSsvEnabled) {
    return { ok: false, message: "SSV não ativo neste ambiente." };
  }

  const prepared = await prepareRewardedAdSessionCallable(placementId);
  if (!prepared.ok) {
    return { ok: false, message: prepared.error };
  }

  const nativeResult = await showNativeRewardedAd(placementId, {
    ssvUserId: prepared.userId,
    ssvCustomData: prepared.customData,
  });
  if (nativeResult.status !== "granted") {
    return { ok: false, message: displayFailureMessage(nativeResult) };
  }

  const sessionStatus = await waitForRewardedAdSessionResult(prepared.sessionId, {
    timeoutMs: 12000,
    intervalMs: 1000,
  });
  if (!sessionStatus.ok) {
    return { ok: false, message: sessionStatus.error };
  }
  if (sessionStatus.status === "invalid") {
    return {
      ok: false,
      message: sessionStatus.errorReason || "A validação do anúncio foi rejeitada pelo servidor.",
    };
  }
  if (sessionStatus.status !== "rewarded") {
    return {
      ok: true,
      pending: true,
      coins: 0,
      boostCoins: 0,
      gems: 0,
      rewardBalance: 0,
      pptPvPDuelsAdded: 0,
      pptPvPDuelsRemaining: 0,
      quizPvPDuelsAdded: 0,
      quizPvPDuelsRemaining: 0,
      reactionPvPDuelsAdded: 0,
      reactionPvPDuelsRemaining: 0,
      message: "Anúncio concluído. Recompensa em validação pelo AdMob; ela deve cair em instantes.",
    };
  }

  return {
    ok: true,
    coins: sessionStatus.coins,
    boostCoins: sessionStatus.boostCoins,
    gems: sessionStatus.gems,
    rewardBalance: sessionStatus.rewardBalance,
    pptPvPDuelsAdded: sessionStatus.pptPvPDuelsAdded,
    pptPvPDuelsRemaining: sessionStatus.pptPvPDuelsRemaining,
    quizPvPDuelsAdded: sessionStatus.quizPvPDuelsAdded,
    quizPvPDuelsRemaining: sessionStatus.quizPvPDuelsRemaining,
    reactionPvPDuelsAdded: sessionStatus.reactionPvPDuelsAdded,
    reactionPvPDuelsRemaining: sessionStatus.reactionPvPDuelsRemaining,
    message: "Recompensa validada pelo AdMob.",
  };
}

function completionTokenForGrantedAd(result: Extract<RewardedAdResult, { status: "granted" }>): string | undefined {
  if (result.completionToken) return result.completionToken;
  return rewardedAdMockEnabled ? createMockCompletionToken() : undefined;
}

/**
 * Envia evento à Cloud Function para validação server-side, limite diário e crédito.
 */
export type ProcessRewardedAdServerResult = {
  ok: boolean;
  coins?: number;
  boostCoins?: number;
  gems?: number;
  rewardBalance?: number;
  pptPvPDuelsAdded?: number;
  pptPvPDuelsRemaining?: number;
  quizPvPDuelsAdded?: number;
  quizPvPDuelsRemaining?: number;
  reactionPvPDuelsAdded?: number;
  reactionPvPDuelsRemaining?: number;
  error?: string;
};

export async function processRewardedAdOnServer(input: {
  placementId: string;
  completionToken?: string;
}): Promise<ProcessRewardedAdServerResult> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return { ok: false, error: "Faça login novamente." };

  try {
    const res = await callFunction<
      { placementId: string; mockCompletionToken?: string },
      {
        coins?: number;
        boostCoins?: number;
        gems?: number;
        rewardBalance?: number;
        pptPvPDuelsAdded?: number;
        pptPvPDuelsRemaining?: number;
        quizPvPDuelsAdded?: number;
        quizPvPDuelsRemaining?: number;
        reactionPvPDuelsAdded?: number;
        reactionPvPDuelsRemaining?: number;
      }
    >("processRewardedAd", {
      placementId: input.placementId,
      mockCompletionToken: input.completionToken,
    });
    const d = res.data;
    return {
      ok: true,
      coins: d?.coins,
      boostCoins: d?.boostCoins,
      gems: d?.gems,
      rewardBalance: d?.rewardBalance,
      pptPvPDuelsAdded: d?.pptPvPDuelsAdded,
      pptPvPDuelsRemaining: d?.pptPvPDuelsRemaining,
      quizPvPDuelsAdded: d?.quizPvPDuelsAdded,
      quizPvPDuelsRemaining: d?.quizPvPDuelsRemaining,
      reactionPvPDuelsAdded: d?.reactionPvPDuelsAdded,
      reactionPvPDuelsRemaining: d?.reactionPvPDuelsRemaining,
    };
  } catch (e: unknown) {
    return { ok: false, error: formatFirebaseError(e) };
  }
}

function formatRewardedAdCreditMessage(input: {
  coins?: number;
  boostCoins?: number;
  gems?: number;
  rewardBalance?: number;
}): string {
  const parts: string[] = [];
  const c = input.coins ?? 0;
  const b = input.boostCoins ?? 0;
  const g = input.gems ?? 0;
  const saldo = input.rewardBalance ?? 0;
  if (c > 0 && b > 0) parts.push(`+${c} PR (inclui boost +${b} PR)`);
  else if (c > 0) parts.push(`+${c} PR`);
  else if (b > 0) parts.push(`Boost +${b} PR`);
  if (g > 0) parts.push(`+${g} TICKET`);
  if (saldo > 0) parts.push(`+${saldo} Saldo`);
  return parts.length > 0 ? `${parts.join(" · ")} creditados!` : "Recompensa registrada.";
}

export async function runRewardedAdFlow(): Promise<{
  ok: boolean;
  coins?: number;
  boostCoins?: number;
  message: string;
}> {
  if (isNativeAndroidPlatform() && admobAndroidSsvEnabled && !rewardedAdMockEnabled) {
    const ssvResult = await runRewardedAdSsvFlow(HOME_REWARDED_PLACEMENT_ID);
    if (!ssvResult.ok) {
      return { ok: false, message: ssvResult.message };
    }
    if (ssvResult.pending) {
      return { ok: true, message: ssvResult.message };
    }
    return {
      ok: true,
      coins: ssvResult.coins,
      boostCoins: ssvResult.boostCoins,
      message: formatRewardedAdCreditMessage({
        coins: ssvResult.coins,
        boostCoins: ssvResult.boostCoins,
        gems: ssvResult.gems,
        rewardBalance: ssvResult.rewardBalance,
      }),
    };
  }

  const adResult = await runRewardedAdDisplay(HOME_REWARDED_PLACEMENT_ID);
  if (adResult.status !== "granted") {
    return {
      ok: false,
      message: displayFailureMessage(adResult),
    };
  }
  const completionToken = completionTokenForGrantedAd(adResult);
  const server = await processRewardedAdOnServer({
    placementId: HOME_REWARDED_PLACEMENT_ID,
    completionToken,
  });
  if (!server.ok) {
    return { ok: false, message: server.error || "Validação reprovada." };
  }
  return {
    ok: true,
    coins: server.coins,
    boostCoins: server.boostCoins,
    message: formatRewardedAdCreditMessage({
      coins: server.coins,
      boostCoins: server.boostCoins,
      gems: server.gems,
      rewardBalance: server.rewardBalance,
    }),
  };
}

/**
 * Anúncio recompensado: +3 duelos PPT (validado no servidor; placement fixo).
 */
export async function runPptDuelRewardedAdFlow(): Promise<{
  ok: boolean;
  pptPvPDuelsRemaining?: number;
  message: string;
}> {
  if (isNativeAndroidPlatform() && admobAndroidSsvEnabled && !rewardedAdMockEnabled) {
    const ssvResult = await runRewardedAdSsvFlow(PPT_PVP_DUELS_PLACEMENT_ID);
    if (!ssvResult.ok) {
      return { ok: false, message: ssvResult.message };
    }
    if (ssvResult.pending) {
      return { ok: true, message: ssvResult.message };
    }
    const total = ssvResult.pptPvPDuelsRemaining;
    return {
      ok: true,
      pptPvPDuelsRemaining: total,
      message:
        total > 0
          ? `+${ssvResult.pptPvPDuelsAdded || PPT_DUEL_CHARGES_PER_AD} duelos · total ${total}`
          : `+${ssvResult.pptPvPDuelsAdded || PPT_DUEL_CHARGES_PER_AD} duelos liberados`,
    };
  }

  const adResult = await runRewardedAdDisplay(PPT_PVP_DUELS_PLACEMENT_ID);
  if (adResult.status !== "granted") {
    return {
      ok: false,
      message: displayFailureMessage(adResult),
    };
  }
  const completionToken = completionTokenForGrantedAd(adResult);
  const server = await processRewardedAdOnServer({
    placementId: PPT_PVP_DUELS_PLACEMENT_ID,
    completionToken,
  });
  if (!server.ok) {
    return { ok: false, message: server.error || "Validação reprovada." };
  }
  const total = server.pptPvPDuelsRemaining;
  return {
    ok: true,
    pptPvPDuelsRemaining: total,
    message:
      total != null
        ? `+${server.pptPvPDuelsAdded ?? PPT_DUEL_CHARGES_PER_AD} duelos · total ${total}`
        : `+${server.pptPvPDuelsAdded ?? PPT_DUEL_CHARGES_PER_AD} duelos liberados`,
  };
}

/**
 * Anúncio recompensado: +3 duelos Quiz (validado no servidor; placement fixo).
 */
export async function runQuizDuelRewardedAdFlow(): Promise<{
  ok: boolean;
  quizPvPDuelsRemaining?: number;
  message: string;
}> {
  if (isNativeAndroidPlatform() && admobAndroidSsvEnabled && !rewardedAdMockEnabled) {
    const ssvResult = await runRewardedAdSsvFlow(QUIZ_PVP_DUELS_PLACEMENT_ID);
    if (!ssvResult.ok) {
      return { ok: false, message: ssvResult.message };
    }
    if (ssvResult.pending) {
      return { ok: true, message: ssvResult.message };
    }
    const total = ssvResult.quizPvPDuelsRemaining;
    return {
      ok: true,
      quizPvPDuelsRemaining: total,
      message:
        total > 0
          ? `+${ssvResult.quizPvPDuelsAdded || QUIZ_DUEL_CHARGES_PER_AD} duelos · total ${total}`
          : `+${ssvResult.quizPvPDuelsAdded || QUIZ_DUEL_CHARGES_PER_AD} duelos liberados`,
    };
  }

  const adResult = await runRewardedAdDisplay(QUIZ_PVP_DUELS_PLACEMENT_ID);
  if (adResult.status !== "granted") {
    return {
      ok: false,
      message: displayFailureMessage(adResult),
    };
  }
  const completionToken = completionTokenForGrantedAd(adResult);
  const server = await processRewardedAdOnServer({
    placementId: QUIZ_PVP_DUELS_PLACEMENT_ID,
    completionToken,
  });
  if (!server.ok) {
    return { ok: false, message: server.error || "Validação reprovada." };
  }
  const total = server.quizPvPDuelsRemaining;
  return {
    ok: true,
    quizPvPDuelsRemaining: total,
    message:
      total != null
        ? `+${server.quizPvPDuelsAdded ?? QUIZ_DUEL_CHARGES_PER_AD} duelos · total ${total}`
        : `+${server.quizPvPDuelsAdded ?? QUIZ_DUEL_CHARGES_PER_AD} duelos liberados`,
  };
}

/**
 * Anúncio recompensado: +3 duelos Reaction Tap (validado no servidor; placement fixo).
 */
/**
 * Anúncio do sorteio: valida no servidor (sem crédito de PR/duelos) para liberar 1 número quando o sorteio está em modo anúncio.
 */
export async function runRaffleNumberRewardedAdFlow(raffleId: string): Promise<{
  ok: boolean;
  sessionId?: string;
  completionToken?: string;
  message: string;
}> {
  const rid = raffleId.trim();
  if (!rid) {
    return { ok: false, message: "Sorteio inválido." };
  }
  if (isNativeAndroidPlatform() && admobAndroidSsvEnabled && !rewardedAdMockEnabled) {
    const prepared = await prepareRewardedAdSessionCallable(RAFFLE_NUMBER_PLACEMENT_ID, {
      raffleId: rid,
    });
    if (!prepared.ok) {
      return { ok: false, message: prepared.error };
    }
    const nativeResult = await showNativeRewardedAd(RAFFLE_NUMBER_PLACEMENT_ID, {
      ssvUserId: prepared.userId,
      ssvCustomData: prepared.customData,
    });
    if (nativeResult.status !== "granted") {
      return { ok: false, message: displayFailureMessage(nativeResult) };
    }
    const sessionStatus = await waitForRewardedAdSessionResult(prepared.sessionId, {
      timeoutMs: 12_000,
      intervalMs: 1000,
    });
    if (!sessionStatus.ok) {
      return { ok: false, message: sessionStatus.error };
    }
    if (sessionStatus.status === "invalid") {
      return {
        ok: false,
        message: sessionStatus.errorReason || "A validação do anúncio foi rejeitada pelo servidor.",
      };
    }
    if (sessionStatus.status !== "rewarded") {
      return {
        ok: true,
        message:
          "Anúncio concluído. Aguarde a validação do AdMob e tente obter o número em alguns segundos.",
      };
    }
    return {
      ok: true,
      sessionId: prepared.sessionId,
      message: "Anúncio validado. Você já pode resgatar seu número.",
    };
  }

  const adResult = await runRewardedAdDisplay(RAFFLE_NUMBER_PLACEMENT_ID);
  if (adResult.status !== "granted") {
    return {
      ok: false,
      message: displayFailureMessage(adResult),
    };
  }
  const completionToken = completionTokenForGrantedAd(adResult);
  const server = await processRewardedAdOnServer({
    placementId: RAFFLE_NUMBER_PLACEMENT_ID,
    completionToken,
  });
  if (!server.ok) {
    return { ok: false, message: server.error || "Validação reprovada." };
  }
  return {
    ok: true,
    completionToken,
    message: "Anúncio validado. Resgatando seu número…",
  };
}

export async function runReactionDuelRewardedAdFlow(): Promise<{
  ok: boolean;
  reactionPvPDuelsRemaining?: number;
  message: string;
}> {
  if (isNativeAndroidPlatform() && admobAndroidSsvEnabled && !rewardedAdMockEnabled) {
    const ssvResult = await runRewardedAdSsvFlow(REACTION_PVP_DUELS_PLACEMENT_ID);
    if (!ssvResult.ok) {
      return { ok: false, message: ssvResult.message };
    }
    if (ssvResult.pending) {
      return { ok: true, message: ssvResult.message };
    }
    const total = ssvResult.reactionPvPDuelsRemaining;
    return {
      ok: true,
      reactionPvPDuelsRemaining: total,
      message:
        total > 0
          ? `+${ssvResult.reactionPvPDuelsAdded || REACTION_DUEL_CHARGES_PER_AD} duelos · total ${total}`
          : `+${ssvResult.reactionPvPDuelsAdded || REACTION_DUEL_CHARGES_PER_AD} duelos liberados`,
    };
  }

  const adResult = await runRewardedAdDisplay(REACTION_PVP_DUELS_PLACEMENT_ID);
  if (adResult.status !== "granted") {
    return {
      ok: false,
      message: displayFailureMessage(adResult),
    };
  }
  const completionToken = completionTokenForGrantedAd(adResult);
  const server = await processRewardedAdOnServer({
    placementId: REACTION_PVP_DUELS_PLACEMENT_ID,
    completionToken,
  });
  if (!server.ok) {
    return { ok: false, message: server.error || "Validação reprovada." };
  }
  const total = server.reactionPvPDuelsRemaining;
  return {
    ok: true,
    reactionPvPDuelsRemaining: total,
    message:
      total != null
        ? `+${server.reactionPvPDuelsAdded ?? REACTION_DUEL_CHARGES_PER_AD} duelos · total ${total}`
        : `+${server.reactionPvPDuelsAdded ?? REACTION_DUEL_CHARGES_PER_AD} duelos liberados`,
  };
}

export type RouletteAdDisplayResult =
  | { status: "granted"; completionToken?: string; message: string }
  | { status: "failed"; message: string };

export async function processRouletteDailyAdDisplay(): Promise<RouletteAdDisplayResult> {
  const adResult = await runRewardedAdDisplay(ROULETTE_DAILY_SPIN_PLACEMENT_ID);
  if (adResult.status !== "granted") {
    return { status: "failed", message: displayFailureMessage(adResult) };
  }
  return {
    status: "granted",
    completionToken: completionTokenForGrantedAd(adResult),
    message: "Anúncio concluído. Girando roleta...",
  };
}

export async function runChestSpeedupRewardedAdFlow(chestId: string): Promise<
  | ({ ok: true } & ChestActionSnapshot & { reducedMs: number; dailyAdsUsed: number; message: string })
  | { ok: false; message: string }
> {
  const adResult = await runRewardedAdDisplay(CHEST_SPEEDUP_PLACEMENT_ID);
  if (adResult.status !== "granted") {
    return {
      ok: false,
      message: displayFailureMessage(adResult),
    };
  }
  const completionToken = completionTokenForGrantedAd(adResult);

  try {
    const res = await callFunction<
      { chestId: string; mockCompletionToken?: string },
      ChestActionSnapshot & { reducedMs: number; dailyAdsUsed: number }
    >("speedUpChestUnlock", {
      chestId,
      mockCompletionToken: completionToken,
    });
    const d = res.data;
    return {
      ok: true,
      ...d,
      message:
        d.status === "ready"
          ? "Baú pronto para coletar."
          : `Tempo reduzido em ${Math.max(1, Math.ceil(d.reducedMs / 60000))} min.`,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      message: formatFirebaseError(e),
    };
  }
}
