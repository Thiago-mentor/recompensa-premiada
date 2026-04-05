"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useHomeDashboard } from "@/hooks/useHomeDashboard";
import { StatCard } from "@/components/cards/StatCard";
import { MissionCard } from "@/components/cards/MissionCard";
import { RewardButton } from "@/components/reward/RewardButton";
import { RankingCard } from "@/components/ranking/RankingCard";
import { GameCard } from "@/components/cards/GameCard";
import { DailyStreakCard } from "@/components/cards/DailyStreakCard";
import { ChestCard } from "@/components/cards/ChestCard";
import { PrizeCard } from "@/components/cards/PrizeCard";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { runRewardedAdFlow } from "@/services/anuncios/rewardedAdService";
import { processDailyLogin } from "@/services/streak/dailyLoginService";
import { claimMissionRewardCallable } from "@/services/missoes/missionService";
import { ROUTES, routeJogosFilaBuscar } from "@/lib/constants/routes";
import {
  ArenaShell,
  fadeUpItem,
  staggerContainer,
  staggerItem,
} from "@/components/arena/ArenaShell";
import { Banknote, Coins, Ticket, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
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
        <Link href={ROUTES.recompensas}>
          <Button variant="ghost" className="text-xs py-2 px-3">
            Recompensas
          </Button>
        </Link>
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

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="PR"
          value={profile ? String(profile.coins) : "—"}
          icon={Coins}
        />
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

      <DailyStreakCard
        streak={profile?.streakAtual ?? 0}
        onCheckIn={onDaily}
        loading={loginLoading}
        preview={streakCardPreview}
        claimedToday={claimedToday}
      />

      <RewardButton onClick={onAd} loading={adLoading} />

      <PrizeCard
        title="Evento de lançamento"
        subtitle="Missões extras em breve — fique de olho nos banners."
      />

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Missões do dia</h2>
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
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Top ranking hoje</h2>
          <Link href={ROUTES.ranking} className="text-sm text-violet-300 hover:underline">
            Ranking completo
          </Link>
        </div>
        <div className="space-y-2">
          {ranking.length === 0 ? (
            <p className="text-sm text-white/50">Ainda sem dados para o período — jogue e suba!</p>
          ) : (
            ranking.map((e) => (
              <RankingCard key={e.uid} entry={e} highlightUid={user?.uid} />
            ))
          )}
        </div>
      </section>

      <section>
        <ArenaShell maxWidth="max-w-none" padding="sm" className="!mx-0 w-full max-w-full">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-32px" }}
          >
            <motion.div variants={fadeUpItem} className="mb-1 flex items-center gap-2">
              <span className="h-1 w-6 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500" />
              <h2 className="bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-lg font-black tracking-tight text-transparent">
                Jogos rápidos
              </h2>
            </motion.div>
            <motion.p variants={fadeUpItem} className="mb-3 text-xs text-white/45">
              Toque para entrar na fila PvP ou abrir o hub completo de minijogos.
            </motion.p>
            <motion.div variants={staggerContainer} className="grid grid-cols-2 gap-3">
              <motion.div variants={staggerItem}>
                <GameCard
                  href={routeJogosFilaBuscar("ppt")}
                  title="PPT"
                  subtitle="1v1 · procura adversário"
                />
              </motion.div>
              <motion.div variants={staggerItem}>
                <GameCard
                  href={routeJogosFilaBuscar("quiz")}
                  title="Quiz"
                  subtitle="1v1 · procura adversário"
                />
              </motion.div>
              <motion.div variants={staggerItem}>
                <GameCard
                  href={routeJogosFilaBuscar("reaction_tap")}
                  title="Reaction"
                  subtitle="1v1 · procura adversário"
                />
              </motion.div>
              <motion.div variants={staggerItem}>
                <GameCard href={`${ROUTES.jogos}/bau`} title="Baú" subtitle="Cooldown + loot" />
              </motion.div>
            </motion.div>
            <motion.p variants={fadeUpItem} className="mt-4 text-center">
              <Link
                href={ROUTES.jogosFila}
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 text-xs font-bold text-violet-200 transition hover:border-violet-400/50 hover:bg-violet-500/15"
              >
                Fila 1v1 — todos os modos
              </Link>
            </motion.p>
          </motion.div>
        </ArenaShell>
      </section>

      <motion.div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-24px" }}
        variants={staggerContainer}
      >
        <motion.div variants={staggerItem}>
          <ChestCard
            available
            onOpen={() =>
              setBanner({ tone: "success", text: "Baú: integre finalizeMatch / cooldown na Function." })
            }
          />
        </motion.div>
        <motion.div variants={staggerItem} className="h-full">
          <GameCard
            href={`${ROUTES.jogos}/roleta`}
            title="Roleta"
            subtitle="Prêmios em PR"
            className="h-full justify-center"
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
