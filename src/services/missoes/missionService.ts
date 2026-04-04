"use client";

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase/client";
import { shouldUseSparkFallback } from "@/lib/firebase/sparkMode";
import { COLLECTIONS, SUBCOLLECTIONS } from "@/lib/constants/collections";
import type { MissionTemplate, UserMissionProgress } from "@/types/mission";
import { callFunction } from "@/services/callables/client";
import { sparkClaimMissionReward } from "@/services/spark/missions";

export async function listActiveMissions(): Promise<MissionTemplate[]> {
  const q = query(
    collection(getFirebaseFirestore(), COLLECTIONS.missions),
    where("ativa", "==", true),
    orderBy("ordem", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MissionTemplate);
}

export function subscribeUserDailyMissions(
  uid: string,
  onNext: (items: UserMissionProgress[]) => void,
): Unsubscribe {
  const ref = collection(
    doc(getFirebaseFirestore(), COLLECTIONS.userMissions, uid),
    SUBCOLLECTIONS.userMissionsDaily,
  );
  return onSnapshot(ref, (snap) => {
    onNext(
      snap.docs.map(
        (d) => ({ missionId: d.id, ...(d.data() as Omit<UserMissionProgress, "missionId">) }),
      ),
    );
  });
}

export async function claimMissionRewardCallable(missionId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return { ok: false, error: "Faça login novamente." };

  if (shouldUseSparkFallback()) {
    return sparkClaimMissionReward(uid, missionId);
  }

  try {
    await callFunction("claimMissionReward", { missionId });
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao resgatar" };
  }
}
