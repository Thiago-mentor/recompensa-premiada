"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  syncQuizDuelRefillSchedule,
  syncReactionDuelRefillSchedule,
  syncPptDuelRefillSchedule,
} from "@/services/matchmaking/autoQueueService";
import type { GameId } from "@/types/game";
import type { MultiplayerSlotDocument } from "@/types/gameRoom";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { GameModeSwitcher } from "@/modules/jogos";
import {
  PPT_DEFAULT_DUEL_CHARGES,
  PPT_DUEL_CHARGES_MAX_STACK,
  PPT_REFILL_WAIT_MS,
} from "@/lib/constants/pptPvp";
import {
  QUIZ_DEFAULT_DUEL_CHARGES,
  QUIZ_DUEL_CHARGES_MAX_STACK,
  QUIZ_REFILL_WAIT_MS,
} from "@/lib/constants/quizPvp";
import {
  REACTION_DEFAULT_DUEL_CHARGES,
  REACTION_DUEL_CHARGES_MAX_STACK,
  REACTION_REFILL_WAIT_MS,
} from "@/lib/constants/reactionPvp";
import {
  runPptDuelRewardedAdFlow,
  runQuizDuelRewardedAdFlow,
  runReactionDuelRewardedAdFlow,
} from "@/services/anuncios/rewardedAdService";

