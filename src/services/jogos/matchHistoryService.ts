"use client";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import type { MatchRecord } from "@/types/game";

export async function fetchUserMatchHistory(
  uid: string,
  max = 20,
): Promise<MatchRecord[]> {
  const db = getFirebaseFirestore();
  const q = query(
    collection(db, COLLECTIONS.matches),
    where("userId", "==", uid),
    orderBy("criadoEm", "desc"),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Omit<MatchRecord, "id">;
    return { id: d.id, ...data } as MatchRecord;
  });
}
