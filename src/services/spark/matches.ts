"use client";

import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS, SUBCOLLECTIONS } from "@/lib/constants/collections";
import { getDailyPeriodKey, getMonthlyPeriodKey, getWeeklyPeriodKey } from "@/utils/date";
import type { GameId } from "@/types/game";
import {
  cooldownRemainingMs,
  resolveMatchEconomy,
  GAME_COOLDOWN_SEC,
  MAX_MATCHES_PER_MINUTE,
} from "@/lib/games/gameEconomy";

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
