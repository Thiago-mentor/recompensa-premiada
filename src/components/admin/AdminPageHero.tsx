import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type AdminHeroAccent = "cyan" | "amber" | "violet" | "emerald" | "rose";

const accentStyles: Record<AdminHeroAccent, string> = {
  cyan:
    "bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] shadow-[0_0_56px_-24px_rgba(34,211,238,0.22)]",
  amber:
    "bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] shadow-[0_0_56px_-24px_rgba(245,158,11,0.24)]",
  violet:
    "bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] shadow-[0_0_56px_-24px_rgba(139,92,246,0.28)]",
  emerald:
    "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] shadow-[0_0_56px_-24px_rgba(16,185,129,0.24)]",
  rose:
    "bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] shadow-[0_0_56px_-24px_rgba(244,63,94,0.24)]",
};

export function AdminPageHero({
  eyebrow = "Controle premium",
  title,
  description,
  actions,
  accent = "cyan",
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  accent?: AdminHeroAccent;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "admin-panel-surface overflow-hidden rounded-[1.9rem] border border-white/10 p-5 shadow-[0_10px_0_-6px_rgba(2,6,23,0.95),0_28px_58px_-28px_rgba(0,0,0,0.76),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-12px_24px_rgba(0,0,0,0.22)]",
        accentStyles[accent],
        className,
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-200/75">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">{title}</h1>
          <div className="mt-2 text-sm leading-relaxed text-white/65">{description}</div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </header>
  );
}
