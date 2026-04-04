"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { ROUTES, routeJogosFilaBuscar } from "@/lib/constants/routes";
import type { GameRoomDocument } from "@/types/gameRoom";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { callFunction } from "@/services/callables/client";
import { isAutoQueueGame } from "@/services/matchmaking/autoQueueService";
import type { GameId } from "@/types/game";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { cn } from "@/lib/utils/cn";
import { AnimatePresence, motion } from "framer-motion";

const PPT_HANDS = ["pedra", "papel", "tesoura"] as const;
type PptHand = (typeof PPT_HANDS)[number];

/** Tempo para escolher na rodada (cliente); ao zerar, envia jogada aleatória. */
const PPT_CHOICE_SECONDS = 10;

function handLabel(h: string) {
  if (h === "pedra") return "Pedra";
  if (h === "papel") return "Papel";
  if (h === "tesoura") return "Tesoura";
  return h;
}

function normalizePptHand(raw: string | undefined): PptHand | null {
  const h = String(raw || "").toLowerCase();
  return (PPT_HANDS as readonly string[]).includes(h) ? (h as PptHand) : null;
}

type RoundFlashPayload = {
  key: string;
  hostHand: PptHand;
  guestHand: PptHand;
  outcome: "host_win" | "guest_win" | "draw";
  headline: string;
  subline: string;
  verdict: "you" | "opp" | "draw";
  hostLabel: string;
  guestLabel: string;
};

function buildRoundFlashPayload(room: GameRoomDocument, isHost: boolean): RoundFlashPayload | null {
  const o = room.pptLastRoundOutcome;
  if (o !== "draw" && o !== "host_win" && o !== "guest_win") return null;
  const hh = normalizePptHand(room.pptLastHostHand);
  const gh = normalizePptHand(room.pptLastGuestHand);
  if (!hh || !gh) return null;

  const hostNome = String(room.hostNome || "Anfitrião").trim();
  const guestNome = String(room.guestNome || "Convidado").trim();

  let verdict: RoundFlashPayload["verdict"];
  let headline: string;
  let subline: string;
  if (o === "draw") {
    verdict = "draw";
    headline = "Empate na rodada!";
    subline = "Empate não pontua — próxima rodada valendo.";
  } else if (o === "host_win") {
    const youWon = isHost;
    verdict = youWon ? "you" : "opp";
    headline = youWon ? "+1 ponto para você!" : "+1 ponto para o oponente!";
    subline = youWon
      ? `${handLabel(hh)} vence ${handLabel(gh)} — você é o anfitrião.`
      : `${handLabel(hh)} vence ${handLabel(gh)} — ponto do anfitrião.`;
  } else {
    const youWon = !isHost;
    verdict = youWon ? "you" : "opp";
    headline = youWon ? "+1 ponto para você!" : "+1 ponto para o oponente!";
    subline = youWon
      ? `${handLabel(gh)} vence ${handLabel(hh)} — você é o convidado.`
      : `${handLabel(gh)} vence ${handLabel(hh)} — ponto do convidado.`;
  }

  const key = `${room.pptHostScore ?? 0}|${room.pptGuestScore ?? 0}|${o}|${hh}|${gh}`;
  return {
    key,
    hostHand: hh,
    guestHand: gh,
    outcome: o,
    headline,
    subline,
    verdict,
    hostLabel: isHost ? "Você" : hostNome.length > 14 ? `${hostNome.slice(0, 14)}…` : hostNome,
    guestLabel: isHost ? (guestNome.length > 14 ? `${guestNome.slice(0, 14)}…` : guestNome) : "Você",
  };
}

