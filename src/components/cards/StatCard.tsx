import { cn } from "@/lib/utils/cn";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "game-panel-soft rounded-[1.35rem] p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100/68">
          {label}
        </span>
        {Icon ? <Icon className="h-4 w-4 text-cyan-200" aria-hidden /> : null}
      </div>
      <p className="mt-2 text-2xl font-black tracking-tight text-white">{value}</p>
    </div>
  );
}
