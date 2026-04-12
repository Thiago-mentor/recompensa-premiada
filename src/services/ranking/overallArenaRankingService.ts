"use client";

import { callFunction } from "@/services/callables/client";
import type { ArenaOverallRankingResponse } from "@/types/ranking";

export async function fetchArenaOverallRanking(topN = 50): Promise<ArenaOverallRankingResponse> {
  const result = await callFunction<{ topN: number }, ArenaOverallRankingResponse>(
    "getArenaOverallRanking",
    { topN },
  );
  return result.data;
}
