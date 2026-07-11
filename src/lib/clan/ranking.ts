import type { Clan } from "@/types/clan";
import { formatClanTime } from "@/lib/clan/ui";

export type ClanRankingMode = "total" | "daily" | "weekly" | "monthly";

export type RankedClanEntry = Clan & {
  position: number;
  totalScore: number;
  totalWins: number;
  totalAds: number;
  dailyScore: number;
  dailyWins: number;
  dailyAds: number;
  weeklyScore: number;
  weeklyWins: number;
  weeklyAds: number;
  monthlyScore: number;
  monthlyWins: number;
  monthlyAds: number;
};

type RankedClanComparable = Omit<RankedClanEntry, "position">;

export function compareClanTotalEntry(a: RankedClanComparable, b: RankedClanComparable): number {
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
  if (b.totalAds !== a.totalAds) return b.totalAds - a.totalAds;
  if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
  const activityDiff = clanActivityMs(b) - clanActivityMs(a);
  if (activityDiff !== 0) return activityDiff;
  return a.name.localeCompare(b.name, "pt-BR");
}

export function compareClanWeeklyEntry(a: RankedClanComparable, b: RankedClanComparable): number {
  if (b.weeklyScore !== a.weeklyScore) return b.weeklyScore - a.weeklyScore;
  if (b.weeklyWins !== a.weeklyWins) return b.weeklyWins - a.weeklyWins;
  if (b.weeklyAds !== a.weeklyAds) return b.weeklyAds - a.weeklyAds;
  if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
  const activityDiff = clanActivityMs(b) - clanActivityMs(a);
  if (activityDiff !== 0) return activityDiff;
  return a.name.localeCompare(b.name, "pt-BR");
}

export function compareClanDailyEntry(a: RankedClanComparable, b: RankedClanComparable): number {
  if (b.dailyScore !== a.dailyScore) return b.dailyScore - a.dailyScore;
  if (b.dailyWins !== a.dailyWins) return b.dailyWins - a.dailyWins;
  if (b.dailyAds !== a.dailyAds) return b.dailyAds - a.dailyAds;
  if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
  const activityDiff = clanActivityMs(b) - clanActivityMs(a);
  if (activityDiff !== 0) return activityDiff;
  return a.name.localeCompare(b.name, "pt-BR");
}

export function compareClanMonthlyEntry(a: RankedClanComparable, b: RankedClanComparable): number {
  if (b.monthlyScore !== a.monthlyScore) return b.monthlyScore - a.monthlyScore;
  if (b.monthlyWins !== a.monthlyWins) return b.monthlyWins - a.monthlyWins;
  if (b.monthlyAds !== a.monthlyAds) return b.monthlyAds - a.monthlyAds;
  if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
  const activityDiff = clanActivityMs(b) - clanActivityMs(a);
  if (activityDiff !== 0) return activityDiff;
  return a.name.localeCompare(b.name, "pt-BR");
}

export function formatClanStats(entry: RankedClanEntry, mode: ClanRankingMode) {
  if (mode === "daily") {
    return `${entry.dailyScore} pts hoje · ${entry.dailyWins} vitórias · ${entry.dailyAds} anúncios`;
  }
  if (mode === "weekly") {
    return `${entry.weeklyScore} pts · ${entry.weeklyWins} vitórias · ${entry.weeklyAds} anúncios`;
  }
  if (mode === "monthly") {
    return `${entry.monthlyScore} pts no mês · ${entry.monthlyWins} vitórias · ${entry.monthlyAds} anúncios`;
  }
  return `${entry.totalScore} pts totais · ${entry.totalWins} vitórias · ${entry.totalAds} anúncios`;
}

export function clanPrizePeriodLabel(mode: ClanRankingMode) {
  return mode === "daily" ? "diária" : mode === "weekly" ? "semanal" : "mensal";
}

export function formatClanCatalogActivity(item: Clan): string {
  if (item.lastMessageAt) return `Chat às ${formatClanTime(item.lastMessageAt)}`;
  if (item.lastScoreAt) return `Pontuou às ${formatClanTime(item.lastScoreAt)}`;
  if (item.updatedAt) return `Atualizado às ${formatClanTime(item.updatedAt)}`;
  return "Sem atividade";
}

function timestampToMs(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  return 0;
}

function clanActivityMs(item: Clan): number {
  return timestampToMs(item.lastMessageAt ?? item.updatedAt);
}
