"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { ROUTES, routeJogosFilaBuscar } from "@/lib/constants/routes";
import { resolveMatchEconomy } from "@/lib/games/gameEconomy";
import {
  DEFAULT_PVP_CHOICE_SECONDS,
  parsePvpChoiceSeconds,
  type PvpChoiceSecondsConfig,
} from "@/lib/games/pvpTiming";
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

/** Tempo para exibir o resultado da rodada antes de abrir a próxima pergunta (sem toque). */
const QUIZ_REVEAL_AUTO_ADVANCE_MS = 1800;

/** Padrão de segundos para UI; valores reais vêm de `system_configs/economy.pvpChoiceSeconds`. */

function handLabel(h: string) {
  if (h === "pedra") return "Pedra";
  if (h === "papel") return "Papel";
  if (h === "tesoura") return "Tesoura";
  return h;
}

function handTheme(hand: PptHand) {
  if (hand === "pedra") {
    return {
      glow: "from-cyan-500/30 via-sky-500/15 to-slate-950",
      ring: "border-cyan-400/45 shadow-[0_0_28px_-10px_rgba(34,211,238,0.38)]",
      icon: "text-cyan-100",
      chip: "border-cyan-400/30 bg-cyan-500/12 text-cyan-100",
      hint: "Impacto",
    };
  }
  if (hand === "papel") {
    return {
      glow: "from-fuchsia-500/28 via-violet-500/14 to-slate-950",
      ring: "border-fuchsia-400/45 shadow-[0_0_28px_-10px_rgba(217,70,239,0.34)]",
      icon: "text-fuchsia-100",
      chip: "border-fuchsia-400/30 bg-fuchsia-500/12 text-fuchsia-100",
      hint: "Controle",
    };
  }
  return {
    glow: "from-amber-400/30 via-orange-500/16 to-slate-950",
    ring: "border-amber-300/45 shadow-[0_0_28px_-10px_rgba(251,191,36,0.34)]",
    icon: "text-amber-100",
    chip: "border-amber-300/30 bg-amber-400/12 text-amber-100",
    hint: "Corte",
  };
}

function handAdvantageLine(hand: PptHand) {
  if (hand === "pedra") return "esmaga tesoura";
  if (hand === "papel") return "cobre pedra";
  return "corta papel";
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
      <span className="text-[8px] font-bold uppercase tracking-[0.22em] text-white/35 sm:text-[9px] sm:tracking-[0.35em]">
        {label}
      </span>
      <div
        className={cn(
          "w-full max-w-[6.3rem] rounded-xl border-2 bg-slate-950/80 p-2.5 sm:max-w-[10rem] sm:rounded-2xl sm:p-4",
          ring,
        )}
      >
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
    quiz_playing: "Quiz ao vivo",
    reaction_waiting: "Aguardando sinal",
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

function ResultSummaryPanel({
  gameLabel,
  title,
  victory,
  myName,
  opponentName,
  myScore,
  oppScore,
  primaryLine,
  secondaryLine,
  tertiaryLine,
  rankingPoints,
  rewardCoins,
}: {
  gameLabel: string;
  title: string;
  victory: boolean;
  myName: string;
  opponentName: string;
  myScore: number;
  oppScore: number;
  primaryLine: string;
  secondaryLine?: string | null;
  tertiaryLine?: string | null;
  rankingPoints?: number | null;
  rewardCoins?: number | null;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[1.45rem] border p-4 sm:rounded-[2rem] sm:p-6",
        victory
          ? "border-emerald-400/35 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.22),transparent_28%),linear-gradient(135deg,rgba(6,78,59,0.58),rgba(2,6,23,0.96)_55%,rgba(8,47,73,0.78))] shadow-[0_0_52px_-12px_rgba(52,211,153,0.32)]"
          : "border-rose-500/30 bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.18),transparent_28%),linear-gradient(135deg,rgba(76,5,25,0.5),rgba(2,6,23,0.96)_55%,rgba(80,7,36,0.7))] shadow-[0_0_52px_-12px_rgba(244,63,94,0.26)]",
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(34,211,238,0.12),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(217,70,239,0.14),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(251,191,36,0.08),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <motion.div
        className={cn(
          "pointer-events-none absolute -top-10 h-28 w-28 rounded-full blur-3xl",
          victory ? "left-8 bg-emerald-400/18" : "left-8 bg-rose-400/18",
        )}
        animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.08, 0.95] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -right-10 bottom-0 h-32 w-32 rounded-full bg-fuchsia-400/12 blur-3xl"
        animate={{ opacity: [0.2, 0.45, 0.2], x: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative space-y-4 sm:space-y-5">
        <div className="flex items-center justify-between gap-3">
          <HudBadge tone={victory ? "emerald" : "default"}>{victory ? "Vitória" : "Resultado final"}</HudBadge>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">{gameLabel}</p>
        </div>

        <div className="space-y-3">
          <div>
            <p
              className={cn(
                "text-xl font-black leading-tight sm:text-[2rem]",
                victory ? "text-emerald-200" : "text-rose-100",
              )}
            >
              {title}
            </p>
            <p className="mt-1 text-sm text-white/68 sm:text-[15px]">{primaryLine}</p>
          </div>

          {(rankingPoints != null || rewardCoins != null) && (
            <div className="flex flex-wrap items-center gap-2">
              {rankingPoints != null ? (
                <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/85 shadow-[0_0_18px_-8px_rgba(34,211,238,0.65)]">
                  +{rankingPoints} ranking
                </span>
              ) : null}
              {rewardCoins != null ? (
                <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/85 shadow-[0_0_18px_-8px_rgba(251,191,36,0.55)]">
                  +{rewardCoins} PR
                </span>
              ) : null}
            </div>
          )}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-[1.4rem] border border-white/10 bg-black/25 p-3 sm:gap-3 sm:rounded-[1.7rem] sm:p-4">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.08] px-2 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-3">
            <p
              className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/70"
              title={myName}
            >
              {myName}
            </p>
            <p className="mt-1 font-mono text-4xl font-black text-cyan-300 drop-shadow-[0_0_18px_rgba(34,211,238,0.35)] sm:text-5xl">
              {myScore}
            </p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/35">Seu placar</p>
          </div>
          <div className="text-center">
            <p className="bg-gradient-to-b from-amber-300 via-orange-400 to-red-500 bg-clip-text text-3xl font-black italic text-transparent drop-shadow-[0_0_14px_rgba(251,191,36,0.35)] sm:text-4xl">
              VS
            </p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.22em] text-white/35">arena fechada</p>
          </div>
          <div className="min-w-0 overflow-hidden rounded-2xl border border-fuchsia-400/15 bg-fuchsia-500/[0.08] px-2 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-3">
            <p
              className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-100/70"
              title={opponentName}
            >
              {opponentName}
            </p>
            <p className="mt-1 font-mono text-4xl font-black text-fuchsia-300 drop-shadow-[0_0_18px_rgba(217,70,239,0.35)] sm:text-5xl">
              {oppScore}
            </p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/35">Placar rival</p>
          </div>
        </div>

        {(secondaryLine || tertiaryLine) && (
          <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.04] p-3 sm:p-4">
            {secondaryLine ? <p className="text-sm text-white/72">{secondaryLine}</p> : null}
            {tertiaryLine ? <p className="mt-2 text-sm text-white/52">{tertiaryLine}</p> : null}
          </div>
        )}
      </div>
    </section>
  );
}

