"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { ROUTES, routeJogosFilaBuscar } from "@/lib/constants/routes";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { autoQueueAllowed } from "@/lib/firebase/sparkMode";
import {
  isAutoQueueGame,
  joinAutoMatchQueue,
  leaveAutoMatchQueue,
  syncPptDuelRefillSchedule,
} from "@/services/matchmaking/autoQueueService";
import type { GameId } from "@/types/game";
import type { MultiplayerSlotDocument } from "@/types/gameRoom";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { PPT_DEFAULT_DUEL_CHARGES, PPT_REFILL_WAIT_MS } from "@/lib/constants/pptPvp";
import { runPptDuelRewardedAdFlow } from "@/services/anuncios/rewardedAdService";

function formatCountdownMs(remainingMs: number): string {
  const s = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const OPTIONS: { id: GameId; label: string; short: string }[] = [
  { id: "ppt", label: "Pedra, papel e tesoura", short: "PPT" },
  { id: "quiz", label: "Quiz rápido", short: "Quiz" },
  { id: "reaction_tap", label: "Reaction tap", short: "Reaction" },
];

export function FilaClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("gameId") || "ppt";
  const initialGame: GameId = isAutoQueueGame(raw) ? raw : "ppt";
  const buscarNaUrl = searchParams.get("buscar") === "1";

  const [gameId, setGameId] = useState<GameId>(initialGame);
  const [phase, setPhase] = useState<"form" | "searching">("form");
  const [error, setError] = useState<string | null>(null);
  const [pptDuelsLeft, setPptDuelsLeft] = useState<number | null>(null);
  const [pptRefillAtMs, setPptRefillAtMs] = useState<number | null>(null);
  const [adBusy, setAdBusy] = useState(false);
  const [pptClock, setPptClock] = useState(0);

  const queueUnavailable = !autoQueueAllowed();

  useEffect(() => {
    setGameId(initialGame);
  }, [initialGame]);

  useEffect(() => {
    if (gameId !== "ppt") {
      setPptDuelsLeft(null);
      return;
    }
    const auth = getFirebaseAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setPptDuelsLeft(null);
      return;
    }
    const db = getFirebaseFirestore();
    const ref = doc(db, COLLECTIONS.users, uid);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setPptDuelsLeft(PPT_DEFAULT_DUEL_CHARGES);
        setPptRefillAtMs(null);
        return;
      }
      const data = snap.data();
      const v = data?.pptPvPDuelsRemaining;
      const n = typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null;
      setPptDuelsLeft(n ?? PPT_DEFAULT_DUEL_CHARGES);
      const refAt = data?.pptPvpDuelsRefillAvailableAt as { toMillis?: () => number } | undefined;
      setPptRefillAtMs(
        refAt && typeof refAt.toMillis === "function" ? refAt.toMillis() : null,
      );
    });
  }, [gameId]);

  useEffect(() => {
    if (gameId !== "ppt" || pptDuelsLeft !== 0) return;
    void syncPptDuelRefillSchedule().catch(() => undefined);
  }, [gameId, pptDuelsLeft]);

  const pptWaitingRefill =
    gameId === "ppt" &&
    pptDuelsLeft !== null &&
    pptDuelsLeft < 1 &&
    pptRefillAtMs !== null &&
    Date.now() < pptRefillAtMs;

  useEffect(() => {
    if (!pptWaitingRefill) return;
    const id = window.setInterval(() => setPptClock((c) => c + 1), 1000);
    return () => window.clearInterval(id);
  }, [pptWaitingRefill]);

  useEffect(() => {
    if (gameId !== "ppt" || pptDuelsLeft !== 0 || pptRefillAtMs === null) return;
    if (Date.now() < pptRefillAtMs) return;
    void syncPptDuelRefillSchedule().catch(() => undefined);
  }, [gameId, pptDuelsLeft, pptRefillAtMs, pptClock]);

  const pptCanEnterQueue =
    gameId !== "ppt" ||
    pptDuelsLeft === null ||
    pptDuelsLeft >= 1 ||
    (pptRefillAtMs !== null && Date.now() >= pptRefillAtMs);

  useEffect(() => {
    if (queueUnavailable) {
      setPhase("form");
      return;
    }
    if (buscarNaUrl) {
      setError(null);
      setPhase("searching");
    } else {
      setPhase("form");
    }
  }, [buscarNaUrl, initialGame, queueUnavailable]);

  const stopSearch = useCallback(() => {
    setPhase("form");
    router.replace(`${ROUTES.jogosFila}?gameId=${gameId}`);
  }, [router, gameId]);

  useEffect(() => {
    if (phase !== "searching" || queueUnavailable) return;

    const auth = getFirebaseAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError("Faça login novamente.");
      router.replace(`${ROUTES.jogosFila}?gameId=${gameId}`);
      return;
    }

    let cancelled = false;
    const db = getFirebaseFirestore();
    const slotDoc = doc(db, COLLECTIONS.multiplayerSlots, uid);

    const runJoin = async () => {
      try {
        const r = await joinAutoMatchQueue(gameId);
        if (cancelled) return;
        if (r.status === "matched") {
          router.replace(`${ROUTES.jogos}/sala/${r.roomId}`);
        }
      } catch {
        /* polling ignora falhas transitórias */
      }
    };

    void (async () => {
      try {
        const r = await joinAutoMatchQueue(gameId);
        if (cancelled) return;
        if (r.status === "matched") {
          router.replace(`${ROUTES.jogos}/sala/${r.roomId}`);
          return;
        }
      } catch (e) {
        if (!cancelled) {
          const fe = e instanceof FirebaseError ? e : null;
          if (fe?.code === "functions/resource-exhausted") {
            setError(
              fe.message ||
                "Sem duelos PvP. Assista a um anúncio (+3) ou aguarde 10 minutos.",
            );
          } else {
            setError(formatFirebaseError(e));
          }
          router.replace(`${ROUTES.jogosFila}?gameId=${gameId}`);
        }
        return;
      }
    })();

    const unsub = onSnapshot(slotDoc, async (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as MultiplayerSlotDocument;
      if (d.queueStatus !== "matched" || !d.roomId || d.gameId !== gameId) return;
      try {
        const rs = await getDoc(doc(db, COLLECTIONS.gameRooms, d.roomId));
        if (!rs.exists()) return;
        const rd = rs.data() as { status?: string; gameId?: string };
        if (rd.gameId !== gameId) return;
        const st = rd.status;
        if (st === "matched" || st === "playing") {
          router.replace(`${ROUTES.jogos}/sala/${d.roomId}`);
        }
      } catch {
        /* snapshot transitório */
      }
    });

    const interval = setInterval(runJoin, 4000);

    return () => {
      cancelled = true;
      unsub();
      clearInterval(interval);
      void leaveAutoMatchQueue(gameId).catch(() => undefined);
    };
  }, [phase, gameId, router, queueUnavailable]);

  const activeLabel = OPTIONS.find((x) => x.id === gameId)?.label ?? gameId;

  return (
    <div className="relative mx-auto max-w-lg">
      <div
        className="pointer-events-none absolute -inset-1 rounded-[1.85rem] opacity-60 blur-2xl"
        style={{
          background:
            phase === "searching"
              ? "linear-gradient(135deg, rgb(34 211 238 / 0.2), rgb(139 92 246 / 0.25), rgb(217 70 239 / 0.15))"
              : "linear-gradient(135deg, rgb(139 92 246 / 0.15), rgb(217 70 239 / 0.12))",
        }}
      />
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-slate-950 via-violet-950/30 to-slate-950 shadow-[0_0_56px_-14px_rgba(34,211,238,0.2)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        <div className="relative space-y-5 p-5 sm:p-7">
          <header className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-300/70">
              Matchmaking
            </p>
            <h1 className="mt-2 bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
              {phase === "searching" ? "Procurando adversário" : "Fila 1v1"}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-white/45">
              Emparelhamento em tempo real com outro jogador.
            </p>
          </header>

          {queueUnavailable ? (
            <AlertBanner tone="error">
              Fila 1v1 indisponível nesta configuração. Opções: (1) emuladores —{" "}
              <code className="text-white/80">NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true</code>, reinicie o
              dev server e rode <code className="text-white/80">npm run emulators</code> na raiz do
              projeto; ou (2) nuvem — <code className="text-white/80">NEXT_PUBLIC_SPARK_FREE_TIER=false</code>
              , plano Blaze e <code className="text-white/80">firebase deploy --only functions</code>.
            </AlertBanner>
          ) : null}

          {error ? (
            <AlertBanner tone="error" className="text-sm">
              {error}
            </AlertBanner>
          ) : null}

          {gameId === "ppt" && pptDuelsLeft !== null ? (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-950/20 px-4 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200/70">
                Duelos PvP restantes
              </p>
              <p className="mt-1 font-mono text-2xl font-black text-amber-100 tabular-nums">
                {pptDuelsLeft}
              </p>
              <p className="mt-1 text-[11px] text-white/45">
                Cada partida consome 1 duelo. Sem duelos: anúncio (+3) ou espere{" "}
                {Math.round(PPT_REFILL_WAIT_MS / 60000)} min para +3.
              </p>
              {pptDuelsLeft < 1 ? (
                <div className="mt-3 space-y-2">
                  {pptWaitingRefill ? (
                    <p className="rounded-xl border border-white/10 bg-black/30 py-3 font-mono text-lg font-black tabular-nums text-amber-100">
                      {formatCountdownMs(pptRefillAtMs! - Date.now())}
                    </p>
                  ) : pptRefillAtMs !== null && Date.now() >= pptRefillAtMs ? (
                    <p className="text-xs font-semibold text-emerald-300/90">Liberando duelos…</p>
                  ) : null}
                  <Button
                    variant="arena"
                    size="lg"
                    className="w-full"
                    disabled={adBusy || queueUnavailable}
                    onClick={() => {
                      setAdBusy(true);
                      void (async () => {
                        try {
                          const r = await runPptDuelRewardedAdFlow();
                          if (r.ok) {
                            setError(null);
                          } else {
                            setError(r.message);
                          }
                        } finally {
                          setAdBusy(false);
                        }
                      })();
                    }}
                  >
                    {adBusy ? "Carregando…" : "Assistir anúncio (+3 duelos)"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
              Modo de jogo
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={phase === "searching" || queueUnavailable}
                  onClick={() => {
                    setGameId(o.id);
                    if (phase === "form") {
                      router.replace(`${ROUTES.jogosFila}?gameId=${o.id}`);
                    }
                  }}
                  className={cn(
                    "rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all duration-200",
                    gameId === o.id
                      ? "border-cyan-400/60 bg-gradient-to-br from-cyan-500/25 to-violet-600/20 text-white shadow-[0_0_20px_-4px_rgba(34,211,238,0.4)]"
                      : "border-white/10 bg-white/5 text-white/60 hover:border-violet-400/35 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <span className="block text-xs font-black uppercase tracking-wider text-cyan-200/80">
                    {o.short}
                  </span>
                  <span className="mt-0.5 block max-w-[8.5rem] text-left text-[11px] font-semibold leading-tight text-white/80">
                    {o.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {phase === "form" ? (
            <Button
              variant="arena"
              size="lg"
              className="w-full"
              disabled={queueUnavailable || (gameId === "ppt" && !pptCanEnterQueue)}
              onClick={() => {
                setError(null);
                router.replace(routeJogosFilaBuscar(gameId));
              }}
            >
              Entrar na fila
            </Button>
          ) : (
            <div className="space-y-5">
              <div className="relative mx-auto flex aspect-square w-[min(100%,280px)] items-center justify-center">
                <div
                  className="animate-matchmaking-orbit absolute inset-0 rounded-full border border-dashed border-cyan-400/25"
                  style={{ animationDuration: "12s" }}
                />
                <div className="animate-matchmaking-ping absolute inset-[12%] rounded-full border border-violet-400/20" />
                <div className="animate-matchmaking-ping absolute inset-[24%] rounded-full border border-fuchsia-400/15 [animation-delay:0.4s]" />
                <div className="relative flex h-[42%] w-[42%] items-center justify-center rounded-full border-2 border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 to-violet-900/40 shadow-[0_0_40px_-6px_rgba(34,211,238,0.45)]">
                  <div className="text-center">
                    <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-cyan-200/70">
                      Scan
                    </p>
                    <p className="mt-1 animate-arena-hud-pulse text-lg font-black text-white">···</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-950/40 to-slate-950/90 p-4 text-center shadow-inner">
                <p className="text-sm font-bold text-cyan-100">Buscando oponente em tempo real</p>
                <p className="mt-1 text-xs text-white/50">
                  Modo: <strong className="text-white">{activeLabel}</strong>
                </p>
              </div>

              <Button
                variant="secondary"
                size="lg"
                className="w-full border-red-400/25 font-bold text-red-100 hover:border-red-400/45 hover:bg-red-950/35 hover:shadow-[0_0_24px_-8px_rgba(248,113,113,0.35)]"
                onClick={() => void stopSearch()}
              >
                Cancelar busca
              </Button>
            </div>
          )}

          <Link
            href={ROUTES.jogos}
            className={cn(
              "flex min-h-[48px] items-center justify-center rounded-2xl border border-white/10",
              "bg-white/5 text-sm font-bold text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white",
            )}
          >
            ← Voltar aos jogos
          </Link>
        </div>
      </div>
    </div>
  );
}
