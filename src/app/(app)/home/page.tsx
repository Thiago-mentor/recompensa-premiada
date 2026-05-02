"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useHomeDashboard } from "@/hooks/useHomeDashboard";
import { PremiumCard } from "@/components/ui/PremiumCard";
import { ChestGrantNotice } from "@/components/chests/ChestGrantNotice";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { runRewardedAdFlow } from "@/services/anuncios/rewardedAdService";
import { getActiveRaffleCallable } from "@/services/raffle/raffleService";
import { fetchTopRanking } from "@/services/ranking/rankingService";
import { ROUTES } from "@/lib/constants/routes";
import {
  resolveAvatarBackgroundCssValue,
  resolveAvatarUrl,
} from "@/lib/users/avatar";
import { getWeeklyPeriodKey } from "@/utils/date";
import {
  Banknote,
  Bell,
  Coins,
  Crown,
  Flame,
  Gift,
  Play,
  RotateCw,
  Ticket,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { GrantedChestSummary } from "@/types/chest";
import type { RaffleView } from "@/types/raffle";
import type { RankingEntry } from "@/types/ranking";

const WEEKLY_GAME_LEADERS_LIMIT = 3;
const WEEKLY_GAME_LEADER_CARDS = [
  { gameId: "ppt", label: "PPT" },
  { gameId: "quiz", label: "QUIZ" },
  { gameId: "reaction_tap", label: "REACTION" },
] as const;

function formatCountdownClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function xpBarPercent(level: number | undefined, xp: number | undefined): number {
  const lv = Math.max(1, level ?? 1);
  const x = Math.max(0, xp ?? 0);
  const span = Math.max(400, lv * 180);
  const inSpan = x % span;
  return Math.min(100, Math.round((inSpan / span) * 100));
}

export default function HomePage() {
  const { user, profile, profileLoading } = useAuth();
  const { ranking, refreshRanking } = useHomeDashboard();
  const [banner, setBanner] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [grantedChestNotice, setGrantedChestNotice] = useState<GrantedChestSummary | null>(null);
  const [adLoading, setAdLoading] = useState(false);
  const [activeRaffle, setActiveRaffle] = useState<RaffleView | null>(null);
  const [raffleTick, setRaffleTick] = useState(() => Date.now());
  const [weeklyGameLeaders, setWeeklyGameLeaders] = useState<
    Record<(typeof WEEKLY_GAME_LEADER_CARDS)[number]["gameId"], RankingEntry[]>
  >({
    ppt: [],
    quiz: [],
    reaction_tap: [],
  });
  const [weeklyGameLeadersLoading, setWeeklyGameLeadersLoading] = useState(true);

  const nome = profile?.nome || user?.displayName || "Jogador";

  const sorteioClockDisplay = useMemo(() => {
    if (!activeRaffle?.endsAtMs) return null;
    const ms = activeRaffle.endsAtMs - raffleTick;
    if (ms <= 0) return "00:00:00";
    return formatCountdownClock(ms);
  }, [activeRaffle, raffleTick]);

  const liveWinnerTeaser = useMemo(() => {
    if (activeRaffle && activeRaffle.prizeAmount > 0) {
      const amt = activeRaffle.prizeAmount;
      const cur = activeRaffle.prizeCurrency;
      const highlight =
        cur === "rewardBalance"
          ? `${amt.toLocaleString("pt-BR")} CASH`
          : cur === "gems"
            ? `${amt.toLocaleString("pt-BR")} TICKET`
            : `${amt.toLocaleString("pt-BR")} PR`;
      return {
        highlight,
        sub: "Prêmio do sorteio ativo — garanta seus números!",
      };
    }
    if (ranking[0]) {
      const n = ranking[0].nome.trim().split(/\s+/)[0];
      return {
        highlight: `${ranking[0].score.toLocaleString("pt-BR")} pts`,
        sub: `${n} lidera o placar agora há pouco`,
      };
    }
    return {
      highlight: "PR + sorteios",
      sub: "Jogue hoje e apareça no hall",
    };
  }, [activeRaffle, ranking]);

  const notifyBell = Boolean(grantedChestNotice);
  const xpPct = xpBarPercent(profile?.level, profile?.xp);

  useEffect(() => {
    let cancelled = false;
    void getActiveRaffleCallable().then((res) => {
      if (cancelled || !res.ok) return;
      setActiveRaffle(res.enabled && res.raffle?.status === "active" ? res.raffle : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeRaffle?.endsAtMs) return;
    const id = window.setInterval(() => setRaffleTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeRaffle?.endsAtMs]);

  useEffect(() => {
    let cancelled = false;
    async function loadWeeklyGameLeaders() {
      if (!user?.uid) {
        if (!cancelled) {
          setWeeklyGameLeaders({ ppt: [], quiz: [], reaction_tap: [] });
          setWeeklyGameLeadersLoading(false);
        }
        return;
      }
      setWeeklyGameLeadersLoading(true);
      try {
        const periodKey = getWeeklyPeriodKey();
        const [ppt, quiz, reactionTap] = await Promise.all(
          WEEKLY_GAME_LEADER_CARDS.map((item) =>
            fetchTopRanking("semanal", periodKey, WEEKLY_GAME_LEADERS_LIMIT, {
              scope: "game",
              gameId: item.gameId,
            }),
          ),
        );
        if (!cancelled) {
          setWeeklyGameLeaders({ ppt, quiz, reaction_tap: reactionTap });
        }
      } finally {
        if (!cancelled) setWeeklyGameLeadersLoading(false);
      }
    }
    void loadWeeklyGameLeaders();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

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
    <div className="pb-4">
      <PremiumCard className="overflow-hidden rounded-[1.9rem] border-violet-400/45 bg-[radial-gradient(circle_at_50%_-10%,rgba(139,92,246,0.28),transparent_34%),linear-gradient(180deg,rgba(8,5,22,0.98),rgba(11,8,30,0.96)_45%,rgba(5,7,18,0.98))] p-3.5 shadow-[0_28px_70px_-30px_rgba(0,0,0,0.82),0_0_70px_-24px_rgba(139,92,246,0.55),inset_0_1px_0_rgba(255,255,255,0.09)] sm:p-4" role="banner">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              aria-label={nome}
              className="h-12 w-12 shrink-0 rounded-full border-[2.5px] border-amber-400/85 bg-cover bg-center shadow-[0_0_22px_-6px_rgba(251,191,36,0.6),inset_0_0_0_1px_rgba(253,230,138,0.35)] ring-2 ring-amber-500/25"
              style={{
                backgroundImage: resolveAvatarBackgroundCssValue({
                  photoUrl: profile?.foto ?? user?.photoURL,
                  name: profile?.nome ?? user?.displayName,
                  username: profile?.username,
                  uid: profile?.uid ?? user?.uid,
                }),
              }}
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-black leading-tight tracking-tight text-white">
                {nome}
              </h1>
              <p className="mt-0.5 text-[10px] font-semibold text-amber-100/80">Nível {profile?.level ?? "—"}</p>
              <div className="relative mt-1.5 h-1.5 overflow-visible rounded-full bg-black/60 ring-1 ring-inset ring-violet-500/25">
                <div className="h-1.5 overflow-hidden rounded-full">
                  <div
                    className="h-full max-w-full rounded-full bg-gradient-to-r from-amber-400 via-fuchsia-500 to-violet-500 shadow-[0_0_14px_rgba(236,72,153,0.5)] transition-all duration-500"
                    style={{ width: `${xpPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          <Link
            href={ROUTES.perfil}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(15,23,42,0.5))] shadow-[0_4px_20px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-white/[0.12]"
            aria-label="Perfil e alertas"
          >
            <Bell className="h-5 w-5 text-white/88" strokeWidth={1.75} />
            {notifyBell ? (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#0c0618]" />
            ) : null}
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Link href={ROUTES.carteira} className="casino-panel-soft flex items-center gap-2 rounded-[1rem] !border-rose-400/25 !border-amber-400/20 px-2.5 py-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/20 shadow-[0_0_14px_-4px_rgba(251,113,133,0.75)]">
              <Coins className="h-3.5 w-3.5 text-rose-300" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] font-black uppercase text-amber-200/90">PR</span>
              <span className="block truncate bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-xs font-black tabular-nums text-transparent">
                {profile ? profile.coins.toLocaleString("pt-BR") : "—"}
              </span>
            </span>
          </Link>
          <Link href={ROUTES.recursos} className="casino-panel-soft flex items-center gap-2 rounded-[1rem] !border-fuchsia-500/30 px-2.5 py-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/18 shadow-[0_0_14px_-4px_rgba(217,70,239,0.75)]">
              <Ticket className="h-3.5 w-3.5 text-rose-300" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] font-black uppercase text-fuchsia-200/90">Ticket</span>
              <span className="block truncate text-xs font-black tabular-nums text-white">
                {profile ? profile.gems.toLocaleString("pt-BR") : "—"}
              </span>
            </span>
          </Link>
          <Link href={ROUTES.carteira} className="casino-panel-soft flex items-center gap-2 rounded-[1rem] !border-emerald-400/35 px-2.5 py-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/18 shadow-[0_0_14px_-4px_rgba(52,211,153,0.75)]">
              <Banknote className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] font-black uppercase text-emerald-200/90">Cash</span>
              <span className="block truncate bg-gradient-to-b from-amber-50 via-amber-300 to-amber-500 bg-clip-text text-xs font-black tabular-nums text-transparent">
                {profile ? `R$ ${profile.rewardBalance.toLocaleString("pt-BR")}` : "—"}
              </span>
            </span>
          </Link>
        </div>

        {profileLoading || !profile ? (
          <div className="mt-3">
            <AlertBanner tone="info">
              {!profile && !profileLoading
                ? "Sincronizando seu perfil com o servidor..."
                : "Carregando perfil..."}
            </AlertBanner>
          </div>
        ) : null}

        {profile?.banido ? (
          <div className="mt-3">
            <AlertBanner tone="error">Conta suspensa. Entre em contato com o suporte.</AlertBanner>
          </div>
        ) : null}

        {banner ? (
          <div className="mt-3">
            <AlertBanner tone={banner.tone}>{banner.text}</AlertBanner>
          </div>
        ) : null}

        {grantedChestNotice ? (
          <div className="mt-3">
            <ChestGrantNotice grantedChest={grantedChestNotice} label="Novo baú concedido" />
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-[1fr_0.82fr] gap-2">
          <Link
            href={ROUTES.ranking}
            className="casino-panel-soft flex min-h-[86px] flex-col justify-center rounded-[1.15rem] !border-rose-400/35 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.22),transparent_38%),linear-gradient(145deg,rgba(69,10,10,0.36),rgba(36,10,38,0.72))] px-3.5 py-3"
          >
            <p className="text-[10px] font-black text-white/85">
              <Flame className="mr-1 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
              Alguém ganhou
            </p>
            <p className="mt-1 bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-400 bg-clip-text text-xl font-black leading-tight text-transparent">
              {liveWinnerTeaser.highlight}
            </p>
            <p className="mt-1 line-clamp-1 text-[10px] text-white/55">{liveWinnerTeaser.sub}</p>
          </Link>
          <Link
            href={ROUTES.sorteios}
            className="rounded-[1.2rem] bg-[linear-gradient(135deg,#f0abfc,#fb923c_42%,#c026d3)] p-[2px] shadow-[0_0_34px_-8px_rgba(244,114,182,0.72)]"
          >
            <div className="flex min-h-[86px] flex-col items-center justify-center rounded-[1.08rem] bg-[linear-gradient(180deg,rgba(35,16,62,0.98),rgba(9,8,24,0.99))] px-2 py-3 text-center">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/90">Sorteio especial</p>
              <p className="mt-1 text-xl font-black tabular-nums tracking-tight text-white">
                {sorteioClockDisplay ?? (activeRaffle ? "Ao vivo" : "Aberto")}
              </p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-amber-300">
                Participe agora!
              </p>
            </div>
          </Link>
        </div>

        <section className="mt-3" aria-label="Ações principais">
          <div className="grid grid-cols-3 gap-2.5">
            <Link
              href={`${ROUTES.recursos}/roleta`}
              className="casino-panel-soft relative flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-[1.1rem] !border-violet-400/40 p-2.5 text-center"
            >
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(from_20deg,#facc15,#ec4899,#8b5cf6,#22d3ee,#22c55e,#facc15)] shadow-[0_0_24px_-6px_rgba(139,92,246,0.75)]">
                <span className="absolute h-9 w-9 rounded-full bg-slate-950/80" />
                <RotateCw className="relative h-5 w-5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" aria-hidden />
              </span>
              <span className="text-[9px] font-black uppercase leading-tight tracking-wide text-white">
                Giro da sorte
              </span>
            </Link>
            <Link
              href={`${ROUTES.recursos}/bau`}
              className="casino-panel-soft relative flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-[1.1rem] !border-amber-400/45 p-2.5 text-center"
            >
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem] bg-[linear-gradient(180deg,#facc15,#b45309)] shadow-[0_12px_24px_-10px_rgba(0,0,0,0.8),0_0_24px_-6px_rgba(251,191,36,0.8)]">
                <span className="absolute inset-x-1 top-5 h-2 rounded-full bg-amber-950/45" />
                <Gift className="relative h-7 w-7 text-amber-950" aria-hidden />
              </span>
              <span className="text-[9px] font-black uppercase leading-tight tracking-wide text-white">
                Abrir baú
              </span>
            </Link>
            <button
              type="button"
              onClick={onAd}
              disabled={adLoading}
              className="casino-panel-soft relative flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-[1.1rem] !border-fuchsia-400/50 bg-[linear-gradient(180deg,rgba(236,72,153,0.16),rgba(124,58,237,0.14),rgba(15,23,42,0.2))] p-2.5 text-center disabled:opacity-60"
            >
              <span className="absolute right-1.5 top-1.5 z-20 rounded-full border border-amber-300/50 bg-amber-400/20 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide text-amber-50 shadow-[0_0_14px_rgba(251,191,36,0.55)]">
                +PR
              </span>
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem] bg-[linear-gradient(145deg,#c4b5fd,#4f46e5_55%,#111827)] shadow-[0_12px_24px_-10px_rgba(0,0,0,0.8),0_0_24px_-6px_rgba(217,70,239,0.7)]">
                <Play className="h-7 w-7 fill-white text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.55)]" aria-hidden />
              </span>
              <span className="text-[9px] font-black uppercase leading-tight tracking-wide text-white">
                {adLoading ? "Carregando" : "Assistir anúncio"}
              </span>
            </button>
          </div>
        </section>

        <Link
          href={ROUTES.cla}
          className="casino-panel-soft mt-3 flex min-h-[92px] items-center justify-between gap-3 rounded-[1.25rem] !border-cyan-400/35 bg-[radial-gradient(circle_at_12%_18%,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_92%_14%,rgba(217,70,239,0.2),transparent_32%),linear-gradient(135deg,rgba(8,47,73,0.42),rgba(49,46,129,0.52),rgba(15,23,42,0.86))] px-3.5 py-3 shadow-[0_0_40px_-16px_rgba(34,211,238,0.42),0_18px_34px_-22px_rgba(0,0,0,0.78)] transition hover:!border-cyan-300/55 hover:brightness-110"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.1rem] border border-cyan-300/35 bg-[linear-gradient(145deg,rgba(34,211,238,0.2),rgba(139,92,246,0.34))] shadow-[0_0_24px_-8px_rgba(34,211,238,0.7),inset_0_1px_0_rgba(255,255,255,0.12)]">
              <span className="absolute inset-1 rounded-[0.9rem] border border-white/10" aria-hidden />
              <Users className="relative h-7 w-7 text-cyan-100 drop-shadow-[0_0_10px_rgba(34,211,238,0.65)]" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-cyan-200/85">
                Arena social
              </span>
              <span className="mt-1 block truncate text-base font-black tracking-tight text-white">
                Entrar no clã
              </span>
              <span className="mt-0.5 block line-clamp-1 text-[11px] text-white/58">
                Chat, membros, pedidos e ranking do seu esquadrão.
              </span>
            </span>
          </div>
          <span className="shrink-0 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-amber-200">
            Acessar
          </span>
        </Link>

        <WeeklyGameLeadersHomeSection
          leaders={weeklyGameLeaders}
          loading={weeklyGameLeadersLoading}
        />

        <section className="mt-3 rounded-[1.2rem] border border-white/10 bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/75">
              Atividades ao vivo
            </p>
            <Link href={ROUTES.ranking} className="text-[10px] font-semibold text-amber-200/90 hover:underline">
              Ver tudo
            </Link>
          </div>
          <ul className="mt-2 space-y-1.5">
            {ranking.length === 0 ? (
              <li className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/55">
                Ninguém no placar ainda. Jogue e apareça aqui.
              </li>
            ) : (
              ranking.slice(0, 4).map((e, i) => (
                <li key={e.uid} className="flex items-center gap-2 rounded-xl bg-white/[0.035] px-2 py-1.5">
                  <div
                    className="h-6 w-6 shrink-0 rounded-full border border-violet-400/25 bg-cover bg-center"
                    style={{
                      backgroundImage: resolveAvatarBackgroundCssValue({
                        photoUrl: e.foto,
                        name: e.nome,
                        username: e.username ?? null,
                        uid: e.uid,
                      }),
                    }}
                  />
                  <p className="min-w-0 flex-1 truncate text-[11px] text-white/82">
                    <span className="font-semibold text-white">{e.nome.trim().split(/\s+/)[0]}</span>{" "}
                    marcou{" "}
                    <span className="font-black text-amber-300">
                      {e.score.toLocaleString("pt-BR")} pts
                    </span>
                  </p>
                  <span className="shrink-0 text-[9px] text-white/38">há {i + 1} min</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </PremiumCard>
    </div>
  );
}

function WeeklyGameLeadersHomeSection({
  leaders,
  loading,
}: {
  leaders: Record<(typeof WEEKLY_GAME_LEADER_CARDS)[number]["gameId"], RankingEntry[]>;
  loading: boolean;
}) {
  return (
    <section className="mt-3 rounded-[1.2rem] border border-cyan-400/18 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(0,0,0,0.18))] p-3 shadow-[0_0_34px_-18px_rgba(34,211,238,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/75">
            Top semanal
          </p>
          <h2 className="mt-0.5 text-sm font-black text-white">Líderes dos jogos</h2>
        </div>
        <Link href={ROUTES.ranking} className="text-[10px] font-semibold text-amber-200/90 hover:underline">
          Ranking
        </Link>
      </div>

      <div className="mt-3 grid gap-2">
        {WEEKLY_GAME_LEADER_CARDS.map((item) => (
          <WeeklyGameLeaderHomeCard
            key={item.gameId}
            title={item.label}
            entries={leaders[item.gameId]}
            loading={loading}
          />
        ))}
      </div>
    </section>
  );
}

function WeeklyGameLeaderHomeCard({
  title,
  entries,
  loading,
}: {
  title: string;
  entries: RankingEntry[];
  loading: boolean;
}) {
  const leader = entries[0] ?? null;

  return (
    <div className="rounded-[1rem] border border-white/10 bg-black/18 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full border border-violet-300/22 bg-violet-500/12 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-violet-100">
          {title}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wide text-white/38">
          Semanal
        </span>
      </div>

      {loading ? (
        <div className="mt-2 h-10 animate-pulse rounded-xl bg-white/[0.05]" />
      ) : leader ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-[0_0_16px_-6px_rgba(251,191,36,0.75)]">
            <Crown className="h-4 w-4" aria-hidden />
          </span>
          <div
            aria-label={leader.nome}
            className="h-8 w-8 shrink-0 rounded-full border border-white/10 bg-cover bg-center"
            style={{
              backgroundImage: resolveAvatarBackgroundCssValue({
                photoUrl: leader.foto,
                name: leader.nome,
                username: leader.username,
                uid: leader.uid,
              }),
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{leader.nome}</p>
            <p className="text-[9px] text-white/40">
              {leader.username ? `@${leader.username}` : `${leader.vitorias} vitórias`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black uppercase tracking-wide text-amber-200/65">Pontos</p>
            <p className="bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-xs font-black tabular-nums text-transparent">
              {leader.score.toLocaleString("pt-BR")}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-2 rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-3 py-2 text-center text-[10px] text-white/42">
          Sem pontuação nesta semana.
        </p>
      )}
    </div>
  );
}
