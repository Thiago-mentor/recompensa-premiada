"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { isSparkFreeTier } from "@/lib/firebase/sparkMode";
import { callFunction } from "@/services/callables/client";
import { sparkLogFraudHint } from "@/services/spark/operations";

/** Envia sinal leve para análise de risco (Spark: Firestore; Blaze: Function). */
export async function reportClientRiskHint(input: {
  tipo: string;
  detalhes?: Record<string, unknown>;
}): Promise<void> {
  try {
    const uid = getFirebaseAuth().currentUser?.uid;
    if (isSparkFreeTier()) {
      if (!uid) return;
      await sparkLogFraudHint({
        uid,
        tipo: input.tipo,
        detalhes: input.detalhes,
      });
      return;
    }
    await callFunction("riskAnalysisOnUserEvent", {
      tipo: input.tipo,
      detalhes: input.detalhes ?? {},
    });
  } catch {
    /* silencioso — não bloquear UX */
  }
}
