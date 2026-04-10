"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  claimMissionRewardCallable,
  listActiveMissions,
  subscribeUserDailyMissions,
} from "@/services/missoes/missionService";
import { MissionCard, type MissionCardModel } from "@/components/cards/MissionCard";
import { ChestGrantNotice } from "@/components/chests/ChestGrantNotice";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { ROUTES } from "@/lib/constants/routes";
import type { GrantedChestSummary } from "@/types/chest";
import type {
  MissionCategory,
  MissionTemplate,
  UserMissionProgress,
} from "@/types/mission";
import { getNextDailyPeriodStartMs } from "@/utils/date";
import {
  CheckCircle2,
  ChevronRight,
  CirclePlay,
  Clock3,
  Gamepad2,
  ListChecks,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";

const CATEGORY_LABEL: Record<MissionCategory, string> = {
  login: "Login",
  ads: "Anúncios",
  jogos: "Jogos",
  social: "Social",
  streak: "Streak",
  loja: "Loja",
  especial: "Especial",
};

type BannerState = {
  tone: "success" | "error" | "info";
  text: string;
};

function formatCountdownMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatRewardLine(reward: { coins: number; gems: number; xp: number }): string {
  const parts = [
    reward.coins > 0 ? `${reward.coins} PR` : null,
    reward.gems > 0 ? `${reward.gems} TICKET` : null,
    reward.xp > 0 ? `${reward.xp} XP` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Sem recompensa configurada";
}

export default function MissoesPage() {
  const { user, profile } = useAuth();
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, UserMissionProgress>>({});
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [grantedChestNotice, setGrantedChestNotice] = useState<GrantedChestSummary | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [progressReady, setProgressReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const nome = profile?.nome || user?.displayName || "Jogador";

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    setLoadError(null);

    void (async () => {
      try {
        const missions = await listActiveMissions();
        if (cancelled) return;
        setTemplates(missions);
      } catch (e) {
        if (cancelled) return;
        setTemplates([]);
        setLoadError(e instanceof Error ? e.message : "Erro ao carregar as missões.");
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
  const inProgress = useMemo(
    () => merged.filter((mission) => !mission.concluida && mission.progresso > 0),
    [merged],
  );
  const queued = useMemo(
    () => merged.filter((mission) => !mission.concluida && mission.progresso === 0),
    [merged],
  );
  const claimed = useMemo(
    () => merged.filter((mission) => mission.recompensaResgatada),
    [merged],
  );

  const totalCurrentProgress = useMemo(
    () =>
      merged.reduce(
        (sum, mission) => sum + Math.min(mission.progresso, Math.max(mission.meta, 1)),
        0,
      ),
    [merged],
  );
  const totalTargetProgress = useMemo(
    () => merged.reduce((sum, mission) => sum + Math.max(mission.meta, 1), 0),
    [merged],
  );
  const totalProgressPct =
    totalTargetProgress > 0
      ? Math.min(100, Math.round((totalCurrentProgress / totalTargetProgress) * 100))
      : 0;
  const availableRewards = useMemo(
    () =>
      claimable.reduce(
        (sum, mission) => ({
          coins: sum.coins + mission.recompensaCoins,
          gems: sum.gems + mission.recompensaGems,
          xp: sum.xp + mission.recompensaXP,
        }),
        { coins: 0, gems: 0, xp: 0 },
      ),
    [claimable],
  );
  const claimedCount = claimed.length;
  const isInitialLoading = templatesLoading || (Boolean(user) && !progressReady);
  const nextResetMs = getNextDailyPeriodStartMs(new Date(nowMs));
  const resetCountdown = formatCountdownMs(nextResetMs - nowMs);
  const focusMission = claimable[0] ?? inProgress[0] ?? queued[0] ?? claimed[0] ?? null;
  const focusMissionPct = focusMission
    ? focusMission.recompensaResgatada
      ? 100
      : Math.min(
          100,
          Math.round(
            (Math.min(focusMission.progresso, Math.max(focusMission.meta, 1)) /
              Math.max(focusMission.meta, 1)) *
              100,
          ),
        )
    : 0;
  const focusCard = useMemo(() => {
    if (merged.length === 0) {
      return {
        eyebrow: "Centro de comando",
        title: "Nenhuma missão ativa no momento",
        description:
          "Assim que o painel receber novas missões, elas aparecerão aqui com progresso e recompensas.",
        badge: "aguardando",
        rewardLine: "Nenhuma recompensa disponível",
        helper: `O próximo reset diário acontece em ${resetCountdown}.`,
        categoryLabel: null as string | null,
      };
    }

    if (claimable.length > 0) {
      return {
        eyebrow: "Pronto para resgatar",
        title: `${claimable.length} recompensa(s) esperando você`,
        description:
          "As metas já foram concluídas. Resgate agora para liberar PR, tickets, XP e possíveis baús do ciclo diário.",
        badge: "resgate liberado",
        rewardLine: formatRewardLine(availableRewards),
        helper:
          claimable.length === 1
            ? `A missão ${claimable[0].titulo.toLowerCase()} já está pronta para coleta.`
            : "Resgate primeiro as missões concluídas para limpar o painel mais rápido.",
        categoryLabel:
          claimable.length === 1
            ? CATEGORY_LABEL[claimable[0].categoria]
            : "Recompensas do dia",
      };
    }

    if (inProgress.length > 0) {
      const mission = inProgress[0];
      return {
        eyebrow: "Próxima meta",
        title: mission.titulo,
        description: mission.descricao,
        badge: `${mission.progresso}/${mission.meta}`,
        rewardLine: formatRewardLine({
          coins: mission.recompensaCoins,
          gems: mission.recompensaGems,
          xp: mission.recompensaXP,
        }),
        helper: `Faltam ${Math.max(0, mission.meta - mission.progresso)} ação(ões) para concluir essa etapa.`,
        categoryLabel: CATEGORY_LABEL[mission.categoria],
      };
    }

    if (queued.length > 0) {
      const mission = queued[0];
      return {
        eyebrow: "Comece por aqui",
        title: mission.titulo,
        description: "Seu ciclo diário está limpo. Faça a primeira ação para começar a destravar recompensas.",
        badge: "novo ciclo",
        rewardLine: formatRewardLine({
          coins: mission.recompensaCoins,
          gems: mission.recompensaGems,
          xp: mission.recompensaXP,
        }),
        helper: `As missões atuais reiniciam em ${resetCountdown}.`,
        categoryLabel: CATEGORY_LABEL[mission.categoria],
      };
    }

    return {
      eyebrow: "Dia finalizado",
      title: "Todas as missões do ciclo foram resgatadas",
      description: `Excelente, ${nome}. Agora é só aguardar o próximo reset para receber novos objetivos.`,
      badge: "100%",
      rewardLine: `${claimedCount} resgate(s) concluído(s) hoje`,
      helper: `Novo ciclo em ${resetCountdown}.`,
      categoryLabel: null as string | null,
    };
  }, [
    availableRewards,
    claimable,
    claimedCount,
    inProgress,
    merged.length,
    nome,
    queued,
    resetCountdown,
  ]);

  async function onClaim(id: string) {
    setBanner(null);
    setGrantedChestNotice(null);
    setClaimingId(id);
    const result = await claimMissionRewardCallable(id);
    setClaimingId(null);
    setGrantedChestNotice(result.ok ? result.grantedChest ?? null : null);
    setBanner({
      tone: result.ok ? "success" : "error",
      text: result.ok ? "Recompensa resgatada com sucesso!" : result.error || "Erro ao resgatar missão.",
    });
  }

  return (
    <div className="space-y-5 pb-4">
      <section className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.18),transparent_36%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-4 shadow-[0_0_52px_-24px_rgba(139,92,246,0.32)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/70">
              Central diária
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
              Missões de {nome}
            </h1>
            <p className="mt-1 text-sm text-white/55">
              Complete objetivos, resgate recompensas e mantenha o ciclo diário girando sem
              perder oportunidades.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/75">
              <Clock3 className="h-4 w-4 text-cyan-200" />
              reset em {resetCountdown}
            </span>
            <Link
              href={ROUTES.home}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
            >
              Voltar ao início
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <MissionSummaryCard
            label="Missões ativas"
            value={isInitialLoading ? "..." : String(merged.length)}
            hint="Painel disponível hoje"
            icon={<ListChecks className="h-4 w-4 text-cyan-200" />}
          />
          <MissionSummaryCard
            label="Prontas para resgatar"
            value={isInitialLoading ? "..." : String(claimable.length)}
            hint={
              claimable.length > 0
                ? formatRewardLine(availableRewards)
                : "Nenhum resgate aberto agora"
            }
            icon={<Sparkles className="h-4 w-4 text-amber-200" />}
          />
          <MissionSummaryCard
            label="Já resgatadas"
            value={isInitialLoading ? "..." : String(claimedCount)}
            hint="Recompensas coletadas"
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-200" />}
          />
          <MissionSummaryCard
            label="Progresso total"
            value={isInitialLoading ? "..." : `${totalProgressPct}%`}
            hint={`${totalCurrentProgress}/${totalTargetProgress || 0} etapas`}
            icon={<Target className="h-4 w-4 text-violet-200" />}
          />
        </div>

        <div className="mt-4 rounded-[1.45rem] border border-white/10 bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                {isInitialLoading ? "Sincronizando" : focusCard.eyebrow}
              </p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-white">
                {isInitialLoading ? "Montando seu painel de missões..." : focusCard.title}
              </h2>
              <p className="mt-1 text-sm text-white/60">
                {isInitialLoading
                  ? "Buscando progresso, recompensas e estado do ciclo diário."
                  : focusCard.description}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white/70">
              {isInitialLoading ? "..." : focusCard.badge}
            </span>
          </div>

          {isInitialLoading ? (
            <MissionInsightSkeleton />
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2 text-[11px]">
                {focusCard.categoryLabel ? (
                  <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 font-semibold text-cyan-100/90">
                    {focusCard.categoryLabel}
                  </span>
                ) : null}
                <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-semibold text-white/80">
                  {focusCard.rewardLine}
                </span>
              </div>

              {focusMission ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-white/55">
                    <span>Missão em destaque</span>
                    <span>
                      {focusMission.recompensaResgatada
                        ? "Resgatada"
                        : `${Math.min(focusMission.progresso, focusMission.meta)} / ${focusMission.meta}`}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all"
                      style={{ width: `${focusMissionPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/55">{focusCard.helper}</p>
                </div>
              ) : (
                <p className="text-xs text-white/55">{focusCard.helper}</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <QuickActionCard
            href={ROUTES.home}
            label="Ação rápida"
            title="Voltar à home"
            description="Anúncios, streak e resgates rápidos continuam acessíveis por lá."
            icon={CirclePlay}
            toneClassName="border-cyan-400/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15"
          />
          <QuickActionCard
            href={ROUTES.jogos}
            label="Arena"
            title="Jogar confrontos"
            description="Avance mais rápido nas metas ligadas a partidas e ranking."
            icon={Gamepad2}
            toneClassName="border-violet-400/20 bg-violet-500/10 text-violet-100 hover:bg-violet-500/15"
          />
          <QuickActionCard
            href={ROUTES.convidar}
            label="Social"
            title="Área de convites"
            description="Compartilhe seu código, acompanhe convidados e cumpra objetivos sociais quando houver campanha."
            icon={Sparkles}
            toneClassName="border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
          />
        </div>
      </section>

      {loadError ? (
        <AlertBanner tone="error" className="text-sm">
          {loadError}
        </AlertBanner>
      ) : null}

      {isInitialLoading && !loadError ? (
        <AlertBanner tone="info" className="text-sm">
          Sincronizando progresso e recompensas do seu ciclo diário...
        </AlertBanner>
      ) : null}

      {banner ? (
        <AlertBanner tone={banner.tone} className="text-sm">
          {banner.text}
        </AlertBanner>
      ) : null}

      {grantedChestNotice ? (
        <ChestGrantNotice grantedChest={grantedChestNotice} label="Baú ganho em missão" />
      ) : null}

      {!isInitialLoading && merged.length === 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Painel vazio</h2>
            <p className="text-xs text-white/45">
              O ciclo está online, mas ainda não existem missões ativas publicadas.
            </p>
          </div>
          <MissionEmptyState text="Nenhuma missão ativa disponível no momento. Publique missões no Firestore para preencher esta central." />
        </section>
      ) : (
        <>
          {isInitialLoading || claimable.length > 0 ? (
            <MissionSection
              title="Prontas para resgatar"
              description="As metas já foram concluídas; basta confirmar o resgate para receber a recompensa."
              items={claimable}
              emptyText="Nenhuma missão liberada para resgate neste momento."
              loading={isInitialLoading}
              claimingId={claimingId}
              onClaim={onClaim}
            />
          ) : null}

          <MissionSection
            title="Em andamento"
            description="Essas são as missões que já receberam progresso no ciclo atual."
            items={inProgress}
            emptyText="Você ainda não avançou em nenhuma missão hoje."
            loading={isInitialLoading}
            claimingId={claimingId}
            onClaim={onClaim}
          />

          <MissionSection
            title="Preparadas para começar"
            description="Objetivos ativos que ainda não receberam nenhuma ação neste ciclo."
            items={queued}
            emptyText="Todas as missões ativas já tiveram progresso ou foram finalizadas."
            loading={isInitialLoading}
            claimingId={claimingId}
            onClaim={onClaim}
          />

          {isInitialLoading || claimedCount > 0 ? (
            <MissionSection
              title="Já resgatadas"
              description="Histórico do que você já concluiu e coletou neste ciclo diário."
              items={claimed}
              emptyText="Nenhuma recompensa de missão foi resgatada hoje."
              loading={isInitialLoading}
              claimingId={claimingId}
              onClaim={onClaim}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function MissionSummaryCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/45">{hint}</p> : null}
    </div>
  );
}

function QuickActionCard({
  href,
  label,
  title,
  description,
  icon: Icon,
  toneClassName,
}: {
  href: string;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  toneClassName: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-[1.35rem] border px-4 py-4 transition ${toneClassName}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-75">{label}</p>
          <p className="mt-1 text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-white/65">{description}</p>
        </div>
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      </div>
      <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold">
        Abrir
        <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}

function MissionSection({
  title,
  description,
  items,
  emptyText,
  loading,
  claimingId,
  onClaim,
}: {
  title: string;
  description: string;
  items: MissionCardModel[];
  emptyText: string;
  loading: boolean;
  claimingId: string | null;
  onClaim: (id: string) => void | Promise<void>;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-xs text-white/45">{description}</p>
      </div>

      <div className="space-y-3">
        {loading ? (
          <>
            <MissionCardSkeleton />
            <MissionCardSkeleton />
          </>
        ) : items.length === 0 ? (
          <MissionEmptyState text={emptyText} />
        ) : (
          items.map((mission) => (
            <MissionCard
              key={`${title}-${mission.id}`}
              mission={mission}
              onClaim={() => onClaim(mission.id)}
              claiming={claimingId === mission.id}
            />
          ))
        )}
      </div>
    </section>
  );
}

function MissionCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-2/5 rounded-full bg-white/10" />
          <div className="h-3 w-4/5 rounded-full bg-white/10" />
        </div>
        <div className="h-6 w-16 rounded-lg bg-white/10" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-7 w-24 rounded-full bg-white/10" />
        <div className="h-7 w-32 rounded-full bg-white/10" />
      </div>
      <div className="mt-4 h-2 rounded-full bg-white/10" />
      <div className="mt-2 h-3 w-28 rounded-full bg-white/10" />
    </div>
  );
}

function MissionInsightSkeleton() {
  return (
    <div className="mt-4 animate-pulse space-y-3">
      <div className="flex gap-2">
        <div className="h-6 w-24 rounded-full bg-white/10" />
        <div className="h-6 w-40 rounded-full bg-white/10" />
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="h-3 w-32 rounded-full bg-white/10" />
        <div className="mt-2 h-2 rounded-full bg-white/10" />
        <div className="mt-2 h-3 w-3/4 rounded-full bg-white/10" />
      </div>
    </div>
  );
}

function MissionEmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
      {text}
    </div>
  );
}
