"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import {
  buildReferralQualificationChecklist,
  buildReferralQualificationStatus,
  resolveReferralQualificationRules,
  summarizeReferralQualificationPending,
  type ReferralQualificationStatusItem,
} from "@/lib/referral/qualificationRules";
import { callFunction } from "@/services/callables/client";
import { formatFirebaseError } from "@/lib/firebase/errors";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Crown,
  Filter,
  Gamepad2,
  Gift,
  Layers3,
  Mail,
  Play,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
  User,
} from "lucide-react";
import type {
  ReferralCampaign,
  ReferralRankingPrizeTier,
  ReferralRewardCurrency,
  ReferralQualificationRules,
  ReferralRecord,
  ReferralStatus,
  ReferralSystemConfig,
} from "@/types/referral";

const EMPTY_CONFIG: ReferralSystemConfig = {
  id: "referral_system",
  enabled: true,
  codeRequired: false,
  defaultInviterRewardAmount: 100,
  defaultInviterRewardCurrency: "coins",
  defaultInvitedRewardAmount: 50,
  defaultInvitedRewardCurrency: "coins",
  invitedRewardEnabled: true,
  rankingEnabled: true,
  limitValidPerDay: 20,
  limitRewardedPerUser: 500,
  qualificationRules: {
    requireEmailVerified: false,
    requireProfileCompleted: true,
    minAdsWatched: 0,
    minMatchesPlayed: 1,
    minMissionRewardsClaimed: 0,
  },
  antiFraudRules: {
    blockSelfReferral: true,
    flagBurstSignups: true,
    burstSignupThreshold: 5,
    requireManualReviewForSuspected: false,
  },
  rankingRules: {
    daily: [],
    weekly: [],
    monthly: [],
    all: [],
  },
  activeCampaignId: null,
  campaignText: "",
};

const EMPTY_CAMPAIGN = {
  id: "",
  name: "",
  description: "",
  regulationText: "",
  startAt: "",
  endAt: "",
  isActive: true,
  inviterRewardAmount: "100",
  inviterRewardCurrency: "coins" as ReferralRewardCurrency,
  invitedRewardAmount: "50",
  invitedRewardCurrency: "coins" as ReferralRewardCurrency,
  invitedRewardEnabled: true,
  requireEmailVerified: false,
  requireProfileCompleted: true,
  minAdsWatched: "0",
  minMatchesPlayed: "1",
  minMissionRewardsClaimed: "0",
};

function normalizePrizeTiers(value: unknown): ReferralRankingPrizeTier[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as Partial<ReferralRankingPrizeTier> & {
        coins?: number;
        gems?: number;
      };
      if (typeof row.amount === "number" && row.amount > 0) {
        return {
          posicaoMax: Math.max(1, Math.floor(Number(row.posicaoMax) || 1)),
          amount: Math.max(0, Math.floor(Number(row.amount) || 0)),
          currency: (row.currency ?? "coins") as ReferralRewardCurrency,
        };
      }
      if (typeof row.coins === "number" && row.coins > 0) {
        return {
          posicaoMax: Math.max(1, Math.floor(Number(row.posicaoMax) || 1)),
          amount: Math.max(0, Math.floor(Number(row.coins) || 0)),
          currency: "coins" as ReferralRewardCurrency,
        };
      }
      if (typeof row.gems === "number" && row.gems > 0) {
        return {
          posicaoMax: Math.max(1, Math.floor(Number(row.posicaoMax) || 1)),
          amount: Math.max(0, Math.floor(Number(row.gems) || 0)),
          currency: "gems" as ReferralRewardCurrency,
        };
      }
      return null;
    })
    .filter((item): item is ReferralRankingPrizeTier => Boolean(item && item.amount > 0))
    .sort((a, b) => a.posicaoMax - b.posicaoMax);
}

function toDateInput(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 16);
    } catch {
      return "";
    }
  }
  return "";
}

function criteriaSummary(rules: ReferralQualificationRules): string[] {
  return buildReferralQualificationChecklist(rules);
}

function rewardCurrencyLabel(currency: ReferralRewardCurrency): string {
  return currency === "coins" ? "PR" : currency === "gems" ? "TICKET" : "CASH";
}

function displayRewardAmount(amount: number | undefined, currency: ReferralRewardCurrency | null | undefined): string {
  return `${amount ?? 0} ${rewardCurrencyLabel(currency ?? "coins")}`;
}

function getProgressItemState(item: ReferralQualificationStatusItem): "done" | "in_progress" | "todo" {
  if (item.completed) return "done";
  if (
    typeof item.current === "number" &&
    typeof item.target === "number" &&
    item.current > 0 &&
    item.current < item.target
  ) {
    return "in_progress";
  }
  return "todo";
}

function getProgressSummaryBadge(
  items: ReferralQualificationStatusItem[],
): { label: string; className: string } {
  const completed = items.filter((item) => item.completed).length;
  if (completed === items.length) {
    return {
      label: "Pronto para recompensa",
      className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    };
  }
  if (completed > 0) {
    return {
      label: "Missao em andamento",
      className: "border-cyan-400/20 bg-cyan-500/10 text-cyan-200",
    };
  }
  return {
    label: "Falta comecar",
    className: "border-amber-400/20 bg-amber-500/10 text-amber-200",
  };
}

function getProgressItemIcon(item: ReferralQualificationStatusItem): LucideIcon {
  switch (item.id) {
    case "profileCompleted":
      return User;
    case "emailVerified":
      return Mail;
    case "matchesPlayed":
      return Gamepad2;
    case "adsWatched":
      return Play;
    case "missionRewardsClaimed":
      return Gift;
    default:
      return CheckCircle2;
  }
}

