"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { subscribeWalletTransactions } from "@/services/carteira/walletService";
import { CurrencyConversionPanel } from "@/components/carteira/CurrencyConversionPanel";
import { StatCard } from "@/components/cards/StatCard";
import { WalletRow } from "@/components/cards/WalletRow";
import type { WalletTransaction, WalletTransactionType } from "@/types/wallet";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { resolveAvatarUrl } from "@/lib/users/avatar";
import {
  ArrowRight,
  ArrowRightLeft,
  Banknote,
  Coins,
  Flame,
  ListTree,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  Wallet,
} from "lucide-react";

const filtros = [
  "todos",
  "anuncio",
  "missao",
  "streak",
  "vitoria",
  "ranking",
  "referral",
  "conversao",
] as const;

type FiltroExtrato = (typeof filtros)[number];
type CarteiraTab = "resumo" | "troca" | "saque" | "extrato";

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

function labelFiltro(f: FiltroExtrato): string {
  const m: Record<FiltroExtrato, string> = {
    todos: "Tudo",
    anuncio: "Anúncio",
    missao: "Missão",
    streak: "Streak",
    vitoria: "Vitória",
    ranking: "Ranking",
    referral: "Convite",
    conversao: "Conversão",
  };
  return m[f];
}

export default function CarteiraPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [filtro, setFiltro] = useState<FiltroExtrato>("todos");
  const [aba, setAba] = useState<CarteiraTab>("resumo");

  useEffect(() => {
    if (!user) return;
    const tipo: WalletTransactionType | null = filtro === "todos" ? null : filtro;
    return subscribeWalletTransactions(user.uid, { pageSize: 50, tipo }, setRows);
  }, [user, filtro]);

  return (
    <div className="space-y-6 pb-4">
      <section className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.18),transparent_35%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-4 shadow-[0_0_56px_-26px_rgba(139,92,246,0.35)] sm:p-5">
        <div className="flex items-start gap-4">
          <div
            aria-label={profile?.nome || user?.displayName || "Carteira"}
            className="h-16 w-16 shrink-0 rounded-[22px] border border-white/10 bg-cover bg-center shadow-[0_0_32px_-16px_rgba(34,211,238,0.5)]"
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
              Economia premium
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">Carteira</h1>
            <p className="mt-1 text-sm text-white/55">
              Sua central de PR, TICKET, CASH, conversão, saque PIX e extrato.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <QuickBalancePill label="PR" value={profile ? String(profile.coins) : "—"} />
          <QuickBalancePill label="TICKET" value={profile ? String(profile.gems) : "—"} />
          <QuickBalancePill label="CASH" value={profile ? String(profile.rewardBalance) : "—"} />
        </div>
      </section>

      <div
        className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-gradient-to-b from-white/8 to-white/[0.03] p-1.5"
        role="tablist"
        aria-label="Seções da carteira"
      >
        {[
          { id: "resumo" as const, label: "Resumo", icon: Wallet },
          { id: "troca" as const, label: "Troca", icon: ArrowRightLeft },
          { id: "saque" as const, label: "Saque Pix", icon: Banknote },
          { id: "extrato" as const, label: "Extrato", icon: ListTree },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={cn(
              "flex min-h-[48px] min-w-[8.5rem] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition",
              aba === id
                ? "bg-gradient-to-r from-cyan-600/25 via-violet-600/30 to-fuchsia-600/25 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                : "text-white/55 hover:bg-white/5 hover:text-white/85",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {aba === "resumo" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <StatCard label="PR" value={profile ? String(profile.coins) : "—"} icon={Coins} />
            <StatCard label="TICKET" value={profile ? String(profile.gems) : "—"} icon={Ticket} />
            <StatCard
              className="col-span-2"
              label="CASH (pontos)"
              value={profile ? String(profile.rewardBalance) : "—"}
              icon={Banknote}
            />
          </div>

          <section className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-950/20 via-slate-950/90 to-slate-950 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/65">
                  Reservas especiais
                </p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-white sm:text-xl">
                  Inventário premium dos baús
                </h2>
                <p className="mt-1 text-sm text-white/50">
                  Estes ativos não entram no extrato financeiro tradicional. Eles ficam guardados
                  no perfil para futuras trocas, boosts e campanhas de super prêmio.
                </p>
              </div>
              <Sparkles className="h-5 w-5 text-amber-200/75" aria-hidden />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Fragmentos"
                value={profile ? String(profile.fragments ?? 0) : "—"}
                icon={Sparkles}
              />
              <StatCard
                label="Boost acumulado"
                value={profile ? `${profile.storedBoostMinutes ?? 0} min` : "—"}
                icon={Flame}
              />
              <StatCard
                label="Super prêmio"
                value={profile ? String(profile.superPrizeEntries ?? 0) : "—"}
                icon={Trophy}
              />
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
              {boostStatusLabel(profile?.activeBoostUntil)}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-950/30 via-slate-950/90 to-slate-950 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200/65">Saque Pix</p>
                  <h2 className="mt-1 text-lg font-black tracking-tight text-white sm:text-xl">
                    Resgate seus CASH via PIX
                  </h2>
                  <p className="mt-1 text-sm text-white/50">
                    Abra a área de saque para solicitar resgates e acompanhar seus pedidos.
                  </p>
                </div>
                <Sparkles className="h-5 w-5 text-violet-200/75" aria-hidden />
              </div>
              <Link
                href={ROUTES.recompensas}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/15"
              >
                Abrir Saque Pix
              </Link>
            </section>

            <section className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-950/25 via-slate-950/90 to-slate-950 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/65">Troca PR e Ticket</p>
                  <h2 className="mt-1 text-lg font-black tracking-tight text-white sm:text-xl">
                    Conversão instantânea
                  </h2>
                  <p className="mt-1 text-sm text-white/50">
                    Compre tickets com PR ou use seus tickets em troca quando a taxa estiver ativa.
                  </p>
                </div>
                <ArrowRightLeft className="h-5 w-5 text-cyan-200/75" aria-hidden />
              </div>
              <button
                type="button"
                onClick={() => setAba("troca")}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
              >
                Abrir Troca
              </button>
            </section>
          </div>
        </div>
      ) : null}

      {aba === "troca" ? (
        <CurrencyConversionPanel
          prBalance={profile?.coins ?? 0}
          ticketBalance={profile?.gems ?? 0}
          signedIn={!!user}
          onBalancesUpdated={refreshProfile}
        />
      ) : null}

      {aba === "saque" ? (
        <section className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-950/30 via-slate-950/90 to-slate-950 p-5 sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <div className="max-w-2xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200/65">Saque Pix</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">
                  Central de Saque Pix
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Solicite resgates, acompanhe a análise e consulte seus comprovantes em um fluxo separado da troca e
                  do extrato.
                </p>
              </div>
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-violet-200/75" aria-hidden />
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="text-sm font-semibold text-white">Acesso rápido ao saque</p>
                <p className="mt-1 text-sm text-white/50">
                  Entre na central para pedir um novo saque ou ver o status dos pedidos anteriores.
                </p>
              </div>
              <Link
                href={ROUTES.recompensas}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-5 text-sm font-semibold text-white shadow-[0_14px_30px_-16px_rgba(139,92,246,0.75)] transition hover:brightness-110"
              >
                Abrir central
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            <div className="grid gap-3 text-sm text-white/55 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">1</p>
                <p className="mt-1 font-semibold text-white">Solicite</p>
                <p className="mt-1">Informe o valor em CASH e sua chave PIX.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">2</p>
                <p className="mt-1 font-semibold text-white">Acompanhe</p>
                <p className="mt-1">Veja se o pedido está em análise, aprovado ou confirmado.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">3</p>
                <p className="mt-1 font-semibold text-white">Consulte</p>
                <p className="mt-1">Abra o comprovante quando o PIX for finalizado.</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {aba === "extrato" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListTree className="h-5 w-5 text-violet-300/80" aria-hidden />
              <div>
                <h2 className="text-lg font-bold text-white">Extrato</h2>
                <p className="text-xs text-white/45">Últimas movimentações da sua conta</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {filtros.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                  filtro === f
                    ? "border-cyan-400/40 bg-gradient-to-r from-cyan-600/25 to-violet-600/25 text-white shadow-[0_0_20px_-8px_rgba(34,211,238,0.35)]"
                    : "border-transparent bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80",
                )}
              >
                {labelFiltro(f)}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-1 sm:rounded-3xl sm:p-2">
            <div className="rounded-xl bg-black/20 px-3 py-2 sm:rounded-2xl sm:px-4 sm:py-3">
              {rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/45">Nenhuma movimentação neste filtro.</p>
              ) : (
                rows.map((tx) => <WalletRow key={tx.id} tx={tx} />)
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function QuickBalancePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
