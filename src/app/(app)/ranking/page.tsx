"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useClanDashboard } from "@/hooks/useClanDashboard";
import { useExperienceCatalogBuckets } from "@/hooks/useExperienceCatalogBuckets";
import { RankingTable } from "@/modules/jogos";
import { ROUTES, routeClaPublico } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { resolveAvatarUrl } from "@/lib/users/avatar";
import {
  formatClanTime,
  resolveClanDailyBreakdown,
  resolveClanMonthlyBreakdown,
  resolveClanWeeklyBreakdown,
} from "@/lib/clan/ui";
import { resolveClanAvatarUrl } from "@/lib/clan/visuals";
import { fetchRankingPrizeConfig } from "@/services/ranking/rankingConfigService";
import { fetchTopRanking, fetchMyRankingEntry } from "@/services/ranking/rankingService";
import { fetchArenaOverallRanking } from "@/services/ranking/overallArenaRankingService";
import { subscribeClanRankingBoard } from "@/services/clans/clanService";
import {
  buildDefaultRankingPrizeConfig,
  createEmptyRankingPrizePeriodConfig,
  formatRankingPrize,
  getRankingPrizeForPosition,
  type NormalizedRankingPrizeConfig,
} from "@/lib/ranking/prizes";
import type {
  ArenaOverallRankingBucket,
  ArenaOverallRankingResponse,
  RankingEntry,
  RankingPeriod,
} from "@/types/ranking";
import type { Clan } from "@/types/clan";
import type { RankingPrizePeriodConfig, RankingPrizeTier } from "@/types/systemConfig";
import { getDailyPeriodKey, getMonthlyPeriodKey, getWeeklyPeriodKey } from "@/utils/date";
import {
  BarChart3,
  ChevronRight,
  Crown,
  Filter,
  Gift,
  Swords,
  Trophy,
  Users,
} from "lucide-react";

type RankingViewMode = "ranking" | "prizes";
type RankingSelectionId =
  | ""
  | "total_ppt"
  | "total_quiz"
  | "total_reaction_tap"
  | "total_clan"
  | "daily_ppt"
  | "daily_quiz"
  | "daily_reaction_tap"
  | "daily_clan"
  | "weekly_ppt"
  | "weekly_quiz"
  | "weekly_reaction_tap"
  | "weekly_clan"
  | "monthly_ppt"
  | "monthly_quiz"
  | "monthly_reaction_tap"
  | "monthly_clan";
type PrizeSelectionId =
  | ""
  | "daily_ppt"
  | "daily_quiz"
  | "daily_reaction_tap"
  | "weekly_ppt"
  | "weekly_quiz"
  | "weekly_reaction_tap"
  | "weekly_clan"
  | "monthly_ppt"
  | "monthly_quiz"
  | "monthly_reaction_tap";
type RankedClanEntry = Clan & {
  position: number;
  totalScore: number;
  totalWins: number;
  totalAds: number;
  dailyScore: number;
  dailyWins: number;
  dailyAds: number;
  weeklyScore: number;
  weeklyWins: number;
  weeklyAds: number;
  monthlyScore: number;
  monthlyWins: number;
  monthlyAds: number;
};
type RankedClanComparable = Omit<RankedClanEntry, "position">;
type ClanRankingMode = "total" | "daily" | "weekly" | "monthly";

const TOP_FETCH_LIMIT = 100;
const TOP_OPTIONS = [5, 10, 25, 50, 100] as const;
const PERIOD_TABS: Array<{ id: RankingPeriod; label: string; key: () => string }> = [
  { id: "diario", label: "Diário", key: getDailyPeriodKey },
  { id: "semanal", label: "Semanal", key: getWeeklyPeriodKey },
  { id: "mensal", label: "Mensal", key: getMonthlyPeriodKey },
];
const RANKING_SELECT_GROUPS: Array<{
  label: string;
  options: Array<{ id: RankingSelectionId; label: string }>;
}> = [
  {
    label: "TOTAL",
    options: [
      { id: "total_ppt", label: "PPT" },
      { id: "total_quiz", label: "QUIZ" },
      { id: "total_reaction_tap", label: "REACTION" },
      { id: "total_clan", label: "CLÃ" },
    ],
  },
  {
    label: "DIÁRIO",
    options: [
      { id: "daily_ppt", label: "PPT" },
      { id: "daily_quiz", label: "QUIZ" },
      { id: "daily_reaction_tap", label: "REACTION" },
      { id: "daily_clan", label: "CLÃ" },
    ],
  },
  {
    label: "SEMANAL",
    options: [
      { id: "weekly_ppt", label: "PPT" },
      { id: "weekly_quiz", label: "QUIZ" },
      { id: "weekly_reaction_tap", label: "REACTION" },
      { id: "weekly_clan", label: "CLÃ" },
    ],
  },
  {
    label: "MENSAL",
    options: [
      { id: "monthly_ppt", label: "PPT" },
      { id: "monthly_quiz", label: "QUIZ" },
      { id: "monthly_reaction_tap", label: "REACTION" },
      { id: "monthly_clan", label: "CLÃ" },
    ],
  },
];
const PRIZE_SELECT_GROUPS: Array<{
  label: string;
  options: Array<{ id: PrizeSelectionId; label: string }>;
}> = [
  {
    label: "DIÁRIO",
    options: [
      { id: "daily_ppt", label: "PPT" },
      { id: "daily_quiz", label: "QUIZ" },
      { id: "daily_reaction_tap", label: "REACTION" },
    ],
  },
  {
    label: "SEMANAL",
    options: [
      { id: "weekly_ppt", label: "PPT" },
      { id: "weekly_quiz", label: "QUIZ" },
      { id: "weekly_reaction_tap", label: "REACTION" },
      { id: "weekly_clan", label: "CLÃ" },
    ],
  },
  {
    label: "MENSAL",
    options: [
      { id: "monthly_ppt", label: "PPT" },
      { id: "monthly_quiz", label: "QUIZ" },
      { id: "monthly_reaction_tap", label: "REACTION" },
    ],
  },
];

