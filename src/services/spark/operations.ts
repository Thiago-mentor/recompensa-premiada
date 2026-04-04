"use client";

import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS, SUBCOLLECTIONS } from "@/lib/constants/collections";
import {
  PPT_DEFAULT_DUEL_CHARGES,
  PPT_DUEL_CHARGES_MAX_STACK,
  PPT_DUEL_CHARGES_PER_AD,
  PPT_PVP_DUELS_PLACEMENT_ID,
} from "@/lib/constants/pptPvp";
import { SPARK_ECONOMY } from "@/lib/constants/sparkEconomy";
import { getDailyPeriodKey, getMonthlyPeriodKey, getWeeklyPeriodKey } from "@/utils/date";
import type { GameId } from "@/types/game";
import {
  cooldownRemainingMs,
  resolveMatchEconomy,
  GAME_COOLDOWN_SEC,
  MAX_MATCHES_PER_MINUTE,
} from "@/lib/games/gameEconomy";

function randomInviteCode(len = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function sparkCreateUserProfile(input: {
  uid: string;
  nome: string;
  username: string;
  foto: string | null;
  email: string | null;
  codigoConviteOpcional?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const db = getFirebaseFirestore();
  const userRef = doc(db, COLLECTIONS.users, input.uid);
  const existingUser = await getDoc(userRef);
  if (existingUser.exists()) return { ok: true };

  const uname = input.username.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (uname.length < 3) return { ok: false, error: "Username inválido." };

  const dup = await getDocs(
    query(collection(db, COLLECTIONS.users), where("username", "==", uname), limit(1)),
  );
  if (!dup.empty) return { ok: false, error: "Username já em uso." };

  let convidadoPor: string | null = null;
  if (input.codigoConviteOpcional?.trim()) {
    const code = input.codigoConviteOpcional.trim().toUpperCase();
    const inv = await getDocs(
      query(collection(db, COLLECTIONS.users), where("codigoConvite", "==", code), limit(1)),
    );
    if (!inv.empty && inv.docs[0].id !== input.uid) convidadoPor = inv.docs[0].id;
  }

  const welcome = SPARK_ECONOMY.welcomeBonus;
  const codigo = randomInviteCode();
  const batch = writeBatch(db);
  batch.set(userRef, {
    uid: input.uid,
    nome: input.nome.trim(),
    email: input.email,
    foto: input.foto,
    username: uname,
    codigoConvite: codigo,
    convidadoPor,
    coins: welcome,
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
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  const wRef = doc(collection(db, COLLECTIONS.walletTransactions));
  batch.set(wRef, {
    userId: input.uid,
    tipo: "bonus_admin",
    moeda: "coins",
    valor: welcome,
    saldoApos: welcome,
    descricao: "Bônus de boas-vindas",
    referenciaId: "welcome",
    criadoEm: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha ao criar perfil (regras Firestore / modo Spark).",
    };
  }
  return { ok: true };
}

export async function sparkProcessDailyLogin(
  uid: string,
): Promise<{ ok: boolean; streak?: number; coins?: number; error?: string }> {
  const db = getFirebaseFirestore();
  const userRef = doc(db, COLLECTIONS.users, uid);
  const bonus = SPARK_ECONOMY.dailyLoginBonus;
  try {
    const out = await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error("Perfil inexistente.");
      const u = snap.data() as Record<string, unknown>;
      if (u.banido === true) throw new Error("Conta suspensa.");

      const now = new Date();
      const todayKey = getDailyPeriodKey(now);
      const yesterday = new Date(now);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yKey = getDailyPeriodKey(yesterday);

      const lastTs = u.ultimaEntradaEm as { toDate?: () => Date } | null | undefined;
      const last = lastTs?.toDate?.();
      let streak = Number(u.streakAtual || 0);
      if (!last) streak = 1;
      else {
        const lastKey = getDailyPeriodKey(last);
        if (lastKey === todayKey) {
          return { streak, coins: 0, skipWallet: true };
        }
        if (lastKey === yKey) streak += 1;
        else streak = 1;
      }
      const melhor = Math.max(Number(u.melhorStreak || 0), streak);
      const newCoins = Number(u.coins || 0) + bonus;

      tx.update(userRef, {
        streakAtual: streak,
        melhorStreak: melhor,
        ultimaEntradaEm: Timestamp.fromDate(now),
        coins: increment(bonus),
        atualizadoEm: serverTimestamp(),
      });

      const wRef = doc(collection(db, COLLECTIONS.walletTransactions));
      tx.set(wRef, {
        userId: uid,
        tipo: "streak",
        moeda: "coins",
        valor: bonus,
        saldoApos: newCoins,
        descricao: "Login diário / streak",
        referenciaId: todayKey,
        criadoEm: serverTimestamp(),
      });
      return { streak, coins: bonus, skipWallet: false };
    });
    return { ok: true, streak: out.streak, coins: out.coins };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro no login diário." };
  }
}

function readPptDuelsSpark(data: Record<string, unknown> | undefined): number {
  if (!data) return PPT_DEFAULT_DUEL_CHARGES;
  const v = Number(data.pptPvPDuelsRemaining);
  if (Number.isFinite(v) && v >= 0) {
    return Math.min(PPT_DUEL_CHARGES_MAX_STACK, Math.floor(v));
  }
  return PPT_DEFAULT_DUEL_CHARGES;
}

export async function sparkProcessRewardedAd(input: {
  uid: string;
  placementId: string;
}): Promise<{
  ok: boolean;
  coins?: number;
  pptPvPDuelsAdded?: number;
  pptPvPDuelsRemaining?: number;
  error?: string;
}> {
  const db = getFirebaseFirestore();
  const uid = input.uid;
  const userRef = doc(db, COLLECTIONS.users, uid);
  const coins = SPARK_ECONOMY.rewardAdCoinAmount;
  const maxAds = SPARK_ECONOMY.limiteDiarioAds;
  const isPptDuels = input.placementId === PPT_PVP_DUELS_PLACEMENT_ID;

  try {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);

    const counted = await getDocs(
      query(
        collection(db, COLLECTIONS.adEvents),
        where("userId", "==", uid),
        where("status", "==", "recompensado"),
        where("criadoEm", ">=", Timestamp.fromDate(start)),
      ),
    );
    if (counted.size >= maxAds) {
      return { ok: false, error: "Limite diário de anúncios atingido." };
    }

    const uSnap = await getDoc(userRef);
    if (!uSnap.exists()) return { ok: false, error: "Perfil inexistente." };
    const u = uSnap.data() as { coins?: number; banido?: boolean };
    if (u.banido) return { ok: false, error: "Conta suspensa." };

    const dayKey = getDailyPeriodKey();
    const bumpMissions = async () => {
      const missions = await getDocs(
        query(
          collection(db, COLLECTIONS.missions),
          where("ativa", "==", true),
          where("eventKey", "==", "watch_ad"),
        ),
      );
      for (const m of missions.docs) {
        const progRef = doc(
          db,
          COLLECTIONS.userMissions,
          uid,
          SUBCOLLECTIONS.userMissionsDaily,
          m.id,
        );
        const pSnap = await getDoc(progRef);
        const meta = Number(m.data().meta || 1);
        const cur = pSnap.exists() ? Number(pSnap.data()?.progresso || 0) : 0;
        const next = Math.min(meta, cur + 1);
        const mb = writeBatch(db);
        mb.set(
          progRef,
          {
            missionId: m.id,
            progresso: next,
            concluida: next >= meta,
            recompensaResgatada: pSnap.data()?.recompensaResgatada ?? false,
            atualizadoEm: serverTimestamp(),
            periodoChave: dayKey,
          },
          { merge: true },
        );
        await mb.commit();
      }
    };

    if (isPptDuels) {
      const cur = readPptDuelsSpark(uSnap.data() as Record<string, unknown>);
      const capped = Math.min(PPT_DUEL_CHARGES_MAX_STACK, cur + PPT_DUEL_CHARGES_PER_AD);
      const added = capped - cur;
      const batch = writeBatch(db);
      const adRef = doc(collection(db, COLLECTIONS.adEvents));
      batch.set(adRef, {
        id: adRef.id,
        userId: uid,
        status: "recompensado",
        placementId: input.placementId,
        rewardKind: "ppt_pvp_duels",
        mock: true,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });
      batch.update(userRef, {
        pptPvPDuelsRemaining: capped,
        pptPvpDuelsRefillAvailableAt: deleteField(),
        totalAdsAssistidos: increment(1),
        atualizadoEm: serverTimestamp(),
      });
      await batch.commit();
      await bumpMissions();
      return {
        ok: true,
        coins: 0,
        pptPvPDuelsAdded: added,
        pptPvPDuelsRemaining: capped,
      };
    }

    const newCoins = Number(u.coins || 0) + coins;

    const batch = writeBatch(db);
    const adRef = doc(collection(db, COLLECTIONS.adEvents));
    batch.set(adRef, {
      id: adRef.id,
      userId: uid,
      status: "recompensado",
      placementId: input.placementId,
      mock: true,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    batch.update(userRef, {
      coins: increment(coins),
      totalAdsAssistidos: increment(1),
      atualizadoEm: serverTimestamp(),
    });
    const wRef = doc(collection(db, COLLECTIONS.walletTransactions));
    batch.set(wRef, {
      userId: uid,
      tipo: "anuncio",
      moeda: "coins",
      valor: coins,
      saldoApos: newCoins,
      descricao: "Anúncio recompensado",
      referenciaId: adRef.id,
      criadoEm: serverTimestamp(),
    });
    await batch.commit();

    await bumpMissions();

    return { ok: true, coins };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro no anúncio." };
  }
}

async function sparkUpsertRanking(
  uid: string,
  nome: string,
  foto: string | null,
  deltaScore: number,
  win: boolean,
): Promise<void> {
  const db = getFirebaseFirestore();
  const batch = writeBatch(db);
  const userRef = doc(db, COLLECTIONS.users, uid);
  batch.update(userRef, {
    scoreRankingDiario: increment(deltaScore),
    scoreRankingSemanal: increment(deltaScore),
    scoreRankingMensal: increment(deltaScore),
    atualizadoEm: serverTimestamp(),
  });

  const periods: { col: string; key: string }[] = [
    { col: COLLECTIONS.rankingsDaily, key: getDailyPeriodKey() },
    { col: COLLECTIONS.rankingsWeekly, key: getWeeklyPeriodKey() },
    { col: COLLECTIONS.rankingsMonthly, key: getMonthlyPeriodKey() },
  ];
  for (const p of periods) {
    const entryRef = doc(db, p.col, p.key, "entries", uid);
    batch.set(
      entryRef,
      {
        uid,
        nome,
        foto,
        score: increment(deltaScore),
        partidas: increment(1),
        vitorias: increment(win ? 1 : 0),
        atualizadoEm: serverTimestamp(),
      },
      { merge: true },
    );
  }
  await batch.commit();
}

function sparkNextBurst(
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

export async function sparkFinalizeMatch(input: {
  uid: string;
  gameId: GameId;
  resultado: "vitoria" | "derrota" | "empate";
  score: number;
  detalhes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  opponentId?: string | null;
  startedAt?: string | null;
}): Promise<{ ok: boolean; rewardCoins?: number; rankingPoints?: number; error?: string }> {
  const db = getFirebaseFirestore();
  const uid = input.uid;
  const userRef = doc(db, COLLECTIONS.users, uid);
  try {
    if (GAME_COOLDOWN_SEC[input.gameId] === undefined) {
      return { ok: false, error: "Jogo inválido." };
    }

    const uSnap = await getDoc(userRef);
    if (!uSnap.exists()) return { ok: false, error: "Perfil inexistente." };
    const u = uSnap.data() as Record<string, unknown> & {
      banido?: boolean;
      nome?: string;
      foto?: string | null;
      coins?: number;
      gameCooldownUntil?: Record<string, unknown>;
    };
    if (u.banido) return { ok: false, error: "Conta suspensa." };

    const now = Date.now();
    const remain = cooldownRemainingMs(input.gameId, u.gameCooldownUntil, now);
    if (remain > 0) {
      return { ok: false, error: `Aguarde ${Math.ceil(remain / 1000)}s para jogar de novo.` };
    }

    const burstR = sparkNextBurst(u, now);
    if (!burstR.ok) {
      return { ok: false, error: "Muitas partidas em sequência. Aguarde um minuto." };
    }

    const effectiveResult: "vitoria" | "derrota" | "empate" =
      input.gameId === "roleta" || input.gameId === "bau" ? "vitoria" : input.resultado;

    const metadata = { ...(input.detalhes ?? {}), ...(input.metadata ?? {}) };
    const economy = resolveMatchEconomy(
      input.gameId,
      effectiveResult,
      input.score,
      metadata,
    );

    const cdSec = GAME_COOLDOWN_SEC[input.gameId] ?? 3;
    const cooldownUntil = Timestamp.fromMillis(now + cdSec * 1000);

    let startedTs: Timestamp | null = null;
    if (input.startedAt) {
      const d = new Date(input.startedAt);
      if (!Number.isNaN(d.getTime()) && now - d.getTime() < 15 * 60 * 1000 && d.getTime() <= now) {
        startedTs = Timestamp.fromDate(d);
      }
    }

    const win = effectiveResult === "vitoria";
    const loss = effectiveResult === "derrota";
    const rewardCoins = economy.rewardCoins;
    const rankingPoints = economy.rankingPoints;
    const newCoins = Number(u.coins || 0) + rewardCoins;
    const finishedTs = Timestamp.now();

    const batch = writeBatch(db);
    const matchRef = doc(collection(db, COLLECTIONS.matches));
    batch.set(matchRef, {
      id: matchRef.id,
      gameId: input.gameId,
      gameType: input.gameId,
      userId: uid,
      opponentId: input.opponentId ?? null,
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
      criadoEm: serverTimestamp(),
    });

    batch.update(userRef, {
      totalPartidas: increment(1),
      totalVitorias: increment(win ? 1 : 0),
      totalDerrotas: increment(loss ? 1 : 0),
      coins: increment(rewardCoins),
      xp: increment(win ? 15 : effectiveResult === "empate" ? 8 : 5),
      atualizadoEm: serverTimestamp(),
      matchBurst: burstR.burst,
      [`gameCooldownUntil.${input.gameId}`]: cooldownUntil,
    });

    if (rewardCoins > 0) {
      const wRef = doc(collection(db, COLLECTIONS.walletTransactions));
      batch.set(wRef, {
        userId: uid,
        tipo: "jogo",
        moeda: "coins",
        valor: rewardCoins,
        saldoApos: newCoins,
        descricao: `Minijogo ${input.gameId}`,
        referenciaId: matchRef.id,
        criadoEm: serverTimestamp(),
      });
    }
    await batch.commit();

    await sparkUpsertRanking(
      uid,
      String(u.nome || "Jogador"),
      (u.foto as string | null) ?? null,
      rankingPoints,
      win,
    );

    const dayKey = getDailyPeriodKey();
    const missions = await getDocs(
      query(
        collection(db, COLLECTIONS.missions),
        where("ativa", "==", true),
        where("eventKey", "==", "play_match"),
      ),
    );
    for (const m of missions.docs) {
      const progRef = doc(
        db,
        COLLECTIONS.userMissions,
        uid,
        SUBCOLLECTIONS.userMissionsDaily,
        m.id,
      );
      const pSnap = await getDoc(progRef);
      const meta = Number(m.data().meta || 1);
      const cur = pSnap.exists() ? Number(pSnap.data()?.progresso || 0) : 0;
      const next = Math.min(meta, cur + 1);
      const mb = writeBatch(db);
      mb.set(
        progRef,
        {
          missionId: m.id,
          progresso: next,
          concluida: next >= meta,
          recompensaResgatada: pSnap.data()?.recompensaResgatada ?? false,
          atualizadoEm: serverTimestamp(),
          periodoChave: dayKey,
        },
        { merge: true },
      );
      await mb.commit();
    }

    return { ok: true, rewardCoins, rankingPoints };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar partida." };
  }
}

export async function sparkClaimMissionReward(
  uid: string,
  missionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = getFirebaseFirestore();
  const mRef = doc(db, COLLECTIONS.missions, missionId);
  const progRef = doc(
    db,
    COLLECTIONS.userMissions,
    uid,
    SUBCOLLECTIONS.userMissionsDaily,
    missionId,
  );
  const userRef = doc(db, COLLECTIONS.users, uid);

  try {
    await runTransaction(db, async (tx) => {
      const mSnap = await tx.get(mRef);
      if (!mSnap.exists()) throw new Error("Missão inexistente.");
      const m = mSnap.data() as { titulo?: string; recompensaCoins?: number; recompensaGems?: number; recompensaXP?: number };
      const pSnap = await tx.get(progRef);
      if (!pSnap.exists() || !pSnap.data()?.concluida) throw new Error("Missão não concluída.");
      if (pSnap.data()?.recompensaResgatada) throw new Error("Recompensa já resgatada.");
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists()) throw new Error("Perfil inexistente.");
      const u = uSnap.data() as { coins?: number };

      const c = Number(m.recompensaCoins || 0);
      const g = Number(m.recompensaGems || 0);
      const xp = Number(m.recompensaXP || 0);

      tx.update(userRef, {
        coins: increment(c),
        gems: increment(g),
        xp: increment(xp),
        atualizadoEm: serverTimestamp(),
      });
      tx.update(progRef, { recompensaResgatada: true, atualizadoEm: serverTimestamp() });

      if (c > 0) {
        const wRef = doc(collection(db, COLLECTIONS.walletTransactions));
        tx.set(wRef, {
          userId: uid,
          tipo: "missao",
          moeda: "coins",
          valor: c,
          saldoApos: Number(u.coins || 0) + c,
          descricao: `Missão: ${m.titulo || missionId}`,
          referenciaId: missionId,
          criadoEm: serverTimestamp(),
        });
      }
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao resgatar." };
  }
}

export async function sparkRequestRewardClaim(input: {
  uid: string;
  valor: number;
  tipo: "pix" | "voucher" | "outro";
  chavePix: string;
}): Promise<{ ok: boolean; error?: string }> {
  const db = getFirebaseFirestore();
  const userRef = doc(db, COLLECTIONS.users, input.uid);
  const uSnap = await getDoc(userRef);
  if (!uSnap.exists()) return { ok: false, error: "Perfil inexistente." };
  const bal = Number(uSnap.data()?.rewardBalance || 0);
  if (input.valor > bal) return { ok: false, error: "Saldo insuficiente." };

  try {
    const ref = doc(collection(db, COLLECTIONS.rewardClaims));
    const b = writeBatch(db);
    b.set(ref, {
      id: ref.id,
      userId: input.uid,
      valor: input.valor,
      tipo: input.tipo,
      chavePix: input.chavePix,
      status: "pendente",
      analisadoPor: null,
      motivoRecusa: null,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    await b.commit();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao solicitar." };
  }
}

export async function sparkReviewRewardClaim(input: {
  adminUid: string;
  claimId: string;
  status: "aprovado" | "recusado";
  motivo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const db = getFirebaseFirestore();
  const ref = doc(db, COLLECTIONS.rewardClaims, input.claimId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("Pedido inexistente.");
      const c = snap.data() as {
        status?: string;
        userId?: string;
        valor?: number;
      };
      if (c.status !== "pendente") throw new Error("Já analisado.");
      const userRef = doc(db, COLLECTIONS.users, String(c.userId));

      if (input.status === "aprovado") {
        const uSnap = await tx.get(userRef);
        const bal = Number(uSnap.data()?.rewardBalance || 0);
        if (bal < Number(c.valor || 0)) throw new Error("Saldo alterado.");
        tx.update(userRef, {
          rewardBalance: increment(-Number(c.valor)),
          atualizadoEm: serverTimestamp(),
        });
        tx.update(ref, {
          status: "aprovado",
          analisadoPor: input.adminUid,
          atualizadoEm: serverTimestamp(),
        });
      } else {
        tx.update(ref, {
          status: "recusado",
          analisadoPor: input.adminUid,
          motivoRecusa: input.motivo ?? "",
          atualizadoEm: serverTimestamp(),
        });
      }
    });

    if (input.status === "aprovado") {
      const snap = await getDoc(ref);
      const c = snap.data() as { userId?: string; valor?: number };
      const uR = doc(db, COLLECTIONS.users, String(c.userId));
      const after = await getDoc(uR);
      const saldoApos = Number(after.data()?.rewardBalance ?? 0);
      const wRef = doc(collection(db, COLLECTIONS.walletTransactions));
      const wb = writeBatch(db);
      wb.set(wRef, {
        userId: String(c.userId),
        tipo: "resgate",
        moeda: "rewardBalance",
        valor: -Number(c.valor),
        saldoApos,
        descricao: "Resgate aprovado",
        referenciaId: input.claimId,
        criadoEm: serverTimestamp(),
      });
      await wb.commit();
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro na análise." };
  }
}

export async function sparkLogFraudHint(input: {
  uid: string;
  tipo: string;
  detalhes?: Record<string, unknown>;
}): Promise<void> {
  const db = getFirebaseFirestore();
  const b = writeBatch(db);
  b.set(doc(collection(db, COLLECTIONS.fraudLogs)), {
    uid: input.uid,
    tipo: input.tipo,
    severidade: "baixa",
    detalhes: input.detalhes ?? {},
    origem: "client",
    timestamp: serverTimestamp(),
  });
  await b.commit();
}
