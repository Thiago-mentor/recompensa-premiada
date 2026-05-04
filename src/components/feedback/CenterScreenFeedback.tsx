"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type CenterScreenFeedbackTone = "info" | "success" | "error";

type FeedbackState = {
  tone: CenterScreenFeedbackTone;
  message: string;
  durationMs: number;
};

const defaultDuration: Record<CenterScreenFeedbackTone, number> = {
  success: 4500,
  info: 5500,
  error: 7500,
};

const tonePanel: Record<CenterScreenFeedbackTone, string> = {
  info: "border-cyan-400/35 bg-[linear-gradient(135deg,rgba(8,47,73,0.88),rgba(8,16,32,0.96))] text-cyan-50 shadow-[0_0_40px_-12px_rgba(34,211,238,0.5)]",
  success:
    "border-emerald-400/35 bg-[linear-gradient(135deg,rgba(6,78,59,0.88),rgba(7,18,22,0.96))] text-emerald-50 shadow-[0_0_40px_-12px_rgba(52,211,153,0.45)]",
  error:
    "border-rose-400/35 bg-[linear-gradient(135deg,rgba(127,29,29,0.9),rgba(20,8,12,0.97))] text-rose-50 shadow-[0_0_40px_-12px_rgba(251,113,133,0.4)]",
};

const CenterScreenFeedbackContext = createContext<{
  notify: (tone: CenterScreenFeedbackTone, message: string, opts?: { durationMs?: number }) => void;
} | null>(null);

function CenterScreenFeedbackOverlay({
  state,
  onDismiss,
}: {
  state: FeedbackState;
  onDismiss: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(onDismiss, state.durationMs);
    return () => clearTimeout(t);
  }, [state, onDismiss]);

  useEffect(() => {
    panelRef.current?.focus();
  }, [state.message, state.tone]);

  const Icon =
    state.tone === "success" ? CheckCircle2 : state.tone === "error" ? XCircle : Info;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ backgroundColor: "rgb(2 6 23 / 0.65)" }}
      role="presentation"
      onClick={onDismiss}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="center-feedback-title"
        aria-describedby="center-feedback-desc"
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-md cursor-default rounded-[1.35rem] border px-5 py-4 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-200",
          tonePanel[state.tone],
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onDismiss();
        }}
      >
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-current opacity-70 transition hover:bg-white/10 hover:opacity-100"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex gap-3 pr-7">
          <Icon className="mt-0.5 h-6 w-6 shrink-0 opacity-90" aria-hidden />
          <div className="min-w-0 flex-1 space-y-1">
            <p id="center-feedback-title" className="text-sm font-semibold leading-tight">
              {state.tone === "success"
                ? "Tudo certo"
                : state.tone === "error"
                  ? "Algo deu errado"
                  : "Aviso"}
            </p>
            <p
              id="center-feedback-desc"
              className="max-h-[min(50vh,18rem)] overflow-y-auto text-sm leading-relaxed text-current/90"
            >
              {state.message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CenterScreenFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FeedbackState | null>(null);

  const notify = useCallback(
    (tone: CenterScreenFeedbackTone, message: string, opts?: { durationMs?: number }) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      setState({
        tone,
        message: trimmed,
        durationMs: opts?.durationMs ?? defaultDuration[tone],
      });
    },
    [],
  );

  const dismiss = useCallback(() => setState(null), []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <CenterScreenFeedbackContext.Provider value={value}>
      {children}
      {state ? <CenterScreenFeedbackOverlay state={state} onDismiss={dismiss} /> : null}
    </CenterScreenFeedbackContext.Provider>
  );
}

export function useCenterScreenFeedback() {
  const ctx = useContext(CenterScreenFeedbackContext);
  if (!ctx) {
    throw new Error("useCenterScreenFeedback deve ser usado dentro de CenterScreenFeedbackProvider");
  }
  return ctx;
}
