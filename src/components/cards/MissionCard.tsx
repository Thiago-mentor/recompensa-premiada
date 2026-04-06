import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import type { MissionTemplate } from "@/types/mission";
import { CheckCircle2, Target } from "lucide-react";

export type MissionCardModel = MissionTemplate & {
  progresso: number;
  concluida: boolean;
  recompensaResgatada: boolean;
};

export function MissionCard({
  mission,
  onClaim,
  claiming,
}: {
  mission: MissionCardModel;
  onClaim?: () => void;
  claiming?: boolean;
}) {
  const pct = Math.min(100, Math.round((mission.progresso / Math.max(mission.meta, 1)) * 100));
  const rewardLine = [
    mission.recompensaCoins > 0 ? `+${mission.recompensaCoins} PR` : null,
    mission.recompensaGems > 0 ? `+${mission.recompensaGems} TICKET` : null,
    mission.recompensaXP > 0 ? `+${mission.recompensaXP} XP` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={cn(
        "rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/85 via-slate-900/90 to-violet-950/50 p-4 shadow-lg",
        mission.concluida && "ring-1 ring-emerald-500/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-white">{mission.titulo}</h3>
          <p className="mt-1 text-sm text-white/65">{mission.descricao}</p>
        </div>
        <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-bold uppercase text-amber-200">
          {mission.tipo}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 font-semibold text-cyan-100/90">
          <Target className="h-3.5 w-3.5" />
          Meta {mission.meta}
        </span>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-100/90">
          {rewardLine}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-white/55">
        Progresso: {mission.progresso} / {mission.meta}
      </p>
      {mission.concluida && !mission.recompensaResgatada ? (
        <Button className="mt-3 w-full" onClick={onClaim} disabled={claiming}>
          {claiming ? "Resgatando..." : "Resgatar recompensa"}
        </Button>
      ) : null}
      {mission.recompensaResgatada ? (
        <p className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Recompensa resgatada
        </p>
      ) : null}
    </article>
  );
}
