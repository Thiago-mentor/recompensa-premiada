import type { Timestamp } from "./firestore";

export type RewardClaimStatus = "pendente" | "aprovado" | "confirmado" | "recusado";

export type RewardClaimTipo = "pix" | "voucher" | "outro";

/** `reward_claims/{id}` */
export interface RewardClaim {
  id: string;
  userId: string;
  valor: number;
  tipo: RewardClaimTipo;
  chavePix: string;
  status: RewardClaimStatus;
  /** Se true, o saldo já foi retido no pedido; aprovação não debita de novo; recusa estorna. */
  retencaoAplicada?: boolean;
  /** URL do comprovante (HTTPS) após admin confirmar o PIX. */
  comprovanteUrl?: string | null;
  confirmadoPor?: string | null;
  confirmadoEm?: Timestamp | null;
  analisadoPor: string | null;
  motivoRecusa: string | null;
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
}
