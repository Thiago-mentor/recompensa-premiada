"use client";

import {
  doc,
  getDoc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import type { UserProfile } from "@/types/user";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { isSparkFreeTier } from "@/lib/firebase/sparkMode";
import { callFunction } from "@/services/callables/client";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { sparkCreateUserProfile } from "@/services/spark/operations";

export function userDocRef(uid: string) {
  return doc(getFirebaseFirestore(), COLLECTIONS.users, uid);
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserProfile;
}

export function subscribeUserProfile(
  uid: string,
  onNext: (profile: UserProfile | null) => void,
): Unsubscribe {
  return onSnapshot(userDocRef(uid), (s) => {
    if (!s.exists()) {
      onNext(null);
      return;
    }
    onNext({ uid, ...s.data() } as UserProfile);
  });
}

export async function ensureUserProfileRemote(input: {
  nome: string;
  username: string;
  foto: string | null;
  email: string | null;
  codigoConviteOpcional?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return { ok: false, error: "Sessão inválida. Entre novamente." };

  if (isSparkFreeTier()) {
    return sparkCreateUserProfile({
      uid,
      nome: input.nome,
      username: input.username,
      foto: input.foto,
      email: input.email,
      codigoConviteOpcional: input.codigoConviteOpcional,
    });
  }

  try {
    await callFunction("initializeUserProfile", {
      nome: input.nome,
      username: input.username,
      foto: input.foto,
      email: input.email,
      codigoConvite: input.codigoConviteOpcional ?? null,
    });
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: formatFirebaseError(e) };
  }
}
