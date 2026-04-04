"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { shouldUseSparkFallback } from "@/lib/firebase/sparkMode";
import { callFunction } from "@/services/callables/client";
import { sparkProcessDailyLogin } from "@/services/spark/dailyLogin";

export async function processDailyLogin(): Promise<{
  ok: boolean;
  streak?: number;
  coins?: number;
  message?: string;
  error?: string;
}> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return { ok: false, error: "Faça login novamente." };

  if (shouldUseSparkFallback()) {
    const r = await sparkProcessDailyLogin(uid);
    if (!r.ok) return { ok: false, error: r.error };
    return {
      ok: true,
      streak: r.streak,
      coins: r.coins,
      message: r.coins === 0 ? "Entrada já registrada hoje." : "Entrada registrada!",
    };
  }

  try {
    const res = await callFunction<Record<string, never>, { streak: number; coins: number }>(
      "processDailyLogin",
      {},
    );
    return {
      ok: true,
      streak: res.data?.streak,
      coins: res.data?.coins,
      message: "Entrada registrada!",
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Não foi possível registrar a entrada.",
    };
  }
}
