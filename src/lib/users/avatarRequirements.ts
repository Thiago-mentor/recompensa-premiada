import type { UserProfile } from "@/types/user";

export const AVATAR_UPLOAD_REQUIREMENTS = {
  ads: 50,
  pptMatches: 10,
  quizMatches: 10,
  reactionMatches: 10,
} as const;

export function getAvatarUploadProgress(profile: UserProfile | null | undefined) {
  return {
    ads: Math.max(0, Math.floor(Number(profile?.totalAdsAssistidos) || 0)),
    pptMatches: Math.max(0, Math.floor(Number(profile?.totalPptPartidas) || 0)),
    quizMatches: Math.max(0, Math.floor(Number(profile?.totalQuizPartidas) || 0)),
    reactionMatches: Math.max(0, Math.floor(Number(profile?.totalReactionPartidas) || 0)),
  };
}

export function getAvatarUploadMissingRequirements(profile: UserProfile | null | undefined) {
  const progress = getAvatarUploadProgress(profile);

  return [
    progress.ads < AVATAR_UPLOAD_REQUIREMENTS.ads
      ? `assistir ${AVATAR_UPLOAD_REQUIREMENTS.ads - progress.ads} anúncio(s)`
      : null,
    progress.pptMatches < AVATAR_UPLOAD_REQUIREMENTS.pptMatches
      ? `jogar ${AVATAR_UPLOAD_REQUIREMENTS.pptMatches - progress.pptMatches} partida(s) PPT`
      : null,
    progress.quizMatches < AVATAR_UPLOAD_REQUIREMENTS.quizMatches
      ? `jogar ${AVATAR_UPLOAD_REQUIREMENTS.quizMatches - progress.quizMatches} partida(s) QUIZ`
      : null,
    progress.reactionMatches < AVATAR_UPLOAD_REQUIREMENTS.reactionMatches
      ? `jogar ${AVATAR_UPLOAD_REQUIREMENTS.reactionMatches - progress.reactionMatches} partida(s) REACTION`
      : null,
  ].filter((item): item is string => Boolean(item));
}

export function canUploadCustomAvatar(profile: UserProfile | null | undefined): boolean {
  return getAvatarUploadMissingRequirements(profile).length === 0;
}
