/**
 * Economia e tabelas dos minijogos — referência no cliente (UI); servidor é a fonte de verdade.
 * Manter em sincronia com `functions/src/gameEconomy.ts`.
 */
import type { GameId } from "@/types/game";
import type { ChestRarity } from "@/types/chest";
import type { WeightedPrizeConfig, RoulettePrizeKindConfig } from "@/types/systemConfig";

export type { GameId, WeightedPrizeConfig };

export interface GameRewardOverrideConfig {
  winCoins?: number;
  drawCoins?: number;
  lossCoins?: number;
  winRankingPoints?: number;
  drawRankingPoints?: number;
  lossRankingPoints?: number;
}

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

export const DEFAULT_ROULETTE_TABLE: WeightedPrizeConfig[] = [
  { coins: 10, weight: 22 },
  { coins: 25, weight: 20 },
  { coins: 50, weight: 18 },
  { coins: 75, weight: 15 },
  { coins: 100, weight: 12 },
  { coins: 150, weight: 8 },
  { coins: 200, weight: 5 },
];

/** Normaliza `economy.rouletteTable` vinda do Firestore (mesma regra do painel admin). */
export function normalizeRouletteTableFromFirestore(raw: unknown): WeightedPrizeConfig[] {
  const source = Array.isArray(raw) ? raw : DEFAULT_ROULETTE_TABLE;
  const rarities: ChestRarity[] = ["comum", "raro", "epico", "lendario"];
  const normalized: WeightedPrizeConfig[] = [];
  for (const row of source) {
    const value = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const kind = String(value.kind || "coins").trim();
    const weight = Math.max(0, Math.floor(Number(value.weight) || 0));
    if (weight <= 0) continue;
    if (kind === "chest") {
      const cr = String(value.chestRarity || "").trim();
      if (!rarities.includes(cr as ChestRarity)) continue;
      normalized.push({ kind: "chest", coins: 0, weight, chestRarity: cr as ChestRarity });
      continue;
    }
    const amount = Math.max(0, Math.floor(Number(value.coins) || 0));
    if (amount <= 0) continue;
    if (kind === "gems") {
      normalized.push({ kind: "gems", coins: amount, weight });
      continue;
    }
    if (kind === "rewardBalance") {
      normalized.push({ kind: "rewardBalance", coins: amount, weight });
      continue;
    }
    normalized.push({ kind: "coins", coins: amount, weight });
  }
  const slice = normalized.slice(0, 24);
  return slice.length > 0 ? slice : [...DEFAULT_ROULETTE_TABLE];
}

/** Moedas virtuais sorteáveis na roleta (exceto baú). */
export type RouletteCurrencyPrizeKind = "coins" | "gems" | "rewardBalance";

function rowCurrencyKind(row: WeightedPrizeConfig): RouletteCurrencyPrizeKind | "chest" {
  if (row.kind === "chest") return "chest";
  if (row.kind === "gems") return "gems";
  if (row.kind === "rewardBalance") return "rewardBalance";
  return "coins";
}

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
  const total = table.reduce((s, x) => s + Math.max(0, x.weight), 0);
  let r = rng() * total;
  for (const row of table) {
    r -= Math.max(0, row.weight);
    if (r <= 0) return Math.max(0, Math.floor(row.coins));
  }
  const last = table[table.length - 1];
  return last ? Math.max(0, Math.floor(last.coins)) : 0;
}

const KNOWN_CHEST_ORDER: ChestRarity[] = ["comum", "raro", "epico", "lendario"];

export function isRouletteChestRarity(value: unknown): value is ChestRarity {
  return typeof value === "string" && (KNOWN_CHEST_ORDER as readonly string[]).includes(value);
}

export type RoulettePickResult =
  | { kind: RouletteCurrencyPrizeKind; amount: number }
  | { kind: "chest"; chestRarity: ChestRarity };

/** Fatias válidas para o sorteio (peso e meta bem definidos). */
export function rouletteTableEntries(
  table: WeightedPrizeConfig[],
): Array<{ weight: number; pick: RoulettePickResult }> {
  const rows = table.length > 0 ? table : DEFAULT_ROULETTE_TABLE;
  const out: Array<{ weight: number; pick: RoulettePickResult }> = [];
  for (const row of rows) {
    const w = Math.max(0, Math.floor(Number(row.weight) || 0));
    if (w <= 0) continue;
    const segmentKind = rowCurrencyKind(row);
    if (segmentKind === "chest") {
      if (!isRouletteChestRarity(row.chestRarity)) continue;
      out.push({ weight: w, pick: { kind: "chest", chestRarity: row.chestRarity } });
      continue;
    }
    const amount = Math.max(0, Math.floor(Number(row.coins) || 0));
    if (amount <= 0) continue;
    out.push({ weight: w, pick: { kind: segmentKind, amount } });
  }
  return out;
}

