import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

type Tone = "info" | "success" | "error";

const tones: Record<Tone, string> = {
  info: "border-cyan-400/24 bg-[linear-gradient(135deg,rgba(8,47,73,0.72),rgba(8,16,32,0.94))] text-cyan-50 shadow-[0_0_26px_-16px_rgba(34,211,238,0.45)]",
  success:
    "border-emerald-400/24 bg-[linear-gradient(135deg,rgba(6,78,59,0.74),rgba(7,18,22,0.94))] text-emerald-50 shadow-[0_0_26px_-16px_rgba(52,211,153,0.4)]",
  error:
    "border-rose-400/24 bg-[linear-gradient(135deg,rgba(127,29,29,0.8),rgba(20,8,12,0.95))] text-rose-50 shadow-[0_0_26px_-16px_rgba(251,113,133,0.36)]",
};

export function AlertBanner({
  tone = "info",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "relative overflow-hidden rounded-[1.15rem] border px-4 py-3 text-sm backdrop-blur-md",
        tones[tone],
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06),transparent_22%,transparent_78%,rgba(255,255,255,0.04))]" />
      {children}
    </div>
  );
}
