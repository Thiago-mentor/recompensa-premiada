"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useGameMatchFlow } from "../../hooks/useGameMatchFlow";
import { MatchResultModal } from "../../components/MatchResultModal";
import { RewardToast } from "../../components/RewardToast";
import { CooldownTimer } from "../../components/CooldownTimer";
import { cooldownRemainingMs } from "@/lib/games/gameEconomy";

export function BauGameScreen() {
  const { profile } = useAuth();
  const sessionStart = useRef<string>(new Date().toISOString());
  const [renderedAt] = useState(() => Date.now());
  const { busy, modal, closeModal, submitMatch, toast, dismissToast } = useGameMatchFlow();

  const cooldownMs = useMemo(() => {
    const gc = profile?.gameCooldownUntil as Record<string, unknown> | undefined;
    return cooldownRemainingMs("bau", gc, renderedAt);
  }, [profile?.gameCooldownUntil, renderedAt]);

  async function openChest() {
    const r = await submitMatch({
      gameId: "bau",
      resultado: "vitoria",
      score: 0,
      metadata: { kind: "bau_chest" },
      startedAt: sessionStart.current,
      uiTitle: "Baú aberto!",
      uiSubtitle: "Loot definido no servidor",
    });
    if (r.ok) {
      sessionStart.current = new Date().toISOString();
    }
  }

  const locked = cooldownMs > 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Baú</h1>
        <p className="text-sm text-white/55">
          Cooldown longo anti-farm · recompensa só após validação no backend.
        </p>
      </div>
      <CooldownTimer remainingMs={cooldownMs} />
      <div className="flex min-h-[160px] items-center justify-center rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-950/50 to-slate-900 text-6xl">
        📦
      </div>
      <Button className="w-full" disabled={busy || locked} onClick={openChest}>
        {locked ? "Em cooldown" : busy ? "Abrindo…" : "Abrir baú"}
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
