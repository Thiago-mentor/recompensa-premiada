import type { Timestamp } from "./firestore";
import type { GrantedChestSummary } from "./chest";
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
  /** Quiz PvP */
  quizHostScore?: number;
  quizGuestScore?: number;
  quizTargetScore?: number;
  quizRound?: number;
  quizQuestionId?: string;
  quizQuestionText?: string;
  quizOptions?: string[];
  /** UIDs que já responderam a questão atual. */
  quizAnsweredUids?: string[];
  quizLastHostAnswerIndex?: number | null;
  quizLastGuestAnswerIndex?: number | null;
  quizLastHostCorrect?: boolean;
  quizLastGuestCorrect?: boolean;
  quizLastHostResponseMs?: number | null;
  quizLastGuestResponseMs?: number | null;
  quizLastRoundWinner?: "host" | "guest" | "draw";
  /** Rodada recém-resolvida: opções e índice correto (para exibir a resposta certa em verde). */
  quizLastRevealOptions?: string[];
  quizLastRevealCorrectIndex?: number;
  /** Enunciado da questão da revelação (a rodada que acabou; evita misturar com a próxima pergunta). */
  quizLastRevealQuestionText?: string;
  quizMatchWinner?: "host" | "guest";
  quizOutcome?: "host_win" | "guest_win" | "draw";
  quizRewardsApplied?: boolean;
  /** Reaction Tap PvP */
  reactionHostScore?: number;
  reactionGuestScore?: number;
  reactionTargetScore?: number;
  reactionRound?: number;
  reactionGoLiveAt?: Timestamp;
  reactionAnsweredUids?: string[];
  reactionHostMs?: number | null;
  reactionGuestMs?: number | null;
  reactionHostFalseStart?: boolean;
  reactionGuestFalseStart?: boolean;
  reactionLastRoundWinner?: "host" | "guest" | "draw";
  reactionMatchWinner?: "host" | "guest";
  /** Legado / resumo rápido da última rodada. */
  reactionWinner?: "host" | "guest" | "draw";
  reactionOutcome?: "host_win" | "guest_win" | "draw";
  reactionRewardsApplied?: boolean;
  /** Prazo server-side da jogada/resposta atual. Ao expirar, a sala é resolvida no backend. */
  actionDeadlineAt?: Timestamp;
  /** Rodadas seguidas sem nenhuma ação dos dois lados; usado para anti-loop. */
  timeoutEmptyRounds?: number;
  /** Feedback genérico de concessão de baú no fechamento da partida PvP. */
  pvpHostGrantedChest?: GrantedChestSummary | null;
  pvpGuestGrantedChest?: GrantedChestSummary | null;
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
