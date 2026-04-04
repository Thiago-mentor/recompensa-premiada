"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { SPARK_ECONOMY } from "@/lib/constants/sparkEconomy";

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
