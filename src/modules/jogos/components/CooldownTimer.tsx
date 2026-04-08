"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

/** Contagem regressiva a partir de `remainingMs` (atualize via props, ex.: perfil Firestore). */
export function CooldownTimer({
  remainingMs,
  className,
  label = "Disponível em",
}: {
  remainingMs: number;
  className?: string;
  label?: string;
}) {
  const [ms, setMs] = useState(remainingMs);
  const isRunning = ms > 0;

  useEffect(() => {
    setMs(remainingMs);
  }, [remainingMs]);

  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => {
      setMs((x) => Math.max(0, x - 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [isRunning]);

  if (ms <= 0) return null;

  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const text =
    h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;

  return (
    <p
      className={cn(
        "rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-100",
        className,
      )}
    >
      {label}: <strong>{text}</strong>
    </p>
  );
}
