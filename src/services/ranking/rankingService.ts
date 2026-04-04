"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import type { RankingEntry, RankingPeriod } from "@/types/ranking";

function collectionForPeriod(tipo: RankingPeriod): string {
  switch (tipo) {
    case "diario":
      return COLLECTIONS.rankingsDaily;
    case "semanal":
      return COLLECTIONS.rankingsWeekly;
    case "mensal":
      return COLLECTIONS.rankingsMonthly;
    default:
      return COLLECTIONS.rankingsDaily;
  }
}

/** Subcoleção `entries` em `rankings_* / {periodoChave} / entries / {uid}` */
export async function fetchTopRanking(
  tipo: RankingPeriod,
  periodoChave: string,
  topN = 50,
): Promise<RankingEntry[]> {
  const db = getFirebaseFirestore();
  const entriesRef = collection(
    doc(db, collectionForPeriod(tipo), periodoChave),
    "entries",
  );
  const q = query(entriesRef, orderBy("score", "desc"), limit(topN));
  const snap = await getDocs(q);
  return snap.docs.map((d, i) => {
    const data = d.data() as Omit<RankingEntry, "posicao" | "uid">;
    return { ...data, uid: d.id, posicao: i + 1 };
  });
}

export async function fetchMyRankingEntry(
  tipo: RankingPeriod,
  periodoChave: string,
  uid: string,
): Promise<RankingEntry | null> {
  const db = getFirebaseFirestore();
  const ref = doc(db, collectionForPeriod(tipo), periodoChave, "entries", uid);
  const s = await getDoc(ref);
  if (!s.exists()) return null;
  const data = s.data() as Omit<RankingEntry, "uid">;
  return { ...data, uid: s.id };
}
