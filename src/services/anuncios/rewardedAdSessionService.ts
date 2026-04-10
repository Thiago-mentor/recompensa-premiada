"use client";

import { callFunction } from "@/services/callables/client";
import type { RewardedAdPlacementId } from "@/lib/constants/rewardedAds";
import { formatFirebaseError } from "@/lib/firebase/errors";

export type RewardedAdSessionStatusResult =
  | {
      ok: true;
      status: "pending" | "rewarded" | "invalid";
      placementId: string;
      expiresAtMs: number | null;
      errorReason: string | null;
      coins: number;
      boostCoins: number;
      pptPvPDuelsAdded: number;
      pptPvPDuelsRemaining: number;
      quizPvPDuelsAdded: number;
      quizPvPDuelsRemaining: number;
      reactionPvPDuelsAdded: number;
      reactionPvPDuelsRemaining: number;
    }
  | { ok: false; error: string };

export async function prepareRewardedAdSessionCallable(
  placementId: RewardedAdPlacementId,
): Promise<
  | {
      ok: true;
      sessionId: string;
      userId: string;
      customData: string;
      expiresAtMs: number;
    }
  | { ok: false; error: string }
> {
  try {
    const res = await callFunction<
      { placementId: string },
      {
        sessionId: string;
        userId: string;
        customData: string;
        expiresAtMs: number;
      }
    >("prepareRewardedAdSession", { placementId });
    return { ok: true, ...res.data };
  } catch (error) {
    return { ok: false, error: formatFirebaseError(error) };
  }
}

export async function getRewardedAdSessionStatusCallable(
  sessionId: string,
): Promise<RewardedAdSessionStatusResult> {
  try {
    const res = await callFunction<
      { sessionId: string },
      {
        status: "pending" | "rewarded" | "invalid";
        placementId: string;
        expiresAtMs: number | null;
        errorReason: string | null;
        coins: number;
        boostCoins: number;
        pptPvPDuelsAdded: number;
        pptPvPDuelsRemaining: number;
        quizPvPDuelsAdded: number;
        quizPvPDuelsRemaining: number;
        reactionPvPDuelsAdded: number;
        reactionPvPDuelsRemaining: number;
      }
    >("getRewardedAdSessionStatus", { sessionId });
    return { ok: true, ...res.data };
  } catch (error) {
    return { ok: false, error: formatFirebaseError(error) };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function waitForRewardedAdSessionResult(
  sessionId: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<RewardedAdSessionStatusResult> {
  const timeoutMs = Math.max(1000, options?.timeoutMs ?? 12000);
  const intervalMs = Math.max(500, options?.intervalMs ?? 1000);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = await getRewardedAdSessionStatusCallable(sessionId);
    if (!status.ok) return status;
    if (status.status === "rewarded" || status.status === "invalid") {
      return status;
    }
    await sleep(intervalMs);
  }

  return getRewardedAdSessionStatusCallable(sessionId);
}
