"use client";

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS, SUBCOLLECTIONS } from "@/lib/constants/collections";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { callFunction } from "@/services/callables/client";
import { getWeeklyPeriodKey } from "@/utils/date";
import type {
  ChangeClanMemberRoleInput,
  Clan,
  ClanMemberShowcaseRow,
  ClanJoinRequest,
  ClanMember,
  ClanMembership,
  ClanMessage,
  ClanWeeklyContributor,
  CreateClanInput,
  JoinClanByCodeResult,
  JoinClanByCodeInput,
  KickClanMemberInput,
  RequestClanAccessInput,
  ReviewClanJoinRequestInput,
  SendClanMessageInput,
  TransferClanOwnershipInput,
  UpdateClanSettingsInput,
} from "@/types/clan";

function clampCoverPosition(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 50;
  return Math.min(100, Math.max(0, Math.round(num)));
}

function clampCoverScale(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 100;
  return Math.min(220, Math.max(100, Math.round(num)));
}

function normalizeClan(id: string, raw: Record<string, unknown>): Clan {
  return {
    id,
    name: String(raw.name || "Clã"),
    tag: String(raw.tag || "TAG"),
    description: typeof raw.description === "string" ? raw.description : "",
    avatarUrl: typeof raw.avatarUrl === "string" ? raw.avatarUrl : null,
    coverUrl: typeof raw.coverUrl === "string" ? raw.coverUrl : null,
    coverPositionX: clampCoverPosition(raw.coverPositionX),
    coverPositionY: clampCoverPosition(raw.coverPositionY),
    coverScale: clampCoverScale(raw.coverScale),
    ownerUid: String(raw.ownerUid || ""),
    inviteCode: String(raw.inviteCode || ""),
    privacy: raw.privacy === "open" ? "open" : "code_only",
    memberCount: Math.max(0, Math.floor(Number(raw.memberCount) || 0)),
    maxMembers: Math.max(1, Math.floor(Number(raw.maxMembers) || 30)),
    scoreTotal: Math.max(0, Math.floor(Number(raw.scoreTotal) || 0)),
    scoreDaily: Math.max(0, Math.floor(Number(raw.scoreDaily) || 0)),
    scoreWeekly: Math.max(0, Math.floor(Number(raw.scoreWeekly) || 0)),
    scoreMonthly: Math.max(0, Math.floor(Number(raw.scoreMonthly) || 0)),
    scoreTotalWins: Math.max(0, Math.floor(Number(raw.scoreTotalWins) || 0)),
    scoreDailyWins: Math.max(0, Math.floor(Number(raw.scoreDailyWins) || 0)),
    scoreWeeklyWins: Math.max(0, Math.floor(Number(raw.scoreWeeklyWins) || 0)),
    scoreMonthlyWins: Math.max(0, Math.floor(Number(raw.scoreMonthlyWins) || 0)),
    scoreTotalAds: Math.max(0, Math.floor(Number(raw.scoreTotalAds) || 0)),
    scoreDailyAds: Math.max(0, Math.floor(Number(raw.scoreDailyAds) || 0)),
    scoreWeeklyAds: Math.max(0, Math.floor(Number(raw.scoreWeeklyAds) || 0)),
    scoreMonthlyAds: Math.max(0, Math.floor(Number(raw.scoreMonthlyAds) || 0)),
    scoreDailyKey: typeof raw.scoreDailyKey === "string" ? raw.scoreDailyKey : "",
    scoreWeeklyKey: typeof raw.scoreWeeklyKey === "string" ? raw.scoreWeeklyKey : "",
    scoreMonthlyKey: typeof raw.scoreMonthlyKey === "string" ? raw.scoreMonthlyKey : "",
    lastScoreAt: (raw.lastScoreAt ?? null) as Clan["lastScoreAt"],
    joinRequestsReceivedCount: Math.max(0, Math.floor(Number(raw.joinRequestsReceivedCount) || 0)),
    joinRequestsApprovedCount: Math.max(0, Math.floor(Number(raw.joinRequestsApprovedCount) || 0)),
    joinRequestsRejectedCount: Math.max(0, Math.floor(Number(raw.joinRequestsRejectedCount) || 0)),
    lastMessageAt: (raw.lastMessageAt ?? null) as Clan["lastMessageAt"],
    createdAt: (raw.createdAt ?? null) as Clan["createdAt"],
    updatedAt: (raw.updatedAt ?? null) as Clan["updatedAt"],
  };
}

function normalizeMembership(id: string, raw: Record<string, unknown>): ClanMembership {
  return {
    uid: id,
    clanId: String(raw.clanId || ""),
    role: raw.role === "owner" || raw.role === "leader" ? raw.role : "member",
    joinedAt: (raw.joinedAt ?? null) as ClanMembership["joinedAt"],
    lastReadAt: (raw.lastReadAt ?? null) as ClanMembership["lastReadAt"],
    updatedAt: (raw.updatedAt ?? null) as ClanMembership["updatedAt"],
  };
}

