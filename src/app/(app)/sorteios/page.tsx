"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants/routes";
import { COLLECTIONS } from "@/lib/constants/collections";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { formatFirebaseError } from "@/lib/firebase/errors";
import {
  getActiveRaffleCallable,
  listMyRafflePurchasesCallable,
  purchaseRaffleNumbersCallable,
} from "@/services/raffle/raffleService";
import type { RafflePurchaseView, RaffleView } from "@/types/raffle";
import { cn } from "@/lib/utils/cn";
import { formatRaffleNumber, formatRaffleRange } from "@/utils/raffle";
import { mapRaffleSnapshotToView } from "@/utils/raffleFirestore";
import { ChevronDown, ChevronUp, Sparkles, Ticket } from "lucide-react";

const MAX_EXPAND_NUMBERS = 240;

function shuffleArrayInPlace(nums: number[]): void {
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = nums[i]!;
    nums[i] = nums[j]!;
    nums[j] = t;
  }
}

function prizeLabel(currency: string, amount: number): string {
  if (amount <= 0) return "Prêmio a definir";
  if (currency === "gems") return `${amount} TICKET`;
  if (currency === "rewardBalance") return `${amount} CASH`;
  return `${amount} PR`;
}

function statusLabel(status: RaffleView["status"]): string {
  const m: Record<RaffleView["status"], string> = {
    draft: "Rascunho",
    active: "Ativo",
    closed: "Encerrado (sorteio pendente)",
    drawn: "Sorteado (pagamento pendente)",
    paid: "Concluído com vencedor",
    no_winner: "Encerrado sem vencedor",
  };
  return m[status] ?? status;
}

function formatWhen(ms: number | null | undefined): string {
  if (ms == null) return "—";
  try {
    return new Date(ms).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return "—";
  }
}

