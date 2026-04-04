"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribeWalletTransactions } from "@/services/carteira/walletService";
import { StatCard } from "@/components/cards/StatCard";
import { WalletRow } from "@/components/cards/WalletRow";
import type { WalletTransaction, WalletTransactionType } from "@/types/wallet";
import { Coins, Gem, Sparkles } from "lucide-react";

const filtros: (WalletTransactionType | "todos")[] = [
  "todos",
  "anuncio",
  "missao",
  "streak",
  "vitoria",
  "ranking",
  "referral",
];

export default function CarteiraPage() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [filtro, setFiltro] = useState<(typeof filtros)[number]>("todos");

  useEffect(() => {
    if (!user) return;
    const tipo = filtro === "todos" ? null : filtro;
    return subscribeWalletTransactions(user.uid, { pageSize: 50, tipo }, setRows);
  }, [user, filtro]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Carteira</h1>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Moedas" value={profile ? String(profile.coins) : "—"} icon={Coins} />
        <StatCard label="Gems" value={profile ? String(profile.gems) : "—"} icon={Gem} />
        <StatCard
          className="col-span-2"
          label="Saldo prêmio"
          value={profile ? String(profile.rewardBalance) : "—"}
          icon={Sparkles}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-white/80">Filtrar extrato</p>
        <div className="flex flex-wrap gap-2">
          {filtros.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filtro === f ? "bg-violet-600 text-white" : "bg-white/10 text-white/70"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        {rows.length === 0 ? (
          <p className="text-sm text-white/50">Sem movimentações ainda.</p>
        ) : (
          rows.map((tx) => <WalletRow key={tx.id} tx={tx} />)
        )}
      </div>
    </div>
  );
}
