import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

type Tone = "info" | "success" | "error";

const tones: Record<Tone, string> = {
  info: "border-sky-500/40 bg-sky-950/40 text-sky-100",
  success: "border-emerald-500/40 bg-emerald-950/40 text-emerald-100",
  error: "border-red-500/40 bg-red-950/50 text-red-100",
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
      className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}
    >
      {children}
    </div>
  );
}
