"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClanEmptyState } from "@/components/cla/ClanEmptyState";
import { ClaGameHeader } from "@/components/cla/ClaGameHeader";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { useCenterScreenFeedback } from "@/components/feedback/CenterScreenFeedback";
import { Button } from "@/components/ui/Button";
import {
  ArenaShell,
  fadeUpItem,
  staggerContainer,
} from "@/components/arena/ArenaShell";
import { useAuth } from "@/hooks/useAuth";
import { useClanDashboard } from "@/hooks/useClanDashboard";
import {
  compareClanWeeklyContributor,
  distributeClanWeeklyRewards,
  formatClanRole,
  resolveClanWeeklyBreakdown,
  resolveClanWeeklyScore,
} from "@/lib/clan/ui";
import {
  buildDefaultRankingPrizeConfig,
  formatRankingPrize,
  getRankingPrizeForPosition,
  type NormalizedRankingPrizeConfig,
} from "@/lib/ranking/prizes";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { resolveAvatarUrl } from "@/lib/users/avatar";
import {
  approveClanJoinRequest,
  changeClanMemberRole,
  fetchClanMemberShowcase,
  kickClanMember,
  leaveClan,
  rejectClanJoinRequest,
  subscribeClanRankingBoard,
  subscribeClanWeeklyContributors,
  transferClanOwnership,
} from "@/services/clans/clanService";
import { fetchRankingPrizeConfig } from "@/services/ranking/rankingConfigService";
import type {
  Clan,
  ClanMember,
  ClanMemberShowcaseMetric,
  ClanMemberShowcaseRow,
  ClanWeeklyContributor,
} from "@/types/clan";
import { ClaSectionNav } from "../ClaSectionNav";
import { Clock3, LogOut, UserPlus, UserX, Wifi, WifiOff } from "lucide-react";

const MEMBER_ONLINE_WINDOW_MS = 3 * 60 * 1000;
const ROSTER_GRID_CLASS =
  "grid grid-cols-[minmax(240px,1.7fr)_repeat(4,minmax(92px,0.82fr))_minmax(124px,0.95fr)] gap-2.5";

