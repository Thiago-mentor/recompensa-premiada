"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeReferralWeeklyRanking = exports.closeReferralDailyRanking = exports.getArenaOverallRanking = exports.adminCloseRanking = exports.closeMonthlyRanking = exports.closeWeeklyRanking = exports.closeDailyRanking = exports.reapPptBothInactiveRounds = exports.reapExpiredPvpRooms = exports.riskAnalysisOnUserEvent = exports.pvpPptPresence = exports.resolvePvpRoomTimeout = exports.forfeitPvpRoom = exports.submitReactionTap = exports.submitQuizAnswer = exports.submitPptPick = exports.leaveAutoMatch = exports.reactionSyncDuelRefill = exports.quizSyncDuelRefill = exports.pptSyncDuelRefill = exports.joinAutoMatch = exports.adminReviewReferral = exports.adminReprocessReferral = exports.processReferralReward = exports.adminDrawRaffle = exports.adminCloseRaffle = exports.adminCreateOrUpdateRaffle = exports.listMyRafflePurchases = exports.purchaseRaffleNumbers = exports.getActiveRaffle = exports.convertCurrency = exports.confirmRewardClaimPix = exports.reviewRewardClaim = exports.adminGrantEconomy = exports.requestRewardClaim = exports.activateStoredBoost = exports.craftBoostFromFragments = exports.claimChestReward = exports.speedUpChestUnlock = exports.startChestUnlock = exports.getUserChestItems = exports.claimMissionReward = exports.finalizeMatch = exports.adMobRewardedSsv = exports.getRewardedAdSessionStatus = exports.prepareRewardedAdSession = exports.processRewardedAd = exports.processDailyLogin = exports.updateUserAvatar = exports.initializeUserProfile = void 0;
exports.touchUserPresence = exports.getClanMemberShowcase = exports.kickClanMember = exports.cancelClanJoinRequest = exports.rejectClanJoinRequest = exports.approveClanJoinRequest = exports.transferClanOwnership = exports.changeClanMemberRole = exports.updateClanSettings = exports.markClanChatRead = exports.sendClanMessage = exports.leaveClan = exports.requestClanAccess = exports.joinClanByCode = exports.createClan = exports.tickRaffles = exports.adminCloseReferralRanking = exports.closeReferralMonthlyRanking = void 0;
const admin = __importStar(require("firebase-admin"));
const node_crypto_1 = require("node:crypto");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_2 = require("firebase-admin/firestore");
const gameEconomy_1 = require("./gameEconomy");
const streakEconomy_1 = require("./streakEconomy");
const quizQuestions_1 = require("./quizQuestions");
admin.initializeApp();
const firestoreDbId = process.env.FIRESTORE_DATABASE_ID?.trim();
const db = firestoreDbId && firestoreDbId !== "(default)"
    ? (0, firestore_1.getFirestore)((0, app_1.getApp)(), firestoreDbId)
    : (0, firestore_1.getFirestore)((0, app_1.getApp)());
const COL = {
    users: "users",
    clans: "clans",
    clanRankingsWeekly: "clan_rankings_weekly",
    clanMemberships: "clan_memberships",
    clanJoinRequests: "clan_join_requests",
    userChests: "user_chests",
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
    rewardedAdSessions: "rewarded_ad_sessions",
    fraudLogs: "fraud_logs",
    systemConfigs: "system_configs",
    raffles: "raffles",
    rafflePurchases: "raffle_purchases",
    rewardClaims: "reward_claims",
    rankingsDaily: "rankings_daily",
    rankingsWeekly: "rankings_weekly",
    rankingsMonthly: "rankings_monthly",
    matchmakingQueue: "matchmaking_queue",
    gameRooms: "game_rooms",
    multiplayerSlots: "multiplayer_slots",
};
const AUTO_QUEUE_GAMES = new Set(["ppt", "quiz", "reaction_tap"]);
const RANKING_GAME_IDS = ["ppt", "quiz", "reaction_tap", "roleta", "bau", "numero_secreto"];
const VICTORY_RANKED_GAME_IDS = new Set(["ppt", "quiz", "reaction_tap"]);
const GAME_TITLES = {
    ppt: "Pedra, papel e tesoura",
    quiz: "Quiz rápido 1x1",
    reaction_tap: "Reaction tap",
    roleta: "Roleta de PR",
    bau: "Baú com cooldown",
    numero_secreto: "Número secreto",
};
/** PPT em sala: primeiro a chegar nesta pontuação vence a partida (cada rodada sem empate = 1 ponto). */
const PPT_MATCH_TARGET_POINTS = 5;
const PPT_ROUND_REVEAL_MS = 3200;
const QUIZ_MATCH_TARGET_POINTS = 5;
const QUIZ_ROUND_REVEAL_MS = 1800;
const REACTION_MATCH_TARGET_POINTS = 5;
const QUIZ_RESPONSE_MS_CAP = 30000;
const DEFAULT_PVP_CHOICE_SEC = { ppt: 10, quiz: 10, reaction_tap: 10 };
function clampPvpChoiceSec(raw, fallback) {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(120, Math.max(3, n));
}
function parsePvpChoiceSecondsFromDoc(d) {
    const pcs = d.pvpChoiceSeconds;
    const o = pcs && typeof pcs === "object" ? pcs : {};
    return {
        ppt: clampPvpChoiceSec(o.ppt, DEFAULT_PVP_CHOICE_SEC.ppt),
        quiz: clampPvpChoiceSec(o.quiz, DEFAULT_PVP_CHOICE_SEC.quiz),
        reaction_tap: clampPvpChoiceSec(o.reaction_tap, DEFAULT_PVP_CHOICE_SEC.reaction_tap),
    };
}
function pvpChoiceWindowMs(secs, gameId) {
    const s = gameId === "ppt"
        ? secs.ppt
        : gameId === "quiz"
            ? secs.quiz
            : gameId === "reaction_tap"
                ? secs.reaction_tap
                : secs.ppt;
    return s * 1000;
}
function pvpActionDeadlineTs(fromMs, windowMs) {
    return firestore_2.Timestamp.fromMillis(fromMs + windowMs);
}
const REACTION_WAIT_MIN_MS = 1800;
const REACTION_WAIT_MAX_MS = 3400;
const REACTION_RESPONSE_MS_CAP = 9999;
const REACTION_FALSE_START_MS = 9999;
const REACTION_TIE_MS = 18;
function readPositiveIntEnv(name, fallback) {
    const raw = process.env[name];
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}
const MULTIPLAYER_FUNCTIONS_REGION = process.env.FUNCTIONS_REGION?.trim() || "southamerica-east1";
const MULTIPLAYER_FUNCTIONS_MIN_INSTANCES = readPositiveIntEnv("MULTIPLAYER_FUNCTIONS_MIN_INSTANCES", 0);
const APP_CHECK_ENFORCED = process.env.ENFORCE_APP_CHECK === "true" &&
    process.env.FUNCTIONS_EMULATOR !== "true" &&
    !process.env.FIREBASE_AUTH_EMULATOR_HOST;
const MULTIPLAYER_CALLABLE_OPTS = {
    region: MULTIPLAYER_FUNCTIONS_REGION,
    minInstances: MULTIPLAYER_FUNCTIONS_MIN_INSTANCES,
    enforceAppCheck: APP_CHECK_ENFORCED,
};
/** Callables gerais (perfil, login, etc.) — mesma região do cliente (`NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION`). */
const DEFAULT_CALLABLE_OPTS = {
    region: MULTIPLAYER_FUNCTIONS_REGION,
    enforceAppCheck: APP_CHECK_ENFORCED,
};
const DEFAULT_SCHEDULE_OPTS = {
    region: MULTIPLAYER_FUNCTIONS_REGION,
    timeZone: "America/Sao_Paulo",
};
const RAFFLE_SYSTEM_CONFIG_ID = "raffle_system";
const RAFFLE_MAX_RELEASED_COUNT = 1000000;
const RAFFLE_DEFAULT_DRAW_TIME_ZONE = DEFAULT_SCHEDULE_OPTS.timeZone;
const RAFFLE_DEFAULT_SYSTEM_CONFIG = {
    enabled: true,
    defaultTicketPrice: 1,
    defaultReleasedCount: 10000,
    defaultMaxPerPurchase: 20,
    defaultPrizeCurrency: "coins",
    defaultPrizeAmount: 1000,
    drawTimeZone: RAFFLE_DEFAULT_DRAW_TIME_ZONE,
};
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
const ALLOWED_REWARDED_AD_PLACEMENTS = new Set([
    HOME_REWARDED_PLACEMENT_ID,
    PPT_PVP_DUELS_PLACEMENT_ID,
    QUIZ_PVP_DUELS_PLACEMENT_ID,
    REACTION_PVP_DUELS_PLACEMENT_ID,
]);
const REWARDED_AD_MOCK_PREFIX = "mock_";
const REWARDED_AD_NATIVE_ANDROID_PREFIX = "native_android_";
const REWARDED_AD_TOKEN_MIN_LEN = 16;
const REWARDED_AD_TOKEN_MAX_LEN = 256;
const REWARDED_AD_SESSION_TTL_MS = 20 * 60 * 1000;
const ADMOB_SSV_KEYS_URL = "https://gstatic.com/admob/reward/verifier-keys.json";
const ADMOB_SSV_KEYS_TTL_MS = 24 * 60 * 60 * 1000;
const rewardAdMockAllowed = process.env.ALLOW_REWARDED_AD_MOCK === "true" ||
    process.env.FUNCTIONS_EMULATOR === "true" ||
    Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
let admobSsvKeysCache = null;
const CHEST_SYSTEM_CONFIG_ID = "chest_system";
const CHEST_SPEEDUP_PLACEMENT_ID = "chest_speedup";
const CHEST_RARITIES = ["comum", "raro", "epico", "lendario"];
const CHEST_SOURCES = [
    "multiplayer_win",
    "mission_claim",
    "daily_streak",
    "ranking_reward",
    "event",
];
const CHEST_BONUS_REWARD_KINDS = [
    "bonusCoins",
    "fragments",
    "boostMinutes",
    "superPrizeEntries",
];
const DEFAULT_CHEST_SYSTEM_CONFIG = {
    enabled: true,
    slotCount: 4,
    queueCapacity: 4,
    unlockDurationsByRarity: {
        comum: 60 * 60,
        raro: 3 * 60 * 60,
        epico: 8 * 60 * 60,
        lendario: 12 * 60 * 60,
    },
    dropTablesBySource: {
        multiplayer_win: [
            { rarity: "comum", weight: 70 },
            { rarity: "raro", weight: 22 },
            { rarity: "epico", weight: 7 },
            { rarity: "lendario", weight: 1 },
        ],
        mission_claim: [
            { rarity: "comum", weight: 20 },
            { rarity: "raro", weight: 55 },
            { rarity: "epico", weight: 22 },
            { rarity: "lendario", weight: 3 },
        ],
        daily_streak: [
            { rarity: "comum", weight: 0 },
            { rarity: "raro", weight: 55 },
            { rarity: "epico", weight: 35 },
            { rarity: "lendario", weight: 10 },
        ],
        ranking_reward: [
            { rarity: "comum", weight: 0 },
            { rarity: "raro", weight: 20 },
            { rarity: "epico", weight: 60 },
            { rarity: "lendario", weight: 20 },
        ],
        event: [
            { rarity: "comum", weight: 0 },
            { rarity: "raro", weight: 10 },
            { rarity: "epico", weight: 60 },
            { rarity: "lendario", weight: 30 },
        ],
    },
    rewardTablesByRarity: {
        comum: {
            coins: { min: 40, max: 90 },
            gems: { min: 0, max: 2 },
            xp: { min: 12, max: 22 },
        },
        raro: {
            coins: { min: 90, max: 180 },
            gems: { min: 1, max: 4 },
            xp: { min: 25, max: 45 },
        },
        epico: {
            coins: { min: 200, max: 380 },
            gems: { min: 4, max: 10 },
            xp: { min: 50, max: 80 },
        },
        lendario: {
            coins: { min: 450, max: 800 },
            gems: { min: 10, max: 25 },
            xp: { min: 90, max: 150 },
        },
    },
    bonusWeightsByRarity: {
        comum: [
            { kind: "bonusCoins", weight: 78 },
            { kind: "fragments", weight: 16 },
            { kind: "boostMinutes", weight: 5 },
            { kind: "superPrizeEntries", weight: 1 },
        ],
        raro: [
            { kind: "bonusCoins", weight: 55 },
            { kind: "fragments", weight: 25 },
            { kind: "boostMinutes", weight: 15 },
            { kind: "superPrizeEntries", weight: 5 },
        ],
        epico: [
            { kind: "bonusCoins", weight: 35 },
            { kind: "fragments", weight: 30 },
            { kind: "boostMinutes", weight: 25 },
            { kind: "superPrizeEntries", weight: 10 },
        ],
        lendario: [
            { kind: "bonusCoins", weight: 25 },
            { kind: "fragments", weight: 25 },
            { kind: "boostMinutes", weight: 30 },
            { kind: "superPrizeEntries", weight: 20 },
        ],
    },
    bonusRewardTablesByRarity: {
        comum: {
            bonusCoins: { min: 15, max: 40 },
            fragments: { min: 1, max: 2 },
            boostMinutes: { min: 5, max: 10 },
            superPrizeEntries: { min: 1, max: 1 },
        },
        raro: {
            bonusCoins: { min: 30, max: 90 },
            fragments: { min: 2, max: 4 },
            boostMinutes: { min: 10, max: 20 },
            superPrizeEntries: { min: 1, max: 2 },
        },
        epico: {
            bonusCoins: { min: 80, max: 180 },
            fragments: { min: 4, max: 8 },
            boostMinutes: { min: 20, max: 40 },
            superPrizeEntries: { min: 1, max: 3 },
        },
        lendario: {
            bonusCoins: { min: 160, max: 360 },
            fragments: { min: 8, max: 15 },
            boostMinutes: { min: 45, max: 90 },
            superPrizeEntries: { min: 2, max: 5 },
        },
    },
    adSpeedupPercent: 0.33,
    maxAdsPerChest: 3,
    adCooldownSeconds: 3 * 60,
    dailyChestAdsLimit: 12,
    pityRules: {
        rareAt: 4,
        epicAt: 12,
        legendaryAt: 40,
    },
};
function readPptDuelCharges(data) {
    if (!data)
        return PPT_DEFAULT_DUEL_CHARGES;
    /** Sem campo no doc (perfis antigos): trata como estoque cheio. Com campo, usa o valor real (≥0). */
    if (!Object.prototype.hasOwnProperty.call(data, "pptPvPDuelsRemaining")) {
        return PPT_DEFAULT_DUEL_CHARGES;
    }
    const raw = data.pptPvPDuelsRemaining;
    if (raw === null || raw === undefined) {
        return PPT_DEFAULT_DUEL_CHARGES;
    }
    const v = Number(raw);
    if (!Number.isFinite(v))
        return PPT_DEFAULT_DUEL_CHARGES;
    return Math.min(PPT_DUEL_CHARGES_MAX_STACK, Math.max(0, Math.floor(v)));
}
function readReactionDuelCharges(data) {
    if (!data)
        return REACTION_DEFAULT_DUEL_CHARGES;
    if (!Object.prototype.hasOwnProperty.call(data, "reactionPvPDuelsRemaining")) {
        return REACTION_DEFAULT_DUEL_CHARGES;
    }
    const raw = data.reactionPvPDuelsRemaining;
    if (raw === null || raw === undefined) {
        return REACTION_DEFAULT_DUEL_CHARGES;
    }
    const v = Number(raw);
    if (!Number.isFinite(v))
        return REACTION_DEFAULT_DUEL_CHARGES;
    return Math.min(REACTION_DUEL_CHARGES_MAX_STACK, Math.max(0, Math.floor(v)));
}
function readQuizDuelCharges(data) {
    if (!data)
        return QUIZ_DEFAULT_DUEL_CHARGES;
    if (!Object.prototype.hasOwnProperty.call(data, "quizPvPDuelsRemaining")) {
        return QUIZ_DEFAULT_DUEL_CHARGES;
    }
    const raw = data.quizPvPDuelsRemaining;
    if (raw === null || raw === undefined) {
        return QUIZ_DEFAULT_DUEL_CHARGES;
    }
    const v = Number(raw);
    if (!Number.isFinite(v))
        return QUIZ_DEFAULT_DUEL_CHARGES;
    return Math.min(QUIZ_DUEL_CHARGES_MAX_STACK, Math.max(0, Math.floor(v)));
}
function readQuizTargetScore(data) {
    if (!data)
        return QUIZ_MATCH_TARGET_POINTS;
    const v = Number(data.quizTargetScore);
    if (!Number.isFinite(v))
        return QUIZ_MATCH_TARGET_POINTS;
    return Math.max(QUIZ_MATCH_TARGET_POINTS, Math.floor(v));
}
/** Com 0 duelos e prazo vencido: recarrega 3 e remove o campo. */
async function ensurePptChargesRefilledInTx(tx, userRef, snap) {
    if (!snap.exists)
        return 0;
    const d = snap.data();
    const c = readPptDuelCharges(d);
    if (c >= 1)
        return c;
    const raMs = millisFromFirestoreTime(d.pptPvpDuelsRefillAvailableAt);
    if (raMs <= 0 || Date.now() < raMs)
        return c;
    tx.update(userRef, {
        pptPvPDuelsRemaining: PPT_DEFAULT_DUEL_CHARGES,
        pptPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    return PPT_DEFAULT_DUEL_CHARGES;
}
async function ensureReactionChargesRefilledInTx(tx, userRef, snap) {
    if (!snap.exists)
        return 0;
    const d = snap.data();
    const c = readReactionDuelCharges(d);
    if (c >= 1)
        return c;
    const raMs = millisFromFirestoreTime(d.reactionPvpDuelsRefillAvailableAt);
    if (raMs <= 0 || Date.now() < raMs)
        return c;
    tx.update(userRef, {
        reactionPvPDuelsRemaining: REACTION_DEFAULT_DUEL_CHARGES,
        reactionPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    return REACTION_DEFAULT_DUEL_CHARGES;
}
async function ensureQuizChargesRefilledInTx(tx, userRef, snap) {
    if (!snap.exists)
        return 0;
    const d = snap.data();
    const c = readQuizDuelCharges(d);
    if (c >= 1)
        return c;
    const raMs = millisFromFirestoreTime(d.quizPvpDuelsRefillAvailableAt);
    if (raMs <= 0 || Date.now() < raMs)
        return c;
    tx.update(userRef, {
        quizPvPDuelsRemaining: QUIZ_DEFAULT_DUEL_CHARGES,
        quizPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    return QUIZ_DEFAULT_DUEL_CHARGES;
}
/**
 * Se duelos = 0: agenda recuperação em 10 min (se ainda não houver data) ou aplica +3 se já passou.
 * Usado no join e numa callable leve para a fila mostrar o countdown.
 */
async function tryApplyPptTimedRefillForUser(uid) {
    const userRef = db.doc(`${COL.users}/${uid}`);
    await db.runTransaction(async (tx) => {
        const rs = await tx.get(userRef);
        if (!rs.exists)
            return;
        const d = rs.data();
        const c = readPptDuelCharges(d);
        if (c >= 1)
            return;
        const raMs = millisFromFirestoreTime(d.pptPvpDuelsRefillAvailableAt);
        if (raMs <= 0) {
            tx.update(userRef, {
                pptPvpDuelsRefillAvailableAt: firestore_2.Timestamp.fromMillis(Date.now() + PPT_DUEL_TIME_REFILL_MS),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            return;
        }
        if (Date.now() >= raMs) {
            tx.update(userRef, {
                pptPvPDuelsRemaining: PPT_DEFAULT_DUEL_CHARGES,
                pptPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
        }
    });
}
async function tryApplyReactionTimedRefillForUser(uid) {
    const userRef = db.doc(`${COL.users}/${uid}`);
    await db.runTransaction(async (tx) => {
        const rs = await tx.get(userRef);
        if (!rs.exists)
            return;
        const d = rs.data();
        const c = readReactionDuelCharges(d);
        if (c >= 1)
            return;
        const raMs = millisFromFirestoreTime(d.reactionPvpDuelsRefillAvailableAt);
        if (raMs <= 0) {
            tx.update(userRef, {
                reactionPvpDuelsRefillAvailableAt: firestore_2.Timestamp.fromMillis(Date.now() + REACTION_DUEL_TIME_REFILL_MS),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            return;
        }
        if (Date.now() >= raMs) {
            tx.update(userRef, {
                reactionPvPDuelsRemaining: REACTION_DEFAULT_DUEL_CHARGES,
                reactionPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
        }
    });
}
async function tryApplyQuizTimedRefillForUser(uid) {
    const userRef = db.doc(`${COL.users}/${uid}`);
    await db.runTransaction(async (tx) => {
        const rs = await tx.get(userRef);
        if (!rs.exists)
            return;
        const d = rs.data();
        const c = readQuizDuelCharges(d);
        if (c >= 1)
            return;
        const raMs = millisFromFirestoreTime(d.quizPvpDuelsRefillAvailableAt);
        if (raMs <= 0) {
            tx.update(userRef, {
                quizPvpDuelsRefillAvailableAt: firestore_2.Timestamp.fromMillis(Date.now() + QUIZ_DUEL_TIME_REFILL_MS),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            return;
        }
        if (Date.now() >= raMs) {
            tx.update(userRef, {
                quizPvPDuelsRemaining: QUIZ_DEFAULT_DUEL_CHARGES,
                quizPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
        }
    });
}
function assertAuthed(uid) {
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "Login obrigatório.");
}
async function assertAdmin(uid) {
    const user = await admin.auth().getUser(uid);
    if (user.customClaims?.admin !== true) {
        throw new https_1.HttpsError("permission-denied", "Apenas administradores.");
    }
}
async function getEconomy() {
    const snap = await db.doc(`${COL.systemConfigs}/economy`).get();
    const d = (snap.data() || {});
    const rawOverrides = d.matchRewardOverrides && typeof d.matchRewardOverrides === "object"
        ? d.matchRewardOverrides
        : {};
    const rawBuy = Math.floor(Number(d.conversionCoinsPerGemBuy));
    const rawSell = Math.floor(Number(d.conversionCoinsPerGemSell));
    const rawCash = Math.floor(Number(d.cashPointsPerReal));
    const rawBoostPercent = Math.floor(Number(d.boostRewardPercent));
    const rawFragmentsPerCraft = Math.floor(Number(d.fragmentsPerBoostCraft));
    const rawBoostMinutesPerCraft = Math.floor(Number(d.boostMinutesPerCraft));
    const rawBoostActivationMinutes = Math.floor(Number(d.boostActivationMinutes));
    return {
        rewardAdCoinAmount: typeof d.rewardAdCoinAmount === "number" ? d.rewardAdCoinAmount : 25,
        dailyLoginBonus: typeof d.dailyLoginBonus === "number" ? d.dailyLoginBonus : 50,
        boostEnabled: d.boostEnabled === true,
        boostRewardPercent: Number.isFinite(rawBoostPercent) && rawBoostPercent >= 0
            ? Math.min(300, rawBoostPercent)
            : 25,
        fragmentsPerBoostCraft: Number.isFinite(rawFragmentsPerCraft) && rawFragmentsPerCraft >= 1
            ? rawFragmentsPerCraft
            : 10,
        boostMinutesPerCraft: Number.isFinite(rawBoostMinutesPerCraft) && rawBoostMinutesPerCraft >= 1
            ? rawBoostMinutesPerCraft
            : 15,
        boostActivationMinutes: Number.isFinite(rawBoostActivationMinutes) && rawBoostActivationMinutes >= 1
            ? rawBoostActivationMinutes
            : 15,
        limiteDiarioAds: typeof d.limiteDiarioAds === "number" ? d.limiteDiarioAds : 20,
        welcomeBonus: typeof d.welcomeBonus === "number" ? d.welcomeBonus : 100,
        referralBonusIndicador: typeof d.referralBonusIndicador === "number" ? d.referralBonusIndicador : 200,
        referralBonusConvidado: typeof d.referralBonusConvidado === "number" ? d.referralBonusConvidado : 100,
        matchRewardOverrides: normalizeMatchRewardOverrides(rawOverrides),
        rankingPrizes: normalizeRankingPrizeConfig(d.rankingPrizes),
        streakTable: (0, streakEconomy_1.normalizeStreakTable)(d.streakTable),
        pvpChoiceSeconds: parsePvpChoiceSecondsFromDoc(d),
        /** PR por ticket ao comprar TICKET com PR (mín. 1). */
        conversionCoinsPerGemBuy: Number.isFinite(rawBuy) && rawBuy >= 1 ? rawBuy : 500,
        /** PR por ticket ao vender TICKET; 0 = desligado. */
        conversionCoinsPerGemSell: Number.isFinite(rawSell) && rawSell >= 0 ? rawSell : 0,
        /** Pontos CASH por R$ 1,00 (ex.: 100 → 100 pts = R$ 1). */
        cashPointsPerReal: Number.isFinite(rawCash) && rawCash >= 1 ? rawCash : 100,
    };
}
function normalizeRaffleReleasedCount(raw) {
    const parsed = Math.floor(Number(raw));
    if (!Number.isFinite(parsed))
        return RAFFLE_DEFAULT_SYSTEM_CONFIG.defaultReleasedCount;
    return Math.min(RAFFLE_MAX_RELEASED_COUNT, Math.max(1, parsed));
}
function normalizeRaffleTicketPrice(raw) {
    const parsed = Math.floor(Number(raw));
    if (!Number.isFinite(parsed))
        return RAFFLE_DEFAULT_SYSTEM_CONFIG.defaultTicketPrice;
    return Math.max(1, parsed);
}
function normalizeRaffleMaxPerPurchase(raw) {
    const parsed = Math.floor(Number(raw));
    if (!Number.isFinite(parsed))
        return RAFFLE_DEFAULT_SYSTEM_CONFIG.defaultMaxPerPurchase;
    return Math.min(500, Math.max(1, parsed));
}
function normalizeRafflePrizeAmount(raw) {
    const parsed = Math.floor(Number(raw));
    if (!Number.isFinite(parsed))
        return RAFFLE_DEFAULT_SYSTEM_CONFIG.defaultPrizeAmount;
    return Math.max(0, parsed);
}
const RAFFLE_PRIZE_IMAGE_URL_MAX = 2048;
function parsePrizeImageUrlFromDoc(raw) {
    if (typeof raw !== "string")
        return null;
    const t = raw.trim();
    if (!t || t.length > RAFFLE_PRIZE_IMAGE_URL_MAX)
        return null;
    return t;
}
/** `undefined` = não alterar o campo; `null` = remover; string = gravar URL. */
function normalizeOptionalPrizeImageUrlFromRequest(raw) {
    if (raw === undefined)
        return undefined;
    if (raw === null)
        return null;
    if (typeof raw !== "string") {
        throw new https_1.HttpsError("invalid-argument", "prizeImageUrl inválido.");
    }
    const t = raw.trim();
    if (!t)
        return null;
    if (t.length > RAFFLE_PRIZE_IMAGE_URL_MAX) {
        throw new https_1.HttpsError("invalid-argument", "prizeImageUrl muito longo.");
    }
    try {
        const u = new URL(t);
        const h = u.hostname.toLowerCase();
        const ok = u.protocol === "https:" ||
            (u.protocol === "http:" && (h === "localhost" || h === "127.0.0.1"));
        if (!ok)
            throw new Error("bad");
    }
    catch {
        throw new https_1.HttpsError("invalid-argument", "prizeImageUrl deve ser uma URL https (ou http em localhost /127.0.0.1 para emulador).");
    }
    return t;
}
async function getRaffleSystemConfig() {
    const snap = await db.doc(`${COL.systemConfigs}/${RAFFLE_SYSTEM_CONFIG_ID}`).get();
    const d = (snap.data() || {});
    const rawCurrency = d.defaultPrizeCurrency;
    const defaultPrizeCurrency = isRewardCurrency(rawCurrency)
        ? rawCurrency
        : RAFFLE_DEFAULT_SYSTEM_CONFIG.defaultPrizeCurrency;
    return {
        enabled: d.enabled !== false,
        defaultTicketPrice: normalizeRaffleTicketPrice(d.defaultTicketPrice),
        defaultReleasedCount: normalizeRaffleReleasedCount(d.defaultReleasedCount),
        defaultMaxPerPurchase: normalizeRaffleMaxPerPurchase(d.defaultMaxPerPurchase),
        defaultPrizeCurrency,
        defaultPrizeAmount: normalizeRafflePrizeAmount(d.defaultPrizeAmount),
        drawTimeZone: typeof d.drawTimeZone === "string" && d.drawTimeZone.trim()
            ? d.drawTimeZone.trim()
            : RAFFLE_DEFAULT_DRAW_TIME_ZONE,
    };
}
function coerceTimestampOrNull(value) {
    if (!value)
        return null;
    if (value instanceof firestore_2.Timestamp)
        return value;
    if (typeof value === "object") {
        const maybe = value;
        if (typeof maybe.toMillis === "function") {
            try {
                return firestore_2.Timestamp.fromMillis(maybe.toMillis());
            }
            catch {
                return null;
            }
        }
    }
    return null;
}
function raffleDocFromFirestore(id, data) {
    const status = String(data.status || "draft");
    const prizeCurrencyRaw = data.prizeCurrency;
    const prizeCurrency = isRewardCurrency(prizeCurrencyRaw) ? prizeCurrencyRaw : "coins";
    return {
        id,
        title: String(data.title || "").trim() || "Sorteio",
        description: typeof data.description === "string" ? data.description : null,
        status: ["draft", "active", "closed", "drawn", "paid", "no_winner"].includes(status)
            ? status
            : "draft",
        releasedCount: normalizeRaffleReleasedCount(data.releasedCount),
        nextSequentialNumber: Math.max(0, Math.min(RAFFLE_MAX_RELEASED_COUNT, Math.floor(Number(data.nextSequentialNumber) || 0))),
        soldCount: Math.max(0, Math.floor(Number(data.soldCount) || 0)),
        soldTicketsRevenue: Math.max(0, Math.floor(Number(data.soldTicketsRevenue) || 0)),
        ticketPrice: normalizeRaffleTicketPrice(data.ticketPrice),
        maxPerPurchase: normalizeRaffleMaxPerPurchase(data.maxPerPurchase),
        prizeCurrency,
        prizeAmount: normalizeRafflePrizeAmount(data.prizeAmount),
        prizeImageUrl: parsePrizeImageUrlFromDoc(data.prizeImageUrl),
        allocationMode: data.allocationMode === "random"
            ? "random"
            : data.allocationMode === "sequential"
                ? "sequential"
                : "sequential",
        startsAt: coerceTimestampOrNull(data.startsAt),
        endsAt: coerceTimestampOrNull(data.endsAt),
        closedAt: coerceTimestampOrNull(data.closedAt),
        drawnAt: coerceTimestampOrNull(data.drawnAt),
        paidAt: coerceTimestampOrNull(data.paidAt),
        winningNumber: data.winningNumber == null ? null : Math.max(0, Math.floor(Number(data.winningNumber) || 0)),
        winnerUserId: typeof data.winnerUserId === "string" ? data.winnerUserId : null,
        winnerPurchaseId: typeof data.winnerPurchaseId === "string" ? data.winnerPurchaseId : null,
        noWinnerPolicy: data.noWinnerPolicy === "no_payout_close" ? "no_payout_close" : "no_payout_close",
        drawTimeZone: typeof data.drawTimeZone === "string" && data.drawTimeZone.trim()
            ? data.drawTimeZone.trim()
            : RAFFLE_DEFAULT_DRAW_TIME_ZONE,
        createdAt: coerceTimestampOrNull(data.createdAt),
        updatedAt: coerceTimestampOrNull(data.updatedAt),
    };
}
function raffleViewFromDoc(docSnap) {
    const d = raffleDocFromFirestore(docSnap.id, (docSnap.data() || {}));
    return {
        id: d.id,
        title: d.title,
        description: d.description,
        status: d.status,
        releasedCount: d.releasedCount,
        nextSequentialNumber: d.nextSequentialNumber,
        soldCount: d.soldCount,
        soldTicketsRevenue: d.soldTicketsRevenue,
        ticketPrice: d.ticketPrice,
        maxPerPurchase: d.maxPerPurchase,
        prizeCurrency: d.prizeCurrency,
        prizeAmount: d.prizeAmount,
        prizeImageUrl: d.prizeImageUrl,
        startsAtMs: d.startsAt ? d.startsAt.toMillis() : null,
        endsAtMs: d.endsAt ? d.endsAt.toMillis() : null,
        closedAtMs: d.closedAt ? d.closedAt.toMillis() : null,
        drawnAtMs: d.drawnAt ? d.drawnAt.toMillis() : null,
        paidAtMs: d.paidAt ? d.paidAt.toMillis() : null,
        winningNumber: d.winningNumber,
        winnerUserId: d.winnerUserId,
        winnerPurchaseId: d.winnerPurchaseId,
        noWinnerPolicy: d.noWinnerPolicy,
        allocationMode: d.allocationMode,
        drawTimeZone: d.drawTimeZone,
        createdAtMs: d.createdAt ? d.createdAt.toMillis() : null,
        updatedAtMs: d.updatedAt ? d.updatedAt.toMillis() : null,
    };
}
function rafflePurchaseViewFromDoc(docSnap) {
    const d = (docSnap.data() || {});
    const createdAt = coerceTimestampOrNull(d.createdAt) ?? firestore_2.Timestamp.fromMillis(0);
    const rawNums = d.numbers;
    const numbers = Array.isArray(rawNums) && rawNums.length > 0
        ? rawNums.map((n) => Math.max(0, Math.floor(Number(n) || 0)))
        : null;
    return {
        id: docSnap.id,
        raffleId: String(d.raffleId || ""),
        raffleTitle: typeof d.raffleTitle === "string" ? d.raffleTitle : null,
        userId: String(d.userId || ""),
        quantity: Math.max(0, Math.floor(Number(d.quantity) || 0)),
        ticketCost: Math.max(0, Math.floor(Number(d.ticketCost) || 0)),
        rangeStart: Math.max(0, Math.floor(Number(d.rangeStart) || 0)),
        rangeEnd: Math.max(0, Math.floor(Number(d.rangeEnd) || 0)),
        numbers,
        clientRequestId: String(d.clientRequestId || ""),
        createdAtMs: createdAt.toMillis(),
    };
}
function raffleSoldBitsByteLength(releasedCount) {
    const n = Math.max(1, Math.min(RAFFLE_MAX_RELEASED_COUNT, Math.floor(releasedCount)));
    return Math.ceil(n / 8);
}
function readSoldBitsBuffer(raw, releasedCount) {
    const len = raffleSoldBitsByteLength(releasedCount);
    const buf = Buffer.alloc(len, 0);
    if (raw == null)
        return buf;
    let incoming = null;
    if (Buffer.isBuffer(raw))
        incoming = raw;
    else if (raw instanceof Uint8Array)
        incoming = Buffer.from(raw);
    if (!incoming || incoming.length === 0)
        return buf;
    const copyLen = Math.min(len, incoming.length);
    incoming.copy(buf, 0, 0, copyLen);
    return buf;
}
function raffleBitIsSet(buf, index) {
    if (index < 0 || index >= RAFFLE_MAX_RELEASED_COUNT)
        return true;
    const byte = index >> 3;
    if (byte >= buf.length)
        return false;
    const bit = index & 7;
    return (buf[byte] & (1 << bit)) !== 0;
}
function raffleBitSet(buf, index) {
    const byte = index >> 3;
    const bit = index & 7;
    if (byte < buf.length)
        buf[byte] |= 1 << bit;
}
function shuffleNumberArrayInPlace(nums) {
    for (let i = nums.length - 1; i > 0; i--) {
        const j = (0, node_crypto_1.randomInt)(0, i);
        const tmp = nums[i];
        nums[i] = nums[j];
        nums[j] = tmp;
    }
}
function isRafflePurchaseWindowOpen(raffle, nowMs) {
    if (raffle.startsAt && raffle.startsAt.toMillis() > nowMs)
        return false;
    if (raffle.endsAt && raffle.endsAt.toMillis() <= nowMs)
        return false;
    return true;
}
function pickWinningNumber(releasedCount) {
    const max = Math.max(1, Math.min(RAFFLE_MAX_RELEASED_COUNT, Math.floor(releasedCount)));
    return (0, node_crypto_1.randomInt)(0, max - 1);
}
function readStoredBoostMinutes(data) {
    if (!data)
        return 0;
    return Math.max(0, Math.floor(Number(data.storedBoostMinutes) || 0));
}
function readFragmentsBalance(data) {
    if (!data)
        return 0;
    return Math.max(0, Math.floor(Number(data.fragments) || 0));
}
function readActiveBoostUntilMs(data) {
    if (!data)
        return 0;
    return millisFromFirestoreTime(data.activeBoostUntil);
}
function isBoostSystemEnabled(economy) {
    return economy?.boostEnabled === true;
}
function resolveBoostedCoins(baseCoins, userData, economy, nowMs = Date.now()) {
    const normalizedBase = Math.max(0, Math.floor(Number(baseCoins) || 0));
    if (normalizedBase <= 0) {
        return { totalCoins: 0, boostCoins: 0, boostActive: false };
    }
    if (!isBoostSystemEnabled(economy)) {
        return { totalCoins: normalizedBase, boostCoins: 0, boostActive: false };
    }
    const activeUntilMs = readActiveBoostUntilMs(userData);
    const boostPercent = Math.max(0, Math.floor(Number(economy.boostRewardPercent) || 0));
    if (activeUntilMs <= nowMs || boostPercent <= 0) {
        return { totalCoins: normalizedBase, boostCoins: 0, boostActive: false };
    }
    const boostCoins = Math.max(1, Math.floor((normalizedBase * boostPercent) / 100));
    return {
        totalCoins: normalizedBase + boostCoins,
        boostCoins,
        boostActive: true,
    };
}
function withBoostDescription(description, boostCoins) {
    return boostCoins > 0 ? `${description} · boost +${boostCoins} PR` : description;
}
function isChestRarity(value) {
    return CHEST_RARITIES.includes(value);
}
function isChestSource(value) {
    return CHEST_SOURCES.includes(value);
}
function clampPositiveInt(value, fallback, min = 1) {
    const raw = Math.floor(Number(value));
    if (!Number.isFinite(raw))
        return fallback;
    return Math.max(min, raw);
}
function normalizeChestRewardRange(raw, fallback) {
    const value = raw && typeof raw === "object" ? raw : {};
    const min = Math.max(0, Math.floor(Number(value.min) || fallback.min));
    const max = Math.max(min, Math.floor(Number(value.max) || fallback.max));
    return { min, max };
}
function normalizeChestRewardTable(raw, fallback) {
    const value = raw && typeof raw === "object" ? raw : {};
    return {
        coins: normalizeChestRewardRange(value.coins, fallback.coins),
        gems: normalizeChestRewardRange(value.gems, fallback.gems),
        xp: normalizeChestRewardRange(value.xp, fallback.xp),
    };
}
function normalizeChestDropWeights(raw, fallback) {
    if (!Array.isArray(raw))
        return fallback;
    const normalized = raw
        .map((entry) => {
        const value = entry && typeof entry === "object" ? entry : {};
        const rarity = isChestRarity(value.rarity) ? value.rarity : null;
        const weight = Math.max(0, Math.floor(Number(value.weight) || 0));
        if (!rarity || weight <= 0)
            return null;
        return { rarity, weight };
    })
        .filter((entry) => entry !== null);
    return normalized.length > 0 ? normalized : fallback;
}
function isChestBonusRewardKind(value) {
    return typeof value === "string" && CHEST_BONUS_REWARD_KINDS.includes(value);
}
function normalizeChestBonusWeights(raw, fallback) {
    if (!Array.isArray(raw))
        return fallback;
    const normalized = raw
        .map((entry) => {
        const value = entry && typeof entry === "object" ? entry : {};
        const kind = isChestBonusRewardKind(value.kind) ? value.kind : null;
        const weight = Math.max(0, Math.floor(Number(value.weight) || 0));
        if (!kind || weight <= 0)
            return null;
        return { kind, weight };
    })
        .filter((entry) => entry !== null);
    return normalized.length > 0 ? normalized : fallback;
}
function normalizeChestBonusRewardTable(raw, fallback) {
    const value = raw && typeof raw === "object" ? raw : {};
    return {
        bonusCoins: normalizeChestRewardRange(value.bonusCoins, fallback.bonusCoins),
        fragments: normalizeChestRewardRange(value.fragments, fallback.fragments),
        boostMinutes: normalizeChestRewardRange(value.boostMinutes, fallback.boostMinutes),
        superPrizeEntries: normalizeChestRewardRange(value.superPrizeEntries, fallback.superPrizeEntries),
    };
}
async function getChestSystemConfig() {
    const snap = await db.doc(`${COL.systemConfigs}/${CHEST_SYSTEM_CONFIG_ID}`).get();
    const d = (snap.data() || {});
    const rawDurations = d.unlockDurationsByRarity && typeof d.unlockDurationsByRarity === "object"
        ? d.unlockDurationsByRarity
        : {};
    const rawDrops = d.dropTablesBySource && typeof d.dropTablesBySource === "object"
        ? d.dropTablesBySource
        : {};
    const rawRewards = d.rewardTablesByRarity && typeof d.rewardTablesByRarity === "object"
        ? d.rewardTablesByRarity
        : {};
    const rawBonusWeights = d.bonusWeightsByRarity && typeof d.bonusWeightsByRarity === "object"
        ? d.bonusWeightsByRarity
        : {};
    const rawBonusRewards = d.bonusRewardTablesByRarity && typeof d.bonusRewardTablesByRarity === "object"
        ? d.bonusRewardTablesByRarity
        : {};
    const rawPity = d.pityRules && typeof d.pityRules === "object" ? d.pityRules : {};
    return {
        enabled: d.enabled !== false,
        slotCount: clampPositiveInt(d.slotCount, DEFAULT_CHEST_SYSTEM_CONFIG.slotCount),
        queueCapacity: clampPositiveInt(d.queueCapacity, DEFAULT_CHEST_SYSTEM_CONFIG.queueCapacity, 0),
        unlockDurationsByRarity: {
            comum: clampPositiveInt(rawDurations.comum, DEFAULT_CHEST_SYSTEM_CONFIG.unlockDurationsByRarity.comum),
            raro: clampPositiveInt(rawDurations.raro, DEFAULT_CHEST_SYSTEM_CONFIG.unlockDurationsByRarity.raro),
            epico: clampPositiveInt(rawDurations.epico, DEFAULT_CHEST_SYSTEM_CONFIG.unlockDurationsByRarity.epico),
            lendario: clampPositiveInt(rawDurations.lendario, DEFAULT_CHEST_SYSTEM_CONFIG.unlockDurationsByRarity.lendario),
        },
        dropTablesBySource: {
            multiplayer_win: normalizeChestDropWeights(rawDrops.multiplayer_win, DEFAULT_CHEST_SYSTEM_CONFIG.dropTablesBySource.multiplayer_win),
            mission_claim: normalizeChestDropWeights(rawDrops.mission_claim, DEFAULT_CHEST_SYSTEM_CONFIG.dropTablesBySource.mission_claim),
            daily_streak: normalizeChestDropWeights(rawDrops.daily_streak, DEFAULT_CHEST_SYSTEM_CONFIG.dropTablesBySource.daily_streak),
            ranking_reward: normalizeChestDropWeights(rawDrops.ranking_reward, DEFAULT_CHEST_SYSTEM_CONFIG.dropTablesBySource.ranking_reward),
            event: normalizeChestDropWeights(rawDrops.event, DEFAULT_CHEST_SYSTEM_CONFIG.dropTablesBySource.event),
        },
        rewardTablesByRarity: {
            comum: normalizeChestRewardTable(rawRewards.comum, DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.comum),
            raro: normalizeChestRewardTable(rawRewards.raro, DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.raro),
            epico: normalizeChestRewardTable(rawRewards.epico, DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.epico),
            lendario: normalizeChestRewardTable(rawRewards.lendario, DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.lendario),
        },
        bonusWeightsByRarity: {
            comum: normalizeChestBonusWeights(rawBonusWeights.comum, DEFAULT_CHEST_SYSTEM_CONFIG.bonusWeightsByRarity.comum),
            raro: normalizeChestBonusWeights(rawBonusWeights.raro, DEFAULT_CHEST_SYSTEM_CONFIG.bonusWeightsByRarity.raro),
            epico: normalizeChestBonusWeights(rawBonusWeights.epico, DEFAULT_CHEST_SYSTEM_CONFIG.bonusWeightsByRarity.epico),
            lendario: normalizeChestBonusWeights(rawBonusWeights.lendario, DEFAULT_CHEST_SYSTEM_CONFIG.bonusWeightsByRarity.lendario),
        },
        bonusRewardTablesByRarity: {
            comum: normalizeChestBonusRewardTable(rawBonusRewards.comum, DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.comum),
            raro: normalizeChestBonusRewardTable(rawBonusRewards.raro, DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.raro),
            epico: normalizeChestBonusRewardTable(rawBonusRewards.epico, DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.epico),
            lendario: normalizeChestBonusRewardTable(rawBonusRewards.lendario, DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.lendario),
        },
        adSpeedupPercent: Math.min(0.95, Math.max(0.05, Number.isFinite(Number(d.adSpeedupPercent))
            ? Number(d.adSpeedupPercent)
            : DEFAULT_CHEST_SYSTEM_CONFIG.adSpeedupPercent)),
        maxAdsPerChest: clampPositiveInt(d.maxAdsPerChest, DEFAULT_CHEST_SYSTEM_CONFIG.maxAdsPerChest, 0),
        adCooldownSeconds: clampPositiveInt(d.adCooldownSeconds, DEFAULT_CHEST_SYSTEM_CONFIG.adCooldownSeconds, 0),
        dailyChestAdsLimit: clampPositiveInt(d.dailyChestAdsLimit, DEFAULT_CHEST_SYSTEM_CONFIG.dailyChestAdsLimit, 0),
        pityRules: {
            rareAt: clampPositiveInt(rawPity.rareAt, DEFAULT_CHEST_SYSTEM_CONFIG.pityRules.rareAt),
            epicAt: clampPositiveInt(rawPity.epicAt, DEFAULT_CHEST_SYSTEM_CONFIG.pityRules.epicAt),
            legendaryAt: clampPositiveInt(rawPity.legendaryAt, DEFAULT_CHEST_SYSTEM_CONFIG.pityRules.legendaryAt),
        },
    };
}
function readUserChestMetaState(data) {
    return {
        totalGranted: Math.max(0, Math.floor(Number(data?.totalGranted) || 0)),
        totalClaimed: Math.max(0, Math.floor(Number(data?.totalClaimed) || 0)),
        dailySpeedupDayKey: String(data?.dailySpeedupDayKey || ""),
        dailySpeedupCount: Math.max(0, Math.floor(Number(data?.dailySpeedupCount) || 0)),
        noRareCount: Math.max(0, Math.floor(Number(data?.noRareCount) || 0)),
        noEpicCount: Math.max(0, Math.floor(Number(data?.noEpicCount) || 0)),
        noLegendaryCount: Math.max(0, Math.floor(Number(data?.noLegendaryCount) || 0)),
    };
}
function readChestItemState(doc) {
    const data = (doc.data() || {});
    return {
        id: doc.id,
        userId: String(data.userId || ""),
        rarity: isChestRarity(data.rarity) ? data.rarity : "comum",
        source: isChestSource(data.source) ? data.source : "multiplayer_win",
        status: data.status === "queued" ||
            data.status === "locked" ||
            data.status === "unlocking" ||
            data.status === "ready"
            ? data.status
            : "locked",
        slotIndex: Number.isFinite(Number(data.slotIndex)) && data.slotIndex !== null
            ? Math.max(0, Math.floor(Number(data.slotIndex)))
            : null,
        queuePosition: Number.isFinite(Number(data.queuePosition)) && data.queuePosition !== null
            ? Math.max(0, Math.floor(Number(data.queuePosition)))
            : null,
        unlockDurationSec: clampPositiveInt(data.unlockDurationSec, 3600),
        rewardsSnapshot: {
            coins: Math.max(0, Math.floor(Number(data.rewardsSnapshot?.coins) || 0)),
            bonusCoins: Math.max(0, Math.floor(Number(data.rewardsSnapshot?.bonusCoins) || 0)),
            gems: Math.max(0, Math.floor(Number(data.rewardsSnapshot?.gems) || 0)),
            xp: Math.max(0, Math.floor(Number(data.rewardsSnapshot?.xp) || 0)),
            fragments: Math.max(0, Math.floor(Number(data.rewardsSnapshot?.fragments) || 0)),
            boostMinutes: Math.max(0, Math.floor(Number(data.rewardsSnapshot?.boostMinutes) || 0)),
            superPrizeEntries: Math.max(0, Math.floor(Number(data.rewardsSnapshot?.superPrizeEntries) || 0)),
        },
        adsUsed: Math.max(0, Math.floor(Number(data.adsUsed) || 0)),
        sourceRefId: typeof data.sourceRefId === "string" ? data.sourceRefId : null,
        grantedAtMs: millisFromFirestoreTime(data.grantedAt),
        unlockStartedAtMs: millisFromFirestoreTime(data.unlockStartedAt) || null,
        readyAtMs: millisFromFirestoreTime(data.readyAt) || null,
        nextAdAvailableAtMs: millisFromFirestoreTime(data.nextAdAvailableAt) || null,
        raw: data,
    };
}
function chestSlotSort(a, b) {
    const slotA = a.slotIndex ?? Number.MAX_SAFE_INTEGER;
    const slotB = b.slotIndex ?? Number.MAX_SAFE_INTEGER;
    if (slotA !== slotB)
        return slotA - slotB;
    return a.grantedAtMs - b.grantedAtMs || a.id.localeCompare(b.id);
}
function chestQueueSort(a, b) {
    const queueA = a.queuePosition ?? Number.MAX_SAFE_INTEGER;
    const queueB = b.queuePosition ?? Number.MAX_SAFE_INTEGER;
    if (queueA !== queueB)
        return queueA - queueB;
    return a.grantedAtMs - b.grantedAtMs || a.id.localeCompare(b.id);
}
function chestRarityOrder(rarity) {
    return CHEST_RARITIES.indexOf(rarity);
}
function promoteChestRarity(current, minRarity) {
    return chestRarityOrder(current) >= chestRarityOrder(minRarity) ? current : minRarity;
}
function normalizeChestSlotsAndQueue(items, config, nowMs) {
    const cloned = items.map((item) => ({ ...item }));
    for (const item of cloned) {
        if (item.status === "unlocking" && item.readyAtMs != null && item.readyAtMs <= nowMs) {
            item.status = "ready";
        }
    }
    const unlocking = cloned
        .filter((item) => item.status === "unlocking")
        .sort((a, b) => (a.unlockStartedAtMs ?? a.grantedAtMs) - (b.unlockStartedAtMs ?? b.grantedAtMs));
    const unlockingKeeperId = unlocking[0]?.id ?? null;
    for (const item of cloned) {
        if (item.status === "unlocking" && item.id !== unlockingKeeperId) {
            item.status = "locked";
            item.unlockStartedAtMs = null;
            item.readyAtMs = null;
            item.nextAdAvailableAtMs = null;
        }
    }
    let slotItems = cloned.filter((item) => item.status !== "queued").sort(chestSlotSort);
    const queueItems = cloned.filter((item) => item.status === "queued").sort(chestQueueSort);
    if (slotItems.length > config.slotCount) {
        const overflow = slotItems.splice(config.slotCount);
        for (const item of overflow) {
            item.status = "queued";
            item.slotIndex = null;
            item.unlockStartedAtMs = null;
            item.readyAtMs = null;
            item.nextAdAvailableAtMs = null;
            queueItems.push(item);
        }
    }
    while (slotItems.length < config.slotCount && queueItems.length > 0) {
        const next = queueItems.shift();
        next.status = "locked";
        next.slotIndex = slotItems.length;
        next.queuePosition = null;
        next.unlockStartedAtMs = null;
        next.readyAtMs = null;
        next.nextAdAvailableAtMs = null;
        slotItems.push(next);
    }
    slotItems = slotItems.sort(chestSlotSort);
    slotItems.forEach((item, index) => {
        item.slotIndex = index;
        item.queuePosition = null;
    });
    queueItems.sort(chestQueueSort);
    queueItems.forEach((item, index) => {
        item.status = "queued";
        item.slotIndex = null;
        item.queuePosition = index;
        item.unlockStartedAtMs = null;
        item.readyAtMs = null;
        item.nextAdAvailableAtMs = null;
    });
    return [...slotItems, ...queueItems];
}
function chestItemPatch(item) {
    return {
        status: item.status,
        slotIndex: item.slotIndex,
        queuePosition: item.queuePosition,
        unlockDurationSec: item.unlockDurationSec,
        rewardsSnapshot: item.rewardsSnapshot,
        adsUsed: item.adsUsed,
        sourceRefId: item.sourceRefId,
        unlockStartedAt: item.unlockStartedAtMs != null ? firestore_2.Timestamp.fromMillis(item.unlockStartedAtMs) : null,
        readyAt: item.readyAtMs != null ? firestore_2.Timestamp.fromMillis(item.readyAtMs) : null,
        nextAdAvailableAt: item.nextAdAvailableAtMs != null ? firestore_2.Timestamp.fromMillis(item.nextAdAvailableAtMs) : null,
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
    };
}
function chestStateChanged(before, after) {
    return (before.status !== after.status ||
        before.slotIndex !== after.slotIndex ||
        before.queuePosition !== after.queuePosition ||
        before.adsUsed !== after.adsUsed ||
        before.unlockStartedAtMs !== after.unlockStartedAtMs ||
        before.readyAtMs !== after.readyAtMs ||
        before.nextAdAvailableAtMs !== after.nextAdAvailableAtMs);
}
function rollRewardAmount(range) {
    if (range.max <= range.min)
        return range.min;
    return range.min + Math.floor(Math.random() * (range.max - range.min + 1));
}
function pickWeightedChestBonusRewardKind(weights) {
    const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0)
        return null;
    let roll = Math.random() * total;
    for (const entry of weights) {
        roll -= entry.weight;
        if (roll <= 0)
            return entry.kind;
    }
    return weights[weights.length - 1]?.kind ?? null;
}
function rollChestRewards(rarity, config, boostEnabled = true) {
    const table = config.rewardTablesByRarity[rarity];
    const rewards = {
        coins: rollRewardAmount(table.coins),
        bonusCoins: 0,
        gems: rollRewardAmount(table.gems),
        xp: rollRewardAmount(table.xp),
        fragments: 0,
        boostMinutes: 0,
        superPrizeEntries: 0,
    };
    const bonusKind = pickWeightedChestBonusRewardKind(config.bonusWeightsByRarity[rarity]);
    if (!bonusKind)
        return rewards;
    const resolvedBonusKind = !boostEnabled && bonusKind === "boostMinutes" ? "bonusCoins" : bonusKind;
    rewards[resolvedBonusKind] = rollRewardAmount(config.bonusRewardTablesByRarity[rarity][resolvedBonusKind]);
    return rewards;
}
function pickWeightedChestRarity(weights) {
    const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0)
        return "comum";
    let roll = Math.random() * total;
    for (const entry of weights) {
        roll -= entry.weight;
        if (roll <= 0)
            return entry.rarity;
    }
    return weights[weights.length - 1]?.rarity ?? "comum";
}
function applyChestPity(rarity, meta, config) {
    if (meta.noLegendaryCount + 1 >= config.pityRules.legendaryAt) {
        return "lendario";
    }
    if (meta.noEpicCount + 1 >= config.pityRules.epicAt) {
        return promoteChestRarity(rarity, "epico");
    }
    if (meta.noRareCount + 1 >= config.pityRules.rareAt) {
        return promoteChestRarity(rarity, "raro");
    }
    return rarity;
}
function nextChestMetaAfterGrant(meta, rarity) {
    return {
        ...meta,
        totalGranted: meta.totalGranted + 1,
        noRareCount: rarity === "comum" ? meta.noRareCount + 1 : 0,
        noEpicCount: rarity === "epico" || rarity === "lendario" ? 0 : meta.noEpicCount + 1,
        noLegendaryCount: rarity === "lendario" ? 0 : meta.noLegendaryCount + 1,
    };
}
function grantedChestSummary(item) {
    return {
        id: item.id,
        rarity: item.rarity,
        status: item.status,
        slotIndex: item.slotIndex,
        queuePosition: item.queuePosition,
        source: item.source,
    };
}
function chestItemWire(item) {
    return {
        id: item.id,
        userId: item.userId,
        rarity: item.rarity,
        source: item.source,
        status: item.status,
        slotIndex: item.slotIndex,
        queuePosition: item.queuePosition,
        unlockDurationSec: item.unlockDurationSec,
        rewardsSnapshot: item.rewardsSnapshot,
        adsUsed: item.adsUsed,
        sourceRefId: item.sourceRefId,
        grantedAtMs: item.grantedAtMs,
        unlockStartedAtMs: item.unlockStartedAtMs,
        readyAtMs: item.readyAtMs,
        nextAdAvailableAtMs: item.nextAdAvailableAtMs,
        updatedAtMs: millisFromFirestoreTime(item.raw.updatedAt) || item.grantedAtMs,
    };
}
async function grantChestIfEligible(input) {
    const [config, economy] = await Promise.all([getChestSystemConfig(), getEconomy()]);
    if (!config.enabled)
        return null;
    const metaRef = db.doc(`${COL.userChests}/${input.uid}`);
    const itemsCol = db.collection(`${COL.userChests}/${input.uid}/items`);
    return db.runTransaction(async (tx) => {
        const [metaSnap, itemsSnap] = await Promise.all([tx.get(metaRef), tx.get(itemsCol)]);
        const nowMs = Date.now();
        const meta = readUserChestMetaState(metaSnap.exists ? (metaSnap.data() || {}) : undefined);
        const rawItems = itemsSnap.docs.map((docSnap) => readChestItemState(docSnap));
        const normalizedItems = normalizeChestSlotsAndQueue(rawItems, config, nowMs);
        const normalizedById = new Map(normalizedItems.map((item) => [item.id, item]));
        for (const docSnap of itemsSnap.docs) {
            const before = rawItems.find((item) => item.id === docSnap.id);
            const after = normalizedById.get(docSnap.id);
            if (before && after && chestStateChanged(before, after)) {
                tx.update(docSnap.ref, chestItemPatch(after));
            }
        }
        const existingSameSource = input.sourceRefId != null
            ? normalizedItems.find((item) => item.source === input.source && item.sourceRefId === input.sourceRefId)
            : null;
        if (existingSameSource) {
            return grantedChestSummary(existingSameSource);
        }
        const occupiedSlots = normalizedItems.filter((item) => item.status !== "queued").length;
        const queuedCount = normalizedItems.filter((item) => item.status === "queued").length;
        if (occupiedSlots >= config.slotCount && queuedCount >= config.queueCapacity) {
            return null;
        }
        const rolled = pickWeightedChestRarity(config.dropTablesBySource[input.source]);
        const rarity = applyChestPity(rolled, meta, config);
        const newItemRef = itemsCol.doc();
        const slotIndex = occupiedSlots < config.slotCount ? occupiedSlots : null;
        const queuePosition = slotIndex == null ? queuedCount : null;
        const status = slotIndex == null ? "queued" : "locked";
        const rewardsSnapshot = rollChestRewards(rarity, config, isBoostSystemEnabled(economy));
        tx.set(newItemRef, {
            id: newItemRef.id,
            userId: input.uid,
            rarity,
            source: input.source,
            status,
            slotIndex,
            queuePosition,
            unlockDurationSec: config.unlockDurationsByRarity[rarity],
            rewardsSnapshot,
            adsUsed: 0,
            sourceRefId: input.sourceRefId ?? null,
            grantedAt: firestore_2.FieldValue.serverTimestamp(),
            unlockStartedAt: null,
            readyAt: null,
            nextAdAvailableAt: null,
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        const nextMeta = nextChestMetaAfterGrant(meta, rarity);
        tx.set(metaRef, {
            userId: input.uid,
            totalGranted: nextMeta.totalGranted,
            totalClaimed: nextMeta.totalClaimed,
            dailySpeedupDayKey: nextMeta.dailySpeedupDayKey || null,
            dailySpeedupCount: nextMeta.dailySpeedupCount,
            noRareCount: nextMeta.noRareCount,
            noEpicCount: nextMeta.noEpicCount,
            noLegendaryCount: nextMeta.noLegendaryCount,
            createdAt: metaSnap.exists ? metaSnap.get("createdAt") ?? firestore_2.FieldValue.serverTimestamp() : firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        return {
            id: newItemRef.id,
            rarity,
            status,
            slotIndex,
            queuePosition,
            source: input.source,
        };
    });
}
async function grantPvpVictoryChestAndSyncRoom(input) {
    const hostGrantedChest = input.matchWinner === "host"
        ? await grantChestIfEligible({
            uid: input.hostUid,
            source: "multiplayer_win",
            sourceRefId: `${input.roomId}:host`,
        })
        : null;
    const guestGrantedChest = input.matchWinner === "guest"
        ? await grantChestIfEligible({
            uid: input.guestUid,
            source: "multiplayer_win",
            sourceRefId: `${input.roomId}:guest`,
        })
        : null;
    await db.doc(`${COL.gameRooms}/${input.roomId}`).set({
        pvpHostGrantedChest: hostGrantedChest,
        pvpGuestGrantedChest: guestGrantedChest,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { hostGrantedChest, guestGrantedChest };
}
function applyNormalizedChestItemWrites(tx, docSnaps, beforeItems, afterItems) {
    const afterById = new Map(afterItems.map((item) => [item.id, item]));
    for (const docSnap of docSnaps) {
        const before = beforeItems.find((item) => item.id === docSnap.id);
        const after = afterById.get(docSnap.id);
        if (before && after && chestStateChanged(before, after)) {
            tx.update(docSnap.ref, chestItemPatch(after));
        }
    }
}
function writeChestMetaState(tx, metaRef, metaSnap, uid, meta) {
    tx.set(metaRef, {
        userId: uid,
        totalGranted: meta.totalGranted,
        totalClaimed: meta.totalClaimed,
        dailySpeedupDayKey: meta.dailySpeedupDayKey || null,
        dailySpeedupCount: meta.dailySpeedupCount,
        noRareCount: meta.noRareCount,
        noEpicCount: meta.noEpicCount,
        noLegendaryCount: meta.noLegendaryCount,
        createdAt: metaSnap.exists
            ? metaSnap.get("createdAt") ?? firestore_2.FieldValue.serverTimestamp()
            : firestore_2.FieldValue.serverTimestamp(),
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
}
function chestActionStatus(item, nowMs) {
    if (item.status === "unlocking" && item.readyAtMs != null && item.readyAtMs <= nowMs) {
        return "ready";
    }
    return item.status;
}
function chestActionPayload(item, nowMs) {
    const status = chestActionStatus(item, nowMs);
    const readyAtMs = item.readyAtMs ?? null;
    const remainingMs = status === "ready" || readyAtMs == null ? 0 : Math.max(0, readyAtMs - nowMs);
    return {
        chestId: item.id,
        rarity: item.rarity,
        status,
        slotIndex: item.slotIndex,
        queuePosition: item.queuePosition,
        readyAtMs,
        remainingMs,
        adsUsed: item.adsUsed,
    };
}
function normalizeRewardOverride(value) {
    if (!value)
        return undefined;
    const out = {};
    const keys = [
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
function normalizeMatchRewardOverrides(raw) {
    return {
        ppt: normalizeRewardOverride(raw.ppt),
        quiz: normalizeRewardOverride(raw.quiz),
        reaction_tap: normalizeRewardOverride(raw.reaction_tap),
    };
}
function pad2(value) {
    return String(value).padStart(2, "0");
}
function appDateTimeParts(d = new Date(), timeZone = DEFAULT_SCHEDULE_OPTS.timeZone) {
    const values = {};
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        hourCycle: "h23",
    });
    for (const part of formatter.formatToParts(d)) {
        if (part.type !== "literal")
            values[part.type] = part.value;
    }
    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day),
        hour: Number(values.hour),
        minute: Number(values.minute),
        second: Number(values.second),
    };
}
function appDateToUtcMs(parts) {
    const approxUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
    const offsetParts = appDateTimeParts(new Date(approxUtc));
    const offsetUtc = Date.UTC(offsetParts.year, offsetParts.month - 1, offsetParts.day, offsetParts.hour, offsetParts.minute, offsetParts.second);
    return approxUtc - (offsetUtc - approxUtc);
}
function startOfAppDay(d = new Date()) {
    const parts = appDateTimeParts(d);
    return new Date(appDateToUtcMs({
        year: parts.year,
        month: parts.month,
        day: parts.day,
    }));
}
function dailyKey(d = new Date()) {
    const parts = appDateTimeParts(d);
    return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}
function weeklyKey(d = new Date()) {
    const parts = appDateTimeParts(d);
    const t = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((+t - +yearStart) / 86400000 + 1) / 7);
    return `${t.getUTCFullYear()}-W${pad2(week)}`;
}
function monthlyKey(d = new Date()) {
    const parts = appDateTimeParts(d);
    return `${parts.year}-${pad2(parts.month)}`;
}
function rankingCollectionForPeriod(period) {
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
function rankingKeyForPeriod(period, when = new Date()) {
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
function rankingReferenceDateForClose(period, when = new Date()) {
    if (period === "mensal")
        return new Date(when.getTime() - 60000);
    return new Date(when.getTime() - 1000);
}
function referralAllTimeKey() {
    return "global";
}
const ARENA_OVERALL_GAME_IDS = ["ppt", "quiz", "reaction_tap"];
function referralRankingCollection(period) {
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
function referralRankingKey(period, when = new Date()) {
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
function isRewardCurrency(value) {
    return value === "coins" || value === "gems" || value === "rewardBalance";
}
function normalizeRewardCurrency(value, fallback = "coins") {
    return isRewardCurrency(value) ? value : fallback;
}
function normalizePrizeTierList(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((item) => {
        const data = item;
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
                currency: "coins",
            };
        }
        return {
            posicaoMax: Math.max(1, Math.floor(Number(data.posicaoMax) || 0)),
            amount: legacyGems,
            currency: "gems",
        };
    })
        .filter((item) => item.posicaoMax >= 1 && item.amount > 0)
        .sort((a, b) => a.posicaoMax - b.posicaoMax);
}
function emptyRankingPrizeRewards() {
    return { coins: 0, gems: 0, rewardBalance: 0 };
}
function hasRankingPrizeRewards(rewards) {
    return rewards.coins + rewards.gems + rewards.rewardBalance > 0;
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
};
const DEFAULT_CLAN_RANKING_PRIZES = {
    diario: [],
    semanal: [
        { posicaoMax: 1, rewards: { coins: 1500, gems: 60, rewardBalance: 30 } },
        { posicaoMax: 3, rewards: { coins: 800, gems: 30, rewardBalance: 15 } },
        { posicaoMax: 10, rewards: { coins: 300, gems: 10, rewardBalance: 5 } },
    ],
    mensal: [],
};
function normalizeRankingPrizeTierList(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((item) => {
        const data = item;
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
function normalizeRankingPrizeConfig(raw) {
    const data = raw && typeof raw === "object" ? raw : {};
    const globalSource = data.global && typeof data.global === "object"
        ? data.global
        : data;
    const byGameSource = data.byGame && typeof data.byGame === "object"
        ? data.byGame
        : {};
    const clanSource = data.clans && typeof data.clans === "object"
        ? data.clans
        : {};
    const global = {
        diario: normalizeRankingPrizeTierList(globalSource.diario),
        semanal: normalizeRankingPrizeTierList(globalSource.semanal),
        mensal: normalizeRankingPrizeTierList(globalSource.mensal),
    };
    if (global.diario.length === 0)
        global.diario = DEFAULT_GLOBAL_RANKING_PRIZES.diario;
    if (global.semanal.length === 0)
        global.semanal = DEFAULT_GLOBAL_RANKING_PRIZES.semanal;
    if (global.mensal.length === 0)
        global.mensal = DEFAULT_GLOBAL_RANKING_PRIZES.mensal;
    const clans = {
        diario: normalizeRankingPrizeTierList(clanSource.diario),
        semanal: normalizeRankingPrizeTierList(clanSource.semanal),
        mensal: normalizeRankingPrizeTierList(clanSource.mensal),
    };
    if (clans.diario.length === 0)
        clans.diario = DEFAULT_CLAN_RANKING_PRIZES.diario;
    if (clans.semanal.length === 0)
        clans.semanal = DEFAULT_CLAN_RANKING_PRIZES.semanal;
    if (clans.mensal.length === 0)
        clans.mensal = DEFAULT_CLAN_RANKING_PRIZES.mensal;
    const byGame = {};
    for (const gameId of RANKING_GAME_IDS) {
        const gameSource = byGameSource[gameId] && typeof byGameSource[gameId] === "object"
            ? byGameSource[gameId]
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
    return { global, byGame, clans };
}
function rankingPrizeTiersForScope(config, period, gameId) {
    if (gameId)
        return config.byGame[gameId]?.[period] ?? [];
    return config.global[period];
}
function clanRankingPrizeTiersForPeriod(config, period) {
    return config.clans[period] ?? [];
}
function rankingPrizeTierForPosition(tiers, position) {
    return tiers.find((tier) => position <= tier.posicaoMax) ?? null;
}
function buildReferralCodeSeed(name, username) {
    const raw = `${username || ""}${name || ""}`.replace(/[^a-z0-9]/gi, "").toUpperCase();
    const compact = raw.slice(0, 4);
    return compact.length >= 3 ? compact : "PREM";
}
function randomReferralCode(seed) {
    return `${seed}${randomCode(4)}`.slice(0, 8);
}
function avatarInitials(name) {
    const parts = String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    if (parts.length === 0)
        return "?";
    return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}
function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
}
function buildDefaultAvatarDataUrl(seed, displayName) {
    const palettes = [
        ["#06B6D4", "#7C3AED"],
        ["#8B5CF6", "#EC4899"],
        ["#F59E0B", "#EF4444"],
        ["#10B981", "#06B6D4"],
        ["#6366F1", "#A855F7"],
    ];
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
function normalizeHttpPhotoUrl(photoUrl) {
    const value = String(photoUrl || "").trim();
    if (!value)
        return null;
    try {
        const url = new URL(value);
        if (url.protocol === "http:" || url.protocol === "https:") {
            return value;
        }
    }
    catch {
        /* ignore invalid URLs */
    }
    return null;
}
async function generateUniqueReferralCode(seed) {
    for (let i = 0; i < 12; i++) {
        const code = randomReferralCode(seed);
        const dup = await db.collection(COL.users).where("codigoConvite", "==", code).limit(1).get();
        if (dup.empty)
            return code;
    }
    return `${seed.slice(0, 2)}${Date.now().toString(36).toUpperCase().slice(-6)}`.slice(0, 8);
}
async function getReferralConfig() {
    const snap = await db.doc(`${COL.systemConfigs}/referral_system`).get();
    const d = (snap.data() || {});
    return {
        enabled: d.enabled !== false,
        codeRequired: d.codeRequired === true,
        defaultInviterRewardAmount: Math.max(0, Math.floor(Number(d.defaultInviterRewardAmount ?? d.defaultInviterRewardCoins) || 100)),
        defaultInviterRewardCurrency: normalizeRewardCurrency(d.defaultInviterRewardCurrency, "coins"),
        defaultInvitedRewardAmount: Math.max(0, Math.floor(Number(d.defaultInvitedRewardAmount ?? d.defaultInvitedRewardCoins) || 50)),
        defaultInvitedRewardCurrency: normalizeRewardCurrency(d.defaultInvitedRewardCurrency, "coins"),
        invitedRewardEnabled: d.invitedRewardEnabled !== false,
        rankingEnabled: d.rankingEnabled !== false,
        limitValidPerDay: Math.max(0, Math.floor(Number(d.limitValidPerDay) || 20)),
        limitRewardedPerUser: Math.max(0, Math.floor(Number(d.limitRewardedPerUser) || 500)),
        qualificationRules: {
            requireEmailVerified: d.qualificationRules && typeof d.qualificationRules === "object"
                ? d.qualificationRules.requireEmailVerified === true
                : false,
            requireProfileCompleted: d.qualificationRules && typeof d.qualificationRules === "object"
                ? d.qualificationRules.requireProfileCompleted !== false
                : true,
            minAdsWatched: Math.max(0, Math.floor(Number(d.qualificationRules && typeof d.qualificationRules === "object"
                ? d.qualificationRules.minAdsWatched
                : 0) || 0)),
            minMatchesPlayed: Math.max(0, Math.floor(Number(d.qualificationRules && typeof d.qualificationRules === "object"
                ? d.qualificationRules.minMatchesPlayed
                : 1) || 1)),
            minMissionRewardsClaimed: Math.max(0, Math.floor(Number(d.qualificationRules && typeof d.qualificationRules === "object"
                ? d.qualificationRules.minMissionRewardsClaimed
                : 0) || 0)),
        },
        antiFraudRules: {
            blockSelfReferral: d.antiFraudRules && typeof d.antiFraudRules === "object"
                ? d.antiFraudRules.blockSelfReferral !== false
                : true,
            flagBurstSignups: d.antiFraudRules && typeof d.antiFraudRules === "object"
                ? d.antiFraudRules.flagBurstSignups !== false
                : true,
            burstSignupThreshold: Math.max(1, Math.floor(Number(d.antiFraudRules && typeof d.antiFraudRules === "object"
                ? d.antiFraudRules.burstSignupThreshold
                : 5) || 5)),
            requireManualReviewForSuspected: d.antiFraudRules && typeof d.antiFraudRules === "object"
                ? d.antiFraudRules.requireManualReviewForSuspected === true
                : false,
        },
        activeCampaignId: typeof d.activeCampaignId === "string" ? d.activeCampaignId : null,
        campaignText: typeof d.campaignText === "string" ? d.campaignText : null,
    };
}
async function getActiveReferralCampaign(config) {
    if (config.activeCampaignId) {
        const snap = await db.doc(`${COL.referralCampaigns}/${config.activeCampaignId}`).get();
        if (snap.exists) {
            const d = snap.data();
            return {
                id: snap.id,
                name: String(d.name || "Campanha de indicação"),
                config: {
                    inviterRewardAmount: Math.max(0, Math.floor(Number(d.config && typeof d.config === "object"
                        ? d.config.inviterRewardAmount ??
                            d.config.inviterRewardCoins
                        : config.defaultInviterRewardAmount) || config.defaultInviterRewardAmount)),
                    inviterRewardCurrency: d.config && typeof d.config === "object"
                        ? normalizeRewardCurrency(d.config.inviterRewardCurrency, config.defaultInviterRewardCurrency)
                        : config.defaultInviterRewardCurrency,
                    invitedRewardAmount: Math.max(0, Math.floor(Number(d.config && typeof d.config === "object"
                        ? d.config.invitedRewardAmount ??
                            d.config.invitedRewardCoins
                        : config.defaultInvitedRewardAmount) || config.defaultInvitedRewardAmount)),
                    invitedRewardCurrency: d.config && typeof d.config === "object"
                        ? normalizeRewardCurrency(d.config.invitedRewardCurrency, config.defaultInvitedRewardCurrency)
                        : config.defaultInvitedRewardCurrency,
                    invitedRewardEnabled: d.config && typeof d.config === "object"
                        ? d.config.invitedRewardEnabled !== false
                        : config.invitedRewardEnabled,
                    qualificationRules: d.config && typeof d.config === "object" && d.config.qualificationRules
                        ? {
                            ...config.qualificationRules,
                            ...d.config.qualificationRules,
                        }
                        : config.qualificationRules,
                    rankingPrizes: d.config && typeof d.config === "object" && d.config.rankingPrizes
                        ? {
                            daily: normalizePrizeTierList(d.config.rankingPrizes.daily),
                            weekly: normalizePrizeTierList(d.config.rankingPrizes.weekly),
                            monthly: normalizePrizeTierList(d.config.rankingPrizes.monthly),
                            all: normalizePrizeTierList(d.config.rankingPrizes.all),
                        }
                        : undefined,
                },
            };
        }
    }
    const activeSnap = await db.collection(COL.referralCampaigns).where("isActive", "==", true).limit(10).get();
    const now = Date.now();
    for (const item of activeSnap.docs) {
        const d = item.data();
        const startAt = millisFromFirestoreTime(d.startAt);
        const endAt = millisFromFirestoreTime(d.endAt);
        if (startAt > 0 && now < startAt)
            continue;
        if (endAt > 0 && now > endAt)
            continue;
        return {
            id: item.id,
            name: String(d.name || "Campanha de indicação"),
            config: {
                inviterRewardAmount: Math.max(0, Math.floor(Number(d.config && typeof d.config === "object"
                    ? d.config.inviterRewardAmount ??
                        d.config.inviterRewardCoins
                    : config.defaultInviterRewardAmount) || config.defaultInviterRewardAmount)),
                inviterRewardCurrency: d.config && typeof d.config === "object"
                    ? normalizeRewardCurrency(d.config.inviterRewardCurrency, config.defaultInviterRewardCurrency)
                    : config.defaultInviterRewardCurrency,
                invitedRewardAmount: Math.max(0, Math.floor(Number(d.config && typeof d.config === "object"
                    ? d.config.invitedRewardAmount ??
                        d.config.invitedRewardCoins
                    : config.defaultInvitedRewardAmount) || config.defaultInvitedRewardAmount)),
                invitedRewardCurrency: d.config && typeof d.config === "object"
                    ? normalizeRewardCurrency(d.config.invitedRewardCurrency, config.defaultInvitedRewardCurrency)
                    : config.defaultInvitedRewardCurrency,
                invitedRewardEnabled: d.config && typeof d.config === "object"
                    ? d.config.invitedRewardEnabled !== false
                    : config.invitedRewardEnabled,
                qualificationRules: d.config && typeof d.config === "object" && d.config.qualificationRules
                    ? {
                        ...config.qualificationRules,
                        ...d.config.qualificationRules,
                    }
                    : config.qualificationRules,
                rankingPrizes: d.config && typeof d.config === "object" && d.config.rankingPrizes
                    ? {
                        daily: normalizePrizeTierList(d.config.rankingPrizes.daily),
                        weekly: normalizePrizeTierList(d.config.rankingPrizes.weekly),
                        monthly: normalizePrizeTierList(d.config.rankingPrizes.monthly),
                        all: normalizePrizeTierList(d.config.rankingPrizes.all),
                    }
                    : undefined,
            },
        };
    }
    return null;
}
async function upsertReferralRankingEntry(tx, inviterUid, inviterName, inviterPhoto, deltas) {
    const periods = ["daily", "weekly", "monthly", "all"];
    for (const period of periods) {
        const ref = db.doc(`${referralRankingCollection(period)}/${referralRankingKey(period)}/entries/${inviterUid}`);
        tx.set(ref, {
            userId: inviterUid,
            userName: inviterName,
            photoURL: inviterPhoto ?? null,
            pendingReferrals: firestore_2.FieldValue.increment(deltas.pending ?? 0),
            validReferrals: firestore_2.FieldValue.increment(deltas.valid ?? 0),
            rewardedReferrals: firestore_2.FieldValue.increment(deltas.rewarded ?? 0),
            blockedReferrals: firestore_2.FieldValue.increment(deltas.blocked ?? 0),
            totalRewards: firestore_2.FieldValue.increment(deltas.rewards ?? 0),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
}
function randomCode(len = 8) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < len; i++)
        s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}
async function addWalletTx(input) {
    await db.collection(COL.wallet).add({
        userId: input.userId,
        tipo: input.tipo,
        moeda: input.moeda,
        valor: input.valor,
        saldoApos: input.saldoApos,
        descricao: input.descricao,
        referenciaId: input.referenciaId ?? null,
        criadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
}
function hashId(...parts) {
    return (0, node_crypto_1.createHash)("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}
function addWalletTxInTx(tx, input) {
    tx.set(db.doc(`${COL.wallet}/${input.id}`), {
        userId: input.userId,
        tipo: input.tipo,
        moeda: input.moeda,
        valor: input.valor,
        saldoApos: input.saldoApos,
        descricao: input.descricao,
        referenciaId: input.referenciaId ?? null,
        criadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
}
function rewardCurrencyLabel(currency) {
    return currency === "coins" ? "PR" : currency === "gems" ? "TICKET" : "CASH";
}
function getUserBalanceByCurrency(userData, currency) {
    return currency === "coins"
        ? Number(userData.coins || 0)
        : currency === "gems"
            ? Number(userData.gems || 0)
            : Number(userData.rewardBalance || 0);
}
function rewardFieldName(currency) {
    return currency === "coins" ? "coins" : currency === "gems" ? "gems" : "rewardBalance";
}
function applyRewardPatch(currentData, reward) {
    const current = getUserBalanceByCurrency(currentData, reward.currency);
    return {
        patch: {
            [rewardFieldName(reward.currency)]: firestore_2.FieldValue.increment(reward.amount),
        },
        balanceAfter: current + reward.amount,
    };
}
function applyMultiCurrencyRewardPatch(currentData, rewards) {
    const patch = {};
    const balancesAfter = {
        coins: Number(currentData.coins || 0),
        gems: Number(currentData.gems || 0),
        rewardBalance: Number(currentData.rewardBalance || 0),
    };
    for (const currency of ["coins", "gems", "rewardBalance"]) {
        const amount = Math.max(0, Math.floor(Number(rewards[currency]) || 0));
        if (amount <= 0)
            continue;
        patch[rewardFieldName(currency)] = firestore_2.FieldValue.increment(amount);
        balancesAfter[currency] += amount;
    }
    return { patch, balancesAfter };
}
function referralMeetsQualification(rules, userData, emailVerified) {
    if (rules.requireEmailVerified && !emailVerified)
        return false;
    if (rules.requireProfileCompleted) {
        if (!String(userData.nome || "").trim() || !String(userData.username || "").trim())
            return false;
    }
    if (Number(userData.totalAdsAssistidos || 0) < rules.minAdsWatched)
        return false;
    if (Number(userData.totalPartidas || 0) < rules.minMatchesPlayed)
        return false;
    if (Number(userData.totalMissionRewardsClaimed || 0) < rules.minMissionRewardsClaimed)
        return false;
    return true;
}
function buildReferralProgressSnapshot(userData, emailVerified) {
    return {
        emailVerified,
        profileCompleted: Boolean(String(userData.nome || "").trim() && String(userData.username || "").trim()),
        adsWatched: Number(userData.totalAdsAssistidos || 0),
        matchesPlayed: Number(userData.totalPartidas || 0),
        missionRewardsClaimed: Number(userData.totalMissionRewardsClaimed || 0),
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
    };
}
async function evaluateReferralForUser(uid) {
    const referralRef = db.doc(`${COL.referrals}/${uid}`);
    const config = await getReferralConfig();
    if (!config.enabled)
        return;
    const campaign = await getActiveReferralCampaign(config);
    await db.runTransaction(async (tx) => {
        const referralSnap = await tx.get(referralRef);
        if (!referralSnap.exists)
            return;
        const referral = referralSnap.data();
        const status = String(referral.status || "pending");
        if (status === "blocked" || status === "invalid" || status === "rewarded")
            return;
        const inviterUid = String(referral.inviterUserId || "");
        const invitedUid = String(referral.invitedUserId || "");
        if (!inviterUid || !invitedUid)
            return;
        const [invitedSnap, inviterSnap] = await Promise.all([
            tx.get(db.doc(`${COL.users}/${invitedUid}`)),
            tx.get(db.doc(`${COL.users}/${inviterUid}`)),
        ]);
        if (!invitedSnap.exists || !inviterSnap.exists)
            return;
        const invitedData = invitedSnap.data();
        const inviterData = inviterSnap.data();
        const authUser = await admin.auth().getUser(invitedUid);
        const rules = campaign?.config.qualificationRules ?? config.qualificationRules;
        const progressSnapshot = buildReferralProgressSnapshot(invitedData, authUser.emailVerified === true);
        const referralProgressPatch = {
            qualificationSnapshot: rules,
            progressSnapshot,
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        };
        const isQualified = referralMeetsQualification(rules, invitedData, authUser.emailVerified === true);
        if (!isQualified) {
            tx.update(referralRef, referralProgressPatch);
            return;
        }
        const todayReferralsSnap = await tx.get(db
            .collection(COL.referrals)
            .where("inviterUserId", "==", inviterUid)
            .where("status", "in", ["valid", "rewarded"])
            .where("qualifiedAt", ">=", firestore_2.Timestamp.fromDate(startOfAppDay()))
            .limit(config.limitValidPerDay + 1));
        const inviterQualifiedToday = todayReferralsSnap.size;
        const totalRewarded = Number(inviterData.referralRewardedCount || 0);
        const suspicious = config.antiFraudRules.flagBurstSignups &&
            Number(inviterData.referralPendingCount || 0) >= config.antiFraudRules.burstSignupThreshold;
        if (config.limitValidPerDay > 0 && inviterQualifiedToday >= config.limitValidPerDay) {
            tx.update(referralRef, {
                ...referralProgressPatch,
                status: "blocked",
                referralStatus: "blocked",
                "fraudFlags.suspectedFraud": true,
                "fraudFlags.manualReviewRequired": true,
                notes: "Bloqueado por limite diário de indicações válidas.",
            });
            return;
        }
        if (config.limitRewardedPerUser > 0 && totalRewarded >= config.limitRewardedPerUser) {
            tx.update(referralRef, {
                ...referralProgressPatch,
                status: "blocked",
                referralStatus: "blocked",
                "fraudFlags.duplicateRewardBlocked": true,
                notes: "Bloqueado por limite total de recompensas do indicador.",
            });
            return;
        }
        if (config.antiFraudRules.requireManualReviewForSuspected && suspicious) {
            tx.update(referralRef, {
                ...referralProgressPatch,
                status: "valid",
                referralStatus: "valid",
                referralQualified: true,
                qualifiedAt: firestore_2.FieldValue.serverTimestamp(),
                "fraudFlags.suspectedFraud": true,
                "fraudFlags.manualReviewRequired": true,
            });
            tx.update(db.doc(`${COL.users}/${invitedUid}`), {
                referralStatus: "valid",
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            tx.update(db.doc(`${COL.users}/${inviterUid}`), {
                referralQualifiedCount: firestore_2.FieldValue.increment(1),
                referralPendingCount: firestore_2.FieldValue.increment(-1),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            await upsertReferralRankingEntry(tx, inviterUid, String(inviterData.nome || "Jogador"), inviterData.foto ?? null, { pending: -1, valid: 1 });
            return;
        }
        const inviterReward = {
            amount: Math.max(0, campaign?.config.inviterRewardAmount ?? config.defaultInviterRewardAmount),
            currency: campaign?.config.inviterRewardCurrency ?? config.defaultInviterRewardCurrency,
        };
        const invitedRewardEnabled = campaign?.config.invitedRewardEnabled ?? config.invitedRewardEnabled;
        const invitedReward = invitedRewardEnabled
            ? {
                amount: Math.max(0, campaign?.config.invitedRewardAmount ?? config.defaultInvitedRewardAmount),
                currency: campaign?.config.invitedRewardCurrency ?? config.defaultInvitedRewardCurrency,
            }
            : { amount: 0, currency: config.defaultInvitedRewardCurrency };
        const inviterRewardPatch = applyRewardPatch(inviterData, inviterReward);
        const invitedRewardPatch = applyRewardPatch(invitedData, invitedReward);
        tx.update(referralRef, {
            ...referralProgressPatch,
            status: "rewarded",
            referralStatus: "rewarded",
            referralQualified: true,
            referralRewardGiven: true,
            qualifiedAt: firestore_2.FieldValue.serverTimestamp(),
            rewardedAt: firestore_2.FieldValue.serverTimestamp(),
            inviterRewardAmount: inviterReward.amount,
            inviterRewardCurrency: inviterReward.currency,
            invitedRewardAmount: invitedReward.amount,
            invitedRewardCurrency: invitedReward.currency,
            inviterRewardCoins: inviterReward.currency === "coins" ? inviterReward.amount : 0,
            invitedRewardCoins: invitedReward.currency === "coins" ? invitedReward.amount : 0,
            inviterRewardGrantedAt: firestore_2.FieldValue.serverTimestamp(),
            invitedRewardGrantedAt: invitedReward.amount > 0 ? firestore_2.FieldValue.serverTimestamp() : null,
            campaignId: campaign?.id ?? null,
            campaignName: campaign?.name ?? null,
        });
        tx.update(db.doc(`${COL.users}/${inviterUid}`), {
            ...inviterRewardPatch.patch,
            referralPendingCount: firestore_2.FieldValue.increment(-1),
            referralQualifiedCount: firestore_2.FieldValue.increment(1),
            referralRewardedCount: firestore_2.FieldValue.increment(1),
            referralInvitedCount: firestore_2.FieldValue.increment(1),
            ...(inviterReward.currency === "coins"
                ? { referralTotalEarnedCoins: firestore_2.FieldValue.increment(inviterReward.amount) }
                : inviterReward.currency === "gems"
                    ? { referralTotalEarnedGems: firestore_2.FieldValue.increment(inviterReward.amount) }
                    : { referralTotalEarnedRewardBalance: firestore_2.FieldValue.increment(inviterReward.amount) }),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.update(db.doc(`${COL.users}/${invitedUid}`), {
            ...invitedRewardPatch.patch,
            referralBonusGranted: true,
            referralStatus: "rewarded",
            ...(invitedReward.currency === "coins"
                ? { referralInvitedRewardCoins: firestore_2.FieldValue.increment(invitedReward.amount) }
                : invitedReward.currency === "gems"
                    ? { referralInvitedRewardGems: firestore_2.FieldValue.increment(invitedReward.amount) }
                    : { referralInvitedRewardBalance: firestore_2.FieldValue.increment(invitedReward.amount) }),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
        await upsertReferralRankingEntry(tx, inviterUid, String(inviterData.nome || "Jogador"), inviterData.foto ?? null, { pending: -1, valid: 1, rewarded: 1, rewards: inviterReward.amount });
    });
}
function parseRewardedAdCompletionToken(raw) {
    const token = String(raw ?? "").trim();
    if (!token) {
        throw new https_1.HttpsError("invalid-argument", "Token de conclusão do anúncio é obrigatório.");
    }
    if (token.length < REWARDED_AD_TOKEN_MIN_LEN || token.length > REWARDED_AD_TOKEN_MAX_LEN) {
        throw new https_1.HttpsError("invalid-argument", "Token de anúncio inválido.");
    }
    const isMock = token.startsWith(REWARDED_AD_MOCK_PREFIX);
    const isNativeAndroid = token.startsWith(REWARDED_AD_NATIVE_ANDROID_PREFIX);
    if (isMock && !rewardAdMockAllowed) {
        throw new https_1.HttpsError("failed-precondition", "Mock de anúncio desabilitado neste ambiente.");
    }
    if (!isMock && !isNativeAndroid) {
        throw new https_1.HttpsError("failed-precondition", "Provedor real de anúncio ainda não configurado no servidor. Use mock apenas em ambiente controlado.");
    }
    return { token, isMock };
}
async function fetchAdMobSsvKeys() {
    if (admobSsvKeysCache && admobSsvKeysCache.expiresAtMs > Date.now()) {
        return admobSsvKeysCache.keysById;
    }
    const response = await fetch(ADMOB_SSV_KEYS_URL);
    if (!response.ok) {
        throw new Error(`Falha ao baixar chaves de verificação do AdMob (${response.status}).`);
    }
    const json = (await response.json());
    const keysById = new Map();
    for (const key of json.keys ?? []) {
        const keyId = String(key.keyId ?? "").trim();
        const pem = String(key.pem ?? "").trim();
        if (keyId && pem) {
            keysById.set(keyId, pem);
        }
    }
    if (keysById.size === 0) {
        throw new Error("Nenhuma chave pública do AdMob foi retornada.");
    }
    admobSsvKeysCache = {
        expiresAtMs: Date.now() + ADMOB_SSV_KEYS_TTL_MS,
        keysById,
    };
    return keysById;
}
async function verifyAdMobSsvSignature(input) {
    const signatureParamIndex = input.rawQuery.indexOf("&signature=");
    if (signatureParamIndex === -1) {
        throw new Error("Query SSV sem assinatura.");
    }
    const dataToVerify = input.rawQuery.slice(0, signatureParamIndex);
    const keysById = await fetchAdMobSsvKeys();
    const publicKeyPem = keysById.get(input.keyId);
    if (!publicKeyPem) {
        throw new Error(`Não foi encontrada chave pública do AdMob para key_id=${input.keyId}.`);
    }
    const verifier = (0, node_crypto_1.createVerify)("SHA256");
    verifier.update(dataToVerify, "utf8");
    verifier.end();
    const signatureBuffer = Buffer.from(input.signature, "base64url");
    const verified = verifier.verify(publicKeyPem, signatureBuffer);
    if (!verified) {
        throw new Error("Assinatura SSV do AdMob inválida.");
    }
}
async function grantRewardedAdPlacement(input) {
    const economy = await getEconomy();
    const userRef = db.doc(`${COL.users}/${input.uid}`);
    const adRef = db.doc(`${COL.adEvents}/${input.adEventId}`);
    const today = dailyKey();
    const isPptDuels = input.placementId === PPT_PVP_DUELS_PLACEMENT_ID;
    const isQuizDuels = input.placementId === QUIZ_PVP_DUELS_PLACEMENT_ID;
    const isReactionDuels = input.placementId === REACTION_PVP_DUELS_PLACEMENT_ID;
    const result = await db.runTransaction(async (tx) => {
        const [uSnap, existingAdSnap] = await Promise.all([tx.get(userRef), tx.get(adRef)]);
        if (!uSnap.exists)
            throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
        if (existingAdSnap.exists) {
            throw new https_1.HttpsError("already-exists", "Este anúncio já foi processado.");
        }
        const u = uSnap.data();
        if (u.banido)
            throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
        const currentDayKey = String(u.rewardedAdsDayKey || "");
        const currentCount = currentDayKey === today ? Math.max(0, Math.floor(Number(u.rewardedAdsCount || 0))) : 0;
        if (currentCount >= economy.limiteDiarioAds) {
            throw new https_1.HttpsError("resource-exhausted", "Limite diário de anúncios atingido.");
        }
        const userPatch = {
            rewardedAdsDayKey: today,
            rewardedAdsCount: currentCount + 1,
            totalAdsAssistidos: firestore_2.FieldValue.increment(1),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        };
        await applyClanScoreCreditTx(tx, { uid: input.uid, ads: 1 });
        tx.set(adRef, {
            id: adRef.id,
            userId: input.uid,
            status: "recompensado",
            placementId: input.placementId,
            rewardKind: isPptDuels
                ? "ppt_pvp_duels"
                : isQuizDuels
                    ? "quiz_pvp_duels"
                    : isReactionDuels
                        ? "reaction_pvp_duels"
                        : "coins",
            mock: input.mock,
            tokenHash: input.tokenHash ?? null,
            source: input.origin,
            sessionId: input.sessionId ?? null,
            providerTransactionId: input.providerTransactionId ?? null,
            metadata: input.rewardMetadata ?? null,
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        if (isPptDuels) {
            const cur = readPptDuelCharges(u);
            const cappedNext = Math.min(PPT_DUEL_CHARGES_MAX_STACK, cur + PPT_DUEL_CHARGES_PER_AD);
            const addedDuels = cappedNext - cur;
            userPatch.pptPvPDuelsRemaining = cappedNext;
            userPatch.pptPvpDuelsRefillAvailableAt = firestore_2.FieldValue.delete();
            tx.update(userRef, userPatch);
            return {
                coins: 0,
                boostCoins: 0,
                pptPvPDuelsAdded: addedDuels,
                pptPvPDuelsRemaining: cappedNext,
            };
        }
        if (isQuizDuels) {
            const cur = readQuizDuelCharges(u);
            const cappedNext = Math.min(QUIZ_DUEL_CHARGES_MAX_STACK, cur + QUIZ_DUEL_CHARGES_PER_AD);
            const addedDuels = cappedNext - cur;
            userPatch.quizPvPDuelsRemaining = cappedNext;
            userPatch.quizPvpDuelsRefillAvailableAt = firestore_2.FieldValue.delete();
            tx.update(userRef, userPatch);
            return {
                coins: 0,
                boostCoins: 0,
                quizPvPDuelsAdded: addedDuels,
                quizPvPDuelsRemaining: cappedNext,
            };
        }
        if (isReactionDuels) {
            const cur = readReactionDuelCharges(u);
            const cappedNext = Math.min(REACTION_DUEL_CHARGES_MAX_STACK, cur + REACTION_DUEL_CHARGES_PER_AD);
            const addedDuels = cappedNext - cur;
            userPatch.reactionPvPDuelsRemaining = cappedNext;
            userPatch.reactionPvpDuelsRefillAvailableAt = firestore_2.FieldValue.delete();
            tx.update(userRef, userPatch);
            return {
                coins: 0,
                boostCoins: 0,
                reactionPvPDuelsAdded: addedDuels,
                reactionPvPDuelsRemaining: cappedNext,
            };
        }
        const boostedCoins = resolveBoostedCoins(economy.rewardAdCoinAmount, u, economy);
        const newCoins = Number(u.coins ?? 0) + boostedCoins.totalCoins;
        userPatch.coins = firestore_2.FieldValue.increment(boostedCoins.totalCoins);
        tx.update(userRef, userPatch);
        addWalletTxInTx(tx, {
            id: `ad_${input.adEventId}_coins`,
            userId: input.uid,
            tipo: "anuncio",
            moeda: "coins",
            valor: boostedCoins.totalCoins,
            saldoApos: newCoins,
            descricao: withBoostDescription("Anúncio recompensado", boostedCoins.boostCoins),
            referenciaId: adRef.id,
        });
        return {
            coins: boostedCoins.totalCoins,
            boostCoins: boostedCoins.boostCoins,
        };
    });
    await bumpWatchAdMissions(input.uid);
    await evaluateReferralForUser(input.uid);
    return result;
}
function millisFromCooldownField(v) {
    if (v == null)
        return 0;
    if (typeof v.toMillis === "function") {
        return v.toMillis();
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}
function nextBurstState(u, now) {
    const burst = u.matchBurst;
    const windowMs = 60000;
    if (!burst?.windowStart) {
        return { ok: true, burst: { windowStart: firestore_2.Timestamp.fromMillis(now), count: 1 } };
    }
    const start = burst.windowStart.toMillis();
    if (now - start > windowMs) {
        return { ok: true, burst: { windowStart: firestore_2.Timestamp.fromMillis(now), count: 1 } };
    }
    const c = Number(burst.count || 0);
    if (c >= gameEconomy_1.MAX_MATCHES_PER_MINUTE)
        return { ok: false };
    return { ok: true, burst: { windowStart: burst.windowStart, count: c + 1 } };
}
async function logMatchFraud(uid, tipo, detalhes) {
    try {
        await db.collection(COL.fraudLogs).add({
            uid,
            tipo,
            severidade: "media",
            detalhes,
            origem: "finalizeMatch",
            timestamp: firestore_2.FieldValue.serverTimestamp(),
        });
    }
    catch {
        /* ignore */
    }
}
async function upsertRanking(input) {
    const userRef = db.doc(`${COL.users}/${input.uid}`);
    const periods = [
        { period: "diario", col: COL.rankingsDaily, key: dailyKey() },
        { period: "semanal", col: COL.rankingsWeekly, key: weeklyKey() },
        { period: "mensal", col: COL.rankingsMonthly, key: monthlyKey() },
    ];
    await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        const userData = (userSnap.data() || {});
        const [dailyPeriod, weeklyPeriod, monthlyPeriod] = periods;
        tx.set(userRef, {
            scoreRankingDiarioKey: dailyPeriod.key,
            scoreRankingDiario: String(userData.scoreRankingDiarioKey || "") !== dailyPeriod.key
                ? input.deltaScore
                : firestore_2.FieldValue.increment(input.deltaScore),
            scoreRankingSemanalKey: weeklyPeriod.key,
            scoreRankingSemanal: String(userData.scoreRankingSemanalKey || "") !== weeklyPeriod.key
                ? input.deltaScore
                : firestore_2.FieldValue.increment(input.deltaScore),
            scoreRankingMensalKey: monthlyPeriod.key,
            scoreRankingMensal: String(userData.scoreRankingMensalKey || "") !== monthlyPeriod.key
                ? input.deltaScore
                : firestore_2.FieldValue.increment(input.deltaScore),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        for (const p of periods) {
            tx.set(db.doc(`${p.col}/${p.key}`), {
                periodoChave: p.key,
                tipo: p.period,
                scope: "global",
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
            const entryRef = db.doc(`${p.col}/${p.key}/entries/${input.uid}`);
            tx.set(entryRef, {
                uid: input.uid,
                nome: input.nome,
                username: input.username ?? null,
                foto: input.foto,
                score: firestore_2.FieldValue.increment(input.deltaScore),
                partidas: firestore_2.FieldValue.increment(1),
                vitorias: firestore_2.FieldValue.increment(input.win ? 1 : 0),
                scope: "global",
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
            tx.set(db.doc(`${p.col}/${p.key}/games/${input.gameId}`), {
                periodoChave: p.key,
                tipo: p.period,
                scope: "game",
                gameId: input.gameId,
                gameTitle: GAME_TITLES[input.gameId],
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
            tx.set(db.doc(`${p.col}/${p.key}/games/${input.gameId}/entries/${input.uid}`), {
                uid: input.uid,
                nome: input.nome,
                username: input.username ?? null,
                foto: input.foto,
                score: firestore_2.FieldValue.increment(input.deltaScore),
                partidas: firestore_2.FieldValue.increment(1),
                vitorias: firestore_2.FieldValue.increment(input.win ? 1 : 0),
                scope: "game",
                gameId: input.gameId,
                gameTitle: GAME_TITLES[input.gameId],
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
    });
}
async function syncUserPresentation(uid, nome, foto) {
    const userSnap = await db.doc(`${COL.users}/${uid}`).get();
    const userData = (userSnap.data() || null);
    const username = userSnap.exists ? String(userData?.username || "") : "";
    const batch = db.batch();
    const rankingTargets = [];
    const gameRankingPeriods = [
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
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
                    atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
    const referralPeriods = ["daily", "weekly", "monthly", "all"];
    for (const period of referralPeriods) {
        batch.set(db.doc(`${referralRankingCollection(period)}/${referralRankingKey(period)}/entries/${uid}`), {
            userId: uid,
            userName: nome,
            photoURL: foto,
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    const membershipSnap = await db.doc(`${COL.clanMemberships}/${uid}`).get();
    const clanId = membershipSnap.exists ? String(membershipSnap.data()?.clanId || "").trim() : "";
    if (clanId) {
        batch.set(db.doc(`${COL.clans}/${clanId}/members/${uid}`), {
            uid,
            clanId,
            nome,
            username: username || null,
            foto,
            role: String(membershipSnap.data()?.role || "member"),
            joinedAt: membershipSnap.data()?.joinedAt ?? firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    await batch.commit();
}
async function bumpPlayMatchMissions(uid) {
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
        await progRef.set({
            missionId: m.id,
            progresso: next,
            concluida: next >= meta,
            recompensaResgatada: pSnap.data()?.recompensaResgatada ?? false,
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            periodoChave: dailyKey(),
        }, { merge: true });
    }
}
function pptOutcomeFromHands(hostHand, guestHand) {
    const beats = {
        pedra: "tesoura",
        papel: "pedra",
        tesoura: "papel",
    };
    if (hostHand === guestHand)
        return "draw";
    if (beats[hostHand] === guestHand)
        return "host_win";
    return "guest_win";
}
function millisFromFirestoreTime(v) {
    if (v != null && typeof v.toMillis === "function") {
        return v.toMillis();
    }
    return 0;
}
function losingHandAgainst(winnerHand) {
    if (winnerHand === "pedra")
        return "tesoura";
    if (winnerHand === "papel")
        return "pedra";
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
const PPT_BOTH_IDLE_NO_PICK_MS = 22000;
async function postPptMatchRankingFromWinner(roomId, hostUid, guestUid, matchWinner, forfeitMeta) {
    const hostRes = matchWinner === "host" ? "vitoria" : "derrota";
    const guestRes = matchWinner === "guest" ? "vitoria" : "derrota";
    const metaBase = {
        pvpRoomId: roomId,
        pptMatchWinner: matchWinner,
    };
    if (forfeitMeta) {
        metaBase.forfeit = true;
        metaBase.forfeitedBy = forfeitMeta.forfeitedByUid;
    }
    const economyConfig = await getEconomy();
    const ecoH = (0, gameEconomy_1.resolveMatchEconomy)("ppt", hostRes, 0, metaBase, economyConfig.matchRewardOverrides);
    const ecoG = (0, gameEconomy_1.resolveMatchEconomy)("ppt", guestRes, 0, metaBase, economyConfig.matchRewardOverrides);
    const [hSnap, gSnap] = await Promise.all([
        db.doc(`${COL.users}/${hostUid}`).get(),
        db.doc(`${COL.users}/${guestUid}`).get(),
    ]);
    await upsertRanking({
        uid: hostUid,
        nome: String(hSnap.data()?.nome || "Jogador"),
        username: String(hSnap.data()?.username || "") || null,
        foto: hSnap.data()?.foto ?? null,
        deltaScore: ecoH.rankingPoints,
        win: hostRes === "vitoria",
        gameId: "ppt",
    });
    await upsertRanking({
        uid: guestUid,
        nome: String(gSnap.data()?.nome || "Jogador"),
        username: String(gSnap.data()?.username || "") || null,
        foto: gSnap.data()?.foto ?? null,
        deltaScore: ecoG.rankingPoints,
        win: guestRes === "vitoria",
        gameId: "ppt",
    });
    await bumpPlayMatchMissions(hostUid);
    await bumpPlayMatchMissions(guestUid);
    await Promise.all([evaluateReferralForUser(hostUid), evaluateReferralForUser(guestUid)]);
    await grantPvpVictoryChestAndSyncRoom({ roomId, hostUid, guestUid, matchWinner });
}
function clampQuizResponseMs(raw) {
    const ms = Number(raw);
    if (!Number.isFinite(ms))
        return QUIZ_RESPONSE_MS_CAP;
    return Math.max(0, Math.min(QUIZ_RESPONSE_MS_CAP, Math.floor(ms)));
}
/** Ponto só se um acerta e o outro erra. Ambos certos ou ambos errados → empate (sem desempate por tempo). */
function resolveQuizRoundWinner(hostCorrect, guestCorrect, hostResponseMs, guestResponseMs) {
    void hostResponseMs;
    void guestResponseMs;
    if (hostCorrect && !guestCorrect)
        return "host";
    if (!hostCorrect && guestCorrect)
        return "guest";
    return "draw";
}
async function postQuizMatchRankingFromWinner(roomId, hostUid, guestUid, matchWinner, hostResponseMs, guestResponseMs) {
    const hostRes = matchWinner === "host" ? "vitoria" : "derrota";
    const guestRes = matchWinner === "guest" ? "vitoria" : "derrota";
    const economyConfig = await getEconomy();
    const ecoH = (0, gameEconomy_1.resolveMatchEconomy)("quiz", hostRes, 0, {
        pvpRoomId: roomId,
        quizMatchWinner: matchWinner,
        responseTimeMs: hostResponseMs,
    }, economyConfig.matchRewardOverrides);
    const ecoG = (0, gameEconomy_1.resolveMatchEconomy)("quiz", guestRes, 0, {
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
        foto: hSnap.data()?.foto ?? null,
        deltaScore: ecoH.rankingPoints,
        win: hostRes === "vitoria",
        gameId: "quiz",
    });
    await upsertRanking({
        uid: guestUid,
        nome: String(gSnap.data()?.nome || "Jogador"),
        username: String(gSnap.data()?.username || "") || null,
        foto: gSnap.data()?.foto ?? null,
        deltaScore: ecoG.rankingPoints,
        win: guestRes === "vitoria",
        gameId: "quiz",
    });
    await bumpPlayMatchMissions(hostUid);
    await bumpPlayMatchMissions(guestUid);
    await Promise.all([evaluateReferralForUser(hostUid), evaluateReferralForUser(guestUid)]);
    await grantPvpVictoryChestAndSyncRoom({ roomId, hostUid, guestUid, matchWinner });
}
function clampReactionResponseMs(raw) {
    const ms = Number(raw);
    if (!Number.isFinite(ms))
        return REACTION_RESPONSE_MS_CAP;
    return Math.max(1, Math.min(REACTION_RESPONSE_MS_CAP, Math.floor(ms)));
}
function nextReactionGoLiveAt() {
    return firestore_2.Timestamp.fromMillis(Date.now() +
        REACTION_WAIT_MIN_MS +
        Math.floor(Math.random() * (REACTION_WAIT_MAX_MS - REACTION_WAIT_MIN_MS)));
}
function resolveReactionWinner(hostFalseStart, guestFalseStart, hostMs, guestMs) {
    if (hostFalseStart && !guestFalseStart)
        return "guest";
    if (guestFalseStart && !hostFalseStart)
        return "host";
    if (hostFalseStart && guestFalseStart)
        return "draw";
    const diff = hostMs - guestMs;
    if (Math.abs(diff) <= REACTION_TIE_MS)
        return "draw";
    return diff < 0 ? "host" : "guest";
}
async function postReactionTapRanking(roomId, hostUid, guestUid, hostRes, guestRes, hostMs, guestMs) {
    const economyConfig = await getEconomy();
    const [ecoH, ecoG] = await Promise.all([
        (0, gameEconomy_1.resolveMatchEconomy)("reaction_tap", hostRes, 0, {
            pvpRoomId: roomId,
            responseTimeMs: hostMs,
            reactionMs: hostMs,
        }, economyConfig.matchRewardOverrides),
        (0, gameEconomy_1.resolveMatchEconomy)("reaction_tap", guestRes, 0, {
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
        foto: hSnap.data()?.foto ?? null,
        deltaScore: ecoH.rankingPoints,
        win: hostRes === "vitoria",
        gameId: "reaction_tap",
    });
    await upsertRanking({
        uid: guestUid,
        nome: String(gSnap.data()?.nome || "Jogador"),
        username: String(gSnap.data()?.username || "") || null,
        foto: gSnap.data()?.foto ?? null,
        deltaScore: ecoG.rankingPoints,
        win: guestRes === "vitoria",
        gameId: "reaction_tap",
    });
    await bumpPlayMatchMissions(hostUid);
    await bumpPlayMatchMissions(guestUid);
    await Promise.all([evaluateReferralForUser(hostUid), evaluateReferralForUser(guestUid)]);
    const matchWinner = hostRes === "vitoria" ? "host" : guestRes === "vitoria" ? "guest" : null;
    if (matchWinner) {
        await grantPvpVictoryChestAndSyncRoom({ roomId, hostUid, guestUid, matchWinner });
    }
}
async function applyQuizMatchCompletionInTransaction(tx, roomRef, roomId, r, matchWinner, hostAnswerIndex, guestAnswerIndex, hostCorrect, guestCorrect, hostResponseMs, guestResponseMs, quizRevealOptions, quizRevealCorrectIndex, quizRevealQuestionText) {
    const hostUid = String(r.hostUid);
    const guestUid = String(r.guestUid);
    const hostScore = Number(r.quizHostScore ?? 0);
    const guestScore = Number(r.quizGuestScore ?? 0);
    const questionId = String(r.quizQuestionId ?? "");
    const hostRes = matchWinner === "host" ? "vitoria" : "derrota";
    const guestRes = matchWinner === "guest" ? "vitoria" : "derrota";
    const outcome = matchWinner === "host" ? "host_win" : "guest_win";
    const hostUserRef = db.doc(`${COL.users}/${hostUid}`);
    const guestUserRef = db.doc(`${COL.users}/${guestUid}`);
    const [hUSnap, gUSnap] = await Promise.all([tx.get(hostUserRef), tx.get(guestUserRef)]);
    if (!hUSnap.exists || !gUSnap.exists) {
        throw new https_1.HttpsError("failed-precondition", "Perfil ausente.");
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
    const ecoH = (0, gameEconomy_1.resolveMatchEconomy)("quiz", hostRes, 0, hostMeta, economyConfig.matchRewardOverrides);
    const ecoG = (0, gameEconomy_1.resolveMatchEconomy)("quiz", guestRes, 0, guestMeta, economyConfig.matchRewardOverrides);
    const boostedH = resolveBoostedCoins(ecoH.rewardCoins, hUSnap.data(), economyConfig);
    const boostedG = resolveBoostedCoins(ecoG.rewardCoins, gUSnap.data(), economyConfig);
    const finishedTs = firestore_2.Timestamp.now();
    const mHost = db.collection(COL.matches).doc();
    const mGuest = db.collection(COL.matches).doc();
    const wHost = db.collection(COL.wallet).doc();
    const wGuest = db.collection(COL.wallet).doc();
    const hostClanScoreTarget = await readClanScoreCreditTargetTx(tx, hostUid);
    const guestClanScoreTarget = await readClanScoreCreditTargetTx(tx, guestUid);
    writeClanScoreCreditForTargetTx(tx, hostClanScoreTarget, {
        wins: hostRes === "vitoria" ? 1 : 0,
    });
    writeClanScoreCreditForTargetTx(tx, guestClanScoreTarget, {
        wins: guestRes === "vitoria" ? 1 : 0,
    });
    tx.set(mHost, {
        id: mHost.id,
        gameId: "quiz",
        gameType: "quiz",
        userId: hostUid,
        opponentId: guestUid,
        resultado: hostRes,
        result: hostRes,
        score: ecoH.normalizedScore,
        rewardCoins: boostedH.totalCoins,
        rankingPoints: ecoH.rankingPoints,
        startedAt: null,
        finishedAt: finishedTs,
        metadata: ecoH.resolvedMetadata,
        detalhes: ecoH.resolvedMetadata,
        antiSpamToken: null,
        criadoEm: firestore_2.FieldValue.serverTimestamp(),
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
        rewardCoins: boostedG.totalCoins,
        rankingPoints: ecoG.rankingPoints,
        startedAt: null,
        finishedAt: finishedTs,
        metadata: ecoG.resolvedMetadata,
        detalhes: ecoG.resolvedMetadata,
        antiSpamToken: null,
        criadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.update(hostUserRef, {
        totalPartidas: firestore_2.FieldValue.increment(1),
        totalVitorias: firestore_2.FieldValue.increment(hostRes === "vitoria" ? 1 : 0),
        totalDerrotas: firestore_2.FieldValue.increment(hostRes === "derrota" ? 1 : 0),
        coins: firestore_2.FieldValue.increment(boostedH.totalCoins),
        xp: firestore_2.FieldValue.increment(hostRes === "vitoria" ? 15 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.update(guestUserRef, {
        totalPartidas: firestore_2.FieldValue.increment(1),
        totalVitorias: firestore_2.FieldValue.increment(guestRes === "vitoria" ? 1 : 0),
        totalDerrotas: firestore_2.FieldValue.increment(guestRes === "derrota" ? 1 : 0),
        coins: firestore_2.FieldValue.increment(boostedG.totalCoins),
        xp: firestore_2.FieldValue.increment(guestRes === "vitoria" ? 15 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    const hostCoinsAfter = Number(hUSnap.data()?.coins ?? 0) + boostedH.totalCoins;
    const guestCoinsAfter = Number(gUSnap.data()?.coins ?? 0) + boostedG.totalCoins;
    if (boostedH.totalCoins > 0) {
        tx.set(wHost, {
            userId: hostUid,
            tipo: "jogo_pvp",
            moeda: "coins",
            valor: boostedH.totalCoins,
            saldoApos: hostCoinsAfter,
            descricao: withBoostDescription("Quiz 1v1", boostedH.boostCoins),
            referenciaId: mHost.id,
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
    }
    if (boostedG.totalCoins > 0) {
        tx.set(wGuest, {
            userId: guestUid,
            tipo: "jogo_pvp",
            moeda: "coins",
            valor: boostedG.totalCoins,
            saldoApos: guestCoinsAfter,
            descricao: withBoostDescription("Quiz 1v1", boostedG.boostCoins),
            referenciaId: mGuest.id,
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
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
        actionDeadlineAt: firestore_2.FieldValue.delete(),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    const gid = r.gameId || "quiz";
    tx.set(slotRef(hostUid), {
        uid: hostUid,
        gameId: gid,
        queueStatus: "idle",
        roomId: null,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(slotRef(guestUid), {
        uid: guestUid,
        gameId: gid,
        queueStatus: "idle",
        roomId: null,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { hostUid, guestUid, matchWinner };
}
async function applyQuizForfeitInTransaction(tx, roomRef, roomId, r, forfeitedByUid) {
    const hostUid = String(r.hostUid);
    const guestUid = String(r.guestUid);
    const matchWinner = forfeitedByUid === hostUid ? "guest" : "host";
    const hostRes = matchWinner === "host" ? "vitoria" : "derrota";
    const guestRes = matchWinner === "guest" ? "vitoria" : "derrota";
    const hostResponseMs = matchWinner === "host" ? 0 : QUIZ_RESPONSE_MS_CAP;
    const guestResponseMs = matchWinner === "guest" ? 0 : QUIZ_RESPONSE_MS_CAP;
    const hostUserRef = db.doc(`${COL.users}/${hostUid}`);
    const guestUserRef = db.doc(`${COL.users}/${guestUid}`);
    const [hUSnap, gUSnap] = await Promise.all([tx.get(hostUserRef), tx.get(guestUserRef)]);
    if (!hUSnap.exists || !gUSnap.exists) {
        throw new https_1.HttpsError("failed-precondition", "Perfil ausente.");
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
    const ecoH = (0, gameEconomy_1.resolveMatchEconomy)("quiz", hostRes, 0, hostMeta, economyConfig.matchRewardOverrides);
    const ecoG = (0, gameEconomy_1.resolveMatchEconomy)("quiz", guestRes, 0, guestMeta, economyConfig.matchRewardOverrides);
    const boostedH = resolveBoostedCoins(ecoH.rewardCoins, hUSnap.data(), economyConfig);
    const boostedG = resolveBoostedCoins(ecoG.rewardCoins, gUSnap.data(), economyConfig);
    const finishedTs = firestore_2.Timestamp.now();
    const mHost = db.collection(COL.matches).doc();
    const mGuest = db.collection(COL.matches).doc();
    const wHost = db.collection(COL.wallet).doc();
    const wGuest = db.collection(COL.wallet).doc();
    const hostClanScoreTarget = await readClanScoreCreditTargetTx(tx, hostUid);
    const guestClanScoreTarget = await readClanScoreCreditTargetTx(tx, guestUid);
    writeClanScoreCreditForTargetTx(tx, hostClanScoreTarget, {
        wins: hostRes === "vitoria" ? 1 : 0,
    });
    writeClanScoreCreditForTargetTx(tx, guestClanScoreTarget, {
        wins: guestRes === "vitoria" ? 1 : 0,
    });
    tx.set(mHost, {
        id: mHost.id,
        gameId: "quiz",
        gameType: "quiz",
        userId: hostUid,
        opponentId: guestUid,
        resultado: hostRes,
        result: hostRes,
        score: ecoH.normalizedScore,
        rewardCoins: boostedH.totalCoins,
        rankingPoints: ecoH.rankingPoints,
        startedAt: null,
        finishedAt: finishedTs,
        metadata: ecoH.resolvedMetadata,
        detalhes: ecoH.resolvedMetadata,
        antiSpamToken: null,
        criadoEm: firestore_2.FieldValue.serverTimestamp(),
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
        rewardCoins: boostedG.totalCoins,
        rankingPoints: ecoG.rankingPoints,
        startedAt: null,
        finishedAt: finishedTs,
        metadata: ecoG.resolvedMetadata,
        detalhes: ecoG.resolvedMetadata,
        antiSpamToken: null,
        criadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.update(hostUserRef, {
        totalPartidas: firestore_2.FieldValue.increment(1),
        totalVitorias: firestore_2.FieldValue.increment(hostRes === "vitoria" ? 1 : 0),
        totalDerrotas: firestore_2.FieldValue.increment(hostRes === "derrota" ? 1 : 0),
        coins: firestore_2.FieldValue.increment(boostedH.totalCoins),
        xp: firestore_2.FieldValue.increment(hostRes === "vitoria" ? 15 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.update(guestUserRef, {
        totalPartidas: firestore_2.FieldValue.increment(1),
        totalVitorias: firestore_2.FieldValue.increment(guestRes === "vitoria" ? 1 : 0),
        totalDerrotas: firestore_2.FieldValue.increment(guestRes === "derrota" ? 1 : 0),
        coins: firestore_2.FieldValue.increment(boostedG.totalCoins),
        xp: firestore_2.FieldValue.increment(guestRes === "vitoria" ? 15 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    const hostCoinsAfter = Number(hUSnap.data()?.coins ?? 0) + boostedH.totalCoins;
    const guestCoinsAfter = Number(gUSnap.data()?.coins ?? 0) + boostedG.totalCoins;
    if (boostedH.totalCoins > 0) {
        tx.set(wHost, {
            userId: hostUid,
            tipo: "jogo_pvp",
            moeda: "coins",
            valor: boostedH.totalCoins,
            saldoApos: hostCoinsAfter,
            descricao: withBoostDescription("Quiz 1v1", boostedH.boostCoins),
            referenciaId: mHost.id,
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
    }
    if (boostedG.totalCoins > 0) {
        tx.set(wGuest, {
            userId: guestUid,
            tipo: "jogo_pvp",
            moeda: "coins",
            valor: boostedG.totalCoins,
            saldoApos: guestCoinsAfter,
            descricao: withBoostDescription("Quiz 1v1", boostedG.boostCoins),
            referenciaId: mGuest.id,
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
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
        actionDeadlineAt: firestore_2.FieldValue.delete(),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.set(slotRef(hostUid), {
        uid: hostUid,
        gameId: "quiz",
        queueStatus: "idle",
        roomId: null,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(slotRef(guestUid), {
        uid: guestUid,
        gameId: "quiz",
        queueStatus: "idle",
        roomId: null,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { hostUid, guestUid, matchWinner, hostResponseMs, guestResponseMs };
}
async function applyReactionMatchCompletionInTransaction(tx, roomRef, roomId, r, hostMs, guestMs, hostFalseStart, guestFalseStart, winner, reactionWindowMs) {
    const hostUid = String(r.hostUid);
    const guestUid = String(r.guestUid);
    const nextHostScore = Number(r.reactionHostScore ?? 0) + (winner === "host" ? 1 : 0);
    const nextGuestScore = Number(r.reactionGuestScore ?? 0) + (winner === "guest" ? 1 : 0);
    const target = Number(r.reactionTargetScore ?? REACTION_MATCH_TARGET_POINTS);
    const roundNumber = Number(r.reactionRound ?? 1);
    const isMatchComplete = (winner === "host" && nextHostScore >= target) || (winner === "guest" && nextGuestScore >= target);
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
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        return {
            hostUid,
            guestUid,
            hostRes: "empate",
            guestRes: "empate",
            winner,
            hostScore: nextHostScore,
            guestScore: nextGuestScore,
            completed: false,
        };
    }
    const hostRes = winner === "host" ? "vitoria" : winner === "guest" ? "derrota" : "empate";
    const guestRes = winner === "guest" ? "vitoria" : winner === "host" ? "derrota" : "empate";
    const hostUserRef = db.doc(`${COL.users}/${hostUid}`);
    const guestUserRef = db.doc(`${COL.users}/${guestUid}`);
    const [hUSnap, gUSnap] = await Promise.all([tx.get(hostUserRef), tx.get(guestUserRef)]);
    if (!hUSnap.exists || !gUSnap.exists) {
        throw new https_1.HttpsError("failed-precondition", "Perfil ausente.");
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
    const ecoH = (0, gameEconomy_1.resolveMatchEconomy)("reaction_tap", hostRes, 0, hostMeta, economyConfig.matchRewardOverrides);
    const ecoG = (0, gameEconomy_1.resolveMatchEconomy)("reaction_tap", guestRes, 0, guestMeta, economyConfig.matchRewardOverrides);
    const boostedH = resolveBoostedCoins(ecoH.rewardCoins, hUSnap.data(), economyConfig);
    const boostedG = resolveBoostedCoins(ecoG.rewardCoins, gUSnap.data(), economyConfig);
    const finishedTs = firestore_2.Timestamp.now();
    const mHost = db.collection(COL.matches).doc();
    const mGuest = db.collection(COL.matches).doc();
    const wHost = db.collection(COL.wallet).doc();
    const wGuest = db.collection(COL.wallet).doc();
    const hostClanScoreTarget = await readClanScoreCreditTargetTx(tx, hostUid);
    const guestClanScoreTarget = await readClanScoreCreditTargetTx(tx, guestUid);
    writeClanScoreCreditForTargetTx(tx, hostClanScoreTarget, {
        wins: hostRes === "vitoria" ? 1 : 0,
    });
    writeClanScoreCreditForTargetTx(tx, guestClanScoreTarget, {
        wins: guestRes === "vitoria" ? 1 : 0,
    });
    tx.set(mHost, {
        id: mHost.id,
        gameId: "reaction_tap",
        gameType: "reaction_tap",
        userId: hostUid,
        opponentId: guestUid,
        resultado: hostRes,
        result: hostRes,
        score: ecoH.normalizedScore,
        rewardCoins: boostedH.totalCoins,
        rankingPoints: ecoH.rankingPoints,
        startedAt: null,
        finishedAt: finishedTs,
        metadata: ecoH.resolvedMetadata,
        detalhes: ecoH.resolvedMetadata,
        antiSpamToken: null,
        criadoEm: firestore_2.FieldValue.serverTimestamp(),
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
        rewardCoins: boostedG.totalCoins,
        rankingPoints: ecoG.rankingPoints,
        startedAt: null,
        finishedAt: finishedTs,
        metadata: ecoG.resolvedMetadata,
        detalhes: ecoG.resolvedMetadata,
        antiSpamToken: null,
        criadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.update(hostUserRef, {
        totalPartidas: firestore_2.FieldValue.increment(1),
        totalVitorias: firestore_2.FieldValue.increment(hostRes === "vitoria" ? 1 : 0),
        totalDerrotas: firestore_2.FieldValue.increment(hostRes === "derrota" ? 1 : 0),
        coins: firestore_2.FieldValue.increment(boostedH.totalCoins),
        xp: firestore_2.FieldValue.increment(hostRes === "vitoria" ? 15 : hostRes === "empate" ? 8 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.update(guestUserRef, {
        totalPartidas: firestore_2.FieldValue.increment(1),
        totalVitorias: firestore_2.FieldValue.increment(guestRes === "vitoria" ? 1 : 0),
        totalDerrotas: firestore_2.FieldValue.increment(guestRes === "derrota" ? 1 : 0),
        coins: firestore_2.FieldValue.increment(boostedG.totalCoins),
        xp: firestore_2.FieldValue.increment(guestRes === "vitoria" ? 15 : guestRes === "empate" ? 8 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    const hostCoinsAfter = Number(hUSnap.data()?.coins ?? 0) + boostedH.totalCoins;
    const guestCoinsAfter = Number(gUSnap.data()?.coins ?? 0) + boostedG.totalCoins;
    if (boostedH.totalCoins > 0) {
        tx.set(wHost, {
            userId: hostUid,
            tipo: "jogo_pvp",
            moeda: "coins",
            valor: boostedH.totalCoins,
            saldoApos: hostCoinsAfter,
            descricao: withBoostDescription("Reaction Tap 1v1", boostedH.boostCoins),
            referenciaId: mHost.id,
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
    }
    if (boostedG.totalCoins > 0) {
        tx.set(wGuest, {
            userId: guestUid,
            tipo: "jogo_pvp",
            moeda: "coins",
            valor: boostedG.totalCoins,
            saldoApos: guestCoinsAfter,
            descricao: withBoostDescription("Reaction Tap 1v1", boostedG.boostCoins),
            referenciaId: mGuest.id,
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
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
        actionDeadlineAt: firestore_2.FieldValue.delete(),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.set(slotRef(hostUid), {
        uid: hostUid,
        gameId: "reaction_tap",
        queueStatus: "idle",
        roomId: null,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(slotRef(guestUid), {
        uid: guestUid,
        gameId: "reaction_tap",
        queueStatus: "idle",
        roomId: null,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    return {
        hostUid,
        guestUid,
        hostRes,
        guestRes,
        winner,
        hostScore: nextHostScore,
        guestScore: nextGuestScore,
        completed: true,
    };
}
async function applyReactionForfeitInTransaction(tx, roomRef, roomId, r, forfeitedByUid) {
    const hostUid = String(r.hostUid);
    const guestUid = String(r.guestUid);
    const winner = forfeitedByUid === hostUid ? "guest" : "host";
    const hostMs = winner === "host" ? 1 : REACTION_FALSE_START_MS;
    const guestMs = winner === "guest" ? 1 : REACTION_FALSE_START_MS;
    const hostFalseStart = forfeitedByUid === hostUid;
    const guestFalseStart = forfeitedByUid === guestUid;
    const econForfeitReaction = await getEconomy();
    const reactionWinMsForfeit = pvpChoiceWindowMs(econForfeitReaction.pvpChoiceSeconds, "reaction_tap");
    const out = await applyReactionMatchCompletionInTransaction(tx, roomRef, roomId, {
        ...r,
        reactionHostScore: winner === "host"
            ? Math.max(Number(r.reactionHostScore ?? 0), Number(r.reactionTargetScore ?? REACTION_MATCH_TARGET_POINTS) - 1)
            : Number(r.reactionHostScore ?? 0),
        reactionGuestScore: winner === "guest"
            ? Math.max(Number(r.reactionGuestScore ?? 0), Number(r.reactionTargetScore ?? REACTION_MATCH_TARGET_POINTS) - 1)
            : Number(r.reactionGuestScore ?? 0),
    }, hostMs, guestMs, hostFalseStart, guestFalseStart, winner, reactionWinMsForfeit);
    return { ...out, winner, hostMs, guestMs };
}
/** Finaliza PPT na transação: perdedor = `loserUid` (desistência / inatividade). */
async function applyPptForfeitInTransaction(tx, roomRef, roomId, r, loserUid) {
    const hostUid = String(r.hostUid);
    const guestUid = String(r.guestUid);
    if (loserUid !== hostUid && loserUid !== guestUid) {
        throw new https_1.HttpsError("failed-precondition", "Participante inválido.");
    }
    const matchWinner = loserUid === hostUid ? "guest" : "host";
    const hostScore = Number(r.pptHostScore ?? 0);
    const guestScore = Number(r.pptGuestScore ?? 0);
    const target = Number(r.pptTargetScore ?? PPT_MATCH_TARGET_POINTS);
    const lastHandH = String(r.pptLastHostHand ?? "");
    const lastHandG = String(r.pptLastGuestHand ?? "");
    const synthOut = matchWinner === "host" ? "host_win" : "guest_win";
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
        throw new https_1.HttpsError("failed-precondition", "Perfil ausente.");
    }
    const hu = hUSnap.data();
    const gu = gUSnap.data();
    if (hu.banido || gu.banido) {
        throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
    }
    const hostClanScoreTarget = await readClanScoreCreditTargetTx(tx, hostUid);
    const guestClanScoreTarget = await readClanScoreCreditTargetTx(tx, guestUid);
    if (hPSnap.exists)
        tx.delete(hPref);
    if (gPSnap.exists)
        tx.delete(gPref);
    const hostRes = matchWinner === "host" ? "vitoria" : "derrota";
    const guestRes = matchWinner === "guest" ? "vitoria" : "derrota";
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
    const ecoH = (0, gameEconomy_1.resolveMatchEconomy)("ppt", hostRes, 0, metaBase, economyConfig.matchRewardOverrides);
    const ecoG = (0, gameEconomy_1.resolveMatchEconomy)("ppt", guestRes, 0, metaBase, economyConfig.matchRewardOverrides);
    const boostedH = resolveBoostedCoins(ecoH.rewardCoins, hu, economyConfig);
    const boostedG = resolveBoostedCoins(ecoG.rewardCoins, gu, economyConfig);
    const finishedTs = firestore_2.Timestamp.now();
    const mHost = db.collection(COL.matches).doc();
    const mGuest = db.collection(COL.matches).doc();
    const wHost = db.collection(COL.wallet).doc();
    const wGuest = db.collection(COL.wallet).doc();
    writeClanScoreCreditForTargetTx(tx, hostClanScoreTarget, {
        wins: hostRes === "vitoria" ? 1 : 0,
    });
    writeClanScoreCreditForTargetTx(tx, guestClanScoreTarget, {
        wins: guestRes === "vitoria" ? 1 : 0,
    });
    tx.set(mHost, {
        id: mHost.id,
        gameId: "ppt",
        gameType: "ppt",
        userId: hostUid,
        opponentId: guestUid,
        resultado: hostRes,
        result: hostRes,
        score: ecoH.normalizedScore,
        rewardCoins: boostedH.totalCoins,
        rankingPoints: ecoH.rankingPoints,
        startedAt: null,
        finishedAt: finishedTs,
        metadata: ecoH.resolvedMetadata,
        detalhes: ecoH.resolvedMetadata,
        antiSpamToken: null,
        criadoEm: firestore_2.FieldValue.serverTimestamp(),
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
        rewardCoins: boostedG.totalCoins,
        rankingPoints: ecoG.rankingPoints,
        startedAt: null,
        finishedAt: finishedTs,
        metadata: ecoG.resolvedMetadata,
        detalhes: ecoG.resolvedMetadata,
        antiSpamToken: null,
        criadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    const hWin = hostRes === "vitoria";
    const hLoss = hostRes === "derrota";
    const gWin = guestRes === "vitoria";
    const gLoss = guestRes === "derrota";
    tx.update(hostUserRef, {
        totalPartidas: firestore_2.FieldValue.increment(1),
        totalVitorias: firestore_2.FieldValue.increment(hWin ? 1 : 0),
        totalDerrotas: firestore_2.FieldValue.increment(hLoss ? 1 : 0),
        coins: firestore_2.FieldValue.increment(boostedH.totalCoins),
        xp: firestore_2.FieldValue.increment(hWin ? 15 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.update(guestUserRef, {
        totalPartidas: firestore_2.FieldValue.increment(1),
        totalVitorias: firestore_2.FieldValue.increment(gWin ? 1 : 0),
        totalDerrotas: firestore_2.FieldValue.increment(gLoss ? 1 : 0),
        coins: firestore_2.FieldValue.increment(boostedG.totalCoins),
        xp: firestore_2.FieldValue.increment(gWin ? 15 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    const coinsH = Number(hu.coins ?? 0) + boostedH.totalCoins;
    const coinsG = Number(gu.coins ?? 0) + boostedG.totalCoins;
    if (boostedH.totalCoins > 0) {
        tx.set(wHost, {
            userId: hostUid,
            tipo: "jogo_pvp",
            moeda: "coins",
            valor: boostedH.totalCoins,
            saldoApos: coinsH,
            descricao: withBoostDescription("PPT 1v1 · vitória por W.O.", boostedH.boostCoins),
            referenciaId: mHost.id,
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
    }
    if (boostedG.totalCoins > 0) {
        tx.set(wGuest, {
            userId: guestUid,
            tipo: "jogo_pvp",
            moeda: "coins",
            valor: boostedG.totalCoins,
            saldoApos: coinsG,
            descricao: withBoostDescription("PPT 1v1 · vitória por W.O.", boostedG.boostCoins),
            referenciaId: mGuest.id,
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
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
        actionDeadlineAt: firestore_2.FieldValue.delete(),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    const gid = r.gameId || "ppt";
    tx.set(slotRef(hostUid), {
        uid: hostUid,
        gameId: gid,
        queueStatus: "idle",
        roomId: null,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(slotRef(guestUid), {
        uid: guestUid,
        gameId: gid,
        queueStatus: "idle",
        roomId: null,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { hostUid, guestUid, matchWinner };
}
/** Encerra PPT sem vencedor: ambos inativos (duas rodadas sem nenhum pick). Sem partidas/recompensas/ranking. */
async function applyPptVoidBothInactiveInTransaction(tx, roomRef, r) {
    const hostUid = String(r.hostUid);
    const guestUid = String(r.guestUid);
    const gid = r.gameId || "ppt";
    const picksColl = roomRef.collection("ppt_picks");
    const hPref = picksColl.doc(hostUid);
    const gPref = picksColl.doc(guestUid);
    const [hPSnap, gPSnap] = await Promise.all([tx.get(hPref), tx.get(gPref)]);
    if (hPSnap.exists)
        tx.delete(hPref);
    if (gPSnap.exists)
        tx.delete(gPref);
    tx.update(roomRef, {
        phase: "completed",
        status: "completed",
        pptRewardsApplied: true,
        pptVoidBothInactive: true,
        pptAwaitingBothPicks: false,
        pptMatchWinner: firestore_2.FieldValue.delete(),
        pptOutcome: firestore_2.FieldValue.delete(),
        timeoutEmptyRounds: 0,
        actionDeadlineAt: firestore_2.FieldValue.delete(),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    const hostUserRef = db.doc(`${COL.users}/${hostUid}`);
    const guestUserRef = db.doc(`${COL.users}/${guestUid}`);
    tx.update(hostUserRef, {
        pptPvPDuelsRemaining: firestore_2.FieldValue.increment(1),
        pptPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.update(guestUserRef, {
        pptPvPDuelsRemaining: firestore_2.FieldValue.increment(1),
        pptPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.set(slotRef(hostUid), {
        uid: hostUid,
        gameId: gid,
        queueStatus: "idle",
        roomId: null,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(slotRef(guestUid), {
        uid: guestUid,
        gameId: gid,
        queueStatus: "idle",
        roomId: null,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
}
async function applyGenericPvpTimeoutVoidInTransaction(tx, roomRef, r, extraRoomUpdates = {}) {
    const hostUid = String(r.hostUid);
    const guestUid = String(r.guestUid);
    const gid = r.gameId || "ppt";
    tx.update(roomRef, {
        status: "completed",
        phase: "completed",
        actionDeadlineAt: firestore_2.FieldValue.delete(),
        ...extraRoomUpdates,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    if (gid === "reaction_tap") {
        const hostUserRef = db.doc(`${COL.users}/${hostUid}`);
        const guestUserRef = db.doc(`${COL.users}/${guestUid}`);
        tx.update(hostUserRef, {
            reactionPvPDuelsRemaining: firestore_2.FieldValue.increment(1),
            reactionPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.update(guestUserRef, {
            reactionPvPDuelsRemaining: firestore_2.FieldValue.increment(1),
            reactionPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
    }
    tx.set(slotRef(hostUid), {
        uid: hostUid,
        gameId: gid,
        queueStatus: "idle",
        roomId: null,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(slotRef(guestUid), {
        uid: guestUid,
        gameId: gid,
        queueStatus: "idle",
        roomId: null,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
}
async function applyPptRoundResultInTransaction(tx, roomRef, roomId, r, hostHand, guestHand, out, pptWindowMs, pickRefs) {
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
            pptRoundStartedAt: firestore_2.FieldValue.serverTimestamp(),
            pptConsecutiveEmptyRounds: 0,
            timeoutEmptyRounds: 0,
            actionDeadlineAt: pvpActionDeadlineTs(Date.now() + PPT_ROUND_REVEAL_MS, pptWindowMs),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
            pptRoundStartedAt: firestore_2.FieldValue.serverTimestamp(),
            pptConsecutiveEmptyRounds: 0,
            timeoutEmptyRounds: 0,
            actionDeadlineAt: pvpActionDeadlineTs(Date.now() + PPT_ROUND_REVEAL_MS, pptWindowMs),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        return "round";
    }
    const matchWinner = newHost >= target ? "host" : "guest";
    const hostRes = matchWinner === "host" ? "vitoria" : "derrota";
    const guestRes = matchWinner === "guest" ? "vitoria" : "derrota";
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
    const ecoH = (0, gameEconomy_1.resolveMatchEconomy)("ppt", hostRes, 0, metaBase, economyConfig.matchRewardOverrides);
    const ecoG = (0, gameEconomy_1.resolveMatchEconomy)("ppt", guestRes, 0, metaBase, economyConfig.matchRewardOverrides);
    const hostUserRef = db.doc(`${COL.users}/${hostUid}`);
    const guestUserRef = db.doc(`${COL.users}/${guestUid}`);
    const [hUSnap, gUSnap] = await Promise.all([tx.get(hostUserRef), tx.get(guestUserRef)]);
    if (!hUSnap.exists || !gUSnap.exists) {
        throw new https_1.HttpsError("failed-precondition", "Perfil ausente.");
    }
    const hu = hUSnap.data();
    const gu = gUSnap.data();
    const boostedH = resolveBoostedCoins(ecoH.rewardCoins, hu, economyConfig);
    const boostedG = resolveBoostedCoins(ecoG.rewardCoins, gu, economyConfig);
    const hostClanScoreTarget = await readClanScoreCreditTargetTx(tx, hostUid);
    const guestClanScoreTarget = await readClanScoreCreditTargetTx(tx, guestUid);
    writeClanScoreCreditForTargetTx(tx, hostClanScoreTarget, {
        wins: hostRes === "vitoria" ? 1 : 0,
    });
    writeClanScoreCreditForTargetTx(tx, guestClanScoreTarget, {
        wins: guestRes === "vitoria" ? 1 : 0,
    });
    if (pickRefs) {
        tx.delete(pickRefs.hostRef);
        tx.delete(pickRefs.guestRef);
    }
    const finishedTs = firestore_2.Timestamp.now();
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
        rewardCoins: boostedH.totalCoins,
        rankingPoints: ecoH.rankingPoints,
        startedAt: null,
        finishedAt: finishedTs,
        metadata: ecoH.resolvedMetadata,
        detalhes: ecoH.resolvedMetadata,
        antiSpamToken: null,
        criadoEm: firestore_2.FieldValue.serverTimestamp(),
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
        rewardCoins: boostedG.totalCoins,
        rankingPoints: ecoG.rankingPoints,
        startedAt: null,
        finishedAt: finishedTs,
        metadata: ecoG.resolvedMetadata,
        detalhes: ecoG.resolvedMetadata,
        antiSpamToken: null,
        criadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.update(hostUserRef, {
        totalPartidas: firestore_2.FieldValue.increment(1),
        totalVitorias: firestore_2.FieldValue.increment(hostRes === "vitoria" ? 1 : 0),
        totalDerrotas: firestore_2.FieldValue.increment(hostRes === "derrota" ? 1 : 0),
        coins: firestore_2.FieldValue.increment(boostedH.totalCoins),
        xp: firestore_2.FieldValue.increment(hostRes === "vitoria" ? 15 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.update(guestUserRef, {
        totalPartidas: firestore_2.FieldValue.increment(1),
        totalVitorias: firestore_2.FieldValue.increment(guestRes === "vitoria" ? 1 : 0),
        totalDerrotas: firestore_2.FieldValue.increment(guestRes === "derrota" ? 1 : 0),
        coins: firestore_2.FieldValue.increment(boostedG.totalCoins),
        xp: firestore_2.FieldValue.increment(guestRes === "vitoria" ? 15 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    const coinsH = Number(hu.coins ?? 0) + boostedH.totalCoins;
    const coinsG = Number(gu.coins ?? 0) + boostedG.totalCoins;
    if (boostedH.totalCoins > 0) {
        tx.set(wHost, {
            userId: hostUid,
            tipo: "jogo_pvp",
            moeda: "coins",
            valor: boostedH.totalCoins,
            saldoApos: coinsH,
            descricao: withBoostDescription("PPT 1v1 (sala)", boostedH.boostCoins),
            referenciaId: mHost.id,
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
    }
    if (boostedG.totalCoins > 0) {
        tx.set(wGuest, {
            userId: guestUid,
            tipo: "jogo_pvp",
            moeda: "coins",
            valor: boostedG.totalCoins,
            saldoApos: coinsG,
            descricao: withBoostDescription("PPT 1v1 (sala)", boostedG.boostCoins),
            referenciaId: mGuest.id,
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
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
        actionDeadlineAt: firestore_2.FieldValue.delete(),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    const gid = r.gameId || "ppt";
    tx.set(slotRef(hostUid), {
        uid: hostUid,
        gameId: gid,
        queueStatus: "idle",
        roomId: null,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(slotRef(guestUid), {
        uid: guestUid,
        gameId: gid,
        queueStatus: "idle",
        roomId: null,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    return "match";
}
exports.initializeUserProfile = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
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
        throw new https_1.HttpsError("invalid-argument", "Nome ou username inválidos. Username: 3 a 10 caracteres (a-z, 0-9, _).");
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
        throw new https_1.HttpsError("already-exists", "Username já em uso.");
    }
    const referralConfig = await getReferralConfig();
    let convidadoPor = null;
    let invitedByCode = null;
    let inviterName = null;
    let inviterPhoto = null;
    if (codigoConvite) {
        const inv = await db
            .collection(COL.users)
            .where("codigoConvite", "==", codigoConvite)
            .limit(1)
            .get();
        if (inv.empty) {
            throw new https_1.HttpsError("invalid-argument", "Código de convite inválido.");
        }
        const inviter = inv.docs[0].id;
        if (inviter === uid && referralConfig.antiFraudRules.blockSelfReferral) {
            throw new https_1.HttpsError("failed-precondition", "Você não pode usar o próprio código.");
        }
        convidadoPor = inviter;
        invitedByCode = codigoConvite;
        inviterName = String(inv.docs[0].data()?.nome || "").trim() || null;
        inviterPhoto = typeof inv.docs[0].data()?.foto === "string" ? inv.docs[0].data()?.foto : null;
    }
    else if (referralConfig.codeRequired) {
        throw new https_1.HttpsError("invalid-argument", "Informe um código de convite para continuar.");
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
            invitedAt: convidadoPor ? firestore_2.FieldValue.serverTimestamp() : null,
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
            fragments: 0,
            storedBoostMinutes: 0,
            activeBoostUntil: null,
            superPrizeEntries: 0,
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
            scoreRankingDiarioKey: dailyKey(),
            scoreRankingSemanalKey: weeklyKey(),
            scoreRankingMensalKey: monthlyKey(),
            banido: false,
            riscoFraude: "baixo",
            pptPvPDuelsRemaining: PPT_DEFAULT_DUEL_CHARGES,
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            lastActiveAt: firestore_2.FieldValue.serverTimestamp(),
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
                invitedAt: firestore_2.FieldValue.serverTimestamp(),
                createdAt: firestore_2.FieldValue.serverTimestamp(),
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
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
                progressSnapshot: buildReferralProgressSnapshot({
                    nome,
                    username,
                    totalAdsAssistidos: 0,
                    totalPartidas: 0,
                    totalMissionRewardsClaimed: 0,
                }, false),
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
                referralPendingCount: firestore_2.FieldValue.increment(1),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            await upsertReferralRankingEntry(tx, convidadoPor, inviterName || "Jogador", inviterPhoto, { pending: 1 });
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
exports.updateUserAvatar = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const rawPhotoUrl = typeof request.data?.photoURL === "string" ? request.data.photoURL.trim() : "";
    const userRef = db.doc(`${COL.users}/${uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError("not-found", "Perfil do usuário não encontrado.");
    }
    const userData = userSnap.data();
    const nome = String(userData.nome || request.auth?.token.name || "Jogador").trim() || "Jogador";
    const username = String(userData.username || uid).trim() || uid;
    const authPhotoURL = normalizeHttpPhotoUrl(rawPhotoUrl);
    const photoURL = authPhotoURL || buildDefaultAvatarDataUrl(username, nome);
    await Promise.all([
        userRef.set({
            foto: photoURL,
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true }),
        admin.auth().updateUser(uid, { photoURL: authPhotoURL }),
        syncUserPresentation(uid, nome, photoURL),
    ]);
    return { ok: true, photoURL };
});
exports.processDailyLogin = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
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
        if (!snap.exists)
            throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
        const u = snap.data();
        if (u.banido)
            throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
        const last = u.ultimaEntradaEm?.toDate?.();
        let streak = Number(u.streakAtual || 0);
        if (!last)
            streak = 1;
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
            if (lastKey === yKey)
                streak += 1;
            else
                streak = 1;
        }
        const reward = (0, streakEconomy_1.resolveStreakRewardForDay)(streak, economy.streakTable, economy.dailyLoginBonus);
        const boostedCoins = resolveBoostedCoins(reward.coins, u, economy, now.getTime());
        const melhor = Math.max(Number(u.melhorStreak || 0), streak);
        const curCoins = Number(u.coins || 0);
        const curGems = Number(u.gems || 0);
        const newCoins = curCoins + boostedCoins.totalCoins;
        const newGems = curGems + reward.gems;
        const patch = {
            streakAtual: streak,
            melhorStreak: melhor,
            ultimaEntradaEm: firestore_2.Timestamp.fromDate(now),
            dailyLoginCount: firestore_2.FieldValue.increment(1),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        };
        if (boostedCoins.totalCoins > 0)
            patch.coins = firestore_2.FieldValue.increment(boostedCoins.totalCoins);
        if (reward.gems > 0)
            patch.gems = firestore_2.FieldValue.increment(reward.gems);
        tx.update(userRef, patch);
        if (boostedCoins.totalCoins > 0) {
            addWalletTxInTx(tx, {
                id: `streak_${uid}_${todayKey}_coins`,
                userId: uid,
                tipo: "streak",
                moeda: "coins",
                valor: boostedCoins.totalCoins,
                saldoApos: newCoins,
                descricao: withBoostDescription(reward.tipoBonus === "bau"
                    ? `Login diário · marco dia ${streak} (baú)`
                    : reward.tipoBonus === "especial"
                        ? `Login diário · marco dia ${streak} (especial)`
                        : "Login diário / streak", boostedCoins.boostCoins),
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
            coins: boostedCoins.totalCoins,
            boostCoins: boostedCoins.boostCoins,
            gems: reward.gems,
            tipoBonus: reward.tipoBonus,
        };
    }).then(async (result) => {
        await evaluateReferralForUser(uid);
        const grantedChest = result.alreadyCheckedIn || result.tipoBonus !== "bau"
            ? null
            : await grantChestIfEligible({
                uid,
                source: "daily_streak",
                sourceRefId: todayKey,
            });
        return { ...result, grantedChest };
    });
});
async function bumpWatchAdMissions(uid) {
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
        await progRef.set({
            missionId: m.id,
            progresso: next,
            concluida: next >= meta,
            recompensaResgatada: pSnap.data()?.recompensaResgatada ?? false,
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            periodoChave: dailyKey(),
        }, { merge: true });
    }
}
/**
 * Recompensa por anúncio: PR (placement padrão) ou +3 duelos PvP específicos.
 * Limite diário compartilhado; só o servidor altera saldos / duelos.
 */
exports.processRewardedAd = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const placementId = String(request.data?.placementId || "").trim();
    if (!ALLOWED_REWARDED_AD_PLACEMENTS.has(placementId)) {
        throw new https_1.HttpsError("invalid-argument", "placementId inválido.");
    }
    const { token: completionToken, isMock } = parseRewardedAdCompletionToken(request.data?.mockCompletionToken);
    const tokenHash = hashId(uid, placementId, completionToken);
    return grantRewardedAdPlacement({
        uid,
        placementId,
        adEventId: tokenHash,
        mock: isMock,
        origin: "callable",
        tokenHash,
    });
});
exports.prepareRewardedAdSession = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const placementId = String(request.data?.placementId || "").trim();
    if (!ALLOWED_REWARDED_AD_PLACEMENTS.has(placementId)) {
        throw new https_1.HttpsError("invalid-argument", "placementId inválido para SSV.");
    }
    const [economy, userSnap] = await Promise.all([getEconomy(), db.doc(`${COL.users}/${uid}`).get()]);
    if (!userSnap.exists) {
        throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
    }
    const userData = userSnap.data();
    if (userData.banido) {
        throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
    }
    const today = dailyKey();
    const currentDayKey = String(userData.rewardedAdsDayKey || "");
    const currentCount = currentDayKey === today ? Math.max(0, Math.floor(Number(userData.rewardedAdsCount || 0))) : 0;
    if (currentCount >= economy.limiteDiarioAds) {
        throw new https_1.HttpsError("resource-exhausted", "Limite diário de anúncios atingido.");
    }
    const sessionRef = db.collection(COL.rewardedAdSessions).doc();
    const expiresAtMs = Date.now() + REWARDED_AD_SESSION_TTL_MS;
    await sessionRef.set({
        id: sessionRef.id,
        userId: uid,
        placementId,
        status: "solicitado",
        provider: "admob_ssv",
        mock: false,
        createdAt: firestore_2.FieldValue.serverTimestamp(),
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
        expiresAt: firestore_2.Timestamp.fromMillis(expiresAtMs),
    });
    return {
        sessionId: sessionRef.id,
        userId: uid,
        customData: sessionRef.id,
        expiresAtMs,
    };
});
exports.getRewardedAdSessionStatus = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const sessionId = String(request.data?.sessionId || "").trim();
    if (!sessionId) {
        throw new https_1.HttpsError("invalid-argument", "sessionId obrigatório.");
    }
    const sessionRef = db.doc(`${COL.rewardedAdSessions}/${sessionId}`);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
        throw new https_1.HttpsError("not-found", "Sessão de anúncio não encontrada.");
    }
    const session = (sessionSnap.data() || {});
    if (String(session.userId || "") !== uid) {
        throw new https_1.HttpsError("permission-denied", "Sessão não pertence ao usuário atual.");
    }
    const expiresAtMs = millisFromFirestoreTime(session.expiresAt);
    const nowMs = Date.now();
    let rawStatus = String(session.status || "solicitado");
    if (rawStatus === "solicitado" && expiresAtMs > 0 && expiresAtMs < nowMs) {
        rawStatus = "invalido";
        await sessionRef.set({
            status: "invalido",
            errorReason: "Sessão expirada antes da confirmação do AdMob.",
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    const result = session.result && typeof session.result === "object"
        ? session.result
        : {};
    return {
        status: rawStatus === "recompensado"
            ? "rewarded"
            : rawStatus === "solicitado"
                ? "pending"
                : rawStatus === "invalido"
                    ? "invalid"
                    : rawStatus,
        placementId: String(session.placementId || ""),
        expiresAtMs: expiresAtMs || null,
        errorReason: typeof session.errorReason === "string" ? session.errorReason : null,
        coins: Math.max(0, Math.floor(Number(result.coins) || 0)),
        boostCoins: Math.max(0, Math.floor(Number(result.boostCoins) || 0)),
        pptPvPDuelsAdded: Math.max(0, Math.floor(Number(result.pptPvPDuelsAdded) || 0)),
        pptPvPDuelsRemaining: Math.max(0, Math.floor(Number(result.pptPvPDuelsRemaining) || 0)),
        quizPvPDuelsAdded: Math.max(0, Math.floor(Number(result.quizPvPDuelsAdded) || 0)),
        quizPvPDuelsRemaining: Math.max(0, Math.floor(Number(result.quizPvPDuelsRemaining) || 0)),
        reactionPvPDuelsAdded: Math.max(0, Math.floor(Number(result.reactionPvPDuelsAdded) || 0)),
        reactionPvPDuelsRemaining: Math.max(0, Math.floor(Number(result.reactionPvPDuelsRemaining) || 0)),
    };
});
exports.adMobRewardedSsv = (0, https_1.onRequest)({
    region: MULTIPLAYER_FUNCTIONS_REGION,
}, async (request, response) => {
    if (request.method !== "GET") {
        response.status(405).send("Method Not Allowed");
        return;
    }
    const originalUrl = request.originalUrl || request.url || "";
    const queryStart = originalUrl.indexOf("?");
    const rawQuery = queryStart >= 0 ? originalUrl.slice(queryStart + 1) : "";
    const signature = String(Array.isArray(request.query.signature) ? request.query.signature[0] : request.query.signature || "").trim();
    const keyId = String(Array.isArray(request.query.key_id) ? request.query.key_id[0] : request.query.key_id || "").trim();
    if (!rawQuery || !signature || !keyId) {
        response.status(200).send("AdMob SSV endpoint ready");
        return;
    }
    try {
        await verifyAdMobSsvSignature({ rawQuery, signature, keyId });
    }
    catch (error) {
        response
            .status(400)
            .send(error instanceof Error ? error.message : "SSV signature verification failed");
        return;
    }
    const sessionId = String(Array.isArray(request.query.custom_data)
        ? request.query.custom_data[0]
        : request.query.custom_data || "").trim();
    const uid = String(Array.isArray(request.query.user_id) ? request.query.user_id[0] : request.query.user_id || "").trim();
    const transactionId = String(Array.isArray(request.query.transaction_id)
        ? request.query.transaction_id[0]
        : request.query.transaction_id || "").trim();
    if (!sessionId || !uid || !transactionId) {
        response.status(200).send("AdMob SSV verification ok");
        return;
    }
    const sessionRef = db.doc(`${COL.rewardedAdSessions}/${sessionId}`);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
        response.status(200).send("Ignored");
        return;
    }
    const session = (sessionSnap.data() || {});
    if (String(session.userId || "") !== uid) {
        await sessionRef.set({
            status: "invalido",
            errorReason: "SSV recebido com user_id divergente da sessão.",
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        response.status(200).send("Ignored");
        return;
    }
    if (String(session.status || "") === "recompensado") {
        response.status(200).send("OK");
        return;
    }
    const expiresAtMs = millisFromFirestoreTime(session.expiresAt);
    if (expiresAtMs > 0 && expiresAtMs < Date.now()) {
        await sessionRef.set({
            status: "invalido",
            errorReason: "SSV chegou após a expiração da sessão.",
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        response.status(200).send("Expired");
        return;
    }
    const placementId = String(session.placementId || "").trim();
    if (!ALLOWED_REWARDED_AD_PLACEMENTS.has(placementId)) {
        await sessionRef.set({
            status: "invalido",
            errorReason: "placementId da sessão é inválido para SSV.",
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        response.status(200).send("Ignored");
        return;
    }
    try {
        const result = await grantRewardedAdPlacement({
            uid,
            placementId,
            adEventId: `ssv_${transactionId}`,
            mock: false,
            origin: "admob_ssv",
            sessionId,
            providerTransactionId: transactionId,
            rewardMetadata: {
                adNetwork: String(Array.isArray(request.query.ad_network)
                    ? request.query.ad_network[0]
                    : request.query.ad_network || ""),
                adUnit: String(Array.isArray(request.query.ad_unit) ? request.query.ad_unit[0] : request.query.ad_unit || ""),
                rewardAmount: String(Array.isArray(request.query.reward_amount)
                    ? request.query.reward_amount[0]
                    : request.query.reward_amount || ""),
                rewardItem: String(Array.isArray(request.query.reward_item)
                    ? request.query.reward_item[0]
                    : request.query.reward_item || ""),
                timestamp: String(Array.isArray(request.query.timestamp) ? request.query.timestamp[0] : request.query.timestamp || ""),
                keyId,
            },
        });
        await sessionRef.set({
            status: "recompensado",
            providerTransactionId: transactionId,
            rewardedAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
            result,
        }, { merge: true });
        response.status(200).send("OK");
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            if (error.code === "already-exists") {
                await sessionRef.set({
                    status: "recompensado",
                    providerTransactionId: transactionId,
                    updatedAt: firestore_2.FieldValue.serverTimestamp(),
                }, { merge: true });
                response.status(200).send("OK");
                return;
            }
            if (error.code === "resource-exhausted" ||
                error.code === "failed-precondition" ||
                error.code === "permission-denied" ||
                error.code === "invalid-argument") {
                await sessionRef.set({
                    status: "invalido",
                    errorReason: error.message,
                    providerTransactionId: transactionId,
                    updatedAt: firestore_2.FieldValue.serverTimestamp(),
                }, { merge: true });
                response.status(200).send("Ignored");
                return;
            }
        }
        console.error("[AdMob SSV] erro inesperado", error);
        response.status(500).send("Internal error");
    }
});
exports.finalizeMatch = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const gameId = request.data?.gameId;
    const resultado = request.data?.resultado;
    const clientScore = Number(request.data?.score || 0);
    const rawMeta = request.data?.metadata ?? request.data?.detalhes;
    const metadata = rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
        ? rawMeta
        : {};
    const opponentId = request.data?.opponentId ? String(request.data.opponentId) : null;
    const startedAtRaw = request.data?.startedAt ? String(request.data.startedAt) : null;
    if (!gameId || !resultado)
        throw new https_1.HttpsError("invalid-argument", "Dados inválidos.");
    if (gameEconomy_1.GAME_COOLDOWN_SEC[gameId] === undefined) {
        throw new https_1.HttpsError("invalid-argument", "Jogo inválido.");
    }
    const userRef = db.doc(`${COL.users}/${uid}`);
    const [uSnap, membershipSnap] = await Promise.all([userRef.get(), clanMembershipRef(uid).get()]);
    if (!uSnap.exists)
        throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
    const u = uSnap.data();
    if (u.banido)
        throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
    const clanIdAtEvent = membershipSnap.exists
        ? String((membershipSnap.data() || {}).clanId || "").trim() || null
        : null;
    const now = Date.now();
    const gcMap = u.gameCooldownUntil || {};
    const until = millisFromCooldownField(gcMap[gameId]);
    if (until > now) {
        await logMatchFraud(uid, "cooldown_violation", { gameId, remainingMs: until - now });
        throw new https_1.HttpsError("resource-exhausted", `Aguarde ${Math.ceil((until - now) / 1000)}s para jogar de novo.`);
    }
    const burstR = nextBurstState(u, now);
    if (!burstR.ok) {
        await logMatchFraud(uid, "match_rate_limit", { gameId });
        throw new https_1.HttpsError("resource-exhausted", "Muitas partidas em sequência. Aguarde um minuto.");
    }
    const effectiveResult = gameId === "roleta" || gameId === "bau" ? "vitoria" : resultado;
    const economyConfig = await getEconomy();
    const economy = (0, gameEconomy_1.resolveMatchEconomy)(gameId, effectiveResult, clientScore, metadata, economyConfig.matchRewardOverrides);
    const cdSec = gameEconomy_1.GAME_COOLDOWN_SEC[gameId] ?? 3;
    const cooldownUntil = firestore_2.Timestamp.fromMillis(now + cdSec * 1000);
    let startedTs = null;
    if (startedAtRaw) {
        const d = new Date(startedAtRaw);
        if (!Number.isNaN(d.getTime()) && now - d.getTime() < 15 * 60 * 1000 && d.getTime() <= now) {
            startedTs = firestore_2.Timestamp.fromDate(d);
        }
    }
    const matchRef = db.collection(COL.matches).doc();
    const win = effectiveResult === "vitoria";
    const loss = effectiveResult === "derrota";
    const boostedCoins = resolveBoostedCoins(economy.rewardCoins, u, economyConfig, now);
    const rewardCoins = boostedCoins.totalCoins;
    const rankingPoints = economy.rankingPoints;
    const coinsBefore = Number(u.coins ?? 0);
    const newCoins = coinsBefore + rewardCoins;
    const finishedTs = firestore_2.Timestamp.now();
    const matchDoc = {
        id: matchRef.id,
        gameId,
        gameType: gameId,
        userId: uid,
        opponentId,
        clanIdAtEvent,
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
        criadoEm: firestore_2.FieldValue.serverTimestamp(),
    };
    const batch = db.batch();
    batch.set(matchRef, matchDoc);
    batch.update(userRef, {
        totalPartidas: firestore_2.FieldValue.increment(1),
        totalVitorias: firestore_2.FieldValue.increment(win ? 1 : 0),
        totalDerrotas: firestore_2.FieldValue.increment(loss ? 1 : 0),
        coins: firestore_2.FieldValue.increment(rewardCoins),
        xp: firestore_2.FieldValue.increment(win ? 15 : effectiveResult === "empate" ? 8 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        matchBurst: burstR.burst,
        [`gameCooldownUntil.${gameId}`]: cooldownUntil,
    });
    await batch.commit();
    await applyClanScoreCreditByClanId(clanIdAtEvent, { uid, wins: win ? 1 : 0 });
    if (rewardCoins > 0) {
        await addWalletTx({
            userId: uid,
            tipo: "jogo",
            moeda: "coins",
            valor: rewardCoins,
            saldoApos: newCoins,
            descricao: withBoostDescription(`Minijogo ${gameId}`, boostedCoins.boostCoins),
            referenciaId: matchRef.id,
        });
    }
    await upsertRanking({
        uid,
        nome: String(u.nome || "Jogador"),
        username: String(u.username || "") || null,
        foto: u.foto ?? null,
        deltaScore: rankingPoints,
        win,
        gameId,
    });
    await bumpPlayMatchMissions(uid);
    await evaluateReferralForUser(uid);
    const grantedChest = AUTO_QUEUE_GAMES.has(gameId) && effectiveResult === "vitoria"
        ? await grantChestIfEligible({
            uid,
            source: "multiplayer_win",
            sourceRefId: matchRef.id,
        })
        : null;
    return {
        matchId: matchRef.id,
        rewardCoins,
        boostCoins: boostedCoins.boostCoins,
        rankingPoints,
        normalizedScore: economy.normalizedScore,
        grantedChest,
    };
});
exports.claimMissionReward = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const missionId = String(request.data?.missionId || "");
    if (!missionId)
        throw new https_1.HttpsError("invalid-argument", "missionId obrigatório.");
    const economy = await getEconomy();
    const missionRef = db.doc(`${COL.missions}/${missionId}`);
    const progRef = db.doc(`${COL.userMissions}/${uid}/daily/${missionId}`);
    const userRef = db.doc(`${COL.users}/${uid}`);
    let chestSourceRefId = missionId;
    await db.runTransaction(async (tx) => {
        const [mSnap, pSnap, uSnap] = await Promise.all([
            tx.get(missionRef),
            tx.get(progRef),
            tx.get(userRef),
        ]);
        if (!mSnap.exists)
            throw new https_1.HttpsError("not-found", "Missão inexistente.");
        if (!pSnap.exists || !pSnap.data()?.concluida) {
            throw new https_1.HttpsError("failed-precondition", "Missão não concluída.");
        }
        if (pSnap.data()?.recompensaResgatada) {
            throw new https_1.HttpsError("already-exists", "Recompensa já resgatada.");
        }
        if (!uSnap.exists)
            throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
        const m = mSnap.data();
        const u = uSnap.data();
        if (u.banido)
            throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
        const c = Number(m.recompensaCoins || 0);
        const boostedCoins = resolveBoostedCoins(c, u, economy);
        const g = Number(m.recompensaGems || 0);
        const xp = Number(m.recompensaXP || 0);
        const currentCoins = Number(u.coins || 0);
        const currentGems = Number(u.gems || 0);
        const periodKey = String(pSnap.data()?.periodoChave || dailyKey());
        chestSourceRefId = `${missionId}:${periodKey}`;
        tx.update(userRef, {
            coins: firestore_2.FieldValue.increment(boostedCoins.totalCoins),
            gems: firestore_2.FieldValue.increment(g),
            xp: firestore_2.FieldValue.increment(xp),
            totalMissionRewardsClaimed: firestore_2.FieldValue.increment(1),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.update(progRef, {
            recompensaResgatada: true,
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        if (boostedCoins.totalCoins > 0) {
            addWalletTxInTx(tx, {
                id: `mission_${uid}_${missionId}_${periodKey}_coins`,
                userId: uid,
                tipo: "missao",
                moeda: "coins",
                valor: boostedCoins.totalCoins,
                saldoApos: currentCoins + boostedCoins.totalCoins,
                descricao: withBoostDescription(`Missão: ${m.titulo || missionId}`, boostedCoins.boostCoins),
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
    const grantedChest = await grantChestIfEligible({
        uid,
        source: "mission_claim",
        sourceRefId: chestSourceRefId,
    });
    return { ok: true, grantedChest };
});
exports.getUserChestItems = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const itemsCol = db.collection(`${COL.userChests}/${uid}/items`);
    const config = await getChestSystemConfig();
    const itemsSnap = await itemsCol.get();
    const nowMs = Date.now();
    const rawItems = itemsSnap.docs.map((docSnap) => readChestItemState(docSnap));
    const normalizedItems = config.enabled
        ? normalizeChestSlotsAndQueue(rawItems, config, nowMs)
        : rawItems;
    const normalizedById = new Map(normalizedItems.map((item) => [item.id, item]));
    const batch = db.batch();
    let hasWrites = false;
    for (const docSnap of itemsSnap.docs) {
        const before = rawItems.find((item) => item.id === docSnap.id);
        const after = normalizedById.get(docSnap.id);
        if (before && after && chestStateChanged(before, after)) {
            batch.update(docSnap.ref, chestItemPatch(after));
            hasWrites = true;
        }
    }
    if (hasWrites) {
        await batch.commit();
    }
    return {
        items: normalizedItems.map((item) => chestItemWire(item)),
    };
});
exports.startChestUnlock = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const chestId = String(request.data?.chestId || "").trim();
    if (!chestId) {
        throw new https_1.HttpsError("invalid-argument", "chestId obrigatório.");
    }
    const config = await getChestSystemConfig();
    if (!config.enabled) {
        throw new https_1.HttpsError("failed-precondition", "Sistema de baús desativado.");
    }
    const chestRef = db.doc(`${COL.userChests}/${uid}/items/${chestId}`);
    const itemsCol = db.collection(`${COL.userChests}/${uid}/items`);
    return db.runTransaction(async (tx) => {
        const [itemsSnap, chestSnap] = await Promise.all([tx.get(itemsCol), tx.get(chestRef)]);
        if (!chestSnap.exists) {
            throw new https_1.HttpsError("not-found", "Baú não encontrado.");
        }
        const nowMs = Date.now();
        const rawItems = itemsSnap.docs.map((docSnap) => readChestItemState(docSnap));
        const normalizedItems = normalizeChestSlotsAndQueue(rawItems, config, nowMs);
        applyNormalizedChestItemWrites(tx, itemsSnap.docs, rawItems, normalizedItems);
        const chest = normalizedItems.find((item) => item.id === chestId);
        if (!chest) {
            throw new https_1.HttpsError("not-found", "Baú não encontrado.");
        }
        if (chest.status === "queued") {
            throw new https_1.HttpsError("failed-precondition", "Este baú ainda está na fila de espera.");
        }
        if (normalizedItems.some((item) => item.id !== chestId &&
            item.status === "unlocking" &&
            item.readyAtMs != null &&
            item.readyAtMs > nowMs)) {
            throw new https_1.HttpsError("failed-precondition", "Já existe um baú em abertura.");
        }
        const currentStatus = chestActionStatus(chest, nowMs);
        if (currentStatus === "ready" || currentStatus === "unlocking") {
            if (currentStatus === "ready" && chest.status !== "ready") {
                chest.status = "ready";
                tx.update(chestRef, chestItemPatch(chest));
            }
            return chestActionPayload(chest, nowMs);
        }
        chest.status = "unlocking";
        chest.unlockStartedAtMs = nowMs;
        chest.readyAtMs = nowMs + chest.unlockDurationSec * 1000;
        chest.nextAdAvailableAtMs = null;
        tx.update(chestRef, chestItemPatch(chest));
        return chestActionPayload(chest, nowMs);
    });
});
exports.speedUpChestUnlock = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const chestId = String(request.data?.chestId || "").trim();
    if (!chestId) {
        throw new https_1.HttpsError("invalid-argument", "chestId obrigatório.");
    }
    const { token: completionToken, isMock } = parseRewardedAdCompletionToken(request.data?.mockCompletionToken);
    const config = await getChestSystemConfig();
    if (!config.enabled) {
        throw new https_1.HttpsError("failed-precondition", "Sistema de baús desativado.");
    }
    const tokenHash = hashId(uid, CHEST_SPEEDUP_PLACEMENT_ID, chestId, completionToken);
    const adRef = db.doc(`${COL.adEvents}/${tokenHash}`);
    const userRef = db.doc(`${COL.users}/${uid}`);
    const metaRef = db.doc(`${COL.userChests}/${uid}`);
    const chestRef = db.doc(`${COL.userChests}/${uid}/items/${chestId}`);
    const itemsCol = db.collection(`${COL.userChests}/${uid}/items`);
    return db.runTransaction(async (tx) => {
        const [userSnap, metaSnap, itemsSnap, chestSnap, adSnap] = await Promise.all([
            tx.get(userRef),
            tx.get(metaRef),
            tx.get(itemsCol),
            tx.get(chestRef),
            tx.get(adRef),
        ]);
        if (!userSnap.exists) {
            throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
        }
        if (!chestSnap.exists) {
            throw new https_1.HttpsError("not-found", "Baú não encontrado.");
        }
        if (adSnap.exists) {
            throw new https_1.HttpsError("already-exists", "Este anúncio já foi processado.");
        }
        const userData = userSnap.data();
        if (userData.banido) {
            throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
        }
        const nowMs = Date.now();
        const meta = readUserChestMetaState(metaSnap.exists ? (metaSnap.data() || {}) : undefined);
        const todayKey = dailyKey();
        const currentDailyCount = meta.dailySpeedupDayKey === todayKey ? meta.dailySpeedupCount : 0;
        if (currentDailyCount >= config.dailyChestAdsLimit) {
            throw new https_1.HttpsError("resource-exhausted", "Limite diário de aceleração de baús atingido.");
        }
        const rawItems = itemsSnap.docs.map((docSnap) => readChestItemState(docSnap));
        const normalizedItems = normalizeChestSlotsAndQueue(rawItems, config, nowMs);
        await applyClanScoreCreditTx(tx, { uid, ads: 1 });
        applyNormalizedChestItemWrites(tx, itemsSnap.docs, rawItems, normalizedItems);
        const chest = normalizedItems.find((item) => item.id === chestId);
        if (!chest) {
            throw new https_1.HttpsError("not-found", "Baú não encontrado.");
        }
        if (chestActionStatus(chest, nowMs) !== "unlocking" || chest.readyAtMs == null) {
            throw new https_1.HttpsError("failed-precondition", "Este baú não está em abertura.");
        }
        if (chest.adsUsed >= config.maxAdsPerChest) {
            throw new https_1.HttpsError("resource-exhausted", "Este baú já atingiu o limite de anúncios.");
        }
        if (chest.nextAdAvailableAtMs != null && chest.nextAdAvailableAtMs > nowMs) {
            const waitSec = Math.max(1, Math.ceil((chest.nextAdAvailableAtMs - nowMs) / 1000));
            throw new https_1.HttpsError("resource-exhausted", `Aguarde ${waitSec}s para acelerar este baú de novo.`);
        }
        const remainingMs = Math.max(0, chest.readyAtMs - nowMs);
        const reducedMs = Math.max(1, Math.ceil(remainingMs * config.adSpeedupPercent));
        const nextReadyAtMs = Math.max(nowMs, chest.readyAtMs - reducedMs);
        chest.adsUsed += 1;
        chest.readyAtMs = nextReadyAtMs;
        if (nextReadyAtMs <= nowMs) {
            chest.status = "ready";
            chest.nextAdAvailableAtMs = null;
        }
        else {
            chest.nextAdAvailableAtMs = nowMs + config.adCooldownSeconds * 1000;
        }
        tx.update(chestRef, chestItemPatch(chest));
        tx.update(userRef, {
            totalAdsAssistidos: firestore_2.FieldValue.increment(1),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.set(adRef, {
            id: adRef.id,
            userId: uid,
            status: "recompensado",
            placementId: CHEST_SPEEDUP_PLACEMENT_ID,
            rewardKind: "chest_speedup",
            chestId,
            mock: isMock,
            tokenHash,
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        writeChestMetaState(tx, metaRef, metaSnap, uid, {
            ...meta,
            dailySpeedupDayKey: todayKey,
            dailySpeedupCount: currentDailyCount + 1,
        });
        return {
            ...chestActionPayload(chest, nowMs),
            reducedMs,
            dailyAdsUsed: currentDailyCount + 1,
        };
    });
});
exports.claimChestReward = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const chestId = String(request.data?.chestId || "").trim();
    if (!chestId) {
        throw new https_1.HttpsError("invalid-argument", "chestId obrigatório.");
    }
    const config = await getChestSystemConfig();
    if (!config.enabled) {
        throw new https_1.HttpsError("failed-precondition", "Sistema de baús desativado.");
    }
    const userRef = db.doc(`${COL.users}/${uid}`);
    const metaRef = db.doc(`${COL.userChests}/${uid}`);
    const chestRef = db.doc(`${COL.userChests}/${uid}/items/${chestId}`);
    const itemsCol = db.collection(`${COL.userChests}/${uid}/items`);
    return db.runTransaction(async (tx) => {
        const [userSnap, metaSnap, itemsSnap, chestSnap] = await Promise.all([
            tx.get(userRef),
            tx.get(metaRef),
            tx.get(itemsCol),
            tx.get(chestRef),
        ]);
        if (!userSnap.exists) {
            throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
        }
        if (!chestSnap.exists) {
            throw new https_1.HttpsError("not-found", "Baú não encontrado.");
        }
        const userData = userSnap.data();
        if (userData.banido) {
            throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
        }
        const nowMs = Date.now();
        const meta = readUserChestMetaState(metaSnap.exists ? (metaSnap.data() || {}) : undefined);
        const rawItems = itemsSnap.docs.map((docSnap) => readChestItemState(docSnap));
        const normalizedItems = normalizeChestSlotsAndQueue(rawItems, config, nowMs);
        applyNormalizedChestItemWrites(tx, itemsSnap.docs, rawItems, normalizedItems);
        const chest = normalizedItems.find((item) => item.id === chestId);
        if (!chest) {
            throw new https_1.HttpsError("not-found", "Baú não encontrado.");
        }
        if (chestActionStatus(chest, nowMs) !== "ready") {
            const remainingMs = chest.readyAtMs != null ? Math.max(0, chest.readyAtMs - nowMs) : chest.unlockDurationSec * 1000;
            throw new https_1.HttpsError("failed-precondition", `Este baú ainda não está pronto. Faltam ${Math.max(1, Math.ceil(remainingMs / 1000))}s.`);
        }
        const rewards = chest.rewardsSnapshot;
        const currentCoins = Number(userData.coins || 0);
        const currentGems = Number(userData.gems || 0);
        const totalCoinReward = rewards.coins + rewards.bonusCoins;
        tx.update(userRef, {
            coins: firestore_2.FieldValue.increment(totalCoinReward),
            gems: firestore_2.FieldValue.increment(rewards.gems),
            xp: firestore_2.FieldValue.increment(rewards.xp),
            fragments: firestore_2.FieldValue.increment(rewards.fragments),
            storedBoostMinutes: firestore_2.FieldValue.increment(rewards.boostMinutes),
            superPrizeEntries: firestore_2.FieldValue.increment(rewards.superPrizeEntries),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        if (totalCoinReward > 0) {
            addWalletTxInTx(tx, {
                id: `chest_${uid}_${chestId}_coins`,
                userId: uid,
                tipo: "bau",
                moeda: "coins",
                valor: totalCoinReward,
                saldoApos: currentCoins + totalCoinReward,
                descricao: `Baú ${chest.rarity}`,
                referenciaId: chestId,
            });
        }
        if (rewards.gems > 0) {
            addWalletTxInTx(tx, {
                id: `chest_${uid}_${chestId}_gems`,
                userId: uid,
                tipo: "bau",
                moeda: "gems",
                valor: rewards.gems,
                saldoApos: currentGems + rewards.gems,
                descricao: `Baú ${chest.rarity} (TICKET)`,
                referenciaId: chestId,
            });
        }
        tx.delete(chestRef);
        const remainingBefore = normalizedItems.filter((item) => item.id !== chestId);
        const remainingAfter = normalizeChestSlotsAndQueue(remainingBefore, config, nowMs);
        const remainingDocSnaps = itemsSnap.docs.filter((docSnap) => docSnap.id !== chestId);
        applyNormalizedChestItemWrites(tx, remainingDocSnaps, remainingBefore, remainingAfter);
        writeChestMetaState(tx, metaRef, metaSnap, uid, {
            ...meta,
            totalClaimed: meta.totalClaimed + 1,
        });
        return {
            chestId,
            rarity: chest.rarity,
            rewards,
            promotedChestId: remainingAfter.find((item) => item.status === "locked" && item.slotIndex != null)?.id ?? null,
        };
    });
});
exports.craftBoostFromFragments = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const economy = await getEconomy();
    if (!isBoostSystemEnabled(economy)) {
        throw new https_1.HttpsError("failed-precondition", "O sistema de boost está desativado no momento.");
    }
    const userRef = db.doc(`${COL.users}/${uid}`);
    return db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
            throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
        }
        const userData = userSnap.data();
        if (userData.banido) {
            throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
        }
        const fragments = readFragmentsBalance(userData);
        const storedBoostMinutes = readStoredBoostMinutes(userData);
        const cost = Math.max(1, economy.fragmentsPerBoostCraft);
        const gainMinutes = Math.max(1, economy.boostMinutesPerCraft);
        if (fragments < cost) {
            throw new https_1.HttpsError("failed-precondition", `Você precisa de ${cost} fragmentos para fabricar este boost.`);
        }
        const nextFragments = fragments - cost;
        const nextStoredBoostMinutes = storedBoostMinutes + gainMinutes;
        tx.update(userRef, {
            fragments: firestore_2.FieldValue.increment(-cost),
            storedBoostMinutes: firestore_2.FieldValue.increment(gainMinutes),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        return {
            ok: true,
            fragmentsCost: cost,
            boostMinutesAdded: gainMinutes,
            fragmentsBalance: nextFragments,
            storedBoostMinutes: nextStoredBoostMinutes,
        };
    });
});
exports.activateStoredBoost = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const economy = await getEconomy();
    if (!isBoostSystemEnabled(economy)) {
        throw new https_1.HttpsError("failed-precondition", "O sistema de boost está desativado no momento.");
    }
    const userRef = db.doc(`${COL.users}/${uid}`);
    return db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
            throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
        }
        const userData = userSnap.data();
        if (userData.banido) {
            throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
        }
        const storedBoostMinutes = readStoredBoostMinutes(userData);
        if (storedBoostMinutes <= 0) {
            throw new https_1.HttpsError("failed-precondition", "Você não tem boost armazenado para ativar.");
        }
        const activationMinutes = Math.max(1, economy.boostActivationMinutes);
        const minutesToActivate = Math.min(storedBoostMinutes, activationMinutes);
        const nowMs = Date.now();
        const currentActiveUntilMs = readActiveBoostUntilMs(userData);
        const baseStartMs = currentActiveUntilMs > nowMs ? currentActiveUntilMs : nowMs;
        const nextActiveUntilMs = baseStartMs + minutesToActivate * 60 * 1000;
        const nextStoredBoostMinutes = storedBoostMinutes - minutesToActivate;
        tx.update(userRef, {
            storedBoostMinutes: firestore_2.FieldValue.increment(-minutesToActivate),
            activeBoostUntil: firestore_2.Timestamp.fromMillis(nextActiveUntilMs),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        return {
            ok: true,
            activatedMinutes: minutesToActivate,
            storedBoostMinutes: nextStoredBoostMinutes,
            activeBoostUntilMs: nextActiveUntilMs,
            boostRewardPercent: economy.boostRewardPercent,
        };
    });
});
exports.requestRewardClaim = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const valor = Math.floor(Number(request.data?.valor));
    const tipo = String(request.data?.tipo || "pix");
    const chavePix = String(request.data?.chavePix || "").trim();
    if (!Number.isFinite(valor) || valor <= 0 || !chavePix) {
        throw new https_1.HttpsError("invalid-argument", "Dados inválidos.");
    }
    const userRef = db.doc(`${COL.users}/${uid}`);
    const ref = db.collection(COL.rewardClaims).doc();
    await db.runTransaction(async (tx) => {
        const uSnap = await tx.get(userRef);
        if (!uSnap.exists)
            throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
        const u = uSnap.data();
        const bal = Number(u.rewardBalance || 0);
        if (valor > bal) {
            throw new https_1.HttpsError("failed-precondition", "Saldo insuficiente.");
        }
        tx.update(userRef, {
            rewardBalance: firestore_2.FieldValue.increment(-valor),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
const ADMIN_GRANT_ECONOMY_MAX = 5000000;
exports.adminGrantEconomy = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const adminUid = request.auth?.uid;
    assertAuthed(adminUid);
    await assertAdmin(adminUid);
    const lookup = String(request.data?.lookup || "username").toLowerCase();
    const value = String(request.data?.value || "").trim();
    const kind = String(request.data?.kind || "");
    const amount = Math.floor(Number(request.data?.amount));
    if (!["username", "uid"].includes(lookup)) {
        throw new https_1.HttpsError("invalid-argument", "lookup deve ser username ou uid.");
    }
    if (!value) {
        throw new https_1.HttpsError("invalid-argument", "Informe username ou UID.");
    }
    if (!["coins", "gems", "rewardBalance"].includes(kind)) {
        throw new https_1.HttpsError("invalid-argument", "kind inválido: coins (PR), gems (TICKET) ou rewardBalance (CASH).");
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > ADMIN_GRANT_ECONOMY_MAX) {
        throw new https_1.HttpsError("invalid-argument", "Quantidade inválida.");
    }
    let targetUid = "";
    if (lookup === "uid") {
        const ref = db.doc(`${COL.users}/${value}`);
        const s = await ref.get();
        if (!s.exists)
            throw new https_1.HttpsError("not-found", "UID não encontrado em users.");
        targetUid = value;
    }
    else {
        const un = value.toLowerCase().replace(/^@/, "");
        const q = await db.collection(COL.users).where("username", "==", un).limit(1).get();
        if (q.empty)
            throw new https_1.HttpsError("not-found", "Username não encontrado.");
        targetUid = q.docs[0].id;
    }
    const userRef = db.doc(`${COL.users}/${targetUid}`);
    const uSnap = await userRef.get();
    if (!uSnap.exists)
        throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
    const u = uSnap.data();
    if (u.banido)
        throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
    const field = kind === "coins" ? "coins" : kind === "gems" ? "gems" : "rewardBalance";
    const before = kind === "coins"
        ? Number(u.coins ?? 0)
        : kind === "gems"
            ? Number(u.gems ?? 0)
            : Number(u.rewardBalance ?? 0);
    const after = before + amount;
    await userRef.update({
        [field]: firestore_2.FieldValue.increment(amount),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    const moeda = kind === "coins" ? "coins" : kind === "gems" ? "gems" : "rewardBalance";
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
exports.reviewRewardClaim = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    await assertAdmin(uid);
    const claimId = String(request.data?.claimId || "");
    const status = String(request.data?.status || "");
    if (!claimId || !["aprovado", "recusado"].includes(status)) {
        throw new https_1.HttpsError("invalid-argument", "Parâmetros inválidos.");
    }
    const ref = db.doc(`${COL.rewardClaims}/${claimId}`);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "Pedido inexistente.");
    const c = snap.data();
    if (c.status !== "pendente")
        throw new https_1.HttpsError("failed-precondition", "Já analisado.");
    const userRef = db.doc(`${COL.users}/${c.userId}`);
    const valorN = Number(c.valor);
    const retencao = c.retencaoAplicada === true;
    if (status === "aprovado") {
        await db.runTransaction(async (tx) => {
            const claimSnap = await tx.get(ref);
            if (!claimSnap.exists)
                throw new https_1.HttpsError("not-found", "Pedido inexistente.");
            const cur = claimSnap.data();
            if (cur.status !== "pendente")
                throw new https_1.HttpsError("failed-precondition", "Já analisado.");
            const comRetencao = cur.retencaoAplicada === true;
            if (comRetencao) {
                tx.update(ref, {
                    status: "aprovado",
                    analisadoPor: uid,
                    atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                });
            }
            else {
                const uSnap = await tx.get(userRef);
                const bal = Number(uSnap.data()?.rewardBalance || 0);
                if (bal < valorN)
                    throw new https_1.HttpsError("failed-precondition", "Saldo alterado.");
                tx.update(userRef, {
                    rewardBalance: firestore_2.FieldValue.increment(-valorN),
                    atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                });
                tx.update(ref, {
                    status: "aprovado",
                    analisadoPor: uid,
                    atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
    }
    else {
        await db.runTransaction(async (tx) => {
            const claimSnap = await tx.get(ref);
            if (!claimSnap.exists)
                throw new https_1.HttpsError("not-found", "Pedido inexistente.");
            const cur = claimSnap.data();
            if (cur.status !== "pendente")
                throw new https_1.HttpsError("failed-precondition", "Já analisado.");
            const comRetencao = cur.retencaoAplicada === true;
            if (comRetencao) {
                tx.update(userRef, {
                    rewardBalance: firestore_2.FieldValue.increment(valorN),
                    atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                });
            }
            tx.update(ref, {
                status: "recusado",
                analisadoPor: uid,
                motivoRecusa: String(request.data?.motivo || ""),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
function isAllowedComprovanteUrl(raw) {
    const u = raw.trim();
    if (u.length < 16 || u.length > 2048)
        return false;
    try {
        const parsed = new URL(u);
        if (parsed.protocol === "https:")
            return true;
        const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST?.trim();
        if (!emulatorHost || parsed.protocol !== "http:")
            return false;
        return parsed.host === emulatorHost;
    }
    catch {
        return false;
    }
}
/** Admin: após aprovar, envia URL do comprovante (upload no Storage pelo cliente) e marca como confirmado. */
exports.confirmRewardClaimPix = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    await assertAdmin(uid);
    const claimId = String(request.data?.claimId || "");
    const comprovanteUrl = String(request.data?.comprovanteUrl || "").trim();
    if (!claimId || !comprovanteUrl || !isAllowedComprovanteUrl(comprovanteUrl)) {
        throw new https_1.HttpsError("invalid-argument", "claimId e comprovanteUrl valido do Storage sao obrigatorios.");
    }
    const ref = db.doc(`${COL.rewardClaims}/${claimId}`);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "Pedido inexistente.");
    const c = snap.data();
    if (c.status !== "aprovado") {
        throw new https_1.HttpsError("failed-precondition", "Só é possível confirmar PIX de pedidos aprovados.");
    }
    await ref.update({
        status: "confirmado",
        comprovanteUrl,
        confirmadoPor: uid,
        confirmadoEm: firestore_2.FieldValue.serverTimestamp(),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    return { ok: true };
});
const CONVERT_MAX_UNITS_PER_CALL = 10000;
exports.convertCurrency = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const direction = String(request.data?.direction || "");
    const amount = Math.floor(Number(request.data?.amount));
    if (direction !== "coins_to_gems" && direction !== "gems_to_coins") {
        throw new https_1.HttpsError("invalid-argument", "Direção inválida (use coins_to_gems ou gems_to_coins).");
    }
    if (!Number.isFinite(amount) || amount < 1 || amount > CONVERT_MAX_UNITS_PER_CALL) {
        throw new https_1.HttpsError("invalid-argument", "Quantidade inválida.");
    }
    const economy = await getEconomy();
    const coinsPerGemBuy = economy.conversionCoinsPerGemBuy;
    const coinsPerGemSell = economy.conversionCoinsPerGemSell;
    const userRef = db.doc(`${COL.users}/${uid}`);
    const out = await db.runTransaction(async (tx) => {
        const uSnap = await tx.get(userRef);
        if (!uSnap.exists)
            throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
        const u = uSnap.data();
        if (u.banido)
            throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
        const coins = Number(u.coins ?? 0);
        const gems = Number(u.gems ?? 0);
        if (direction === "coins_to_gems") {
            const cost = amount * coinsPerGemBuy;
            if (!Number.isSafeInteger(cost) || cost < 1) {
                throw new https_1.HttpsError("failed-precondition", "Taxa de conversão inválida.");
            }
            if (coins < cost)
                throw new https_1.HttpsError("failed-precondition", "PR insuficientes.");
            const newCoins = coins - cost;
            const newGems = gems + amount;
            tx.update(userRef, {
                coins: firestore_2.FieldValue.increment(-cost),
                gems: firestore_2.FieldValue.increment(amount),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            return {
                direction: "coins_to_gems",
                cost,
                gemsBought: amount,
                newCoins,
                newGems,
            };
        }
        if (coinsPerGemSell < 1) {
            throw new https_1.HttpsError("failed-precondition", "Conversão de TICKET para PR está desativada (ajuste conversionCoinsPerGemSell na economia).");
        }
        const payout = amount * coinsPerGemSell;
        if (!Number.isSafeInteger(payout) || payout < 1) {
            throw new https_1.HttpsError("failed-precondition", "Taxa de conversão inválida.");
        }
        if (gems < amount)
            throw new https_1.HttpsError("failed-precondition", "Saldo de TICKET insuficiente.");
        const newCoins = coins + payout;
        const newGems = gems - amount;
        tx.update(userRef, {
            coins: firestore_2.FieldValue.increment(payout),
            gems: firestore_2.FieldValue.increment(-amount),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        return {
            direction: "gems_to_coins",
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
    }
    else if (out.direction === "gems_to_coins") {
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
async function assertNoOtherActiveRaffle(exceptId) {
    const q = await db.collection(COL.raffles).where("status", "==", "active").limit(5).get();
    const conflicts = q.docs.filter((d) => (exceptId ? d.id !== exceptId : true));
    if (conflicts.length > 0) {
        throw new https_1.HttpsError("failed-precondition", "Já existe um sorteio ativo. Encerre-o antes de abrir outro.");
    }
}
async function closeRaffleIfDue(raffleId, nowMs) {
    const ref = db.doc(`${COL.raffles}/${raffleId}`);
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            return false;
        const raw = (snap.data() || {});
        const raffle = raffleDocFromFirestore(snap.id, raw);
        if (raffle.status !== "active")
            return false;
        if (!raffle.endsAt || raffle.endsAt.toMillis() > nowMs)
            return false;
        tx.set(ref, {
            status: "closed",
            closedAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        return true;
    });
}
async function drawClosedRaffle(raffleId) {
    const raffleRef = db.doc(`${COL.raffles}/${raffleId}`);
    const purchaseColl = db.collection(COL.rafflePurchases);
    const headerSnap = await raffleRef.get();
    if (!headerSnap.exists)
        return "skipped";
    const header = raffleDocFromFirestore(headerSnap.id, (headerSnap.data() || {}));
    if (header.status !== "closed")
        return "skipped";
    if (header.drawnAt)
        return "skipped";
    const winningNumber = pickWinningNumber(header.releasedCount);
    const arrQ = await purchaseColl
        .where("raffleId", "==", raffleId)
        .where("numbers", "array-contains", winningNumber)
        .limit(1)
        .get();
    let winnerUserId = null;
    let winnerPurchaseId = null;
    let outcome = "no_winner";
    if (!arrQ.empty) {
        const purchaseDoc = arrQ.docs[0];
        const purchase = purchaseDoc.data();
        const candidateUid = String(purchase.userId || "");
        const nums = Array.isArray(purchase.numbers) ? purchase.numbers : [];
        if (candidateUid && nums.includes(winningNumber)) {
            outcome = "winner";
            winnerUserId = candidateUid;
            winnerPurchaseId = purchaseDoc.id;
        }
    }
    else {
        const coverQ = await purchaseColl
            .where("raffleId", "==", raffleId)
            .where("rangeStart", "<=", winningNumber)
            .orderBy("rangeStart", "desc")
            .limit(1)
            .get();
        if (!coverQ.empty) {
            const purchaseDoc = coverQ.docs[0];
            const purchase = purchaseDoc.data();
            const rangeEnd = Math.max(0, Math.floor(Number(purchase.rangeEnd) || 0));
            const candidateUid = String(purchase.userId || "");
            if (rangeEnd >= winningNumber && candidateUid) {
                outcome = "winner";
                winnerUserId = candidateUid;
                winnerPurchaseId = purchaseDoc.id;
            }
        }
    }
    const drawResult = await db.runTransaction(async (tx) => {
        const raffleSnap = await tx.get(raffleRef);
        if (!raffleSnap.exists)
            return { kind: "skip" };
        const raffle = raffleDocFromFirestore(raffleSnap.id, (raffleSnap.data() || {}));
        if (raffle.status !== "closed")
            return { kind: "skip" };
        if (raffle.drawnAt)
            return { kind: "skip" };
        if (outcome === "no_winner") {
            tx.set(raffleRef, {
                status: "no_winner",
                winningNumber,
                winnerUserId: null,
                winnerPurchaseId: null,
                drawnAt: firestore_2.FieldValue.serverTimestamp(),
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
            return { kind: "no_winner" };
        }
        if (!winnerUserId || !winnerPurchaseId) {
            tx.set(raffleRef, {
                status: "no_winner",
                winningNumber,
                winnerUserId: null,
                winnerPurchaseId: null,
                drawnAt: firestore_2.FieldValue.serverTimestamp(),
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
            return { kind: "no_winner" };
        }
        const purchaseRef = db.doc(`${COL.rafflePurchases}/${winnerPurchaseId}`);
        const purchaseSnap = await tx.get(purchaseRef);
        if (!purchaseSnap.exists) {
            tx.set(raffleRef, {
                status: "no_winner",
                winningNumber,
                winnerUserId: null,
                winnerPurchaseId: null,
                drawnAt: firestore_2.FieldValue.serverTimestamp(),
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
            return { kind: "no_winner" };
        }
        const purchase = purchaseSnap.data();
        const purchaseUserId = String(purchase.userId || "");
        const nums = Array.isArray(purchase.numbers) ? purchase.numbers : [];
        let covers = purchase.raffleId === raffleId &&
            purchaseUserId === winnerUserId &&
            nums.length > 0 &&
            nums.includes(winningNumber);
        if (!covers) {
            const rangeStart = Math.max(0, Math.floor(Number(purchase.rangeStart) || 0));
            const rangeEnd = Math.max(0, Math.floor(Number(purchase.rangeEnd) || 0));
            covers =
                purchase.raffleId === raffleId &&
                    purchaseUserId === winnerUserId &&
                    nums.length === 0 &&
                    rangeStart <= winningNumber &&
                    rangeEnd >= winningNumber;
        }
        if (!covers) {
            tx.set(raffleRef, {
                status: "no_winner",
                winningNumber,
                winnerUserId: null,
                winnerPurchaseId: null,
                drawnAt: firestore_2.FieldValue.serverTimestamp(),
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
            return { kind: "no_winner" };
        }
        tx.set(raffleRef, {
            status: "drawn",
            winningNumber,
            winnerUserId,
            winnerPurchaseId,
            drawnAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        return {
            kind: "winner",
            prizeCurrency: raffle.prizeCurrency,
            prizeAmount: raffle.prizeAmount,
            winnerUserId,
        };
    });
    if (drawResult.kind === "skip")
        return "skipped";
    if (drawResult.kind === "no_winner")
        return "no_winner";
    const prizeAmount = Math.max(0, Math.floor(Number(drawResult.prizeAmount) || 0));
    if (prizeAmount <= 0) {
        await raffleRef.set({
            status: "paid",
            paidAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        return "paid";
    }
    const userRef = db.doc(`${COL.users}/${drawResult.winnerUserId}`);
    const payout = await db.runTransaction(async (tx) => {
        const raffleSnap = await tx.get(raffleRef);
        if (!raffleSnap.exists)
            throw new https_1.HttpsError("not-found", "Sorteio não encontrado.");
        const raffle = raffleDocFromFirestore(raffleSnap.id, (raffleSnap.data() || {}));
        if (raffle.status !== "drawn") {
            return { kind: "skip" };
        }
        if (raffle.paidAt) {
            return { kind: "skip" };
        }
        const uSnap = await tx.get(userRef);
        if (!uSnap.exists) {
            tx.set(raffleRef, {
                status: "no_winner",
                winnerUserId: null,
                winnerPurchaseId: null,
                paidAt: firestore_2.FieldValue.serverTimestamp(),
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
            return { kind: "no_user" };
        }
        const u = uSnap.data();
        if (u.banido) {
            tx.set(raffleRef, {
                status: "no_winner",
                winnerUserId: null,
                winnerPurchaseId: null,
                paidAt: firestore_2.FieldValue.serverTimestamp(),
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
            return { kind: "banned" };
        }
        const reward = { amount: prizeAmount, currency: drawResult.prizeCurrency };
        const applied = applyRewardPatch(u, reward);
        tx.set(userRef, {
            ...applied.patch,
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        addWalletTxInTx(tx, {
            id: hashId("raffle_prize", raffleRef.id, drawResult.winnerUserId),
            userId: drawResult.winnerUserId,
            tipo: "sorteio_premio",
            moeda: rewardFieldName(reward.currency),
            valor: reward.amount,
            saldoApos: applied.balanceAfter,
            descricao: `Prêmio do sorteio · ${raffle.title}`,
            referenciaId: raffleRef.id,
        });
        tx.set(raffleRef, {
            status: "paid",
            paidAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        return { kind: "ok" };
    });
    if (payout.kind === "skip")
        return "paid";
    return "paid";
}
async function runRaffleLifecycleTick(nowMs = Date.now()) {
    const activeSnap = await db.collection(COL.raffles).where("status", "==", "active").limit(10).get();
    for (const docSnap of activeSnap.docs) {
        await closeRaffleIfDue(docSnap.id, nowMs);
    }
    const closedSnap = await db.collection(COL.raffles).where("status", "==", "closed").limit(10).get();
    for (const docSnap of closedSnap.docs) {
        await drawClosedRaffle(docSnap.id);
    }
}
exports.getActiveRaffle = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const system = await getRaffleSystemConfig();
    if (!system.enabled) {
        return { ok: true, enabled: false, raffle: null };
    }
    const q = await db.collection(COL.raffles).where("status", "==", "active").limit(1).get();
    if (q.empty) {
        return { ok: true, enabled: true, raffle: null };
    }
    return { ok: true, enabled: true, raffle: raffleViewFromDoc(q.docs[0]) };
});
exports.purchaseRaffleNumbers = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const raffleId = String(request.data?.raffleId || "").trim();
    const quantity = Math.floor(Number(request.data?.quantity));
    const clientRequestId = String(request.data?.clientRequestId || "").trim();
    if (!raffleId || !clientRequestId) {
        throw new https_1.HttpsError("invalid-argument", "raffleId e clientRequestId são obrigatórios.");
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
        throw new https_1.HttpsError("invalid-argument", "Quantidade inválida.");
    }
    const system = await getRaffleSystemConfig();
    if (!system.enabled) {
        throw new https_1.HttpsError("failed-precondition", "Sorteios desativados no momento.");
    }
    const raffleRef = db.doc(`${COL.raffles}/${raffleId}`);
    const purchaseId = hashId("raffle_buy", uid, raffleId, clientRequestId);
    const purchaseRef = db.doc(`${COL.rafflePurchases}/${purchaseId}`);
    const userRef = db.doc(`${COL.users}/${uid}`);
    const existingPurchase = await purchaseRef.get();
    if (existingPurchase.exists) {
        const raffleSnap = await raffleRef.get();
        const raffle = raffleSnap.exists ? raffleViewFromDoc(raffleSnap) : null;
        return {
            ok: true,
            idempotent: true,
            raffle,
            purchase: rafflePurchaseViewFromDoc(existingPurchase),
        };
    }
    const result = await db.runTransaction(async (tx) => {
        const [purchaseSnap, raffleSnap, userSnap] = await Promise.all([
            tx.get(purchaseRef),
            tx.get(raffleRef),
            tx.get(userRef),
        ]);
        if (purchaseSnap.exists) {
            return { kind: "idempotent" };
        }
        if (!raffleSnap.exists)
            throw new https_1.HttpsError("not-found", "Sorteio não encontrado.");
        if (!userSnap.exists)
            throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
        const u = userSnap.data();
        if (u.banido)
            throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
        const raffle = raffleDocFromFirestore(raffleSnap.id, (raffleSnap.data() || {}));
        if (raffle.status !== "active") {
            throw new https_1.HttpsError("failed-precondition", "Este sorteio não está ativo para compras.");
        }
        const nowMs = Date.now();
        if (!isRafflePurchaseWindowOpen(raffle, nowMs)) {
            throw new https_1.HttpsError("failed-precondition", "Fora da janela de compras deste sorteio.");
        }
        if (quantity > raffle.maxPerPurchase) {
            throw new https_1.HttpsError("invalid-argument", `Quantidade acima do limite por compra (${raffle.maxPerPurchase}).`);
        }
        const remainingPool = raffle.allocationMode === "random"
            ? raffle.releasedCount - raffle.soldCount
            : raffle.releasedCount - raffle.nextSequentialNumber;
        if (remainingPool < quantity) {
            throw new https_1.HttpsError("failed-precondition", "Números esgotados para este sorteio.");
        }
        const ticketCost = quantity * raffle.ticketPrice;
        if (!Number.isSafeInteger(ticketCost) || ticketCost < 1) {
            throw new https_1.HttpsError("failed-precondition", "Custo inválido.");
        }
        const gems = Number(u.gems ?? 0);
        if (gems < ticketCost) {
            throw new https_1.HttpsError("failed-precondition", "Saldo de TICKET insuficiente.");
        }
        const newGems = gems - ticketCost;
        tx.set(userRef, {
            gems: firestore_2.FieldValue.increment(-ticketCost),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        addWalletTxInTx(tx, {
            id: hashId("raffle_buy", purchaseId),
            userId: uid,
            tipo: "sorteio_compra",
            moeda: "gems",
            valor: -ticketCost,
            saldoApos: newGems,
            descricao: `Sorteio: compra de ${quantity} número(s) · ${raffle.title}`,
            referenciaId: purchaseId,
        });
        let rangeStart = 0;
        let rangeEnd = 0;
        let numbers;
        if (raffle.allocationMode === "random") {
            const rawRaffle = (raffleSnap.data() || {});
            const buf = readSoldBitsBuffer(rawRaffle.soldBits, raffle.releasedCount);
            const picked = [];
            let attempts = 0;
            const maxAttempts = Math.max(800, quantity * 250);
            while (picked.length < quantity && attempts < maxAttempts) {
                attempts += 1;
                const cand = (0, node_crypto_1.randomInt)(0, raffle.releasedCount - 1);
                if (raffleBitIsSet(buf, cand))
                    continue;
                raffleBitSet(buf, cand);
                picked.push(cand);
            }
            if (picked.length < quantity) {
                throw new https_1.HttpsError("failed-precondition", "Não foi possível sortear números disponíveis. Tente uma quantidade menor.");
            }
            shuffleNumberArrayInPlace(picked);
            numbers = picked;
            rangeStart = Math.min(...picked);
            rangeEnd = Math.max(...picked);
            tx.set(raffleRef, {
                soldBits: buf,
                soldCount: firestore_2.FieldValue.increment(quantity),
                soldTicketsRevenue: firestore_2.FieldValue.increment(ticketCost),
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
            const purchasePayload = {
                raffleId,
                raffleTitle: raffle.title,
                userId: uid,
                quantity,
                ticketCost,
                rangeStart,
                rangeEnd,
                numbers,
                clientRequestId,
                createdAt: firestore_2.Timestamp.now(),
            };
            tx.set(purchaseRef, {
                ...purchasePayload,
                createdAt: firestore_2.FieldValue.serverTimestamp(),
            });
        }
        else {
            const rangeStartSeq = raffle.nextSequentialNumber;
            const rangeEndSeq = rangeStartSeq + quantity - 1;
            const nextPointer = rangeEndSeq + 1;
            rangeStart = rangeStartSeq;
            rangeEnd = rangeEndSeq;
            tx.set(raffleRef, {
                nextSequentialNumber: nextPointer,
                soldCount: firestore_2.FieldValue.increment(quantity),
                soldTicketsRevenue: firestore_2.FieldValue.increment(ticketCost),
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
            const purchasePayload = {
                raffleId,
                raffleTitle: raffle.title,
                userId: uid,
                quantity,
                ticketCost,
                rangeStart,
                rangeEnd,
                clientRequestId,
                createdAt: firestore_2.Timestamp.now(),
            };
            tx.set(purchaseRef, {
                ...purchasePayload,
                createdAt: firestore_2.FieldValue.serverTimestamp(),
            });
        }
        return {
            kind: "created",
            purchase: {
                id: purchaseRef.id,
                raffleId,
                raffleTitle: raffle.title,
                userId: uid,
                quantity,
                ticketCost,
                rangeStart,
                rangeEnd,
                numbers: numbers ?? null,
                clientRequestId,
                createdAtMs: Date.now(),
            },
        };
    });
    if (result.kind === "idempotent") {
        const [raffleSnap, purchaseSnap] = await Promise.all([raffleRef.get(), purchaseRef.get()]);
        return {
            ok: true,
            idempotent: true,
            raffle: raffleSnap.exists ? raffleViewFromDoc(raffleSnap) : null,
            purchase: purchaseSnap.exists ? rafflePurchaseViewFromDoc(purchaseSnap) : null,
        };
    }
    const [raffleSnapAfter, purchaseSnapAfter] = await Promise.all([raffleRef.get(), purchaseRef.get()]);
    return {
        ok: true,
        idempotent: false,
        raffle: raffleSnapAfter.exists ? raffleViewFromDoc(raffleSnapAfter) : null,
        purchase: purchaseSnapAfter.exists ? rafflePurchaseViewFromDoc(purchaseSnapAfter) : result.purchase,
    };
});
exports.listMyRafflePurchases = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const raffleId = String(request.data?.raffleId || "").trim();
    const pageSize = Math.min(50, Math.max(1, Math.floor(Number(request.data?.pageSize) || 20)));
    const cursor = request.data?.cursor;
    const cursorMs = cursor?.createdAtMs != null ? Math.floor(Number(cursor.createdAtMs)) : null;
    const cursorId = cursor?.purchaseId ? String(cursor.purchaseId) : null;
    let q = db
        .collection(COL.rafflePurchases)
        .where("userId", "==", uid)
        .orderBy("createdAt", "desc")
        .orderBy(firestore_2.FieldPath.documentId(), "desc")
        .limit(pageSize + 1);
    if (raffleId) {
        q = db
            .collection(COL.rafflePurchases)
            .where("userId", "==", uid)
            .where("raffleId", "==", raffleId)
            .orderBy("createdAt", "desc")
            .orderBy(firestore_2.FieldPath.documentId(), "desc")
            .limit(pageSize + 1);
    }
    if (cursorMs != null && cursorId) {
        q = q.startAfter(firestore_2.Timestamp.fromMillis(cursorMs), cursorId);
    }
    const snap = await q.get();
    const docs = snap.docs;
    const pageDocs = docs.slice(0, pageSize);
    const hasMore = docs.length > pageSize;
    const last = pageDocs[pageDocs.length - 1];
    const nextCursor = hasMore && last
        ? {
            createdAtMs: rafflePurchaseViewFromDoc(last).createdAtMs ?? 0,
            purchaseId: last.id,
        }
        : null;
    return {
        ok: true,
        items: pageDocs.map((d) => rafflePurchaseViewFromDoc(d)),
        nextCursor,
    };
});
exports.adminCreateOrUpdateRaffle = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const adminUid = request.auth?.uid;
    assertAuthed(adminUid);
    await assertAdmin(adminUid);
    const raffleId = String(request.data?.raffleId || "").trim();
    const title = String(request.data?.title || "").trim();
    const description = request.data?.description == null ? null : String(request.data.description);
    const status = String(request.data?.status || "draft").trim();
    const releasedCount = normalizeRaffleReleasedCount(request.data?.releasedCount);
    const ticketPrice = normalizeRaffleTicketPrice(request.data?.ticketPrice);
    const maxPerPurchase = normalizeRaffleMaxPerPurchase(request.data?.maxPerPurchase);
    const prizeCurrencyRaw = request.data?.prizeCurrency;
    const prizeCurrency = isRewardCurrency(prizeCurrencyRaw) ? prizeCurrencyRaw : "coins";
    const prizeAmount = normalizeRafflePrizeAmount(request.data?.prizeAmount);
    const allocationInput = request.data?.allocationMode;
    const prizeImageUrlUpdate = normalizeOptionalPrizeImageUrlFromRequest(request.data?.prizeImageUrl);
    const startsAtMs = request.data?.startsAtMs != null ? Math.floor(Number(request.data.startsAtMs)) : null;
    const endsAtMs = request.data?.endsAtMs != null ? Math.floor(Number(request.data.endsAtMs)) : null;
    const startsAt = startsAtMs != null && Number.isFinite(startsAtMs) ? firestore_2.Timestamp.fromMillis(startsAtMs) : null;
    const endsAt = endsAtMs != null && Number.isFinite(endsAtMs) ? firestore_2.Timestamp.fromMillis(endsAtMs) : null;
    if (!title) {
        throw new https_1.HttpsError("invalid-argument", "Título obrigatório.");
    }
    if (!["draft", "active"].includes(status)) {
        throw new https_1.HttpsError("invalid-argument", "status deve ser draft ou active.");
    }
    if (startsAt && endsAt && startsAt.toMillis() >= endsAt.toMillis()) {
        throw new https_1.HttpsError("invalid-argument", "Datas inválidas: endsAt deve ser depois de startsAt.");
    }
    const system = await getRaffleSystemConfig();
    const ref = raffleId ? db.doc(`${COL.raffles}/${raffleId}`) : db.collection(COL.raffles).doc();
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const prev = snap.exists ? raffleDocFromFirestore(snap.id, (snap.data() || {})) : null;
        const resolvedAllocation = allocationInput === "sequential"
            ? "sequential"
            : allocationInput === "random"
                ? "random"
                : prev
                    ? prev.allocationMode
                    : "random";
        if (prev) {
            if (!["draft", "active"].includes(prev.status)) {
                throw new https_1.HttpsError("failed-precondition", "Não é possível editar sorteios já encerrados.");
            }
            if (prev.soldCount > releasedCount) {
                throw new https_1.HttpsError("failed-precondition", "releasedCount não pode ser menor que números já vendidos.");
            }
            if (prev.nextSequentialNumber > releasedCount) {
                throw new https_1.HttpsError("failed-precondition", "releasedCount não pode ser menor que números já reservados (sequencial).");
            }
            if (prev.soldCount > 0 && resolvedAllocation !== prev.allocationMode) {
                throw new https_1.HttpsError("failed-precondition", "Não é possível alterar o modo de numeração após existirem vendas.");
            }
        }
        if (status === "active") {
            await assertNoOtherActiveRaffle(prev?.id ?? null);
        }
        const nextSequentialNumber = prev ? Math.min(prev.nextSequentialNumber, releasedCount) : 0;
        const soldCount = prev?.soldCount ?? 0;
        const soldTicketsRevenue = prev?.soldTicketsRevenue ?? 0;
        const payload = {
            title,
            description,
            status,
            releasedCount,
            nextSequentialNumber,
            soldCount,
            soldTicketsRevenue,
            ticketPrice,
            maxPerPurchase,
            prizeCurrency,
            prizeAmount,
            allocationMode: resolvedAllocation,
            startsAt,
            endsAt,
            noWinnerPolicy: "no_payout_close",
            drawTimeZone: system.drawTimeZone,
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        };
        if (prizeImageUrlUpdate !== undefined) {
            payload.prizeImageUrl = prizeImageUrlUpdate;
        }
        if (resolvedAllocation === "random") {
            if (!snap.exists) {
                payload.soldBits = Buffer.alloc(raffleSoldBitsByteLength(releasedCount), 0);
            }
            else if (prev && releasedCount > prev.releasedCount) {
                const rawPrev = (snap.data() || {});
                const oldBuf = readSoldBitsBuffer(rawPrev.soldBits, prev.releasedCount);
                const newLen = raffleSoldBitsByteLength(releasedCount);
                const extended = Buffer.alloc(newLen, 0);
                oldBuf.copy(extended, 0, 0, Math.min(oldBuf.length, newLen));
                payload.soldBits = extended;
            }
        }
        if (!snap.exists) {
            payload.createdAt = firestore_2.FieldValue.serverTimestamp();
            payload.closedAt = null;
            payload.drawnAt = null;
            payload.paidAt = null;
            payload.winningNumber = null;
            payload.winnerUserId = null;
            payload.winnerPurchaseId = null;
        }
        tx.set(ref, payload, { merge: true });
    });
    const after = await ref.get();
    return { ok: true, raffle: after.exists ? raffleViewFromDoc(after) : null };
});
exports.adminCloseRaffle = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const adminUid = request.auth?.uid;
    assertAuthed(adminUid);
    await assertAdmin(adminUid);
    const raffleId = String(request.data?.raffleId || "").trim();
    if (!raffleId)
        throw new https_1.HttpsError("invalid-argument", "raffleId obrigatório.");
    const ref = db.doc(`${COL.raffles}/${raffleId}`);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new https_1.HttpsError("not-found", "Sorteio não encontrado.");
        const raffle = raffleDocFromFirestore(snap.id, (snap.data() || {}));
        if (raffle.status !== "active") {
            throw new https_1.HttpsError("failed-precondition", "Somente sorteios ativos podem ser encerrados manualmente.");
        }
        tx.set(ref, {
            status: "closed",
            closedAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
    const after = await ref.get();
    return { ok: true, raffle: after.exists ? raffleViewFromDoc(after) : null };
});
exports.adminDrawRaffle = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const adminUid = request.auth?.uid;
    assertAuthed(adminUid);
    await assertAdmin(adminUid);
    const raffleId = String(request.data?.raffleId || "").trim();
    if (!raffleId)
        throw new https_1.HttpsError("invalid-argument", "raffleId obrigatório.");
    const ref = db.doc(`${COL.raffles}/${raffleId}`);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new https_1.HttpsError("not-found", "Sorteio não encontrado.");
        const raffle = raffleDocFromFirestore(snap.id, (snap.data() || {}));
        if (raffle.status === "active") {
            tx.set(ref, {
                status: "closed",
                closedAt: firestore_2.FieldValue.serverTimestamp(),
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
    });
    await drawClosedRaffle(raffleId);
    const after = await ref.get();
    return { ok: true, raffle: after.exists ? raffleViewFromDoc(after) : null };
});
exports.processReferralReward = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    await evaluateReferralForUser(uid);
    const referralSnap = await db.doc(`${COL.referrals}/${uid}`).get();
    if (!referralSnap.exists) {
        return { ok: false, reason: "no_referral" };
    }
    const referral = referralSnap.data();
    return {
        ok: true,
        status: String(referral.status || "pending"),
        qualified: referral.referralQualified === true,
        rewarded: referral.referralRewardGiven === true,
    };
});
exports.adminReprocessReferral = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    await assertAdmin(uid);
    const referralId = String(request.data?.referralId || "").trim();
    if (!referralId) {
        throw new https_1.HttpsError("invalid-argument", "referralId obrigatório.");
    }
    const referralRef = db.doc(`${COL.referrals}/${referralId}`);
    const beforeSnap = await referralRef.get();
    if (!beforeSnap.exists) {
        throw new https_1.HttpsError("not-found", "Indicação não encontrada.");
    }
    const referral = beforeSnap.data();
    const invitedUid = String(referral.invitedUserId || "");
    if (!invitedUid) {
        throw new https_1.HttpsError("failed-precondition", "Indicação sem convidado vinculado.");
    }
    await evaluateReferralForUser(invitedUid);
    const afterSnap = await referralRef.get();
    const after = (afterSnap.data() || {});
    return {
        ok: true,
        referralId,
        status: String(after.status || "pending"),
        qualified: after.referralQualified === true,
        rewarded: after.referralRewardGiven === true,
    };
});
exports.adminReviewReferral = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    await assertAdmin(uid);
    const referralId = String(request.data?.referralId || "").trim();
    const action = String(request.data?.action || "").trim();
    if (!referralId || !["block", "mark_valid", "reward"].includes(action)) {
        throw new https_1.HttpsError("invalid-argument", "referralId/action inválidos.");
    }
    const referralConfig = await getReferralConfig();
    const campaign = await getActiveReferralCampaign(referralConfig);
    const referralRef = db.doc(`${COL.referrals}/${referralId}`);
    await db.runTransaction(async (tx) => {
        const referralSnap = await tx.get(referralRef);
        if (!referralSnap.exists)
            throw new https_1.HttpsError("not-found", "Indicação não encontrada.");
        const referral = referralSnap.data();
        const inviterUid = String(referral.inviterUserId || "");
        const invitedUid = String(referral.invitedUserId || "");
        if (!inviterUid || !invitedUid)
            throw new https_1.HttpsError("failed-precondition", "Dados da indicação inválidos.");
        const inviterRef = db.doc(`${COL.users}/${inviterUid}`);
        const invitedRef = db.doc(`${COL.users}/${invitedUid}`);
        const [inviterSnap, invitedSnap] = await Promise.all([tx.get(inviterRef), tx.get(invitedRef)]);
        if (!inviterSnap.exists || !invitedSnap.exists) {
            throw new https_1.HttpsError("failed-precondition", "Usuários da indicação não encontrados.");
        }
        const inviterData = inviterSnap.data();
        const invitedData = invitedSnap.data();
        const status = String(referral.status || "pending");
        if (action === "block") {
            tx.update(referralRef, {
                status: "blocked",
                referralStatus: "blocked",
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
                "fraudFlags.manualReviewRequired": false,
                notes: "Bloqueado manualmente pelo admin.",
            });
            if (status === "pending") {
                tx.update(inviterRef, {
                    referralPendingCount: firestore_2.FieldValue.increment(-1),
                    referralBlockedCount: firestore_2.FieldValue.increment(1),
                    atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                });
                await upsertReferralRankingEntry(tx, inviterUid, String(inviterData.nome || "Jogador"), inviterData.foto ?? null, { pending: -1, blocked: 1 });
            }
            tx.update(invitedRef, { referralStatus: "blocked", atualizadoEm: firestore_2.FieldValue.serverTimestamp() });
            return;
        }
        if (action === "mark_valid" && status === "pending") {
            tx.update(referralRef, {
                status: "valid",
                referralStatus: "valid",
                referralQualified: true,
                qualifiedAt: firestore_2.FieldValue.serverTimestamp(),
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
                notes: "Validado manualmente pelo admin.",
            });
            tx.update(inviterRef, {
                referralPendingCount: firestore_2.FieldValue.increment(-1),
                referralQualifiedCount: firestore_2.FieldValue.increment(1),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            tx.update(invitedRef, { referralStatus: "valid", atualizadoEm: firestore_2.FieldValue.serverTimestamp() });
            await upsertReferralRankingEntry(tx, inviterUid, String(inviterData.nome || "Jogador"), inviterData.foto ?? null, { pending: -1, valid: 1 });
            return;
        }
        if (action === "reward" && status !== "rewarded") {
            const inviterReward = {
                amount: Math.max(0, Number(referral.inviterRewardAmount ??
                    referral.inviterRewardCoins ??
                    campaign?.config.inviterRewardAmount ??
                    referralConfig.defaultInviterRewardAmount ??
                    0)),
                currency: normalizeRewardCurrency(referral.inviterRewardCurrency ?? campaign?.config.inviterRewardCurrency, referralConfig.defaultInviterRewardCurrency),
            };
            const invitedReward = campaign?.config.invitedRewardEnabled ?? referralConfig.invitedRewardEnabled
                ? {
                    amount: Math.max(0, Number(referral.invitedRewardAmount ??
                        referral.invitedRewardCoins ??
                        campaign?.config.invitedRewardAmount ??
                        referralConfig.defaultInvitedRewardAmount ??
                        0)),
                    currency: normalizeRewardCurrency(referral.invitedRewardCurrency ?? campaign?.config.invitedRewardCurrency, referralConfig.defaultInvitedRewardCurrency),
                }
                : { amount: 0, currency: referralConfig.defaultInvitedRewardCurrency };
            const inviterRewardPatch = applyRewardPatch(inviterData, inviterReward);
            const invitedRewardPatch = applyRewardPatch(invitedData, invitedReward);
            tx.update(referralRef, {
                status: "rewarded",
                referralStatus: "rewarded",
                referralQualified: true,
                referralRewardGiven: true,
                qualifiedAt: referral.qualifiedAt ?? firestore_2.FieldValue.serverTimestamp(),
                rewardedAt: firestore_2.FieldValue.serverTimestamp(),
                inviterRewardAmount: inviterReward.amount,
                inviterRewardCurrency: inviterReward.currency,
                invitedRewardAmount: invitedReward.amount,
                invitedRewardCurrency: invitedReward.currency,
                inviterRewardCoins: inviterReward.currency === "coins" ? inviterReward.amount : 0,
                invitedRewardCoins: invitedReward.currency === "coins" ? invitedReward.amount : 0,
                inviterRewardGrantedAt: firestore_2.FieldValue.serverTimestamp(),
                invitedRewardGrantedAt: invitedReward.amount > 0 ? firestore_2.FieldValue.serverTimestamp() : null,
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
                notes: "Recompensa concedida manualmente pelo admin.",
            });
            tx.update(inviterRef, {
                ...inviterRewardPatch.patch,
                referralPendingCount: firestore_2.FieldValue.increment(status === "pending" ? -1 : 0),
                referralQualifiedCount: firestore_2.FieldValue.increment(status === "pending" ? 1 : 0),
                referralRewardedCount: firestore_2.FieldValue.increment(1),
                referralInvitedCount: firestore_2.FieldValue.increment(1),
                ...(inviterReward.currency === "coins"
                    ? { referralTotalEarnedCoins: firestore_2.FieldValue.increment(inviterReward.amount) }
                    : inviterReward.currency === "gems"
                        ? { referralTotalEarnedGems: firestore_2.FieldValue.increment(inviterReward.amount) }
                        : { referralTotalEarnedRewardBalance: firestore_2.FieldValue.increment(inviterReward.amount) }),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            tx.update(invitedRef, {
                ...invitedRewardPatch.patch,
                referralBonusGranted: true,
                referralStatus: "rewarded",
                ...(invitedReward.currency === "coins"
                    ? { referralInvitedRewardCoins: firestore_2.FieldValue.increment(invitedReward.amount) }
                    : invitedReward.currency === "gems"
                        ? { referralInvitedRewardGems: firestore_2.FieldValue.increment(invitedReward.amount) }
                        : { referralInvitedRewardBalance: firestore_2.FieldValue.increment(invitedReward.amount) }),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
            await upsertReferralRankingEntry(tx, inviterUid, String(inviterData.nome || "Jogador"), inviterData.foto ?? null, {
                pending: status === "pending" ? -1 : 0,
                valid: status === "pending" ? 1 : 0,
                rewarded: 1,
                rewards: inviterReward.amount,
            });
        }
    });
    return { ok: true };
});
function waitingColl(gameId) {
    return db.collection(`${COL.matchmakingQueue}/${gameId}/waiting`);
}
function slotRef(uid) {
    return db.doc(`${COL.multiplayerSlots}/${uid}`);
}
/** Fila automática 1v1: entra na fila e tenta emparelhar com o jogador mais antigo. */
exports.joinAutoMatch = (0, https_1.onCall)(MULTIPLAYER_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const gameId = request.data?.gameId;
    if (!gameId || !AUTO_QUEUE_GAMES.has(gameId)) {
        throw new https_1.HttpsError("invalid-argument", "Jogo não suporta fila automática.");
    }
    const userRef = db.doc(`${COL.users}/${uid}`);
    let uSnap = await userRef.get();
    if (!uSnap.exists)
        throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
    let u = uSnap.data();
    if (u.banido)
        throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
    if (gameId === "ppt") {
        await tryApplyPptTimedRefillForUser(uid);
        uSnap = await userRef.get();
        u = uSnap.data();
    }
    if (gameId === "quiz") {
        await tryApplyQuizTimedRefillForUser(uid);
        uSnap = await userRef.get();
        u = uSnap.data();
    }
    if (gameId === "reaction_tap") {
        await tryApplyReactionTimedRefillForUser(uid);
        uSnap = await userRef.get();
        u = uSnap.data();
    }
    if (gameId === "ppt") {
        const charges = readPptDuelCharges(u);
        if (charges < 1) {
            throw new https_1.HttpsError("resource-exhausted", "Sem duelos PvP. Assista a um anúncio (+3) ou aguarde 10 minutos para recuperar 3 duelos.");
        }
    }
    if (gameId === "quiz") {
        const charges = readQuizDuelCharges(u);
        if (charges < 1) {
            throw new https_1.HttpsError("resource-exhausted", "Sem duelos PvP de Quiz. Assista a um anúncio (+3) ou aguarde 10 minutos para recuperar 3 duelos.");
        }
    }
    if (gameId === "reaction_tap") {
        const charges = readReactionDuelCharges(u);
        if (charges < 1) {
            throw new https_1.HttpsError("resource-exhausted", "Sem duelos PvP de Reaction Tap. Assista a um anúncio (+3) ou aguarde 10 minutos para recuperar 3 duelos.");
        }
    }
    const nome = String(u.nome || "Jogador");
    const foto = u.foto ?? null;
    const coll = waitingColl(gameId);
    const mySlot = slotRef(uid);
    const existingSlot = await mySlot.get();
    const slotData = existingSlot.data();
    if (slotData?.roomId && slotData.queueStatus === "matched") {
        const roomSnap = await db.doc(`${COL.gameRooms}/${slotData.roomId}`).get();
        if (roomSnap.exists) {
            const r = roomSnap.data();
            const slotGame = slotData.gameId;
            const roomGame = r.gameId;
            const sameGameAsRequest = roomGame === gameId && (slotGame === gameId || slotGame === undefined || slotGame === roomGame);
            /** Sala já encerrada mas slot antigo — não reabrir; permite nova fila e novo débito de duelo. */
            const roomClearlyEnded = r.status === "completed" ||
                r.phase === "completed" ||
                Boolean(r.pptRewardsApplied);
            const roomActive = !roomClearlyEnded && (r.status === "matched" || r.status === "playing");
            const isParticipant = r.hostUid === uid || r.guestUid === uid;
            if (roomActive && sameGameAsRequest && isParticipant) {
                return {
                    status: "matched",
                    roomId: slotData.roomId,
                    hostUid: r.hostUid,
                    guestUid: r.guestUid,
                    yourSeat: r.hostUid === uid ? 0 : 1,
                };
            }
        }
        // Outro jogo, sala encerrada/inexistente, ou você não participa — libera para fila do jogo pedido.
        await mySlot.set({
            uid,
            gameId,
            queueStatus: "idle",
            roomId: null,
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    await mySlot.set({
        uid,
        gameId,
        queueStatus: "waiting",
        roomId: null,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    const waitRef = coll.doc(uid);
    const waitSnap = await waitRef.get();
    if (!waitSnap.exists) {
        await waitRef.set({
            uid,
            nome,
            foto,
            joinedAt: firestore_2.FieldValue.serverTimestamp(),
        });
    }
    const snap = await coll.orderBy("joinedAt", "asc").limit(2).get();
    const others = snap.docs.filter((d) => d.id !== uid);
    const partnerDoc = others[0];
    if (!partnerDoc) {
        return { status: "waiting" };
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
            const ja = selfSnap.data().joinedAt;
            const jb = pSnap.data().joinedAt;
            const host = ja.toMillis() <= jb.toMillis() ? uid : partnerId;
            const guest = host === uid ? partnerId : uid;
            const hostData = host === uid ? selfSnap.data() : pSnap.data();
            const guestData = host === uid ? pSnap.data() : selfSnap.data();
            const hostUserRef = db.doc(`${COL.users}/${host}`);
            const guestUserRef = db.doc(`${COL.users}/${guest}`);
            const [hostUSnap, guestUSnap] = await Promise.all([
                tx.get(hostUserRef),
                tx.get(guestUserRef),
            ]);
            if (!hostUSnap.exists || !guestUSnap.exists) {
                return null;
            }
            const hu = hostUSnap.data();
            const gu = guestUSnap.data();
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
                    tx.set(slotRef(host), {
                        uid: host,
                        gameId,
                        queueStatus: "idle",
                        roomId: null,
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    }, { merge: true });
                }
                if (pptGuestC < 1) {
                    tx.delete(coll.doc(guest));
                    tx.set(slotRef(guest), {
                        uid: guest,
                        gameId,
                        queueStatus: "idle",
                        roomId: null,
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    }, { merge: true });
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
                    tx.set(slotRef(host), {
                        uid: host,
                        gameId,
                        queueStatus: "idle",
                        roomId: null,
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    }, { merge: true });
                }
                if (reactionGuestC < 1) {
                    tx.delete(coll.doc(guest));
                    tx.set(slotRef(guest), {
                        uid: guest,
                        gameId,
                        queueStatus: "idle",
                        roomId: null,
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    }, { merge: true });
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
                    tx.set(slotRef(host), {
                        uid: host,
                        gameId,
                        queueStatus: "idle",
                        roomId: null,
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    }, { merge: true });
                }
                if (quizGuestC < 1) {
                    tx.delete(coll.doc(guest));
                    tx.set(slotRef(guest), {
                        uid: guest,
                        gameId,
                        queueStatus: "idle",
                        roomId: null,
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    }, { merge: true });
                }
                if (quizHostC < 1 || quizGuestC < 1) {
                    return null;
                }
            }
            tx.delete(selfW);
            tx.delete(pW);
            const initialQuizQuestion = gameId === "quiz" ? await (0, quizQuestions_1.pickQuizQuestion)() : null;
            const reactionGoLiveAt = gameId === "reaction_tap" ? nextReactionGoLiveAt() : null;
            const initialActionDeadlineAt = gameId === "reaction_tap" && reactionGoLiveAt
                ? pvpActionDeadlineTs(reactionGoLiveAt.toMillis(), reactionMatchWinMs)
                : pvpActionDeadlineTs(Date.now(), gameId === "ppt" ? pptMatchWinMs : gameId === "quiz" ? quizMatchWinMs : reactionMatchWinMs);
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
                        pptRoundStartedAt: firestore_2.FieldValue.serverTimestamp(),
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
                criadoEm: firestore_2.FieldValue.serverTimestamp(),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            tx.set(slotRef(host), {
                uid: host,
                gameId,
                queueStatus: "matched",
                roomId: roomRef.id,
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            tx.set(slotRef(guest), {
                uid: guest,
                gameId,
                queueStatus: "matched",
                roomId: roomRef.id,
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            if (gameId === "ppt") {
                const refillAt = firestore_2.Timestamp.fromMillis(Date.now() + PPT_DUEL_TIME_REFILL_MS);
                /** Valor explícito: `increment(-1)` com campo ausente no Firestore parte de 0 → -1 e quebra a leitura. */
                const nextHost = pptHostC - 1;
                const nextGuest = pptGuestC - 1;
                if (pptHostC === 1) {
                    tx.update(hostUserRef, {
                        pptPvPDuelsRemaining: nextHost,
                        pptPvpDuelsRefillAvailableAt: refillAt,
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
                else {
                    tx.update(hostUserRef, {
                        pptPvPDuelsRemaining: nextHost,
                        pptPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
                if (pptGuestC === 1) {
                    tx.update(guestUserRef, {
                        pptPvPDuelsRemaining: nextGuest,
                        pptPvpDuelsRefillAvailableAt: refillAt,
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
                else {
                    tx.update(guestUserRef, {
                        pptPvPDuelsRemaining: nextGuest,
                        pptPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
            }
            if (gameId === "quiz") {
                const refillAt = firestore_2.Timestamp.fromMillis(Date.now() + QUIZ_DUEL_TIME_REFILL_MS);
                const nextHost = quizHostC - 1;
                const nextGuest = quizGuestC - 1;
                if (quizHostC === 1) {
                    tx.update(hostUserRef, {
                        quizPvPDuelsRemaining: nextHost,
                        quizPvpDuelsRefillAvailableAt: refillAt,
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
                else {
                    tx.update(hostUserRef, {
                        quizPvPDuelsRemaining: nextHost,
                        quizPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
                if (quizGuestC === 1) {
                    tx.update(guestUserRef, {
                        quizPvPDuelsRemaining: nextGuest,
                        quizPvpDuelsRefillAvailableAt: refillAt,
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
                else {
                    tx.update(guestUserRef, {
                        quizPvPDuelsRemaining: nextGuest,
                        quizPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
            }
            if (gameId === "reaction_tap") {
                const refillAt = firestore_2.Timestamp.fromMillis(Date.now() + REACTION_DUEL_TIME_REFILL_MS);
                const nextHost = reactionHostC - 1;
                const nextGuest = reactionGuestC - 1;
                if (reactionHostC === 1) {
                    tx.update(hostUserRef, {
                        reactionPvPDuelsRemaining: nextHost,
                        reactionPvpDuelsRefillAvailableAt: refillAt,
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
                else {
                    tx.update(hostUserRef, {
                        reactionPvPDuelsRemaining: nextHost,
                        reactionPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
                if (reactionGuestC === 1) {
                    tx.update(guestUserRef, {
                        reactionPvPDuelsRemaining: nextGuest,
                        reactionPvpDuelsRefillAvailableAt: refillAt,
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
                else {
                    tx.update(guestUserRef, {
                        reactionPvPDuelsRemaining: nextGuest,
                        reactionPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
            }
            return { host, guest };
        });
        if (!result) {
            return { status: "waiting" };
        }
        return {
            status: "matched",
            roomId: roomRef.id,
            hostUid: result.host,
            guestUid: result.guest,
            yourSeat: uid === result.host ? 0 : 1,
        };
    }
    catch {
        return { status: "waiting" };
    }
});
/** Agenda ou aplica recuperação de duelos por tempo (10 min); não entra na fila. */
exports.pptSyncDuelRefill = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (req) => {
    const uid = req.auth?.uid;
    assertAuthed(uid);
    await tryApplyPptTimedRefillForUser(uid);
    return { ok: true };
});
/** Agenda ou aplica recuperação de duelos Quiz por tempo (10 min); não entra na fila. */
exports.quizSyncDuelRefill = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (req) => {
    const uid = req.auth?.uid;
    assertAuthed(uid);
    await tryApplyQuizTimedRefillForUser(uid);
    return { ok: true };
});
/** Agenda ou aplica recuperação de duelos Reaction Tap por tempo (10 min); não entra na fila. */
exports.reactionSyncDuelRefill = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (req) => {
    const uid = req.auth?.uid;
    assertAuthed(uid);
    await tryApplyReactionTimedRefillForUser(uid);
    return { ok: true };
});
exports.leaveAutoMatch = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const gameId = request.data?.gameId;
    if (!gameId || !AUTO_QUEUE_GAMES.has(gameId)) {
        throw new https_1.HttpsError("invalid-argument", "Jogo inválido.");
    }
    const s = await slotRef(uid).get();
    const st = s.data()?.queueStatus;
    if (st === "matched") {
        throw new https_1.HttpsError("failed-precondition", "Você já foi pareado. Abra a sala ou aguarde o fim da partida.");
    }
    await waitingColl(gameId).doc(uid).delete().catch(() => undefined);
    await slotRef(uid).set({
        uid,
        gameId,
        queueStatus: "idle",
        roomId: null,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true };
});
/**
 * PPT 1v1 na sala: melhor de N pontos (`PPT_MATCH_TARGET_POINTS`); empate não encerra.
 * Economia / ranking / matches só ao término da partida.
 */
exports.submitPptPick = (0, https_1.onCall)(MULTIPLAYER_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const roomId = String(request.data?.roomId || "").trim();
    const hand = String(request.data?.hand || "").toLowerCase();
    const allowed = new Set(["pedra", "papel", "tesoura"]);
    if (!roomId || !allowed.has(hand)) {
        throw new https_1.HttpsError("invalid-argument", "roomId ou jogada inválidos.");
    }
    const roomRef = db.doc(`${COL.gameRooms}/${roomId}`);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists)
        throw new https_1.HttpsError("not-found", "Sala inexistente.");
    const room = roomSnap.data();
    if (room.gameId !== "ppt") {
        throw new https_1.HttpsError("failed-precondition", "Esta sala não é PPT.");
    }
    if (uid !== room.hostUid && uid !== room.guestUid) {
        throw new https_1.HttpsError("permission-denied", "Você não está nesta sala.");
    }
    if (room.pptRewardsApplied || room.phase === "completed") {
        throw new https_1.HttpsError("failed-precondition", "Partida já finalizada.");
    }
    const picksColl = roomRef.collection("ppt_picks");
    const hostPre = String(room.hostUid);
    const guestPre = String(room.guestUid);
    const [preH, preG] = await Promise.all([
        db.doc(`${COL.users}/${hostPre}`).get(),
        db.doc(`${COL.users}/${guestPre}`).get(),
    ]);
    if (!preH.exists || !preG.exists) {
        throw new https_1.HttpsError("failed-precondition", "Perfil ausente.");
    }
    if (preH.data().banido || preG.data().banido) {
        throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
    }
    const econPpt = await getEconomy();
    const pptPickWindowMs = pvpChoiceWindowMs(econPpt.pvpChoiceSeconds, "ppt");
    /**
     * Uma única transação: grava a jogada do caller e, se o oponente já tiver jogado, resolve a rodada.
     * Evita corrida entre dois submits quase simultâneos (pick órfão + "já escolheu" para sempre).
     */
    const pptTxResult = await db.runTransaction(async (tx) => {
        const rSnap = await tx.get(roomRef);
        const r = rSnap.data();
        if (!rSnap.exists || r.pptRewardsApplied || r.phase === "completed")
            return false;
        if (r.gameId !== "ppt")
            return false;
        if (millisFromFirestoreTime(r.actionDeadlineAt) > 0 && Date.now() > millisFromFirestoreTime(r.actionDeadlineAt)) {
            throw new https_1.HttpsError("failed-precondition", "Tempo da rodada esgotado.");
        }
        const hostUid = String(r.hostUid);
        const guestUid = String(r.guestUid);
        if (uid !== hostUid && uid !== guestUid)
            return false;
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
        if (!hUSnap.exists || !gUSnap.exists)
            return false;
        const hu = hUSnap.data();
        const gu = gUSnap.data();
        if (hu.banido || gu.banido)
            return false;
        const myPref = uid === hostUid ? hPref : gPref;
        const pickedUids = new Set(r.pptPickedUids ?? []);
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
            throw new https_1.HttpsError("already-exists", "Você já escolheu nesta rodada.");
        }
        if (!otherSnapExists) {
            tx.set(myPref, {
                hand,
                criadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            tx.update(roomRef, {
                phase: "ppt_waiting",
                status: "playing",
                pptPickedUids: firestore_2.FieldValue.arrayUnion(uid),
                pptAwaitingBothPicks: false,
                pptConsecutiveEmptyRounds: 0,
                timeoutEmptyRounds: 0,
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
        return { status: "queued" };
    }
    if (pptTxResult === false) {
        const rs = await roomRef.get();
        const rd = rs.data();
        if (rd?.pptRewardsApplied && rd.pptMatchWinner) {
            return {
                status: "completed",
                matchWinner: rd.pptMatchWinner,
                hostScore: Number(rd.pptHostScore ?? 0),
                guestScore: Number(rd.pptGuestScore ?? 0),
                lastRoundOutcome: rd.pptLastRoundOutcome,
                hostHand: rd.pptLastHostHand,
                guestHand: rd.pptLastGuestHand,
            };
        }
        return { status: "queued" };
    }
    if (pptTxResult === "round") {
        const rs = await roomRef.get();
        const rd = rs.data();
        return {
            status: "round",
            roundOutcome: String(rd.pptLastRoundOutcome ?? ""),
            hostHand: String(rd.pptLastHostHand ?? ""),
            guestHand: String(rd.pptLastGuestHand ?? ""),
            hostScore: Number(rd.pptHostScore ?? 0),
            guestScore: Number(rd.pptGuestScore ?? 0),
        };
    }
    const finalSnap = await roomRef.get();
    const fd = finalSnap.data();
    if (!finalSnap.exists || !fd?.pptMatchWinner) {
        return { status: "queued" };
    }
    const hostUid = String(fd.hostUid ?? room.hostUid);
    const guestUid = String(fd.guestUid ?? room.guestUid);
    const matchWinner = fd.pptMatchWinner;
    const hostRes = matchWinner === "host" ? "vitoria" : "derrota";
    const guestRes = matchWinner === "guest" ? "vitoria" : "derrota";
    const lastOut = fd.pptLastRoundOutcome;
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
    const ecoH = (0, gameEconomy_1.resolveMatchEconomy)("ppt", hostRes, 0, metaBase, economyConfig.matchRewardOverrides);
    const ecoG = (0, gameEconomy_1.resolveMatchEconomy)("ppt", guestRes, 0, metaBase, economyConfig.matchRewardOverrides);
    const [hSnap, gSnap] = await Promise.all([
        db.doc(`${COL.users}/${hostUid}`).get(),
        db.doc(`${COL.users}/${guestUid}`).get(),
    ]);
    await upsertRanking({
        uid: hostUid,
        nome: String(hSnap.data()?.nome || "Jogador"),
        username: String(hSnap.data()?.username || "") || null,
        foto: hSnap.data()?.foto ?? null,
        deltaScore: ecoH.rankingPoints,
        win: hostRes === "vitoria",
        gameId: "ppt",
    });
    await upsertRanking({
        uid: guestUid,
        nome: String(gSnap.data()?.nome || "Jogador"),
        username: String(gSnap.data()?.username || "") || null,
        foto: gSnap.data()?.foto ?? null,
        deltaScore: ecoG.rankingPoints,
        win: guestRes === "vitoria",
        gameId: "ppt",
    });
    await bumpPlayMatchMissions(hostUid);
    await bumpPlayMatchMissions(guestUid);
    await Promise.all([evaluateReferralForUser(hostUid), evaluateReferralForUser(guestUid)]);
    await grantPvpVictoryChestAndSyncRoom({ roomId, hostUid, guestUid, matchWinner });
    return {
        status: "completed",
        matchWinner,
        hostScore: Number(fd.pptHostScore ?? 0),
        guestScore: Number(fd.pptGuestScore ?? 0),
        lastRoundOutcome: fd.pptLastRoundOutcome,
        hostHand: fd.pptLastHostHand,
        guestHand: fd.pptLastGuestHand,
    };
});
exports.submitQuizAnswer = (0, https_1.onCall)(MULTIPLAYER_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const roomId = String(request.data?.roomId || "").trim();
    const answerIndex = Number(request.data?.answerIndex);
    const responseTimeMs = clampQuizResponseMs(request.data?.responseTimeMs);
    if (!roomId || !Number.isInteger(answerIndex) || answerIndex < 0) {
        throw new https_1.HttpsError("invalid-argument", "roomId ou resposta inválidos.");
    }
    const roomRef = db.doc(`${COL.gameRooms}/${roomId}`);
    const answersColl = roomRef.collection("quiz_answers");
    const econQuizSubmit = await getEconomy();
    const quizSubmitWindowMs = pvpChoiceWindowMs(econQuizSubmit.pvpChoiceSeconds, "quiz");
    const result = await db.runTransaction(async (tx) => {
        const roomSnap = await tx.get(roomRef);
        if (!roomSnap.exists) {
            throw new https_1.HttpsError("not-found", "Sala inexistente.");
        }
        const room = roomSnap.data();
        if (String(room.gameId) !== "quiz") {
            throw new https_1.HttpsError("failed-precondition", "Esta sala não é Quiz.");
        }
        if (uid !== room.hostUid && uid !== room.guestUid) {
            throw new https_1.HttpsError("permission-denied", "Você não está nesta sala.");
        }
        if (room.quizRewardsApplied === true || room.phase === "completed" || room.status === "completed") {
            throw new https_1.HttpsError("failed-precondition", "Partida já finalizada.");
        }
        if (millisFromFirestoreTime(room.actionDeadlineAt) > 0 &&
            Date.now() > millisFromFirestoreTime(room.actionDeadlineAt)) {
            throw new https_1.HttpsError("failed-precondition", "Tempo da pergunta esgotado.");
        }
        const questionId = String(room.quizQuestionId ?? "");
        const question = await (0, quizQuestions_1.getQuizQuestionById)(questionId);
        if (!question) {
            throw new https_1.HttpsError("failed-precondition", "Questão da sala inválida.");
        }
        if (answerIndex >= question.options.length) {
            throw new https_1.HttpsError("invalid-argument", "Opção inválida para esta questão.");
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
            throw new https_1.HttpsError("failed-precondition", "Você já respondeu esta questão.");
        }
        const answered = new Set(Array.isArray(room.quizAnsweredUids)
            ? room.quizAnsweredUids.map((x) => String(x))
            : []);
        answered.add(uid);
        if (!otherAnswerSnap.exists) {
            tx.set(myAnswerRef, {
                uid,
                answerIndex,
                responseTimeMs,
                createdAt: firestore_2.FieldValue.serverTimestamp(),
            });
            tx.update(roomRef, {
                quizAnsweredUids: Array.from(answered),
                timeoutEmptyRounds: 0,
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            return { status: "queued" };
        }
        const otherAnswer = otherAnswerSnap.data();
        const hostAnswerIndex = uid === hostUid ? answerIndex : Number(otherAnswer.answerIndex ?? -1);
        const guestAnswerIndex = uid === guestUid ? answerIndex : Number(otherAnswer.answerIndex ?? -1);
        const hostResponse = uid === hostUid ? responseTimeMs : clampQuizResponseMs(otherAnswer.responseTimeMs);
        const guestResponse = uid === guestUid ? responseTimeMs : clampQuizResponseMs(otherAnswer.responseTimeMs);
        const hostCorrect = hostAnswerIndex === question.correctIndex;
        const guestCorrect = guestAnswerIndex === question.correctIndex;
        const roundWinner = resolveQuizRoundWinner(hostCorrect, guestCorrect, hostResponse, guestResponse);
        const nextHostScore = Number(room.quizHostScore ?? 0) + (roundWinner === "host" ? 1 : 0);
        const nextGuestScore = Number(room.quizGuestScore ?? 0) + (roundWinner === "guest" ? 1 : 0);
        const target = readQuizTargetScore(room);
        if ((roundWinner === "host" && nextHostScore >= target) || (roundWinner === "guest" && nextGuestScore >= target)) {
            const matchWinner = roundWinner;
            const out = await applyQuizMatchCompletionInTransaction(tx, roomRef, roomId, { ...room, quizHostScore: nextHostScore, quizGuestScore: nextGuestScore }, matchWinner, hostAnswerIndex, guestAnswerIndex, hostCorrect, guestCorrect, hostResponse, guestResponse, question.options, question.correctIndex, question.q);
            return {
                status: "completed",
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
        const nextQuestion = await (0, quizQuestions_1.pickQuizQuestion)(Math.random, questionId);
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
            actionDeadlineAt: pvpActionDeadlineTs(Date.now() + QUIZ_ROUND_REVEAL_MS, quizSubmitWindowMs),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        return {
            status: "round",
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
        await postQuizMatchRankingFromWinner(roomId, result.hostUid, result.guestUid, result.matchWinner, result.hostResponseMs, result.guestResponseMs);
    }
    return result;
});
exports.submitReactionTap = (0, https_1.onCall)(MULTIPLAYER_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const roomId = String(request.data?.roomId || "").trim();
    if (!roomId) {
        throw new https_1.HttpsError("invalid-argument", "roomId obrigatório.");
    }
    const roomRef = db.doc(`${COL.gameRooms}/${roomId}`);
    const resultsColl = roomRef.collection("reaction_results");
    const econReactionSubmit = await getEconomy();
    const reactionSubmitWindowMs = pvpChoiceWindowMs(econReactionSubmit.pvpChoiceSeconds, "reaction_tap");
    const result = await db.runTransaction(async (tx) => {
        const roomSnap = await tx.get(roomRef);
        if (!roomSnap.exists) {
            throw new https_1.HttpsError("not-found", "Sala inexistente.");
        }
        const room = roomSnap.data();
        if (String(room.gameId) !== "reaction_tap") {
            throw new https_1.HttpsError("failed-precondition", "Esta sala não é Reaction Tap.");
        }
        if (uid !== room.hostUid && uid !== room.guestUid) {
            throw new https_1.HttpsError("permission-denied", "Você não está nesta sala.");
        }
        if (room.reactionRewardsApplied === true ||
            room.phase === "completed" ||
            room.status === "completed") {
            throw new https_1.HttpsError("failed-precondition", "Partida já finalizada.");
        }
        if (millisFromFirestoreTime(room.actionDeadlineAt) > 0 &&
            Date.now() > millisFromFirestoreTime(room.actionDeadlineAt)) {
            throw new https_1.HttpsError("failed-precondition", "Tempo da rodada esgotado.");
        }
        const goLiveAtMs = millisFromFirestoreTime(room.reactionGoLiveAt);
        if (goLiveAtMs > 0 && Date.now() < goLiveAtMs) {
            throw new https_1.HttpsError("failed-precondition", "Aguardando sinal da rodada.");
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
            throw new https_1.HttpsError("failed-precondition", "Você já reagiu nesta partida.");
        }
        const answered = new Set(Array.isArray(room.reactionAnsweredUids)
            ? room.reactionAnsweredUids.map((x) => String(x))
            : []);
        answered.add(uid);
        if (!otherResultSnap.exists) {
            tx.set(myResultRef, {
                uid,
                reactionMs,
                falseStart,
                createdAt: firestore_2.FieldValue.serverTimestamp(),
            });
            tx.update(roomRef, {
                reactionAnsweredUids: Array.from(answered),
                timeoutEmptyRounds: 0,
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            return { status: "queued" };
        }
        const other = otherResultSnap.data();
        const hostMs = uid === hostUid ? reactionMs : clampReactionResponseMs(other.reactionMs);
        const guestMs = uid === guestUid ? reactionMs : clampReactionResponseMs(other.reactionMs);
        const hostFalseStart = uid === hostUid ? falseStart : other.falseStart === true;
        const guestFalseStart = uid === guestUid ? falseStart : other.falseStart === true;
        const winner = resolveReactionWinner(hostFalseStart, guestFalseStart, hostMs, guestMs);
        const out = await applyReactionMatchCompletionInTransaction(tx, roomRef, roomId, room, hostMs, guestMs, hostFalseStart, guestFalseStart, winner, reactionSubmitWindowMs);
        tx.delete(otherResultRef);
        return out.completed
            ? {
                status: "completed",
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
                status: "round",
                winner,
                hostMs,
                guestMs,
                hostScore: out.hostScore,
                guestScore: out.guestScore,
            };
    });
    if (result.status === "completed") {
        await postReactionTapRanking(roomId, result.hostUid, result.guestUid, result.hostRes, result.guestRes, result.hostMs, result.guestMs);
    }
    return result;
});
/** Desistência explícita ou sair da sala: quem chama perde; oponente vence (PPT/Quiz/Reaction). */
exports.forfeitPvpRoom = (0, https_1.onCall)(MULTIPLAYER_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const roomId = String(request.data?.roomId || "").trim();
    if (!roomId) {
        throw new https_1.HttpsError("invalid-argument", "roomId obrigatório.");
    }
    const roomRef = db.doc(`${COL.gameRooms}/${roomId}`);
    const result = await db.runTransaction(async (tx) => {
        const rs = await tx.get(roomRef);
        if (!rs.exists) {
            throw new https_1.HttpsError("not-found", "Sala inexistente.");
        }
        const r = rs.data();
        if (uid !== r.hostUid && uid !== r.guestUid) {
            throw new https_1.HttpsError("permission-denied", "Você não está nesta sala.");
        }
        const gameId = String(r.gameId);
        if (gameId !== "ppt" && gameId !== "quiz" && gameId !== "reaction_tap") {
            throw new https_1.HttpsError("failed-precondition", "W.O. disponível só em salas PvP.");
        }
        if (r.pptRewardsApplied === true ||
            r.quizRewardsApplied === true ||
            r.reactionRewardsApplied === true ||
            r.phase === "completed" ||
            r.status === "completed") {
            return { applied: false };
        }
        if (gameId === "ppt") {
            const out = await applyPptForfeitInTransaction(tx, roomRef, roomId, r, uid);
            return { applied: true, gameId: "ppt", ...out };
        }
        if (gameId === "quiz") {
            const out = await applyQuizForfeitInTransaction(tx, roomRef, roomId, r, uid);
            return { applied: true, gameId: "quiz", ...out };
        }
        const out = await applyReactionForfeitInTransaction(tx, roomRef, roomId, r, uid);
        return { applied: true, gameId: "reaction_tap", ...out };
    });
    if (result.applied) {
        if (result.gameId === "ppt") {
            await postPptMatchRankingFromWinner(roomId, result.hostUid, result.guestUid, result.matchWinner, { forfeitedByUid: uid });
        }
        else {
            if (result.gameId === "reaction_tap") {
                await postReactionTapRanking(roomId, result.hostUid, result.guestUid, result.hostRes, result.guestRes, result.hostMs, result.guestMs);
                return {
                    ok: true,
                    applied: result.applied,
                    matchWinner: result.applied ? result.winner : null,
                    gameId: result.applied ? result.gameId : null,
                };
            }
            await postQuizMatchRankingFromWinner(roomId, result.hostUid, result.guestUid, result.matchWinner, result.hostResponseMs, result.guestResponseMs);
        }
    }
    return {
        ok: true,
        applied: result.applied,
        matchWinner: result.applied ? ("winner" in result ? result.winner : result.matchWinner) : null,
        gameId: result.applied ? result.gameId : null,
    };
});
async function resolveExpiredPvpRoom(roomRef, roomId, actorUid) {
    const econTimeout = await getEconomy();
    const pptTimeoutMs = pvpChoiceWindowMs(econTimeout.pvpChoiceSeconds, "ppt");
    const quizTimeoutMs = pvpChoiceWindowMs(econTimeout.pvpChoiceSeconds, "quiz");
    const reactionTimeoutMs = pvpChoiceWindowMs(econTimeout.pvpChoiceSeconds, "reaction_tap");
    const result = await db.runTransaction(async (tx) => {
        const rs = await tx.get(roomRef);
        if (!rs.exists) {
            return { kind: "noop" };
        }
        const r = rs.data();
        const gameId = String(r.gameId || "");
        if (actorUid && actorUid !== r.hostUid && actorUid !== r.guestUid) {
            throw new https_1.HttpsError("permission-denied", "Você não está nesta sala.");
        }
        if (r.phase === "completed" ||
            r.status === "completed" ||
            r.status === "cancelled" ||
            r.pptRewardsApplied === true ||
            r.quizRewardsApplied === true ||
            r.reactionRewardsApplied === true) {
            return { kind: "noop" };
        }
        const deadlineMs = millisFromFirestoreTime(r.actionDeadlineAt);
        if (deadlineMs <= 0 || Date.now() < deadlineMs) {
            return { kind: "noop" };
        }
        if (gameId === "ppt") {
            const picksColl = roomRef.collection("ppt_picks");
            const hostUid = String(r.hostUid);
            const guestUid = String(r.guestUid);
            const [hostPickSnap, guestPickSnap] = await Promise.all([
                tx.get(picksColl.doc(hostUid)),
                tx.get(picksColl.doc(guestUid)),
            ]);
            const pickedUids = new Set(r.pptPickedUids ?? []);
            const hostPickValid = hostPickSnap.exists && pickedUids.has(hostUid);
            const guestPickValid = guestPickSnap.exists && pickedUids.has(guestUid);
            if (hostPickSnap.exists && !hostPickValid) {
                tx.delete(picksColl.doc(hostUid));
            }
            if (guestPickSnap.exists && !guestPickValid) {
                tx.delete(picksColl.doc(guestUid));
            }
            if (hostPickValid && guestPickValid) {
                return { kind: "noop" };
            }
            if (!hostPickValid && !guestPickValid) {
                const strikes = Math.max(0, Number(r.pptConsecutiveEmptyRounds ?? 0));
                if (strikes >= 1) {
                    await applyPptVoidBothInactiveInTransaction(tx, roomRef, r);
                    return { kind: "void", gameId };
                }
                tx.update(roomRef, {
                    phase: "ppt_playing",
                    status: "playing",
                    pptPickedUids: [],
                    pptLastRoundOutcome: "draw",
                    pptAwaitingBothPicks: true,
                    pptRoundStartedAt: firestore_2.FieldValue.serverTimestamp(),
                    pptConsecutiveEmptyRounds: strikes + 1,
                    timeoutEmptyRounds: strikes + 1,
                    actionDeadlineAt: pvpActionDeadlineTs(Date.now(), pptTimeoutMs),
                    atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                });
                return { kind: "ppt_round" };
            }
            const hostHand = hostPickValid
                ? String(hostPickSnap.data()?.hand || "")
                : losingHandAgainst(String(guestPickSnap.data()?.hand || "papel"));
            const guestHand = guestPickValid
                ? String(guestPickSnap.data()?.hand || "")
                : losingHandAgainst(String(hostPickSnap.data()?.hand || "pedra"));
            const out = pptOutcomeFromHands(hostHand, guestHand);
            const step = await applyPptRoundResultInTransaction(tx, roomRef, roomId, r, hostHand, guestHand, out, pptTimeoutMs, {
                hostRef: picksColl.doc(hostUid),
                guestRef: picksColl.doc(guestUid),
            });
            if (step === "match") {
                return {
                    kind: "ppt_match",
                    hostUid,
                    guestUid,
                    matchWinner: out === "host_win" ? "host" : "guest",
                };
            }
            return { kind: "ppt_round" };
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
                return { kind: "noop" };
            }
            const questionId = String(r.quizQuestionId ?? "");
            const question = await (0, quizQuestions_1.getQuizQuestionById)(questionId);
            if (!question) {
                return { kind: "noop" };
            }
            if (!hostAnswerSnap.exists && !guestAnswerSnap.exists) {
                const strikes = Math.max(0, Number(r.timeoutEmptyRounds ?? 0));
                if (strikes >= 1) {
                    await applyGenericPvpTimeoutVoidInTransaction(tx, roomRef, r, {
                        quizOutcome: "draw",
                        quizLastRoundWinner: "draw",
                        quizAnsweredUids: [],
                        quizRewardsApplied: true,
                        quizMatchWinner: firestore_2.FieldValue.delete(),
                        timeoutEmptyRounds: 0,
                        quizLastRevealOptions: firestore_2.FieldValue.delete(),
                        quizLastRevealCorrectIndex: firestore_2.FieldValue.delete(),
                        quizLastRevealQuestionText: firestore_2.FieldValue.delete(),
                        quizLastHostAnswerIndex: firestore_2.FieldValue.delete(),
                        quizLastGuestAnswerIndex: firestore_2.FieldValue.delete(),
                        quizLastHostCorrect: firestore_2.FieldValue.delete(),
                        quizLastGuestCorrect: firestore_2.FieldValue.delete(),
                    });
                    return { kind: "void", gameId };
                }
                const nextQuestion = await (0, quizQuestions_1.pickQuizQuestion)(Math.random, questionId);
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
                    atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                });
                return { kind: "quiz_round" };
            }
            const hostAnswer = hostAnswerSnap.data();
            const guestAnswer = guestAnswerSnap.data();
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
            const roundWinner = resolveQuizRoundWinner(hostCorrect, guestCorrect, hostResponse, guestResponse);
            const nextHostScore = Number(r.quizHostScore ?? 0) + (roundWinner === "host" ? 1 : 0);
            const nextGuestScore = Number(r.quizGuestScore ?? 0) + (roundWinner === "guest" ? 1 : 0);
            const target = readQuizTargetScore(r);
            if ((roundWinner === "host" && nextHostScore >= target) || (roundWinner === "guest" && nextGuestScore >= target)) {
                const matchWinner = roundWinner;
                const out = await applyQuizMatchCompletionInTransaction(tx, roomRef, roomId, { ...r, quizHostScore: nextHostScore, quizGuestScore: nextGuestScore }, matchWinner, hostAnswerIndex, guestAnswerIndex, hostCorrect, guestCorrect, hostResponse, guestResponse, question.options, question.correctIndex, question.q);
                tx.delete(answersColl.doc(hostUid));
                tx.delete(answersColl.doc(guestUid));
                return { kind: "quiz_match", ...out, hostResponseMs: hostResponse, guestResponseMs: guestResponse };
            }
            const nextQuestion = await (0, quizQuestions_1.pickQuizQuestion)(Math.random, questionId);
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
                actionDeadlineAt: pvpActionDeadlineTs(Date.now() + QUIZ_ROUND_REVEAL_MS, quizTimeoutMs),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            return { kind: "quiz_round" };
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
                return { kind: "noop" };
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
                        reactionMatchWinner: firestore_2.FieldValue.delete(),
                        timeoutEmptyRounds: 0,
                    });
                    return { kind: "void", gameId };
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
                    atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                });
                return { kind: "reaction_round" };
            }
            const hostResult = hostResultSnap.data();
            const guestResult = guestResultSnap.data();
            const hostMs = hostResultSnap.exists
                ? clampReactionResponseMs(hostResult?.reactionMs)
                : REACTION_RESPONSE_MS_CAP;
            const guestMs = guestResultSnap.exists
                ? clampReactionResponseMs(guestResult?.reactionMs)
                : REACTION_RESPONSE_MS_CAP;
            const hostFalseStart = hostResultSnap.exists && hostResult?.falseStart === true;
            const guestFalseStart = guestResultSnap.exists && guestResult?.falseStart === true;
            const winner = resolveReactionWinner(hostFalseStart, guestFalseStart, hostMs, guestMs);
            const out = await applyReactionMatchCompletionInTransaction(tx, roomRef, roomId, r, hostMs, guestMs, hostFalseStart, guestFalseStart, winner, reactionTimeoutMs);
            tx.delete(resultsColl.doc(hostUid));
            tx.delete(resultsColl.doc(guestUid));
            return out.completed
                ? { kind: "reaction_match", ...out, hostMs, guestMs }
                : { kind: "reaction_round" };
        }
        return { kind: "noop" };
    });
    if (result.kind === "ppt_match") {
        await postPptMatchRankingFromWinner(roomId, result.hostUid, result.guestUid, result.matchWinner);
    }
    else if (result.kind === "quiz_match") {
        await postQuizMatchRankingFromWinner(roomId, result.hostUid, result.guestUid, result.matchWinner, result.hostResponseMs, result.guestResponseMs);
    }
    else if (result.kind === "reaction_match") {
        await postReactionTapRanking(roomId, result.hostUid, result.guestUid, result.hostRes, result.guestRes, result.hostMs, result.guestMs);
    }
    return result;
}
exports.resolvePvpRoomTimeout = (0, https_1.onCall)(MULTIPLAYER_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const roomId = String(request.data?.roomId || "").trim();
    if (!roomId) {
        throw new https_1.HttpsError("invalid-argument", "roomId obrigatório.");
    }
    const roomRef = db.doc(`${COL.gameRooms}/${roomId}`);
    const result = await resolveExpiredPvpRoom(roomRef, roomId, uid);
    return { ok: true, kind: result.kind };
});
/** Ping de presença na partida PPT; se o oponente ficar sem sinal, vitória por W.O. */
exports.pvpPptPresence = (0, https_1.onCall)(MULTIPLAYER_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const roomId = String(request.data?.roomId || "").trim();
    if (!roomId) {
        throw new https_1.HttpsError("invalid-argument", "roomId obrigatório.");
    }
    const roomRef = db.doc(`${COL.gameRooms}/${roomId}`);
    const out = await db.runTransaction(async (tx) => {
        const rs = await tx.get(roomRef);
        if (!rs.exists) {
            return { kind: "noop" };
        }
        const r = rs.data();
        if (String(r.gameId) !== "ppt") {
            return { kind: "noop" };
        }
        if (r.pptRewardsApplied === true || r.phase === "completed" || r.status === "completed") {
            return { kind: "noop" };
        }
        if (uid !== r.hostUid && uid !== r.guestUid) {
            throw new https_1.HttpsError("permission-denied", "Você não está nesta sala.");
        }
        const hostUid = String(r.hostUid);
        const guestUid = String(r.guestUid);
        const isHost = uid === hostUid;
        const nowMs = Date.now();
        const createdMs = millisFromFirestoreTime(r.criadoEm);
        const roomAgeOk = createdMs > 0 && nowMs - createdMs > PVP_PPT_GRACE_AFTER_CREATE_MS;
        const oppField = isHost ? r.pptGuestPresenceAt : r.pptHostPresenceAt;
        const oppMs = millisFromFirestoreTime(oppField);
        const opponentStale = roomAgeOk && oppMs > 0 && nowMs - oppMs > PVP_PPT_HEARTBEAT_STALE_MS;
        if (opponentStale) {
            const loserUid = isHost ? guestUid : hostUid;
            const applied = await applyPptForfeitInTransaction(tx, roomRef, roomId, r, loserUid);
            return { kind: "forfeit", ...applied, loserUid };
        }
        tx.update(roomRef, {
            [isHost ? "pptHostPresenceAt" : "pptGuestPresenceAt"]: firestore_2.FieldValue.serverTimestamp(),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        return { kind: "ping" };
    });
    if (out.kind === "forfeit") {
        await postPptMatchRankingFromWinner(roomId, out.hostUid, out.guestUid, out.matchWinner, { forfeitedByUid: out.loserUid });
    }
    return { ok: true, kind: out.kind };
});
exports.riskAnalysisOnUserEvent = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
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
        timestamp: firestore_2.FieldValue.serverTimestamp(),
    });
    return { ok: true };
});
async function closeRankingScopePayout(period, periodKey, prizeTiers, gameId) {
    const collectionName = rankingCollectionForPeriod(period);
    const rankingRootPath = gameId
        ? `${collectionName}/${periodKey}/games/${gameId}`
        : `${collectionName}/${periodKey}`;
    const rankingRootRef = db.doc(rankingRootPath);
    const payoutFlagRef = gameId
        ? db.doc(`${rankingRootPath}/meta/payout`)
        : db.doc(`${collectionName}/${periodKey}/meta/payout_global`);
    const payoutFlagSnap = await payoutFlagRef.get();
    if (payoutFlagSnap.exists)
        return;
    const maxPos = prizeTiers[prizeTiers.length - 1]?.posicaoMax ?? 0;
    if (maxPos < 1)
        return;
    const entriesPath = gameId
        ? `${rankingRootPath}/entries`
        : `${collectionName}/${periodKey}/entries`;
    const victoryRankedGame = Boolean(gameId && VICTORY_RANKED_GAME_IDS.has(gameId));
    const entriesSnap = victoryRankedGame
        ? await db.collection(entriesPath).get()
        : await db.collection(entriesPath).orderBy("score", "desc").limit(maxPos).get();
    if (entriesSnap.empty) {
        await payoutFlagRef.set({
            period,
            periodKey,
            scope: gameId ? "game" : "global",
            gameId: gameId ?? null,
            gameTitle: gameId ? GAME_TITLES[gameId] : null,
            processedAt: firestore_2.FieldValue.serverTimestamp(),
            winners: 0,
            note: "Sem entradas para premiar.",
        });
        return;
    }
    const winners = (victoryRankedGame
        ? entriesSnap.docs
            .map((docSnap) => {
            const raw = (docSnap.data() || {});
            return {
                uid: docSnap.id,
                entryRef: docSnap.ref,
                vitorias: normalizeCounter(raw.vitorias),
                score: normalizeCounter(raw.score),
                partidas: normalizeCounter(raw.partidas),
                atualizadoEm: raw.atualizadoEm ?? null,
            };
        })
            .sort((a, b) => {
            if (b.vitorias !== a.vitorias)
                return b.vitorias - a.vitorias;
            if (b.score !== a.score)
                return b.score - a.score;
            if (b.partidas !== a.partidas)
                return b.partidas - a.partidas;
            const updatedDiff = millisFromFirestoreTime(b.atualizadoEm) - millisFromFirestoreTime(a.atualizadoEm);
            if (updatedDiff !== 0)
                return updatedDiff;
            return a.uid.localeCompare(b.uid, "pt-BR");
        })
            .slice(0, maxPos)
            .map((entry, index) => ({
            pos: index + 1,
            uid: entry.uid,
            entryRef: entry.entryRef,
            tier: rankingPrizeTierForPosition(prizeTiers, index + 1),
        }))
        : entriesSnap.docs.map((docSnap, index) => ({
            pos: index + 1,
            uid: docSnap.id,
            entryRef: docSnap.ref,
            tier: rankingPrizeTierForPosition(prizeTiers, index + 1),
        })));
    const rewardedWinners = winners.filter((winner) => winner.tier != null && hasRankingPrizeRewards(winner.tier.rewards));
    if (rewardedWinners.length === 0)
        return;
    const userRefs = rewardedWinners.map((winner) => db.doc(`${COL.users}/${winner.uid}`));
    const userSnapshots = userRefs.length ? await db.getAll(...userRefs) : [];
    const userMap = new Map(userSnapshots
        .filter((snap) => snap.exists)
        .map((snap) => [snap.id, snap.data()]));
    const batch = db.batch();
    let grantedCount = 0;
    for (const winner of rewardedWinners) {
        if (!winner.tier)
            continue;
        const userData = userMap.get(winner.uid);
        if (!userData)
            continue;
        const userRef = db.doc(`${COL.users}/${winner.uid}`);
        const rewardPatch = applyMultiCurrencyRewardPatch(userData, winner.tier.rewards);
        if (Object.keys(rewardPatch.patch).length === 0)
            continue;
        batch.set(userRef, {
            ...rewardPatch.patch,
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        for (const currency of ["coins", "gems", "rewardBalance"]) {
            const amount = winner.tier.rewards[currency];
            if (amount <= 0)
                continue;
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
                criadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
        }
        batch.set(winner.entryRef, {
            posicao: winner.pos,
            premioRecebido: winner.tier.rewards,
            premioProcessadoEm: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        grantedCount += 1;
    }
    batch.set(payoutFlagRef, {
        period,
        periodKey,
        scope: gameId ? "game" : "global",
        gameId: gameId ?? null,
        gameTitle: gameId ? GAME_TITLES[gameId] : null,
        processedAt: firestore_2.FieldValue.serverTimestamp(),
        winners: grantedCount,
    });
    batch.set(rankingRootRef, {
        periodoChave: periodKey,
        tipo: period,
        scope: gameId ? "game" : "global",
        gameId: gameId ?? null,
        gameTitle: gameId ? GAME_TITLES[gameId] : null,
        prizeProcessedAt: firestore_2.FieldValue.serverTimestamp(),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();
}
function normalizeClanWeeklySnapshot(periodKey, raw) {
    if (String(raw.scoreWeeklyKey || "") !== periodKey) {
        return { score: 0, wins: 0, ads: 0 };
    }
    return {
        score: normalizeCounter(raw.scoreWeekly),
        wins: normalizeCounter(raw.scoreWeeklyWins),
        ads: normalizeCounter(raw.scoreWeeklyAds),
    };
}
function normalizeClanWeeklyContributorSnapshot(uid, raw) {
    return {
        uid,
        score: normalizeCounter(raw.score),
        wins: normalizeCounter(raw.wins),
        ads: normalizeCounter(raw.ads),
        updatedAt: raw.updatedAt ?? null,
    };
}
function compareClanContributor(a, b) {
    if (b.score !== a.score)
        return b.score - a.score;
    if (b.wins !== a.wins)
        return b.wins - a.wins;
    if (b.ads !== a.ads)
        return b.ads - a.ads;
    const updatedDiff = millisFromFirestoreTime(b.updatedAt) - millisFromFirestoreTime(a.updatedAt);
    if (updatedDiff !== 0)
        return updatedDiff;
    return a.uid.localeCompare(b.uid, "pt-BR");
}
function distributeClanRewardsToContributors(rewards, contributors) {
    const rankedContributors = [...contributors]
        .filter((item) => item.score > 0)
        .sort(compareClanContributor);
    if (rankedContributors.length === 0)
        return [];
    const totalScore = rankedContributors.reduce((sum, item) => sum + item.score, 0);
    if (totalScore <= 0)
        return [];
    const allocations = new Map(rankedContributors.map((item) => [item.uid, emptyRankingPrizeRewards()]));
    for (const currency of ["coins", "gems", "rewardBalance"]) {
        const amount = Math.max(0, Math.floor(Number(rewards[currency]) || 0));
        if (amount <= 0)
            continue;
        let distributed = 0;
        const remainderRows = rankedContributors.map((item, index) => {
            const weightedAmount = amount * item.score;
            const baseShare = Math.floor(weightedAmount / totalScore);
            allocations.get(item.uid)[currency] = baseShare;
            distributed += baseShare;
            return {
                index,
                remainder: weightedAmount % totalScore,
                contributor: item,
            };
        });
        let remaining = amount - distributed;
        if (remaining > 0) {
            remainderRows.sort((a, b) => {
                if (b.remainder !== a.remainder)
                    return b.remainder - a.remainder;
                return compareClanContributor(a.contributor, b.contributor);
            });
            for (let i = 0; i < remaining; i += 1) {
                const target = remainderRows[i % remainderRows.length];
                allocations.get(target.contributor.uid)[currency] += 1;
            }
        }
    }
    return rankedContributors
        .map((contributor) => ({
        contributor,
        rewards: allocations.get(contributor.uid),
    }))
        .filter((item) => hasRankingPrizeRewards(item.rewards));
}
async function closeClanWeeklyRankingPayout(periodKey, prizeTiers) {
    const rankingRootRef = db.doc(`${COL.clanRankingsWeekly}/${periodKey}`);
    const payoutFlagRef = db.doc(`${COL.clanRankingsWeekly}/${periodKey}/meta/payout`);
    const payoutFlagSnap = await payoutFlagRef.get();
    if (payoutFlagSnap.exists)
        return;
    const maxPos = prizeTiers[prizeTiers.length - 1]?.posicaoMax ?? 0;
    if (maxPos < 1)
        return;
    const clansSnap = await db.collection(COL.clans).where("scoreWeeklyKey", "==", periodKey).get();
    if (clansSnap.empty) {
        await payoutFlagRef.set({
            period: "semanal",
            periodKey,
            processedAt: firestore_2.FieldValue.serverTimestamp(),
            winners: 0,
            note: "Sem clãs pontuados para premiar.",
        });
        return;
    }
    const entries = clansSnap.docs
        .map((docSnap) => {
        const raw = (docSnap.data() || {});
        const weekly = normalizeClanWeeklySnapshot(periodKey, raw);
        return {
            clanId: docSnap.id,
            ref: docSnap.ref,
            raw,
            ownerUid: String(raw.ownerUid || "").trim(),
            name: String(raw.name || "Clã"),
            tag: String(raw.tag || "TAG"),
            avatarUrl: typeof raw.avatarUrl === "string" ? raw.avatarUrl : null,
            coverUrl: typeof raw.coverUrl === "string" ? raw.coverUrl : null,
            privacy: raw.privacy === "open" ? "open" : "code_only",
            memberCount: normalizeCounter(raw.memberCount),
            weeklyScore: weekly.score,
            weeklyWins: weekly.wins,
            weeklyAds: weekly.ads,
            lastScoreAt: raw.lastScoreAt ?? null,
            updatedAt: raw.updatedAt ?? null,
        };
    })
        .filter((entry) => entry.weeklyScore > 0)
        .sort((a, b) => {
        if (b.weeklyScore !== a.weeklyScore)
            return b.weeklyScore - a.weeklyScore;
        if (b.weeklyWins !== a.weeklyWins)
            return b.weeklyWins - a.weeklyWins;
        if (b.weeklyAds !== a.weeklyAds)
            return b.weeklyAds - a.weeklyAds;
        if (b.memberCount !== a.memberCount)
            return b.memberCount - a.memberCount;
        const scoreActivityDiff = millisFromFirestoreTime(b.lastScoreAt ?? b.updatedAt) -
            millisFromFirestoreTime(a.lastScoreAt ?? a.updatedAt);
        if (scoreActivityDiff !== 0)
            return scoreActivityDiff;
        return a.name.localeCompare(b.name, "pt-BR");
    })
        .slice(0, maxPos)
        .map((entry, index) => ({
        ...entry,
        pos: index + 1,
        tier: rankingPrizeTierForPosition(prizeTiers, index + 1),
    }));
    let rewardedClans = 0;
    let rewardedContributors = 0;
    let rewardedOwners = 0;
    let ownerFallbackClans = 0;
    for (const entry of entries) {
        const entryRef = db.doc(`${COL.clanRankingsWeekly}/${periodKey}/entries/${entry.clanId}`);
        const contributorsColl = db.collection(`${COL.clanRankingsWeekly}/${periodKey}/clans/${entry.clanId}/contributors`);
        const clanRewards = entry.tier?.rewards ?? emptyRankingPrizeRewards();
        const result = await db.runTransaction(async (tx) => {
            const [entrySnap, contributorsSnap] = await Promise.all([tx.get(entryRef), tx.get(contributorsColl)]);
            if (entrySnap.exists && entrySnap.get("premioProcessadoEm")) {
                const alreadyRewardedContributors = normalizeCounter(entrySnap.get("rewardedContributors"));
                const alreadyRewardedOwners = normalizeCounter(entrySnap.get("rewardedOwners"));
                return {
                    rewardedContributors: alreadyRewardedContributors,
                    rewardedOwners: alreadyRewardedOwners,
                    usedOwnerFallback: String(entrySnap.get("rewardDistributionMode") || "") === "owner_fallback",
                };
            }
            const rankedContributors = contributorsSnap.docs
                .map((docSnap) => normalizeClanWeeklyContributorSnapshot(docSnap.id, (docSnap.data() || {})))
                .filter((contributor) => contributor.score > 0)
                .sort(compareClanContributor);
            let rewardDistributionMode = "contributors_proportional";
            let payoutCandidates = rankedContributors;
            if (payoutCandidates.length === 0 && entry.ownerUid) {
                rewardDistributionMode = "owner_fallback";
                payoutCandidates = [
                    {
                        uid: entry.ownerUid,
                        score: 1,
                        wins: entry.weeklyWins,
                        ads: entry.weeklyAds,
                        updatedAt: entry.lastScoreAt ?? entry.updatedAt,
                    },
                ];
            }
            const userRefs = payoutCandidates.map((contributor) => db.doc(`${COL.users}/${contributor.uid}`));
            const userSnaps = userRefs.length > 0 ? await Promise.all(userRefs.map((ref) => tx.get(ref))) : [];
            const payableContributors = payoutCandidates
                .map((contributor, index) => {
                const userSnap = userSnaps[index];
                if (!userSnap?.exists)
                    return null;
                return {
                    contributor,
                    userRef: userRefs[index],
                    userData: userSnap.data(),
                };
            })
                .filter((row) => row != null);
            const contributorRewardRows = rewardDistributionMode === "owner_fallback"
                ? payableContributors.length > 0 && hasRankingPrizeRewards(clanRewards)
                    ? [{ contributor: payableContributors[0].contributor, rewards: clanRewards }]
                    : []
                : distributeClanRewardsToContributors(clanRewards, payableContributors.map((row) => row.contributor));
            const rewardMap = new Map(contributorRewardRows.map((row) => [row.contributor.uid, row.rewards]));
            const payableContributorMap = new Map(payableContributors.map((row) => [row.contributor.uid, row]));
            for (const contributor of rankedContributors) {
                tx.set(contributorsColl.doc(contributor.uid), {
                    clanPosition: entry.pos,
                    clanRewards,
                    payoutRewards: rewardMap.get(contributor.uid) ?? emptyRankingPrizeRewards(),
                    rewardDistributionMode,
                    payoutProcessedAt: firestore_2.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            let rewardedContributorCount = 0;
            for (const rewardRow of contributorRewardRows) {
                const payableContributor = payableContributorMap.get(rewardRow.contributor.uid);
                if (!payableContributor)
                    continue;
                const rewardPatch = applyMultiCurrencyRewardPatch(payableContributor.userData, rewardRow.rewards);
                if (Object.keys(rewardPatch.patch).length === 0)
                    continue;
                tx.set(payableContributor.userRef, {
                    ...rewardPatch.patch,
                    atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                }, { merge: true });
                for (const currency of ["coins", "gems", "rewardBalance"]) {
                    const amount = rewardRow.rewards[currency];
                    if (amount <= 0)
                        continue;
                    tx.set(db.doc(`${COL.wallet}/${hashId("clan_ranking_contributor", periodKey, entry.clanId, rewardRow.contributor.uid, currency)}`), {
                        userId: rewardRow.contributor.uid,
                        tipo: "ranking",
                        moeda: currency,
                        valor: amount,
                        saldoApos: rewardPatch.balancesAfter[currency],
                        descricao: `Premiação semanal do clã ${entry.name} · rateio por contribuição · ${rewardCurrencyLabel(currency)}`,
                        referenciaId: `cla:semanal:${periodKey}:${entry.clanId}:#${entry.pos}`,
                        criadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
                rewardedContributorCount += 1;
            }
            const rewardedOwnerCount = rewardDistributionMode === "owner_fallback" && rewardedContributorCount > 0 ? 1 : 0;
            tx.set(entryRef, {
                clanId: entry.clanId,
                nome: entry.name,
                tag: entry.tag,
                ownerUid: entry.ownerUid || null,
                avatarUrl: entry.avatarUrl,
                coverUrl: entry.coverUrl,
                privacy: entry.privacy,
                memberCount: entry.memberCount,
                score: entry.weeklyScore,
                wins: entry.weeklyWins,
                ads: entry.weeklyAds,
                posicao: entry.pos,
                rewards: clanRewards,
                premioRecebido: clanRewards,
                premioProcessadoEm: firestore_2.FieldValue.serverTimestamp(),
                rewardDistributionMode,
                contributorsConsidered: rankedContributors.length,
                payableContributors: payableContributors.length,
                rewardedContributors: rewardedContributorCount,
                rewardedOwners: rewardedOwnerCount,
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
            return {
                rewardedContributors: rewardedContributorCount,
                rewardedOwners: rewardedOwnerCount,
                usedOwnerFallback: rewardDistributionMode === "owner_fallback",
            };
        });
        rewardedContributors += result.rewardedContributors;
        rewardedOwners += result.rewardedOwners;
        if (result.usedOwnerFallback)
            ownerFallbackClans += 1;
        if (result.rewardedContributors > 0 || result.rewardedOwners > 0) {
            rewardedClans += 1;
        }
    }
    const batch = db.batch();
    batch.set(payoutFlagRef, {
        period: "semanal",
        periodKey,
        processedAt: firestore_2.FieldValue.serverTimestamp(),
        winners: entries.length,
        rewardedClans,
        rewardedContributors,
        rewardedOwners,
        ownerFallbackClans,
    });
    batch.set(rankingRootRef, {
        period: "semanal",
        periodKey,
        prizeProcessedAt: firestore_2.FieldValue.serverTimestamp(),
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();
}
async function closeRankingJob(period) {
    const economy = await getEconomy();
    const periodKey = rankingKeyForPeriod(period, rankingReferenceDateForClose(period));
    const globalPrizeTiers = rankingPrizeTiersForScope(economy.rankingPrizes, period);
    if (globalPrizeTiers.length > 0) {
        await closeRankingScopePayout(period, periodKey, globalPrizeTiers);
    }
    for (const gameId of RANKING_GAME_IDS) {
        const gamePrizeTiers = rankingPrizeTiersForScope(economy.rankingPrizes, period, gameId);
        if (gamePrizeTiers.length === 0)
            continue;
        await closeRankingScopePayout(period, periodKey, gamePrizeTiers, gameId);
    }
    if (period === "semanal") {
        const clanPrizeTiers = clanRankingPrizeTiersForPeriod(economy.rankingPrizes, period);
        if (clanPrizeTiers.length > 0) {
            await closeClanWeeklyRankingPayout(periodKey, clanPrizeTiers);
        }
    }
}
function referralPrizeTiersForPeriod(configDoc, campaign, period) {
    const campaignTiers = campaign?.config.rankingPrizes?.[period];
    if (campaignTiers && campaignTiers.length > 0)
        return normalizePrizeTierList(campaignTiers);
    const rawRules = configDoc.rankingRules && typeof configDoc.rankingRules === "object"
        ? (configDoc.rankingRules[period] ?? [])
        : [];
    return normalizePrizeTierList(rawRules);
}
async function closeReferralRankingJob(period) {
    const configSnap = await db.doc(`${COL.systemConfigs}/referral_system`).get();
    if (!configSnap.exists)
        return;
    const configDoc = configSnap.data();
    if (configDoc.enabled === false)
        return;
    if (configDoc.rankingEnabled === false)
        return;
    const referralConfig = await getReferralConfig();
    const campaign = await getActiveReferralCampaign(referralConfig);
    const prizeTiers = referralPrizeTiersForPeriod(configDoc, campaign, period);
    if (prizeTiers.length === 0)
        return;
    const periodKey = referralRankingKey(period);
    const rankingRootRef = db.doc(`${referralRankingCollection(period)}/${periodKey}`);
    const payoutFlagRef = db.doc(`${referralRankingCollection(period)}/${periodKey}/meta/payout`);
    const payoutFlagSnap = await payoutFlagRef.get();
    if (payoutFlagSnap.exists)
        return;
    const maxPos = prizeTiers[prizeTiers.length - 1]?.posicaoMax ?? 0;
    if (maxPos < 1)
        return;
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
            processedAt: firestore_2.FieldValue.serverTimestamp(),
            winners: 0,
            campaignId: campaign?.id ?? null,
            note: "Sem entradas para premiar.",
        });
        return;
    }
    const winners = entriesSnap.docs.map((docSnap, index) => {
        const tier = prizeTiers.find((item) => index + 1 <= item.posicaoMax) ??
            null;
        return {
            pos: index + 1,
            uid: docSnap.id,
            data: docSnap.data(),
            tier,
        };
    });
    const batch = db.batch();
    for (const winner of winners) {
        if (!winner.tier || winner.tier.amount <= 0)
            continue;
        const userRef = db.doc(`${COL.users}/${winner.uid}`);
        const userSnap = await userRef.get();
        if (!userSnap.exists)
            continue;
        const userData = userSnap.data();
        const rewardPatch = applyRewardPatch(userData, {
            amount: winner.tier.amount,
            currency: winner.tier.currency,
        });
        batch.set(userRef, {
            ...rewardPatch.patch,
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        batch.set(db.doc(`${COL.wallet}/referral_rank_${period}_${periodKey}_${winner.uid}_${winner.tier.currency}`), {
            userId: winner.uid,
            tipo: "referral",
            moeda: winner.tier.currency,
            valor: winner.tier.amount,
            saldoApos: rewardPatch.balanceAfter,
            descricao: `Premiação ranking de indicações ${period} · ${rewardCurrencyLabel(winner.tier.currency)}`,
            referenciaId: `${period}:${periodKey}:#${winner.pos}`,
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
    }
    batch.set(payoutFlagRef, {
        period,
        periodKey,
        processedAt: firestore_2.FieldValue.serverTimestamp(),
        winners: winners.filter((winner) => winner.tier != null).length,
        campaignId: campaign?.id ?? null,
    });
    batch.set(rankingRootRef, {
        period,
        periodKey,
        prizeProcessedAt: firestore_2.FieldValue.serverTimestamp(),
        campaignId: campaign?.id ?? null,
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();
}
/** Backstop server-side: resolve salas PvP expiradas para impedir travas e loops infinitos. */
exports.reapExpiredPvpRooms = (0, scheduler_1.onSchedule)({ ...DEFAULT_SCHEDULE_OPTS, schedule: "* * * * *" }, async () => {
    const snap = await db
        .collection(COL.gameRooms)
        .where("actionDeadlineAt", "<=", firestore_2.Timestamp.now())
        .limit(100)
        .get();
    for (const doc of snap.docs) {
        try {
            await resolveExpiredPvpRoom(doc.ref, doc.id);
        }
        catch (e) {
            console.error("reapExpiredPvpRooms", doc.id, e);
        }
    }
});
/** Duas janelas seguidas sem nenhum pick dos dois → anula partida e libera slots (sem pontos). */
exports.reapPptBothInactiveRounds = (0, scheduler_1.onSchedule)({ ...DEFAULT_SCHEDULE_OPTS, schedule: "* * * * *" }, async () => {
    const snap = await db
        .collection(COL.gameRooms)
        .where("pptAwaitingBothPicks", "==", true)
        .where("status", "in", ["matched", "playing"])
        .limit(100)
        .get();
    const now = Date.now();
    for (const doc of snap.docs) {
        const d = doc.data();
        if (String(d.gameId) !== "ppt")
            continue;
        if (d.pptRewardsApplied === true || String(d.phase) === "completed")
            continue;
        const picks = d.pptPickedUids ?? [];
        if (picks.length > 0)
            continue;
        const startedMs = millisFromFirestoreTime(d.pptRoundStartedAt);
        if (startedMs <= 0 || now - startedMs < PPT_BOTH_IDLE_NO_PICK_MS)
            continue;
        const roomRef = doc.ref;
        try {
            await db.runTransaction(async (tx) => {
                const rs = await tx.get(roomRef);
                if (!rs.exists)
                    return;
                const r = rs.data();
                if (r.pptRewardsApplied === true || String(r.phase) === "completed")
                    return;
                if (r.pptAwaitingBothPicks !== true)
                    return;
                const p2 = (r.pptPickedUids ?? []).length;
                if (p2 > 0)
                    return;
                const sm = millisFromFirestoreTime(r.pptRoundStartedAt);
                if (sm <= 0 || Date.now() - sm < PPT_BOTH_IDLE_NO_PICK_MS)
                    return;
                const strikes = Math.max(0, Number(r.pptConsecutiveEmptyRounds ?? 0));
                if (strikes >= 1) {
                    await applyPptVoidBothInactiveInTransaction(tx, roomRef, r);
                }
                else {
                    tx.update(roomRef, {
                        pptConsecutiveEmptyRounds: 1,
                        pptRoundStartedAt: firestore_2.FieldValue.serverTimestamp(),
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
            });
        }
        catch (e) {
            console.error("reapPptBothInactiveRounds", doc.id, e);
        }
    }
});
exports.closeDailyRanking = (0, scheduler_1.onSchedule)({ ...DEFAULT_SCHEDULE_OPTS, schedule: "0 0 * * *" }, async () => {
    await closeRankingJob("diario");
});
exports.closeWeeklyRanking = (0, scheduler_1.onSchedule)({ ...DEFAULT_SCHEDULE_OPTS, schedule: "0 0 * * 1" }, async () => {
    await closeRankingJob("semanal");
});
exports.closeMonthlyRanking = (0, scheduler_1.onSchedule)({ ...DEFAULT_SCHEDULE_OPTS, schedule: "0 0 1 * *" }, async () => {
    await closeRankingJob("mensal");
});
exports.adminCloseRanking = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    await assertAdmin(uid);
    const period = String(request.data?.period || "").trim();
    if (!["diario", "semanal", "mensal"].includes(period)) {
        throw new https_1.HttpsError("invalid-argument", "Período inválido.");
    }
    await closeRankingJob(period);
    return { ok: true };
});
exports.getArenaOverallRanking = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const topN = Math.min(100, Math.max(5, Math.floor(Number(request.data?.topN) || 50)));
    const matchesSnap = await db
        .collection(COL.matches)
        .where("gameId", "in", [...ARENA_OVERALL_GAME_IDS])
        .get();
    const statsByUser = new Map();
    for (const docSnap of matchesSnap.docs) {
        const raw = (docSnap.data() || {});
        const userId = String(raw.userId || "").trim();
        const gameId = String(raw.gameId || "").trim();
        if (!userId || !ARENA_OVERALL_GAME_IDS.includes(gameId))
            continue;
        const score = normalizeCounter(raw.score);
        const result = String(raw.resultado || raw.result || "").trim();
        const accumulator = statsByUser.get(userId) ?? createArenaOverallAccumulator();
        accumulator.total.score += score;
        accumulator.total.partidas += 1;
        accumulator.total.vitorias += result === "vitoria" ? 1 : 0;
        accumulator.byGame[gameId].score += score;
        accumulator.byGame[gameId].partidas += 1;
        accumulator.byGame[gameId].vitorias += result === "vitoria" ? 1 : 0;
        statsByUser.set(userId, accumulator);
    }
    const usersById = await readUserPresentationMap(Array.from(statsByUser.keys()));
    const generalRows = buildArenaOverallRows(statsByUser, usersById);
    const byGameRows = {
        ppt: buildArenaOverallRows(statsByUser, usersById, "ppt"),
        quiz: buildArenaOverallRows(statsByUser, usersById, "quiz"),
        reaction_tap: buildArenaOverallRows(statsByUser, usersById, "reaction_tap"),
    };
    const packRows = (rows) => {
        const myEntry = rows.find((row) => row.uid === uid) ?? null;
        return {
            entries: rows.slice(0, topN),
            myEntry,
            myPosition: myEntry?.posicao ?? null,
        };
    };
    return {
        ok: true,
        general: packRows(generalRows),
        byGame: {
            ppt: packRows(byGameRows.ppt),
            quiz: packRows(byGameRows.quiz),
            reaction_tap: packRows(byGameRows.reaction_tap),
        },
    };
});
exports.closeReferralDailyRanking = (0, scheduler_1.onSchedule)({ ...DEFAULT_SCHEDULE_OPTS, schedule: "0 0 * * *" }, async () => {
    await closeReferralRankingJob("daily");
});
exports.closeReferralWeeklyRanking = (0, scheduler_1.onSchedule)({ ...DEFAULT_SCHEDULE_OPTS, schedule: "0 0 * * 1" }, async () => {
    await closeReferralRankingJob("weekly");
});
exports.closeReferralMonthlyRanking = (0, scheduler_1.onSchedule)({ ...DEFAULT_SCHEDULE_OPTS, schedule: "0 0 1 * *" }, async () => {
    await closeReferralRankingJob("monthly");
});
exports.adminCloseReferralRanking = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    await assertAdmin(uid);
    const period = String(request.data?.period || "").trim();
    if (!["daily", "weekly", "monthly"].includes(period)) {
        throw new https_1.HttpsError("invalid-argument", "Período inválido.");
    }
    await closeReferralRankingJob(period);
    return { ok: true };
});
exports.tickRaffles = (0, scheduler_1.onSchedule)({ ...DEFAULT_SCHEDULE_OPTS, schedule: "* * * * *" }, async () => {
    await runRaffleLifecycleTick(Date.now());
});
const CLAN_DEFAULT_MAX_MEMBERS = 30;
const CLAN_DEFAULT_COVER_POSITION = 50;
const CLAN_DEFAULT_COVER_SCALE = 100;
const CLAN_INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CLAN_SHOWCASE_GAME_IDS = ["ppt", "quiz", "reaction_tap"];
function clanRef(clanId) {
    return db.doc(`${COL.clans}/${clanId}`);
}
function clanMembershipRef(uid) {
    return db.doc(`${COL.clanMemberships}/${uid}`);
}
function clanMemberRef(clanId, uid) {
    return db.doc(`${COL.clans}/${clanId}/members/${uid}`);
}
function clanMessagesCollection(clanId) {
    return db.collection(`${COL.clans}/${clanId}/messages`);
}
function clanJoinRequestRef(uid) {
    return db.doc(`${COL.clanJoinRequests}/${uid}`);
}
function normalizeClanName(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 24);
}
function normalizeClanTag(value) {
    return String(value || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);
}
function normalizeClanDescription(value) {
    return String(value || "")
        .replace(/\r/g, "")
        .trim()
        .slice(0, 160);
}
function normalizeClanPrivacy(value) {
    return value === "open" ? "open" : "code_only";
}
function normalizeClanCoverPosition(value) {
    const num = Number(value);
    if (!Number.isFinite(num))
        return CLAN_DEFAULT_COVER_POSITION;
    return Math.min(100, Math.max(0, Math.round(num)));
}
function normalizeClanCoverScale(value) {
    const num = Number(value);
    if (!Number.isFinite(num))
        return CLAN_DEFAULT_COVER_SCALE;
    return Math.min(220, Math.max(100, Math.round(num)));
}
function normalizeClanManagedRole(value) {
    return value === "leader" ? "leader" : "member";
}
function normalizeClanInviteCode(value) {
    return String(value || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 8);
}
function normalizeClanMessageText(value) {
    return String(value || "")
        .replace(/\r/g, "")
        .trim()
        .slice(0, 240);
}
function randomClanInviteCode(length = 6) {
    let output = "";
    for (let i = 0; i < length; i += 1) {
        output += CLAN_INVITE_CODE_CHARS[(0, node_crypto_1.randomInt)(0, CLAN_INVITE_CODE_CHARS.length)];
    }
    return output;
}
async function generateUniqueClanInviteCode() {
    for (let attempt = 0; attempt < 24; attempt += 1) {
        const code = randomClanInviteCode();
        const existing = await db.collection(COL.clans).where("inviteCode", "==", code).limit(1).get();
        if (existing.empty)
            return code;
    }
    throw new https_1.HttpsError("internal", "Não foi possível gerar um código de clã único.");
}
function extractClanAssetPathFromUrl(rawUrl) {
    const urlValue = normalizeHttpPhotoUrl(typeof rawUrl === "string" ? rawUrl : null);
    if (!urlValue)
        return null;
    try {
        const url = new URL(urlValue);
        const marker = "/o/";
        const markerIndex = url.pathname.indexOf(marker);
        if (markerIndex < 0)
            return null;
        const encodedPath = url.pathname.slice(markerIndex + marker.length);
        const objectPath = decodeURIComponent(encodedPath);
        return objectPath.startsWith("clan_assets/") ? objectPath : null;
    }
    catch {
        return null;
    }
}
async function deleteClanAssetIfExists(rawUrl) {
    const objectPath = extractClanAssetPathFromUrl(rawUrl);
    if (!objectPath)
        return;
    try {
        const file = admin.storage().bucket().file(objectPath);
        const [exists] = await file.exists();
        if (exists) {
            await file.delete();
        }
    }
    catch {
        /* ignore cleanup failures to avoid blocking config updates */
    }
}
async function getClanUserPresentation(uid) {
    const userSnap = await db.doc(`${COL.users}/${uid}`).get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError("failed-precondition", "Perfil do usuário não encontrado.");
    }
    const userData = (userSnap.data() || {});
    const nome = String(userData.nome || "Jogador").trim() || "Jogador";
    const username = typeof userData.username === "string" ? userData.username.trim() || null : null;
    const foto = typeof userData.foto === "string" && userData.foto.trim()
        ? userData.foto.trim()
        : buildDefaultAvatarDataUrl(username || uid, nome);
    return {
        uid,
        nome,
        username,
        foto,
        banido: userData.banido === true,
    };
}
async function getClanActorProfile(uid) {
    const user = await getClanUserPresentation(uid);
    if (user.banido) {
        throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
    }
    return {
        uid: user.uid,
        nome: user.nome,
        username: user.username,
        foto: user.foto,
    };
}
async function getClanMembershipOrThrow(uid) {
    const membershipSnap = await clanMembershipRef(uid).get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError("failed-precondition", "Você não faz parte de um clã.");
    }
    return membershipSnap;
}
function canModerateClanMember(actorRole, targetRole, actorUid, targetUid) {
    if (actorUid === targetUid)
        return false;
    if (targetRole === "owner")
        return false;
    if (actorRole === "owner")
        return true;
    return actorRole === "leader" && targetRole === "member";
}
function canReviewClanRequest(actorRole) {
    return actorRole === "owner" || actorRole === "leader";
}
async function readClanScoreCreditTargetForClanIdTx(tx, clanId, uid) {
    const targetClanRef = clanRef(clanId);
    const clanSnap = await tx.get(targetClanRef);
    if (!clanSnap.exists)
        return null;
    const clanData = (clanSnap.data() || {});
    const currentDayKey = dailyKey();
    const currentWeekKey = weeklyKey();
    const currentMonthKey = monthlyKey();
    return {
        uid,
        clanId,
        dailyPeriodKey: currentDayKey,
        weeklyPeriodKey: currentWeekKey,
        monthlyPeriodKey: currentMonthKey,
        shouldResetDaily: String(clanData.scoreDailyKey || "") !== currentDayKey,
        shouldResetWeekly: String(clanData.scoreWeeklyKey || "") !== currentWeekKey,
        shouldResetMonthly: String(clanData.scoreMonthlyKey || "") !== currentMonthKey,
    };
}
async function readClanScoreCreditTargetTx(tx, uid) {
    const membershipSnap = await tx.get(clanMembershipRef(uid));
    if (!membershipSnap.exists)
        return null;
    const membershipData = (membershipSnap.data() || {});
    const clanId = String(membershipData.clanId || "").trim();
    if (!clanId)
        return null;
    return readClanScoreCreditTargetForClanIdTx(tx, clanId, uid);
}
function writeClanScoreCreditForTargetTx(tx, target, input) {
    const wins = normalizeCounter(input.wins);
    const ads = normalizeCounter(input.ads);
    const total = wins + ads;
    if (total <= 0 || !target)
        return;
    tx.set(clanRef(target.clanId), {
        scoreTotal: firestore_2.FieldValue.increment(total),
        scoreTotalWins: firestore_2.FieldValue.increment(wins),
        scoreTotalAds: firestore_2.FieldValue.increment(ads),
        scoreDailyKey: target.dailyPeriodKey,
        scoreDaily: target.shouldResetDaily ? total : firestore_2.FieldValue.increment(total),
        scoreDailyWins: target.shouldResetDaily ? wins : firestore_2.FieldValue.increment(wins),
        scoreDailyAds: target.shouldResetDaily ? ads : firestore_2.FieldValue.increment(ads),
        scoreWeeklyKey: target.weeklyPeriodKey,
        scoreWeekly: target.shouldResetWeekly ? total : firestore_2.FieldValue.increment(total),
        scoreWeeklyWins: target.shouldResetWeekly ? wins : firestore_2.FieldValue.increment(wins),
        scoreWeeklyAds: target.shouldResetWeekly ? ads : firestore_2.FieldValue.increment(ads),
        scoreMonthlyKey: target.monthlyPeriodKey,
        scoreMonthly: target.shouldResetMonthly ? total : firestore_2.FieldValue.increment(total),
        scoreMonthlyWins: target.shouldResetMonthly ? wins : firestore_2.FieldValue.increment(wins),
        scoreMonthlyAds: target.shouldResetMonthly ? ads : firestore_2.FieldValue.increment(ads),
        lastScoreAt: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(db.doc(`${COL.clanRankingsWeekly}/${target.weeklyPeriodKey}/clans/${target.clanId}/contributors/${target.uid}`), {
        uid: target.uid,
        clanId: target.clanId,
        periodKey: target.weeklyPeriodKey,
        score: firestore_2.FieldValue.increment(total),
        wins: firestore_2.FieldValue.increment(wins),
        ads: firestore_2.FieldValue.increment(ads),
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
}
async function applyClanScoreCreditForClanIdTx(tx, clanId, input) {
    const target = await readClanScoreCreditTargetForClanIdTx(tx, clanId, input.uid);
    writeClanScoreCreditForTargetTx(tx, target, input);
}
async function applyClanScoreCreditTx(tx, input) {
    const target = await readClanScoreCreditTargetTx(tx, input.uid);
    writeClanScoreCreditForTargetTx(tx, target, input);
}
async function applyClanScoreCreditByClanId(clanId, input) {
    const normalizedClanId = String(clanId || "").trim();
    if (!normalizedClanId)
        return;
    await db.runTransaction(async (tx) => {
        await applyClanScoreCreditForClanIdTx(tx, normalizedClanId, input);
    });
}
function weeklyRankingGameEntryRef(periodKey, gameId, uid) {
    return db.doc(`${COL.rankingsWeekly}/${periodKey}/games/${gameId}/entries/${uid}`);
}
function weeklyPeriodStartTimestamp(d = new Date()) {
    const parts = appDateTimeParts(d);
    const t = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() - day + 1);
    return firestore_2.Timestamp.fromMillis(appDateToUtcMs({
        year: t.getUTCFullYear(),
        month: t.getUTCMonth() + 1,
        day: t.getUTCDate(),
    }));
}
function normalizeCounter(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
}
function createArenaOverallStats() {
    return { score: 0, partidas: 0, vitorias: 0 };
}
function createArenaOverallAccumulator() {
    return {
        total: createArenaOverallStats(),
        byGame: {
            ppt: createArenaOverallStats(),
            quiz: createArenaOverallStats(),
            reaction_tap: createArenaOverallStats(),
        },
    };
}
async function readUserPresentationMap(uids) {
    const userMap = new Map();
    const refs = uids.map((uid) => db.doc(`${COL.users}/${uid}`));
    for (let index = 0; index < refs.length; index += 200) {
        const chunk = refs.slice(index, index + 200);
        if (chunk.length === 0)
            continue;
        const snaps = await db.getAll(...chunk);
        for (const snap of snaps) {
            if (!snap.exists)
                continue;
            userMap.set(snap.id, (snap.data() || {}));
        }
    }
    return userMap;
}
function compareArenaOverallEntry(a, b) {
    if (b.vitorias !== a.vitorias)
        return b.vitorias - a.vitorias;
    if (b.score !== a.score)
        return b.score - a.score;
    if (b.partidas !== a.partidas)
        return b.partidas - a.partidas;
    const aName = String(a.nome || a.username || a.uid || "Jogador");
    const bName = String(b.nome || b.username || b.uid || "Jogador");
    return aName.localeCompare(bName, "pt-BR");
}
function buildArenaOverallRows(statsByUser, usersById, gameId) {
    return Array.from(statsByUser.entries())
        .map(([uid, accumulator]) => {
        const stats = gameId ? accumulator.byGame[gameId] : accumulator.total;
        if (stats.partidas <= 0 && stats.score <= 0 && stats.vitorias <= 0) {
            return null;
        }
        const userData = usersById.get(uid) ?? {};
        return {
            uid,
            nome: String(userData.nome || "Jogador"),
            username: typeof userData.username === "string" ? userData.username : null,
            foto: typeof userData.foto === "string" ? userData.foto : null,
            score: normalizeCounter(stats.score),
            partidas: normalizeCounter(stats.partidas),
            vitorias: normalizeCounter(stats.vitorias),
            scope: gameId ? "game" : "global",
            gameId: gameId ?? null,
            gameTitle: gameId ? GAME_TITLES[gameId] : null,
        };
    })
        .filter((row) => row != null)
        .sort(compareArenaOverallEntry)
        .map((row, index) => ({ ...row, posicao: index + 1 }));
}
async function countUserVictoriesByGame(uid, gameId) {
    const snapshot = await db
        .collection(COL.matches)
        .where("userId", "==", uid)
        .where("gameId", "==", gameId)
        .where("resultado", "==", "vitoria")
        .count()
        .get();
    return normalizeCounter(snapshot.data().count);
}
async function countUserWeeklyRewardedAds(uid, from) {
    const snapshot = await db
        .collection(COL.adEvents)
        .where("userId", "==", uid)
        .where("status", "==", "recompensado")
        .where("criadoEm", ">=", from)
        .count()
        .get();
    return normalizeCounter(snapshot.data().count);
}
function buildClanJoinRequestPayload(input) {
    return {
        userId: input.userId,
        clanId: input.clanId,
        clanName: input.clanName,
        clanTag: input.clanTag,
        requestedByCode: input.requestedByCode,
        status: input.status ?? "pending",
        userName: input.userName,
        username: input.username,
        photoURL: input.photoURL,
        requestedAt: firestore_2.FieldValue.serverTimestamp(),
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
        reviewedAt: input.reviewedAt ?? null,
        reviewedByUid: input.reviewedByUid ?? null,
        reviewedByName: input.reviewedByName ?? null,
    };
}
function buildClanMessagePayload(input) {
    return {
        clanId: input.clanId,
        authorUid: input.authorUid,
        authorName: input.authorName,
        authorUsername: input.authorUsername,
        authorPhoto: input.authorPhoto,
        text: input.text,
        kind: input.kind,
        systemType: input.systemType ?? null,
        createdAt: firestore_2.FieldValue.serverTimestamp(),
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
    };
}
exports.createClan = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const name = normalizeClanName(request.data?.name);
    const tag = normalizeClanTag(request.data?.tag);
    const description = normalizeClanDescription(request.data?.description);
    const privacy = normalizeClanPrivacy(request.data?.privacy);
    if (name.length < 3) {
        throw new https_1.HttpsError("invalid-argument", "O nome do clã precisa ter pelo menos 3 caracteres.");
    }
    if (tag.length < 2) {
        throw new https_1.HttpsError("invalid-argument", "A TAG do clã precisa ter entre 2 e 6 caracteres.");
    }
    const [actor, duplicatedTagSnap, existingJoinRequestSnap] = await Promise.all([
        getClanActorProfile(uid),
        db.collection(COL.clans).where("tag", "==", tag).limit(1).get(),
        clanJoinRequestRef(uid).get(),
    ]);
    if (!duplicatedTagSnap.empty) {
        throw new https_1.HttpsError("already-exists", "Essa TAG já está em uso.");
    }
    const membershipRef = clanMembershipRef(uid);
    const currentMembership = await membershipRef.get();
    if (currentMembership.exists) {
        throw new https_1.HttpsError("failed-precondition", "Você já faz parte de um clã.");
    }
    const inviteCode = await generateUniqueClanInviteCode();
    const newClanRef = db.collection(COL.clans).doc();
    const firstMessageRef = clanMessagesCollection(newClanRef.id).doc();
    await db.runTransaction(async (tx) => {
        const membershipSnap = await tx.get(membershipRef);
        if (membershipSnap.exists) {
            throw new https_1.HttpsError("failed-precondition", "Você já faz parte de um clã.");
        }
        tx.set(newClanRef, {
            name,
            tag,
            description,
            avatarUrl: null,
            coverUrl: null,
            coverPositionX: CLAN_DEFAULT_COVER_POSITION,
            coverPositionY: CLAN_DEFAULT_COVER_POSITION,
            coverScale: CLAN_DEFAULT_COVER_SCALE,
            ownerUid: uid,
            inviteCode,
            privacy,
            memberCount: 1,
            maxMembers: CLAN_DEFAULT_MAX_MEMBERS,
            scoreTotal: 0,
            scoreDaily: 0,
            scoreWeekly: 0,
            scoreMonthly: 0,
            scoreTotalWins: 0,
            scoreDailyWins: 0,
            scoreWeeklyWins: 0,
            scoreMonthlyWins: 0,
            scoreTotalAds: 0,
            scoreDailyAds: 0,
            scoreWeeklyAds: 0,
            scoreMonthlyAds: 0,
            scoreDailyKey: dailyKey(),
            scoreWeeklyKey: weeklyKey(),
            scoreMonthlyKey: monthlyKey(),
            lastScoreAt: null,
            joinRequestsReceivedCount: 0,
            joinRequestsApprovedCount: 0,
            joinRequestsRejectedCount: 0,
            lastMessageAt: null,
            createdAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.set(membershipRef, {
            uid,
            clanId: newClanRef.id,
            role: "owner",
            joinedAt: firestore_2.FieldValue.serverTimestamp(),
            lastReadAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.set(clanMemberRef(newClanRef.id, uid), {
            uid,
            clanId: newClanRef.id,
            role: "owner",
            nome: actor.nome,
            username: actor.username,
            foto: actor.foto,
            joinedAt: firestore_2.FieldValue.serverTimestamp(),
            lastActiveAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.set(firstMessageRef, buildClanMessagePayload({
            clanId: newClanRef.id,
            authorUid: uid,
            authorName: actor.nome,
            authorUsername: actor.username,
            authorPhoto: actor.foto,
            text: `${actor.nome} fundou o clã.`,
            kind: "system",
            systemType: "clan_created",
        }));
        if (existingJoinRequestSnap.exists) {
            tx.delete(clanJoinRequestRef(uid));
        }
    });
    return { ok: true, clanId: newClanRef.id };
});
exports.joinClanByCode = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const code = normalizeClanInviteCode(request.data?.code);
    if (code.length < 4) {
        throw new https_1.HttpsError("invalid-argument", "Informe um código de clã válido.");
    }
    const [actor, clanQuerySnap, currentMembership, existingRequestSnap] = await Promise.all([
        getClanActorProfile(uid),
        db.collection(COL.clans).where("inviteCode", "==", code).limit(1).get(),
        clanMembershipRef(uid).get(),
        clanJoinRequestRef(uid).get(),
    ]);
    if (currentMembership.exists) {
        throw new https_1.HttpsError("failed-precondition", "Você já faz parte de um clã.");
    }
    if (clanQuerySnap.empty) {
        throw new https_1.HttpsError("not-found", "Código de clã não encontrado.");
    }
    const targetClanRef = clanQuerySnap.docs[0].ref;
    const membershipRef = clanMembershipRef(uid);
    const joinRequestRef = clanJoinRequestRef(uid);
    const joinMessageRef = clanMessagesCollection(targetClanRef.id).doc();
    const targetClanData = (clanQuerySnap.docs[0].data() || {});
    const privacy = normalizeClanPrivacy(targetClanData.privacy);
    if (privacy === "code_only") {
        let shouldIncrementReceived = true;
        if (existingRequestSnap.exists) {
            const existingData = (existingRequestSnap.data() || {});
            const existingStatus = String(existingData.status || "pending");
            const existingClanId = String(existingData.clanId || "");
            if (existingStatus === "pending" && existingClanId && existingClanId !== targetClanRef.id) {
                throw new https_1.HttpsError("failed-precondition", "Você já tem uma solicitação pendente. Cancele-a antes de pedir entrada em outro clã.");
            }
            shouldIncrementReceived = !(existingStatus === "pending" && existingClanId === targetClanRef.id);
        }
        const batch = db.batch();
        batch.set(joinRequestRef, buildClanJoinRequestPayload({
            userId: uid,
            clanId: targetClanRef.id,
            clanName: String(targetClanData.name || "Clã"),
            clanTag: String(targetClanData.tag || "TAG"),
            requestedByCode: code,
            userName: actor.nome,
            username: actor.username,
            photoURL: actor.foto,
        }), { merge: true });
        if (shouldIncrementReceived) {
            batch.set(targetClanRef, {
                joinRequestsReceivedCount: firestore_2.FieldValue.increment(1),
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        await batch.commit();
        return { ok: true, clanId: targetClanRef.id, status: "pending" };
    }
    await db.runTransaction(async (tx) => {
        const [membershipSnap, clanSnap, existingMemberSnap] = await Promise.all([
            tx.get(membershipRef),
            tx.get(targetClanRef),
            tx.get(clanMemberRef(targetClanRef.id, uid)),
        ]);
        if (membershipSnap.exists || existingMemberSnap.exists) {
            throw new https_1.HttpsError("failed-precondition", "Você já faz parte de um clã.");
        }
        if (!clanSnap.exists) {
            throw new https_1.HttpsError("not-found", "Clã não encontrado.");
        }
        const clanData = (clanSnap.data() || {});
        const memberCount = Math.max(0, Math.floor(Number(clanData.memberCount) || 0));
        const maxMembers = Math.max(1, Math.floor(Number(clanData.maxMembers) || CLAN_DEFAULT_MAX_MEMBERS));
        if (memberCount >= maxMembers) {
            throw new https_1.HttpsError("failed-precondition", "Esse clã já atingiu o limite de membros.");
        }
        tx.set(membershipRef, {
            uid,
            clanId: targetClanRef.id,
            role: "member",
            joinedAt: firestore_2.FieldValue.serverTimestamp(),
            lastReadAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.set(clanMemberRef(targetClanRef.id, uid), {
            uid,
            clanId: targetClanRef.id,
            role: "member",
            nome: actor.nome,
            username: actor.username,
            foto: actor.foto,
            joinedAt: firestore_2.FieldValue.serverTimestamp(),
            lastActiveAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.update(targetClanRef, {
            memberCount: firestore_2.FieldValue.increment(1),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        if (existingRequestSnap.exists) {
            tx.delete(joinRequestRef);
        }
        tx.set(joinMessageRef, buildClanMessagePayload({
            clanId: targetClanRef.id,
            authorUid: uid,
            authorName: actor.nome,
            authorUsername: actor.username,
            authorPhoto: actor.foto,
            text: `${actor.nome} entrou no clã.`,
            kind: "system",
            systemType: "member_joined",
        }));
    });
    return { ok: true, clanId: targetClanRef.id, status: "joined" };
});
exports.requestClanAccess = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const clanId = String(request.data?.clanId || "").trim();
    if (!clanId) {
        throw new https_1.HttpsError("invalid-argument", "Clã inválido.");
    }
    const [actor, clanSnap, currentMembership, existingRequestSnap] = await Promise.all([
        getClanActorProfile(uid),
        clanRef(clanId).get(),
        clanMembershipRef(uid).get(),
        clanJoinRequestRef(uid).get(),
    ]);
    if (currentMembership.exists) {
        throw new https_1.HttpsError("failed-precondition", "Você já faz parte de um clã.");
    }
    if (!clanSnap.exists) {
        throw new https_1.HttpsError("not-found", "Clã não encontrado.");
    }
    const targetClanRef = clanSnap.ref;
    const membershipRef = clanMembershipRef(uid);
    const joinRequestRef = clanJoinRequestRef(uid);
    const joinMessageRef = clanMessagesCollection(targetClanRef.id).doc();
    const targetClanData = (clanSnap.data() || {});
    const privacy = normalizeClanPrivacy(targetClanData.privacy);
    if (privacy === "code_only") {
        let shouldIncrementReceived = true;
        if (existingRequestSnap.exists) {
            const existingData = (existingRequestSnap.data() || {});
            const existingStatus = String(existingData.status || "pending");
            const existingClanId = String(existingData.clanId || "");
            if (existingStatus === "pending" && existingClanId && existingClanId !== targetClanRef.id) {
                throw new https_1.HttpsError("failed-precondition", "Você já tem uma solicitação pendente. Cancele-a antes de pedir entrada em outro clã.");
            }
            shouldIncrementReceived = !(existingStatus === "pending" && existingClanId === targetClanRef.id);
        }
        const batch = db.batch();
        batch.set(joinRequestRef, buildClanJoinRequestPayload({
            userId: uid,
            clanId: targetClanRef.id,
            clanName: String(targetClanData.name || "Clã"),
            clanTag: String(targetClanData.tag || "TAG"),
            requestedByCode: null,
            userName: actor.nome,
            username: actor.username,
            photoURL: actor.foto,
        }), { merge: true });
        if (shouldIncrementReceived) {
            batch.set(targetClanRef, {
                joinRequestsReceivedCount: firestore_2.FieldValue.increment(1),
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        await batch.commit();
        return { ok: true, clanId: targetClanRef.id, status: "pending" };
    }
    await db.runTransaction(async (tx) => {
        const [membershipSnap, freshClanSnap, existingMemberSnap] = await Promise.all([
            tx.get(membershipRef),
            tx.get(targetClanRef),
            tx.get(clanMemberRef(targetClanRef.id, uid)),
        ]);
        if (membershipSnap.exists || existingMemberSnap.exists) {
            throw new https_1.HttpsError("failed-precondition", "Você já faz parte de um clã.");
        }
        if (!freshClanSnap.exists) {
            throw new https_1.HttpsError("not-found", "Clã não encontrado.");
        }
        const freshClanData = (freshClanSnap.data() || {});
        const memberCount = Math.max(0, Math.floor(Number(freshClanData.memberCount) || 0));
        const maxMembers = Math.max(1, Math.floor(Number(freshClanData.maxMembers) || CLAN_DEFAULT_MAX_MEMBERS));
        if (memberCount >= maxMembers) {
            throw new https_1.HttpsError("failed-precondition", "Esse clã já atingiu o limite de membros.");
        }
        tx.set(membershipRef, {
            uid,
            clanId: targetClanRef.id,
            role: "member",
            joinedAt: firestore_2.FieldValue.serverTimestamp(),
            lastReadAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.set(clanMemberRef(targetClanRef.id, uid), {
            uid,
            clanId: targetClanRef.id,
            role: "member",
            nome: actor.nome,
            username: actor.username,
            foto: actor.foto,
            joinedAt: firestore_2.FieldValue.serverTimestamp(),
            lastActiveAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.update(targetClanRef, {
            memberCount: firestore_2.FieldValue.increment(1),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        if (existingRequestSnap.exists) {
            tx.delete(joinRequestRef);
        }
        tx.set(joinMessageRef, buildClanMessagePayload({
            clanId: targetClanRef.id,
            authorUid: uid,
            authorName: actor.nome,
            authorUsername: actor.username,
            authorPhoto: actor.foto,
            text: `${actor.nome} entrou no clã.`,
            kind: "system",
            systemType: "member_joined",
        }));
    });
    return { ok: true, clanId: targetClanRef.id, status: "joined" };
});
exports.leaveClan = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const [actor, membershipSnap] = await Promise.all([
        getClanActorProfile(uid),
        clanMembershipRef(uid).get(),
    ]);
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError("failed-precondition", "Você não faz parte de um clã.");
    }
    const membershipData = (membershipSnap.data() || {});
    const clanId = String(membershipData.clanId || "").trim();
    const role = String(membershipData.role || "member");
    if (!clanId) {
        throw new https_1.HttpsError("failed-precondition", "Sua associação com o clã está inválida.");
    }
    if (role === "owner") {
        throw new https_1.HttpsError("failed-precondition", "O fundador ainda não pode sair do clã sem transferir a liderança.");
    }
    const leaveMessageRef = clanMessagesCollection(clanId).doc();
    await db.runTransaction(async (tx) => {
        const currentMembershipSnap = await tx.get(clanMembershipRef(uid));
        if (!currentMembershipSnap.exists) {
            throw new https_1.HttpsError("failed-precondition", "Você não faz parte de um clã.");
        }
        const currentMembershipData = (currentMembershipSnap.data() || {});
        if (String(currentMembershipData.role || "member") === "owner") {
            throw new https_1.HttpsError("failed-precondition", "O fundador ainda não pode sair do clã sem transferir a liderança.");
        }
        const currentClanId = String(currentMembershipData.clanId || "").trim();
        const currentClanRef = clanRef(currentClanId);
        const currentClanSnap = await tx.get(currentClanRef);
        if (!currentClanSnap.exists) {
            throw new https_1.HttpsError("not-found", "Clã não encontrado.");
        }
        tx.delete(clanMembershipRef(uid));
        tx.delete(clanMemberRef(currentClanId, uid));
        tx.update(currentClanRef, {
            memberCount: firestore_2.FieldValue.increment(-1),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.set(leaveMessageRef, buildClanMessagePayload({
            clanId: currentClanId,
            authorUid: uid,
            authorName: actor.nome,
            authorUsername: actor.username,
            authorPhoto: actor.foto,
            text: `${actor.nome} saiu do clã.`,
            kind: "system",
            systemType: "member_left",
        }));
    });
    return { ok: true };
});
exports.sendClanMessage = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const clanId = String(request.data?.clanId || "").trim();
    const text = normalizeClanMessageText(request.data?.text);
    if (!clanId) {
        throw new https_1.HttpsError("invalid-argument", "Clã inválido.");
    }
    if (text.length < 1) {
        throw new https_1.HttpsError("invalid-argument", "Digite uma mensagem antes de enviar.");
    }
    const [actor, membershipSnap] = await Promise.all([
        getClanActorProfile(uid),
        clanMembershipRef(uid).get(),
    ]);
    if (!membershipSnap.exists || String(membershipSnap.data()?.clanId || "") !== clanId) {
        throw new https_1.HttpsError("permission-denied", "Você precisa fazer parte desse clã para enviar mensagens.");
    }
    const clanDoc = await clanRef(clanId).get();
    if (!clanDoc.exists) {
        throw new https_1.HttpsError("not-found", "Clã não encontrado.");
    }
    const messageRef = clanMessagesCollection(clanId).doc();
    const batch = db.batch();
    batch.set(messageRef, buildClanMessagePayload({
        clanId,
        authorUid: uid,
        authorName: actor.nome,
        authorUsername: actor.username,
        authorPhoto: actor.foto,
        text,
        kind: "text",
    }));
    batch.set(clanRef(clanId), {
        lastMessageAt: firestore_2.FieldValue.serverTimestamp(),
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();
    return { ok: true, messageId: messageRef.id };
});
exports.markClanChatRead = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const clanId = String(request.data?.clanId || "").trim();
    if (!clanId) {
        throw new https_1.HttpsError("invalid-argument", "Clã inválido.");
    }
    const membershipSnap = await clanMembershipRef(uid).get();
    if (!membershipSnap.exists || String(membershipSnap.data()?.clanId || "") !== clanId) {
        throw new https_1.HttpsError("permission-denied", "Você não faz parte desse clã.");
    }
    await clanMembershipRef(uid).set({
        lastReadAt: firestore_2.FieldValue.serverTimestamp(),
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true };
});
exports.updateClanSettings = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const clanId = String(request.data?.clanId || "").trim();
    const rawName = typeof request.data?.name === "string" ? request.data.name : undefined;
    const rawTag = typeof request.data?.tag === "string" ? request.data.tag : undefined;
    const rawInviteCode = typeof request.data?.inviteCode === "string" ? request.data.inviteCode : undefined;
    const description = normalizeClanDescription(request.data?.description);
    const privacy = normalizeClanPrivacy(request.data?.privacy);
    const rawAvatarUrl = request.data?.avatarUrl;
    const rawCoverUrl = request.data?.coverUrl;
    const rawCoverPositionX = request.data?.coverPositionX;
    const rawCoverPositionY = request.data?.coverPositionY;
    const rawCoverScale = request.data?.coverScale;
    if (!clanId) {
        throw new https_1.HttpsError("invalid-argument", "Clã inválido.");
    }
    const [actor, membershipSnap] = await Promise.all([
        getClanActorProfile(uid),
        clanMembershipRef(uid).get(),
    ]);
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError("failed-precondition", "Você não faz parte de um clã.");
    }
    const membershipData = (membershipSnap.data() || {});
    if (String(membershipData.clanId || "") !== clanId) {
        throw new https_1.HttpsError("permission-denied", "Você não pode editar esse clã.");
    }
    const role = String(membershipData.role || "member");
    if (!["owner", "leader"].includes(role)) {
        throw new https_1.HttpsError("permission-denied", "Somente líderes podem editar o clã.");
    }
    const targetClanRef = clanRef(clanId);
    const clanSnap = await targetClanRef.get();
    if (!clanSnap.exists) {
        throw new https_1.HttpsError("not-found", "Clã não encontrado.");
    }
    const currentClanData = (clanSnap.data() || {});
    const nextName = rawName !== undefined ? normalizeClanName(rawName) : undefined;
    const nextTag = rawTag !== undefined ? normalizeClanTag(rawTag) : undefined;
    const nextInviteCode = rawInviteCode !== undefined ? normalizeClanInviteCode(rawInviteCode) : undefined;
    if (nextName !== undefined && nextName.length < 3) {
        throw new https_1.HttpsError("invalid-argument", "O nome do clã precisa ter pelo menos 3 caracteres.");
    }
    if (nextTag !== undefined && nextTag.length < 2) {
        throw new https_1.HttpsError("invalid-argument", "A TAG do clã precisa ter entre 2 e 6 caracteres.");
    }
    if (nextInviteCode !== undefined && nextInviteCode.length < 4) {
        throw new https_1.HttpsError("invalid-argument", "O código do clã precisa ter pelo menos 4 caracteres.");
    }
    if (nextTag !== undefined && nextTag !== String(currentClanData.tag || "")) {
        const duplicatedTagSnap = await db.collection(COL.clans).where("tag", "==", nextTag).limit(1).get();
        if (!duplicatedTagSnap.empty && duplicatedTagSnap.docs[0]?.id !== clanId) {
            throw new https_1.HttpsError("already-exists", "Essa TAG já está em uso.");
        }
    }
    if (nextInviteCode !== undefined &&
        nextInviteCode !== String(currentClanData.inviteCode || "")) {
        const duplicatedCodeSnap = await db
            .collection(COL.clans)
            .where("inviteCode", "==", nextInviteCode)
            .limit(1)
            .get();
        if (!duplicatedCodeSnap.empty && duplicatedCodeSnap.docs[0]?.id !== clanId) {
            throw new https_1.HttpsError("already-exists", "Esse código de convite já está em uso.");
        }
    }
    const patch = {
        description,
        privacy,
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
    };
    if (nextName !== undefined) {
        patch.name = nextName;
    }
    if (nextTag !== undefined) {
        patch.tag = nextTag;
    }
    if (nextInviteCode !== undefined) {
        patch.inviteCode = nextInviteCode;
    }
    if (rawAvatarUrl === null) {
        patch.avatarUrl = null;
    }
    else if (typeof rawAvatarUrl === "string") {
        const avatarUrl = normalizeHttpPhotoUrl(rawAvatarUrl);
        if (!avatarUrl) {
            throw new https_1.HttpsError("invalid-argument", "URL de avatar do clã inválida.");
        }
        patch.avatarUrl = avatarUrl;
    }
    if (rawCoverUrl === null) {
        patch.coverUrl = null;
    }
    else if (typeof rawCoverUrl === "string") {
        const coverUrl = normalizeHttpPhotoUrl(rawCoverUrl);
        if (!coverUrl) {
            throw new https_1.HttpsError("invalid-argument", "URL de capa do clã inválida.");
        }
        patch.coverUrl = coverUrl;
    }
    if (rawCoverPositionX !== undefined) {
        patch.coverPositionX = normalizeClanCoverPosition(rawCoverPositionX);
    }
    if (rawCoverPositionY !== undefined) {
        patch.coverPositionY = normalizeClanCoverPosition(rawCoverPositionY);
    }
    if (rawCoverScale !== undefined) {
        patch.coverScale = normalizeClanCoverScale(rawCoverScale);
    }
    const previousAvatarUrl = currentClanData.avatarUrl;
    const previousCoverUrl = currentClanData.coverUrl;
    const nextAvatarUrl = patch.avatarUrl !== undefined ? patch.avatarUrl : previousAvatarUrl;
    const nextCoverUrl = patch.coverUrl !== undefined ? patch.coverUrl : previousCoverUrl;
    const currentName = String(currentClanData.name || "");
    const currentTag = String(currentClanData.tag || "");
    const currentInviteCode = String(currentClanData.inviteCode || "");
    const currentPrivacy = normalizeClanPrivacy(currentClanData.privacy);
    const currentDescription = normalizeClanDescription(currentClanData.description);
    const currentCoverPositionX = normalizeClanCoverPosition(currentClanData.coverPositionX);
    const currentCoverPositionY = normalizeClanCoverPosition(currentClanData.coverPositionY);
    const currentCoverScale = normalizeClanCoverScale(currentClanData.coverScale);
    const historyFields = [];
    if (nextName !== undefined && nextName !== currentName)
        historyFields.push("nome");
    if (nextTag !== undefined && nextTag !== currentTag)
        historyFields.push("TAG");
    if (nextInviteCode !== undefined && nextInviteCode !== currentInviteCode)
        historyFields.push("código");
    if (privacy !== currentPrivacy)
        historyFields.push("privacidade");
    if (description !== currentDescription)
        historyFields.push("descrição");
    if (patch.avatarUrl !== undefined && nextAvatarUrl !== previousAvatarUrl)
        historyFields.push("avatar");
    if (patch.coverUrl !== undefined && nextCoverUrl !== previousCoverUrl)
        historyFields.push("capa");
    if ((rawCoverPositionX !== undefined && normalizeClanCoverPosition(rawCoverPositionX) !== currentCoverPositionX) ||
        (rawCoverPositionY !== undefined && normalizeClanCoverPosition(rawCoverPositionY) !== currentCoverPositionY) ||
        (rawCoverScale !== undefined && normalizeClanCoverScale(rawCoverScale) !== currentCoverScale)) {
        historyFields.push("enquadramento");
    }
    const batch = db.batch();
    batch.set(targetClanRef, patch, { merge: true });
    if (historyFields.length > 0) {
        batch.set(clanMessagesCollection(clanId).doc(), buildClanMessagePayload({
            clanId,
            authorUid: uid,
            authorName: actor.nome,
            authorUsername: actor.username,
            authorPhoto: actor.foto,
            text: `${actor.nome} atualizou ${historyFields.join(", ")} do clã.`,
            kind: "system",
            systemType: "settings_updated",
        }));
    }
    await batch.commit();
    if (previousAvatarUrl && previousAvatarUrl !== nextAvatarUrl) {
        await deleteClanAssetIfExists(previousAvatarUrl);
    }
    if (previousCoverUrl && previousCoverUrl !== nextCoverUrl) {
        await deleteClanAssetIfExists(previousCoverUrl);
    }
    return { ok: true };
});
exports.changeClanMemberRole = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const clanId = String(request.data?.clanId || "").trim();
    const targetUid = String(request.data?.targetUid || "").trim();
    const nextRole = normalizeClanManagedRole(request.data?.role);
    if (!clanId || !targetUid) {
        throw new https_1.HttpsError("invalid-argument", "Clã ou membro inválido.");
    }
    if (targetUid === uid) {
        throw new https_1.HttpsError("failed-precondition", "Você não pode alterar o próprio papel por aqui.");
    }
    const [actor, targetUser, ownerMembershipSnap] = await Promise.all([
        getClanActorProfile(uid),
        getClanUserPresentation(targetUid),
        clanMembershipRef(uid).get(),
    ]);
    if (!ownerMembershipSnap.exists) {
        throw new https_1.HttpsError("failed-precondition", "Você não faz parte de um clã.");
    }
    const ownerMembershipData = (ownerMembershipSnap.data() || {});
    if (String(ownerMembershipData.clanId || "") !== clanId || String(ownerMembershipData.role || "") !== "owner") {
        throw new https_1.HttpsError("permission-denied", "Somente o fundador pode alterar cargos.");
    }
    const roleMessageRef = clanMessagesCollection(clanId).doc();
    await db.runTransaction(async (tx) => {
        const [clanSnap, ownerMembershipTx, targetMembershipSnap] = await Promise.all([
            tx.get(clanRef(clanId)),
            tx.get(clanMembershipRef(uid)),
            tx.get(clanMembershipRef(targetUid)),
        ]);
        if (!clanSnap.exists) {
            throw new https_1.HttpsError("not-found", "Clã não encontrado.");
        }
        const currentOwnerMembership = (ownerMembershipTx.data() || {});
        if (!ownerMembershipTx.exists ||
            String(currentOwnerMembership.clanId || "") !== clanId ||
            String(currentOwnerMembership.role || "") !== "owner") {
            throw new https_1.HttpsError("permission-denied", "Somente o fundador pode alterar cargos.");
        }
        if (!targetMembershipSnap.exists) {
            throw new https_1.HttpsError("not-found", "Membro alvo não encontrado.");
        }
        const targetMembershipData = (targetMembershipSnap.data() || {});
        if (String(targetMembershipData.clanId || "") !== clanId) {
            throw new https_1.HttpsError("permission-denied", "Esse membro não faz parte do seu clã.");
        }
        const currentRole = String(targetMembershipData.role || "member");
        if (currentRole === "owner") {
            throw new https_1.HttpsError("failed-precondition", "O fundador não pode ser alterado por esta ação.");
        }
        if (currentRole === nextRole) {
            return;
        }
        tx.set(clanMembershipRef(targetUid), {
            role: nextRole,
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(clanMemberRef(clanId, targetUid), {
            role: nextRole,
            nome: targetUser.nome,
            username: targetUser.username,
            foto: targetUser.foto,
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(roleMessageRef, buildClanMessagePayload({
            clanId,
            authorUid: uid,
            authorName: actor.nome,
            authorUsername: actor.username,
            authorPhoto: actor.foto,
            text: nextRole === "leader"
                ? `${actor.nome} promoveu ${targetUser.nome} para líder.`
                : `${actor.nome} rebaixou ${targetUser.nome} para membro.`,
            kind: "system",
            systemType: "role_changed",
        }));
    });
    return { ok: true };
});
exports.transferClanOwnership = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const clanId = String(request.data?.clanId || "").trim();
    const targetUid = String(request.data?.targetUid || "").trim();
    if (!clanId || !targetUid) {
        throw new https_1.HttpsError("invalid-argument", "Clã ou membro inválido.");
    }
    if (targetUid === uid) {
        throw new https_1.HttpsError("failed-precondition", "Escolha outro membro para receber a liderança.");
    }
    const [actor, targetUser, ownerMembershipSnap] = await Promise.all([
        getClanActorProfile(uid),
        getClanUserPresentation(targetUid),
        clanMembershipRef(uid).get(),
    ]);
    if (!ownerMembershipSnap.exists) {
        throw new https_1.HttpsError("failed-precondition", "Você não faz parte de um clã.");
    }
    const ownerMembershipData = (ownerMembershipSnap.data() || {});
    if (String(ownerMembershipData.clanId || "") !== clanId || String(ownerMembershipData.role || "") !== "owner") {
        throw new https_1.HttpsError("permission-denied", "Somente o fundador pode transferir a liderança.");
    }
    const transferMessageRef = clanMessagesCollection(clanId).doc();
    await db.runTransaction(async (tx) => {
        const [clanSnap, currentOwnerMembershipSnap, targetMembershipSnap] = await Promise.all([
            tx.get(clanRef(clanId)),
            tx.get(clanMembershipRef(uid)),
            tx.get(clanMembershipRef(targetUid)),
        ]);
        if (!clanSnap.exists) {
            throw new https_1.HttpsError("not-found", "Clã não encontrado.");
        }
        if (!currentOwnerMembershipSnap.exists) {
            throw new https_1.HttpsError("failed-precondition", "Seu vínculo com o clã não foi encontrado.");
        }
        const currentOwnerMembership = (currentOwnerMembershipSnap.data() || {});
        if (String(currentOwnerMembership.clanId || "") !== clanId ||
            String(currentOwnerMembership.role || "") !== "owner") {
            throw new https_1.HttpsError("permission-denied", "Somente o fundador pode transferir a liderança.");
        }
        if (!targetMembershipSnap.exists) {
            throw new https_1.HttpsError("not-found", "Membro alvo não encontrado.");
        }
        const targetMembershipData = (targetMembershipSnap.data() || {});
        if (String(targetMembershipData.clanId || "") !== clanId) {
            throw new https_1.HttpsError("permission-denied", "Esse membro não faz parte do seu clã.");
        }
        if (String(targetMembershipData.role || "") === "owner") {
            throw new https_1.HttpsError("failed-precondition", "Esse membro já é o fundador do clã.");
        }
        tx.set(clanRef(clanId), {
            ownerUid: targetUid,
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(clanMembershipRef(uid), {
            role: "leader",
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(clanMembershipRef(targetUid), {
            role: "owner",
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(clanMemberRef(clanId, uid), {
            role: "leader",
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(clanMemberRef(clanId, targetUid), {
            role: "owner",
            nome: targetUser.nome,
            username: targetUser.username,
            foto: targetUser.foto,
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(transferMessageRef, buildClanMessagePayload({
            clanId,
            authorUid: uid,
            authorName: actor.nome,
            authorUsername: actor.username,
            authorPhoto: actor.foto,
            text: `${actor.nome} transferiu a liderança para ${targetUser.nome}.`,
            kind: "system",
            systemType: "ownership_transferred",
        }));
    });
    return { ok: true };
});
exports.approveClanJoinRequest = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const clanId = String(request.data?.clanId || "").trim();
    const targetUid = String(request.data?.targetUid || "").trim();
    if (!clanId || !targetUid) {
        throw new https_1.HttpsError("invalid-argument", "Clã ou solicitação inválida.");
    }
    const [actor, actorMembershipSnap] = await Promise.all([
        getClanActorProfile(uid),
        getClanMembershipOrThrow(uid),
    ]);
    const actorMembershipData = (actorMembershipSnap.data() || {});
    const actorRole = String(actorMembershipData.role || "member");
    if (String(actorMembershipData.clanId || "") !== clanId || !canReviewClanRequest(actorRole)) {
        throw new https_1.HttpsError("permission-denied", "Somente a liderança pode aprovar entradas.");
    }
    const targetUser = await getClanUserPresentation(targetUid);
    if (targetUser.banido) {
        throw new https_1.HttpsError("permission-denied", "Esse usuário está suspenso e não pode entrar no clã.");
    }
    const joinMessageRef = clanMessagesCollection(clanId).doc();
    await db.runTransaction(async (tx) => {
        const [clanSnap, requestSnap, targetMembershipSnap] = await Promise.all([
            tx.get(clanRef(clanId)),
            tx.get(clanJoinRequestRef(targetUid)),
            tx.get(clanMembershipRef(targetUid)),
        ]);
        if (!clanSnap.exists) {
            throw new https_1.HttpsError("not-found", "Clã não encontrado.");
        }
        if (!requestSnap.exists) {
            throw new https_1.HttpsError("not-found", "Solicitação não encontrada.");
        }
        if (targetMembershipSnap.exists) {
            tx.delete(clanJoinRequestRef(targetUid));
            return;
        }
        const requestData = (requestSnap.data() || {});
        if (String(requestData.clanId || "") !== clanId ||
            String(requestData.status || "pending") !== "pending") {
            throw new https_1.HttpsError("failed-precondition", "A solicitação não está mais pendente.");
        }
        const clanData = (clanSnap.data() || {});
        const memberCount = Math.max(0, Math.floor(Number(clanData.memberCount) || 0));
        const maxMembers = Math.max(1, Math.floor(Number(clanData.maxMembers) || CLAN_DEFAULT_MAX_MEMBERS));
        if (memberCount >= maxMembers) {
            throw new https_1.HttpsError("failed-precondition", "Esse clã já atingiu o limite de membros.");
        }
        tx.set(clanMembershipRef(targetUid), {
            uid: targetUid,
            clanId,
            role: "member",
            joinedAt: firestore_2.FieldValue.serverTimestamp(),
            lastReadAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(clanMemberRef(clanId, targetUid), {
            uid: targetUid,
            clanId,
            role: "member",
            nome: targetUser.nome,
            username: targetUser.username,
            foto: targetUser.foto,
            joinedAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.update(clanRef(clanId), {
            memberCount: firestore_2.FieldValue.increment(1),
            joinRequestsApprovedCount: firestore_2.FieldValue.increment(1),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.delete(clanJoinRequestRef(targetUid));
        tx.set(joinMessageRef, buildClanMessagePayload({
            clanId,
            authorUid: uid,
            authorName: actor.nome,
            authorUsername: actor.username,
            authorPhoto: actor.foto,
            text: `${actor.nome} aprovou a entrada de ${targetUser.nome}.`,
            kind: "system",
            systemType: "request_approved",
        }));
    });
    return { ok: true, clanId };
});
exports.rejectClanJoinRequest = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const clanId = String(request.data?.clanId || "").trim();
    const targetUid = String(request.data?.targetUid || "").trim();
    if (!clanId || !targetUid) {
        throw new https_1.HttpsError("invalid-argument", "Clã ou solicitação inválida.");
    }
    const [actor, actorMembershipSnap] = await Promise.all([
        getClanActorProfile(uid),
        getClanMembershipOrThrow(uid),
    ]);
    const actorMembershipData = (actorMembershipSnap.data() || {});
    const actorRole = String(actorMembershipData.role || "member");
    if (String(actorMembershipData.clanId || "") !== clanId || !canReviewClanRequest(actorRole)) {
        throw new https_1.HttpsError("permission-denied", "Somente a liderança pode recusar entradas.");
    }
    const rejectMessageRef = clanMessagesCollection(clanId).doc();
    await db.runTransaction(async (tx) => {
        const [requestSnap, clanSnap] = await Promise.all([
            tx.get(clanJoinRequestRef(targetUid)),
            tx.get(clanRef(clanId)),
        ]);
        if (!clanSnap.exists) {
            throw new https_1.HttpsError("not-found", "Clã não encontrado.");
        }
        if (!requestSnap.exists) {
            throw new https_1.HttpsError("not-found", "Solicitação não encontrada.");
        }
        const requestData = (requestSnap.data() || {});
        if (String(requestData.clanId || "") !== clanId ||
            String(requestData.status || "pending") !== "pending") {
            throw new https_1.HttpsError("failed-precondition", "A solicitação não está mais pendente.");
        }
        tx.set(clanRef(clanId), {
            joinRequestsRejectedCount: firestore_2.FieldValue.increment(1),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(clanJoinRequestRef(targetUid), {
            status: "rejected",
            reviewedByUid: uid,
            reviewedByName: actor.nome,
            reviewedAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(rejectMessageRef, buildClanMessagePayload({
            clanId,
            authorUid: uid,
            authorName: actor.nome,
            authorUsername: actor.username,
            authorPhoto: actor.foto,
            text: `${actor.nome} recusou uma solicitação de entrada.`,
            kind: "system",
            systemType: "request_rejected",
        }));
    });
    return { ok: true };
});
exports.cancelClanJoinRequest = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const requestRef = clanJoinRequestRef(uid);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
        throw new https_1.HttpsError("not-found", "Nenhuma solicitação pendente foi encontrada.");
    }
    const requestData = (requestSnap.data() || {});
    if (String(requestData.status || "pending") !== "pending") {
        throw new https_1.HttpsError("failed-precondition", "Essa solicitação já foi encerrada.");
    }
    await requestRef.delete();
    return { ok: true };
});
exports.kickClanMember = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const clanId = String(request.data?.clanId || "").trim();
    const targetUid = String(request.data?.targetUid || "").trim();
    if (!clanId || !targetUid) {
        throw new https_1.HttpsError("invalid-argument", "Clã ou membro inválido.");
    }
    const [actor, actorMembershipSnap, targetUser] = await Promise.all([
        getClanActorProfile(uid),
        getClanMembershipOrThrow(uid),
        getClanUserPresentation(targetUid),
    ]);
    const actorMembershipData = (actorMembershipSnap.data() || {});
    const actorRole = String(actorMembershipData.role || "member");
    if (String(actorMembershipData.clanId || "") !== clanId) {
        throw new https_1.HttpsError("permission-denied", "Você não pode moderar esse clã.");
    }
    const kickMessageRef = clanMessagesCollection(clanId).doc();
    await db.runTransaction(async (tx) => {
        const [clanSnap, targetMembershipSnap] = await Promise.all([
            tx.get(clanRef(clanId)),
            tx.get(clanMembershipRef(targetUid)),
        ]);
        if (!clanSnap.exists) {
            throw new https_1.HttpsError("not-found", "Clã não encontrado.");
        }
        if (!targetMembershipSnap.exists) {
            throw new https_1.HttpsError("not-found", "Membro não encontrado.");
        }
        const targetMembershipData = (targetMembershipSnap.data() || {});
        if (String(targetMembershipData.clanId || "") !== clanId) {
            throw new https_1.HttpsError("permission-denied", "Esse membro não faz parte do seu clã.");
        }
        const targetRole = String(targetMembershipData.role || "member");
        if (!canModerateClanMember(actorRole, targetRole, uid, targetUid)) {
            throw new https_1.HttpsError("permission-denied", "Você não tem permissão para remover esse membro.");
        }
        tx.delete(clanMembershipRef(targetUid));
        tx.delete(clanMemberRef(clanId, targetUid));
        tx.update(clanRef(clanId), {
            memberCount: firestore_2.FieldValue.increment(-1),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.set(kickMessageRef, buildClanMessagePayload({
            clanId,
            authorUid: uid,
            authorName: actor.nome,
            authorUsername: actor.username,
            authorPhoto: actor.foto,
            text: `${actor.nome} removeu ${targetUser.nome} do clã.`,
            kind: "system",
            systemType: "member_removed",
        }));
    });
    return { ok: true };
});
exports.getClanMemberShowcase = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const clanId = String(request.data?.clanId || "").trim();
    if (!clanId) {
        throw new https_1.HttpsError("invalid-argument", "Clã inválido.");
    }
    const membershipSnap = await getClanMembershipOrThrow(uid);
    const membershipData = (membershipSnap.data() || {});
    if (String(membershipData.clanId || "") !== clanId) {
        throw new https_1.HttpsError("permission-denied", "Você não pode consultar esse clã.");
    }
    const memberSnaps = await db.collection(`${COL.clans}/${clanId}/members`).get();
    const memberIds = memberSnaps.docs.map((docSnap) => docSnap.id);
    if (memberIds.length === 0) {
        return { ok: true, rows: [] };
    }
    const weekKey = weeklyKey();
    const weekStartTs = weeklyPeriodStartTimestamp();
    const userRefs = memberIds.map((memberUid) => db.doc(`${COL.users}/${memberUid}`));
    const rankingPlans = memberIds.flatMap((memberUid) => CLAN_SHOWCASE_GAME_IDS.map((gameId) => ({
        uid: memberUid,
        gameId,
        ref: weeklyRankingGameEntryRef(weekKey, gameId, memberUid),
    })));
    const [userSnaps, weeklyRankingSnaps, totalVictoryRows, weeklyAdRows] = await Promise.all([
        db.getAll(...userRefs),
        db.getAll(...rankingPlans.map((item) => item.ref)),
        Promise.all(memberIds.flatMap((memberUid) => CLAN_SHOWCASE_GAME_IDS.map(async (gameId) => ({
            uid: memberUid,
            gameId,
            total: await countUserVictoriesByGame(memberUid, gameId),
        })))),
        Promise.all(memberIds.map(async (memberUid) => ({
            uid: memberUid,
            weekly: await countUserWeeklyRewardedAds(memberUid, weekStartTs),
        }))),
    ]);
    const totalVictoriesByMember = new Map();
    for (const row of totalVictoryRows) {
        const current = totalVictoriesByMember.get(row.uid) ?? {};
        current[row.gameId] = row.total;
        totalVictoriesByMember.set(row.uid, current);
    }
    const weeklyVictoriesByMember = new Map();
    rankingPlans.forEach((plan, index) => {
        const snap = weeklyRankingSnaps[index];
        const raw = snap.exists ? (snap.data() || {}) : {};
        const current = weeklyVictoriesByMember.get(plan.uid) ?? {};
        current[plan.gameId] = normalizeCounter(raw.vitorias);
        weeklyVictoriesByMember.set(plan.uid, current);
    });
    const userStatsByMember = new Map();
    userSnaps.forEach((snap, index) => {
        const memberUid = memberIds[index];
        const raw = snap.exists ? (snap.data() || {}) : {};
        userStatsByMember.set(memberUid, {
            totalAds: normalizeCounter(raw.totalAdsAssistidos),
        });
    });
    const weeklyAdsByMember = new Map();
    weeklyAdRows.forEach((row) => {
        weeklyAdsByMember.set(row.uid, row.weekly);
    });
    return {
        ok: true,
        rows: memberIds.map((memberUid) => {
            const totalVictories = totalVictoriesByMember.get(memberUid) ?? {};
            const weeklyVictories = weeklyVictoriesByMember.get(memberUid) ?? {};
            const userStats = userStatsByMember.get(memberUid) ?? { totalAds: 0 };
            return {
                uid: memberUid,
                ppt: {
                    total: normalizeCounter(totalVictories.ppt),
                    weekly: normalizeCounter(weeklyVictories.ppt),
                },
                quiz: {
                    total: normalizeCounter(totalVictories.quiz),
                    weekly: normalizeCounter(weeklyVictories.quiz),
                },
                reaction: {
                    total: normalizeCounter(totalVictories.reaction_tap),
                    weekly: normalizeCounter(weeklyVictories.reaction_tap),
                },
                ads: {
                    total: normalizeCounter(userStats.totalAds),
                    weekly: normalizeCounter(weeklyAdsByMember.get(memberUid)),
                },
            };
        }),
    };
});
exports.touchUserPresence = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const userRef = db.doc(`${COL.users}/${uid}`);
    const [userSnap, membershipSnap] = await Promise.all([userRef.get(), clanMembershipRef(uid).get()]);
    if (!userSnap.exists) {
        return { ok: true };
    }
    const clanId = membershipSnap.exists
        ? String((membershipSnap.data() || {}).clanId || "").trim()
        : "";
    const batch = db.batch();
    batch.set(userRef, { lastActiveAt: firestore_2.FieldValue.serverTimestamp() }, { merge: true });
    if (clanId) {
        const memberRef = clanMemberRef(clanId, uid);
        const memberSnap = await memberRef.get();
        if (memberSnap.exists) {
            batch.set(memberRef, { lastActiveAt: firestore_2.FieldValue.serverTimestamp() }, { merge: true });
        }
    }
    await batch.commit();
    return { ok: true };
});
//# sourceMappingURL=index.js.map