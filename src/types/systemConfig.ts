import type { Timestamp } from "./firestore";
import type { GameId } from "./game";
import type { ChestRarity, ChestSource } from "./chest";
import type {
  ReferralQualificationRules,
  ReferralRankingPrizeTier,
  ReferralRewardCurrency,
} from "./referral";

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
  rewardBalance: number;
}

export interface GameRewardOverrideConfig {
  winCoins?: number;
  drawCoins?: number;
  lossCoins?: number;
  winRankingPoints?: number;
  drawRankingPoints?: number;
  lossRankingPoints?: number;
}

export interface ChestRewardRange {
  min: number;
  max: number;
}

export interface ChestRewardTable {
  coins: ChestRewardRange;
  gems: ChestRewardRange;
  xp: ChestRewardRange;
}

export type ChestBonusRewardKind =
  | "bonusCoins"
  | "fragments"
  | "boostMinutes"
  | "superPrizeEntries";

export interface ChestBonusRewardWeight {
  kind: ChestBonusRewardKind;
  weight: number;
}

export interface ChestBonusRewardTable {
  bonusCoins: ChestRewardRange;
  fragments: ChestRewardRange;
  boostMinutes: ChestRewardRange;
  superPrizeEntries: ChestRewardRange;
}

export interface ChestDropWeight {
  rarity: ChestRarity;
  weight: number;
}

export interface ChestPityRules {
  rareAt: number;
  epicAt: number;
  legendaryAt: number;
}

export type ExperienceCategory = "arena" | "utility";

export interface ExperienceCatalogConfigEntry {
  category: ExperienceCategory;
  title?: string;
  subtitle?: string;
  badgeLabel?: string;
  order?: number;
}

export interface RankingPrizePeriodConfig {
  diario: RankingPrizeTier[];
  semanal: RankingPrizeTier[];
  mensal: RankingPrizeTier[];
}

export interface RankingPrizeGameConfig extends Partial<RankingPrizePeriodConfig> {
  enabled?: boolean;
  title?: string;
}

/**
 * Mantém compatibilidade com o shape legado (`diario|semanal|mensal` na raiz)
 * e suporta a nova configuração por escopo (`global` / `byGame`).
 */
export interface RankingPrizeConfig extends Partial<RankingPrizePeriodConfig> {
  global?: Partial<RankingPrizePeriodConfig>;
  byGame?: Partial<Record<GameId | string, RankingPrizeGameConfig>>;
}

/** `system_configs/economy` (documento único ou id fixo) */
export interface SystemEconomyConfig {
  id: "economy";
  rewardAdCoinAmount: number;
  dailyLoginBonus: number;
  /** Percentual extra de PR quando o boost ativo está rodando (ex.: 25 = +25%). */
  boostRewardPercent?: number;
  /** Quantos fragmentos são consumidos para fabricar um pacote de boost. */
  fragmentsPerBoostCraft?: number;
  /** Quantos minutos de boost armazenado são creditados por craft. */
  boostMinutesPerCraft?: number;
  /** Quantos minutos são consumidos/ativados a cada uso do boost armazenado. */
  boostActivationMinutes?: number;
  streakTable: StreakRewardTier[];
  gameEntryCost: Partial<Record<string, number>>;
  chestCooldownSegundos: number;
  rankingPrizes: RankingPrizeConfig;
  matchRewardOverrides?: Partial<Record<string, GameRewardOverrideConfig>>;
  experienceCatalog?: Partial<Record<GameId | string, ExperienceCatalogConfigEntry>>;
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

/** `system_configs/chest_system` */
export interface ChestSystemConfig {
  id: "chest_system";
  enabled: boolean;
  slotCount: number;
  queueCapacity: number;
  unlockDurationsByRarity: Record<ChestRarity, number>;
  dropTablesBySource: Record<ChestSource, ChestDropWeight[]>;
  rewardTablesByRarity: Record<ChestRarity, ChestRewardTable>;
  bonusWeightsByRarity: Record<ChestRarity, ChestBonusRewardWeight[]>;
  bonusRewardTablesByRarity: Record<ChestRarity, ChestBonusRewardTable>;
  adSpeedupPercent: number;
  maxAdsPerChest: number;
  adCooldownSeconds: number;
  dailyChestAdsLimit: number;
  pityRules: ChestPityRules;
  updatedAt?: Timestamp;
}

export interface ReferralCampaignSystemConfig {
  id: "referral_system";
  enabled: boolean;
  codeRequired: boolean;
  defaultInviterRewardAmount: number;
  defaultInviterRewardCurrency: ReferralRewardCurrency;
  defaultInvitedRewardAmount: number;
  defaultInvitedRewardCurrency: ReferralRewardCurrency;
  invitedRewardEnabled: boolean;
  rankingEnabled: boolean;
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
