"use client";

import {
  collection,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS, SUBCOLLECTIONS } from "@/lib/constants/collections";

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
      const m = mSnap.data() as {
        titulo?: string;
        recompensaCoins?: number;
        recompensaGems?: number;
        recompensaXP?: number;
      };
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
