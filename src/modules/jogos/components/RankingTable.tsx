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
    <div className="game-panel overflow-hidden rounded-[1.25rem] shadow-[0_0_36px_-24px_rgba(139,92,246,0.5)] sm:rounded-[1.5rem]">
      <table className="w-full table-fixed text-left text-[13px] sm:text-sm">
        <thead className="bg-white/5 text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-100/52 sm:text-[10px] sm:tracking-wider">
          <tr>
            <th className="w-10 px-2.5 py-2.5 sm:w-14 sm:px-4 sm:py-3">#</th>
            <th className="px-2.5 py-2.5 sm:px-4 sm:py-3">Jogador</th>
            {showPrizeColumn ? (
              <th className="hidden px-4 py-3 text-left lg:table-cell">Prêmio</th>
            ) : null}
            <th className="hidden w-20 px-3 py-3 text-right lg:table-cell sm:px-4">PR</th>
            <th className="w-16 px-2 py-2.5 text-right sm:w-20 sm:px-4 sm:py-3">Vitórias</th>
            <th className="w-16 px-2 py-2.5 text-right sm:w-20 sm:px-4 sm:py-3">Partidas</th>
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
                <td className="px-2.5 py-2.5 font-mono tabular-nums text-white/55 sm:px-4 sm:py-3">
                  {pos}
                </td>
                <td className="px-2.5 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <div
                      className="h-9 w-9 shrink-0 rounded-[14px] border border-white/10 bg-cover bg-center sm:h-11 sm:w-11 sm:rounded-[18px]"
                      style={{
                        backgroundImage: `url(${resolveAvatarUrl({
                          photoUrl: e.foto,
                          name: e.nome,
                          username: e.username,
                          uid: e.uid,
                        })})`,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold leading-tight text-white sm:text-sm">
                        {e.nome}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] leading-tight text-white/45 sm:text-xs">
                        {e.username ? `@${e.username}` : "sem @usuário"}
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
                <td className="hidden px-3 py-3 text-right font-semibold text-cyan-100 lg:table-cell sm:px-4">
                  {e.score}
                </td>
                <td className="px-2 py-2.5 text-right font-semibold text-violet-200 sm:px-4 sm:py-3">
                  {e.vitorias}
                </td>
                <td className="px-2 py-2.5 text-right text-white/60 sm:px-4 sm:py-3">
                  {e.partidas}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
