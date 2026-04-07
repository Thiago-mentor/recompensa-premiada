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
import { COLLECTIONS, SUBCOLLECTIONS } from "@/lib/constants/collections";
import type { GameId } from "@/types/game";
import type { RankingEntry, RankingPeriod, RankingScope } from "@/types/ranking";

export type RankingQueryOptions = {
  scope?: RankingScope;
  gameId?: GameId | string | null;
};

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

function entriesCollectionPath(
  tipo: RankingPeriod,
  periodoChave: string,
  options?: RankingQueryOptions,
): string {
  const scope = options?.scope ?? "global";
  if (scope === "game") {
    const gameId = String(options?.gameId || "").trim();
    if (!gameId) throw new Error("gameId é obrigatório para ranking por jogo.");
    return `${collectionForPeriod(tipo)}/${periodoChave}/${SUBCOLLECTIONS.rankingGames}/${gameId}/${SUBCOLLECTIONS.rankingEntries}`;
  }
  return `${collectionForPeriod(tipo)}/${periodoChave}/${SUBCOLLECTIONS.rankingEntries}`;
}

function normalizeEntry(
  uid: string,
  raw: Record<string, unknown>,
  options?: RankingQueryOptions,
): RankingEntry {
  return {
    uid,
    nome: String(raw.nome || "Jogador"),
    username: typeof raw.username === "string" ? raw.username : null,
    foto: typeof raw.foto === "string" ? raw.foto : null,
    score: Math.max(0, Math.floor(Number(raw.score) || 0)),
    partidas: Math.max(0, Math.floor(Number(raw.partidas) || 0)),
    vitorias: Math.max(0, Math.floor(Number(raw.vitorias) || 0)),
    scope: raw.scope === "game" ? "game" : options?.scope ?? "global",
    gameId:
      typeof raw.gameId === "string"
        ? raw.gameId
        : options?.scope === "game"
          ? String(options?.gameId || "")
          : null,
    gameTitle: typeof raw.gameTitle === "string" ? raw.gameTitle : null,
    atualizadoEm: raw.atualizadoEm as RankingEntry["atualizadoEm"],
  };
}

/** Subcoleção `entries` em `rankings_* / {periodoChave} / entries / {uid}` */
export async function fetchTopRanking(
  tipo: RankingPeriod,
  periodoChave: string,
  topN = 50,
  options?: RankingQueryOptions,
): Promise<RankingEntry[]> {
  const db = getFirebaseFirestore();
  const entriesRef = collection(db, entriesCollectionPath(tipo, periodoChave, options));
  const q = query(entriesRef, orderBy("score", "desc"), limit(topN));
  const snap = await getDocs(q);
  return snap.docs.map((d, i) => ({ ...normalizeEntry(d.id, d.data(), options), posicao: i + 1 }));
}

export async function fetchMyRankingEntry(
  tipo: RankingPeriod,
  periodoChave: string,
  uid: string,
  options?: RankingQueryOptions,
): Promise<RankingEntry | null> {
  const db = getFirebaseFirestore();
  const ref = doc(db, entriesCollectionPath(tipo, periodoChave, options), uid);
  const s = await getDoc(ref);
  if (!s.exists()) return null;
  return normalizeEntry(s.id, s.data(), options);
}
