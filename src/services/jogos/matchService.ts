"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { callFunction } from "@/services/callables/client";
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
  rankingPoints?: number;
  normalizedScore?: number;
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
        rankingPoints?: number;
        normalizedScore?: number;
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
      rankingPoints: d.rankingPoints,
      normalizedScore: d.normalizedScore,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Partida não registrada",
    };
  }
}