function formatCountdownMs(remainingMs: number): string {
  const s = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** Firestore: número ou string; campo ausente → null (UI usa default 3). Negativo = dado corrompido → mostra 0. */
function parsePptDuelsRemaining(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  return Math.min(PPT_DUEL_CHARGES_MAX_STACK, Math.floor(n));
}

function parseReactionDuelsRemaining(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  return Math.min(REACTION_DUEL_CHARGES_MAX_STACK, Math.floor(n));
}

function parseQuizDuelsRemaining(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  return Math.min(QUIZ_DUEL_CHARGES_MAX_STACK, Math.floor(n));
}

const OPTIONS: { id: GameId; label: string; short: string }[] = [
  { id: "ppt", label: "Pedra, papel e tesoura", short: "PPT" },
  { id: "quiz", label: "Quiz rápido", short: "Quiz" },
  { id: "reaction_tap", label: "Reaction tap", short: "Reaction" },
];

function queueCopy(gameId: GameId) {
  if (gameId === "ppt") {
    return {
      summary: "Duelo curto, leitura rápida e 1 carga consumida ao emparelhar.",
      searching: "Cancelando antes do emparelhamento não consome duelo.",
    };
  }
  if (gameId === "quiz") {
    return {
      summary: "Perguntas em tempo real e 1 carga consumida ao emparelhar.",
      searching: "Cancelando antes do emparelhamento não consome duelo.",
    };
  }
  if (gameId === "reaction_tap") {
    return {
      summary: "Reflexo em tempo real e 1 carga consumida ao emparelhar.",
      searching: "Cancelando antes do emparelhamento não consome duelo.",
    };
  }
  return {
    summary: "Vence quem reagir melhor no confronto em tempo real.",
    searching: "Entrando adversário, a sala abre automaticamente.",
  };
}

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
  const [quizDuelsLeft, setQuizDuelsLeft] = useState<number | null>(null);
  const [quizRefillAtMs, setQuizRefillAtMs] = useState<number | null>(null);
  const [reactionDuelsLeft, setReactionDuelsLeft] = useState<number | null>(null);
  const [reactionRefillAtMs, setReactionRefillAtMs] = useState<number | null>(null);
  const [adBusy, setAdBusy] = useState(false);
  const [pptClock, setPptClock] = useState(0);
  const [quizClock, setQuizClock] = useState(0);
  const [reactionClock, setReactionClock] = useState(0);
  const pptRefillAppliedAfterDeadlineRef = useRef(false);
  const quizRefillAppliedAfterDeadlineRef = useRef(false);
  const reactionRefillAppliedAfterDeadlineRef = useRef(false);

  const queueUnavailable = !autoQueueAllowed();

  useEffect(() => {
    setGameId(initialGame);
  }, [initialGame]);

  useEffect(() => {
    if (gameId !== "ppt" && gameId !== "quiz" && gameId !== "reaction_tap") {
      setPptDuelsLeft(null);
      setPptRefillAtMs(null);
      setQuizDuelsLeft(null);
      setQuizRefillAtMs(null);
      setReactionDuelsLeft(null);
      setReactionRefillAtMs(null);
      return;
    }
    const auth = getFirebaseAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setPptDuelsLeft(null);
      setPptRefillAtMs(null);
      setQuizDuelsLeft(null);
      setQuizRefillAtMs(null);
      setReactionDuelsLeft(null);
      setReactionRefillAtMs(null);
      return;
    }
    const db = getFirebaseFirestore();
    const ref = doc(db, COLLECTIONS.users, uid);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setPptDuelsLeft(PPT_DEFAULT_DUEL_CHARGES);
        setPptRefillAtMs(null);
        setQuizDuelsLeft(QUIZ_DEFAULT_DUEL_CHARGES);
        setQuizRefillAtMs(null);
        setReactionDuelsLeft(REACTION_DEFAULT_DUEL_CHARGES);
        setReactionRefillAtMs(null);
        return;
      }
      const data = snap.data();
      const parsed = parsePptDuelsRemaining(data?.pptPvPDuelsRemaining);
      setPptDuelsLeft(parsed ?? PPT_DEFAULT_DUEL_CHARGES);
      const refAt = data?.pptPvpDuelsRefillAvailableAt as { toMillis?: () => number } | undefined;
      setPptRefillAtMs(
        refAt && typeof refAt.toMillis === "function" ? refAt.toMillis() : null,
      );
      const parsedQuiz = parseQuizDuelsRemaining(data?.quizPvPDuelsRemaining);
      setQuizDuelsLeft(parsedQuiz ?? QUIZ_DEFAULT_DUEL_CHARGES);
      const quizRefAt = data?.quizPvpDuelsRefillAvailableAt as { toMillis?: () => number } | undefined;
      setQuizRefillAtMs(
        quizRefAt && typeof quizRefAt.toMillis === "function" ? quizRefAt.toMillis() : null,
      );
      const parsedReaction = parseReactionDuelsRemaining(data?.reactionPvPDuelsRemaining);
      setReactionDuelsLeft(parsedReaction ?? REACTION_DEFAULT_DUEL_CHARGES);
      const reactionRefAt = data?.reactionPvpDuelsRefillAvailableAt as
        | { toMillis?: () => number }
        | undefined;
      setReactionRefillAtMs(
        reactionRefAt && typeof reactionRefAt.toMillis === "function"
          ? reactionRefAt.toMillis()
          : null,
      );
    });
  }, [gameId]);

  useEffect(() => {
    if (gameId !== "ppt" || pptDuelsLeft !== 0) return;
    void syncPptDuelRefillSchedule().catch(() => undefined);
  }, [gameId, pptDuelsLeft]);

  useEffect(() => {
    if (gameId !== "quiz" || quizDuelsLeft !== 0) return;
    void syncQuizDuelRefillSchedule().catch(() => undefined);
  }, [gameId, quizDuelsLeft]);

  useEffect(() => {
    if (gameId !== "reaction_tap" || reactionDuelsLeft !== 0) return;
    void syncReactionDuelRefillSchedule().catch(() => undefined);
  }, [gameId, reactionDuelsLeft]);

  const pptWaitingRefill =
    gameId === "ppt" &&
    pptDuelsLeft !== null &&
    pptDuelsLeft < 1 &&
    pptRefillAtMs !== null &&
    Date.now() < pptRefillAtMs;
  const reactionWaitingRefill =
    gameId === "reaction_tap" &&
    reactionDuelsLeft !== null &&
    reactionDuelsLeft < 1 &&
    reactionRefillAtMs !== null &&
    Date.now() < reactionRefillAtMs;
  const quizWaitingRefill =
    gameId === "quiz" &&
    quizDuelsLeft !== null &&
    quizDuelsLeft < 1 &&
    quizRefillAtMs !== null &&
    Date.now() < quizRefillAtMs;

  useEffect(() => {
    if (!pptWaitingRefill) return;
    const id = window.setInterval(() => setPptClock((c) => c + 1), 1000);
    return () => window.clearInterval(id);
  }, [pptWaitingRefill]);

  useEffect(() => {
    if (!quizWaitingRefill) return;
    const id = window.setInterval(() => setQuizClock((c) => c + 1), 1000);
    return () => window.clearInterval(id);
  }, [quizWaitingRefill]);

  useEffect(() => {
    if (!reactionWaitingRefill) return;
    const id = window.setInterval(() => setReactionClock((c) => c + 1), 1000);
    return () => window.clearInterval(id);
  }, [reactionWaitingRefill]);

  useEffect(() => {
    if (gameId !== "ppt" || pptDuelsLeft !== 0 || pptRefillAtMs === null) {
      pptRefillAppliedAfterDeadlineRef.current = false;
      return;
    }
    if (Date.now() < pptRefillAtMs) return;
    if (pptRefillAppliedAfterDeadlineRef.current) return;
    pptRefillAppliedAfterDeadlineRef.current = true;
    void syncPptDuelRefillSchedule().catch(() => {
      pptRefillAppliedAfterDeadlineRef.current = false;
    });
  }, [gameId, pptDuelsLeft, pptRefillAtMs, pptClock]);

  useEffect(() => {
    if (gameId !== "quiz" || quizDuelsLeft !== 0 || quizRefillAtMs === null) {
      quizRefillAppliedAfterDeadlineRef.current = false;
      return;
    }
    if (Date.now() < quizRefillAtMs) return;
    if (quizRefillAppliedAfterDeadlineRef.current) return;
    quizRefillAppliedAfterDeadlineRef.current = true;
    void syncQuizDuelRefillSchedule().catch(() => {
      quizRefillAppliedAfterDeadlineRef.current = false;
    });
  }, [gameId, quizDuelsLeft, quizRefillAtMs, quizClock]);

  useEffect(() => {
    if (gameId !== "reaction_tap" || reactionDuelsLeft !== 0 || reactionRefillAtMs === null) {
      reactionRefillAppliedAfterDeadlineRef.current = false;
      return;
    }
    if (Date.now() < reactionRefillAtMs) return;
    if (reactionRefillAppliedAfterDeadlineRef.current) return;
    reactionRefillAppliedAfterDeadlineRef.current = true;
    void syncReactionDuelRefillSchedule().catch(() => {
      reactionRefillAppliedAfterDeadlineRef.current = false;
    });
  }, [gameId, reactionDuelsLeft, reactionRefillAtMs, reactionClock]);

  const pptCanEnterQueue =
    gameId !== "ppt" ||
    pptDuelsLeft === null ||
    pptDuelsLeft >= 1 ||
    (pptRefillAtMs !== null && Date.now() >= pptRefillAtMs);
  const reactionCanEnterQueue =
    gameId !== "reaction_tap" ||
    reactionDuelsLeft === null ||
    reactionDuelsLeft >= 1 ||
    (reactionRefillAtMs !== null && Date.now() >= reactionRefillAtMs);
  const quizCanEnterQueue =
    gameId !== "quiz" ||
    quizDuelsLeft === null ||
    quizDuelsLeft >= 1 ||
    (quizRefillAtMs !== null && Date.now() >= quizRefillAtMs);

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
    setError(null);
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
  const activeCopy = queueCopy(gameId);
  const switcherGameId = gameId === "quiz" || gameId === "reaction_tap" ? gameId : "ppt";

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
              {phase === "searching"
                ? `Buscando partida de ${activeLabel.toLowerCase()} em tempo real.`
                : activeCopy.summary}
            </p>
          </header>

          {queueUnavailable ? (
            <AlertBanner tone="error">
              Fila 1v1 indisponível nesta configuração. Para o fluxo principal do projeto, use
              emuladores locais com <code className="text-white/80">NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true</code>{" "}
              e <code className="text-white/80">npm run emulators</code>, ou publique as Cloud
              Functions na nuvem com <code className="text-white/80">NEXT_PUBLIC_SPARK_FREE_TIER=false</code>.
            </AlertBanner>
          ) : null}

          {error ? (
            <AlertBanner tone="error" className="text-sm">
              {error}
            </AlertBanner>
          ) : null}

          {(gameId === "ppt" || gameId === "quiz" || gameId === "reaction_tap") &&
          (gameId === "ppt"
            ? pptDuelsLeft
            : gameId === "quiz"
              ? quizDuelsLeft
              : reactionDuelsLeft) !== null ? (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-950/20 px-4 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200/70">
                Duelos PvP restantes
              </p>
              <p className="mt-1 font-mono text-2xl font-black text-amber-100 tabular-nums">
                {gameId === "ppt"
                  ? pptDuelsLeft
                  : gameId === "quiz"
                    ? quizDuelsLeft
                    : reactionDuelsLeft}
              </p>
              <p className="mt-1 text-[11px] text-white/45">
                1 duelo é descontado ao <span className="text-white/60">emparelhar</span> (ao entrar na
                sala). Sem duelos: anúncio (+3) ou espere{" "}
                {Math.round(
                  (
                    gameId === "ppt"
                      ? PPT_REFILL_WAIT_MS
                      : gameId === "quiz"
                        ? QUIZ_REFILL_WAIT_MS
                        : REACTION_REFILL_WAIT_MS
                  ) / 60000,
                )}{" "}
                min para +3.
              </p>
              {(gameId === "ppt"
                ? pptDuelsLeft
                : gameId === "quiz"
                  ? quizDuelsLeft
                  : reactionDuelsLeft)! < 1 ? (
                <div className="mt-3 space-y-2">
                  {(gameId === "ppt"
                    ? pptWaitingRefill
                    : gameId === "quiz"
                      ? quizWaitingRefill
                      : reactionWaitingRefill) ? (
                    <p className="rounded-xl border border-white/10 bg-black/30 py-3 font-mono text-lg font-black tabular-nums text-amber-100">
                      {formatCountdownMs(
                        (
                          gameId === "ppt"
                            ? pptRefillAtMs
                            : gameId === "quiz"
                              ? quizRefillAtMs
                              : reactionRefillAtMs
                        )! - Date.now(),
                      )}
                    </p>
                  ) : (gameId === "ppt"
                      ? pptRefillAtMs
                      : gameId === "quiz"
                        ? quizRefillAtMs
                        : reactionRefillAtMs) !== null &&
                    Date.now() >=
                      (gameId === "ppt"
                        ? pptRefillAtMs!
                        : gameId === "quiz"
                          ? quizRefillAtMs!
                          : reactionRefillAtMs!) ? (
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
                          const r =
                            gameId === "ppt"
                              ? await runPptDuelRewardedAdFlow()
                              : gameId === "quiz"
                                ? await runQuizDuelRewardedAdFlow()
                                : await runReactionDuelRewardedAdFlow();
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

          <div>
            <GameModeSwitcher
              currentGameId={switcherGameId}
              mode="queue"
              onSelect={(nextGameId) => {
                if (queueUnavailable) return;
                setError(null);
                setGameId(nextGameId);
                router.replace(
                  phase === "searching"
                    ? routeJogosFilaBuscar(nextGameId)
                    : `${ROUTES.jogosFila}?gameId=${nextGameId}`,
                );
              }}
            />
            <p className="mt-3 text-center text-[11px] leading-relaxed text-white/45">
              {activeCopy.summary}
            </p>
          </div>

          {phase === "form" ? (
            <Button
              variant="arena"
              size="lg"
              className="w-full"
              disabled={
                queueUnavailable ||
                (gameId === "ppt" && !pptCanEnterQueue) ||
                (gameId === "quiz" && !quizCanEnterQueue) ||
                (gameId === "reaction_tap" && !reactionCanEnterQueue)
              }
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
                <p className="mt-2 text-[11px] leading-relaxed text-white/45">{activeCopy.searching}</p>
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
