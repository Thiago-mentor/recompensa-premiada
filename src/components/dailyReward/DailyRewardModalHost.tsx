"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  DEFAULT_ECONOMY_STREAK_SLICE,
  fetchEconomyStreakSlice,
  type EconomyStreakSlice,
} from "@/services/economy/economyStreakConfig";
import { processDailyLogin } from "@/services/streak/dailyLoginService";
import {
  buildStreakDayWindow,
  getDailyRewardUiState,
} from "@/utils/dailyRewardUiState";
import { getDailyPeriodKey } from "@/utils/date";
import { resolveStreakRewardForDay } from "@/utils/streakReward";
import { DailyRewardModal, type DailyRewardSlot } from "./DailyRewardModal";

const HIDE_KEY_PREFIX = "rp_daily_modal_hide_";

export function DailyRewardModalHost() {
  const { profile, profileLoading, refreshProfile } = useAuth();
  const [economy, setEconomy] = useState<EconomyStreakSlice>(
    () => DEFAULT_ECONOMY_STREAK_SLICE,
  );
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  /** Força releitura do sessionStorage após fechar o modal. */
  const [storageRev, setStorageRev] = useState(0);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const e = await fetchEconomyStreakSlice();
        if (!c) setEconomy(e);
      } catch {
        if (!c) setEconomy({ dailyLoginBonus: 50, streakTable: [] });
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const ui = useMemo(() => getDailyRewardUiState(profile), [profile]);

  const slots: DailyRewardSlot[] = useMemo(() => {
    if (ui.kind !== "can_claim") return [];
    const center = ui.streakAfterClaim;
    const days = buildStreakDayWindow(center, 7);
    return days.map((dayNum) => {
      const r = resolveStreakRewardForDay(dayNum, economy.streakTable, economy.dailyLoginBonus);
      let status: DailyRewardSlot["status"];
      if (dayNum <= ui.completedBefore) status = "claimed";
      else if (dayNum === ui.streakAfterClaim) status = "current";
      else status = "upcoming";
      return {
        dayNum,
        coins: r.coins,
        gems: r.gems,
        status,
        tipoBonus: r.tipoBonus,
      };
    });
  }, [economy.streakTable, economy.dailyLoginBonus, ui]);

  const hiddenByUserToday = useMemo(() => {
    if (typeof window === "undefined") return false;
    void storageRev;
    try {
      return sessionStorage.getItem(HIDE_KEY_PREFIX + getDailyPeriodKey()) === "1";
    } catch {
      return false;
    }
  }, [storageRev]);

  const modalOpen = useMemo(() => {
    if (hiddenByUserToday) return false;
    if (profileLoading) return false;
    if (profile?.banido) return false;
    if (ui.kind !== "can_claim") return false;
    return slots.length > 0;
  }, [hiddenByUserToday, profileLoading, profile?.banido, ui, slots]);

  const hideForToday = useCallback(() => {
    setClaimError(null);
    const today = getDailyPeriodKey();
    try {
      sessionStorage.setItem(HIDE_KEY_PREFIX + today, "1");
    } catch {
      /* ignore */
    }
    setStorageRev((n) => n + 1);
  }, []);

  const onClaim = useCallback(async () => {
    setClaimError(null);
    setClaimLoading(true);
    const res = await processDailyLogin();
    setClaimLoading(false);
    if (res.ok && !res.alreadyCheckedIn) {
      await refreshProfile();
      return;
    }
    if (res.alreadyCheckedIn) {
      await refreshProfile();
      hideForToday();
      return;
    }
    setClaimError(res.error || "Não foi possível resgatar. Tente de novo.");
  }, [refreshProfile, hideForToday]);

  return (
    <DailyRewardModal
      open={modalOpen}
      slots={slots}
      claimLoading={claimLoading}
      errorMessage={claimError}
      onClaim={onClaim}
      onClose={hideForToday}
    />
  );
}
