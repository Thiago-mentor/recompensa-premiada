"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { requestRewardClaim } from "@/services/rewards/rewardClaimService";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";

export default function RecompensasPage() {
  const { profile } = useAuth();
  const [valor, setValor] = useState("");
  const [chave, setChave] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const v = Number(valor);
    if (!Number.isFinite(v) || v <= 0) {
      setMsg("Valor inválido");
      return;
    }
    setLoading(true);
    const r = await requestRewardClaim({ valor: v, tipo: "pix", chavePix: chave });
    setLoading(false);
    setMsg(r.ok ? "Pedido registrado — aguardando análise manual." : r.error || "Erro");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Premiação</h1>
      <p className="text-sm text-white/60">
        CASH (pontos) disponíveis: <strong className="text-white">{profile?.rewardBalance ?? 0}</strong>
      </p>
      <p className="text-xs text-white/45">
        CASH são pontos, não reais. Na análise do resgate, convertem em R$ com a taxa de vocês e o PIX é pago
        após aprovação. Sem PIX automático: histórico em{" "}
        <code className="text-violet-300">reward_claims</code>.
      </p>
      {msg ? (
        <AlertBanner tone={msg.includes("Erro") || msg.includes("inválido") ? "error" : "success"}>
          {msg}
        </AlertBanner>
      ) : null}
      <form onSubmit={enviar} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <label className="text-xs text-white/50">Pontos CASH a resgatar</label>
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-white"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-white/50">Chave PIX</label>
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-white"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Enviando…" : "Solicitar resgate"}
        </Button>
      </form>
    </div>
  );
}
