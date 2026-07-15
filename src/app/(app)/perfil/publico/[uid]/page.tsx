"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Crown,
  Flame,
  Medal,
  ShieldCheck,
  Share2,
  Sparkles,
  Swords,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/lib/constants/routes";
import { resolveAvatarBackgroundCssValue } from "@/lib/users/avatar";
import { fetchPublicProfile } from "@/services/users/publicProfileService";
import type { PublicProfile } from "@/types/publicProfile";

type TrophyState = {
  title: string;
  description: string;
  icon: LucideIcon;
  unlocked: boolean;
  progress: string;
  tone: string;
};

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

function PublicMetric({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="game-panel-soft rounded-[1.1rem] border-white/10 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">{label}</span>
        <Icon className="h-4 w-4 text-cyan-200/75" aria-hidden />
      </div>
      <p className="mt-2 text-xl font-black tabular-nums text-white">{value}</p>
    </div>
  );
}

function buildTrophies(profile: PublicProfile): TrophyState[] {
  return [
    {
      title: "Primeiro ranking",
      description: "Receba sua primeira premiacao de ranking.",
      icon: Trophy,
      unlocked: profile.rankingWins >= 1,
      progress: profile.rankingWins >= 1 ? "Conquistado" : "Ainda nao conquistado",
      tone: "border-amber-300/25 bg-amber-400/10 text-amber-100",
    },
    {
      title: "Trinca de rankings",
      description: "Conquiste tres premiacoes de ranking.",
      icon: Crown,
      unlocked: profile.rankingWins >= 3,
      progress: `${Math.min(profile.rankingWins, 3)}/3 rankings`,
      tone: "border-fuchsia-300/25 bg-fuchsia-400/10 text-fuchsia-100",
    },
    {
      title: "Podio",
      description: "Fique entre os tres primeiros colocados.",
      icon: Medal,
      unlocked: profile.rankingPodiums >= 1,
      progress: profile.rankingPodiums >= 1 ? "Podio conquistado" : "Buscando o primeiro podio",
      tone: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100",
    },
    {
      title: "Sequencia quente",
      description: "Alcance uma sequencia de tres vitorias.",
      icon: Flame,
      unlocked: profile.melhorStreak >= 3,
      progress: `${Math.min(profile.melhorStreak, 3)}/3 na melhor sequencia`,
      tone: "border-orange-300/25 bg-orange-400/10 text-orange-100",
    },
    {
      title: "Veterano da arena",
      description: "Jogue dez partidas na arena.",
      icon: Swords,
      unlocked: profile.totalPartidas >= 10,
      progress: `${Math.min(profile.totalPartidas, 10)}/10 partidas`,
      tone: "border-violet-300/25 bg-violet-400/10 text-violet-100",
    },
    {
      title: "Perfil verificado",
      description: "Mantenha sua conta ativa e pronta para competir.",
      icon: ShieldCheck,
      unlocked: profile.totalPartidas >= 1,
      progress: profile.totalPartidas >= 1 ? "Ativo na arena" : "Jogue uma partida para liberar",
      tone: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
    },
  ];
}

