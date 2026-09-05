"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, LockKeyhole, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { deleteMyAccount } from "@/services/users/accountService";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { ROUTES } from "@/lib/constants/routes";

export function DeleteAccountPanel({ compact = false }: { compact?: boolean }) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDelete = confirmation.trim().toUpperCase() === "EXCLUIR";

  async function confirmDeletion() {
    if (!canDelete || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount();
      window.location.replace("/?conta=excluida");
    } catch (cause) {
      setError(formatFirebaseError(cause));
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-white/55">Verificando sua conta...</p>;
  if (!user) {
    return (
      <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.06] p-4">
        <p className="text-sm text-white/75">Entre na sua conta para confirmar a exclusão com segurança.</p>
        <Link href={ROUTES.login} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-cyan-400 px-4 text-sm font-bold text-slate-950">
          Entrar para excluir
        </Link>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "rounded-3xl border border-red-400/20 bg-red-950/20 p-5 sm:p-6"}>
      {!open ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-bold text-red-100"><Trash2 className="h-4 w-4" /> Excluir minha conta</p>
            <p className="mt-1 text-sm leading-relaxed text-white/55">Apaga seu acesso, perfil, avatar, saldos e dados pessoais. Esta ação não pode ser desfeita.</p>
          </div>
          <Button variant="danger" onClick={() => setOpen(true)}>Iniciar exclusão</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
            <div><p className="font-bold text-red-100">Exclusão permanente</p><p className="mt-1 text-sm leading-relaxed text-red-100/70">Você perderá PR, tickets, recompensas, progresso e acesso à conta. Registros legais e antifraude indispensáveis permanecem apenas anonimizados.</p></div>
          </div>
          <label className="block text-sm font-semibold text-white">Digite <strong>EXCLUIR</strong> para confirmar
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-white outline-none focus:border-red-400/50" placeholder="EXCLUIR" />
          </label>
          {error ? <AlertBanner tone="error">{error}</AlertBanner> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="ghost" disabled={busy} onClick={() => { setOpen(false); setConfirmation(""); setError(null); }}>Cancelar</Button>
            <Button variant="danger" disabled={!canDelete || busy} onClick={() => void confirmDeletion()}><LockKeyhole className="h-4 w-4" />{busy ? "Excluindo..." : "Excluir definitivamente"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
