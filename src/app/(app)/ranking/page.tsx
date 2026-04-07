"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { RankingTable } from "@/modules/jogos";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { resolveAvatarUrl } from "@/lib/users/avatar";
import { useExperienceCatalogBuckets } from "@/hooks/useExperienceCatalogBuckets";
import { fetchRankingPrizeConfig } from "@/services/ranking/rankingConfigService";
import { fetchMyRankingEntry, fetchTopRanking } from "@/services/ranking/rankingService";
import {
  createEmptyRankingPrizePeriodConfig,
  formatRankingPrize,
  type NormalizedRankingPrizeConfig,
} from "@/lib/ranking/prizes";
import type { RankingEntry, RankingPeriod, RankingScope } from "@/types/ranking";
import type { RankingPrizePeriodConfig, RankingPrizeTier } from "@/types/systemConfig";
import { getDailyPeriodKey, getMonthlyPeriodKey, getWeeklyPeriodKey } from "@/utils/date";
import { ChevronRight, Crown, Filter, Gift, Trophy } from "lucide-react";

type RankingViewMode = "ranking" | "prizes";

const TOP_FETCH_LIMIT = 100;
const TOP_OPTIONS = [5, 10, 25, 50, 100] as const;

const tabs: { id: RankingPeriod; label: string; key: () => string }[] = [
  { id: "diario", label: "Diário", key: getDailyPeriodKey },
  { id: "semanal", label: "Semanal", key: getWeeklyPeriodKey },
  { id: "mensal", label: "Mensal", key: getMonthlyPeriodKey },
];

