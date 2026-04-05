"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribeWalletTransactions } from "@/services/carteira/walletService";
import { CurrencyConversionPanel } from "@/components/carteira/CurrencyConversionPanel";
import { StatCard } from "@/components/cards/StatCard";
import { WalletRow } from "@/components/cards/WalletRow";
import type { WalletTransaction, WalletTransactionType } from "@/types/wallet";
import { cn } from "@/lib/utils/cn";
import { Banknote, Coins, ListTree, Ticket } from "lucide-react";

const filtros = [
  "todos",
  "anuncio",
  "missao",
  "streak",
  "vitoria",
  "ranking",
  "referral",
  "conversao",
] as const;

type FiltroExtrato = (typeof filtros)[number];

function labelFiltro(f: FiltroExtrato): string {
  const m: Record<FiltroExtrato, string> = {
    todos: "Tudo",
    anuncio: "Anúncio",
    missao: "Missão",
    streak: "Streak",
    vitoria: "Vitória",
    ranking: "Ranking",
    referral: "Convite",
    conversao: "Conversão",
  };
  return m[f];
}

export default function CarteiraPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [filtro, setFiltro] = useState<FiltroExtrato>("todos");

  useEffect(() => {
    if (!user) return;
    const tipo: WalletTransactionType | null = filtro === "todos" ? null : filtro;
    return subscribeWalletTransactions(user.uid, { pageSize: 50, tipo }, setRows);
  }, [user, filtro]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Carteira</h1>
        <p className="mt-1 text-sm text-white/50">
          PR nos jogos, TICKET nos sorteios, CASH nos resgates.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="PR" value={profile ? String(profile.coins) : "—"} icon={Coins} />
        <StatCard label="TICKET" value={profile ? String(profile.gems) : "—"} icon={Ticket} />
        <StatCard
          className="col-span-2"
          label="CASH (pontos)"
          value={profile ? String(profile.rewardBalance) : "—"}
          icon={Banknote}
        />
      </div>

      <CurrencyConversionPanel
        prBalance={profile?.coins ?? 0}
        ticketBalance={profile?.gems ?? 0}
        signedIn={!!user}
        onBalancesUpdated={refreshProfile}
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListTree className="h-5 w-5 text-violet-300/80" aria-hidden />
            <div>
              <h2 className="text-lg font-bold text-white">Extrato</h2>
              <p className="text-xs text-white/45">Últimas movimentações da sua conta</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {filtros.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                filtro === f
                  ? "border-cyan-400/40 bg-gradient-to-r from-cyan-600/25 to-violet-600/25 text-white shadow-[0_0_20px_-8px_rgba(34,211,238,0.35)]"
                  : "border-transparent bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80",
              )}
            >
              {labelFiltro(f)}
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-1 sm:rounded-3xl sm:p-2">
          <div className="rounded-xl bg-black/20 px-3 py-2 sm:rounded-2xl sm:px-4 sm:py-3">
            {rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/45">Nenhuma movimentação neste filtro.</p>
            ) : (
              rows.map((tx) => <WalletRow key={tx.id} tx={tx} />)
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
