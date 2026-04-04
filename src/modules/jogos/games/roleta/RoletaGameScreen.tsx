"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useGameMatchFlow } from "../../hooks/useGameMatchFlow";
import { MatchResultModal } from "../../components/MatchResultModal";
import { RewardToast } from "../../components/RewardToast";

const DISPLAY_SEGMENTS = [10, 25, 50, 75, 100, 150, 200];

export function RoletaGameScreen() {
  const sessionStart = useRef<string>(new Date().toISOString());
  const [spinning, setSpinning] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const { busy, modal, closeModal, submitMatch, toast, dismissToast } = useGameMatchFlow();

  async function spin() {
    setSpinning(true);
    const steps = 16 + Math.floor(Math.random() * 8);
    for (let i = 0; i < steps; i++) {
      setHighlight(i % DISPLAY_SEGMENTS.length);
      await new Promise((r) => setTimeout(r, 70 + i * 4));
    }
    setSpinning(false);

    const r = await submitMatch({
      gameId: "roleta",
      resultado: "vitoria",
      score: 0,
      metadata: { visualSegment: DISPLAY_SEGMENTS[highlight] },
      startedAt: sessionStart.current,
      uiTitle: "Roleta",
      uiSubtitle: "Prêmio creditado conforme tabela do servidor",
    });

    if (r.ok) {
      sessionStart.current = new Date().toISOString();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Roleta de coins</h1>
        <p className="text-sm text-white/55">
          A animação é só visual — o valor real vem da Cloud Function / modo Spark.
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {DISPLAY_SEGMENTS.map((v, i) => (
          <div
            key={v}
            className={`flex h-14 items-center justify-center rounded-xl border text-sm font-bold transition ${
              i === highlight
                ? "border-fuchsia-400 bg-fuchsia-600/40 text-white"
                : "border-white/10 bg-white/5 text-white/50"
            }`}
          >
            {v}
          </div>
        ))}
      </div>
      <Button className="w-full" disabled={spinning || busy} onClick={spin}>
        {spinning ? "Girando…" : busy ? "Registrando…" : "Girar roleta"}
      </Button>
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
