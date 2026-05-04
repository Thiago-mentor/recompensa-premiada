import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";
import type { LucideIcon } from "lucide-react";

export function ClanEmptyState({
  icon: Icon,
  text,
  ctaLabel = "Ir para visão geral",
}: {
  icon: LucideIcon;
  text: string;
  ctaLabel?: string;
}) {
  return (
    <section className="game-panel relative overflow-hidden border border-dashed border-cyan-400/28 bg-gradient-to-b from-white/[0.07] to-white/[0.02] px-4 py-12 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-fuchsia-500/15 blur-2xl"
      />
      <Icon
        className="relative mx-auto h-9 w-9 text-cyan-200/65 drop-shadow-[0_0_14px_rgba(34,211,238,0.35)]"
        aria-hidden
      />
      <p className="relative mt-3 text-sm text-white/58">{text}</p>
      <Link
        href={ROUTES.cla}
        className="relative mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-4 py-2.5 text-sm font-bold text-cyan-100 shadow-[0_0_20px_-8px_rgba(34,211,238,0.45)] transition hover:bg-cyan-500/22"
      >
        {ctaLabel}
      </Link>
    </section>
  );
}