export function pickWeightedRoulettePrize(
  table: WeightedPrizeConfig[],
  rng: () => number,
): RoulettePickResult {
  let entries = rouletteTableEntries(table);
  if (entries.length === 0) entries = rouletteTableEntries(DEFAULT_ROULETTE_TABLE);
  const total = entries.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) return { kind: "coins", amount: DEFAULT_ROULETTE_TABLE[0]!.coins };
  let r = rng() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) return e.pick;
  }
  return entries[entries.length - 1]!.pick;
}

/** Resposta do servidor usada só para alinhar a roleta visual à fatia sorteada. */
export type RouletteWheelServerHint = {
  roulettePrizeKind: "coins" | "gems" | "rewardBalance" | "chest";
  chestRarity?: string | null;
  rewardCoins?: number;
  rewardGems?: number;
  rewardCash?: number;
  rouletteRewardAmount?: number;
};

function rowEffectiveKind(row: WeightedPrizeConfig): RoulettePrizeKindConfig {
  return row.kind ?? "coins";
}

/**
 * Índice da fatia em `table` que corresponde ao prêmio devolvido pelo servidor.
 * Várias fatias iguais: usa a primeira. Tabela dessincronizada: melhor fallback do que ângulo aleatório.
 */
export function wheelSliceIndexForServerPrize(
  table: WeightedPrizeConfig[],
  resolved: RouletteWheelServerHint,
): number {
  const n = table.length;
  if (n < 1) return 0;
  const kind = resolved.roulettePrizeKind;
  if (kind === "chest") {
    const r = resolved.chestRarity;
    if (r && typeof r === "string") {
      const i = table.findIndex((row) => rowEffectiveKind(row) === "chest" && row.chestRarity === r);
      if (i >= 0) return i;
    }
    const j = table.findIndex((row) => rowEffectiveKind(row) === "chest");
    return j >= 0 ? j : 0;
  }
  if (kind === "gems") {
    const amt = Math.max(
      0,
      Math.floor(Number(resolved.rewardGems ?? resolved.rouletteRewardAmount ?? 0) || 0),
    );
    const i = table.findIndex((row) => rowEffectiveKind(row) === "gems" && row.coins === amt);
    if (i >= 0) return i;
    const j = table.findIndex((row) => rowEffectiveKind(row) === "gems");
    return j >= 0 ? j : 0;
  }
  if (kind === "rewardBalance") {
    const amt = Math.max(
      0,
      Math.floor(Number(resolved.rewardCash ?? resolved.rouletteRewardAmount ?? 0) || 0),
    );
    const i = table.findIndex((row) => rowEffectiveKind(row) === "rewardBalance" && row.coins === amt);
    if (i >= 0) return i;
    const j = table.findIndex((row) => rowEffectiveKind(row) === "rewardBalance");
    return j >= 0 ? j : 0;
  }
  const amt = Math.max(
    0,
    Math.floor(Number(resolved.rewardCoins ?? resolved.rouletteRewardAmount ?? 0) || 0),
  );
  const i = table.findIndex((row) => rowEffectiveKind(row) === "coins" && row.coins === amt);
  if (i >= 0) return i;
  const j = table.findIndex((row) => rowEffectiveKind(row) === "coins");
  return j >= 0 ? j : 0;
}

function rouletteScoreHintForChest(r: ChestRarity): number {
  if (r === "comum") return 460;
  if (r === "raro") return 580;
  if (r === "epico") return 740;
  return 860;
}

