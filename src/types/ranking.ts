import type { Timestamp } from "./firestore";

export type RankingPeriod = "diario" | "semanal" | "mensal";

/** Documento agregado por período (opcional) */
export interface RankingPeriodMeta {
  periodoChave: string;
  tipo: RankingPeriod;
  fechadoEm: Timestamp | null;
}

/** Entrada de leaderboard — doc em subcoleção ou coleção dedicada */
export interface RankingEntry {
  uid: string;
  nome: string;
  foto: string | null;
  score: number;
  partidas: number;
  vitorias: number;
  posicao?: number;
  atualizadoEm: Timestamp;
}
