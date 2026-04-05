"use client";

import { doc, getDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import type { StreakRewardTier } from "@/types/systemConfig";
import { normalizeStreakTable } from "@/utils/streakReward";

export type EconomyStreakSlice = {
  dailyLoginBonus: number;
  streakTable: StreakRewardTier[];
};

const DEFAULT_BONUS = 50;

/** Valor inicial síncrono (evita modal preso até o `getDoc` da economia). */
export const DEFAULT_ECONOMY_STREAK_SLICE: EconomyStreakSlice = {
  dailyLoginBonus: DEFAULT_BONUS,
  streakTable: [],
};

export async function fetchEconomyStreakSlice(): Promise<EconomyStreakSlice> {
  const db = getFirebaseFirestore();
  const snap = await getDoc(doc(db, COLLECTIONS.systemConfigs, "economy"));
  const d = snap.data() || {};
  const dailyLoginBonus =
    typeof d.dailyLoginBonus === "number" && Number.isFinite(d.dailyLoginBonus)
      ? Math.max(0, Math.floor(d.dailyLoginBonus))
      : DEFAULT_BONUS;
  return {
    dailyLoginBonus,
    streakTable: normalizeStreakTable(d.streakTable),
  };
}
