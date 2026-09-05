"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  DEFAULT_ECONOMY_STREAK_SLICE,
  fetchEconomyStreakSlice,
  subscribeEconomyStreakSlice,
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
  const { user, profile, loading, profileLoading, refreshProfile } = useAuth();
  const [economy, setEconomy] = useState<EconomyStreakSlice>(
    () => DEFAULT_ECONOMY_STREAK_SLICE,
  );
  const [economyReady, setEconomyReady] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [dismissedUserPeriodKey, setDismissedUserPeriodKey] = useState<string | null>(null);
  /** Força releitura do sessionStorage após fechar o modal. */
  const [storageRev, setStorageRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeEconomyStreakSlice(
      (value) => {
        if (cancelled) return;
        setEconomy(value);
        setEconomyReady(true);
      },
      () => {
        void fetchEconomyStreakSlice()
          .then((value) => {
            if (!cancelled) setEconomy(value);
          })
          .finally(() => {
            if (!cancelled) setEconomyReady(true);
          });
      },
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const ui = useMemo(() => getDailyRewardUiState(profile), [profile]);

  const slots: DailyRewardSlot[] = useMemo(() => {
    if (ui.kind !== "can_claim") return [];
    const center = ui.streakAfterClaim;
    const days = buildStreakDayWindow(center, economy.streakDisplayDays);
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
  }, [economy.dailyLoginBonus, economy.streakDisplayDays, economy.streakTable, ui]);

  const hiddenByUserToday = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (!user?.uid) return false;
    void storageRev;
    try {
      return sessionStorage.getItem(`${HIDE_KEY_PREFIX}${user.uid}_${getDailyPeriodKey()}`) === "1";
    } catch {
      return false;
    }
  }, [storageRev, user?.uid]);

  const modalOpen = useMemo(() => {
    if (dismissedUserPeriodKey === `${user?.uid ?? ""}_${getDailyPeriodKey()}`) return false;
    if (hiddenByUserToday) return false;
    if (loading) return false;
    if (!economyReady) return false;
    if (!user) return false;
    if (!profile) return false;
    if (profileLoading) return false;
    if (profile?.banido) return false;
    if (ui.kind !== "can_claim") return false;
    return slots.length > 0;
  }, [dismissedUserPeriodKey, hiddenByUserToday, loading, economyReady, user, profile, profileLoading, ui, slots]);

  const hideForToday = useCallback(() => {
    setClaimError(null);
    setClaimLoading(false);
    const today = getDailyPeriodKey();
    if (!user?.uid) return;
    setDismissedUserPeriodKey(`${user.uid}_${today}`);
    try {
      sessionStorage.setItem(`${HIDE_KEY_PREFIX}${user.uid}_${today}`, "1");
    } catch {
      /* ignore */
    }
    setStorageRev((n) => n + 1);
  }, [user?.uid]);

  const onClaim = useCallback(async () => {
    if (claimLoading) return;
    setClaimError(null);
    setClaimLoading(true);
    try {
      const res = await processDailyLogin();
      if (res.ok) {
        hideForToday();
        void refreshProfile();
        return;
      }
      setClaimError(res.error || "Não foi possível resgatar. Tente de novo.");
    } finally {
      setClaimLoading(false);
    }
  }, [claimLoading, refreshProfile, hideForToday]);

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
