"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { autoQueueAllowed } from "@/lib/firebase/sparkMode";
import { callFunction } from "@/services/callables/client";
import type { GameId } from "@/types/game";

const QUEUE_GAMES: GameId[] = ["ppt", "quiz", "reaction_tap"];

export function isAutoQueueGame(id: string): id is GameId {
  return QUEUE_GAMES.includes(id as GameId);
}

export type JoinAutoMatchResponse =
  | {
      status: "waiting";
    }
  | {
      status: "matched";
      roomId: string;
      hostUid?: string;
      guestUid?: string;
      yourSeat?: number;
    };

export async function joinAutoMatchQueue(gameId: GameId): Promise<JoinAutoMatchResponse> {
  if (!autoQueueAllowed()) {
    throw new Error(
      "Fila automática exige Cloud Functions (Blaze) ou emuladores locais. Defina NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true e rode npm run emulators, ou use NEXT_PUBLIC_SPARK_FREE_TIER=false com deploy das Functions.",
    );
  }
  if (!getFirebaseAuth().currentUser?.uid) {
    throw new Error("Faça login para entrar na fila.");
  }
  const res = await callFunction<{ gameId: GameId }, JoinAutoMatchResponse>("joinAutoMatch", {
    gameId,
  });
  return res.data as JoinAutoMatchResponse;
}

export async function leaveAutoMatchQueue(gameId: GameId): Promise<void> {
  if (!autoQueueAllowed()) return;
  await callFunction("leaveAutoMatch", { gameId });
}

/** Sincroniza timer / recuperação de duelos PPT (10 min) sem entrar na fila. */
export async function syncPptDuelRefillSchedule(): Promise<void> {
  if (!autoQueueAllowed()) return;
  if (!getFirebaseAuth().currentUser?.uid) return;
  await callFunction("pptSyncDuelRefill", {});
}

/** Sincroniza timer / recuperação de duelos Quiz (10 min) sem entrar na fila. */
export async function syncQuizDuelRefillSchedule(): Promise<void> {
  if (!autoQueueAllowed()) return;
  if (!getFirebaseAuth().currentUser?.uid) return;
  await callFunction("quizSyncDuelRefill", {});
}

/** Sincroniza timer / recuperação de duelos Reaction Tap (10 min) sem entrar na fila. */
export async function syncReactionDuelRefillSchedule(): Promise<void> {
  if (!autoQueueAllowed()) return;
  if (!getFirebaseAuth().currentUser?.uid) return;
  await callFunction("reactionSyncDuelRefill", {});
}
