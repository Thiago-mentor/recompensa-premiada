import type { Timestamp } from "./firestore";

export type ClanPrivacy = "open" | "code_only";
export type ClanRole = "owner" | "leader" | "member";
export type ClanMessageKind = "text" | "system";
export type ClanJoinRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface Clan {
  id: string;
  name: string;
  tag: string;
  description: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  coverPositionX: number;
  coverPositionY: number;
  coverScale: number;
  ownerUid: string;
  inviteCode: string;
  privacy: ClanPrivacy;
  memberCount: number;
  maxMembers: number;
  scoreTotal: number;
  scoreDaily: number;
  scoreWeekly: number;
  scoreMonthly: number;
  scoreTotalWins: number;
  scoreDailyWins: number;
  scoreWeeklyWins: number;
  scoreMonthlyWins: number;
  scoreTotalAds: number;
  scoreDailyAds: number;
  scoreWeeklyAds: number;
  scoreMonthlyAds: number;
  scoreDailyKey: string;
  scoreWeeklyKey: string;
  scoreMonthlyKey: string;
  lastScoreAt?: Timestamp | null;
  joinRequestsReceivedCount: number;
  joinRequestsApprovedCount: number;
  joinRequestsRejectedCount: number;
  lastMessageAt?: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ClanMembership {
  uid: string;
  clanId: string;
  role: ClanRole;
  joinedAt: Timestamp | null;
  lastReadAt?: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ClanMember {
  uid: string;
  clanId: string;
  role: ClanRole;
  nome: string;
  username: string | null;
  foto: string | null;
  joinedAt: Timestamp | null;
  lastActiveAt?: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ClanWeeklyContributor {
  uid: string;
  clanId: string;
  periodKey: string;
  score: number;
  wins: number;
  ads: number;
  updatedAt: Timestamp | null;
}

export interface ClanMessage {
  id: string;
  clanId: string;
  authorUid: string | null;
  authorName: string;
  authorUsername: string | null;
  authorPhoto: string | null;
  text: string;
  kind: ClanMessageKind;
  systemType: string | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ClanJoinRequest {
  id: string;
  userId: string;
  clanId: string;
  clanName: string;
  clanTag: string;
  requestedByCode: string | null;
  status: ClanJoinRequestStatus;
  userName: string;
  username: string | null;
  photoURL: string | null;
  requestedAt: Timestamp | null;
  updatedAt: Timestamp | null;
  reviewedAt: Timestamp | null;
  reviewedByUid: string | null;
  reviewedByName: string | null;
}

export type CreateClanInput = {
  name: string;
  tag: string;
  description: string;
  privacy: ClanPrivacy;
};

export type JoinClanByCodeInput = {
  code: string;
};

export type RequestClanAccessInput = {
  clanId: string;
};

export type SendClanMessageInput = {
  clanId: string;
  text: string;
};

export type UpdateClanSettingsInput = {
  clanId: string;
  name?: string;
  tag?: string;
  inviteCode?: string;
  description: string;
  privacy: ClanPrivacy;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  coverPositionX?: number;
  coverPositionY?: number;
  coverScale?: number;
};

export type JoinClanByCodeResult = {
  ok: boolean;
  clanId: string;
  status: "joined" | "pending";
};

export type ChangeClanMemberRoleInput = {
  clanId: string;
  targetUid: string;
  role: Exclude<ClanRole, "owner">;
};

export type TransferClanOwnershipInput = {
  clanId: string;
  targetUid: string;
};

export type ReviewClanJoinRequestInput = {
  clanId: string;
  targetUid: string;
};

export type KickClanMemberInput = {
  clanId: string;
  targetUid: string;
};

export type ClanMemberShowcaseMetric = {
  total: number;
  weekly: number;
};

export type ClanMemberShowcaseRow = {
  uid: string;
  ppt: ClanMemberShowcaseMetric;
  quiz: ClanMemberShowcaseMetric;
  reaction: ClanMemberShowcaseMetric;
  ads: ClanMemberShowcaseMetric;
};
