"use client";

import { doc, getDoc } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/constants/collections";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { normalizeGameCatalogConfig, type GameCatalogConfig } from "@/modules/jogos";

const ECONOMY_ID = "economy";

export async function fetchExperienceCatalogConfig(): Promise<GameCatalogConfig> {
  const db = getFirebaseFirestore();
  const snap = await getDoc(doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID));
  if (!snap.exists()) return {};
  return normalizeGameCatalogConfig(snap.data()?.experienceCatalog);
}
