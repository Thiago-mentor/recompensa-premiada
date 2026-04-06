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
exports.closeMonthlyRanking = exports.closeWeeklyRanking = exports.closeDailyRanking = exports.reapPptBothInactiveRounds = exports.reapExpiredPvpRooms = exports.riskAnalysisOnUserEvent = exports.pvpPptPresence = exports.resolvePvpRoomTimeout = exports.forfeitPvpRoom = exports.submitReactionTap = exports.submitQuizAnswer = exports.submitPptPick = exports.leaveAutoMatch = exports.reactionSyncDuelRefill = exports.quizSyncDuelRefill = exports.pptSyncDuelRefill = exports.joinAutoMatch = exports.processReferralReward = exports.convertCurrency = exports.confirmRewardClaimPix = exports.reviewRewardClaim = exports.adminGrantEconomy = exports.requestRewardClaim = exports.claimMissionReward = exports.finalizeMatch = exports.processRewardedAd = exports.processDailyLogin = exports.initializeUserProfile = void 0;
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
};
const AUTO_QUEUE_GAMES = new Set(["ppt", "quiz", "reaction_tap"]);
/** PPT em sala: primeiro a chegar nesta pontuação vence a partida (cada rodada sem empate = 1 ponto). */
const PPT_MATCH_TARGET_POINTS = 5;
const QUIZ_MATCH_TARGET_POINTS = 5;
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
const REWARDED_AD_TOKEN_MIN_LEN = 16;
const REWARDED_AD_TOKEN_MAX_LEN = 256;
const rewardAdMockAllowed = process.env.ALLOW_REWARDED_AD_MOCK === "true" ||
    process.env.FUNCTIONS_EMULATOR === "true" ||
    Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
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
    return {
        rewardAdCoinAmount: typeof d.rewardAdCoinAmount === "number" ? d.rewardAdCoinAmount : 25,
        dailyLoginBonus: typeof d.dailyLoginBonus === "number" ? d.dailyLoginBonus : 50,
        limiteDiarioAds: typeof d.limiteDiarioAds === "number" ? d.limiteDiarioAds : 20,
        welcomeBonus: typeof d.welcomeBonus === "number" ? d.welcomeBonus : 100,
        referralBonusIndicador: typeof d.referralBonusIndicador === "number" ? d.referralBonusIndicador : 200,
        referralBonusConvidado: typeof d.referralBonusConvidado === "number" ? d.referralBonusConvidado : 100,
        matchRewardOverrides: normalizeMatchRewardOverrides(rawOverrides),
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
function parseRewardedAdCompletionToken(raw) {
    const token = String(raw ?? "").trim();
    if (!token) {
        throw new https_1.HttpsError("invalid-argument", "Token de conclusão do anúncio é obrigatório.");
    }
    if (token.length < REWARDED_AD_TOKEN_MIN_LEN || token.length > REWARDED_AD_TOKEN_MAX_LEN) {
        throw new https_1.HttpsError("invalid-argument", "Token de anúncio inválido.");
    }
    const isMock = token.startsWith(REWARDED_AD_MOCK_PREFIX);
    if (isMock && !rewardAdMockAllowed) {
        throw new https_1.HttpsError("failed-precondition", "Mock de anúncio desabilitado neste ambiente.");
    }
    if (!isMock) {
        throw new https_1.HttpsError("failed-precondition", "Provedor real de anúncio ainda não configurado no servidor. Use mock apenas em ambiente controlado.");
    }
    return { token, isMock };
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
async function upsertRanking(uid, nome, foto, deltaScore, win) {
    const batch = db.batch();
    const userRef = db.doc(`${COL.users}/${uid}`);
    batch.update(userRef, {
        scoreRankingDiario: firestore_2.FieldValue.increment(deltaScore),
        scoreRankingSemanal: firestore_2.FieldValue.increment(deltaScore),
        scoreRankingMensal: firestore_2.FieldValue.increment(deltaScore),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    const periods = [
        { col: COL.rankingsDaily, key: dailyKey() },
        { col: COL.rankingsWeekly, key: weeklyKey() },
        { col: COL.rankingsMonthly, key: monthlyKey() },
    ];
    for (const p of periods) {
        const entryRef = db.doc(`${p.col}/${p.key}/entries/${uid}`);
        batch.set(entryRef, {
            uid,
            nome,
            foto,
            score: firestore_2.FieldValue.increment(deltaScore),
            partidas: firestore_2.FieldValue.increment(1),
            vitorias: firestore_2.FieldValue.increment(win ? 1 : 0),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
    await upsertRanking(hostUid, String(hSnap.data()?.nome || "Jogador"), hSnap.data()?.foto ?? null, ecoH.rankingPoints, hostRes === "vitoria");
    await upsertRanking(guestUid, String(gSnap.data()?.nome || "Jogador"), gSnap.data()?.foto ?? null, ecoG.rankingPoints, guestRes === "vitoria");
    await bumpPlayMatchMissions(hostUid);
    await bumpPlayMatchMissions(guestUid);
}
function clampQuizResponseMs(raw) {
    const ms = Number(raw);
    if (!Number.isFinite(ms))
        return QUIZ_RESPONSE_MS_CAP;
    return Math.max(0, Math.min(QUIZ_RESPONSE_MS_CAP, Math.floor(ms)));
}
/** Ponto só se um acerta e o outro erra. Ambos certos ou ambos errados → empate (sem desempate por tempo). */
function resolveQuizRoundWinner(hostCorrect, guestCorrect, _hostResponseMs, _guestResponseMs) {
    if (hostCorrect && !guestCorrect)
        return "host";
    if (!hostCorrect && guestCorrect)
        return "guest";
    return "draw";
}
async function postQuizMatchRankingFromWinner(roomId, hostUid, guestUid, matchWinner, hostResponseMs, guestResponseMs) {
    const hostRes = matchWinner === "host" ? "vitoria" : "derrota";
    const guestRes = matchWinner === "guest" ? "vitoria" : "derrota";
    const ecoH = (0, gameEconomy_1.resolveMatchEconomy)("quiz", hostRes, 0, {
        pvpRoomId: roomId,
        quizMatchWinner: matchWinner,
        responseTimeMs: hostResponseMs,
    });
    const ecoG = (0, gameEconomy_1.resolveMatchEconomy)("quiz", guestRes, 0, {
        pvpRoomId: roomId,
        quizMatchWinner: matchWinner,
        responseTimeMs: guestResponseMs,
    });
    const [hSnap, gSnap] = await Promise.all([
        db.doc(`${COL.users}/${hostUid}`).get(),
        db.doc(`${COL.users}/${guestUid}`).get(),
    ]);
    await upsertRanking(hostUid, String(hSnap.data()?.nome || "Jogador"), hSnap.data()?.foto ?? null, ecoH.rankingPoints, hostRes === "vitoria");
    await upsertRanking(guestUid, String(gSnap.data()?.nome || "Jogador"), gSnap.data()?.foto ?? null, ecoG.rankingPoints, guestRes === "vitoria");
    await bumpPlayMatchMissions(hostUid);
    await bumpPlayMatchMissions(guestUid);
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
    const [ecoH, ecoG] = await Promise.all([
        (0, gameEconomy_1.resolveMatchEconomy)("reaction_tap", hostRes, 0, {
            pvpRoomId: roomId,
            responseTimeMs: hostMs,
            reactionMs: hostMs,
        }),
        (0, gameEconomy_1.resolveMatchEconomy)("reaction_tap", guestRes, 0, {
            pvpRoomId: roomId,
            responseTimeMs: guestMs,
            reactionMs: guestMs,
        }),
    ]);
    const [hSnap, gSnap] = await Promise.all([
        db.doc(`${COL.users}/${hostUid}`).get(),
        db.doc(`${COL.users}/${guestUid}`).get(),
    ]);
    await upsertRanking(hostUid, String(hSnap.data()?.nome || "Jogador"), hSnap.data()?.foto ?? null, ecoH.rankingPoints, hostRes === "vitoria");
    await upsertRanking(guestUid, String(gSnap.data()?.nome || "Jogador"), gSnap.data()?.foto ?? null, ecoG.rankingPoints, guestRes === "vitoria");
    await bumpPlayMatchMissions(hostUid);
    await bumpPlayMatchMissions(guestUid);
}
async function applyQuizMatchCompletionInTransaction(tx, roomRef, roomId, r, matchWinner, hostAnswerIndex, guestAnswerIndex, hostCorrect, guestCorrect, hostResponseMs, guestResponseMs, quizRevealOptions, quizRevealCorrectIndex, quizRevealQuestionText) {
    const hostUid = String(r.hostUid);
    const guestUid = String(r.guestUid);
    const hostScore = Number(r.quizHostScore ?? 0);
    const guestScore = Number(r.quizGuestScore ?? 0);
    const target = readQuizTargetScore(r);
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
    const finishedTs = firestore_2.Timestamp.now();
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
        rewardCoins: ecoG.rewardCoins,
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
        coins: firestore_2.FieldValue.increment(ecoH.rewardCoins),
        xp: firestore_2.FieldValue.increment(hostRes === "vitoria" ? 15 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.update(guestUserRef, {
        totalPartidas: firestore_2.FieldValue.increment(1),
        totalVitorias: firestore_2.FieldValue.increment(guestRes === "vitoria" ? 1 : 0),
        totalDerrotas: firestore_2.FieldValue.increment(guestRes === "derrota" ? 1 : 0),
        coins: firestore_2.FieldValue.increment(ecoG.rewardCoins),
        xp: firestore_2.FieldValue.increment(guestRes === "vitoria" ? 15 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
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
    const finishedTs = firestore_2.Timestamp.now();
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
        rewardCoins: ecoG.rewardCoins,
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
        coins: firestore_2.FieldValue.increment(ecoH.rewardCoins),
        xp: firestore_2.FieldValue.increment(hostRes === "vitoria" ? 15 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.update(guestUserRef, {
        totalPartidas: firestore_2.FieldValue.increment(1),
        totalVitorias: firestore_2.FieldValue.increment(guestRes === "vitoria" ? 1 : 0),
        totalDerrotas: firestore_2.FieldValue.increment(guestRes === "derrota" ? 1 : 0),
        coins: firestore_2.FieldValue.increment(ecoG.rewardCoins),
        xp: firestore_2.FieldValue.increment(guestRes === "vitoria" ? 15 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
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
    const finishedTs = firestore_2.Timestamp.now();
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
        rewardCoins: ecoG.rewardCoins,
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
        coins: firestore_2.FieldValue.increment(ecoH.rewardCoins),
        xp: firestore_2.FieldValue.increment(hostRes === "vitoria" ? 15 : hostRes === "empate" ? 8 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.update(guestUserRef, {
        totalPartidas: firestore_2.FieldValue.increment(1),
        totalVitorias: firestore_2.FieldValue.increment(guestRes === "vitoria" ? 1 : 0),
        totalDerrotas: firestore_2.FieldValue.increment(guestRes === "derrota" ? 1 : 0),
        coins: firestore_2.FieldValue.increment(ecoG.rewardCoins),
        xp: firestore_2.FieldValue.increment(guestRes === "vitoria" ? 15 : guestRes === "empate" ? 8 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
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
        rewardCoins: ecoH.rewardCoins,
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
        rewardCoins: ecoG.rewardCoins,
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
        coins: firestore_2.FieldValue.increment(ecoH.rewardCoins),
        xp: firestore_2.FieldValue.increment(hWin ? 15 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.update(guestUserRef, {
        totalPartidas: firestore_2.FieldValue.increment(1),
        totalVitorias: firestore_2.FieldValue.increment(gWin ? 1 : 0),
        totalDerrotas: firestore_2.FieldValue.increment(gLoss ? 1 : 0),
        coins: firestore_2.FieldValue.increment(ecoG.rewardCoins),
        xp: firestore_2.FieldValue.increment(gWin ? 15 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
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
            actionDeadlineAt: pvpActionDeadlineTs(Date.now(), pptWindowMs),
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
            actionDeadlineAt: pvpActionDeadlineTs(Date.now(), pptWindowMs),
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
        rewardCoins: ecoH.rewardCoins,
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
        rewardCoins: ecoG.rewardCoins,
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
        coins: firestore_2.FieldValue.increment(ecoH.rewardCoins),
        xp: firestore_2.FieldValue.increment(hostRes === "vitoria" ? 15 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    tx.update(guestUserRef, {
        totalPartidas: firestore_2.FieldValue.increment(1),
        totalVitorias: firestore_2.FieldValue.increment(guestRes === "vitoria" ? 1 : 0),
        totalDerrotas: firestore_2.FieldValue.increment(guestRes === "derrota" ? 1 : 0),
        coins: firestore_2.FieldValue.increment(ecoG.rewardCoins),
        xp: firestore_2.FieldValue.increment(guestRes === "vitoria" ? 15 : 5),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
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
    const foto = request.data?.foto ?? null;
    const email = request.data?.email ?? null;
    const codigoConvite = request.data?.codigoConvite
        ? String(request.data.codigoConvite).toUpperCase()
        : null;
    if (nome.length < 2 || username.length < 3 || username.length > 10) {
        throw new https_1.HttpsError("invalid-argument", "Nome ou username inválidos. Username: 3 a 10 caracteres (a-z, 0-9, _).");
    }
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
    let convidadoPor = null;
    if (codigoConvite) {
        const inv = await db
            .collection(COL.users)
            .where("codigoConvite", "==", codigoConvite)
            .limit(1)
            .get();
        if (!inv.empty) {
            const inviter = inv.docs[0].id;
            if (inviter !== uid)
                convidadoPor = inviter;
        }
    }
    const economy = await getEconomy();
    const codigo = randomCode(8);
    await db.runTransaction(async (tx) => {
        tx.set(userRef, {
            uid,
            nome,
            email,
            foto,
            username,
            codigoConvite: codigo,
            convidadoPor,
            coins: economy.welcomeBonus,
            gems: 0,
            rewardBalance: 0,
            xp: 0,
            level: 1,
            streakAtual: 0,
            melhorStreak: 0,
            ultimaEntradaEm: null,
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
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
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
        const melhor = Math.max(Number(u.melhorStreak || 0), streak);
        const curCoins = Number(u.coins || 0);
        const curGems = Number(u.gems || 0);
        const newCoins = curCoins + reward.coins;
        const newGems = curGems + reward.gems;
        const patch = {
            streakAtual: streak,
            melhorStreak: melhor,
            ultimaEntradaEm: firestore_2.Timestamp.fromDate(now),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        };
        if (reward.coins > 0)
            patch.coins = firestore_2.FieldValue.increment(reward.coins);
        if (reward.gems > 0)
            patch.gems = firestore_2.FieldValue.increment(reward.gems);
        tx.update(userRef, patch);
        if (reward.coins > 0) {
            addWalletTxInTx(tx, {
                id: `streak_${uid}_${todayKey}_coins`,
                userId: uid,
                tipo: "streak",
                moeda: "coins",
                valor: reward.coins,
                saldoApos: newCoins,
                descricao: reward.tipoBonus === "bau"
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
            return { coins: 0, pptPvPDuelsAdded: addedDuels, pptPvPDuelsRemaining: cappedNext };
        }
        if (isQuizDuels) {
            const cur = readQuizDuelCharges(u);
            const cappedNext = Math.min(QUIZ_DUEL_CHARGES_MAX_STACK, cur + QUIZ_DUEL_CHARGES_PER_AD);
            const addedDuels = cappedNext - cur;
            userPatch.quizPvPDuelsRemaining = cappedNext;
            userPatch.quizPvpDuelsRefillAvailableAt = firestore_2.FieldValue.delete();
            tx.update(userRef, userPatch);
            return { coins: 0, quizPvPDuelsAdded: addedDuels, quizPvPDuelsRemaining: cappedNext };
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
                reactionPvPDuelsAdded: addedDuels,
                reactionPvPDuelsRemaining: cappedNext,
            };
        }
        const coins = economy.rewardAdCoinAmount;
        const newCoins = Number(u.coins ?? 0) + coins;
        userPatch.coins = firestore_2.FieldValue.increment(coins);
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
    return result;
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
    const uSnap = await userRef.get();
    if (!uSnap.exists)
        throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
    const u = uSnap.data();
    if (u.banido)
        throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
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
    const rewardCoins = economy.rewardCoins;
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
    await upsertRanking(uid, String(u.nome || "Jogador"), u.foto ?? null, rankingPoints, win);
    await bumpPlayMatchMissions(uid);
    return {
        matchId: matchRef.id,
        rewardCoins,
        rankingPoints,
        normalizedScore: economy.normalizedScore,
    };
});
exports.claimMissionReward = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const missionId = String(request.data?.missionId || "");
    if (!missionId)
        throw new https_1.HttpsError("invalid-argument", "missionId obrigatório.");
    const missionRef = db.doc(`${COL.missions}/${missionId}`);
    const progRef = db.doc(`${COL.userMissions}/${uid}/daily/${missionId}`);
    const userRef = db.doc(`${COL.users}/${uid}`);
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
        const g = Number(m.recompensaGems || 0);
        const xp = Number(m.recompensaXP || 0);
        const currentCoins = Number(u.coins || 0);
        const currentGems = Number(u.gems || 0);
        const periodKey = String(pSnap.data()?.periodoChave || dailyKey());
        tx.update(userRef, {
            coins: firestore_2.FieldValue.increment(c),
            gems: firestore_2.FieldValue.increment(g),
            xp: firestore_2.FieldValue.increment(xp),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.update(progRef, {
            recompensaResgatada: true,
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
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
    return { ok: true };
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
exports.processReferralReward = (0, https_1.onCall)(DEFAULT_CALLABLE_OPTS, async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    // MVP: marcar ação mínima cumprida; bônus real após validações adicionais
    const userRef = db.doc(`${COL.users}/${uid}`);
    const economy = await getEconomy();
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists)
            throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
        const u = snap.data();
        const inviter = u.convidadoPor;
        if (!inviter || u.referralBonusGranted) {
            return { ok: false, reason: "no_referral" };
        }
        if (inviter === uid) {
            throw new https_1.HttpsError("failed-precondition", "Indicação inválida.");
        }
        const invRef = db.doc(`${COL.users}/${inviter}`);
        const invSnap = await tx.get(invRef);
        if (!invSnap.exists) {
            throw new https_1.HttpsError("failed-precondition", "Usuário indicador inexistente.");
        }
        const guestCoins = Number(u.coins || 0) + economy.referralBonusConvidado;
        const inviterCoins = Number(invSnap.data()?.coins || 0) + economy.referralBonusIndicador;
        tx.update(userRef, {
            referralBonusGranted: true,
            coins: firestore_2.FieldValue.increment(economy.referralBonusConvidado),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.update(invRef, {
            coins: firestore_2.FieldValue.increment(economy.referralBonusIndicador),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        addWalletTxInTx(tx, {
            id: `referral_guest_${uid}_${inviter}`,
            userId: uid,
            tipo: "referral",
            moeda: "coins",
            valor: economy.referralBonusConvidado,
            saldoApos: guestCoins,
            descricao: "Bônus de indicação (convidado)",
            referenciaId: inviter,
        });
        addWalletTxInTx(tx, {
            id: `referral_inviter_${inviter}_${uid}`,
            userId: inviter,
            tipo: "referral",
            moeda: "coins",
            valor: economy.referralBonusIndicador,
            saldoApos: inviterCoins,
            descricao: "Bônus de indicação (indicador)",
            referenciaId: uid,
        });
        return { ok: true };
    });
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
    await upsertRanking(hostUid, String(hSnap.data()?.nome || "Jogador"), hSnap.data()?.foto ?? null, ecoH.rankingPoints, hostRes === "vitoria");
    await upsertRanking(guestUid, String(gSnap.data()?.nome || "Jogador"), gSnap.data()?.foto ?? null, ecoG.rankingPoints, guestRes === "vitoria");
    await bumpPlayMatchMissions(hostUid);
    await bumpPlayMatchMissions(guestUid);
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
            actionDeadlineAt: pvpActionDeadlineTs(Date.now(), quizSubmitWindowMs),
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
    const requestedFalseStart = request.data?.falseStart === true;
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
        const falseStart = requestedFalseStart || (goLiveAtMs > 0 && Date.now() < goLiveAtMs);
        const reactionMs = falseStart
            ? REACTION_FALSE_START_MS
            : clampReactionResponseMs(request.data?.reactionMs);
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
                actionDeadlineAt: pvpActionDeadlineTs(Date.now(), quizTimeoutMs),
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
async function closeRankingJob(period) {
    // Snapshot + premiação: expandir com consulta ordenada e distribuição por system_configs
    console.log(`closeRanking ${period} tick`);
}
/** Backstop server-side: resolve salas PvP expiradas para impedir travas e loops infinitos. */
exports.reapExpiredPvpRooms = (0, scheduler_1.onSchedule)({ schedule: "* * * * *", timeZone: "America/Sao_Paulo" }, async () => {
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
exports.reapPptBothInactiveRounds = (0, scheduler_1.onSchedule)({ schedule: "* * * * *", timeZone: "America/Sao_Paulo" }, async () => {
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
exports.closeDailyRanking = (0, scheduler_1.onSchedule)({ schedule: "59 23 * * *", timeZone: "America/Sao_Paulo" }, async () => {
    await closeRankingJob("diario");
});
exports.closeWeeklyRanking = (0, scheduler_1.onSchedule)({ schedule: "59 23 * * 0", timeZone: "America/Sao_Paulo" }, async () => {
    await closeRankingJob("semanal");
});
exports.closeMonthlyRanking = (0, scheduler_1.onSchedule)({ schedule: "0 0 1 * *", timeZone: "America/Sao_Paulo" }, async () => {
    await closeRankingJob("mensal");
});
//# sourceMappingURL=index.js.map