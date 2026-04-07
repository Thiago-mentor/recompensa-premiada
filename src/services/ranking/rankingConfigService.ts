"use client";

import { doc, getDoc } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/constants/collections";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import {
  buildDefaultRankingPrizeConfig,
  normalizeRankingPrizeConfig,
  type NormalizedRankingPrizeConfig,
} from "@/lib/ranking/prizes";

const ECONOMY_ID = "economy";

export async function fetchRankingPrizeConfig(): Promise<NormalizedRankingPrizeConfig> {
  const db = getFirebaseFirestore();
  const snap = await getDoc(doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID));
  if (!snap.exists()) return buildDefaultRankingPrizeConfig();
  return normalizeRankingPrizeConfig(snap.data()?.rankingPrizes);
}
