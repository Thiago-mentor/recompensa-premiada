import type { Timestamp } from "./firestore";

/** `referrals/{id}` — convite rastreado */
export interface ReferralRecord {
  id: string;
  codigo: string;
  indicadorUid: string;
  convidadoUid: string;
  etapa: "registrado" | "acao_minima" | "bonificado";
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
}
