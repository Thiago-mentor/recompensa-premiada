"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  listActiveMissions,
  subscribeUserDailyMissions,
} from "@/services/missoes/missionService";
import type { MissionTemplate, UserMissionProgress } from "@/types/mission";

export type DailyMissionCalloutStepModel = {
  title: string;
  hint: string;
};

export type DailyMissionCalloutModel = {
  loading: boolean;
  ads: DailyMissionCalloutStepModel;
  tickets: DailyMissionCalloutStepModel;
  rank: DailyMissionCalloutStepModel;
};

type MergedDailyMission = MissionTemplate & {
  progresso: number;
  concluida: boolean;
  recompensaResgatada: boolean;
};

function pickFirstByOrder<T extends { ordem: number }>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return [...items].sort((a, b) => a.ordem - b.ordem)[0];
}

function buildModel(merged: MergedDailyMission[]): DailyMissionCalloutModel {
  const adsMission = pickFirstByOrder(merged.filter((m) => m.categoria === "ads"));
  const jogosMission = pickFirstByOrder(merged.filter((m) => m.categoria === "jogos"));

  const remainingGems = merged
    .filter((m) => !m.recompensaResgatada)
    .reduce((sum, m) => sum + Math.max(0, m.recompensaGems), 0);

  const ads: DailyMissionCalloutStepModel = adsMission
    ? (() => {
        const meta = Math.max(1, adsMission.meta);
        const title =
          adsMission.titulo.trim().length > 0
            ? adsMission.titulo
            : `Assista ${meta} anúncio${meta === 1 ? "" : "s"}`;
        let hint: string;
        if (adsMission.recompensaResgatada) {
          hint = "Recompensa resgatada — meta do dia cumprida.";
        } else if (adsMission.concluida) {
          hint = "Meta batida — resgate sua recompensa em Missões.";
        } else {
          const p = Math.min(adsMission.progresso, meta);
          hint = `Progresso ${p}/${meta} · use o botão “Ganhar +3 tickets agora !”.`;
        }
        return { title, hint };
      })()
    : {
        title: "Assistir anúncios",
        hint: "Use o botão “Ganhar +3 tickets agora !” abaixo quando estiver disponível.",
      };

  const tickets: DailyMissionCalloutStepModel =
    remainingGems > 0
      ? {
          title: `Ganhe +${remainingGems.toLocaleString("pt-BR")} tickets`,
          hint: "Total de tickets nas missões diárias que ainda não foram resgatadas.",
        }
      : merged.some((m) => m.recompensaGems > 0)
        ? {
            title: "Tickets do dia",
            hint: "Você já resgatou as recompensas em tickets — veja outras metas em Missões.",
          }
        : {
            title: "Ganhe tickets",
            hint: "Abra Missões para ver se há recompensas em tickets no ciclo atual.",
          };

  const rank: DailyMissionCalloutStepModel = jogosMission
    ? {
        title: jogosMission.titulo,
        hint:
          jogosMission.recompensaResgatada
            ? "Objetivo de jogo resgatado — continue na Arena por ranking."
            : jogosMission.descricao.trim().length > 0
              ? jogosMission.descricao
              : (() => {
                  const meta = Math.max(1, jogosMission.meta);
                  const p = Math.min(jogosMission.progresso, meta);
                  return `Progresso ${p}/${meta} · jogue na Arena.`;
                })(),
      }
    : {
        title: "Suba no ranking",
        hint: "Vença na Arena e pontue no placar diário.",
      };

  return { loading: false, ads, tickets, rank };
}

export function useDailyMissionCalloutModel(): DailyMissionCalloutModel {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, UserMissionProgress>>({});
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [progressReady, setProgressReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    void (async () => {
      try {
        const list = await listActiveMissions();
        if (!cancelled) setTemplates(list);
      } catch {
        if (!cancelled) setTemplates([]);
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProgressMap({});
      setProgressReady(false);
      return;
    }
    setProgressReady(false);
    return subscribeUserDailyMissions(user.uid, (items) => {
      const map: Record<string, UserMissionProgress> = {};
      for (const it of items) map[it.missionId] = it;
      setProgressMap(map);
      setProgressReady(true);
    });
  }, [user]);

  return useMemo(() => {
    const bootLoading = templatesLoading || (Boolean(user) && !progressReady);
    if (bootLoading) {
      return {
        loading: true,
        ads: { title: "…", hint: "Carregando metas do dia…" },
        tickets: { title: "…", hint: "Carregando metas do dia…" },
        rank: { title: "…", hint: "Carregando metas do dia…" },
      };
    }

    const daily = templates.filter((t) => t.ativa && t.tipo === "diaria");
    const merged: MergedDailyMission[] = daily.map((t) => {
      const p = progressMap[t.id];
      return {
        ...t,
        progresso: p?.progresso ?? 0,
        concluida: p?.concluida ?? false,
        recompensaResgatada: p?.recompensaResgatada ?? false,
      };
    });

    return buildModel(merged);
  }, [templates, progressMap, templatesLoading, progressReady, user]);
}
