"use client";

import { doc, getDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";

export type ConversionRates = {
  coinsPerGemBuy: number;
  coinsPerGemSell: number;
};

const ECONOMY_ID = "economy";

export async function fetchConversionRates(): Promise<ConversionRates> {
  const db = getFirebaseFirestore();
  const snap = await getDoc(doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID));
  const d = snap.data() ?? {};
  const buy = Math.floor(Number(d.conversionCoinsPerGemBuy));
  const sell = Math.floor(Number(d.conversionCoinsPerGemSell));
  return {
    coinsPerGemBuy: Number.isFinite(buy) && buy >= 1 ? buy : 500,
    coinsPerGemSell: Number.isFinite(sell) && sell >= 0 ? sell : 0,
  };
}
