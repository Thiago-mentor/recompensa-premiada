"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { useAuth } from "@/hooks/useAuth";
import { requestRewardClaim } from "@/services/rewards/rewardClaimService";
import {
  saldoPointsToBrl,
  fetchSaldoPointsPerReal,
  formatBrl,
} from "@/services/economy/saldoEconomyConfig";
import type { RewardClaim } from "@/types/reward";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { PedidosSaquePanel } from "@/components/recompensas/PedidosSaquePanel";
import { cn } from "@/lib/utils/cn";
import { History, Wallet } from "lucide-react";

function claimCriadoMs(criadoEm: unknown): number {
  if (
    criadoEm &&
    typeof criadoEm === "object" &&
    "toMillis" in criadoEm &&
    typeof (criadoEm as { toMillis: () => number }).toMillis === "function"
  ) {
    try {
      return (criadoEm as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  return 0;
}

export default function RecompensasPage() {
  const { profile, user, refreshProfile } = useAuth();
  const [valor, setValor] = useState("");
  const [chave, setChave] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saldoPointsPerReal, setSaldoPointsPerReal] = useState<number | null>(null);
  const [meusPedidos, setMeusPedidos] = useState<RewardClaim[]>([]);
  const [aba, setAba] = useState<"resgatar" | "historico">("resgatar");

  useEffect(() => {
    let c = false;
    void fetchSaldoPointsPerReal()
      .then((n) => {
        if (!c) setSaldoPointsPerReal(n);
      })
      .catch(() => {
        if (!c) setSaldoPointsPerReal(100);
      });
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const db = getFirebaseFirestore();
    const q = query(
      collection(db, COLLECTIONS.rewardClaims),
      where("userId", "==", user.uid),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RewardClaim);
        list.sort((a, b) => claimCriadoMs(b.criadoEm) - claimCriadoMs(a.criadoEm));
        setMeusPedidos(list);
      },
      () => setMeusPedidos([]),
    );
    return () => unsub();
  }, [user?.uid]);

  const pedidosVisiveis = useMemo(
    () => (user?.uid ? meusPedidos : []),
    [user?.uid, meusPedidos],
  );
  const balance = profile?.rewardBalance ?? 0;
  const rate = saldoPointsPerReal ?? 100;

  const pendentesCount = useMemo(
    () => pedidosVisiveis.filter((p) => p.status === "pendente" || p.status === "aprovado").length,
    [pedidosVisiveis],
  );

  const retidoPendente = useMemo(
    () => pedidosVisiveis.filter((p) => p.status === "pendente").reduce((s, p) => s + p.valor, 0),
    [pedidosVisiveis],
  );

  const valorNum = useMemo(() => {
    const v = Number(valor);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  }, [valor]);

  const brlSaldoTotal = useMemo(() => saldoPointsToBrl(balance, rate), [balance, rate]);
  const brlResgate = useMemo(() => saldoPointsToBrl(valorNum, rate), [valorNum, rate]);
  const brlPorPonto = useMemo(() => saldoPointsToBrl(1, rate), [rate]);

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
      setMsg("Você não tem saldo suficiente.");
      return;
    }
    setLoading(true);
    const r = await requestRewardClaim({ valor: vi, tipo: "pix", chavePix: chave });
    setLoading(false);
    if (r.ok) {
      setMsg("Pedido registrado.");
      setValor("");
      setChave("");
      void refreshProfile();
      setAba("historico");
    } else {
      setMsg(r.error || "Erro");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Saque PIX</h1>
        </div>
      </div>

      <div
        className="flex rounded-xl border border-white/10 bg-black/30 p-1"
        role="tablist"
        aria-label="Seções de premiação"
      >
        <button
          type="button"
          role="tab"
          aria-selected={aba === "resgatar"}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition",
            aba === "resgatar"
              ? "bg-violet-600/35 text-white shadow-sm"
              : "text-white/45 hover:text-white/70",
          )}
          onClick={() => setAba("resgatar")}
        >
          <Wallet className="h-4 w-4 opacity-80" aria-hidden />
          Resgatar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aba === "historico"}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition",
            aba === "historico"
              ? "bg-violet-600/35 text-white shadow-sm"
              : "text-white/45 hover:text-white/70",
          )}
          onClick={() => setAba("historico")}
        >
          <History className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <span className="whitespace-nowrap">Histórico</span>
          {pendentesCount > 0 ? (
            <span className="rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold leading-none text-slate-950">
              {pendentesCount > 9 ? "9+" : pendentesCount}
            </span>
          ) : null}
        </button>
      </div>

      {msg ? (
        <AlertBanner
          tone={msg.includes("Erro") || msg.includes("inválido") || msg.includes("não tem") ? "error" : "success"}
        >
          {msg}
        </AlertBanner>
      ) : null}

      {aba === "resgatar" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-950/35 via-slate-950/90 to-slate-950 p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/65">Saldo</p>
            <div className="mt-2 flex flex-wrap items-end gap-4">
              <div>
                <p className="text-3xl font-black tabular-nums text-white sm:text-4xl">{balance}</p>
                <p className="text-xs text-white/40">Saldo disponível</p>
              </div>
              <div className="h-10 w-px bg-white/10" aria-hidden />
              <div>
                <p className="text-xl font-bold tabular-nums text-emerald-200 sm:text-2xl">
                  {formatBrl(brlSaldoTotal)}
                </p>
                <p className="text-xs text-white/40">{rate} pts ≈ R$ 1,00</p>
              </div>
            </div>
            {retidoPendente > 0 ? (
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-950/20 px-3 py-2">
                <p className="text-[11px] font-medium text-amber-200/90">
                  Retido: <strong className="tabular-nums">{retidoPendente}</strong> pts (~{formatBrl(saldoPointsToBrl(retidoPendente, rate))})
                </p>
              </div>
            ) : null}
          </div>

          <form
            onSubmit={enviar}
            className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5"
          >
            <div>
              <label className="text-xs font-semibold text-white/50" htmlFor="saldo-valor">
                Pontos de saldo
              </label>
              <input
                id="saldo-valor"
                type="number"
                min={1}
                max={balance || undefined}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-lg font-semibold text-white outline-none focus:border-violet-500/60"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
              {valorNum > 0 ? (
                <p className="mt-2 text-sm text-emerald-200/85">
                  ≈ <strong>{formatBrl(brlResgate)}</strong>
                </p>
              ) : (
                <p className="mt-2 text-xs text-white/30">~{formatBrl(brlPorPonto)} / ponto</p>
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
      ) : (
        <PedidosSaquePanel pedidos={pedidosVisiveis} saldoPointsPerReal={rate} />
      )}
    </div>
  );
}
