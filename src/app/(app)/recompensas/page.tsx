"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { requestRewardClaim } from "@/services/rewards/rewardClaimService";
import {
  cashPointsToBrl,
  fetchCashPointsPerReal,
  formatBrl,
} from "@/services/economy/cashEconomyConfig";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";

export default function RecompensasPage() {
  const { profile } = useAuth();
  const [valor, setValor] = useState("");
  const [chave, setChave] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cashPointsPerReal, setCashPointsPerReal] = useState<number | null>(null);

  useEffect(() => {
    let c = false;
    void fetchCashPointsPerReal()
      .then((n) => {
        if (!c) setCashPointsPerReal(n);
      })
      .catch(() => {
        if (!c) setCashPointsPerReal(100);
      });
    return () => {
      c = true;
    };
  }, []);

  const balance = profile?.rewardBalance ?? 0;
  const rate = cashPointsPerReal ?? 100;

  const valorNum = useMemo(() => {
    const v = Number(valor);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  }, [valor]);

  const brlSaldoTotal = useMemo(() => cashPointsToBrl(balance, rate), [balance, rate]);
  const brlResgate = useMemo(() => cashPointsToBrl(valorNum, rate), [valorNum, rate]);
  const brlPorPonto = useMemo(() => cashPointsToBrl(1, rate), [rate]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const v = Number(valor);
    if (!Number.isFinite(v) || v <= 0) {
      setMsg("Valor inválido");
      return;
    }
    const vi = Math.floor(v);
    if (vi > balance) {
      setMsg("Você não tem CASH suficiente.");
      return;
    }
    setLoading(true);
    const r = await requestRewardClaim({ valor: vi, tipo: "pix", chavePix: chave });
    setLoading(false);
    setMsg(r.ok ? "Pedido registrado — aguardando análise manual." : r.error || "Erro");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Premiação</h1>
        <p className="text-sm text-white/55">
          Resgate de CASH (pontos) via PIX após aprovação. A taxa em reais vem do painel admin.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-950/40 via-slate-950/80 to-slate-950 p-4 sm:p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-200/70">
          Seu saldo
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-4">
          <div>
            <p className="text-3xl font-black tabular-nums text-white sm:text-4xl">{balance}</p>
            <p className="text-xs text-white/45">pontos CASH</p>
          </div>
          <div className="h-10 w-px bg-white/10" aria-hidden />
          <div>
            <p className="text-xl font-bold tabular-nums text-emerald-200 sm:text-2xl">
              {formatBrl(brlSaldoTotal)}
            </p>
            <p className="text-xs text-white/45">
              equivalente (~{rate} pts = R$ 1,00)
            </p>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
          Valor aproximado para referência; o valor líquido do PIX pode seguir regras fiscais ou taxas da
          operadora, definidas por vocês na análise.
        </p>
      </div>

      {msg ? (
        <AlertBanner tone={msg.includes("Erro") || msg.includes("inválido") || msg.includes("não tem") ? "error" : "success"}>
          {msg}
        </AlertBanner>
      ) : null}

      <form
        onSubmit={enviar}
        className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5"
      >
        <div>
          <label className="text-xs font-semibold text-white/50" htmlFor="cash-valor">
            Pontos CASH a resgatar
          </label>
          <input
            id="cash-valor"
            type="number"
            min={1}
            max={balance || undefined}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-lg font-semibold text-white outline-none focus:border-violet-500/60"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          {valorNum > 0 ? (
            <p className="mt-2 text-sm text-emerald-200/90">
              ≈ <strong>{formatBrl(brlResgate)}</strong> em reais (estimativa)
            </p>
          ) : (
            <p className="mt-2 text-xs text-white/35">
              Cada ponto vale ~{formatBrl(brlPorPonto)} nesta configuração.
            </p>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-white/50" htmlFor="pix-chave">
            Chave PIX
          </label>
          <input
            id="pix-chave"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-white outline-none focus:border-violet-500/60"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            placeholder="CPF, e-mail, telefone ou chave aleatória"
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Enviando…" : "Solicitar resgate"}
        </Button>
      </form>
    </div>
  );
}
