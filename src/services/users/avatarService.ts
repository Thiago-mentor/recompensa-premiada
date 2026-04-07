"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseAuth, getFirebaseStorage } from "@/lib/firebase/client";
import { callFunction } from "@/services/callables/client";

function avatarFileName(file: File): string {
  const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "png";
  const safeExt = ext && /^[a-z0-9]+$/.test(ext) ? ext : "png";
  return `avatar_${Date.now()}.${safeExt}`;
}

export async function uploadUserAvatar(file: File): Promise<string> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) throw new Error("Sessão inválida. Entre novamente.");

  const storageRef = ref(getFirebaseStorage(), `avatars/${uid}/${avatarFileName(file)}`);
  await uploadBytes(storageRef, file, { contentType: file.type || "image/png" });
  const photoURL = await getDownloadURL(storageRef);
  const result = await callFunction<{ photoURL: string }, { ok: boolean; photoURL: string }>("updateUserAvatar", {
    photoURL,
  });
  return result.data.photoURL;
}

export async function resetUserAvatar(): Promise<string> {
  const result = await callFunction<{ photoURL: null }, { ok: boolean; photoURL: string }>("updateUserAvatar", {
    photoURL: null,
  });
  return result.data.photoURL;
}
