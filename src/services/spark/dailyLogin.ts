"use client";

import {
  Timestamp,
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { SPARK_ECONOMY } from "@/lib/constants/sparkEconomy";
import { getDailyPeriodKey } from "@/utils/date";

export async function sparkProcessDailyLogin(
  uid: string,
): Promise<{ ok: boolean; streak?: number; coins?: number; error?: string }> {
  const db = getFirebaseFirestore();
  const userRef = doc(db, COLLECTIONS.users, uid);
  const bonus = SPARK_ECONOMY.dailyLoginBonus;
  try {
    const out = await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error("Perfil inexistente.");
      const u = snap.data() as Record<string, unknown>;
      if (u.banido === true) throw new Error("Conta suspensa.");

      const now = new Date();
      const todayKey = getDailyPeriodKey(now);
      const yesterday = new Date(now);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yKey = getDailyPeriodKey(yesterday);

      const lastTs = u.ultimaEntradaEm as { toDate?: () => Date } | null | undefined;
      const last = lastTs?.toDate?.();
      let streak = Number(u.streakAtual || 0);
      if (!last) streak = 1;
      else {
        const lastKey = getDailyPeriodKey(last);
        if (lastKey === todayKey) {
          return { streak, coins: 0, skipWallet: true };
        }
        if (lastKey === yKey) streak += 1;
        else streak = 1;
      }
      const melhor = Math.max(Number(u.melhorStreak || 0), streak);
      const newCoins = Number(u.coins || 0) + bonus;

      tx.update(userRef, {
        streakAtual: streak,
        melhorStreak: melhor,
        ultimaEntradaEm: Timestamp.fromDate(now),
        coins: increment(bonus),
        atualizadoEm: serverTimestamp(),
      });

      const wRef = doc(collection(db, COLLECTIONS.walletTransactions));
      tx.set(wRef, {
        userId: uid,
        tipo: "streak",
        moeda: "coins",
        valor: bonus,
        saldoApos: newCoins,
        descricao: "Login diário / streak",
        referenciaId: todayKey,
        criadoEm: serverTimestamp(),
      });
      return { streak, coins: bonus, skipWallet: false };
    });
    return { ok: true, streak: out.streak, coins: out.coins };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro no login diário." };
  }
}
