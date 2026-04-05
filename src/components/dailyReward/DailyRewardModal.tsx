"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Check, Gift, Sparkles, X } from "lucide-react";

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

  if (!open || typeof window === "undefined") return null;

  const hasCurrent = slots.some((s) => s.status === "current");

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-reward-title"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 pb-10 backdrop-blur-md sm:items-center sm:p-4 sm:pb-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      onClick={onClose}
    >
      <motion.div
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-[1.35rem] border-[3px] border-[#f5d94a] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.2),0_24px_60px_-12px_rgba(0,0,0,0.65),0_0_80px_-20px_rgba(245,217,74,0.35)] sm:p-5",
          "bg-gradient-to-b from-[#5c3eb0] via-[#4f3496] to-[#3d2675]",
        )}
        initial={{ opacity: 0, scale: 0.94, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320, mass: 0.85 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 0%, white, transparent 45%),
              radial-gradient(circle at 80% 100%, #f5d94a, transparent 40%)`,
          }}
        />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-red-600/95 text-white shadow-lg ring-2 ring-black/20 transition hover:scale-105 hover:bg-red-500 active:scale-95"
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
            className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-[#4f3496] to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-[#4f3496] to-transparent"
            aria-hidden
          />

          <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {slots.map((s) => {
              const isCurrent = s.status === "current";
              const isClaimed = s.status === "claimed";
              const bonusLabel =
                s.tipoBonus === "bau" ? "Baú" : s.tipoBonus === "especial" ? "Especial" : null;

              return (
                <div
                  key={s.dayNum}
                  ref={isCurrent ? currentRef : undefined}
                  className={cn(
                    "relative flex w-[4.65rem] shrink-0 snap-center flex-col rounded-2xl border-2 px-1.5 pb-2.5 pt-1.5 text-center transition-shadow duration-300",
                    isCurrent &&
                      "z-[2] scale-[1.07] border-[#ffe566] bg-gradient-to-b from-[#ffe566] to-[#f5c918] text-slate-900 shadow-[0_0_24px_-4px_rgba(255,229,102,0.75),0_8px_20px_-8px_rgba(0,0,0,0.5)] ring-2 ring-amber-200/60",
                    isClaimed &&
                      "border-violet-950/60 bg-violet-950/75 text-violet-100/95 opacity-[0.92]",
                    s.status === "upcoming" &&
                      "border-violet-900/55 bg-violet-900/55 text-violet-50/90 shadow-inner",
                  )}
                >
                  {isCurrent ? (
                    <span className="absolute -top-2 left-1/2 z-[1] -translate-x-1/2 rounded-full bg-slate-900 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#ffe566] shadow-md">
                      Hoje
                    </span>
                  ) : null}

                  <div
                    className={cn(
                      "flex min-h-[2.1rem] flex-col items-center justify-center text-[10px] font-bold uppercase leading-tight",
                      isCurrent ? "text-slate-800" : "text-white/85",
                    )}
                  >
                    {isClaimed ? (
                      <span className="flex flex-col items-center gap-0.5 text-emerald-300/95">
                        <Check className="h-4 w-4" strokeWidth={3} />
                        <span className="text-[8px] font-extrabold tracking-wide">Ok</span>
                      </span>
                    ) : (
                      <span className="pt-0.5">Dia {s.dayNum}</span>
                    )}
                  </div>

                  <div
                    className={cn(
                      "relative mx-auto mt-1.5 h-[3.25rem] w-full overflow-hidden rounded-xl",
                      "bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.45),transparent_52%)]",
                      isCurrent ? "bg-amber-200/95" : "bg-violet-800/90",
                    )}
                  >
                    <div
                      className="absolute inset-0 opacity-30"
                      style={{
                        backgroundImage: `repeating-conic-gradient(from 0deg, transparent 0deg 8deg, rgba(255,255,255,0.06) 8deg 16deg)`,
                      }}
                    />
                  </div>

                  <p
                    className={cn(
                      "mt-2 text-[11px] font-extrabold leading-tight",
                      isCurrent ? "text-slate-900" : "text-amber-50/95",
                    )}
                  >
                    {formatCoins(s.coins)}
                    <span className="block text-[9px] font-bold opacity-90">PR</span>
                    {s.gems > 0 ? (
                      <span className="mt-0.5 block text-[9px] font-bold text-fuchsia-200">
                        +{s.gems} TICKET
                      </span>
                    ) : null}
                  </p>

                  {bonusLabel ? (
                    <span
                      className={cn(
                        "mt-1 inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[7px] font-bold uppercase tracking-wide",
                        isCurrent
                          ? "bg-slate-900/15 text-slate-800"
                          : "bg-black/25 text-amber-100/90",
                      )}
                    >
                      {s.tipoBonus === "bau" ? (
                        <Gift className="h-2.5 w-2.5" />
                      ) : (
                        <Sparkles className="h-2.5 w-2.5" />
                      )}
                      {bonusLabel}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={claimLoading || !hasCurrent}
          onClick={onClaim}
          className={cn(
            "relative mt-5 w-full overflow-hidden rounded-2xl border-4 border-black/25 py-3.5 text-base font-black uppercase tracking-[0.2em] text-slate-950 shadow-[0_6px_0_rgba(0,0,0,0.35)] transition enabled:hover:translate-y-0.5 enabled:hover:shadow-[0_4px_0_rgba(0,0,0,0.35)] enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-45",
            "bg-gradient-to-r from-[#ffe566] via-[#f472b6] to-[#a855f7]",
          )}
        >
          <span className="relative z-[1] drop-shadow-sm">{claimLoading ? "RESGATANDO…" : "RESGATAR"}</span>
        </button>

        {errorMessage ? (
          <p className="mt-2.5 text-center text-sm font-medium text-red-200">{errorMessage}</p>
        ) : null}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
