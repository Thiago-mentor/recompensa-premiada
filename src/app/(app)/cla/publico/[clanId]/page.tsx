"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { Button } from "@/components/ui/Button";
import { useClanDashboard } from "@/hooks/useClanDashboard";
import {
  buildDefaultRankingPrizeConfig,
  formatRankingPrize,
  getRankingPrizeForPosition,
  type NormalizedRankingPrizeConfig,
} from "@/lib/ranking/prizes";
import { resolveClanAvatarUrl, resolveClanCoverStyle, resolveClanMonogram } from "@/lib/clan/visuals";
import {
  compareClanWeeklyContributor,
  distributeClanWeeklyRewards,
  formatClanRole,
  formatClanPrivacy,
  formatClanTime,
  resolveClanWeeklyBreakdown,
  resolveClanWeeklyScore,
} from "@/lib/clan/ui";
import { resolveAvatarUrl } from "@/lib/users/avatar";
import { ROUTES } from "@/lib/constants/routes";
import {
  cancelClanJoinRequest,
  requestClanAccess,
  subscribeClan,
  subscribeClanMembers,
  subscribeClanRankingBoard,
  subscribeClanWeeklyContributors,
} from "@/services/clans/clanService";
import { fetchRankingPrizeConfig } from "@/services/ranking/rankingConfigService";
import type { Clan, ClanMember, ClanWeeklyContributor } from "@/types/clan";
import { Users, Crown, ArrowLeft, Shield, Sparkles, Trophy } from "lucide-react";

export default function ClaPublicoPage({ params }: { params: Promise<{ clanId: string }> }) {
  return <ClaPublicClient params={params} />;
}

