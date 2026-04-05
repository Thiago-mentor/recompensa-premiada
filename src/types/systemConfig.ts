import type { Timestamp } from "./firestore";

/** Tabela de streak: dia -> recompensa */
export interface StreakRewardTier {
  dia: number;
  coins: number;
  gems: number;
  tipoBonus: "nenhum" | "bau" | "especial";
}

export interface RankingPrizeTier {
  posicaoMax: number;
  coins: number;
  gems: number;
}

export interface GameRewardOverrideConfig {
  winCoins?: number;
  drawCoins?: number;
  lossCoins?: number;
  winRankingPoints?: number;
  drawRankingPoints?: number;
  lossRankingPoints?: number;
}

/** `system_configs/economy` (documento único ou id fixo) */
export interface SystemEconomyConfig {
  id: "economy";
  rewardAdCoinAmount: number;
  dailyLoginBonus: number;
  streakTable: StreakRewardTier[];
  gameEntryCost: Partial<Record<string, number>>;
  chestCooldownSegundos: number;
  rankingPrizes: {
    diario: RankingPrizeTier[];
    semanal: RankingPrizeTier[];
    mensal: RankingPrizeTier[];
  };
  matchRewardOverrides?: Partial<Record<string, GameRewardOverrideConfig>>;
  referralBonusIndicador: number;
  referralBonusConvidado: number;
  limiteDiarioAds: number;
  limiteDiarioCoins: number;
  atualizadoEm: Timestamp;
}
