"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useClanDashboard } from "@/hooks/useClanDashboard";
import { useExperienceCatalogBuckets } from "@/hooks/useExperienceCatalogBuckets";
import { useHomeDashboard } from "@/hooks/useHomeDashboard";
import { StatCard } from "@/components/cards/StatCard";
import { RewardButton } from "@/components/reward/RewardButton";
import { RankingCard } from "@/components/ranking/RankingCard";
import { GameCard } from "@/components/cards/GameCard";
import { HomeChestSummaryCard } from "@/components/chests/HomeChestSummaryCard";
import { ChestGrantNotice } from "@/components/chests/ChestGrantNotice";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { ClanAccessBadge } from "@/components/cla/ClanAccessBadge";
import { runRewardedAdFlow } from "@/services/anuncios/rewardedAdService";
import { ROUTES } from "@/lib/constants/routes";
import { resolveAvatarUrl } from "@/lib/users/avatar";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { resolveUserRankingDailyScore } from "@/lib/users/ranking";
import {
  ArrowRight,
  Banknote,
  CirclePlay,
  Clock3,
  Coins,
  Crown,
  Flame,
  Gift,
  MessageCircle,
  Sparkles,
  Shield,
  Ticket,
  TrendingUp,
  UserPlus,
  Wallet,
  Users,
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
  const {
    clan,
    clanAccessBadge,
    hasClan,
    canManageClan,
    hasUnreadChat,
    hasPendingJoinRequests,
    pendingJoinRequestsCount,
  } = useClanDashboard();
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
  const currentRankingScore = resolveUserRankingDailyScore(profile);
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
  const quickAccessItems = useMemo<HomeQuickAccessItem[]>(() => {
    const baseItems: HomeQuickAccessItem[] = [
      {
        id: "wallet",
        href: ROUTES.carteira,
        label: "Carteira",
        description: "Saldos, extrato e conversão.",
        icon: Wallet,
        tone: "emerald",
      },
      {
        id: "rewards",
        href: ROUTES.recompensas,
        label: "Recompensas",
        description: "Resgates, saques e histórico.",
        icon: Gift,
        tone: "amber",
      },
      {
        id: "resources",
        href: ROUTES.recursos,
        label: "Recursos",
        description: "Baús, roleta e extras do app.",
        icon: Sparkles,
        tone: "cyan",
      },
      {
        id: "shop",
        href: ROUTES.loja,
        label: "Loja",
        description: boostSystemEnabled ? "Boosts e vantagens da arena." : "Itens e bônus premium.",
        icon: Coins,
        tone: "violet",
      },
    ];

    if (hasClan) {
      const clanItems: HomeQuickAccessItem[] = canManageClan
        ? [
            {
              id: "clan-chat",
              href: ROUTES.claChat,
              label: "Chat do clã",
              description: hasUnreadChat ? "Mensagens novas esperando sua leitura." : "Combinados e avisos do time.",
              icon: MessageCircle,
              tone: "fuchsia",
              badge: hasUnreadChat ? "Novo" : undefined,
            },
            {
              id: "clan-config",
              href: ROUTES.claConfiguracoes,
              label: "Gerenciar clã",
              description: hasPendingJoinRequests
                ? "Pedidos, privacidade e código do grupo."
                : "Papéis, descrição e identidade do esquadrão.",
              icon: Shield,
              tone: "amber",
              badge: hasPendingJoinRequests
                ? pendingJoinRequestsCount === 1
                  ? "1 pedido"
                  : `${pendingJoinRequestsCount} pedidos`
                : undefined,
            },
          ]
        : [
            {
              id: "clan-chat",
              href: ROUTES.claChat,
              label: "Chat do clã",
              description: hasUnreadChat ? "Mensagens novas esperando sua leitura." : "Conversa rápida com o time.",
              icon: MessageCircle,
              tone: "fuchsia",
              badge: hasUnreadChat ? "Novo" : undefined,
            },
            {
              id: "clan-members",
              href: ROUTES.claMembros,
              label: "Membros",
              description: "Presença, papéis e formação do clã.",
              icon: Users,
              tone: "cyan",
              badge: clan?.memberCount ? `${clan.memberCount}/${clan.maxMembers}` : undefined,
            },
          ];
      return [...baseItems, ...clanItems];
    }

    return [
      ...baseItems,
      {
        id: "clans",
        href: ROUTES.cla,
        label: "Clãs",
        description:
          clanAccessBadge?.label === "Pedido pendente"
            ? "Acompanhe seu pedido ou procure outro time."
            : "Descubra, crie ou entre em um esquadrão.",
        icon: Crown,
        tone: "fuchsia",
        badge: clanAccessBadge?.label,
      },
      {
        id: "invites",
        href: ROUTES.convidar,
        label: "Convites",
        description: "Traga amigos e aumente suas recompensas.",
        icon: UserPlus,
        tone: "amber",
      },
    ];
  }, [
    boostSystemEnabled,
    canManageClan,
    clan,
    clanAccessBadge?.label,
    hasClan,
    hasPendingJoinRequests,
    hasUnreadChat,
    pendingJoinRequestsCount,
  ]);
  const clanSpotlight = hasClan
    ? {
        eyebrow: "Seu esquadrão",
        title: clan?.name || "Clã",
        description: "Chat, membros e rota do time sem sair da arena.",
        href: ROUTES.cla,
      }
    : {
        eyebrow: "Lobby social",
        title: "Monte seu clã",
        description: "Entre num esquadrão ou abra o seu canal de time.",
        href: ROUTES.cla,
      };

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
    <div className="space-y-5 pb-6">
      <header className="game-panel p-4 shadow-[0_0_60px_-24px_rgba(34,211,238,0.3)] sm:p-5">
        <div className="flex items-start gap-4">
          <div
            aria-label={nome}
            className="h-16 w-16 shrink-0 rounded-[24px] border border-cyan-400/20 bg-cover bg-center shadow-[0_0_34px_-14px_rgba(34,211,238,0.55)]"
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
            <p className="game-kicker">
              Comando da arena
            </p>
            <h1 className="mt-1 bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-2xl font-black tracking-tight text-transparent">
              {nome}
            </h1>
            <p className="mt-1 text-sm text-white/58">Seu hub de PR, ranking diário e esquadrão.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="game-chip">
                Nível {profile?.level ?? "—"}
              </span>
              <span className="game-chip border-orange-400/20 bg-orange-500/10 text-orange-100/85">
                <Flame className="h-3 w-3" />
                streak {profile?.streakAtual ?? 0}
              </span>
              <span className="game-chip border-cyan-400/20 bg-cyan-500/10 text-cyan-100/85">
                {currentRankingScore} pts hoje
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link
            href={ROUTES.ranking}
            className="game-panel-soft flex min-h-[52px] items-center justify-between rounded-[1.15rem] border-cyan-400/18 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/35"
          >
            <span>Ver ranking</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={ROUTES.carteira}
            className="game-panel-soft flex min-h-[52px] items-center justify-between rounded-[1.15rem] border-violet-400/18 px-4 py-3 text-sm font-semibold text-violet-100 transition hover:border-violet-300/35"
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

      <section className="game-panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="game-kicker">Acessos rápidos</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-white">
              Rotas fora do menu
            </h2>
            <p className="mt-1 text-sm text-white/58">Atalhos para áreas secundárias sem inflar o nav.</p>
          </div>
          <span className="game-chip border-cyan-400/18 bg-cyan-500/10 text-cyan-100/82">
            {quickAccessItems.length} rotas
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {quickAccessItems.map((item) => (
            <HomeQuickAccessCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {boostSystemEnabled ? (
        <section className="game-panel overflow-hidden border-amber-400/20 p-4 shadow-[0_0_42px_-18px_rgba(251,191,36,0.2)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="game-kicker text-amber-200/72">
                Boost premium
              </p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-white">
                {boostActive
                  ? `Boost ativo · +${homeBoostPercent}% PR`
                  : storedBoostMinutes > 0
                    ? "Boost no gatilho"
                    : "Ative o boost de PR"}
              </h2>
              <p className="mt-1 text-sm text-white/62">
                {boostActive
                  ? `Termina em ${formatCountdownMs(boostRemainingMs)}.`
                  : storedBoostMinutes > 0
                    ? `Você tem ${storedBoostMinutes} min prontos para ligar na loja.`
                    : "Converta fragmentos em minutos de boost e acelere sua corrida por PR."}
              </p>
            </div>
            <span className="game-chip border-amber-300/20 bg-amber-400/10 text-amber-100/85">
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
              Estoque: {storedBoostMinutes} min
            </span>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="game-panel p-4 shadow-[0_0_48px_-18px_rgba(139,92,246,0.28)] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="game-kicker">Saldo e progresso</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">Farm de PR do dia</h2>
              <p className="mt-1 text-sm text-white/58">Anúncios, check-in e partidas puxam seu placar.</p>
            </div>
            <span className="game-chip">
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
              value={profile ? String(resolveUserRankingDailyScore(profile)) : "—"}
              icon={TrendingUp}
            />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="game-panel-soft rounded-[1.2rem] border-cyan-400/15 px-3 py-3">
              <p className="game-kicker text-cyan-100/75">Anúncios</p>
              <p className="mt-1 text-sm font-semibold text-white">Mais PR com menos esforço</p>
            </div>
            <div className="game-panel-soft rounded-[1.2rem] border-amber-400/15 px-3 py-3">
              <p className="game-kicker text-amber-100/75">Confrontos</p>
              <p className="mt-1 text-sm font-semibold text-white">Ranqueie e acumule recompensas</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Missão relâmpago</p>
              <p className="text-sm text-white/55">A rota mais rápida para subir agora.</p>
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

      <Link
        href={clanSpotlight.href}
        className="game-panel flex items-center justify-between gap-3 overflow-hidden border-fuchsia-400/20 p-4 shadow-[0_0_42px_-18px_rgba(217,70,239,0.35)] transition hover:border-fuchsia-400/35"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/10">
            <Crown className="h-5 w-5 text-fuchsia-200" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="game-kicker text-fuchsia-200/75">{clanSpotlight.eyebrow}</p>
            <p className="mt-1 text-base font-black text-white">{clanSpotlight.title}</p>
            <p className="mt-1 text-xs text-white/58">
              {clanSpotlight.description}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {clanAccessBadge ? (
            <ClanAccessBadge label={clanAccessBadge.label} tone={clanAccessBadge.tone} />
          ) : null}
          <ArrowRight className="h-5 w-5 text-fuchsia-200/80" aria-hidden />
        </div>
      </Link>

      <section className="game-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="game-kicker">Games</p>
            <h2 className="text-lg font-black tracking-tight text-white">Confrontos</h2>
            <p className="text-xs text-white/50">Jogos competitivos com foco em placar e progressão.</p>
          </div>
          <Link href={ROUTES.jogos} className="text-sm font-semibold text-violet-300 hover:underline">
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
              <p className="game-kicker text-cyan-100/65">Recursos extras</p>
              <p className="text-xs text-white/50">
                Recursos extras para girar economia, cooldown e bônus.
              </p>
            </div>
            <Link href={ROUTES.recursos} className="text-sm font-semibold text-cyan-300 hover:underline">
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
                    ? "game-panel-soft rounded-[1.35rem] border-amber-400/20 px-4 py-4 transition hover:border-amber-300/35"
                    : "game-panel-soft rounded-[1.35rem] border-cyan-400/20 px-4 py-4 transition hover:border-cyan-300/35"}
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

      <section className="game-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="game-kicker">Ranking</p>
            <h2 className="text-lg font-black tracking-tight text-white">Ranking de hoje</h2>
            <p className="text-xs text-white/50">Seu avanço no placar do dia.</p>
          </div>
          <Link href={ROUTES.ranking} className="text-sm font-semibold text-violet-300 hover:underline">
            Ranking completo
          </Link>
        </div>

        <div className="game-panel-soft mb-4 rounded-[1.45rem] border-cyan-400/18 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="game-kicker">Seu progresso</p>
              <p className="mt-1 text-xl font-black text-white">{currentRankingScore} pts hoje</p>
            </div>
            <span className="game-chip">
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

type HomeQuickAccessTone = "cyan" | "violet" | "amber" | "emerald" | "fuchsia";

type HomeQuickAccessItem = {
  id: string;
  href: string;
  label: string;
  description: string;
  icon: typeof Wallet;
  tone: HomeQuickAccessTone;
  badge?: string;
};

const quickAccessToneClasses: Record<
  HomeQuickAccessTone,
  { card: string; icon: string; badge: string }
> = {
  cyan: {
    card: "border-cyan-400/18 hover:border-cyan-300/35",
    icon: "border-cyan-300/25 bg-cyan-400/12 text-cyan-100",
    badge: "border-cyan-300/20 bg-cyan-400/10 text-cyan-100/85",
  },
  violet: {
    card: "border-violet-400/18 hover:border-violet-300/35",
    icon: "border-violet-300/25 bg-violet-400/12 text-violet-100",
    badge: "border-violet-300/20 bg-violet-400/10 text-violet-100/85",
  },
  amber: {
    card: "border-amber-400/18 hover:border-amber-300/35",
    icon: "border-amber-300/25 bg-amber-400/12 text-amber-100",
    badge: "border-amber-300/20 bg-amber-400/10 text-amber-100/85",
  },
  emerald: {
    card: "border-emerald-400/18 hover:border-emerald-300/35",
    icon: "border-emerald-300/25 bg-emerald-400/12 text-emerald-100",
    badge: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100/85",
  },
  fuchsia: {
    card: "border-fuchsia-400/18 hover:border-fuchsia-300/35",
    icon: "border-fuchsia-300/25 bg-fuchsia-400/12 text-fuchsia-100",
    badge: "border-fuchsia-300/20 bg-fuchsia-400/10 text-fuchsia-100/85",
  },
};

function HomeQuickAccessCard({ item }: { item: HomeQuickAccessItem }) {
  const tone = quickAccessToneClasses[item.tone];
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`game-panel-soft flex min-h-[124px] flex-col justify-between rounded-[1.35rem] p-4 transition ${tone.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border ${tone.icon}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        {item.badge ? (
          <span className={`game-chip min-h-[1.85rem] px-2.5 py-1 ${tone.badge}`}>
            {item.badge}
          </span>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-black text-white">{item.label}</p>
        <p className="line-clamp-2 text-xs leading-relaxed text-white/58">{item.description}</p>
      </div>
    </Link>
  );
}
