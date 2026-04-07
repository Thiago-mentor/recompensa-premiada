"use client";

import { cn } from "@/lib/utils/cn";
import { getRankingPrizeForPosition, formatRankingPrize } from "@/lib/ranking/prizes";
import { resolveAvatarUrl } from "@/lib/users/avatar";
import type { RankingEntry } from "@/types/ranking";
import type { RankingPrizeTier } from "@/types/systemConfig";

export function RankingTable({
  entries,
  highlightUid,
  startRank = 1,
  prizeTiers = [],
  showPrizeColumn = true,
}: {
  entries: RankingEntry[];
  highlightUid?: string;
  /** Índice inicial de posição (ex.: 4 quando já exibiu pódio). */
  startRank?: number;
  prizeTiers?: RankingPrizeTier[];
  showPrizeColumn?: boolean;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/65 shadow-[0_0_36px_-24px_rgba(139,92,246,0.5)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-[10px] font-semibold uppercase tracking-wider text-white/45">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Jogador</th>
            {showPrizeColumn ? (
              <th className="hidden px-4 py-3 text-left lg:table-cell">Prêmio</th>
            ) : null}
            <th className="px-4 py-3 text-right">Score</th>
            <th className="hidden px-4 py-3 text-right sm:table-cell">Vitórias</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const pos = startRank + i;
            const isMe = highlightUid && e.uid === highlightUid;
            const prize = getRankingPrizeForPosition(prizeTiers, pos);
            return (
              <tr
                key={e.uid}
                className={cn(
                  "border-t border-white/5",
                  isMe ? "bg-amber-500/15" : "hover:bg-white/[0.03]",
                )}
              >
                <td className="px-4 py-3 font-mono text-white/55">{pos}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-11 w-11 shrink-0 rounded-[18px] border border-white/10 bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${resolveAvatarUrl({
                          photoUrl: e.foto,
                          name: e.nome,
                          username: e.username,
                          uid: e.uid,
                        })})`,
                      }}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{e.nome}</p>
                      <p className="mt-0.5 text-xs text-white/45">
                        {e.username ? `@${e.username}` : `${e.partidas} partidas`}
                      </p>
                    </div>
                  </div>
                </td>
                {showPrizeColumn ? (
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className="inline-flex rounded-full border border-cyan-400/15 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100/85">
                      {formatRankingPrize(prize)}
                    </span>
                  </td>
                ) : null}
                <td className="px-4 py-3 text-right font-semibold text-violet-200">
                  {e.score}
                </td>
                <td className="hidden px-4 py-3 text-right text-white/60 sm:table-cell">
                  {e.vitorias}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
