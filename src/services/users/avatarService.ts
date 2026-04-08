"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseAuth, getFirebaseStorage } from "@/lib/firebase/client";
import { callFunction } from "@/services/callables/client";

const MAX_AVATAR_FILE_BYTES = 3 * 1024 * 1024;
const TARGET_AVATAR_FILE_BYTES = 2_500_000;
const MAX_AVATAR_DIMENSIONS = [1024, 768, 512] as const;
const JPEG_QUALITIES = [0.9, 0.82, 0.74] as const;
const WEB_FRIENDLY_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function avatarFileName(file: File): string {
  const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "png";
  const safeExt = ext && /^[a-z0-9]+$/.test(ext) ? ext : "png";
  return `avatar_${Date.now()}.${safeExt}`;
}

function isLikelyImageFile(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i.test(file.name)
  );
}

function shouldNormalizeAvatar(file: File): boolean {
  if (file.size > MAX_AVATAR_FILE_BYTES) return true;
  if (!file.type) return true;
  return !WEB_FRIENDLY_AVATAR_TYPES.has(file.type.toLowerCase());
}

function createJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Não foi possível processar a foto selecionada."));
      },
      "image/jpeg",
      quality,
    );
  });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const previewUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(previewUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      reject(new Error("Não foi possível ler essa foto. Use JPG, PNG ou WebP."));
    };
    img.src = previewUrl;
  });
}

function normalizedAvatarName(file: File): string {
  const baseName = file.name.replace(/\.[^.]+$/, "").trim() || "avatar";
  return `${baseName}.jpg`;
}

async function normalizeAvatarFile(file: File): Promise<File> {
  const img = await loadImageFromFile(file);
  let bestBlob: Blob | null = null;

  for (const maxDimension of MAX_AVATAR_DIMENSIONS) {
    const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight, 1));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar a foto para upload.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of JPEG_QUALITIES) {
      const blob = await createJpegBlob(canvas, quality);
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
      }
      if (blob.size <= TARGET_AVATAR_FILE_BYTES) {
        return new File([blob], normalizedAvatarName(file), { type: "image/jpeg" });
      }
    }
  }

  if (bestBlob && bestBlob.size <= MAX_AVATAR_FILE_BYTES) {
    return new File([bestBlob], normalizedAvatarName(file), { type: "image/jpeg" });
  }

  throw new Error("A foto precisa ter no máximo 3 MB.");
}

async function prepareAvatarFile(file: File): Promise<File> {
  if (!isLikelyImageFile(file)) {
    throw new Error("Selecione uma imagem válida.");
  }
  if (!shouldNormalizeAvatar(file)) {
    return file;
  }
  return normalizeAvatarFile(file);
}

export async function uploadUserAvatar(file: File): Promise<string> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) throw new Error("Sessão inválida. Entre novamente.");

  const avatarFile = await prepareAvatarFile(file);
  const storageRef = ref(getFirebaseStorage(), `avatars/${uid}/${avatarFileName(avatarFile)}`);
  await uploadBytes(storageRef, avatarFile, { contentType: avatarFile.type || "image/jpeg" });
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
