"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { fetchUserMatchHistory } from "@/services/jogos/matchHistoryService";
import type { MatchRecord } from "@/types/game";
import { cn } from "@/lib/utils/cn";
import { staggerContainer, staggerItem } from "@/components/arena/ArenaShell";

function formatGame(id: string) {
  const map: Record<string, string> = {
    ppt: "PPT",
    quiz: "Quiz",
    reaction_tap: "Reaction",
    roleta: "Roleta",
    bau: "Baú",
    numero_secreto: "Número",
  };
  return map[id] ?? id;
}

export function MatchHistoryList({ className }: { className?: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<MatchRecord[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    void fetchUserMatchHistory(user.uid, 15)
      .then((items) => {
        if (!cancelled) setRows(items);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  if (!user) return null;

  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4 shadow-inner shadow-black/30",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-200/75">
          Histórico recente
        </h2>
        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/40">
          Arena
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-white/45">Nenhuma partida registrada ainda.</p>
      ) : (
        <motion.ul
          className="space-y-2 text-xs"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {rows.map((m) => (
            <motion.li
              key={m.id}
              variants={staggerItem}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.04] to-transparent px-3 py-2.5 text-white/85"
            >
              <span className="font-semibold text-white/90">{formatGame(m.gameType ?? m.gameId)}</span>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                  m.resultado === "vitoria" && "bg-emerald-500/15 text-emerald-300",
                  m.resultado === "empate" && "bg-amber-500/15 text-amber-200",
                  m.resultado === "derrota" && "bg-rose-500/15 text-rose-300",
                )}
              >
                {m.resultado}
              </span>
              <span className="w-full text-[11px] text-white/45 sm:w-auto sm:text-right">
                score {m.score}
                {m.rewardCoins != null ? ` · +${m.rewardCoins} PR` : ""}
              </span>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}
