"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  claimChestRewardCallable,
  startChestUnlockCallable,
  subscribeUserChestItems,
} from "@/services/chests/chestService";
import { runChestSpeedupRewardedAdFlow } from "@/services/anuncios/rewardedAdService";
import type { ClaimChestRewardResult, StartChestUnlockResult } from "@/services/chests/chestService";
import type { ResolvedChestItem } from "@/utils/chest";
import {
  buildChestSummary,
  CHEST_RARITY_LABEL,
  DEFAULT_CHEST_QUEUE_CAPACITY,
  DEFAULT_CHEST_SLOT_COUNT,
  formatChestRewardSummary,
} from "@/utils/chest";

type BusyAction = "start" | "speed" | "claim";

export function useChestHub() {
  const { user, refreshProfile } = useAuth();
  const [itemsState, setItemsState] = useState<{
    uid: string | null;
    items: ResolvedChestItem[];
  }>({ uid: null, items: [] });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busyState, setBusyState] = useState<{ chestId: string; action: BusyAction } | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const effectiveItems = useMemo(
    () => (itemsState.uid === user?.uid ? itemsState.items : []),
    [itemsState.items, itemsState.uid, user?.uid],
  );
  const effectiveLoading = !!user?.uid && itemsState.uid !== user.uid;

  useEffect(() => {
    if (!user?.uid) return;
    const currentUid = user.uid;
    const unsub = subscribeUserChestItems(currentUid, (next) => {
      const built = buildChestSummary(next, Date.now());
      setItemsState({ uid: currentUid, items: built.items });
    });
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    const hasUnlocking = effectiveItems.some((item) => item.resolvedStatus === "unlocking");
    if (!hasUnlocking) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [effectiveItems]);

  const summaryData = useMemo(
    () =>
      buildChestSummary(
        effectiveItems,
        nowMs,
        DEFAULT_CHEST_SLOT_COUNT,
        DEFAULT_CHEST_QUEUE_CAPACITY,
      ),
    [effectiveItems, nowMs],
  );

  const slotItems = summaryData.summary.slots as Array<ResolvedChestItem | null>;
  const queueItems = summaryData.summary.queue as ResolvedChestItem[];
  const activeUnlockChest = summaryData.items.find((item) => item.resolvedStatus === "unlocking") ?? null;

  const clearFeedback = useCallback(() => setFeedback(null), []);

  const startUnlock = useCallback(async (chestId: string): Promise<StartChestUnlockResult> => {
    setBusyState({ chestId, action: "start" });
    setFeedback(null);
    const result = await startChestUnlockCallable(chestId);
    if (result.ok) {
      setFeedback({ tone: "success", text: "Baú começou a abrir." });
    } else {
      setFeedback({ tone: "error", text: result.error });
    }
    setBusyState(null);
    return result;
  }, []);

  const speedUpChest = useCallback(async (chestId: string) => {
    setBusyState({ chestId, action: "speed" });
    setFeedback(null);
    const result = await runChestSpeedupRewardedAdFlow(chestId);
    if (result.ok) {
      setFeedback({ tone: "success", text: result.message });
    } else {
      setFeedback({ tone: "error", text: result.message });
    }
    setBusyState(null);
    return result;
  }, []);

  const claimChest = useCallback(
    async (chestId: string): Promise<ClaimChestRewardResult> => {
      setBusyState({ chestId, action: "claim" });
      setFeedback(null);
      const result = await claimChestRewardCallable(chestId);
      if (result.ok) {
        const rewardLine = formatChestRewardSummary(result.rewards);
        const promotedLine = result.promotedChestId
          ? "O próximo baú já subiu da fila para um slot."
          : null;
        setFeedback({
          tone: "success",
          text: [`Baú ${CHEST_RARITY_LABEL[result.rarity]} aberto.`, rewardLine, promotedLine]
            .filter(Boolean)
            .join(" · "),
        });
        await refreshProfile();
      } else {
        setFeedback({ tone: "error", text: result.error });
      }
      setBusyState(null);
      return result;
    },
    [refreshProfile],
  );

  return {
    loading: effectiveLoading,
    items: summaryData.items,
    summary: summaryData.summary,
    slotItems,
    queueItems,
    activeUnlockChest,
    feedback,
    clearFeedback,
    busyState,
    startUnlock,
    speedUpChest,
    claimChest,
    rarityLabel: CHEST_RARITY_LABEL,
  };
}
