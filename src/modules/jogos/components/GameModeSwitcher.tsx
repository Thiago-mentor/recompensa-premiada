"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { GameId } from "@/types/game";
import { routeJogosFilaBuscar } from "@/lib/constants/routes";

type SwitcherGameId = Extract<GameId, "ppt" | "quiz" | "reaction_tap">;

const OPTIONS: { id: SwitcherGameId; label: string; short: string }[] = [
  { id: "ppt", label: "Pedra, papel e tesoura", short: "PPT" },
  { id: "quiz", label: "Quiz rápido", short: "Quiz" },
  { id: "reaction_tap", label: "Reaction tap", short: "Reaction" },
];

function soloHref(gameId: SwitcherGameId) {
  if (gameId === "ppt") return "/jogos/pedra-papel-tesoura?teste=1";
  if (gameId === "quiz") return "/jogos/quiz?teste=1";
  return "/jogos/reaction?teste=1";
}

export function GameModeSwitcher({
  currentGameId,
  mode,
  onSelect,
  className,
}: {
  currentGameId: SwitcherGameId;
  mode: "queue" | "solo";
  onSelect?: (gameId: SwitcherGameId) => void;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-white/10 bg-black/20 p-4", className)}>
      <p className="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
        Modo de jogo
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {OPTIONS.map((option) => {
          const selected = currentGameId === option.id;
          const href = mode === "queue" ? routeJogosFilaBuscar(option.id) : soloHref(option.id);
          return (
            <Link
              key={option.id}
              href={href}
              onClick={(event) => {
                if (!onSelect) return;
                event.preventDefault();
                onSelect(option.id);
              }}
              className={cn(
                "rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all duration-200",
                selected
                  ? "border-cyan-400/60 bg-gradient-to-br from-cyan-500/25 to-violet-600/20 text-white shadow-[0_0_20px_-4px_rgba(34,211,238,0.4)]"
                  : "border-white/10 bg-white/5 text-white/60 hover:border-violet-400/35 hover:bg-white/10 hover:text-white",
              )}
            >
              <span className="block text-xs font-black uppercase tracking-wider text-cyan-200/80">
                {option.short}
              </span>
              <span className="mt-0.5 block max-w-[8.5rem] text-left text-[11px] font-semibold leading-tight text-white/80">
                {option.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
