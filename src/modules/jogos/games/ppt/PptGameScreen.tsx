"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useGameMatchFlow } from "../../hooks/useGameMatchFlow";
import { MatchResultModal } from "../../components/MatchResultModal";
import { RewardToast } from "../../components/RewardToast";
import type { Hand } from "./engine";
import { pptClientScore, randomHouseHand, resolvePptRound } from "./engine";

export function PptGameScreen() {
  const sessionStart = useRef<string>(new Date().toISOString());
  const { busy, modal, closeModal, submitMatch, toast, dismissToast } = useGameMatchFlow();
  const [last, setLast] = useState<{ user: Hand; house: Hand } | null>(null);

  async function play(user: Hand) {
    const house = randomHouseHand();
    const { resultado } = resolvePptRound(user, house);
    setLast({ user, house });
    await submitMatch({
      gameId: "ppt",
      resultado,
      score: pptClientScore(resultado),
      metadata: { user, house, opponent: "casa" },
      startedAt: sessionStart.current,
      uiTitle:
        resultado === "vitoria"
          ? "Vitória!"
          : resultado === "empate"
            ? "Empate"
            : "Derrota",
      uiSubtitle: `Você: ${user} · Casa: ${house}`,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Pedra, papel e tesoura</h1>
        <p className="text-sm text-white/55">
          Sessão rápida contra a casa · resultado e coins validados no servidor.
        </p>
      </div>
      {last ? (
        <p className="text-sm text-white/70">
          Última rodada: você <strong className="text-white">{last.user}</strong> · casa{" "}
          <strong className="text-white">{last.house}</strong>
        </p>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        {(["pedra", "papel", "tesoura"] as const).map((h) => (
          <Button
            key={h}
            variant="secondary"
            className="capitalize"
            disabled={busy}
            onClick={() => play(h)}
          >
            {h}
          </Button>
        ))}
      </div>
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
