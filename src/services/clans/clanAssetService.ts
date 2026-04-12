"use client";

import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseAuth, getFirebaseStorage } from "@/lib/firebase/client";

const MAX_CLAN_ASSET_FILE_BYTES = 5 * 1024 * 1024;
const TARGET_CLAN_ASSET_FILE_BYTES = 3_500_000;
const MAX_CLAN_AVATAR_DIMENSIONS = [1024, 768, 512] as const;
const MAX_CLAN_COVER_DIMENSIONS = [1600, 1280, 1024] as const;
const JPEG_QUALITIES = [0.9, 0.82, 0.74] as const;
const WEB_FRIENDLY_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const DEFAULT_CLAN_COVER_POSITION = 50;
const DEFAULT_CLAN_COVER_SCALE = 100;

type ClanAssetKind = "avatar" | "cover";
type ClanAssetSource = Blob | string;

export type ClanCoverPreviewCrop = {
  positionX: number;
  positionY: number;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
};

function clanAssetFileName(kind: ClanAssetKind, file: File): string {
  const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "jpg";
  const safeExt = ext && /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
  return `${kind}_${Date.now()}.${safeExt}`;
}

function isLikelyImageFile(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i.test(file.name)
  );
}

function shouldNormalizeImage(file: File): boolean {
  if (file.size > MAX_CLAN_ASSET_FILE_BYTES) return true;
  if (!file.type) return true;
  return !WEB_FRIENDLY_TYPES.has(file.type.toLowerCase());
}

function createJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Não foi possível processar a imagem selecionada."));
      },
      "image/jpeg",
      quality,
    );
  });
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const previewUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(previewUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      reject(new Error("Não foi possível ler essa imagem. Use JPG, PNG ou WebP."));
    };
    img.src = previewUrl;
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
      reject(new Error("Não foi possível ler essa imagem. Use JPG, PNG ou WebP."));
    };
    img.src = previewUrl;
  });
}

function normalizedImageName(file: File, kind: ClanAssetKind): string {
  const baseName = file.name.replace(/\.[^.]+$/, "").trim() || kind;
  return `${baseName}.jpg`;
}

function normalizedImageNameFromSourceName(sourceName: string, kind: ClanAssetKind): string {
  const baseName = sourceName.replace(/\.[^.]+$/, "").trim() || kind;
  return `${baseName}.jpg`;
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function resolveCoverCanvasSize(viewportWidth: number, viewportHeight: number, maxDimension: number) {
  const safeWidth = Math.max(1, viewportWidth);
  const safeHeight = Math.max(1, viewportHeight);
  if (safeWidth >= safeHeight) {
    return {
      width: maxDimension,
      height: Math.max(1, Math.round((safeHeight / safeWidth) * maxDimension)),
    };
  }
  return {
    width: Math.max(1, Math.round((safeWidth / safeHeight) * maxDimension)),
    height: maxDimension,
  };
}

function drawClanCoverPreview(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  crop: ClanCoverPreviewCrop,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a capa do clã.");

  const positionX = clampNumber(crop.positionX, 0, 100, DEFAULT_CLAN_COVER_POSITION);
  const positionY = clampNumber(crop.positionY, 0, 100, DEFAULT_CLAN_COVER_POSITION);
  const scale = clampNumber(crop.scale, 100, 220, DEFAULT_CLAN_COVER_SCALE);
  const drawWidth = Math.max(1, Math.round((canvas.width * scale) / 100));
  const drawHeight = Math.max(
    1,
    Math.round((drawWidth * image.naturalHeight) / Math.max(image.naturalWidth, 1)),
  );
  const offsetX = ((canvas.width - drawWidth) * positionX) / 100;
  const offsetY = ((canvas.height - drawHeight) * positionY) / 100;

  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

async function readClanAssetSourceBlob(source: ClanAssetSource): Promise<Blob> {
  if (typeof source !== "string") return source;
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error("Não foi possível carregar a capa atual para gerar o recorte final.");
  }
  return response.blob();
}

async function renderClanCoverFromPreview(
  source: ClanAssetSource,
  crop: ClanCoverPreviewCrop,
  sourceName: string,
): Promise<File> {
  const viewportWidth = Math.max(1, crop.viewportWidth);
  const viewportHeight = Math.max(1, crop.viewportHeight);
  const imageBlob = await readClanAssetSourceBlob(source);
  const image = await loadImageFromBlob(imageBlob);
  let bestBlob: Blob | null = null;

  for (const maxDimension of MAX_CLAN_COVER_DIMENSIONS) {
    const { width, height } = resolveCoverCanvasSize(viewportWidth, viewportHeight, maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    drawClanCoverPreview(canvas, image, crop);

    for (const quality of JPEG_QUALITIES) {
      const blob = await createJpegBlob(canvas, quality);
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
      }
      if (blob.size <= TARGET_CLAN_ASSET_FILE_BYTES) {
        return new File([blob], normalizedImageNameFromSourceName(sourceName, "cover"), {
          type: "image/jpeg",
        });
      }
    }
  }

  if (bestBlob && bestBlob.size <= MAX_CLAN_ASSET_FILE_BYTES) {
    return new File([bestBlob], normalizedImageNameFromSourceName(sourceName, "cover"), {
      type: "image/jpeg",
    });
  }

  throw new Error("A imagem precisa ter no máximo 5 MB.");
}

async function normalizeClanImageFile(file: File, kind: ClanAssetKind): Promise<File> {
  const img = await loadImageFromFile(file);
  let bestBlob: Blob | null = null;
  const dimensions = kind === "cover" ? MAX_CLAN_COVER_DIMENSIONS : MAX_CLAN_AVATAR_DIMENSIONS;

  for (const maxDimension of dimensions) {
    const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight, 1));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar a imagem para upload.");
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of JPEG_QUALITIES) {
      const blob = await createJpegBlob(canvas, quality);
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
      }
      if (blob.size <= TARGET_CLAN_ASSET_FILE_BYTES) {
        return new File([blob], normalizedImageName(file, kind), { type: "image/jpeg" });
      }
    }
  }

  if (bestBlob && bestBlob.size <= MAX_CLAN_ASSET_FILE_BYTES) {
    return new File([bestBlob], normalizedImageName(file, kind), { type: "image/jpeg" });
  }

  throw new Error("A imagem precisa ter no máximo 5 MB.");
}

