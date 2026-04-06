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
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {label}
      </button>
      <Link
        href={fallbackHref}
        className="ml-2 hidden text-xs text-white/45 transition hover:text-white/70 sm:inline"
      >
        ir para início
      </Link>
    </div>
  );
}