export default function RankingPage() {
  const { user } = useAuth();
  const { hasClan, clan: myClan } = useClanDashboard();
  const { arena: arenaCatalog } = useExperienceCatalogBuckets();
  const [viewMode, setViewMode] = useState<RankingViewMode>("ranking");
  const [visibleTop, setVisibleTop] = useState<(typeof TOP_OPTIONS)[number]>(5);
  const [pendingRankingSelection, setPendingRankingSelection] =
    useState<RankingSelectionId>("");
  const [activeRankingSelection, setActiveRankingSelection] =
    useState<RankingSelectionId>("");
  const [pendingPrizeSelection, setPendingPrizeSelection] =
    useState<PrizeSelectionId>("");
  const [activePrizeSelection, setActivePrizeSelection] =
    useState<PrizeSelectionId>("");
  const [overallRanking, setOverallRanking] = useState<ArenaOverallRankingResponse | null>(null);
  const [overallLoading, setOverallLoading] = useState(true);
  const [rankingList, setRankingList] = useState<RankingEntry[]>([]);
  const [rankingMine, setRankingMine] = useState<RankingEntry | null>(null);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [prizeConfig, setPrizeConfig] = useState<NormalizedRankingPrizeConfig>(
    buildDefaultRankingPrizeConfig(),
  );
  const [clanBoard, setClanBoard] = useState<Clan[]>([]);
  const [clanLoading, setClanLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadOverallRanking() {
      if (!user?.uid) {
        if (!cancelled) {
          setOverallRanking(null);
          setOverallLoading(false);
        }
        return;
      }
      setOverallLoading(true);
      try {
        const result = await fetchArenaOverallRanking(TOP_FETCH_LIMIT);
        if (!cancelled) {
          setOverallRanking(result);
        }
      } finally {
        if (!cancelled) {
          setOverallLoading(false);
        }
      }
    }
    void loadOverallRanking();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    let cancelled = false;
    const selection = parseArenaSelection(activeRankingSelection);
    async function loadGameRanking() {
      if (!selection || selection.mode === "total") {
        if (!cancelled) {
          setRankingList([]);
          setRankingMine(null);
          setRankingLoading(false);
        }
        return;
      }
      const period = PERIOD_TABS.find((item) => item.id === selection.period)!;
      const periodKey = period.key();
      setRankingLoading(true);
      try {
        const [top, myEntry] = await Promise.all([
          fetchTopRanking(selection.period!, periodKey, TOP_FETCH_LIMIT, {
            scope: "game",
            gameId: selection.gameId,
          }),
          user
            ? fetchMyRankingEntry(selection.period!, periodKey, user.uid, {
                scope: "game",
                gameId: selection.gameId,
              })
            : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setRankingList(top);
          setRankingMine(myEntry);
        }
      } finally {
        if (!cancelled) {
          setRankingLoading(false);
        }
      }
    }
    void loadGameRanking();
    return () => {
      cancelled = true;
    };
  }, [activeRankingSelection, user]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const config = await fetchRankingPrizeConfig();
        if (!cancelled) setPrizeConfig(config);
      } catch {
        if (!cancelled) setPrizeConfig(buildDefaultRankingPrizeConfig());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeClanRankingBoard((nextBoard) => {
      setClanBoard(nextBoard);
      setClanLoading(false);
    });
    return unsubscribe;
  }, []);

  const activeRankingGameSelection = useMemo(
    () => parseArenaSelection(activeRankingSelection),
    [activeRankingSelection],
  );
  const activePrizeGameSelection = useMemo(
    () => parseArenaSelection(activePrizeSelection),
    [activePrizeSelection],
  );
  const selectedRankingGame = useMemo(
    () =>
      activeRankingGameSelection
        ? arenaCatalog.find((game) => game.id === activeRankingGameSelection.gameId) ?? null
        : null,
    [activeRankingGameSelection, arenaCatalog],
  );
  const selectedPrizeGame = useMemo(
    () =>
      activePrizeGameSelection
        ? arenaCatalog.find((game) => game.id === activePrizeGameSelection.gameId) ?? null
        : null,
    [activePrizeGameSelection, arenaCatalog],
  );
  const selectedPrizeGameConfig = useMemo<RankingPrizePeriodConfig>(
    () =>
      activePrizeGameSelection
        ? prizeConfig.byGame[activePrizeGameSelection.gameId] ?? createEmptyRankingPrizePeriodConfig()
        : createEmptyRankingPrizePeriodConfig(),
    [activePrizeGameSelection, prizeConfig],
  );
  const rankingEntries = useMemo(() => rankingList.slice(0, visibleTop), [rankingList, visibleTop]);
  const rankingMyPosition = useMemo(() => {
    if (!user?.uid) return null;
    const index = rankingList.findIndex((entry) => entry.uid === user.uid);
    return index >= 0 ? index + 1 : null;
  }, [rankingList, user?.uid]);
  const currentRankingPeriodLabel =
    activeRankingGameSelection?.mode === "period"
      ? PERIOD_TABS.find((item) => item.id === activeRankingGameSelection.period)?.label ?? ""
      : "";
  const currentRankingPrize = useMemo(() => {
    if (activeRankingGameSelection?.mode !== "period" || rankingMyPosition == null) return null;
    const period = activeRankingGameSelection.period as RankingPeriod;
    const gamePrizeConfig =
      prizeConfig.byGame[activeRankingGameSelection.gameId] ?? createEmptyRankingPrizePeriodConfig();
    return getRankingPrizeForPosition(gamePrizeConfig[period], rankingMyPosition);
  }, [activeRankingGameSelection, prizeConfig, rankingMyPosition]);
  const currentPrizePeriodLabel =
    activePrizeGameSelection?.mode === "period"
      ? PERIOD_TABS.find((item) => item.id === activePrizeGameSelection.period)?.label ?? ""
      : "";
  const currentPrizeTiers = useMemo(() => {
    if (activePrizeGameSelection?.mode !== "period") return [];
    const period = activePrizeGameSelection.period as RankingPeriod;
    return selectedPrizeGameConfig[period];
  }, [activePrizeGameSelection, selectedPrizeGameConfig]);
  const selectedOverallBucket = useMemo<ArenaOverallRankingBucket | null>(() => {
    if (!overallRanking || activeRankingGameSelection?.mode !== "total") return null;
    return overallRanking.byGame[activeRankingGameSelection.gameId];
  }, [overallRanking, activeRankingGameSelection]);
  const overallEntries = selectedOverallBucket?.entries.slice(0, visibleTop) ?? [];
  const overallMyEntry = selectedOverallBucket?.myEntry ?? null;
  const overallMyPosition = selectedOverallBucket?.myPosition ?? null;

  const clanRankings = useMemo(() => {
    const base = clanBoard.map((item) => {
      const daily = resolveClanDailyBreakdown(item);
      const weekly = resolveClanWeeklyBreakdown(item);
      const monthly = resolveClanMonthlyBreakdown(item);
      return {
        ...item,
        totalScore: Math.max(0, Math.floor(Number(item.scoreTotal) || 0)),
        totalWins: Math.max(0, Math.floor(Number(item.scoreTotalWins) || 0)),
        totalAds: Math.max(0, Math.floor(Number(item.scoreTotalAds) || 0)),
        dailyScore: daily.score,
        dailyWins: daily.wins,
        dailyAds: daily.ads,
        weeklyScore: weekly.score,
        weeklyWins: weekly.wins,
        weeklyAds: weekly.ads,
        monthlyScore: monthly.score,
        monthlyWins: monthly.wins,
        monthlyAds: monthly.ads,
      };
    });
    const total = base
      .filter((item) => item.totalScore > 0)
      .sort(compareClanTotalEntry)
      .map((item, index) => ({ ...item, position: index + 1 }));
    const daily = base
      .filter((item) => item.dailyScore > 0)
      .sort(compareClanDailyEntry)
      .map((item, index) => ({ ...item, position: index + 1 }));
    const weekly = base
      .filter((item) => item.weeklyScore > 0)
      .sort(compareClanWeeklyEntry)
      .map((item, index) => ({ ...item, position: index + 1 }));
    const monthly = base
      .filter((item) => item.monthlyScore > 0)
      .sort(compareClanMonthlyEntry)
      .map((item, index) => ({ ...item, position: index + 1 }));
    return { total, daily, weekly, monthly };
  }, [clanBoard]);
  const myClanTotalEntry = useMemo(
    () => clanRankings.total.find((item) => item.id === myClan?.id) ?? null,
    [clanRankings.total, myClan?.id],
  );
  const myClanDailyEntry = useMemo(
    () => clanRankings.daily.find((item) => item.id === myClan?.id) ?? null,
    [clanRankings.daily, myClan?.id],
  );
  const myClanWeeklyEntry = useMemo(
    () => clanRankings.weekly.find((item) => item.id === myClan?.id) ?? null,
    [clanRankings.weekly, myClan?.id],
  );
  const myClanMonthlyEntry = useMemo(
    () => clanRankings.monthly.find((item) => item.id === myClan?.id) ?? null,
    [clanRankings.monthly, myClan?.id],
  );
  const currentCtaHref = selectedRankingGame?.href ?? selectedPrizeGame?.href ?? ROUTES.jogos;

  return (
    <div className="space-y-5 pb-6">
      <header className="game-panel flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <p className="game-kicker">Comando de ranking</p>
          <h1 className="mt-1 bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-[1.9rem] font-black leading-none tracking-tight text-transparent">
            Central de ranking
          </h1>
          <p className="mt-1 text-sm text-white/58">Placares da arena, ciclos e clãs num só painel.</p>
        </div>
        <Link
          href={currentCtaHref}
          className="game-panel-soft inline-flex min-h-[46px] items-center gap-2 rounded-[1rem] border-cyan-400/20 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/35"
        >
          Jogar
          <ChevronRight className="h-4 w-4" />
        </Link>
      </header>

      <section className="game-panel p-3.5 shadow-[0_0_42px_-24px_rgba(139,92,246,0.4)] sm:p-4">
        <div className="space-y-3">
          <FilterBlock label="Visualização">
            <div className="game-panel-soft grid grid-cols-2 gap-2 rounded-[1.25rem] p-1.5">
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
                      "flex min-h-[46px] min-w-0 items-center justify-center gap-2 rounded-[1rem] px-3 py-2.5 text-[13px] font-semibold transition sm:text-sm",
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

          {viewMode === "ranking" ? (
            <div className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)_92px]">
              <FilterBlock label="Top exibido">
                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <select
                    value={String(visibleTop)}
                    onChange={(e) =>
                      setVisibleTop(Number(e.target.value) as (typeof TOP_OPTIONS)[number])
                    }
                    className="game-input w-full appearance-none py-2 pl-10 pr-3 text-sm font-semibold"
                  >
                    {TOP_OPTIONS.map((top) => (
                      <option key={top} value={top} className="bg-slate-950">
                        {top}
                      </option>
                    ))}
                  </select>
                </div>
              </FilterBlock>

              <FilterBlock label="Escolher ranking">
                <select
                  value={pendingRankingSelection}
                  onChange={(e) => setPendingRankingSelection(e.target.value as RankingSelectionId)}
                  className="game-input w-full px-3 py-2 text-sm font-semibold"
                >
                  <option value="" className="bg-slate-950">
                    Selecione:
                  </option>
                  {RANKING_SELECT_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((option) => (
                        <option key={option.id} value={option.id} className="bg-slate-950">
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </FilterBlock>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setActiveRankingSelection(pendingRankingSelection)}
                  disabled={!pendingRankingSelection}
                  className="game-panel-soft min-h-[46px] w-full rounded-[1rem] border-cyan-400/18 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/35"
                >
                  Ver
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_92px]">
              <FilterBlock label="Escolher premiação">
                <select
                  value={pendingPrizeSelection}
                  onChange={(e) => setPendingPrizeSelection(e.target.value as PrizeSelectionId)}
                  className="game-input w-full px-3 py-2 text-sm font-semibold"
                >
                  <option value="" className="bg-slate-950">
                    Selecione:
                  </option>
                  {PRIZE_SELECT_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((option) => (
                        <option key={option.id} value={option.id} className="bg-slate-950">
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </FilterBlock>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setActivePrizeSelection(pendingPrizeSelection)}
                  disabled={!pendingPrizeSelection}
                  className="game-panel-soft min-h-[46px] w-full rounded-[1rem] border-cyan-400/18 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/35"
                >
                  Ver
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {viewMode === "ranking" ? (
        activeRankingSelection === "total_clan" ? (
          <section className="game-panel p-4 shadow-[0_0_42px_-24px_rgba(245,158,11,0.25)]">
            <SectionHeading
              icon={<Users className="h-4 w-4" />}
              eyebrow="Ranking total"
              title="CLÃ"
              description="Pontuação total acumulada do clã."
            />

            <div className="mt-4">
              <ClanRankingPanel
                title="Clã · Geral"
                subtitle="Pontuação total acumulada do clã."
                entries={clanRankings.total}
                loading={clanLoading}
                myEntry={myClanTotalEntry}
                hasMyClan={hasClan}
                highlightClanId={myClan?.id ?? null}
                visibleTop={visibleTop}
                mode="total"
              />
            </div>
          </section>
        ) : activeRankingSelection === "daily_clan" ? (
          <section className="game-panel p-4 shadow-[0_0_42px_-24px_rgba(245,158,11,0.25)]">
            <SectionHeading
              icon={<Users className="h-4 w-4" />}
              eyebrow="Ranking diário"
              title="CLÃ"
              description="Pontuação acumulada no dia atual para o clã."
            />

            <div className="mt-4">
              <ClanRankingPanel
                title="Clã · Diário"
                subtitle="Pontuação do dia atual do clã."
                entries={clanRankings.daily}
                loading={clanLoading}
                myEntry={myClanDailyEntry}
                hasMyClan={hasClan}
                highlightClanId={myClan?.id ?? null}
                visibleTop={visibleTop}
                mode="daily"
              />
            </div>
          </section>
        ) : activeRankingSelection === "weekly_clan" ? (
          <section className="game-panel p-4 shadow-[0_0_42px_-24px_rgba(245,158,11,0.25)]">
            <SectionHeading
              icon={<Users className="h-4 w-4" />}
              eyebrow="Ranking semanal"
              title="CLÃ"
              description="Pontuação da semana atual com faixa rateada por contribuição."
            />

            <div className="mt-4">
              <ClanRankingPanel
                title="Clã · Semanal"
                subtitle="Pontuação da semana atual com faixa rateada por contribuição."
                entries={clanRankings.weekly}
                loading={clanLoading}
                myEntry={myClanWeeklyEntry}
                hasMyClan={hasClan}
                highlightClanId={myClan?.id ?? null}
                visibleTop={visibleTop}
                mode="weekly"
                prizeTiers={prizeConfig.clans.semanal}
              />
            </div>
          </section>
        ) : activeRankingSelection === "monthly_clan" ? (
          <section className="game-panel p-4 shadow-[0_0_42px_-24px_rgba(245,158,11,0.25)]">
            <SectionHeading
              icon={<Users className="h-4 w-4" />}
              eyebrow="Ranking mensal"
              title="CLÃ"
              description="Pontuação acumulada no mês atual para o clã."
            />

            <div className="mt-4">
              <ClanRankingPanel
                title="Clã · Mensal"
                subtitle="Pontuação do mês atual do clã."
                entries={clanRankings.monthly}
                loading={clanLoading}
                myEntry={myClanMonthlyEntry}
                hasMyClan={hasClan}
                highlightClanId={myClan?.id ?? null}
                visibleTop={visibleTop}
                mode="monthly"
              />
            </div>
          </section>
        ) : activeRankingGameSelection?.mode === "total" ? (
          <section className="game-panel p-4 shadow-[0_0_42px_-24px_rgba(34,211,238,0.28)]">
            <SectionHeading
              icon={<BarChart3 className="h-4 w-4" />}
              eyebrow="Ranking total"
              title={selectedRankingGame?.title ?? activeRankingGameSelection.gameId.toUpperCase()}
              description="Histórico total do confronto selecionado, sem dividir por período."
            />

            <div className="mt-4 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
              <RankingSummaryCard
                title="Seu resumo"
                subtitle={`${selectedRankingGame?.title ?? activeRankingGameSelection.gameId} · Total`}
                entry={overallMyEntry}
                position={overallMyPosition}
                emptyText="Você ainda não entrou no ranking total deste confronto."
              />
              <RankingTableCard
                title={`Top ${visibleTop}`}
                subtitle={`${selectedRankingGame?.title ?? activeRankingGameSelection.gameId} · Total`}
                entries={overallEntries}
                loading={overallLoading}
                highlightUid={user?.uid}
                actualPosition={overallMyPosition}
                visibleTop={visibleTop}
                emptyText="Ainda não há histórico suficiente neste ranking total."
              />
            </div>
          </section>
        ) : activeRankingGameSelection?.mode === "period" ? (
          <section className="game-panel p-4 shadow-[0_0_42px_-24px_rgba(34,211,238,0.28)]">
            <SectionHeading
              icon={<Swords className="h-4 w-4" />}
              eyebrow={`Ranking ${currentRankingPeriodLabel.toLowerCase()}`}
              title={selectedRankingGame?.title ?? activeRankingGameSelection.gameId.toUpperCase()}
              description="A classificação mostra apenas o confronto e o período selecionados."
            />

            <div className="mt-4 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
              <RankingSummaryCard
                title="Seu resumo"
                subtitle={`${selectedRankingGame?.title ?? activeRankingGameSelection.gameId} · ${currentRankingPeriodLabel}`}
                entry={rankingMine}
                position={rankingMyPosition}
                prizeLabel={
                  rankingMyPosition != null ? `Faixa atual: ${formatRankingPrize(currentRankingPrize)}` : null
                }
                emptyText="Você ainda não entrou neste ranking."
              />
              <RankingTableCard
                title={`Top ${visibleTop}`}
                subtitle={`${selectedRankingGame?.title ?? activeRankingGameSelection.gameId} · ${currentRankingPeriodLabel}`}
                entries={rankingEntries}
                loading={rankingLoading}
                highlightUid={user?.uid}
                actualPosition={rankingMyPosition}
                visibleTop={visibleTop}
                emptyText="Ainda não há jogadores neste ranking."
              />
            </div>
          </section>
        ) : (
          <section className="game-panel p-4">
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
              Selecione um ranking para visualizar.
            </div>
          </section>
        )
      ) : activePrizeSelection === "weekly_clan" ? (
        <section className="space-y-4">
          <SectionHeading
            icon={<Users className="h-4 w-4" />}
            eyebrow="Prêmio do clã"
            title="CLÃ"
            description="Faixa semanal do clã com rateio por contribuição."
          />

          <div className="max-w-md">
            <PrizePeriodCard
              title="Semanal"
              subtitle="Clã · rateio por contribuição"
              tiers={prizeConfig.clans.semanal}
            />
          </div>
        </section>
      ) : activePrizeGameSelection ? (
        <section className="space-y-4">
          <SectionHeading
            icon={<Gift className="h-4 w-4" />}
            eyebrow={`Prêmios ${currentPrizePeriodLabel.toLowerCase()}`}
            title={selectedPrizeGame?.title ?? activePrizeGameSelection.gameId.toUpperCase()}
            description="Faixas de prêmio do confronto e do período selecionados."
          />

          <div className="max-w-md">
            <PrizePeriodCard
              title={currentPrizePeriodLabel}
              subtitle={selectedPrizeGame?.title ?? activePrizeGameSelection.gameId}
              tiers={currentPrizeTiers}
            />
          </div>
        </section>
      ) : (
        <section className="game-panel p-4">
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
            Selecione uma premiação para visualizar.
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeading({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="game-kicker">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-white/58">{description}</p>
      </div>
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400/18 bg-cyan-500/10 text-cyan-100/80">
        {icon}
      </span>
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
      <p className="mb-2 pl-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/55">
        {label}
      </p>
      {children}
    </div>
  );
}

function RankingSummaryCard({
  title,
  subtitle,
  entry,
  position,
  prizeLabel,
  emptyText,
}: {
  title: string;
  subtitle: string;
  entry: RankingEntry | null;
  position: number | null;
  prizeLabel?: string | null;
  emptyText: string;
}) {
  return (
    <div className="game-panel p-3">
      <p className="game-kicker text-cyan-100/58">{title}</p>
      <div className="game-panel-soft mt-3 rounded-[1.1rem] p-3">
        {entry ? (
          <div className="flex items-center gap-3">
            <div
              aria-label={entry.nome}
              className="h-12 w-12 rounded-[18px] border border-white/10 bg-cover bg-center shadow-[0_0_30px_-16px_rgba(34,211,238,0.45)]"
              style={{
                backgroundImage: `url(${resolveAvatarUrl({
                  photoUrl: entry.foto,
                  name: entry.nome,
                  username: entry.username,
                  uid: entry.uid,
                })})`,
              }}
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{entry.nome}</p>
              <p className="mt-0.5 text-xs text-white/45">
                {entry.username ? `@${entry.username}` : "continue jogando"}
              </p>
              <p className="mt-1 text-xs text-cyan-100/70">{subtitle}</p>
              {prizeLabel ? <p className="mt-1 text-[11px] text-amber-100/80">{prizeLabel}</p> : null}
            </div>
          </div>
        ) : (
          <div className="game-panel-soft rounded-2xl border-dashed px-3 py-4 text-sm text-white/50">
            {emptyText}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <CompactMetric label="Posição" value={position != null ? `#${position}` : "--"} />
        <CompactMetric label="Vitórias" value={entry ? String(entry.vitorias) : "--"} />
        <CompactMetric label="Partidas" value={entry ? String(entry.partidas) : "--"} />
      </div>
    </div>
  );
}

function RankingTableCard({
  title,
  subtitle,
  entries,
  loading,
  highlightUid,
  actualPosition,
  visibleTop,
  emptyText,
}: {
  title: string;
  subtitle: string;
  entries: RankingEntry[];
  loading: boolean;
  highlightUid?: string;
  actualPosition: number | null;
  visibleTop: number;
  emptyText: string;
}) {
  return (
    <div className="game-panel p-3 sm:p-4 shadow-[0_0_42px_-24px_rgba(34,211,238,0.28)]">
      <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2 sm:mb-3 sm:gap-3">
        <div>
          <h3 className="text-base font-semibold text-white sm:text-lg">{title}</h3>
          <p className="mt-0.5 text-[11px] text-white/52 sm:text-xs">{subtitle}</p>
        </div>
        {actualPosition != null && actualPosition > visibleTop ? (
          <div className="game-chip border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100 sm:px-3 sm:text-xs">
            Posição real: #{actualPosition}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="game-panel-soft rounded-2xl px-4 py-10 text-center text-sm text-white/45">
          Carregando ranking...
        </div>
      ) : entries.length === 0 ? (
        <div className="game-panel-soft rounded-2xl border-dashed px-4 py-8 text-center text-sm text-white/45">
          {emptyText}
        </div>
      ) : (
        <RankingTable
          entries={entries}
          highlightUid={highlightUid}
          startRank={1}
          prizeTiers={[]}
          showPrizeColumn={false}
        />
      )}
    </div>
  );
}

function ClanRankingPanel({
  title,
  subtitle,
  entries,
  loading,
  myEntry,
  hasMyClan,
  highlightClanId,
  visibleTop,
  mode,
  prizeTiers = [],
}: {
  title: string;
  subtitle: string;
  entries: RankedClanEntry[];
  loading: boolean;
  myEntry: RankedClanEntry | null;
  hasMyClan: boolean;
  highlightClanId: string | null;
  visibleTop: number;
  mode: ClanRankingMode;
  prizeTiers?: RankingPrizeTier[];
}) {
  return (
    <div className="game-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs text-white/52">{subtitle}</p>
        </div>
        <span className="game-chip">
          Top {visibleTop}
        </span>
      </div>

      <div className="game-panel-soft mt-3 rounded-[1.2rem] p-3.5">
        {myEntry ? (
          <Link href={routeClaPublico(myEntry.id)} className="flex items-center gap-3">
            <div
              aria-label={myEntry.name}
              className="h-14 w-14 rounded-[20px] border border-white/10 bg-cover bg-center shadow-[0_0_30px_-16px_rgba(34,211,238,0.45)]"
              style={{ backgroundImage: `url(${resolveClanAvatarUrl(myEntry)})` }}
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{myEntry.name}</p>
              <p className="mt-0.5 text-xs text-white/45">#{myEntry.position}</p>
              <p className="mt-1 text-xs text-cyan-100/70">{formatClanStats(myEntry, mode)}</p>
            </div>
          </Link>
        ) : (
          <div className="game-panel-soft rounded-2xl border-dashed px-3 py-4 text-sm text-white/50">
            {hasMyClan
              ? mode === "daily"
                ? "Seu clã ainda não pontuou hoje."
                : mode === "weekly"
                  ? "Seu clã ainda não pontuou nesta semana."
                  : mode === "monthly"
                    ? "Seu clã ainda não pontuou neste mês."
                    : "Seu clã ainda não entrou no ranking geral."
              : "Entre em um clã para acompanhar sua posição por aqui."}
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
          Carregando clãs...
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
          Nenhum clã entrou neste ranking ainda.
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {entries.slice(0, visibleTop).map((entry) => (
            <ClanRankingRow
              key={`${mode}-${entry.id}`}
              entry={entry}
              highlight={Boolean(highlightClanId && entry.id === highlightClanId)}
              mode={mode}
              prizeLabel={
                mode === "weekly"
                  ? formatRankingPrize(getRankingPrizeForPosition(prizeTiers, entry.position))
                  : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ClanRankingRow({
  entry,
  highlight,
  mode,
  prizeLabel,
}: {
  entry: RankedClanEntry;
  highlight: boolean;
  mode: ClanRankingMode;
  prizeLabel: string | null;
}) {
  return (
    <Link
      href={routeClaPublico(entry.id)}
      className={cn(
        "game-panel-soft block rounded-[1.2rem] p-3 transition",
        highlight
          ? "border-amber-400/35 ring-1 ring-amber-400/40"
          : "hover:border-white/20 hover:bg-white/[0.04]",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-sm font-black text-white/75">
          #{entry.position}
        </div>
        <div
          className="h-12 w-12 shrink-0 rounded-[18px] border border-white/10 bg-cover bg-center"
          style={{ backgroundImage: `url("${resolveClanAvatarUrl(entry)}")` }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-white">{entry.name}</p>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/65">
              {entry.tag}
            </span>
          </div>
          <p className="mt-1 text-xs text-white/45">{formatClanStats(entry, mode)}</p>
          <p className="mt-1 text-[11px] text-white/35">
            {entry.memberCount}/{entry.maxMembers} membros · {formatClanCatalogActivity(entry)}
          </p>
          {prizeLabel ? (
            <p className="mt-1 text-[11px] font-semibold text-amber-100/80">
              Faixa semanal: {prizeLabel}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="game-panel-soft flex min-h-[60px] flex-col justify-between rounded-[1rem] px-2.5 py-2 text-center">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-100/58">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-none text-white">{value}</p>
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
    <div className="game-panel p-4 shadow-[0_0_36px_-24px_rgba(139,92,246,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs text-white/52">{subtitle}</p>
        </div>
        <span className="game-chip border-cyan-400/20 bg-cyan-500/10 text-cyan-100/85">
          {tiers.length} faixas
        </span>
      </div>

      {tiers.length === 0 ? (
        <div className="game-panel-soft mt-4 rounded-2xl border-dashed px-4 py-8 text-center text-sm text-white/45">
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
                className="game-panel-soft rounded-2xl px-4 py-3"
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

function parseArenaSelection(
  selection: RankingSelectionId | PrizeSelectionId,
): {
  mode: "total" | "period";
  period?: RankingPeriod;
  gameId: "ppt" | "quiz" | "reaction_tap";
} | null {
  if (!selection) return null;
  const parts = selection.split("_");
  if (parts.includes("clan")) return null;
  const [periodRaw, gameRaw, maybeTap] = parts;
  const gameId =
    gameRaw === "reaction" ? "reaction_tap" : maybeTap === "tap" ? "reaction_tap" : gameRaw;
  if (gameId !== "ppt" && gameId !== "quiz" && gameId !== "reaction_tap") return null;
  if (periodRaw === "total") {
    return { mode: "total", gameId };
  }
  const period =
    periodRaw === "daily" ? "diario" : periodRaw === "weekly" ? "semanal" : "mensal";
  return { mode: "period", period, gameId };
}

function compareClanTotalEntry(a: RankedClanComparable, b: RankedClanComparable): number {
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
  if (b.totalAds !== a.totalAds) return b.totalAds - a.totalAds;
  if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
  const activityDiff = clanActivityMs(b) - clanActivityMs(a);
  if (activityDiff !== 0) return activityDiff;
  return a.name.localeCompare(b.name, "pt-BR");
}

function compareClanWeeklyEntry(a: RankedClanComparable, b: RankedClanComparable): number {
  if (b.weeklyScore !== a.weeklyScore) return b.weeklyScore - a.weeklyScore;
  if (b.weeklyWins !== a.weeklyWins) return b.weeklyWins - a.weeklyWins;
  if (b.weeklyAds !== a.weeklyAds) return b.weeklyAds - a.weeklyAds;
  if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
  const activityDiff = clanActivityMs(b) - clanActivityMs(a);
  if (activityDiff !== 0) return activityDiff;
  return a.name.localeCompare(b.name, "pt-BR");
}

function compareClanDailyEntry(a: RankedClanComparable, b: RankedClanComparable): number {
  if (b.dailyScore !== a.dailyScore) return b.dailyScore - a.dailyScore;
  if (b.dailyWins !== a.dailyWins) return b.dailyWins - a.dailyWins;
  if (b.dailyAds !== a.dailyAds) return b.dailyAds - a.dailyAds;
  if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
  const activityDiff = clanActivityMs(b) - clanActivityMs(a);
  if (activityDiff !== 0) return activityDiff;
  return a.name.localeCompare(b.name, "pt-BR");
}

function compareClanMonthlyEntry(a: RankedClanComparable, b: RankedClanComparable): number {
  if (b.monthlyScore !== a.monthlyScore) return b.monthlyScore - a.monthlyScore;
  if (b.monthlyWins !== a.monthlyWins) return b.monthlyWins - a.monthlyWins;
  if (b.monthlyAds !== a.monthlyAds) return b.monthlyAds - a.monthlyAds;
  if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
  const activityDiff = clanActivityMs(b) - clanActivityMs(a);
  if (activityDiff !== 0) return activityDiff;
  return a.name.localeCompare(b.name, "pt-BR");
}

function formatClanStats(entry: RankedClanEntry, mode: ClanRankingMode) {
  if (mode === "daily") {
    return `${entry.dailyScore} pts hoje · ${entry.dailyWins} vitórias · ${entry.dailyAds} anúncios`;
  }
  if (mode === "weekly") {
    return `${entry.weeklyScore} pts · ${entry.weeklyWins} vitórias · ${entry.weeklyAds} anúncios`;
  }
  if (mode === "monthly") {
    return `${entry.monthlyScore} pts no mês · ${entry.monthlyWins} vitórias · ${entry.monthlyAds} anúncios`;
  }
  return `${entry.totalScore} pts totais · ${entry.totalWins} vitórias · ${entry.totalAds} anúncios`;
}

function timestampToMs(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  return 0;
}

function clanActivityMs(item: Clan): number {
  return timestampToMs(item.lastMessageAt ?? item.updatedAt);
}

function formatClanCatalogActivity(item: Clan): string {
  if (item.lastMessageAt) return `Chat às ${formatClanTime(item.lastMessageAt)}`;
  if (item.lastScoreAt) return `Pontuou às ${formatClanTime(item.lastScoreAt)}`;
  if (item.updatedAt) return `Atualizado às ${formatClanTime(item.updatedAt)}`;
  return "Sem atividade";
}
