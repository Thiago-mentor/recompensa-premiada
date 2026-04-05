"use client";

import { useCallback, useState } from "react";
import {
  finalizeMatchOnServer,
  type FinalizeMatchInput,
  type FinalizeMatchResult,
} from "@/services/jogos/matchService";
import type { MatchResultKind } from "../components/MatchResultModal";

type ModalState =
  | { open: false }
  | {
      open: true;
      result: MatchResultKind | null;
      title: string;
      subtitle?: string;
      rewardCoins: number;
      rankingPoints: number;
      error: string | null;
    };

export function useGameMatchFlow() {
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const closeModal = useCallback(() => setModal({ open: false }), []);

  const submitMatch = useCallback(
    async (input: FinalizeMatchInput & { uiTitle: string; uiSubtitle?: string }) => {
      setBusy(true);
      const { uiTitle, uiSubtitle, ...payload } = input;
      const r: FinalizeMatchResult = await finalizeMatchOnServer(payload);
      setBusy(false);

      if (r.ok) {
        setModal({
          open: true,
          result: payload.resultado,
          title: uiTitle,
          subtitle: uiSubtitle,
          rewardCoins: r.rewardCoins ?? 0,
          rankingPoints: r.rankingPoints ?? 0,
          error: null,
        });
        if ((r.rewardCoins ?? 0) > 0) {
          setToast({ message: `+${r.rewardCoins} PR creditados` });
        }
      } else {
        setModal({
          open: true,
          result: null,
          title: "Não registrado",
          subtitle: undefined,
          rewardCoins: 0,
          rankingPoints: 0,
          error: r.error ?? "Erro desconhecido",
        });
      }

      return r;
    },
    [],
  );

  const dismissToast = useCallback(() => setToast(null), []);

  return {
    busy,
    modal,
    closeModal,
    submitMatch,
    toast,
    dismissToast,
  };
}
