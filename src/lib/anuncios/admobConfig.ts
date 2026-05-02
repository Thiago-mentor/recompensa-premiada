import { Capacitor } from "@capacitor/core";
import { PPT_PVP_DUELS_PLACEMENT_ID } from "@/lib/constants/pptPvp";
import { QUIZ_PVP_DUELS_PLACEMENT_ID } from "@/lib/constants/quizPvp";
import { REACTION_PVP_DUELS_PLACEMENT_ID } from "@/lib/constants/reactionPvp";
import {
  CHEST_SPEEDUP_PLACEMENT_ID,
  HOME_REWARDED_PLACEMENT_ID,
  RAFFLE_NUMBER_PLACEMENT_ID,
  ROULETTE_DAILY_SPIN_PLACEMENT_ID,
  type RewardedAdPlacementId,
} from "@/lib/constants/rewardedAds";

const ANDROID_TEST_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const ANDROID_TEST_REWARDED_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917";

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function isNativeAndroidPlatform(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export const admobAndroidAppId =
  env("NEXT_PUBLIC_ADMOB_ANDROID_APP_ID") ?? ANDROID_TEST_APP_ID;

const admobAndroidRewardedDefaultUnitId =
  env("NEXT_PUBLIC_ADMOB_ANDROID_REWARDED_DEFAULT_ID") ?? ANDROID_TEST_REWARDED_AD_UNIT_ID;

export const admobAndroidRewardedUnitIds: Record<RewardedAdPlacementId, string> = {
  [HOME_REWARDED_PLACEMENT_ID]:
    env("NEXT_PUBLIC_ADMOB_ANDROID_REWARDED_HOME_ID") ?? admobAndroidRewardedDefaultUnitId,
  [ROULETTE_DAILY_SPIN_PLACEMENT_ID]:
    env("NEXT_PUBLIC_ADMOB_ANDROID_REWARDED_ROULETTE_ID") ?? admobAndroidRewardedDefaultUnitId,
  [PPT_PVP_DUELS_PLACEMENT_ID]:
    env("NEXT_PUBLIC_ADMOB_ANDROID_REWARDED_PPT_ID") ?? admobAndroidRewardedDefaultUnitId,
  [QUIZ_PVP_DUELS_PLACEMENT_ID]:
    env("NEXT_PUBLIC_ADMOB_ANDROID_REWARDED_QUIZ_ID") ?? admobAndroidRewardedDefaultUnitId,
  [REACTION_PVP_DUELS_PLACEMENT_ID]:
    env("NEXT_PUBLIC_ADMOB_ANDROID_REWARDED_REACTION_ID") ?? admobAndroidRewardedDefaultUnitId,
  [CHEST_SPEEDUP_PLACEMENT_ID]:
    env("NEXT_PUBLIC_ADMOB_ANDROID_REWARDED_CHEST_SPEEDUP_ID") ??
    admobAndroidRewardedDefaultUnitId,
  /** Padrão: ID de rewarded de teste do Google; em produção defina NEXT_PUBLIC_ADMOB_ANDROID_REWARDED_RAFFLE_ID. */
  [RAFFLE_NUMBER_PLACEMENT_ID]:
    env("NEXT_PUBLIC_ADMOB_ANDROID_REWARDED_RAFFLE_ID") ?? ANDROID_TEST_REWARDED_AD_UNIT_ID,
};

export const admobAndroidSsvEnabled =
  process.env.NEXT_PUBLIC_ADMOB_ANDROID_SSV_ENABLED === "true";

export function usingAndroidTestAdMobIds(): boolean {
  return (
    admobAndroidAppId === ANDROID_TEST_APP_ID ||
    Object.values(admobAndroidRewardedUnitIds).some(
      (adUnitId) => adUnitId === ANDROID_TEST_REWARDED_AD_UNIT_ID,
    )
  );
}
