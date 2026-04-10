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

export type RafflePrizeCurrency = WalletCurrency;

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
  closedAt?: Timestamp | null;
  drawnAt?: Timestamp | null;
  paidAt?: Timestamp | null;
  winningNumber?: number | null;
  winnerUserId?: string | null;
  winnerPurchaseId?: string | null;
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
  closedAtMs?: number | null;
  drawnAtMs?: number | null;
  paidAtMs?: number | null;
  winningNumber?: number | null;
  winnerUserId?: string | null;
  winnerPurchaseId?: string | null;
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
