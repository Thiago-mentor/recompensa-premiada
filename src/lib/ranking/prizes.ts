import { GAME_CATALOG } from "@/modules/jogos/core/gameRegistry";
import type { RankingPeriod, RankingRewardPreview } from "@/types/ranking";
import type {
  RankingPrizeConfig,
  RankingPrizePeriodConfig,
  RankingPrizeTier,
} from "@/types/systemConfig";

export type NormalizedRankingPrizeConfig = {
  global: RankingPrizePeriodConfig;
  byGame: Record<string, RankingPrizePeriodConfig>;
  clans: RankingPrizePeriodConfig;
};

export const RANKING_PERIODS: RankingPeriod[] = ["diario", "semanal", "mensal"];

const DEFAULT_GLOBAL_PRIZES: RankingPrizePeriodConfig = {
  diario: [
    { posicaoMax: 1, coins: 500, gems: 25, rewardBalance: 0 },
    { posicaoMax: 3, coins: 250, gems: 10, rewardBalance: 0 },
    { posicaoMax: 10, coins: 100, gems: 5, rewardBalance: 0 },
  ],
  semanal: [
    { posicaoMax: 1, coins: 1500, gems: 60, rewardBalance: 30 },
    { posicaoMax: 3, coins: 800, gems: 30, rewardBalance: 15 },
    { posicaoMax: 10, coins: 300, gems: 10, rewardBalance: 5 },
  ],
  mensal: [
    { posicaoMax: 1, coins: 5000, gems: 150, rewardBalance: 150 },
    { posicaoMax: 3, coins: 2500, gems: 70, rewardBalance: 70 },
    { posicaoMax: 10, coins: 1000, gems: 25, rewardBalance: 20 },
  ],
};

const DEFAULT_CLAN_PRIZES: RankingPrizePeriodConfig = {
  diario: [],
  semanal: [
    { posicaoMax: 1, coins: 1500, gems: 60, rewardBalance: 30 },
    { posicaoMax: 3, coins: 800, gems: 30, rewardBalance: 15 },
    { posicaoMax: 10, coins: 300, gems: 10, rewardBalance: 5 },
  ],
  mensal: [],
};

export const KNOWN_RANKING_GAME_IDS = Array.from(
  new Set<string>([...GAME_CATALOG.map((game) => game.id), "numero_secreto"]),
);

export function createEmptyRankingPrizeTier(): RankingPrizeTier {
  return {
    posicaoMax: 0,
    coins: 0,
    gems: 0,
    rewardBalance: 0,
  };
}

export function createEmptyRankingPrizePeriodConfig(): RankingPrizePeriodConfig {
  return {
    diario: [],
    semanal: [],
    mensal: [],
  };
}

function cloneTier(tier: RankingPrizeTier): RankingPrizeTier {
  return {
    posicaoMax: Math.max(1, Math.floor(Number(tier.posicaoMax) || 0)),
    coins: Math.max(0, Math.floor(Number(tier.coins) || 0)),
    gems: Math.max(0, Math.floor(Number(tier.gems) || 0)),
    rewardBalance: Math.max(0, Math.floor(Number(tier.rewardBalance) || 0)),
  };
}

function cloneTierList(tiers: RankingPrizeTier[]): RankingPrizeTier[] {
  return tiers.map(cloneTier).sort((a, b) => a.posicaoMax - b.posicaoMax);
}

function normalizeTier(raw: unknown): RankingPrizeTier | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  let coins = Math.max(0, Math.floor(Number(data.coins) || 0));
  let gems = Math.max(0, Math.floor(Number(data.gems) || 0));
  let rewardBalance = Math.max(0, Math.floor(Number(data.rewardBalance) || 0));
  const amount = Math.max(0, Math.floor(Number(data.amount) || 0));
  const currency = String(data.currency || "");

  if (coins + gems + rewardBalance === 0 && amount > 0) {
    if (currency === "gems") gems = amount;
    else if (currency === "rewardBalance") rewardBalance = amount;
    else coins = amount;
  }

  const posicaoMax = Math.max(1, Math.floor(Number(data.posicaoMax) || 0));
  if (coins + gems + rewardBalance <= 0) return null;
  return { posicaoMax, coins, gems, rewardBalance };
}

