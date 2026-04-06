"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { cn } from "@/lib/utils/cn";
import { useReferralDashboard } from "@/hooks/useReferralDashboard";
import type { ReferralRankingPeriod, ReferralStatus } from "@/types/referral";
import {
  Copy,
  Gift,
  Medal,
  Share2,
  Sparkles,
  Trophy,
  UserPlus2,
  Users,
} from "lucide-react";

type TabId = "convite" | "convidados" | "ranking";

function statusLabel(status: ReferralStatus): string {
  switch (status) {
    case "pending":
      return "Pendente";
    case "valid":
      return "Válida";
    case "rewarded":
      return "Recompensada";
    case "blocked":
      return "Bloqueada";
    case "invalid":
      return "Inválida";
    default:
      return status;
  }
}

export default function ConvidarPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<TabId>("convite");
  const [period, setPeriod] = useState<ReferralRankingPeriod>("daily");
  const [copied, setCopied] = useState<string | null>(null);
  const { config, campaign, invitedRows, myReferral, ranking, myRanking } = useReferralDashboard(period);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inviteCode = profile?.codigoConvite ?? "—";
  const inviteLink = profile ? `${origin}/cadastro?convite=${profile.codigoConvite}` : "";
  const invitedCount = profile?.referralInvitedCount ?? invitedRows.length;
  const validCount = profile?.referralQualifiedCount ?? 0;
  const totalEarned = profile?.referralTotalEarnedCoins ?? 0;
  const pendingCount = profile?.referralPendingCount ?? invitedRows.filter((row) => row.status === "pending").length;

  const rankingPosition = useMemo(() => {
    if (!myRanking) return null;
    const index = ranking.findIndex((entry) => entry.userId === myRanking.userId);
    return index >= 0 ? index + 1 : null;
  }, [ranking, myRanking]);

  async function copyValue(value: string, kind: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  }

  async function shareInvite() {
    if (!inviteLink) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Entre no Recompensa Premiada",
          text: `Use meu código ${inviteCode} e entre no app.`,
          url: inviteLink,
        });
        return;
      } catch {
        /* ignore */
      }
    }
    await copyValue(inviteLink, "share");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Convide e Ganhe</h1>
        <p className="mt-1 text-sm text-white/55">
          Compartilhe seu código, acompanhe convidados e suba no ranking de indicações.
        </p>
      </div>

      {copied ? <AlertBanner tone="success">Copiado com sucesso.</AlertBanner> : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Convidados</p>
          <p className="mt-1 text-2xl font-black text-white">{invitedCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/70">Válidas</p>
          <p className="mt-1 text-2xl font-black text-white">{validCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/70">Pendentes</p>
          <p className="mt-1 text-2xl font-black text-white">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/70">Ganhos</p>
          <p className="mt-1 text-2xl font-black text-white">{totalEarned} PR</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5">
        {[
          { id: "convite" as const, label: "Meu convite", icon: Gift },
          { id: "convidados" as const, label: "Meus convidados", icon: Users },
          { id: "ranking" as const, label: "Ranking", icon: Trophy },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition",
              tab === id
                ? "bg-gradient-to-r from-cyan-600/25 via-violet-600/30 to-fuchsia-600/25 text-white"
                : "text-white/55 hover:bg-white/5 hover:text-white/80",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "convite" ? (
        <section className="space-y-4">
          <div className="rounded-[1.7rem] border border-violet-400/20 bg-gradient-to-br from-violet-950/30 via-slate-950/95 to-slate-950 p-5 shadow-[0_0_40px_-16px_rgba(139,92,246,0.35)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200/70">Seu código</p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div>
                <p className="text-2xl font-black tracking-[0.12em] text-white">{inviteCode}</p>
                <p className="mt-1 text-xs text-white/45">Compartilhe este código ou o link abaixo.</p>
              </div>
              <Button variant="secondary" onClick={() => void copyValue(inviteCode, "code")} disabled={!profile}>
                <Copy className="h-4 w-4" />
                Copiar
              </Button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Button onClick={() => void copyValue(inviteLink, "link")} disabled={!profile}>
                <Copy className="h-4 w-4" />
                Copiar link
              </Button>
              <Button variant="secondary" onClick={() => void shareInvite()} disabled={!profile}>
                <Share2 className="h-4 w-4" />
                Compartilhar convite
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-1 h-5 w-5 text-amber-300" />
              <div className="space-y-1">
                <p className="font-semibold text-white">{campaign?.name ?? "Campanha padrão de indicação"}</p>
                <p className="text-sm text-white/60">
                  {campaign?.description ??
                    config?.campaignText ??
                    "Ganhe recompensas quando seus convidados cumprirem as regras da campanha ativa."}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
            <p className="text-sm font-semibold text-white">Seu vínculo atual</p>
            <p className="mt-2 text-sm text-white/60">
              {myReferral
                ? `Você entrou com um convite e seu status está em ${statusLabel(myReferral.status)}.`
                : "Você não entrou com código de convite ou ainda não há vínculo registrado para sua conta."}
            </p>
          </div>
        </section>
      ) : null}

      {tab === "convidados" ? (
        <section className="space-y-3">
          {invitedRows.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-10 text-center">
              <UserPlus2 className="mx-auto h-8 w-8 text-white/35" />
              <p className="mt-3 text-sm text-white/55">Nenhum convidado ainda. Compartilhe seu código para começar.</p>
            </div>
          ) : (
            invitedRows.map((row) => (
              <article key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{row.invitedUserName || row.invitedUserEmail || row.invitedUserId}</p>
                    <p className="mt-1 text-xs text-white/45">Código usado: {row.invitedByCode}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold text-white/75">
                    {statusLabel(row.status)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/55">
                  <span>Indicador: {row.inviterName || "—"}</span>
                  <span>Recompensa: {row.inviterRewardCoins} PR</span>
                  <span>Convidado: {row.invitedRewardCoins} PR</span>
                </div>
              </article>
            ))
          )}
        </section>
      ) : null}

      {tab === "ranking" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([
              { id: "daily", label: "Diário" },
              { id: "weekly", label: "Semanal" },
              { id: "monthly", label: "Mensal" },
              { id: "all", label: "Geral" },
            ] as const).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                  period === item.id
                    ? "border-cyan-400/40 bg-cyan-500/15 text-white"
                    : "border-transparent bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {myRanking ? (
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/70">Sua posição</p>
              <p className="mt-1 text-xl font-black text-white">
                {rankingPosition ? `#${rankingPosition}` : "Em crescimento"}
              </p>
              <p className="mt-1 text-sm text-white/60">
                {myRanking.validReferrals} indicações válidas · {myRanking.totalRewards} PR acumulados
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            {ranking.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-10 text-center text-sm text-white/55">
                Ainda sem ranking para este período.
              </div>
            ) : (
              ranking.map((entry, index) => (
                <div
                  key={entry.userId}
                  className={cn(
                    "rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3",
                    index < 3 && "bg-gradient-to-r from-amber-500/10 to-transparent",
                    entry.userId === profile?.uid && "ring-1 ring-cyan-400/50",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{entry.userName}</p>
                      <p className="text-xs text-white/50">
                        {entry.validReferrals} válidas · {entry.totalRewards} PR
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-200">
                      {index < 3 ? <Medal className="h-4 w-4" /> : null}
                      #{index + 1}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
