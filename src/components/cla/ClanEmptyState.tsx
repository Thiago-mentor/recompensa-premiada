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
    <section className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-12 text-center">
      <Icon className="mx-auto h-8 w-8 text-white/35" aria-hidden />
      <p className="mt-3 text-sm text-white/55">{text}</p>
      <Link
        href={ROUTES.cla}
        className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/15"
      >
        {ctaLabel}
      </Link>
    </section>
  );
}
