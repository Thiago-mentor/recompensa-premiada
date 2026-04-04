"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { Coins } from "lucide-react";

export function RewardToast({
  message,
  visible,
  onDismiss,
  durationMs = 4200,
}: {
  message: string | null;
  visible: boolean;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!visible || !message) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [visible, message, durationMs, onDismiss]);

  if (!visible || !message) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-6 left-1/2 z-[60] flex max-w-sm -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4",
        "duration-300",
      )}
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-950/95 px-4 py-3 text-sm text-emerald-50 shadow-xl shadow-emerald-900/40">
        <Coins className="h-5 w-5 text-emerald-300" />
        <span>{message}</span>
      </div>
    </div>
  );
}
