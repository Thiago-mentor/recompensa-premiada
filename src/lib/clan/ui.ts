import type {
  ClanJoinRequestStatus,
  ClanPrivacy,
  ClanRole,
  ClanWeeklyContributor,
} from "@/types/clan";
import type { RankingRewardPreview } from "@/types/ranking";
import { getDailyPeriodKey, getMonthlyPeriodKey, getWeeklyPeriodKey } from "@/utils/date";

export function formatClanRole(role: ClanRole | null | undefined): string {
  if (role === "owner") return "Fundador";
  if (role === "leader") return "Líder";
  return "Membro";
}

export function formatClanPrivacy(privacy: ClanPrivacy | null | undefined): string {
  return privacy === "open" ? "Aberto" : "Somente código";
}

export function formatClanJoinRequestStatus(status: ClanJoinRequestStatus | null | undefined): string {
  if (status === "approved") return "Aprovada";
  if (status === "rejected") return "Recusada";
  if (status === "cancelled") return "Cancelada";
  return "Pendente";
}

export function formatClanTime(value: unknown): string {
  if (!value || typeof value !== "object" || !("toDate" in value)) return "agora";
  try {
    return (value as { toDate: () => Date }).toDate().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "agora";
  }
}

type ClanPeriodBreakdown = {
  score: number;
  wins: number;
  ads: number;
};

function resolveClanPeriodBreakdown(
  currentPeriodKey: string,
  storedPeriodKey: unknown,
  values: {
    score: unknown;
    wins: unknown;
    ads: unknown;
  },
): ClanPeriodBreakdown {
  if (String(storedPeriodKey || "") !== currentPeriodKey) {
    return { score: 0, wins: 0, ads: 0 };
  }
  return {
    score: Math.max(0, Math.floor(Number(values.score) || 0)),
    wins: Math.max(0, Math.floor(Number(values.wins) || 0)),
    ads: Math.max(0, Math.floor(Number(values.ads) || 0)),
  };
}

export function resolveClanDailyScore(input: {
  scoreDaily?: number | null;
  scoreDailyWins?: number | null;
  scoreDailyAds?: number | null;
  scoreDailyKey?: string | null;
}): number {
  return resolveClanDailyBreakdown(input).score;
}

export function resolveClanDailyBreakdown(input: {
  scoreDaily?: number | null;
  scoreDailyWins?: number | null;
  scoreDailyAds?: number | null;
  scoreDailyKey?: string | null;
}): ClanPeriodBreakdown {
  return resolveClanPeriodBreakdown(getDailyPeriodKey(), input.scoreDailyKey, {
    score: input.scoreDaily,
    wins: input.scoreDailyWins,
    ads: input.scoreDailyAds,
  });
}

export function resolveClanWeeklyScore(input: {
  scoreWeekly?: number | null;
  scoreWeeklyWins?: number | null;
  scoreWeeklyAds?: number | null;
  scoreWeeklyKey?: string | null;
}): number {
  return resolveClanWeeklyBreakdown(input).score;
}

export function resolveClanWeeklyBreakdown(input: {
  scoreWeekly?: number | null;
  scoreWeeklyWins?: number | null;
  scoreWeeklyAds?: number | null;
  scoreWeeklyKey?: string | null;
}): ClanPeriodBreakdown {
  return resolveClanPeriodBreakdown(getWeeklyPeriodKey(), input.scoreWeeklyKey, {
    score: input.scoreWeekly,
    wins: input.scoreWeeklyWins,
    ads: input.scoreWeeklyAds,
  });
}

export function resolveClanMonthlyScore(input: {
  scoreMonthly?: number | null;
  scoreMonthlyWins?: number | null;
  scoreMonthlyAds?: number | null;
  scoreMonthlyKey?: string | null;
}): number {
  return resolveClanMonthlyBreakdown(input).score;
}