export default function SorteiosPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [raffle, setRaffle] = useState<RaffleView | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [buying, setBuying] = useState(false);
  const [purchases, setPurchases] = useState<RafflePurchaseView[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<{ createdAtMs: number; purchaseId: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadRaffle = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getActiveRaffleCallable();
      setEnabled(res.enabled);
      setRaffle(res.raffle);
    } catch (e) {
      setMsg(formatFirebaseError(e));
      setRaffle(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRaffle();
  }, [loadRaffle]);

  useEffect(() => {
    if (!enabled || !raffle?.id) return;
    const db = getFirebaseFirestore();
    const ref = doc(db, COLLECTIONS.raffles, raffle.id);
    const unsub = onSnapshot(ref, (snap) => {
      const next = mapRaffleSnapshotToView(snap);
      if (next) setRaffle(next);
    });
    return () => unsub();
  }, [enabled, raffle?.id]);

  useEffect(() => {
    if (!raffle?.maxPerPurchase) return;
    const max = raffle.maxPerPurchase;
    setQuantity((current) => {
      const n = Math.floor(Number(current) || 0);
      return n > max ? String(max) : current;
    });
  }, [raffle?.maxPerPurchase, raffle?.id]);

  useEffect(() => {
    if (!raffle?.id) {
      setPurchases([]);
      setNextCursor(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setPurchasesLoading(true);
      try {
        const res = await listMyRafflePurchasesCallable({
          raffleId: raffle.id,
          pageSize: 15,
          cursor: null,
        });
        if (!cancelled) {
          setPurchases(res.items);
          setNextCursor(res.nextCursor);
        }
      } catch {
        if (!cancelled) {
          setPurchases([]);
          setNextCursor(null);
        }
      } finally {
        if (!cancelled) setPurchasesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [raffle?.id]);

  async function loadMorePurchases() {
    if (!raffle?.id || !nextCursor) return;
    setPurchasesLoading(true);
    try {
      const res = await listMyRafflePurchasesCallable({
        raffleId: raffle.id,
        pageSize: 15,
        cursor: nextCursor,
      });
      setPurchases((prev) => [...prev, ...res.items]);
      setNextCursor(res.nextCursor);
    } finally {
      setPurchasesLoading(false);
    }
  }

  const ticketBalance = profile?.gems ?? 0;
  const maxPurchase = raffle?.maxPerPurchase ?? 500;
  const qtyNum = Math.min(maxPurchase, Math.max(1, Math.floor(Number(quantity) || 0)));
  const canBuy =
    !!user &&
    raffle?.status === "active" &&
    enabled &&
    qtyNum >= 1 &&
    qtyNum <= maxPurchase;

  async function buy() {
    if (!user || !raffle) return;
    setBuying(true);
    setMsg(null);
    try {
      const clientRequestId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      await purchaseRaffleNumbersCallable({
        raffleId: raffle.id,
        quantity: qtyNum,
        clientRequestId,
      });
      await refreshProfile();
      await loadRaffle();
      const res = await listMyRafflePurchasesCallable({ raffleId: raffle.id, pageSize: 15, cursor: null });
      setPurchases(res.items);
      setNextCursor(res.nextCursor);
    } catch (e) {
      setMsg(formatFirebaseError(e));
    } finally {
      setBuying(false);
    }
  }

  const hero = useMemo(() => {
    if (!raffle) return null;
    const remaining = Math.max(0, raffle.releasedCount - raffle.soldCount);
    return { remaining };
  }, [raffle]);

  return (
    <div className="space-y-6 pb-4">
      <section className="overflow-hidden rounded-[1.85rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.2),transparent_38%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-5 shadow-[0_0_56px_-28px_rgba(236,72,153,0.35)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-fuchsia-200/70">Sorteios</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Números da sorte</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              Compre com TICKET: os números são sorteados aleatoriamente dentro da faixa liberada (sem repetição entre
              participantes). A página atualiza em tempo real quando o admin altera regras do sorteio.
            </p>
          </div>
          <Link
            href={ROUTES.carteira}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white/85 transition hover:bg-white/10"
          >
            Voltar à carteira
          </Link>
        </div>
      </section>

      {msg ? (
        <AlertBanner tone="error">
          <div className="flex items-start justify-between gap-3">
            <span>{msg}</span>
            <button
              type="button"
              className="shrink-0 text-xs font-semibold underline"
              onClick={() => setMsg(null)}
            >
              Fechar
            </button>
          </div>
        </AlertBanner>
      ) : null}

      {loading ? (
        <p className="text-sm text-white/55">Carregando sorteio...</p>
      ) : !enabled ? (
        <AlertBanner tone="info">Sorteios desativados no momento.</AlertBanner>
      ) : !raffle ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 text-sm text-white/65">
          Não há sorteio ativo agora. Quando um novo sorteio abrir, ele aparecerá aqui automaticamente.
        </div>
      ) : (
        <>
          <section className="rounded-[1.75rem] border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-950/35 via-slate-950/90 to-slate-950 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200/70">
                  {statusLabel(raffle.status)}
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">{raffle.title}</h2>
                {raffle.description ? (
                  <p className="mt-2 max-w-2xl text-sm text-white/60">{raffle.description}</p>
                ) : null}
                {raffle.prizeImageUrl ? (
                  <div className="relative mt-4 aspect-[16/10] w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                    <Image
                      src={raffle.prizeImageUrl}
                      alt={`Imagem do prêmio: ${raffle.title}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 448px"
                      priority={false}
                    />
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Prêmio</p>
                <p className="mt-1 text-lg font-bold text-emerald-200">
                  {prizeLabel(raffle.prizeCurrency, raffle.prizeAmount)}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatPill label="Preço / número" value={`${raffle.ticketPrice} TICKET`} />
              <StatPill label="Números liberados" value={String(raffle.releasedCount)} />
              <StatPill label="Já vendidos" value={String(raffle.soldCount)} />
              <StatPill label="Disponíveis" value={hero ? String(hero.remaining) : "—"} />
            </div>

            <div className="mt-4 grid gap-2 text-xs text-white/45 sm:grid-cols-2">
              <p>Início: {formatWhen(raffle.startsAtMs)}</p>
              <p>Encerramento: {formatWhen(raffle.endsAtMs)}</p>
            </div>

            {raffle.status === "active" ? (
              <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-end">
                <div className="flex max-w-xs flex-col gap-2">
                  <label className="text-xs font-semibold text-white/70" htmlFor="qty">
                    Quantidade (máx. {raffle.maxPerPurchase})
                  </label>
                  <input
                    id="qty"
                    type="number"
                    min={1}
                    max={raffle.maxPerPurchase}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    onBlur={() => {
                      const n = Math.floor(Number(quantity) || 0);
                      const clamped = Math.min(maxPurchase, Math.max(1, n));
                      setQuantity(String(clamped));
                    }}
                    className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white outline-none ring-fuchsia-500/40 focus:ring-2"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1 text-sm text-white/55">
                  <p>
                    Seu saldo: <strong className="text-white">{ticketBalance} TICKET</strong>
                  </p>
                  <p>
                    Custo desta compra:{" "}
                    <strong className="text-white">{Math.max(1, qtyNum) * raffle.ticketPrice} TICKET</strong>
                  </p>
                </div>
                <Button
                  type="button"
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={!canBuy || buying}
                  onClick={() => void buy()}
                >
                  <Ticket className="h-4 w-4" />
                  {buying ? "Comprando..." : "Comprar números"}
                </Button>
              </div>
            ) : (
              <div className="mt-6 border-t border-white/10 pt-5 text-sm text-white/55">
                {raffle.status === "closed" || raffle.status === "drawn" ? (
                  <p>Este sorteio já foi encerrado para compras. Aguarde o resultado.</p>
                ) : raffle.status === "paid" && raffle.winningNumber != null ? (
                  <p>
                    Número sorteado:{" "}
                    <strong className="text-white">{formatRaffleNumber(raffle.winningNumber)}</strong>
                  </p>
                ) : raffle.status === "no_winner" && raffle.winningNumber != null ? (
                  <p>
                    Sorteio encerrado. Número sorteado:{" "}
                    <strong className="text-white">{formatRaffleNumber(raffle.winningNumber)}</strong> — sem titular
                    vendido.
                  </p>
                ) : (
                  <p>Status: {statusLabel(raffle.status)}</p>
                )}
              </div>
            )}
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/80 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-200/80" />
              <h3 className="text-lg font-black text-white">Meus números (esta edição)</h3>
            </div>
            <p className="mt-1 text-sm text-white/55">
              Cada linha é uma compra. Expanda para ver os números individuais (amostra limitada para não travar o
              app).
            </p>

            {purchasesLoading && purchases.length === 0 ? (
              <p className="mt-4 text-sm text-white/45">Carregando compras...</p>
            ) : purchases.length === 0 ? (
              <p className="mt-4 text-sm text-white/45">Você ainda não tem números neste sorteio.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {purchases.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {p.numbers && p.numbers.length > 0
                            ? `${p.quantity} números aleatórios`
                            : `Faixa ${formatRaffleRange(p.rangeStart, p.rangeEnd)}`}
                        </p>
                        {p.numbers && p.numbers.length > 0 ? (
                          <p className="text-xs text-white/40">
                            Referência mín.–máx.: {formatRaffleRange(Math.min(...p.numbers), Math.max(...p.numbers))}
                          </p>
                        ) : null}
                        <p className="text-xs text-white/45">
                          {p.quantity} número(s) · {p.ticketCost} TICKET ·{" "}
                          {p.createdAtMs
                            ? new Date(p.createdAtMs).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
                            : "—"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedId((cur) => (cur === p.id ? null : p.id))}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/5"
                      >
                        {expandedId === p.id ? (
                          <>
                            Ocultar <ChevronUp className="h-3.5 w-3.5" />
                          </>
                        ) : (
                          <>
                            Ver números <ChevronDown className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                    {expandedId === p.id ? (
                      <ExpandedNumbers
                        rangeStart={p.rangeStart}
                        rangeEnd={p.rangeEnd}
                        numbers={p.numbers}
                        expandKey={p.id}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {nextCursor ? (
              <div className="mt-4">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={purchasesLoading}
                  onClick={() => void loadMorePurchases()}
                >
                  {purchasesLoading ? "Carregando..." : "Carregar mais compras"}
                </Button>
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-1 text-base font-bold text-white">{value}</p>
    </div>
  );
}

function ExpandedNumbers({
  rangeStart,
  rangeEnd,
  numbers,
  expandKey,
}: {
  rangeStart: number;
  rangeEnd: number;
  numbers?: number[] | null;
  expandKey: string;
}) {
  const { nums, total, hint } = useMemo(() => {
    if (numbers && numbers.length > 0) {
      const capped =
        numbers.length > MAX_EXPAND_NUMBERS ? numbers.slice(0, MAX_EXPAND_NUMBERS) : [...numbers];
      shuffleArrayInPlace(capped);
      return {
        nums: capped,
        total: numbers.length,
        hint: "ordem apenas visual; o titular do bilhete é o conjunto sorteado.",
      } as const;
    }
    const start = Math.min(rangeStart, rangeEnd);
    const end = Math.max(rangeStart, rangeEnd);
    const totalR = end - start + 1;
    const show = Math.min(totalR, MAX_EXPAND_NUMBERS);
    const arr = Array.from({ length: show }, (_, i) => start + i);
    shuffleArrayInPlace(arr);
    return {
      nums: arr,
      total: totalR,
      hint: `amostra em ordem aleatória; faixa contínua ${formatRaffleRange(start, end)}.`,
    } as const;
  }, [numbers, rangeStart, rangeEnd]);

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <div className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-white/5 bg-black/30 p-3">
        {nums.map((n) => (
          <span
            key={`${expandKey}-${n}`}
            className={cn(
              "inline-flex min-w-[4.25rem] justify-center rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-white/85",
            )}
          >
            {formatRaffleNumber(n)}
          </span>
        ))}
      </div>
      {total > MAX_EXPAND_NUMBERS ? (
        <p className="mt-2 text-xs text-amber-200/80">
          Mostrando {MAX_EXPAND_NUMBERS} de {total} números ({hint})
        </p>
      ) : (
        <p className="mt-2 text-xs text-white/40">{hint}</p>
      )}
    </div>
  );
}
