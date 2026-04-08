"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { callFunction } from "@/services/callables/client";

export async function craftBoostFromFragmentsCallable(): Promise<
  | {
      ok: true;
      fragmentsCost: number;
      boostMinutesAdded: number;
      fragmentsBalance: number;
      storedBoostMinutes: number;
    }
  | { ok: false; error: string }
> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return { ok: false, error: "Faça login novamente." };

  try {
    const res = await callFunction<
      Record<string, never>,
      {
        ok: true;
        fragmentsCost: number;
        boostMinutesAdded: number;
        fragmentsBalance: number;
        storedBoostMinutes: number;
      }
    >("craftBoostFromFragments", {});
    return res.data;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao fabricar boost." };
  }
}

export async function activateStoredBoostCallable(): Promise<
  | {
      ok: true;
      activatedMinutes: number;
      storedBoostMinutes: number;
      activeBoostUntilMs: number;
      boostRewardPercent: number;
    }
  | { ok: false; error: string }
> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return { ok: false, error: "Faça login novamente." };

  try {
    const res = await callFunction<
      Record<string, never>,
      {
        ok: true;
        activatedMinutes: number;
        storedBoostMinutes: number;
        activeBoostUntilMs: number;
        boostRewardPercent: number;
      }
    >("activateStoredBoost", {});
    return res.data;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao ativar boost." };
  }
}
