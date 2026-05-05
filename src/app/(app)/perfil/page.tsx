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
import { ROUTES } from "@/lib/constants/routes";
import { BOOST_SYSTEM_DEFAULT_ENABLED, isBoostSystemEnabled } from "@/lib/features/boost";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";
import { resolveAvatarUrl } from "@/lib/users/avatar";
import { resetUserAvatar, uploadUserAvatar } from "@/services/users/avatarService";
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
import { Banknote, Coins, Crown, Flame, ShieldAlert, Sparkles, Ticket, Trophy, Wallet } from "lucide-react";

const PROFILE_SECTIONS = [
  { id: "conta", label: "Conta", hint: "Identidade e foto" },
  { id: "status", label: "Status", hint: "Progresso e ativos" },
  { id: "acessos", label: "Acessos", hint: "Atalhos e saída" },
] as const;

type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]["id"];

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
