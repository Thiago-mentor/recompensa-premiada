"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchTopRanking } from "@/services/ranking/rankingService";
import { getDailyPeriodKey } from "@/utils/date";
import type { RankingEntry } from "@/types/ranking";

export function useHomeDashboard() {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);

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

  const refreshRanking = useCallback(async () => {
    const key = getDailyPeriodKey();
    try {
      setRanking(await fetchTopRanking("diario", key, 5));
    } catch {
      setRanking([]);
    }
  }, []);

  return {
    ranking,
    refreshRanking,
  };
}
