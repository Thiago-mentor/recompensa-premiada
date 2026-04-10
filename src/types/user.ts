import type { Timestamp } from "./firestore";

/** Nível de risco anti-fraude */
export type FraudRiskLevel = "baixo" | "medio" | "alto";

/**
 * Perfil do usuário em `users/{uid}` — alinhado ao modelo solicitado.
 * Campos sensíveis (saldos, ranking) só devem ser alterados no backend.
 */
export interface UserProfile {
  uid: string;
  nome: string;
  email: string | null;
  foto: string | null;
  /** @unique index planejado */
  username: string;
  codigoConvite: string;
  convidadoPor: string | null;
  invitedByCode?: string | null;
  invitedAt?: Timestamp | null;
  referralStatus?: "pending" | "valid" | "rewarded" | "blocked" | "invalid" | null;
  /** PR — vitórias e economia dos jogos (exibido como “PR”). */
  coins: number;
  /** TICKET — sorteios / entradas (exibido como “TICKET”; campo Firestore legado `gems`). */
  gems: number;
  /** CASH — pontos para saque; conversão em reais (R$) só no fluxo de resgate, via taxa definida por vocês. */
  rewardBalance: number;
  xp: number;
  /** Fragmentos de crafting / upgrades futuros, concedidos por baús e eventos. */
  fragments?: number;
  /** Minutos de boost armazenados para uso futuro. */
  storedBoostMinutes?: number;
  /** Quando o boost de PR ativo termina; null/ausente = sem boost em execução. */
  activeBoostUntil?: Timestamp | null;
  /** Créditos raros para entradas especiais / jackpots futuros. */
  superPrizeEntries?: number;
  level: number;
  streakAtual: number;
  melhorStreak: number;
  ultimaEntradaEm: Timestamp | null;
  dailyLoginCount?: number;
  totalAdsAssistidos: number;
  totalPartidas: number;
  totalVitorias: number;
  totalDerrotas: number;
  scoreRankingDiario: number;
  scoreRankingSemanal: number;
  scoreRankingMensal: number;
  banido: boolean;
  riscoFraude: FraudRiskLevel;
  /** Indicação validada (ex.: convidado cumpriu ação mínima) */
  referralBonusGranted?: boolean;
  referralPendingCount?: number;
  referralQualifiedCount?: number;
  referralRewardedCount?: number;
  referralBlockedCount?: number;
  referralInvitedCount?: number;
  referralTotalEarnedCoins?: number;
  referralTotalEarnedGems?: number;
  referralTotalEarnedRewardBalance?: number;
  referralInvitedRewardCoins?: number;
  referralInvitedRewardGems?: number;
  referralInvitedRewardBalance?: number;
  totalMissionRewardsClaimed?: number;
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
  /** Timestamps de fim de cooldown por `gameId` (Cloud Functions). */
  gameCooldownUntil?: Record<string, Timestamp | unknown>;
  matchBurst?: { windowStart: Timestamp; count: number };
  /** Duelos PPT restantes antes de assistir anúncio (escrita só no servidor). */
  pptPvPDuelsRemaining?: number;
  /** Quando (Firestore) os duelos podem voltar a 3 só com o tempo (10 min). */
  pptPvpDuelsRefillAvailableAt?: Timestamp | null;
  /** Duelos Quiz restantes antes de assistir anúncio (escrita só no servidor). */
  quizPvPDuelsRemaining?: number;
  /** Quando (Firestore) os duelos de Quiz podem voltar a 3 só com o tempo (10 min). */
  quizPvpDuelsRefillAvailableAt?: Timestamp | null;
  /** Duelos Reaction Tap restantes antes de assistir anúncio (escrita só no servidor). */
  reactionPvPDuelsRemaining?: number;
  /** Quando (Firestore) os duelos de Reaction podem voltar a 3 só com o tempo (10 min). */
  reactionPvpDuelsRefillAvailableAt?: Timestamp | null;
}

/** Payload permitido na criação inicial (cliente ou função) */
export type UserProfileCreateInput = Pick<
  UserProfile,
  "uid" | "nome" | "email" | "foto" | "username" | "codigoConvite" | "convidadoPor"
>;