export default function AdminIndicacoesPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "system" | "campaigns" | "queue">("overview");
  const [systemEditorTab, setSystemEditorTab] = useState<"geral" | "recompensas" | "ranking" | "requisitos">(
    "geral",
  );
  const [campaignEditorTab, setCampaignEditorTab] = useState<"dados" | "recompensas" | "requisitos" | "biblioteca">(
    "dados",
  );
  const [config, setConfig] = useState<ReferralSystemConfig>(EMPTY_CONFIG);
  const [dailyPrizeTiers, setDailyPrizeTiers] = useState<ReferralRankingPrizeTier[]>(EMPTY_CONFIG.rankingRules.daily);
  const [weeklyPrizeTiers, setWeeklyPrizeTiers] = useState<ReferralRankingPrizeTier[]>(EMPTY_CONFIG.rankingRules.weekly);
  const [monthlyPrizeTiers, setMonthlyPrizeTiers] = useState<ReferralRankingPrizeTier[]>(EMPTY_CONFIG.rankingRules.monthly);
  const [campaigns, setCampaigns] = useState<ReferralCampaign[]>([]);
  const [campaignForm, setCampaignForm] = useState(EMPTY_CAMPAIGN);
  const [rows, setRows] = useState<ReferralRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | ReferralStatus>("all");
  const [msg, setMsg] = useState<string | null>(null);
  const [closingPeriod, setClosingPeriod] = useState<"" | "daily" | "weekly" | "monthly">("");
  const [busyReferralAction, setBusyReferralAction] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    pending: number;
    valid: number;
    rewarded: number;
    blocked: number;
  }>({
    total: 0,
    pending: 0,
    valid: 0,
    rewarded: 0,
    blocked: 0,
  });

  const loadAll = useCallback(async () => {
    const db = getFirebaseFirestore();
    const [cfgSnap, campaignSnap, referralSnap, total, pending, valid, rewarded, blocked] = await Promise.all([
      getDoc(doc(db, COLLECTIONS.systemConfigs, "referral_system")),
      getDocs(query(collection(db, COLLECTIONS.referralCampaigns), orderBy("startAt", "desc"), limit(20))),
      getDocs(
        statusFilter === "all"
          ? query(collection(db, COLLECTIONS.referrals), orderBy("createdAt", "desc"), limit(100))
          : query(
              collection(db, COLLECTIONS.referrals),
              where("status", "==", statusFilter),
              orderBy("createdAt", "desc"),
              limit(100),
            ),
      ),
      getCountFromServer(collection(db, COLLECTIONS.referrals)),
      getCountFromServer(query(collection(db, COLLECTIONS.referrals), where("status", "==", "pending"))),
      getCountFromServer(query(collection(db, COLLECTIONS.referrals), where("status", "==", "valid"))),
      getCountFromServer(query(collection(db, COLLECTIONS.referrals), where("status", "==", "rewarded"))),
      getCountFromServer(query(collection(db, COLLECTIONS.referrals), where("status", "==", "blocked"))),
    ]);

    if (cfgSnap.exists()) {
      const raw = cfgSnap.data() as Record<string, unknown>;
      const rawConfig = raw as unknown as Partial<ReferralSystemConfig>;
      const nextConfig: ReferralSystemConfig = {
        ...EMPTY_CONFIG,
        ...rawConfig,
        defaultInviterRewardAmount: Math.max(
          0,
          Number(raw.defaultInviterRewardAmount ?? raw.defaultInviterRewardCoins ?? EMPTY_CONFIG.defaultInviterRewardAmount) || 0,
        ),
        defaultInviterRewardCurrency: (raw.defaultInviterRewardCurrency as ReferralRewardCurrency) || "coins",
        defaultInvitedRewardAmount: Math.max(
          0,
          Number(raw.defaultInvitedRewardAmount ?? raw.defaultInvitedRewardCoins ?? EMPTY_CONFIG.defaultInvitedRewardAmount) || 0,
        ),
        defaultInvitedRewardCurrency: (raw.defaultInvitedRewardCurrency as ReferralRewardCurrency) || "coins",
        rankingEnabled: raw.rankingEnabled !== false,
        rankingRules: {
          ...EMPTY_CONFIG.rankingRules,
          ...((raw.rankingRules as ReferralSystemConfig["rankingRules"] | undefined) ?? {}),
        },
      };
      setConfig(nextConfig);
      setDailyPrizeTiers(normalizePrizeTiers(nextConfig.rankingRules.daily));
      setWeeklyPrizeTiers(normalizePrizeTiers(nextConfig.rankingRules.weekly));
      setMonthlyPrizeTiers(normalizePrizeTiers(nextConfig.rankingRules.monthly));
    }
    setCampaigns(campaignSnap.docs.map((item) => ({ id: item.id, ...item.data() }) as ReferralCampaign));
    setRows(referralSnap.docs.map((item) => ({ id: item.id, ...item.data() }) as ReferralRecord));
    setStats({
      total: total.data().count,
      pending: pending.data().count,
      valid: valid.data().count,
      rewarded: rewarded.data().count,
      blocked: blocked.data().count,
    });
  }, [statusFilter]);

  useEffect(() => {
    loadAll().catch(() => undefined);
  }, [loadAll]);

  const activeCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === config.activeCampaignId) ?? null,
    [campaigns, config.activeCampaignId],
  );
  const activeRules = useMemo(
    () => resolveReferralQualificationRules(config, activeCampaign),
    [activeCampaign, config],
  );
  const activeCriteria = useMemo(() => criteriaSummary(activeRules), [activeRules]);
  const qualificationItems = useMemo(
    () => buildReferralQualificationStatus(activeRules, null),
    [activeRules],
  );
  const completionRate = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.round((stats.rewarded / stats.total) * 100);
  }, [stats.rewarded, stats.total]);

  async function saveConfig() {
    setMsg(null);
    try {
      const nextConfig: ReferralSystemConfig = {
        ...config,
        rankingRules: {
          ...config.rankingRules,
          daily: dailyPrizeTiers,
          weekly: weeklyPrizeTiers,
          monthly: monthlyPrizeTiers,
          all: config.rankingRules.all,
        },
      };
      const db = getFirebaseFirestore();
      await setDoc(
        doc(db, COLLECTIONS.systemConfigs, "referral_system"),
        {
          ...nextConfig,
          updatedAt: new Date(),
        },
        { merge: true },
      );
      setMsg("Configurações de indicação salvas.");
      await loadAll();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Erro ao salvar configurações.");
    }
  }

  async function saveCampaign() {
    setMsg(null);
    try {
      const db = getFirebaseFirestore();
      const targetId = campaignForm.id.trim() || `campaign_${Date.now()}`;
      await setDoc(
        doc(db, COLLECTIONS.referralCampaigns, targetId),
        {
          id: targetId,
          name: campaignForm.name.trim(),
          description: campaignForm.description.trim(),
          regulationText: campaignForm.regulationText.trim(),
          startAt: campaignForm.startAt ? new Date(campaignForm.startAt) : null,
          endAt: campaignForm.endAt ? new Date(campaignForm.endAt) : null,
          isActive: campaignForm.isActive,
          config: {
            inviterRewardAmount: Number(campaignForm.inviterRewardAmount),
            inviterRewardCurrency: campaignForm.inviterRewardCurrency,
            invitedRewardAmount: Number(campaignForm.invitedRewardAmount),
            invitedRewardCurrency: campaignForm.invitedRewardCurrency,
            invitedRewardEnabled: campaignForm.invitedRewardEnabled,
            qualificationRules: {
              requireEmailVerified: campaignForm.requireEmailVerified,
              requireProfileCompleted: campaignForm.requireProfileCompleted,
              minAdsWatched: Number(campaignForm.minAdsWatched),
              minMatchesPlayed: Number(campaignForm.minMatchesPlayed),
              minMissionRewardsClaimed: Number(campaignForm.minMissionRewardsClaimed),
            },
          },
          updatedAt: new Date(),
        },
        { merge: true },
      );
      setMsg("Campanha salva.");
      setCampaignForm(EMPTY_CAMPAIGN);
      await loadAll();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Erro ao salvar campanha.");
    }
  }

  async function review(referralId: string, action: "block" | "mark_valid" | "reward") {
    setMsg(null);
    setBusyReferralAction(`${referralId}:${action}`);
    try {
      await callFunction("adminReviewReferral", { referralId, action });
      setMsg("Ação aplicada na indicação.");
      await loadAll();
    } catch (error) {
      setMsg(formatFirebaseError(error));
    } finally {
      setBusyReferralAction(null);
    }
  }

  async function reprocessReferral(referralId: string) {
    setMsg(null);
    setBusyReferralAction(`${referralId}:reprocess`);
    try {
      await callFunction("adminReprocessReferral", { referralId });
      setMsg("Progresso da indicação reprocessado.");
      await loadAll();
    } catch (error) {
      setMsg(formatFirebaseError(error));
    } finally {
      setBusyReferralAction(null);
    }
  }

  async function closeRanking(period: "daily" | "weekly" | "monthly") {
    setMsg(null);
    setClosingPeriod(period);
    try {
      await callFunction("adminCloseReferralRanking", { period });
      setMsg("Fechamento do ranking de indicações executado.");
      await loadAll();
    } catch (error) {
      setMsg(formatFirebaseError(error));
    } finally {
      setClosingPeriod("");
    }
  }

  function updatePrizeTier(
    period: "daily" | "weekly" | "monthly",
    index: number,
    patch: Partial<ReferralRankingPrizeTier>,
  ) {
    const setter =
      period === "daily"
        ? setDailyPrizeTiers
        : period === "weekly"
          ? setWeeklyPrizeTiers
          : setMonthlyPrizeTiers;
    setter((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }

  function addPrizeTier(period: "daily" | "weekly" | "monthly") {
    const setter =
      period === "daily"
        ? setDailyPrizeTiers
        : period === "weekly"
          ? setWeeklyPrizeTiers
          : setMonthlyPrizeTiers;
    setter((current) => [
      ...current,
      {
        posicaoMax: current.length > 0 ? current[current.length - 1].posicaoMax + 1 : 1,
        amount: 100,
        currency: "coins",
      },
    ]);
  }

  function removePrizeTier(period: "daily" | "weekly" | "monthly", index: number) {
    const setter =
      period === "daily"
        ? setDailyPrizeTiers
        : period === "weekly"
          ? setWeeklyPrizeTiers
          : setMonthlyPrizeTiers;
    setter((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[28px] border border-cyan-400/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 shadow-[0_0_60px_-20px_rgba(34,211,238,0.28)]">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200">
              <Crown className="h-3.5 w-3.5" />
              Painel Premium
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white">Central de Indicacoes</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Controle campanhas, configure regras da conta convidada, acompanhe gargalos de conversao e tome acoes
              operacionais sem sair da mesma tela.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Pill icon={Layers3} text={activeCampaign?.name ?? "Campanha padrao em uso"} />
              <Pill icon={ShieldCheck} text={`${qualificationItems.length} requisitos ativos`} />
              <Pill icon={BarChart3} text={`${completionRate}% de conversao em recompensa`} />
            </div>
          </div>

          <div className="grid min-w-[280px] flex-1 gap-3 sm:grid-cols-3">
            <QuickHighlight
              icon={Sparkles}
              title="Campanha ativa"
              value={activeCampaign?.name ?? "Padrao"}
              tone="cyan"
            />
            <QuickHighlight
              icon={Activity}
              title="Pendentes agora"
              value={String(stats.pending)}
              tone="amber"
            />
            <QuickHighlight
              icon={ShieldCheck}
              title="Prontas para recompensa"
              value={String(stats.rewarded)}
              tone="emerald"
            />
          </div>
        </div>
      </section>

      {msg ? <AlertBanner tone="info">{msg}</AlertBanner> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat title="Volume total" value={stats.total} subtitle="Indicacoes monitoradas" icon={Layers3} tone="slate" />
        <Stat title="Pendentes" value={stats.pending} subtitle="Aguardando requisitos" icon={Activity} tone="amber" />
        <Stat title="Validas" value={stats.valid} subtitle="Ja qualificadas" icon={ShieldCheck} tone="cyan" />
        <Stat title="Recompensadas" value={stats.rewarded} subtitle="Bonus liberado" icon={Gift} tone="emerald" />
        <Stat title="Bloqueadas" value={stats.blocked} subtitle="Retidas por regra ou revisao" icon={Filter} tone="violet" />
      </section>

      <section className="flex flex-wrap gap-2 rounded-[22px] border border-white/10 bg-slate-900/70 p-2">
        {[
          { id: "overview" as const, label: "Visao geral", icon: BarChart3 },
          { id: "system" as const, label: "Sistema", icon: SlidersHorizontal },
          { id: "campaigns" as const, label: "Campanhas", icon: Sparkles },
          { id: "queue" as const, label: "Fila", icon: Layers3 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
              activeTab === id
                ? "bg-gradient-to-r from-cyan-500/15 via-violet-500/15 to-fuchsia-500/15 text-white ring-1 ring-cyan-400/30"
                : "text-slate-400 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </section>

      {activeTab === "overview" ? (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 rounded-[24px] border border-white/10 bg-slate-900/80 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.9)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Resumo geral</h2>
                <p className="mt-1 text-xs text-slate-400">Panorama rapido da automacao e das recompensas.</p>
              </div>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-bold",
                  config.rankingEnabled
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                    : "border-amber-400/20 bg-amber-500/10 text-amber-200",
                )}
              >
                Ranking {config.rankingEnabled ? "ativo" : "desativado"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <QuickHighlight
                icon={Gift}
                title="Premio indicador"
                value={displayRewardAmount(config.defaultInviterRewardAmount, config.defaultInviterRewardCurrency)}
                tone="cyan"
              />
              <QuickHighlight
                icon={Gift}
                title="Premio convidado"
                value={displayRewardAmount(config.defaultInvitedRewardAmount, config.defaultInvitedRewardCurrency)}
                tone="emerald"
              />
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Requisitos ativos</p>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                {activeCriteria.map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-[24px] border border-white/10 bg-slate-900/80 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.9)]">
            <div>
              <h2 className="text-lg font-semibold text-white">Automacao do ranking</h2>
              <p className="mt-1 text-xs text-slate-400">Feche manualmente apenas quando precisar forcar a premiacao.</p>
            </div>
            <Pill icon={Sparkles} text={`Campanha: ${activeCampaign?.name ?? "Padrao do sistema"}`} />
            <Pill
              icon={Gift}
              text={`Faixas: ${dailyPrizeTiers.length} diaria(s), ${weeklyPrizeTiers.length} semanal(is), ${monthlyPrizeTiers.length} mensal(is)`}
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant="secondary" disabled={closingPeriod !== "" || !config.rankingEnabled} onClick={() => void closeRanking("daily")}>
                {closingPeriod === "daily" ? "Fechando..." : "Fechar diario"}
              </Button>
              <Button variant="secondary" disabled={closingPeriod !== "" || !config.rankingEnabled} onClick={() => void closeRanking("weekly")}>
                {closingPeriod === "weekly" ? "Fechando..." : "Fechar semanal"}
              </Button>
              <Button variant="secondary" disabled={closingPeriod !== "" || !config.rankingEnabled} onClick={() => void closeRanking("monthly")}>
                {closingPeriod === "monthly" ? "Fechando..." : "Fechar mensal"}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className={cn("grid gap-4 xl:grid-cols-[1.1fr_0.9fr]", activeTab !== "system" && activeTab !== "campaigns" && "hidden")}>
        <div className={cn("space-y-4 rounded-[24px] border border-white/10 bg-slate-900/80 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.9)]", activeTab !== "system" && "hidden")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Configuracoes do sistema</h2>
              <p className="mt-1 text-xs text-slate-400">
                Defina a regra base que a conta convidada precisa cumprir para liberar a indicacao.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Regra ativa</p>
              <p className="mt-1 text-sm font-semibold text-white">{activeCampaign ? "Campanha personalizada" : "Padrao do sistema"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
            {([
              { id: "geral", label: "Geral" },
              { id: "recompensas", label: "Recompensas" },
              { id: "ranking", label: "Ranking" },
              { id: "requisitos", label: "Requisitos" },
            ] as const).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSystemEditorTab(item.id)}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-semibold transition",
                  systemEditorTab === item.id
                    ? "bg-gradient-to-r from-cyan-500/15 via-violet-500/15 to-fuchsia-500/15 text-white ring-1 ring-cyan-400/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-white",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {systemEditorTab === "geral" ? (
            <div className="space-y-4">
              <ToggleRow
                label="Sistema ativo"
                checked={config.enabled}
                onChange={(checked) => setConfig((current) => ({ ...current, enabled: checked }))}
              />
              <ToggleRow
                label="Código obrigatório no cadastro"
                checked={config.codeRequired}
                onChange={(checked) => setConfig((current) => ({ ...current, codeRequired: checked }))}
              />
              <ToggleRow
                label="Recompensa para convidado"
                checked={config.invitedRewardEnabled}
                onChange={(checked) => setConfig((current) => ({ ...current, invitedRewardEnabled: checked }))}
              />
              <Field
                label="Limite válido por dia"
                value={String(config.limitValidPerDay)}
                onChange={(value) =>
                  setConfig((current) => ({ ...current, limitValidPerDay: Math.max(0, Number(value) || 0) }))
                }
              />
              <Field
                label="Limite total por usuário"
                value={String(config.limitRewardedPerUser)}
                onChange={(value) =>
                  setConfig((current) => ({ ...current, limitRewardedPerUser: Math.max(0, Number(value) || 0) }))
                }
              />
              <Field
                label="Campanha ativa (ID)"
                value={config.activeCampaignId ?? ""}
                onChange={(value) => setConfig((current) => ({ ...current, activeCampaignId: value || null }))}
              />
              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">Texto da campanha</span>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white"
                  value={config.campaignText ?? ""}
                  onChange={(e) => setConfig((current) => ({ ...current, campaignText: e.target.value }))}
                />
              </label>
            </div>
          ) : null}

          {systemEditorTab === "recompensas" ? (
            <div className="space-y-4">
              <Field
                label={`Valor da recompensa do indicador (${rewardCurrencyLabel(config.defaultInviterRewardCurrency)})`}
                value={String(config.defaultInviterRewardAmount)}
                onChange={(value) =>
                  setConfig((current) => ({ ...current, defaultInviterRewardAmount: Math.max(0, Number(value) || 0) }))
                }
              />
              <SelectField
                label="Moeda da recompensa do indicador"
                value={config.defaultInviterRewardCurrency}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    defaultInviterRewardCurrency: value as ReferralRewardCurrency,
                  }))
                }
                options={[
                  { value: "coins", label: "PR" },
                  { value: "gems", label: "TICKET" },
                  { value: "rewardBalance", label: "CASH" },
                ]}
              />
              <Field
                label="Valor da recompensa do convidado"
                value={String(config.defaultInvitedRewardAmount)}
                onChange={(value) =>
                  setConfig((current) => ({ ...current, defaultInvitedRewardAmount: Math.max(0, Number(value) || 0) }))
                }
              />
              <SelectField
                label="Moeda da recompensa do convidado"
                value={config.defaultInvitedRewardCurrency}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    defaultInvitedRewardCurrency: value as ReferralRewardCurrency,
                  }))
                }
                options={[
                  { value: "coins", label: "PR" },
                  { value: "gems", label: "TICKET" },
                  { value: "rewardBalance", label: "CASH" },
                ]}
              />
            </div>
          ) : null}

          {systemEditorTab === "ranking" ? (
            <div className="space-y-4">
              <ToggleRow
                label="Ranking automatico ativo"
                checked={config.rankingEnabled}
                onChange={(checked) => setConfig((current) => ({ ...current, rankingEnabled: checked }))}
              />
              <PrizeTierEditor
                title="Premiacao do ranking diario"
                periodLabel="diario"
                tiers={dailyPrizeTiers}
                onAdd={() => addPrizeTier("daily")}
                onRemove={(index) => removePrizeTier("daily", index)}
                onChange={(index, patch) => updatePrizeTier("daily", index, patch)}
              />
              <PrizeTierEditor
                title="Premiacao do ranking semanal"
                periodLabel="semanal"
                tiers={weeklyPrizeTiers}
                onAdd={() => addPrizeTier("weekly")}
                onRemove={(index) => removePrizeTier("weekly", index)}
                onChange={(index, patch) => updatePrizeTier("weekly", index, patch)}
              />
              <PrizeTierEditor
                title="Premiacao do ranking mensal"
                periodLabel="mensal"
                tiers={monthlyPrizeTiers}
                onAdd={() => addPrizeTier("monthly")}
                onRemove={(index) => removePrizeTier("monthly", index)}
                onChange={(index, patch) => updatePrizeTier("monthly", index, patch)}
              />
            </div>
          ) : null}

          {systemEditorTab === "requisitos" ? (
            <div className="space-y-4">
              <Field
                label="Min. anuncios da conta convidada"
                value={String(config.qualificationRules.minAdsWatched)}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    qualificationRules: {
                      ...current.qualificationRules,
                      minAdsWatched: Math.max(0, Number(value) || 0),
                    },
                  }))
                }
              />
              <Field
                label="Min. partidas da conta convidada"
                value={String(config.qualificationRules.minMatchesPlayed)}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    qualificationRules: {
                      ...current.qualificationRules,
                      minMatchesPlayed: Math.max(0, Number(value) || 0),
                    },
                  }))
                }
              />
              <Field
                label="Min. missoes resgatadas da conta convidada"
                value={String(config.qualificationRules.minMissionRewardsClaimed)}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    qualificationRules: {
                      ...current.qualificationRules,
                      minMissionRewardsClaimed: Math.max(0, Number(value) || 0),
                    },
                  }))
                }
              />
              <ToggleRow
                label="Exigir e-mail verificado da conta convidada"
                checked={config.qualificationRules.requireEmailVerified}
                onChange={(checked) =>
                  setConfig((current) => ({
                    ...current,
                    qualificationRules: { ...current.qualificationRules, requireEmailVerified: checked },
                  }))
                }
              />
              <ToggleRow
                label="Exigir perfil completo da conta convidada"
                checked={config.qualificationRules.requireProfileCompleted}
                onChange={(checked) =>
                  setConfig((current) => ({
                    ...current,
                    qualificationRules: { ...current.qualificationRules, requireProfileCompleted: checked },
                  }))
                }
              />
              <ToggleRow
                label="Revisão manual para suspeitas"
                checked={config.antiFraudRules.requireManualReviewForSuspected}
                onChange={(checked) =>
                  setConfig((current) => ({
                    ...current,
                    antiFraudRules: {
                      ...current.antiFraudRules,
                      requireManualReviewForSuspected: checked,
                    },
                  }))
                }
              />
            </div>
          ) : null}
          <CriteriaPreviewCard
            title="Criterios em vigor no app"
            description={
              activeCampaign
                ? `A campanha ativa "${activeCampaign.name}" esta sobrescrevendo as regras padrao.`
                : "Sem campanha ativa especifica, o app usa as regras padrao abaixo."
            }
            rules={activeRules}
          />
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Leitura rapida</p>
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              {activeCriteria.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <Button className="w-full" onClick={() => void saveConfig()}>
            Salvar configurações
          </Button>
        </div>

        <div className={cn("space-y-4 rounded-[24px] border border-white/10 bg-slate-900/80 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.9)]", activeTab !== "campaigns" && "hidden")}>
          <div>
            <h2 className="text-lg font-semibold text-white">Campanhas</h2>
            <p className="mt-1 text-xs text-slate-400">
              Campanha ativa: {activeCampaign?.name ?? "nenhuma definida"}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
            {([
              { id: "dados", label: "Dados" },
              { id: "recompensas", label: "Recompensas" },
              { id: "requisitos", label: "Requisitos" },
              { id: "biblioteca", label: "Biblioteca" },
            ] as const).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCampaignEditorTab(item.id)}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-semibold transition",
                  campaignEditorTab === item.id
                    ? "bg-gradient-to-r from-cyan-500/15 via-violet-500/15 to-fuchsia-500/15 text-white ring-1 ring-cyan-400/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-white",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {campaignEditorTab === "dados" ? (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <Button variant="secondary" disabled={closingPeriod !== "" || !config.rankingEnabled} onClick={() => void closeRanking("daily")}>
                  {closingPeriod === "daily" ? "Fechando..." : "Fechar diário"}
                </Button>
                <Button variant="secondary" disabled={closingPeriod !== "" || !config.rankingEnabled} onClick={() => void closeRanking("weekly")}>
                  {closingPeriod === "weekly" ? "Fechando..." : "Fechar semanal"}
                </Button>
                <Button variant="secondary" disabled={closingPeriod !== "" || !config.rankingEnabled} onClick={() => void closeRanking("monthly")}>
                  {closingPeriod === "monthly" ? "Fechando..." : "Fechar mensal"}
                </Button>
              </div>
              <Field label="ID (opcional)" value={campaignForm.id} onChange={(value) => setCampaignForm((current) => ({ ...current, id: value }))} />
              <Field label="Nome" value={campaignForm.name} onChange={(value) => setCampaignForm((current) => ({ ...current, name: value }))} />
              <Field label="Descrição" value={campaignForm.description} onChange={(value) => setCampaignForm((current) => ({ ...current, description: value }))} />
              <Field label="Início" value={campaignForm.startAt} onChange={(value) => setCampaignForm((current) => ({ ...current, startAt: value }))} type="datetime-local" />
              <Field label="Fim" value={campaignForm.endAt} onChange={(value) => setCampaignForm((current) => ({ ...current, endAt: value }))} type="datetime-local" />
              <ToggleRow label="Campanha ativa" checked={campaignForm.isActive} onChange={(checked) => setCampaignForm((current) => ({ ...current, isActive: checked }))} />
              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">Regulamento / observacoes</span>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white"
                  value={campaignForm.regulationText}
                  onChange={(e) => setCampaignForm((current) => ({ ...current, regulationText: e.target.value }))}
                />
              </label>
            </div>
          ) : null}

          {campaignEditorTab === "recompensas" ? (
            <div className="space-y-4">
              <Field
                label={`Valor da recompensa do indicador (${rewardCurrencyLabel(campaignForm.inviterRewardCurrency)})`}
                value={campaignForm.inviterRewardAmount}
                onChange={(value) => setCampaignForm((current) => ({ ...current, inviterRewardAmount: value }))}
              />
              <SelectField
                label="Moeda da recompensa do indicador"
                value={campaignForm.inviterRewardCurrency}
                onChange={(value) =>
                  setCampaignForm((current) => ({
                    ...current,
                    inviterRewardCurrency: value as ReferralRewardCurrency,
                  }))
                }
                options={[
                  { value: "coins", label: "PR" },
                  { value: "gems", label: "TICKET" },
                  { value: "rewardBalance", label: "CASH" },
                ]}
              />
              <Field
                label="Valor da recompensa do convidado"
                value={campaignForm.invitedRewardAmount}
                onChange={(value) => setCampaignForm((current) => ({ ...current, invitedRewardAmount: value }))}
              />
              <SelectField
                label="Moeda da recompensa do convidado"
                value={campaignForm.invitedRewardCurrency}
                onChange={(value) =>
                  setCampaignForm((current) => ({
                    ...current,
                    invitedRewardCurrency: value as ReferralRewardCurrency,
                  }))
                }
                options={[
                  { value: "coins", label: "PR" },
                  { value: "gems", label: "TICKET" },
                  { value: "rewardBalance", label: "CASH" },
                ]}
              />
              <ToggleRow label="Recompensa convidado" checked={campaignForm.invitedRewardEnabled} onChange={(checked) => setCampaignForm((current) => ({ ...current, invitedRewardEnabled: checked }))} />
            </div>
          ) : null}

          {campaignEditorTab === "requisitos" ? (
            <div className="space-y-4">
              <Field label="Min. anuncios da conta convidada na campanha" value={campaignForm.minAdsWatched} onChange={(value) => setCampaignForm((current) => ({ ...current, minAdsWatched: value }))} />
              <Field label="Min. partidas da conta convidada na campanha" value={campaignForm.minMatchesPlayed} onChange={(value) => setCampaignForm((current) => ({ ...current, minMatchesPlayed: value }))} />
              <Field
                label="Min. missoes resgatadas da conta convidada na campanha"
                value={campaignForm.minMissionRewardsClaimed}
                onChange={(value) => setCampaignForm((current) => ({ ...current, minMissionRewardsClaimed: value }))}
              />
              <ToggleRow
                label="Exigir e-mail verificado da conta convidada na campanha"
                checked={campaignForm.requireEmailVerified}
                onChange={(checked) => setCampaignForm((current) => ({ ...current, requireEmailVerified: checked }))}
              />
              <ToggleRow
                label="Exigir perfil completo da conta convidada na campanha"
                checked={campaignForm.requireProfileCompleted}
                onChange={(checked) => setCampaignForm((current) => ({ ...current, requireProfileCompleted: checked }))}
              />
              <CriteriaPreviewCard
                title="Preview dos criterios da campanha"
                description="Este resumo mostra o que o convidado precisara cumprir se esta campanha estiver ativa."
                rules={{
                  requireEmailVerified: campaignForm.requireEmailVerified,
                  requireProfileCompleted: campaignForm.requireProfileCompleted,
                  minAdsWatched: Math.max(0, Number(campaignForm.minAdsWatched) || 0),
                  minMatchesPlayed: Math.max(0, Number(campaignForm.minMatchesPlayed) || 0),
                  minMissionRewardsClaimed: Math.max(0, Number(campaignForm.minMissionRewardsClaimed) || 0),
                }}
              />
            </div>
          ) : null}

          {campaignEditorTab === "biblioteca" ? (
            <div className="space-y-2 border-t border-white/10 pt-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Biblioteca de campanhas
              </div>
              {campaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  type="button"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:border-cyan-400/25 hover:bg-white/5"
                  onClick={() => {
                    const legacyCampaignConfig = campaign.config as unknown as {
                      inviterRewardCoins?: number;
                    };
                    setCampaignForm({
                      id: campaign.id,
                      name: campaign.name,
                      description: campaign.description,
                      regulationText: campaign.regulationText ?? "",
                      startAt: toDateInput(campaign.startAt),
                      endAt: toDateInput(campaign.endAt),
                      isActive: campaign.isActive,
                      inviterRewardAmount: String(
                        campaign.config.inviterRewardAmount ?? legacyCampaignConfig.inviterRewardCoins,
                      ),
                      inviterRewardCurrency: campaign.config.inviterRewardCurrency ?? "coins",
                      invitedRewardAmount: String(campaign.config.invitedRewardAmount),
                      invitedRewardCurrency: campaign.config.invitedRewardCurrency,
                      invitedRewardEnabled: campaign.config.invitedRewardEnabled,
                      requireEmailVerified: campaign.config.qualificationRules.requireEmailVerified,
                      requireProfileCompleted: campaign.config.qualificationRules.requireProfileCompleted,
                      minAdsWatched: String(campaign.config.qualificationRules.minAdsWatched),
                      minMatchesPlayed: String(campaign.config.qualificationRules.minMatchesPlayed),
                      minMissionRewardsClaimed: String(campaign.config.qualificationRules.minMissionRewardsClaimed),
                    });
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{campaign.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{campaign.description}</p>
                    </div>
                    {campaign.id === config.activeCampaignId ? (
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-200">
                        Ativa
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          <Button className="w-full" onClick={() => void saveCampaign()}>
            Salvar campanha
          </Button>
        </div>
      </section>

      <section className={cn("space-y-4 rounded-[24px] border border-white/10 bg-slate-900/80 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.9)]", activeTab !== "queue" && "hidden")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Fila de indicações</h2>
            <p className="text-xs text-slate-400">
              Acompanhe pendências, reprocesse progresso e resolva manualmente casos especiais.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              className="bg-transparent text-sm text-white outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | ReferralStatus)}
            >
              <option value="all">Todas</option>
              <option value="pending">Pendentes</option>
              <option value="valid">Válidas</option>
              <option value="rewarded">Recompensadas</option>
              <option value="blocked">Bloqueadas</option>
              <option value="invalid">Inválidas</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.9))] p-4 shadow-[0_18px_50px_-30px_rgba(34,211,238,0.2)]"
            >
              {(() => {
                const progressItems = buildReferralQualificationStatus(
                  row.qualificationSnapshot ?? activeRules,
                  row.progressSnapshot,
                );
                const progressBadge = getProgressSummaryBadge(progressItems);

                return (
                  <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">
                    {row.inviterName || row.inviterUserId} → {row.invitedUserName || row.invitedUserEmail || row.invitedUserId}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Status: {row.status} · Código: {row.invitedByCode} · Campanha: {row.campaignName || "padrão"}
                  </p>
                  <span className={cn("mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-bold", progressBadge.className)}>
                    {progressBadge.label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={busyReferralAction !== null}
                    onClick={() => void reprocessReferral(row.id)}
                  >
                    <RefreshCw className={cn("h-4 w-4", busyReferralAction === `${row.id}:reprocess` && "animate-spin")} />
                    Reprocessar
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busyReferralAction !== null}
                    onClick={() => void review(row.id, "mark_valid")}
                  >
                    Validar
                  </Button>
                  <Button disabled={busyReferralAction !== null} onClick={() => void review(row.id, "reward")}>
                    Recompensar
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busyReferralAction !== null}
                    onClick={() => void review(row.id, "block")}
                  >
                    Bloquear
                  </Button>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Criterios desta indicacao</p>
                <div className="mt-2 space-y-1.5 text-sm text-slate-200">
                  {criteriaSummary(row.qualificationSnapshot ?? activeRules).map((item) => (
                    <p key={`${row.id}-${item}`}>• {item}</p>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                  <span>Indicador: {row.inviterName || row.inviterUserId}</span>
                  <span>
                    Premio convidado:{" "}
                    {displayRewardAmount(row.invitedRewardAmount ?? row.invitedRewardCoins, row.invitedRewardCurrency)}
                  </span>
                  <span>
                    Premio indicador:{" "}
                    {displayRewardAmount(row.inviterRewardAmount ?? row.inviterRewardCoins, row.inviterRewardCurrency)}
                  </span>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-500/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Progresso atual</p>
                <p className="mt-2 text-xs text-slate-400">
                  {summarizeReferralQualificationPending(progressItems)}
                </p>
                <div className="mt-2 space-y-1.5 text-sm text-slate-100">
                  {progressItems.map((item) => (
                    <div
                      key={`${row.id}-${item.id}`}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
                        getProgressItemState(item) === "done" && "border-emerald-400/15 bg-emerald-500/5",
                        getProgressItemState(item) === "in_progress" && "border-cyan-400/15 bg-cyan-500/5",
                        getProgressItemState(item) === "todo" && "border-white/10 bg-black/20",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {(() => {
                          const Icon = getProgressItemIcon(item);
                          return (
                            <Icon
                              className={cn(
                                "h-4 w-4 shrink-0",
                                getProgressItemState(item) === "done" && "text-emerald-300",
                                getProgressItemState(item) === "in_progress" && "text-cyan-300",
                                getProgressItemState(item) === "todo" && "text-white/50",
                              )}
                            />
                          );
                        })()}
                        <span>{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px] font-bold",
                            getProgressItemState(item) === "done" &&
                              "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
                            getProgressItemState(item) === "in_progress" &&
                              "border-cyan-400/20 bg-cyan-500/10 text-cyan-200",
                            getProgressItemState(item) === "todo" && "border-white/10 bg-black/20 text-white/60",
                          )}
                        >
                          {getProgressItemState(item) === "done"
                            ? "Concluido"
                            : getProgressItemState(item) === "in_progress"
                              ? "Em andamento"
                              : "Falta fazer"}
                        </span>
                        <span className={item.completed ? "text-emerald-300" : "text-amber-200"}>
                          {item.progressText}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
                  </>
                );
              })()}
            </article>
          ))}
          {rows.length === 0 ? <p className="text-sm text-slate-500">Nenhuma indicação neste filtro.</p> : null}
        </div>
      </section>
    </div>
  );
}

function Pill({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
      <Icon className="h-3.5 w-3.5 text-cyan-300" />
      {text}
    </span>
  );
}

function QuickHighlight({
  icon: Icon,
  title,
  value,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  tone: "cyan" | "amber" | "emerald";
}) {
  const toneClasses = {
    cyan: "border-cyan-400/20 bg-cyan-500/10 text-cyan-200",
    amber: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
  } as const;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className={cn("inline-flex rounded-xl border p-2", toneClasses[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{title}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function Stat({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
  tone: "slate" | "amber" | "cyan" | "emerald" | "violet";
}) {
  const toneClasses = {
    slate: "border-white/10 bg-slate-900/80 text-slate-200",
    amber: "border-amber-400/15 bg-amber-500/10 text-amber-200",
    cyan: "border-cyan-400/15 bg-cyan-500/10 text-cyan-200",
    emerald: "border-emerald-400/15 bg-emerald-500/10 text-emerald-200",
    violet: "border-violet-400/15 bg-violet-500/10 text-violet-200",
  } as const;

  return (
    <div className="rounded-[22px] border border-white/10 bg-slate-900/80 p-4 shadow-[0_16px_50px_-35px_rgba(34,211,238,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-300">{title}</p>
          <p className="mt-1 text-3xl font-black text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className={cn("rounded-2xl border p-2.5", toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "number",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-300">{label}</span>
      <input
        type={type}
        className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-300">{label}</span>
      <select
        className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <span className="text-sm text-white">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function PrizeTierEditor({
  title,
  periodLabel,
  tiers,
  onAdd,
  onRemove,
  onChange,
}: {
  title: string;
  periodLabel: string;
  tiers: ReferralRankingPrizeTier[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, patch: Partial<ReferralRankingPrizeTier>) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Defina por faixa a premiacao automatica do ranking {periodLabel}.
          </p>
        </div>
        <Button variant="secondary" onClick={onAdd}>
          Adicionar faixa
        </Button>
      </div>
      <div className="mt-4 space-y-3">
        {tiers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
            Nenhuma faixa criada ainda.
          </div>
        ) : (
          tiers.map((tier, index) => (
            <div key={`${periodLabel}-${index}`} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
              <Field
                label="Ate a posicao"
                value={String(tier.posicaoMax)}
                onChange={(value) => onChange(index, { posicaoMax: Math.max(1, Number(value) || 1) })}
              />
              <Field
                label="Valor"
                value={String(tier.amount)}
                onChange={(value) => onChange(index, { amount: Math.max(0, Number(value) || 0) })}
              />
              <SelectField
                label="Moeda"
                value={tier.currency}
                onChange={(value) => onChange(index, { currency: value as ReferralRewardCurrency })}
                options={[
                  { value: "coins", label: "PR" },
                  { value: "gems", label: "TICKET" },
                  { value: "rewardBalance", label: "CASH" },
                ]}
              />
              <div className="flex items-end">
                <Button variant="danger" className="w-full" onClick={() => onRemove(index)}>
                  Remover
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CriteriaPreviewCard({
  title,
  description,
  rules,
}: {
  title: string;
  description: string;
  rules: ReferralQualificationRules;
}) {
  return (
    <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-300">{description}</p>
      <div className="mt-3 space-y-1.5 text-sm text-slate-100">
        {criteriaSummary(rules).map((item) => (
          <p key={item}>• {item}</p>
        ))}
      </div>
    </div>
  );
}
