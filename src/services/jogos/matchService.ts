"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { shouldUseSparkFallback } from "@/lib/firebase/sparkMode";
import { callFunction } from "@/services/callables/client";
import { sparkFinalizeMatch } from "@/services/spark/matches";
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

  if (shouldUseSparkFallback()) {
    const r = await sparkFinalizeMatch({
      uid,
      gameId: input.gameId,
      resultado: input.resultado,
      score: input.score,
      metadata,
      opponentId: input.opponentId,
      startedAt: input.startedAt,
    });
    return r.ok
      ? {
          ok: true,
          rewardCoins: r.rewardCoins,
          rankingPoints: r.rankingPoints,
        }
      : { ok: false, error: r.error };
  }

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
