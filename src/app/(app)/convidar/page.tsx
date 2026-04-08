"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { cn } from "@/lib/utils/cn";
import { resolveAvatarUrl } from "@/lib/users/avatar";
import { useReferralDashboard } from "@/hooks/useReferralDashboard";
import {
  buildReferralQualificationStatus,
  resolveReferralQualificationRules,
  summarizeReferralQualificationPending,
  type ReferralQualificationStatusItem,
} from "@/lib/referral/qualificationRules";
import type {
  ReferralCampaign,
  ReferralRankingPrizeTier,
  ReferralRewardCurrency,
  ReferralQualificationProgress,
  ReferralQualificationRules,
  ReferralRankingPeriod,
  ReferralStatus,
  ReferralSystemConfig,
} from "@/types/referral";
import {
  CheckCircle2,
  Copy,
  Gamepad2,
  Gift,
  Mail,
  Medal,
  Play,
  Share2,
  Sparkles,
  Trophy,
  type LucideIcon,
  User,
  UserPlus2,
  Users,
} from "lucide-react";

type TabId = "convite" | "convidados" | "ranking";

function statusLabel(status: ReferralStatus): string {
  switch (status) {
    case "pending":
      return "Pendente";
    case "valid":
      return "Válida";
    case "rewarded":
      return "Recompensada";
    case "blocked":
      return "Bloqueada";
    case "invalid":
      return "Inválida";
    default:
      return status;
  }
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

function rewardCurrencyLabel(currency: ReferralRewardCurrency | null | undefined): string {
  return currency === "gems" ? "TICKET" : currency === "rewardBalance" ? "CASH" : "PR";
}

function getRankingCurrencySummary(
  rankingPrizes:
    | {
        daily: Array<{ currency: ReferralRewardCurrency }>;
        weekly: Array<{ currency: ReferralRewardCurrency }>;
        monthly: Array<{ currency: ReferralRewardCurrency }>;
        all: Array<{ currency: ReferralRewardCurrency }>;
      }
    | undefined
    | null,
  period: ReferralRankingPeriod,
): string {
  const tiers =
    period === "daily"
      ? rankingPrizes?.daily ?? []
      : period === "weekly"
        ? rankingPrizes?.weekly ?? []
        : period === "monthly"
          ? rankingPrizes?.monthly ?? []
          : rankingPrizes?.all ?? [];
  const currencies = [...new Set(tiers.map((tier) => tier.currency))];
  if (currencies.length === 0) return "PR";
  if (currencies.length === 1) return rewardCurrencyLabel(currencies[0]);
  return "moedas por faixa";
}

function getRankingPrizeTiers(
  config: ReferralSystemConfig | null,
  campaign: ReferralCampaign | null,
  period: ReferralRankingPeriod,
): ReferralRankingPrizeTier[] {
  const fromCampaign =
    period === "daily"
      ? campaign?.config.rankingPrizes?.daily
      : period === "weekly"
        ? campaign?.config.rankingPrizes?.weekly
        : period === "monthly"
          ? campaign?.config.rankingPrizes?.monthly
          : campaign?.config.rankingPrizes?.all;
  if (fromCampaign && fromCampaign.length > 0) return fromCampaign;

  const fromConfig =
    period === "daily"
      ? config?.rankingRules?.daily
      : period === "weekly"
        ? config?.rankingRules?.weekly
        : period === "monthly"
          ? config?.rankingRules?.monthly
          : config?.rankingRules?.all;
  return fromConfig ?? [];
}

function formatRankingTierLabel(tier: ReferralRankingPrizeTier, index: number, prev?: ReferralRankingPrizeTier): string {
  const start = index === 0 ? 1 : (prev?.posicaoMax ?? 0) + 1;
  const end = tier.posicaoMax;
  return start === end ? `${start}º lugar` : `${start}º ao ${end}º lugar`;
}

function findPrizeTierForPosition(
  tiers: ReferralRankingPrizeTier[],
  position: number | null,
): ReferralRankingPrizeTier | null {
  if (!position) return null;
  return tiers.find((tier) => position <= tier.posicaoMax) ?? null;
}

function getReferralEarnedTotal(
  currency: ReferralRewardCurrency,
  profile:
    | {
        referralTotalEarnedCoins?: number;
        referralTotalEarnedGems?: number;
        referralTotalEarnedRewardBalance?: number;
      }
    | null
    | undefined,
): number {
  if (!profile) return 0;
  if (currency === "gems") return profile.referralTotalEarnedGems ?? 0;
  if (currency === "rewardBalance") return profile.referralTotalEarnedRewardBalance ?? 0;
  return profile.referralTotalEarnedCoins ?? 0;
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

export default function ConvidarPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<TabId>("convite");
  const [period, setPeriod] = useState<ReferralRankingPeriod>("daily");
  const [copied, setCopied] = useState<string | null>(null);
  const { config, campaign, invitedRows, myReferral, ranking, myRanking } = useReferralDashboard(period);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inviteCode = profile?.codigoConvite ?? "—";
  const inviteLink = profile ? `${origin}/cadastro?convite=${profile.codigoConvite}` : "";
  const invitedCount = profile?.referralInvitedCount ?? invitedRows.length;
  const validCount = profile?.referralQualifiedCount ?? 0;
  const pendingCount = profile?.referralPendingCount ?? invitedRows.filter((row) => row.status === "pending").length;
  const activeRules = resolveReferralQualificationRules(config, campaign);
  const challengeItems = buildReferralQualificationStatus(activeRules);
  const myReferralRules = myReferral?.qualificationSnapshot ?? activeRules;
  const inviterRewardCurrency = campaign?.config.inviterRewardCurrency ?? config?.defaultInviterRewardCurrency ?? "coins";
  const invitedRewardCurrency = campaign?.config.invitedRewardCurrency ?? config?.defaultInvitedRewardCurrency ?? "coins";
  const rankingCurrencySummary = getRankingCurrencySummary(campaign?.config.rankingPrizes, period);
  const rankingPrizeTiers = getRankingPrizeTiers(config, campaign, period);
  const totalEarned = getReferralEarnedTotal(inviterRewardCurrency, profile);
  const podiumEntries = ranking.slice(0, 3);
  const remainingRanking = ranking.slice(3);

  const rankingPosition = useMemo(() => {
    if (!myRanking) return null;
    const index = ranking.findIndex((entry) => entry.userId === myRanking.userId);
    return index >= 0 ? index + 1 : null;
  }, [ranking, myRanking]);
  const estimatedPrizeTier = useMemo(
    () => findPrizeTierForPosition(rankingPrizeTiers, rankingPosition),
    [rankingPosition, rankingPrizeTiers],
  );

  async function copyValue(value: string, kind: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  }

  async function shareInvite() {
    if (!inviteLink) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Entre no Recompensa Premiada",
          text: `Use meu código ${inviteCode} e entre no app.`,
          url: inviteLink,
        });
        return;
      } catch {
        /* ignore */
      }
    }
    await copyValue(inviteLink, "share");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Convide e Ganhe</h1>
        <p className="mt-1 text-sm text-white/55">
          Compartilhe seu código, acompanhe convidados e suba no ranking de indicações.
        </p>
      </div>

      {copied ? <AlertBanner tone="success">Copiado com sucesso.</AlertBanner> : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Convidados</p>
          <p className="mt-1 text-2xl font-black text-white">{invitedCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/70">Válidas</p>
          <p className="mt-1 text-2xl font-black text-white">{validCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/70">Pendentes</p>
          <p className="mt-1 text-2xl font-black text-white">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/70">Ganhos</p>
          <p className="mt-1 text-2xl font-black text-white">
            {totalEarned} {rewardCurrencyLabel(inviterRewardCurrency)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5">
        {[
          { id: "convite" as const, label: "Meu convite", icon: Gift },
          { id: "convidados" as const, label: "Meus convidados", icon: Users },
          { id: "ranking" as const, label: "Ranking", icon: Trophy },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition",
              tab === id
                ? "bg-gradient-to-r from-cyan-600/25 via-violet-600/30 to-fuchsia-600/25 text-white"
                : "text-white/55 hover:bg-white/5 hover:text-white/80",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "convite" ? (
        <section className="space-y-4">
          <div className="rounded-[1.7rem] border border-violet-400/20 bg-gradient-to-br from-violet-950/30 via-slate-950/95 to-slate-950 p-5 shadow-[0_0_40px_-16px_rgba(139,92,246,0.35)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200/70">Seu código</p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div>
                <p className="text-2xl font-black tracking-[0.12em] text-white">{inviteCode}</p>
                <p className="mt-1 text-xs text-white/45">Compartilhe este código ou o link abaixo.</p>
              </div>
              <Button variant="secondary" onClick={() => void copyValue(inviteCode, "code")} disabled={!profile}>
                <Copy className="h-4 w-4" />
                Copiar
              </Button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Button onClick={() => void copyValue(inviteLink, "link")} disabled={!profile}>
                <Copy className="h-4 w-4" />
                Copiar link
              </Button>
              <Button variant="secondary" onClick={() => void shareInvite()} disabled={!profile}>
                <Share2 className="h-4 w-4" />
                Compartilhar convite
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-1 h-5 w-5 text-amber-300" />
              <div className="space-y-1">
                <p className="font-semibold text-white">{campaign?.name ?? "Campanha padrão de indicação"}</p>
                <p className="text-sm text-white/60">
                  {campaign?.description ??
                    config?.campaignText ??
                    "Ganhe recompensas quando seus convidados cumprirem as regras da campanha ativa."}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold text-cyan-200">
                Indicador recebe {rewardCurrencyLabel(inviterRewardCurrency)}
              </span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-200">
                Convidado recebe {rewardCurrencyLabel(invitedRewardCurrency)}
              </span>
            </div>
            <p className="mt-3 text-xs text-white/45">
              Se a moeda for alterada no painel admin depois, as próximas premiações passam a seguir a nova configuração
              automaticamente.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
            <p className="text-sm font-semibold text-white">Complete o desafio</p>
            <p className="mt-2 text-sm text-white/60">
              Para a indicacao sair de pendente e liberar a recompensa, a conta convidada precisa cumprir:
            </p>
            <p className="mt-2 text-xs text-white/45">
              Nao precisa conectar com quem convidou. Basta a conta convidada jogar e cumprir os objetivos abaixo.
            </p>
            <div className="mt-3 space-y-2">
              {challengeItems.map((item) => {
                const Icon = getProgressItemIcon(item);
                return (
                  <div key={item.id} className="flex items-start gap-2 text-sm text-white/80">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
            <p className="text-sm font-semibold text-white">Seu vínculo atual</p>
            <p className="mt-2 text-sm text-white/60">
              {myReferral
                ? `Você entrou com um convite e seu status está em ${statusLabel(myReferral.status)}.`
                : "Você não entrou com código de convite ou ainda não há vínculo registrado para sua conta."}
            </p>
            {myReferral ? (
              <ProgressChecklist
                className="mt-4"
                rules={myReferralRules}
                progress={myReferral.progressSnapshot}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "convidados" ? (
        <section className="space-y-3">
          {invitedRows.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-10 text-center">
              <UserPlus2 className="mx-auto h-8 w-8 text-white/35" />
              <p className="mt-3 text-sm text-white/55">Nenhum convidado ainda. Compartilhe seu código para começar.</p>
            </div>
          ) : (
            invitedRows.map((row) => (
              <article key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                {(() => {
                  const progressItems = buildReferralQualificationStatus(
                    row.qualificationSnapshot ?? activeRules,
                    row.progressSnapshot,
                  );
                  const badge = getProgressSummaryBadge(progressItems);

                  return (
                    <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{row.invitedUserName || row.invitedUserEmail || row.invitedUserId}</p>
                    <p className="mt-1 text-xs text-white/45">Código usado: {row.invitedByCode}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold text-white/75">
                      {statusLabel(row.status)}
                    </span>
                    <span className={cn("rounded-full border px-3 py-1 text-[11px] font-bold", badge.className)}>
                      {badge.label}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/55">
                  <span>Indicador: {row.inviterName || "—"}</span>
                  <span>
                    Recompensa: {row.inviterRewardAmount ?? row.inviterRewardCoins}{" "}
                    {rewardCurrencyLabel(row.inviterRewardCurrency)}
                  </span>
                  <span>
                    Convidado: {row.invitedRewardAmount ?? row.invitedRewardCoins}{" "}
                    {rewardCurrencyLabel(row.invitedRewardCurrency)}
                  </span>
                </div>
                <ProgressChecklist
                  className="mt-4"
                  rules={row.qualificationSnapshot ?? activeRules}
                  progress={row.progressSnapshot}
                />
                    </>
                  );
                })()}
              </article>
            ))
          )}
        </section>
      ) : null}

      {tab === "ranking" ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
            <p className="text-sm font-semibold text-white">Premiação do ranking</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold text-cyan-200">
                Ranking atual: {rankingCurrencySummary}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {rankingPrizeTiers.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/55">
                  Ainda não há faixas de premiação configuradas para este período.
                </div>
              ) : (
                rankingPrizeTiers.map((tier, index) => (
                  <div
                    key={`${period}-${tier.posicaoMax}-${tier.currency}-${tier.amount}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                  >
                    <span className="text-sm font-semibold text-white">
                      {formatRankingTierLabel(tier, index, rankingPrizeTiers[index - 1])}
                    </span>
                    <span className="text-sm font-black text-cyan-200">
                      {tier.amount} {rewardCurrencyLabel(tier.currency)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {([
              { id: "daily", label: "Diário" },
              { id: "weekly", label: "Semanal" },
              { id: "monthly", label: "Mensal" },
              { id: "all", label: "Geral" },
            ] as const).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                  period === item.id
                    ? "border-cyan-400/40 bg-cyan-500/15 text-white"
                    : "border-transparent bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {myRanking ? (
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/70">Sua posição</p>
              <p className="mt-1 text-xl font-black text-white">
                {rankingPosition ? `#${rankingPosition}` : "Em crescimento"}
              </p>
              <p className="mt-1 text-sm text-white/60">
                {myRanking.validReferrals} indicações válidas · {myRanking.totalRewards}{" "}
                {rankingCurrencySummary}
              </p>
            </div>
          ) : null}

          {estimatedPrizeTier ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/70">
                Sua recompensa estimada
              </p>
              <p className="mt-1 text-xl font-black text-white">
                {estimatedPrizeTier.amount} {rewardCurrencyLabel(estimatedPrizeTier.currency)}
              </p>
              <p className="mt-1 text-sm text-white/60">
                Mantendo a posição {rankingPosition ? `#${rankingPosition}` : ""}, você entra na faixa{" "}
                {formatRankingTierLabel(
                  estimatedPrizeTier,
                  rankingPrizeTiers.findIndex((tier) => tier.posicaoMax === estimatedPrizeTier.posicaoMax),
                  rankingPrizeTiers[
                    rankingPrizeTiers.findIndex((tier) => tier.posicaoMax === estimatedPrizeTier.posicaoMax) - 1
                  ],
                )}
                .
              </p>
            </div>
          ) : null}

          {podiumEntries.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {podiumEntries.map((entry, index) => (
                <div
                  key={`podium-${entry.userId}`}
                  className={cn(
                    "flex h-full flex-col rounded-[24px] border bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-4",
                    index === 0 && "border-amber-300/35 shadow-[0_18px_50px_-35px_rgba(251,191,36,0.35)]",
                    index === 1 && "border-slate-300/20 shadow-[0_18px_50px_-35px_rgba(148,163,184,0.2)]",
                    index === 2 && "border-orange-300/20 shadow-[0_18px_50px_-35px_rgba(251,146,60,0.2)]",
                    entry.userId === profile?.uid && "ring-1 ring-cyan-400/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className={cn(
                        "text-[10px] font-black uppercase tracking-[0.22em]",
                        index === 0 ? "text-amber-200/90" : "text-white/60",
                      )}
                    >
                      {index === 0 ? "1º lugar" : index === 1 ? "2º lugar" : "3º lugar"}
                    </p>
                    <div
                      className={cn(
                        "rounded-full border p-2",
                        index === 0 && "border-amber-300/30 bg-amber-300/10 text-amber-200",
                        index === 1 && "border-slate-300/20 bg-slate-200/10 text-slate-200",
                        index === 2 && "border-orange-300/20 bg-orange-300/10 text-orange-200",
                      )}
                    >
                      <Medal className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col items-center text-center">
                    {/* Avatares podem vir de data URL ou URL dinâmica do Firebase Storage. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveAvatarUrl({
                        photoUrl: entry.photoURL,
                        name: entry.userName,
                        uid: entry.userId,
                      })}
                      alt={entry.userName}
                      className="h-16 w-16 rounded-[20px] border border-white/10 object-cover"
                    />
                    <div className="mt-3 min-w-0 w-full">
                      <p className="truncate text-xl font-black tracking-tight text-white">{entry.userName}</p>
                    </div>
                  </div>
                  <div className="mt-auto pt-5">
                    <div className="border-t border-white/10 pt-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
                      Indicações
                    </p>
                    <p className="mt-2 text-4xl font-black leading-none text-white">
                      {entry.validReferrals}
                    </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            {ranking.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-10 text-center text-sm text-white/55">
                Ainda sem ranking para este período.
              </div>
            ) : (
              remainingRanking.map((entry, index) => (
                <div
                  key={entry.userId}
                  className={cn(
                    "rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3",
                    entry.userId === profile?.uid && "ring-1 ring-cyan-400/50",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{entry.userName}</p>
                      <p className="text-xs text-white/50">
                        {entry.validReferrals} válidas · {entry.totalRewards} {rankingCurrencySummary}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-200">
                      #{index + 4}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ProgressChecklist({
  rules,
  progress,
  className,
}: {
  rules: ReferralQualificationRules;
  progress?: ReferralQualificationProgress | null;
  className?: string;
}) {
  const items = buildReferralQualificationStatus(rules, progress);
  const completed = items.filter((item) => item.completed).length;
  const pendingSummary = summarizeReferralQualificationPending(items);
  const percent = Math.round((completed / Math.max(items.length, 1)) * 100);
  const summaryBadge = getProgressSummaryBadge(items);

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-black/20 p-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Progresso do desafio</p>
          <span className={cn("mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold", summaryBadge.className)}>
            {summaryBadge.label}
          </span>
        </div>
        <span className="text-xs font-semibold text-white/60">{completed}/{items.length} concluidos</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-white/50">{percent}% da missao concluido</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border px-3 py-2",
              getProgressItemState(item) === "done" && "border-emerald-400/15 bg-emerald-500/5",
              getProgressItemState(item) === "in_progress" && "border-cyan-400/15 bg-cyan-500/5",
              getProgressItemState(item) === "todo" && "border-white/10 bg-white/[0.03]",
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
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
              <span className="truncate text-sm text-white/80">{item.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] font-bold",
                  getProgressItemState(item) === "done" && "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
                  getProgressItemState(item) === "in_progress" && "border-cyan-400/20 bg-cyan-500/10 text-cyan-200",
                  getProgressItemState(item) === "todo" && "border-white/10 bg-black/20 text-white/60",
                )}
              >
                {getProgressItemState(item) === "done"
                  ? "Concluido"
                  : getProgressItemState(item) === "in_progress"
                    ? "Em andamento"
                    : "Falta fazer"}
              </span>
              <span className="shrink-0 text-xs font-semibold text-white/60">{item.progressText}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-white/50">{pendingSummary}</p>
    </div>
  );
}
