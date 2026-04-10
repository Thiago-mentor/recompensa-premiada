"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useExperienceCatalogBuckets } from "@/hooks/useExperienceCatalogBuckets";
import { useHomeDashboard } from "@/hooks/useHomeDashboard";
import { StatCard } from "@/components/cards/StatCard";
import { RewardButton } from "@/components/reward/RewardButton";
import { RankingCard } from "@/components/ranking/RankingCard";
import { GameCard } from "@/components/cards/GameCard";
import { HomeChestSummaryCard } from "@/components/chests/HomeChestSummaryCard";
import { ChestGrantNotice } from "@/components/chests/ChestGrantNotice";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { runRewardedAdFlow } from "@/services/anuncios/rewardedAdService";
import { ROUTES } from "@/lib/constants/routes";
import { resolveAvatarUrl } from "@/lib/users/avatar";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import {
  ArrowRight,
  Banknote,
  CirclePlay,
  Clock3,
  Coins,
  Flame,
  Gift,
  Sparkles,
  Ticket,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import type { GrantedChestSummary } from "@/types/chest";
import type { SystemEconomyConfig } from "@/types/systemConfig";
import { BOOST_SYSTEM_DEFAULT_ENABLED, isBoostSystemEnabled } from "@/lib/features/boost";

function timestampToMs(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  if ("toMillis" in value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return null;
    }
  }
  if ("toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return null;
    }
  }
  return null;
}

function formatCountdownMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function HomePage() {
  const { user, profile, profileLoading } = useAuth();
  const { arena: arenaCatalog, utility: utilityCatalog } = useExperienceCatalogBuckets();
  const { ranking, refreshRanking } = useHomeDashboard();
  const [banner, setBanner] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [grantedChestNotice, setGrantedChestNotice] = useState<GrantedChestSummary | null>(null);
  const [adLoading, setAdLoading] = useState(false);
  const [homeBoostPercent, setHomeBoostPercent] = useState(25);
  const [boostSystemEnabled, setBoostSystemEnabled] = useState(BOOST_SYSTEM_DEFAULT_ENABLED);
  const [boostNowMs, setBoostNowMs] = useState(() => Date.now());

  const nome = profile?.nome || user?.displayName || "Jogador";
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const snap = await getDoc(doc(getFirebaseFirestore(), COLLECTIONS.systemConfigs, "economy"));
        if (!snap.exists() || cancelled) return;
        const data = snap.data() as Partial<SystemEconomyConfig>;
        setBoostSystemEnabled(isBoostSystemEnabled(data));
        if (typeof data.boostRewardPercent === "number") {
          setHomeBoostPercent(Math.max(0, Math.floor(data.boostRewardPercent)));
        }
      } catch {
        if (!cancelled) {
          setBoostSystemEnabled(BOOST_SYSTEM_DEFAULT_ENABLED);
          setHomeBoostPercent(25);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeBoostUntilMs = boostSystemEnabled ? timestampToMs(profile?.activeBoostUntil) : null;
  const boostRemainingMs =
    activeBoostUntilMs != null ? Math.max(0, activeBoostUntilMs - boostNowMs) : 0;
  const boostActive = boostRemainingMs > 0;
  const storedBoostMinutes = boostSystemEnabled ? profile?.storedBoostMinutes ?? 0 : 0;

  useEffect(() => {
    if (!boostSystemEnabled || !boostActive) return;
    const id = window.setInterval(() => setBoostNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [boostActive, boostSystemEnabled]);

  async function onAd() {
    setBanner(null);
    setGrantedChestNotice(null);
    setAdLoading(true);
    const res = await runRewardedAdFlow();
    setAdLoading(false);
    setBanner({
      tone: res.ok ? "success" : "error",
      text: res.ok ? res.message : res.message,
    });
    if (res.ok) refreshRanking();
  }

  return (
    <div className="space-y-6 pb-4">
      <header className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.18),transparent_36%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-4 shadow-[0_0_56px_-26px_rgba(34,211,238,0.28)] sm:p-5">
        <div className="flex items-start gap-4">
          <div
            aria-label={nome}
            className="h-16 w-16 shrink-0 rounded-[22px] border border-white/10 bg-cover bg-center shadow-[0_0_32px_-16px_rgba(34,211,238,0.55)]"
            style={{
              backgroundImage: `url(${resolveAvatarUrl({
                photoUrl: profile?.foto ?? user?.photoURL,
                name: profile?.nome ?? user?.displayName,
                username: profile?.username,
                uid: profile?.uid ?? user?.uid,
              })})`,
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/70">
              Painel premium
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">{nome}</h1>
            <p className="mt-1 text-sm text-white/55">
              Continue acumulando PR, tickets e posição no ranking do dia.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white/70">
                Nível {profile?.level ?? "—"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-100/85">
                <Flame className="h-3 w-3" />
                streak {profile?.streakAtual ?? 0}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link
            href={ROUTES.ranking}
            className="flex min-h-[48px] items-center justify-between rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
          >
            <span>Ver ranking</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={ROUTES.carteira}
            className="flex min-h-[48px] items-center justify-between rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/15"
          >
            <span>Abrir carteira</span>
            <Wallet className="h-4 w-4" />
          </Link>
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

      {grantedChestNotice ? (
        <ChestGrantNotice
          grantedChest={grantedChestNotice}
          label="Novo baú concedido"
        />
      ) : null}

      {boostSystemEnabled ? (
        <section className="overflow-hidden rounded-[1.6rem] border border-amber-400/20 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_26%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.16),transparent_32%),linear-gradient(135deg,rgba(51,65,85,0.98),rgba(15,23,42,0.98))] p-4 shadow-[0_0_42px_-18px_rgba(251,191,36,0.2)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/70">
                Boost premium
              </p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-white">
                {boostActive
                  ? `Boost ativo · +${homeBoostPercent}% PR`
                  : storedBoostMinutes > 0
                    ? "Boost pronto para ativação"
                    : "Ative multiplicadores de PR"}
              </h2>
              <p className="mt-1 text-sm text-white/60">
                {boostActive
                  ? `Faltam ${formatCountdownMs(boostRemainingMs)} para o bônus acabar.`
                  : storedBoostMinutes > 0
                    ? `Você tem ${storedBoostMinutes} min guardados para ligar na loja.`
                    : "Transforme fragmentos em minutos de boost e acelere anúncios, streak e partidas."}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-100/85">
              {boostActive ? <Flame className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
              {boostActive ? "online" : storedBoostMinutes > 0 ? "pronto" : "offline"}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={ROUTES.loja}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-2.5 text-sm font-bold text-amber-100 transition hover:bg-amber-400/15"
            >
              {boostActive ? "Gerenciar boost" : "Abrir loja de boost"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <span className="inline-flex min-h-[44px] items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/65">
              Estoque atual: {storedBoostMinutes} min
            </span>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="rounded-[1.7rem] border border-white/10 bg-gradient-to-br from-slate-950/95 via-violet-950/25 to-slate-950 p-4 shadow-[0_0_48px_-18px_rgba(139,92,246,0.28)] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/65">Saldo e progresso</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">Ganhe PR mais rápido hoje</h2>
              <p className="mt-1 text-sm text-white/55">
                Assista anúncios, faça check-in e jogue partidas para subir no ranking do dia.
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

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/10 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/75">Anúncios</p>
              <p className="mt-1 text-sm font-semibold text-white">Mais PR com menos esforço</p>
            </div>
            <div className="rounded-2xl border border-amber-400/15 bg-amber-500/10 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/75">Confrontos</p>
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

      <HomeChestSummaryCard />

      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Games</p>
            <h2 className="text-lg font-semibold text-white">Confrontos</h2>
            <p className="text-xs text-white/45">Jogos competitivos com foco em ranking e progresso.</p>
          </div>
          <Link href={ROUTES.jogos} className="text-sm text-violet-300 hover:underline">
            Ver todos
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {arenaCatalog.length === 0 ? (
            <div className="col-span-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
              Nenhum confronto ativo na arena neste momento.
            </div>
          ) : (
            arenaCatalog.map((game, index) => (
              <GameCard
                key={game.id}
                href={game.href}
                title={game.title}
                subtitle={game.subtitle}
                reward={homeExperienceReward(game.id)}
                className={arenaCatalog.length % 2 === 1 && index === arenaCatalog.length - 1 ? "col-span-2" : undefined}
              />
            ))
          )}
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                Recursos extras
              </p>
              <p className="text-xs text-white/45">
                As experiências classificadas como recurso continuam disponíveis nesta área do app.
              </p>
            </div>
            <Link href={ROUTES.recursos} className="text-sm text-cyan-300 hover:underline">
              Abrir recursos
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {utilityCatalog.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45 sm:col-span-2">
                Nenhum recurso extra configurado no momento.
              </div>
            ) : (
              utilityCatalog.map((resource) => (
                <Link
                  key={resource.id}
                  href={resource.href}
                  className={resource.id === "bau"
                    ? "rounded-[1.4rem] border border-amber-400/20 bg-amber-500/10 px-4 py-4 transition hover:bg-amber-500/15"
                    : "rounded-[1.4rem] border border-cyan-400/20 bg-cyan-500/10 px-4 py-4 transition hover:bg-cyan-500/15"}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{resource.title}</p>
                      <p className="mt-1 text-xs text-white/60">
                        {resource.id === "bau"
                          ? "Recurso com cooldown para liberar bônus e recompensas extras."
                          : "Acesso rápido para buscar PR e movimentar sua economia no app."}
                      </p>
                    </div>
                    {resource.id === "bau" ? (
                      <Gift className="h-5 w-5 text-amber-200" />
                    ) : (
                      <Sparkles className="h-5 w-5 text-cyan-200" />
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Ranking</p>
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

function homeExperienceReward(gameId: string) {
  if (gameId === "roleta") return "PR imediato";
  if (gameId === "bau") return "PR e bônus";
  return "PR + ranking";
}
