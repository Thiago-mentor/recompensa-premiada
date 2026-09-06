"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { resolveUserRankingDailyScore } from "@/lib/users/ranking";
import { useClanDashboard } from "@/hooks/useClanDashboard";
import { logout } from "@/services/auth/authService";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { ClanAccessBadge } from "@/components/cla/ClanAccessBadge";
import { useRouter } from "next/navigation";
import { ROUTES, routePerfilPublico } from "@/lib/constants/routes";
import { BOOST_SYSTEM_DEFAULT_ENABLED, isBoostSystemEnabled } from "@/lib/features/boost";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";
import Image from "next/image";
import { resolveAvatarUrl } from "@/lib/users/avatar";
import { resetUserAvatar, uploadUserAvatar } from "@/services/users/avatarService";
import { DeleteAccountPanel } from "@/components/account/DeleteAccountPanel";
import { formatFirebaseError } from "@/lib/firebase/errors";
import {
  canUploadCustomAvatar,
  getAvatarUploadMissingRequirements,
  getAvatarUploadProgress,
  isAvatarUploadReputationEnabled,
  resolveAvatarUploadReputationThresholds,
} from "@/lib/users/avatarRequirements";
import { fetchEconomyConfigDocument } from "@/services/systemConfigs/economyDocumentCache";
import type { SystemEconomyConfig } from "@/types/systemConfig";
import { Banknote, Brain, Coins, Crown, Disc3, Flame, Hash, Layers3, Lock, Medal, PackageOpen, ShieldAlert, Sparkles, Swords, Ticket, Trophy, Wallet, Zap, type LucideIcon } from "lucide-react";
import type { RankingGameTrophy } from "@/types/user";

const PROFILE_SECTIONS = [
  { id: "conta", label: "Conta", hint: "Identidade e foto" },
  { id: "status", label: "Status", hint: "Progresso e ativos" },
  { id: "acessos", label: "Acessos", hint: "Atalhos e saída" },
] as const;

type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]["id"];

const PROFILE_RANKING_GAMES = [
  { id: "ppt", title: "PPT", subtitle: "Pedra, papel e tesoura", icon: Swords },
  { id: "quiz", title: "Quiz", subtitle: "Conhecimento rápido", icon: Brain },
  { id: "reaction_tap", title: "Reaction", subtitle: "Velocidade e precisão", icon: Zap },
  { id: "card_battle", title: "Cartas", subtitle: "Batalha estratégica", icon: Layers3 },
  { id: "roleta", title: "Roleta", subtitle: "Rodadas premiadas", icon: Disc3 },
  { id: "bau", title: "Baús", subtitle: "Coleção de recompensas", icon: PackageOpen },
  { id: "numero_secreto", title: "Número", subtitle: "Desafio secreto", icon: Hash },
] as const;

function boostStatusLabel(value: unknown): string {
  if (!value || typeof value !== "object") return "Inativo";
  if ("toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    try {
      const date = (value as { toDate: () => Date }).toDate();
      if (date.getTime() <= Date.now()) return "Inativo";
      return `Ativo até ${date.toLocaleString("pt-BR")}`;
    } catch {
      return "Inativo";
    }
  }
  return "Inativo";
}

