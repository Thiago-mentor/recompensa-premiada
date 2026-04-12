import type { Timestamp } from "./firestore";
import type { WalletCurrency } from "./wallet";

export type RaffleStatus =
  | "draft"
  | "active"
  | "closed"
  | "drawn"
  | "paid"
  | "no_winner";

export type RaffleNoWinnerPolicy = "no_payout_close";

/** `sequential` = faixa contínua (legado); `random` = números sorteados sem repetição na faixa liberada. */
export type RaffleAllocationMode = "sequential" | "random";
export type RaffleScheduleMode = "date_range" | "until_sold_out";

export type RafflePrizeCurrency = WalletCurrency;

export interface RaffleInstantPrizeTier {
  quantity: number;
  amount: number;
  currency: RafflePrizeCurrency;
  awardedCount?: number;
}

export interface RaffleInstantPrizeHit {
  number: number;
  amount: number;
  currency: RafflePrizeCurrency;
  tierIndex: number;
  purchaseId: string;
  userId: string;
  winnerName?: string | null;
  winnerUsername?: string | null;
}

export interface RaffleInstantPrizeHitView extends RaffleInstantPrizeHit {
  awardedAtMs?: number | null;
}

export interface Raffle {
  id: string;
  title: string;
  description?: string | null;
  status: RaffleStatus;
  releasedCount: number;
  nextSequentialNumber: number;
  soldCount: number;
  soldTicketsRevenue: number;
  ticketPrice: number;
  maxPerPurchase: number;
  prizeCurrency: RafflePrizeCurrency;
  prizeAmount: number;
  /** URL da imagem do prêmio (opcional). */
  prizeImageUrl?: string | null;
  startsAt: Timestamp | null;
  endsAt: Timestamp | null;
  scheduleMode?: RaffleScheduleMode;
  closedAt?: Timestamp | null;
  resultScheduledAt?: Timestamp | null;
  drawnAt?: Timestamp | null;
  paidAt?: Timestamp | null;
  winningNumber?: number | null;
  winnerUserId?: string | null;
  winnerPurchaseId?: string | null;
  winnerName?: string | null;
  winnerUsername?: string | null;
  instantPrizeTiers?: RaffleInstantPrizeTier[];
  instantPrizeHits?: RaffleInstantPrizeHit[];
  noWinnerPolicy: RaffleNoWinnerPolicy;
  allocationMode?: RaffleAllocationMode;
  drawTimeZone?: string | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface RaffleView {
  id: string;
  title: string;
  description?: string | null;
  status: RaffleStatus;
  releasedCount: number;
  nextSequentialNumber: number;
  soldCount: number;
  soldTicketsRevenue: number;
  ticketPrice: number;
  maxPerPurchase: number;
  prizeCurrency: RafflePrizeCurrency;
  prizeAmount: number;
  prizeImageUrl?: string | null;
  startsAtMs: number | null;
  endsAtMs: number | null;
  scheduleMode?: RaffleScheduleMode;
  closedAtMs?: number | null;
  resultScheduledAtMs?: number | null;
  drawnAtMs?: number | null;
  paidAtMs?: number | null;
  winningNumber?: number | null;
  winnerUserId?: string | null;
  winnerPurchaseId?: string | null;
  winnerName?: string | null;
  winnerUsername?: string | null;
  instantPrizeTiers?: RaffleInstantPrizeTier[];
  instantPrizeHits?: RaffleInstantPrizeHitView[];
  noWinnerPolicy: RaffleNoWinnerPolicy;
  allocationMode?: RaffleAllocationMode;
  drawTimeZone?: string | null;
  createdAtMs?: number | null;
  updatedAtMs?: number | null;
}

export interface RafflePurchase {
  id: string;
  raffleId: string;
  raffleTitle?: string | null;
  raffleStatus?: RaffleStatus | null;
  userId: string;
  quantity: number;
  ticketCost: number;
  rangeStart: number;
  rangeEnd: number;
  clientRequestId: string;
  createdAt: Timestamp | null;
}

export interface RafflePurchaseView {
  id: string;
  raffleId: string;
  raffleTitle?: string | null;
  raffleStatus?: RaffleStatus | null;
  userId: string;
  quantity: number;
  ticketCost: number;
  rangeStart: number;
  rangeEnd: number;
  /** Presente quando o sorteio usa alocação aleatória. */
  numbers?: number[] | null;
  instantPrizeHits?: RaffleInstantPrizeHit[] | null;
  clientRequestId: string;
  createdAtMs: number | null;
}

export interface RafflePurchaseListCursor {
  createdAtMs: number;
  purchaseId: string;
}

export interface RafflePurchaseListResult {
  items: RafflePurchaseView[];
  nextCursor: RafflePurchaseListCursor | null;
}

export interface RaffleSystemDefaults {
  id: "raffle_system";
  enabled: boolean;
  defaultTicketPrice: number;
  defaultReleasedCount: number;
  defaultMaxPerPurchase: number;
  drawTimeZone: string;
  updatedAt?: Timestamp | null;
}
