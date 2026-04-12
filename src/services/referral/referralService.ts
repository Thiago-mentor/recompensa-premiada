"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { callFunction } from "@/services/callables/client";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { getDailyPeriodKey, getMonthlyPeriodKey, getWeeklyPeriodKey } from "@/utils/date";
import type {
  ReferralCampaign,
  ReferralRankingEntry,
  ReferralRankingPeriod,
  ReferralRecord,
  ReferralSystemConfig,
} from "@/types/referral";

function referralTimestampToMillis(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  if ("toMillis" in value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  if ("toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return 0;
    }
  }
  return 0;
}

function sortReferralRows(rows: ReferralRecord[]): ReferralRecord[] {
  return [...rows].sort((a, b) => {
    const bMs = Math.max(
      referralTimestampToMillis(b.createdAt),
      referralTimestampToMillis(b.invitedAt),
      referralTimestampToMillis(b.updatedAt),
    );
    const aMs = Math.max(
      referralTimestampToMillis(a.createdAt),
      referralTimestampToMillis(a.invitedAt),
      referralTimestampToMillis(a.updatedAt),
    );
    return bMs - aMs;
  });
}

function referralRankingCollection(period: ReferralRankingPeriod): string {
  switch (period) {
    case "daily":
      return COLLECTIONS.referralRankingsDaily;
    case "weekly":
      return COLLECTIONS.referralRankingsWeekly;
    case "monthly":
      return COLLECTIONS.referralRankingsMonthly;
    case "all":
    default:
      return COLLECTIONS.referralRankingsAllTime;
  }
}

function referralRankingPeriodKey(period: ReferralRankingPeriod): string {
  if (period === "all") return "global";
  if (period === "daily") return getDailyPeriodKey();
  if (period === "monthly") return getMonthlyPeriodKey();
  return getWeeklyPeriodKey();
}

/** Chaves legadas / alternativas para o ranking acumulado (compatível com dados antigos). */
const REFERRAL_RANKING_ALLTIME_PERIOD_KEYS = ["global", "all"] as const;

function normalizeReferralRankingDoc(docId: string, raw: Record<string, unknown>): ReferralRankingEntry {
  return {
    userId: typeof raw.userId === "string" && raw.userId ? raw.userId : docId,
    userName: typeof raw.userName === "string" && raw.userName.trim() ? raw.userName : "Participante",
    photoURL: raw.photoURL != null && raw.photoURL !== "" ? (raw.photoURL as string | null) : null,
    validReferrals: Math.max(0, Math.floor(Number(raw.validReferrals) || 0)),
    pendingReferrals: Math.max(0, Math.floor(Number(raw.pendingReferrals) || 0)),
    rewardedReferrals: Math.max(0, Math.floor(Number(raw.rewardedReferrals) || 0)),
    blockedReferrals: Math.max(0, Math.floor(Number(raw.blockedReferrals) || 0)),
    totalRewards: Math.max(0, Math.floor(Number(raw.totalRewards) || 0)),
    updatedAt: raw.updatedAt as ReferralRankingEntry["updatedAt"],
  };
}

function sortRankingEntries(rows: ReferralRankingEntry[]): ReferralRankingEntry[] {
  return [...rows].sort((a, b) => {
    if (b.validReferrals !== a.validReferrals) return b.validReferrals - a.validReferrals;
    if (b.totalRewards !== a.totalRewards) return b.totalRewards - a.totalRewards;
    return String(a.userId).localeCompare(String(b.userId));
  });
}

async function loadReferralRankingForPeriodKey(
  collName: string,
  periodKey: string,
  topN: number,
): Promise<ReferralRankingEntry[]> {
  const db = getFirebaseFirestore();
  const snap = await getDocs(
    query(
      collection(doc(db, collName, periodKey), "entries"),
      orderBy("validReferrals", "desc"),
      limit(topN),
    ),
  );
  const rows = snap.docs.map((item) => normalizeReferralRankingDoc(item.id, item.data() as Record<string, unknown>));
  return sortRankingEntries(rows);
}

export async function fetchReferralSystemConfig(): Promise<ReferralSystemConfig | null> {
  const db = getFirebaseFirestore();
  const snap = await getDoc(doc(db, COLLECTIONS.systemConfigs, "referral_system"));
  if (!snap.exists()) return null;
  return snap.data() as ReferralSystemConfig;
}

export async function fetchReferralCampaigns(): Promise<ReferralCampaign[]> {
  const db = getFirebaseFirestore();
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.referralCampaigns), orderBy("startAt", "desc"), limit(20)),
  );
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }) as ReferralCampaign);
}

