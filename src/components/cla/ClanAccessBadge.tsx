import { cn } from "@/lib/utils/cn";

export function ClanAccessBadge({
  label,
  tone = "amber",
  className,
}: {
  label: string;
  tone?: "amber" | "fuchsia";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] shadow-[0_0_20px_-14px_rgba(255,255,255,0.35)]",
        tone === "amber"
          ? "border-amber-400/25 bg-amber-500/10 text-amber-100"
          : "border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-100",
        className,
      )}
    >
      {label}
    </span>
  );
}
