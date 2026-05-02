"use client";

import Link from "next/link";
import { ArrowRight, Clock3, Gift, LockKeyhole, PackageOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useChestHub } from "@/hooks/useChestHub";
import { ROUTES } from "@/lib/constants/routes";
import {
  CHEST_SOURCE_LABEL,
  formatChestDurationMs,
  formatChestRewardSummary,
} from "@/utils/chest";

const chestHubHref = `${ROUTES.recursos}/bau`;

export function HomeChestSummaryCard() {
  const { loading, summary, slotItems, queueItems, activeUnlockChest, rarityLabel } = useChestHub();

  const readyChest = slotItems.find((item) => item?.canClaim) ?? null;
  const lockedChest = slotItems.find((item) => item?.canStartUnlock) ?? null;
  const queuedChest = queueItems[0] ?? null;
  const totalSlots = slotItems.length;
  const totalChests = summary.occupiedSlots + summary.queuedCount;

  const spotlight = (() => {
    if (loading) {
      return {
        tone:
          "border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-slate-950",
        label: "Sincronizando",
        title: "Lendo o estado do seu hub de baús",
        description: "Assim que os dados chegarem, este resumo mostra o próximo ganho disponível.",
        icon: Clock3,
      };
    }
    if (readyChest) {
      return {
        tone:
          "border-emerald-400/25 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_34%),linear-gradient(135deg,rgba(6,78,59,0.55),rgba(2,6,23,0.96)_55%,rgba(8,47,73,0.72))]",
        label: "Pronto para coletar",
        title: `${summary.readyCount} baú${summary.readyCount > 1 ? "s" : ""} aguardando abertura`,
        description: `${rarityLabel[readyChest.rarity]} · ${formatChestRewardSummary(readyChest.rewardsSnapshot)}`,
        subline: "Abra o hub para coletar agora e liberar espaço para novos envios.",
        icon: PackageOpen,
      };
    }
    if (activeUnlockChest) {
      return {
        tone:
          "border-cyan-400/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,rgba(8,47,73,0.5),rgba(2,6,23,0.96)_58%,rgba(76,29,149,0.55))]",
        label: "Em liberação",
        title: `Baú ${rarityLabel[activeUnlockChest.rarity]} em contagem regressiva`,
        description:
          activeUnlockChest.speedupCooldownRemainingMs > 0
            ? `Faltam ${formatChestDurationMs(activeUnlockChest.remainingMs)} para coletar. Novo anúncio para acelerar em ${formatChestDurationMs(activeUnlockChest.speedupCooldownRemainingMs)}.`
            : `Faltam ${formatChestDurationMs(activeUnlockChest.remainingMs)} para coletar esse slot.`,
        subline: `Origem: ${CHEST_SOURCE_LABEL[activeUnlockChest.source]}.`,
        icon: Clock3,
      };
    }
    if (lockedChest) {
      return {
        tone:
          "border-amber-400/20 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_34%),linear-gradient(135deg,rgba(120,53,15,0.5),rgba(2,6,23,0.96)_58%,rgba(76,29,149,0.52))]",
        label: "Aguardando início",
        title: `Baú ${rarityLabel[lockedChest.rarity]} parado no slot ${Number(lockedChest.slotIndex ?? 0) + 1}`,
        description: formatChestRewardSummary(lockedChest.rewardsSnapshot),
        subline: "Entre no hub para iniciar a abertura e colocar esse timer para rodar.",
        icon: LockKeyhole,
      };
    }
    if (queuedChest) {
      return {
        tone:
          "border-violet-400/20 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.15),transparent_34%),linear-gradient(135deg,rgba(88,28,135,0.45),rgba(2,6,23,0.96)_58%,rgba(8,47,73,0.5))]",
        label: "Fila montada",
        title: `Baú ${rarityLabel[queuedChest.rarity]} aguardando vaga`,
        description: `Posição ${Number(queuedChest.queuePosition ?? 0) + 1} da fila · ${CHEST_SOURCE_LABEL[queuedChest.source]}.`,
        subline: "Assim que um slot for liberado, ele sobe automaticamente para a área principal.",
        icon: Gift,
      };
    }
    return {
      tone:
        "border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-slate-950",
      label: "Hub vazio",
      title: "Seu estoque de baús ainda está zerado",
      description: "Vitórias 1v1, marcos de streak e resgates de missão podem alimentar esse painel.",
      subline: "Quando o primeiro baú chegar, o resumo aparece aqui automaticamente.",
      icon: Sparkles,
    };
  })();

  const SpotlightIcon = spotlight.icon;

  return (
    <section className="casino-panel p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="casino-kicker text-amber-200/85">Baús</p>
          <h2 className="text-lg font-black tracking-tight text-white">Hub de recompensas</h2>
          <p className="text-xs text-white/50">
            Resumo rápido do que já chegou e do que está no pipeline.
          </p>
        </div>
        <Link href={chestHubHref} className="text-sm font-semibold text-amber-300 hover:underline">
          Abrir hub
        </Link>
      </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <div
          className={cn(
            "rounded-[1.3rem] border p-5 shadow-[0_0_40px_-16px_rgba(34,211,238,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]",
            spotlight.tone,
          )}
        >
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-black/25 text-white shadow-[0_0_20px_-8px_rgba(255,255,255,0.2)]">
              <SpotlightIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/55">
                {spotlight.label}
              </p>
              <p className="mt-1 text-lg font-black tracking-tight text-white">{spotlight.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{spotlight.description}</p>
              {"subline" in spotlight && spotlight.subline ? (
                <p className="mt-2 text-xs leading-relaxed text-white/55">{spotlight.subline}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={chestHubHref}
              className="inline-flex min-h-[44px] items-center justify-center rounded-[1.125rem] border border-fuchsia-400/40 bg-[linear-gradient(135deg,rgba(91,33,182,0.65),rgba(217,70,239,0.55))] px-4 py-2.5 text-sm font-black text-white shadow-[0_0_28px_-10px_rgba(236,72,153,0.4)] transition hover:brightness-110"
            >
              Gerenciar baús
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            {totalChests === 0 ? (
              <span className="inline-flex min-h-[44px] items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/60">
                Missões, streak e 1v1 abastecem este espaço
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <MetricCard
            label="Prontos"
            value={loading ? "..." : String(summary.readyCount)}
            hint={summary.readyCount > 0 ? "Abra e colete" : "Nada liberado"}
          />
          <MetricCard
            label="Slots"
            value={loading ? "..." : `${summary.occupiedSlots}/${totalSlots}`}
            hint={totalSlots > 0 ? "Ocupação atual" : "Sem slots"}
          />
          <MetricCard
            label="Fila"
            value={loading ? "..." : String(summary.queuedCount)}
            hint={summary.backlogFull ? "Cheia" : "Em espera"}
            tone={summary.backlogFull ? "warning" : "default"}
          />
        </div>
      </div>

      {summary.backlogFull ? (
        <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100/90">
          Seu hub está no limite. Coletar e iniciar aberturas agora evita perder novos envios.
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-[1.2rem] border p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_-12px_rgba(139,92,246,0.2)]",
        tone === "warning"
          ? "border-rose-400/20 bg-rose-500/10"
          : "border-white/10 bg-slate-950/55",
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-2 text-xl font-black tracking-tight text-white">{value}</p>
      <p
        className={cn(
          "mt-1 text-[11px] leading-relaxed",
          tone === "warning" ? "text-rose-100/75" : "text-white/50",
        )}
      >
        {hint}
      </p>
    </div>
  );
}
