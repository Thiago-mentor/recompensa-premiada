import type { StreakRewardTier } from "./systemConfig";

export type StreakCardPreview = {
  nextMilestone: { tier: StreakRewardTier; daysUntil: number } | null;
  nextLoginReward: {
    coins: number;
    gems: number;
    tipoBonus: StreakRewardTier["tipoBonus"];
  };
  hasConfiguredMilestones: boolean;
};
