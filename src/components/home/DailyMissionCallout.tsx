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
      className="relative overflow-hidden rounded-[1.25rem] border border-amber-400/35 bg-[linear-gradient(135deg,rgba(120,53,15,0.35)_0%,rgba(88,28,135,0.28)_48%,rgba(15,23,42,0.92)_100%)] p-3.5 shadow-[0_0_40px_-14px_rgba(251,191,36,0.45),inset_0_1px_0_rgba(255,255,255,0.1)] sm:p-4"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-amber-400/15 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-4 bottom-0 h-24 w-24 rounded-full bg-violet-500/20 blur-2xl"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none" aria-hidden>
            🎯
          </span>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-200/90">
              Foco de hoje
            </p>
            <h2
              id="daily-mission-title"
              className="mt-0.5 text-sm font-black uppercase tracking-wide text-white sm:text-base"
            >
              Missão do dia
            </h2>
          </div>
        </div>
        <Link
          href={ROUTES.missoes}
          className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-cyan-100/90 transition hover:bg-white/10"
        >
          Painel completo
          <ChevronRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      <ul className="relative mt-3 space-y-2" aria-busy={model.loading}>
        {content.map((step) => {
          const Icon = step.icon;
          const rowClassName = model.loading
            ? "pointer-events-none flex w-full items-start gap-2.5 rounded-xl border border-white/8 bg-black/15 px-2.5 py-2 text-left opacity-95"
            : "group flex w-full items-start gap-2.5 rounded-xl border border-white/8 bg-black/20 px-2.5 py-2 text-left transition hover:border-amber-300/35 hover:bg-black/30";

          const body = model.loading ? (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20">
                <Icon className="h-4 w-4 text-amber-200/50" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-2 py-0.5">
                <div className="h-4 w-[min(220px,72%)] animate-pulse rounded-md bg-white/12" />
                <div className="h-3 w-[min(280px,92%)] animate-pulse rounded-md bg-white/8" />
              </div>
            </>
          ) : (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <Icon className="h-4 w-4 text-amber-200" strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold leading-snug text-white">{step.title}</span>
                <span className="mt-0.5 block text-[10px] font-medium text-white/55">{step.hint}</span>
              </span>
              <ChevronRight
                className="mt-0.5 h-4 w-4 shrink-0 text-white/35 transition group-hover:text-amber-200/90"
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

      <p className="relative mt-3 text-[10px] font-semibold leading-relaxed text-white/45">
        👉 Feche essas três metas hoje e veja PR, tickets e posição no ranking subirem mais rápido.
      </p>
    </section>
  );
}
