"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/constants/collections";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { fetchEconomyConfigDocument } from "@/services/systemConfigs/economyDocumentCache";
import type { StreakRewardTier, SystemEconomyConfig } from "@/types/systemConfig";
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

function normalizeEconomyStreakSlice(raw: Partial<SystemEconomyConfig> | null): EconomyStreakSlice {
  const d = raw ?? {};
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

export async function fetchEconomyStreakSlice(): Promise<EconomyStreakSlice> {
  const raw = await fetchEconomyConfigDocument();
  return normalizeEconomyStreakSlice(raw);
}

/** Mantém o calendário do jogador alinhado ao documento salvo pelo admin. */
export function subscribeEconomyStreakSlice(
  onValue: (value: EconomyStreakSlice) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(getFirebaseFirestore(), COLLECTIONS.systemConfigs, "economy"),
    (snapshot) => {
      onValue(
        normalizeEconomyStreakSlice(
          snapshot.exists() ? (snapshot.data() as Partial<SystemEconomyConfig>) : null,
        ),
      );
    },
    (error) => onError(error),
  );
}
