"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { shouldUseSparkFallback } from "@/lib/firebase/sparkMode";
import { callFunction } from "@/services/callables/client";
import { sparkLogFraudHint } from "@/services/spark/fraud";

/** Envia sinal leve para análise de risco (preferência por Function; Spark só como fallback legado). */
export async function reportClientRiskHint(input: {
  tipo: string;
  detalhes?: Record<string, unknown>;
}): Promise<void> {
  try {
    const uid = getFirebaseAuth().currentUser?.uid;
    if (shouldUseSparkFallback()) {
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
