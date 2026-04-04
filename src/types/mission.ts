import type { Timestamp } from "./firestore";

export type MissionType = "diaria" | "semanal" | "evento";

export type MissionCategory =
  | "login"
  | "ads"
  | "jogos"
  | "social"
  | "streak"
  | "loja"
  | "especial";

/** Template em `missions/{missionId}` */
export interface MissionTemplate {
  id: string;
  titulo: string;
  descricao: string;
  tipo: MissionType;
  /** Meta numérica (ex.: 3 anúncios) */
  meta: number;
  recompensaCoins: number;
  recompensaGems: number;
  recompensaXP: number;
  ativa: boolean;
  ordem: number;
  icone: string;
  categoria: MissionCategory;
  /** Identificador lógico para progresso server-side */
  eventKey: string;
}

/** Progresso em `userMissions/{uid}/daily|weekly/{missionId}` */
export interface UserMissionProgress {
  missionId: string;
  progresso: number;
  concluida: boolean;
  recompensaResgatada: boolean;
  atualizadoEm: Timestamp;
  periodoChave: string;
}
