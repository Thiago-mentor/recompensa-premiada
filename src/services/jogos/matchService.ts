"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { callFunction } from "@/services/callables/client";
import type { GrantedChestSummary } from "@/types/chest";
import type { GameId } from "@/types/game";

export type FinalizeMatchInput = {
  gameId: GameId;
  resultado: "vitoria" | "derrota" | "empate";
  score: number;
  detalhes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  opponentId?: string | null;
  startedAt?: string | null;
};

export type FinalizeMatchResult = {
  ok: boolean;
  matchId?: string;
  rewardCoins?: number;
  boostCoins?: number;
  rankingPoints?: number;
  normalizedScore?: number;
  grantedChest?: GrantedChestSummary | null;
  error?: string;
};

export async function finalizeMatchOnServer(input: FinalizeMatchInput): Promise<FinalizeMatchResult> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return { ok: false, error: "Faça login novamente." };

  const metadata = { ...(input.detalhes ?? {}), ...(input.metadata ?? {}) };

  try {
    const res = await callFunction<
      Record<string, unknown>,
      {
        matchId?: string;
        rewardCoins?: number;
        boostCoins?: number;
        rankingPoints?: number;
        normalizedScore?: number;
        grantedChest?: GrantedChestSummary | null;
      }
    >("finalizeMatch", {
      gameId: input.gameId,
      resultado: input.resultado,
      score: input.score,
      metadata,
      opponentId: input.opponentId ?? undefined,
      startedAt: input.startedAt ?? undefined,
    });
    const d = res.data;
    return {
      ok: true,
      matchId: d.matchId,
      rewardCoins: d.rewardCoins,
      boostCoins: d.boostCoins,
      rankingPoints: d.rankingPoints,
      normalizedScore: d.normalizedScore,
      grantedChest: d.grantedChest ?? null,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: formatFirebaseError(e),
    };
  }
}
