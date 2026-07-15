"use client";

import { callFunction } from "@/services/callables/client";
import type { PublicProfile } from "@/types/publicProfile";

const PUBLIC_PROFILE_CACHE_TTL_MS = 90_000;
const publicProfileCache = new Map<string, { expiresAt: number; profile: PublicProfile | null }>();

export async function fetchPublicProfile(uid: string): Promise<PublicProfile | null> {
  const cached = publicProfileCache.get(uid);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;

  const response = await callFunction<{ uid: string }, { ok: boolean; profile: PublicProfile | null }>(
    "getPublicProfile",
    { uid },
  );
  const profile = response.data.profile ?? null;
  publicProfileCache.set(uid, { expiresAt: Date.now() + PUBLIC_PROFILE_CACHE_TTL_MS, profile });
  return profile;
}
