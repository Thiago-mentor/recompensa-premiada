"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { isSparkFreeTier } from "@/lib/firebase/sparkMode";
import { callFunction } from "@/services/callables/client";
import { sparkRequestRewardClaim } from "@/services/spark/operations";

export async function requestRewardClaim(input: {
  valor: number;
  tipo: "pix" | "voucher" | "outro";
  chavePix: string;
}): Promise<{ ok: boolean; error?: string }> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return { ok: false, error: "Faça login novamente." };

  if (isSparkFreeTier()) {
    return sparkRequestRewardClaim({ uid, ...input });
  }

  try {
    await callFunction("requestRewardClaim", input);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao solicitar" };
  }
}
