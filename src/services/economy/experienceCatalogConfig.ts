"use client";

import { fetchEconomyConfigDocument } from "@/services/systemConfigs/economyDocumentCache";
import { normalizeGameCatalogConfig, type GameCatalogConfig } from "@/modules/jogos";

export async function fetchExperienceCatalogConfig(): Promise<GameCatalogConfig> {
  const snap = await fetchEconomyConfigDocument();
  if (!snap) return {};
  return normalizeGameCatalogConfig(snap.experienceCatalog);
}
