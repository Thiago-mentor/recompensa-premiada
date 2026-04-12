import type { Timestamp } from "./firestore";

export type GameId =
  | "ppt"
  | "quiz"
  | "reaction_tap"
  | "numero_secreto"
  | "roleta"
  | "bau";

/** `games/{gameId}` metadados */
export interface GameDefinition {
  id: GameId;
  nome: string;
  descricao: string;
  custoEntradaCoins: number;
  cooldownSegundos: number;
  ativo: boolean;
  ordem: number;
}

/** `matches/{matchId}` — modelo alinhado ao backend (Cloud Functions). */
export interface MatchRecord {
  id: string;
  gameId: GameId;
  /** Igual a gameId em documentos novos */
  gameType?: GameId;
  userId: string;
  opponentId?: string | null;
  clanIdAtEvent?: string | null;
  resultado: "vitoria" | "derrota" | "empate";
  /** Alias legível em inglês (espelho de resultado) */
  result?: "vitoria" | "derrota" | "empate";
  /** Score normalizado (0–1000) */
  score: number;
  rewardCoins?: number;
  rankingPoints?: number;
  startedAt?: Timestamp | null;
  finishedAt?: Timestamp | null;
  metadata?: Record<string, unknown>;
  detalhes: Record<string, unknown>;
  antiSpamToken: string | null;
  criadoEm: Timestamp;
}
