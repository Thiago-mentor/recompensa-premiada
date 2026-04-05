"use client";

import { rewardedAdMockEnabled } from "@/lib/firebase/config";
import { getFirebaseAuth } from "@/lib/firebase/client";
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
import { callFunction } from "@/services/callables/client";

const PLACEMENT_HOME = "home_rewarded";

export type RewardedAdResult =
  | { status: "granted"; coins: number }
  | { status: "skipped" }
  | { status: "failed"; reason: string };

/**
 * Simula conclusão de anúncio recompensado (dev / web).
 * Em produção mobile, trocar por SDK (AdMob etc.) e enviar token de conclusão à Function.
 */
export async function simulateRewardedAd(): Promise<RewardedAdResult> {
  if (!rewardedAdMockEnabled) {
    return { status: "failed", reason: "Mock desabilitado — integre o SDK." };
  }
  await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
  const roll = Math.random();
  if (roll < 0.08) return { status: "skipped" };
  if (roll < 0.12) return { status: "failed", reason: "sem inventário (simulado)" };
  return { status: "granted", coins: 0 };
}

/**
 * Envia evento à Cloud Function para validação server-side, limite diário e crédito.
 */
export type ProcessRewardedAdServerResult = {
  ok: boolean;
  coins?: number;
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
  mockCompletionToken?: string;
}): Promise<ProcessRewardedAdServerResult> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return { ok: false, error: "Faça login novamente." };

  try {
    const res = await callFunction<
      { placementId: string; mockCompletionToken?: string },
      {
        coins?: number;
        pptPvPDuelsAdded?: number;
        pptPvPDuelsRemaining?: number;
        quizPvPDuelsAdded?: number;
        quizPvPDuelsRemaining?: number;
        reactionPvPDuelsAdded?: number;
        reactionPvPDuelsRemaining?: number;
      }
    >("processRewardedAd", {
      placementId: input.placementId,
      mockCompletionToken: input.mockCompletionToken,
    });
    const d = res.data;
    return {
      ok: true,
      coins: d?.coins,
      pptPvPDuelsAdded: d?.pptPvPDuelsAdded,
      pptPvPDuelsRemaining: d?.pptPvPDuelsRemaining,
      quizPvPDuelsAdded: d?.quizPvPDuelsAdded,
      quizPvPDuelsRemaining: d?.quizPvPDuelsRemaining,
      reactionPvPDuelsAdded: d?.reactionPvPDuelsAdded,
      reactionPvPDuelsRemaining: d?.reactionPvPDuelsRemaining,
    };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro no servidor" };
  }
}

export async function runRewardedAdFlow(): Promise<{
  ok: boolean;
  coins?: number;
  message: string;
}> {
  const simulated = await simulateRewardedAd();
  if (simulated.status !== "granted") {
    return {
      ok: false,
      message:
        simulated.status === "skipped"
          ? "Anúncio não concluído."
          : simulated.reason || "Tente novamente.",
    };
  }
  const server = await processRewardedAdOnServer({
    placementId: PLACEMENT_HOME,
    mockCompletionToken: rewardedAdMockEnabled ? `mock_${Date.now()}` : undefined,
  });
  if (!server.ok) {
    return { ok: false, message: server.error || "Validação reprovada." };
  }
  return {
    ok: true,
    coins: server.coins,
    message: `+${server.coins ?? 0} PR creditados!`,
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
  const simulated = await simulateRewardedAd();
  if (simulated.status !== "granted") {
    return {
      ok: false,
      message:
        simulated.status === "skipped"
          ? "Anúncio não concluído."
          : simulated.reason || "Tente novamente.",
    };
  }
  const server = await processRewardedAdOnServer({
    placementId: PPT_PVP_DUELS_PLACEMENT_ID,
    mockCompletionToken: rewardedAdMockEnabled ? `mock_${Date.now()}` : undefined,
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
  const simulated = await simulateRewardedAd();
  if (simulated.status !== "granted") {
    return {
      ok: false,
      message:
        simulated.status === "skipped"
          ? "Anúncio não concluído."
          : simulated.reason || "Tente novamente.",
    };
  }
  const server = await processRewardedAdOnServer({
    placementId: QUIZ_PVP_DUELS_PLACEMENT_ID,
    mockCompletionToken: rewardedAdMockEnabled ? `mock_${Date.now()}` : undefined,
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
export async function runReactionDuelRewardedAdFlow(): Promise<{
  ok: boolean;
  reactionPvPDuelsRemaining?: number;
  message: string;
}> {
  const simulated = await simulateRewardedAd();
  if (simulated.status !== "granted") {
    return {
      ok: false,
      message:
        simulated.status === "skipped"
          ? "Anúncio não concluído."
          : simulated.reason || "Tente novamente.",
    };
  }
  const server = await processRewardedAdOnServer({
    placementId: REACTION_PVP_DUELS_PLACEMENT_ID,
    mockCompletionToken: rewardedAdMockEnabled ? `mock_${Date.now()}` : undefined,
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
