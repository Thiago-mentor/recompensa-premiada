"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { listActiveMissions, subscribeUserDailyMissions } from "@/services/missoes/missionService";
import { fetchTopRanking } from "@/services/ranking/rankingService";
import { getDailyPeriodKey } from "@/utils/date";
import type { MissionCardModel } from "@/components/cards/MissionCard";
import type { MissionTemplate, UserMissionProgress } from "@/types/mission";
import type { RankingEntry } from "@/types/ranking";

export function useHomeDashboard() {
  const { user, profile } = useAuth();
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, UserMissionProgress>>({});
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await listActiveMissions();
        if (!cancelled) setTemplates(m);
      } catch (e) {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : "Erro ao carregar missões");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUserDailyMissions(user.uid, (items) => {
      const map: Record<string, UserMissionProgress> = {};
      for (const it of items) map[it.missionId] = it;
      setProgressMap(map);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const key = getDailyPeriodKey();
    let cancelled = false;
    (async () => {
      try {
        const top = await fetchTopRanking("diario", key, 5);
        if (!cancelled) setRanking(top);
      } catch {
        if (!cancelled) setRanking([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const missionsMerged: MissionCardModel[] = useMemo(() => {
    return templates.map((t) => {
      const p = progressMap[t.id];
      return {
        ...t,
        progresso: p?.progresso ?? 0,
        concluida: p?.concluida ?? false,
        recompensaResgatada: p?.recompensaResgatada ?? false,
      };
    });
  }, [templates, progressMap]);

  const dailyPreview = useMemo(
    () => missionsMerged.filter((m) => m.tipo === "diaria").slice(0, 2),
    [missionsMerged],
  );

  const refreshRanking = useCallback(async () => {
    const key = getDailyPeriodKey();
    try {
      setRanking(await fetchTopRanking("diario", key, 5));
    } catch {
      setRanking([]);
    }
  }, []);

  return {
    profile,
    missionsMerged,
    dailyPreview,
    ranking,
    loadError,
    refreshRanking,
  };
}
