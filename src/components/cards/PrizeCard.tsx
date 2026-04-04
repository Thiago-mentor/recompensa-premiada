import { cn } from "@/lib/utils/cn";
import { Sparkles } from "lucide-react";

export function PrizeCard({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/50 to-slate-900/80 p-4 flex gap-3 items-center",
        className,
      )}
    >
      <Sparkles className="h-8 w-8 shrink-0 text-fuchsia-300" />
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="text-sm text-white/65">{subtitle}</p>
      </div>
    </div>
  );
}
