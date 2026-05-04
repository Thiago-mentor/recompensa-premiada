"use client";

import { fetchEconomyConfigDocument } from "@/services/systemConfigs/economyDocumentCache";

export type ConversionRates = {
  coinsPerGemBuy: number;
  coinsPerGemSell: number;
};

export async function fetchConversionRates(): Promise<ConversionRates> {
  const d = (await fetchEconomyConfigDocument()) ?? {};
  const buy = Math.floor(Number(d.conversionCoinsPerGemBuy));
  const sell = Math.floor(Number(d.conversionCoinsPerGemSell));
  return {
    coinsPerGemBuy: Number.isFinite(buy) && buy >= 1 ? buy : 500,
    coinsPerGemSell: Number.isFinite(sell) && sell >= 0 ? sell : 0,
  };
}
