"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import { AlertBanner } from "@/components/feedback/AlertBanner";

export default function ConvidarPage() {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = profile ? `${origin}/cadastro?convite=${profile.codigoConvite}` : "";

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Convidar amigos</h1>
      <p className="text-sm text-white/60">
        Seu código: <strong className="text-white">{profile?.codigoConvite ?? "—"}</strong>
      </p>
      <p className="text-xs text-white/45">
        Bônus só após o convidado criar conta, login real e ação mínima — validado na Cloud Function{" "}
        <code className="text-violet-300">processReferralReward</code>.
      </p>
      {copied ? <AlertBanner tone="success">Link copiado!</AlertBanner> : null}
      <Button className="w-full" variant="secondary" onClick={copy} disabled={!link}>
        Copiar link de convite
      </Button>
    </div>
  );
}
