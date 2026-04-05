import { Button } from "@/components/ui/Button";
import type { StreakCardPreview } from "@/types/streakPreview";
import { formatStreakRewardShort } from "@/utils/streakReward";
import { Flame } from "lucide-react";

export function DailyStreakCard({
  streak,
  onCheckIn,
  loading,
  preview,
  claimedToday,
}: {
  streak: number;
  onCheckIn: () => void;
  loading?: boolean;
  preview?: StreakCardPreview | null;
  /** Quando o perfil indica coleta já feita hoje (sem banner no topo). */
  claimedToday?: boolean;
}) {
  const milestoneLine = preview?.nextMilestone
    ? (() => {
        const { tier, daysUntil } = preview.nextMilestone;
        const d = daysUntil === 1 ? "dia" : "dias";
        return `Próximo marco: dia ${tier.dia} (faltam ${daysUntil} ${d}) · ${formatStreakRewardShort(tier)}`;
      })()
    : preview?.hasConfiguredMilestones
      ? "Você já passou dos marcos configurados nesta lista — continue a sequência para novos eventos."
      : null;

  const nextLoginLine =
    claimedToday && preview
      ? `Amanhã, se voltar: ${formatStreakRewardShort(preview.nextLoginReward)}`
      : preview
        ? `Próxima entrada (se a sequência continuar): ${formatStreakRewardShort(preview.nextLoginReward)}`
        : null;

  return (
    <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-950/50 to-slate-900/90 p-4">
      <div className="flex items-center gap-2 text-orange-200">
        <Flame className="h-6 w-6" />
        <div>
          <p className="text-sm font-medium text-orange-100/90">Recompensa diária</p>
          <p className="text-2xl font-bold text-white">Sequência: {streak} dias</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-white/55">
        Colete <strong className="text-white/70">uma vez por dia</strong>. Dias seguidos mantêm a
        sequência; pular um dia zera. Marcos com TICKET/baú vêm da configuração da economia.
      </p>
      {milestoneLine ? (
        <p className="mt-2 text-xs leading-relaxed text-orange-100/75">{milestoneLine}</p>
      ) : null}
      {nextLoginLine ? (
        <p className="mt-1 text-xs leading-relaxed text-white/45">{nextLoginLine}</p>
      ) : null}
      {claimedToday ? (
        <p className="mt-2 rounded-lg border border-emerald-500/35 bg-emerald-950/40 px-3 py-2 text-xs leading-relaxed text-emerald-100/95">
          Recompensa de hoje já coletada. Volte amanhã para manter a sequência.
        </p>
      ) : null}
      <Button
        variant="secondary"
        className="mt-3 w-full border-orange-500/30"
        onClick={onCheckIn}
        disabled={loading || claimedToday}
      >
        {loading ? "Registrando…" : claimedToday ? "Já coletado hoje" : "Coletar recompensa de hoje"}
      </Button>
    </div>
  );
}