export default function ClaMembrosPage() {
  const { user } = useAuth();
  const { notify } = useCenterScreenFeedback();
  const {
    loading,
    hasClan,
    clan,
    members,
    membership,
    pendingJoinRequests,
    canManageClan,
    isOwner,
  } = useClanDashboard();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const isSoloFounder = Boolean(isOwner && members.length === 1);
  const [showcaseRows, setShowcaseRows] = useState<ClanMemberShowcaseRow[]>([]);
  const [showcaseLoading, setShowcaseLoading] = useState(false);
  const [showcaseError, setShowcaseError] = useState<string | null>(null);
  const [board, setBoard] = useState<Clan[]>([]);
  const [contributors, setContributors] = useState<ClanWeeklyContributor[]>([]);
  const [prizeConfig, setPrizeConfig] = useState<NormalizedRankingPrizeConfig>(
    buildDefaultRankingPrizeConfig(),
  );
  const memberIdsKey = useMemo(() => members.map((member) => member.uid).join(","), [members]);
  const showcaseByUid = useMemo(
    () => new Map(showcaseRows.map((row) => [row.uid, row])),
    [showcaseRows],
  );

  useEffect(() => {
    if (!hasClan || !clan?.id) {
      setShowcaseRows([]);
      setShowcaseError(null);
      setShowcaseLoading(false);
      return;
    }
    const clanId = clan.id;

    let cancelled = false;
    async function loadShowcase(background = false) {
      if (!background) {
        setShowcaseLoading(true);
        setShowcaseError(null);
      }
      try {
        const result = await fetchClanMemberShowcase({ clanId });
        if (cancelled) return;
        setShowcaseError(null);
        setShowcaseRows(result.rows);
      } catch (error) {
        if (cancelled || background) return;
        setShowcaseError(
          error instanceof Error
            ? error.message
            : "Não foi possível sincronizar o placar premium dos membros.",
        );
      } finally {
        if (!cancelled && !background) {
          setShowcaseLoading(false);
        }
      }
    }

    void loadShowcase(false);
    const intervalId = window.setInterval(() => {
      void loadShowcase(true);
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [clan?.id, hasClan, memberIdsKey]);

  useEffect(() => {
    const unsubscribe = subscribeClanRankingBoard(setBoard);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!hasClan || !clan?.id) {
      setContributors([]);
      return;
    }
    const unsubscribe = subscribeClanWeeklyContributors(clan.id, setContributors);
    return unsubscribe;
  }, [clan?.id, hasClan]);

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

  const clanPointsRank = useMemo(() => {
    if (!clan?.id) return null;
    const byPoints = [...board].sort(
      (a, b) => compareClanWeeklyScore(b, a) || clanActivityMs(b) - clanActivityMs(a),
    );
    return resolveClanRank(byPoints, clan.id);
  }, [board, clan?.id]);
  const weeklyPrizePreview = useMemo(
    () =>
      clan && clanPointsRank && resolveClanWeeklyScore(clan) > 0
        ? getRankingPrizeForPosition(prizeConfig.clans.semanal, clanPointsRank)
        : null,
    [clan, clanPointsRank, prizeConfig],
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
  const contributorByUid = useMemo(
    () => new Map(activeContributors.map((item) => [item.uid, item])),
    [activeContributors],
  );
  const nonMemberContributorCount = useMemo(() => {
    const memberIds = new Set(members.map((member) => member.uid));
    return activeContributors.filter((item) => !memberIds.has(item.uid)).length;
  }, [activeContributors, members]);

  async function handleLeaveClan() {
    setBusyKey("leave");
    try {
      const result = await leaveClan();
      notify(
        "success",
        result.dissolved
          ? "O clã foi encerrado. Você não pertence mais a nenhum grupo."
          : "Você saiu do clã com sucesso.",
      );
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Não foi possível sair do clã.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleChangeRole(targetUid: string, role: "leader" | "member") {
    if (!clan?.id) return;
    setBusyKey(`role:${targetUid}:${role}`);
    try {
      await changeClanMemberRole({ clanId: clan.id, targetUid, role });
      notify(
        "success",
        role === "leader" ? "Membro promovido para líder." : "Líder rebaixado para membro.",
      );
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Não foi possível atualizar o cargo.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleTransferOwnership(targetUid: string, nome: string) {
    if (!clan?.id) return;
    if (!window.confirm(`Transferir a liderança do clã para ${nome}?`)) return;

    setBusyKey(`transfer:${targetUid}`);
    try {
      await transferClanOwnership({ clanId: clan.id, targetUid });
      notify("success", `Liderança transferida para ${nome}. Você agora é líder do clã.`);
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Não foi possível transferir a liderança.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleApproveRequest(targetUid: string, nome: string) {
    if (!clan?.id) return;
    setBusyKey(`approve:${targetUid}`);
    try {
      await approveClanJoinRequest({ clanId: clan.id, targetUid });
      notify("success", `${nome} entrou no clã com sucesso.`);
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Não foi possível aprovar a solicitação.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRejectRequest(targetUid: string, nome: string) {
    if (!clan?.id) return;
    setBusyKey(`reject:${targetUid}`);
    try {
      await rejectClanJoinRequest({ clanId: clan.id, targetUid });
      notify("success", `Solicitação de ${nome} recusada.`);
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Não foi possível recusar a solicitação.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleKickMember(targetUid: string, nome: string) {
    if (!clan?.id) return;
    if (!window.confirm(`Remover ${nome} do clã?`)) return;
    setBusyKey(`kick:${targetUid}`);
    try {
      await kickClanMember({ clanId: clan.id, targetUid });
      notify("success", `${nome} foi removido do clã.`);
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Não foi possível remover o membro.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <ArenaShell maxWidth="max-w-[1320px]" padding="sm" hudFrame={false}>
      <motion.div className="space-y-5" variants={staggerContainer} initial="hidden" animate="show">
        <ClaGameHeader
          kicker="Esquadrão"
          title="Membros"
          description="Papéis, convites e presença do grupo aparecem aqui quando você estiver em um clã."
          accent="cyan"
        />

        <ClaSectionNav />

        {loading ? (
          <motion.section variants={fadeUpItem} className="game-panel px-4 py-10 text-center text-sm text-white/55">
            Carregando integrantes do clã...
          </motion.section>
        ) : !hasClan || !clan ? (
          <ClanEmptyState
            icon={UserPlus}
            text="Nenhum clã carregado ainda. Volte ao hub para criar ou entrar com um código de convite."
          />
        ) : (
          <>
            <motion.section
              variants={fadeUpItem}
              className="rounded-[1.6rem] border border-cyan-400/20 bg-cyan-500/10 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/75">
                    Escalação ativa
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white">
                    {clan.name} <span className="text-cyan-100/75">[{clan.tag}]</span>
                  </h2>
                  <p className="mt-1 text-sm text-white/60">
                    {members.length} membro{members.length > 1 ? "s" : ""} sincronizado
                    {members.length > 1 ? "s" : ""} com o lobby.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white/70">
                  {formatClanRole(membership?.role)}
                </span>
              </div>
            </motion.section>

            {isSoloFounder ? (
              <AlertBanner tone="info">
                Você é o único membro. Para{" "}
                <strong className="font-semibold text-cyan-100">encerrar o clã permanentemente</strong>, use{" "}
                <Link
                  href={ROUTES.claConfiguracoes}
                  className="font-semibold text-cyan-200 underline-offset-4 hover:underline"
                >
                  Configurações
                </Link>{" "}
                — lá está a zona sensível com essa opção.
              </AlertBanner>
            ) : isOwner ? (
              <AlertBanner tone="info">
                Há outros membros no grupo. Transfira a liderança antes de sair do clã.
              </AlertBanner>
            ) : (
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  onClick={() => void handleLeaveClan()}
                  disabled={busyKey !== null}
                >
                  <LogOut className="h-4 w-4" />
                  {busyKey === "leave" ? "Saindo..." : "Sair do clã"}
                </Button>
              </div>
            )}

            <motion.section
              variants={fadeUpItem}
              className="rounded-[1.6rem] border border-amber-400/20 bg-amber-500/10 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/75">
                    Rateio semanal projetado
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white">Fatia por contribuição</h2>
                  <p className="mt-1 max-w-3xl text-sm text-white/60">
                    A projeção usa a faixa atual do clã no ranking semanal e o mesmo rateio
                    proporcional aplicado no fechamento do backend.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white/70">
                    {clanPointsRank ? `#${clanPointsRank} em pontos` : "Fora do ranking"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white/70">
                    {activeContributors.length === 1
                      ? "1 contribuidor ativo"
                      : `${activeContributors.length} contribuidores ativos`}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-sm font-semibold text-amber-100/85">
                Faixa atual do clã: {formatRankingPrize(weeklyPrizePreview)}
              </p>
              {nonMemberContributorCount > 0 ? (
                <p className="mt-2 text-xs text-white/50">
                  {nonMemberContributorCount === 1
                    ? "Existe 1 pessoa que já pontuou nesta semana, mas não está mais entre os membros atuais. A projeção abaixo já considera essa fatia."
                    : `Existem ${nonMemberContributorCount} pessoas que já pontuaram nesta semana, mas não estão mais entre os membros atuais. A projeção abaixo já considera essas fatias.`}
                </p>
              ) : null}
            </motion.section>

            {canManageClan ? (
              <motion.section
                variants={fadeUpItem}
                className="rounded-[1.7rem] border border-amber-400/20 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(244,114,182,0.12),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-4 shadow-[0_0_42px_-18px_rgba(251,191,36,0.22)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/75">
                      Painel da liderança
                    </p>
                    <h2 className="mt-1 text-xl font-black text-white">Solicitações pendentes</h2>
                    <p className="mt-1 max-w-2xl text-sm text-white/60">
                      Aprove ou recuse pedidos de entrada com foco em toque rápido no mobile.
                    </p>
                  </div>
                  <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-100/85">
                    {pendingJoinRequests.length === 0
                      ? "Inbox limpo"
                      : pendingJoinRequests.length === 1
                        ? "1 pendente"
                        : `${pendingJoinRequests.length} pendentes`}
                  </span>
                </div>

                {pendingJoinRequests.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
                    Nenhuma solicitação pendente no momento.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {pendingJoinRequests.map((request) => (
                      <motion.article
                        key={request.id}
                        variants={fadeUpItem}
                        className="rounded-[1.35rem] border border-amber-300/15 bg-black/25 p-3 shadow-[0_0_26px_-18px_rgba(251,191,36,0.3)] backdrop-blur-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            aria-label={request.userName}
                            className="h-14 w-14 shrink-0 rounded-[18px] border border-white/10 bg-cover bg-center shadow-[0_0_26px_-14px_rgba(251,191,36,0.32)]"
                            style={{
                              backgroundImage: `url("${resolveAvatarUrl({
                                photoUrl: request.photoURL,
                                name: request.userName,
                                username: request.username,
                                uid: request.userId,
                              })}")`,
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-base font-black tracking-tight text-white">
                                {request.userName}
                              </p>
                              <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-100">
                                Pendente
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-white/45">
                              {request.username ? `@${request.username}` : "sem username público"}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-white/42">
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                {request.requestedByCode
                                  ? `Código ${request.requestedByCode}`
                                  : "Perfil público"}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                {formatRequestTimestamp(request.requestedAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Button
                            variant="arena"
                            className="min-h-[42px] px-3 py-2 text-xs"
                            disabled={busyKey !== null}
                            onClick={() => void handleApproveRequest(request.userId, request.userName)}
                          >
                            <UserPlus className="h-4 w-4" />
                            {busyKey === `approve:${request.userId}` ? "Aprovando..." : "Aprovar"}
                          </Button>
                          <Button
                            variant="secondary"
                            className="min-h-[42px] px-3 py-2 text-xs"
                            disabled={busyKey !== null}
                            onClick={() => void handleRejectRequest(request.userId, request.userName)}
                          >
                            <UserX className="h-4 w-4" />
                            {busyKey === `reject:${request.userId}` ? "Recusando..." : "Recusar"}
                          </Button>
                        </div>
                      </motion.article>
                    ))}
                  </div>
                )}
              </motion.section>
            ) : null}

            <motion.section
              variants={fadeUpItem}
              className="rounded-[1.7rem] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.18),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-4 shadow-[0_0_48px_-18px_rgba(34,211,238,0.28)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/75">
                    Membros + rateio
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white">Contribuição semanal dos membros</h2>
                  <p className="mt-1 max-w-3xl text-sm text-white/60">
                    A lista mostra o desempenho tático da semana e a projeção atual da fatia de cada
                    membro no rateio do clã.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-100/85">
                    Tática + rateio
                  </span>
                  {showcaseLoading ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white/65">
                      Atualizando
                    </span>
                  ) : null}
                </div>
              </div>

              {showcaseError ? (
                <AlertBanner tone="error" className="mt-4">
                  {showcaseError}
                </AlertBanner>
              ) : null}

              {showcaseLoading && showcaseRows.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
                  Sincronizando placar premium dos membros...
                </div>
              ) : (
                <>
                  <div className="mt-4 space-y-3 md:hidden">
                    {members.map((member) => {
                      const isYou = member.uid === user?.uid;
                      const canKick =
                        !isYou &&
                        canManageClan &&
                        (isOwner
                          ? member.role !== "owner"
                          : membership?.role === "leader"
                            ? member.role === "member"
                            : false);
                      const presence = resolveMemberPresence(member.lastActiveAt);
                      const metrics = showcaseByUid.get(member.uid);
                      const contribution = contributorByUid.get(member.uid);
                      const weeklyScore = contribution?.score ?? 0;
                      const weeklyWins = contribution?.wins ?? 0;
                      const weeklyAds = contribution?.ads ?? 0;
                      const shareRatio =
                        totalContributorScore > 0 && weeklyScore > 0
                          ? weeklyScore / totalContributorScore
                          : 0;
                      const projectedReward = projectedRewardMap.get(member.uid) ?? null;
                      const hasMemberActions = (isOwner && !isYou) || canKick;

                      return (
                        <motion.article
                          key={member.uid}
                          variants={fadeUpItem}
                          className={cn(
                            "rounded-[1.45rem] border bg-black/25 p-3 backdrop-blur-sm",
                            member.role === "owner"
                              ? "border-amber-400/30 bg-amber-500/10 shadow-[0_0_34px_-16px_rgba(251,191,36,0.45)]"
                              : member.role === "leader"
                                ? "border-violet-400/25 bg-violet-500/10 shadow-[0_0_30px_-18px_rgba(168,85,247,0.35)]"
                                : "border-white/10 shadow-[0_0_24px_-18px_rgba(34,211,238,0.24)]",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              aria-label={member.nome}
                              className="h-14 w-14 shrink-0 rounded-[18px] border border-white/10 bg-cover bg-center shadow-[0_0_28px_-14px_rgba(34,211,238,0.35)]"
                              style={{
                                backgroundImage: `url("${resolveAvatarUrl({
                                  photoUrl: member.foto,
                                  name: member.nome,
                                  username: member.username,
                                  uid: member.uid,
                                })}")`,
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-base font-black tracking-tight text-white">
                                  {member.nome}
                                </p>
                                {member.role === "owner" ? (
                                  <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-100">
                                    Fundador
                                  </span>
                                ) : member.role === "leader" ? (
                                  <span className="rounded-full border border-violet-300/25 bg-violet-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-100">
                                    Líder
                                  </span>
                                ) : null}
                                {isYou ? (
                                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-100">
                                    Você
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-0.5 truncate text-[11px] text-white/45">
                                {member.username ? `@${member.username}` : "sem username público"}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-white/35">
                                {member.role === "owner"
                                  ? "Fundador no topo da escalação."
                                  : `Entrou em ${formatMemberJoinedAt(member.joinedAt)}`}
                              </p>
                            </div>
                            <MemberPresencePill online={presence.online} />
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <MetricCounterCard label="PPT" metric={metrics?.ppt} tone="cyan" />
                            <MetricCounterCard label="Quiz" metric={metrics?.quiz} tone="violet" />
                            <MetricCounterCard label="Reaction" metric={metrics?.reaction} tone="amber" />
                            <MetricCounterCard label="Anúncios" metric={metrics?.ads} tone="emerald" />
                          </div>

                          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-white/48">
                            <Clock3 className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate">{presence.detail}</span>
                          </p>

                          <MemberWeeklyProjectionPanel
                            weeklyScore={weeklyScore}
                            weeklyWins={weeklyWins}
                            weeklyAds={weeklyAds}
                            shareRatio={shareRatio}
                            projectedReward={projectedReward}
                            weeklyPrizePreview={weeklyPrizePreview}
                          />

                          {hasMemberActions ? (
                            <div className="mt-3 border-t border-white/10 pt-3">
                              <MemberActionBar
                                member={member}
                                isOwner={isOwner}
                                isYou={isYou}
                                canKick={canKick}
                                busyKey={busyKey}
                                justify="start"
                                onChangeRole={handleChangeRole}
                                onTransferOwnership={handleTransferOwnership}
                                onKickMember={handleKickMember}
                              />
                            </div>
                          ) : null}
                        </motion.article>
                      );
                    })}
                  </div>

                  <div className="mt-4 hidden overflow-x-auto pb-1 md:block">
                    <div className="min-w-[900px] space-y-3">
                      <div
                        className={cn(
                          ROSTER_GRID_CLASS,
                          "px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35",
                        )}
                      >
                        <span>Membro</span>
                        <span className="text-center">PPT</span>
                        <span className="text-center">Quiz</span>
                        <span className="text-center">Reaction</span>
                        <span className="text-center">Anúncios</span>
                        <span className="text-center">Status</span>
                      </div>

                      {members.map((member) => {
                        const isYou = member.uid === user?.uid;
                        const canKick =
                          !isYou &&
                          canManageClan &&
                          (isOwner
                            ? member.role !== "owner"
                            : membership?.role === "leader"
                              ? member.role === "member"
                              : false);
                        const presence = resolveMemberPresence(member.lastActiveAt);
                        const metrics = showcaseByUid.get(member.uid);
                        const contribution = contributorByUid.get(member.uid);
                        const weeklyScore = contribution?.score ?? 0;
                        const weeklyWins = contribution?.wins ?? 0;
                        const weeklyAds = contribution?.ads ?? 0;
                        const shareRatio =
                          totalContributorScore > 0 && weeklyScore > 0
                            ? weeklyScore / totalContributorScore
                            : 0;
                        const projectedReward = projectedRewardMap.get(member.uid) ?? null;
                        const hasMemberActions = (isOwner && !isYou) || canKick;

                        return (
                          <motion.article
                            key={member.uid}
                            variants={fadeUpItem}
                            className={cn(
                              "rounded-[1.45rem] border bg-black/25 p-3 backdrop-blur-sm",
                              member.role === "owner"
                                ? "border-amber-400/30 bg-amber-500/10 shadow-[0_0_34px_-16px_rgba(251,191,36,0.45)]"
                                : member.role === "leader"
                                  ? "border-violet-400/25 bg-violet-500/10 shadow-[0_0_30px_-18px_rgba(168,85,247,0.35)]"
                                  : "border-white/10 shadow-[0_0_24px_-18px_rgba(34,211,238,0.24)]",
                            )}
                          >
                            <div className={cn(ROSTER_GRID_CLASS, "items-center")}>
                              <div className="flex min-w-0 items-center gap-3 rounded-[1rem] border border-white/10 bg-slate-950/88 px-3 py-2.5 backdrop-blur-sm">
                                <div
                                  aria-label={member.nome}
                                  className="h-14 w-14 shrink-0 rounded-[18px] border border-white/10 bg-cover bg-center shadow-[0_0_28px_-14px_rgba(34,211,238,0.35)]"
                                  style={{
                                    backgroundImage: `url("${resolveAvatarUrl({
                                      photoUrl: member.foto,
                                      name: member.nome,
                                      username: member.username,
                                      uid: member.uid,
                                    })}")`,
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-black tracking-tight text-white sm:text-[15px]">
                                      {member.nome}
                                    </p>
                                    {member.role === "owner" ? (
                                      <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-100">
                                        Fundador
                                      </span>
                                    ) : member.role === "leader" ? (
                                      <span className="rounded-full border border-violet-300/25 bg-violet-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-100">
                                        Líder
                                      </span>
                                    ) : null}
                                    {isYou ? (
                                      <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-100">
                                        Você
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-0.5 truncate text-[11px] text-white/45">
                                    {member.username ? `@${member.username}` : "sem username público"}
                                  </p>
                                  <p className="mt-0.5 truncate text-[10px] text-white/35">
                                    {member.role === "owner"
                                      ? "Fundador no topo da escalação."
                                      : `Entrou em ${formatMemberJoinedAt(member.joinedAt)}`}
                                  </p>
                                </div>
                              </div>

                              <MetricCounterCard label="PPT" metric={metrics?.ppt} tone="cyan" />
                              <MetricCounterCard label="Quiz" metric={metrics?.quiz} tone="violet" />
                              <MetricCounterCard label="Reaction" metric={metrics?.reaction} tone="amber" />
                              <MetricCounterCard label="Anúncios" metric={metrics?.ads} tone="emerald" />
                              <RosterStatusCell online={presence.online} detail={presence.detail} />
                            </div>

                            <MemberWeeklyProjectionPanel
                              weeklyScore={weeklyScore}
                              weeklyWins={weeklyWins}
                              weeklyAds={weeklyAds}
                              shareRatio={shareRatio}
                              projectedReward={projectedReward}
                              weeklyPrizePreview={weeklyPrizePreview}
                              className="mt-3"
                            />

                            {hasMemberActions ? (
                              <div className="mt-3 border-t border-white/10 pt-3">
                                <MemberActionBar
                                  member={member}
                                  isOwner={isOwner}
                                  isYou={isYou}
                                  canKick={canKick}
                                  busyKey={busyKey}
                                  justify="end"
                                  onChangeRole={handleChangeRole}
                                  onTransferOwnership={handleTransferOwnership}
                                  onKickMember={handleKickMember}
                                />
                              </div>
                            ) : null}
                          </motion.article>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </motion.section>
          </>
        )}
      </motion.div>
    </ArenaShell>
  );
}

function MemberWeeklyProjectionPanel({
  weeklyScore,
  weeklyWins,
  weeklyAds,
  shareRatio,
  projectedReward,
  weeklyPrizePreview,
  className,
}: {
  weeklyScore: number;
  weeklyWins: number;
  weeklyAds: number;
  shareRatio: number;
  projectedReward: { coins: number; gems: number; rewardBalance: number } | null;
  weeklyPrizePreview: { coins?: number; gems?: number; rewardBalance?: number } | null;
  className?: string;
}) {
  const isActiveContributor = weeklyScore > 0;
  const projectedRewardLabel =
    !isActiveContributor
      ? "Sem contribuição na semana."
      : !weeklyPrizePreview
        ? "Clã fora da faixa premiada no momento."
        : formatRankingPrize(projectedReward) === "Sem prêmio"
          ? "Sem fatia nesta faixa atual."
          : `Projeção: ${formatRankingPrize(projectedReward)}`;
  const shareLabel = isActiveContributor
    ? `${formatShareRatio(shareRatio)} da pontuação registrada`
    : "Sem participação no rateio";

  return (
    <div
      className={cn(
        "mt-3 rounded-[1rem] border px-3 py-2.5",
        isActiveContributor
          ? "border-amber-400/20 bg-amber-500/10 shadow-[0_0_22px_-16px_rgba(251,191,36,0.5)]"
          : "border-white/10 bg-white/[0.03]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">Rateio semanal</p>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            isActiveContributor
              ? "border-amber-300/20 bg-amber-400/10 text-amber-100"
              : "border-white/10 bg-white/5 text-white/60",
          )}
        >
          {shareLabel}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <ProjectionMiniStat label="Pontos" value={String(weeklyScore)} active={isActiveContributor} />
        <ProjectionMiniStat label="Vitórias" value={String(weeklyWins)} active={isActiveContributor} />
        <ProjectionMiniStat label="Anúncios" value={String(weeklyAds)} active={isActiveContributor} />
      </div>

      <p
        className={cn(
          "mt-3 text-[11px] font-semibold",
          isActiveContributor && weeklyPrizePreview ? "text-amber-100/90" : "text-white/55",
        )}
      >
        {projectedRewardLabel}
      </p>
    </div>
  );
}

function ProjectionMiniStat({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[0.9rem] border px-2.5 py-2 text-center",
        active ? "border-white/10 bg-black/20" : "border-white/8 bg-black/10",
      )}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/38">{label}</p>
      <p className={cn("mt-1 text-sm font-black", active ? "text-white" : "text-white/65")}>{value}</p>
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

function formatMemberJoinedAt(value: unknown): string {
  if (!value || typeof value !== "object" || !("toDate" in value)) return "data indisponível";
  try {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString("pt-BR");
  } catch {
    return "data indisponível";
  }
}

function formatRequestTimestamp(value: unknown): string {
  if (!value || typeof value !== "object" || !("toDate" in value)) return "pedido recente";
  try {
    const date = (value as { toDate: () => Date }).toDate();
    return `${date.toLocaleDateString("pt-BR")} • ${date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return "pedido recente";
  }
}

function resolveMemberPresence(value: unknown): { online: boolean; detail: string } {
  const lastActiveAtMs = timestampToMs(value);
  if (!lastActiveAtMs) {
    return { online: false, detail: "sem presença recente" };
  }

  const diffMs = Math.max(0, Date.now() - lastActiveAtMs);
  if (diffMs <= MEMBER_ONLINE_WINDOW_MS) {
    return { online: true, detail: "ativo agora" };
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return { online: false, detail: `visto há ${Math.max(1, diffMinutes)} min` };
  }

  const date = new Date(lastActiveAtMs);
  return {
    online: false,
    detail: `visto ${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`,
  };
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

function formatShareRatio(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function MetricCounterCard({
  label,
  metric,
  tone,
}: {
  label: string;
  metric?: ClanMemberShowcaseMetric;
  tone: "cyan" | "violet" | "amber" | "emerald";
}) {
  const toneClasses: Record<typeof tone, { border: string; bg: string; weekly: string }> = {
    cyan: {
      border: "border-cyan-400/20",
      bg: "bg-cyan-500/10",
      weekly: "text-cyan-100",
    },
    violet: {
      border: "border-violet-400/20",
      bg: "bg-violet-500/10",
      weekly: "text-violet-100",
    },
    amber: {
      border: "border-amber-400/20",
      bg: "bg-amber-500/10",
      weekly: "text-amber-100",
    },
    emerald: {
      border: "border-emerald-400/20",
      bg: "bg-emerald-500/10",
      weekly: "text-emerald-100",
    },
  };
  const totalValue = metric ? String(metric.total) : "—";
  const weeklyValue = metric ? String(metric.weekly) : "—";

  return (
    <div
      className={cn(
        "rounded-[1rem] border px-2.5 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        toneClasses[tone].border,
        toneClasses[tone].bg,
      )}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/38">{label}</p>
      <div className="mt-1 flex items-end justify-center gap-1">
        <span className="text-lg font-black tracking-tight text-white sm:text-[19px]">{totalValue}</span>
        <span className={cn("text-xs font-semibold", toneClasses[tone].weekly)}>({weeklyValue})</span>
      </div>
      <p className="mt-0.5 text-[9px] text-white/35">total (semana)</p>
    </div>
  );
}

function MemberPresencePill({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wide",
        online
          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
          : "border-rose-400/20 bg-rose-500/10 text-rose-100",
      )}
    >
      {online ? <Wifi className="h-3 w-3" aria-hidden /> : <WifiOff className="h-3 w-3" aria-hidden />}
      <span>{online ? "On" : "Off"}</span>
    </span>
  );
}

function MemberActionBar({
  member,
  isOwner,
  isYou,
  canKick,
  busyKey,
  justify,
  onChangeRole,
  onTransferOwnership,
  onKickMember,
}: {
  member: ClanMember;
  isOwner: boolean;
  isYou: boolean;
  canKick: boolean;
  busyKey: string | null;
  justify: "start" | "end";
  onChangeRole: (targetUid: string, role: "leader" | "member") => Promise<void>;
  onTransferOwnership: (targetUid: string, nome: string) => Promise<void>;
  onKickMember: (targetUid: string, nome: string) => Promise<void>;
}) {
  const hasOwnerActions = isOwner && !isYou;
  if (!hasOwnerActions && !canKick) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", justify === "end" ? "justify-end" : "justify-start")}>
      {hasOwnerActions && member.role === "member" ? (
        <Button
          variant="secondary"
          className="min-h-[38px] px-3 py-2 text-xs"
          disabled={busyKey !== null}
          onClick={() => void onChangeRole(member.uid, "leader")}
        >
          {busyKey === `role:${member.uid}:leader` ? "Promovendo..." : "Promover a líder"}
        </Button>
      ) : null}

      {hasOwnerActions && member.role === "leader" ? (
        <Button
          variant="secondary"
          className="min-h-[38px] px-3 py-2 text-xs"
          disabled={busyKey !== null}
          onClick={() => void onChangeRole(member.uid, "member")}
        >
          {busyKey === `role:${member.uid}:member` ? "Rebaixando..." : "Rebaixar para membro"}
        </Button>
      ) : null}

      {hasOwnerActions ? (
        <Button
          variant="arena"
          className="min-h-[38px] px-3 py-2 text-xs"
          disabled={busyKey !== null}
          onClick={() => void onTransferOwnership(member.uid, member.nome)}
        >
          {busyKey === `transfer:${member.uid}` ? "Transferindo..." : "Transferir liderança"}
        </Button>
      ) : null}

      {canKick ? (
        <Button
          variant="danger"
          className="min-h-[38px] px-3 py-2 text-xs"
          disabled={busyKey !== null}
          onClick={() => void onKickMember(member.uid, member.nome)}
        >
          <UserX className="h-4 w-4" />
          {busyKey === `kick:${member.uid}` ? "Removendo..." : "Remover do clã"}
        </Button>
      ) : null}
    </div>
  );
}

function RosterStatusCell({ online, detail }: { online: boolean; detail: string }) {
  return (
    <div
      className={cn(
        "rounded-[1rem] border px-2.5 py-2.5",
        online
          ? "border-emerald-400/20 bg-emerald-500/10"
          : "border-rose-400/20 bg-rose-500/10",
      )}
    >
      <div className="flex items-center justify-center gap-1.5">
        {online ? (
          <Wifi className="h-3.5 w-3.5 text-emerald-200" aria-hidden />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-rose-200" aria-hidden />
        )}
        <p
          className={cn(
            "text-xs font-black uppercase tracking-wide",
            online ? "text-emerald-100" : "text-rose-100",
          )}
        >
          {online ? "Online" : "Offline"}
        </p>
      </div>
      <p className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-white/50">
        <Clock3 className="h-3 w-3" aria-hidden />
        <span className="truncate">{detail}</span>
      </p>
    </div>
  );
}