function ClaPublicClient({ params }: { params: Promise<{ clanId: string }> }) {
  const { hasClan, clan: myClan, myJoinRequest } = useClanDashboard();
  const [routeClanId, setRouteClanId] = useState<string | null>(null);
  const [clan, setClan] = useState<Clan | null>(null);
  const [board, setBoard] = useState<Clan[]>([]);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [contributors, setContributors] = useState<ClanWeeklyContributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"request" | "cancel" | null>(null);
  const [prizeConfig, setPrizeConfig] = useState<NormalizedRankingPrizeConfig>(
    buildDefaultRankingPrizeConfig(),
  );
  const [notice, setNotice] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void params.then((value) => {
      if (active) setRouteClanId(value.clanId);
    });
    return () => {
      active = false;
    };
  }, [params]);

  useEffect(() => {
    if (!routeClanId) return;
    const unsubscribe = subscribeClan(routeClanId, (nextClan) => {
      setClan(nextClan);
      setLoading(false);
    });
    return unsubscribe;
  }, [routeClanId]);

  useEffect(() => {
    const unsubscribe = subscribeClanRankingBoard(setBoard);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!routeClanId) {
      setMembers([]);
      setContributors([]);
      return;
    }
    const unsubMembers = subscribeClanMembers(routeClanId, setMembers);
    const unsubContributors = subscribeClanWeeklyContributors(routeClanId, setContributors);
    return () => {
      unsubMembers();
      unsubContributors();
    };
  }, [routeClanId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const config = await fetchRankingPrizeConfig();
        if (!cancelled) setPrizeConfig(config);
      } catch {
        if (!cancelled) setPrizeConfig(buildDefaultRankingPrizeConfig());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clanRanks = useMemo(() => {
    if (!routeClanId) {
      return { activity: null as number | null, points: null as number | null };
    }
    const byActivity = [...board].sort((a, b) => clanActivityMs(b) - clanActivityMs(a));
    const byPoints = [...board].sort(
      (a, b) => compareClanWeeklyScore(b, a) || clanActivityMs(b) - clanActivityMs(a),
    );
    return {
      activity: resolveClanRank(byActivity, routeClanId),
      points: resolveClanRank(byPoints, routeClanId),
    };
  }, [board, routeClanId]);

  const weeklyPrizePreview = useMemo(
    () =>
      clan && clanRanks.points && resolveClanWeeklyScore(clan) > 0
        ? getRankingPrizeForPosition(prizeConfig.clans.semanal, clanRanks.points)
        : null,
    [clan, clanRanks.points, prizeConfig],
  );
  const activeContributors = useMemo(
    () => contributors.filter((item) => item.score > 0).sort(compareClanWeeklyContributor),
    [contributors],
  );
  const totalContributorScore = useMemo(
    () => activeContributors.reduce((sum, item) => sum + item.score, 0),
    [activeContributors],
  );
  const projectedRewardMap = useMemo(
    () =>
      new Map(
        distributeClanWeeklyRewards(weeklyPrizePreview, activeContributors).map((item) => [
          item.uid,
          item.rewards,
        ]),
      ),
    [activeContributors, weeklyPrizePreview],
  );
  const contributorsByUid = useMemo(
    () => new Map(activeContributors.map((item) => [item.uid, item])),
    [activeContributors],
  );
  const memberContributionRows = useMemo(() => {
    return [...members]
      .map((member) => {
        const contribution = contributorsByUid.get(member.uid);
        const weeklyScore = contribution?.score ?? 0;
        const weeklyWins = contribution?.wins ?? 0;
        const weeklyAds = contribution?.ads ?? 0;
        const shareRatio =
          totalContributorScore > 0 && weeklyScore > 0 ? weeklyScore / totalContributorScore : 0;
        return {
          ...member,
          weeklyScore,
          weeklyWins,
          weeklyAds,
          shareRatio,
          projectedReward: projectedRewardMap.get(member.uid) ?? null,
        };
      })
      .sort((a, b) => {
        const contributionDiff = compareClanWeeklyContributor(
          {
            uid: a.uid,
            score: a.weeklyScore,
            wins: a.weeklyWins,
            ads: a.weeklyAds,
            updatedAt: contributorsByUid.get(a.uid)?.updatedAt ?? a.updatedAt,
          },
          {
            uid: b.uid,
            score: b.weeklyScore,
            wins: b.weeklyWins,
            ads: b.weeklyAds,
            updatedAt: contributorsByUid.get(b.uid)?.updatedAt ?? b.updatedAt,
          },
        );
        if (contributionDiff !== 0) return contributionDiff;
        const roleDiff = roleWeight(a.role) - roleWeight(b.role);
        if (roleDiff !== 0) return roleDiff;
        return a.nome.localeCompare(b.nome, "pt-BR");
      });
  }, [contributorsByUid, members, projectedRewardMap, totalContributorScore]);
  const nonMemberContributorCount = useMemo(() => {
    const memberIds = new Set(members.map((member) => member.uid));
    return activeContributors.filter((item) => !memberIds.has(item.uid)).length;
  }, [activeContributors, members]);

  const isMyClan = Boolean(hasClan && myClan?.id && myClan.id === clan?.id);
  const isMyPendingClan = Boolean(
    clan?.id && myJoinRequest?.status === "pending" && myJoinRequest.clanId === clan.id,
  );
  async function handleRequestAccess() {
    if (!clan?.id) return;
    setBusy("request");
    setNotice(null);
    try {
      const result = await requestClanAccess({ clanId: clan.id });
      setNotice({
        tone: "success",
        text:
          result.status === "pending"
            ? `Pedido enviado para ${clan.name}.`
            : `Você entrou no clã ${clan.name}.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Não foi possível pedir entrada no clã.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleCancelRequest() {
    setBusy("cancel");
    setNotice(null);
    try {
      await cancelClanJoinRequest();
      setNotice({ tone: "success", text: "Solicitação de entrada cancelada." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Não foi possível cancelar o pedido.",
      });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="game-panel px-4 py-10 text-center text-sm text-white/55">
          Carregando perfil do clã...
        </div>
      </div>
    );
  }

  if (!clan) {
    return (
      <div className="space-y-4">
        <AlertBanner tone="error">Esse clã não foi encontrado ou não está mais disponível.</AlertBanner>
      </div>
    );
  }

  const coverStyle = resolveClanCoverStyle(clan);
  const avatarUrl = resolveClanAvatarUrl(clan);
  const monogram = resolveClanMonogram(clan);
  const blockedByAnotherPendingRequest = Boolean(
    clan.privacy !== "open" &&
      myJoinRequest?.status === "pending" &&
      myJoinRequest.clanId !== clan.id,
  );

  return (
    <motion.div
      className="space-y-5 pb-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <Link
        href={ROUTES.cla}
        className="game-panel-soft inline-flex min-h-11 items-center gap-2 rounded-[1rem] border-cyan-400/18 px-3.5 text-sm font-semibold text-white/88 transition hover:border-cyan-400/32 hover:bg-cyan-500/10 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao hub do clã
      </Link>

      {notice ? <AlertBanner tone={notice.tone}>{notice.text}</AlertBanner> : null}

      <section
        className="game-panel overflow-hidden"
        style={coverStyle}
      >
        <div className="bg-gradient-to-b from-transparent via-slate-950/40 to-slate-950/90 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="relative">
                <div
                  className="h-20 w-20 rounded-[26px] border border-white/10 bg-cover bg-center shadow-[0_0_32px_-16px_rgba(34,211,238,0.45)]"
                  style={{ backgroundImage: `url("${avatarUrl}")` }}
                />
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/85 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
                  {monogram}
                </span>
              </div>
              <div className="min-w-0">
                <p className="game-kicker">
                  Perfil público
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {clan.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="game-chip border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold tracking-wide text-white/75">
                    {clan.tag}
                  </span>
                  <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-bold text-fuchsia-100">
                    {formatClanPrivacy(clan.privacy)}
                  </span>
                </div>
                <p className="mt-3 max-w-2xl text-sm text-white/60">
                  {clan.description || "Esse esquadrão ainda não publicou descrição."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {isMyClan ? (
                <Link
                  href={ROUTES.cla}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-gradient-to-r from-cyan-600/90 via-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_28px_-6px_rgba(34,211,238,0.45)] transition hover:brightness-110"
                >
                  Abrir meu clã
                </Link>
              ) : isMyPendingClan ? (
                <Button
                  variant="secondary"
                  onClick={() => void handleCancelRequest()}
                  disabled={busy !== null}
                >
                  {busy === "cancel" ? "Cancelando..." : "Cancelar pedido"}
                </Button>
              ) : (
                <Button
                  variant={clan.privacy === "open" ? "arena" : "secondary"}
                  onClick={() => void handleRequestAccess()}
                  disabled={busy !== null || blockedByAnotherPendingRequest}
                >
                  {busy === "request"
                    ? clan.privacy === "open"
                      ? "Entrando..."
                      : "Enviando..."
                    : blockedByAnotherPendingRequest
                      ? "Pedido pendente"
                      : clan.privacy === "open"
                      ? "Entrar agora"
                      : "Enviar pedido"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <PublicStat label="Membros" value={`${clan.memberCount}/${clan.maxMembers}`} icon={Users} />
        <PublicStat label="Entrada" value={formatClanPrivacy(clan.privacy)} icon={Shield} />
        <PublicStat label="Pontos semana" value={`${resolveClanWeeklyScore(clan)} pts`} icon={Trophy} />
        <PublicStat
          label="Ranking atividade"
          value={clanRanks.activity ? `#${clanRanks.activity}` : "—"}
          icon={Sparkles}
        />
        <PublicStat
          label="Ranking pontos"
          value={clanRanks.points ? `#${clanRanks.points}` : "—"}
          icon={Crown}
        />
      </section>

      <section className="game-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
          <p className="game-kicker">
              Contribuição da semana
            </p>
            <p className="mt-1 text-sm text-white/60">
              Vitórias e anúncios definem a fatia semanal. A projeção segue o rateio real do backend.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs font-semibold text-amber-100/85">
              Faixa atual do clã: {formatRankingPrize(weeklyPrizePreview)}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {activeContributors.length === 1
                ? "1 contribuidor com pontos"
                : `${activeContributors.length} contribuidores com pontos`}
            </p>
          </div>
        </div>

        {nonMemberContributorCount > 0 ? (
          <p className="game-panel-soft mt-3 rounded-2xl px-3 py-2 text-xs text-white/50">
            {nonMemberContributorCount === 1
              ? "1 pessoa pontuou nesta semana, mas já saiu da lista atual. A projeção já considera essa fatia."
              : `${nonMemberContributorCount} pessoas pontuaram nesta semana, mas já saíram da lista atual. A projeção já considera essas fatias.`}
          </p>
        ) : null}

        {memberContributionRows.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/45">
            Ainda não há membros carregados para mostrar a contribuição semanal.
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {memberContributionRows.map((member) => (
              <ContributorProjectionRow
                key={member.uid}
                member={member}
                weeklyPrizePreview={weeklyPrizePreview}
              />
            ))}
          </div>
        )}
      </section>

      <section className="game-panel p-4">
        <p className="game-kicker">
          Pontuação semanal
        </p>
        <p className="mt-1 text-sm text-white/60">
          Vitórias e anúncios somam pontos. Se o clã fechar em faixa premiada, o rateio vai para quem pontuou.
        </p>
      </section>

      <section className="game-panel p-4">
        <p className="game-kicker">Atividade</p>
        <p className="mt-1 text-sm text-white/60">
          {clan.lastMessageAt
            ? `Última atividade do chat às ${formatClanTime(clan.lastMessageAt)}.`
            : clan.updatedAt
              ? `Última atualização às ${formatClanTime(clan.updatedAt)}.`
              : "Sem atividade recente registrada."}
        </p>
      </section>
    </motion.div>
  );
}

function PublicStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <div className="game-panel-soft rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/58">{label}</p>
        <Icon className="h-4 w-4 text-cyan-100/75" />
      </div>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function ContributorProjectionRow({
  member,
  weeklyPrizePreview,
}: {
  member: ClanMember & {
    weeklyScore: number;
    weeklyWins: number;
    weeklyAds: number;
    shareRatio: number;
    projectedReward: { coins: number; gems: number; rewardBalance: number } | null;
  };
  weeklyPrizePreview: { coins?: number; gems?: number; rewardBalance?: number } | null;
}) {
  const avatarUrl = resolveAvatarUrl({
    photoUrl: member.foto,
    name: member.nome,
    username: member.username,
    uid: member.uid,
  });
  const projectedRewardLabel =
    member.weeklyScore <= 0
      ? "Sem contribuição na semana."
      : !weeklyPrizePreview
        ? "Clã fora da faixa premiada no momento."
        : formatRankingPrize(member.projectedReward) === "Sem prêmio"
          ? "Sem fatia nesta faixa atual."
          : `Projeção: ${formatRankingPrize(member.projectedReward)}`;

  return (
    <div className="game-panel-soft rounded-2xl p-3">
      <div className="flex items-start gap-3">
        <div
          className="h-12 w-12 shrink-0 rounded-[18px] border border-white/10 bg-cover bg-center"
          style={{ backgroundImage: `url("${avatarUrl}")` }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-white">{member.nome}</p>
            {member.username ? <span className="text-xs text-white/40">@{member.username}</span> : null}
            <span className="game-chip border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white/65">
              {formatClanRole(member.role)}
            </span>
          </div>
          <p className="mt-1 text-xs text-white/55">
            {member.weeklyScore} pts · {member.weeklyWins} vitórias · {member.weeklyAds} anúncios
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            {member.weeklyScore > 0
              ? `${formatShareRatio(member.shareRatio)} da pontuação registrada`
              : "Ainda sem pontos nesta semana."}
          </p>
          <p
            className={`mt-1 text-[11px] font-semibold ${
              member.weeklyScore > 0 && weeklyPrizePreview ? "text-amber-100/80" : "text-white/45"
            }`}
          >
            {projectedRewardLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

function timestampToMs(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  return 0;
}

function clanActivityMs(item: Clan): number {
  return timestampToMs(item.lastMessageAt ?? item.updatedAt);
}

function resolveClanRank(list: Clan[], clanId: string): number | null {
  const index = list.findIndex((item) => item.id === clanId);
  return index >= 0 ? index + 1 : null;
}

function compareClanWeeklyScore(a: Clan, b: Clan): number {
  const scoreA = resolveClanWeeklyBreakdown(a);
  const scoreB = resolveClanWeeklyBreakdown(b);
  if (scoreA.score !== scoreB.score) return scoreA.score - scoreB.score;
  if (scoreA.wins !== scoreB.wins) return scoreA.wins - scoreB.wins;
  if (scoreA.ads !== scoreB.ads) return scoreA.ads - scoreB.ads;
  return a.memberCount - b.memberCount;
}

function roleWeight(role: ClanMember["role"]): number {
  if (role === "owner") return 0;
  if (role === "leader") return 1;
  return 2;
}

function formatShareRatio(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}
