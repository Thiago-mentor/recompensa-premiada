import * as admin from "firebase-admin";
import { createHash } from "node:crypto";
import { getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  FieldValue,
  Timestamp,
  type DocumentReference,
  type DocumentSnapshot,
  type Transaction,
} from "firebase-admin/firestore";
import {
  type GameId,
  type GameRewardOverrideConfig,
  GAME_COOLDOWN_SEC,
  MAX_MATCHES_PER_MINUTE,
  resolveMatchEconomy,
} from "./gameEconomy";
import { normalizeStreakTable, resolveStreakRewardForDay } from "./streakEconomy";
import { getQuizQuestionById, pickQuizQuestion } from "./quizQuestions";

admin.initializeApp();

const firestoreDbId = process.env.FIRESTORE_DATABASE_ID?.trim();
const db =
  firestoreDbId && firestoreDbId !== "(default)"
    ? getFirestore(getApp(), firestoreDbId)
    : getFirestore(getApp());

const COL = {
  users: "users",
  referrals: "referrals",
  referralCampaigns: "referral_campaigns",
  referralRankingsDaily: "referral_rankings_daily",
  referralRankingsWeekly: "referral_rankings_weekly",
  referralRankingsMonthly: "referral_rankings_monthly",
  referralRankingsAllTime: "referral_rankings_alltime",
  missions: "missions",
  userMissions: "userMissions",
  wallet: "wallet_transactions",
  matches: "matches",
  adEvents: "ad_events",
  fraudLogs: "fraud_logs",
  systemConfigs: "system_configs",
  rewardClaims: "reward_claims",
  rankingsDaily: "rankings_daily",
  rankingsWeekly: "rankings_weekly",
  rankingsMonthly: "rankings_monthly",
  matchmakingQueue: "matchmaking_queue",
  gameRooms: "game_rooms",
  multiplayerSlots: "multiplayer_slots",
} as const;

const AUTO_QUEUE_GAMES = new Set<GameId>(["ppt", "quiz", "reaction_tap"]);
const RANKING_GAME_IDS: GameId[] = ["ppt", "quiz", "reaction_tap", "roleta", "bau", "numero_secreto"];
const GAME_TITLES: Record<GameId, string> = {
  ppt: "Pedra, papel e tesoura",
  quiz: "Quiz rápido 1x1",
  reaction_tap: "Reaction tap",
  roleta: "Roleta de PR",
  bau: "Baú com cooldown",
  numero_secreto: "Número secreto",
};

/** PPT em sala: primeiro a chegar nesta pontuação vence a partida (cada rodada sem empate = 1 ponto). */
const PPT_MATCH_TARGET_POINTS = 5;
const QUIZ_MATCH_TARGET_POINTS = 5;
const REACTION_MATCH_TARGET_POINTS = 5;
const QUIZ_RESPONSE_MS_CAP = 30_000;

const DEFAULT_PVP_CHOICE_SEC = { ppt: 10, quiz: 10, reaction_tap: 10 } as const;

function clampPvpChoiceSec(raw: unknown, fallback: number): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(120, Math.max(3, n));
}

function parsePvpChoiceSecondsFromDoc(d: Record<string, unknown>): {
  ppt: number;
  quiz: number;
  reaction_tap: number;
} {
  const pcs = d.pvpChoiceSeconds;
  const o = pcs && typeof pcs === "object" ? (pcs as Record<string, unknown>) : {};
  return {
    ppt: clampPvpChoiceSec(o.ppt, DEFAULT_PVP_CHOICE_SEC.ppt),
    quiz: clampPvpChoiceSec(o.quiz, DEFAULT_PVP_CHOICE_SEC.quiz),
    reaction_tap: clampPvpChoiceSec(o.reaction_tap, DEFAULT_PVP_CHOICE_SEC.reaction_tap),
  };
}

function pvpChoiceWindowMs(
  secs: { ppt: number; quiz: number; reaction_tap: number },
  gameId: GameId,
): number {
  const s =
    gameId === "ppt"
      ? secs.ppt
      : gameId === "quiz"
        ? secs.quiz
        : gameId === "reaction_tap"
          ? secs.reaction_tap
          : secs.ppt;
  return s * 1000;
}

function pvpActionDeadlineTs(fromMs: number, windowMs: number): Timestamp {
  return Timestamp.fromMillis(fromMs + windowMs);
}
const REACTION_WAIT_MIN_MS = 1800;
const REACTION_WAIT_MAX_MS = 3400;
const REACTION_RESPONSE_MS_CAP = 9999;
const REACTION_FALSE_START_MS = 9999;
const REACTION_TIE_MS = 18;

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

const MULTIPLAYER_FUNCTIONS_REGION = process.env.FUNCTIONS_REGION?.trim() || "southamerica-east1";
const MULTIPLAYER_FUNCTIONS_MIN_INSTANCES = readPositiveIntEnv(
  "MULTIPLAYER_FUNCTIONS_MIN_INSTANCES",
  0,
);
const APP_CHECK_ENFORCED =
  process.env.ENFORCE_APP_CHECK === "true" &&
  process.env.FUNCTIONS_EMULATOR !== "true" &&
  !process.env.FIREBASE_AUTH_EMULATOR_HOST;
const MULTIPLAYER_CALLABLE_OPTS = {
  region: MULTIPLAYER_FUNCTIONS_REGION,
  minInstances: MULTIPLAYER_FUNCTIONS_MIN_INSTANCES,
  enforceAppCheck: APP_CHECK_ENFORCED,
} as const;

/** Callables gerais (perfil, login, etc.) — mesma região do cliente (`NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION`). */
const DEFAULT_CALLABLE_OPTS = {
  region: MULTIPLAYER_FUNCTIONS_REGION,
  enforceAppCheck: APP_CHECK_ENFORCED,
} as const;

/** Duelos PvP PPT antes de precisar de anúncio (só o servidor altera). */
const PPT_DEFAULT_DUEL_CHARGES = 3;
const PPT_DUEL_CHARGES_PER_AD = 3;
/** Teto para evitar acúmulo absurdo; ajuste se quiser. */
const PPT_DUEL_CHARGES_MAX_STACK = 30;
/** Após zerar duelos, recupera 3 sem anúncio quando este prazo passar (servidor). */
const PPT_DUEL_TIME_REFILL_MS = 10 * 60 * 1000;
/** Anúncio recompensado: `placementId` que libera duelos (validado na Function). */
const PPT_PVP_DUELS_PLACEMENT_ID = "ppt_pvp_duels";
const QUIZ_DEFAULT_DUEL_CHARGES = 3;
const QUIZ_DUEL_CHARGES_PER_AD = 3;
const QUIZ_DUEL_CHARGES_MAX_STACK = 30;
const QUIZ_DUEL_TIME_REFILL_MS = 10 * 60 * 1000;
const QUIZ_PVP_DUELS_PLACEMENT_ID = "quiz_pvp_duels";
const REACTION_DEFAULT_DUEL_CHARGES = 3;
const REACTION_DUEL_CHARGES_PER_AD = 3;
const REACTION_DUEL_CHARGES_MAX_STACK = 30;
const REACTION_DUEL_TIME_REFILL_MS = 10 * 60 * 1000;
const REACTION_PVP_DUELS_PLACEMENT_ID = "reaction_pvp_duels";
const HOME_REWARDED_PLACEMENT_ID = "home_rewarded";
const ALLOWED_REWARDED_AD_PLACEMENTS = new Set<string>([
  HOME_REWARDED_PLACEMENT_ID,
  PPT_PVP_DUELS_PLACEMENT_ID,
  QUIZ_PVP_DUELS_PLACEMENT_ID,
  REACTION_PVP_DUELS_PLACEMENT_ID,
]);
const REWARDED_AD_MOCK_PREFIX = "mock_";
const REWARDED_AD_TOKEN_MIN_LEN = 16;
const REWARDED_AD_TOKEN_MAX_LEN = 256;
const rewardAdMockAllowed =
  process.env.ALLOW_REWARDED_AD_MOCK === "true" ||
  process.env.FUNCTIONS_EMULATOR === "true" ||
  Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

function readPptDuelCharges(data: Record<string, unknown> | undefined): number {
  if (!data) return PPT_DEFAULT_DUEL_CHARGES;
  /** Sem campo no doc (perfis antigos): trata como estoque cheio. Com campo, usa o valor real (≥0). */
  if (!Object.prototype.hasOwnProperty.call(data, "pptPvPDuelsRemaining")) {
    return PPT_DEFAULT_DUEL_CHARGES;
  }
  const raw = data.pptPvPDuelsRemaining;
  if (raw === null || raw === undefined) {
    return PPT_DEFAULT_DUEL_CHARGES;
  }
  const v = Number(raw);
  if (!Number.isFinite(v)) return PPT_DEFAULT_DUEL_CHARGES;
  return Math.min(PPT_DUEL_CHARGES_MAX_STACK, Math.max(0, Math.floor(v)));
}

function readReactionDuelCharges(data: Record<string, unknown> | undefined): number {
  if (!data) return REACTION_DEFAULT_DUEL_CHARGES;
  if (!Object.prototype.hasOwnProperty.call(data, "reactionPvPDuelsRemaining")) {
    return REACTION_DEFAULT_DUEL_CHARGES;
  }
  const raw = data.reactionPvPDuelsRemaining;
  if (raw === null || raw === undefined) {
    return REACTION_DEFAULT_DUEL_CHARGES;
  }
  const v = Number(raw);
  if (!Number.isFinite(v)) return REACTION_DEFAULT_DUEL_CHARGES;
  return Math.min(REACTION_DUEL_CHARGES_MAX_STACK, Math.max(0, Math.floor(v)));
}

function readQuizDuelCharges(data: Record<string, unknown> | undefined): number {
  if (!data) return QUIZ_DEFAULT_DUEL_CHARGES;
  if (!Object.prototype.hasOwnProperty.call(data, "quizPvPDuelsRemaining")) {
    return QUIZ_DEFAULT_DUEL_CHARGES;
  }
  const raw = data.quizPvPDuelsRemaining;
  if (raw === null || raw === undefined) {
    return QUIZ_DEFAULT_DUEL_CHARGES;
  }
  const v = Number(raw);
  if (!Number.isFinite(v)) return QUIZ_DEFAULT_DUEL_CHARGES;
  return Math.min(QUIZ_DUEL_CHARGES_MAX_STACK, Math.max(0, Math.floor(v)));
}

function readQuizTargetScore(data: Record<string, unknown> | undefined): number {
  if (!data) return QUIZ_MATCH_TARGET_POINTS;
  const v = Number(data.quizTargetScore);
  if (!Number.isFinite(v)) return QUIZ_MATCH_TARGET_POINTS;
  return Math.max(QUIZ_MATCH_TARGET_POINTS, Math.floor(v));
}

