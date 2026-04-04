import type { Timestamp } from "./firestore";

export type AdEventStatus =
  | "solicitado"
  | "exibido"
  | "concluido"
  | "recompensado"
  | "invalido";

/** `ad_events/{id}` */
export interface AdEvent {
  id: string;
  userId: string;
  status: AdEventStatus;
  placementId: string;
  mock: boolean;
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
}
