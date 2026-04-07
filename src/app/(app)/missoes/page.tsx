"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  listActiveMissions,
  subscribeUserDailyMissions,
  claimMissionRewardCallable,
} from "@/services/missoes/missionService";
import { MissionCard, type MissionCardModel } from "@/components/cards/MissionCard";
import type { MissionTemplate, UserMissionProgress } from "@/types/mission";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { ROUTES } from "@/lib/constants/routes";
import { CheckCircle2, ChevronRight, Clock3, Sparkles, Target } from "lucide-react";

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
  const claimable = useMemo(
    () => merged.filter((mission) => mission.concluida && !mission.recompensaResgatada),
    [merged],
  );
  const completedCount = useMemo(
    () => merged.filter((mission) => mission.recompensaResgatada).length,
    [merged],
  );
  const inProgressCount = Math.max(0, merged.length - completedCount);

  async function onClaim(id: string) {
    setClaimingId(id);
    const r = await claimMissionRewardCallable(id);
    setClaimingId(null);
    setMsg(r.ok ? "Recompensa resgatada!" : r.error || "Erro");
  }

  return (
    <div className="space-y-5 pb-4">
      <section className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.18),transparent_36%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-4 shadow-[0_0_52px_-24px_rgba(139,92,246,0.32)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/70">
              Progresso diário
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Missões</h1>
            <p className="mt-1 text-sm text-white/55">
              Complete objetivos, resgate recompensas e mantenha seu ritmo ativo todos os dias.
            </p>
          </div>
          <Link
            href={ROUTES.home}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
          >
            Voltar ao início
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <MissionSummaryCard label="Missões ativas" value={String(merged.length)} icon={<Target className="h-4 w-4 text-cyan-200" />} />
          <MissionSummaryCard label="Prontas para resgatar" value={String(claimable.length)} icon={<Sparkles className="h-4 w-4 text-amber-200" />} />
          <MissionSummaryCard label="Já concluídas" value={String(completedCount)} icon={<CheckCircle2 className="h-4 w-4 text-emerald-200" />} />
        </div>
      </section>

      {msg ? (
        <AlertBanner tone="success" className="text-sm">
          {msg}
        </AlertBanner>
      ) : null}

      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
              Status atual
            </p>
            <h2 className="text-lg font-semibold text-white">Painel das missões</h2>
            <p className="text-xs text-white/45">
              {claimable.length > 0
                ? `${claimable.length} missão(ões) pronta(s) para resgate.`
                : `${inProgressCount} missão(ões) em andamento.`}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white/65">
            <Clock3 className="h-3 w-3" />
            ciclo diário
          </span>
        </div>
      </section>

      {claimable.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Prontas para resgatar</h2>
            <p className="text-xs text-white/45">Priorize essas missões para liberar suas recompensas agora.</p>
          </div>
          <div className="space-y-3">
            {claimable.map((mission) => (
              <MissionCard
                key={`claimable-${mission.id}`}
                mission={mission}
                onClaim={() => onClaim(mission.id)}
                claiming={claimingId === mission.id}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Todas as missões</h2>
          <p className="text-xs text-white/45">Acompanhe progresso, metas e recompensas do dia.</p>
        </div>
        <div className="space-y-3">
          {merged.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
              Nenhuma missão ativa disponível no momento.
            </div>
          ) : (
            merged.map((m) => (
              <MissionCard
                key={m.id}
                mission={m}
                onClaim={() => onClaim(m.id)}
                claiming={claimingId === m.id}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function MissionSummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}
