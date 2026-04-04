import { cn } from "@/lib/utils/cn";
import type { RankingEntry } from "@/types/ranking";
import { Crown, Medal } from "lucide-react";

export function RankingCard({
  entry,
  highlightUid,
}: {
  entry: RankingEntry;
  highlightUid?: string | null;
}) {
  const pos = entry.posicao ?? 0;
  const top = pos <= 3;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5",
        highlightUid && entry.uid === highlightUid && "ring-1 ring-amber-400/60 bg-amber-500/10",
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
        <p className="text-xs text-white/55">
          {entry.vitorias} vitórias · {entry.partidas} partidas
        </p>
      </div>
      <span className="text-sm font-bold tabular-nums text-amber-200">{entry.score}</span>
    </div>
  );
}