function RoundRevealOverlay({ flash }: { flash: RoundFlashPayload }) {
  const glow =
    flash.verdict === "you"
      ? "shadow-[0_0_48px_-8px_rgba(52,211,153,0.55)]"
      : flash.verdict === "opp"
        ? "shadow-[0_0_48px_-8px_rgba(251,113,133,0.45)]"
        : "shadow-[0_0_48px_-8px_rgba(251,191,36,0.4)]";

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Resultado da rodada"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className="absolute inset-0 bg-slate-950/85 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-white/15 bg-gradient-to-b from-violet-950/95 via-slate-950/98 to-slate-950 p-6 sm:p-8",
          glow,
        )}
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 12 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.12),transparent_55%)]" />
        <p className="relative text-center text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-200/70">
          Rodada encerrada
        </p>
        <div
          className="relative mt-6 flex items-stretch justify-center gap-2 sm:gap-5"
          style={{ perspective: 1200 }}
        >
          {[
            { hand: flash.hostHand, label: flash.hostLabel, side: "host" as const, delay: 0.1 },
            { hand: flash.guestHand, label: flash.guestLabel, side: "guest" as const, delay: 0.28 },
          ].map(({ hand, label, side, delay }) => (
            <motion.div
              key={side}
              className="flex flex-1 flex-col items-center gap-2"
              initial={{ opacity: 0, rotateY: -88, z: -40 }}
              animate={{ opacity: 1, rotateY: 0, z: 0 }}
              transition={{
                delay,
                type: "spring",
                stiffness: 280,
                damping: 22,
              }}
              style={{ transformStyle: "preserve-3d" }}
            >
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">{label}</span>
              <div
                className={cn(
                  "flex w-full max-w-[8.5rem] flex-col items-center gap-2 rounded-2xl border-2 bg-gradient-to-b from-white/[0.12] to-slate-950/90 p-4 sm:max-w-[9.5rem] sm:p-5",
                  side === "host" ? "border-cyan-400/45" : "border-fuchsia-400/45",
                )}
              >
                <HandIcon hand={hand} className="h-16 w-16 text-white sm:h-[4.5rem] sm:w-[4.5rem]" />
                <span className="text-sm font-black uppercase tracking-wide text-white">{handLabel(hand)}</span>
              </div>
            </motion.div>
          ))}
          <div className="pointer-events-none absolute left-1/2 top-[55%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <motion.span
              className="select-none bg-gradient-to-b from-amber-300 to-orange-500 bg-clip-text font-black italic text-transparent drop-shadow-[0_0_16px_rgba(251,191,36,0.5)]"
              style={{ fontSize: "clamp(1.75rem, 6vw, 2.5rem)" }}
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 400, damping: 18 }}
            >
              VS
            </motion.span>
          </div>
        </div>

        <motion.div
          className="relative mt-8 space-y-1 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.35 }}
        >
          <p
            className={cn(
              "text-xl font-black tracking-tight sm:text-2xl",
              flash.verdict === "you" && "text-emerald-300 drop-shadow-[0_0_20px_rgba(52,211,153,0.45)]",
              flash.verdict === "opp" && "text-rose-300 drop-shadow-[0_0_20px_rgba(251,113,133,0.35)]",
              flash.verdict === "draw" && "text-amber-200 drop-shadow-[0_0_20px_rgba(251,191,36,0.35)]",
            )}
          >
            {flash.headline}
          </p>
          <p className="text-sm text-white/55">{flash.subline}</p>
        </motion.div>

        <motion.div
          className="relative mt-6 flex justify-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75 }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-cyan-400/80"
              animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.15, 0.85] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.12 }}
            />
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/** Ícones SVG inline — zero requisições extras, ~1 KB no bundle. */
function HandIcon({ hand, className }: { hand: PptHand; className?: string }) {
  const common = cn("h-12 w-12 shrink-0 text-violet-200", className);
  if (hand === "pedra") {
    return (
      <svg viewBox="0 0 64 64" className={common} aria-hidden>
        <path
          fill="currentColor"
          d="M32 8C24 8 18 14 18 22c0 4 2 8 5 10l-4 14c-1 3 1 6 4 7h38c3-1 5-4 4-7l-4-14c3-2 5-6 5-10 0-8-6-14-14-14-3 0-6 1-8 3-2-2-5-3-8-3z"
          opacity="0.92"
        />
      </svg>
    );
  }
  if (hand === "papel") {
    return (
      <svg viewBox="0 0 64 64" className={common} aria-hidden>
        <rect x="10" y="14" width="44" height="36" rx="6" fill="currentColor" opacity="0.88" />
        <rect x="16" y="20" width="32" height="24" rx="2" fill="rgb(15 23 42 / 0.35)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className={common} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        d="M18 42 L32 22 L46 42 M28 32 L22 52 M36 32 L42 52"
        opacity="0.95"
      />
    </svg>
  );
}

/** Verso da carta — oponente ainda não revelado (sem leitura de `ppt_picks` no cliente). */
function CardBackFace({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex aspect-square w-full max-w-[7.5rem] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-fuchsia-500/35 bg-gradient-to-br from-violet-900/95 via-slate-900 to-slate-950 sm:max-w-[9rem]",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-12deg, transparent, transparent 5px, rgba(255,255,255,0.06) 5px, rgba(255,255,255,0.06) 10px)",
        }}
      />
      <div className="pointer-events-none absolute inset-2 rounded-lg border border-white/10" />
      <motion.span
        className="relative font-black text-fuchsia-300/45"
        style={{ fontSize: "clamp(2rem, 8vw, 3rem)" }}
        animate={{ opacity: [0.35, 0.85, 0.35], scale: [0.96, 1.04, 0.96] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      >
        ?
      </motion.span>
    </div>
  );
}

function PptPlayCardFrame({
  tone,
  children,
  label,
}: {
  tone: "you" | "opp";
  children: ReactNode;
  label: string;
}) {
  const ring =
    tone === "you"
      ? "border-cyan-400/50 shadow-[0_0_28px_-6px_rgba(34,211,238,0.4)]"
      : "border-fuchsia-400/40 shadow-[0_0_24px_-8px_rgba(217,70,239,0.25)]";
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <span className="text-[9px] font-bold uppercase tracking-[0.35em] text-white/35">{label}</span>
      <div className={cn("w-full max-w-[9rem] rounded-2xl border-2 bg-slate-950/80 p-3 sm:max-w-[10rem] sm:p-4", ring)}>
        {children}
      </div>
    </div>
  );
}

