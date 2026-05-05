import type { UserProfile } from "@/types/user";
import type { SystemEconomyConfig } from "@/types/systemConfig";

/** Padrão quando o documento não define `avatarUploadReputationThresholds`. */
export const DEFAULT_AVATAR_UPLOAD_REPUTATION_THRESHOLDS = {
  ads: 50,
  pptMatches: 10,
  quizMatches: 10,
  reactionMatches: 10,
} as const;

export type AvatarUploadReputationThresholdsResolved = {
  ads: number;
  pptMatches: number;
  quizMatches: number;
  reactionMatches: number;
};

/** Lê `system_configs/economy.avatarUploadReputationThresholds` com fallback nos padrões. */
export function resolveAvatarUploadReputationThresholds(
  config: Partial<SystemEconomyConfig> | null | undefined,
): AvatarUploadReputationThresholdsResolved {
  const raw = config?.avatarUploadReputationThresholds;
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const def = DEFAULT_AVATAR_UPLOAD_REPUTATION_THRESHOLDS;
  function pick(key: keyof typeof def): number {
    if (!Object.prototype.hasOwnProperty.call(o, key)) return def[key];
    const n = Math.floor(Number(o[key]));
    return Number.isFinite(n) && n >= 0 ? n : def[key];
  }
  return {
    ads: pick("ads"),
    pptMatches: pick("pptMatches"),
    quizMatches: pick("quizMatches"),
    reactionMatches: pick("reactionMatches"),
  };
}

/** Valor em `system_configs/economy.avatarUploadRequireReputation`. */
export function isAvatarUploadReputationEnabled(
  config: Partial<SystemEconomyConfig> | null | undefined,
): boolean {
  return config?.avatarUploadRequireReputation === true;
}

export function getAvatarUploadProgress(profile: UserProfile | null | undefined) {
  return {
    ads: Math.max(0, Math.floor(Number(profile?.totalAdsAssistidos) || 0)),
    pptMatches: Math.max(0, Math.floor(Number(profile?.totalPptPartidas) || 0)),
    quizMatches: Math.max(0, Math.floor(Number(profile?.totalQuizPartidas) || 0)),
    reactionMatches: Math.max(0, Math.floor(Number(profile?.totalReactionPartidas) || 0)),
  };
}

export function getAvatarUploadMissingRequirements(
  profile: UserProfile | null | undefined,
  reputationEnabled: boolean,
  thresholds: AvatarUploadReputationThresholdsResolved,
) {
  if (!reputationEnabled) return [];

  const progress = getAvatarUploadProgress(profile);
  const req = thresholds;

  return [
    progress.ads < req.ads ? `assistir ${req.ads - progress.ads} anúncio(s)` : null,
    progress.pptMatches < req.pptMatches
      ? `jogar ${req.pptMatches - progress.pptMatches} partida(s) PPT`
      : null,
    progress.quizMatches < req.quizMatches
      ? `jogar ${req.quizMatches - progress.quizMatches} partida(s) QUIZ`
      : null,
    progress.reactionMatches < req.reactionMatches
      ? `jogar ${req.reactionMatches - progress.reactionMatches} partida(s) REACTION`
      : null,
  ].filter((item): item is string => Boolean(item));
}

export function canUploadCustomAvatar(
  profile: UserProfile | null | undefined,
  reputationEnabled: boolean,
  thresholds: AvatarUploadReputationThresholdsResolved,
): boolean {
  return getAvatarUploadMissingRequirements(profile, reputationEnabled, thresholds).length === 0;
}
