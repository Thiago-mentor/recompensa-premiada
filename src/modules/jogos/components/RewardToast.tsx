"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { Coins, Sparkles } from "lucide-react";

export function RewardToast({
  message,
  visible,
  onDismiss,
  durationMs = 4200,
  presentation = "default",
}: {
  message: string | null;
  visible: boolean;
  onDismiss: () => void;
  durationMs?: number;
  presentation?: "default" | "roleta";
}) {
  useEffect(() => {
    if (!visible || !message) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [visible, message, durationMs, onDismiss]);

  if (!visible || !message) return null;

  const isJackpot = presentation === "roleta";

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-6 left-1/2 z-[60] flex max-w-sm -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4",
        "duration-300",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm shadow-xl",
          isJackpot &&
            [
              "border-fuchsia-500/38 border-orange-400/25 text-violet-50",
              "bg-[linear-gradient(160deg,#2a1445_0%,#120718_52%,#1a0828_100%)]",
              "shadow-[0_12px_40px_-14px_rgba(217,70,239,0.45)]",
            ].join(" "),
          !isJackpot && "border-emerald-500/40 bg-emerald-950/95 text-emerald-50 shadow-emerald-900/40",
        )}
      >
        {isJackpot ? (
          <Sparkles className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
        ) : (
          <Coins className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
        )}
        <span>{message}</span>
      </div>
    </div>
  );
}