export default function PerfilPage() {
  const { user, profile, isAdmin, refreshProfile } = useAuth();
  const { clanAccessBadge } = useClanDashboard();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");
  const [boostSystemEnabled, setBoostSystemEnabled] = useState(BOOST_SYSTEM_DEFAULT_ENABLED);
  const [avatarReputationEnabled, setAvatarReputationEnabled] = useState(false);
  const [avatarReputationThresholds, setAvatarReputationThresholds] = useState(() =>
    resolveAvatarUploadReputationThresholds(undefined),
  );
  const [activeSection, setActiveSection] = useState<ProfileSectionId>("conta");
  const avatarUploadUnlocked = canUploadCustomAvatar(
    profile,
    avatarReputationEnabled,
    avatarReputationThresholds,
  );
  const avatarMissingRequirements = getAvatarUploadMissingRequirements(
    profile,
    avatarReputationEnabled,
    avatarReputationThresholds,
  );
  const avatarUploadProgress = getAvatarUploadProgress(profile);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await fetchEconomyConfigDocument();
        if (cancelled) return;
        if (!raw) return;
        const data = raw as Partial<SystemEconomyConfig>;
        setBoostSystemEnabled(isBoostSystemEnabled(data));
        setAvatarReputationEnabled(isAvatarUploadReputationEnabled(data));
        setAvatarReputationThresholds(resolveAvatarUploadReputationThresholds(data));
      } catch {
        if (!cancelled) setBoostSystemEnabled(BOOST_SYSTEM_DEFAULT_ENABLED);
        if (!cancelled) {
          setAvatarReputationEnabled(false);
          setAvatarReputationThresholds(resolveAvatarUploadReputationThresholds(undefined));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function sair() {
    await logout();
    router.replace(ROUTES.login);
  }

  async function onSelectAvatar(file: File | null) {
    if (!file) return;
    if (!avatarUploadUnlocked) {
      setMsgTone("error");
      setMsg(`Upload de avatar bloqueado. Ainda falta: ${avatarMissingRequirements.join(", ")}.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setAvatarBusy(true);
    setAvatarPreviewUrl(null);
    setMsg(null);
    try {
      const photoURL = await uploadUserAvatar(file);
      setAvatarPreviewUrl(photoURL);
      await refreshProfile();
      setMsgTone("success");
      setMsg("Foto atualizada com sucesso.");
    } catch (error) {
      setAvatarPreviewUrl(null);
      setMsgTone("error");
      setMsg(formatFirebaseError(error));
    } finally {
      setAvatarBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onResetAvatar() {
    setAvatarBusy(true);
    setAvatarPreviewUrl(null);
    setMsg(null);
    try {
      const photoURL = await resetUserAvatar();
      setAvatarPreviewUrl(photoURL);
      await refreshProfile();
      setMsgTone("success");
      setMsg("Avatar voltou para o padrão.");
    } catch (error) {
      setAvatarPreviewUrl(null);
      setMsgTone("error");
      setMsg(formatFirebaseError(error));
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <div className="space-y-5 pb-6">
      <section className="game-panel overflow-hidden p-5 shadow-[0_0_56px_-26px_rgba(34,211,238,0.28)]">
        <div className="flex items-start gap-4">
          <div
            aria-label={profile?.nome || user?.displayName || "Perfil"}
            className="h-24 w-24 shrink-0 rounded-[28px] border border-white/10 bg-cover bg-center shadow-[0_0_35px_-18px_rgba(34,211,238,0.45)]"
            style={{
              backgroundImage: `url("${resolveAvatarUrl({
                photoUrl:
                  (avatarBusy ? avatarPreviewUrl : null) ?? profile?.foto ?? user?.photoURL,
                name: profile?.nome ?? user?.displayName,
                username: profile?.username,
                uid: profile?.uid ?? user?.uid,
              })}")`,
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="game-kicker">
              Perfil tático
            </p>
            <h1 className="mt-1 bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-2xl font-black tracking-tight text-transparent">
              {profile?.nome || user?.displayName || "Perfil"}
            </h1>
            <p className="mt-1 text-sm text-white/58">
              {profile?.username ? `@${profile.username}` : "defina seu @ e fortaleça sua presença na arena"}
            </p>
            <p className="mt-1 text-sm text-white/48">{profile?.email || user?.email}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="game-chip">
                nível {profile?.level ?? "—"}
              </span>
              <span className="game-chip border-amber-400/20 bg-amber-500/10 text-amber-100/85">
                {profile?.xp ?? "—"} XP
              </span>
            </div>
          </div>
        </div>
      </section>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onSelectAvatar(e.target.files?.[0] ?? null)}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ProfileMetric label="PR" value={profile ? String(profile.coins) : "—"} icon={<Coins className="h-4 w-4 text-cyan-200" />} />
        <ProfileMetric label="TICKET" value={profile ? String(profile.gems) : "—"} icon={<Ticket className="h-4 w-4 text-fuchsia-200" />} />
        <ProfileMetric label="Saldo" value={profile ? String(profile.rewardBalance) : "—"} icon={<Banknote className="h-4 w-4 text-emerald-200" />} />
        <ProfileMetric label="Vitórias" value={profile ? String(profile.totalVitorias ?? 0) : "—"} icon={<Trophy className="h-4 w-4 text-amber-200" />} />
      </section>

      <Link
        href={ROUTES.carteira}
        className="game-panel-soft flex items-center justify-between gap-3 rounded-[1.35rem] border-emerald-400/18 px-4 py-3 text-sm font-semibold text-white/90 transition hover:border-emerald-400/30"
      >
        <span className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-emerald-200" aria-hidden />
          Abrir carteira
        </span>
        <span className="text-xs font-medium text-white/45">extrato e saldos</span>
      </Link>

      {profile?.uid || user?.uid ? (
        <Link
          href={routePerfilPublico(profile?.uid ?? user?.uid ?? "")}
          className="game-panel-soft flex items-center justify-between gap-3 rounded-[1.35rem] border-amber-400/18 px-4 py-3 text-sm font-semibold text-white/90 transition hover:border-amber-400/35"
        >
          <span className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-200" aria-hidden />
            Ver meu perfil publico
          </span>
          <span className="text-xs font-medium text-white/45">trofeus e conquistas</span>
        </Link>
      ) : null}

      <section className="space-y-4">
        <div className="game-panel p-2">
          <div className="grid grid-cols-3 gap-2">
            {PROFILE_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "rounded-[1rem] border px-3 py-3 text-left transition",
                  activeSection === section.id
                      ? "border-cyan-400/30 bg-cyan-500/10 text-white shadow-[0_0_24px_-12px_rgba(34,211,238,0.45)]"
                      : "border-white/10 bg-black/20 text-white/65 hover:bg-white/[0.04] hover:text-white/85",
                )}
              >
                <p className="text-xs font-semibold">{section.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed opacity-80">{section.hint}</p>
              </button>
            ))}
          </div>
        </div>

        {msg ? (
          <AlertBanner tone={msgTone} className="text-sm">
            {msg}
          </AlertBanner>
        ) : null}

        {activeSection === "conta" ? (
          <ProfileSectionCard
            eyebrow="Conta"
            title="Identidade e preferências"
            description="Dados centrais da conta e controles rápidos do avatar."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="secondary"
                disabled={avatarBusy || !avatarUploadUnlocked}
                onClick={() => inputRef.current?.click()}
              >
                {avatarBusy ? "Enviando..." : "Trocar foto"}
              </Button>
              <Button
                variant="ghost"
                disabled={avatarBusy}
                onClick={() => void onResetAvatar()}
              >
                Usar avatar padrão
              </Button>
            </div>
            {!avatarUploadUnlocked ? (
              <div className="game-panel-soft rounded-xl border-amber-400/20 bg-amber-500/10 px-3 py-3 text-sm text-amber-100/90">
                <p className="font-semibold text-white">Upload de foto bloqueado por reputação.</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/75">
                  Requisito: {avatarReputationThresholds.ads} anúncios,{" "}
                  {avatarReputationThresholds.pptMatches} PPT,{" "}
                  {avatarReputationThresholds.quizMatches} QUIZ e{" "}
                  {avatarReputationThresholds.reactionMatches} REACTION.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-amber-100/70">
                  Seu progresso: {avatarUploadProgress.ads} anúncios · {avatarUploadProgress.pptMatches} PPT ·{" "}
                  {avatarUploadProgress.quizMatches} QUIZ · {avatarUploadProgress.reactionMatches} REACTION.
                </p>
              </div>
            ) : (
              <div className="game-panel-soft rounded-xl border-emerald-400/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100/85">
                Upload liberado. Sua foto ainda será validada automaticamente pelo Google Cloud Vision.
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <AccountRow label="Nome" value={profile?.nome || user?.displayName || "—"} />
              <AccountRow label="Username" value={profile?.username ? `@${profile.username}` : "—"} />
              <AccountRow label="E-mail" value={profile?.email || user?.email || "—"} />
              <AccountRow label="Código de convite" value={profile?.codigoConvite || "—"} />
              <AccountRow label="Risco da conta" value={String(profile?.riscoFraude ?? "—")} />
              <AccountRow label="Streak atual / melhor" value={`${profile?.streakAtual ?? 0} / ${profile?.melhorStreak ?? 0}`} />
            </div>
          </ProfileSectionCard>
        ) : null}

        {activeSection === "status" ? (
          <>
            <ProfileSectionCard
              eyebrow="Status"
              title="Progresso e atividade"
              description="Seu painel de progresso e atividade em leitura rápida."
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <AccountRow label="Nível / XP" value={`${profile?.level ?? "—"} · ${profile?.xp ?? "—"} XP`} />
                <AccountRow label="Ranking diário" value={String(resolveUserRankingDailyScore(profile))} />
                <AccountRow label="Partidas / vitórias" value={`${profile?.totalPartidas ?? 0} / ${profile?.totalVitorias ?? 0}`} />
                <AccountRow label="Derrotas" value={String(profile?.totalDerrotas ?? 0)} />
                <AccountRow label="Anúncios assistidos" value={String(profile?.totalAdsAssistidos ?? 0)} />
                <AccountRow
                  label="Missões resgatadas"
                  value={String(profile?.totalMissionRewardsClaimed ?? 0)}
                />
              </div>
            </ProfileSectionCard>

            <ProfileSectionCard
              eyebrow="Conquistas"
              title="Troféus e ganhos de ranking"
              description="Conquistas calculadas pelo servidor e sua evolução nos placares oficiais."
              tone="highlight"
            >
              <div className="relative overflow-hidden rounded-[1.5rem] border border-amber-300/20 bg-[radial-gradient(circle_at_75%_35%,rgba(251,191,36,0.2),transparent_30%),linear-gradient(135deg,rgba(76,29,149,0.75),rgba(15,23,42,0.94))] px-4 py-5 sm:min-h-52 sm:pr-[44%]">
                <div className="relative z-10 max-w-sm">
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
                    <Crown className="h-3.5 w-3.5" /> Hall da fama
                  </span>
                  <h3 className="mt-3 text-2xl font-black tracking-tight text-white">Sua coleção de campeonatos</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">Cada modalidade guarda seu melhor resultado e todas as premiações oficiais recebidas.</p>
                </div>
                <Image src="/assets/profile/ranking-podium-premium.png" alt="Pódio premium com troféus de ouro, prata e bronze" width={560} height={560} className="mx-auto mt-4 h-48 w-48 object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.45)] sm:absolute sm:-bottom-8 sm:right-1 sm:mt-0 sm:h-64 sm:w-64" priority={false} />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <ProfileMetric label="Rankings ganhos" value={String(profile?.rankingWins ?? 0)} icon={<Trophy className="h-4 w-4 text-amber-200" />} />
                <ProfileMetric label="Pódios" value={String(profile?.rankingPodiums ?? 0)} icon={<Medal className="h-4 w-4 text-fuchsia-200" />} />
                <ProfileMetric label="Melhor posição" value={profile?.bestRankingPosition ? `#${profile.bestRankingPosition}` : "—"} icon={<Crown className="h-4 w-4 text-cyan-200" />} />
                <ProfileMetric label="Pontuação atual" value={String(resolveUserRankingDailyScore(profile))} icon={<Sparkles className="h-4 w-4 text-emerald-200" />} />
              </div>
              <div>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div><p className="game-kicker">Por modalidade</p><h3 className="mt-1 text-lg font-black text-white">Galeria de troféus</h3></div>
                  <span className="text-xs font-semibold text-white/45">{Object.values(profile?.rankingTrophies ?? {}).filter((item) => (item?.wins ?? 0) > 0).length}/{PROFILE_RANKING_GAMES.length} liberados</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {PROFILE_RANKING_GAMES.map((game) => (
                    <GameTrophyCard key={game.id} game={game} trophy={profile?.rankingTrophies?.[game.id]} />
                  ))}
                </div>
              </div>
            </ProfileSectionCard>

            <ProfileSectionCard
              eyebrow="Inventário premium"
              title="Recursos guardados no perfil"
              description={
                boostSystemEnabled
                  ? "Fragmentos, boost e entradas especiais em um só painel."
                  : "Entradas especiais e reservas do perfil."
              }
              tone="highlight"
            >
              <div
                className={`grid gap-3 ${boostSystemEnabled ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}
              >
                {boostSystemEnabled ? (
                  <ProfileMetric
                    label="Fragmentos"
                    value={profile ? String(profile.fragments ?? 0) : "—"}
                    icon={<Sparkles className="h-4 w-4 text-fuchsia-200" />}
                  />
                ) : null}
                {boostSystemEnabled ? (
                  <ProfileMetric
                    label="Boost acumulado"
                    value={profile ? `${profile.storedBoostMinutes ?? 0} min` : "—"}
                    icon={<Flame className="h-4 w-4 text-orange-200" />}
                  />
                ) : null}
                <ProfileMetric
                  label="Entradas especiais"
                  value={profile ? String(profile.superPrizeEntries ?? 0) : "—"}
                  icon={<Trophy className="h-4 w-4 text-amber-200" />}
                />
              </div>
              <div className="game-panel-soft rounded-xl px-3 py-3 text-sm text-white/65">
                {boostSystemEnabled ? (
                  <p>
                    <strong className="text-white">Fragmentos</strong> servem para fabricar boost na
                    loja. <strong className="text-white">Entradas especiais</strong> sao creditos raros
                    guardados para campanhas ou jackpots especiais quando esse modo estiver ativo.
                  </p>
                ) : (
                  <p>
                    <strong className="text-white">Fragmentos</strong> ficaram ocultos porque o sistema de
                    boost esta desligado. <strong className="text-white">Entradas especiais</strong> sao
                    creditos raros guardados para campanhas ou jackpots especiais quando esse modo
                    estiver ativo.
                  </p>
                )}
              </div>
              {boostSystemEnabled ? (
                <div className="game-panel-soft rounded-xl px-3 py-3 text-sm text-white/65">
                  {boostStatusLabel(profile?.activeBoostUntil)}
                </div>
              ) : null}
            </ProfileSectionCard>
          </>
        ) : null}

        {activeSection === "acessos" ? (
          <ProfileSectionCard
            eyebrow="Acessos"
            title="Atalhos importantes"
            description="Rotas rápidas para as áreas mais usadas a partir do perfil."
          >
            <div className="grid gap-3">
              <Link
                href={ROUTES.cla}
                className="game-panel-soft flex items-center justify-between rounded-[1.4rem] border-fuchsia-500/24 px-4 py-4 text-fuchsia-100 transition hover:border-fuchsia-400/35"
              >
                <div>
                  <p className="text-sm font-semibold">Clã</p>
                  <p className="mt-1 text-xs text-fuchsia-100/70">Time, chat e gestão do esquadrão.</p>
                </div>
                <div className="flex items-center gap-2">
                  {clanAccessBadge ? (
                    <ClanAccessBadge
                      label={clanAccessBadge.label}
                      tone={clanAccessBadge.tone}
                    />
                  ) : null}
                  <Crown className="h-5 w-5" />
                </div>
              </Link>
              <Link
                href={ROUTES.carteira}
                className="game-panel-soft flex items-center justify-between rounded-[1.4rem] border-emerald-500/24 px-4 py-4 text-emerald-100 transition hover:border-emerald-400/35"
              >
                <div>
                  <p className="text-sm font-semibold">Carteira</p>
                  <p className="mt-1 text-xs text-emerald-100/70">Saldos, extrato e conversão.</p>
                </div>
                <Wallet className="h-5 w-5" />
              </Link>
              {isAdmin ? (
                <Link
                  href={ROUTES.admin.dashboard}
                  className="game-panel-soft flex items-center justify-between rounded-[1.4rem] border-violet-500/24 px-4 py-4 text-violet-200 transition hover:border-violet-400/35"
                >
                  <div>
                    <p className="text-sm font-semibold">Painel admin</p>
                    <p className="mt-1 text-xs text-violet-200/70">
                      Controle economia, jogos e placares.
                    </p>
                  </div>
                  <ShieldAlert className="h-5 w-5" />
                </Link>
              ) : null}
              <Button variant="danger" className="w-full" onClick={sair}>
                Sair
              </Button>
              <div className="mt-2 border-t border-white/10 pt-5">
                <DeleteAccountPanel compact />
              </div>
            </div>
          </ProfileSectionCard>
        ) : null}
      </section>
    </div>
  );
}

function ProfileMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="game-panel-soft rounded-2xl px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/58">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function GameTrophyCard({
  game,
  trophy,
}: {
  game: { id: string; title: string; subtitle: string; icon: LucideIcon };
  trophy?: RankingGameTrophy;
}) {
  const Icon = game.icon;
  const unlocked = (trophy?.wins ?? 0) > 0;
  const best = trophy?.bestPosition ?? null;
  const medalTone = best === 1
    ? "from-amber-200 via-yellow-400 to-amber-600 text-amber-950"
    : best === 2
      ? "from-slate-100 via-slate-300 to-slate-500 text-slate-900"
      : best === 3
        ? "from-orange-200 via-orange-500 to-amber-800 text-orange-950"
        : "from-violet-300 via-fuchsia-500 to-violet-800 text-white";
  const rewards = trophy?.totalRewards;

  return (
    <article className={cn("relative overflow-hidden rounded-[1.35rem] border p-4 transition", unlocked ? "border-amber-300/20 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.14),transparent_38%),rgba(0,0,0,0.24)] shadow-[0_18px_36px_-28px_rgba(251,191,36,0.5)]" : "border-white/10 bg-black/20 opacity-70")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05]"><Icon className="h-5 w-5 text-cyan-100/80" /></span>
          <div className="min-w-0"><h4 className="truncate text-sm font-black text-white">{game.title}</h4><p className="mt-0.5 truncate text-[11px] text-white/45">{game.subtitle}</p></div>
        </div>
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br shadow-lg", unlocked ? medalTone : "from-slate-700 to-slate-900 text-white/40")}>
          {unlocked ? <Trophy className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
        </span>
      </div>
      {unlocked ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <MiniTrophyStat label="Melhor" value={best ? `#${best}` : "—"} />
            <MiniTrophyStat label="Ganhos" value={String(trophy?.wins ?? 0)} />
            <MiniTrophyStat label="Pódios" value={String(trophy?.podiums ?? 0)} />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/55">{Math.max(0, rewards?.coins ?? 0).toLocaleString("pt-BR")} PR · {Math.max(0, rewards?.gems ?? 0).toLocaleString("pt-BR")} TICKET · {Math.max(0, rewards?.rewardBalance ?? 0).toLocaleString("pt-BR")} saldo</p>
        </>
      ) : <p className="mt-4 text-xs text-white/45">Conquiste uma premiação neste ranking para liberar.</p>}
    </article>
  );
}

function MiniTrophyStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/8 bg-black/20 px-2 py-2"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/35">{label}</p><p className="mt-1 text-xs font-black text-white">{value}</p></div>;
}

function ProfileSectionCard({
  eyebrow,
  title,
  description,
  tone = "default",
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  tone?: "default" | "highlight";
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "space-y-4 rounded-[1.6rem] border p-4",
        tone === "highlight"
          ? "game-panel border-amber-400/18 shadow-[0_0_42px_-18px_rgba(251,191,36,0.2)]"
          : "game-panel",
      )}
    >
      <div>
        <p className="game-kicker">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-black tracking-tight text-white">{title}</h2>
        <p className="mt-1 text-sm text-white/58">{description}</p>
      </div>
      {children}
    </section>
  );
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="game-panel-soft rounded-xl px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/58">{label}</p>
      <p className="mt-1 text-sm text-white">{value}</p>
    </div>
  );
}
