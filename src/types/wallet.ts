import type { Timestamp } from "./firestore";

export type WalletTransactionType =
  | "missao"
  | "streak"
  | "anuncio"
  | "bau"
  | "vitoria"
  | "derrota"
  | "jogo"
  | "jogo_pvp"
  | "compra"
  | "bonus_admin"
  | "ranking"
  | "referral"
  | "ajuste"
  | "resgate"
  | "resgate_pendente"
  | "conversao";

export type WalletCurrency = "coins" | "gems" | "rewardBalance";

/** `wallet_transactions/{id}` */
export interface WalletTransaction {
  id: string;
  userId: string;
  tipo: WalletTransactionType;
  moeda: WalletCurrency;
  valor: number;
  saldoApos: number;
  descricao: string;
  referenciaId: string | null;
  criadoEm: Timestamp;
}
