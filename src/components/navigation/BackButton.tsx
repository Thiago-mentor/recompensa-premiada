"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { ChevronLeft } from "lucide-react";

type BackButtonProps = {
  fallbackHref: string;
  label?: string;
  className?: string;
};

export function BackButton({ fallbackHref, label = "Voltar", className }: BackButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <div className={cn("flex items-center", className)}>
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex min-h-11 items-center gap-2 rounded-[1rem] border border-cyan-400/18 bg-[linear-gradient(180deg,rgba(5,10,24,0.95),rgba(7,12,28,0.88))] px-3.5 text-sm font-semibold text-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-cyan-400/32 hover:bg-cyan-500/10 hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {label}
      </button>
      <Link
        href={fallbackHref}
        className="ml-2 hidden text-xs font-medium text-cyan-100/55 transition hover:text-cyan-100/80 sm:inline"
      >
        ir para início
      </Link>
    </div>
  );
}