function normalizeMember(snapshot: QueryDocumentSnapshot): ClanMember {
  const raw = snapshot.data() as Record<string, unknown>;
  return {
    uid: snapshot.id,
    clanId: String(raw.clanId || ""),
    role: raw.role === "owner" || raw.role === "leader" ? raw.role : "member",
    nome: String(raw.nome || "Jogador"),
    username: typeof raw.username === "string" ? raw.username : null,
    foto: typeof raw.foto === "string" ? raw.foto : null,
    joinedAt: (raw.joinedAt ?? null) as ClanMember["joinedAt"],
    lastActiveAt: (raw.lastActiveAt ?? null) as ClanMember["lastActiveAt"],
    updatedAt: (raw.updatedAt ?? null) as ClanMember["updatedAt"],
  };
}

function normalizeMessage(snapshot: QueryDocumentSnapshot): ClanMessage {
  const raw = snapshot.data() as Record<string, unknown>;
  return {
    id: snapshot.id,
    clanId: String(raw.clanId || ""),
    authorUid: typeof raw.authorUid === "string" ? raw.authorUid : null,
    authorName: String(raw.authorName || "Sistema"),
    authorUsername: typeof raw.authorUsername === "string" ? raw.authorUsername : null,
    authorPhoto: typeof raw.authorPhoto === "string" ? raw.authorPhoto : null,
    text: String(raw.text || ""),
    kind: raw.kind === "text" ? "text" : "system",
    systemType: typeof raw.systemType === "string" ? raw.systemType : null,
    createdAt: (raw.createdAt ?? null) as ClanMessage["createdAt"],
    updatedAt: (raw.updatedAt ?? null) as ClanMessage["updatedAt"],
  };
}

function normalizeClanWeeklyContributor(snapshot: QueryDocumentSnapshot): ClanWeeklyContributor {
  const raw = snapshot.data() as Record<string, unknown>;
  return {
    uid: snapshot.id,
    clanId: String(raw.clanId || ""),
    periodKey: typeof raw.periodKey === "string" ? raw.periodKey : "",
    score: Math.max(0, Math.floor(Number(raw.score) || 0)),
    wins: Math.max(0, Math.floor(Number(raw.wins) || 0)),
    ads: Math.max(0, Math.floor(Number(raw.ads) || 0)),
    updatedAt: (raw.updatedAt ?? null) as ClanWeeklyContributor["updatedAt"],
  };
}

function normalizeJoinRequest(id: string, raw: Record<string, unknown>): ClanJoinRequest {
  return {
    id,
    userId: String(raw.userId || id),
    clanId: String(raw.clanId || ""),
    clanName: String(raw.clanName || "Clã"),
    clanTag: String(raw.clanTag || "TAG"),
    requestedByCode: typeof raw.requestedByCode === "string" ? raw.requestedByCode : null,
    status:
      raw.status === "approved" ||
      raw.status === "rejected" ||
      raw.status === "cancelled"
        ? raw.status
        : "pending",
    userName: String(raw.userName || "Jogador"),
    username: typeof raw.username === "string" ? raw.username : null,
    photoURL: typeof raw.photoURL === "string" ? raw.photoURL : null,
    requestedAt: (raw.requestedAt ?? null) as ClanJoinRequest["requestedAt"],
    updatedAt: (raw.updatedAt ?? null) as ClanJoinRequest["updatedAt"],
    reviewedAt: (raw.reviewedAt ?? null) as ClanJoinRequest["reviewedAt"],
    reviewedByUid: typeof raw.reviewedByUid === "string" ? raw.reviewedByUid : null,
    reviewedByName: typeof raw.reviewedByName === "string" ? raw.reviewedByName : null,
  };
}

export function subscribeMyClanMembership(
  uid: string,
  onNext: (membership: ClanMembership | null) => void,
): Unsubscribe {
  return onSnapshot(doc(getFirebaseFirestore(), COLLECTIONS.clanMemberships, uid), (snapshot) => {
    if (!snapshot.exists()) {
      onNext(null);
      return;
    }
    onNext(normalizeMembership(snapshot.id, snapshot.data() as Record<string, unknown>));
  });
}

export function subscribeClan(clanId: string, onNext: (clan: Clan | null) => void): Unsubscribe {
  return onSnapshot(doc(getFirebaseFirestore(), COLLECTIONS.clans, clanId), (snapshot) => {
    if (!snapshot.exists()) {
      onNext(null);
      return;
    }
    onNext(normalizeClan(snapshot.id, snapshot.data() as Record<string, unknown>));
  });
}

