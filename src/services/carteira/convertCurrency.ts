"use client";

import { callFunction } from "@/services/callables/client";

export type ConvertDirection = "coins_to_gems" | "gems_to_coins";

export type ConvertCurrencyResponse =
  | {
      ok: true;
      direction: "coins_to_gems";
      cost: number;
      gemsBought: number;
      newCoins: number;
      newGems: number;
    }
  | {
      ok: true;
      direction: "gems_to_coins";
      payout: number;
      gemsSold: number;
      newCoins: number;
      newGems: number;
    };

export async function convertCurrency(
  direction: ConvertDirection,
  amount: number,
): Promise<ConvertCurrencyResponse> {
  const res = await callFunction<{ direction: ConvertDirection; amount: number }, ConvertCurrencyResponse>(
    "convertCurrency",
    { direction, amount },
  );
  if (!res.data) throw new Error("Resposta inválida do servidor.");
  return res.data;
}