function legacyOutcomeLine(outcome: GameRoomDocument["pptOutcome"], isHost: boolean): string {
  if (!outcome || outcome === "draw") return "Empate";
  if (outcome === "host_win") return isHost ? "Você venceu" : "Você perdeu";
  return isHost ? "Você perdeu" : "Você venceu";
}

function matchVictoryLine(room: GameRoomDocument, isHost: boolean): string {
  const w = room.pptMatchWinner;
  if (!w) return "Partida encerrada";
  const youWon = (w === "host" && isHost) || (w === "guest" && !isHost);
  return youWon ? "Você venceu a partida!" : "O oponente venceu a partida.";
}

function gameDisplayName(id: string) {
  if (id === "ppt") return "Pedra, papel e tesoura";
  if (id === "quiz") return "Quiz rápido";
  if (id === "reaction_tap") return "Reaction tap";
  return id;
}

function phaseDisplay(phase?: string) {
  if (!phase) return "—";
  const m: Record<string, string> = {
    lobby: "Lobby",
    ppt_playing: "Em jogo",
    ppt_waiting: "Aguardando jogadas",
    completed: "Encerrada",
  };
  return m[phase] ?? phase;
}

function statusDisplay(status?: string) {
  if (!status) return "—";
  const m: Record<string, string> = {
    matched: "Emparelhados",
    playing: "Em partida",
    completed: "Finalizada",
    cancelled: "Cancelada",
  };
  return m[status] ?? status;
}

