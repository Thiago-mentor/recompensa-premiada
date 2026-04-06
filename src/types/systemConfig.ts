import type { Timestamp } from "./firestore";
import type { ReferralQualificationRules, ReferralRankingPrizeTier } from "./referral";

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
  /** PR cobrados por cada TICKET na conversão PR → TICKET (campo técnico: `gems` no perfil). */
  conversionCoinsPerGemBuy?: number;
  /** PR pagos por cada TICKET na conversão TICKET → PR; `0` desativa a venda. */
  conversionCoinsPerGemSell?: number;
  /** Quantos pontos CASH equivalem a R$ 1,00 no cálculo de saque (≥ 1). */
  cashPointsPerReal?: number;
  /** Segundos para responder em cada PvP (servidor usa no `actionDeadlineAt`). */
  pvpChoiceSeconds?: Partial<{
    ppt: number;
    quiz: number;
    reaction_tap: number;
  }>;
  atualizadoEm: Timestamp;
}

export interface ReferralCampaignSystemConfig {
  id: "referral_system";
  enabled: boolean;
  codeRequired: boolean;
  defaultInviterRewardCoins: number;
  defaultInvitedRewardCoins: number;
  invitedRewardEnabled: boolean;
  limitValidPerDay: number;
  limitRewardedPerUser: number;
  qualificationRules: ReferralQualificationRules;
  rankingRules: {
    daily: ReferralRankingPrizeTier[];
    weekly: ReferralRankingPrizeTier[];
    monthly: ReferralRankingPrizeTier[];
    all: ReferralRankingPrizeTier[];
  };
  antiFraudRules: {
    blockSelfReferral: boolean;
    flagBurstSignups: boolean;
    burstSignupThreshold: number;
    requireManualReviewForSuspected: boolean;
  };
  activeCampaignId?: string | null;
  campaignText?: string | null;
  updatedAt?: Timestamp;
}
