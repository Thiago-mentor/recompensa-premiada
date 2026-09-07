"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock3, Flame, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { BOOST_SYSTEM_DEFAULT_ENABLED, isBoostSystemEnabled } from "@/lib/features/boost";
import { fetchEconomyConfigDocument } from "@/services/systemConfigs/economyDocumentCache";
import { activateStoredBoostCallable } from "@/services/boost/boostService";
import type { SystemEconomyConfig } from "@/types/systemConfig";

const DEFAULT_CONFIG = {
  boostRewardPercent: 25,
  boostActivationMinutes: 15,
};

function timestampToMs(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  if ("toMillis" in value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return null;
    }
  }
  if ("toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return null;
    }
  }
  return null;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function BoostStatusBanner({ className }: { className?: string }) {
  const { user, profile, refreshProfile } = useAuth();
  const [resolved, setResolved] = useState(false);
  const [enabled, setEnabled] = useState(BOOST_SYSTEM_DEFAULT_ENABLED);
  const [rewardPercent, setRewardPercent] = useState(DEFAULT_CONFIG.boostRewardPercent);
  const [activationMinutes, setActivationMinutes] = useState(DEFAULT_CONFIG.boostActivationMinutes);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [activeUntilOverrideMs, setActiveUntilOverrideMs] = useState<number | null>(null);
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchEconomyConfigDocument()
      .then((raw) => {
        if (cancelled) return;
        const config = (raw ?? {}) as Partial<SystemEconomyConfig>;
        setEnabled(isBoostSystemEnabled(config));
        setRewardPercent(
          typeof config.boostRewardPercent === "number"
            ? Math.max(0, Math.floor(config.boostRewardPercent))
            : DEFAULT_CONFIG.boostRewardPercent,
        );
        setActivationMinutes(
          typeof config.boostActivationMinutes === "number"
            ? Math.max(1, Math.floor(config.boostActivationMinutes))
            : DEFAULT_CONFIG.boostActivationMinutes,
        );
      })
      .finally(() => {
        if (!cancelled) setResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const profileActiveUntilMs = timestampToMs(profile?.activeBoostUntil);
  const activeUntilMs = Math.max(profileActiveUntilMs ?? 0, activeUntilOverrideMs ?? 0);
  const remainingMs = Math.max(0, activeUntilMs - nowMs);
  const active = remainingMs > 0;
  const storedMinutes = Math.max(0, Math.floor(profile?.storedBoostMinutes ?? 0));
  const nextActivationMinutes = Math.min(storedMinutes, activationMinutes);

  useEffect(() => {
    if (activeUntilMs <= Date.now()) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeUntilMs]);

  const statusCopy = useMemo(() => {
    if (active) return `+${rewardPercent}% de PR por ${formatRemaining(remainingMs)}`;
    if (storedMinutes > 0) return `${storedMinutes} min disponíveis para ativar`;
    return `${profile?.fragments ?? 0} fragmentos no inventário`;
  }, [active, profile?.fragments, remainingMs, rewardPercent, storedMinutes]);

  async function activate() {
    if (!user || activating || storedMinutes <= 0) return;
    setActivating(true);
    setMessage(null);
    const result = await activateStoredBoostCallable();
    setActivating(false);
    if (!result.ok) {
      setMessage("Não foi possível ativar agora. Tente novamente.");
      return;
    }
    setActiveUntilOverrideMs(result.activeBoostUntilMs);
    setNowMs(Date.now());
    setMessage(`Boost +${result.boostRewardPercent}% ativado.`);
    await refreshProfile();
  }

  if (!resolved || !enabled) return null;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[1.25rem] border px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_34px_-24px_rgba(251,146,60,0.7)]",
        active
          ? "border-orange-300/38 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.2),transparent_40%),linear-gradient(135deg,rgba(67,20,7,0.72),rgba(30,27,75,0.64),rgba(2,6,23,0.94))]"
          : "border-violet-300/24 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.16),transparent_42%),linear-gradient(135deg,rgba(46,16,101,0.46),rgba(2,6,23,0.94))]",
        className,
      )}
      aria-label="Status do boost"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.05)_48%,transparent_65%)]" />
      <div className="relative flex items-center gap-3">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border",
            active
              ? "border-orange-200/45 bg-orange-400/18 text-orange-100 shadow-[0_0_24px_-8px_rgba(251,146,60,0.9)]"
              : "border-violet-300/30 bg-violet-500/15 text-violet-100",
          )}
        >
          <Flame className={cn("h-5 w-5", active && "fill-orange-300")} aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
              {active ? "Boost ativo" : "Boost de PR"}
            </p>
            {active ? (
              <span className="rounded-full border border-orange-200/35 bg-orange-400/14 px-2 py-0.5 text-[8px] font-black uppercase text-orange-100">
                Turbo
              </span>
            ) : null}
          </div>
          <p className={cn("mt-0.5 font-black", active ? "text-sm tabular-nums text-orange-100" : "text-xs text-white")}>
            {statusCopy}
          </p>
          {message ? <p className="mt-1 text-[9px] font-semibold text-emerald-200">{message}</p> : null}
        </div>

        {!active && storedMinutes > 0 ? (
          <button
            type="button"
            onClick={() => void activate()}
            disabled={activating}
            className="min-h-10 shrink-0 rounded-xl border border-orange-300/35 bg-orange-400/15 px-3 text-[10px] font-black text-orange-100 transition hover:bg-orange-400/22 disabled:opacity-55"
          >
            {activating ? "Ativando…" : `Ativar ${nextActivationMinutes} min`}
          </button>
        ) : (
          <Link
            href={ROUTES.loja}
            className="flex h-10 shrink-0 items-center gap-1 rounded-xl border border-white/12 bg-white/[0.055] px-2.5 text-[9px] font-black text-white/72 transition hover:border-orange-300/30 hover:text-orange-100"
          >
            {active ? <Clock3 className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            Lab
            <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </section>
  );
}
