"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GameModeSwitcher } from "../../components/GameModeSwitcher";
import { useGameMatchFlow } from "../../hooks/useGameMatchFlow";
import { MatchResultModal } from "../../components/MatchResultModal";
import { RewardToast } from "../../components/RewardToast";
import { falseStartOutcome, reactionResultFromMs } from "./engine";

type Phase = "idle" | "wait" | "go";

export function ReactionGameScreen() {
  const sessionStart = useRef<string>(new Date().toISOString());
  const start = useRef(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [ms, setMs] = useState<number | null>(null);
  const { busy, modal, closeModal, submitMatch, toast, dismissToast } = useGameMatchFlow();

  function begin() {
    setMs(null);
    setPhase("wait");
    const delay = 1000 + Math.random() * 2000;
    setTimeout(() => {
      setPhase("go");
      start.current = performance.now();
    }, delay);
  }

  async function tap() {
    if (phase === "wait") {
      const fs = falseStartOutcome();
      setPhase("idle");
      await submitMatch({
        gameId: "reaction_tap",
        resultado: fs.resultado,
        score: 0,
        metadata: { reactionMs: fs.reactionMs, falseStart: true },
        startedAt: sessionStart.current,
        uiTitle: "Falso start",
        uiSubtitle: "Toque só quando ficar verde.",
      });
      return;
    }
    if (phase !== "go") return;
    const reaction = Math.round(performance.now() - start.current);
    setMs(reaction);
    setPhase("idle");
    const { resultado, scoreHint } = reactionResultFromMs(reaction);
    await submitMatch({
      gameId: "reaction_tap",
      resultado,
      score: scoreHint,
      metadata: { reactionMs: reaction },
      startedAt: sessionStart.current,
      uiTitle: resultado === "vitoria" ? "Reflexo afiado!" : "Tente de novo",
      uiSubtitle: `${reaction} ms`,
    });
  }

  return (
    <div className="space-y-4">
      <GameModeSwitcher currentGameId="reaction_tap" mode="solo" />
      <div>
        <h1 className="text-xl font-bold text-white">Reaction tap</h1>
        <p className="text-sm text-white/55">
          Não toque durante &quot;Aguarde&quot;. Reação em ms vai para o servidor.
        </p>
      </div>
      <button
        type="button"
        onClick={phase === "go" || phase === "wait" ? tap : begin}
        disabled={busy}
        className={`w-full rounded-2xl py-16 text-lg font-bold transition ${
          phase === "go"
            ? "bg-emerald-500 text-black"
            : phase === "wait"
              ? "bg-amber-600/80 text-white"
              : "bg-white/10 text-white"
        }`}
      >
        {phase === "idle"
          ? ms != null
            ? `Último: ${ms} ms — toque para nova rodada`
            : "Toque para começar"
          : phase === "wait"
            ? "Aguarde…"
            : "TOQUE!"}
      </button>
      {phase === "idle" && ms == null ? (
        <Button variant="secondary" className="w-full" disabled={busy} onClick={begin}>
          Iniciar rodada
        </Button>
      ) : null}
      <MatchResultModal
        open={modal.open}
        onClose={closeModal}
        result={modal.open ? modal.result : null}
        title={modal.open ? modal.title : ""}
        subtitle={modal.open ? modal.subtitle : undefined}
        rewardCoins={modal.open ? modal.rewardCoins : 0}
        boostCoins={modal.open ? modal.boostCoins : 0}
        rankingPoints={modal.open ? modal.rankingPoints : 0}
        grantedChest={modal.open ? modal.grantedChest : null}
        error={modal.open ? modal.error : null}
      />
      <RewardToast
        message={toast?.message ?? null}
        visible={!!toast}
        onDismiss={dismissToast}
      />
    </div>
  );
}