/** Com 0 duelos e prazo vencido: recarrega 3 e remove o campo. */
async function ensurePptChargesRefilledInTx(
  tx: Transaction,
  userRef: DocumentReference,
  snap: DocumentSnapshot,
): Promise<number> {
  if (!snap.exists) return 0;
  const d = snap.data() as Record<string, unknown>;
  const c = readPptDuelCharges(d);
  if (c >= 1) return c;
  const raMs = millisFromFirestoreTime(d.pptPvpDuelsRefillAvailableAt);
  if (raMs <= 0 || Date.now() < raMs) return c;
  tx.update(userRef, {
    pptPvPDuelsRemaining: PPT_DEFAULT_DUEL_CHARGES,
    pptPvpDuelsRefillAvailableAt: FieldValue.delete(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  return PPT_DEFAULT_DUEL_CHARGES;
}

async function ensureReactionChargesRefilledInTx(
  tx: Transaction,
  userRef: DocumentReference,
  snap: DocumentSnapshot,
): Promise<number> {
  if (!snap.exists) return 0;
  const d = snap.data() as Record<string, unknown>;
  const c = readReactionDuelCharges(d);
  if (c >= 1) return c;
  const raMs = millisFromFirestoreTime(d.reactionPvpDuelsRefillAvailableAt);
  if (raMs <= 0 || Date.now() < raMs) return c;
  tx.update(userRef, {
    reactionPvPDuelsRemaining: REACTION_DEFAULT_DUEL_CHARGES,
    reactionPvpDuelsRefillAvailableAt: FieldValue.delete(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  return REACTION_DEFAULT_DUEL_CHARGES;
}

async function ensureQuizChargesRefilledInTx(
  tx: Transaction,
  userRef: DocumentReference,
  snap: DocumentSnapshot,
): Promise<number> {
  if (!snap.exists) return 0;
  const d = snap.data() as Record<string, unknown>;
  const c = readQuizDuelCharges(d);
  if (c >= 1) return c;
  const raMs = millisFromFirestoreTime(d.quizPvpDuelsRefillAvailableAt);
  if (raMs <= 0 || Date.now() < raMs) return c;
  tx.update(userRef, {
    quizPvPDuelsRemaining: QUIZ_DEFAULT_DUEL_CHARGES,
    quizPvpDuelsRefillAvailableAt: FieldValue.delete(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  return QUIZ_DEFAULT_DUEL_CHARGES;
}

/**
 * Se duelos = 0: agenda recuperação em 10 min (se ainda não houver data) ou aplica +3 se já passou.
 * Usado no join e numa callable leve para a fila mostrar o countdown.
 */
async function tryApplyPptTimedRefillForUser(uid: string): Promise<void> {
  const userRef = db.doc(`${COL.users}/${uid}`);
  await db.runTransaction(async (tx) => {
    const rs = await tx.get(userRef);
    if (!rs.exists) return;
    const d = rs.data() as Record<string, unknown>;
    const c = readPptDuelCharges(d);
    if (c >= 1) return;
    const raMs = millisFromFirestoreTime(d.pptPvpDuelsRefillAvailableAt);
    if (raMs <= 0) {
      tx.update(userRef, {
        pptPvpDuelsRefillAvailableAt: Timestamp.fromMillis(Date.now() + PPT_DUEL_TIME_REFILL_MS),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      return;
    }
    if (Date.now() >= raMs) {
      tx.update(userRef, {
        pptPvPDuelsRemaining: PPT_DEFAULT_DUEL_CHARGES,
        pptPvpDuelsRefillAvailableAt: FieldValue.delete(),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
    }
  });
}

async function tryApplyReactionTimedRefillForUser(uid: string): Promise<void> {
  const userRef = db.doc(`${COL.users}/${uid}`);
  await db.runTransaction(async (tx) => {
    const rs = await tx.get(userRef);
    if (!rs.exists) return;
    const d = rs.data() as Record<string, unknown>;
    const c = readReactionDuelCharges(d);
    if (c >= 1) return;
    const raMs = millisFromFirestoreTime(d.reactionPvpDuelsRefillAvailableAt);
    if (raMs <= 0) {
      tx.update(userRef, {
        reactionPvpDuelsRefillAvailableAt: Timestamp.fromMillis(
          Date.now() + REACTION_DUEL_TIME_REFILL_MS,
        ),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      return;
    }
    if (Date.now() >= raMs) {
      tx.update(userRef, {
        reactionPvPDuelsRemaining: REACTION_DEFAULT_DUEL_CHARGES,
        reactionPvpDuelsRefillAvailableAt: FieldValue.delete(),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
    }
  });
}

async function tryApplyQuizTimedRefillForUser(uid: string): Promise<void> {
  const userRef = db.doc(`${COL.users}/${uid}`);
  await db.runTransaction(async (tx) => {
    const rs = await tx.get(userRef);
    if (!rs.exists) return;
    const d = rs.data() as Record<string, unknown>;
    const c = readQuizDuelCharges(d);
    if (c >= 1) return;
    const raMs = millisFromFirestoreTime(d.quizPvpDuelsRefillAvailableAt);
    if (raMs <= 0) {
      tx.update(userRef, {
        quizPvpDuelsRefillAvailableAt: Timestamp.fromMillis(Date.now() + QUIZ_DUEL_TIME_REFILL_MS),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      return;
    }
    if (Date.now() >= raMs) {
      tx.update(userRef, {
        quizPvPDuelsRemaining: QUIZ_DEFAULT_DUEL_CHARGES,
        quizPvpDuelsRefillAvailableAt: FieldValue.delete(),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
    }
  });
}

function assertAuthed(uid: string | undefined): asserts uid {
  if (!uid) throw new HttpsError("unauthenticated", "Login obrigatório.");
}

async function assertAdmin(uid: string) {
  const user = await admin.auth().getUser(uid);
  if (user.customClaims?.admin !== true) {
    throw new HttpsError("permission-denied", "Apenas administradores.");
  }
}

async function getEconomy() {
  const snap = await db.doc(`${COL.systemConfigs}/economy`).get();
  const d = (snap.data() || {}) as Record<string, unknown>;
  const rawOverrides =
    d.matchRewardOverrides && typeof d.matchRewardOverrides === "object"
      ? (d.matchRewardOverrides as Record<string, Record<string, unknown>>)
      : {};
  const rawBuy = Math.floor(Number(d.conversionCoinsPerGemBuy));
  const rawSell = Math.floor(Number(d.conversionCoinsPerGemSell));
  const rawCash = Math.floor(Number(d.cashPointsPerReal));
  return {
    rewardAdCoinAmount: typeof d.rewardAdCoinAmount === "number" ? d.rewardAdCoinAmount : 25,
    dailyLoginBonus: typeof d.dailyLoginBonus === "number" ? d.dailyLoginBonus : 50,
    limiteDiarioAds: typeof d.limiteDiarioAds === "number" ? d.limiteDiarioAds : 20,
    welcomeBonus: typeof d.welcomeBonus === "number" ? d.welcomeBonus : 100,
    referralBonusIndicador:
      typeof d.referralBonusIndicador === "number" ? d.referralBonusIndicador : 200,
    referralBonusConvidado:
      typeof d.referralBonusConvidado === "number" ? d.referralBonusConvidado : 100,
    matchRewardOverrides: normalizeMatchRewardOverrides(rawOverrides),
    rankingPrizes: normalizeRankingPrizeConfig(d.rankingPrizes),
    streakTable: normalizeStreakTable(d.streakTable),
    pvpChoiceSeconds: parsePvpChoiceSecondsFromDoc(d),
    /** PR por ticket ao comprar TICKET com PR (mín. 1). */
    conversionCoinsPerGemBuy: Number.isFinite(rawBuy) && rawBuy >= 1 ? rawBuy : 500,
    /** PR por ticket ao vender TICKET; 0 = desligado. */
    conversionCoinsPerGemSell: Number.isFinite(rawSell) && rawSell >= 0 ? rawSell : 0,
    /** Pontos CASH por R$ 1,00 (ex.: 100 → 100 pts = R$ 1). */
    cashPointsPerReal: Number.isFinite(rawCash) && rawCash >= 1 ? rawCash : 100,
  };
}

function normalizeRewardOverride(value: Record<string, unknown> | undefined): GameRewardOverrideConfig | undefined {
  if (!value) return undefined;
  const out: GameRewardOverrideConfig = {};
  const keys: (keyof GameRewardOverrideConfig)[] = [
    "winCoins",
    "drawCoins",
    "lossCoins",
    "winRankingPoints",
    "drawRankingPoints",
    "lossRankingPoints",
  ];
  for (const key of keys) {
    const n = Number(value[key]);
    if (Number.isFinite(n) && n >= 0) {
      out[key] = Math.floor(n);
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeMatchRewardOverrides(raw: Record<string, Record<string, unknown>>) {
  return {
    ppt: normalizeRewardOverride(raw.ppt),
    quiz: normalizeRewardOverride(raw.quiz),
    reaction_tap: normalizeRewardOverride(raw.reaction_tap),
  } as Partial<Record<GameId, GameRewardOverrideConfig>>;
}

function dailyKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
function weeklyKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+t - +yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function monthlyKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function rankingCollectionForPeriod(period: RankingPeriodMode): string {
  switch (period) {
    case "diario":
      return COL.rankingsDaily;
    case "semanal":
      return COL.rankingsWeekly;
    case "mensal":
    default:
      return COL.rankingsMonthly;
  }
}

function rankingKeyForPeriod(period: RankingPeriodMode, when = new Date()): string {
  switch (period) {
    case "diario":
      return dailyKey(when);
    case "semanal":
      return weeklyKey(when);
    case "mensal":
    default:
      return monthlyKey(when);
  }
}

function rankingScoreFieldForPeriod(period: RankingPeriodMode): "scoreRankingDiario" | "scoreRankingSemanal" | "scoreRankingMensal" {
  return period === "diario"
    ? "scoreRankingDiario"
    : period === "semanal"
      ? "scoreRankingSemanal"
      : "scoreRankingMensal";
}

function rankingReferenceDateForClose(period: RankingPeriodMode, when = new Date()): Date {
  if (period === "mensal") return new Date(when.getTime() - 60_000);
  return new Date(when.getTime() - 1_000);
}

function referralAllTimeKey() {
  return "global";
}

type ReferralStatus = "pending" | "valid" | "rewarded" | "blocked" | "invalid";
type ReferralRankingPeriod = "daily" | "weekly" | "monthly" | "all";
type RankingPeriodMode = "diario" | "semanal" | "mensal";
type RewardCurrency = "coins" | "gems" | "rewardBalance";
type RewardValue = { amount: number; currency: RewardCurrency };
type RankingPrizeRewards = { coins: number; gems: number; rewardBalance: number };
type RankingPrizeTierResolved = { posicaoMax: number; rewards: RankingPrizeRewards };
type RankingPrizeConfigResolved = {
  global: Record<RankingPeriodMode, RankingPrizeTierResolved[]>;
  byGame: Partial<Record<GameId, Record<RankingPeriodMode, RankingPrizeTierResolved[]>>>;
};

type ReferralConfig = {
  enabled: boolean;
  codeRequired: boolean;
  defaultInviterRewardAmount: number;
  defaultInviterRewardCurrency: RewardCurrency;
  defaultInvitedRewardAmount: number;
  defaultInvitedRewardCurrency: RewardCurrency;
  invitedRewardEnabled: boolean;
  rankingEnabled: boolean;
  limitValidPerDay: number;
  limitRewardedPerUser: number;
  qualificationRules: {
    requireEmailVerified: boolean;
    requireProfileCompleted: boolean;
    minAdsWatched: number;
    minMatchesPlayed: number;
    minMissionRewardsClaimed: number;
  };
  antiFraudRules: {
    blockSelfReferral: boolean;
    flagBurstSignups: boolean;
    burstSignupThreshold: number;
    requireManualReviewForSuspected: boolean;
  };
  activeCampaignId: string | null;
  campaignText: string | null;
};

type ReferralCampaignResolved = {
  id: string;
  name: string;
  config: {
    inviterRewardAmount: number;
    inviterRewardCurrency: RewardCurrency;
    invitedRewardAmount: number;
    invitedRewardCurrency: RewardCurrency;
    invitedRewardEnabled: boolean;
    qualificationRules: ReferralConfig["qualificationRules"];
    rankingPrizes?: {
      daily?: Array<{ posicaoMax?: number; amount?: number; currency?: RewardCurrency; coins?: number; gems?: number }>;
      weekly?: Array<{ posicaoMax?: number; amount?: number; currency?: RewardCurrency; coins?: number; gems?: number }>;
      monthly?: Array<{ posicaoMax?: number; amount?: number; currency?: RewardCurrency; coins?: number; gems?: number }>;
      all?: Array<{ posicaoMax?: number; amount?: number; currency?: RewardCurrency; coins?: number; gems?: number }>;
    };
  };
};

function referralRankingCollection(period: ReferralRankingPeriod): string {
  switch (period) {
    case "daily":
      return COL.referralRankingsDaily;
    case "weekly":
      return COL.referralRankingsWeekly;
    case "monthly":
      return COL.referralRankingsMonthly;
    case "all":
    default:
      return COL.referralRankingsAllTime;
  }
}

function referralRankingKey(period: ReferralRankingPeriod, when = new Date()): string {
  switch (period) {
    case "daily":
      return dailyKey(when);
    case "weekly":
      return weeklyKey(when);
    case "monthly":
      return monthlyKey(when);
    case "all":
    default:
      return referralAllTimeKey();
  }
}

function isRewardCurrency(value: unknown): value is RewardCurrency {
  return value === "coins" || value === "gems" || value === "rewardBalance";
}

function normalizeRewardCurrency(value: unknown, fallback: RewardCurrency = "coins"): RewardCurrency {
  return isRewardCurrency(value) ? value : fallback;
}

function normalizePrizeTierList(raw: unknown): Array<{ posicaoMax: number; amount: number; currency: RewardCurrency }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const data = item as Record<string, unknown>;
      const amount = Math.max(0, Math.floor(Number(data.amount) || 0));
      const currency = normalizeRewardCurrency(data.currency, "coins");
      const legacyCoins = Math.max(0, Math.floor(Number(data.coins) || 0));
      const legacyGems = Math.max(0, Math.floor(Number(data.gems) || 0));

      if (amount > 0) {
        return {
          posicaoMax: Math.max(1, Math.floor(Number(data.posicaoMax) || 0)),
          amount,
          currency,
        };
      }

      if (legacyCoins > 0) {
        return {
          posicaoMax: Math.max(1, Math.floor(Number(data.posicaoMax) || 0)),
          amount: legacyCoins,
          currency: "coins" as const,
        };
      }

      return {
        posicaoMax: Math.max(1, Math.floor(Number(data.posicaoMax) || 0)),
        amount: legacyGems,
        currency: "gems" as const,
      };
    })
    .filter((item) => item.posicaoMax >= 1 && item.amount > 0)
    .sort((a, b) => a.posicaoMax - b.posicaoMax);
}

function emptyRankingPrizeRewards(): RankingPrizeRewards {
  return { coins: 0, gems: 0, rewardBalance: 0 };
}

function hasRankingPrizeRewards(rewards: RankingPrizeRewards): boolean {
  return rewards.coins + rewards.gems + rewards.rewardBalance > 0;
}

function emptyRankingPeriodPrizeConfig(): Record<RankingPeriodMode, RankingPrizeTierResolved[]> {
  return { diario: [], semanal: [], mensal: [] };
}

const DEFAULT_GLOBAL_RANKING_PRIZES = {
  diario: [
    { posicaoMax: 1, rewards: { coins: 500, gems: 25, rewardBalance: 0 } },
    { posicaoMax: 3, rewards: { coins: 250, gems: 10, rewardBalance: 0 } },
    { posicaoMax: 10, rewards: { coins: 100, gems: 5, rewardBalance: 0 } },
  ],
  semanal: [
    { posicaoMax: 1, rewards: { coins: 1500, gems: 60, rewardBalance: 30 } },
    { posicaoMax: 3, rewards: { coins: 800, gems: 30, rewardBalance: 15 } },
    { posicaoMax: 10, rewards: { coins: 300, gems: 10, rewardBalance: 5 } },
  ],
  mensal: [
    { posicaoMax: 1, rewards: { coins: 5000, gems: 150, rewardBalance: 150 } },
    { posicaoMax: 3, rewards: { coins: 2500, gems: 70, rewardBalance: 70 } },
    { posicaoMax: 10, rewards: { coins: 1000, gems: 25, rewardBalance: 20 } },
  ],
} satisfies Record<RankingPeriodMode, RankingPrizeTierResolved[]>;

function normalizeRankingPrizeTierList(raw: unknown): RankingPrizeTierResolved[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const data = item as Record<string, unknown>;
      const rewards = emptyRankingPrizeRewards();
      rewards.coins = Math.max(0, Math.floor(Number(data.coins) || 0));
      rewards.gems = Math.max(0, Math.floor(Number(data.gems) || 0));
      rewards.rewardBalance = Math.max(0, Math.floor(Number(data.rewardBalance) || 0));

      const amount = Math.max(0, Math.floor(Number(data.amount) || 0));
      if (!hasRankingPrizeRewards(rewards) && amount > 0) {
        const currency = normalizeRewardCurrency(data.currency, "coins");
        rewards[currency] = amount;
      }

      return {
        posicaoMax: Math.max(1, Math.floor(Number(data.posicaoMax) || 0)),
        rewards,
      };
    })
    .filter((item) => item.posicaoMax >= 1 && hasRankingPrizeRewards(item.rewards))
    .sort((a, b) => a.posicaoMax - b.posicaoMax);
}

function normalizeRankingPrizeConfig(raw: unknown): RankingPrizeConfigResolved {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const globalSource =
    data.global && typeof data.global === "object"
      ? (data.global as Record<string, unknown>)
      : data;
  const byGameSource =
    data.byGame && typeof data.byGame === "object"
      ? (data.byGame as Record<string, unknown>)
      : {};

  const global = {
    diario: normalizeRankingPrizeTierList(globalSource.diario),
    semanal: normalizeRankingPrizeTierList(globalSource.semanal),
    mensal: normalizeRankingPrizeTierList(globalSource.mensal),
  };
  if (global.diario.length === 0) global.diario = DEFAULT_GLOBAL_RANKING_PRIZES.diario;
  if (global.semanal.length === 0) global.semanal = DEFAULT_GLOBAL_RANKING_PRIZES.semanal;
  if (global.mensal.length === 0) global.mensal = DEFAULT_GLOBAL_RANKING_PRIZES.mensal;

  const byGame = {} as Partial<Record<GameId, Record<RankingPeriodMode, RankingPrizeTierResolved[]>>>;
  for (const gameId of RANKING_GAME_IDS) {
    const gameSource =
      byGameSource[gameId] && typeof byGameSource[gameId] === "object"
        ? (byGameSource[gameId] as Record<string, unknown>)
        : {};
    const normalized = {
      diario: normalizeRankingPrizeTierList(gameSource.diario),
      semanal: normalizeRankingPrizeTierList(gameSource.semanal),
      mensal: normalizeRankingPrizeTierList(gameSource.mensal),
    };
    if (normalized.diario.length || normalized.semanal.length || normalized.mensal.length) {
      byGame[gameId] = normalized;
    }
  }

  return { global, byGame };
}

function rankingPrizeTiersForScope(
  config: RankingPrizeConfigResolved,
  period: RankingPeriodMode,
  gameId?: GameId | null,
): RankingPrizeTierResolved[] {
  if (gameId) return config.byGame[gameId]?.[period] ?? [];
  return config.global[period];
}

function rankingPrizeTierForPosition(
  tiers: RankingPrizeTierResolved[],
  position: number,
): RankingPrizeTierResolved | null {
  return tiers.find((tier) => position <= tier.posicaoMax) ?? null;
}

function formatRankingRewardSummary(rewards: RankingPrizeRewards): string {
  const parts: string[] = [];
  if (rewards.coins > 0) parts.push(`${rewards.coins} PR`);
  if (rewards.gems > 0) parts.push(`${rewards.gems} TICKET`);
  if (rewards.rewardBalance > 0) parts.push(`${rewards.rewardBalance} CASH`);
  return parts.length > 0 ? parts.join(" · ") : "sem prêmio";
}

function buildReferralCodeSeed(name: string | null | undefined, username: string | null | undefined): string {
  const raw = `${username || ""}${name || ""}`.replace(/[^a-z0-9]/gi, "").toUpperCase();
  const compact = raw.slice(0, 4);
  return compact.length >= 3 ? compact : "PREM";
}

function randomReferralCode(seed: string): string {
  return `${seed}${randomCode(4)}`.slice(0, 8);
}

function avatarInitials(name: string | null | undefined): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildDefaultAvatarDataUrl(seed: string, displayName?: string | null): string {
  const palettes = [
    ["#06B6D4", "#7C3AED"],
    ["#8B5CF6", "#EC4899"],
    ["#F59E0B", "#EF4444"],
    ["#10B981", "#06B6D4"],
    ["#6366F1", "#A855F7"],
  ] as const;
  const normalizedSeed = seed.trim() || "user";
  const palette = palettes[hashString(normalizedSeed) % palettes.length];
  const initials = avatarInitials(displayName || normalizedSeed);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette[0]}" />
          <stop offset="100%" stop-color="${palette[1]}" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="32" fill="url(#g)" />
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="700">${initials}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function generateUniqueReferralCode(seed: string): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const code = randomReferralCode(seed);
    const dup = await db.collection(COL.users).where("codigoConvite", "==", code).limit(1).get();
    if (dup.empty) return code;
  }
  return `${seed.slice(0, 2)}${Date.now().toString(36).toUpperCase().slice(-6)}`.slice(0, 8);
}

async function getReferralConfig(): Promise<ReferralConfig> {
  const snap = await db.doc(`${COL.systemConfigs}/referral_system`).get();
  const d = (snap.data() || {}) as Record<string, unknown>;
  return {
    enabled: d.enabled !== false,
    codeRequired: d.codeRequired === true,
    defaultInviterRewardAmount: Math.max(
      0,
      Math.floor(Number(d.defaultInviterRewardAmount ?? d.defaultInviterRewardCoins) || 100),
    ),
    defaultInviterRewardCurrency: normalizeRewardCurrency(d.defaultInviterRewardCurrency, "coins"),
    defaultInvitedRewardAmount: Math.max(
      0,
      Math.floor(Number(d.defaultInvitedRewardAmount ?? d.defaultInvitedRewardCoins) || 50),
    ),
    defaultInvitedRewardCurrency: normalizeRewardCurrency(d.defaultInvitedRewardCurrency, "coins"),
    invitedRewardEnabled: d.invitedRewardEnabled !== false,
    rankingEnabled: d.rankingEnabled !== false,
    limitValidPerDay: Math.max(0, Math.floor(Number(d.limitValidPerDay) || 20)),
    limitRewardedPerUser: Math.max(0, Math.floor(Number(d.limitRewardedPerUser) || 500)),
    qualificationRules: {
      requireEmailVerified: d.qualificationRules && typeof d.qualificationRules === "object"
        ? (d.qualificationRules as Record<string, unknown>).requireEmailVerified === true
        : false,
      requireProfileCompleted: d.qualificationRules && typeof d.qualificationRules === "object"
        ? (d.qualificationRules as Record<string, unknown>).requireProfileCompleted !== false
        : true,
      minAdsWatched: Math.max(
        0,
        Math.floor(
          Number(
            d.qualificationRules && typeof d.qualificationRules === "object"
              ? (d.qualificationRules as Record<string, unknown>).minAdsWatched
              : 0,
          ) || 0,
        ),
      ),
      minMatchesPlayed: Math.max(
        0,
        Math.floor(
          Number(
            d.qualificationRules && typeof d.qualificationRules === "object"
              ? (d.qualificationRules as Record<string, unknown>).minMatchesPlayed
              : 1,
          ) || 1,
        ),
      ),
      minMissionRewardsClaimed: Math.max(
        0,
        Math.floor(
          Number(
            d.qualificationRules && typeof d.qualificationRules === "object"
              ? (d.qualificationRules as Record<string, unknown>).minMissionRewardsClaimed
              : 0,
          ) || 0,
        ),
      ),
    },
    antiFraudRules: {
      blockSelfReferral: d.antiFraudRules && typeof d.antiFraudRules === "object"
        ? (d.antiFraudRules as Record<string, unknown>).blockSelfReferral !== false
        : true,
      flagBurstSignups: d.antiFraudRules && typeof d.antiFraudRules === "object"
        ? (d.antiFraudRules as Record<string, unknown>).flagBurstSignups !== false
        : true,
      burstSignupThreshold: Math.max(
        1,
        Math.floor(
          Number(
            d.antiFraudRules && typeof d.antiFraudRules === "object"
              ? (d.antiFraudRules as Record<string, unknown>).burstSignupThreshold
              : 5,
          ) || 5,
        ),
      ),
      requireManualReviewForSuspected: d.antiFraudRules && typeof d.antiFraudRules === "object"
        ? (d.antiFraudRules as Record<string, unknown>).requireManualReviewForSuspected === true
        : false,
    },
    activeCampaignId: typeof d.activeCampaignId === "string" ? d.activeCampaignId : null,
    campaignText: typeof d.campaignText === "string" ? d.campaignText : null,
  };
}

async function getActiveReferralCampaign(config: ReferralConfig): Promise<ReferralCampaignResolved | null> {
  if (config.activeCampaignId) {
    const snap = await db.doc(`${COL.referralCampaigns}/${config.activeCampaignId}`).get();
    if (snap.exists) {
      const d = snap.data() as Record<string, unknown>;
      return {
        id: snap.id,
        name: String(d.name || "Campanha de indicação"),
        config: {
          inviterRewardAmount: Math.max(
            0,
            Math.floor(
              Number(
                d.config && typeof d.config === "object"
                  ? (d.config as Record<string, unknown>).inviterRewardAmount ??
                      (d.config as Record<string, unknown>).inviterRewardCoins
                  : config.defaultInviterRewardAmount,
              ) || config.defaultInviterRewardAmount,
            ),
          ),
          inviterRewardCurrency:
            d.config && typeof d.config === "object"
              ? normalizeRewardCurrency(
                  (d.config as Record<string, unknown>).inviterRewardCurrency,
                  config.defaultInviterRewardCurrency,
                )
              : config.defaultInviterRewardCurrency,
          invitedRewardAmount: Math.max(
            0,
            Math.floor(
              Number(
                d.config && typeof d.config === "object"
                  ? (d.config as Record<string, unknown>).invitedRewardAmount ??
                      (d.config as Record<string, unknown>).invitedRewardCoins
                  : config.defaultInvitedRewardAmount,
              ) || config.defaultInvitedRewardAmount,
            ),
          ),
          invitedRewardCurrency:
            d.config && typeof d.config === "object"
              ? normalizeRewardCurrency(
                  (d.config as Record<string, unknown>).invitedRewardCurrency,
                  config.defaultInvitedRewardCurrency,
                )
              : config.defaultInvitedRewardCurrency,
          invitedRewardEnabled:
            d.config && typeof d.config === "object"
              ? (d.config as Record<string, unknown>).invitedRewardEnabled !== false
              : config.invitedRewardEnabled,
          qualificationRules:
            d.config && typeof d.config === "object" && (d.config as Record<string, unknown>).qualificationRules
              ? {
                  ...config.qualificationRules,
                  ...((d.config as Record<string, unknown>).qualificationRules as Record<string, unknown>),
                }
              : config.qualificationRules,
          rankingPrizes:
            d.config && typeof d.config === "object" && (d.config as Record<string, unknown>).rankingPrizes
              ? {
                  daily: normalizePrizeTierList(((d.config as Record<string, unknown>).rankingPrizes as Record<string, unknown>).daily),
                  weekly: normalizePrizeTierList(((d.config as Record<string, unknown>).rankingPrizes as Record<string, unknown>).weekly),
                  monthly: normalizePrizeTierList(((d.config as Record<string, unknown>).rankingPrizes as Record<string, unknown>).monthly),
                  all: normalizePrizeTierList(((d.config as Record<string, unknown>).rankingPrizes as Record<string, unknown>).all),
                }
              : undefined,
        },
      };
    }
  }

  const activeSnap = await db.collection(COL.referralCampaigns).where("isActive", "==", true).limit(10).get();
  const now = Date.now();
  for (const item of activeSnap.docs) {
    const d = item.data() as Record<string, unknown>;
    const startAt = millisFromFirestoreTime(d.startAt);
    const endAt = millisFromFirestoreTime(d.endAt);
    if (startAt > 0 && now < startAt) continue;
    if (endAt > 0 && now > endAt) continue;
    return {
      id: item.id,
      name: String(d.name || "Campanha de indicação"),
      config: {
        inviterRewardAmount: Math.max(
          0,
          Math.floor(
            Number(
              d.config && typeof d.config === "object"
                ? (d.config as Record<string, unknown>).inviterRewardAmount ??
                    (d.config as Record<string, unknown>).inviterRewardCoins
                : config.defaultInviterRewardAmount,
            ) || config.defaultInviterRewardAmount,
          ),
        ),
        inviterRewardCurrency:
          d.config && typeof d.config === "object"
            ? normalizeRewardCurrency(
                (d.config as Record<string, unknown>).inviterRewardCurrency,
                config.defaultInviterRewardCurrency,
              )
            : config.defaultInviterRewardCurrency,
        invitedRewardAmount: Math.max(
          0,
          Math.floor(
            Number(
              d.config && typeof d.config === "object"
                ? (d.config as Record<string, unknown>).invitedRewardAmount ??
                    (d.config as Record<string, unknown>).invitedRewardCoins
                : config.defaultInvitedRewardAmount,
            ) || config.defaultInvitedRewardAmount,
          ),
        ),
        invitedRewardCurrency:
          d.config && typeof d.config === "object"
            ? normalizeRewardCurrency(
                (d.config as Record<string, unknown>).invitedRewardCurrency,
                config.defaultInvitedRewardCurrency,
              )
            : config.defaultInvitedRewardCurrency,
        invitedRewardEnabled:
          d.config && typeof d.config === "object"
            ? (d.config as Record<string, unknown>).invitedRewardEnabled !== false
            : config.invitedRewardEnabled,
        qualificationRules:
          d.config && typeof d.config === "object" && (d.config as Record<string, unknown>).qualificationRules
            ? {
                ...config.qualificationRules,
                ...((d.config as Record<string, unknown>).qualificationRules as Record<string, unknown>),
              }
            : config.qualificationRules,
        rankingPrizes:
          d.config && typeof d.config === "object" && (d.config as Record<string, unknown>).rankingPrizes
            ? {
                daily: normalizePrizeTierList(((d.config as Record<string, unknown>).rankingPrizes as Record<string, unknown>).daily),
                weekly: normalizePrizeTierList(((d.config as Record<string, unknown>).rankingPrizes as Record<string, unknown>).weekly),
                monthly: normalizePrizeTierList(((d.config as Record<string, unknown>).rankingPrizes as Record<string, unknown>).monthly),
                all: normalizePrizeTierList(((d.config as Record<string, unknown>).rankingPrizes as Record<string, unknown>).all),
              }
            : undefined,
      },
    };
  }
  return null;
}

async function upsertReferralRankingEntry(
  tx: Transaction,
  inviterUid: string,
  inviterName: string,
  inviterPhoto: string | null,
  deltas: { pending?: number; valid?: number; rewarded?: number; blocked?: number; rewards?: number },
) {
  const periods: ReferralRankingPeriod[] = ["daily", "weekly", "monthly", "all"];
  for (const period of periods) {
    const ref = db.doc(
      `${referralRankingCollection(period)}/${referralRankingKey(period)}/entries/${inviterUid}`,
    );
    tx.set(
      ref,
      {
        userId: inviterUid,
        userName: inviterName,
        photoURL: inviterPhoto ?? null,
        pendingReferrals: FieldValue.increment(deltas.pending ?? 0),
        validReferrals: FieldValue.increment(deltas.valid ?? 0),
        rewardedReferrals: FieldValue.increment(deltas.rewarded ?? 0),
        blockedReferrals: FieldValue.increment(deltas.blocked ?? 0),
        totalRewards: FieldValue.increment(deltas.rewards ?? 0),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
}

function randomCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function addWalletTx(input: {
  userId: string;
  tipo: string;
  moeda: "coins" | "gems" | "rewardBalance";
  valor: number;
  saldoApos: number;
  descricao: string;
  referenciaId?: string | null;
}) {
  await db.collection(COL.wallet).add({
    userId: input.userId,
    tipo: input.tipo,
    moeda: input.moeda,
    valor: input.valor,
    saldoApos: input.saldoApos,
    descricao: input.descricao,
    referenciaId: input.referenciaId ?? null,
    criadoEm: FieldValue.serverTimestamp(),
  });
}

function hashId(...parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

function addWalletTxInTx(
  tx: Transaction,
  input: {
    id: string;
    userId: string;
    tipo: string;
    moeda: "coins" | "gems" | "rewardBalance";
    valor: number;
    saldoApos: number;
    descricao: string;
    referenciaId?: string | null;
  },
) {
  tx.set(db.doc(`${COL.wallet}/${input.id}`), {
    userId: input.userId,
    tipo: input.tipo,
    moeda: input.moeda,
    valor: input.valor,
    saldoApos: input.saldoApos,
    descricao: input.descricao,
    referenciaId: input.referenciaId ?? null,
    criadoEm: FieldValue.serverTimestamp(),
  });
}

function rewardCurrencyLabel(currency: RewardCurrency): string {
  return currency === "coins" ? "PR" : currency === "gems" ? "TICKET" : "CASH";
}

function getUserBalanceByCurrency(userData: Record<string, unknown>, currency: RewardCurrency): number {
  return currency === "coins"
    ? Number(userData.coins || 0)
    : currency === "gems"
      ? Number(userData.gems || 0)
      : Number(userData.rewardBalance || 0);
}

function rewardFieldName(currency: RewardCurrency): "coins" | "gems" | "rewardBalance" {
  return currency === "coins" ? "coins" : currency === "gems" ? "gems" : "rewardBalance";
}

function applyRewardPatch(
  currentData: Record<string, unknown>,
  reward: RewardValue,
): { patch: Record<string, unknown>; balanceAfter: number } {
  const current = getUserBalanceByCurrency(currentData, reward.currency);
  return {
    patch: {
      [rewardFieldName(reward.currency)]: FieldValue.increment(reward.amount),
    },
    balanceAfter: current + reward.amount,
  };
}

function applyMultiCurrencyRewardPatch(
  currentData: Record<string, unknown>,
  rewards: RankingPrizeRewards,
): {
  patch: Record<string, unknown>;
  balancesAfter: Record<RewardCurrency, number>;
} {
  const patch: Record<string, unknown> = {};
  const balancesAfter: Record<RewardCurrency, number> = {
    coins: Number(currentData.coins || 0),
    gems: Number(currentData.gems || 0),
    rewardBalance: Number(currentData.rewardBalance || 0),
  };

  for (const currency of ["coins", "gems", "rewardBalance"] as const) {
    const amount = Math.max(0, Math.floor(Number(rewards[currency]) || 0));
    if (amount <= 0) continue;
    patch[rewardFieldName(currency)] = FieldValue.increment(amount);
    balancesAfter[currency] += amount;
  }

  return { patch, balancesAfter };
}

function referralMeetsQualification(
  rules: ReferralConfig["qualificationRules"],
  userData: Record<string, unknown>,
  emailVerified: boolean,
): boolean {
  if (rules.requireEmailVerified && !emailVerified) return false;
  if (rules.requireProfileCompleted) {
    if (!String(userData.nome || "").trim() || !String(userData.username || "").trim()) return false;
  }
  if (Number(userData.totalAdsAssistidos || 0) < rules.minAdsWatched) return false;
  if (Number(userData.totalPartidas || 0) < rules.minMatchesPlayed) return false;
  if (Number(userData.totalMissionRewardsClaimed || 0) < rules.minMissionRewardsClaimed) return false;
  return true;
}

function buildReferralProgressSnapshot(
  userData: Record<string, unknown>,
  emailVerified: boolean,
) {
  return {
    emailVerified,
    profileCompleted: Boolean(String(userData.nome || "").trim() && String(userData.username || "").trim()),
    adsWatched: Number(userData.totalAdsAssistidos || 0),
    matchesPlayed: Number(userData.totalPartidas || 0),
    missionRewardsClaimed: Number(userData.totalMissionRewardsClaimed || 0),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function evaluateReferralForUser(uid: string): Promise<void> {
  const referralRef = db.doc(`${COL.referrals}/${uid}`);
  const config = await getReferralConfig();
  if (!config.enabled) return;
  const campaign = await getActiveReferralCampaign(config);

  await db.runTransaction(async (tx) => {
    const referralSnap = await tx.get(referralRef);
    if (!referralSnap.exists) return;
    const referral = referralSnap.data() as Record<string, unknown>;
    const status = String(referral.status || "pending") as ReferralStatus;
    if (status === "blocked" || status === "invalid" || status === "rewarded") return;

    const inviterUid = String(referral.inviterUserId || "");
    const invitedUid = String(referral.invitedUserId || "");
    if (!inviterUid || !invitedUid) return;

    const [invitedSnap, inviterSnap] = await Promise.all([
      tx.get(db.doc(`${COL.users}/${invitedUid}`)),
      tx.get(db.doc(`${COL.users}/${inviterUid}`)),
    ]);
    if (!invitedSnap.exists || !inviterSnap.exists) return;

    const invitedData = invitedSnap.data() as Record<string, unknown>;
    const inviterData = inviterSnap.data() as Record<string, unknown>;
    const authUser = await admin.auth().getUser(invitedUid);
    const rules = campaign?.config.qualificationRules ?? config.qualificationRules;
    const progressSnapshot = buildReferralProgressSnapshot(invitedData, authUser.emailVerified === true);
    tx.update(referralRef, {
      qualificationSnapshot: rules,
      progressSnapshot,
      updatedAt: FieldValue.serverTimestamp(),
    });
    const isQualified = referralMeetsQualification(rules, invitedData, authUser.emailVerified === true);
    if (!isQualified) return;

    const todayReferralsSnap = await tx.get(
      db
        .collection(COL.referrals)
        .where("inviterUserId", "==", inviterUid)
        .where("status", "in", ["valid", "rewarded"])
        .where("qualifiedAt", ">=", Timestamp.fromDate(new Date(new Date().setUTCHours(0, 0, 0, 0))))
        .limit(config.limitValidPerDay + 1),
    );
    const inviterQualifiedToday = todayReferralsSnap.size;
    const totalRewarded = Number(inviterData.referralRewardedCount || 0);
    const suspicious =
      config.antiFraudRules.flagBurstSignups &&
      Number(inviterData.referralPendingCount || 0) >= config.antiFraudRules.burstSignupThreshold;

    if (config.limitValidPerDay > 0 && inviterQualifiedToday >= config.limitValidPerDay) {
      tx.update(referralRef, {
        status: "blocked",
        referralStatus: "blocked",
        updatedAt: FieldValue.serverTimestamp(),
        "fraudFlags.suspectedFraud": true,
        "fraudFlags.manualReviewRequired": true,
        notes: "Bloqueado por limite diário de indicações válidas.",
      });
      return;
    }

    if (config.limitRewardedPerUser > 0 && totalRewarded >= config.limitRewardedPerUser) {
      tx.update(referralRef, {
        status: "blocked",
        referralStatus: "blocked",
        updatedAt: FieldValue.serverTimestamp(),
        "fraudFlags.duplicateRewardBlocked": true,
        notes: "Bloqueado por limite total de recompensas do indicador.",
      });
      return;
    }

    if (config.antiFraudRules.requireManualReviewForSuspected && suspicious) {
      tx.update(referralRef, {
        status: "valid",
        referralStatus: "valid",
        referralQualified: true,
        qualifiedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        "fraudFlags.suspectedFraud": true,
        "fraudFlags.manualReviewRequired": true,
      });
      tx.update(db.doc(`${COL.users}/${invitedUid}`), {
        referralStatus: "valid",
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      tx.update(db.doc(`${COL.users}/${inviterUid}`), {
        referralQualifiedCount: FieldValue.increment(1),
        referralPendingCount: FieldValue.increment(-1),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      await upsertReferralRankingEntry(
        tx,
        inviterUid,
        String(inviterData.nome || "Jogador"),
        (inviterData.foto as string | null) ?? null,
        { pending: -1, valid: 1 },
      );
      return;
    }

    const inviterReward: RewardValue = {
      amount: Math.max(0, campaign?.config.inviterRewardAmount ?? config.defaultInviterRewardAmount),
      currency: campaign?.config.inviterRewardCurrency ?? config.defaultInviterRewardCurrency,
    };
    const invitedRewardEnabled = campaign?.config.invitedRewardEnabled ?? config.invitedRewardEnabled;
    const invitedReward: RewardValue = invitedRewardEnabled
      ? {
          amount: Math.max(
            0,
            campaign?.config.invitedRewardAmount ?? config.defaultInvitedRewardAmount,
          ),
          currency: campaign?.config.invitedRewardCurrency ?? config.defaultInvitedRewardCurrency,
        }
      : { amount: 0, currency: config.defaultInvitedRewardCurrency };
    const inviterRewardPatch = applyRewardPatch(inviterData, inviterReward);
    const invitedRewardPatch = applyRewardPatch(invitedData, invitedReward);

    tx.update(referralRef, {
      status: "rewarded",
      referralStatus: "rewarded",
      referralQualified: true,
      referralRewardGiven: true,
      qualifiedAt: FieldValue.serverTimestamp(),
      rewardedAt: FieldValue.serverTimestamp(),
      inviterRewardAmount: inviterReward.amount,
      inviterRewardCurrency: inviterReward.currency,
      invitedRewardAmount: invitedReward.amount,
      invitedRewardCurrency: invitedReward.currency,
      inviterRewardCoins: inviterReward.currency === "coins" ? inviterReward.amount : 0,
      invitedRewardCoins: invitedReward.currency === "coins" ? invitedReward.amount : 0,
      inviterRewardGrantedAt: FieldValue.serverTimestamp(),
      invitedRewardGrantedAt: invitedReward.amount > 0 ? FieldValue.serverTimestamp() : null,
      campaignId: campaign?.id ?? null,
      campaignName: campaign?.name ?? null,
      qualificationSnapshot: rules,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(db.doc(`${COL.users}/${inviterUid}`), {
      ...inviterRewardPatch.patch,
      referralPendingCount: FieldValue.increment(-1),
      referralQualifiedCount: FieldValue.increment(1),
      referralRewardedCount: FieldValue.increment(1),
      referralInvitedCount: FieldValue.increment(1),
      ...(inviterReward.currency === "coins"
        ? { referralTotalEarnedCoins: FieldValue.increment(inviterReward.amount) }
        : inviterReward.currency === "gems"
          ? { referralTotalEarnedGems: FieldValue.increment(inviterReward.amount) }
          : { referralTotalEarnedRewardBalance: FieldValue.increment(inviterReward.amount) }),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    tx.update(db.doc(`${COL.users}/${invitedUid}`), {
      ...invitedRewardPatch.patch,
      referralBonusGranted: true,
      referralStatus: "rewarded",
      ...(invitedReward.currency === "coins"
        ? { referralInvitedRewardCoins: FieldValue.increment(invitedReward.amount) }
        : invitedReward.currency === "gems"
          ? { referralInvitedRewardGems: FieldValue.increment(invitedReward.amount) }
          : { referralInvitedRewardBalance: FieldValue.increment(invitedReward.amount) }),
      atualizadoEm: FieldValue.serverTimestamp(),
    });

    addWalletTxInTx(tx, {
      id: `referral_inviter_${inviterUid}_${invitedUid}`,
      userId: inviterUid,
      tipo: "referral",
      moeda: inviterReward.currency,
      valor: inviterReward.amount,
      saldoApos: inviterRewardPatch.balanceAfter,
      descricao: `Indicação válida${campaign?.name ? ` · ${campaign.name}` : ""} · ${rewardCurrencyLabel(inviterReward.currency)}`,
      referenciaId: invitedUid,
    });
    if (invitedReward.amount > 0) {
      addWalletTxInTx(tx, {
        id: `referral_invited_${invitedUid}_${inviterUid}`,
        userId: invitedUid,
        tipo: "referral",
        moeda: invitedReward.currency,
        valor: invitedReward.amount,
        saldoApos: invitedRewardPatch.balanceAfter,
        descricao: `Bônus por convite${campaign?.name ? ` · ${campaign.name}` : ""} · ${rewardCurrencyLabel(invitedReward.currency)}`,
        referenciaId: inviterUid,
      });
    }
    await upsertReferralRankingEntry(
      tx,
      inviterUid,
      String(inviterData.nome || "Jogador"),
      (inviterData.foto as string | null) ?? null,
      { pending: -1, valid: 1, rewarded: 1, rewards: inviterReward.amount },
    );
  });
}

function parseRewardedAdCompletionToken(raw: unknown): { token: string; isMock: boolean } {
  const token = String(raw ?? "").trim();
  if (!token) {
    throw new HttpsError("invalid-argument", "Token de conclusão do anúncio é obrigatório.");
  }
  if (token.length < REWARDED_AD_TOKEN_MIN_LEN || token.length > REWARDED_AD_TOKEN_MAX_LEN) {
    throw new HttpsError("invalid-argument", "Token de anúncio inválido.");
  }
  const isMock = token.startsWith(REWARDED_AD_MOCK_PREFIX);
  if (isMock && !rewardAdMockAllowed) {
    throw new HttpsError("failed-precondition", "Mock de anúncio desabilitado neste ambiente.");
  }
  if (!isMock) {
    throw new HttpsError(
      "failed-precondition",
      "Provedor real de anúncio ainda não configurado no servidor. Use mock apenas em ambiente controlado.",
    );
  }
  return { token, isMock };
}

function millisFromCooldownField(v: unknown): number {
  if (v == null) return 0;
  if (typeof (v as Timestamp).toMillis === "function") {
    return (v as Timestamp).toMillis();
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function nextBurstState(
  u: Record<string, unknown>,
  now: number,
):
  | { ok: true; burst: { windowStart: Timestamp; count: number } }
  | { ok: false } {
  const burst = u.matchBurst as { windowStart?: Timestamp; count?: number } | undefined;
  const windowMs = 60_000;
  if (!burst?.windowStart) {
    return { ok: true, burst: { windowStart: Timestamp.fromMillis(now), count: 1 } };
  }
  const start = burst.windowStart.toMillis();
  if (now - start > windowMs) {
    return { ok: true, burst: { windowStart: Timestamp.fromMillis(now), count: 1 } };
  }
  const c = Number(burst.count || 0);
  if (c >= MAX_MATCHES_PER_MINUTE) return { ok: false };
  return { ok: true, burst: { windowStart: burst.windowStart, count: c + 1 } };
}

async function logMatchFraud(
  uid: string,
  tipo: string,
  detalhes: Record<string, unknown>,
) {
  try {
    await db.collection(COL.fraudLogs).add({
      uid,
      tipo,
      severidade: "media",
      detalhes,
      origem: "finalizeMatch",
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch {
    /* ignore */
  }
}

async function upsertRanking(input: {
  uid: string;
  nome: string;
  username?: string | null;
  foto: string | null;
  deltaScore: number;
  win: boolean;
  gameId: GameId;
}) {
  const batch = db.batch();
  const userRef = db.doc(`${COL.users}/${input.uid}`);
  batch.update(userRef, {
    scoreRankingDiario: FieldValue.increment(input.deltaScore),
    scoreRankingSemanal: FieldValue.increment(input.deltaScore),
    scoreRankingMensal: FieldValue.increment(input.deltaScore),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  const periods: { period: RankingPeriodMode; col: string; key: string }[] = [
    { period: "diario", col: COL.rankingsDaily, key: dailyKey() },
    { period: "semanal", col: COL.rankingsWeekly, key: weeklyKey() },
    { period: "mensal", col: COL.rankingsMonthly, key: monthlyKey() },
  ];
  for (const p of periods) {
    batch.set(
      db.doc(`${p.col}/${p.key}`),
      {
        periodoChave: p.key,
        tipo: p.period,
        scope: "global",
        atualizadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    const entryRef = db.doc(`${p.col}/${p.key}/entries/${input.uid}`);
    batch.set(
      entryRef,
      {
        uid: input.uid,
        nome: input.nome,
        username: input.username ?? null,
        foto: input.foto,
        score: FieldValue.increment(input.deltaScore),
        partidas: FieldValue.increment(1),
        vitorias: FieldValue.increment(input.win ? 1 : 0),
        scope: "global",
        atualizadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    batch.set(
      db.doc(`${p.col}/${p.key}/games/${input.gameId}`),
      {
        periodoChave: p.key,
        tipo: p.period,
        scope: "game",
        gameId: input.gameId,
        gameTitle: GAME_TITLES[input.gameId],
        atualizadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    batch.set(
      db.doc(`${p.col}/${p.key}/games/${input.gameId}/entries/${input.uid}`),
      {
        uid: input.uid,
        nome: input.nome,
        username: input.username ?? null,
        foto: input.foto,
        score: FieldValue.increment(input.deltaScore),
        partidas: FieldValue.increment(1),
        vitorias: FieldValue.increment(input.win ? 1 : 0),
        scope: "game",
        gameId: input.gameId,
        gameTitle: GAME_TITLES[input.gameId],
        atualizadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  await batch.commit();
}

async function syncUserPresentation(uid: string, nome: string, foto: string | null) {
  const userSnap = await db.doc(`${COL.users}/${uid}`).get();
  const username = userSnap.exists ? String(userSnap.data()?.username || "") : "";
  const batch = db.batch();
  const rankingTargets: Array<{
    ref: DocumentReference;
    payload: Record<string, unknown>;
  }> = [];
  const gameRankingPeriods: { period: RankingPeriodMode; col: string; key: string }[] = [
    { period: "diario", col: COL.rankingsDaily, key: dailyKey() },
    { period: "semanal", col: COL.rankingsWeekly, key: weeklyKey() },
    { period: "mensal", col: COL.rankingsMonthly, key: monthlyKey() },
  ];
  for (const p of gameRankingPeriods) {
    rankingTargets.push({
      ref: db.doc(`${p.col}/${p.key}/entries/${uid}`),
      payload: {
        uid,
        nome,
        username: username || null,
        foto,
        scope: "global",
        atualizadoEm: FieldValue.serverTimestamp(),
      },
    });
    for (const gameId of RANKING_GAME_IDS) {
      rankingTargets.push({
        ref: db.doc(`${p.col}/${p.key}/games/${gameId}/entries/${uid}`),
        payload: {
          uid,
          nome,
          username: username || null,
          foto,
          scope: "game",
          gameId,
          gameTitle: GAME_TITLES[gameId],
          atualizadoEm: FieldValue.serverTimestamp(),
        },
      });
    }
  }
  const rankingSnapshots = rankingTargets.length
    ? await db.getAll(...rankingTargets.map((target) => target.ref))
    : [];
  rankingTargets.forEach((target, index) => {
    if (rankingSnapshots[index]?.exists) {
      batch.set(target.ref, target.payload, { merge: true });
    }
  });

  const referralPeriods: ReferralRankingPeriod[] = ["daily", "weekly", "monthly", "all"];
  for (const period of referralPeriods) {
    batch.set(
      db.doc(`${referralRankingCollection(period)}/${referralRankingKey(period)}/entries/${uid}`),
      {
        userId: uid,
        userName: nome,
        photoURL: foto,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  await batch.commit();
}

async function bumpPlayMatchMissions(uid: string) {
  const playSnap = await db
    .collection(COL.missions)
    .where("ativa", "==", true)
    .where("eventKey", "==", "play_match")
    .get();
  for (const m of playSnap.docs) {
    const progRef = db.doc(`${COL.userMissions}/${uid}/daily/${m.id}`);
    const pSnap = await progRef.get();
    const meta = Number(m.data().meta || 1);
    const cur = pSnap.exists ? Number(pSnap.data()?.progresso || 0) : 0;
    const next = Math.min(meta, cur + 1);
    await progRef.set(
      {
        missionId: m.id,
        progresso: next,
        concluida: next >= meta,
        recompensaResgatada: pSnap.data()?.recompensaResgatada ?? false,
        atualizadoEm: FieldValue.serverTimestamp(),
        periodoChave: dailyKey(),
      },
      { merge: true },
    );
  }
}

function pptOutcomeFromHands(
  hostHand: string,
  guestHand: string,
): "host_win" | "guest_win" | "draw" {
  const beats: Record<string, string> = {
    pedra: "tesoura",
    papel: "pedra",
    tesoura: "papel",
  };
  if (hostHand === guestHand) return "draw";
  if (beats[hostHand] === guestHand) return "host_win";
  return "guest_win";
}

function millisFromFirestoreTime(v: unknown): number {
  if (v != null && typeof (v as Timestamp).toMillis === "function") {
    return (v as Timestamp).toMillis();
  }
  return 0;
}

function losingHandAgainst(winnerHand: string): "pedra" | "papel" | "tesoura" {
  if (winnerHand === "pedra") return "tesoura";
  if (winnerHand === "papel") return "pedra";
  return "papel";
}

/** Sem sinal do oponente neste intervalo → vitória de quem ainda pinga (W.O.). */
const PVP_PPT_HEARTBEAT_STALE_MS = 3 * 60 * 1000;
/** Evita W.O. logo após criar a sala (opponente ainda não mandou 1º ping). */
const PVP_PPT_GRACE_AFTER_CREATE_MS = 2 * 60 * 1000;
/**
 * Janela em que nenhum dos dois enviou jogada com a rodada “aberta” (0 em `pptPickedUids`).
 * Dois ciclos seguidos → partida anulada, slots em idle, sem recompensas.
 */
const PPT_BOTH_IDLE_NO_PICK_MS = 22_000;

async function postPptMatchRankingFromWinner(
  roomId: string,
  hostUid: string,
  guestUid: string,
  matchWinner: "host" | "guest",
  forfeitMeta?: { forfeitedByUid: string },
) {
  const hostRes: "vitoria" | "derrota" = matchWinner === "host" ? "vitoria" : "derrota";
  const guestRes: "vitoria" | "derrota" = matchWinner === "guest" ? "vitoria" : "derrota";
  const metaBase: Record<string, unknown> = {
    pvpRoomId: roomId,
    pptMatchWinner: matchWinner,
  };
  if (forfeitMeta) {
    metaBase.forfeit = true;
    metaBase.forfeitedBy = forfeitMeta.forfeitedByUid;
  }
  const economyConfig = await getEconomy();
  const ecoH = resolveMatchEconomy("ppt", hostRes, 0, metaBase, economyConfig.matchRewardOverrides);
  const ecoG = resolveMatchEconomy("ppt", guestRes, 0, metaBase, economyConfig.matchRewardOverrides);
  const [hSnap, gSnap] = await Promise.all([
    db.doc(`${COL.users}/${hostUid}`).get(),
    db.doc(`${COL.users}/${guestUid}`).get(),
  ]);
  await upsertRanking({
    uid: hostUid,
    nome: String(hSnap.data()?.nome || "Jogador"),
    username: String(hSnap.data()?.username || "") || null,
    foto: (hSnap.data()?.foto as string | null) ?? null,
    deltaScore: ecoH.rankingPoints,
    win: hostRes === "vitoria",
    gameId: "ppt",
  });
  await upsertRanking({
    uid: guestUid,
    nome: String(gSnap.data()?.nome || "Jogador"),
    username: String(gSnap.data()?.username || "") || null,
    foto: (gSnap.data()?.foto as string | null) ?? null,
    deltaScore: ecoG.rankingPoints,
    win: guestRes === "vitoria",
    gameId: "ppt",
  });
  await bumpPlayMatchMissions(hostUid);
  await bumpPlayMatchMissions(guestUid);
}

function clampQuizResponseMs(raw: unknown): number {
  const ms = Number(raw);
  if (!Number.isFinite(ms)) return QUIZ_RESPONSE_MS_CAP;
  return Math.max(0, Math.min(QUIZ_RESPONSE_MS_CAP, Math.floor(ms)));
}

/** Ponto só se um acerta e o outro erra. Ambos certos ou ambos errados → empate (sem desempate por tempo). */
function resolveQuizRoundWinner(
  hostCorrect: boolean,
  guestCorrect: boolean,
  _hostResponseMs: number,
  _guestResponseMs: number,
): "host" | "guest" | "draw" {
  if (hostCorrect && !guestCorrect) return "host";
  if (!hostCorrect && guestCorrect) return "guest";
  return "draw";
}

async function postQuizMatchRankingFromWinner(
  roomId: string,
  hostUid: string,
  guestUid: string,
  matchWinner: "host" | "guest",
  hostResponseMs: number,
  guestResponseMs: number,
) {
  const hostRes: "vitoria" | "derrota" = matchWinner === "host" ? "vitoria" : "derrota";
  const guestRes: "vitoria" | "derrota" = matchWinner === "guest" ? "vitoria" : "derrota";
  const economyConfig = await getEconomy();
  const ecoH = resolveMatchEconomy("quiz", hostRes, 0, {
    pvpRoomId: roomId,
    quizMatchWinner: matchWinner,
    responseTimeMs: hostResponseMs,
  }, economyConfig.matchRewardOverrides);
  const ecoG = resolveMatchEconomy("quiz", guestRes, 0, {
    pvpRoomId: roomId,
    quizMatchWinner: matchWinner,
    responseTimeMs: guestResponseMs,
  }, economyConfig.matchRewardOverrides);
  const [hSnap, gSnap] = await Promise.all([
    db.doc(`${COL.users}/${hostUid}`).get(),
    db.doc(`${COL.users}/${guestUid}`).get(),
  ]);
  await upsertRanking({
    uid: hostUid,
    nome: String(hSnap.data()?.nome || "Jogador"),
    username: String(hSnap.data()?.username || "") || null,
    foto: (hSnap.data()?.foto as string | null) ?? null,
    deltaScore: ecoH.rankingPoints,
    win: hostRes === "vitoria",
    gameId: "quiz",
  });
  await upsertRanking({
    uid: guestUid,
    nome: String(gSnap.data()?.nome || "Jogador"),
    username: String(gSnap.data()?.username || "") || null,
    foto: (gSnap.data()?.foto as string | null) ?? null,
    deltaScore: ecoG.rankingPoints,
    win: guestRes === "vitoria",
    gameId: "quiz",
  });
  await bumpPlayMatchMissions(hostUid);
  await bumpPlayMatchMissions(guestUid);
}

function clampReactionResponseMs(raw: unknown): number {
  const ms = Number(raw);
  if (!Number.isFinite(ms)) return REACTION_RESPONSE_MS_CAP;
  return Math.max(1, Math.min(REACTION_RESPONSE_MS_CAP, Math.floor(ms)));
}

function nextReactionGoLiveAt(): Timestamp {
  return Timestamp.fromMillis(
    Date.now() +
      REACTION_WAIT_MIN_MS +
      Math.floor(Math.random() * (REACTION_WAIT_MAX_MS - REACTION_WAIT_MIN_MS)),
  );
}

function resolveReactionWinner(
  hostFalseStart: boolean,
  guestFalseStart: boolean,
  hostMs: number,
  guestMs: number,
): "host" | "guest" | "draw" {
  if (hostFalseStart && !guestFalseStart) return "guest";
  if (guestFalseStart && !hostFalseStart) return "host";
  if (hostFalseStart && guestFalseStart) return "draw";
  const diff = hostMs - guestMs;
  if (Math.abs(diff) <= REACTION_TIE_MS) return "draw";
  return diff < 0 ? "host" : "guest";
}

async function postReactionTapRanking(
  roomId: string,
  hostUid: string,
  guestUid: string,
  hostRes: "vitoria" | "derrota" | "empate",
  guestRes: "vitoria" | "derrota" | "empate",
  hostMs: number,
  guestMs: number,
) {
  const economyConfig = await getEconomy();
  const [ecoH, ecoG] = await Promise.all([
    resolveMatchEconomy("reaction_tap", hostRes, 0, {
      pvpRoomId: roomId,
      responseTimeMs: hostMs,
      reactionMs: hostMs,
    }, economyConfig.matchRewardOverrides),
    resolveMatchEconomy("reaction_tap", guestRes, 0, {
      pvpRoomId: roomId,
      responseTimeMs: guestMs,
      reactionMs: guestMs,
    }, economyConfig.matchRewardOverrides),
  ]);
  const [hSnap, gSnap] = await Promise.all([
    db.doc(`${COL.users}/${hostUid}`).get(),
    db.doc(`${COL.users}/${guestUid}`).get(),
  ]);
  await upsertRanking({
    uid: hostUid,
    nome: String(hSnap.data()?.nome || "Jogador"),
    username: String(hSnap.data()?.username || "") || null,
    foto: (hSnap.data()?.foto as string | null) ?? null,
    deltaScore: ecoH.rankingPoints,
    win: hostRes === "vitoria",
    gameId: "reaction_tap",
  });
  await upsertRanking({
    uid: guestUid,
    nome: String(gSnap.data()?.nome || "Jogador"),
    username: String(gSnap.data()?.username || "") || null,
    foto: (gSnap.data()?.foto as string | null) ?? null,
    deltaScore: ecoG.rankingPoints,
    win: guestRes === "vitoria",
    gameId: "reaction_tap",
  });
  await bumpPlayMatchMissions(hostUid);
  await bumpPlayMatchMissions(guestUid);
}

async function applyQuizMatchCompletionInTransaction(
  tx: Transaction,
  roomRef: DocumentReference,
  roomId: string,
  r: Record<string, unknown>,
  matchWinner: "host" | "guest",
  hostAnswerIndex: number,
  guestAnswerIndex: number,
  hostCorrect: boolean,
  guestCorrect: boolean,
  hostResponseMs: number,
  guestResponseMs: number,
  quizRevealOptions: string[],
  quizRevealCorrectIndex: number,
  quizRevealQuestionText: string,
) {
  const hostUid = String(r.hostUid);
  const guestUid = String(r.guestUid);
  const hostScore = Number(r.quizHostScore ?? 0);
  const guestScore = Number(r.quizGuestScore ?? 0);
  const target = readQuizTargetScore(r);
  const questionId = String(r.quizQuestionId ?? "");

  const hostRes: "vitoria" | "derrota" = matchWinner === "host" ? "vitoria" : "derrota";
  const guestRes: "vitoria" | "derrota" = matchWinner === "guest" ? "vitoria" : "derrota";
  const outcome: "host_win" | "guest_win" = matchWinner === "host" ? "host_win" : "guest_win";

  const hostUserRef = db.doc(`${COL.users}/${hostUid}`);
  const guestUserRef = db.doc(`${COL.users}/${guestUid}`);
  const [hUSnap, gUSnap] = await Promise.all([tx.get(hostUserRef), tx.get(guestUserRef)]);
  if (!hUSnap.exists || !gUSnap.exists) {
    throw new HttpsError("failed-precondition", "Perfil ausente.");
  }

  const hostMeta = {
    pvpRoomId: roomId,
    questionId,
    hostAnswerIndex,
    guestAnswerIndex,
    hostCorrect,
    guestCorrect,
    quizMatchWinner: matchWinner,
    quizFinalHostScore: hostScore,
    quizFinalGuestScore: guestScore,
    responseTimeMs: hostResponseMs,
  };
  const guestMeta = {
    pvpRoomId: roomId,
    questionId,
    hostAnswerIndex,
    guestAnswerIndex,
    hostCorrect,
    guestCorrect,
    quizMatchWinner: matchWinner,
    quizFinalHostScore: hostScore,
    quizFinalGuestScore: guestScore,
    responseTimeMs: guestResponseMs,
  };
  const economyConfig = await getEconomy();
  const ecoH = resolveMatchEconomy("quiz", hostRes, 0, hostMeta, economyConfig.matchRewardOverrides);
  const ecoG = resolveMatchEconomy("quiz", guestRes, 0, guestMeta, economyConfig.matchRewardOverrides);

  const finishedTs = Timestamp.now();
  const mHost = db.collection(COL.matches).doc();
  const mGuest = db.collection(COL.matches).doc();
  const wHost = db.collection(COL.wallet).doc();
  const wGuest = db.collection(COL.wallet).doc();

  tx.set(mHost, {
    id: mHost.id,
    gameId: "quiz",
    gameType: "quiz",
    userId: hostUid,
    opponentId: guestUid,
    resultado: hostRes,
    result: hostRes,
    score: ecoH.normalizedScore,
    rewardCoins: ecoH.rewardCoins,
    rankingPoints: ecoH.rankingPoints,
    startedAt: null,
    finishedAt: finishedTs,
    metadata: ecoH.resolvedMetadata,
    detalhes: ecoH.resolvedMetadata,
    antiSpamToken: null,
    criadoEm: FieldValue.serverTimestamp(),
  });
  tx.set(mGuest, {
    id: mGuest.id,
    gameId: "quiz",
    gameType: "quiz",
    userId: guestUid,
    opponentId: hostUid,
    resultado: guestRes,
    result: guestRes,
    score: ecoG.normalizedScore,
    rewardCoins: ecoG.rewardCoins,
    rankingPoints: ecoG.rankingPoints,
    startedAt: null,
    finishedAt: finishedTs,
    metadata: ecoG.resolvedMetadata,
    detalhes: ecoG.resolvedMetadata,
    antiSpamToken: null,
    criadoEm: FieldValue.serverTimestamp(),
  });

  tx.update(hostUserRef, {
    totalPartidas: FieldValue.increment(1),
    totalVitorias: FieldValue.increment(hostRes === "vitoria" ? 1 : 0),
    totalDerrotas: FieldValue.increment(hostRes === "derrota" ? 1 : 0),
    coins: FieldValue.increment(ecoH.rewardCoins),
    xp: FieldValue.increment(hostRes === "vitoria" ? 15 : 5),
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  tx.update(guestUserRef, {
    totalPartidas: FieldValue.increment(1),
    totalVitorias: FieldValue.increment(guestRes === "vitoria" ? 1 : 0),
    totalDerrotas: FieldValue.increment(guestRes === "derrota" ? 1 : 0),
    coins: FieldValue.increment(ecoG.rewardCoins),
    xp: FieldValue.increment(guestRes === "vitoria" ? 15 : 5),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  const hostCoinsAfter = Number(hUSnap.data()?.coins ?? 0) + ecoH.rewardCoins;
  const guestCoinsAfter = Number(gUSnap.data()?.coins ?? 0) + ecoG.rewardCoins;

  if (ecoH.rewardCoins > 0) {
    tx.set(wHost, {
      userId: hostUid,
      tipo: "jogo_pvp",
      moeda: "coins",
      valor: ecoH.rewardCoins,
      saldoApos: hostCoinsAfter,
      descricao: "Quiz 1v1",
      referenciaId: mHost.id,
      criadoEm: FieldValue.serverTimestamp(),
    });
  }
  if (ecoG.rewardCoins > 0) {
    tx.set(wGuest, {
      userId: guestUid,
      tipo: "jogo_pvp",
      moeda: "coins",
      valor: ecoG.rewardCoins,
      saldoApos: guestCoinsAfter,
      descricao: "Quiz 1v1",
      referenciaId: mGuest.id,
      criadoEm: FieldValue.serverTimestamp(),
    });
  }

  tx.update(roomRef, {
    status: "completed",
    phase: "completed",
    quizHostScore: hostScore,
    quizGuestScore: guestScore,
    quizLastHostAnswerIndex: hostAnswerIndex,
    quizLastGuestAnswerIndex: guestAnswerIndex,
    quizLastHostCorrect: hostCorrect,
    quizLastGuestCorrect: guestCorrect,
    quizLastHostResponseMs: hostResponseMs,
    quizLastGuestResponseMs: guestResponseMs,
    quizLastRoundWinner: matchWinner,
    quizLastRevealOptions: quizRevealOptions,
    quizLastRevealCorrectIndex: quizRevealCorrectIndex,
    quizLastRevealQuestionText: quizRevealQuestionText,
    quizMatchWinner: matchWinner,
    quizOutcome: outcome,
    quizRewardsApplied: true,
    quizAnsweredUids: [],
    timeoutEmptyRounds: 0,
    actionDeadlineAt: FieldValue.delete(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  const gid = (r.gameId as GameId) || "quiz";
  tx.set(
    slotRef(hostUid),
    {
      uid: hostUid,
      gameId: gid,
      queueStatus: "idle",
      roomId: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  tx.set(
    slotRef(guestUid),
    {
      uid: guestUid,
      gameId: gid,
      queueStatus: "idle",
      roomId: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { hostUid, guestUid, matchWinner };
}

async function applyQuizForfeitInTransaction(
  tx: Transaction,
  roomRef: DocumentReference,
  roomId: string,
  r: Record<string, unknown>,
  forfeitedByUid: string,
) {
  const hostUid = String(r.hostUid);
  const guestUid = String(r.guestUid);
  const matchWinner: "host" | "guest" = forfeitedByUid === hostUid ? "guest" : "host";
  const hostRes: "vitoria" | "derrota" = matchWinner === "host" ? "vitoria" : "derrota";
  const guestRes: "vitoria" | "derrota" = matchWinner === "guest" ? "vitoria" : "derrota";
  const hostResponseMs = matchWinner === "host" ? 0 : QUIZ_RESPONSE_MS_CAP;
  const guestResponseMs = matchWinner === "guest" ? 0 : QUIZ_RESPONSE_MS_CAP;

  const hostUserRef = db.doc(`${COL.users}/${hostUid}`);
  const guestUserRef = db.doc(`${COL.users}/${guestUid}`);
  const [hUSnap, gUSnap] = await Promise.all([tx.get(hostUserRef), tx.get(guestUserRef)]);
  if (!hUSnap.exists || !gUSnap.exists) {
    throw new HttpsError("failed-precondition", "Perfil ausente.");
  }

  const hostMeta = {
    pvpRoomId: roomId,
    quizMatchWinner: matchWinner,
    forfeit: true,
    forfeitedBy: forfeitedByUid,
    responseTimeMs: hostResponseMs,
  };
  const guestMeta = {
    pvpRoomId: roomId,
    quizMatchWinner: matchWinner,
    forfeit: true,
    forfeitedBy: forfeitedByUid,
    responseTimeMs: guestResponseMs,
  };
  const economyConfig = await getEconomy();
  const ecoH = resolveMatchEconomy("quiz", hostRes, 0, hostMeta, economyConfig.matchRewardOverrides);
  const ecoG = resolveMatchEconomy("quiz", guestRes, 0, guestMeta, economyConfig.matchRewardOverrides);

  const finishedTs = Timestamp.now();
  const mHost = db.collection(COL.matches).doc();
  const mGuest = db.collection(COL.matches).doc();
  const wHost = db.collection(COL.wallet).doc();
  const wGuest = db.collection(COL.wallet).doc();

  tx.set(mHost, {
    id: mHost.id,
    gameId: "quiz",
    gameType: "quiz",
    userId: hostUid,
    opponentId: guestUid,
    resultado: hostRes,
    result: hostRes,
    score: ecoH.normalizedScore,
    rewardCoins: ecoH.rewardCoins,
    rankingPoints: ecoH.rankingPoints,
    startedAt: null,
    finishedAt: finishedTs,
    metadata: ecoH.resolvedMetadata,
    detalhes: ecoH.resolvedMetadata,
    antiSpamToken: null,
    criadoEm: FieldValue.serverTimestamp(),
  });
  tx.set(mGuest, {
    id: mGuest.id,
    gameId: "quiz",
    gameType: "quiz",
    userId: guestUid,
    opponentId: hostUid,
    resultado: guestRes,
    result: guestRes,
    score: ecoG.normalizedScore,
    rewardCoins: ecoG.rewardCoins,
    rankingPoints: ecoG.rankingPoints,
    startedAt: null,
    finishedAt: finishedTs,
    metadata: ecoG.resolvedMetadata,
    detalhes: ecoG.resolvedMetadata,
    antiSpamToken: null,
    criadoEm: FieldValue.serverTimestamp(),
  });

  tx.update(hostUserRef, {
    totalPartidas: FieldValue.increment(1),
    totalVitorias: FieldValue.increment(hostRes === "vitoria" ? 1 : 0),
    totalDerrotas: FieldValue.increment(hostRes === "derrota" ? 1 : 0),
    coins: FieldValue.increment(ecoH.rewardCoins),
    xp: FieldValue.increment(hostRes === "vitoria" ? 15 : 5),
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  tx.update(guestUserRef, {
    totalPartidas: FieldValue.increment(1),
    totalVitorias: FieldValue.increment(guestRes === "vitoria" ? 1 : 0),
    totalDerrotas: FieldValue.increment(guestRes === "derrota" ? 1 : 0),
    coins: FieldValue.increment(ecoG.rewardCoins),
    xp: FieldValue.increment(guestRes === "vitoria" ? 15 : 5),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  const hostCoinsAfter = Number(hUSnap.data()?.coins ?? 0) + ecoH.rewardCoins;
  const guestCoinsAfter = Number(gUSnap.data()?.coins ?? 0) + ecoG.rewardCoins;

  if (ecoH.rewardCoins > 0) {
    tx.set(wHost, {
      userId: hostUid,
      tipo: "jogo_pvp",
      moeda: "coins",
      valor: ecoH.rewardCoins,
      saldoApos: hostCoinsAfter,
      descricao: "Quiz 1v1",
      referenciaId: mHost.id,
      criadoEm: FieldValue.serverTimestamp(),
    });
  }
  if (ecoG.rewardCoins > 0) {
    tx.set(wGuest, {
      userId: guestUid,
      tipo: "jogo_pvp",
      moeda: "coins",
      valor: ecoG.rewardCoins,
      saldoApos: guestCoinsAfter,
      descricao: "Quiz 1v1",
      referenciaId: mGuest.id,
      criadoEm: FieldValue.serverTimestamp(),
    });
  }

  tx.update(roomRef, {
    status: "completed",
    phase: "completed",
    quizLastRoundWinner: matchWinner,
    quizMatchWinner: matchWinner,
    quizOutcome: matchWinner === "host" ? "host_win" : "guest_win",
    quizRewardsApplied: true,
    quizAnsweredUids: [],
    timeoutEmptyRounds: 0,
    actionDeadlineAt: FieldValue.delete(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  tx.set(
    slotRef(hostUid),
    {
      uid: hostUid,
      gameId: "quiz",
      queueStatus: "idle",
      roomId: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  tx.set(
    slotRef(guestUid),
    {
      uid: guestUid,
      gameId: "quiz",
      queueStatus: "idle",
      roomId: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { hostUid, guestUid, matchWinner, hostResponseMs, guestResponseMs };
}

async function applyReactionMatchCompletionInTransaction(
  tx: Transaction,
  roomRef: DocumentReference,
  roomId: string,
  r: Record<string, unknown>,
  hostMs: number,
  guestMs: number,
  hostFalseStart: boolean,
  guestFalseStart: boolean,
  winner: "host" | "guest" | "draw",
  reactionWindowMs: number,
) {
  const hostUid = String(r.hostUid);
  const guestUid = String(r.guestUid);
  const nextHostScore = Number(r.reactionHostScore ?? 0) + (winner === "host" ? 1 : 0);
  const nextGuestScore = Number(r.reactionGuestScore ?? 0) + (winner === "guest" ? 1 : 0);
  const target = Number(r.reactionTargetScore ?? REACTION_MATCH_TARGET_POINTS);
  const roundNumber = Number(r.reactionRound ?? 1);
  const isMatchComplete =
    (winner === "host" && nextHostScore >= target) || (winner === "guest" && nextGuestScore >= target);

  if (!isMatchComplete) {
    const nextGoLiveAt = nextReactionGoLiveAt();
    tx.update(roomRef, {
      status: "playing",
      phase: "reaction_waiting",
      reactionHostMs: hostMs,
      reactionGuestMs: guestMs,
      reactionHostFalseStart: hostFalseStart,
      reactionGuestFalseStart: guestFalseStart,
      reactionWinner: winner,
      reactionLastRoundWinner: winner,
      reactionHostScore: nextHostScore,
      reactionGuestScore: nextGuestScore,
      reactionRound: roundNumber + 1,
      reactionGoLiveAt: nextGoLiveAt,
      reactionAnsweredUids: [],
      timeoutEmptyRounds: 0,
      actionDeadlineAt: pvpActionDeadlineTs(nextGoLiveAt.toMillis(), reactionWindowMs),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    return {
      hostUid,
      guestUid,
      hostRes: "empate" as const,
      guestRes: "empate" as const,
      winner,
      hostScore: nextHostScore,
      guestScore: nextGuestScore,
      completed: false as const,
    };
  }

  const hostRes: "vitoria" | "derrota" | "empate" =
    winner === "host" ? "vitoria" : winner === "guest" ? "derrota" : "empate";
  const guestRes: "vitoria" | "derrota" | "empate" =
    winner === "guest" ? "vitoria" : winner === "host" ? "derrota" : "empate";

  const hostUserRef = db.doc(`${COL.users}/${hostUid}`);
  const guestUserRef = db.doc(`${COL.users}/${guestUid}`);
  const [hUSnap, gUSnap] = await Promise.all([tx.get(hostUserRef), tx.get(guestUserRef)]);
  if (!hUSnap.exists || !gUSnap.exists) {
    throw new HttpsError("failed-precondition", "Perfil ausente.");
  }

  const hostMeta = {
    pvpRoomId: roomId,
    reactionMs: hostMs,
    responseTimeMs: hostMs,
    falseStart: hostFalseStart,
    reactionWinner: winner,
  };
  const guestMeta = {
    pvpRoomId: roomId,
    reactionMs: guestMs,
    responseTimeMs: guestMs,
    falseStart: guestFalseStart,
    reactionWinner: winner,
  };
  const economyConfig = await getEconomy();
  const ecoH = resolveMatchEconomy(
    "reaction_tap",
    hostRes,
    0,
    hostMeta,
    economyConfig.matchRewardOverrides,
  );
  const ecoG = resolveMatchEconomy(
    "reaction_tap",
    guestRes,
    0,
    guestMeta,
    economyConfig.matchRewardOverrides,
  );

  const finishedTs = Timestamp.now();
  const mHost = db.collection(COL.matches).doc();
  const mGuest = db.collection(COL.matches).doc();
  const wHost = db.collection(COL.wallet).doc();
  const wGuest = db.collection(COL.wallet).doc();

  tx.set(mHost, {
    id: mHost.id,
    gameId: "reaction_tap",
    gameType: "reaction_tap",
    userId: hostUid,
    opponentId: guestUid,
    resultado: hostRes,
    result: hostRes,
    score: ecoH.normalizedScore,
    rewardCoins: ecoH.rewardCoins,
    rankingPoints: ecoH.rankingPoints,
    startedAt: null,
    finishedAt: finishedTs,
    metadata: ecoH.resolvedMetadata,
    detalhes: ecoH.resolvedMetadata,
    antiSpamToken: null,
    criadoEm: FieldValue.serverTimestamp(),
  });
  tx.set(mGuest, {
    id: mGuest.id,
    gameId: "reaction_tap",
    gameType: "reaction_tap",
    userId: guestUid,
    opponentId: hostUid,
    resultado: guestRes,
    result: guestRes,
    score: ecoG.normalizedScore,
    rewardCoins: ecoG.rewardCoins,
    rankingPoints: ecoG.rankingPoints,
    startedAt: null,
    finishedAt: finishedTs,
    metadata: ecoG.resolvedMetadata,
    detalhes: ecoG.resolvedMetadata,
    antiSpamToken: null,
    criadoEm: FieldValue.serverTimestamp(),
  });

  tx.update(hostUserRef, {
    totalPartidas: FieldValue.increment(1),
    totalVitorias: FieldValue.increment(hostRes === "vitoria" ? 1 : 0),
    totalDerrotas: FieldValue.increment(hostRes === "derrota" ? 1 : 0),
    coins: FieldValue.increment(ecoH.rewardCoins),
    xp: FieldValue.increment(hostRes === "vitoria" ? 15 : hostRes === "empate" ? 8 : 5),
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  tx.update(guestUserRef, {
    totalPartidas: FieldValue.increment(1),
    totalVitorias: FieldValue.increment(guestRes === "vitoria" ? 1 : 0),
    totalDerrotas: FieldValue.increment(guestRes === "derrota" ? 1 : 0),
    coins: FieldValue.increment(ecoG.rewardCoins),
    xp: FieldValue.increment(guestRes === "vitoria" ? 15 : guestRes === "empate" ? 8 : 5),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  const hostCoinsAfter = Number(hUSnap.data()?.coins ?? 0) + ecoH.rewardCoins;
  const guestCoinsAfter = Number(gUSnap.data()?.coins ?? 0) + ecoG.rewardCoins;

  if (ecoH.rewardCoins > 0) {
    tx.set(wHost, {
      userId: hostUid,
      tipo: "jogo_pvp",
      moeda: "coins",
      valor: ecoH.rewardCoins,
      saldoApos: hostCoinsAfter,
      descricao: "Reaction Tap 1v1",
      referenciaId: mHost.id,
      criadoEm: FieldValue.serverTimestamp(),
    });
  }
  if (ecoG.rewardCoins > 0) {
    tx.set(wGuest, {
      userId: guestUid,
      tipo: "jogo_pvp",
      moeda: "coins",
      valor: ecoG.rewardCoins,
      saldoApos: guestCoinsAfter,
      descricao: "Reaction Tap 1v1",
      referenciaId: mGuest.id,
      criadoEm: FieldValue.serverTimestamp(),
    });
  }

  tx.update(roomRef, {
    status: "completed",
    phase: "completed",
    reactionHostScore: nextHostScore,
    reactionGuestScore: nextGuestScore,
    reactionTargetScore: target,
    reactionHostMs: hostMs,
    reactionGuestMs: guestMs,
    reactionHostFalseStart: hostFalseStart,
    reactionGuestFalseStart: guestFalseStart,
    reactionWinner: winner,
    reactionLastRoundWinner: winner,
    reactionMatchWinner: winner,
    reactionOutcome: winner === "host" ? "host_win" : "guest_win",
    reactionRewardsApplied: true,
    reactionAnsweredUids: [],
    timeoutEmptyRounds: 0,
    actionDeadlineAt: FieldValue.delete(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  tx.set(
    slotRef(hostUid),
    {
      uid: hostUid,
      gameId: "reaction_tap",
      queueStatus: "idle",
      roomId: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  tx.set(
    slotRef(guestUid),
    {
      uid: guestUid,
      gameId: "reaction_tap",
      queueStatus: "idle",
      roomId: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return {
    hostUid,
    guestUid,
    hostRes,
    guestRes,
    winner,
    hostScore: nextHostScore,
    guestScore: nextGuestScore,
    completed: true as const,
  };
}

async function applyReactionForfeitInTransaction(
  tx: Transaction,
  roomRef: DocumentReference,
  roomId: string,
  r: Record<string, unknown>,
  forfeitedByUid: string,
) {
  const hostUid = String(r.hostUid);
  const guestUid = String(r.guestUid);
  const winner: "host" | "guest" = forfeitedByUid === hostUid ? "guest" : "host";
  const hostMs = winner === "host" ? 1 : REACTION_FALSE_START_MS;
  const guestMs = winner === "guest" ? 1 : REACTION_FALSE_START_MS;
  const hostFalseStart = forfeitedByUid === hostUid;
  const guestFalseStart = forfeitedByUid === guestUid;
  const econForfeitReaction = await getEconomy();
  const reactionWinMsForfeit = pvpChoiceWindowMs(econForfeitReaction.pvpChoiceSeconds, "reaction_tap");
  const out = await applyReactionMatchCompletionInTransaction(
    tx,
    roomRef,
    roomId,
    {
      ...r,
      reactionHostScore:
        winner === "host"
          ? Math.max(
              Number(r.reactionHostScore ?? 0),
              Number(r.reactionTargetScore ?? REACTION_MATCH_TARGET_POINTS) - 1,
            )
          : Number(r.reactionHostScore ?? 0),
      reactionGuestScore:
        winner === "guest"
          ? Math.max(
              Number(r.reactionGuestScore ?? 0),
              Number(r.reactionTargetScore ?? REACTION_MATCH_TARGET_POINTS) - 1,
            )
          : Number(r.reactionGuestScore ?? 0),
    },
    hostMs,
    guestMs,
    hostFalseStart,
    guestFalseStart,
    winner,
    reactionWinMsForfeit,
  );
  return { ...out, winner, hostMs, guestMs };
}

/** Finaliza PPT na transação: perdedor = `loserUid` (desistência / inatividade). */
async function applyPptForfeitInTransaction(
  tx: Transaction,
  roomRef: DocumentReference,
  roomId: string,
  r: Record<string, unknown>,
  loserUid: string,
): Promise<{ hostUid: string; guestUid: string; matchWinner: "host" | "guest" }> {
  const hostUid = String(r.hostUid);
  const guestUid = String(r.guestUid);
  if (loserUid !== hostUid && loserUid !== guestUid) {
    throw new HttpsError("failed-precondition", "Participante inválido.");
  }
  const matchWinner: "host" | "guest" = loserUid === hostUid ? "guest" : "host";
  const hostScore = Number(r.pptHostScore ?? 0);
  const guestScore = Number(r.pptGuestScore ?? 0);
  const target = Number(r.pptTargetScore ?? PPT_MATCH_TARGET_POINTS);
  const lastHandH = String(r.pptLastHostHand ?? "");
  const lastHandG = String(r.pptLastGuestHand ?? "");
  const synthOut: "host_win" | "guest_win" = matchWinner === "host" ? "host_win" : "guest_win";

  const picksColl = roomRef.collection("ppt_picks");
  const hPref = picksColl.doc(hostUid);
  const gPref = picksColl.doc(guestUid);
  const hostUserRef = db.doc(`${COL.users}/${hostUid}`);
  const guestUserRef = db.doc(`${COL.users}/${guestUid}`);

  const [hPSnap, gPSnap, hUSnap, gUSnap] = await Promise.all([
    tx.get(hPref),
    tx.get(gPref),
    tx.get(hostUserRef),
    tx.get(guestUserRef),
  ]);
  if (!hUSnap.exists || !gUSnap.exists) {
    throw new HttpsError("failed-precondition", "Perfil ausente.");
  }
  const hu = hUSnap.data()!;
  const gu = gUSnap.data()!;
  if (hu.banido || gu.banido) {
    throw new HttpsError("permission-denied", "Conta suspensa.");
  }

  if (hPSnap.exists) tx.delete(hPref);
  if (gPSnap.exists) tx.delete(gPref);

  const hostRes: "vitoria" | "derrota" = matchWinner === "host" ? "vitoria" : "derrota";
  const guestRes: "vitoria" | "derrota" = matchWinner === "guest" ? "vitoria" : "derrota";
  const metaBase = {
    pvpRoomId: roomId,
    hostHand: lastHandH,
    guestHand: lastHandG,
    lastRoundOutcome: synthOut,
    pptMatchTo: target,
    pptFinalHostScore: hostScore,
    pptFinalGuestScore: guestScore,
    pptMatchWinner: matchWinner,
    forfeit: true,
    forfeitedBy: loserUid,
  };
  const economyConfig = await getEconomy();
  const ecoH = resolveMatchEconomy("ppt", hostRes, 0, metaBase, economyConfig.matchRewardOverrides);
  const ecoG = resolveMatchEconomy("ppt", guestRes, 0, metaBase, economyConfig.matchRewardOverrides);

  const finishedTs = Timestamp.now();
  const mHost = db.collection(COL.matches).doc();
  const mGuest = db.collection(COL.matches).doc();
  const wHost = db.collection(COL.wallet).doc();
  const wGuest = db.collection(COL.wallet).doc();

  tx.set(mHost, {
    id: mHost.id,
    gameId: "ppt",
    gameType: "ppt",
    userId: hostUid,
    opponentId: guestUid,
    resultado: hostRes,
    result: hostRes,
    score: ecoH.normalizedScore,
    rewardCoins: ecoH.rewardCoins,
    rankingPoints: ecoH.rankingPoints,
    startedAt: null,
    finishedAt: finishedTs,
    metadata: ecoH.resolvedMetadata,
    detalhes: ecoH.resolvedMetadata,
    antiSpamToken: null,
    criadoEm: FieldValue.serverTimestamp(),
  });
  tx.set(mGuest, {
    id: mGuest.id,
    gameId: "ppt",
    gameType: "ppt",
    userId: guestUid,
    opponentId: hostUid,
    resultado: guestRes,
    result: guestRes,
    score: ecoG.normalizedScore,
    rewardCoins: ecoG.rewardCoins,
    rankingPoints: ecoG.rankingPoints,
    startedAt: null,
    finishedAt: finishedTs,
    metadata: ecoG.resolvedMetadata,
    detalhes: ecoG.resolvedMetadata,
    antiSpamToken: null,
    criadoEm: FieldValue.serverTimestamp(),
  });

  const hWin = hostRes === "vitoria";
  const hLoss = hostRes === "derrota";
  const gWin = guestRes === "vitoria";
  const gLoss = guestRes === "derrota";

  tx.update(hostUserRef, {
    totalPartidas: FieldValue.increment(1),
    totalVitorias: FieldValue.increment(hWin ? 1 : 0),
    totalDerrotas: FieldValue.increment(hLoss ? 1 : 0),
    coins: FieldValue.increment(ecoH.rewardCoins),
    xp: FieldValue.increment(hWin ? 15 : 5),
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  tx.update(guestUserRef, {
    totalPartidas: FieldValue.increment(1),
    totalVitorias: FieldValue.increment(gWin ? 1 : 0),
    totalDerrotas: FieldValue.increment(gLoss ? 1 : 0),
    coins: FieldValue.increment(ecoG.rewardCoins),
    xp: FieldValue.increment(gWin ? 15 : 5),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  const coinsH = Number(hu.coins ?? 0) + ecoH.rewardCoins;
  const coinsG = Number(gu.coins ?? 0) + ecoG.rewardCoins;

  if (ecoH.rewardCoins > 0) {
    tx.set(wHost, {
      userId: hostUid,
      tipo: "jogo_pvp",
      moeda: "coins",
      valor: ecoH.rewardCoins,
      saldoApos: coinsH,
      descricao: "PPT 1v1 · vitória por W.O.",
      referenciaId: mHost.id,
      criadoEm: FieldValue.serverTimestamp(),
    });
  }
  if (ecoG.rewardCoins > 0) {
    tx.set(wGuest, {
      userId: guestUid,
      tipo: "jogo_pvp",
      moeda: "coins",
      valor: ecoG.rewardCoins,
      saldoApos: coinsG,
      descricao: "PPT 1v1 · vitória por W.O.",
      referenciaId: mGuest.id,
      criadoEm: FieldValue.serverTimestamp(),
    });
  }

  tx.update(roomRef, {
    phase: "completed",
    status: "completed",
    pptHostScore: hostScore,
    pptGuestScore: guestScore,
    pptTargetScore: target,
    pptLastHostHand: lastHandH,
    pptLastGuestHand: lastHandG,
    pptLastRoundOutcome: synthOut,
    pptMatchWinner: matchWinner,
    pptOutcome: matchWinner === "host" ? "host_win" : "guest_win",
    pptRewardsApplied: true,
    pptAwaitingBothPicks: false,
    pptEndedByForfeit: true,
    pptForfeitedByUid: loserUid,
    actionDeadlineAt: FieldValue.delete(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  const gid = (r.gameId as GameId) || "ppt";
  tx.set(
    slotRef(hostUid),
    {
      uid: hostUid,
      gameId: gid,
      queueStatus: "idle",
      roomId: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  tx.set(
    slotRef(guestUid),
    {
      uid: guestUid,
      gameId: gid,
      queueStatus: "idle",
      roomId: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { hostUid, guestUid, matchWinner };
}

/** Encerra PPT sem vencedor: ambos inativos (duas rodadas sem nenhum pick). Sem partidas/recompensas/ranking. */
async function applyPptVoidBothInactiveInTransaction(
  tx: Transaction,
  roomRef: DocumentReference,
  r: Record<string, unknown>,
) {
  const hostUid = String(r.hostUid);
  const guestUid = String(r.guestUid);
  const gid = (r.gameId as GameId) || "ppt";
  const picksColl = roomRef.collection("ppt_picks");
  const hPref = picksColl.doc(hostUid);
  const gPref = picksColl.doc(guestUid);
  const [hPSnap, gPSnap] = await Promise.all([tx.get(hPref), tx.get(gPref)]);
  if (hPSnap.exists) tx.delete(hPref);
  if (gPSnap.exists) tx.delete(gPref);

  tx.update(roomRef, {
    phase: "completed",
    status: "completed",
    pptRewardsApplied: true,
    pptVoidBothInactive: true,
    pptAwaitingBothPicks: false,
    pptMatchWinner: FieldValue.delete(),
    pptOutcome: FieldValue.delete(),
    timeoutEmptyRounds: 0,
    actionDeadlineAt: FieldValue.delete(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  const hostUserRef = db.doc(`${COL.users}/${hostUid}`);
  const guestUserRef = db.doc(`${COL.users}/${guestUid}`);
  tx.update(hostUserRef, {
    pptPvPDuelsRemaining: FieldValue.increment(1),
    pptPvpDuelsRefillAvailableAt: FieldValue.delete(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  tx.update(guestUserRef, {
    pptPvPDuelsRemaining: FieldValue.increment(1),
    pptPvpDuelsRefillAvailableAt: FieldValue.delete(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  tx.set(
    slotRef(hostUid),
    {
      uid: hostUid,
      gameId: gid,
      queueStatus: "idle",
      roomId: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  tx.set(
    slotRef(guestUid),
    {
      uid: guestUid,
      gameId: gid,
      queueStatus: "idle",
      roomId: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function applyGenericPvpTimeoutVoidInTransaction(
  tx: Transaction,
  roomRef: DocumentReference,
  r: Record<string, unknown>,
  extraRoomUpdates: Record<string, unknown> = {},
) {
  const hostUid = String(r.hostUid);
  const guestUid = String(r.guestUid);
  const gid = (r.gameId as GameId) || "ppt";

  tx.update(roomRef, {
    status: "completed",
    phase: "completed",
    actionDeadlineAt: FieldValue.delete(),
    ...extraRoomUpdates,
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  if (gid === "reaction_tap") {
    const hostUserRef = db.doc(`${COL.users}/${hostUid}`);
    const guestUserRef = db.doc(`${COL.users}/${guestUid}`);
    tx.update(hostUserRef, {
      reactionPvPDuelsRemaining: FieldValue.increment(1),
      reactionPvpDuelsRefillAvailableAt: FieldValue.delete(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    tx.update(guestUserRef, {
      reactionPvPDuelsRemaining: FieldValue.increment(1),
      reactionPvpDuelsRefillAvailableAt: FieldValue.delete(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
  }

  tx.set(
    slotRef(hostUid),
    {
      uid: hostUid,
      gameId: gid,
      queueStatus: "idle",
      roomId: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  tx.set(
    slotRef(guestUid),
    {
      uid: guestUid,
      gameId: gid,
      queueStatus: "idle",
      roomId: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function applyPptRoundResultInTransaction(
  tx: Transaction,
  roomRef: DocumentReference,
  roomId: string,
  r: Record<string, unknown>,
  hostHand: string,
  guestHand: string,
  out: "host_win" | "guest_win" | "draw",
  pptWindowMs: number,
  pickRefs?: { hostRef: DocumentReference; guestRef: DocumentReference },
): Promise<"round" | "match"> {
  const hostUid = String(r.hostUid);
  const guestUid = String(r.guestUid);
  const target = Number(r.pptTargetScore ?? PPT_MATCH_TARGET_POINTS);
  const hostScore = Number(r.pptHostScore ?? 0);
  const guestScore = Number(r.pptGuestScore ?? 0);

  if (out === "draw") {
    if (pickRefs) {
      tx.delete(pickRefs.hostRef);
      tx.delete(pickRefs.guestRef);
    }
    tx.update(roomRef, {
      phase: "ppt_playing",
      status: "playing",
      pptPickedUids: [],
      pptLastHostHand: hostHand,
      pptLastGuestHand: guestHand,
      pptLastRoundOutcome: "draw",
      pptAwaitingBothPicks: true,
      pptRoundStartedAt: FieldValue.serverTimestamp(),
      pptConsecutiveEmptyRounds: 0,
      timeoutEmptyRounds: 0,
      actionDeadlineAt: pvpActionDeadlineTs(Date.now(), pptWindowMs),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    return "round";
  }

  const newHost = hostScore + (out === "host_win" ? 1 : 0);
  const newGuest = guestScore + (out === "guest_win" ? 1 : 0);
  if (newHost < target && newGuest < target) {
    if (pickRefs) {
      tx.delete(pickRefs.hostRef);
      tx.delete(pickRefs.guestRef);
    }
    tx.update(roomRef, {
      pptHostScore: newHost,
      pptGuestScore: newGuest,
      phase: "ppt_playing",
      status: "playing",
      pptPickedUids: [],
      pptLastHostHand: hostHand,
      pptLastGuestHand: guestHand,
      pptLastRoundOutcome: out,
      pptAwaitingBothPicks: true,
      pptRoundStartedAt: FieldValue.serverTimestamp(),
      pptConsecutiveEmptyRounds: 0,
      timeoutEmptyRounds: 0,
      actionDeadlineAt: pvpActionDeadlineTs(Date.now(), pptWindowMs),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    return "round";
  }

  const matchWinner: "host" | "guest" = newHost >= target ? "host" : "guest";
  const hostRes: "vitoria" | "derrota" = matchWinner === "host" ? "vitoria" : "derrota";
  const guestRes: "vitoria" | "derrota" = matchWinner === "guest" ? "vitoria" : "derrota";
  const metaBase = {
    pvpRoomId: roomId,
    hostHand,
    guestHand,
    lastRoundOutcome: out,
    pptMatchTo: target,
    pptFinalHostScore: newHost,
    pptFinalGuestScore: newGuest,
    pptMatchWinner: matchWinner,
  };
  const economyConfig = await getEconomy();
  const ecoH = resolveMatchEconomy("ppt", hostRes, 0, metaBase, economyConfig.matchRewardOverrides);
  const ecoG = resolveMatchEconomy("ppt", guestRes, 0, metaBase, economyConfig.matchRewardOverrides);

  const hostUserRef = db.doc(`${COL.users}/${hostUid}`);
  const guestUserRef = db.doc(`${COL.users}/${guestUid}`);
  const [hUSnap, gUSnap] = await Promise.all([tx.get(hostUserRef), tx.get(guestUserRef)]);
  if (!hUSnap.exists || !gUSnap.exists) {
    throw new HttpsError("failed-precondition", "Perfil ausente.");
  }
  const hu = hUSnap.data()!;
  const gu = gUSnap.data()!;
  if (pickRefs) {
    tx.delete(pickRefs.hostRef);
    tx.delete(pickRefs.guestRef);
  }

  const finishedTs = Timestamp.now();
  const mHost = db.collection(COL.matches).doc();
  const mGuest = db.collection(COL.matches).doc();
  const wHost = db.collection(COL.wallet).doc();
  const wGuest = db.collection(COL.wallet).doc();

  tx.set(mHost, {
    id: mHost.id,
    gameId: "ppt",
    gameType: "ppt",
    userId: hostUid,
    opponentId: guestUid,
    resultado: hostRes,
    result: hostRes,
    score: ecoH.normalizedScore,
    rewardCoins: ecoH.rewardCoins,
    rankingPoints: ecoH.rankingPoints,
    startedAt: null,
    finishedAt: finishedTs,
    metadata: ecoH.resolvedMetadata,
    detalhes: ecoH.resolvedMetadata,
    antiSpamToken: null,
    criadoEm: FieldValue.serverTimestamp(),
  });
  tx.set(mGuest, {
    id: mGuest.id,
    gameId: "ppt",
    gameType: "ppt",
    userId: guestUid,
    opponentId: hostUid,
    resultado: guestRes,
    result: guestRes,
    score: ecoG.normalizedScore,
    rewardCoins: ecoG.rewardCoins,
    rankingPoints: ecoG.rankingPoints,
    startedAt: null,
    finishedAt: finishedTs,
    metadata: ecoG.resolvedMetadata,
    detalhes: ecoG.resolvedMetadata,
    antiSpamToken: null,
    criadoEm: FieldValue.serverTimestamp(),
  });

  tx.update(hostUserRef, {
    totalPartidas: FieldValue.increment(1),
    totalVitorias: FieldValue.increment(hostRes === "vitoria" ? 1 : 0),
    totalDerrotas: FieldValue.increment(hostRes === "derrota" ? 1 : 0),
    coins: FieldValue.increment(ecoH.rewardCoins),
    xp: FieldValue.increment(hostRes === "vitoria" ? 15 : 5),
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  tx.update(guestUserRef, {
    totalPartidas: FieldValue.increment(1),
    totalVitorias: FieldValue.increment(guestRes === "vitoria" ? 1 : 0),
    totalDerrotas: FieldValue.increment(guestRes === "derrota" ? 1 : 0),
    coins: FieldValue.increment(ecoG.rewardCoins),
    xp: FieldValue.increment(guestRes === "vitoria" ? 15 : 5),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  const coinsH = Number(hu.coins ?? 0) + ecoH.rewardCoins;
  const coinsG = Number(gu.coins ?? 0) + ecoG.rewardCoins;
  if (ecoH.rewardCoins > 0) {
    tx.set(wHost, {
      userId: hostUid,
      tipo: "jogo_pvp",
      moeda: "coins",
      valor: ecoH.rewardCoins,
      saldoApos: coinsH,
      descricao: "PPT 1v1 (sala)",
      referenciaId: mHost.id,
      criadoEm: FieldValue.serverTimestamp(),
    });
  }
  if (ecoG.rewardCoins > 0) {
    tx.set(wGuest, {
      userId: guestUid,
      tipo: "jogo_pvp",
      moeda: "coins",
      valor: ecoG.rewardCoins,
      saldoApos: coinsG,
      descricao: "PPT 1v1 (sala)",
      referenciaId: mGuest.id,
      criadoEm: FieldValue.serverTimestamp(),
    });
  }

  tx.update(roomRef, {
    phase: "completed",
    status: "completed",
    pptHostScore: newHost,
    pptGuestScore: newGuest,
    pptTargetScore: target,
    pptLastHostHand: hostHand,
    pptLastGuestHand: guestHand,
    pptLastRoundOutcome: out,
    pptMatchWinner: matchWinner,
    pptOutcome: matchWinner === "host" ? "host_win" : "guest_win",
    pptRewardsApplied: true,
    pptAwaitingBothPicks: false,
    timeoutEmptyRounds: 0,
    actionDeadlineAt: FieldValue.delete(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  const gid = (r.gameId as GameId) || "ppt";
  tx.set(
    slotRef(hostUid),
    {
      uid: hostUid,
      gameId: gid,
      queueStatus: "idle",
      roomId: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  tx.set(
    slotRef(guestUid),
    {
      uid: guestUid,
      gameId: gid,
      queueStatus: "idle",
      roomId: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return "match";
}

export const initializeUserProfile = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  const nome = String(request.data?.nome || "").trim();
  const username = String(request.data?.username || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  const rawFoto = typeof request.data?.foto === "string" ? request.data.foto.trim() : "";
  const email = request.data?.email ?? null;
  const codigoConvite = request.data?.codigoConvite
    ? String(request.data.codigoConvite).toUpperCase()
    : null;

  if (nome.length < 2 || username.length < 3 || username.length > 10) {
    throw new HttpsError(
      "invalid-argument",
      "Nome ou username inválidos. Username: 3 a 10 caracteres (a-z, 0-9, _).",
    );
  }

  const foto = rawFoto || buildDefaultAvatarDataUrl(username || uid, nome);

  const userRef = db.doc(`${COL.users}/${uid}`);
  const existing = await userRef.get();
  if (existing.exists) {
    return { ok: true, existing: true };
  }

  const dup = await db
    .collection(COL.users)
    .where("username", "==", username)
    .limit(1)
    .get();
  if (!dup.empty) {
    throw new HttpsError("already-exists", "Username já em uso.");
  }

  const referralConfig = await getReferralConfig();
  let convidadoPor: string | null = null;
  let invitedByCode: string | null = null;
  let inviterName: string | null = null;
  let inviterPhoto: string | null = null;
  if (codigoConvite) {
    const inv = await db
      .collection(COL.users)
      .where("codigoConvite", "==", codigoConvite)
      .limit(1)
      .get();
    if (inv.empty) {
      throw new HttpsError("invalid-argument", "Código de convite inválido.");
    }
    const inviter = inv.docs[0].id;
    if (inviter === uid && referralConfig.antiFraudRules.blockSelfReferral) {
      throw new HttpsError("failed-precondition", "Você não pode usar o próprio código.");
    }
    convidadoPor = inviter;
    invitedByCode = codigoConvite;
    inviterName = String(inv.docs[0].data()?.nome || "").trim() || null;
    inviterPhoto = typeof inv.docs[0].data()?.foto === "string" ? inv.docs[0].data()?.foto : null;
  } else if (referralConfig.codeRequired) {
    throw new HttpsError("invalid-argument", "Informe um código de convite para continuar.");
  }

  const economy = await getEconomy();
  const codigo = await generateUniqueReferralCode(buildReferralCodeSeed(nome, username));
  const campaign = await getActiveReferralCampaign(referralConfig);

  await db.runTransaction(async (tx) => {
    tx.set(userRef, {
      uid,
      nome,
      email,
      foto,
      username,
      codigoConvite: codigo,
      convidadoPor,
      invitedByCode,
      invitedAt: convidadoPor ? FieldValue.serverTimestamp() : null,
      referralStatus: convidadoPor ? "pending" : null,
      referralPendingCount: 0,
      referralQualifiedCount: 0,
      referralRewardedCount: 0,
      referralBlockedCount: 0,
      referralInvitedCount: 0,
      referralTotalEarnedCoins: 0,
      referralTotalEarnedGems: 0,
      referralTotalEarnedRewardBalance: 0,
      referralInvitedRewardCoins: 0,
      referralInvitedRewardGems: 0,
      referralInvitedRewardBalance: 0,
      totalMissionRewardsClaimed: 0,
      coins: economy.welcomeBonus,
      gems: 0,
      rewardBalance: 0,
      xp: 0,
      level: 1,
      streakAtual: 0,
      melhorStreak: 0,
      ultimaEntradaEm: null,
      dailyLoginCount: 0,
      totalAdsAssistidos: 0,
      totalPartidas: 0,
      totalVitorias: 0,
      totalDerrotas: 0,
      scoreRankingDiario: 0,
      scoreRankingSemanal: 0,
      scoreRankingMensal: 0,
      banido: false,
      riscoFraude: "baixo",
      pptPvPDuelsRemaining: PPT_DEFAULT_DUEL_CHARGES,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });

    if (convidadoPor && invitedByCode) {
      const referralRef = db.doc(`${COL.referrals}/${uid}`);
      tx.set(referralRef, {
        id: uid,
        inviterUserId: convidadoPor,
        inviterCode: invitedByCode,
        inviterName,
        invitedUserId: uid,
        invitedUserName: nome,
        invitedUserEmail: email,
        invitedByCode,
        invitedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        status: "pending",
        referralStatus: "pending",
        referralQualified: false,
        referralRewardGiven: false,
        inviterRewardAmount: 0,
        inviterRewardCurrency: "coins",
        invitedRewardAmount: 0,
        invitedRewardCurrency: referralConfig.defaultInvitedRewardCurrency,
        inviterRewardCoins: 0,
        invitedRewardCoins: 0,
        campaignId: campaign?.id ?? null,
        campaignName: campaign?.name ?? null,
        inviteSource: "cadastro",
        qualificationSnapshot: campaign?.config.qualificationRules ?? referralConfig.qualificationRules,
        progressSnapshot: buildReferralProgressSnapshot(
          {
            nome,
            username,
            totalAdsAssistidos: 0,
            totalPartidas: 0,
            totalMissionRewardsClaimed: 0,
          },
          false,
        ),
        fraudFlags: {
          suspectedFraud: false,
          selfReferralBlocked: false,
          duplicateRewardBlocked: false,
          manualReviewRequired: false,
          sameIpFlag: false,
        },
        notes: null,
      });
      tx.update(db.doc(`${COL.users}/${convidadoPor}`), {
        referralPendingCount: FieldValue.increment(1),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      await upsertReferralRankingEntry(
        tx,
        convidadoPor,
        inviterName || "Jogador",
        inviterPhoto,
        { pending: 1 },
      );
    }
  });

  await addWalletTx({
    userId: uid,
    tipo: "bonus_admin",
    moeda: "coins",
    valor: economy.welcomeBonus,
    saldoApos: economy.welcomeBonus,
    descricao: "Bônus de boas-vindas",
    referenciaId: "welcome",
  });

  return { ok: true, codigoConvite: codigo };
});

export const updateUserAvatar = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);

  const rawPhotoUrl = typeof request.data?.photoURL === "string" ? request.data.photoURL.trim() : "";
  const userRef = db.doc(`${COL.users}/${uid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "Perfil do usuário não encontrado.");
  }

  const userData = userSnap.data() as Record<string, unknown>;
  const nome = String(userData.nome || request.auth?.token.name || "Jogador").trim() || "Jogador";
  const username = String(userData.username || uid).trim() || uid;
  const photoURL = rawPhotoUrl || buildDefaultAvatarDataUrl(username, nome);

  await Promise.all([
    userRef.set(
      {
        foto: photoURL,
        atualizadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true },
    ),
    admin.auth().updateUser(uid, { photoURL }),
    syncUserPresentation(uid, nome, photoURL),
  ]);

  return { ok: true, photoURL };
});

export const processDailyLogin = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  const economy = await getEconomy();
  const userRef = db.doc(`${COL.users}/${uid}`);
  const now = new Date();
  const todayKey = dailyKey(now);
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yKey = dailyKey(yesterday);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError("failed-precondition", "Perfil inexistente.");
    const u = snap.data()!;
    if (u.banido) throw new HttpsError("permission-denied", "Conta suspensa.");

    const last = u.ultimaEntradaEm?.toDate?.() as Date | undefined;
    let streak = Number(u.streakAtual || 0);
    if (!last) streak = 1;
    else {
      const lastKey = dailyKey(last);
      if (lastKey === todayKey) {
        return {
          streak,
          coins: 0,
          gems: 0,
          tipoBonus: "nenhum",
          message: "already_checked_in",
          alreadyCheckedIn: true,
        };
      }
      if (lastKey === yKey) streak += 1;
      else streak = 1;
    }

    const reward = resolveStreakRewardForDay(streak, economy.streakTable, economy.dailyLoginBonus);
    const melhor = Math.max(Number(u.melhorStreak || 0), streak);
    const curCoins = Number(u.coins || 0);
    const curGems = Number(u.gems || 0);
    const newCoins = curCoins + reward.coins;
    const newGems = curGems + reward.gems;

    const patch: Record<string, unknown> = {
      streakAtual: streak,
      melhorStreak: melhor,
      ultimaEntradaEm: Timestamp.fromDate(now),
      dailyLoginCount: FieldValue.increment(1),
      atualizadoEm: FieldValue.serverTimestamp(),
    };
    if (reward.coins > 0) patch.coins = FieldValue.increment(reward.coins);
    if (reward.gems > 0) patch.gems = FieldValue.increment(reward.gems);
    tx.update(userRef, patch);

    if (reward.coins > 0) {
      addWalletTxInTx(tx, {
        id: `streak_${uid}_${todayKey}_coins`,
        userId: uid,
        tipo: "streak",
        moeda: "coins",
        valor: reward.coins,
        saldoApos: newCoins,
        descricao:
          reward.tipoBonus === "bau"
            ? `Login diário · marco dia ${streak} (baú)`
            : reward.tipoBonus === "especial"
              ? `Login diário · marco dia ${streak} (especial)`
              : "Login diário / streak",
        referenciaId: todayKey,
      });
    }
    if (reward.gems > 0) {
      addWalletTxInTx(tx, {
        id: `streak_${uid}_${todayKey}_gems`,
        userId: uid,
        tipo: "streak",
        moeda: "gems",
        valor: reward.gems,
        saldoApos: newGems,
        descricao: "Login diário / streak (TICKET)",
        referenciaId: todayKey,
      });
    }

    return {
      streak,
      coins: reward.coins,
      gems: reward.gems,
      tipoBonus: reward.tipoBonus,
    };
  }).then(async (result) => {
    await evaluateReferralForUser(uid);
    return result;
  });
});

async function bumpWatchAdMissions(uid: string) {
  const missionsSnap = await db
    .collection(COL.missions)
    .where("ativa", "==", true)
    .where("eventKey", "==", "watch_ad")
    .get();
  for (const m of missionsSnap.docs) {
    const progRef = db.doc(`${COL.userMissions}/${uid}/daily/${m.id}`);
    const pSnap = await progRef.get();
    const meta = Number(m.data().meta || 1);
    const cur = pSnap.exists ? Number(pSnap.data()?.progresso || 0) : 0;
    const next = Math.min(meta, cur + 1);
    await progRef.set(
      {
        missionId: m.id,
        progresso: next,
        concluida: next >= meta,
        recompensaResgatada: pSnap.data()?.recompensaResgatada ?? false,
        atualizadoEm: FieldValue.serverTimestamp(),
        periodoChave: dailyKey(),
      },
      { merge: true },
    );
  }
}

/**
 * Recompensa por anúncio: PR (placement padrão) ou +3 duelos PvP específicos.
 * Limite diário compartilhado; só o servidor altera saldos / duelos.
 */
export const processRewardedAd = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  const placementId = String(request.data?.placementId || "").trim();
  if (!ALLOWED_REWARDED_AD_PLACEMENTS.has(placementId)) {
    throw new HttpsError("invalid-argument", "placementId inválido.");
  }
  const { token: completionToken, isMock } = parseRewardedAdCompletionToken(
    request.data?.mockCompletionToken,
  );
  const economy = await getEconomy();
  const userRef = db.doc(`${COL.users}/${uid}`);
  const tokenHash = hashId(uid, placementId, completionToken);
  const adRef = db.doc(`${COL.adEvents}/${tokenHash}`);
  const today = dailyKey();
  const isPptDuels = placementId === PPT_PVP_DUELS_PLACEMENT_ID;
  const isQuizDuels = placementId === QUIZ_PVP_DUELS_PLACEMENT_ID;
  const isReactionDuels = placementId === REACTION_PVP_DUELS_PLACEMENT_ID;
  const result = await db.runTransaction(async (tx) => {
    const [uSnap, existingAdSnap] = await Promise.all([tx.get(userRef), tx.get(adRef)]);
    if (!uSnap.exists) throw new HttpsError("failed-precondition", "Perfil inexistente.");
    if (existingAdSnap.exists) {
      throw new HttpsError("already-exists", "Este anúncio já foi processado.");
    }

    const u = uSnap.data()!;
    if (u.banido) throw new HttpsError("permission-denied", "Conta suspensa.");

    const currentDayKey = String(u.rewardedAdsDayKey || "");
    const currentCount =
      currentDayKey === today ? Math.max(0, Math.floor(Number(u.rewardedAdsCount || 0))) : 0;
    if (currentCount >= economy.limiteDiarioAds) {
      throw new HttpsError("resource-exhausted", "Limite diário de anúncios atingido.");
    }

    const userPatch: Record<string, unknown> = {
      rewardedAdsDayKey: today,
      rewardedAdsCount: currentCount + 1,
      totalAdsAssistidos: FieldValue.increment(1),
      atualizadoEm: FieldValue.serverTimestamp(),
    };

    tx.set(adRef, {
      id: adRef.id,
      userId: uid,
      status: "recompensado",
      placementId,
      rewardKind: isPptDuels
        ? "ppt_pvp_duels"
        : isQuizDuels
          ? "quiz_pvp_duels"
          : isReactionDuels
            ? "reaction_pvp_duels"
            : "coins",
      mock: isMock,
      tokenHash,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });

    if (isPptDuels) {
      const cur = readPptDuelCharges(u as Record<string, unknown>);
      const cappedNext = Math.min(PPT_DUEL_CHARGES_MAX_STACK, cur + PPT_DUEL_CHARGES_PER_AD);
      const addedDuels = cappedNext - cur;
      userPatch.pptPvPDuelsRemaining = cappedNext;
      userPatch.pptPvpDuelsRefillAvailableAt = FieldValue.delete();
      tx.update(userRef, userPatch);
      return { coins: 0, pptPvPDuelsAdded: addedDuels, pptPvPDuelsRemaining: cappedNext };
    }

    if (isQuizDuels) {
      const cur = readQuizDuelCharges(u as Record<string, unknown>);
      const cappedNext = Math.min(QUIZ_DUEL_CHARGES_MAX_STACK, cur + QUIZ_DUEL_CHARGES_PER_AD);
      const addedDuels = cappedNext - cur;
      userPatch.quizPvPDuelsRemaining = cappedNext;
      userPatch.quizPvpDuelsRefillAvailableAt = FieldValue.delete();
      tx.update(userRef, userPatch);
      return { coins: 0, quizPvPDuelsAdded: addedDuels, quizPvPDuelsRemaining: cappedNext };
    }

    if (isReactionDuels) {
      const cur = readReactionDuelCharges(u as Record<string, unknown>);
      const cappedNext = Math.min(REACTION_DUEL_CHARGES_MAX_STACK, cur + REACTION_DUEL_CHARGES_PER_AD);
      const addedDuels = cappedNext - cur;
      userPatch.reactionPvPDuelsRemaining = cappedNext;
      userPatch.reactionPvpDuelsRefillAvailableAt = FieldValue.delete();
      tx.update(userRef, userPatch);
      return {
        coins: 0,
        reactionPvPDuelsAdded: addedDuels,
        reactionPvPDuelsRemaining: cappedNext,
      };
    }

    const coins = economy.rewardAdCoinAmount;
    const newCoins = Number(u.coins ?? 0) + coins;
    userPatch.coins = FieldValue.increment(coins);
    tx.update(userRef, userPatch);
    addWalletTxInTx(tx, {
      id: `ad_${tokenHash}_coins`,
      userId: uid,
      tipo: "anuncio",
      moeda: "coins",
      valor: coins,
      saldoApos: newCoins,
      descricao: "Anúncio recompensado",
      referenciaId: adRef.id,
    });
    return { coins };
  });

  await bumpWatchAdMissions(uid);
  await evaluateReferralForUser(uid);
  return result;
});

export const finalizeMatch = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  const gameId = request.data?.gameId as GameId;
  const resultado = request.data?.resultado as "vitoria" | "derrota" | "empate";
  const clientScore = Number(request.data?.score || 0);
  const rawMeta = request.data?.metadata ?? request.data?.detalhes;
  const metadata =
    rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
      ? (rawMeta as Record<string, unknown>)
      : {};
  const opponentId = request.data?.opponentId ? String(request.data.opponentId) : null;
  const startedAtRaw = request.data?.startedAt ? String(request.data.startedAt) : null;

  if (!gameId || !resultado) throw new HttpsError("invalid-argument", "Dados inválidos.");
  if (GAME_COOLDOWN_SEC[gameId] === undefined) {
    throw new HttpsError("invalid-argument", "Jogo inválido.");
  }

  const userRef = db.doc(`${COL.users}/${uid}`);
  const uSnap = await userRef.get();
  if (!uSnap.exists) throw new HttpsError("failed-precondition", "Perfil inexistente.");
  const u = uSnap.data()!;
  if (u.banido) throw new HttpsError("permission-denied", "Conta suspensa.");

  const now = Date.now();
  const gcMap = (u.gameCooldownUntil as Record<string, unknown>) || {};
  const until = millisFromCooldownField(gcMap[gameId]);
  if (until > now) {
    await logMatchFraud(uid, "cooldown_violation", { gameId, remainingMs: until - now });
    throw new HttpsError(
      "resource-exhausted",
      `Aguarde ${Math.ceil((until - now) / 1000)}s para jogar de novo.`,
    );
  }

  const burstR = nextBurstState(u, now);
  if (!burstR.ok) {
    await logMatchFraud(uid, "match_rate_limit", { gameId });
    throw new HttpsError("resource-exhausted", "Muitas partidas em sequência. Aguarde um minuto.");
  }

  const effectiveResult: "vitoria" | "derrota" | "empate" =
    gameId === "roleta" || gameId === "bau" ? "vitoria" : resultado;

  const economyConfig = await getEconomy();
  const economy = resolveMatchEconomy(
    gameId,
    effectiveResult,
    clientScore,
    metadata,
    economyConfig.matchRewardOverrides,
  );
  const cdSec = GAME_COOLDOWN_SEC[gameId] ?? 3;
  const cooldownUntil = Timestamp.fromMillis(now + cdSec * 1000);

  let startedTs: Timestamp | null = null;
  if (startedAtRaw) {
    const d = new Date(startedAtRaw);
    if (!Number.isNaN(d.getTime()) && now - d.getTime() < 15 * 60 * 1000 && d.getTime() <= now) {
      startedTs = Timestamp.fromDate(d);
    }
  }

  const matchRef = db.collection(COL.matches).doc();
  const win = effectiveResult === "vitoria";
  const loss = effectiveResult === "derrota";
  const rewardCoins = economy.rewardCoins;
  const rankingPoints = economy.rankingPoints;
  const coinsBefore = Number(u.coins ?? 0);
  const newCoins = coinsBefore + rewardCoins;
  const finishedTs = Timestamp.now();

  const matchDoc = {
    id: matchRef.id,
    gameId,
    gameType: gameId,
    userId: uid,
    opponentId,
    resultado: effectiveResult,
    result: effectiveResult,
    score: economy.normalizedScore,
    rewardCoins,
    rankingPoints,
    startedAt: startedTs,
    finishedAt: finishedTs,
    metadata: economy.resolvedMetadata,
    detalhes: economy.resolvedMetadata,
    antiSpamToken: null,
    criadoEm: FieldValue.serverTimestamp(),
  };

  const batch = db.batch();
  batch.set(matchRef, matchDoc);
  batch.update(userRef, {
    totalPartidas: FieldValue.increment(1),
    totalVitorias: FieldValue.increment(win ? 1 : 0),
    totalDerrotas: FieldValue.increment(loss ? 1 : 0),
    coins: FieldValue.increment(rewardCoins),
    xp: FieldValue.increment(win ? 15 : effectiveResult === "empate" ? 8 : 5),
    atualizadoEm: FieldValue.serverTimestamp(),
    matchBurst: burstR.burst,
    [`gameCooldownUntil.${gameId}`]: cooldownUntil,
  });
  await batch.commit();

  if (rewardCoins > 0) {
    await addWalletTx({
      userId: uid,
      tipo: "jogo",
      moeda: "coins",
      valor: rewardCoins,
      saldoApos: newCoins,
      descricao: `Minijogo ${gameId}`,
      referenciaId: matchRef.id,
    });
  }

  await upsertRanking({
    uid,
    nome: String(u.nome || "Jogador"),
    username: String(u.username || "") || null,
    foto: (u.foto as string | null) ?? null,
    deltaScore: rankingPoints,
    win,
    gameId,
  });

  await bumpPlayMatchMissions(uid);
  await evaluateReferralForUser(uid);

  return {
    matchId: matchRef.id,
    rewardCoins,
    rankingPoints,
    normalizedScore: economy.normalizedScore,
  };
});

export const claimMissionReward = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  const missionId = String(request.data?.missionId || "");
  if (!missionId) throw new HttpsError("invalid-argument", "missionId obrigatório.");
  const missionRef = db.doc(`${COL.missions}/${missionId}`);
  const progRef = db.doc(`${COL.userMissions}/${uid}/daily/${missionId}`);
  const userRef = db.doc(`${COL.users}/${uid}`);
  await db.runTransaction(async (tx) => {
    const [mSnap, pSnap, uSnap] = await Promise.all([
      tx.get(missionRef),
      tx.get(progRef),
      tx.get(userRef),
    ]);
    if (!mSnap.exists) throw new HttpsError("not-found", "Missão inexistente.");
    if (!pSnap.exists || !pSnap.data()?.concluida) {
      throw new HttpsError("failed-precondition", "Missão não concluída.");
    }
    if (pSnap.data()?.recompensaResgatada) {
      throw new HttpsError("already-exists", "Recompensa já resgatada.");
    }
    if (!uSnap.exists) throw new HttpsError("failed-precondition", "Perfil inexistente.");

    const m = mSnap.data()!;
    const u = uSnap.data()!;
    if (u.banido) throw new HttpsError("permission-denied", "Conta suspensa.");

    const c = Number(m.recompensaCoins || 0);
    const g = Number(m.recompensaGems || 0);
    const xp = Number(m.recompensaXP || 0);
    const currentCoins = Number(u.coins || 0);
    const currentGems = Number(u.gems || 0);
    const periodKey = String(pSnap.data()?.periodoChave || dailyKey());

    tx.update(userRef, {
      coins: FieldValue.increment(c),
      gems: FieldValue.increment(g),
      xp: FieldValue.increment(xp),
      totalMissionRewardsClaimed: FieldValue.increment(1),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    tx.update(progRef, {
      recompensaResgatada: true,
      atualizadoEm: FieldValue.serverTimestamp(),
    });

    if (c > 0) {
      addWalletTxInTx(tx, {
        id: `mission_${uid}_${missionId}_${periodKey}_coins`,
        userId: uid,
        tipo: "missao",
        moeda: "coins",
        valor: c,
        saldoApos: currentCoins + c,
        descricao: `Missão: ${m.titulo || missionId}`,
        referenciaId: missionId,
      });
    }
    if (g > 0) {
      addWalletTxInTx(tx, {
        id: `mission_${uid}_${missionId}_${periodKey}_gems`,
        userId: uid,
        tipo: "missao",
        moeda: "gems",
        valor: g,
        saldoApos: currentGems + g,
        descricao: `Missão: ${m.titulo || missionId} (TICKET)`,
        referenciaId: missionId,
      });
    }
  });

  await evaluateReferralForUser(uid);
  return { ok: true };
});

export const requestRewardClaim = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  const valor = Math.floor(Number(request.data?.valor));
  const tipo = String(request.data?.tipo || "pix");
  const chavePix = String(request.data?.chavePix || "").trim();
  if (!Number.isFinite(valor) || valor <= 0 || !chavePix) {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }

  const userRef = db.doc(`${COL.users}/${uid}`);
  const ref = db.collection(COL.rewardClaims).doc();

  await db.runTransaction(async (tx) => {
    const uSnap = await tx.get(userRef);
    if (!uSnap.exists) throw new HttpsError("failed-precondition", "Perfil inexistente.");
    const u = uSnap.data()!;
    const bal = Number(u.rewardBalance || 0);
    if (valor > bal) {
      throw new HttpsError("failed-precondition", "Saldo insuficiente.");
    }
    tx.update(userRef, {
      rewardBalance: FieldValue.increment(-valor),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    tx.set(ref, {
      id: ref.id,
      userId: uid,
      valor,
      tipo,
      chavePix,
      status: "pendente",
      retencaoAplicada: true,
      analisadoPor: null,
      motivoRecusa: null,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
  });

  const after = await userRef.get();
  const saldoApos = Number(after.data()?.rewardBalance ?? 0);
  await addWalletTx({
    userId: uid,
    tipo: "resgate_pendente",
    moeda: "rewardBalance",
    valor: -valor,
    saldoApos,
    descricao: "Retenção para saque PIX (em análise)",
    referenciaId: ref.id,
  });

  return { claimId: ref.id };
});

const ADMIN_GRANT_ECONOMY_MAX = 5_000_000;

export const adminGrantEconomy = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const adminUid = request.auth?.uid;
  assertAuthed(adminUid);
  await assertAdmin(adminUid);

  const lookup = String(request.data?.lookup || "username").toLowerCase();
  const value = String(request.data?.value || "").trim();
  const kind = String(request.data?.kind || "") as "coins" | "gems" | "rewardBalance";
  const amount = Math.floor(Number(request.data?.amount));

  if (!["username", "uid"].includes(lookup)) {
    throw new HttpsError("invalid-argument", "lookup deve ser username ou uid.");
  }
  if (!value) {
    throw new HttpsError("invalid-argument", "Informe username ou UID.");
  }
  if (!["coins", "gems", "rewardBalance"].includes(kind)) {
    throw new HttpsError("invalid-argument", "kind inválido: coins (PR), gems (TICKET) ou rewardBalance (CASH).");
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > ADMIN_GRANT_ECONOMY_MAX) {
    throw new HttpsError("invalid-argument", "Quantidade inválida.");
  }

  let targetUid = "";
  if (lookup === "uid") {
    const ref = db.doc(`${COL.users}/${value}`);
    const s = await ref.get();
    if (!s.exists) throw new HttpsError("not-found", "UID não encontrado em users.");
    targetUid = value;
  } else {
    const un = value.toLowerCase().replace(/^@/, "");
    const q = await db.collection(COL.users).where("username", "==", un).limit(1).get();
    if (q.empty) throw new HttpsError("not-found", "Username não encontrado.");
    targetUid = q.docs[0].id;
  }

  const userRef = db.doc(`${COL.users}/${targetUid}`);
  const uSnap = await userRef.get();
  if (!uSnap.exists) throw new HttpsError("failed-precondition", "Perfil inexistente.");
  const u = uSnap.data()!;
  if (u.banido) throw new HttpsError("permission-denied", "Conta suspensa.");

  const field = kind === "coins" ? "coins" : kind === "gems" ? "gems" : "rewardBalance";
  const before =
    kind === "coins"
      ? Number(u.coins ?? 0)
      : kind === "gems"
        ? Number(u.gems ?? 0)
        : Number(u.rewardBalance ?? 0);
  const after = before + amount;

  await userRef.update({
    [field]: FieldValue.increment(amount),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  const moeda: "coins" | "gems" | "rewardBalance" =
    kind === "coins" ? "coins" : kind === "gems" ? "gems" : "rewardBalance";
  const label = kind === "coins" ? "PR" : kind === "gems" ? "TICKET" : "CASH";
  await addWalletTx({
    userId: targetUid,
    tipo: "bonus_admin",
    moeda,
    valor: amount,
    saldoApos: after,
    descricao: `Crédito admin: +${amount} ${label}`,
    referenciaId: adminUid,
  });

  return { ok: true, targetUid, field, newBalance: after };
});

export const reviewRewardClaim = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  await assertAdmin(uid);
  const claimId = String(request.data?.claimId || "");
  const status = String(request.data?.status || "") as "aprovado" | "recusado";
  if (!claimId || !["aprovado", "recusado"].includes(status)) {
    throw new HttpsError("invalid-argument", "Parâmetros inválidos.");
  }

  const ref = db.doc(`${COL.rewardClaims}/${claimId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Pedido inexistente.");
  const c = snap.data()!;
  if (c.status !== "pendente") throw new HttpsError("failed-precondition", "Já analisado.");

  const userRef = db.doc(`${COL.users}/${c.userId}`);
  const valorN = Number(c.valor);
  const retencao = c.retencaoAplicada === true;

  if (status === "aprovado") {
    await db.runTransaction(async (tx) => {
      const claimSnap = await tx.get(ref);
      if (!claimSnap.exists) throw new HttpsError("not-found", "Pedido inexistente.");
      const cur = claimSnap.data()!;
      if (cur.status !== "pendente") throw new HttpsError("failed-precondition", "Já analisado.");
      const comRetencao = cur.retencaoAplicada === true;

      if (comRetencao) {
        tx.update(ref, {
          status: "aprovado",
          analisadoPor: uid,
          atualizadoEm: FieldValue.serverTimestamp(),
        });
      } else {
        const uSnap = await tx.get(userRef);
        const bal = Number(uSnap.data()?.rewardBalance || 0);
        if (bal < valorN) throw new HttpsError("failed-precondition", "Saldo alterado.");
        tx.update(userRef, {
          rewardBalance: FieldValue.increment(-valorN),
          atualizadoEm: FieldValue.serverTimestamp(),
        });
        tx.update(ref, {
          status: "aprovado",
          analisadoPor: uid,
          atualizadoEm: FieldValue.serverTimestamp(),
        });
      }
    });
    // Pedidos com retenção já têm extrato em `resgate_pendente`; não duplicar linha no aprove.
    if (!retencao) {
      const after = await userRef.get();
      const saldoApos = Number(after.data()?.rewardBalance ?? 0);
      await addWalletTx({
        userId: c.userId,
        tipo: "resgate",
        moeda: "rewardBalance",
        valor: -valorN,
        saldoApos,
        descricao: "Resgate aprovado",
        referenciaId: claimId,
      });
    }
  } else {
    await db.runTransaction(async (tx) => {
      const claimSnap = await tx.get(ref);
      if (!claimSnap.exists) throw new HttpsError("not-found", "Pedido inexistente.");
      const cur = claimSnap.data()!;
      if (cur.status !== "pendente") throw new HttpsError("failed-precondition", "Já analisado.");
      const comRetencao = cur.retencaoAplicada === true;

      if (comRetencao) {
        tx.update(userRef, {
          rewardBalance: FieldValue.increment(valorN),
          atualizadoEm: FieldValue.serverTimestamp(),
        });
      }
      tx.update(ref, {
        status: "recusado",
        analisadoPor: uid,
        motivoRecusa: String(request.data?.motivo || ""),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
    });
    if (retencao) {
      const after = await userRef.get();
      const saldoApos = Number(after.data()?.rewardBalance ?? 0);
      await addWalletTx({
        userId: c.userId,
        tipo: "ajuste",
        moeda: "rewardBalance",
        valor: valorN,
        saldoApos,
        descricao: "Estorno CASH — saque recusado",
        referenciaId: claimId,
      });
    }
  }

  return { ok: true };
});

function isAllowedComprovanteUrl(raw: string): boolean {
  const u = raw.trim();
  if (u.length < 16 || u.length > 2048) return false;
  try {
    const parsed = new URL(u);
    if (parsed.protocol === "https:") return true;

    const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST?.trim();
    if (!emulatorHost || parsed.protocol !== "http:") return false;

    return parsed.host === emulatorHost;
  } catch {
    return false;
  }
}

/** Admin: após aprovar, envia URL do comprovante (upload no Storage pelo cliente) e marca como confirmado. */
export const confirmRewardClaimPix = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  await assertAdmin(uid);
  const claimId = String(request.data?.claimId || "");
  const comprovanteUrl = String(request.data?.comprovanteUrl || "").trim();
  if (!claimId || !comprovanteUrl || !isAllowedComprovanteUrl(comprovanteUrl)) {
    throw new HttpsError("invalid-argument", "claimId e comprovanteUrl valido do Storage sao obrigatorios.");
  }

  const ref = db.doc(`${COL.rewardClaims}/${claimId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Pedido inexistente.");
  const c = snap.data()!;
  if (c.status !== "aprovado") {
    throw new HttpsError("failed-precondition", "Só é possível confirmar PIX de pedidos aprovados.");
  }

  await ref.update({
    status: "confirmado",
    comprovanteUrl,
    confirmadoPor: uid,
    confirmadoEm: FieldValue.serverTimestamp(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

const CONVERT_MAX_UNITS_PER_CALL = 10_000;

export const convertCurrency = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  const direction = String(request.data?.direction || "");
  const amount = Math.floor(Number(request.data?.amount));
  if (direction !== "coins_to_gems" && direction !== "gems_to_coins") {
    throw new HttpsError("invalid-argument", "Direção inválida (use coins_to_gems ou gems_to_coins).");
  }
  if (!Number.isFinite(amount) || amount < 1 || amount > CONVERT_MAX_UNITS_PER_CALL) {
    throw new HttpsError("invalid-argument", "Quantidade inválida.");
  }

  const economy = await getEconomy();
  const coinsPerGemBuy = economy.conversionCoinsPerGemBuy;
  const coinsPerGemSell = economy.conversionCoinsPerGemSell;

  const userRef = db.doc(`${COL.users}/${uid}`);

  const out = await db.runTransaction(async (tx) => {
    const uSnap = await tx.get(userRef);
    if (!uSnap.exists) throw new HttpsError("failed-precondition", "Perfil inexistente.");
    const u = uSnap.data()!;
    if (u.banido) throw new HttpsError("permission-denied", "Conta suspensa.");

    const coins = Number(u.coins ?? 0);
    const gems = Number(u.gems ?? 0);

    if (direction === "coins_to_gems") {
      const cost = amount * coinsPerGemBuy;
      if (!Number.isSafeInteger(cost) || cost < 1) {
        throw new HttpsError("failed-precondition", "Taxa de conversão inválida.");
      }
      if (coins < cost) throw new HttpsError("failed-precondition", "PR insuficientes.");
      const newCoins = coins - cost;
      const newGems = gems + amount;
      tx.update(userRef, {
        coins: FieldValue.increment(-cost),
        gems: FieldValue.increment(amount),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      return {
        direction: "coins_to_gems" as const,
        cost,
        gemsBought: amount,
        newCoins,
        newGems,
      };
    }

    if (coinsPerGemSell < 1) {
      throw new HttpsError(
        "failed-precondition",
        "Conversão de TICKET para PR está desativada (ajuste conversionCoinsPerGemSell na economia).",
      );
    }
    const payout = amount * coinsPerGemSell;
    if (!Number.isSafeInteger(payout) || payout < 1) {
      throw new HttpsError("failed-precondition", "Taxa de conversão inválida.");
    }
    if (gems < amount) throw new HttpsError("failed-precondition", "Saldo de TICKET insuficiente.");
    const newCoins = coins + payout;
    const newGems = gems - amount;
    tx.update(userRef, {
      coins: FieldValue.increment(payout),
      gems: FieldValue.increment(-amount),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    return {
      direction: "gems_to_coins" as const,
      payout,
      gemsSold: amount,
      newCoins,
      newGems,
    };
  });

  if (out.direction === "coins_to_gems") {
    await addWalletTx({
      userId: uid,
      tipo: "conversao",
      moeda: "coins",
      valor: -out.cost,
      saldoApos: out.newCoins,
      descricao: `Conversão: ${out.cost} PR → ${out.gemsBought} TICKET`,
    });
    await addWalletTx({
      userId: uid,
      tipo: "conversao",
      moeda: "gems",
      valor: out.gemsBought,
      saldoApos: out.newGems,
      descricao: `Conversão: +${out.gemsBought} TICKET`,
    });
  } else if (out.direction === "gems_to_coins") {
    await addWalletTx({
      userId: uid,
      tipo: "conversao",
      moeda: "gems",
      valor: -out.gemsSold,
      saldoApos: out.newGems,
      descricao: `Conversão: ${out.gemsSold} TICKET → ${out.payout} PR`,
    });
    await addWalletTx({
      userId: uid,
      tipo: "conversao",
      moeda: "coins",
      valor: out.payout,
      saldoApos: out.newCoins,
      descricao: `Conversão: +${out.payout} PR`,
    });
  }

  return { ok: true, ...out };
});

export const processReferralReward = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  await evaluateReferralForUser(uid);
  const referralSnap = await db.doc(`${COL.referrals}/${uid}`).get();
  if (!referralSnap.exists) {
    return { ok: false, reason: "no_referral" };
  }
  const referral = referralSnap.data() as Record<string, unknown>;
  return {
    ok: true,
    status: String(referral.status || "pending"),
    qualified: referral.referralQualified === true,
    rewarded: referral.referralRewardGiven === true,
  };
});

export const adminReprocessReferral = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  await assertAdmin(uid);

  const referralId = String(request.data?.referralId || "").trim();
  if (!referralId) {
    throw new HttpsError("invalid-argument", "referralId obrigatório.");
  }

  const referralRef = db.doc(`${COL.referrals}/${referralId}`);
  const beforeSnap = await referralRef.get();
  if (!beforeSnap.exists) {
    throw new HttpsError("not-found", "Indicação não encontrada.");
  }

  const referral = beforeSnap.data() as Record<string, unknown>;
  const invitedUid = String(referral.invitedUserId || "");
  if (!invitedUid) {
    throw new HttpsError("failed-precondition", "Indicação sem convidado vinculado.");
  }

  await evaluateReferralForUser(invitedUid);

  const afterSnap = await referralRef.get();
  const after = (afterSnap.data() || {}) as Record<string, unknown>;

  return {
    ok: true,
    referralId,
    status: String(after.status || "pending"),
    qualified: after.referralQualified === true,
    rewarded: after.referralRewardGiven === true,
  };
});

export const adminReviewReferral = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  await assertAdmin(uid);
  const referralId = String(request.data?.referralId || "").trim();
  const action = String(request.data?.action || "").trim();
  if (!referralId || !["block", "mark_valid", "reward"].includes(action)) {
    throw new HttpsError("invalid-argument", "referralId/action inválidos.");
  }

  const referralConfig = await getReferralConfig();
  const campaign = await getActiveReferralCampaign(referralConfig);
  const referralRef = db.doc(`${COL.referrals}/${referralId}`);

  await db.runTransaction(async (tx) => {
    const referralSnap = await tx.get(referralRef);
    if (!referralSnap.exists) throw new HttpsError("not-found", "Indicação não encontrada.");
    const referral = referralSnap.data() as Record<string, unknown>;
    const inviterUid = String(referral.inviterUserId || "");
    const invitedUid = String(referral.invitedUserId || "");
    if (!inviterUid || !invitedUid) throw new HttpsError("failed-precondition", "Dados da indicação inválidos.");

    const inviterRef = db.doc(`${COL.users}/${inviterUid}`);
    const invitedRef = db.doc(`${COL.users}/${invitedUid}`);
    const [inviterSnap, invitedSnap] = await Promise.all([tx.get(inviterRef), tx.get(invitedRef)]);
    if (!inviterSnap.exists || !invitedSnap.exists) {
      throw new HttpsError("failed-precondition", "Usuários da indicação não encontrados.");
    }
    const inviterData = inviterSnap.data() as Record<string, unknown>;
    const invitedData = invitedSnap.data() as Record<string, unknown>;
    const status = String(referral.status || "pending") as ReferralStatus;

    if (action === "block") {
      tx.update(referralRef, {
        status: "blocked",
        referralStatus: "blocked",
        updatedAt: FieldValue.serverTimestamp(),
        "fraudFlags.manualReviewRequired": false,
        notes: "Bloqueado manualmente pelo admin.",
      });
      if (status === "pending") {
        tx.update(inviterRef, {
          referralPendingCount: FieldValue.increment(-1),
          referralBlockedCount: FieldValue.increment(1),
          atualizadoEm: FieldValue.serverTimestamp(),
        });
        await upsertReferralRankingEntry(
          tx,
          inviterUid,
          String(inviterData.nome || "Jogador"),
          (inviterData.foto as string | null) ?? null,
          { pending: -1, blocked: 1 },
        );
      }
      tx.update(invitedRef, { referralStatus: "blocked", atualizadoEm: FieldValue.serverTimestamp() });
      return;
    }

    if (action === "mark_valid" && status === "pending") {
      tx.update(referralRef, {
        status: "valid",
        referralStatus: "valid",
        referralQualified: true,
        qualifiedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        notes: "Validado manualmente pelo admin.",
      });
      tx.update(inviterRef, {
        referralPendingCount: FieldValue.increment(-1),
        referralQualifiedCount: FieldValue.increment(1),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      tx.update(invitedRef, { referralStatus: "valid", atualizadoEm: FieldValue.serverTimestamp() });
      await upsertReferralRankingEntry(
        tx,
        inviterUid,
        String(inviterData.nome || "Jogador"),
        (inviterData.foto as string | null) ?? null,
        { pending: -1, valid: 1 },
      );
      return;
    }

    if (action === "reward" && status !== "rewarded") {
      const inviterReward: RewardValue = {
        amount: Math.max(
          0,
          Number(
            referral.inviterRewardAmount ??
              referral.inviterRewardCoins ??
              campaign?.config.inviterRewardAmount ??
              referralConfig.defaultInviterRewardAmount ??
              0,
          ),
        ),
        currency: normalizeRewardCurrency(
          referral.inviterRewardCurrency ?? campaign?.config.inviterRewardCurrency,
          referralConfig.defaultInviterRewardCurrency,
        ),
      };
      const invitedReward: RewardValue =
        campaign?.config.invitedRewardEnabled ?? referralConfig.invitedRewardEnabled
          ? {
              amount: Math.max(
                0,
                Number(
                  referral.invitedRewardAmount ??
                    referral.invitedRewardCoins ??
                    campaign?.config.invitedRewardAmount ??
                    referralConfig.defaultInvitedRewardAmount ??
                    0,
                ),
              ),
              currency: normalizeRewardCurrency(
                referral.invitedRewardCurrency ?? campaign?.config.invitedRewardCurrency,
                referralConfig.defaultInvitedRewardCurrency,
              ),
            }
          : { amount: 0, currency: referralConfig.defaultInvitedRewardCurrency };
      const inviterRewardPatch = applyRewardPatch(inviterData, inviterReward);
      const invitedRewardPatch = applyRewardPatch(invitedData, invitedReward);
      tx.update(referralRef, {
        status: "rewarded",
        referralStatus: "rewarded",
        referralQualified: true,
        referralRewardGiven: true,
        qualifiedAt: referral.qualifiedAt ?? FieldValue.serverTimestamp(),
        rewardedAt: FieldValue.serverTimestamp(),
        inviterRewardAmount: inviterReward.amount,
        inviterRewardCurrency: inviterReward.currency,
        invitedRewardAmount: invitedReward.amount,
        invitedRewardCurrency: invitedReward.currency,
        inviterRewardCoins: inviterReward.currency === "coins" ? inviterReward.amount : 0,
        invitedRewardCoins: invitedReward.currency === "coins" ? invitedReward.amount : 0,
        inviterRewardGrantedAt: FieldValue.serverTimestamp(),
        invitedRewardGrantedAt: invitedReward.amount > 0 ? FieldValue.serverTimestamp() : null,
        updatedAt: FieldValue.serverTimestamp(),
        notes: "Recompensa concedida manualmente pelo admin.",
      });
      tx.update(inviterRef, {
        ...inviterRewardPatch.patch,
        referralPendingCount: FieldValue.increment(status === "pending" ? -1 : 0),
        referralQualifiedCount: FieldValue.increment(status === "pending" ? 1 : 0),
        referralRewardedCount: FieldValue.increment(1),
        referralInvitedCount: FieldValue.increment(1),
        ...(inviterReward.currency === "coins"
          ? { referralTotalEarnedCoins: FieldValue.increment(inviterReward.amount) }
          : inviterReward.currency === "gems"
            ? { referralTotalEarnedGems: FieldValue.increment(inviterReward.amount) }
            : { referralTotalEarnedRewardBalance: FieldValue.increment(inviterReward.amount) }),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      tx.update(invitedRef, {
        ...invitedRewardPatch.patch,
        referralBonusGranted: true,
        referralStatus: "rewarded",
        ...(invitedReward.currency === "coins"
          ? { referralInvitedRewardCoins: FieldValue.increment(invitedReward.amount) }
          : invitedReward.currency === "gems"
            ? { referralInvitedRewardGems: FieldValue.increment(invitedReward.amount) }
            : { referralInvitedRewardBalance: FieldValue.increment(invitedReward.amount) }),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      addWalletTxInTx(tx, {
        id: `referral_inviter_${inviterUid}_${invitedUid}`,
        userId: inviterUid,
        tipo: "referral",
        moeda: inviterReward.currency,
        valor: inviterReward.amount,
        saldoApos: inviterRewardPatch.balanceAfter,
        descricao: `Indicação recompensada manualmente · ${rewardCurrencyLabel(inviterReward.currency)}`,
        referenciaId: invitedUid,
      });
      if (invitedReward.amount > 0) {
        addWalletTxInTx(tx, {
          id: `referral_invited_${invitedUid}_${inviterUid}`,
          userId: invitedUid,
          tipo: "referral",
          moeda: invitedReward.currency,
          valor: invitedReward.amount,
          saldoApos: invitedRewardPatch.balanceAfter,
          descricao: `Bônus manual de indicação · ${rewardCurrencyLabel(invitedReward.currency)}`,
          referenciaId: inviterUid,
        });
      }
      await upsertReferralRankingEntry(
        tx,
        inviterUid,
        String(inviterData.nome || "Jogador"),
        (inviterData.foto as string | null) ?? null,
        {
          pending: status === "pending" ? -1 : 0,
          valid: status === "pending" ? 1 : 0,
          rewarded: 1,
          rewards: inviterReward.amount,
        },
      );
    }
  });

  return { ok: true };
});

function waitingColl(gameId: string) {
  return db.collection(`${COL.matchmakingQueue}/${gameId}/waiting`);
}

function slotRef(uid: string) {
  return db.doc(`${COL.multiplayerSlots}/${uid}`);
}

/** Fila automática 1v1: entra na fila e tenta emparelhar com o jogador mais antigo. */
export const joinAutoMatch = onCall(MULTIPLAYER_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  const gameId = request.data?.gameId as GameId;
  if (!gameId || !AUTO_QUEUE_GAMES.has(gameId)) {
    throw new HttpsError("invalid-argument", "Jogo não suporta fila automática.");
  }

  const userRef = db.doc(`${COL.users}/${uid}`);
  let uSnap = await userRef.get();
  if (!uSnap.exists) throw new HttpsError("failed-precondition", "Perfil inexistente.");
  let u = uSnap.data()!;
  if (u.banido) throw new HttpsError("permission-denied", "Conta suspensa.");

  if (gameId === "ppt") {
    await tryApplyPptTimedRefillForUser(uid);
    uSnap = await userRef.get();
    u = uSnap.data()!;
  }
  if (gameId === "quiz") {
    await tryApplyQuizTimedRefillForUser(uid);
    uSnap = await userRef.get();
    u = uSnap.data()!;
  }
  if (gameId === "reaction_tap") {
    await tryApplyReactionTimedRefillForUser(uid);
    uSnap = await userRef.get();
    u = uSnap.data()!;
  }

  if (gameId === "ppt") {
    const charges = readPptDuelCharges(u as Record<string, unknown>);
    if (charges < 1) {
      throw new HttpsError(
        "resource-exhausted",
        "Sem duelos PvP. Assista a um anúncio (+3) ou aguarde 10 minutos para recuperar 3 duelos.",
      );
    }
  }
  if (gameId === "quiz") {
    const charges = readQuizDuelCharges(u as Record<string, unknown>);
    if (charges < 1) {
      throw new HttpsError(
        "resource-exhausted",
        "Sem duelos PvP de Quiz. Assista a um anúncio (+3) ou aguarde 10 minutos para recuperar 3 duelos.",
      );
    }
  }
  if (gameId === "reaction_tap") {
    const charges = readReactionDuelCharges(u as Record<string, unknown>);
    if (charges < 1) {
      throw new HttpsError(
        "resource-exhausted",
        "Sem duelos PvP de Reaction Tap. Assista a um anúncio (+3) ou aguarde 10 minutos para recuperar 3 duelos.",
      );
    }
  }

  const nome = String(u.nome || "Jogador");
  const foto = u.foto ?? null;
  const coll = waitingColl(gameId);
  const mySlot = slotRef(uid);

  const existingSlot = await mySlot.get();
  const slotData = existingSlot.data() as {
    roomId?: string | null;
    queueStatus?: string;
    gameId?: string;
  } | undefined;
  if (slotData?.roomId && slotData.queueStatus === "matched") {
    const roomSnap = await db.doc(`${COL.gameRooms}/${slotData.roomId}`).get();
    if (roomSnap.exists) {
      const r = roomSnap.data() as {
        status?: string;
        phase?: string;
        gameId?: string;
        hostUid?: string;
        guestUid?: string;
        pptRewardsApplied?: boolean;
      };
      const slotGame = slotData.gameId;
      const roomGame = r.gameId;
      const sameGameAsRequest =
        roomGame === gameId && (slotGame === gameId || slotGame === undefined || slotGame === roomGame);
      /** Sala já encerrada mas slot antigo — não reabrir; permite nova fila e novo débito de duelo. */
      const roomClearlyEnded =
        r.status === "completed" ||
        r.phase === "completed" ||
        Boolean(r.pptRewardsApplied);
      const roomActive =
        !roomClearlyEnded && (r.status === "matched" || r.status === "playing");
      const isParticipant = r.hostUid === uid || r.guestUid === uid;
      if (roomActive && sameGameAsRequest && isParticipant) {
        return {
          status: "matched" as const,
          roomId: slotData.roomId,
          hostUid: r.hostUid,
          guestUid: r.guestUid,
          yourSeat: r.hostUid === uid ? 0 : 1,
        };
      }
    }
    // Outro jogo, sala encerrada/inexistente, ou você não participa — libera para fila do jogo pedido.
    await mySlot.set(
      {
        uid,
        gameId,
        queueStatus: "idle",
        roomId: null,
        atualizadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  await mySlot.set(
    {
      uid,
      gameId,
      queueStatus: "waiting",
      roomId: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const waitRef = coll.doc(uid);
  const waitSnap = await waitRef.get();
  if (!waitSnap.exists) {
    await waitRef.set({
      uid,
      nome,
      foto,
      joinedAt: FieldValue.serverTimestamp(),
    });
  }

  const snap = await coll.orderBy("joinedAt", "asc").limit(2).get();
  const others = snap.docs.filter((d) => d.id !== uid);
  const partnerDoc = others[0];
  if (!partnerDoc) {
    return { status: "waiting" as const };
  }

  const partnerId = partnerDoc.id;
  const roomRef = db.collection(COL.gameRooms).doc();

  const econMatch = await getEconomy();
  const pptMatchWinMs = pvpChoiceWindowMs(econMatch.pvpChoiceSeconds, "ppt");
  const quizMatchWinMs = pvpChoiceWindowMs(econMatch.pvpChoiceSeconds, "quiz");
  const reactionMatchWinMs = pvpChoiceWindowMs(econMatch.pvpChoiceSeconds, "reaction_tap");

  try {
    const result = await db.runTransaction(async (tx) => {
      const selfW = coll.doc(uid);
      const pW = coll.doc(partnerId);
      const [selfSnap, pSnap] = await Promise.all([tx.get(selfW), tx.get(pW)]);
      if (!selfSnap.exists || !pSnap.exists) {
        return null;
      }
      const ja = selfSnap.data()!.joinedAt as Timestamp;
      const jb = pSnap.data()!.joinedAt as Timestamp;
      const host = ja.toMillis() <= jb.toMillis() ? uid : partnerId;
      const guest = host === uid ? partnerId : uid;
      const hostData = host === uid ? selfSnap.data()! : pSnap.data()!;
      const guestData = host === uid ? pSnap.data()! : selfSnap.data()!;

      const hostUserRef = db.doc(`${COL.users}/${host}`);
      const guestUserRef = db.doc(`${COL.users}/${guest}`);
      const [hostUSnap, guestUSnap] = await Promise.all([
        tx.get(hostUserRef),
        tx.get(guestUserRef),
      ]);
      if (!hostUSnap.exists || !guestUSnap.exists) {
        return null;
      }
      const hu = hostUSnap.data()!;
      const gu = guestUSnap.data()!;
      if (hu.banido || gu.banido) {
        return null;
      }
      let pptHostC = 0;
      let pptGuestC = 0;
      let quizHostC = 0;
      let quizGuestC = 0;
      let reactionHostC = 0;
      let reactionGuestC = 0;
      if (gameId === "ppt") {
        pptHostC = await ensurePptChargesRefilledInTx(tx, hostUserRef, hostUSnap);
        pptGuestC = await ensurePptChargesRefilledInTx(tx, guestUserRef, guestUSnap);
        if (pptHostC < 1) {
          tx.delete(coll.doc(host));
          tx.set(
            slotRef(host),
            {
              uid: host,
              gameId,
              queueStatus: "idle",
              roomId: null,
              atualizadoEm: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
        if (pptGuestC < 1) {
          tx.delete(coll.doc(guest));
          tx.set(
            slotRef(guest),
            {
              uid: guest,
              gameId,
              queueStatus: "idle",
              roomId: null,
              atualizadoEm: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
        if (pptHostC < 1 || pptGuestC < 1) {
          return null;
        }
      }
      if (gameId === "reaction_tap") {
        reactionHostC = await ensureReactionChargesRefilledInTx(tx, hostUserRef, hostUSnap);
        reactionGuestC = await ensureReactionChargesRefilledInTx(tx, guestUserRef, guestUSnap);
        if (reactionHostC < 1) {
          tx.delete(coll.doc(host));
          tx.set(
            slotRef(host),
            {
              uid: host,
              gameId,
              queueStatus: "idle",
              roomId: null,
              atualizadoEm: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
        if (reactionGuestC < 1) {
          tx.delete(coll.doc(guest));
          tx.set(
            slotRef(guest),
            {
              uid: guest,
              gameId,
              queueStatus: "idle",
              roomId: null,
              atualizadoEm: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
        if (reactionHostC < 1 || reactionGuestC < 1) {
          return null;
        }
      }
      if (gameId === "quiz") {
        quizHostC = await ensureQuizChargesRefilledInTx(tx, hostUserRef, hostUSnap);
        quizGuestC = await ensureQuizChargesRefilledInTx(tx, guestUserRef, guestUSnap);
        if (quizHostC < 1) {
          tx.delete(coll.doc(host));
          tx.set(
            slotRef(host),
            {
              uid: host,
              gameId,
              queueStatus: "idle",
              roomId: null,
              atualizadoEm: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
        if (quizGuestC < 1) {
          tx.delete(coll.doc(guest));
          tx.set(
            slotRef(guest),
            {
              uid: guest,
              gameId,
              queueStatus: "idle",
              roomId: null,
              atualizadoEm: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
        if (quizHostC < 1 || quizGuestC < 1) {
          return null;
        }
      }

      tx.delete(selfW);
      tx.delete(pW);
      const initialQuizQuestion = gameId === "quiz" ? await pickQuizQuestion() : null;
      const reactionGoLiveAt = gameId === "reaction_tap" ? nextReactionGoLiveAt() : null;
      const initialActionDeadlineAt =
        gameId === "reaction_tap" && reactionGoLiveAt
          ? pvpActionDeadlineTs(reactionGoLiveAt.toMillis(), reactionMatchWinMs)
          : pvpActionDeadlineTs(
              Date.now(),
              gameId === "ppt" ? pptMatchWinMs : gameId === "quiz" ? quizMatchWinMs : reactionMatchWinMs,
            );
      tx.set(roomRef, {
        id: roomRef.id,
        gameId,
        hostUid: host,
        guestUid: guest,
        hostNome: String(hostData.nome || "Jogador"),
        guestNome: String(guestData.nome || "Jogador"),
        hostFoto: hostData.foto ?? null,
        guestFoto: guestData.foto ?? null,
        status: "matched",
        phase: "lobby",
        ...(gameId === "ppt"
          ? {
              pptHostScore: 0,
              pptGuestScore: 0,
              pptTargetScore: PPT_MATCH_TARGET_POINTS,
              pptAwaitingBothPicks: true,
              pptRoundStartedAt: FieldValue.serverTimestamp(),
              pptConsecutiveEmptyRounds: 0,
            }
          : {}),
        ...(gameId === "quiz" && initialQuizQuestion
          ? {
              status: "playing",
              phase: "quiz_playing",
              quizHostScore: 0,
              quizGuestScore: 0,
              quizTargetScore: QUIZ_MATCH_TARGET_POINTS,
              quizRound: 1,
              quizQuestionId: initialQuizQuestion.id,
              quizQuestionText: initialQuizQuestion.q,
              quizOptions: initialQuizQuestion.options,
              quizAnsweredUids: [],
            }
          : {}),
        ...(gameId === "reaction_tap" && reactionGoLiveAt
          ? {
              status: "playing",
              phase: "reaction_waiting",
              reactionHostScore: 0,
              reactionGuestScore: 0,
              reactionTargetScore: REACTION_MATCH_TARGET_POINTS,
              reactionRound: 1,
              reactionGoLiveAt,
              reactionAnsweredUids: [],
            }
          : {}),
        timeoutEmptyRounds: 0,
        actionDeadlineAt: initialActionDeadlineAt,
        criadoEm: FieldValue.serverTimestamp(),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      tx.set(slotRef(host), {
        uid: host,
        gameId,
        queueStatus: "matched",
        roomId: roomRef.id,
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      tx.set(slotRef(guest), {
        uid: guest,
        gameId,
        queueStatus: "matched",
        roomId: roomRef.id,
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      if (gameId === "ppt") {
        const refillAt = Timestamp.fromMillis(Date.now() + PPT_DUEL_TIME_REFILL_MS);
        /** Valor explícito: `increment(-1)` com campo ausente no Firestore parte de 0 → -1 e quebra a leitura. */
        const nextHost = pptHostC - 1;
        const nextGuest = pptGuestC - 1;
        if (pptHostC === 1) {
          tx.update(hostUserRef, {
            pptPvPDuelsRemaining: nextHost,
            pptPvpDuelsRefillAvailableAt: refillAt,
            atualizadoEm: FieldValue.serverTimestamp(),
          });
        } else {
          tx.update(hostUserRef, {
            pptPvPDuelsRemaining: nextHost,
            pptPvpDuelsRefillAvailableAt: FieldValue.delete(),
            atualizadoEm: FieldValue.serverTimestamp(),
          });
        }
        if (pptGuestC === 1) {
          tx.update(guestUserRef, {
            pptPvPDuelsRemaining: nextGuest,
            pptPvpDuelsRefillAvailableAt: refillAt,
            atualizadoEm: FieldValue.serverTimestamp(),
          });
        } else {
          tx.update(guestUserRef, {
            pptPvPDuelsRemaining: nextGuest,
            pptPvpDuelsRefillAvailableAt: FieldValue.delete(),
            atualizadoEm: FieldValue.serverTimestamp(),
          });
        }
      }
      if (gameId === "quiz") {
        const refillAt = Timestamp.fromMillis(Date.now() + QUIZ_DUEL_TIME_REFILL_MS);
        const nextHost = quizHostC - 1;
        const nextGuest = quizGuestC - 1;
        if (quizHostC === 1) {
          tx.update(hostUserRef, {
            quizPvPDuelsRemaining: nextHost,
            quizPvpDuelsRefillAvailableAt: refillAt,
            atualizadoEm: FieldValue.serverTimestamp(),
          });
        } else {
          tx.update(hostUserRef, {
            quizPvPDuelsRemaining: nextHost,
            quizPvpDuelsRefillAvailableAt: FieldValue.delete(),
            atualizadoEm: FieldValue.serverTimestamp(),
          });
        }
        if (quizGuestC === 1) {
          tx.update(guestUserRef, {
            quizPvPDuelsRemaining: nextGuest,
            quizPvpDuelsRefillAvailableAt: refillAt,
            atualizadoEm: FieldValue.serverTimestamp(),
          });
        } else {
          tx.update(guestUserRef, {
            quizPvPDuelsRemaining: nextGuest,
            quizPvpDuelsRefillAvailableAt: FieldValue.delete(),
            atualizadoEm: FieldValue.serverTimestamp(),
          });
        }
      }
      if (gameId === "reaction_tap") {
        const refillAt = Timestamp.fromMillis(Date.now() + REACTION_DUEL_TIME_REFILL_MS);
        const nextHost = reactionHostC - 1;
        const nextGuest = reactionGuestC - 1;
        if (reactionHostC === 1) {
          tx.update(hostUserRef, {
            reactionPvPDuelsRemaining: nextHost,
            reactionPvpDuelsRefillAvailableAt: refillAt,
            atualizadoEm: FieldValue.serverTimestamp(),
          });
        } else {
          tx.update(hostUserRef, {
            reactionPvPDuelsRemaining: nextHost,
            reactionPvpDuelsRefillAvailableAt: FieldValue.delete(),
            atualizadoEm: FieldValue.serverTimestamp(),
          });
        }
        if (reactionGuestC === 1) {
          tx.update(guestUserRef, {
            reactionPvPDuelsRemaining: nextGuest,
            reactionPvpDuelsRefillAvailableAt: refillAt,
            atualizadoEm: FieldValue.serverTimestamp(),
          });
        } else {
          tx.update(guestUserRef, {
            reactionPvPDuelsRemaining: nextGuest,
            reactionPvpDuelsRefillAvailableAt: FieldValue.delete(),
            atualizadoEm: FieldValue.serverTimestamp(),
          });
        }
      }
      return { host, guest };
    });

    if (!result) {
      return { status: "waiting" as const };
    }

    return {
      status: "matched" as const,
      roomId: roomRef.id,
      hostUid: result.host,
      guestUid: result.guest,
      yourSeat: uid === result.host ? 0 : 1,
    };
  } catch {
    return { status: "waiting" as const };
  }
});

/** Agenda ou aplica recuperação de duelos por tempo (10 min); não entra na fila. */
export const pptSyncDuelRefill = onCall(DEFAULT_CALLABLE_OPTS, async (req) => {
  const uid = req.auth?.uid;
  assertAuthed(uid);
  await tryApplyPptTimedRefillForUser(uid);
  return { ok: true as const };
});

/** Agenda ou aplica recuperação de duelos Quiz por tempo (10 min); não entra na fila. */
export const quizSyncDuelRefill = onCall(DEFAULT_CALLABLE_OPTS, async (req) => {
  const uid = req.auth?.uid;
  assertAuthed(uid);
  await tryApplyQuizTimedRefillForUser(uid);
  return { ok: true as const };
});

/** Agenda ou aplica recuperação de duelos Reaction Tap por tempo (10 min); não entra na fila. */
export const reactionSyncDuelRefill = onCall(DEFAULT_CALLABLE_OPTS, async (req) => {
  const uid = req.auth?.uid;
  assertAuthed(uid);
  await tryApplyReactionTimedRefillForUser(uid);
  return { ok: true as const };
});

export const leaveAutoMatch = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  const gameId = request.data?.gameId as GameId;
  if (!gameId || !AUTO_QUEUE_GAMES.has(gameId)) {
    throw new HttpsError("invalid-argument", "Jogo inválido.");
  }
  const s = await slotRef(uid).get();
  const st = (s.data() as { queueStatus?: string } | undefined)?.queueStatus;
  if (st === "matched") {
    throw new HttpsError(
      "failed-precondition",
      "Você já foi pareado. Abra a sala ou aguarde o fim da partida.",
    );
  }
  await waitingColl(gameId).doc(uid).delete().catch(() => undefined);
  await slotRef(uid).set(
    {
      uid,
      gameId,
      queueStatus: "idle",
      roomId: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { ok: true };
});

/**
 * PPT 1v1 na sala: melhor de N pontos (`PPT_MATCH_TARGET_POINTS`); empate não encerra.
 * Economia / ranking / matches só ao término da partida.
 */
export const submitPptPick = onCall(MULTIPLAYER_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  const roomId = String(request.data?.roomId || "").trim();
  const hand = String(request.data?.hand || "").toLowerCase();
  const allowed = new Set(["pedra", "papel", "tesoura"]);
  if (!roomId || !allowed.has(hand)) {
    throw new HttpsError("invalid-argument", "roomId ou jogada inválidos.");
  }

  const roomRef = db.doc(`${COL.gameRooms}/${roomId}`);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) throw new HttpsError("not-found", "Sala inexistente.");
  const room = roomSnap.data() as {
    gameId?: string;
    hostUid?: string;
    guestUid?: string;
    phase?: string;
    pptRewardsApplied?: boolean;
  };
  if (room.gameId !== "ppt") {
    throw new HttpsError("failed-precondition", "Esta sala não é PPT.");
  }
  if (uid !== room.hostUid && uid !== room.guestUid) {
    throw new HttpsError("permission-denied", "Você não está nesta sala.");
  }
  if (room.pptRewardsApplied || room.phase === "completed") {
    throw new HttpsError("failed-precondition", "Partida já finalizada.");
  }

  const picksColl = roomRef.collection("ppt_picks");

  const hostPre = String(room.hostUid);
  const guestPre = String(room.guestUid);
  const [preH, preG] = await Promise.all([
    db.doc(`${COL.users}/${hostPre}`).get(),
    db.doc(`${COL.users}/${guestPre}`).get(),
  ]);
  if (!preH.exists || !preG.exists) {
    throw new HttpsError("failed-precondition", "Perfil ausente.");
  }
  if ((preH.data() as { banido?: boolean }).banido || (preG.data() as { banido?: boolean }).banido) {
    throw new HttpsError("permission-denied", "Conta suspensa.");
  }

  const econPpt = await getEconomy();
  const pptPickWindowMs = pvpChoiceWindowMs(econPpt.pvpChoiceSeconds, "ppt");

  /**
   * Uma única transação: grava a jogada do caller e, se o oponente já tiver jogado, resolve a rodada.
   * Evita corrida entre dois submits quase simultâneos (pick órfão + "já escolheu" para sempre).
   */
  const pptTxResult = await db.runTransaction(async (tx): Promise<false | "queued" | "round" | "match"> => {
    const rSnap = await tx.get(roomRef);
    const r = rSnap.data() as typeof room & {
      pptRewardsApplied?: boolean;
      pptHostScore?: number;
      pptGuestScore?: number;
      pptTargetScore?: number;
      actionDeadlineAt?: Timestamp;
    };
    if (!rSnap.exists || r.pptRewardsApplied || r.phase === "completed") return false;
    if (r.gameId !== "ppt") return false;
    if (millisFromFirestoreTime(r.actionDeadlineAt) > 0 && Date.now() > millisFromFirestoreTime(r.actionDeadlineAt)) {
      throw new HttpsError("failed-precondition", "Tempo da rodada esgotado.");
    }

    const hostUid = String(r.hostUid);
    const guestUid = String(r.guestUid);
    if (uid !== hostUid && uid !== guestUid) return false;

    const hPref = picksColl.doc(hostUid);
    const gPref = picksColl.doc(guestUid);
    const hostUserRef = db.doc(`${COL.users}/${hostUid}`);
    const guestUserRef = db.doc(`${COL.users}/${guestUid}`);

    const [hPSnap, gPSnap, hUSnap, gUSnap] = await Promise.all([
      tx.get(hPref),
      tx.get(gPref),
      tx.get(hostUserRef),
      tx.get(guestUserRef),
    ]);
    if (!hUSnap.exists || !gUSnap.exists) return false;
    const hu = hUSnap.data()!;
    const gu = gUSnap.data()!;
    if (hu.banido || gu.banido) return false;

    const myPref = uid === hostUid ? hPref : gPref;
    const pickedUids = new Set<string>(((r as { pptPickedUids?: unknown }).pptPickedUids as string[] | undefined) ?? []);
    const hostPickValid = hPSnap.exists && pickedUids.has(hostUid);
    const guestPickValid = gPSnap.exists && pickedUids.has(guestUid);
    if (hPSnap.exists && !hostPickValid) {
      tx.delete(hPref);
    }
    if (gPSnap.exists && !guestPickValid) {
      tx.delete(gPref);
    }

    const mySnapExists = uid === hostUid ? hostPickValid : guestPickValid;
    const otherSnapExists = uid === hostUid ? guestPickValid : hostPickValid;

    if (mySnapExists) {
      throw new HttpsError("already-exists", "Você já escolheu nesta rodada.");
    }

    if (!otherSnapExists) {
      tx.set(myPref, {
        hand,
        criadoEm: FieldValue.serverTimestamp(),
      });
      tx.update(roomRef, {
        phase: "ppt_waiting",
        status: "playing",
        pptPickedUids: FieldValue.arrayUnion(uid),
        pptAwaitingBothPicks: false,
        pptConsecutiveEmptyRounds: 0,
        timeoutEmptyRounds: 0,
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      return "queued";
    }

    const hostHand = uid === hostUid ? hand : String(hPSnap.data()?.hand ?? "");
    const guestHand = uid === guestUid ? hand : String(gPSnap.data()?.hand ?? "");
    const out = pptOutcomeFromHands(hostHand, guestHand);
    return applyPptRoundResultInTransaction(tx, roomRef, roomId, r, hostHand, guestHand, out, pptPickWindowMs, {
      hostRef: hPref,
      guestRef: gPref,
    });
  });

  if (pptTxResult === "queued") {
    return { status: "queued" as const };
  }

  if (pptTxResult === false) {
    const rs = await roomRef.get();
    const rd = rs.data() as
      | {
          pptRewardsApplied?: boolean;
          pptMatchWinner?: string;
          pptHostScore?: number;
          pptGuestScore?: number;
          pptLastRoundOutcome?: string;
          pptLastHostHand?: string;
          pptLastGuestHand?: string;
        }
      | undefined;
    if (rd?.pptRewardsApplied && rd.pptMatchWinner) {
      return {
        status: "completed" as const,
        matchWinner: rd.pptMatchWinner as "host" | "guest",
        hostScore: Number(rd.pptHostScore ?? 0),
        guestScore: Number(rd.pptGuestScore ?? 0),
        lastRoundOutcome: rd.pptLastRoundOutcome,
        hostHand: rd.pptLastHostHand,
        guestHand: rd.pptLastGuestHand,
      };
    }
    return { status: "queued" as const };
  }

  if (pptTxResult === "round") {
    const rs = await roomRef.get();
    const rd = rs.data()!;
    return {
      status: "round" as const,
      roundOutcome: String(rd.pptLastRoundOutcome ?? ""),
      hostHand: String(rd.pptLastHostHand ?? ""),
      guestHand: String(rd.pptLastGuestHand ?? ""),
      hostScore: Number(rd.pptHostScore ?? 0),
      guestScore: Number(rd.pptGuestScore ?? 0),
    };
  }

  const finalSnap = await roomRef.get();
  const fd = finalSnap.data() as
    | {
        pptMatchWinner?: string;
        pptLastRoundOutcome?: string;
        pptLastHostHand?: string;
        pptLastGuestHand?: string;
        pptHostScore?: number;
        pptGuestScore?: number;
        hostUid?: string;
        guestUid?: string;
      }
    | undefined;
  if (!finalSnap.exists || !fd?.pptMatchWinner) {
    return { status: "queued" as const };
  }

  const hostUid = String(fd.hostUid ?? room.hostUid);
  const guestUid = String(fd.guestUid ?? room.guestUid);
  const matchWinner = fd.pptMatchWinner as "host" | "guest";
  const hostRes: "vitoria" | "derrota" = matchWinner === "host" ? "vitoria" : "derrota";
  const guestRes: "vitoria" | "derrota" = matchWinner === "guest" ? "vitoria" : "derrota";
  const lastOut = fd.pptLastRoundOutcome as "host_win" | "guest_win" | "draw";
  const metaBase = {
    pvpRoomId: roomId,
    hostHand: String(fd.pptLastHostHand ?? ""),
    guestHand: String(fd.pptLastGuestHand ?? ""),
    outcome: lastOut,
    pptMatchWinner: matchWinner,
    pptFinalHostScore: Number(fd.pptHostScore ?? 0),
    pptFinalGuestScore: Number(fd.pptGuestScore ?? 0),
  };
  const economyConfig = await getEconomy();
  const ecoH = resolveMatchEconomy("ppt", hostRes, 0, metaBase, economyConfig.matchRewardOverrides);
  const ecoG = resolveMatchEconomy("ppt", guestRes, 0, metaBase, economyConfig.matchRewardOverrides);

  const [hSnap, gSnap] = await Promise.all([
    db.doc(`${COL.users}/${hostUid}`).get(),
    db.doc(`${COL.users}/${guestUid}`).get(),
  ]);
  await upsertRanking({
    uid: hostUid,
    nome: String(hSnap.data()?.nome || "Jogador"),
    username: String(hSnap.data()?.username || "") || null,
    foto: (hSnap.data()?.foto as string | null) ?? null,
    deltaScore: ecoH.rankingPoints,
    win: hostRes === "vitoria",
    gameId: "ppt",
  });
  await upsertRanking({
    uid: guestUid,
    nome: String(gSnap.data()?.nome || "Jogador"),
    username: String(gSnap.data()?.username || "") || null,
    foto: (gSnap.data()?.foto as string | null) ?? null,
    deltaScore: ecoG.rankingPoints,
    win: guestRes === "vitoria",
    gameId: "ppt",
  });
  await bumpPlayMatchMissions(hostUid);
  await bumpPlayMatchMissions(guestUid);

  return {
    status: "completed" as const,
    matchWinner,
    hostScore: Number(fd.pptHostScore ?? 0),
    guestScore: Number(fd.pptGuestScore ?? 0),
    lastRoundOutcome: fd.pptLastRoundOutcome,
    hostHand: fd.pptLastHostHand,
    guestHand: fd.pptLastGuestHand,
  };
});

export const submitQuizAnswer = onCall(MULTIPLAYER_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  const roomId = String(request.data?.roomId || "").trim();
  const answerIndex = Number(request.data?.answerIndex);
  const responseTimeMs = clampQuizResponseMs(request.data?.responseTimeMs);

  if (!roomId || !Number.isInteger(answerIndex) || answerIndex < 0) {
    throw new HttpsError("invalid-argument", "roomId ou resposta inválidos.");
  }

  const roomRef = db.doc(`${COL.gameRooms}/${roomId}`);
  const answersColl = roomRef.collection("quiz_answers");

  const econQuizSubmit = await getEconomy();
  const quizSubmitWindowMs = pvpChoiceWindowMs(econQuizSubmit.pvpChoiceSeconds, "quiz");

  const result = await db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists) {
      throw new HttpsError("not-found", "Sala inexistente.");
    }

    const room = roomSnap.data() as Record<string, unknown>;
    if (String(room.gameId) !== "quiz") {
      throw new HttpsError("failed-precondition", "Esta sala não é Quiz.");
    }
    if (uid !== room.hostUid && uid !== room.guestUid) {
      throw new HttpsError("permission-denied", "Você não está nesta sala.");
    }
    if (room.quizRewardsApplied === true || room.phase === "completed" || room.status === "completed") {
      throw new HttpsError("failed-precondition", "Partida já finalizada.");
    }
    if (
      millisFromFirestoreTime(room.actionDeadlineAt) > 0 &&
      Date.now() > millisFromFirestoreTime(room.actionDeadlineAt)
    ) {
      throw new HttpsError("failed-precondition", "Tempo da pergunta esgotado.");
    }

    const questionId = String(room.quizQuestionId ?? "");
    const question = await getQuizQuestionById(questionId);
    if (!question) {
      throw new HttpsError("failed-precondition", "Questão da sala inválida.");
    }
    if (answerIndex >= question.options.length) {
      throw new HttpsError("invalid-argument", "Opção inválida para esta questão.");
    }

    const hostUid = String(room.hostUid);
    const guestUid = String(room.guestUid);
    const otherUid = uid === hostUid ? guestUid : hostUid;
    const myAnswerRef = answersColl.doc(uid);
    const otherAnswerRef = answersColl.doc(otherUid);
    const [myAnswerSnap, otherAnswerSnap] = await Promise.all([
      tx.get(myAnswerRef),
      tx.get(otherAnswerRef),
    ]);

    if (myAnswerSnap.exists) {
      throw new HttpsError("failed-precondition", "Você já respondeu esta questão.");
    }

    const answered = new Set<string>(
      Array.isArray(room.quizAnsweredUids)
        ? room.quizAnsweredUids.map((x) => String(x))
        : [],
    );
    answered.add(uid);

    if (!otherAnswerSnap.exists) {
      tx.set(myAnswerRef, {
        uid,
        answerIndex,
        responseTimeMs,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(roomRef, {
        quizAnsweredUids: Array.from(answered),
        timeoutEmptyRounds: 0,
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      return { status: "queued" as const };
    }

    const otherAnswer = otherAnswerSnap.data() as {
      answerIndex?: number;
      responseTimeMs?: number;
    };
    const hostAnswerIndex = uid === hostUid ? answerIndex : Number(otherAnswer.answerIndex ?? -1);
    const guestAnswerIndex = uid === guestUid ? answerIndex : Number(otherAnswer.answerIndex ?? -1);
    const hostResponse = uid === hostUid ? responseTimeMs : clampQuizResponseMs(otherAnswer.responseTimeMs);
    const guestResponse = uid === guestUid ? responseTimeMs : clampQuizResponseMs(otherAnswer.responseTimeMs);
    const hostCorrect = hostAnswerIndex === question.correctIndex;
    const guestCorrect = guestAnswerIndex === question.correctIndex;
    const roundWinner = resolveQuizRoundWinner(
      hostCorrect,
      guestCorrect,
      hostResponse,
      guestResponse,
    );
    const nextHostScore = Number(room.quizHostScore ?? 0) + (roundWinner === "host" ? 1 : 0);
    const nextGuestScore = Number(room.quizGuestScore ?? 0) + (roundWinner === "guest" ? 1 : 0);
    const target = readQuizTargetScore(room);

    if ((roundWinner === "host" && nextHostScore >= target) || (roundWinner === "guest" && nextGuestScore >= target)) {
      const matchWinner = roundWinner as "host" | "guest";
      const out = await applyQuizMatchCompletionInTransaction(
        tx,
        roomRef,
        roomId,
        { ...room, quizHostScore: nextHostScore, quizGuestScore: nextGuestScore },
        matchWinner,
        hostAnswerIndex,
        guestAnswerIndex,
        hostCorrect,
        guestCorrect,
        hostResponse,
        guestResponse,
        question.options,
        question.correctIndex,
        question.q,
      );
      return {
        status: "completed" as const,
        matchWinner,
        hostUid: out.hostUid,
        guestUid: out.guestUid,
        hostScore: nextHostScore,
        guestScore: nextGuestScore,
        hostResponseMs: hostResponse,
        guestResponseMs: guestResponse,
        hostAnswerIndex,
        guestAnswerIndex,
      };
    }

    tx.delete(otherAnswerRef);

    const nextQuestion = await pickQuizQuestion(Math.random, questionId);
    tx.update(roomRef, {
      status: "playing",
      phase: "quiz_playing",
      quizHostScore: nextHostScore,
      quizGuestScore: nextGuestScore,
      quizRound: Number(room.quizRound ?? 1) + 1,
      quizQuestionId: nextQuestion.id,
      quizQuestionText: nextQuestion.q,
      quizOptions: nextQuestion.options,
      quizAnsweredUids: [],
      quizLastHostAnswerIndex: hostAnswerIndex,
      quizLastGuestAnswerIndex: guestAnswerIndex,
      quizLastHostCorrect: hostCorrect,
      quizLastGuestCorrect: guestCorrect,
      quizLastHostResponseMs: hostResponse,
      quizLastGuestResponseMs: guestResponse,
      quizLastRoundWinner: roundWinner,
      quizLastRevealOptions: question.options,
      quizLastRevealCorrectIndex: question.correctIndex,
      quizLastRevealQuestionText: question.q,
      timeoutEmptyRounds: 0,
      actionDeadlineAt: pvpActionDeadlineTs(Date.now(), quizSubmitWindowMs),
      atualizadoEm: FieldValue.serverTimestamp(),
    });

    return {
      status: "round" as const,
      roundWinner,
      hostScore: nextHostScore,
      guestScore: nextGuestScore,
      hostAnswerIndex,
      guestAnswerIndex,
      hostCorrect,
      guestCorrect,
      hostResponseMs: hostResponse,
      guestResponseMs: guestResponse,
      correctIndex: question.correctIndex,
      questionId,
    };
  });

  if (result.status === "completed") {
    await postQuizMatchRankingFromWinner(
      roomId,
      result.hostUid,
      result.guestUid,
      result.matchWinner,
      result.hostResponseMs,
      result.guestResponseMs,
    );
  }

  return result;
});

export const submitReactionTap = onCall(MULTIPLAYER_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  const roomId = String(request.data?.roomId || "").trim();

  if (!roomId) {
    throw new HttpsError("invalid-argument", "roomId obrigatório.");
  }

  const roomRef = db.doc(`${COL.gameRooms}/${roomId}`);
  const resultsColl = roomRef.collection("reaction_results");

  const econReactionSubmit = await getEconomy();
  const reactionSubmitWindowMs = pvpChoiceWindowMs(econReactionSubmit.pvpChoiceSeconds, "reaction_tap");

  const result = await db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists) {
      throw new HttpsError("not-found", "Sala inexistente.");
    }

    const room = roomSnap.data() as Record<string, unknown>;
    if (String(room.gameId) !== "reaction_tap") {
      throw new HttpsError("failed-precondition", "Esta sala não é Reaction Tap.");
    }
    if (uid !== room.hostUid && uid !== room.guestUid) {
      throw new HttpsError("permission-denied", "Você não está nesta sala.");
    }
    if (
      room.reactionRewardsApplied === true ||
      room.phase === "completed" ||
      room.status === "completed"
    ) {
      throw new HttpsError("failed-precondition", "Partida já finalizada.");
    }
    if (
      millisFromFirestoreTime(room.actionDeadlineAt) > 0 &&
      Date.now() > millisFromFirestoreTime(room.actionDeadlineAt)
    ) {
      throw new HttpsError("failed-precondition", "Tempo da rodada esgotado.");
    }
    const goLiveAtMs = millisFromFirestoreTime(room.reactionGoLiveAt);
    if (goLiveAtMs > 0 && Date.now() < goLiveAtMs) {
      throw new HttpsError("failed-precondition", "Aguardando sinal da rodada.");
    }
    const falseStart = false;
    const reactionMs = clampReactionResponseMs(request.data?.reactionMs);

    const hostUid = String(room.hostUid);
    const guestUid = String(room.guestUid);
    const otherUid = uid === hostUid ? guestUid : hostUid;
    const myResultRef = resultsColl.doc(uid);
    const otherResultRef = resultsColl.doc(otherUid);
    const [myResultSnap, otherResultSnap] = await Promise.all([
      tx.get(myResultRef),
      tx.get(otherResultRef),
    ]);

    if (myResultSnap.exists) {
      throw new HttpsError("failed-precondition", "Você já reagiu nesta partida.");
    }

    const answered = new Set<string>(
      Array.isArray(room.reactionAnsweredUids)
        ? room.reactionAnsweredUids.map((x) => String(x))
        : [],
    );
    answered.add(uid);

    if (!otherResultSnap.exists) {
      tx.set(myResultRef, {
        uid,
        reactionMs,
        falseStart,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(roomRef, {
        reactionAnsweredUids: Array.from(answered),
        timeoutEmptyRounds: 0,
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      return { status: "queued" as const };
    }

    const other = otherResultSnap.data() as { reactionMs?: number; falseStart?: boolean };
    const hostMs =
      uid === hostUid ? reactionMs : clampReactionResponseMs(other.reactionMs);
    const guestMs =
      uid === guestUid ? reactionMs : clampReactionResponseMs(other.reactionMs);
    const hostFalseStart = uid === hostUid ? falseStart : other.falseStart === true;
    const guestFalseStart = uid === guestUid ? falseStart : other.falseStart === true;
    const winner = resolveReactionWinner(hostFalseStart, guestFalseStart, hostMs, guestMs);

    const out = await applyReactionMatchCompletionInTransaction(
      tx,
      roomRef,
      roomId,
      room,
      hostMs,
      guestMs,
      hostFalseStart,
      guestFalseStart,
      winner,
      reactionSubmitWindowMs,
    );
    tx.delete(otherResultRef);
    return out.completed
      ? {
          status: "completed" as const,
          winner,
          hostUid: out.hostUid,
          guestUid: out.guestUid,
          hostRes: out.hostRes,
          guestRes: out.guestRes,
          hostMs,
          guestMs,
          hostScore: out.hostScore,
          guestScore: out.guestScore,
        }
      : {
          status: "round" as const,
          winner,
          hostMs,
          guestMs,
          hostScore: out.hostScore,
          guestScore: out.guestScore,
        };
  });

  if (result.status === "completed") {
    await postReactionTapRanking(
      roomId,
      result.hostUid,
      result.guestUid,
      result.hostRes,
      result.guestRes,
      result.hostMs,
      result.guestMs,
    );
  }

  return result;
});

/** Desistência explícita ou sair da sala: quem chama perde; oponente vence (PPT/Quiz/Reaction). */
export const forfeitPvpRoom = onCall(MULTIPLAYER_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  const roomId = String(request.data?.roomId || "").trim();
  if (!roomId) {
    throw new HttpsError("invalid-argument", "roomId obrigatório.");
  }

  const roomRef = db.doc(`${COL.gameRooms}/${roomId}`);
  const result = await db.runTransaction(async (tx) => {
    const rs = await tx.get(roomRef);
    if (!rs.exists) {
      throw new HttpsError("not-found", "Sala inexistente.");
    }
    const r = rs.data() as Record<string, unknown>;
    if (uid !== r.hostUid && uid !== r.guestUid) {
      throw new HttpsError("permission-denied", "Você não está nesta sala.");
    }
    const gameId = String(r.gameId);
    if (gameId !== "ppt" && gameId !== "quiz" && gameId !== "reaction_tap") {
      throw new HttpsError("failed-precondition", "W.O. disponível só em salas PvP.");
    }
    if (
      r.pptRewardsApplied === true ||
      r.quizRewardsApplied === true ||
      r.reactionRewardsApplied === true ||
      r.phase === "completed" ||
      r.status === "completed"
    ) {
      return { applied: false as const };
    }
    if (gameId === "ppt") {
      const out = await applyPptForfeitInTransaction(tx, roomRef, roomId, r, uid);
      return { applied: true as const, gameId: "ppt" as const, ...out };
    }
    if (gameId === "quiz") {
      const out = await applyQuizForfeitInTransaction(tx, roomRef, roomId, r, uid);
      return { applied: true as const, gameId: "quiz" as const, ...out };
    }
    const out = await applyReactionForfeitInTransaction(tx, roomRef, roomId, r, uid);
    return { applied: true as const, gameId: "reaction_tap" as const, ...out };
  });

  if (result.applied) {
    if (result.gameId === "ppt") {
      await postPptMatchRankingFromWinner(
        roomId,
        result.hostUid,
        result.guestUid,
        result.matchWinner,
        { forfeitedByUid: uid },
      );
    } else {
      if (result.gameId === "reaction_tap") {
        await postReactionTapRanking(
          roomId,
          result.hostUid,
          result.guestUid,
          result.hostRes,
          result.guestRes,
          result.hostMs,
          result.guestMs,
        );
        return {
          ok: true,
          applied: result.applied,
          matchWinner: result.applied ? result.winner : null,
          gameId: result.applied ? result.gameId : null,
        };
      }
      await postQuizMatchRankingFromWinner(
        roomId,
        result.hostUid,
        result.guestUid,
        result.matchWinner,
        result.hostResponseMs,
        result.guestResponseMs,
      );
    }
  }
  return {
    ok: true,
    applied: result.applied,
    matchWinner: result.applied ? ("winner" in result ? result.winner : result.matchWinner) : null,
    gameId: result.applied ? result.gameId : null,
  };
});

async function resolveExpiredPvpRoom(roomRef: DocumentReference, roomId: string, actorUid?: string) {
  const econTimeout = await getEconomy();
  const pptTimeoutMs = pvpChoiceWindowMs(econTimeout.pvpChoiceSeconds, "ppt");
  const quizTimeoutMs = pvpChoiceWindowMs(econTimeout.pvpChoiceSeconds, "quiz");
  const reactionTimeoutMs = pvpChoiceWindowMs(econTimeout.pvpChoiceSeconds, "reaction_tap");

  const result = await db.runTransaction(async (tx) => {
    const rs = await tx.get(roomRef);
    if (!rs.exists) {
      return { kind: "noop" as const };
    }
    const r = rs.data() as Record<string, unknown>;
    const gameId = String(r.gameId || "") as GameId;
    if (actorUid && actorUid !== r.hostUid && actorUid !== r.guestUid) {
      throw new HttpsError("permission-denied", "Você não está nesta sala.");
    }
    if (
      r.phase === "completed" ||
      r.status === "completed" ||
      r.status === "cancelled" ||
      r.pptRewardsApplied === true ||
      r.quizRewardsApplied === true ||
      r.reactionRewardsApplied === true
    ) {
      return { kind: "noop" as const };
    }
    const deadlineMs = millisFromFirestoreTime(r.actionDeadlineAt);
    if (deadlineMs <= 0 || Date.now() < deadlineMs) {
      return { kind: "noop" as const };
    }

    if (gameId === "ppt") {
      const picksColl = roomRef.collection("ppt_picks");
      const hostUid = String(r.hostUid);
      const guestUid = String(r.guestUid);
      const [hostPickSnap, guestPickSnap] = await Promise.all([
        tx.get(picksColl.doc(hostUid)),
        tx.get(picksColl.doc(guestUid)),
      ]);
      const pickedUids = new Set<string>(((r as { pptPickedUids?: unknown }).pptPickedUids as string[] | undefined) ?? []);
      const hostPickValid = hostPickSnap.exists && pickedUids.has(hostUid);
      const guestPickValid = guestPickSnap.exists && pickedUids.has(guestUid);
      if (hostPickSnap.exists && !hostPickValid) {
        tx.delete(picksColl.doc(hostUid));
      }
      if (guestPickSnap.exists && !guestPickValid) {
        tx.delete(picksColl.doc(guestUid));
      }
      if (hostPickValid && guestPickValid) {
        return { kind: "noop" as const };
      }
      if (!hostPickValid && !guestPickValid) {
        const strikes = Math.max(0, Number(r.pptConsecutiveEmptyRounds ?? 0));
        if (strikes >= 1) {
          await applyPptVoidBothInactiveInTransaction(tx, roomRef, r);
          return { kind: "void" as const, gameId };
        }
        tx.update(roomRef, {
          phase: "ppt_playing",
          status: "playing",
          pptPickedUids: [],
          pptLastRoundOutcome: "draw",
          pptAwaitingBothPicks: true,
          pptRoundStartedAt: FieldValue.serverTimestamp(),
          pptConsecutiveEmptyRounds: strikes + 1,
          timeoutEmptyRounds: strikes + 1,
          actionDeadlineAt: pvpActionDeadlineTs(Date.now(), pptTimeoutMs),
          atualizadoEm: FieldValue.serverTimestamp(),
        });
        return { kind: "ppt_round" as const };
      }
      const hostHand = hostPickValid
        ? String(hostPickSnap.data()?.hand || "")
        : losingHandAgainst(String(guestPickSnap.data()?.hand || "papel"));
      const guestHand = guestPickValid
        ? String(guestPickSnap.data()?.hand || "")
        : losingHandAgainst(String(hostPickSnap.data()?.hand || "pedra"));
      const out = pptOutcomeFromHands(hostHand, guestHand);
      const step = await applyPptRoundResultInTransaction(
        tx,
        roomRef,
        roomId,
        r,
        hostHand,
        guestHand,
        out,
        pptTimeoutMs,
        {
          hostRef: picksColl.doc(hostUid),
          guestRef: picksColl.doc(guestUid),
        },
      );
      if (step === "match") {
        return {
          kind: "ppt_match" as const,
          hostUid,
          guestUid,
          matchWinner: out === "host_win" ? ("host" as const) : ("guest" as const),
        };
      }
      return { kind: "ppt_round" as const };
    }

    if (gameId === "quiz") {
      const answersColl = roomRef.collection("quiz_answers");
      const hostUid = String(r.hostUid);
      const guestUid = String(r.guestUid);
      const [hostAnswerSnap, guestAnswerSnap] = await Promise.all([
        tx.get(answersColl.doc(hostUid)),
        tx.get(answersColl.doc(guestUid)),
      ]);
      if (hostAnswerSnap.exists && guestAnswerSnap.exists) {
        return { kind: "noop" as const };
      }
      const questionId = String(r.quizQuestionId ?? "");
      const question = await getQuizQuestionById(questionId);
      if (!question) {
        return { kind: "noop" as const };
      }
      if (!hostAnswerSnap.exists && !guestAnswerSnap.exists) {
        const strikes = Math.max(0, Number(r.timeoutEmptyRounds ?? 0));
        if (strikes >= 1) {
          await applyGenericPvpTimeoutVoidInTransaction(tx, roomRef, r, {
            quizOutcome: "draw",
            quizLastRoundWinner: "draw",
            quizAnsweredUids: [],
            quizRewardsApplied: true,
            quizMatchWinner: FieldValue.delete(),
            timeoutEmptyRounds: 0,
            quizLastRevealOptions: FieldValue.delete(),
            quizLastRevealCorrectIndex: FieldValue.delete(),
            quizLastRevealQuestionText: FieldValue.delete(),
            quizLastHostAnswerIndex: FieldValue.delete(),
            quizLastGuestAnswerIndex: FieldValue.delete(),
            quizLastHostCorrect: FieldValue.delete(),
            quizLastGuestCorrect: FieldValue.delete(),
          });
          return { kind: "void" as const, gameId };
        }
        const nextQuestion = await pickQuizQuestion(Math.random, questionId);
        tx.update(roomRef, {
          status: "playing",
          phase: "quiz_playing",
          quizRound: Number(r.quizRound ?? 1) + 1,
          quizQuestionId: nextQuestion.id,
          quizQuestionText: nextQuestion.q,
          quizOptions: nextQuestion.options,
          quizAnsweredUids: [],
          quizLastHostAnswerIndex: null,
          quizLastGuestAnswerIndex: null,
          quizLastHostCorrect: false,
          quizLastGuestCorrect: false,
          quizLastHostResponseMs: QUIZ_RESPONSE_MS_CAP,
          quizLastGuestResponseMs: QUIZ_RESPONSE_MS_CAP,
          quizLastRoundWinner: "draw",
          timeoutEmptyRounds: strikes + 1,
          actionDeadlineAt: pvpActionDeadlineTs(Date.now(), quizTimeoutMs),
          atualizadoEm: FieldValue.serverTimestamp(),
        });
        return { kind: "quiz_round" as const };
      }
      const hostAnswer = hostAnswerSnap.data() as { answerIndex?: number; responseTimeMs?: number } | undefined;
      const guestAnswer = guestAnswerSnap.data() as { answerIndex?: number; responseTimeMs?: number } | undefined;
      const hostAnswerIndex = hostAnswerSnap.exists ? Number(hostAnswer?.answerIndex ?? -1) : -1;
      const guestAnswerIndex = guestAnswerSnap.exists ? Number(guestAnswer?.answerIndex ?? -1) : -1;
      const hostResponse = hostAnswerSnap.exists
        ? clampQuizResponseMs(hostAnswer?.responseTimeMs)
        : QUIZ_RESPONSE_MS_CAP;
      const guestResponse = guestAnswerSnap.exists
        ? clampQuizResponseMs(guestAnswer?.responseTimeMs)
        : QUIZ_RESPONSE_MS_CAP;
      const hostCorrect = hostAnswerIndex === question.correctIndex;
      const guestCorrect = guestAnswerIndex === question.correctIndex;
      const roundWinner = resolveQuizRoundWinner(
        hostCorrect,
        guestCorrect,
        hostResponse,
        guestResponse,
      );
      const nextHostScore = Number(r.quizHostScore ?? 0) + (roundWinner === "host" ? 1 : 0);
      const nextGuestScore = Number(r.quizGuestScore ?? 0) + (roundWinner === "guest" ? 1 : 0);
      const target = readQuizTargetScore(r);
      if ((roundWinner === "host" && nextHostScore >= target) || (roundWinner === "guest" && nextGuestScore >= target)) {
        const matchWinner = roundWinner as "host" | "guest";
        const out = await applyQuizMatchCompletionInTransaction(
          tx,
          roomRef,
          roomId,
          { ...r, quizHostScore: nextHostScore, quizGuestScore: nextGuestScore },
          matchWinner,
          hostAnswerIndex,
          guestAnswerIndex,
          hostCorrect,
          guestCorrect,
          hostResponse,
          guestResponse,
          question.options,
          question.correctIndex,
          question.q,
        );
        tx.delete(answersColl.doc(hostUid));
        tx.delete(answersColl.doc(guestUid));
        return { kind: "quiz_match" as const, ...out, hostResponseMs: hostResponse, guestResponseMs: guestResponse };
      }
      const nextQuestion = await pickQuizQuestion(Math.random, questionId);
      tx.delete(answersColl.doc(hostUid));
      tx.delete(answersColl.doc(guestUid));
      tx.update(roomRef, {
        status: "playing",
        phase: "quiz_playing",
        quizHostScore: nextHostScore,
        quizGuestScore: nextGuestScore,
        quizRound: Number(r.quizRound ?? 1) + 1,
        quizQuestionId: nextQuestion.id,
        quizQuestionText: nextQuestion.q,
        quizOptions: nextQuestion.options,
        quizAnsweredUids: [],
        quizLastHostAnswerIndex: hostAnswerIndex,
        quizLastGuestAnswerIndex: guestAnswerIndex,
        quizLastHostCorrect: hostCorrect,
        quizLastGuestCorrect: guestCorrect,
        quizLastHostResponseMs: hostResponse,
        quizLastGuestResponseMs: guestResponse,
        quizLastRoundWinner: roundWinner,
        quizLastRevealOptions: question.options,
        quizLastRevealCorrectIndex: question.correctIndex,
        quizLastRevealQuestionText: question.q,
        timeoutEmptyRounds: 0,
        actionDeadlineAt: pvpActionDeadlineTs(Date.now(), quizTimeoutMs),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      return { kind: "quiz_round" as const };
    }

    if (gameId === "reaction_tap") {
      const resultsColl = roomRef.collection("reaction_results");
      const hostUid = String(r.hostUid);
      const guestUid = String(r.guestUid);
      const [hostResultSnap, guestResultSnap] = await Promise.all([
        tx.get(resultsColl.doc(hostUid)),
        tx.get(resultsColl.doc(guestUid)),
      ]);
      if (hostResultSnap.exists && guestResultSnap.exists) {
        return { kind: "noop" as const };
      }
      if (!hostResultSnap.exists && !guestResultSnap.exists) {
        const strikes = Math.max(0, Number(r.timeoutEmptyRounds ?? 0));
        if (strikes >= 1) {
          await applyGenericPvpTimeoutVoidInTransaction(tx, roomRef, r, {
            reactionOutcome: "draw",
            reactionWinner: "draw",
            reactionLastRoundWinner: "draw",
            reactionAnsweredUids: [],
            reactionRewardsApplied: true,
            reactionMatchWinner: FieldValue.delete(),
            timeoutEmptyRounds: 0,
          });
          return { kind: "void" as const, gameId };
        }
        const nextGoLiveAt = nextReactionGoLiveAt();
        tx.update(roomRef, {
          status: "playing",
          phase: "reaction_waiting",
          reactionRound: Number(r.reactionRound ?? 1) + 1,
          reactionGoLiveAt: nextGoLiveAt,
          reactionWinner: "draw",
          reactionLastRoundWinner: "draw",
          reactionHostFalseStart: false,
          reactionGuestFalseStart: false,
          reactionAnsweredUids: [],
          timeoutEmptyRounds: strikes + 1,
          actionDeadlineAt: pvpActionDeadlineTs(nextGoLiveAt.toMillis(), reactionTimeoutMs),
          atualizadoEm: FieldValue.serverTimestamp(),
        });
        return { kind: "reaction_round" as const };
      }
      const hostResult = hostResultSnap.data() as { reactionMs?: number; falseStart?: boolean } | undefined;
      const guestResult = guestResultSnap.data() as { reactionMs?: number; falseStart?: boolean } | undefined;
      const hostMs = hostResultSnap.exists
        ? clampReactionResponseMs(hostResult?.reactionMs)
        : REACTION_RESPONSE_MS_CAP;
      const guestMs = guestResultSnap.exists
        ? clampReactionResponseMs(guestResult?.reactionMs)
        : REACTION_RESPONSE_MS_CAP;
      const hostFalseStart = hostResultSnap.exists && hostResult?.falseStart === true;
      const guestFalseStart = guestResultSnap.exists && guestResult?.falseStart === true;
      const winner = resolveReactionWinner(hostFalseStart, guestFalseStart, hostMs, guestMs);
      const out = await applyReactionMatchCompletionInTransaction(
        tx,
        roomRef,
        roomId,
        r,
        hostMs,
        guestMs,
        hostFalseStart,
        guestFalseStart,
        winner,
        reactionTimeoutMs,
      );
      tx.delete(resultsColl.doc(hostUid));
      tx.delete(resultsColl.doc(guestUid));
      return out.completed
        ? { kind: "reaction_match" as const, ...out, hostMs, guestMs }
        : { kind: "reaction_round" as const };
    }

    return { kind: "noop" as const };
  });

  if (result.kind === "ppt_match") {
    await postPptMatchRankingFromWinner(roomId, result.hostUid, result.guestUid, result.matchWinner);
  } else if (result.kind === "quiz_match") {
    await postQuizMatchRankingFromWinner(
      roomId,
      result.hostUid,
      result.guestUid,
      result.matchWinner,
      result.hostResponseMs,
      result.guestResponseMs,
    );
  } else if (result.kind === "reaction_match") {
    await postReactionTapRanking(
      roomId,
      result.hostUid,
      result.guestUid,
      result.hostRes,
      result.guestRes,
      result.hostMs,
      result.guestMs,
    );
  }

  return result;
}

export const resolvePvpRoomTimeout = onCall(MULTIPLAYER_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  const roomId = String(request.data?.roomId || "").trim();
  if (!roomId) {
    throw new HttpsError("invalid-argument", "roomId obrigatório.");
  }
  const roomRef = db.doc(`${COL.gameRooms}/${roomId}`);
  const result = await resolveExpiredPvpRoom(roomRef, roomId, uid);
  return { ok: true, kind: result.kind };
});

/** Ping de presença na partida PPT; se o oponente ficar sem sinal, vitória por W.O. */
export const pvpPptPresence = onCall(MULTIPLAYER_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  const roomId = String(request.data?.roomId || "").trim();
  if (!roomId) {
    throw new HttpsError("invalid-argument", "roomId obrigatório.");
  }

  const roomRef = db.doc(`${COL.gameRooms}/${roomId}`);
  const out = await db.runTransaction(async (tx) => {
    const rs = await tx.get(roomRef);
    if (!rs.exists) {
      return { kind: "noop" as const };
    }
    const r = rs.data() as Record<string, unknown>;
    if (String(r.gameId) !== "ppt") {
      return { kind: "noop" as const };
    }
    if (r.pptRewardsApplied === true || r.phase === "completed" || r.status === "completed") {
      return { kind: "noop" as const };
    }
    if (uid !== r.hostUid && uid !== r.guestUid) {
      throw new HttpsError("permission-denied", "Você não está nesta sala.");
    }

    const hostUid = String(r.hostUid);
    const guestUid = String(r.guestUid);
    const isHost = uid === hostUid;
    const nowMs = Date.now();
    const createdMs = millisFromFirestoreTime(r.criadoEm);
    const roomAgeOk = createdMs > 0 && nowMs - createdMs > PVP_PPT_GRACE_AFTER_CREATE_MS;
    const oppField = isHost ? r.pptGuestPresenceAt : r.pptHostPresenceAt;
    const oppMs = millisFromFirestoreTime(oppField);
    const opponentStale =
      roomAgeOk && oppMs > 0 && nowMs - oppMs > PVP_PPT_HEARTBEAT_STALE_MS;

    if (opponentStale) {
      const loserUid = isHost ? guestUid : hostUid;
      const applied = await applyPptForfeitInTransaction(tx, roomRef, roomId, r, loserUid);
      return { kind: "forfeit" as const, ...applied, loserUid };
    }

    tx.update(roomRef, {
      [isHost ? "pptHostPresenceAt" : "pptGuestPresenceAt"]: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    return { kind: "ping" as const };
  });

  if (out.kind === "forfeit") {
    await postPptMatchRankingFromWinner(
      roomId,
      out.hostUid,
      out.guestUid,
      out.matchWinner,
      { forfeitedByUid: out.loserUid },
    );
  }
  return { ok: true, kind: out.kind };
});

export const riskAnalysisOnUserEvent = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  const tipo = String(request.data?.tipo || "evento").slice(0, 120);
  const detalhes = request.data?.detalhes || {};
  await db.collection(COL.fraudLogs).add({
    uid,
    tipo,
    severidade: "baixa",
    detalhes,
    origem: "client",
    timestamp: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

async function closeRankingScopePayout(
  period: RankingPeriodMode,
  periodKey: string,
  prizeTiers: RankingPrizeTierResolved[],
  gameId?: GameId,
) {
  const collectionName = rankingCollectionForPeriod(period);
  const rankingRootPath = gameId
    ? `${collectionName}/${periodKey}/games/${gameId}`
    : `${collectionName}/${periodKey}`;
  const rankingRootRef = db.doc(rankingRootPath);
  const payoutFlagRef = gameId
    ? db.doc(`${rankingRootPath}/meta/payout`)
    : db.doc(`${collectionName}/${periodKey}/meta/payout_global`);
  const payoutFlagSnap = await payoutFlagRef.get();
  if (payoutFlagSnap.exists) return;

  const maxPos = prizeTiers[prizeTiers.length - 1]?.posicaoMax ?? 0;
  if (maxPos < 1) return;

  const entriesPath = gameId
    ? `${rankingRootPath}/entries`
    : `${collectionName}/${periodKey}/entries`;
  const entriesSnap = await db.collection(entriesPath).orderBy("score", "desc").limit(maxPos).get();

  if (entriesSnap.empty) {
    await payoutFlagRef.set({
      period,
      periodKey,
      scope: gameId ? "game" : "global",
      gameId: gameId ?? null,
      gameTitle: gameId ? GAME_TITLES[gameId] : null,
      processedAt: FieldValue.serverTimestamp(),
      winners: 0,
      note: "Sem entradas para premiar.",
    });
    return;
  }

  const winners = entriesSnap.docs.map((docSnap, index) => ({
    pos: index + 1,
    uid: docSnap.id,
    entryRef: docSnap.ref,
    tier: rankingPrizeTierForPosition(prizeTiers, index + 1),
  }));
  const rewardedWinners = winners.filter(
    (winner) => winner.tier != null && hasRankingPrizeRewards(winner.tier.rewards),
  );
  if (rewardedWinners.length === 0) return;

  const userRefs = rewardedWinners.map((winner) => db.doc(`${COL.users}/${winner.uid}`));
  const userSnapshots = userRefs.length ? await db.getAll(...userRefs) : [];
  const userMap = new Map(
    userSnapshots
      .filter((snap) => snap.exists)
      .map((snap) => [snap.id, snap.data() as Record<string, unknown>]),
  );

  const batch = db.batch();
  let grantedCount = 0;
  for (const winner of rewardedWinners) {
    if (!winner.tier) continue;
    const userData = userMap.get(winner.uid);
    if (!userData) continue;

    const userRef = db.doc(`${COL.users}/${winner.uid}`);
    const rewardPatch = applyMultiCurrencyRewardPatch(userData, winner.tier.rewards);
    if (Object.keys(rewardPatch.patch).length === 0) continue;

    batch.set(
      userRef,
      {
        ...rewardPatch.patch,
        atualizadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    for (const currency of ["coins", "gems", "rewardBalance"] as const) {
      const amount = winner.tier.rewards[currency];
      if (amount <= 0) continue;
      batch.set(db.doc(`${COL.wallet}/${hashId("ranking", period, periodKey, gameId ?? "global", winner.uid, currency)}`), {
        userId: winner.uid,
        tipo: "ranking",
        moeda: currency,
        valor: amount,
        saldoApos: rewardPatch.balancesAfter[currency],
        descricao: gameId
          ? `Premiação ranking ${period} · ${GAME_TITLES[gameId]} · ${rewardCurrencyLabel(currency)}`
          : `Premiação ranking ${period} geral · ${rewardCurrencyLabel(currency)}`,
        referenciaId: gameId
          ? `${period}:${periodKey}:${gameId}:#${winner.pos}`
          : `${period}:${periodKey}:global:#${winner.pos}`,
        criadoEm: FieldValue.serverTimestamp(),
      });
    }

    batch.set(
      winner.entryRef,
      {
        posicao: winner.pos,
        premioRecebido: winner.tier.rewards,
        premioProcessadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    grantedCount += 1;
  }

  batch.set(payoutFlagRef, {
    period,
    periodKey,
    scope: gameId ? "game" : "global",
    gameId: gameId ?? null,
    gameTitle: gameId ? GAME_TITLES[gameId] : null,
    processedAt: FieldValue.serverTimestamp(),
    winners: grantedCount,
  });
  batch.set(
    rankingRootRef,
    {
      periodoChave: periodKey,
      tipo: period,
      scope: gameId ? "game" : "global",
      gameId: gameId ?? null,
      gameTitle: gameId ? GAME_TITLES[gameId] : null,
      prizeProcessedAt: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();
}

async function closeRankingJob(period: RankingPeriodMode) {
  const economy = await getEconomy();
  const periodKey = rankingKeyForPeriod(period, rankingReferenceDateForClose(period));
  const globalPrizeTiers = rankingPrizeTiersForScope(economy.rankingPrizes, period);
  if (globalPrizeTiers.length > 0) {
    await closeRankingScopePayout(period, periodKey, globalPrizeTiers);
  }

  for (const gameId of RANKING_GAME_IDS) {
    const gamePrizeTiers = rankingPrizeTiersForScope(economy.rankingPrizes, period, gameId);
    if (gamePrizeTiers.length === 0) continue;
    await closeRankingScopePayout(period, periodKey, gamePrizeTiers, gameId);
  }
}

function referralPrizeTiersForPeriod(
  configDoc: Record<string, unknown>,
  campaign: ReferralCampaignResolved | null,
  period: Exclude<ReferralRankingPeriod, "all">,
): Array<{ posicaoMax: number; amount: number; currency: RewardCurrency }> {
  const campaignTiers = campaign?.config.rankingPrizes?.[period];
  if (campaignTiers && campaignTiers.length > 0) return normalizePrizeTierList(campaignTiers);
  const rawRules =
    configDoc.rankingRules && typeof configDoc.rankingRules === "object"
      ? ((configDoc.rankingRules as Record<string, unknown>)[period] ?? [])
      : [];
  return normalizePrizeTierList(rawRules);
}

async function closeReferralRankingJob(period: Exclude<ReferralRankingPeriod, "all">) {
  const configSnap = await db.doc(`${COL.systemConfigs}/referral_system`).get();
  if (!configSnap.exists) return;
  const configDoc = configSnap.data() as Record<string, unknown>;
  if (configDoc.enabled === false) return;
  if (configDoc.rankingEnabled === false) return;

  const referralConfig = await getReferralConfig();
  const campaign = await getActiveReferralCampaign(referralConfig);
  const prizeTiers = referralPrizeTiersForPeriod(configDoc, campaign, period);
  if (prizeTiers.length === 0) return;

  const periodKey = referralRankingKey(period);
  const rankingRootRef = db.doc(`${referralRankingCollection(period)}/${periodKey}`);
  const payoutFlagRef = db.doc(`${referralRankingCollection(period)}/${periodKey}/meta/payout`);
  const payoutFlagSnap = await payoutFlagRef.get();
  if (payoutFlagSnap.exists) return;

  const maxPos = prizeTiers[prizeTiers.length - 1]?.posicaoMax ?? 0;
  if (maxPos < 1) return;

  const entriesSnap = await db
    .collection(`${referralRankingCollection(period)}/${periodKey}/entries`)
    .orderBy("validReferrals", "desc")
    .orderBy("totalRewards", "desc")
    .limit(maxPos)
    .get();
  if (entriesSnap.empty) {
    await payoutFlagRef.set({
      period,
      periodKey,
      processedAt: FieldValue.serverTimestamp(),
      winners: 0,
      campaignId: campaign?.id ?? null,
      note: "Sem entradas para premiar.",
    });
    return;
  }

  const winners = entriesSnap.docs.map((docSnap, index) => {
    const tier =
      prizeTiers.find((item) => index + 1 <= item.posicaoMax) ??
      null;
    return {
      pos: index + 1,
      uid: docSnap.id,
      data: docSnap.data() as Record<string, unknown>,
      tier,
    };
  });

  const batch = db.batch();
  for (const winner of winners) {
    if (!winner.tier || winner.tier.amount <= 0) continue;
    const userRef = db.doc(`${COL.users}/${winner.uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) continue;
    const userData = userSnap.data() as Record<string, unknown>;
    const rewardPatch = applyRewardPatch(userData, {
      amount: winner.tier.amount,
      currency: winner.tier.currency,
    });
    batch.set(
      userRef,
      {
        ...rewardPatch.patch,
        atualizadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    batch.set(db.doc(`${COL.wallet}/referral_rank_${period}_${periodKey}_${winner.uid}_${winner.tier.currency}`), {
      userId: winner.uid,
      tipo: "referral",
      moeda: winner.tier.currency,
      valor: winner.tier.amount,
      saldoApos: rewardPatch.balanceAfter,
      descricao: `Premiação ranking de indicações ${period} · ${rewardCurrencyLabel(winner.tier.currency)}`,
      referenciaId: `${period}:${periodKey}:#${winner.pos}`,
      criadoEm: FieldValue.serverTimestamp(),
    });
  }

  batch.set(payoutFlagRef, {
    period,
    periodKey,
    processedAt: FieldValue.serverTimestamp(),
    winners: winners.filter((winner) => winner.tier != null).length,
    campaignId: campaign?.id ?? null,
  });
  batch.set(
    rankingRootRef,
    {
      period,
      periodKey,
      prizeProcessedAt: FieldValue.serverTimestamp(),
      campaignId: campaign?.id ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();
}

/** Backstop server-side: resolve salas PvP expiradas para impedir travas e loops infinitos. */
export const reapExpiredPvpRooms = onSchedule(
  { schedule: "* * * * *", timeZone: "America/Sao_Paulo" },
  async () => {
    const snap = await db
      .collection(COL.gameRooms)
      .where("actionDeadlineAt", "<=", Timestamp.now())
      .limit(100)
      .get();

    for (const doc of snap.docs) {
      try {
        await resolveExpiredPvpRoom(doc.ref, doc.id);
      } catch (e) {
        console.error("reapExpiredPvpRooms", doc.id, e);
      }
    }
  },
);

/** Duas janelas seguidas sem nenhum pick dos dois → anula partida e libera slots (sem pontos). */
export const reapPptBothInactiveRounds = onSchedule(
  { schedule: "* * * * *", timeZone: "America/Sao_Paulo" },
  async () => {
    const snap = await db
      .collection(COL.gameRooms)
      .where("pptAwaitingBothPicks", "==", true)
      .where("status", "in", ["matched", "playing"])
      .limit(100)
      .get();

    const now = Date.now();
    for (const doc of snap.docs) {
      const d = doc.data() as Record<string, unknown>;
      if (String(d.gameId) !== "ppt") continue;
      if (d.pptRewardsApplied === true || String(d.phase) === "completed") continue;
      const picks = (d.pptPickedUids as string[] | undefined) ?? [];
      if (picks.length > 0) continue;
      const startedMs = millisFromFirestoreTime(d.pptRoundStartedAt);
      if (startedMs <= 0 || now - startedMs < PPT_BOTH_IDLE_NO_PICK_MS) continue;

      const roomRef = doc.ref;
      try {
        await db.runTransaction(async (tx) => {
          const rs = await tx.get(roomRef);
          if (!rs.exists) return;
          const r = rs.data() as Record<string, unknown>;
          if (r.pptRewardsApplied === true || String(r.phase) === "completed") return;
          if (r.pptAwaitingBothPicks !== true) return;
          const p2 = ((r.pptPickedUids as string[] | undefined) ?? []).length;
          if (p2 > 0) return;
          const sm = millisFromFirestoreTime(r.pptRoundStartedAt);
          if (sm <= 0 || Date.now() - sm < PPT_BOTH_IDLE_NO_PICK_MS) return;

          const strikes = Math.max(0, Number(r.pptConsecutiveEmptyRounds ?? 0));
          if (strikes >= 1) {
            await applyPptVoidBothInactiveInTransaction(tx, roomRef, r);
          } else {
            tx.update(roomRef, {
              pptConsecutiveEmptyRounds: 1,
              pptRoundStartedAt: FieldValue.serverTimestamp(),
              atualizadoEm: FieldValue.serverTimestamp(),
            });
          }
        });
      } catch (e) {
        console.error("reapPptBothInactiveRounds", doc.id, e);
      }
    }
  },
);

export const closeDailyRanking = onSchedule(
  { schedule: "59 23 * * *", timeZone: "America/Sao_Paulo" },
  async () => {
    await closeRankingJob("diario");
  },
);

export const closeWeeklyRanking = onSchedule(
  { schedule: "59 23 * * 0", timeZone: "America/Sao_Paulo" },
  async () => {
    await closeRankingJob("semanal");
  },
);

export const closeMonthlyRanking = onSchedule(
  { schedule: "0 0 1 * *", timeZone: "America/Sao_Paulo" },
  async () => {
    await closeRankingJob("mensal");
  },
);

export const adminCloseRanking = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  await assertAdmin(uid);
  const period = String(request.data?.period || "").trim() as RankingPeriodMode;
  if (!["diario", "semanal", "mensal"].includes(period)) {
    throw new HttpsError("invalid-argument", "Período inválido.");
  }
  await closeRankingJob(period);
  return { ok: true };
});

export const closeReferralDailyRanking = onSchedule(
  { schedule: "59 23 * * *", timeZone: "America/Sao_Paulo" },
  async () => {
    await closeReferralRankingJob("daily");
  },
);

export const closeReferralWeeklyRanking = onSchedule(
  { schedule: "59 23 * * 0", timeZone: "America/Sao_Paulo" },
  async () => {
    await closeReferralRankingJob("weekly");
  },
);

export const closeReferralMonthlyRanking = onSchedule(
  { schedule: "0 0 1 * *", timeZone: "America/Sao_Paulo" },
  async () => {
    await closeReferralRankingJob("monthly");
  },
);

export const adminCloseReferralRanking = onCall(DEFAULT_CALLABLE_OPTS, async (request) => {
  const uid = request.auth?.uid;
  assertAuthed(uid);
  await assertAdmin(uid);
  const period = String(request.data?.period || "").trim() as "daily" | "weekly" | "monthly";
  if (!["daily", "weekly", "monthly"].includes(period)) {
    throw new HttpsError("invalid-argument", "Período inválido.");
  }
  await closeReferralRankingJob(period);
  return { ok: true };
});
