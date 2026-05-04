import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type AdminMetricTone = "cyan" | "rose" | "amber" | "violet" | "emerald" | "slate";

const metricTones: Record<AdminMetricTone, string> = {
  cyan: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
  rose: "border-rose-400/20 bg-rose-500/10 text-rose-100",
  amber: "border-amber-400/20 bg-amber-500/10 text-amber-100",
  violet: "border-violet-400/20 bg-violet-500/10 text-violet-100",
  emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
  slate: "border-white/10 bg-white/[0.05] text-white/80",
};

export function AdminMetricCard({
  title,
  value,
  hint,
  icon,
  tone = "cyan",
  className,
}: {
  title: string;
  value: string;
  hint: string;
  icon?: ReactNode;
  tone?: AdminMetricTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "admin-panel-surface rounded-[1.5rem] border border-white/10 bg-slate-900/80 px-4 py-4 shadow-[0_9px_0_-6px_rgba(2,6,23,0.95),0_22px_44px_-24px_rgba(0,0,0,0.76),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-8px_18px_rgba(0,0,0,0.22)]",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
          metricTones[tone],
        )}
      >
        {icon}
        {title}
      </span>
      <p className="mt-3 text-2xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-white/45">{hint}</p>
    </div>
  );
}
