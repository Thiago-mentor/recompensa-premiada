import { cn } from "@/lib/utils/cn";
import { resolveAvatarBackgroundCssValue } from "@/lib/users/avatar";
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
        "game-panel-soft flex items-center gap-3 rounded-[1.3rem] px-3.5 py-3.5",
        highlightUid &&
          entry.uid === highlightUid &&
          "border-amber-400/28 ring-1 ring-amber-400/45 shadow-[0_0_30px_-16px_rgba(251,191,36,0.45)]",
        top && "border-amber-400/20 bg-[linear-gradient(90deg,rgba(251,191,36,0.12),rgba(6,10,21,0.72))]",
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
        className="h-9 w-9 shrink-0 rounded-full bg-cover bg-center"
        style={{
          backgroundImage: resolveAvatarBackgroundCssValue({
            photoUrl: entry.foto,
            name: entry.nome,
            uid: entry.uid,
          }),
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{entry.nome}</p>
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
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200/70">PR</p>
        <span className="bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-sm font-black tabular-nums text-transparent drop-shadow-[0_0_10px_rgba(251,191,36,0.35)]">
          {entry.score}
        </span>
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
