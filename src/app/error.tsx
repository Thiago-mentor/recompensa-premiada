"use client";

import { RefreshCw } from "lucide-react";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#070712] px-5 py-10 text-white">
      <section className="w-full max-w-sm rounded-[1.5rem] border border-fuchsia-400/25 bg-slate-950/90 p-6 text-center shadow-[0_0_48px_-18px_rgba(217,70,239,0.55)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-200">
          <RefreshCw className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-black">Algo saiu do ritmo</h1>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Nao foi possivel carregar esta tela agora. Tente novamente sem perder sua sessao.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-fuchsia-300/35 bg-fuchsia-500/15 px-5 text-sm font-bold text-fuchsia-50 transition hover:bg-fuchsia-500/25 active:scale-[0.98]"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
