import { PPT_PVP_DUELS_PLACEMENT_ID } from "@/lib/constants/pptPvp";
import { QUIZ_PVP_DUELS_PLACEMENT_ID } from "@/lib/constants/quizPvp";
import { REACTION_PVP_DUELS_PLACEMENT_ID } from "@/lib/constants/reactionPvp";

export const HOME_REWARDED_PLACEMENT_ID = "home_rewarded";
export const CHEST_SPEEDUP_PLACEMENT_ID = "chest_speedup";

export const REWARDED_AD_PLACEMENTS = [
  HOME_REWARDED_PLACEMENT_ID,
  PPT_PVP_DUELS_PLACEMENT_ID,
  QUIZ_PVP_DUELS_PLACEMENT_ID,
  REACTION_PVP_DUELS_PLACEMENT_ID,
  CHEST_SPEEDUP_PLACEMENT_ID,
] as const;

export type RewardedAdPlacementId = (typeof REWARDED_AD_PLACEMENTS)[number];