async function prepareClanAssetFile(file: File, kind: ClanAssetKind): Promise<File> {
  if (!isLikelyImageFile(file)) {
    throw new Error("Selecione uma imagem válida.");
  }
  if (!shouldNormalizeImage(file)) {
    return file;
  }
  return normalizeClanImageFile(file, kind);
}

export async function validateClanImageFile(file: File): Promise<void> {
  if (!isLikelyImageFile(file)) {
    throw new Error("Selecione uma imagem válida.");
  }
  await loadImageFromFile(file);
}

export async function uploadClanAsset(file: File, kind: ClanAssetKind): Promise<string> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) throw new Error("Sessão inválida. Entre novamente.");

  const preparedFile = await prepareClanAssetFile(file, kind);
  const storageRef = ref(
    getFirebaseStorage(),
    `clan_assets/${uid}/${clanAssetFileName(kind, preparedFile)}`,
  );
  await uploadBytes(storageRef, preparedFile, {
    contentType: preparedFile.type || "image/jpeg",
  });
  return getDownloadURL(storageRef);
}

export async function uploadClanCoverFromPreview(
  input: {
    source: File | string;
  } & ClanCoverPreviewCrop,
): Promise<string> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) throw new Error("Sessão inválida. Entre novamente.");

  if (input.source instanceof File) {
    await validateClanImageFile(input.source);
  }

  const preparedFile = await renderClanCoverFromPreview(
    input.source,
    input,
    input.source instanceof File ? input.source.name : "cover.jpg",
  );
  const storageRef = ref(
    getFirebaseStorage(),
    `clan_assets/${uid}/${clanAssetFileName("cover", preparedFile)}`,
  );
  await uploadBytes(storageRef, preparedFile, {
    contentType: preparedFile.type || "image/jpeg",
  });
  return getDownloadURL(storageRef);
}

export async function deleteClanAssetByUrl(rawUrl: string | null | undefined): Promise<void> {
  const url = String(rawUrl || "").trim();
  if (!url) return;
  try {
    const storageRef = ref(getFirebaseStorage(), url);
    await deleteObject(storageRef);
  } catch {
    /* ignore cleanup failures on temporary assets */
  }
}
