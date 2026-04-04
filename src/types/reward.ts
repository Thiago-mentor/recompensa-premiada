import type { Timestamp } from "./firestore";

export type RewardClaimStatus = "pendente" | "aprovado" | "recusado";

export type RewardClaimTipo = "pix" | "voucher" | "outro";

/** `reward_claims/{id}` */
export interface RewardClaim {
  id: string;
  userId: string;
  valor: number;
  tipo: RewardClaimTipo;
  chavePix: string;
  status: RewardClaimStatus;
  analisadoPor: string | null;
  motivoRecusa: string | null;
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
}
