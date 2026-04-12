"use client";

import { callFunction } from "@/services/callables/client";

const PRESENCE_THROTTLE_MS = 45_000;

let lastPresencePingAt = 0;
let inFlightPresencePing: Promise<void> | null = null;

export async function touchUserPresence(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastPresencePingAt < PRESENCE_THROTTLE_MS) {
    return;
  }
  if (inFlightPresencePing) {
    return inFlightPresencePing;
  }

  lastPresencePingAt = now;
  inFlightPresencePing = callFunction<Record<string, never>, { ok: boolean }>("touchUserPresence", {})
    .then(() => undefined)
    .catch((error) => {
      lastPresencePingAt = 0;
      throw error;
    })
    .finally(() => {
      inFlightPresencePing = null;
    });

  return inFlightPresencePing;
}
