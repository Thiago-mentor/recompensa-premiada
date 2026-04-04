import type { Timestamp } from "./firestore";
import type { GameId } from "./game";

/** Documento `game_rooms/{roomId}` */
export interface GameRoomDocument {
  id: string;
  gameId: GameId;
  hostUid: string;
  guestUid: string;
  hostNome: string;
  guestNome: string;
  hostFoto: string | null;
  guestFoto: string | null;
  status: "matched" | "playing" | "completed" | "cancelled";
  phase: string;
  /** UIDs que já enviaram jogada nesta rodada (atualizado pela Function). */
  pptPickedUids?: string[];
  pptHostScore?: number;
  pptGuestScore?: number;
  /** Meta de pontos para vencer a partida (padrão 5 na Function). */
  pptTargetScore?: number;
  pptLastHostHand?: string;
  pptLastGuestHand?: string;
  /** Legado (partida single-round). */
  pptHostHand?: string;
  pptGuestHand?: string;
  pptLastRoundOutcome?: "host_win" | "guest_win" | "draw";
  /** Vencedor da partida (melhor de N). */
  pptMatchWinner?: "host" | "guest";
  /** Mantido no fim da partida: última rodada decisiva (host_win | guest_win). */
  pptOutcome?: "host_win" | "guest_win" | "draw";
  pptRewardsApplied?: boolean;
  /** Vitória por W.O. / abandono / falta de sinal do oponente */
  pptEndedByForfeit?: boolean;
  /** UID do jogador que perdeu por desistência ou inatividade */
  pptForfeitedByUid?: string;
  /** Servidor: rodada aberta aguardando os dois enviarem jogada (0 em `pptPickedUids`). */
  pptAwaitingBothPicks?: boolean;
  /** Início da janela atual para detetar inatividade dupla. */
  pptRoundStartedAt?: Timestamp;
  /** Quantas janelas seguidas passaram sem nenhum pick (0 → 1 → anula). */
  pptConsecutiveEmptyRounds?: number;
  /** Partida encerrada sem vencedor: ambos inativos duas rodadas seguidas. */
  pptVoidBothInactive?: boolean;
  /** Heartbeat PPT (servidor) — presença na partida */
  pptHostPresenceAt?: Timestamp;
  pptGuestPresenceAt?: Timestamp;
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
}

/** Documento `multiplayer_slots/{uid}` — atualizado pelas Functions */
export interface MultiplayerSlotDocument {
  uid: string;
  gameId: GameId;
  queueStatus: "idle" | "waiting" | "matched";
  roomId: string | null;
  atualizadoEm: Timestamp;
}
