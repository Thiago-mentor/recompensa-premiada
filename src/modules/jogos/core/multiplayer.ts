/**
 * Contratos e notas para multiplayer 1v1 (futuro).
 *
 * Hoje: `matches` já tem `opponentId` + `metadata`; `finalizeMatch` valida economia no servidor.
 * PvP exige **estado de sessão** e **jogadas que não confiem só no cliente**.
 *
 * Camadas sugeridas:
 * 1. **Matchmaking** — fila por `gameId` (Firestore ou Realtime DB) ou convite por código.
 * 2. **Sala** — doc `game_rooms/{roomId}` com `hostUid`, `guestUid`, `status`, `gameId`, `turn`,
 *    `expiresAt`, `serverSeed` (opcional).
 * 3. **Jogadas** — subcoleção `game_rooms/{id}/moves/{n}` ou Function `submitMove` que valida turno e regras.
 * 4. **Encerramento** — uma única Function `finalizeMultiplayerMatch` grava 2× `matches` (ou 1 doc + `participants[]`)
 *    e aplica recompensas/ranking (evita dupla contagem com transação).
 * 5. **Anti-cheat** — PPT: commit-reveal (hash da jogada + reveal) ou só servidor sorteia “casa” após ambos lockarem.
 *
 * Jogos marcados `multiplayerReady` no catálogo são os primeiros candidatos a modo PvP.
 */
import type { GameId } from "@/types/game";

/** Estado da sala antes de virar histórico em `matches`. */
export type GameRoomStatus = "open" | "matched" | "in_progress" | "completed" | "cancelled";

export type GameRoom = {
  id: string;
  gameId: GameId;
  hostUid: string;
  guestUid: string | null;
  status: GameRoomStatus;
  /** Quem deve agir (ex.: host = 0, guest = 1). */
  activeSeat: 0 | 1 | null;
  criadoEm: unknown;
  atualizadoEm: unknown;
};

/** Convite assíncrono (amigo) — alternativa à fila global. */
export type GameInvite = {
  id: string;
  fromUid: string;
  toUid: string | null;
  gameId: GameId;
  codigoCurto: string;
  expiraEm: unknown;
  status: "pendente" | "aceito" | "recusado" | "expirado";
};

/** Payload futuro para `finalizeMatch` / Function dedicada. */
export type MultiplayerResultPayload = {
  roomId: string;
  winnerUid: string | null;
  /** empate em jogos que suportarem */
  draw?: boolean;
  metadata: Record<string, unknown>;
};

/** Alinhado a `src/lib/constants/collections.ts` + Functions. */
export const MULTIPLAYER_COLLECTIONS = {
  rooms: "game_rooms",
  invites: "game_invites",
  queue: "matchmaking_queue",
  slots: "multiplayer_slots",
} as const;
