import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import type { MissionTemplate } from "@/types/mission";

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
  return (
    <article
      className={cn(
        "rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-violet-950/50 p-4 shadow-lg",
        mission.concluida && "ring-1 ring-emerald-500/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-white">{mission.titulo}</h3>
          <p className="mt-1 text-sm text-white/65">{mission.descricao}</p>
        </div>
        <span className="rounded-lg bg-black/30 px-2 py-1 text-[10px] font-bold uppercase text-amber-200">
          {mission.tipo}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-white/55">
        {mission.progresso} / {mission.meta}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-amber-100/90">
        <span>+{mission.recompensaCoins} PR</span>
        {mission.recompensaGems > 0 ? <span>+{mission.recompensaGems} gems</span> : null}
        <span>+{mission.recompensaXP} XP</span>
      </div>
      {mission.concluida && !mission.recompensaResgatada ? (
        <Button className="mt-3 w-full" onClick={onClaim} disabled={claiming}>
          {claiming ? "Resgatando…" : "Resgatar recompensa"}
        </Button>
      ) : null}
      {mission.recompensaResgatada ? (
        <p className="mt-3 text-center text-sm font-medium text-emerald-300">Recompensa resgatada</p>
      ) : null}
    </article>
  );
}
