"use client";

import { cn } from "@/lib/utils/cn";
import { getRankingPrizeForPosition, formatRankingPrize } from "@/lib/ranking/prizes";
import { resolveAvatarBackgroundCssValue } from "@/lib/users/avatar";
import type { RankingEntry } from "@/types/ranking";
import type { RankingPrizeTier } from "@/types/systemConfig";
import { Crown, Medal, Sparkles } from "lucide-react";

export function TopPodium({
  entries,
  highlightUid,
  prizeTiers = [],
}: {
  entries: RankingEntry[];
  highlightUid?: string;
  prizeTiers?: RankingPrizeTier[];
}) {
  const top = entries.slice(0, 3);
  if (top.length === 0) {
    return (
      <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-white/45">
        Nenhum jogador ainda neste período.
      </div>
    );
  }

  const order = [top[1], top[0], top[2]].filter(Boolean) as RankingEntry[];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
      {order.map((e) => {
        const realIdx = top.findIndex((x) => x.uid === e.uid);
        const h = realIdx === 0 ? "sm:min-h-[320px]" : "sm:min-h-[284px]";
        const isFirst = realIdx === 0;
        const isMe = highlightUid && e.uid === highlightUid;
        const pos = realIdx + 1;
        const prize = getRankingPrizeForPosition(prizeTiers, pos);
        return (
          <div
            key={e.uid}
            className={cn(
              "relative flex flex-col items-center overflow-hidden rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(167,139,250,0.22),transparent_55%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] px-4 pb-5 pt-6 text-center",
              h,
              isFirst ? "shadow-[0_0_48px_-18px_rgba(245,158,11,0.45)]" : "shadow-[0_0_36px_-20px_rgba(139,92,246,0.4)]",
              isMe && "ring-2 ring-amber-400/60",
            )}
          >
            <div className="absolute inset-x-4 top-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
              <span>#{pos}</span>
              {isMe ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-amber-100/90">
                  <Sparkles className="h-3 w-3" />
                  você
                </span>
              ) : null}
            </div>

            <div
              className={cn(
                "mt-6 flex h-16 w-16 items-center justify-center rounded-[26px] border border-white/10 bg-cover bg-center shadow-[0_0_28px_-12px_rgba(34,211,238,0.45)]",
                isFirst && "h-20 w-20 rounded-[30px]",
              )}
              style={{
                backgroundImage: resolveAvatarBackgroundCssValue({
                  photoUrl: e.foto,
                  name: e.nome,
                  username: e.username,
                  uid: e.uid,
                }),
              }}
            />

            <div
              className={cn(
                "mt-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10",
                isFirst && "bg-amber-500/20 text-amber-200",
                realIdx === 1 && "bg-slate-200/10 text-slate-100",
                realIdx === 2 && "bg-orange-500/15 text-orange-100",
              )}
            >
              {isFirst ? <Crown className="h-5 w-5" /> : <Medal className="h-5 w-5" />}
            </div>

            <p className="mt-3 max-w-full truncate text-base font-semibold text-white">{e.nome}</p>
            <p className="mt-1 text-xs text-white/45">{e.username ? `@${e.username}` : "jogador ranqueado"}</p>

            <div className="mt-4 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/65">Score</p>
              <p className="mt-1 text-2xl font-black tracking-tight text-white">{e.score}</p>
              <p className="mt-2 text-xs text-white/55">
                {e.vitorias} vitórias · {e.partidas} partidas
              </p>
            </div>

            <div className="mt-3 w-full rounded-2xl border border-amber-400/15 bg-amber-500/10 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/75">
                Premiação prevista
              </p>
              <p className="mt-1 text-sm font-semibold text-amber-50">{formatRankingPrize(prize)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
