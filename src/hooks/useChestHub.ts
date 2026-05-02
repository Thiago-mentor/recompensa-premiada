"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { CHEST_ALREADY_OPENING_MESSAGE, CHEST_OPEN_LOWER_SLOT_FIRST_MESSAGE } from "@/lib/firebase/errors";
import {
  claimChestRewardCallable,
  fetchUserChestItemsCallable,
  startChestUnlockCallable,
  subscribeUserChestItems,
} from "@/services/chests/chestService";
import { runChestSpeedupRewardedAdFlow } from "@/services/anuncios/rewardedAdService";
import type { ClaimChestRewardResult, StartChestUnlockResult } from "@/services/chests/chestService";
import type { ResolvedChestItem } from "@/utils/chest";
import type { UserChestItem } from "@/types/chest";
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
  const currentUid = user?.uid ?? null;
  const [itemsState, setItemsState] = useState<{
    uid: string | null;
    items: ResolvedChestItem[];
  }>({ uid: null, items: [] });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busyState, setBusyState] = useState<{ chestId: string; action: BusyAction } | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(
    null,
  );

  const applyItems = useCallback((uid: string, next: UserChestItem[]) => {
    const built = buildChestSummary(next, Date.now());
    setItemsState({ uid, items: built.items });
  }, []);

  const refreshItemsFromServer = useCallback(
    async (
      options:
        | {
            infoText?: string | null;
            silent?: boolean;
          }
        | undefined = undefined,
    ) => {
      if (!currentUid) return { ok: false as const, error: "Faça login novamente." };
      const result = await fetchUserChestItemsCallable();
      if (!result.ok) {
        if (!options?.silent) {
          setFeedback({ tone: "error", text: result.error });
        }
        setItemsState({ uid: currentUid, items: [] });
        return result;
      }
      applyItems(currentUid, result.items);
      if (!options?.silent && options?.infoText) {
        setFeedback({ tone: "info", text: options.infoText });
      }
      return result;
    },
    [applyItems, currentUid],
  );

  const effectiveItems = useMemo(
    () => (itemsState.uid === currentUid ? itemsState.items : []),
    [itemsState.items, itemsState.uid, currentUid],
  );
  const effectiveLoading = !!currentUid && itemsState.uid !== currentUid;

  useEffect(() => {
    if (!currentUid) return;
    let active = true;
    const unsub = subscribeUserChestItems(
      currentUid,
      (next) => {
        if (!active) return;
        applyItems(currentUid, next);
      },
      async () => {
        if (!active) return;
        await refreshItemsFromServer({
          infoText: "Tempo real indisponível no momento. Exibindo um snapshot seguro do servidor.",
        });
      },
    );
    return () => {
      active = false;
      unsub();
    };
  }, [applyItems, refreshItemsFromServer, currentUid]);

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

  const summaryDataRef = useRef(summaryData);
  summaryDataRef.current = summaryData;

  const slotItems = summaryData.summary.slots as Array<ResolvedChestItem | null>;
  const queueItems = summaryData.summary.queue as ResolvedChestItem[];
  const activeUnlockChest = summaryData.items.find((item) => item.resolvedStatus === "unlocking") ?? null;

  const clearFeedback = useCallback(() => setFeedback(null), []);

  const startUnlock = useCallback(async (chestId: string): Promise<StartChestUnlockResult> => {
    const blockingUnlock = summaryDataRef.current.items.find(
      (i) => i.resolvedStatus === "unlocking",
    );
    if (blockingUnlock != null) {
      setFeedback({ tone: "error", text: CHEST_ALREADY_OPENING_MESSAGE });
      return { ok: false, error: CHEST_ALREADY_OPENING_MESSAGE };
    }
    const nextAllowed = summaryDataRef.current.items.find((i) => i.canStartUnlock);
    if (nextAllowed != null && nextAllowed.id !== chestId) {
      setFeedback({ tone: "error", text: CHEST_OPEN_LOWER_SLOT_FIRST_MESSAGE });
      return { ok: false, error: CHEST_OPEN_LOWER_SLOT_FIRST_MESSAGE };
    }
    setFeedback(null);
    const result = await startChestUnlockCallable(chestId);
    if (result.ok) {
      void refreshItemsFromServer({ silent: true });
      setFeedback({ tone: "success", text: "Baú começou a abrir." });
    } else {
      setFeedback({ tone: "error", text: result.error });
    }
    setBusyState(null);
    return result;
  }, [refreshItemsFromServer]);

  const speedUpChest = useCallback(async (chestId: string) => {
    setBusyState({ chestId, action: "speed" });
    setFeedback(null);
    const result = await runChestSpeedupRewardedAdFlow(chestId);
    if (result.ok) {
      void refreshItemsFromServer({ silent: true });
      setFeedback({ tone: "success", text: result.message });
    } else {
      setFeedback({ tone: "error", text: result.message });
    }
    setBusyState(null);
    return result;
  }, [refreshItemsFromServer]);

  const claimChest = useCallback(
    async (chestId: string): Promise<ClaimChestRewardResult> => {
      setBusyState({ chestId, action: "claim" });
      setFeedback(null);
      const result = await claimChestRewardCallable(chestId);
      if (result.ok) {
        await refreshItemsFromServer({ silent: true });
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
    [refreshItemsFromServer, refreshProfile],
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
