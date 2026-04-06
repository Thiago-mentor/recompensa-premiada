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
import type {
  ReferralCampaign,
  ReferralRankingEntry,
  ReferralRankingPeriod,
  ReferralRecord,
  ReferralSystemConfig,
} from "@/types/referral";

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
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  if (period === "daily") return `${yyyy}-${mm}-${dd}`;
  if (period === "monthly") return `${yyyy}-${mm}`;
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+t - +yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
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
  return onSnapshot(
    query(
      collection(db, COLLECTIONS.referrals),
      where("inviterUserId", "==", inviterUserId),
      orderBy("createdAt", "desc"),
      limit(50),
    ),
    (snap) => {
      onNext(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as ReferralRecord));
    },
    () => onNext([]),
  );
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
  const db = getFirebaseFirestore();
  const periodKey = referralRankingPeriodKey(period);
  const snap = await getDocs(
    query(
      collection(doc(db, referralRankingCollection(period), periodKey), "entries"),
      orderBy("validReferrals", "desc"),
      limit(topN),
    ),
  );
  return snap.docs.map((item) => ({ userId: item.id, ...item.data() }) as ReferralRankingEntry);
}

export async function fetchMyReferralRankingEntry(
  period: ReferralRankingPeriod,
  userId: string,
): Promise<ReferralRankingEntry | null> {
  const db = getFirebaseFirestore();
  const periodKey = referralRankingPeriodKey(period);
  const snap = await getDoc(doc(db, referralRankingCollection(period), periodKey, "entries", userId));
  if (!snap.exists()) return null;
  return { userId: snap.id, ...snap.data() } as ReferralRankingEntry;
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
