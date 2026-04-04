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
exports.closeMonthlyRanking = exports.closeWeeklyRanking = exports.closeDailyRanking = exports.reapPptBothInactiveRounds = exports.riskAnalysisOnUserEvent = exports.pvpPptPresence = exports.forfeitPvpRoom = exports.submitPptPick = exports.leaveAutoMatch = exports.pptSyncDuelRefill = exports.joinAutoMatch = exports.processReferralReward = exports.reviewRewardClaim = exports.requestRewardClaim = exports.claimMissionReward = exports.finalizeMatch = exports.processRewardedAd = exports.processDailyLogin = exports.initializeUserProfile = void 0;
const admin = __importStar(require("firebase-admin"));
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_2 = require("firebase-admin/firestore");
const gameEconomy_1 = require("./gameEconomy");
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
/** Duelos PvP PPT antes de precisar de anúncio (só o servidor altera). */
const PPT_DEFAULT_DUEL_CHARGES = 3;
const PPT_DUEL_CHARGES_PER_AD = 3;
/** Teto para evitar acúmulo absurdo; ajuste se quiser. */
const PPT_DUEL_CHARGES_MAX_STACK = 30;
/** Após zerar duelos, recupera 3 sem anúncio quando este prazo passar (servidor). */
const PPT_DUEL_TIME_REFILL_MS = 10 * 60 * 1000;
/** Anúncio recompensado: `placementId` que libera duelos (validado na Function). */
const PPT_PVP_DUELS_PLACEMENT_ID = "ppt_pvp_duels";
function readPptDuelCharges(data) {
    if (!data)
        return PPT_DEFAULT_DUEL_CHARGES;
    const v = Number(data.pptPvPDuelsRemaining);
    if (Number.isFinite(v) && v >= 0) {
        return Math.min(PPT_DUEL_CHARGES_MAX_STACK, Math.floor(v));
    }
    return PPT_DEFAULT_DUEL_CHARGES;
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
    const d = snap.data() || {};
    return {
        rewardAdCoinAmount: typeof d.rewardAdCoinAmount === "number" ? d.rewardAdCoinAmount : 25,
        dailyLoginBonus: typeof d.dailyLoginBonus === "number" ? d.dailyLoginBonus : 50,
        limiteDiarioAds: typeof d.limiteDiarioAds === "number" ? d.limiteDiarioAds : 20,
        welcomeBonus: typeof d.welcomeBonus === "number" ? d.welcomeBonus : 100,
        referralBonusIndicador: typeof d.referralBonusIndicador === "number" ? d.referralBonusIndicador : 200,
        referralBonusConvidado: typeof d.referralBonusConvidado === "number" ? d.referralBonusConvidado : 100,
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
    const ecoH = (0, gameEconomy_1.resolveMatchEconomy)("ppt", hostRes, 0, metaBase);
    const ecoG = (0, gameEconomy_1.resolveMatchEconomy)("ppt", guestRes, 0, metaBase);
    const [hSnap, gSnap] = await Promise.all([
        db.doc(`${COL.users}/${hostUid}`).get(),
        db.doc(`${COL.users}/${guestUid}`).get(),
    ]);
    await upsertRanking(hostUid, String(hSnap.data()?.nome || "Jogador"), hSnap.data()?.foto ?? null, ecoH.rankingPoints, hostRes === "vitoria");
    await upsertRanking(guestUid, String(gSnap.data()?.nome || "Jogador"), gSnap.data()?.foto ?? null, ecoG.rankingPoints, guestRes === "vitoria");
    await bumpPlayMatchMissions(hostUid);
    await bumpPlayMatchMissions(guestUid);
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
    const ecoH = (0, gameEconomy_1.resolveMatchEconomy)("ppt", hostRes, 0, metaBase);
    const ecoG = (0, gameEconomy_1.resolveMatchEconomy)("ppt", guestRes, 0, metaBase);
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
exports.initializeUserProfile = (0, https_1.onCall)(async (request) => {
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
    if (nome.length < 2 || username.length < 3) {
        throw new https_1.HttpsError("invalid-argument", "Nome ou username inválidos.");
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
exports.processDailyLogin = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const economy = await getEconomy();
    const userRef = db.doc(`${COL.users}/${uid}`);
    const snap = await userRef.get();
    if (!snap.exists)
        throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
    const u = snap.data();
    if (u.banido)
        throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
    const now = new Date();
    const last = u.ultimaEntradaEm?.toDate?.();
    const todayKey = dailyKey(now);
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yKey = dailyKey(yesterday);
    let streak = Number(u.streakAtual || 0);
    if (!last)
        streak = 1;
    else {
        const lastKey = dailyKey(last);
        if (lastKey === todayKey) {
            return { streak, coins: 0, message: "already_checked_in" };
        }
        if (lastKey === yKey)
            streak += 1;
        else
            streak = 1;
    }
    const melhor = Math.max(Number(u.melhorStreak || 0), streak);
    const newCoins = u.coins + economy.dailyLoginBonus;
    await userRef.update({
        streakAtual: streak,
        melhorStreak: melhor,
        ultimaEntradaEm: firestore_2.Timestamp.fromDate(now),
        coins: firestore_2.FieldValue.increment(economy.dailyLoginBonus),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    await addWalletTx({
        userId: uid,
        tipo: "streak",
        moeda: "coins",
        valor: economy.dailyLoginBonus,
        saldoApos: newCoins,
        descricao: "Login diário / streak",
        referenciaId: todayKey,
    });
    return { streak, coins: economy.dailyLoginBonus };
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
 * Recompensa por anúncio: moedas (placement padrão) ou +3 duelos PPT (`ppt_pvp_duels`).
 * Limite diário compartilhado; só o servidor altera saldos / duelos.
 */
exports.processRewardedAd = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const placementId = String(request.data?.placementId || "default");
    const mockToken = request.data?.mockCompletionToken
        ? String(request.data.mockCompletionToken)
        : null;
    const economy = await getEconomy();
    const userRef = db.doc(`${COL.users}/${uid}`);
    const uSnap = await userRef.get();
    if (!uSnap.exists)
        throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
    const u = uSnap.data();
    if (u.banido)
        throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const adsToday = await db
        .collection(COL.adEvents)
        .where("userId", "==", uid)
        .where("status", "==", "recompensado")
        .where("criadoEm", ">=", firestore_2.Timestamp.fromDate(start))
        .get();
    if (adsToday.size >= economy.limiteDiarioAds) {
        throw new https_1.HttpsError("resource-exhausted", "Limite diário de anúncios atingido.");
    }
    if (!mockToken) {
        throw new https_1.HttpsError("failed-precondition", "Token de conclusão obrigatório fora do modo mock.");
    }
    const isPptDuels = placementId === PPT_PVP_DUELS_PLACEMENT_ID;
    if (isPptDuels) {
        const adRef = db.collection(COL.adEvents).doc();
        const { capped, added } = await db.runTransaction(async (tx) => {
            const rs = await tx.get(userRef);
            if (!rs.exists) {
                throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
            }
            const raw = rs.data();
            if (raw.banido) {
                throw new https_1.HttpsError("permission-denied", "Conta suspensa.");
            }
            const cur = readPptDuelCharges(raw);
            const cappedNext = Math.min(PPT_DUEL_CHARGES_MAX_STACK, cur + PPT_DUEL_CHARGES_PER_AD);
            const addedDuels = cappedNext - cur;
            tx.set(adRef, {
                id: adRef.id,
                userId: uid,
                status: "recompensado",
                placementId,
                rewardKind: "ppt_pvp_duels",
                mock: true,
                criadoEm: firestore_2.FieldValue.serverTimestamp(),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            tx.update(userRef, {
                pptPvPDuelsRemaining: cappedNext,
                pptPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
                totalAdsAssistidos: firestore_2.FieldValue.increment(1),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            return { capped: cappedNext, added: addedDuels };
        });
        await bumpWatchAdMissions(uid);
        return {
            coins: 0,
            pptPvPDuelsAdded: added,
            pptPvPDuelsRemaining: capped,
        };
    }
    const coins = economy.rewardAdCoinAmount;
    const newCoins = Number(u.coins ?? 0) + coins;
    const adRef = db.collection(COL.adEvents).doc();
    await adRef.set({
        id: adRef.id,
        userId: uid,
        status: "recompensado",
        placementId,
        mock: true,
        criadoEm: firestore_2.FieldValue.serverTimestamp(),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    await userRef.update({
        coins: firestore_2.FieldValue.increment(coins),
        totalAdsAssistidos: firestore_2.FieldValue.increment(1),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    await addWalletTx({
        userId: uid,
        tipo: "anuncio",
        moeda: "coins",
        valor: coins,
        saldoApos: newCoins,
        descricao: "Anúncio recompensado",
        referenciaId: adRef.id,
    });
    await bumpWatchAdMissions(uid);
    return { coins };
});
exports.finalizeMatch = (0, https_1.onCall)(async (request) => {
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
    const economy = (0, gameEconomy_1.resolveMatchEconomy)(gameId, effectiveResult, clientScore, metadata);
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
exports.claimMissionReward = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const missionId = String(request.data?.missionId || "");
    if (!missionId)
        throw new https_1.HttpsError("invalid-argument", "missionId obrigatório.");
    const mSnap = await db.doc(`${COL.missions}/${missionId}`).get();
    if (!mSnap.exists)
        throw new https_1.HttpsError("not-found", "Missão inexistente.");
    const m = mSnap.data();
    const progRef = db.doc(`${COL.userMissions}/${uid}/daily/${missionId}`);
    const pSnap = await progRef.get();
    if (!pSnap.exists || !pSnap.data()?.concluida) {
        throw new https_1.HttpsError("failed-precondition", "Missão não concluída.");
    }
    if (pSnap.data()?.recompensaResgatada) {
        throw new https_1.HttpsError("already-exists", "Recompensa já resgatada.");
    }
    const userRef = db.doc(`${COL.users}/${uid}`);
    const uSnap = await userRef.get();
    if (!uSnap.exists)
        throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
    const u = uSnap.data();
    const c = Number(m.recompensaCoins || 0);
    const g = Number(m.recompensaGems || 0);
    const xp = Number(m.recompensaXP || 0);
    await userRef.update({
        coins: firestore_2.FieldValue.increment(c),
        gems: firestore_2.FieldValue.increment(g),
        xp: firestore_2.FieldValue.increment(xp),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    await progRef.update({
        recompensaResgatada: true,
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    if (c > 0) {
        await addWalletTx({
            userId: uid,
            tipo: "missao",
            moeda: "coins",
            valor: c,
            saldoApos: u.coins + c,
            descricao: `Missão: ${m.titulo || missionId}`,
            referenciaId: missionId,
        });
    }
    return { ok: true };
});
exports.requestRewardClaim = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    const valor = Number(request.data?.valor);
    const tipo = String(request.data?.tipo || "pix");
    const chavePix = String(request.data?.chavePix || "").trim();
    if (!Number.isFinite(valor) || valor <= 0 || !chavePix) {
        throw new https_1.HttpsError("invalid-argument", "Dados inválidos.");
    }
    const userRef = db.doc(`${COL.users}/${uid}`);
    const uSnap = await userRef.get();
    if (!uSnap.exists)
        throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
    const u = uSnap.data();
    if (valor > Number(u.rewardBalance || 0)) {
        throw new https_1.HttpsError("failed-precondition", "Saldo insuficiente.");
    }
    const ref = db.collection(COL.rewardClaims).doc();
    await ref.set({
        id: ref.id,
        userId: uid,
        valor,
        tipo,
        chavePix,
        status: "pendente",
        analisadoPor: null,
        motivoRecusa: null,
        criadoEm: firestore_2.FieldValue.serverTimestamp(),
        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
    });
    return { claimId: ref.id };
});
exports.reviewRewardClaim = (0, https_1.onCall)(async (request) => {
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
    if (status === "aprovado") {
        await db.runTransaction(async (tx) => {
            const uSnap = await tx.get(userRef);
            const bal = Number(uSnap.data()?.rewardBalance || 0);
            if (bal < Number(c.valor))
                throw new https_1.HttpsError("failed-precondition", "Saldo alterado.");
            tx.update(userRef, {
                rewardBalance: firestore_2.FieldValue.increment(-Number(c.valor)),
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            tx.update(ref, {
                status: "aprovado",
                analisadoPor: uid,
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
        });
        const after = await userRef.get();
        const saldoApos = Number(after.data()?.rewardBalance ?? 0);
        await addWalletTx({
            userId: c.userId,
            tipo: "resgate",
            moeda: "rewardBalance",
            valor: -Number(c.valor),
            saldoApos,
            descricao: "Resgate aprovado",
            referenciaId: claimId,
        });
    }
    else {
        await ref.update({
            status: "recusado",
            analisadoPor: uid,
            motivoRecusa: String(request.data?.motivo || ""),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
    }
    return { ok: true };
});
exports.processReferralReward = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);
    // MVP: marcar ação mínima cumprida; bônus real após validações adicionais
    const userRef = db.doc(`${COL.users}/${uid}`);
    const snap = await userRef.get();
    if (!snap.exists)
        throw new https_1.HttpsError("failed-precondition", "Perfil inexistente.");
    const u = snap.data();
    const inviter = u.convidadoPor;
    if (!inviter || u.referralBonusGranted) {
        return { ok: false, reason: "no_referral" };
    }
    const economy = await getEconomy();
    const invRef = db.doc(`${COL.users}/${inviter}`);
    await db.runTransaction(async (tx) => {
        tx.update(userRef, {
            referralBonusGranted: true,
            coins: firestore_2.FieldValue.increment(economy.referralBonusConvidado),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.update(invRef, {
            coins: firestore_2.FieldValue.increment(economy.referralBonusIndicador),
            atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
    });
    await addWalletTx({
        userId: uid,
        tipo: "referral",
        moeda: "coins",
        valor: economy.referralBonusConvidado,
        saldoApos: 0,
        descricao: "Bônus de indicação (convidado)",
        referenciaId: inviter,
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
exports.joinAutoMatch = (0, https_1.onCall)(async (request) => {
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
    if (gameId === "ppt") {
        const charges = readPptDuelCharges(u);
        if (charges < 1) {
            throw new https_1.HttpsError("resource-exhausted", "Sem duelos PvP. Assista a um anúncio (+3) ou aguarde 10 minutos para recuperar 3 duelos.");
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
            const roomActive = r.status === "matched" || r.status === "playing";
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
    const snap = await coll.orderBy("joinedAt", "asc").limit(25).get();
    const others = snap.docs.filter((d) => d.id !== uid);
    const partnerDoc = others[0];
    if (!partnerDoc) {
        return { status: "waiting" };
    }
    const partnerId = partnerDoc.id;
    const roomRef = db.collection(COL.gameRooms).doc();
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
            tx.delete(selfW);
            tx.delete(pW);
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
                if (pptHostC === 1) {
                    tx.update(hostUserRef, {
                        pptPvPDuelsRemaining: firestore_2.FieldValue.increment(-1),
                        pptPvpDuelsRefillAvailableAt: refillAt,
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
                else {
                    tx.update(hostUserRef, {
                        pptPvPDuelsRemaining: firestore_2.FieldValue.increment(-1),
                        pptPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
                if (pptGuestC === 1) {
                    tx.update(guestUserRef, {
                        pptPvPDuelsRemaining: firestore_2.FieldValue.increment(-1),
                        pptPvpDuelsRefillAvailableAt: refillAt,
                        atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
                else {
                    tx.update(guestUserRef, {
                        pptPvPDuelsRemaining: firestore_2.FieldValue.increment(-1),
                        pptPvpDuelsRefillAvailableAt: firestore_2.FieldValue.delete(),
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
exports.pptSyncDuelRefill = (0, https_1.onCall)(async (req) => {
    const uid = req.auth?.uid;
    assertAuthed(uid);
    await tryApplyPptTimedRefillForUser(uid);
    return { ok: true };
});
exports.leaveAutoMatch = (0, https_1.onCall)(async (request) => {
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
exports.submitPptPick = (0, https_1.onCall)(async (request) => {
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
        const mySnap = uid === hostUid ? hPSnap : gPSnap;
        const otherSnap = uid === hostUid ? gPSnap : hPSnap;
        if (mySnap.exists) {
            throw new https_1.HttpsError("already-exists", "Você já escolheu nesta rodada.");
        }
        tx.set(myPref, {
            hand,
            criadoEm: firestore_2.FieldValue.serverTimestamp(),
        });
        if (!otherSnap.exists) {
            tx.update(roomRef, {
                phase: "ppt_waiting",
                status: "playing",
                pptPickedUids: firestore_2.FieldValue.arrayUnion(uid),
                pptAwaitingBothPicks: false,
                pptConsecutiveEmptyRounds: 0,
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            return "queued";
        }
        const hostHand = uid === hostUid ? hand : String(hPSnap.data().hand);
        const guestHand = uid === guestUid ? hand : String(gPSnap.data().hand);
        const out = pptOutcomeFromHands(hostHand, guestHand);
        const hostScore = Number(r.pptHostScore ?? 0);
        const guestScore = Number(r.pptGuestScore ?? 0);
        const target = Number(r.pptTargetScore ?? PPT_MATCH_TARGET_POINTS);
        if (out === "draw") {
            tx.delete(hPref);
            tx.delete(gPref);
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
                atualizadoEm: firestore_2.FieldValue.serverTimestamp(),
            });
            return "round";
        }
        const newHost = hostScore + (out === "host_win" ? 1 : 0);
        const newGuest = guestScore + (out === "guest_win" ? 1 : 0);
        if (newHost < target && newGuest < target) {
            tx.delete(hPref);
            tx.delete(gPref);
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
        const ecoH = (0, gameEconomy_1.resolveMatchEconomy)("ppt", hostRes, 0, metaBase);
        const ecoG = (0, gameEconomy_1.resolveMatchEconomy)("ppt", guestRes, 0, metaBase);
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
        tx.delete(hPref);
        tx.delete(gPref);
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
    const ecoH = (0, gameEconomy_1.resolveMatchEconomy)("ppt", hostRes, 0, metaBase);
    const ecoG = (0, gameEconomy_1.resolveMatchEconomy)("ppt", guestRes, 0, metaBase);
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
/** Desistência explícita ou sair da sala: quem chama perde; oponente vence (PPT). */
exports.forfeitPvpRoom = (0, https_1.onCall)(async (request) => {
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
        if (String(r.gameId) !== "ppt") {
            throw new https_1.HttpsError("failed-precondition", "W.O. disponível só em salas PPT.");
        }
        if (r.pptRewardsApplied === true || r.phase === "completed" || r.status === "completed") {
            return { applied: false };
        }
        const out = await applyPptForfeitInTransaction(tx, roomRef, roomId, r, uid);
        return { applied: true, ...out };
    });
    if (result.applied) {
        await postPptMatchRankingFromWinner(roomId, result.hostUid, result.guestUid, result.matchWinner, { forfeitedByUid: uid });
    }
    return { ok: true, applied: result.applied, matchWinner: result.applied ? result.matchWinner : null };
});
/** Ping de presença na partida PPT; se o oponente ficar sem sinal, vitória por W.O. */
exports.pvpPptPresence = (0, https_1.onCall)(async (request) => {
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
exports.riskAnalysisOnUserEvent = (0, https_1.onCall)(async (request) => {
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