export function pickRoulettePrize(rng: () => number = Math.random): number {
  return pickWeightedCoins(DEFAULT_ROULETTE_TABLE, rng);
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

function applyRewardOverrides(
  resultado: "vitoria" | "derrota" | "empate",
  rewardCoins: number,
  rankingPoints: number,
  overrides?: GameRewardOverrideConfig,
) {
  if (!overrides) return { rewardCoins, rankingPoints };
  if (resultado === "vitoria") {
    return {
      rewardCoins: overrides.winCoins ?? rewardCoins,
      rankingPoints: overrides.winRankingPoints ?? rankingPoints,
    };
  }
  if (resultado === "empate") {
    return {
      rewardCoins: overrides.drawCoins ?? rewardCoins,
      rankingPoints: overrides.drawRankingPoints ?? rankingPoints,
    };
  }
  return {
    rewardCoins: overrides.lossCoins ?? rewardCoins,
    rankingPoints: overrides.lossRankingPoints ?? rankingPoints,
  };
}

export function resolveMatchEconomy(
  gameId: GameId,
  resultado: "vitoria" | "derrota" | "empate",
  clientScore: number,
  metadata: Record<string, unknown>,
  rewardOverrides?: Partial<Record<GameId, GameRewardOverrideConfig>>,
  rng: () => number = Math.random,
  rouletteTable: WeightedPrizeConfig[] = DEFAULT_ROULETTE_TABLE,
): {
  normalizedScore: number;
  rewardCoins: number;
  rankingPoints: number;
  resolvedMetadata: Record<string, unknown>;
} {
  const baseMeta = { ...metadata };

  if (gameId === "roleta") {
    const table = rouletteTable.length > 0 ? rouletteTable : DEFAULT_ROULETTE_TABLE;
    const picked = pickWeightedRoulettePrize(table, rng);
    if (picked.kind === "chest") {
      const normalizedScore = clampScore(rouletteScoreHintForChest(picked.chestRarity));
      return {
        normalizedScore,
        rewardCoins: 0,
        rankingPoints: rankingPointsFrom(normalizedScore, "vitoria"),
        resolvedMetadata: {
          ...baseMeta,
          roulettePrizeKind: "chest",
          chestRarity: picked.chestRarity,
          source: "roleta_table",
        },
      };
    }
    const currencyKind = picked.kind;
    const amount = picked.amount;
    const normalizedScore = clampScore(amount * 5);
    return {
      normalizedScore,
      rewardCoins: currencyKind === "coins" ? amount : 0,
      rankingPoints: rankingPointsFrom(normalizedScore, "vitoria"),
      resolvedMetadata: {
        ...baseMeta,
        roulettePrizeKind: currencyKind,
        rouletteRewardAmount: amount,
        ...(currencyKind === "coins" ? { serverPrize: amount } : {}),
        source: "roleta_table",
      },
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
    const resolved = applyRewardOverrides(
      resultado,
      resultado === "vitoria" ? 45 : resultado === "empate" ? 12 : 0,
      resultado === "vitoria" ? 1 : 0,
      rewardOverrides?.ppt,
    );
    return {
      normalizedScore,
      rewardCoins: resolved.rewardCoins,
      rankingPoints: resolved.rankingPoints,
      resolvedMetadata: baseMeta,
    };
  }

  if (gameId === "quiz") {
    const timeMs = Number(metadata.responseTimeMs ?? 8000);
    const win = resultado === "vitoria";
    const base = win ? 500 : 120;
    const speedBonus = win ? clampScore(Math.max(0, 8000 - timeMs) / 15) : 0;
    const normalizedScore = clampScore(base + speedBonus);
    const resolved = applyRewardOverrides(
      resultado,
      win ? Math.min(95, Math.max(25, 25 + Math.floor(speedBonus / 2))) : 5,
      rankingPointsFrom(normalizedScore, resultado),
      rewardOverrides?.quiz,
    );
    return {
      normalizedScore,
      rewardCoins: resolved.rewardCoins,
      rankingPoints: resolved.rankingPoints,
      resolvedMetadata: { ...baseMeta, responseTimeMs: timeMs },
    };
  }

  if (gameId === "reaction_tap") {
    const reactionMs = Number(metadata.reactionMs ?? clientScore);
    const win = resultado === "vitoria";
    const normalizedScore = win
      ? clampScore(950 - Math.min(750, reactionMs))
      : clampScore(Math.max(80, 280 - Math.min(200, reactionMs)));
    const resolved = applyRewardOverrides(
      resultado,
      win ? Math.min(110, Math.max(20, 40 + Math.floor((350 - reactionMs) / 10))) : 4,
      rankingPointsFrom(normalizedScore, resultado),
      rewardOverrides?.reaction_tap,
    );
    return {
      normalizedScore,
      rewardCoins: resolved.rewardCoins,
      rankingPoints: resolved.rankingPoints,
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
