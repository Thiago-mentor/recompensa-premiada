"use client";

import {
  Timestamp,
  collection,
  deleteField,
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
import {
  PPT_DEFAULT_DUEL_CHARGES,
  PPT_DUEL_CHARGES_MAX_STACK,
  PPT_DUEL_CHARGES_PER_AD,
  PPT_PVP_DUELS_PLACEMENT_ID,
} from "@/lib/constants/pptPvp";
import {
  QUIZ_DEFAULT_DUEL_CHARGES,
  QUIZ_DUEL_CHARGES_MAX_STACK,
  QUIZ_DUEL_CHARGES_PER_AD,
  QUIZ_PVP_DUELS_PLACEMENT_ID,
} from "@/lib/constants/quizPvp";
import {
  REACTION_DEFAULT_DUEL_CHARGES,
  REACTION_DUEL_CHARGES_MAX_STACK,
  REACTION_DUEL_CHARGES_PER_AD,
  REACTION_PVP_DUELS_PLACEMENT_ID,
} from "@/lib/constants/reactionPvp";
import { SPARK_ECONOMY } from "@/lib/constants/sparkEconomy";
import { getDailyPeriodKey } from "@/utils/date";

function readPptDuelsSpark(data: Record<string, unknown> | undefined): number {
  if (!data) return PPT_DEFAULT_DUEL_CHARGES;
  const v = Number(data.pptPvPDuelsRemaining);
  if (Number.isFinite(v) && v >= 0) {
    return Math.min(PPT_DUEL_CHARGES_MAX_STACK, Math.floor(v));
  }
  return PPT_DEFAULT_DUEL_CHARGES;
}

function readReactionDuelsSpark(data: Record<string, unknown> | undefined): number {
  if (!data) return REACTION_DEFAULT_DUEL_CHARGES;
  const v = Number(data.reactionPvPDuelsRemaining);
  if (Number.isFinite(v) && v >= 0) {
    return Math.min(REACTION_DUEL_CHARGES_MAX_STACK, Math.floor(v));
  }
  return REACTION_DEFAULT_DUEL_CHARGES;
}

function readQuizDuelsSpark(data: Record<string, unknown> | undefined): number {
  if (!data) return QUIZ_DEFAULT_DUEL_CHARGES;
  const v = Number(data.quizPvPDuelsRemaining);
  if (Number.isFinite(v) && v >= 0) {
    return Math.min(QUIZ_DUEL_CHARGES_MAX_STACK, Math.floor(v));
  }
  return QUIZ_DEFAULT_DUEL_CHARGES;
}

export async function sparkProcessRewardedAd(input: {
  uid: string;
  placementId: string;
}): Promise<{
  ok: boolean;
  coins?: number;
  pptPvPDuelsAdded?: number;
  pptPvPDuelsRemaining?: number;
  quizPvPDuelsAdded?: number;
  quizPvPDuelsRemaining?: number;
  reactionPvPDuelsAdded?: number;
  reactionPvPDuelsRemaining?: number;
  error?: string;
}> {
  const db = getFirebaseFirestore();
  const uid = input.uid;
  const userRef = doc(db, COLLECTIONS.users, uid);
  const coins = SPARK_ECONOMY.rewardAdCoinAmount;
  const maxAds = SPARK_ECONOMY.limiteDiarioAds;
  const isPptDuels = input.placementId === PPT_PVP_DUELS_PLACEMENT_ID;
  const isQuizDuels = input.placementId === QUIZ_PVP_DUELS_PLACEMENT_ID;
  const isReactionDuels = input.placementId === REACTION_PVP_DUELS_PLACEMENT_ID;

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

    if (isQuizDuels) {
      const cur = readQuizDuelsSpark(uSnap.data() as Record<string, unknown>);
      const capped = Math.min(QUIZ_DUEL_CHARGES_MAX_STACK, cur + QUIZ_DUEL_CHARGES_PER_AD);
      const added = capped - cur;
      const batch = writeBatch(db);
      const adRef = doc(collection(db, COLLECTIONS.adEvents));
      batch.set(adRef, {
        id: adRef.id,
        userId: uid,
        status: "recompensado",
        placementId: input.placementId,
        rewardKind: "quiz_pvp_duels",
        mock: true,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });
      batch.update(userRef, {
        quizPvPDuelsRemaining: capped,
        quizPvpDuelsRefillAvailableAt: deleteField(),
        totalAdsAssistidos: increment(1),
        atualizadoEm: serverTimestamp(),
      });
      await batch.commit();
      await bumpMissions();
      return {
        ok: true,
        coins: 0,
        quizPvPDuelsAdded: added,
        quizPvPDuelsRemaining: capped,
      };
    }

    if (isReactionDuels) {
      const cur = readReactionDuelsSpark(uSnap.data() as Record<string, unknown>);
      const capped = Math.min(REACTION_DUEL_CHARGES_MAX_STACK, cur + REACTION_DUEL_CHARGES_PER_AD);
      const added = capped - cur;
      const batch = writeBatch(db);
      const adRef = doc(collection(db, COLLECTIONS.adEvents));
      batch.set(adRef, {
        id: adRef.id,
        userId: uid,
        status: "recompensado",
        placementId: input.placementId,
        rewardKind: "reaction_pvp_duels",
        mock: true,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });
      batch.update(userRef, {
        reactionPvPDuelsRemaining: capped,
        reactionPvpDuelsRefillAvailableAt: deleteField(),
        totalAdsAssistidos: increment(1),
        atualizadoEm: serverTimestamp(),
      });
      await batch.commit();
      await bumpMissions();
      return {
        ok: true,
        coins: 0,
        reactionPvPDuelsAdded: added,
        reactionPvPDuelsRemaining: capped,
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
