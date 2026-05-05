"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
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
import { runRaffleNumberRewardedAdFlow } from "@/services/anuncios/rewardedAdService";
import { formatRaffleAdCooldownLabel } from "@/lib/admin/rewardedAdCooldownInput";
import type { RafflePurchaseView, RaffleView } from "@/types/raffle";
import { cn } from "@/lib/utils/cn";
import {
  formatRaffleReleasedRangeLabel,
  formatRaffleScopedNumber,
  formatRaffleScopedRange,
  getRaffleProgressPercent,
} from "@/utils/raffle";
import { mapRaffleSnapshotToView } from "@/utils/raffleFirestore";
import { ChevronDown, ChevronUp, Clapperboard, Sparkles, Ticket } from "lucide-react";

const MAX_EXPAND_NUMBERS = 240;
type SorteiosTab = "atual" | "meus_numeros" | "finalizados";

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
  if (currency === "rewardBalance") return `${amount} Saldo`;
  return `${amount} PR`;
}

function statusLabel(status: RaffleView["status"]): string {
  const m: Record<RaffleView["status"], string> = {
    draft: "Rascunho",
    active: "Ativo",
    closed: "Encerrado (aguardando número oficial)",
    drawn: "Sorteado (pagamento pendente)",
    paid: "Concluído com vencedor",
    no_winner: "Encerrado sem vencedor",
  };
  return m[status] ?? status;
}

function scheduleModeLabel(raffle: Pick<RaffleView, "scheduleMode" | "endsAtMs">): string {
  const mode = raffle.scheduleMode ?? (raffle.endsAtMs == null ? "until_sold_out" : "date_range");
  return mode === "until_sold_out" ? "Até esgotar os números" : "Início e fim por data";
}

function winnerLabel(raffle: Pick<RaffleView, "winnerName" | "winnerUsername">): string {
  if (raffle.winnerUsername) return `@${raffle.winnerUsername}`;
  if (raffle.winnerName) return raffle.winnerName;
  return "—";
}

function isFinalizedRaffle(status: RaffleView["status"]): boolean {
  return status === "paid" || status === "no_winner" || status === "drawn";
}

function instantPrizeWinnerLabel(hit: {
  winnerName?: string | null;
  winnerUsername?: string | null;
}): string {
  if (hit.winnerUsername) return `@${hit.winnerUsername}`;
  if (hit.winnerName) return hit.winnerName;
  return "Jogador";
}

function formatWhen(ms: number | null | undefined): string {
  if (ms == null) return "—";
  try {
    return new Date(ms).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return "—";
  }
}

