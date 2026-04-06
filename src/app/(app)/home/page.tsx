"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useHomeDashboard } from "@/hooks/useHomeDashboard";
import { StatCard } from "@/components/cards/StatCard";
import { MissionCard } from "@/components/cards/MissionCard";
import { RewardButton } from "@/components/reward/RewardButton";
import { RankingCard } from "@/components/ranking/RankingCard";
import { GameCard } from "@/components/cards/GameCard";
import { DailyStreakCard } from "@/components/cards/DailyStreakCard";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { runRewardedAdFlow } from "@/services/anuncios/rewardedAdService";
import { processDailyLogin } from "@/services/streak/dailyLoginService";
import { claimMissionRewardCallable } from "@/services/missoes/missionService";
import { ROUTES, routeJogosFilaBuscar } from "@/lib/constants/routes";
import { Banknote, CirclePlay, Coins, Ticket, TrendingUp } from "lucide-react";
import Link from "next/link";
import { getDailyRewardUiState } from "@/utils/dailyRewardUiState";

export default function HomePage() {
  const { user, profile, profileLoading } = useAuth();
  const { dailyPreview, ranking, loadError, refreshRanking, streakCardPreview } = useHomeDashboard();
  const [banner, setBanner] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [adLoading, setAdLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const nome = profile?.nome || user?.displayName || "Jogador";

  const claimedToday = useMemo(
    () => getDailyRewardUiState(profile).kind === "claimed_today",
    [profile],
  );
  const currentRankingScore = profile?.scoreRankingDiario ?? 0;
  const highlightedRankingEntry = useMemo(
    () => ranking.find((entry) => entry.uid === user?.uid) ?? null,
    [ranking, user?.uid],
  );
  const rankingGoal = useMemo(() => {
    if (ranking.length === 0) return null;
    if (highlightedRankingEntry?.posicao && highlightedRankingEntry.posicao > 1) {
      const above = ranking.find((entry) => entry.posicao === highlightedRankingEntry.posicao! - 1);
      if (!above) return null;
      return `Faltam ${Math.max(1, above.score - currentRankingScore + 1)} pts para subir uma posição`;
    }
    if (!highlightedRankingEntry) {
      const cutoff = ranking[ranking.length - 1];
      return `Faltam ${Math.max(1, cutoff.score - currentRankingScore + 1)} pts para entrar no top ${ranking.length}`;
    }
    return "Você já aparece entre os melhores desta lista";
  }, [ranking, highlightedRankingEntry, currentRankingScore]);

  async function onAd() {
    setBanner(null);
    setAdLoading(true);
    const res = await runRewardedAdFlow();
    setAdLoading(false);
    setBanner({
      tone: res.ok ? "success" : "error",
      text: res.ok ? res.message : res.message,
    });
    if (res.ok) refreshRanking();
  }

  async function onDaily() {
    setBanner(null);
    setLoginLoading(true);
    const res = await processDailyLogin();
    setLoginLoading(false);
    if (!res.ok) {
      setBanner({ tone: "error", text: res.error || "Erro" });
      return;
    }
    if (res.alreadyCheckedIn) {
      return;
    }
    setBanner({
      tone: "success",
      text: `${res.message ?? "Ok."} · Sequência: ${res.streak ?? "-"} dias`,
    });
  }

  async function onClaim(missionId: string) {
    setClaimingId(missionId);
    const r = await claimMissionRewardCallable(missionId);
    setClaimingId(null);
    setBanner({
      tone: r.ok ? "success" : "error",
      text: r.ok ? "Recompensa resgatada!" : r.error || "Erro ao resgatar",
    });
  }

  return (
    <div className="space-y-6 pb-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-white/55">Olá,</p>
          <h1 className="text-2xl font-bold text-white">{nome}</h1>
        </div>
      </header>

      {profileLoading || !profile ? (
        <AlertBanner tone="info">
          {!profile && !profileLoading
            ? "Sincronizando seu perfil com o servidor…"
            : "Carregando perfil…"}
        </AlertBanner>
      ) : null}

      {profile?.banido ? (
        <AlertBanner tone="error">Conta suspensa. Entre em contato com o suporte.</AlertBanner>
      ) : null}

      {banner ? <AlertBanner tone={banner.tone}>{banner.text}</AlertBanner> : null}

      {loadError ? (
        <AlertBanner tone="error" className="text-xs">
          {loadError}
        </AlertBanner>
      ) : null}

      <section className="space-y-4">
        <div className="rounded-[1.7rem] border border-white/10 bg-gradient-to-br from-slate-950/95 via-violet-950/25 to-slate-950 p-4 shadow-[0_0_48px_-18px_rgba(139,92,246,0.28)] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/65">Saldo e progresso</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">Ganhe PR mais rápido hoje</h2>
              <p className="mt-1 text-sm text-white/55">
                Assista anúncios, complete missões e jogue partidas para subir no ranking do dia.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white/60">
              foco em ação
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatCard label="PR" value={profile ? String(profile.coins) : "—"} icon={Coins} />
            <StatCard label="TICKET" value={profile ? String(profile.gems) : "—"} icon={Ticket} />
            <StatCard
              label="CASH (pontos)"
              value={profile ? String(profile.rewardBalance) : "—"}
              icon={Banknote}
            />
            <StatCard
              label="Ranking hoje"
              value={profile ? String(profile.scoreRankingDiario) : "—"}
              icon={TrendingUp}
            />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/10 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/75">Anúncios</p>
              <p className="mt-1 text-sm font-semibold text-white">Mais PR com menos esforço</p>
            </div>
            <div className="rounded-2xl border border-fuchsia-400/15 bg-fuchsia-500/10 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-100/75">Missões</p>
              <p className="mt-1 text-sm font-semibold text-white">PR, ticket e XP no mesmo fluxo</p>
            </div>
            <div className="rounded-2xl border border-amber-400/15 bg-amber-500/10 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/75">Jogos</p>
              <p className="mt-1 text-sm font-semibold text-white">Ranqueie e acumule recompensas</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Ação principal</p>
              <p className="text-sm text-white/55">Maior potencial de clique e conversão</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-100/90">
              <CirclePlay className="h-3.5 w-3.5" />
              ganho imediato
            </span>
          </div>
          <RewardButton onClick={onAd} loading={adLoading} />
        </div>
      </section>

      <DailyStreakCard
        streak={profile?.streakAtual ?? 0}
        onCheckIn={onDaily}
        loading={loginLoading}
        preview={streakCardPreview}
        claimedToday={claimedToday}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Missões do dia</h2>
            <p className="text-xs text-white/45">Missões rápidas para manter seu progresso ativo</p>
          </div>
          <Link href={ROUTES.missoes} className="text-sm text-violet-300 hover:underline">
            Ver todas
          </Link>
        </div>
        <div className="space-y-3">
          {dailyPreview.length === 0 ? (
            <p className="text-sm text-white/50">
              Nenhuma missão ativa no Firestore. Faça deploy das funções e seed de missões.
            </p>
          ) : (
            dailyPreview.map((m) => (
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

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Jogos</h2>
            <p className="text-xs text-white/45">Cards mais claros, recompensa visível e clique maior</p>
          </div>
          <Link href={ROUTES.jogos} className="text-sm text-violet-300 hover:underline">
            Ver todos
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <GameCard
            href={routeJogosFilaBuscar("ppt")}
            title="PPT"
            subtitle="1v1 rápido e competitivo"
            reward="PR + ranking"
          />
          <GameCard
            href={routeJogosFilaBuscar("quiz")}
            title="Quiz"
            subtitle="acerto e velocidade contam"
            reward="PR + ranking"
          />
          <GameCard
            href={routeJogosFilaBuscar("reaction_tap")}
            title="Reaction"
            subtitle="reflexo puro contra outro jogador"
            reward="PR + ranking"
          />
          <GameCard
            href={`${ROUTES.jogos}/bau`}
            title="Baú"
            subtitle="cooldown curto com loot"
            reward="PR e bônus"
          />
          <GameCard
            href={`${ROUTES.jogos}/roleta`}
            title="Roleta"
            subtitle="gire e busque prêmio rápido"
            reward="PR imediato"
            className="col-span-2"
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Ranking de hoje</h2>
            <p className="text-xs text-white/45">Acompanhe seu avanço e quanto falta para subir</p>
          </div>
          <Link href={ROUTES.ranking} className="text-sm text-violet-300 hover:underline">
            Ranking completo
          </Link>
        </div>

        <div className="mb-4 rounded-[1.7rem] border border-white/10 bg-gradient-to-br from-slate-950/95 via-cyan-950/15 to-slate-950 p-4 shadow-[0_0_42px_-18px_rgba(34,211,238,0.25)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/65">Seu progresso</p>
              <p className="mt-1 text-xl font-black text-white">{currentRankingScore} pts hoje</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white/60">
              {highlightedRankingEntry?.posicao ? `top ${highlightedRankingEntry.posicao}` : "subindo"}
            </span>
          </div>
          {rankingGoal ? (
            <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
              {rankingGoal}
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          {ranking.length === 0 ? (
            <p className="text-sm text-white/50">Ainda sem dados para o período. Jogue para aparecer aqui.</p>
          ) : (
            ranking.map((e) => (
              <RankingCard key={e.uid} entry={e} highlightUid={user?.uid} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
