"use client";

import { doc, getDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import type { StreakRewardTier } from "@/types/systemConfig";
import { normalizeStreakTable } from "@/utils/streakReward";

export type EconomyStreakSlice = {
  dailyLoginBonus: number;
  streakTable: StreakRewardTier[];
  streakDisplayDays: number;
};

const DEFAULT_BONUS = 50;
export const DEFAULT_STREAK_DISPLAY_DAYS = 7;
export const MAX_STREAK_DISPLAY_DAYS = 30;

export function normalizeStreakDisplayDays(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_STREAK_DISPLAY_DAYS;
  return Math.min(MAX_STREAK_DISPLAY_DAYS, Math.max(1, parsed));
}

/** Valor inicial síncrono (evita modal preso até o `getDoc` da economia). */
export const DEFAULT_ECONOMY_STREAK_SLICE: EconomyStreakSlice = {
  dailyLoginBonus: DEFAULT_BONUS,
  streakTable: [],
  streakDisplayDays: DEFAULT_STREAK_DISPLAY_DAYS,
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
    streakDisplayDays: normalizeStreakDisplayDays(d.streakDisplayDays),
  };
}
