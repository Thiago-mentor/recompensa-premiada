"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  listActiveMissions,
  subscribeUserDailyMissions,
  claimMissionRewardCallable,
} from "@/services/missoes/missionService";
import { MissionCard, type MissionCardModel } from "@/components/cards/MissionCard";
import type { MissionTemplate, UserMissionProgress } from "@/types/mission";
import { AlertBanner } from "@/components/feedback/AlertBanner";

export default function MissoesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, UserMissionProgress>>({});
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const m = await listActiveMissions();
        if (!c) setTemplates(m);
      } catch {
        if (!c) setTemplates([]);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeUserDailyMissions(user.uid, (items) => {
      const map: Record<string, UserMissionProgress> = {};
      for (const it of items) map[it.missionId] = it;
      setProgressMap(map);
    });
  }, [user]);

  const merged: MissionCardModel[] = useMemo(
    () =>
      templates.map((t) => {
        const p = progressMap[t.id];
        return {
          ...t,
          progresso: p?.progresso ?? 0,
          concluida: p?.concluida ?? false,
          recompensaResgatada: p?.recompensaResgatada ?? false,
        };
      }),
    [templates, progressMap],
  );

  async function onClaim(id: string) {
    setClaimingId(id);
    const r = await claimMissionRewardCallable(id);
    setClaimingId(null);
    setMsg(r.ok ? "Recompensa resgatada!" : r.error || "Erro");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Missões</h1>
      {msg ? (
        <AlertBanner tone="success" className="text-sm">
          {msg}
        </AlertBanner>
      ) : null}
      <div className="space-y-3">
        {merged.map((m) => (
          <MissionCard
            key={m.id}
            mission={m}
            onClaim={() => onClaim(m.id)}
            claiming={claimingId === m.id}
          />
        ))}
      </div>
    </div>
  );
}
