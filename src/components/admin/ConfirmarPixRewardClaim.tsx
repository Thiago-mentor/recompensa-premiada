"use client";

import { useRef, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase/client";
import {
  firebaseEmulatorHost,
  firebaseEmulatorPorts,
  useFirebaseEmulators,
} from "@/lib/firebase/config";
import { callFunction } from "@/services/callables/client";

const MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 20_000;

type BusyStep = "idle" | "uploading" | "confirming";

function isAllowedComprovanteUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:") return true;
    if (!useFirebaseEmulators || parsed.protocol !== "http:") return false;
    const samePort = parsed.port === String(firebaseEmulatorPorts.storage);
    const allowedHosts = new Set(["127.0.0.1", "localhost", firebaseEmulatorHost]);
    return samePort && allowedHosts.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function ConfirmarPixRewardClaim({ claimId, onDone }: { claimId: string; onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busyStep, setBusyStep] = useState<BusyStep>("idle");
  const [err, setErr] = useState<string | null>(null);

  const busy = busyStep !== "idle";

  async function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(message)), UPLOAD_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setErr("Arquivo máx. 5 MB.");
      return;
    }
    if (!/^image\//.test(file.type) && file.type !== "application/pdf") {
      setErr("Use imagem ou PDF.");
      return;
    }
    if (!claimId) {
      setErr("claimId é obrigatório.");
      return;
    }

    setErr(null);
    setBusyStep("uploading");
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      const path = `reward_claim_comprovantes/${claimId}/${Date.now()}_${safe}`;
      const storageRef = ref(getFirebaseStorage(), path);
      await withTimeout(
        uploadBytes(storageRef, file, { contentType: file.type }),
        "O upload do comprovante demorou demais. Tente novamente.",
      );
      const url = await withTimeout(
        getDownloadURL(storageRef),
        "Nao foi possivel obter a URL final do comprovante.",
      );
      if (!isAllowedComprovanteUrl(url)) {
        setErr("Nao foi possivel obter uma URL valida do comprovante.");
        return;
      }
      setBusyStep("confirming");
      await withTimeout(
        callFunction("confirmRewardClaimPix", { claimId, comprovanteUrl: url }),
        "A confirmacao do PIX demorou demais. Verifique os emuladores e tente novamente.",
      );
      onDone();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao enviar.");
    } finally {
      setBusyStep("idle");
    }
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-2 sm:items-end">
      {busyStep === "uploading" ? (
        <p className="text-right text-[11px] text-cyan-200/80">Enviando comprovante...</p>
      ) : null}
      {busyStep === "confirming" ? (
        <p className="text-right text-[11px] text-cyan-200/80">Confirmando PIX...</p>
      ) : null}
      {err ? <p className="text-right text-xs text-rose-300">{err}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={onPick}
      />
      <button
        type="button"
        disabled={busy}
        className="rounded-lg border border-cyan-500/40 bg-cyan-950/50 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-950/70 disabled:opacity-50"
        onClick={() => inputRef.current?.click()}
      >
        {busyStep === "uploading"
          ? "Enviando..."
          : busyStep === "confirming"
            ? "Confirmando..."
            : "Confirmar PIX (comprovante)"}
      </button>
    </div>
  );
}