export default function PublicProfilePage() {
  const params = useParams<{ uid: string }>();
  const uid = typeof params?.uid === "string" ? params.uid : "";
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    void fetchPublicProfile(uid)
      .then((nextProfile) => {
        if (cancelled) return;
        if (!nextProfile) {
          setError("Perfil nao encontrado.");
          return;
        }
        setProfile(nextProfile);
      })
      .catch(() => {
        if (!cancelled) setError("Nao foi possivel carregar este perfil agora.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  const trophies = useMemo(() => (profile ? buildTrophies(profile) : []), [profile]);
  const unlockedTrophies = trophies.filter((trophy) => trophy.unlocked).length;

  async function shareProfile() {
    if (!profile || typeof window === "undefined") return;
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: `Perfil de ${profile.nome} na Rivaliza`,
          text: `Confira o perfil de ${profile.nome} na Rivaliza.`,
          url,
        });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareMessage("Link copiado");
        window.setTimeout(() => setShareMessage(null), 2200);
        return;
      }
      setShareMessage("Copie o endereco desta pagina");
    } catch (shareError) {
      if ((shareError as { name?: string })?.name !== "AbortError") {
        setShareMessage("Nao foi possivel compartilhar agora");
      }
    }
  }

  if (loading) {
    return (
      <div className="game-panel px-4 py-16 text-center text-sm text-white/55">
        Carregando perfil...
      </div>
    );
  }

  if (!profile || error) {
    return (
      <div className="space-y-4 pb-6">
        <Link
          href={ROUTES.ranking}
          className="game-panel-soft inline-flex min-h-11 items-center gap-2 rounded-[1rem] px-3.5 text-sm font-semibold text-white/85 transition hover:border-cyan-300/30"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao ranking
        </Link>
        <div className="game-panel px-4 py-16 text-center text-sm text-rose-100/75">
          {error || "Perfil nao encontrado."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      <header className="game-panel overflow-hidden p-5 shadow-[0_0_56px_-26px_rgba(34,211,238,0.28)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={ROUTES.ranking}
            className="inline-flex min-h-9 items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-cyan-100/65 transition hover:text-cyan-100"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Ranking
          </Link>
          <button
            type="button"
            onClick={() => void shareProfile()}
            className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 text-xs font-bold text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-500/15"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            {shareMessage ?? "Compartilhar"}
          </button>
        </div>

        <div className="mt-5 flex items-start gap-4">
          <div
            aria-label={profile.nome}
            className="h-24 w-24 shrink-0 rounded-[28px] border border-cyan-200/20 bg-cover bg-center shadow-[0_0_38px_-14px_rgba(34,211,238,0.65)]"
            style={{
              backgroundImage: resolveAvatarBackgroundCssValue({
                photoUrl: profile.foto,
                name: profile.nome,
                username: profile.username,
                uid: profile.uid,
              }),
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="game-kicker text-cyan-100/65">Perfil publico</p>
            <h1 className="mt-1 truncate bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-2xl font-black tracking-tight text-transparent">
              {profile.nome}
            </h1>
            <p className="mt-1 truncate text-sm text-white/55">
              {profile.username ? `@${profile.username}` : "Jogador da Rivaliza"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="game-chip">nivel {profile.level}</span>
              <span className="game-chip border-amber-400/20 bg-amber-500/10 text-amber-100/85">
                {formatNumber(profile.xp)} XP
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PublicMetric label="Rankings ganhos" value={formatNumber(profile.rankingWins)} icon={Trophy} />
        <PublicMetric label="Podios" value={formatNumber(profile.rankingPodiums)} icon={Medal} />
        <PublicMetric
          label="Melhor posicao"
          value={profile.bestRankingPosition ? `#${profile.bestRankingPosition}` : "--"}
          icon={Crown}
        />
        <PublicMetric label="Vitorias" value={formatNumber(profile.totalVitorias)} icon={Sparkles} />
      </section>

      <section className="game-panel p-4 shadow-[0_0_48px_-24px_rgba(139,92,246,0.45)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="game-kicker text-cyan-100/60">Vitrine de conquistas</p>
            <h2 className="mt-1 text-xl font-black text-white">Trof&#233;us da arena</h2>
          </div>
          <span className="game-chip border-amber-400/20 bg-amber-500/10 text-amber-100/85">
            {unlockedTrophies}/{trophies.length} liberados
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trophies.map((trophy) => {
            const Icon = trophy.icon;
            return (
              <article
                key={trophy.title}
                className={`rounded-[1.15rem] border p-3.5 transition ${
                  trophy.unlocked
                    ? trophy.tone
                    : "border-white/8 bg-white/[0.025] text-white/45 grayscale"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/15">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.12em]">
                    {trophy.unlocked ? "Liberado" : "Bloqueado"}
                  </span>
                </div>
                <h3 className="mt-3 font-bold text-white">{trophy.title}</h3>
                <p className="mt-1 min-h-10 text-xs leading-5 text-white/55">{trophy.description}</p>
                <p className="mt-3 text-[11px] font-semibold text-white/60">{trophy.progress}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="game-panel-soft grid grid-cols-2 gap-3 rounded-[1.25rem] p-4 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">Partidas</p>
          <p className="mt-1 text-lg font-black text-white">{formatNumber(profile.totalPartidas)}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">Derrotas</p>
          <p className="mt-1 text-lg font-black text-white">{formatNumber(profile.totalDerrotas)}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">Melhor sequencia</p>
          <p className="mt-1 text-lg font-black text-white">{formatNumber(profile.melhorStreak)}</p>
        </div>
      </section>
    </div>
  );
}