function normalizeTierList(raw: unknown, fallback: RankingPrizeTier[]): RankingPrizeTier[] {
  if (!Array.isArray(raw)) return cloneTierList(fallback);
  const parsed = raw
    .map((item) => normalizeTier(item))
    .filter((item): item is RankingPrizeTier => item != null)
    .sort((a, b) => a.posicaoMax - b.posicaoMax);
  return parsed.length > 0 ? parsed : cloneTierList(fallback);
}

function normalizePeriodConfig(
  raw: unknown,
  fallback: RankingPrizePeriodConfig,
): RankingPrizePeriodConfig {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    diario: normalizeTierList(data.diario, fallback.diario),
    semanal: normalizeTierList(data.semanal, fallback.semanal),
    mensal: normalizeTierList(data.mensal, fallback.mensal),
  };
}

export function buildDefaultRankingPrizeConfig(): NormalizedRankingPrizeConfig {
  return {
    global: normalizePeriodConfig(DEFAULT_GLOBAL_PRIZES, DEFAULT_GLOBAL_PRIZES),
    byGame: Object.fromEntries(
      KNOWN_RANKING_GAME_IDS.map((gameId) => [gameId, createEmptyRankingPrizePeriodConfig()]),
    ),
    clans: normalizePeriodConfig(DEFAULT_CLAN_PRIZES, DEFAULT_CLAN_PRIZES),
  };
}

export function normalizeRankingPrizeConfig(raw: unknown): NormalizedRankingPrizeConfig {
  const fallback = buildDefaultRankingPrizeConfig();
  const data = raw && typeof raw === "object" ? (raw as RankingPrizeConfig & Record<string, unknown>) : {};
  const globalSource = data.global && typeof data.global === "object" ? data.global : data;
  const byGameSource =
    data.byGame && typeof data.byGame === "object"
      ? (data.byGame as Record<string, unknown>)
      : {};

  const keys = new Set<string>([...KNOWN_RANKING_GAME_IDS, ...Object.keys(byGameSource)]);
  const byGame = Object.fromEntries(
    Array.from(keys).map((gameId) => [
      gameId,
      normalizePeriodConfig(
        byGameSource[gameId],
        fallback.byGame[gameId] ?? createEmptyRankingPrizePeriodConfig(),
      ),
    ]),
  );

  return {
    global: normalizePeriodConfig(globalSource, fallback.global),
    byGame,
    clans: normalizePeriodConfig(data.clans, fallback.clans),
  };
}

export function getRankingPrizeTierForPosition(
  tiers: RankingPrizeTier[],
  position: number | null | undefined,
): RankingPrizeTier | null {
  if (!position || position < 1) return null;
  return tiers.find((tier) => position <= tier.posicaoMax) ?? null;
}

export function getRankingPrizeForPosition(
  tiers: RankingPrizeTier[],
  position: number | null | undefined,
): RankingRewardPreview | null {
  const tier = getRankingPrizeTierForPosition(tiers, position);
  if (!tier) return null;
  return {
    coins: tier.coins || 0,
    gems: tier.gems || 0,
    rewardBalance: tier.rewardBalance || 0,
  };
}

export function formatRankingPrize(
  reward: RankingRewardPreview | RankingPrizeTier | null | undefined,
): string {
  if (!reward) return "Sem prêmio";
  const parts: string[] = [];
  if ((reward.coins ?? 0) > 0) parts.push(`${reward.coins} PR`);
  if ((reward.gems ?? 0) > 0) parts.push(`${reward.gems} TICKET`);
  if ((reward.rewardBalance ?? 0) > 0) parts.push(`${reward.rewardBalance} Saldo`);
  return parts.length > 0 ? parts.join(" · ") : "Sem prêmio";
}

export function hasAnyRankingPrize(
  reward: RankingRewardPreview | RankingPrizeTier | null | undefined,
): boolean {
  return (reward?.coins ?? 0) + (reward?.gems ?? 0) + (reward?.rewardBalance ?? 0) > 0;
}

export function gameTitleFromId(gameId: string): string {
  const game = GAME_CATALOG.find((item) => item.id === gameId);
  if (game) return game.title;
  if (gameId === "numero_secreto") return "Número secreto";
  return gameId;
}
