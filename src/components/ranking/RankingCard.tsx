import { cn } from "@/lib/utils/cn";
import type { RankingEntry } from "@/types/ranking";
import { Crown, Medal, Sparkles, TrendingUp } from "lucide-react";

export function RankingCard({
  entry,
  highlightUid,
}: {
  entry: RankingEntry;
  highlightUid?: string | null;
}) {
  const pos = entry.posicao ?? 0;
  const top = pos <= 3;
  const winRate =
    entry.partidas > 0 ? Math.round((entry.vitorias / Math.max(entry.partidas, 1)) * 100) : 0;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3",
        highlightUid && entry.uid === highlightUid && "ring-1 ring-amber-400/60 bg-amber-500/10 shadow-[0_0_28px_-16px_rgba(251,191,36,0.45)]",
        top && "bg-gradient-to-r from-amber-500/15 to-transparent",
      )}
    >
      <div className="flex w-8 justify-center">
        {pos === 1 ? (
          <Crown className="h-5 w-5 text-amber-300" />
        ) : pos <= 3 ? (
          <Medal className="h-5 w-5 text-violet-300" />
        ) : (
          <span className="text-sm font-bold text-white/50">{pos}</span>
        )}
      </div>
      <div
        className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 bg-cover bg-center"
        style={entry.foto ? { backgroundImage: `url(${entry.foto})` } : undefined}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">{entry.nome}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/55">
          <span>{entry.vitorias} vitórias</span>
          <span>{entry.partidas} partidas</span>
          <span className="inline-flex items-center gap-1 text-cyan-200/80">
            <TrendingUp className="h-3 w-3" />
            {winRate}% aproveitamento
          </span>
        </div>
      </div>
      <div className="text-right">
        <span className="text-sm font-bold tabular-nums text-amber-200">{entry.score}</span>
        {highlightUid && entry.uid === highlightUid ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-100/90">
            <Sparkles className="h-3 w-3" />
            você
          </p>
        ) : null}
      </div>
    </div>
  );
}
