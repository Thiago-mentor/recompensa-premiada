"use client";

import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";

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
