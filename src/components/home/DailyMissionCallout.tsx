import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";
import type { DailyMissionCalloutModel } from "@/hooks/useDailyMissionCalloutModel";
import { ChevronRight, Ticket, Tv, Trophy } from "lucide-react";

const STEPS = [
  { key: "ads" as const, icon: Tv, href: "#home-rewarded-ad" as const, externalAnchor: true },
  { key: "tickets" as const, icon: Ticket, href: ROUTES.missoes, externalAnchor: false },
  { key: "rank" as const, icon: Trophy, href: ROUTES.jogos, externalAnchor: false },
] as const;

export function DailyMissionCallout({ model }: { model: DailyMissionCalloutModel }) {
  const content = [
    { ...STEPS[0], title: model.ads.title, hint: model.ads.hint },
    { ...STEPS[1], title: model.tickets.title, hint: model.tickets.hint },
    { ...STEPS[2], title: model.rank.title, hint: model.rank.hint },
  ];

  return (
    <section
      aria-labelledby="daily-mission-title"
      className="overflow-hidden rounded-[1.2rem] border border-amber-400/30 bg-[linear-gradient(135deg,rgba(120,53,15,0.28),rgba(88,28,135,0.2)_52%,rgba(15,23,42,0.88))] p-3 shadow-[0_0_34px_-18px_rgba(251,191,36,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-400/10" aria-hidden>
            <Trophy className="h-4 w-4 text-amber-200" />
          </span>
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-amber-200/75">
              Foco de hoje
            </p>
            <h2
              id="daily-mission-title"
              className="text-sm font-black text-white"
            >
              Missões do dia
            </h2>
          </div>
        </div>
        <Link
          href={ROUTES.missoes}
          className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-bold text-amber-200/85"
        >
          Ver todas
          <ChevronRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      <ul className="mt-2.5 divide-y divide-white/[0.07]" aria-busy={model.loading}>
        {content.map((step) => {
          const Icon = step.icon;
          const rowClassName = model.loading
            ? "pointer-events-none flex min-h-[54px] w-full items-center gap-2.5 py-2 text-left opacity-95"
            : "group flex min-h-[54px] w-full items-center gap-2.5 py-2 text-left transition hover:bg-white/[0.025]";

          const body = model.loading ? (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20">
                <Icon className="h-4 w-4 text-amber-200/50" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3.5 w-[min(220px,72%)] animate-pulse rounded bg-white/12" />
                <div className="h-2.5 w-[min(280px,92%)] animate-pulse rounded bg-white/8" />
              </div>
            </>
          ) : (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20">
                <Icon className="h-4 w-4 text-amber-200" strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold leading-snug text-white">{step.title}</span>
                <span className="mt-0.5 block line-clamp-1 text-[9px] text-white/50">{step.hint}</span>
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-white/30 transition group-hover:text-amber-200/90"
                aria-hidden
              />
            </>
          );

          if (!model.loading && step.externalAnchor) {
            return (
              <li key={step.key}>
                <a href={step.href} className={rowClassName}>
                  {body}
                </a>
              </li>
            );
          }

          if (!model.loading && !step.externalAnchor) {
            return (
              <li key={step.key}>
                <Link href={step.href} className={rowClassName}>
                  {body}
                </Link>
              </li>
            );
          }

          return (
            <li key={step.key}>
              <div className={rowClassName}>{body}</div>
            </li>
          );
        })}
      </ul>

    </section>
  );
}
