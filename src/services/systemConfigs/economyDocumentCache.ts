"use client";

/**
 * Dedup + TTL para `system_configs/economy` — evita repetir getDoc em navegações/serviços no mesmo período curto.
 * Salas PvP em partida continuam com `onSnapshot` próprio (latência baixa quando a config muda durante jogo).
 * Após escritas no admin use `invalidateEconomyConfigCache()`.
 * Contexto de deploy e TTL: `docs/firebase-custo-e-indices.md`.
 */

import { doc, getDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import type { SystemEconomyConfig } from "@/types/systemConfig";

const DOC_ID = "economy";
const TTL_MS = 90_000;

type EconomyPayload = Partial<SystemEconomyConfig> | null;

let fetchedAtMs = 0;
let cached: EconomyPayload | undefined;
let inFlight: Promise<EconomyPayload> | null = null;

export function invalidateEconomyConfigCache(): void {
  fetchedAtMs = 0;
  cached = undefined;
  inFlight = null;
}

export async function fetchEconomyConfigDocument(): Promise<EconomyPayload> {
  const now = Date.now();
  if (cached !== undefined && now - fetchedAtMs < TTL_MS) {
    return cached;
  }
  if (inFlight) return inFlight;

  inFlight = (async (): Promise<EconomyPayload> => {
    try {
      const snap = await getDoc(doc(getFirebaseFirestore(), COLLECTIONS.systemConfigs, DOC_ID));
      const payload: EconomyPayload = snap.exists()
        ? (snap.data() as Partial<SystemEconomyConfig>)
        : null;
      cached = payload;
      fetchedAtMs = Date.now();
      return payload;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
