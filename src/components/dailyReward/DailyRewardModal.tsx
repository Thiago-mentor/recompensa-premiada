"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import {
  Check,
  Coins,
  Crown,
  Gem,
  Gift,
  LockKeyhole,
  Sparkles,
  X,
} from "lucide-react";

export type DailyRewardSlot = {
  dayNum: number;
  coins: number;
  gems: number;
  status: "claimed" | "current" | "upcoming";
  tipoBonus?: "nenhum" | "bau" | "especial";
};

function formatCoins(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, n));
}

const subscribeToClient = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

type DailyRewardLayout = {
  dialogClassName: string;
  edgeMaskClassName: string;
  trackClassName: string;
  slotWidth: string;
  slotClassName: string;
  titleClassName: string;
  artworkClassName: string;
  amountClassName: string;
  amountLabelClassName: string;
  ticketClassName: string;
  bonusClassName: string;
  todayBadgeClassName: string;
};

function getDailyRewardLayout(slotCount: number): DailyRewardLayout {
  if (slotCount >= 15) {
    return {
      dialogClassName: "max-w-[min(100vw-0.75rem,44rem)] sm:max-w-2xl",
      edgeMaskClassName: "w-6",
      trackClassName: "gap-1.5 pb-1.5 pt-3",
      slotWidth: "4.35rem",
      slotClassName: "px-1.5 pb-2.5 pt-1.5 min-h-[11.3rem]",
      titleClassName: "min-h-[1.85rem] text-[9px]",
      artworkClassName: "h-[3.75rem]",
      amountClassName: "text-[10px]",
      amountLabelClassName: "text-[8px]",
      ticketClassName: "text-[8px]",
      bonusClassName: "px-1 py-0.5 text-[6px]",
      todayBadgeClassName: "px-1.5 py-0.5 text-[7px]",
    };
  }

  if (slotCount >= 8) {
    return {
      dialogClassName: "max-w-[min(100vw-0.75rem,38rem)] sm:max-w-xl",
      edgeMaskClassName: "w-7",
      trackClassName: "gap-2 pb-2 pt-3",
      slotWidth: "5rem",
      slotClassName: "px-2 pb-3 pt-2 min-h-[11.8rem]",
      titleClassName: "min-h-[2rem] text-[9px]",
      artworkClassName: "h-[4rem]",
      amountClassName: "text-[11px]",
      amountLabelClassName: "text-[9px]",
      ticketClassName: "text-[8px]",
      bonusClassName: "px-1 py-0.5 text-[7px]",
      todayBadgeClassName: "px-1.5 py-0.5 text-[7px]",
    };
  }

  return {
    dialogClassName: "max-w-md",
    edgeMaskClassName: "w-8",
    trackClassName: "gap-2.5 pb-2 pt-3",
    slotWidth: "5.7rem",
    slotClassName: "px-2 pb-3 pt-2 min-h-[12.2rem]",
    titleClassName: "min-h-[2.1rem] text-[10px]",
    artworkClassName: "h-[4.35rem]",
    amountClassName: "text-[11px]",
    amountLabelClassName: "text-[9px]",
    ticketClassName: "text-[9px]",
    bonusClassName: "px-1 py-0.5 text-[7px]",
    todayBadgeClassName: "px-2 py-0.5 text-[8px]",
  };
}

