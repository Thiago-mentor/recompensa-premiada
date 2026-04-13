import type { DocumentSnapshot } from "firebase/firestore";
import type {
  RaffleAllocationMode,
  RaffleInstantPrizeHitView,
  RaffleInstantPrizeTier,
  RaffleScheduleMode,
  RaffleView,
} from "@/types/raffle";
import {
  clampRaffleMaxPerPurchase,
  clampRaffleReleasedCount,
  clampRaffleTicketPrice,
  computeRaffleResultScheduleMs,
} from "@/utils/raffle";

const RAFFLE_STATUSES: RaffleView["status"][] = [
  "draft",
  "active",
  "closed",
  "drawn",
  "paid",
  "no_winner",
];

function parseStatus(raw: unknown): RaffleView["status"] {
  const s = String(raw || "draft");
  return RAFFLE_STATUSES.includes(s as RaffleView["status"]) ? (s as RaffleView["status"]) : "draft";
}

function tsToMs(v: unknown): number | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { toMillis?: () => number };
  if (typeof o.toMillis === "function") {
    try {
      return o.toMillis();
    } catch {
      return null;
    }
  }
  return null;
}

function parseAllocationMode(raw: unknown): RaffleAllocationMode {
  return raw === "random" ? "random" : "sequential";
}

function parseScheduleMode(raw: unknown, endsAtMs: number | null): RaffleScheduleMode {
  if (raw === "until_sold_out") return "until_sold_out";
  if (raw === "date_range") return "date_range";
  return endsAtMs == null ? "until_sold_out" : "date_range";
}

function parseInstantPrizeCurrency(raw: unknown): RaffleInstantPrizeTier["currency"] {
  return raw === "coins" || raw === "gems" || raw === "rewardBalance" ? raw : "rewardBalance";
}

function parseInstantPrizeTiers(raw: unknown): RaffleInstantPrizeTier[] {
  if (!Array.isArray(raw)) return [];
  const items = raw.map<RaffleInstantPrizeTier | null>((item) => {
      const value = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
      if (!value) return null;
      const quantity = Math.max(0, Math.floor(Number(value.quantity) || 0));
      const amount = Math.max(0, Math.floor(Number(value.amount) || 0));
      if (quantity <= 0 || amount <= 0) return null;
      return {
        quantity,
        amount,
        currency: parseInstantPrizeCurrency(value.currency),
        awardedCount: Math.max(0, Math.floor(Number(value.awardedCount) || 0)),
      } satisfies RaffleInstantPrizeTier;
    });
  return items.filter((item): item is RaffleInstantPrizeTier => item != null);
}

function parseInstantPrizeHits(raw: unknown): RaffleInstantPrizeHitView[] {
  if (!Array.isArray(raw)) return [];
  const items = raw.map<RaffleInstantPrizeHitView | null>((item) => {
      const value = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
      if (!value) return null;
      const purchaseId = typeof value.purchaseId === "string" ? value.purchaseId : "";
      const userId = typeof value.userId === "string" ? value.userId : "";
      const amount = Math.max(0, Math.floor(Number(value.amount) || 0));
      if (!purchaseId || !userId || amount <= 0) return null;
      return {
        number: Math.max(0, Math.floor(Number(value.number) || 0)),
        amount,
        currency: parseInstantPrizeCurrency(value.currency),
        tierIndex: Math.max(0, Math.floor(Number(value.tierIndex) || 0)),
        purchaseId,
        userId,
        winnerName: typeof value.winnerName === "string" ? value.winnerName : null,
        winnerUsername: typeof value.winnerUsername === "string" ? value.winnerUsername : null,
        awardedAtMs: tsToMs(value.awardedAt),
      } satisfies RaffleInstantPrizeHitView;
    });
  return items.filter((item): item is RaffleInstantPrizeHitView => item != null);
}

/** Converte snapshot Firestore do sorteio para o mesmo formato retornado pelas callables. */
export function mapRaffleSnapshotToView(snap: DocumentSnapshot): RaffleView | null {
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  const id = snap.id;
  const prizeCurrencyRaw = d.prizeCurrency;
  const prizeCurrency =
    prizeCurrencyRaw === "gems" || prizeCurrencyRaw === "rewardBalance" || prizeCurrencyRaw === "coins"
      ? prizeCurrencyRaw
      : "coins";
  const startsAtMs = tsToMs(d.startsAt);
  const endsAtMs = tsToMs(d.endsAt);
  const closedAtMs = tsToMs(d.closedAt);
  const drawTimeZone = typeof d.drawTimeZone === "string" ? d.drawTimeZone : null;
  const resultScheduledAtMs =
    tsToMs(d.resultScheduledAt) ?? computeRaffleResultScheduleMs(closedAtMs, drawTimeZone ?? undefined);
  const instantPrizeTiers = parseInstantPrizeTiers(d.instantPrizeTiers);
  const instantPrizeHits = parseInstantPrizeHits(d.instantPrizeHits);

  return {
    id,
    title: String(d.title || "").trim() || "Sorteio",
    description: typeof d.description === "string" ? d.description : null,
    status: parseStatus(d.status),
    releasedCount: clampRaffleReleasedCount(d.releasedCount),
    nextSequentialNumber: Math.max(0, Math.floor(Number(d.nextSequentialNumber) || 0)),
    soldCount: Math.max(0, Math.floor(Number(d.soldCount) || 0)),
    soldTicketsRevenue: Math.max(0, Math.floor(Number(d.soldTicketsRevenue) || 0)),
    ticketPrice: clampRaffleTicketPrice(d.ticketPrice),
    maxPerPurchase: clampRaffleMaxPerPurchase(d.maxPerPurchase),
    prizeCurrency,
    prizeAmount: Math.max(0, Math.floor(Number(d.prizeAmount) || 0)),
    prizeImageUrl:
      typeof d.prizeImageUrl === "string" && d.prizeImageUrl.trim()
        ? d.prizeImageUrl.trim().slice(0, 2048)
        : null,
    startsAtMs,
    endsAtMs,
    scheduleMode: parseScheduleMode(d.scheduleMode, endsAtMs),
    closedAtMs,
    resultScheduledAtMs,
    drawnAtMs: tsToMs(d.drawnAt),
    paidAtMs: tsToMs(d.paidAt),
    winningNumber: d.winningNumber == null ? null : Math.max(0, Math.floor(Number(d.winningNumber) || 0)),
    winnerUserId: typeof d.winnerUserId === "string" ? d.winnerUserId : null,
    winnerPurchaseId: typeof d.winnerPurchaseId === "string" ? d.winnerPurchaseId : null,
    winnerName: typeof d.winnerName === "string" ? d.winnerName : null,
    winnerUsername: typeof d.winnerUsername === "string" ? d.winnerUsername : null,
    instantPrizeTiers,
    instantPrizeHits,
    noWinnerPolicy: "no_payout_close",
    allocationMode: parseAllocationMode(d.allocationMode),
    drawTimeZone,
    createdAtMs: tsToMs(d.createdAt),
    updatedAtMs: tsToMs(d.updatedAt),
  };
}
