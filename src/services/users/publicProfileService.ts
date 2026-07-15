"use client";

import { callFunction } from "@/services/callables/client";
import type { PublicProfile } from "@/types/publicProfile";

export async function fetchPublicProfile(uid: string): Promise<PublicProfile | null> {
  const response = await callFunction<{ uid: string }, { ok: boolean; profile: PublicProfile | null }>(
    "getPublicProfile",
    { uid },
  );
  return response.data.profile ?? null;
}