export function DailyRewardModal({
  open,
  slots,
  claimLoading,
  errorMessage,
  onClaim,
  onClose,
}: {
  open: boolean;
  slots: DailyRewardSlot[];
  claimLoading: boolean;
  errorMessage?: string | null;
  onClaim: () => void;
  onClose: () => void;
}) {
  const currentRef = useRef<HTMLDivElement | null>(null);
  const mounted = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onKey]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      currentRef.current?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }, 180);
    return () => window.clearTimeout(t);
  }, [open, slots]);

  if (!open || !mounted) return null;

  const layout = getDailyRewardLayout(slots.length);

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-reward-title"
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/80 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md sm:items-center sm:p-4 sm:pb-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onClick={onClose}
    >
      <motion.div
        className={cn(
          "pointer-events-auto relative max-h-[calc(100vh-1.5rem)] max-h-[calc(100dvh-1.5rem)] min-h-0 w-full overflow-x-hidden overflow-y-auto overscroll-contain rounded-[1.35rem] border-[3px] border-[#f5d94a] p-4 pb-5 shadow-[0_0_0_1px_rgba(0,0,0,0.2),0_24px_60px_-12px_rgba(0,0,0,0.65),0_0_80px_-20px_rgba(245,217,74,0.35)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:max-h-[calc(100vh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:p-5",
          "bg-gradient-to-b from-[#5c3eb0] via-[#4f3496] to-[#3d2675]",
          layout.dialogClassName,
        )}
        initial={{ opacity: 0, scale: 0.94, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320, mass: 0.85 }}
        style={{ transformPerspective: 1200 }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 0%, white, transparent 45%),
              radial-gradient(circle at 80% 100%, #f5d94a, transparent 40%)`,
          }}
        />

        <motion.div
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#fff3a6] to-transparent"
          animate={{ opacity: [0.35, 0.9, 0.35], scaleX: [0.8, 1, 0.8] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
        <motion.div
          className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/4 rotate-[18deg] bg-white/10 blur-2xl"
          animate={{ x: ["-40%", "520%"] }}
          transition={{ duration: 5.5, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}
          aria-hidden
        />

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="pointer-events-auto absolute right-2.5 top-2.5 z-30 flex h-9 w-9 touch-manipulation items-center justify-center rounded-full bg-red-600/95 text-white shadow-lg ring-2 ring-black/20 transition hover:scale-105 hover:bg-red-500 active:scale-95"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" strokeWidth={2.5} />
        </button>

        <div className="relative pr-8">
          <h2
            id="daily-reward-title"
            className="font-black uppercase leading-none tracking-tight text-[#ffe566] drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]"
            style={{ fontSize: "clamp(1.45rem, 5vw, 1.75rem)" }}
          >
            Recompensa diária
          </h2>
          <p className="mt-2 max-w-[95%] text-sm leading-snug text-white/88">
            Volte todo dia para manter a sequência e desbloquear prêmios melhores.
          </p>
        </div>

        <div className="relative mt-4">
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 z-[1] bg-gradient-to-r from-[#4f3496] to-transparent",
              layout.edgeMaskClassName,
            )}
            aria-hidden
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 z-[1] bg-gradient-to-l from-[#4f3496] to-transparent",
              layout.edgeMaskClassName,
            )}
            aria-hidden
          />

          <div
            className={cn(
              "flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              layout.trackClassName,
            )}
          >
            {slots.map((s) => {
              const isCurrent = s.status === "current";
              const isClaimed = s.status === "claimed";
              const bonusLabel =
                s.tipoBonus === "bau" ? "Baú" : s.tipoBonus === "especial" ? "Especial" : null;

              return (
                <div
                  key={s.dayNum}
                  ref={isCurrent ? currentRef : undefined}
                  style={{ width: layout.slotWidth }}
                  className={cn(
                    "group relative isolate flex shrink-0 snap-center flex-col overflow-hidden rounded-[1.15rem] border text-center transition duration-300",
                    layout.slotClassName,
                    isCurrent &&
                      "z-[2] scale-[1.06] border-amber-200 bg-gradient-to-b from-[#fff4ac] via-[#ffd84f] to-[#e9a913] text-slate-950 shadow-[0_0_28px_-5px_rgba(255,220,75,0.95),0_14px_26px_-14px_rgba(0,0,0,0.8)] ring-2 ring-amber-100/70",
                    isClaimed &&
                      "border-emerald-300/20 bg-gradient-to-b from-[#29215d]/95 to-[#18143a]/95 text-violet-100 opacity-80",
                    s.status === "upcoming" &&
                      "border-white/10 bg-gradient-to-b from-[#6848bd]/85 to-[#342268]/95 text-violet-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_24px_-18px_rgba(0,0,0,0.9)] hover:-translate-y-0.5 hover:border-violet-200/30",
                  )}
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.32),transparent_68%)]",
                      isClaimed && "opacity-30",
                    )}
                    aria-hidden
                  />
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.06]"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg,white 1px,transparent 1px),linear-gradient(45deg,white 1px,transparent 1px)",
                      backgroundSize: "12px 12px",
                    }}
                    aria-hidden
                  />

                  <div className="relative z-[2] flex min-h-5 items-center justify-center">
                    {isCurrent ? (
                      <span
                        className={cn(
                          "rounded-full bg-slate-950 font-black uppercase tracking-[0.14em] text-amber-300 shadow-md",
                          layout.todayBadgeClassName,
                        )}
                      >
                        Hoje
                      </span>
                    ) : isClaimed ? (
                      <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-emerald-300">
                        <Check className="h-3 w-3" strokeWidth={3} />
                        Resgatado
                      </span>
                    ) : (
                      <LockKeyhole className="h-3 w-3 text-violet-200/55" aria-hidden />
                    )}
                  </div>

                  <div
                    className={cn(
                      "relative z-[2] flex flex-col items-center justify-center font-black uppercase leading-tight tracking-[0.08em]",
                      layout.titleClassName,
                      isCurrent ? "text-slate-800" : "text-white/85",
                    )}
                  >
                    <span className="pt-0.5">Dia {s.dayNum}</span>
                  </div>

                  <motion.div
                    className={cn(
                      "relative mx-auto mt-1 w-full overflow-hidden rounded-xl border [transform-style:preserve-3d]",
                      layout.artworkClassName,
                      isCurrent
                        ? "border-white/55 bg-[radial-gradient(circle_at_50%_30%,#fff8cf,rgba(255,255,255,0.2)_45%,rgba(146,64,14,0.2)_100%)]"
                        : "border-white/10 bg-[radial-gradient(circle_at_50%_28%,rgba(216,180,254,0.3),rgba(30,20,70,0.5)_70%)]",
                    )}
                    animate={
                      isCurrent
                        ? { y: [0, -2, 0], rotateY: [-4, 4, -4] }
                        : { rotateY: 0 }
                    }
                    transition={
                      isCurrent
                        ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
                        : { duration: 0.2 }
                    }
                    whileHover={{ scale: 1.05, rotateX: -4, rotateY: 7 }}
                  >
                    <Sparkles
                      className={cn(
                        "absolute right-1 top-1 h-3 w-3",
                        isCurrent ? "text-amber-700/70" : "text-fuchsia-200/60",
                      )}
                      aria-hidden
                    />
                    <div className="absolute inset-x-2 bottom-1.5 h-1.5 rounded-full bg-black/25 blur-[2px]" />
                    <div
                      className={cn(
                        "absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border shadow-[inset_0_2px_3px_rgba(255,255,255,0.55),0_6px_0_rgba(0,0,0,0.18),0_10px_18px_-7px_rgba(0,0,0,0.8)]",
                        isCurrent
                          ? "border-amber-50 bg-gradient-to-br from-white via-amber-200 to-amber-500 text-amber-800"
                          : "border-violet-100/40 bg-gradient-to-br from-violet-100 via-fuchsia-300 to-violet-700 text-violet-950",
                      )}
                      style={{ transform: "translate(-50%, -50%) translateZ(12px)" }}
                    >
                      {s.tipoBonus === "bau" ? (
                        <Gift className="h-6 w-6" strokeWidth={2.2} aria-label="Baú de prêmio" />
                      ) : s.tipoBonus === "especial" ? (
                        <Crown className="h-6 w-6" strokeWidth={2.2} aria-label="Prêmio especial" />
                      ) : s.gems > 0 ? (
                        <Gem className="h-6 w-6" strokeWidth={2.2} aria-label="Ticket" />
                      ) : (
                        <Coins className="h-6 w-6" strokeWidth={2.2} aria-label="Moedas PR" />
                      )}
                    </div>

                    {bonusLabel && s.coins > 0 ? (
                      <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border border-amber-100 bg-amber-400 text-amber-950 shadow-md">
                        <Coins className="h-3 w-3" strokeWidth={2.7} aria-hidden />
                      </span>
                    ) : null}
                    {bonusLabel && s.gems > 0 ? (
                      <span className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full border border-fuchsia-100 bg-fuchsia-400 text-fuchsia-950 shadow-md">
                        <Gem className="h-3 w-3" strokeWidth={2.7} aria-hidden />
                      </span>
                    ) : null}
                  </motion.div>

                  <div className="relative z-[2] mt-2 space-y-1">
                    <div
                      className={cn(
                        "flex items-center justify-center gap-1 rounded-lg px-1 py-1 font-black leading-none",
                        layout.amountClassName,
                        isCurrent ? "bg-amber-950/10 text-slate-950" : "bg-black/20 text-amber-100",
                      )}
                    >
                      <Coins className="h-3.5 w-3.5 shrink-0 text-amber-500" strokeWidth={2.5} />
                      <span>{formatCoins(s.coins)}</span>
                      <span className={cn("font-extrabold opacity-75", layout.amountLabelClassName)}>PR</span>
                    </div>
                    {s.gems > 0 ? (
                      <div
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-lg px-1 py-1 font-black leading-none",
                          layout.ticketClassName,
                          isCurrent ? "bg-fuchsia-950/10 text-fuchsia-950" : "bg-fuchsia-400/10 text-fuchsia-200",
                        )}
                      >
                        <Gem className="h-3 w-3 shrink-0 text-fuchsia-400" strokeWidth={2.5} />
                        <span>+{s.gems}</span>
                        <span className="opacity-80">ticket</span>
                      </div>
                    ) : null}
                  </div>

                  {bonusLabel ? (
                    <span
                      className={cn(
                        "relative z-[2] mt-1 inline-flex items-center justify-center gap-0.5 rounded-md font-black uppercase tracking-wide",
                        layout.bonusClassName,
                        isCurrent
                          ? "bg-slate-950/15 text-slate-900"
                          : "bg-black/25 text-violet-100",
                      )}
                    >
                      {s.tipoBonus === "bau" ? (
                        <Gift className="h-2.5 w-2.5" />
                      ) : (
                        <Crown className="h-2.5 w-2.5" />
                      )}
                      {bonusLabel}
                    </span>
                  ) : null}

                  {isClaimed ? (
                    <div className="pointer-events-none absolute inset-0 z-[3] bg-slate-950/15" aria-hidden />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={claimLoading || slots.length === 0}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!claimLoading && slots.length > 0) onClaim();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={cn(
            "pointer-events-auto relative z-20 mt-5 w-full touch-manipulation overflow-hidden rounded-2xl border-4 border-black/25 py-3.5 text-base font-black uppercase tracking-[0.2em] text-slate-950 shadow-[0_6px_0_rgba(0,0,0,0.35)] transition enabled:hover:translate-y-0.5 enabled:hover:shadow-[0_4px_0_rgba(0,0,0,0.35)] enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-45",
            "bg-gradient-to-r from-[#ffe566] via-[#f472b6] to-[#a855f7]",
          )}
        >
          <motion.span
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/4 rotate-12 bg-white/35 blur-md"
            animate={{ x: ["-20%", "520%"] }}
            transition={{ duration: 4.8, repeat: Infinity, repeatDelay: 1.8, ease: "easeInOut" }}
            aria-hidden
          />
          <span className="relative z-[1] drop-shadow-sm">{claimLoading ? "RECEBENDO..." : "RECEBER"}</span>
        </button>

        {errorMessage ? (
          <p className="mt-2.5 text-center text-sm font-medium text-red-200">{errorMessage}</p>
        ) : null}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
