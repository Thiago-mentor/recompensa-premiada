"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";

export function ConnectionStatusBanner() {
  const [offline, setOffline] = useState(false);
  const [justRestored, setJustRestored] = useState(false);

  const checkConnection = useCallback(async () => {
    if (typeof window === "undefined") return false;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(`/favicon.ico?connection_probe=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    let restoredTimer: number | null = null;
    const probe = async (showFailure: boolean) => {
      const connected = await checkConnection();
      if (connected) {
        setOffline(false);
      } else if (showFailure) {
        setOffline(true);
        setJustRestored(false);
      }
      return connected;
    };

    const onOffline = () => {
      setJustRestored(false);
      void probe(true);
    };
    const onOnline = () => {
      void probe(false).then((connected) => {
        if (!connected) return;
        setOffline((wasOffline) => {
          if (!wasOffline) return false;
          setJustRestored(true);
          if (restoredTimer !== null) window.clearTimeout(restoredTimer);
          restoredTimer = window.setTimeout(() => setJustRestored(false), 2800);
          return false;
        });
      });
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    const probeTimer = window.setTimeout(() => void probe(false), 300);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      if (restoredTimer !== null) window.clearTimeout(restoredTimer);
      window.clearTimeout(probeTimer);
    };
  }, [checkConnection]);

  if (!offline && !justRestored) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        offline
          ? "fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-amber-300/30 bg-slate-950/95 px-4 py-3 text-amber-50 shadow-2xl shadow-black/40 backdrop-blur"
          : "fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-emerald-300/30 bg-slate-950/95 px-4 py-3 text-emerald-50 shadow-2xl shadow-black/40 backdrop-blur"
      }
    >
      {offline ? <WifiOff className="h-5 w-5 shrink-0 text-amber-300" /> : <Wifi className="h-5 w-5 shrink-0 text-emerald-300" />}
      <span className="min-w-0 flex-1 text-xs font-semibold">
        {offline ? "Sem conexão. Algumas ações ficarão pausadas." : "Conexão restaurada."}
      </span>
      {offline ? (
        <button
          type="button"
          onClick={() => {
            void checkConnection().then((connected) => {
              if (connected) window.location.reload();
            });
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar
        </button>
      ) : null}
    </div>
  );
}
