"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useGameMatchFlow } from "../../hooks/useGameMatchFlow";
import { MatchResultModal } from "../../components/MatchResultModal";
import { RewardToast } from "../../components/RewardToast";
import { pickQuizQuestion, type QuizQuestion } from "./questions";
import { simulateOpponentAnswer } from "./engine";

export function QuizGameScreen() {
  const roundStart = useRef<number>(Date.now());
  const sessionStart = useRef<string>(new Date().toISOString());
  const [q, setQ] = useState<QuizQuestion>(() => pickQuizQuestion());
  const [phase, setPhase] = useState<"play" | "wait_casa" | "revealed">("play");
  const [picked, setPicked] = useState<number | null>(null);
  const [casaPick, setCasaPick] = useState<number | null>(null);
  const { busy, modal, closeModal, submitMatch, toast, dismissToast } = useGameMatchFlow();

  const newRound = useCallback(() => {
    setQ(pickQuizQuestion());
    setPhase("play");
    setPicked(null);
    setCasaPick(null);
    roundStart.current = Date.now();
  }, []);

  const opponentLabel = useMemo(() => "Casa", []);

  async function answer(i: number) {
    if (phase !== "play" || picked !== null) return;
    setPicked(i);
    const responseTimeMs = Date.now() - roundStart.current;
    setPhase("wait_casa");
    const { picked: casa, delayMs } = simulateOpponentAnswer(q);
    await new Promise((r) => setTimeout(r, delayMs));
    setCasaPick(casa);
    setPhase("revealed");

    const userWin = i === q.correctIndex;
    /** Regra simples 1×1: vitória se você acertou (casa é narrativa). */
    const resultado = userWin ? "vitoria" : "derrota";

    await submitMatch({
      gameId: "quiz",
      resultado,
      score: userWin ? 100 : 20,
      metadata: {
        perguntaId: q.id,
        userPick: i,
        casaPick: casa,
        responseTimeMs,
        opponent: opponentLabel,
      },
      startedAt: sessionStart.current,
      uiTitle: userWin ? "Você venceu a rodada!" : "Casa levou melhor",
      uiSubtitle: userWin
        ? `Tempo: ${responseTimeMs}ms · ${q.q}`
        : `Resposta certa: ${q.options[q.correctIndex]}`,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Quiz rápido 1×1</h1>
        <p className="text-sm text-white/55">
          Você contra a <strong className="text-violet-300">casa</strong> · tempo influencia a
          recompensa.
        </p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-lg text-white">{q.q}</p>
        <p className="mt-1 text-xs text-white/45">
          {phase === "wait_casa" ? "Casa pensando…" : null}
          {phase === "revealed" && casaPick !== null ? (
            <span>
              Casa marcou: <strong>{q.options[casaPick]}</strong>
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {q.options.map((o, i) => (
          <Button
            key={o}
            variant={picked === i ? "primary" : "secondary"}
            disabled={busy || picked !== null || phase !== "play"}
            onClick={() => answer(i)}
          >
            {o}
          </Button>
        ))}
      </div>
      {phase === "revealed" ? (
        <Button variant="secondary" className="w-full" disabled={busy} onClick={newRound}>
          Próxima pergunta
        </Button>
      ) : null}
      <MatchResultModal
        open={modal.open}
        onClose={closeModal}
        result={modal.open ? modal.result : null}
        title={modal.open ? modal.title : ""}
        subtitle={modal.open ? modal.subtitle : undefined}
        rewardCoins={modal.open ? modal.rewardCoins : 0}
        rankingPoints={modal.open ? modal.rankingPoints : 0}
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
