import { PPT_PVP_DUELS_PLACEMENT_ID } from "@/lib/constants/pptPvp";
import { QUIZ_PVP_DUELS_PLACEMENT_ID } from "@/lib/constants/quizPvp";
import { REACTION_PVP_DUELS_PLACEMENT_ID } from "@/lib/constants/reactionPvp";

export const HOME_REWARDED_PLACEMENT_ID = "home_rewarded";
export const ROULETTE_DAILY_SPIN_PLACEMENT_ID = "roulette_daily_spin";
export const CHEST_SPEEDUP_PLACEMENT_ID = "chest_speedup";
export const RAFFLE_NUMBER_PLACEMENT_ID = "raffle_number";

export const REWARDED_AD_PLACEMENTS = [
  HOME_REWARDED_PLACEMENT_ID,
  ROULETTE_DAILY_SPIN_PLACEMENT_ID,
  PPT_PVP_DUELS_PLACEMENT_ID,
  QUIZ_PVP_DUELS_PLACEMENT_ID,
  REACTION_PVP_DUELS_PLACEMENT_ID,
  CHEST_SPEEDUP_PLACEMENT_ID,
  RAFFLE_NUMBER_PLACEMENT_ID,
] as const;

export type RewardedAdPlacementId = (typeof REWARDED_AD_PLACEMENTS)[number];

/** Rótulos para admin e docs; IDs coincidem com as Cloud Functions. */
export const REWARDED_AD_PLACEMENT_LABELS: Record<RewardedAdPlacementId, string> = {
  [HOME_REWARDED_PLACEMENT_ID]: "Home (anúncio recompensado)",
  [ROULETTE_DAILY_SPIN_PLACEMENT_ID]: "Roleta — giro diário (placement do anúncio)",
  [PPT_PVP_DUELS_PLACEMENT_ID]: "Arena PPT — recarga de duelos",
  [QUIZ_PVP_DUELS_PLACEMENT_ID]: "Arena Quiz — recarga de duelos",
  [REACTION_PVP_DUELS_PLACEMENT_ID]: "Arena Reaction — recarga de duelos",
  [CHEST_SPEEDUP_PLACEMENT_ID]: "Baú — aceleração (timer via sistema de baús)",
  [RAFFLE_NUMBER_PLACEMENT_ID]: "Sorteio — número por anúncio",
};
