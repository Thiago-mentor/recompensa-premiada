import type { Timestamp } from "./firestore";

export type FraudLogType =
  | "claim_rapido"
  | "ads_irregular"
  | "spam_partidas"
  | "conta_suspeita"
  | "loop_ganho"
  | "referral_abuso"
  | "progresso_invalido"
  | "cooldown_violation"
  | "match_rate_limit"
  | "admin_update_user_fraud_state"
  | (string & {});

export type FraudSeverity = "baixa" | "media" | "alta" | (string & {});

/** `fraud_logs/{logId}` */
export interface FraudLog {
  id: string;
  uid: string;
  tipo: FraudLogType;
  severidade: FraudSeverity;
  detalhes: Record<string, unknown>;
  origem: "client" | "function" | "admin" | "finalizeMatch" | (string & {});
  timestamp: Timestamp;
}
