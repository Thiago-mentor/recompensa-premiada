import type { Timestamp } from "./firestore";
import type { GameId } from "./game";

export type RankingPeriod = "diario" | "semanal" | "mensal";
export type RankingScope = "global" | "game";
export type ArenaOverallRankingKey = "general" | Extract<GameId, "ppt" | "quiz" | "reaction_tap">;

export interface RankingRewardPreview {
  coins?: number;
  gems?: number;
  rewardBalance?: number;
}

/** Documento agregado por período (opcional) */
export interface RankingPeriodMeta {
  periodoChave: string;
  tipo: RankingPeriod;
  scope?: RankingScope;
  gameId?: string | null;
  gameTitle?: string | null;
  prizeProcessedAt?: Timestamp | null;
  atualizadoEm?: Timestamp | null;
  fechadoEm: Timestamp | null;
}

/** Entrada de leaderboard — doc em subcoleção ou coleção dedicada */
export interface RankingEntry {
  uid: string;
  nome: string;
  username?: string | null;
  foto: string | null;
  score: number;
  partidas: number;
  vitorias: number;
  posicao?: number;
  scope?: RankingScope;
  gameId?: string | null;
  gameTitle?: string | null;
  premioPrevisto?: RankingRewardPreview | null;
  atualizadoEm: Timestamp;
}

export interface ArenaOverallRankingBucket {
  entries: RankingEntry[];
  myEntry: RankingEntry | null;
  myPosition: number | null;
}

export interface ArenaOverallRankingResponse {
  ok: boolean;
  general: ArenaOverallRankingBucket;
  byGame: Record<Extract<GameId, "ppt" | "quiz" | "reaction_tap">, ArenaOverallRankingBucket>;
}
