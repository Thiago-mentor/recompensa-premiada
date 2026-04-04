/**
 * Economia e tabelas dos minijogos — fonte de verdade no cliente (UI + modo Spark).
 * Manter em sincronia com `functions/src/gameEconomy.ts`.
 */
import type { GameId } from "@/types/game";

export type { GameId };

/** Tempo restante de cooldown (ms) a partir do mapa `gameCooldownUntil` no perfil. */
export function cooldownRemainingMs(
  gameId: string,
  gameCooldownUntil: Record<string, unknown> | undefined,
  nowMs: number,
): number {
  const raw = gameCooldownUntil?.[gameId];
  if (raw == null) return 0;
  const ms =
    raw && typeof (raw as { toMillis?: () => number }).toMillis === "function"
      ? (raw as { toMillis: () => number }).toMillis()
      : Number(raw);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, ms - nowMs);
}

export const GAME_COOLDOWN_SEC: Record<GameId, number> = {
  ppt: 2,
  quiz: 3,
  reaction_tap: 4,
  roleta: 12,
  bau: 4 * 3600,
  numero_secreto: 2,
};

/** Limite global de partidas finalizadas por minuto (anti-spam). */
export const MAX_MATCHES_PER_MINUTE = 28;

const ROULETTE_TABLE: { coins: number; weight: number }[] = [
  { coins: 10, weight: 22 },
  { coins: 25, weight: 20 },
  { coins: 50, weight: 18 },
  { coins: 75, weight: 15 },
  { coins: 100, weight: 12 },
  { coins: 150, weight: 8 },
  { coins: 200, weight: 5 },
];

const BAU_LOOT: { coins: number; weight: number }[] = [
  { coins: 15, weight: 25 },
  { coins: 40, weight: 25 },
  { coins: 80, weight: 20 },
  { coins: 120, weight: 15 },
  { coins: 200, weight: 10 },
  { coins: 350, weight: 5 },
];

export function pickWeightedCoins(
  table: { coins: number; weight: number }[],
  rng: () => number,
): number {
  const total = table.reduce((s, x) => s + x.weight, 0);
  let r = rng() * total;
  for (const row of table) {
    r -= row.weight;
    if (r <= 0) return row.coins;
  }
  return table[table.length - 1]!.coins;
}

export function pickRoulettePrize(rng: () => number = Math.random): number {
  return pickWeightedCoins(ROULETTE_TABLE, rng);
}

export function pickBauLoot(rng: () => number = Math.random): number {
  return pickWeightedCoins(BAU_LOOT, rng);
}

export function clampScore(n: number, min = 0, max = 1000): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function rankingPointsFrom(
  normalizedScore: number,
  resultado: "vitoria" | "derrota" | "empate",
): number {
  if (resultado === "vitoria") {
    return Math.max(8, Math.min(120, Math.floor(normalizedScore / 8) + 10));
  }
  if (resultado === "empate") return 4;
  return 2;
}

export function resolveMatchEconomy(
  gameId: GameId,
  resultado: "vitoria" | "derrota" | "empate",
  clientScore: number,
  metadata: Record<string, unknown>,
  rng: () => number = Math.random,
): {
  normalizedScore: number;
  rewardCoins: number;
  rankingPoints: number;
  resolvedMetadata: Record<string, unknown>;
} {
  const baseMeta = { ...metadata };

  if (gameId === "roleta") {
    const prize = pickRoulettePrize(rng);
    const normalizedScore = clampScore(prize * 5);
    return {
      normalizedScore,
      rewardCoins: prize,
      rankingPoints: rankingPointsFrom(normalizedScore, "vitoria"),
      resolvedMetadata: { ...baseMeta, serverPrize: prize, source: "roleta_table" },
    };
  }

  if (gameId === "bau") {
    const loot = pickBauLoot(rng);
    const normalizedScore = clampScore(loot / 2);
    return {
      normalizedScore,
      rewardCoins: loot,
      rankingPoints: rankingPointsFrom(normalizedScore, "vitoria"),
      resolvedMetadata: { ...baseMeta, serverLoot: loot, source: "bau_table" },
    };
  }

  if (gameId === "ppt") {
    const normalizedScore =
      resultado === "vitoria" ? 650 : resultado === "empate" ? 400 : 200;
    const rewardCoins =
      resultado === "vitoria" ? 45 : resultado === "empate" ? 12 : 0;
    const rankingPoints = resultado === "vitoria" ? 1 : 0;
    return {
      normalizedScore,
      rewardCoins,
      rankingPoints,
      resolvedMetadata: baseMeta,
    };
  }

  if (gameId === "quiz") {
    const timeMs = Number(metadata.responseTimeMs ?? 8000);
    const win = resultado === "vitoria";
    const base = win ? 500 : 120;
    const speedBonus = win ? clampScore(Math.max(0, 8000 - timeMs) / 15) : 0;
    const normalizedScore = clampScore(base + speedBonus);
    const rewardCoins = win
      ? Math.min(95, Math.max(25, 25 + Math.floor(speedBonus / 2)))
      : 5;
    return {
      normalizedScore,
      rewardCoins,
      rankingPoints: rankingPointsFrom(normalizedScore, resultado),
      resolvedMetadata: { ...baseMeta, responseTimeMs: timeMs },
    };
  }

  if (gameId === "reaction_tap") {
    const reactionMs = Number(metadata.reactionMs ?? clientScore);
    const win = resultado === "vitoria";
    const normalizedScore = win
      ? clampScore(950 - Math.min(750, reactionMs))
      : clampScore(Math.max(80, 280 - Math.min(200, reactionMs)));
    const rewardCoins = win
      ? Math.min(110, Math.max(20, 40 + Math.floor((350 - reactionMs) / 10)))
      : 4;
    return {
      normalizedScore,
      rewardCoins,
      rankingPoints: rankingPointsFrom(normalizedScore, resultado),
      resolvedMetadata: { ...baseMeta, reactionMs },
    };
  }

  const normalizedScore = clampScore(clientScore);
  const win = resultado === "vitoria";
  const rewardCoins = win
    ? Math.min(120, Math.max(10, 15 + Math.floor(normalizedScore / 5)))
    : 0;
  return {
    normalizedScore,
    rewardCoins,
    rankingPoints: rankingPointsFrom(normalizedScore, resultado),
    resolvedMetadata: baseMeta,
  };
}