export function resolveClanMonthlyBreakdown(input: {
  scoreMonthly?: number | null;
  scoreMonthlyWins?: number | null;
  scoreMonthlyAds?: number | null;
  scoreMonthlyKey?: string | null;
}): ClanPeriodBreakdown {
  return resolveClanPeriodBreakdown(getMonthlyPeriodKey(), input.scoreMonthlyKey, {
    score: input.scoreMonthly,
    wins: input.scoreMonthlyWins,
    ads: input.scoreMonthlyAds,
  });
}

type ClanWeeklyRewardProjection = {
  uid: string;
  score: number;
  wins: number;
  ads: number;
  rewards: { coins: number; gems: number; rewardBalance: number };
};

function normalizeRankingRewardPreview(
  reward: RankingRewardPreview | null | undefined,
): { coins: number; gems: number; rewardBalance: number } {
  return {
    coins: Math.max(0, Math.floor(Number(reward?.coins) || 0)),
    gems: Math.max(0, Math.floor(Number(reward?.gems) || 0)),
    rewardBalance: Math.max(0, Math.floor(Number(reward?.rewardBalance) || 0)),
  };
}

function clanContributionUpdatedAtMs(value: unknown): number {
  if (!value || typeof value !== "object" || !("toMillis" in value)) return 0;
  try {
    return (value as { toMillis: () => number }).toMillis();
  } catch {
    return 0;
  }
}

export function compareClanWeeklyContributor(
  a: Pick<ClanWeeklyContributor, "uid" | "score" | "wins" | "ads" | "updatedAt">,
  b: Pick<ClanWeeklyContributor, "uid" | "score" | "wins" | "ads" | "updatedAt">,
): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (b.ads !== a.ads) return b.ads - a.ads;
  const updatedDiff = clanContributionUpdatedAtMs(b.updatedAt) - clanContributionUpdatedAtMs(a.updatedAt);
  if (updatedDiff !== 0) return updatedDiff;
  return a.uid.localeCompare(b.uid, "pt-BR");
}

export function distributeClanWeeklyRewards(
  reward: RankingRewardPreview | null | undefined,
  contributors: Array<Pick<ClanWeeklyContributor, "uid" | "score" | "wins" | "ads" | "updatedAt">>,
): ClanWeeklyRewardProjection[] {
  const rewards = normalizeRankingRewardPreview(reward);
  const rankedContributors = [...contributors]
    .filter((item) => item.score > 0)
    .sort(compareClanWeeklyContributor);
  if (rankedContributors.length === 0) return [];

  const totalReward = rewards.coins + rewards.gems + rewards.rewardBalance;
  if (totalReward <= 0) return [];

  const totalScore = rankedContributors.reduce((sum, item) => sum + item.score, 0);
  if (totalScore <= 0) return [];

  const allocations = new Map(
    rankedContributors.map((item) => [
      item.uid,
      { coins: 0, gems: 0, rewardBalance: 0 },
    ]),
  );

  for (const currency of ["coins", "gems", "rewardBalance"] as const) {
    const amount = rewards[currency];
    if (amount <= 0) continue;

    let distributed = 0;
    const remainderRows = rankedContributors.map((item) => {
      const weightedAmount = amount * item.score;
      const baseShare = Math.floor(weightedAmount / totalScore);
      allocations.get(item.uid)![currency] = baseShare;
      distributed += baseShare;
      return {
        contributor: item,
        remainder: weightedAmount % totalScore,
      };
    });

    const remaining = amount - distributed;
    if (remaining > 0) {
      remainderRows.sort((a, b) => {
        if (b.remainder !== a.remainder) return b.remainder - a.remainder;
        return compareClanWeeklyContributor(a.contributor, b.contributor);
      });

      for (let index = 0; index < remaining; index += 1) {
        const target = remainderRows[index % remainderRows.length];
        allocations.get(target.contributor.uid)![currency] += 1;
      }
    }
  }

  return rankedContributors
    .map((contributor) => ({
      uid: contributor.uid,
      score: contributor.score,
      wins: contributor.wins,
      ads: contributor.ads,
      rewards: allocations.get(contributor.uid)!,
    }))
    .filter(
      (item) =>
        item.rewards.coins > 0 || item.rewards.gems > 0 || item.rewards.rewardBalance > 0,
    );
}