export default function RankingPage() {
  const { user } = useAuth();
  const { arena: arenaCatalog } = useExperienceCatalogBuckets();
  const [viewMode, setViewMode] = useState<RankingViewMode>("ranking");
  const [scope, setScope] = useState<RankingScope>("global");
  const [tab, setTab] = useState<RankingPeriod>("diario");
  const [selectedGameId, setSelectedGameId] = useState("ppt");
  const [visibleTop, setVisibleTop] = useState<(typeof TOP_OPTIONS)[number]>(5);
  const [list, setList] = useState<RankingEntry[]>([]);
  const [mine, setMine] = useState<RankingEntry | null>(null);
  const [prizeConfig, setPrizeConfig] = useState<NormalizedRankingPrizeConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const nextDefaultId = arenaCatalog[0]?.id ?? "ppt";
    if (!arenaCatalog.some((game) => game.id === selectedGameId)) {
      setSelectedGameId(nextDefaultId);
    }
    if (scope === "game" && arenaCatalog.length === 0) {
      setScope("global");
    }
  }, [arenaCatalog, scope, selectedGameId]);

  const selectedGame = useMemo(
    () => arenaCatalog.find((game) => game.id === selectedGameId) ?? arenaCatalog[0],
    [arenaCatalog, selectedGameId],
  );
  const rankingOptions = useMemo(
    () =>
      scope === "game"
        ? { scope: "game" as const, gameId: selectedGameId }
        : { scope: "global" as const },
    [scope, selectedGameId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const period = tabs.find((item) => item.id === tab)!;
    const key = period.key();
    try {
      const [top, myEntry] = await Promise.all([
        fetchTopRanking(tab, key, TOP_FETCH_LIMIT, rankingOptions),
        user ? fetchMyRankingEntry(tab, key, user.uid, rankingOptions) : Promise.resolve(null),
      ]);
      setList(top);
      setMine(myEntry);
    } finally {
      setLoading(false);
    }
  }, [rankingOptions, tab, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await fetchRankingPrizeConfig();
        if (!cancelled) setPrizeConfig(config);
      } catch {
        if (!cancelled) setPrizeConfig(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const myIndex = useMemo(() => {
    if (!user) return -1;
    return list.findIndex((entry) => entry.uid === user.uid);
  }, [list, user]);

  const myPosition = myIndex >= 0 ? myIndex + 1 : null;
  const visibleEntries = useMemo(() => list.slice(0, visibleTop), [list, visibleTop]);
  const prizePeriods = useMemo<RankingPrizePeriodConfig>(
    () =>
      scope === "game"
        ? prizeConfig?.byGame[selectedGameId] ?? createEmptyRankingPrizePeriodConfig()
        : prizeConfig?.global ?? createEmptyRankingPrizePeriodConfig(),
    [prizeConfig, scope, selectedGameId],
  );
  const ctaHref = scope === "game" && selectedGame ? selectedGame.href : ROUTES.jogos;
  const selectedScopeLabel = scope === "game" ? selectedGame?.title ?? "Confronto" : "Ranking geral";
  const currentPeriodLabel = tabs.find((item) => item.id === tab)?.label ?? tab;

  return (
    <div className="space-y-4 pb-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/70">
            Ranking premium
          </p>
          <h1 className="mt-0.5 text-[1.85rem] font-black leading-none tracking-tight text-white">
            Rankings
          </h1>
          <p className="mt-1 text-sm text-white/55">
            Acompanhe a classificação e veja os prêmios em uma aba separada.
          </p>
        </div>
        <Link
          href={ctaHref}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
        >
          Jogar
          <ChevronRight className="h-4 w-4" />
        </Link>
      </header>

      <section className="rounded-[1.6rem] border border-white/10 bg-slate-950/75 p-3.5 shadow-[0_0_42px_-24px_rgba(139,92,246,0.4)] sm:p-4">
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <FilterBlock label="Visualização">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1.5">
                {([
                  { id: "ranking", label: "Classificação", icon: Trophy },
                  { id: "prizes", label: "Prêmios", icon: Gift },
                ] as const).map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setViewMode(item.id)}
                      className={cn(
                      "flex min-h-[46px] min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition sm:text-sm",
                        viewMode === item.id
                          ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                          : "text-white/55 hover:bg-white/5",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </FilterBlock>

            <FilterBlock label="Tipo do ranking">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1.5">
                {([
                  { id: "global", label: "Geral" },
                  { id: "game", label: "Por confronto" },
                ] as const).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setScope(item.id)}
                    className={cn(
                      "min-h-[46px] min-w-0 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition sm:text-sm",
                      scope === item.id
                        ? "bg-white text-slate-950"
                        : "text-white/55 hover:bg-white/5",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </FilterBlock>
          </div>

          {viewMode === "ranking" ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
              <FilterBlock label="Período">
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/5 p-1.5">
                  {tabs.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTab(item.id)}
                      className={cn(
                        "min-h-[46px] min-w-0 rounded-xl px-2 py-2.5 text-[13px] font-semibold transition sm:px-3 sm:text-sm",
                        tab === item.id
                          ? "bg-white text-slate-950"
                          : "text-white/55 hover:bg-white/5",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </FilterBlock>

              <FilterBlock label="Top exibido">
                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <select
                    value={String(visibleTop)}
                    onChange={(e) =>
                      setVisibleTop(Number(e.target.value) as (typeof TOP_OPTIONS)[number])
                    }
                    className="min-h-[46px] w-full appearance-none rounded-xl border border-white/10 bg-black/20 py-2 pl-10 pr-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-400/30"
                  >
                    {TOP_OPTIONS.map((top) => (
                      <option key={top} value={top} className="bg-slate-950">
                        Top {top}
                      </option>
                    ))}
                  </select>
                </div>
              </FilterBlock>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
              Veja abaixo as faixas de prêmio configuradas para cada período.
            </div>
          )}
        </div>

        {scope === "game" && arenaCatalog.length > 0 ? (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {arenaCatalog.map((game) => (
              <button
                key={game.id}
                type="button"
                onClick={() => setSelectedGameId(game.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-2.5 text-sm font-semibold transition",
                  selectedGameId === game.id
                    ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.05]",
                )}
              >
                {game.title}
              </button>
            ))}
          </div>
        ) : scope === "game" ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/45">
            Nenhum confronto está classificado como arena no momento.
          </div>
        ) : null}
      </section>

      {viewMode === "ranking" ? (
        <>
          <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-3.5 sm:p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
              Seu resumo
            </p>

            <div className="mt-3 rounded-[1.2rem] border border-white/10 bg-slate-950/65 p-3.5">
              {mine ? (
                <div className="flex items-center gap-3">
                  <div
                    aria-label={mine.nome}
                    className="h-14 w-14 rounded-[20px] border border-white/10 bg-cover bg-center shadow-[0_0_30px_-16px_rgba(34,211,238,0.45)]"
                    style={{
                      backgroundImage: `url(${resolveAvatarUrl({
                        photoUrl: mine.foto,
                        name: mine.nome,
                        username: mine.username,
                        uid: mine.uid,
                      })})`,
                    }}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{mine.nome}</p>
                    <p className="mt-0.5 text-xs text-white/45">
                      {mine.username ? `@${mine.username}` : "continue jogando"}
                    </p>
                    <p className="mt-1 text-xs text-cyan-100/70">
                      {selectedScopeLabel} · {currentPeriodLabel}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-white/50">
                  Você ainda não entrou neste ranking.
                </div>
              )}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <CompactMetric label="Posição" value={myPosition != null ? `#${myPosition}` : "--"} />
              <CompactMetric label="Score" value={mine ? String(mine.score) : "--"} />
              <CompactMetric label="Vitórias" value={mine ? String(mine.vitorias) : "--"} />
              <CompactMetric label="Partidas" value={mine ? String(mine.partidas) : "--"} />
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-white/10 bg-slate-950/65 p-4 shadow-[0_0_42px_-24px_rgba(34,211,238,0.28)]">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Top {visibleTop}</h2>
                <p className="text-xs text-white/45">
                  {selectedScopeLabel} · {currentPeriodLabel}
                </p>
              </div>
              {myPosition != null && myPosition > visibleTop ? (
                <div className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
                  Sua posição real: #{myPosition}
                </div>
              ) : null}
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-white/45">
                Carregando ranking...
              </div>
            ) : visibleEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
                Ainda não há jogadores neste filtro. Jogue para aparecer aqui.
              </div>
            ) : (
              <RankingTable
                entries={visibleEntries}
                highlightUid={user?.uid}
                startRank={1}
                prizeTiers={[]}
                showPrizeColumn={false}
              />
            )}
          </section>
        </>
      ) : (
        <section className="space-y-4">
          <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-lg font-semibold text-white">Prêmios</h2>
            <p className="mt-1 text-sm text-white/55">
              {scope === "game"
                ? `Faixas do ranking de ${selectedGame?.title ?? "confronto selecionado"}.`
                : "Faixas do ranking geral por período."}
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {tabs.map((period) => (
              <PrizePeriodCard
                key={period.id}
                title={period.label}
                subtitle={scope === "game" ? selectedGame?.title ?? "Confronto" : "Ranking geral"}
                tiers={prizePeriods[period.id]}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FilterBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 pl-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
        {label}
      </p>
      {children}
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[74px] flex-col justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function PrizePeriodCard({
  title,
  subtitle,
  tiers,
}: {
  title: string;
  subtitle: string;
  tiers: RankingPrizeTier[];
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-4 shadow-[0_0_36px_-24px_rgba(139,92,246,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs text-white/45">{subtitle}</p>
        </div>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-100/85">
          {tiers.length} faixas
        </span>
      </div>

      {tiers.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
          Nenhum prêmio configurado neste período.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-[1.4rem] border border-amber-400/20 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_55%),linear-gradient(180deg,rgba(30,41,59,0.96),rgba(15,23,42,0.96))] px-4 py-4 shadow-[0_0_28px_-18px_rgba(245,158,11,0.45)]">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/80">
                <Crown className="h-3.5 w-3.5" />
                Destaque
              </span>
              <span className="text-xs font-semibold text-amber-100/75">
                {formatPrizeRangeLabel(tiers, 0)}
              </span>
            </div>
            <p className="mt-3 text-xl font-black tracking-tight text-white">
              {formatRankingPrize(tiers[0])}
            </p>
            <p className="mt-1 text-xs text-white/45">Melhor faixa deste período.</p>
          </div>

          <div className="grid gap-3">
            {tiers.slice(1).map((tier, index) => (
              <div
                key={`${title}-${tier.posicaoMax}-${index + 1}`}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">
                    {formatPrizeRangeLabel(tiers, index + 1)}
                  </p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/55">
                    Faixa {index + 2}
                  </span>
                </div>
                <p className="mt-2 text-sm text-cyan-100">{formatRankingPrize(tier)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatPrizeRangeLabel(tiers: RankingPrizeTier[], index: number) {
  const current = tiers[index];
  if (!current) return "Faixa";
  const start = index === 0 ? 1 : (tiers[index - 1]?.posicaoMax ?? 0) + 1;
  const end = current.posicaoMax;
  if (start === end) return `#${start}`;
  return `#${start} ao #${end}`;
}
