"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase/client";

const MAX_BYTES = 5 * 1024 * 1024;

export async function uploadRafflePrizeImage(raffleId: string, file: File): Promise<string> {
  const id = raffleId.trim();
  if (!id) throw new Error("ID do sorteio ausente. Salve o sorteio antes de enviar a imagem.");
  if (!file.type.startsWith("image/")) throw new Error("Envie apenas um arquivo de imagem.");
  if (file.size > MAX_BYTES) throw new Error("Imagem acima de 5 MB.");

  const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "jpg";
  const safeExt = ext && /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
  const fileName = `prize_${Date.now()}.${safeExt}`;
  const path = `raffles/${id}/${fileName}`;
  const storageRef = ref(getFirebaseStorage(), path);
  await uploadBytes(storageRef, file, { contentType: file.type || "image/jpeg" });
  return getDownloadURL(storageRef);
}