function PlayerPillar({
  nome,
  score,
  align,
  ringClass,
  scoreLabel = "Placar",
  progressRatio = 1,
  detail,
}: {
  nome: string;
  score: number;
  align: "left" | "right";
  ringClass: string;
  scoreLabel?: string;
  progressRatio?: number;
  detail?: string | null;
}) {
  const progressPercent = Math.max(0, Math.min(100, progressRatio * 100));
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-1.5 sm:gap-2",
        align === "left" ? "items-start text-left" : "items-end text-right",
      )}
    >
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 sm:gap-1.5 sm:px-2.5 sm:py-1",
          align === "left" ? "" : "flex-row-reverse",
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            align === "left"
              ? "bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.75)]"
              : "bg-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.75)]",
          )}
        />
        <p className="max-w-[7rem] truncate text-[9px] font-bold uppercase tracking-[0.12em] text-white/70 sm:max-w-[11rem] sm:text-[10px]">
          {nome}
        </p>
      </div>
      <div
        className={cn(
          "relative flex h-[3.35rem] w-[3.35rem] items-center justify-center rounded-xl border-2 text-lg font-black text-white shadow-lg transition-transform duration-300 sm:h-[5.25rem] sm:w-[5.25rem] sm:rounded-2xl sm:text-2xl",
          ringClass,
        )}
      >
        <span className="relative z-10 font-mono text-2xl drop-shadow-[0_0_12px_rgba(255,255,255,0.35)] sm:text-4xl">
          {score}
        </span>
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
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45 sm:text-xs">
        {scoreLabel}
      </p>
      {detail ? <p className="text-[10px] text-white/40">{detail}</p> : null}
      <div
        className={cn(
          "hidden w-full max-w-[9rem] sm:block sm:max-w-[11rem]",
          align === "left" ? "" : "sm:flex sm:justify-end",
        )}
      >
        <div className="w-full rounded-full bg-white/8 p-1">
          <div
            className={cn(
              "h-1.5 rounded-full",
              align === "left"
                ? "bg-gradient-to-r from-cyan-300 to-sky-400"
                : "bg-gradient-to-r from-fuchsia-300 to-violet-400",
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function FaceoffBoard({
  myName,
  oppName,
  myScore,
  oppScore,
  target,
  myDetail,
  oppDetail,
  centerCaption,
  actionLabel,
  actionBusy,
  onAction,
}: {
  myName: string;
  oppName: string;
  myScore: number;
  oppScore: number;
  target: number;
  myDetail?: string | null;
  oppDetail?: string | null;
  centerCaption: string;
  actionLabel: string;
  actionBusy: boolean;
  onAction: () => void;
}) {
  const safeTarget = Math.max(1, target);
  return (
    <div className="relative flex items-stretch justify-center gap-2 pt-0.5 sm:gap-4 sm:pt-1">
      <PlayerPillar
        nome={myName}
        score={myScore}
        align="left"
        ringClass="border-cyan-400/50 bg-slate-950/80 shadow-[0_0_28px_-6px_rgba(34,211,238,0.4)]"
        progressRatio={myScore / safeTarget}
        detail={myDetail}
      />

      <div className="flex w-20 shrink-0 flex-col items-center justify-center self-center sm:w-24">
        <span className="select-none bg-gradient-to-b from-amber-300 to-orange-500 bg-clip-text text-lg font-black italic text-transparent drop-shadow-[0_0_12px_rgba(251,191,36,0.35)] sm:text-xl">
          VS
        </span>
        <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.18em] text-white/35">
          meta {target}
        </span>
        <span className="mt-1 text-center text-[8px] font-bold uppercase tracking-[0.16em] text-white/40">
          {centerCaption}
        </span>
        <button
          type="button"
          className="mt-2 rounded-lg border border-red-400/25 bg-red-500/10 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-red-100"
          disabled={actionBusy}
          onClick={onAction}
        >
          {actionBusy ? "..." : actionLabel}
        </button>
      </div>

      <PlayerPillar
        nome={oppName}
        score={oppScore}
        align="right"
        ringClass="border-fuchsia-400/40 bg-slate-950/80 shadow-[0_0_24px_-8px_rgba(217,70,239,0.25)]"
        progressRatio={oppScore / safeTarget}
        detail={oppDetail}
      />
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

function reactionRoundSummary(room: GameRoomDocument, isHost: boolean): string | null {
  const winner = room.reactionLastRoundWinner ?? room.reactionWinner;
  if (!winner) return null;
  if (winner === "draw") {
    if (room.reactionHostFalseStart && room.reactionGuestFalseStart) {
      return "Tempo esgotado ou largada dupla. Rodada sem ponto.";
    }
    return "Tempo esgotado. Ninguem pontuou nesta rodada.";
  }
  const youWon = (winner === "host" && isHost) || (winner === "guest" && !isHost);
  if (youWon) {
    return room.reactionHostFalseStart || room.reactionGuestFalseStart
      ? "Você venceu a rodada por falso start do oponente."
      : "Você venceu a rodada. Seu reflexo foi mais rapido.";
  }
  return room.reactionHostFalseStart || room.reactionGuestFalseStart
    ? "Você perdeu a rodada por falso start."
    : "Você perdeu a rodada. O oponente reagiu mais rapido.";
}

function quizRoundSummary(room: GameRoomDocument): string | null {
  const winner = room.quizLastRoundWinner;
  if (!winner) return null;

  const hostCorrect = room.quizLastHostCorrect === true;
  const guestCorrect = room.quizLastGuestCorrect === true;
  const winnerName = winner === "host" ? room.hostNome : winner === "guest" ? room.guestNome : "";

  if (winner === "draw") {
    if (hostCorrect && guestCorrect) {
      return "Os dois acertaram. Rodada empatada — ninguém marca ponto.";
    }
    if (!hostCorrect && !guestCorrect) {
      return "Os dois erraram. Rodada empatada — ninguém marca ponto.";
    }
    return "Rodada empatada — ninguém marca ponto.";
  }

  if (winnerName) {
    return `${winnerName} marcou o ponto (acertou e o adversário errou).`;
  }

  return null;
}

function quizOptionArraysEqual(a?: string[], b?: string[]): boolean {
  if (!a?.length && !b?.length) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/**
 * Entre rodadas o Firestore já traz a próxima pergunta em `quizOptions`, mas a revelação é da rodada anterior.
 * A UI mostra primeiro só o resultado; a pergunta nova ocupa o mesmo painel após um breve intervalo (automático).
 */
function quizInterstitialRevealActive(room: GameRoomDocument): boolean {
  const answered = room.quizAnsweredUids?.length ?? 0;
  if (answered !== 0) return false;
  if (!room.quizLastRevealOptions?.length || typeof room.quizLastRevealCorrectIndex !== "number") {
    return false;
  }
  if (!room.quizLastRoundWinner) return false;
  return !quizOptionArraysEqual(room.quizLastRevealOptions, room.quizOptions ?? []);
}

function quizRevealSameCardRows(
  options: string[],
  correctIndex: number,
  myPickIndex: number | null | undefined,
  youWrong: boolean,
  keyPrefix: string,
): ReactNode {
  return (
    <div className="space-y-2">
      {youWrong ? (
        <p className="text-sm font-medium text-emerald-100/95">
          Você errou nesta rodada. A alternativa certa está em{" "}
          <span className="font-semibold text-emerald-300">verde</span>.
        </p>
      ) : null}
      <div className="grid gap-2 sm:gap-3">
        {options.map((option, index) => {
          const isCorrect = index === correctIndex;
          const wasMyPick = typeof myPickIndex === "number" && myPickIndex === index;
          return (
            <div
              key={`${keyPrefix}-${index}`}
              className={cn(
                "group relative flex items-center gap-2 overflow-hidden rounded-[1.1rem] border-2 px-4 py-3 text-left text-sm font-semibold sm:rounded-[1.35rem] sm:px-5 sm:py-4",
                isCorrect
                  ? "border-emerald-400/75 bg-emerald-500/20 text-emerald-50 shadow-[0_0_24px_-8px_rgba(52,211,153,0.45)]"
                  : wasMyPick
                    ? "border-fuchsia-400/50 bg-fuchsia-500/12 text-white"
                    : "border-white/10 bg-black/25 text-white/70",
              )}
            >
              <span
                className={cn(
                  "relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-black",
                  isCorrect
                    ? "border-emerald-300/60 bg-emerald-950/40 text-emerald-100"
                    : "border-white/15 bg-black/30 text-white/80",
                )}
              >
                {String.fromCharCode(65 + index)}
              </span>
              <span className="relative flex-1">{option}</span>
              {isCorrect ? (
                <span className="relative text-[9px] font-bold uppercase tracking-widest text-emerald-200/90">
                  Correta
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function reactionRoundHeadline(room: GameRoomDocument, isHost: boolean): {
  title: string;
  tone: "emerald" | "rose" | "amber";
} | null {
  const winner = room.reactionLastRoundWinner ?? room.reactionWinner;
  if (!winner) return null;
  if (winner === "draw") {
    return { title: "Tempo esgotado", tone: "amber" };
  }
  const youWon = (winner === "host" && isHost) || (winner === "guest" && !isHost);
  return youWon
    ? { title: "Voce venceu a rodada", tone: "emerald" }
    : { title: "Voce perdeu a rodada", tone: "rose" };
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

type SubmitQuizResult =
  | { status: "queued" }
  | {
      status: "round";
      roundWinner: "host" | "guest" | "draw";
      hostScore: number;
      guestScore: number;
    }
  | {
      status: "completed";
      matchWinner: "host" | "guest";
      hostScore: number;
      guestScore: number;
    };

type SubmitReactionResult =
  | { status: "queued" }
  | {
      status: "round";
      winner: "host" | "guest" | "draw";
      hostMs: number;
      guestMs: number;
      hostScore: number;
      guestScore: number;
    }
  | {
      status: "completed";
      winner: "host" | "guest" | "draw";
      hostMs: number;
      guestMs: number;
      hostScore: number;
      guestScore: number;
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
  const [quizSending, setQuizSending] = useState(false);
  const [quizErr, setQuizErr] = useState<string | null>(null);
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [reactionSending, setReactionSending] = useState(false);
  const [reactionErr, setReactionErr] = useState<string | null>(null);
  const [reactionClock, setReactionClock] = useState(() => Date.now());
  const [quizSecondsLeft, setQuizSecondsLeft] = useState<number>(DEFAULT_PVP_CHOICE_SECONDS.quiz);
  const [quizTimeoutAnswer, setQuizTimeoutAnswer] = useState(false);
  /** Intersticial: só mostra a pergunta nova no mesmo painel depois que o jogador confirma o resultado. */
  const [quizRevealDismissedKey, setQuizRevealDismissedKey] = useState<string | null>(null);
  const [forfeitBusy, setForfeitBusy] = useState(false);
  const [highlightHand, setHighlightHand] = useState<PptHand | null>(null);
  const quizStartedAtRef = useRef<number>(Date.now());
  const reactionStartPerfRef = useRef<number | null>(null);
  const quizTimeoutFiredRef = useRef(false);
  const prevMyPickDoneRef = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(DEFAULT_PVP_CHOICE_SECONDS.ppt);
  const [timeoutPick, setTimeoutPick] = useState(false);
  const timeoutFiredRef = useRef(false);
  const pptSubmitLockedRef = useRef(false);
  const reactionSubmitLockedRef = useRef(false);
  const matchDoneRef = useRef(false);
  const quizMatchFinalScrollRef = useRef<HTMLDivElement>(null);
  const prevQuizMatchDoneRef = useRef(false);
  const timeoutResolveKeyRef = useRef("");
  const pptLeaveGen = useRef(0);
  const [roundFlash, setRoundFlash] = useState<RoundFlashPayload | null>(null);
  const lastShownRoundFlashKeyRef = useRef<string | null>(null);
  const skipInitialRoundFlashRef = useRef(true);
  const roundFlashTimeoutRef = useRef<number | null>(null);
  const [pvpChoiceSec, setPvpChoiceSec] = useState<PvpChoiceSecondsConfig>(() =>
    parsePvpChoiceSeconds(undefined),
  );
  const pvpChoiceSecRef = useRef(pvpChoiceSec);
  pvpChoiceSecRef.current = pvpChoiceSec;

  useEffect(() => {
    const db = getFirebaseFirestore();
    const ref = doc(db, COLLECTIONS.systemConfigs, "economy");
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        setPvpChoiceSec(parsePvpChoiceSeconds(snap.data()));
      },
      (err) => {
        console.error(
          "[PvP] Não foi possível ler system_configs/economy (tempo de resposta). Verifique login, regras do Firestore e deploy.",
          err,
        );
      },
    );
  }, []);

  useEffect(() => {
    setRoom(undefined);
    setDenied(false);
    setPptErr(null);
    setQuizErr(null);
    setReactionErr(null);
    setPptSending(false);
    setQuizSending(false);
    setReactionSending(false);
    setQuizSelected(null);
    setReactionClock(Date.now());
    setQuizSecondsLeft(pvpChoiceSecRef.current.quiz);
    setQuizTimeoutAnswer(false);
    setSecondsLeft(pvpChoiceSecRef.current.ppt);
    setTimeoutPick(false);
    quizTimeoutFiredRef.current = false;
    timeoutFiredRef.current = false;
    pptSubmitLockedRef.current = false;
    reactionSubmitLockedRef.current = false;
    setRoundFlash(null);
    lastShownRoundFlashKeyRef.current = null;
    skipInitialRoundFlashRef.current = true;
    if (roundFlashTimeoutRef.current) {
      window.clearTimeout(roundFlashTimeoutRef.current);
      roundFlashTimeoutRef.current = null;
    }
    prevMyPickDoneRef.current = false;
    reactionStartPerfRef.current = null;
    timeoutResolveKeyRef.current = "";
    prevQuizMatchDoneRef.current = false;
  }, [roomId]);

  useEffect(() => {
    quizStartedAtRef.current = Date.now();
    setQuizSelected(null);
    setQuizErr(null);
    setQuizSecondsLeft(pvpChoiceSecRef.current.quiz);
    setQuizTimeoutAnswer(false);
    quizTimeoutFiredRef.current = false;
  }, [room?.quizQuestionId, room?.quizRound]);

  useEffect(() => {
    reactionSubmitLockedRef.current = false;
    setReactionErr(null);
    setReactionSending(false);
  }, [room?.reactionRound, room?.reactionGoLiveAt, room?.reactionAnsweredUids]);

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
      const alreadyPicked = !!(uid && room?.pptPickedUids?.includes(uid));
      if (!uid || pptSending || pptSubmitLockedRef.current || alreadyPicked) return;
      pptSubmitLockedRef.current = true;
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
        const msg = formatFirebaseError(e);
        setHighlightHand(null);
        if (
          timeoutFiredRef.current ||
          msg.includes("Tempo da rodada esgotado") ||
          msg.includes("Partida já finalizada") ||
          msg.includes("Você já jogou") ||
          msg.includes("Você já escolheu nesta rodada")
        ) {
          setPptErr(null);
        } else {
          pptSubmitLockedRef.current = false;
          setPptErr(msg);
        }
      } finally {
        setPptSending(false);
      }
    },
    [uid, roomId, pptSending, room?.pptPickedUids],
  );

  const submitQuiz = useCallback(
    async (answerIndex: number) => {
      if (!uid || quizSending) return;
      setQuizSelected(answerIndex);
      setQuizErr(null);
      setQuizSending(true);
      try {
        await callFunction<{ roomId: string; answerIndex: number; responseTimeMs: number }, SubmitQuizResult>(
          "submitQuizAnswer",
          {
            roomId,
            answerIndex,
            responseTimeMs: Math.max(0, Date.now() - quizStartedAtRef.current),
          },
        );
      } catch (e: unknown) {
        const msg = formatFirebaseError(e);
        setQuizSelected(null);
        if (
          quizTimeoutFiredRef.current ||
          msg.includes("Tempo da rodada esgotado") ||
          msg.includes("Partida já finalizada") ||
          msg.includes("Você já respondeu")
        ) {
          setQuizErr(null);
        } else {
          setQuizErr(msg);
        }
      } finally {
        setQuizSending(false);
      }
    },
    [uid, roomId, quizSending],
  );

  const submitQuizRef = useRef(submitQuiz);
  submitQuizRef.current = submitQuiz;

  const submitReaction = useCallback(
    async (input: { falseStart: boolean; reactionMs: number }) => {
      if (!uid || reactionSending || reactionSubmitLockedRef.current) return;
      reactionSubmitLockedRef.current = true;
      setReactionErr(null);
      setReactionSending(true);
      try {
        await callFunction<
          { roomId: string; falseStart: boolean; reactionMs: number },
          SubmitReactionResult
        >("submitReactionTap", {
          roomId,
          falseStart: input.falseStart,
          reactionMs: input.reactionMs,
        });
      } catch (e: unknown) {
        const msg = formatFirebaseError(e);
        if (msg.includes("Tempo da rodada esgotado")) {
          setReactionErr(null);
        } else {
          reactionSubmitLockedRef.current = false;
          setReactionErr(msg);
        }
      } finally {
        setReactionSending(false);
      }
    },
    [uid, roomId, reactionSending],
  );

  const matchDone =
    room?.phase === "completed" ||
    room?.status === "completed" ||
    room?.pptRewardsApplied === true ||
    room?.quizRewardsApplied === true ||
    room?.reactionRewardsApplied === true;

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
  }, [room]);

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
  const isQuiz = room?.gameId === "quiz";
  const isReaction = room?.gameId === "reaction_tap";

  useEffect(() => {
    if (!isQuiz || !matchDone) {
      if (!matchDone) prevQuizMatchDoneRef.current = false;
      return;
    }
    if (!prevQuizMatchDoneRef.current) {
      queueMicrotask(() => {
        quizMatchFinalScrollRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    prevQuizMatchDoneRef.current = true;
  }, [isQuiz, matchDone]);
  const picked = room ? new Set(room.pptPickedUids ?? []) : new Set<string>();
  const myPickDone = !!(uid && picked.has(uid));
  const showPptPlay = !!(isPpt && !matchDone && uid);
  const quizAnswered = room ? new Set(room.quizAnsweredUids ?? []) : new Set<string>();
  const myQuizAnswered = !!(uid && quizAnswered.has(uid));
  const oppQuizAnswered = !!(uid && quizAnswered.size === 1 && !quizAnswered.has(uid));
  const showQuizPlay = !!(isQuiz && !matchDone && uid);
  const reactionAnswered = room ? new Set(room.reactionAnsweredUids ?? []) : new Set<string>();
  const myReactionAnswered = !!(uid && reactionAnswered.has(uid));
  const oppReactionAnswered = !!(uid && reactionAnswered.size === 1 && !reactionAnswered.has(uid));
  const showReactionPlay = !!(isReaction && !matchDone && uid);
  const quizOptionCount = room?.quizOptions?.length ?? 0;
  const reactionGoLiveAtMs =
    room?.reactionGoLiveAt && typeof room.reactionGoLiveAt.toMillis === "function"
      ? room.reactionGoLiveAt.toMillis()
      : null;
  const actionDeadlineAtMs =
    room?.actionDeadlineAt && typeof room.actionDeadlineAt.toMillis === "function"
      ? room.actionDeadlineAt.toMillis()
      : null;

  /** Resultado da rodada já veio do servidor; não usar o prazo da *próxima* pergunta como contagem regressiva aqui. */
  const quizInterstitialForTimer =
    !!room && room.gameId === "quiz" && !matchDone && quizInterstitialRevealActive(room);

  useEffect(() => {
    if (!showPptPlay || matchDone || actionDeadlineAtMs == null) return;
    pptSubmitLockedRef.current = false;
    setHighlightHand(null);
    timeoutFiredRef.current = false;
    setTimeoutPick(false);
  }, [showPptPlay, matchDone, actionDeadlineAtMs]);

  /** Só zera a carta “travada” ao fechar a rodada (Firestore limpa `pptPickedUids`), não ao enviar a jogada. */
  useEffect(() => {
    if (prevMyPickDoneRef.current && !myPickDone) {
      setHighlightHand(null);
      pptSubmitLockedRef.current = false;
    }
    prevMyPickDoneRef.current = myPickDone;
  }, [myPickDone]);

  useEffect(() => {
    timeoutFiredRef.current = false;
    setTimeoutPick(false);
    if (!showPptPlay || !uid || myPickDone || matchDone || actionDeadlineAtMs == null) {
      setSecondsLeft(pvpChoiceSec.ppt);
      return;
    }

    const syncTimer = () => {
      const remainingMs = Math.max(0, actionDeadlineAtMs - Date.now());
      const left = Math.max(0, Math.ceil(remainingMs / 1000));
      setSecondsLeft(left);
      if (remainingMs <= 0 && !timeoutFiredRef.current) {
        timeoutFiredRef.current = true;
        setTimeoutPick(true);
      }
    };

    syncTimer();
    const tick = window.setInterval(() => {
      syncTimer();
      if (timeoutFiredRef.current) {
        window.clearInterval(tick);
      }
    }, 200);

    return () => window.clearInterval(tick);
  }, [roundKey, showPptPlay, uid, myPickDone, matchDone, actionDeadlineAtMs, pvpChoiceSec.ppt]);

  useEffect(() => {
    quizTimeoutFiredRef.current = false;
    setQuizTimeoutAnswer(false);
    if (!showQuizPlay || !uid || myQuizAnswered || matchDone) {
      setQuizSecondsLeft(pvpChoiceSec.quiz);
      return;
    }
    if (quizInterstitialForTimer) {
      setQuizSecondsLeft(pvpChoiceSec.quiz);
      return;
    }
    if (actionDeadlineAtMs == null) {
      setQuizSecondsLeft(pvpChoiceSec.quiz);
      return;
    }

    const syncQuizTimer = () => {
      const remainingMs = Math.max(0, actionDeadlineAtMs - Date.now());
      const left = Math.max(0, Math.ceil(remainingMs / 1000));
      setQuizSecondsLeft(left);
      if (remainingMs <= 0 && !quizTimeoutFiredRef.current) {
        quizTimeoutFiredRef.current = true;
        setQuizTimeoutAnswer(true);
        if (quizOptionCount > 0) {
          const answerIndex = Math.floor(Math.random() * quizOptionCount);
          void submitQuizRef.current(answerIndex);
        }
      }
    };

    syncQuizTimer();
    const tick = window.setInterval(() => {
      syncQuizTimer();
      if (quizTimeoutFiredRef.current) {
        window.clearInterval(tick);
      }
    }, 200);

    return () => window.clearInterval(tick);
  }, [
    showQuizPlay,
    uid,
    myQuizAnswered,
    matchDone,
    quizInterstitialForTimer,
    actionDeadlineAtMs,
    quizOptionCount,
    pvpChoiceSec.quiz,
  ]);

  useEffect(() => {
    reactionStartPerfRef.current = null;
    setReactionClock(Date.now());
    if (!showReactionPlay || !reactionGoLiveAtMs) return;

    const syncReactionStart = () => {
      const delta = Date.now() - reactionGoLiveAtMs;
      if (delta >= 0 && reactionStartPerfRef.current === null) {
        reactionStartPerfRef.current = performance.now() - delta;
      }
    };

    syncReactionStart();
    const tick = window.setInterval(() => {
      setReactionClock(Date.now());
      syncReactionStart();
    }, 50);

    return () => window.clearInterval(tick);
  }, [showReactionPlay, reactionGoLiveAtMs, myReactionAnswered]);

  useEffect(() => {
    if (!uid || denied || !room || matchDone) return;
    if (actionDeadlineAtMs == null) return;

    const resolveKey = `${room.gameId}:${room.phase}:${actionDeadlineAtMs}`;
    const runResolve = () => {
      if (matchDoneRef.current) return;
      if (timeoutResolveKeyRef.current === resolveKey) return;
      timeoutResolveKeyRef.current = resolveKey;
      void callFunction<{ roomId: string }, { ok?: boolean; kind?: string }>("resolvePvpRoomTimeout", {
        roomId,
      }).catch(() => {
        timeoutResolveKeyRef.current = "";
      });
    };

    const waitMs = actionDeadlineAtMs - Date.now();
    if (waitMs <= 0) {
      runResolve();
      return;
    }

    const id = window.setTimeout(runResolve, waitMs + 150);
    return () => window.clearTimeout(id);
  }, [uid, denied, room, roomId, matchDone, actionDeadlineAtMs]);

  /** Presença + W.O. — deps estáveis (evita cleanup a cada snapshot do Firestore). */
  const inLivePptMatch =
    !!uid &&
    !denied &&
    room !== undefined &&
    room !== null &&
    room.gameId === "ppt" &&
    !matchDone;

  const inLiveQuizMatch =
    !!uid &&
    !denied &&
    room !== undefined &&
    room !== null &&
    room.gameId === "quiz" &&
    !matchDone;

  const inLiveReactionMatch =
    !!uid &&
    !denied &&
    room !== undefined &&
    room !== null &&
    room.gameId === "reaction_tap" &&
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

  useEffect(() => {
    if (!inLiveQuizMatch) {
      return;
    }

    const onPageHide = () => {
      if (matchDoneRef.current) return;
      void callFunction<{ roomId: string }, { ok?: boolean }>("forfeitPvpRoom", { roomId }).catch(
        () => undefined,
      );
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      queueMicrotask(() => {
        if (matchDoneRef.current) return;
        void callFunction<{ roomId: string }, { ok?: boolean }>("forfeitPvpRoom", { roomId }).catch(
          () => undefined,
        );
      });
    };
  }, [inLiveQuizMatch, roomId]);

  useEffect(() => {
    if (!inLiveReactionMatch) {
      return;
    }

    const onPageHide = () => {
      if (matchDoneRef.current) return;
      void callFunction<{ roomId: string }, { ok?: boolean }>("forfeitPvpRoom", { roomId }).catch(
        () => undefined,
      );
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      queueMicrotask(() => {
        if (matchDoneRef.current) return;
        void callFunction<{ roomId: string }, { ok?: boolean }>("forfeitPvpRoom", { roomId }).catch(
          () => undefined,
        );
      });
    };
  }, [inLiveReactionMatch, roomId]);

  const quizRevealGateKey =
    room != null &&
    room.gameId === "quiz" &&
    !matchDone &&
    quizInterstitialRevealActive(room)
      ? `${room.quizRound ?? 0}:${String(room.quizQuestionId ?? "")}`
      : null;

  useEffect(() => {
    if (quizRevealGateKey == null) {
      setQuizRevealDismissedKey(null);
      return;
    }
    setQuizRevealDismissedKey((prev) => (prev === quizRevealGateKey ? prev : null));
    const id = window.setTimeout(() => {
      setQuizRevealDismissedKey(quizRevealGateKey);
    }, QUIZ_REVEAL_AUTO_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [quizRevealGateKey]);

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
      const msg = formatFirebaseError(e);
      if (room?.gameId === "quiz") setQuizErr(msg);
      else if (room?.gameId === "reaction_tap") setReactionErr(msg);
      else setPptErr(msg);
      setForfeitBusy(false);
    }
  }, [uid, forfeitBusy, roomId, router, room?.gameId]);

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
        <Link
          href={routeJogosFilaBuscar(
            room?.gameId && isAutoQueueGame(room.gameId) ? room.gameId : "ppt",
          )}
          className="mt-4 block"
        >
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
  const quizTarget = Math.max(5, Number(room.quizTargetScore ?? 5) || 5);
  const quizHostPts = room.quizHostScore ?? 0;
  const quizGuestPts = room.quizGuestScore ?? 0;
  const myQuizPts = isHost ? quizHostPts : quizGuestPts;
  const oppQuizPts = isHost ? quizGuestPts : quizHostPts;
  const reactionTarget = room.reactionTargetScore ?? 5;
  const reactionHostPts = room.reactionHostScore ?? 0;
  const reactionGuestPts = room.reactionGuestScore ?? 0;
  const myReactionPts = isHost ? reactionHostPts : reactionGuestPts;
  const oppReactionPts = isHost ? reactionGuestPts : reactionHostPts;

  const roundHint = !matchDone ? lastRoundSummary(isHost, room.pptLastRoundOutcome) : null;
  const quizRoundHint = !matchDone && isQuiz ? quizRoundSummary(room) : null;
  const reactionHint = !matchDone && isReaction ? reactionRoundSummary(room, isHost) : null;
  const reactionHeadline = !matchDone && isReaction ? reactionRoundHeadline(room, isHost) : null;
  const oppLockedIn = !!(uid && picked.size === 1 && !picked.has(uid));
  const myLockedHand: PptHand | null =
    myPickDone && highlightHand && (PPT_HANDS as readonly string[]).includes(highlightHand)
      ? highlightHand
      : null;
  const quizQuestion = room.quizQuestionText ?? "";
  const quizOptions = room.quizOptions ?? [];
  const quizInterstitialReveal = !matchDone && isQuiz && quizInterstitialRevealActive(room);
  const interstitialRevealCorrectIndex =
    quizInterstitialReveal && typeof room.quizLastRevealCorrectIndex === "number"
      ? room.quizLastRevealCorrectIndex
      : null;
  const quizRevealBlocking =
    !!quizInterstitialReveal &&
    interstitialRevealCorrectIndex != null &&
    (room.quizLastRevealOptions?.length ?? 0) > 0 &&
    quizRevealGateKey != null &&
    quizRevealDismissedKey !== quizRevealGateKey;
  const myLastQuizRoundPick = isHost ? room.quizLastHostAnswerIndex : room.quizLastGuestAnswerIndex;
  const quizYouWrongLastRound =
    !!quizInterstitialReveal &&
    (isHost ? room.quizLastHostCorrect === false : room.quizLastGuestCorrect === false);
  /** Ninguém respondeu a rodada atual ainda — não mostrar “Em espera” para o oponente. */
  const oppQuizStatusLabel = oppQuizAnswered
    ? "Ja respondeu"
    : quizAnswered.size === 0
      ? "Ainda decidindo"
      : "Em espera";
  /** Vencedor explícito ou inferido de `quizOutcome` (legado / campo ausente após void). */
  const quizWinnerResolved: "host" | "guest" | undefined =
    room.quizMatchWinner ??
    (room.quizOutcome === "host_win"
      ? "host"
      : room.quizOutcome === "guest_win"
        ? "guest"
        : undefined);
  const quizYouWonMatch =
    !!quizWinnerResolved &&
    ((quizWinnerResolved === "host" && isHost) || (quizWinnerResolved === "guest" && !isHost));
  const quizEndedNoWinner = !!(isQuiz && matchDone && !quizWinnerResolved);
  const reactionYouWonMatch =
    !!room.reactionMatchWinner &&
    ((room.reactionMatchWinner === "host" && isHost) || (room.reactionMatchWinner === "guest" && !isHost));
  const myReactionMs = isHost ? room.reactionHostMs : room.reactionGuestMs;
  const oppReactionMs = isHost ? room.reactionGuestMs : room.reactionHostMs;
  const myQuizResponseMs = isHost ? room.quizLastHostResponseMs : room.quizLastGuestResponseMs;
  const reactionCountdownMs =
    showReactionPlay && reactionGoLiveAtMs != null ? Math.max(0, reactionGoLiveAtMs - reactionClock) : 0;
  const reactionSignalLive =
    showReactionPlay && reactionGoLiveAtMs != null && reactionClock >= reactionGoLiveAtMs;
  const reactionInputReady = reactionSignalLive && !myReactionAnswered && !reactionSending && !matchDone;
  const reactionRoundTimeLeftMs =
    showReactionPlay && actionDeadlineAtMs != null ? Math.max(0, actionDeadlineAtMs - reactionClock) : 0;
  const reactionRoundExpired =
    showReactionPlay && actionDeadlineAtMs != null && reactionClock >= actionDeadlineAtMs;
  const duelTarget = isQuiz ? quizTarget : isReaction ? reactionTarget : target;
  const duelMyPts = isQuiz ? myQuizPts : isReaction ? myReactionPts : myPts;
  const duelOppPts = isQuiz ? oppQuizPts : isReaction ? oppReactionPts : oppPts;
  const youWonMatch =
    !!room.pptMatchWinner &&
    ((room.pptMatchWinner === "host" && isHost) || (room.pptMatchWinner === "guest" && !isHost));
  const rewardSummary = matchDone
    ? (() => {
        if (isQuiz && quizWinnerResolved) {
          const result = quizYouWonMatch ? "vitoria" : "derrota";
          const eco = resolveMatchEconomy("quiz", result, 0, {
            responseTimeMs: Number(myQuizResponseMs ?? 8000),
          });
          return { ranking: eco.rankingPoints, coins: eco.rewardCoins };
        }
        if (isReaction && room.reactionMatchWinner) {
          const result = reactionYouWonMatch ? "vitoria" : "derrota";
          const eco = resolveMatchEconomy("reaction_tap", result, 0, {
            reactionMs: Number(myReactionMs ?? 9999),
          });
          return { ranking: eco.rankingPoints, coins: eco.rewardCoins };
        }
        if (isPpt && room.pptMatchWinner) {
          const eco = resolveMatchEconomy("ppt", youWonMatch ? "vitoria" : "derrota", 0, {});
          return { ranking: eco.rankingPoints, coins: eco.rewardCoins };
        }
        return null;
      })()
    : null;

  const timerActive = showPptPlay && !myPickDone && !matchDone;
  const timerProgress = timerActive ? secondsLeft / Math.max(pvpChoiceSec.ppt, 1) : 0;
  const timerAccent =
    secondsLeft <= 3 ? "rgb(248 113 113)" : secondsLeft <= 6 ? "rgb(251 191 36)" : "rgb(34 211 238)";
  const battleCopy = isQuiz
    ? matchDone
      ? quizEndedNoWinner
        ? {
            title: "Quiz encerrado",
            subtitle:
              "Partida finalizada sem vencedor (inatividade dupla ou encerramento sem desempate). Veja o placar abaixo.",
          }
        : {
            title: quizYouWonMatch ? "Fim de quiz" : "Quiz encerrado",
            subtitle: quizYouWonMatch
              ? "Você fechou a partida no conhecimento."
              : "A disputa terminou. Da próxima, busque mais precisão.",
          }
      : myQuizAnswered
        ? {
            title: "Resposta travada",
            subtitle: "Sua resposta foi enviada. Aguarde o servidor fechar a rodada.",
          }
        : oppQuizAnswered
          ? {
              title: "Oponente já respondeu",
              subtitle: "Responda antes do cronômetro zerar.",
            }
          : {
              title: "Quiz rápido 1v1",
              subtitle: "Ponto só se você acertar e o adversário errar. Dois acertos ou dois erros = empate.",
            }
    : isReaction
      ? matchDone
        ? {
            title: reactionYouWonMatch ? "Fim do duelo" : "Reaction encerrado",
            subtitle: reactionYouWonMatch
              ? "Seu reflexo decidiu a partida."
              : "O oponente levou a melhor no reflexo.",
          }
        : myReactionAnswered
          ? {
              title: "Seu toque foi enviado",
              subtitle: "Agora o servidor aguarda o tempo do outro jogador para fechar a disputa.",
            }
          : reactionSignalLive
            ? {
                title: "Sinal aberto",
                subtitle: "Toque agora. Quem reagir mais rápido vence.",
              }
            : {
                title: "Reaction tap 1v1",
                subtitle: "Espere o sinal verde. Toques antecipados ficam bloqueados até a rodada liberar.",
              }
    : matchDone
      ? {
          title: youWonMatch ? "Fim de duelo" : "Duelo encerrado",
          subtitle: youWonMatch
            ? "Você fechou a partida. Respire e parta para a próxima."
            : "A rodada acabou. Ajuste a leitura e tente de novo.",
        }
      : myPickDone
        ? {
            title: "Sua jogada está travada",
            subtitle: "Agora é segurar a tensão e esperar a revelação do oponente.",
          }
        : oppLockedIn
          ? {
              title: "O rival já escolheu",
              subtitle: "Falta só a sua mão. Entre com confiança antes do contador zerar.",
            }
          : {
              title: "Pedra, papel e tesoura com emoção",
              subtitle: "Simples de entender, rápido de jogar e com tensão a cada escolha.",
            };

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute -inset-px rounded-[1.75rem] opacity-70 blur-xl"
        style={{
          background:
            "linear-gradient(135deg, rgb(34 211 238 / 0.15), rgb(139 92 246 / 0.2), rgb(217 70 239 / 0.12))",
        }}
      />
      <div className="relative overflow-hidden rounded-[1.6rem] border border-cyan-500/20 bg-gradient-to-b from-slate-950/95 via-violet-950/25 to-slate-950 shadow-[0_0_60px_-14px_rgba(34,211,238,0.22)] sm:rounded-3xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.07),transparent_28%),radial-gradient(circle_at_18%_24%,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_82%_24%,rgba(217,70,239,0.12),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(251,191,36,0.08),transparent_28%)]" />
        <motion.div
          className="pointer-events-none absolute -left-12 top-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl"
          animate={{ x: [0, 24, 0], y: [0, -10, 0], opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute -right-12 top-20 h-40 w-40 rounded-full bg-fuchsia-400/10 blur-3xl"
          animate={{ x: [0, -24, 0], y: [0, 10, 0], opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 7.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.12),transparent_65%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative space-y-3.5 p-3 sm:space-y-5 sm:p-6">
          {/* HUD cabeçalho */}
          <header className="flex flex-col gap-2 border-b border-white/10 pb-3 sm:gap-3 sm:pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-lg font-black tracking-tight text-transparent sm:text-2xl">
                {gameDisplayName(room.gameId)}
              </h1>
              <p className="mt-1 text-[11px] leading-relaxed text-white/50 sm:text-sm">
                {battleCopy.subtitle}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <HudBadge tone="cyan">{statusDisplay(room.status)}</HudBadge>
              <HudBadge tone="amber">{phaseDisplay(room.phase)}</HudBadge>
            </div>
          </header>

          {/* Duelo VS */}
          {!matchDone && !showReactionPlay && !showQuizPlay ? (
          <section className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-gradient-to-r from-cyan-950/45 via-slate-950/85 to-fuchsia-950/45 p-3 shadow-[0_0_46px_-16px_rgba(34,211,238,0.26)] sm:rounded-[1.8rem] sm:p-5">
            <div className="pointer-events-none absolute -left-10 top-0 h-32 w-32 rounded-full bg-cyan-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -right-8 bottom-0 h-32 w-32 rounded-full bg-fuchsia-500/15 blur-3xl" />
            <div className="pointer-events-none absolute inset-x-[20%] top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
            <motion.div
              className="pointer-events-none absolute inset-x-8 bottom-2 h-16 rounded-full bg-gradient-to-r from-cyan-500/10 via-amber-400/12 to-fuchsia-500/10 blur-2xl"
              animate={{ opacity: [0.35, 0.7, 0.35], scaleX: [0.96, 1.04, 0.96] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="mb-1 text-center sm:mb-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-white/35 sm:text-[10px] sm:tracking-[0.35em]">
                {battleCopy.title}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <PlayerPillar
                nome={myDisplayName}
                score={duelMyPts}
                align="left"
                ringClass="border-cyan-400/60 bg-slate-900/90 shadow-[0_0_24px_-4px_rgba(34,211,238,0.45)]"
                progressRatio={duelMyPts / Math.max(1, duelTarget)}
              />
              <div className="relative flex shrink-0 flex-col items-center gap-0.5 px-1 sm:gap-1">
                <div className="pointer-events-none absolute inset-0 rounded-full bg-amber-300/10 blur-xl" />
                <span className="select-none bg-gradient-to-b from-amber-300 via-orange-400 to-red-500 bg-clip-text text-2xl font-black italic tracking-tighter text-transparent drop-shadow-[0_0_20px_rgba(251,191,36,0.4)] sm:text-4xl">
                  VS
                </span>
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/35 sm:text-[9px] sm:tracking-[0.3em]">
                  {isQuiz ? "pergunta ativa" : isReaction ? "sinal armado" : "rodada viva"}
                </span>
                {matchDone && rewardSummary ? (
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.18em] text-cyan-100/80 sm:px-2 sm:text-[8px] sm:tracking-[0.25em]">
                      +{rewardSummary.ranking} ranking
                    </span>
                    <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.18em] text-amber-100/80 sm:px-2 sm:text-[8px] sm:tracking-[0.25em]">
                      +{rewardSummary.coins} PR
                    </span>
                  </div>
                ) : (
                  <div className="mt-0.5 rounded-full border border-amber-300/15 bg-amber-300/8 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.18em] text-amber-100/75 sm:mt-1 sm:px-2 sm:text-[8px] sm:tracking-[0.25em]">
                    primeiro a {duelTarget}
                  </div>
                )}
              </div>
              <PlayerPillar
                nome={opponentNome}
                score={duelOppPts}
                align="right"
                ringClass="border-fuchsia-400/55 bg-slate-900/90 shadow-[0_0_24px_-4px_rgba(217,70,239,0.4)]"
                progressRatio={duelOppPts / Math.max(1, duelTarget)}
              />
            </div>
            <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-white/8 bg-black/20 p-2 sm:hidden">
              {rewardSummary ? (
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-cyan-100/80">
                    +{rewardSummary.ranking} ranking
                  </span>
                  <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-amber-100/80">
                    +{rewardSummary.coins} PR
                  </span>
                </div>
              ) : (
                <div className="text-center text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">
                  Meta {duelTarget}
                </div>
              )}
              <button
                type="button"
                className="rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-red-100"
                disabled={forfeitBusy}
                onClick={() => void confirmForfeit()}
              >
                {forfeitBusy ? "..." : "Desistir"}
              </button>
            </div>
            <div className="mt-3 hidden flex-wrap items-center justify-center gap-2 sm:flex">
              {isQuiz ? (
                <>
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/85">
                    Acerto vale 1 ponto
                  </span>
                  <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-100/85">
                    Tempo desempata
                  </span>
                  <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100/85">
                    Resposta automatica ao zerar
                  </span>
                </>
              ) : isReaction ? (
                <>
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/85">
                    Espere o sinal
                  </span>
                  <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-100/85">
                    Menor ms vence
                  </span>
                  <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100/85">
                    Falso start pune
                  </span>
                </>
              ) : (
                <>
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/85">
                    Pedra esmaga tesoura
                  </span>
                  <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-100/85">
                    Papel cobre pedra
                  </span>
                  <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100/85">
                    Tesoura corta papel
                  </span>
                </>
              )}
            </div>
          </section>
          ) : null}

          {isPpt && matchDone && room.pptVoidBothInactive ? (
            <ResultSummaryPanel
              gameLabel="Pedra, papel e tesoura"
              title="Partida anulada"
              victory={false}
              myName={myDisplayName}
              opponentName={opponentNome}
              myScore={myPts}
              oppScore={oppPts}
              primaryLine="Sem pontos: ambos ficaram inativos."
              secondaryLine={null}
              tertiaryLine={null}
            />
          ) : null}

          {isPpt && matchDone && room.pptMatchWinner ? (
            <ResultSummaryPanel
              gameLabel="Pedra, papel e tesoura"
              title={matchVictoryLine(room, isHost)}
              victory={youWonMatch}
              myName={myDisplayName}
              opponentName={opponentNome}
              myScore={myPts}
              oppScore={oppPts}
              primaryLine={youWonMatch ? "Você fechou a série antes do rival." : "O adversário levou a melhor nesta série."}
              secondaryLine={null}
              tertiaryLine={null}
              rankingPoints={rewardSummary?.ranking}
              rewardCoins={rewardSummary?.coins}
            />
          ) : null}

          {isPpt && matchDone && !room.pptMatchWinner && room.pptOutcome ? (
            <ResultSummaryPanel
              gameLabel="Pedra, papel e tesoura"
              title={legacyOutcomeLine(room.pptOutcome, isHost)}
              victory={youWonMatch}
              myName={myDisplayName}
              opponentName={opponentNome}
              myScore={myPts}
              oppScore={oppPts}
              primaryLine={youWonMatch ? "Você venceu no confronto final." : "O oponente confirmou a vantagem no confronto final."}
              secondaryLine={null}
              tertiaryLine={null}
            />
          ) : null}

          {isQuiz && matchDone ? (
            <div ref={quizMatchFinalScrollRef} className="scroll-mt-8 space-y-3">
              {quizWinnerResolved ? (
                <ResultSummaryPanel
                  gameLabel="Quiz rápido"
                  title={quizYouWonMatch ? "Você venceu o quiz!" : "O oponente venceu o quiz."}
                  victory={quizYouWonMatch}
                  myName={myDisplayName}
                  opponentName={opponentNome}
                  myScore={myQuizPts}
                  oppScore={oppQuizPts}
                  primaryLine="Conhecimento e timing definiram o placar final."
                  secondaryLine={null}
                  tertiaryLine={null}
                  rankingPoints={rewardSummary?.ranking}
                  rewardCoins={rewardSummary?.coins}
                />
              ) : null}
              {quizEndedNoWinner ? (
                <ResultSummaryPanel
                  gameLabel="Quiz rápido"
                  title="Sem vencedor"
                  victory={false}
                  myName={myDisplayName}
                  opponentName={opponentNome}
                  myScore={myQuizPts}
                  oppScore={oppQuizPts}
                  primaryLine={
                    room.quizOutcome === "draw"
                      ? "Partida anulada ou encerrada em empate — sem premiação de vitória."
                      : "Partida encerrada. O placar final está registrado acima."
                  }
                  secondaryLine={null}
                  tertiaryLine={null}
                />
              ) : null}
            </div>
          ) : null}

          {isReaction && matchDone && room.reactionMatchWinner ? (
            <ResultSummaryPanel
              gameLabel="Reaction tap"
              title={reactionYouWonMatch ? "Você venceu no Reaction Tap!" : "O oponente venceu no Reaction Tap."}
              victory={reactionYouWonMatch}
              myName={myDisplayName}
              opponentName={opponentNome}
              myScore={myReactionPts}
              oppScore={oppReactionPts}
              primaryLine="O reflexo definiu a vitória no tempo certo."
              secondaryLine={null}
              tertiaryLine={null}
              rankingPoints={rewardSummary?.ranking}
              rewardCoins={rewardSummary?.coins}
            />
          ) : null}

          {showPptPlay ? (
            <section
              className="relative space-y-3 overflow-hidden rounded-[1.35rem] border border-violet-400/25 bg-gradient-to-b from-violet-950/55 via-slate-950/95 to-cyan-950/25 p-3 shadow-[0_0_48px_-14px_rgba(139,92,246,0.3)] sm:space-y-5 sm:rounded-[1.9rem] sm:p-6"
              aria-label="Pedra, papel e tesoura"
              title="Toque numa carta antes do tempo acabar. Se o tempo expirar, o servidor encerra a rodada."
            >
              <div className="pointer-events-none absolute -top-10 left-1/4 h-32 w-32 rounded-full bg-violet-500/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-8 right-0 h-32 w-32 rounded-full bg-cyan-500/12 blur-3xl" />
              <div className="pointer-events-none absolute inset-x-8 bottom-0 h-16 bg-gradient-to-r from-cyan-500/8 via-violet-500/12 to-fuchsia-500/8 blur-2xl" />
              {roundHint ? <span className="sr-only">{roundHint}</span> : null}

              <div className="relative flex items-start justify-between gap-2 sm:gap-3">
                <div>
                  <p className="pt-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-violet-300/75 sm:pt-1 sm:text-[10px] sm:tracking-[0.35em]">
                    {myPickDone ? "Aguardando resposta" : "Escolha sua arma"}
                  </p>
                  <p className="mt-1 hidden max-w-[11rem] text-xs text-white/55 sm:block sm:mt-2 sm:max-w-sm sm:text-sm">
                    Toque no gesto que mais combina com a sua leitura da rodada e sinta a tensão do
                    reveal.
                  </p>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.18em] text-white/60 sm:mt-3 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-[0.28em]">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_10px_rgba(196,181,253,0.75)]" />
                    {myPickDone ? "jogada travada" : "escolha tatica"}
                  </div>
                </div>
                {timerActive ? (
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "relative flex h-[4rem] w-[4rem] shrink-0 items-center justify-center rounded-full border-[3px] bg-slate-950/95 sm:h-[5.5rem] sm:w-[5.5rem]",
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
                      <div className="absolute inset-1.5 flex flex-col items-center justify-center rounded-full bg-slate-950/95 ring-1 ring-white/10 sm:inset-2.5">
                        <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">
                          Tempo
                        </span>
                        <span
                          className={cn(
                            "font-mono text-xl font-black tabular-nums sm:text-3xl",
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
                    className="flex items-center gap-1.5 rounded-full border border-cyan-500/25 bg-cyan-950/20 px-2.5 py-1 sm:gap-2 sm:px-3 sm:py-1.5"
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
                  Tempo esgotado
                </p>
              ) : null}
              {pptErr ? (
                <AlertBanner tone="error" className="text-sm">
                  {pptErr}
                </AlertBanner>
              ) : null}

              {myPickDone ? (
                <div
                  className="relative flex items-stretch justify-center gap-2 pt-0.5 sm:gap-4 sm:pt-1"
                  style={{ perspective: 1000 }}
                >
                  <PptPlayCardFrame tone="you" label="Você">
                    <motion.div
                      className="flex flex-col items-center gap-1 py-0.5 sm:gap-2 sm:py-1"
                      initial={{ rotateY: -25, opacity: 0.5 }}
                      animate={{ rotateY: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 280, damping: 22 }}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      {myLockedHand ? (
                        <>
                          <HandIcon
                            hand={myLockedHand}
                            className="h-10 w-10 text-cyan-200 sm:h-16 sm:w-16"
                          />
                          <span className="text-[9px] font-bold uppercase tracking-wide text-white/50 sm:text-[10px]">
                            {handLabel(myLockedHand)}
                          </span>
                        </>
                      ) : (
                        <div className="flex min-h-[3.5rem] flex-col items-center justify-center gap-1 text-white/35 sm:min-h-[5.5rem] sm:gap-2">
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

                  <div className="flex w-6 shrink-0 flex-col items-center justify-center self-center sm:w-12">
                    <span className="select-none bg-gradient-to-b from-amber-300 to-orange-500 bg-clip-text text-lg font-black italic text-transparent drop-shadow-[0_0_12px_rgba(251,191,36,0.35)] sm:text-xl">
                      VS
                    </span>
                  </div>

                  <PptPlayCardFrame tone="opp" label="Oponente">
                    <motion.div
                      className="py-0.5 sm:py-1"
                      initial={{ rotateY: 25, opacity: 0.35 }}
                      animate={{ rotateY: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.08 }}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <CardBackFace className="mx-auto max-w-[4.8rem] sm:max-w-[7.5rem]" />
                      <p className="sr-only">Carta do oponente oculta até ambos jogarem</p>
                    </motion.div>
                  </PptPlayCardFrame>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  {PPT_HANDS.map((h) => {
                    const theme = handTheme(h);
                    const selected = highlightHand === h && (pptSending || myPickDone);
                    return (
                      <button
                        key={h}
                        type="button"
                        disabled={pptSending}
                        onClick={() => void submitPpt(h)}
                        className={cn(
                          "group relative flex min-h-[8.6rem] flex-col items-center justify-between gap-1.5 overflow-hidden rounded-[1.1rem] border-2 p-2.5 transition-all duration-200 sm:min-h-[13rem] sm:gap-3 sm:rounded-[1.45rem] sm:p-4",
                          "bg-gradient-to-b from-white/[0.08] to-slate-950/90",
                          "hover:-translate-y-1 hover:shadow-[0_12px_40px_-12px_rgba(34,211,238,0.35)]",
                          "active:scale-[0.97] active:brightness-95",
                          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400",
                          "disabled:pointer-events-none disabled:opacity-40",
                          selected &&
                            "border-cyan-400/80 shadow-[0_0_28px_-4px_rgba(34,211,238,0.55)] ring-2 ring-cyan-400/40",
                          !selected && cn("border-white/15", theme.ring),
                        )}
                      >
                        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-75", theme.glow)} />
                        <div
                          className={cn(
                            "relative rounded-lg bg-gradient-to-br from-white/10 to-transparent p-2 ring-1 transition-all duration-200 sm:rounded-xl sm:p-3",
                            "ring-white/10 group-hover:ring-white/25",
                            selected && "from-cyan-500/20 ring-cyan-400/50",
                          )}
                        >
                          <HandIcon
                            hand={h}
                            className={cn(
                              "h-9 w-9 transition-transform duration-200 group-hover:scale-110 sm:h-16 sm:w-16",
                              selected ? "text-cyan-200" : cn(theme.icon, "group-hover:text-white"),
                            )}
                          />
                        </div>
                        <div className="relative text-center">
                          <span
                            className={cn(
                              "hidden rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.28em] sm:inline-flex",
                              theme.chip,
                            )}
                          >
                            {theme.hint}
                          </span>
                          <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-white/90 sm:mt-2 sm:text-xs">
                            {handLabel(h)}
                          </p>
                          <p className="mt-0.5 hidden text-[9px] text-white/45 sm:block">
                            {handAdvantageLine(h)}
                          </p>
                        </div>
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

          {showQuizPlay ? (
            <section
              className="relative space-y-3 overflow-hidden rounded-[1.35rem] border border-fuchsia-400/25 bg-gradient-to-b from-violet-950/55 via-slate-950/95 to-cyan-950/25 p-3 shadow-[0_0_48px_-14px_rgba(217,70,239,0.28)] sm:space-y-5 sm:rounded-[1.9rem] sm:p-6"
              aria-label="Quiz rápido"
              data-quiz-sala-ui="pvp-rules-2026-04"
            >
              <div className="pointer-events-none absolute -top-10 left-1/4 h-32 w-32 rounded-full bg-fuchsia-500/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-8 right-0 h-32 w-32 rounded-full bg-cyan-500/12 blur-3xl" />
              <div className="pointer-events-none absolute inset-x-8 bottom-0 h-16 bg-gradient-to-r from-cyan-500/8 via-fuchsia-500/12 to-violet-500/8 blur-2xl" />

              <div className="relative flex items-start justify-between gap-2 sm:gap-3">
                <div>
                  <p className="pt-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-fuchsia-300/75 sm:pt-1 sm:text-[10px] sm:tracking-[0.35em]">
                    {quizRevealBlocking
                      ? "Resultado da rodada"
                      : myQuizAnswered
                        ? "Resposta travada"
                        : "Pergunta da rodada"}
                  </p>
                  <p className="mt-1 hidden max-w-[11rem] text-xs text-white/55 sm:block sm:mt-2 sm:max-w-sm sm:text-sm">
                    Ponto só se um acertar e o outro errar. Se os dois acertarem ou os dois errarem, a rodada
                    empata.
                  </p>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.18em] text-white/60 sm:mt-3 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-[0.28em]">
                    <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300 shadow-[0_0_10px_rgba(244,114,182,0.75)]" />
                    {quizRevealBlocking
                      ? "próxima automática"
                      : myQuizAnswered
                        ? "aguardando fechamento"
                        : "escolha rapida"}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      "relative flex h-[4rem] w-[4rem] shrink-0 items-center justify-center rounded-full border-[3px] bg-slate-950/95 sm:h-[5.5rem] sm:w-[5.5rem]",
                      quizInterstitialReveal
                        ? "border-emerald-400/55"
                        : myQuizAnswered
                          ? "border-cyan-400/55"
                          : quizSecondsLeft <= 3
                            ? "animate-arena-timer-urgent border-red-400/70"
                            : quizSecondsLeft <= 6
                              ? "border-amber-400/65"
                              : "border-cyan-400/55",
                    )}
                    style={{
                      background: quizInterstitialReveal
                        ? "conic-gradient(rgb(52 211 153 / 0.55) 360deg, rgb(15 23 42 / 0.92) 0deg)"
                        : `conic-gradient(${
                            myQuizAnswered
                              ? "rgb(34 211 238)"
                              : quizSecondsLeft <= 3
                                ? "rgb(248 113 113)"
                                : quizSecondsLeft <= 6
                                  ? "rgb(251 191 36)"
                                  : "rgb(34 211 238)"
                          } ${
                            ((myQuizAnswered ? pvpChoiceSec.quiz : quizSecondsLeft) /
                              Math.max(pvpChoiceSec.quiz, 1)) *
                            360
                          }deg, rgb(15 23 42 / 0.92) 0deg)`,
                    }}
                  >
                    <div className="absolute inset-1.5 flex flex-col items-center justify-center rounded-full bg-slate-950/95 ring-1 ring-white/10 sm:inset-2.5">
                      <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">
                        {quizInterstitialReveal ? "Rodada" : "Tempo"}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-xl font-black tabular-nums sm:text-3xl",
                          quizInterstitialReveal ? "text-emerald-200" : "text-cyan-200",
                        )}
                      >
                        {quizInterstitialReveal ? "OK" : myQuizAnswered ? "OK" : quizSecondsLeft}
                      </span>
                      <span className="text-[9px] text-white/25">
                        {quizInterstitialReveal ? "resolv." : myQuizAnswered ? "env." : "s"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <FaceoffBoard
                myName={myDisplayName}
                oppName={opponentNome}
                myScore={myQuizPts}
                oppScore={oppQuizPts}
                target={quizTarget}
                myDetail={myQuizAnswered ? "Resposta enviada" : "Ainda decidindo"}
                oppDetail={oppQuizStatusLabel}
                centerCaption={quizRevealBlocking ? "rodada resolvida" : "quiz ao vivo"}
                actionLabel="Desistir"
                actionBusy={forfeitBusy}
                onAction={() => void confirmForfeit()}
              />

              <div className="space-y-4 border-t border-white/10 pt-3 sm:space-y-4 sm:pt-4">
                {quizRevealBlocking ? (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/90">
                        Rodada anterior
                      </p>
                      <p className="text-xs text-white/70 sm:text-sm">
                        {room.quizLastRevealQuestionText?.trim() || "—"}
                      </p>
                      {quizRevealSameCardRows(
                        room.quizLastRevealOptions!,
                        interstitialRevealCorrectIndex!,
                        typeof myLastQuizRoundPick === "number" ? myLastQuizRoundPick : null,
                        quizYouWrongLastRound,
                        `interstitial-${room.quizRound ?? 0}-${room.quizQuestionId ?? "q"}`,
                      )}
                    </div>
                    {quizRoundHint ? (
                      <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-2 text-sm text-fuchsia-100/90">
                        {quizRoundHint}
                      </div>
                    ) : null}
                    <p className="text-center text-[10px] text-white/45">
                      A próxima pergunta abre sozinha em poucos segundos. O tempo da rodada só conta depois disso.
                    </p>
                    <button
                      type="button"
                      className="mx-auto block text-center text-[10px] font-semibold uppercase tracking-widest text-fuchsia-300/80 underline decoration-fuchsia-400/40 underline-offset-2 hover:text-fuchsia-200"
                      onClick={() => {
                        if (quizRevealGateKey) setQuizRevealDismissedKey(quizRevealGateKey);
                      }}
                    >
                      Avançar agora
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-bold leading-snug text-white sm:text-base">
                      {quizQuestion || "Aguarde a próxima pergunta..."}
                    </p>

                    {quizErr && !quizTimeoutAnswer ? (
                      <AlertBanner tone="error" className="mt-3 text-sm">
                        {quizErr}
                      </AlertBanner>
                    ) : null}
                    {quizTimeoutAnswer ? (
                      <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-widest text-amber-300/90">
                        Tempo zerado: resposta automatica enviada
                      </p>
                    ) : null}

                    <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3">
                      {quizOptions.map((option, index) => {
                        const selected = quizSelected === index;
                        return (
                          <button
                            key={`${room.quizQuestionId}-${index}`}
                            type="button"
                            disabled={quizSending || myQuizAnswered || matchDone}
                            onClick={() => void submitQuiz(index)}
                            className={cn(
                              "group relative overflow-hidden rounded-[1.1rem] border-2 px-4 py-3 text-left text-sm font-semibold transition-all duration-200 sm:rounded-[1.35rem] sm:px-5 sm:py-4",
                              "bg-gradient-to-b from-white/[0.08] to-slate-950/90 text-white",
                              "hover:-translate-y-0.5 hover:border-fuchsia-300/45 hover:shadow-[0_12px_30px_-16px_rgba(217,70,239,0.45)]",
                              "disabled:pointer-events-none disabled:opacity-55",
                              selected ? "border-fuchsia-300/60 bg-fuchsia-500/12" : "border-white/10",
                            )}
                          >
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-fuchsia-500/6 via-transparent to-cyan-500/6 opacity-80" />
                            <span className="relative mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[11px] font-black">
                              {String.fromCharCode(65 + index)}
                            </span>
                            <span className="relative">{option}</span>
                          </button>
                        );
                      })}
                    </div>

                    {myQuizAnswered ? (
                      <p className="mt-3 border-t border-white/10 pt-3 text-center text-xs text-white/55 sm:mt-4 sm:pt-4">
                        Resposta travada. Aguarde o servidor resolver a rodada e liberar a próxima pergunta.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </section>
          ) : null}

          {showReactionPlay ? (
            <section className="relative space-y-4 overflow-hidden rounded-[1.35rem] border border-emerald-400/25 bg-gradient-to-b from-emerald-950/40 via-slate-950/95 to-cyan-950/25 p-3 shadow-[0_0_48px_-14px_rgba(16,185,129,0.28)] sm:space-y-5 sm:rounded-[1.9rem] sm:p-6">
              <div className="pointer-events-none absolute -top-10 left-1/4 h-32 w-32 rounded-full bg-emerald-500/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-8 right-0 h-32 w-32 rounded-full bg-cyan-500/12 blur-3xl" />
              <div className="pointer-events-none absolute inset-x-8 bottom-0 h-16 bg-gradient-to-r from-cyan-500/8 via-emerald-500/12 to-teal-500/8 blur-2xl" />

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-emerald-200/80 sm:text-[10px]">
                    Reaction tap
                  </p>
                  <p className="mt-1 text-sm font-bold text-white sm:text-base">
                    {reactionSignalLive ? "TOQUE AGORA!" : "Espere o painel ficar verde antes de tocar."}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/45">Estado</p>
                  <p className="mt-1 text-lg font-black text-white">
                    {reactionSignalLive ? "Valendo" : "Aguarde"}
                  </p>
                </div>
              </div>

              <FaceoffBoard
                myName={myDisplayName}
                oppName={opponentNome}
                myScore={myReactionPts}
                oppScore={oppReactionPts}
                target={reactionTarget}
                myDetail={myReactionAnswered ? `${myReactionMs ?? "—"} ms` : "Pontos atuais"}
                oppDetail={oppReactionAnswered ? `${oppReactionMs ?? "—"} ms` : "Aguardando toque"}
                centerCaption={reactionSignalLive ? "sinal aberto" : "aguarde o verde"}
                actionLabel="Desistir"
                actionBusy={forfeitBusy}
                onAction={() => void confirmForfeit()}
              />

              {reactionHint ? (
                <div
                  className={cn(
                    "rounded-2xl border px-3 py-3",
                    reactionHeadline?.tone === "emerald" &&
                      "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
                    reactionHeadline?.tone === "rose" &&
                      "border-rose-400/25 bg-rose-500/10 text-rose-100",
                    reactionHeadline?.tone === "amber" &&
                      "border-amber-400/25 bg-amber-500/10 text-amber-100",
                    !reactionHeadline && "border-white/10 bg-black/20 text-white/65",
                  )}
                >
                  {reactionHeadline ? (
                    <p className="text-[11px] font-black uppercase tracking-[0.18em]">
                      {reactionHeadline.title}
                    </p>
                  ) : null}
                  <p className={cn("text-xs", reactionHeadline ? "mt-1 opacity-90" : "")}>{reactionHint}</p>
                </div>
              ) : (
                  <p className="text-xs text-white/45">
                    Aguarde a liberação da rodada. O toque só fica ativo quando o sinal abrir.
                  </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-100/85">
                  Você {myReactionAnswered ? "ja reagiu" : "esta armado"}
                </span>
                {oppReactionAnswered ? (
                  <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-100/85">
                    Oponente reagiu
                  </span>
                ) : null}
                {!reactionSignalLive ? (
                  <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-amber-100/85">
                    Sinal {Math.max(0, Math.ceil(reactionCountdownMs / 1000))}s
                  </span>
                ) : null}
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em]",
                    reactionRoundExpired
                      ? "border-rose-400/30 bg-rose-500/10 text-rose-100/90"
                      : "border-white/10 bg-white/5 text-white/75",
                  )}
                >
                  {reactionRoundExpired
                    ? "Tempo esgotado"
                    : `Tempo ${Math.max(0, Math.ceil(reactionRoundTimeLeftMs / 1000))}s`}
                </span>
              </div>

              {reactionErr ? (
                <AlertBanner tone="error" className="text-sm">
                  {reactionErr}
                </AlertBanner>
              ) : null}

              <button
                type="button"
                disabled={!reactionInputReady || reactionRoundExpired}
                onClick={() => {
                  if (!reactionInputReady) return;
                  const reactionMs = Math.max(
                    1,
                    Math.round(
                      performance.now() -
                        (reactionStartPerfRef.current ?? performance.now()),
                    ),
                  );
                  void submitReaction({ falseStart: false, reactionMs });
                }}
                className={cn(
                  "w-full rounded-[1.35rem] border-2 py-10 text-xl font-black uppercase tracking-[0.22em] transition sm:rounded-[1.7rem] sm:py-14 sm:text-3xl",
                  reactionInputReady
                    ? "border-emerald-300/70 bg-emerald-400 text-slate-950 shadow-[0_0_36px_-8px_rgba(52,211,153,0.55)]"
                    : "border-amber-400/35 bg-amber-500/15 text-amber-100 shadow-[0_0_30px_-10px_rgba(251,191,36,0.22)]",
                  (!reactionInputReady || reactionSending || myReactionAnswered || matchDone) &&
                    "pointer-events-none opacity-55",
                  reactionRoundExpired && "pointer-events-none opacity-55",
                )}
              >
                {myReactionAnswered
                  ? "Resposta enviada"
                  : reactionRoundExpired
                    ? "Tempo esgotado"
                    : reactionSignalLive
                      ? "TOQUE!"
                      : "Aguarde"}
              </button>
            </section>
          ) : null}

          {!isPpt && !isQuiz && !isReaction ? (
            <AlertBanner tone="info" className="text-sm">
              Este jogo ainda não tem modo de sala sincronizado nesta tela — só PPT 1v1 está ligado por
              enquanto.
            </AlertBanner>
          ) : null}

          <footer className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Link href={ROUTES.jogos} className="min-w-0">
              <Button
                variant="secondary"
                size="lg"
                className="w-full border border-white/15 bg-white/[0.06] font-bold shadow-[0_0_24px_-12px_rgba(255,255,255,0.2)]"
              >
                Voltar ao lobby
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
              Nova partida
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
