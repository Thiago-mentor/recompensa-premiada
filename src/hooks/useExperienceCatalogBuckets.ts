"use client";

import { useEffect, useMemo, useState } from "react";
import {
  resolveConfiguredGameCatalog,
  splitConfiguredGameCatalog,
  type GameCatalogConfig,
} from "@/modules/jogos";
import { fetchExperienceCatalogConfig } from "@/services/economy/experienceCatalogConfig";

export function useExperienceCatalogBuckets() {
  const [config, setConfig] = useState<GameCatalogConfig>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const nextConfig = await fetchExperienceCatalogConfig();
        if (!cancelled) setConfig(nextConfig);
      } catch {
        if (!cancelled) setConfig({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const catalog = useMemo(() => resolveConfiguredGameCatalog(config), [config]);
  const buckets = useMemo(() => splitConfiguredGameCatalog(catalog), [catalog]);

  return {
    catalog,
    arena: buckets.arena,
    utility: buckets.utility,
  };
}
