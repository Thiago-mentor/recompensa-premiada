"use client";

import { cn } from "@/lib/utils/cn";
import type { RankingEntry } from "@/types/ranking";

const medals = ["🥇", "🥈", "🥉"];

export function TopPodium({
  entries,
  highlightUid,
}: {
  entries: RankingEntry[];
  highlightUid?: string;
}) {
  const top = entries.slice(0, 3);
  if (top.length === 0) {
    return (
      <p className="text-center text-sm text-white/45">Nenhum jogador ainda neste período.</p>
    );
  }

  const order = [top[1], top[0], top[2]].filter(Boolean) as RankingEntry[];

  return (
    <div className="flex items-end justify-center gap-2 sm:gap-4">
      {order.map((e, i) => {
        const realIdx = top.findIndex((x) => x.uid === e.uid);
        const h = realIdx === 0 ? "h-36" : realIdx === 1 ? "h-28" : "h-24";
        const medal = medals[realIdx] ?? "★";
        const isMe = highlightUid && e.uid === highlightUid;
        return (
          <div
            key={e.uid}
            className={cn(
              "flex w-[30%] max-w-[140px] flex-col items-center rounded-t-2xl border border-white/10 bg-gradient-to-b from-violet-950/80 to-slate-950/90 px-2 pb-3 pt-4 text-center",
              h,
              isMe && "ring-2 ring-amber-400/60",
            )}
          >
            <span className="text-2xl">{medal}</span>
            <span className="mt-1 truncate text-xs font-medium text-white">
              {e.nome.split(" ")[0]}
            </span>
            <span className="text-lg font-bold text-violet-200">{e.score}</span>
          </div>
        );
      })}
    </div>
  );
}
