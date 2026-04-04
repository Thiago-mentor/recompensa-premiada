"use client";

import {
  collection,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";

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
