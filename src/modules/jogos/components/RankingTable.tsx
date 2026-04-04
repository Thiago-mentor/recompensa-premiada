"use client";

import { cn } from "@/lib/utils/cn";
import type { RankingEntry } from "@/types/ranking";

export function RankingTable({
  entries,
  highlightUid,
  startRank = 1,
}: {
  entries: RankingEntry[];
  highlightUid?: string;
  /** Índice inicial de posição (ex.: 4 quando já exibiu pódio). */
  startRank?: number;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-[10px] font-semibold uppercase tracking-wider text-white/45">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Jogador</th>
            <th className="px-3 py-2 text-right">Score</th>
            <th className="hidden px-3 py-2 text-right sm:table-cell">Vitórias</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const pos = startRank + i;
            const isMe = highlightUid && e.uid === highlightUid;
            return (
              <tr
                key={e.uid}
                className={cn(
                  "border-t border-white/5",
                  isMe ? "bg-amber-500/15" : "hover:bg-white/[0.03]",
                )}
              >
                <td className="px-3 py-2.5 font-mono text-white/55">{pos}</td>
                <td className="max-w-[140px] truncate px-3 py-2.5 font-medium text-white">
                  {e.nome}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-violet-200">
                  {e.score}
                </td>
                <td className="hidden px-3 py-2.5 text-right text-white/60 sm:table-cell">
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