function formatFederalResultWhen(ms: number | null | undefined): string {
  if (ms == null) return "—";
  try {
    return new Date(ms).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function SorteiosPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<SorteiosTab>("atual");
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [raffle, setRaffle] = useState<RaffleView | null>(null);
  const [finalizedRaffles, setFinalizedRaffles] = useState<RaffleView[]>([]);
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
    if (!enabled) {
      setFinalizedRaffles([]);
      return;
    }
    const db = getFirebaseFirestore();
    const historyQuery = query(collection(db, COLLECTIONS.raffles), orderBy("updatedAt", "desc"), limit(24));
    const unsub = onSnapshot(historyQuery, (snap) => {
      const next = snap.docs
        .map((docSnap) => mapRaffleSnapshotToView(docSnap))
        .filter((item): item is RaffleView => item != null && isFinalizedRaffle(item.status));
      setFinalizedRaffles(next);
    });
    return () => unsub();
  }, [enabled]);

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
  const entryMode = raffle?.entryMode ?? "ticket";
  const qtyNum = Math.min(maxPurchase, Math.max(1, Math.floor(Number(quantity) || 0)));
  const canBuy =
    !!user &&
    raffle?.status === "active" &&
    enabled &&
    entryMode === "ticket" &&
    qtyNum >= 1 &&
    qtyNum <= maxPurchase;
  const canBuyWithAd =
    !!user && raffle?.status === "active" && enabled && entryMode === "rewarded_ad";

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

  async function buyWithAd() {
    if (!user || !raffle) return;
    setBuying(true);
    setMsg(null);
    try {
      const flow = await runRaffleNumberRewardedAdFlow(raffle.id);
      if (!flow.ok) {
        setMsg(flow.message);
        return;
      }
      if (!flow.sessionId && !flow.completionToken) {
        setMsg(flow.message);
        return;
      }
      const clientRequestId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      await purchaseRaffleNumbersCallable({
        raffleId: raffle.id,
        quantity: 1,
        clientRequestId,
        rewardedAdSessionId: flow.sessionId,
        rewardedAdCompletionToken: flow.completionToken,
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
    const progressPercent = getRaffleProgressPercent(raffle.soldCount, raffle.releasedCount);
    const instantPrizeCount = (raffle.instantPrizeTiers ?? []).reduce(
      (sum, tier) => sum + Math.max(0, tier.quantity),
      0,
    );
    return { remaining, progressPercent, instantPrizeCount };
  }, [raffle]);

  return (
    <div className="space-y-6 pb-4">
      <section className="overflow-hidden rounded-[1.85rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.2),transparent_38%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-5 shadow-[0_0_56px_-28px_rgba(236,72,153,0.35)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-fuchsia-200/70">Sorteios</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Números da sorte</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              Participe com TICKET ou, quando o sorteio estiver em modo anúncio, assista a um vídeo recompensado para
              ganhar 1 número. Os números saem da faixa liberada pelo admin; esta página atualiza em tempo real.
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

      <section className="rounded-2xl border border-white/10 bg-slate-950/75 p-2">
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: "atual", label: "Atual" },
            { id: "meus_numeros", label: `Meus números (${purchases.length})` },
            { id: "finalizados", label: `Finalizados (${finalizedRaffles.length})` },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-xl px-4 py-3 text-sm font-semibold transition",
                activeTab === tab.id
                  ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white"
                  : "bg-white/[0.03] text-white/65 hover:bg-white/[0.06]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "atual" ? (
        loading ? (
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

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <StatPill
                label={entryMode === "rewarded_ad" ? "Inscrição" : "Preço / número"}
                value={
                  entryMode === "rewarded_ad"
                    ? "1 anúncio = 1 número"
                    : `${raffle.ticketPrice} TICKET`
                }
              />
              <StatPill label="Números liberados" value={String(raffle.releasedCount)} />
              <StatPill label="Já vendidos" value={String(raffle.soldCount)} />
              <StatPill label="Disponíveis" value={hero ? String(hero.remaining) : "—"} />
              <StatPill label="Progresso" value={hero ? `${hero.progressPercent}%` : "—"} />
              <StatPill label="Premiados" value={hero ? String(hero.instantPrizeCount) : "0"} />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/55">
                <span>Modo: {scheduleModeLabel(raffle)}</span>
                <span>{hero ? `${hero.progressPercent}% concluído` : "—"}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 transition-[width]"
                  style={{ width: `${hero?.progressPercent ?? 0}%` }}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-xs text-white/45 sm:grid-cols-2">
              <p>Início: {formatWhen(raffle.startsAtMs)}</p>
              <p>Encerramento: {raffle.endsAtMs ? formatWhen(raffle.endsAtMs) : "Até esgotar os números"}</p>
              <p>Faixa: {formatRaffleReleasedRangeLabel(raffle.releasedCount)}</p>
              <p>Modo: {scheduleModeLabel(raffle)}</p>
              {raffle.resultScheduledAtMs ? (
                <p className="sm:col-span-2">Resultado Federal: {formatFederalResultWhen(raffle.resultScheduledAtMs)}</p>
              ) : null}
            </div>

            {raffle.status === "active" ? (
              entryMode === "rewarded_ad" ? (
                <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6">
                  <p className="text-sm text-white/60">
                    Assista ao anúncio até o fim. Após a validação (AdMob ou ambiente de testes), você recebe{" "}
                    <strong className="text-white">1 número</strong> neste sorteio. Cada anúncio só pode ser usado uma
                    vez. O limite diário de anúncios do app continua valendo.
                    {raffle.rewardedAdCooldownSeconds != null && raffle.rewardedAdCooldownSeconds > 0 ? (
                      <>
                        {" "}
                        Intervalo mínimo entre um número e o próximo:{" "}
                        <strong className="text-white">
                          {formatRaffleAdCooldownLabel(raffle.rewardedAdCooldownSeconds)}
                        </strong>
                        .
                      </>
                    ) : null}
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={!canBuyWithAd || buying}
                    onClick={() => void buyWithAd()}
                  >
                    <Clapperboard className="h-4 w-4" />
                    {buying ? "Processando..." : "Assistir anúncio e ganhar número"}
                  </Button>
                </div>
              ) : (
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
              )
            ) : (
              <div className="mt-6 border-t border-white/10 pt-5 text-sm text-white/55">
                {raffle.status === "closed" || raffle.status === "drawn" ? (
                  <div className="space-y-1">
                    <p>Este sorteio já foi encerrado para compras.</p>
                    {raffle.resultScheduledAtMs ? (
                      <p>
                        Resultado da Federal previsto para{" "}
                        <strong className="text-white">{formatFederalResultWhen(raffle.resultScheduledAtMs)}</strong>.
                      </p>
                    ) : (
                      <p>Aguarde o lançamento do número oficial.</p>
                    )}
                  </div>
                ) : raffle.status === "paid" && raffle.winningNumber != null ? (
                  <div className="space-y-1">
                    <p>
                      Número sorteado:{" "}
                      <strong className="text-white">
                        {formatRaffleScopedNumber(raffle.winningNumber, raffle.releasedCount)}
                      </strong>
                    </p>
                    <p>
                      Ganhador: <strong className="text-white">{winnerLabel(raffle)}</strong>
                    </p>
                  </div>
                ) : raffle.status === "no_winner" && raffle.winningNumber != null ? (
                  <p>
                    Sorteio encerrado. Número sorteado:{" "}
                    <strong className="text-white">
                      {formatRaffleScopedNumber(raffle.winningNumber, raffle.releasedCount)}
                    </strong>{" "}
                    — sem titular vendido.
                  </p>
                ) : (
                  <p>Status: {statusLabel(raffle.status)}</p>
                )}
              </div>
            )}
          </section>

          {raffle.instantPrizeTiers && raffle.instantPrizeTiers.length > 0 ? (
            <section className="rounded-[1.75rem] border border-emerald-400/20 bg-emerald-950/10 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-200/85" />
                <h3 className="text-lg font-black text-white">Números premiados</h3>
              </div>
              <p className="mt-1 text-sm text-white/55">
                Quando um número premiado é comprado, o saldo em pontos entra automaticamente e aparece aqui para todos.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {raffle.instantPrizeTiers.map((tier, index) => (
                  <div key={`tier-${index}`} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                    <p className="text-sm font-semibold text-white">
                      Faixa {index + 1}: {tier.quantity} número(s) de {tier.amount} Saldo
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      Encontrados: {tier.awardedCount ?? 0} / {tier.quantity}
                    </p>
                  </div>
                ))}
              </div>

              {raffle.instantPrizeHits && raffle.instantPrizeHits.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {raffle.instantPrizeHits
                    .slice()
                    .reverse()
                    .map((hit, index) => (
                      <div
                        key={`public-hit-${hit.purchaseId}-${hit.number}-${index}`}
                        className="rounded-2xl border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_45%),linear-gradient(180deg,rgba(2,6,23,0.9),rgba(15,23,42,0.9))] px-4 py-3 text-sm text-white/75 shadow-[0_0_28px_-18px_rgba(16,185,129,0.8)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/90">
                              <Sparkles className="h-3.5 w-3.5" />
                              Número Premiado
                            </p>
                            <p className="mt-2 text-lg font-black tracking-tight text-emerald-100">
                              {formatRaffleScopedNumber(hit.number, raffle.releasedCount)}
                            </p>
                            <p className="mt-1 text-xs text-white/55">{instantPrizeWinnerLabel(hit)}</p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-right">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Premiação</p>
                            <p className="mt-1 text-sm font-bold text-emerald-200">{hit.amount} Saldo</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-white/50">
                  Nenhum número premiado foi encontrado ainda.
                </div>
              )}
            </section>
          ) : null}
        </>
      )
      ) : activeTab === "meus_numeros" ? (
        loading ? (
          <p className="text-sm text-white/55">Carregando números...</p>
        ) : !enabled ? (
          <AlertBanner tone="info">Sorteios desativados no momento.</AlertBanner>
        ) : !raffle ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 text-sm text-white/65">
            Não há sorteio disponível para listar seus números agora.
          </div>
        ) : (
          <MyNumbersSection
            raffle={raffle}
            purchases={purchases}
            purchasesLoading={purchasesLoading}
            nextCursor={nextCursor}
            expandedId={expandedId}
            onToggleExpanded={(purchaseId) =>
              setExpandedId((current) => (current === purchaseId ? null : purchaseId))
            }
            onLoadMore={() => void loadMorePurchases()}
          />
        )
      ) : !enabled ? (
        <AlertBanner tone="info">Sorteios desativados no momento.</AlertBanner>
      ) : finalizedRaffles.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 text-sm text-white/65">
          Ainda não há sorteios finalizados para mostrar.
        </div>
      ) : (
        <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/80 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-200/80" />
            <h3 className="text-lg font-black text-white">Sorteios finalizados</h3>
          </div>
          <p className="mt-1 text-sm text-white/55">
            Consulte os resultados anteriores, com número sorteado, progresso e ganhador.
          </p>

          <div className="mt-4 space-y-4">
            {finalizedRaffles.map((item) => (
              <FinalizedRaffleCard key={item.id} raffle={item} />
            ))}
          </div>
        </section>
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

function MyNumbersSection({
  raffle,
  purchases,
  purchasesLoading,
  nextCursor,
  expandedId,
  onToggleExpanded,
  onLoadMore,
}: {
  raffle: RaffleView;
  purchases: RafflePurchaseView[];
  purchasesLoading: boolean;
  nextCursor: { createdAtMs: number; purchaseId: string } | null;
  expandedId: string | null;
  onToggleExpanded: (purchaseId: string) => void;
  onLoadMore: () => void;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/80 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-amber-200/80" />
        <h3 className="text-lg font-black text-white">Meus números</h3>
      </div>
      <p className="mt-1 text-sm text-white/55">
        Cada linha é uma compra. Expanda para ver os números individuais e os destaques premiados.
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
                      : `Faixa ${formatRaffleScopedRange(p.rangeStart, p.rangeEnd, raffle.releasedCount)}`}
                  </p>
                  {p.numbers && p.numbers.length > 0 ? (
                    <p className="text-xs text-white/40">
                      Referência mín.–máx.:{" "}
                      {formatRaffleScopedRange(
                        Math.min(...p.numbers),
                        Math.max(...p.numbers),
                        raffle.releasedCount,
                      )}
                    </p>
                  ) : null}
                  <p className="text-xs text-white/45">
                    {p.quantity} número(s) ·{" "}
                    {p.entryVia === "rewarded_ad"
                      ? "via anúncio"
                      : `${p.ticketCost} TICKET`}{" "}
                    ·{" "}
                    {p.createdAtMs
                      ? new Date(p.createdAtMs).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
                      : "—"}
                  </p>
                  {p.instantPrizeHits && p.instantPrizeHits.length > 0 ? (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                      <Sparkles className="h-3.5 w-3.5" />
                      {p.instantPrizeHits.length} número(s) premiado(s) ·{" "}
                      {p.instantPrizeHits.reduce((sum, hit) => sum + hit.amount, 0)} Saldo
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onToggleExpanded(p.id)}
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
                  instantPrizeHits={p.instantPrizeHits}
                  expandKey={p.id}
                  releasedCount={raffle.releasedCount}
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
            onClick={onLoadMore}
          >
            {purchasesLoading ? "Carregando..." : "Carregar mais compras"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function ExpandedNumbers({
  rangeStart,
  rangeEnd,
  numbers,
  instantPrizeHits,
  expandKey,
  releasedCount,
}: {
  rangeStart: number;
  rangeEnd: number;
  numbers?: number[] | null;
  instantPrizeHits?: RafflePurchaseView["instantPrizeHits"];
  expandKey: string;
  releasedCount: number;
}) {
  const instantPrizeByNumber = useMemo(
    () =>
      new Map(
        (instantPrizeHits ?? []).map((hit) => [
          hit.number,
          hit,
        ]),
      ),
    [instantPrizeHits],
  );
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
      hint: `amostra em ordem aleatória; faixa contínua ${formatRaffleScopedRange(
        start,
        end,
        releasedCount,
      )}.`,
    } as const;
  }, [numbers, rangeStart, rangeEnd, releasedCount]);

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <div className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-white/5 bg-black/30 p-3">
        {nums.map((n) => (
          <span
            key={`${expandKey}-${n}`}
            className={cn(
              "inline-flex min-w-[4.25rem] items-center justify-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-white/85",
              instantPrizeByNumber.has(n) &&
                "border-emerald-300/35 bg-emerald-500/18 text-emerald-100 shadow-[0_0_20px_-10px_rgba(16,185,129,0.9)]",
            )}
          >
            {instantPrizeByNumber.has(n) ? <Sparkles className="h-3 w-3 shrink-0" /> : null}
            {formatRaffleScopedNumber(n, releasedCount)}
          </span>
        ))}
      </div>
      {instantPrizeHits && instantPrizeHits.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {instantPrizeHits.map((hit, index) => (
            <span
              key={`${expandKey}-hit-${hit.number}-${index}`}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100"
            >
              {formatRaffleScopedNumber(hit.number, releasedCount)} · {hit.amount} Saldo
            </span>
          ))}
        </div>
      ) : null}
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

function FinalizedRaffleCard({ raffle }: { raffle: RaffleView }) {
  const progressPercent = getRaffleProgressPercent(raffle.soldCount, raffle.releasedCount);

  return (
    <article className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/55">
            {statusLabel(raffle.status)}
          </p>
          <h4 className="mt-1 text-lg font-black text-white">{raffle.title}</h4>
          {raffle.description ? <p className="mt-2 text-sm text-white/55">{raffle.description}</p> : null}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Prêmio</p>
          <p className="mt-1 text-base font-bold text-emerald-200">{prizeLabel(raffle.prizeCurrency, raffle.prizeAmount)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatPill label="Números liberados" value={String(raffle.releasedCount)} />
        <StatPill label="Vendidos" value={String(raffle.soldCount)} />
        <StatPill label="Progresso" value={`${progressPercent}%`} />
        <StatPill
          label="Número sorteado"
          value={
            raffle.winningNumber != null
              ? formatRaffleScopedNumber(raffle.winningNumber, raffle.releasedCount)
              : "—"
          }
        />
        <StatPill
          label="Ganhador"
          value={raffle.status === "no_winner" ? "Sem ganhador" : winnerLabel(raffle)}
        />
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-4 grid gap-2 text-xs text-white/45 sm:grid-cols-2 lg:grid-cols-5">
        <p>Modo: {scheduleModeLabel(raffle)}</p>
        <p>Início: {formatWhen(raffle.startsAtMs)}</p>
        <p>Fim: {raffle.endsAtMs ? formatWhen(raffle.endsAtMs) : "Até esgotar os números"}</p>
        <p>Faixa: {formatRaffleReleasedRangeLabel(raffle.releasedCount)}</p>
        <p>Atualizado: {formatWhen(raffle.updatedAtMs)}</p>
      </div>

      {raffle.instantPrizeHits && raffle.instantPrizeHits.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {raffle.instantPrizeHits.slice(0, 12).map((hit, index) => (
            <span
              key={`final-hit-${raffle.id}-${hit.number}-${index}`}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/12 px-3 py-1 text-xs font-semibold text-emerald-100 shadow-[0_0_20px_-12px_rgba(16,185,129,0.8)]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {formatRaffleScopedNumber(hit.number, raffle.releasedCount)} · {hit.amount} Saldo
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
