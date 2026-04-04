"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchTopRanking, fetchMyRankingEntry } from "@/services/ranking/rankingService";
import { TopPodium, RankingTable } from "@/modules/jogos";
import type { RankingEntry, RankingPeriod } from "@/types/ranking";
import { getDailyPeriodKey, getMonthlyPeriodKey, getWeeklyPeriodKey } from "@/utils/date";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";

const TOP_N = 100;

const tabs: { id: RankingPeriod; label: string; key: () => string }[] = [
  { id: "diario", label: "Diário", key: getDailyPeriodKey },
  { id: "semanal", label: "Semanal", key: getWeeklyPeriodKey },
  { id: "mensal", label: "Mensal", key: getMonthlyPeriodKey },
];

export default function RankingPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<RankingPeriod>("diario");
  const [list, setList] = useState<RankingEntry[]>([]);
  const [mine, setMine] = useState<RankingEntry | null>(null);

  const load = useCallback(async () => {
    const t = tabs.find((x) => x.id === tab)!;
    const key = t.key();
    const top = await fetchTopRanking(tab, key, TOP_N);
    setList(top);
    if (user) setMine(await fetchMyRankingEntry(tab, key, user.uid));
    else setMine(null);
  }, [tab, user]);

  useEffect(() => {
    load();
  }, [load]);

  const myIndex = useMemo(() => {
    if (!user) return -1;
    return list.findIndex((e) => e.uid === user.uid);
  }, [list, user]);

  const myPosition = myIndex >= 0 ? myIndex + 1 : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold text-white">Ranking</h1>
        <Link href={ROUTES.jogos} className="text-sm text-violet-300 hover:underline">
          Jogar minijogos →
        </Link>
      </div>
      <div className="flex gap-2 rounded-xl bg-white/5 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition",
              tab === t.id ? "bg-violet-600 text-white" : "text-white/55",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mine ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {myPosition != null ? (
            <>
              Sua posição no top {TOP_N}: <strong>#{myPosition}</strong> · score{" "}
              <strong>{mine.score}</strong> · vitórias {mine.vitorias} · partidas {mine.partidas}
            </>
          ) : (
            <>
              Sua pontuação: <strong>{mine.score}</strong> · vitórias {mine.vitorias} — fora do
              top {TOP_N} exibido; continue jogando para subir.
            </>
          )}
        </div>
      ) : (
        <p className="text-sm text-white/50">Jogue partidas para entrar no ranking deste período.</p>
      )}

      <TopPodium entries={list} highlightUid={user?.uid} />

      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
        Top {TOP_N} completo
      </h2>
      <RankingTable entries={list.slice(3)} highlightUid={user?.uid} startRank={4} />
    </div>
  );
}