export function subscribeDiscoverableClans(
  onNext: (clans: Clan[]) => void,
  maxItems = 24,
): Unsubscribe {
  const clansRef = collection(getFirebaseFirestore(), COLLECTIONS.clans);
  const clansQuery = query(clansRef, orderBy("updatedAt", "desc"), limit(maxItems));
  return onSnapshot(clansQuery, (snapshot) => {
    onNext(
      snapshot.docs
        .map((docSnap) => normalizeClan(docSnap.id, docSnap.data() as Record<string, unknown>))
        .filter((item) => item.memberCount < item.maxMembers),
    );
  });
}

/** Uma só subscrição Firestore partilhada por todos os consumidores (evita listens duplicados). */
const clanRankingBoardMulticast: {
  listeners: Set<(clans: Clan[]) => void>;
  unsub: Unsubscribe | null;
  last: Clan[];
} = {
  listeners: new Set(),
  unsub: null,
  last: [],
};

function ensureClanRankingBoardListener(): void {
  if (clanRankingBoardMulticast.unsub) return;
  const clansRef = collection(getFirebaseFirestore(), COLLECTIONS.clans);
  clanRankingBoardMulticast.unsub = onSnapshot(clansRef, (snapshot) => {
    clanRankingBoardMulticast.last = snapshot.docs.map((docSnap) =>
      normalizeClan(docSnap.id, docSnap.data() as Record<string, unknown>),
    );
    for (const listener of clanRankingBoardMulticast.listeners) {
      listener(clanRankingBoardMulticast.last);
    }
  });
}

export function subscribeClanRankingBoard(onNext: (clans: Clan[]) => void): Unsubscribe {
  clanRankingBoardMulticast.listeners.add(onNext);
  if (clanRankingBoardMulticast.last.length > 0) {
    onNext(clanRankingBoardMulticast.last);
  }
  ensureClanRankingBoardListener();
  return () => {
    clanRankingBoardMulticast.listeners.delete(onNext);
    if (clanRankingBoardMulticast.listeners.size === 0) {
      clanRankingBoardMulticast.unsub?.();
      clanRankingBoardMulticast.unsub = null;
      clanRankingBoardMulticast.last = [];
    }
  };
}

export function subscribeClanMembers(
  clanId: string,
  onNext: (members: ClanMember[]) => void,
): Unsubscribe {
  const membersRef = collection(
    getFirebaseFirestore(),
    COLLECTIONS.clans,
    clanId,
    SUBCOLLECTIONS.clanMembers,
  );
  const membersQuery = query(membersRef, orderBy("joinedAt", "asc"));
  return onSnapshot(membersQuery, (snapshot) => {
    onNext(snapshot.docs.map(normalizeMember));
  });
}

export function subscribeClanWeeklyContributors(
  clanId: string,
  onNext: (contributors: ClanWeeklyContributor[]) => void,
  periodKey = getWeeklyPeriodKey(),
): Unsubscribe {
  const contributorsRef = collection(
    getFirebaseFirestore(),
    COLLECTIONS.clanRankingsWeekly,
    periodKey,
    COLLECTIONS.clans,
    clanId,
    SUBCOLLECTIONS.clanContributors,
  );
  return onSnapshot(contributorsRef, (snapshot) => {
    onNext(snapshot.docs.map(normalizeClanWeeklyContributor));
  });
}

export function subscribeClanMessages(
  clanId: string,
  onNext: (messages: ClanMessage[]) => void,
): Unsubscribe {
  const messagesRef = collection(
    getFirebaseFirestore(),
    COLLECTIONS.clans,
    clanId,
    SUBCOLLECTIONS.clanMessages,
  );
  const messagesQuery = query(messagesRef, orderBy("createdAt", "desc"), limit(40));
  return onSnapshot(messagesQuery, (snapshot) => {
    onNext(snapshot.docs.map(normalizeMessage).reverse());
  });
}

export function subscribeMyClanJoinRequest(
  uid: string,
  onNext: (request: ClanJoinRequest | null) => void,
): Unsubscribe {
  return onSnapshot(doc(getFirebaseFirestore(), COLLECTIONS.clanJoinRequests, uid), (snapshot) => {
    if (!snapshot.exists()) {
      onNext(null);
      return;
    }
    onNext(normalizeJoinRequest(snapshot.id, snapshot.data() as Record<string, unknown>));
  });
}

