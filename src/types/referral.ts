import type { Timestamp } from "./firestore";

export type ReferralStatus = "pending" | "valid" | "rewarded" | "blocked" | "invalid";
export type ReferralRankingPeriod = "daily" | "weekly" | "monthly" | "all";
export type ReferralRewardCurrency = "coins" | "gems" | "rewardBalance";

export interface ReferralFraudFlags {
  suspectedFraud: boolean;
  selfReferralBlocked: boolean;
  duplicateRewardBlocked: boolean;
  manualReviewRequired: boolean;
  sameIpFlag: boolean;
}

export interface ReferralQualificationProgress {
  emailVerified: boolean;
  profileCompleted: boolean;
  adsWatched: number;
  matchesPlayed: number;
  missionRewardsClaimed: number;
  updatedAt?: Timestamp | null;
}

/** `referrals/{invitedUserId}` — convite rastreado */
export interface ReferralRecord {
  id: string;
  inviterUserId: string;
  inviterCode: string;
  inviterName?: string | null;
  invitedUserId: string;
  invitedUserName?: string | null;
  invitedUserEmail?: string | null;
  invitedByCode: string;
  invitedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: ReferralStatus;
  referralStatus: ReferralStatus;
  referralQualified: boolean;
  referralRewardGiven: boolean;
  inviterRewardAmount?: number;
  inviterRewardCurrency?: ReferralRewardCurrency | null;
  invitedRewardAmount?: number;
  invitedRewardCurrency?: ReferralRewardCurrency | null;
  inviterRewardCoins: number;
  invitedRewardCoins: number;
  inviterRewardGrantedAt?: Timestamp | null;
  invitedRewardGrantedAt?: Timestamp | null;
  qualifiedAt?: Timestamp | null;
  rewardedAt?: Timestamp | null;
  campaignId?: string | null;
  campaignName?: string | null;
  inviteSource?: string | null;
  qualificationSnapshot?: ReferralQualificationRules | null;
  progressSnapshot?: ReferralQualificationProgress | null;
  fraudFlags: ReferralFraudFlags;
  notes?: string | null;
}

export interface ReferralQualificationRules {
  requireEmailVerified: boolean;
  requireProfileCompleted: boolean;
  minAdsWatched: number;
  minMatchesPlayed: number;
  minMissionRewardsClaimed: number;
}

export interface ReferralRankingPrizeTier {
  posicaoMax: number;
  amount: number;
  currency: ReferralRewardCurrency;
}

export interface ReferralCampaignConfig {
  inviterRewardAmount: number;
  inviterRewardCurrency: ReferralRewardCurrency;
  invitedRewardAmount: number;
  invitedRewardCurrency: ReferralRewardCurrency;
  invitedRewardEnabled: boolean;
  qualificationRules: ReferralQualificationRules;
  rankingPrizes: {
    daily: ReferralRankingPrizeTier[];
    weekly: ReferralRankingPrizeTier[];
    monthly: ReferralRankingPrizeTier[];
    all: ReferralRankingPrizeTier[];
  };
}

export interface ReferralCampaign {
  id: string;
  name: string;
  description: string;
  regulationText?: string | null;
  startAt: Timestamp | null;
  endAt: Timestamp | null;
  isActive: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  config: ReferralCampaignConfig;
}

export interface ReferralRankingEntry {
  userId: string;
  userName: string;
  photoURL?: string | null;
  validReferrals: number;
  pendingReferrals: number;
  rewardedReferrals: number;
  blockedReferrals: number;
  totalRewards: number;
  updatedAt?: Timestamp | null;
}

export interface ReferralSystemConfig {
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
  antiFraudRules: {
    blockSelfReferral: boolean;
    flagBurstSignups: boolean;
    burstSignupThreshold: number;
    requireManualReviewForSuspected: boolean;
  };
  rankingRules: {
    daily: ReferralRankingPrizeTier[];
    weekly: ReferralRankingPrizeTier[];
    monthly: ReferralRankingPrizeTier[];
    all: ReferralRankingPrizeTier[];
  };
  activeCampaignId?: string | null;
  campaignText?: string | null;
  updatedAt?: Timestamp | null;
}
