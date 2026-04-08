"use client";

import {
  collection,
  doc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS, SUBCOLLECTIONS } from "@/lib/constants/collections";
import type {
  ChestActionSnapshot,
  ChestRewardSnapshot,
  GrantedChestSummary,
  UserChestItem,
} from "@/types/chest";
import { callFunction } from "@/services/callables/client";
import { formatFirebaseError } from "@/lib/firebase/errors";

export function subscribeUserChestItems(
  uid: string,
  onNext: (items: UserChestItem[]) => void,
): Unsubscribe {
  const ref = collection(
    doc(getFirebaseFirestore(), COLLECTIONS.userChests, uid),
    SUBCOLLECTIONS.chestItems,
  );
  return onSnapshot(ref, (snap) => {
    onNext(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserChestItem, "id">) })));
  });
}

export type StartChestUnlockResult =
  | ({ ok: true } & ChestActionSnapshot)
  | { ok: false; error: string };

export async function startChestUnlockCallable(
  chestId: string,
): Promise<StartChestUnlockResult> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return { ok: false, error: "Faça login novamente." };
  try {
    const res = await callFunction<
      { chestId: string },
      ChestActionSnapshot
    >("startChestUnlock", { chestId });
    return { ok: true, ...res.data };
  } catch (error) {
    return { ok: false, error: formatFirebaseError(error) };
  }
}

export type SpeedUpChestUnlockResult =
  | ({ ok: true } & ChestActionSnapshot & { reducedMs: number; dailyAdsUsed: number })
  | { ok: false; error: string };

export async function speedUpChestUnlockCallable(input: {
  chestId: string;
  mockCompletionToken?: string;
}): Promise<SpeedUpChestUnlockResult> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return { ok: false, error: "Faça login novamente." };
  try {
    const res = await callFunction<
      { chestId: string; mockCompletionToken?: string },
      ChestActionSnapshot & { reducedMs: number; dailyAdsUsed: number }
    >("speedUpChestUnlock", input);
    return { ok: true, ...res.data };
  } catch (error) {
    return { ok: false, error: formatFirebaseError(error) };
  }
}

export type ClaimChestRewardResult =
  | {
      ok: true;
      chestId: string;
      rarity: GrantedChestSummary["rarity"];
      rewards: ChestRewardSnapshot;
      promotedChestId: string | null;
    }
  | { ok: false; error: string };

export async function claimChestRewardCallable(
  chestId: string,
): Promise<ClaimChestRewardResult> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return { ok: false, error: "Faça login novamente." };
  try {
    const res = await callFunction<
      { chestId: string },
      {
        chestId: string;
        rarity: GrantedChestSummary["rarity"];
        rewards: ChestRewardSnapshot;
        promotedChestId: string | null;
      }
    >("claimChestReward", { chestId });
    return { ok: true, ...res.data };
  } catch (error) {
    return { ok: false, error: formatFirebaseError(error) };
  }
}