export function subscribeClanJoinRequests(
  clanId: string,
  onNext: (requests: ClanJoinRequest[]) => void,
): Unsubscribe {
  const requestsRef = collection(
    getFirebaseFirestore(),
    COLLECTIONS.clans,
    clanId,
    SUBCOLLECTIONS.clanJoinRequests,
  );
  return onSnapshot(requestsRef, (snapshot) => {
    onNext(
      snapshot.docs
        .map((docSnap) =>
          normalizeJoinRequest(docSnap.id, docSnap.data() as Record<string, unknown>),
        )
        .filter((item) => item.status === "pending")
        .sort((a, b) => timestampToMs(a.requestedAt) - timestampToMs(b.requestedAt))
        .slice(0, 50),
    );
  });
}

function timestampToMs(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  return 0;
}

async function callClanFunction<TReq extends Record<string, unknown>, TRes>(
  name:
    | "createClan"
    | "joinClanByCode"
    | "requestClanAccess"
    | "leaveClan"
    | "sendClanMessage"
    | "markClanChatRead"
    | "updateClanSettings"
    | "getClanMemberShowcase"
    | "changeClanMemberRole"
    | "transferClanOwnership"
    | "approveClanJoinRequest"
    | "rejectClanJoinRequest"
    | "cancelClanJoinRequest"
    | "kickClanMember",
  data: TReq,
): Promise<TRes> {
  try {
    const result = await callFunction<TReq, TRes>(name, data);
    return result.data;
  } catch (error) {
    throw new Error(formatFirebaseError(error));
  }
}

export async function createClan(input: CreateClanInput): Promise<{ ok: boolean; clanId: string }> {
  return callClanFunction<CreateClanInput, { ok: boolean; clanId: string }>("createClan", input);
}

export async function joinClanByCode(
  input: JoinClanByCodeInput,
): Promise<JoinClanByCodeResult> {
  return callClanFunction<JoinClanByCodeInput, JoinClanByCodeResult>(
    "joinClanByCode",
    input,
  );
}

export async function requestClanAccess(
  input: RequestClanAccessInput,
): Promise<JoinClanByCodeResult> {
  return callClanFunction<RequestClanAccessInput, JoinClanByCodeResult>(
    "requestClanAccess",
    input,
  );
}

export async function leaveClan(): Promise<{ ok: boolean; dissolved?: boolean }> {
  return callClanFunction<Record<string, never>, { ok: boolean; dissolved?: boolean }>("leaveClan", {});
}

export async function sendClanMessage(
  input: SendClanMessageInput,
): Promise<{ ok: boolean; messageId: string }> {
  return callClanFunction<SendClanMessageInput, { ok: boolean; messageId: string }>(
    "sendClanMessage",
    input,
  );
}

export async function markClanChatRead(input: {
  clanId: string;
}): Promise<{ ok: boolean }> {
  return callClanFunction<{ clanId: string }, { ok: boolean }>("markClanChatRead", input);
}

export async function updateClanSettings(input: UpdateClanSettingsInput): Promise<{ ok: boolean }> {
  return callClanFunction<UpdateClanSettingsInput, { ok: boolean }>("updateClanSettings", input);
}

export async function fetchClanMemberShowcase(input: {
  clanId: string;
}): Promise<{ ok: boolean; rows: ClanMemberShowcaseRow[] }> {
  return callClanFunction<{ clanId: string }, { ok: boolean; rows: ClanMemberShowcaseRow[] }>(
    "getClanMemberShowcase",
    input,
  );
}

export async function changeClanMemberRole(
  input: ChangeClanMemberRoleInput,
): Promise<{ ok: boolean }> {
  return callClanFunction<ChangeClanMemberRoleInput, { ok: boolean }>(
    "changeClanMemberRole",
    input,
  );
}

export async function transferClanOwnership(
  input: TransferClanOwnershipInput,
): Promise<{ ok: boolean }> {
  return callClanFunction<TransferClanOwnershipInput, { ok: boolean }>(
    "transferClanOwnership",
    input,
  );
}

export async function approveClanJoinRequest(
  input: ReviewClanJoinRequestInput,
): Promise<{ ok: boolean; clanId: string }> {
  return callClanFunction<ReviewClanJoinRequestInput, { ok: boolean; clanId: string }>(
    "approveClanJoinRequest",
    input,
  );
}

export async function rejectClanJoinRequest(
  input: ReviewClanJoinRequestInput,
): Promise<{ ok: boolean }> {
  return callClanFunction<ReviewClanJoinRequestInput, { ok: boolean }>(
    "rejectClanJoinRequest",
    input,
  );
}

export async function cancelClanJoinRequest(): Promise<{ ok: boolean }> {
  return callClanFunction<Record<string, never>, { ok: boolean }>("cancelClanJoinRequest", {});
}

export async function kickClanMember(input: KickClanMemberInput): Promise<{ ok: boolean }> {
  return callClanFunction<KickClanMemberInput, { ok: boolean }>("kickClanMember", input);
}
