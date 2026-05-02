"use client";

import { callFunction } from "@/services/callables/client";
import type {
  RafflePurchaseListCursor,
  RafflePurchaseView,
  RaffleView,
} from "@/types/raffle";

export type GetActiveRaffleResult = {
  ok: boolean;
  enabled: boolean;
  raffle: RaffleView | null;
};

export type PurchaseRaffleNumbersResult = {
  ok: boolean;
  idempotent?: boolean;
  raffle: RaffleView | null;
  purchase: RafflePurchaseView | null;
};

export type ListMyRafflePurchasesResult = {
  ok: boolean;
  items: RafflePurchaseView[];
  nextCursor: RafflePurchaseListCursor | null;
};

export async function getActiveRaffleCallable(): Promise<GetActiveRaffleResult> {
  const res = await callFunction<Record<string, never>, GetActiveRaffleResult>("getActiveRaffle", {});
  return res.data;
}

export async function purchaseRaffleNumbersCallable(input: {
  raffleId: string;
  quantity: number;
  clientRequestId: string;
  rewardedAdSessionId?: string;
  rewardedAdCompletionToken?: string;
}): Promise<PurchaseRaffleNumbersResult> {
  const res = await callFunction<
    {
      raffleId: string;
      quantity: number;
      clientRequestId: string;
      rewardedAdSessionId?: string;
      rewardedAdCompletionToken?: string;
    },
    PurchaseRaffleNumbersResult
  >("purchaseRaffleNumbers", input);
  return res.data;
}

export async function listMyRafflePurchasesCallable(input: {
  raffleId?: string;
  pageSize?: number;
  cursor?: RafflePurchaseListCursor | null;
}): Promise<ListMyRafflePurchasesResult> {
  const res = await callFunction<
    {
      raffleId?: string;
      pageSize?: number;
      cursor?: RafflePurchaseListCursor | null;
    },
    ListMyRafflePurchasesResult
  >("listMyRafflePurchases", {
    raffleId: input.raffleId ?? "",
    pageSize: input.pageSize,
    cursor: input.cursor ?? undefined,
  });
  return res.data;
}

export async function adminCreateOrUpdateRaffleCallable(input: Record<string, unknown>): Promise<{
  ok: boolean;
  raffle: RaffleView | null;
}> {
  const res = await callFunction<Record<string, unknown>, { ok: boolean; raffle: RaffleView | null }>(
    "adminCreateOrUpdateRaffle",
    input,
  );
  return res.data;
}

export async function adminCloseRaffleCallable(raffleId: string): Promise<{
  ok: boolean;
  raffle: RaffleView | null;
}> {
  const res = await callFunction<{ raffleId: string }, { ok: boolean; raffle: RaffleView | null }>(
    "adminCloseRaffle",
    { raffleId },
  );
  return res.data;
}

export async function adminDrawRaffleCallable(input: { raffleId: string; winningNumber: number }): Promise<{
  ok: boolean;
  raffle: RaffleView | null;
}> {
  const res = await callFunction<
    { raffleId: string; winningNumber: number },
    { ok: boolean; raffle: RaffleView | null }
  >(
    "adminDrawRaffle",
    input,
  );
  return res.data;
}
