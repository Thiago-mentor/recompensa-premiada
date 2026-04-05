"use client";

import { callFunction } from "@/services/callables/client";

/** Envia sinal leve para análise de risco via Cloud Function. */
export async function reportClientRiskHint(input: {
  tipo: string;
  detalhes?: Record<string, unknown>;
}): Promise<void> {
  try {
    await callFunction("riskAnalysisOnUserEvent", {
      tipo: input.tipo,
      detalhes: input.detalhes ?? {},
    });
  } catch {
    /* silencioso — não bloquear UX */
  }
}
