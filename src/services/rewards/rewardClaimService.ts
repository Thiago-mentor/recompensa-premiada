"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { callFunction } from "@/services/callables/client";

export async function requestRewardClaim(input: {
  valor: number;
  tipo: "pix" | "voucher" | "outro";
  chavePix: string;
}): Promise<{ ok: boolean; error?: string }> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return { ok: false, error: "Faça login novamente." };

  try {
    await callFunction("requestRewardClaim", input);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: formatFirebaseError(e) };
  }
}
