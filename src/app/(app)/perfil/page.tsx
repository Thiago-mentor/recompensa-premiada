"use client";

import { useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/services/auth/authService";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants/routes";
import Link from "next/link";
import { resolveAvatarUrl } from "@/lib/users/avatar";
import { resetUserAvatar, uploadUserAvatar } from "@/services/users/avatarService";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { Banknote, Coins, Flame, ShieldAlert, Sparkles, Ticket, Trophy } from "lucide-react";

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
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function sair() {
    await logout();
    router.replace(ROUTES.login);
  }

  async function onSelectAvatar(file: File | null) {
    if (!file) return;
    setAvatarBusy(true);
    setAvatarPreviewUrl(null);
    setMsg(null);
    try {
      const photoURL = await uploadUserAvatar(file);
      setAvatarPreviewUrl(photoURL);
      await refreshProfile();
      setMsg("Foto atualizada com sucesso.");
    } catch (error) {
      setAvatarPreviewUrl(null);
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
      setMsg("Avatar voltou para o padrão.");
    } catch (error) {
      setAvatarPreviewUrl(null);
      setMsg(formatFirebaseError(error));
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <div className="space-y-6 pb-4">
      <section className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.18),transparent_35%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-5 shadow-[0_0_56px_-26px_rgba(34,211,238,0.28)]">
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
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/70">
              Conta premium
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
              {profile?.nome || user?.displayName || "Perfil"}
            </h1>
            <p className="mt-1 text-sm text-white/55">
              {profile?.username ? `@${profile.username}` : "complete seu perfil para fortalecer sua conta"}
            </p>
            <p className="mt-1 text-sm text-white/45">{profile?.email || user?.email}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white/70">
                nível {profile?.level ?? "—"}
              </span>
              <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-100/85">
                {profile?.xp ?? "—"} XP
              </span>
              <span className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-red-100/85">
                risco {profile?.riscoFraude ?? "—"}
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="secondary" disabled={avatarBusy} onClick={() => inputRef.current?.click()}>
          {avatarBusy ? "Enviando..." : "Trocar foto"}
        </Button>
        <Button variant="ghost" disabled={avatarBusy} onClick={() => void onResetAvatar()}>
          Usar avatar padrão
        </Button>
      </div>
      {msg ? <p className="text-center text-sm text-cyan-100">{msg}</p> : null}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ProfileMetric label="PR" value={profile ? String(profile.coins) : "—"} icon={<Coins className="h-4 w-4 text-cyan-200" />} />
        <ProfileMetric label="TICKET" value={profile ? String(profile.gems) : "—"} icon={<Ticket className="h-4 w-4 text-fuchsia-200" />} />
        <ProfileMetric label="CASH" value={profile ? String(profile.rewardBalance) : "—"} icon={<Banknote className="h-4 w-4 text-emerald-200" />} />
        <ProfileMetric label="Vitórias" value={profile ? String(profile.totalVitorias ?? 0) : "—"} icon={<Trophy className="h-4 w-4 text-amber-200" />} />
      </section>

      <section className="rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-slate-950/95 via-amber-950/10 to-slate-950 p-4 shadow-[0_0_42px_-18px_rgba(251,191,36,0.2)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/60">
              Inventário premium
            </p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-white">
              Recursos vindos dos baús
            </h2>
            <p className="mt-1 text-sm text-white/55">
              Fragmentos, boost armazenado e entradas de super prêmio ficam aqui para uso em
              eventos e sistemas futuros.
            </p>
          </div>
          <Sparkles className="mt-1 h-5 w-5 text-amber-200/75" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ProfileMetric
            label="Fragmentos"
            value={profile ? String(profile.fragments ?? 0) : "—"}
            icon={<Sparkles className="h-4 w-4 text-fuchsia-200" />}
          />
          <ProfileMetric
            label="Boost acumulado"
            value={profile ? `${profile.storedBoostMinutes ?? 0} min` : "—"}
            icon={<Flame className="h-4 w-4 text-orange-200" />}
          />
          <ProfileMetric
            label="Super prêmio"
            value={profile ? String(profile.superPrizeEntries ?? 0) : "—"}
            icon={<Trophy className="h-4 w-4 text-amber-200" />}
          />
        </div>
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/65">
          {boostStatusLabel(profile?.activeBoostUntil)}
        </div>
      </section>

      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Dados da conta</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <AccountRow label="Nome" value={profile?.nome || user?.displayName || "—"} />
          <AccountRow label="Username" value={profile?.username ? `@${profile.username}` : "—"} />
          <AccountRow label="E-mail" value={profile?.email || user?.email || "—"} />
          <AccountRow label="Nível / XP" value={`${profile?.level ?? "—"} · ${profile?.xp ?? "—"} XP`} />
          <AccountRow label="Streak atual" value={String(profile?.streakAtual ?? 0)} />
          <AccountRow label="Risco" value={String(profile?.riscoFraude ?? "—")} />
          <AccountRow label="Fragmentos" value={String(profile?.fragments ?? 0)} />
          <AccountRow
            label="Boost armazenado"
            value={`${profile?.storedBoostMinutes ?? 0} min`}
          />
          <AccountRow
            label="Entradas de super prêmio"
            value={String(profile?.superPrizeEntries ?? 0)}
          />
          <AccountRow label="Boost ativo" value={boostStatusLabel(profile?.activeBoostUntil)} />
        </div>
      </section>

      <Link
        href={ROUTES.convidar}
        className="flex items-center justify-between rounded-[1.4rem] border border-cyan-500/30 bg-cyan-950/30 px-4 py-4 text-cyan-100 transition hover:bg-cyan-950/40"
      >
        <div>
          <p className="text-sm font-semibold">Área de convites</p>
          <p className="mt-1 text-xs text-cyan-100/70">Compartilhe seu código e acompanhe resultados.</p>
        </div>
        <Sparkles className="h-5 w-5" />
      </Link>
      {isAdmin ? (
        <Link
          href={ROUTES.admin.dashboard}
          className="flex items-center justify-between rounded-[1.4rem] border border-violet-500/40 bg-violet-950/40 px-4 py-4 text-violet-200 transition hover:bg-violet-950/50"
        >
          <div>
            <p className="text-sm font-semibold">Painel admin</p>
            <p className="mt-1 text-xs text-violet-200/70">Gerencie economia, jogos e rankings.</p>
          </div>
          <ShieldAlert className="h-5 w-5" />
        </Link>
      ) : null}
      <Button variant="danger" className="w-full" onClick={sair}>
        Sair
      </Button>
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-1 text-sm text-white">{value}</p>
    </div>
  );
}
