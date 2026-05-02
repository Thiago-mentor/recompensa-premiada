import { cn } from "@/lib/utils/cn";
import type { LucideIcon } from "lucide-react";

const tones = {
  /** PR — ícone rosa/dourado, valor ouro (estilo reference) */
  pr: {
    label: "text-amber-200/92",
    icon: "text-rose-300 drop-shadow-[0_0_14px_rgba(251,113,133,0.75)]",
    value:
      "bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(251,191,36,0.35)]",
    panel:
      "casino-panel-soft !border-rose-400/35 !border-amber-400/30 shadow-[0_0_40px_-14px_rgba(251,113,133,0.35),0_0_32px_-12px_rgba(245,158,11,0.25)]",
  },
  /** TICKET — ícone vermelho/rosa, valor branco */
  ticket: {
    label: "text-fuchsia-200/88",
    icon: "text-rose-400 drop-shadow-[0_0_14px_rgba(251,113,133,0.7)]",
    value: "text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.12)]",
    panel:
      "casino-panel-soft !border-fuchsia-500/38 shadow-[0_0_38px_-14px_rgba(217,70,239,0.4),0_0_28px_-10px_rgba(244,114,182,0.25)]",
  },
  /** CASH — ícone verde, valor ouro intenso */
  cash: {
    label: "text-emerald-200/88",
    icon: "text-emerald-400 drop-shadow-[0_0_16px_rgba(52,211,153,0.6)]",
    value:
      "bg-gradient-to-b from-amber-50 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(251,191,36,0.4)]",
    panel:
      "casino-panel-soft !border-emerald-400/45 !border-amber-400/25 shadow-[0_0_42px_-14px_rgba(16,185,129,0.32),0_0_36px_-12px_rgba(245,158,11,0.22)]",
  },
  cyan: {
    label: "text-cyan-100/75",
    icon: "text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]",
    value: "text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.1)]",
    panel:
      "casino-panel-soft !border-cyan-400/32 shadow-[0_0_28px_-12px_rgba(34,211,238,0.32)]",
  },
  gold: {
    label: "text-amber-200/95",
    icon: "text-amber-300 drop-shadow-[0_0_14px_rgba(251,191,36,0.5)]",
    value:
      "bg-gradient-to-b from-amber-100 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_16px_rgba(251,191,36,0.3)]",
    panel:
      "casino-panel-soft !border-amber-400/48 shadow-[0_0_40px_-14px_rgba(245,158,11,0.38),0_0_24px_-6px_rgba(234,179,8,0.28)]",
  },
  violet: {
    label: "text-violet-200/95",
    icon: "text-violet-300 drop-shadow-[0_0_12px_rgba(167,139,250,0.55)]",
    value: "text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.1)]",
    panel:
      "casino-panel-soft !border-violet-400/42 shadow-[0_0_36px_-14px_rgba(139,92,246,0.42)]",
  },
  emerald: {
    label: "text-emerald-200/90",
    icon: "text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]",
    value: "text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.1)]",
    panel:
      "casino-panel-soft !border-emerald-400/35 shadow-[0_0_28px_-12px_rgba(16,185,129,0.32)]",
  },
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  className,
  tone = "cyan",
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  className?: string;
  tone?: keyof typeof tones;
}) {
  const t = tones[tone];
  return (
    <div className={cn("template-3d-lift rounded-[1.25rem] p-[1.15rem] sm:p-5", t.panel, className)}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-[10px] font-black uppercase tracking-[0.24em]", t.label)}>
          {label}
        </span>
        {Icon ? <Icon className={cn("h-[1.05rem] w-[1.05rem]", t.icon)} aria-hidden /> : null}
      </div>
      <p
        className={cn(
          "mt-3 text-2xl font-black tracking-tight sm:text-[1.65rem]",
          t.value,
        )}
      >
        {value}
      </p>
    </div>
  );
}
