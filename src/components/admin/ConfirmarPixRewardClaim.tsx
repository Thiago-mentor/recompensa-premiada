"use client";

import { useRef, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase/client";
import { callFunction } from "@/services/callables/client";

const MAX_BYTES = 5 * 1024 * 1024;

export function ConfirmarPixRewardClaim({ claimId, onDone }: { claimId: string; onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    setErr(null);
    setBusy(true);
    if (!claimId) {
      return setErr("claimId é obrigatório.");
    }
    
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      const path = `reward_claim_comprovantes/${claimId}/${Date.now()}_${safe}`;
      const storageRef = ref(getFirebaseStorage(), path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      if (!url.startsWith("https://")) {
      return setErr("Comprovante deve ser uma URL HTTPS.");
    }
    await callFunction("confirmRewardClaimPix", { claimId, comprovanteUrl: url });
      onDone();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao enviar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-2 sm:items-end">
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
        {busy ? "Enviando…" : "Confirmar PIX (comprovante)"}
      </button>
    </div>
  );
}
