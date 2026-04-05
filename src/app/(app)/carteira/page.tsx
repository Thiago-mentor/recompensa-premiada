"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribeWalletTransactions } from "@/services/carteira/walletService";
import { fetchConversionRates } from "@/services/carteira/conversionRates";
import { convertCurrency } from "@/services/carteira/convertCurrency";
import { StatCard } from "@/components/cards/StatCard";
import { WalletRow } from "@/components/cards/WalletRow";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import type { WalletTransaction, WalletTransactionType } from "@/types/wallet";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { Banknote, Coins, Ticket } from "lucide-react";

const filtros: (WalletTransactionType | "todos")[] = [
  "todos",
  "anuncio",
  "missao",
  "streak",
  "vitoria",
  "ranking",
  "referral",
  "conversao",
];

export default function CarteiraPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [filtro, setFiltro] = useState<(typeof filtros)[number]>("todos");
  const [rates, setRates] = useState<{ coinsPerGemBuy: number; coinsPerGemSell: number } | null>(null);
  const [gemsToBuy, setGemsToBuy] = useState("1");
  const [gemsToSell, setGemsToSell] = useState("1");
  const [convertBusy, setConvertBusy] = useState<"buy" | "sell" | null>(null);
  const [convertMsg, setConvertMsg] = useState<string | null>(null);
  const [convertErr, setConvertErr] = useState<string | null>(null);

  const loadRates = useCallback(() => {
    void fetchConversionRates().then(setRates).catch(() => setRates({ coinsPerGemBuy: 500, coinsPerGemSell: 0 }));
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  useEffect(() => {
    if (!user) return;
    const tipo = filtro === "todos" ? null : filtro;
    return subscribeWalletTransactions(user.uid, { pageSize: 50, tipo }, setRows);
  }, [user, filtro]);

  async function handleConvert(direction: "coins_to_gems" | "gems_to_coins") {
    setConvertErr(null);
    setConvertMsg(null);
    const raw = direction === "coins_to_gems" ? gemsToBuy : gemsToSell;
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 1) {
      setConvertErr("Informe uma quantidade inteira ≥ 1.");
      return;
    }
    setConvertBusy(direction === "coins_to_gems" ? "buy" : "sell");
    try {
      await convertCurrency(direction, n);
      setConvertMsg(
        direction === "coins_to_gems"
          ? `Você comprou ${n} ticket(s).`
          : `Você trocou ${n} ticket(s) por PR.`,
      );
      await refreshProfile();
      loadRates();
    } catch (e: unknown) {
      setConvertErr(formatFirebaseError(e));
    } finally {
      setConvertBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Carteira</h1>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="PR" value={profile ? String(profile.coins) : "—"} icon={Coins} />
        <StatCard label="TICKET" value={profile ? String(profile.gems) : "—"} icon={Ticket} />
        <StatCard
          className="col-span-2"
          label="CASH"
          value={profile ? String(profile.rewardBalance) : "—"}
          icon={Banknote}
        />
      </div>

      <section className="space-y-3 rounded-2xl border border-violet-400/25 bg-gradient-to-b from-violet-950/40 to-slate-950/90 p-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Converter PR e TICKET</h2>
          <p className="mt-1 text-xs text-white/55">
            PR recompensa vitórias nos jogos; TICKET será usado nos sorteios. Taxas na economia; cada troca
            gera linhas no extrato (&quot;Conversão&quot;).
          </p>
          <p className="mt-2 text-xs text-white/45">
            CASH acumula para saque — a conversão em reais (PIX) pode ser feita na hora do resgate, conforme
            a taxa que vocês definirem.
          </p>
        </div>
        {convertErr ? (
          <AlertBanner tone="error" className="text-sm">
            {convertErr}
          </AlertBanner>
        ) : null}
        {convertMsg ? (
          <AlertBanner tone="info" className="text-sm">
            {convertMsg}
          </AlertBanner>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-cyan-400/20 bg-black/25 p-3">
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-200/80">PR → TICKET</p>
            <p className="mt-1 text-sm text-white/60">
              Custo:{" "}
              <span className="font-semibold text-white">
                {rates?.coinsPerGemBuy ?? "…"} PR / ticket
              </span>
            </p>
            <label className="mt-3 block text-xs text-white/45" htmlFor="gems-to-buy">
              Quantos tickets deseja receber?
            </label>
            <input
              id="gems-to-buy"
              inputMode="numeric"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
              value={gemsToBuy}
              onChange={(e) => setGemsToBuy(e.target.value.replace(/\D/g, "") || "0")}
            />
            <Button
              type="button"
              variant="arena"
              size="lg"
              className="mt-3 w-full"
              disabled={convertBusy !== null || !user}
              onClick={() => void handleConvert("coins_to_gems")}
            >
              {convertBusy === "buy" ? "Convertendo…" : "Converter"}
            </Button>
          </div>
          <div className="rounded-xl border border-fuchsia-400/20 bg-black/25 p-3">
            <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-200/80">TICKET → PR</p>
            {rates && rates.coinsPerGemSell < 1 ? (
              <p className="mt-2 text-sm text-amber-200/90">
                Troca de TICKET por PR está desligada no painel admin (taxa = 0).
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-white/60">
                  Você recebe:{" "}
                  <span className="font-semibold text-white">
                    {rates?.coinsPerGemSell ?? "…"} PR / ticket
                  </span>
                </p>
                <label className="mt-3 block text-xs text-white/45" htmlFor="gems-to-sell">
                  Quantos tickets deseja trocar?
                </label>
                <input
                  id="gems-to-sell"
                  inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                  value={gemsToSell}
                  onChange={(e) => setGemsToSell(e.target.value.replace(/\D/g, "") || "0")}
                />
                <Button
                  type="button"
                  variant="arena"
                  size="lg"
                  className="mt-3 w-full"
                  disabled={convertBusy !== null || !user || (rates?.coinsPerGemSell ?? 0) < 1}
                  onClick={() => void handleConvert("gems_to_coins")}
                >
                  {convertBusy === "sell" ? "Convertendo…" : "Converter"}
                </Button>
              </>
            )}
          </div>
        </div>
      </section>
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
