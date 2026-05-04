"use client";

import { fetchEconomyConfigDocument } from "@/services/systemConfigs/economyDocumentCache";
import {
  buildDefaultRankingPrizeConfig,
  normalizeRankingPrizeConfig,
  type NormalizedRankingPrizeConfig,
} from "@/lib/ranking/prizes";

export async function fetchRankingPrizeConfig(): Promise<NormalizedRankingPrizeConfig> {
  const snap = await fetchEconomyConfigDocument();
  if (!snap) return buildDefaultRankingPrizeConfig();
  return normalizeRankingPrizeConfig(snap.rankingPrizes);
}
