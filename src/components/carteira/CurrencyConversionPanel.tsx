"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Coins, RefreshCw, Ticket } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { cn } from "@/lib/utils/cn";
import { fetchConversionRates } from "@/services/carteira/conversionRates";
import { convertCurrency } from "@/services/carteira/convertCurrency";
import { formatFirebaseError } from "@/lib/firebase/errors";

type TabId = "buy" | "sell";

function parseQty(raw: string): number {
  const n = Math.floor(Number(raw.replace(/\D/g, "") || "0"));
  return Number.isFinite(n) ? n : 0;
}

export function CurrencyConversionPanel({
  prBalance,
  ticketBalance,
  signedIn,
  onBalancesUpdated,
}: {
  prBalance: number;
  ticketBalance: number;
  signedIn: boolean;
  onBalancesUpdated: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState<TabId>("buy");
  const [rates, setRates] = useState<{ coinsPerGemBuy: number; coinsPerGemSell: number } | null>(null);
  const [buyQty, setBuyQty] = useState("1");
  const [sellQty, setSellQty] = useState("1");
  const [busy, setBusy] = useState<"buy" | "sell" | null>(null);
  const [refreshingRates, setRefreshingRates] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadRates = useCallback(async () => {
    setRefreshingRates(true);
    try {
      const r = await fetchConversionRates();
      setRates(r);
    } catch {
      setRates({ coinsPerGemBuy: 500, coinsPerGemSell: 0 });
    } finally {
      setRefreshingRates(false);
    }
  }, []);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  const buyN = parseQty(buyQty);
  const sellN = parseQty(sellQty);
  const rateBuy = rates?.coinsPerGemBuy ?? 0;
  const rateSell = rates?.coinsPerGemSell ?? 0;

  const buyTotalPr = buyN > 0 && rateBuy > 0 ? buyN * rateBuy : 0;
  const sellTotalPr = sellN > 0 && rateSell > 0 ? sellN * rateSell : 0;

  const buyOk = useMemo(
    () => signedIn && buyN >= 1 && rateBuy >= 1 && prBalance >= buyTotalPr,
    [signedIn, buyN, rateBuy, prBalance, buyTotalPr],
  );

  const sellOk = useMemo(
    () =>
      signedIn &&
      sellN >= 1 &&
      rateSell >= 1 &&
      ticketBalance >= sellN,
    [signedIn, sellN, rateSell, ticketBalance],
  );

  const maxBuyTickets =
    rateBuy >= 1 ? Math.max(0, Math.floor(prBalance / rateBuy)) : 0;

  async function submitBuy() {
    setErr(null);
    setMsg(null);
    if (!buyOk || buyN < 1) {
      setErr(
        prBalance < buyTotalPr
          ? "PR insuficientes para esta quantidade de TICKET."
          : "Informe pelo menos 1 ticket.",
      );
      return;
    }
    setBusy("buy");
    try {
      await convertCurrency("coins_to_gems", buyN);
      setMsg(`Pronto! Você recebeu ${buyN} ticket${buyN > 1 ? "s" : ""}.`);
      setBuyQty("1");
      await onBalancesUpdated();
      void loadRates();
    } catch (e: unknown) {
      setErr(formatFirebaseError(e));
    } finally {
      setBusy(null);
    }
  }

  async function submitSell() {
    setErr(null);
    setMsg(null);
    if (!sellOk || sellN < 1) {
      setErr(
        ticketBalance < sellN
          ? "Você não tem tickets suficientes."
          : "Informe pelo menos 1 ticket.",
      );
      return;
    }
    setBusy("sell");
    try {
      await convertCurrency("gems_to_coins", sellN);
      setMsg(`Pronto! ${sellN} ticket${sellN > 1 ? "s" : ""} viraram ${sellTotalPr} PR.`);
      setSellQty("1");
      await onBalancesUpdated();
      void loadRates();
    } catch (e: unknown) {
      setErr(formatFirebaseError(e));
    } finally {
      setBusy(null);
    }
  }

  const sellDisabled = rateSell < 1;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[1.65rem] border border-cyan-400/20 bg-gradient-to-b from-slate-950 via-violet-950/35 to-slate-950",
        "shadow-[0_0_60px_-18px_rgba(34,211,238,0.25)]",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(34,211,238,0.12), transparent), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(217,70,239,0.08), transparent), radial-gradient(ellipse 50% 40% at 0% 80%, rgba(251,191,36,0.06), transparent)",
        }}
      />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="relative p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-200/70">
              Troca instantânea
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">
              Central de conversão
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
              Use <span className="font-semibold text-cyan-200/90">PR</span> (vitórias nos jogos) para obter{" "}
              <span className="font-semibold text-fuchsia-200/90">TICKET</span> (sorteios). Você também pode
              devolver tickets por PR, se a taxa estiver ativa no servidor.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadRates()}
            disabled={refreshingRates}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 self-start rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white",
              refreshingRates && "opacity-60",
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshingRates && "animate-spin")} />
            Atualizar taxas
          </button>
        </div>

        {err ? (
          <div className="mt-4">
            <AlertBanner tone="error" className="text-sm">
              {err}
            </AlertBanner>
          </div>
        ) : null}
        {msg ? (
          <div className="mt-4">
            <AlertBanner tone="info" className="text-sm">
              {msg}
            </AlertBanner>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/30 p-1.5 sm:inline-flex sm:flex-nowrap">
          {(
            [
              { id: "buy" as const, label: "Comprar TICKET", sub: "gasta PR" },
              { id: "sell" as const, label: "TICKET → PR", sub: "recupera PR" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setErr(null);
                setMsg(null);
              }}
              className={cn(
                "flex min-w-[10rem] flex-1 flex-col rounded-xl px-4 py-2.5 text-left transition sm:flex-none",
                tab === t.id
                  ? "bg-gradient-to-r from-cyan-600/35 via-violet-600/40 to-fuchsia-600/35 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                  : "text-white/50 hover:bg-white/5 hover:text-white/75",
              )}
            >
              <span className="text-sm font-bold">{t.label}</span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">{t.sub}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_280px] lg:items-stretch">
          <AnimatePresence mode="wait">
            {tab === "buy" ? (
              <motion.div
                key="buy"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 px-4 py-4 sm:gap-6 sm:py-5">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/15 shadow-[0_0_24px_-8px_rgba(34,211,238,0.5)]">
                      <Coins className="h-7 w-7 text-cyan-200" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-200/80">PR</span>
                    <span className="text-xs text-white/45">seu saldo</span>
                    <span className="font-mono text-lg font-black tabular-nums text-white">{prBalance}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 text-white/35">
                    <ArrowRight className="h-6 w-6 sm:h-7 sm:w-7" />
                    <span className="text-center text-[10px] font-bold uppercase tracking-widest">
                      {rateBuy >= 1 ? `${rateBuy} PR` : "—"}
                      <br />
                      <span className="font-normal text-white/30">por ticket</span>
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/15 shadow-[0_0_24px_-8px_rgba(217,70,239,0.45)]">
                      <Ticket className="h-7 w-7 text-fuchsia-200" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-200/80">
                      TICKET
                    </span>
                    <span className="text-xs text-white/45">recebe</span>
                    <span className="font-mono text-lg font-black tabular-nums text-white">{buyN || "—"}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-white/50" htmlFor="conv-buy-qty">
                    Quantos tickets?
                  </label>
                  <div className="mt-2 flex flex-wrap items-stretch gap-2">
                    <div className="flex flex-1 items-center gap-1 rounded-2xl border border-white/10 bg-black/40 p-1 sm:max-w-xs">
                      <button
                        type="button"
                        className="rounded-xl px-3 py-2 text-lg font-bold text-white/60 hover:bg-white/10 hover:text-white"
                        onClick={() => setBuyQty(String(Math.max(1, buyN - 1)))}
                      >
                        −
                      </button>
                      <input
                        id="conv-buy-qty"
                        inputMode="numeric"
                        className="min-w-0 flex-1 bg-transparent text-center font-mono text-xl font-black tabular-nums text-white outline-none"
                        value={buyQty}
                        onChange={(e) => setBuyQty(e.target.value.replace(/\D/g, "") || "")}
                      />
                      <button
                        type="button"
                        className="rounded-xl px-3 py-2 text-lg font-bold text-white/60 hover:bg-white/10 hover:text-white"
                        onClick={() => setBuyQty(String(buyN + 1))}
                      >
                        +
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      className="rounded-2xl border border-white/10 text-xs text-cyan-200/90"
                      disabled={!signedIn || maxBuyTickets < 1}
                      onClick={() => setBuyQty(String(maxBuyTickets))}
                    >
                      Máx. ({maxBuyTickets})
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="sell"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {sellDisabled ? (
                  <div className="rounded-2xl border border-amber-400/25 bg-amber-950/25 px-5 py-10 text-center">
                    <Ticket className="mx-auto h-10 w-10 text-amber-200/60" />
                    <p className="mt-4 text-sm font-semibold text-amber-100/90">
                      Troca TICKET → PR desativada
                    </p>
                    <p className="mt-2 text-xs text-white/45">
                      O admin precisa definir uma taxa maior que zero em{" "}
                      <span className="text-white/60">Conversão PR ↔ TICKET</span> no painel.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-950/15 px-4 py-4 sm:gap-6 sm:py-5">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/15">
                          <Ticket className="h-7 w-7 text-fuchsia-200" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-200/80">
                          TICKET
                        </span>
                        <span className="text-xs text-white/45">seu saldo</span>
                        <span className="font-mono text-lg font-black tabular-nums text-white">
                          {ticketBalance}
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-white/35">
                        <ArrowRight className="h-6 w-6 sm:h-7 sm:w-7" />
                        <span className="text-center text-[10px] font-bold uppercase tracking-widest">
                          {rateSell >= 1 ? `${rateSell} PR` : "—"}
                          <br />
                          <span className="font-normal text-white/30">por ticket</span>
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/15">
                          <Coins className="h-7 w-7 text-cyan-200" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-200/80">PR</span>
                        <span className="text-xs text-white/45">recebe</span>
                        <span className="font-mono text-lg font-black tabular-nums text-white">
                          {sellN > 0 ? sellTotalPr : "—"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-white/50" htmlFor="conv-sell-qty">
                        Quantos tickets enviar?
                      </label>
                      <div className="mt-2 flex flex-wrap items-stretch gap-2">
                        <div className="flex flex-1 items-center gap-1 rounded-2xl border border-white/10 bg-black/40 p-1 sm:max-w-xs">
                          <button
                            type="button"
                            className="rounded-xl px-3 py-2 text-lg font-bold text-white/60 hover:bg-white/10 hover:text-white"
                            onClick={() => setSellQty(String(Math.max(1, sellN - 1)))}
                          >
                            −
                          </button>
                          <input
                            id="conv-sell-qty"
                            inputMode="numeric"
                            className="min-w-0 flex-1 bg-transparent text-center font-mono text-xl font-black tabular-nums text-white outline-none"
                            value={sellQty}
                            onChange={(e) => setSellQty(e.target.value.replace(/\D/g, "") || "")}
                          />
                          <button
                            type="button"
                            className="rounded-xl px-3 py-2 text-lg font-bold text-white/60 hover:bg-white/10 hover:text-white"
                            onClick={() => setSellQty(String(sellN + 1))}
                          >
                            +
                          </button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="md"
                          className="rounded-2xl border border-white/10 text-xs text-fuchsia-200/90"
                          disabled={!signedIn || ticketBalance < 1}
                          onClick={() => setSellQty(String(ticketBalance))}
                        >
                          Usar tudo ({ticketBalance})
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-black/35 p-4 sm:p-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Resumo</p>
              {tab === "buy" ? (
                <dl className="mt-3 space-y-3 text-sm">
                  <div className="flex justify-between gap-2 border-b border-white/5 pb-2">
                    <dt className="text-white/50">Tickets</dt>
                    <dd className="font-mono font-bold text-white">{buyN >= 1 ? buyN : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-white/5 pb-2">
                    <dt className="text-white/50">Custo em PR</dt>
                    <dd
                      className={cn(
                        "font-mono font-bold",
                        prBalance < buyTotalPr && buyN >= 1 ? "text-rose-300" : "text-cyan-200",
                      )}
                    >
                      {buyN >= 1 && rateBuy >= 1 ? buyTotalPr : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 pt-1">
                    <dt className="text-white/50">Saldo após</dt>
                    <dd className="font-mono text-white/80">
                      {buyN >= 1 && rateBuy >= 1 ? Math.max(0, prBalance - buyTotalPr) : "—"}
                    </dd>
                  </div>
                </dl>
              ) : sellDisabled ? (
                <p className="mt-3 text-sm text-white/45">Nenhuma operação disponível.</p>
              ) : (
                <dl className="mt-3 space-y-3 text-sm">
                  <div className="flex justify-between gap-2 border-b border-white/5 pb-2">
                    <dt className="text-white/50">Tickets usados</dt>
                    <dd className="font-mono font-bold text-white">{sellN >= 1 ? sellN : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-white/5 pb-2">
                    <dt className="text-white/50">PR creditados</dt>
                    <dd className="font-mono font-bold text-cyan-200">
                      {sellN >= 1 && rateSell >= 1 ? sellTotalPr : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 pt-1">
                    <dt className="text-white/50">Tickets após</dt>
                    <dd className="font-mono text-white/80">
                      {sellN >= 1 ? Math.max(0, ticketBalance - sellN) : "—"}
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            {tab === "buy" ? (
              <Button
                type="button"
                variant="arena"
                size="lg"
                className="w-full"
                disabled={!signedIn || busy !== null || !buyOk}
                onClick={() => void submitBuy()}
              >
                {busy === "buy" ? "Convertendo…" : "Confirmar compra"}
              </Button>
            ) : sellDisabled ? null : (
              <Button
                type="button"
                variant="arena"
                size="lg"
                className="w-full"
                disabled={!signedIn || busy !== null || !sellOk}
                onClick={() => void submitSell()}
              >
                {busy === "sell" ? "Convertendo…" : "Confirmar troca"}
              </Button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-white/35">
          Saldo (pontos) não entra nesta troca — use a área <span className="text-white/50">Saque Pix</span> para
          resgate. Cada conversão gera lançamentos no extrato.
        </p>
      </div>
    </section>
  );
}