function HudBadge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "cyan" | "amber" | "emerald";
}) {
  const tones = {
    default: "border-white/15 bg-white/5 text-white/90",
    cyan: "border-cyan-400/35 bg-cyan-500/10 text-cyan-100",
    amber: "border-amber-400/35 bg-amber-500/10 text-amber-100",
    emerald: "border-emerald-400/35 bg-emerald-500/10 text-emerald-100",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

function PlayerPillar({
  nome,
  role,
  align,
  ringClass,
}: {
  nome: string;
  role: string;
  align: "left" | "right";
  ringClass: string;
}) {
  const initial = (nome.trim().slice(0, 1) || "?").toUpperCase();
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-2",
        align === "left" ? "items-start text-left" : "items-end text-right",
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{role}</p>
      <div
        className={cn(
          "relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border-2 text-xl font-black text-white shadow-lg transition-transform duration-300 sm:h-[5.25rem] sm:w-[5.25rem] sm:text-2xl",
          ringClass,
        )}
      >
        <span className="relative z-10 drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]">{initial}</span>
        <span
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-40"
          style={{
            background:
              align === "left"
                ? "radial-gradient(circle at 30% 30%, rgb(34 211 238 / 0.35), transparent 65%)"
                : "radial-gradient(circle at 70% 30%, rgb(217 70 239 / 0.35), transparent 65%)",
          }}
        />
      </div>
      <p className="max-w-[9rem] truncate text-sm font-bold text-white sm:max-w-[11rem] sm:text-base">{nome}</p>
    </div>
  );
}

function lastRoundSummary(isHost: boolean, last?: GameRoomDocument["pptLastRoundOutcome"]) {
  if (!last) return null;
  if (last === "draw") return "Última rodada: empate — ninguém pontuou. Próxima rodada!";
  if (last === "host_win") {
    return isHost
      ? "Última rodada: você marcou 1 ponto."
      : "Última rodada: o oponente marcou 1 ponto.";
  }
  return isHost
    ? "Última rodada: o oponente marcou 1 ponto."
    : "Última rodada: você marcou 1 ponto.";
}

type SubmitPptResult =
  | { status: "queued" }
  | {
      status: "round";
      roundOutcome: string;
      hostHand: string;
      guestHand: string;
      hostScore: number;
      guestScore: number;
    }
  | {
      status: "completed";
      matchWinner: string;
      hostScore: number;
      guestScore: number;
      lastRoundOutcome?: string;
      hostHand?: string;
      guestHand?: string;
    };

export function SalaClient({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const uid = user?.uid;
  const myDisplayName = profile?.nome || user?.displayName || "Você";
  const [room, setRoom] = useState<GameRoomDocument | null | undefined>(undefined);
  const [denied, setDenied] = useState(false);
  const [pptSending, setPptSending] = useState(false);
  const [pptErr, setPptErr] = useState<string | null>(null);
  const [forfeitBusy, setForfeitBusy] = useState(false);
  const [highlightHand, setHighlightHand] = useState<PptHand | null>(null);
  const prevMyPickDoneRef = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState(PPT_CHOICE_SECONDS);
  const [timeoutPick, setTimeoutPick] = useState(false);
  const timeoutFiredRef = useRef(false);
  const matchDoneRef = useRef(false);
  const pptLeaveGen = useRef(0);
  const [roundFlash, setRoundFlash] = useState<RoundFlashPayload | null>(null);
  const lastShownRoundFlashKeyRef = useRef<string | null>(null);
  const skipInitialRoundFlashRef = useRef(true);
  const roundFlashTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setRoom(undefined);
    setDenied(false);
    setPptErr(null);
    setPptSending(false);
    setSecondsLeft(PPT_CHOICE_SECONDS);
    setTimeoutPick(false);
    timeoutFiredRef.current = false;
    setRoundFlash(null);
    lastShownRoundFlashKeyRef.current = null;
    skipInitialRoundFlashRef.current = true;
    if (roundFlashTimeoutRef.current) {
      window.clearTimeout(roundFlashTimeoutRef.current);
      roundFlashTimeoutRef.current = null;
    }
    prevMyPickDoneRef.current = false;
  }, [roomId]);

  useEffect(() => {
    const db = getFirebaseFirestore();
    const ref = doc(db, COLLECTIONS.gameRooms, roomId);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setRoom(null);
          return;
        }
        const d = snap.data() as Omit<GameRoomDocument, "id">;
        const r = { id: snap.id, ...d } as GameRoomDocument;
        setRoom(r);
        if (uid && r.hostUid !== uid && r.guestUid !== uid) {
          setDenied(true);
        } else {
          setDenied(false);
        }
      },
      () => setRoom(null),
    );
  }, [roomId, uid]);

  const submitPpt = useCallback(
    async (hand: PptHand) => {
      if (!uid || pptSending) return;
      setHighlightHand(hand);
      setPptErr(null);
      setPptSending(true);
      try {
        const res = await callFunction<{ roomId: string; hand: string }, SubmitPptResult>(
          "submitPptPick",
          { roomId, hand },
        );
        void res.data;
      } catch (e: unknown) {
        setHighlightHand(null);
        setPptErr(formatFirebaseError(e));
      } finally {
        setPptSending(false);
      }
    },
    [uid, roomId, pptSending],
  );

  const submitPptRef = useRef(submitPpt);
  submitPptRef.current = submitPpt;

  const matchDone =
    room?.phase === "completed" ||
    room?.status === "completed" ||
    room?.pptRewardsApplied === true;

  matchDoneRef.current = matchDone;

  const roundKey = useMemo(() => {
    if (!room || matchDone) return "";
    return [
      room.pptHostScore ?? 0,
      room.pptGuestScore ?? 0,
      room.pptLastRoundOutcome ?? "_",
      (room.pptPickedUids ?? []).slice().sort().join(","),
    ].join(":");
  }, [room, matchDone]);

  /** Chave estável do último resultado PPT (placar + mãos); usada só para o overlay de fim de rodada. */
  const roundOutcomeFlashKey = useMemo(() => {
    if (!room) return "";
    const o = room.pptLastRoundOutcome;
    if (o !== "draw" && o !== "host_win" && o !== "guest_win") return "";
    const hh = normalizePptHand(room.pptLastHostHand);
    const gh = normalizePptHand(room.pptLastGuestHand);
    if (!hh || !gh) return "";
    return `${room.pptHostScore ?? 0}|${room.pptGuestScore ?? 0}|${o}|${hh}|${gh}`;
  }, [
    room?.pptHostScore,
    room?.pptGuestScore,
    room?.pptLastRoundOutcome,
    room?.pptLastHostHand,
    room?.pptLastGuestHand,
  ]);

  useEffect(() => {
    if (room === undefined || room === null || !uid) return;

    if (skipInitialRoundFlashRef.current) {
      skipInitialRoundFlashRef.current = false;
      if (roundOutcomeFlashKey) {
        lastShownRoundFlashKeyRef.current = roundOutcomeFlashKey;
      }
      return;
    }

    if (!roundOutcomeFlashKey) return;

    const isHostLocal = uid === room.hostUid;
    const payload = buildRoundFlashPayload(room, isHostLocal);
    if (!payload || payload.key !== roundOutcomeFlashKey) return;
    if (lastShownRoundFlashKeyRef.current === payload.key) return;

    lastShownRoundFlashKeyRef.current = payload.key;
    if (roundFlashTimeoutRef.current) {
      window.clearTimeout(roundFlashTimeoutRef.current);
    }
    setRoundFlash(payload);
    roundFlashTimeoutRef.current = window.setTimeout(() => {
      setRoundFlash(null);
      roundFlashTimeoutRef.current = null;
    }, 3200);
  }, [room, uid, roundOutcomeFlashKey]);

  useEffect(() => {
    return () => {
      if (roundFlashTimeoutRef.current) {
        window.clearTimeout(roundFlashTimeoutRef.current);
        roundFlashTimeoutRef.current = null;
      }
    };
  }, []);

  const isPpt = room?.gameId === "ppt";
  const picked = room ? new Set(room.pptPickedUids ?? []) : new Set<string>();
  const myPickDone = !!(uid && picked.has(uid));
  const showPptPlay = !!(isPpt && !matchDone && uid);

  /** Só zera a carta “travada” ao fechar a rodada (Firestore limpa `pptPickedUids`), não ao enviar a jogada. */
  useEffect(() => {
    if (prevMyPickDoneRef.current && !myPickDone) {
      setHighlightHand(null);
    }
    prevMyPickDoneRef.current = myPickDone;
  }, [myPickDone]);

  useEffect(() => {
    timeoutFiredRef.current = false;
    setTimeoutPick(false);
    if (!showPptPlay || !uid || myPickDone || matchDone) {
      setSecondsLeft(PPT_CHOICE_SECONDS);
      return;
    }

    let left = PPT_CHOICE_SECONDS;
    setSecondsLeft(left);
    const tick = window.setInterval(() => {
      left -= 1;
      setSecondsLeft(left);
      if (left <= 0) {
        window.clearInterval(tick);
        if (!timeoutFiredRef.current) {
          timeoutFiredRef.current = true;
          setTimeoutPick(true);
          const h = PPT_HANDS[Math.floor(Math.random() * PPT_HANDS.length)]!;
          void submitPptRef.current(h);
        }
      }
    }, 1000);

    return () => window.clearInterval(tick);
  }, [roundKey, showPptPlay, uid, myPickDone, matchDone]);

  /** Presença + W.O. — deps estáveis (evita cleanup a cada snapshot do Firestore). */
  const inLivePptMatch =
    !!uid &&
    !denied &&
    room !== undefined &&
    room !== null &&
    room.gameId === "ppt" &&
    !matchDone;

  useEffect(() => {
    if (!inLivePptMatch) {
      return;
    }
    pptLeaveGen.current += 1;
    const gen = pptLeaveGen.current;
    const ping = () =>
      void callFunction<{ roomId: string }, { ok?: boolean }>("pvpPptPresence", { roomId }).catch(
        () => undefined,
      );
    ping();
    const id = window.setInterval(ping, 25_000);

    const onPageHide = () => {
      if (matchDoneRef.current) return;
      void callFunction<{ roomId: string }, { ok?: boolean }>("forfeitPvpRoom", { roomId }).catch(
        () => undefined,
      );
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("pagehide", onPageHide);
      const g = gen;
      queueMicrotask(() => {
        if (pptLeaveGen.current !== g) return;
        if (matchDoneRef.current) return;
        void callFunction<{ roomId: string }, { ok?: boolean }>("forfeitPvpRoom", { roomId }).catch(
          () => undefined,
        );
      });
    };
  }, [inLivePptMatch, roomId, uid]);

  const confirmForfeit = useCallback(async () => {
    if (!uid || forfeitBusy || matchDoneRef.current) return;
    if (!window.confirm("Desistir? Você perde a partida e o oponente vence.")) return;
    setForfeitBusy(true);
    try {
      await callFunction<{ roomId: string }, { ok?: boolean; applied?: boolean }>("forfeitPvpRoom", {
        roomId,
      });
      router.push(ROUTES.jogos);
    } catch (e: unknown) {
      setPptErr(formatFirebaseError(e));
      setForfeitBusy(false);
    }
  }, [uid, forfeitBusy, roomId, router]);

  if (room === undefined) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-slate-950 via-violet-950/30 to-slate-950 p-8 shadow-[0_0_48px_-12px_rgba(34,211,238,0.2)]">
        <div className="animate-arena-hud-pulse mx-auto h-14 w-14 rounded-2xl border-2 border-cyan-400/40 bg-cyan-500/10" />
        <p className="mt-4 text-center text-sm font-semibold tracking-wide text-cyan-100/80">
          Conectando à arena…
        </p>
      </div>
    );
  }

  if (room === null || denied) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-red-500/25 bg-gradient-to-b from-slate-950 via-red-950/20 to-slate-950 p-6 shadow-[0_0_40px_-10px_rgba(248,113,113,0.25)]">
        <AlertBanner tone="error">
          Sala inválida ou você não participa desta partida.
        </AlertBanner>
        <Link href={routeJogosFilaBuscar("ppt")} className="mt-4 block">
          <Button variant="arena" size="lg" className="w-full">
            Procurar adversário
          </Button>
        </Link>
      </div>
    );
  }

  const isHost = uid === room.hostUid;
  const opponentNome = isHost ? room.guestNome : room.hostNome;
  const filaGameId: GameId =
    room.gameId && isAutoQueueGame(room.gameId) ? room.gameId : "ppt";

  const target = room.pptTargetScore ?? 5;
  const hostPts = room.pptHostScore ?? 0;
  const guestPts = room.pptGuestScore ?? 0;
  const myPts = isHost ? hostPts : guestPts;
  const oppPts = isHost ? guestPts : hostPts;

  const roundHint = !matchDone ? lastRoundSummary(isHost, room.pptLastRoundOutcome) : null;
  const oppLockedIn = !!(uid && picked.size === 1 && !picked.has(uid));
  const myLockedHand: PptHand | null =
    myPickDone && highlightHand && (PPT_HANDS as readonly string[]).includes(highlightHand)
      ? highlightHand
      : null;

  const timerActive = showPptPlay && !myPickDone && !matchDone;
  const timerProgress = timerActive ? secondsLeft / PPT_CHOICE_SECONDS : 0;
  const timerAccent =
    secondsLeft <= 3 ? "rgb(248 113 113)" : secondsLeft <= 6 ? "rgb(251 191 36)" : "rgb(34 211 238)";
  const youWonMatch =
    !!room.pptMatchWinner &&
    ((room.pptMatchWinner === "host" && isHost) || (room.pptMatchWinner === "guest" && !isHost));

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute -inset-px rounded-[1.75rem] opacity-70 blur-xl"
        style={{
          background:
            "linear-gradient(135deg, rgb(34 211 238 / 0.15), rgb(139 92 246 / 0.2), rgb(217 70 239 / 0.12))",
        }}
      />
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-slate-950/95 via-violet-950/25 to-slate-950 shadow-[0_0_60px_-14px_rgba(34,211,238,0.22)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative space-y-5 p-4 sm:p-6">
          {/* HUD cabeçalho */}
          <header className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-xl font-black tracking-tight text-transparent sm:text-2xl">
                {gameDisplayName(room.gameId)}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <HudBadge tone="cyan">{statusDisplay(room.status)}</HudBadge>
              <HudBadge tone="amber">{phaseDisplay(room.phase)}</HudBadge>
            </div>
          </header>

          {/* Duelo VS */}
          <section className="relative rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-950/40 via-slate-950/80 to-fuchsia-950/40 p-4 shadow-inner shadow-black/40 sm:p-5">
            <div className="pointer-events-none absolute inset-x-[20%] top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <PlayerPillar
                nome={myDisplayName}
                role="Você"
                align="left"
                ringClass="border-cyan-400/60 bg-slate-900/90 shadow-[0_0_24px_-4px_rgba(34,211,238,0.45)]"
              />
              <div className="flex shrink-0 flex-col items-center gap-1 px-1">
                <span className="select-none bg-gradient-to-b from-amber-300 via-orange-400 to-red-500 bg-clip-text font-black italic tracking-tighter text-transparent drop-shadow-[0_0_20px_rgba(251,191,36,0.4)] sm:text-4xl text-3xl">
                  VS
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/35">
                  duelo
                </span>
              </div>
              <PlayerPillar
                nome={opponentNome}
                role="Oponente"
                align="right"
                ringClass="border-fuchsia-400/55 bg-slate-900/90 shadow-[0_0_24px_-4px_rgba(217,70,239,0.4)]"
              />
            </div>
          </section>

          {isPpt && !matchDone ? (
            <section className="overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-950/30 via-slate-950/90 to-orange-950/20 p-4 shadow-[0_0_32px_-8px_rgba(251,191,36,0.15)] sm:p-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-200/80">
                  Placar ao vivo
                </p>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="font-mono text-4xl font-black tabular-nums text-cyan-300 drop-shadow-[0_0_20px_rgba(34,211,238,0.35)] sm:text-5xl">
                    {myPts}
                  </span>
                  <span className="text-2xl font-black text-white/25">:</span>
                  <span className="font-mono text-4xl font-black tabular-nums text-fuchsia-300 drop-shadow-[0_0_20px_rgba(217,70,239,0.35)] sm:text-5xl">
                    {oppPts}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-white/45">
                  Meta <span className="font-bold text-amber-200/90">{target}</span> · empate 0 pts
                </p>
              </div>
              <Button
                variant="danger"
                size="lg"
                className="mt-4 w-full border border-red-400/30 shadow-[0_0_24px_-6px_rgba(248,113,113,0.35)]"
                disabled={forfeitBusy}
                onClick={() => void confirmForfeit()}
              >
                {forfeitBusy ? "Desistindo…" : "Desistir — aceito derrota"}
              </Button>
            </section>
          ) : null}

          {isPpt && matchDone && room.pptVoidBothInactive ? (
            <section className="space-y-2 rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900/90 to-slate-950 p-4 sm:p-5">
              <HudBadge tone="default">Anulada</HudBadge>
              <p className="text-base font-black text-white/90 sm:text-lg">
                Sem pontos — ambos inativos (2 rodadas sem jogada).
              </p>
            </section>
          ) : null}

          {isPpt && matchDone && room.pptMatchWinner ? (
            <section
              className={cn(
                "space-y-3 rounded-2xl border p-4 sm:p-5",
                youWonMatch
                  ? "border-emerald-400/35 bg-gradient-to-br from-emerald-950/50 to-slate-950/90 shadow-[0_0_36px_-10px_rgba(52,211,153,0.25)]"
                  : "border-red-500/30 bg-gradient-to-br from-red-950/40 to-slate-950/90 shadow-[0_0_36px_-10px_rgba(248,113,113,0.2)]",
              )}
            >
              <div className="flex items-center gap-2">
                <HudBadge tone={youWonMatch ? "emerald" : "default"}>Fim de partida</HudBadge>
              </div>
              <p
                className={cn(
                  "text-xl font-black sm:text-2xl",
                  youWonMatch ? "text-emerald-200" : "text-red-200",
                )}
              >
                {matchVictoryLine(room, isHost)}
              </p>
              {room.pptEndedByForfeit ? (
                <p className="text-sm text-white/75">
                  {room.pptForfeitedByUid === uid
                    ? "W.O. contra você (desistência, saída ou conexão)."
                    : "Vitória por W.O. — o oponente saiu ou perdeu o sinal."}
                </p>
              ) : null}
              <p className="text-sm text-white/60">
                Placar final · anfitrião <strong className="text-white">{hostPts}</strong> × convidado{" "}
                <strong className="text-white">{guestPts}</strong>
              </p>
              <p className="text-sm text-white/55">
                Última jogada · você{" "}
                {handLabel(isHost ? String(room.pptLastHostHand ?? "—") : String(room.pptLastGuestHand ?? "—"))}{" "}
                · {opponentNome}{" "}
                {handLabel(isHost ? String(room.pptLastGuestHand ?? "—") : String(room.pptLastHostHand ?? "—"))}
              </p>
            </section>
          ) : null}

          {isPpt && matchDone && !room.pptMatchWinner && room.pptOutcome ? (
            <section className="space-y-2 rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-950/40 to-slate-950/90 p-4 sm:p-5">
              <HudBadge tone="emerald">Fim de partida</HudBadge>
              <p className="text-lg font-bold text-white">{legacyOutcomeLine(room.pptOutcome, isHost)}</p>
              <p className="text-sm text-white/60">
                Você:{" "}
                {handLabel(
                  isHost
                    ? String(room.pptLastHostHand ?? room.pptHostHand ?? "—")
                    : String(room.pptLastGuestHand ?? room.pptGuestHand ?? "—"),
                )}{" "}
                · {opponentNome}:{" "}
                {handLabel(
                  isHost
                    ? String(room.pptLastGuestHand ?? room.pptGuestHand ?? "—")
                    : String(room.pptLastHostHand ?? room.pptHostHand ?? "—"),
                )}
              </p>
            </section>
          ) : null}

          {showPptPlay ? (
            <section
              className="space-y-4 rounded-2xl border border-violet-400/25 bg-gradient-to-b from-violet-950/50 via-slate-950/95 to-cyan-950/20 p-4 shadow-[0_0_40px_-12px_rgba(139,92,246,0.25)] sm:space-y-5 sm:p-6"
              aria-label="Pedra, papel e tesoura"
              title="Toque numa carta. Sem escolha, uma jogada aleatória é enviada ao fim do tempo."
            >
              {roundHint ? <span className="sr-only">{roundHint}</span> : null}

              <div className="flex items-start justify-between gap-3">
                <p className="pt-1 text-[10px] font-bold uppercase tracking-[0.35em] text-violet-300/75">
                  {myPickDone ? "Aguardando" : "Escolha"}
                </p>
                {timerActive ? (
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "relative flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center rounded-full border-[3px] bg-slate-950/95 sm:h-[5.5rem] sm:w-[5.5rem]",
                        secondsLeft <= 3 && "animate-arena-timer-urgent border-red-400/70",
                        secondsLeft > 3 && secondsLeft <= 6 && "border-amber-400/65",
                        secondsLeft > 6 && "border-cyan-400/55",
                      )}
                      style={{
                        background: `conic-gradient(${timerAccent} ${timerProgress * 360}deg, rgb(15 23 42 / 0.92) 0deg)`,
                        boxShadow:
                          secondsLeft <= 3
                            ? "0 0 32px rgba(248,113,113,0.35)"
                            : secondsLeft <= 6
                              ? "0 0 28px rgba(251,191,36,0.22)"
                              : "0 0 28px rgba(34,211,238,0.2)",
                      }}
                    >
                      <div className="absolute inset-2 flex flex-col items-center justify-center rounded-full bg-slate-950/95 ring-1 ring-white/10 sm:inset-2.5">
                        <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">
                          Tempo
                        </span>
                        <span
                          className={cn(
                            "font-mono text-2xl font-black tabular-nums sm:text-3xl",
                            secondsLeft <= 3 && "text-red-400",
                            secondsLeft > 3 && secondsLeft <= 6 && "text-amber-300",
                            secondsLeft > 6 && "text-cyan-200",
                          )}
                        >
                          {secondsLeft}
                        </span>
                        <span className="text-[9px] text-white/25">s</span>
                      </div>
                    </div>
                  </div>
                ) : myPickDone ? (
                  <motion.div
                    className="flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-950/20 px-3 py-1.5"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 24 }}
                    aria-hidden
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400/60 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-200/85">
                      Oponente
                    </span>
                  </motion.div>
                ) : null}
              </div>

              {oppLockedIn ? (
                <div className="-mt-1 flex justify-end sm:-mt-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-500/30 bg-fuchsia-950/25 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-fuchsia-200/85">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(217,70,239,0.6)]" />
                    Oponente pronto
                  </span>
                </div>
              ) : null}

              {timeoutPick ? (
                <p className="text-center text-[10px] font-bold uppercase tracking-widest text-amber-300/90">
                  Aleatório
                </p>
              ) : null}
              {pptErr ? (
                <AlertBanner tone="error" className="text-sm">
                  {pptErr}
                </AlertBanner>
              ) : null}

              {myPickDone ? (
                <div
                  className="relative flex items-stretch justify-center gap-1 pt-1 sm:gap-4"
                  style={{ perspective: 1000 }}
                >
                  <PptPlayCardFrame tone="you" label="Você">
                    <motion.div
                      className="flex flex-col items-center gap-2 py-1"
                      initial={{ rotateY: -25, opacity: 0.5 }}
                      animate={{ rotateY: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 280, damping: 22 }}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      {myLockedHand ? (
                        <>
                          <HandIcon
                            hand={myLockedHand}
                            className="h-[3.75rem] w-[3.75rem] text-cyan-200 sm:h-16 sm:w-16"
                          />
                          <span className="text-[10px] font-bold uppercase tracking-wide text-white/50">
                            {handLabel(myLockedHand)}
                          </span>
                        </>
                      ) : (
                        <div className="flex min-h-[5.5rem] flex-col items-center justify-center gap-2 text-white/35">
                          <motion.span
                            className="h-2 w-2 rounded-full bg-white/25"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.2, repeat: Infinity }}
                          />
                          <span className="text-[10px] font-semibold uppercase tracking-widest">…</span>
                        </div>
                      )}
                    </motion.div>
                  </PptPlayCardFrame>

                  <div className="flex w-8 shrink-0 flex-col items-center justify-center self-center sm:w-12">
                    <span className="select-none bg-gradient-to-b from-amber-300 to-orange-500 bg-clip-text font-black italic text-transparent drop-shadow-[0_0_12px_rgba(251,191,36,0.35)] sm:text-xl">
                      VS
                    </span>
                  </div>

                  <PptPlayCardFrame tone="opp" label="Oponente">
                    <motion.div
                      className="py-1"
                      initial={{ rotateY: 25, opacity: 0.35 }}
                      animate={{ rotateY: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.08 }}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <CardBackFace className="mx-auto max-w-[6.5rem] sm:max-w-[7.5rem]" />
                      <p className="sr-only">Carta do oponente oculta até ambos jogarem</p>
                    </motion.div>
                  </PptPlayCardFrame>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  {PPT_HANDS.map((h) => {
                    const selected = highlightHand === h && (pptSending || myPickDone);
                    return (
                      <button
                        key={h}
                        type="button"
                        disabled={pptSending}
                        onClick={() => void submitPpt(h)}
                        className={cn(
                          "group relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border-2 p-3 transition-all duration-200 sm:gap-3 sm:p-4",
                          "bg-gradient-to-b from-white/[0.08] to-slate-950/90",
                          "hover:-translate-y-1 hover:border-cyan-400/50 hover:shadow-[0_12px_40px_-12px_rgba(34,211,238,0.35)]",
                          "active:scale-[0.97] active:brightness-95",
                          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400",
                          "disabled:pointer-events-none disabled:opacity-40",
                          selected &&
                            "border-cyan-400/80 shadow-[0_0_28px_-4px_rgba(34,211,238,0.55)] ring-2 ring-cyan-400/40",
                          !selected && "border-white/15",
                        )}
                      >
                        <div
                          className={cn(
                            "rounded-xl bg-gradient-to-br from-white/10 to-transparent p-2.5 ring-1 transition-all duration-200 sm:p-3",
                            "ring-white/10 group-hover:ring-cyan-400/30",
                            selected && "from-cyan-500/20 ring-cyan-400/50",
                          )}
                        >
                          <HandIcon
                            hand={h}
                            className={cn(
                              "h-12 w-12 transition-transform duration-200 group-hover:scale-110 sm:h-16 sm:w-16",
                              selected ? "text-cyan-200" : "text-violet-200 group-hover:text-cyan-100",
                            )}
                          />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-white/85 sm:text-xs">
                          {handLabel(h)}
                        </span>
                        {selected ? (
                          <span className="absolute right-2 top-2 h-2 w-2 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_10px_rgb(34,211,238)]" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          {!isPpt ? (
            <AlertBanner tone="info" className="text-sm">
              Este jogo ainda não tem modo de sala sincronizado nesta tela — só PPT 1v1 está ligado por
              enquanto.
            </AlertBanner>
          ) : null}

          <footer className="flex flex-col gap-3 border-t border-white/10 pt-4">
            <Link href={ROUTES.jogos}>
              <Button variant="secondary" size="lg" className="w-full font-bold">
                Voltar aos jogos
              </Button>
            </Link>
            <Link
              href={routeJogosFilaBuscar(filaGameId)}
              className={cn(
                "flex min-h-[52px] items-center justify-center rounded-2xl border border-fuchsia-500/35",
                "bg-gradient-to-r from-fuchsia-950/40 to-violet-950/40 text-center text-base font-bold text-fuchsia-100",
                "shadow-[0_0_24px_-8px_rgba(217,70,239,0.35)] transition hover:border-fuchsia-400/50 hover:brightness-110 active:scale-[0.99]",
              )}
            >
              Procurar outro adversário
            </Link>
          </footer>
        </div>
      </div>

      <AnimatePresence>
        {roundFlash ? <RoundRevealOverlay key={roundFlash.key} flash={roundFlash} /> : null}
      </AnimatePresence>
    </div>
  );
}
