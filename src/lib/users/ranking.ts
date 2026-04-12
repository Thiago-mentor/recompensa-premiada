"use client";

import { getDailyPeriodKey, getMonthlyPeriodKey, getWeeklyPeriodKey } from "@/utils/date";

type UserRankingPeriodInput = {
  scoreRankingDiario?: number | null;
  scoreRankingSemanal?: number | null;
  scoreRankingMensal?: number | null;
  scoreRankingDiarioKey?: string | null;
  scoreRankingSemanalKey?: string | null;
  scoreRankingMensalKey?: string | null;
} | null | undefined;

function resolveUserRankingScore(
  storedKey: string | null | undefined,
  currentKey: string,
  rawScore: number | null | undefined,
): number {
  if (String(storedKey || "") !== currentKey) return 0;
  return Math.max(0, Math.floor(Number(rawScore) || 0));
}

export function resolveUserRankingDailyScore(profile: UserRankingPeriodInput): number {
  return resolveUserRankingScore(
    profile?.scoreRankingDiarioKey,
    getDailyPeriodKey(),
    profile?.scoreRankingDiario,
  );
}

export function resolveUserRankingWeeklyScore(profile: UserRankingPeriodInput): number {
  return resolveUserRankingScore(
    profile?.scoreRankingSemanalKey,
    getWeeklyPeriodKey(),
    profile?.scoreRankingSemanal,
  );
}

export function resolveUserRankingMonthlyScore(profile: UserRankingPeriodInput): number {
  return resolveUserRankingScore(
    profile?.scoreRankingMensalKey,
    getMonthlyPeriodKey(),
    profile?.scoreRankingMensal,
  );
}
