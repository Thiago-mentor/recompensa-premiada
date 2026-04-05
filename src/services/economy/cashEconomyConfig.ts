"use client";

import { doc, getDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";

const ECONOMY_ID = "economy";

/** Pontos CASH por cada R$ 1,00 (mín. 1 no servidor; padrão 100). */
export async function fetchCashPointsPerReal(): Promise<number> {
  const db = getFirebaseFirestore();
  const snap = await getDoc(doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID));
  const n = Math.floor(Number(snap.data()?.cashPointsPerReal));
  return Number.isFinite(n) && n >= 1 ? n : 100;
}

export function cashPointsToBrl(points: number, cashPointsPerReal: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0;
  const rate = Number.isFinite(cashPointsPerReal) && cashPointsPerReal >= 1 ? cashPointsPerReal : 100;
  return points / rate;
}

export function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
