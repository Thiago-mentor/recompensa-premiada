"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { callFunction } from "@/services/callables/client";

type ProcessDailyLoginData = {
  streak: number;
  coins: number;
  gems?: number;
  tipoBonus?: string;
  message?: string;
  alreadyCheckedIn?: boolean;
};

const MSG_ALREADY_TODAY =
  "Você já coletou a recompensa de hoje. Volte amanhã para manter a sequência.";

function formatDailyLoginSuccess(d: {
  coins: number;
  gems?: number;
  tipoBonus?: string;
}): string {
  const parts: string[] = [];
  if (d.coins > 0) parts.push(`+${d.coins} PR`);
  if (d.gems && d.gems > 0) parts.push(`+${d.gems} gems`);
  if (d.tipoBonus === "bau") parts.push("Marco: baú especial");
  if (d.tipoBonus === "especial") parts.push("Marco: bônus especial");
  if (parts.length === 0) return "Entrada registrada!";
  return `Entrada registrada! ${parts.join(" · ")}`;
}

export async function processDailyLogin(): Promise<{
  ok: boolean;
  streak?: number;
  coins?: number;
  gems?: number;
  alreadyCheckedIn?: boolean;
  message?: string;
  error?: string;
}> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return { ok: false, error: "Faça login novamente." };

  try {
    const res = await callFunction<Record<string, never>, ProcessDailyLoginData>(
      "processDailyLogin",
      {},
    );
    const d = res.data;
    if (!d || typeof d.streak !== "number") {
      return { ok: false, error: "Resposta inválida do servidor." };
    }
    if (d.alreadyCheckedIn === true || d.message === "already_checked_in") {
      return {
        ok: true,
        streak: d.streak,
        coins: 0,
        gems: 0,
        alreadyCheckedIn: true,
        message: MSG_ALREADY_TODAY,
      };
    }
    return {
      ok: true,
      streak: d.streak,
      coins: d.coins,
      gems: d.gems,
      alreadyCheckedIn: false,
      message: formatDailyLoginSuccess({
        coins: d.coins ?? 0,
        gems: d.gems,
        tipoBonus: d.tipoBonus,
      }),
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Não foi possível registrar a entrada.",
    };
  }
}