export async function fetchActiveReferralCampaign(): Promise<ReferralCampaign | null> {
  const campaigns = await fetchReferralCampaigns();
  const now = Date.now();
  return (
    campaigns.find((campaign) => {
      if (!campaign.isActive) return false;
      const startAt =
        campaign.startAt && typeof campaign.startAt === "object" && "toMillis" in campaign.startAt
          ? campaign.startAt.toMillis()
          : null;
      const endAt =
        campaign.endAt && typeof campaign.endAt === "object" && "toMillis" in campaign.endAt
          ? campaign.endAt.toMillis()
          : null;
      if (startAt && now < startAt) return false;
      if (endAt && now > endAt) return false;
      return true;
    }) ?? null
  );
}

export function subscribeInvitedReferrals(
  inviterUserId: string,
  onNext: (rows: ReferralRecord[]) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  let unsubscribe: Unsubscribe | null = null;

  function subscribe(withOrderBy: boolean): Unsubscribe {
    return onSnapshot(
      withOrderBy
        ? query(
            collection(db, COLLECTIONS.referrals),
            where("inviterUserId", "==", inviterUserId),
            orderBy("createdAt", "desc"),
            limit(50),
          )
        : query(
            collection(db, COLLECTIONS.referrals),
            where("inviterUserId", "==", inviterUserId),
            limit(200),
          ),
      (snap) => {
        const rows = snap.docs.map((item) => ({ id: item.id, ...item.data() }) as ReferralRecord);
        onNext(withOrderBy ? rows : sortReferralRows(rows).slice(0, 50));
      },
      (error) => {
        if (withOrderBy) {
          console.warn("[Referral] Falha na query ordenada de convidados; usando fallback sem índice.", error);
          unsubscribe = subscribe(false);
          return;
        }
        console.error("[Referral] Falha ao carregar convidados.", error);
        onNext([]);
      },
    );
  }

  unsubscribe = subscribe(true);
  return () => {
    unsubscribe?.();
  };
}

export function subscribeReferralAsInvited(
  invitedUserId: string,
  onNext: (row: ReferralRecord | null) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  return onSnapshot(doc(db, COLLECTIONS.referrals, invitedUserId), (snap) => {
    onNext(snap.exists() ? ({ id: snap.id, ...snap.data() } as ReferralRecord) : null);
  });
}

export async function fetchReferralRankingTop(
  period: ReferralRankingPeriod,
  topN = 20,
): Promise<ReferralRankingEntry[]> {
  const collName = referralRankingCollection(period);
  try {
    if (period === "all") {
      for (const key of REFERRAL_RANKING_ALLTIME_PERIOD_KEYS) {
        try {
          const rows = await loadReferralRankingForPeriodKey(collName, key, topN);
          if (rows.length > 0) return rows;
        } catch {
          /* tenta próxima chave */
        }
      }
      return [];
    }
    return await loadReferralRankingForPeriodKey(collName, referralRankingPeriodKey(period), topN);
  } catch (e) {
    console.warn("[referralService] fetchReferralRankingTop", period, e);
    return [];
  }
}

export async function fetchMyReferralRankingEntry(
  period: ReferralRankingPeriod,
  userId: string,
): Promise<ReferralRankingEntry | null> {
  const db = getFirebaseFirestore();
  const collName = referralRankingCollection(period);
  const keys =
    period === "all" ? [...REFERRAL_RANKING_ALLTIME_PERIOD_KEYS] : [referralRankingPeriodKey(period)];

  for (const periodKey of keys) {
    try {
      const snap = await getDoc(doc(db, collName, periodKey, "entries", userId));
      if (snap.exists()) {
        return normalizeReferralRankingDoc(snap.id, snap.data() as Record<string, unknown>);
      }
    } catch {
      /* próxima chave */
    }
  }
  return null;
}

export async function fetchAdminReferralRows(status?: string): Promise<ReferralRecord[]> {
  const db = getFirebaseFirestore();
  const ref = collection(db, COLLECTIONS.referrals);
  const q = status
    ? query(ref, where("status", "==", status), orderBy("createdAt", "desc"), limit(100))
    : query(ref, orderBy("createdAt", "desc"), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }) as ReferralRecord);
}

export async function processReferralRewardCallable(): Promise<
  | {
      ok: true;
      status: string;
      qualified: boolean;
      rewarded: boolean;
    }
  | {
      ok: false;
      reason?: string;
      error?: string;
    }
> {
  try {
    const res = await callFunction<
      Record<string, never>,
      {
        ok: boolean;
        reason?: string;
        status?: string;
        qualified?: boolean;
        rewarded?: boolean;
      }
    >("processReferralReward", {});
    if (!res.data.ok) {
      return { ok: false, reason: res.data.reason };
    }
    return {
      ok: true,
      status: res.data.status ?? "pending",
      qualified: res.data.qualified === true,
      rewarded: res.data.rewarded === true,
    };
  } catch (error) {
    return { ok: false, error: formatFirebaseError(error) };
  }
}
