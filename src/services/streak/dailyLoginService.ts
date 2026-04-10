"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { callFunction } from "@/services/callables/client";
import type { GrantedChestSummary } from "@/types/chest";

type ProcessDailyLoginData = {
  streak: number;
  coins: number;
  boostCoins?: number;
  gems?: number;
  tipoBonus?: string;
  message?: string;
  alreadyCheckedIn?: boolean;
  grantedChest?: GrantedChestSummary | null;
};

const MSG_ALREADY_TODAY =
  "Você já coletou a recompensa de hoje. Volte amanhã para manter a sequência.";

function formatDailyLoginSuccess(d: {
  coins: number;
  boostCoins?: number;
  gems?: number;
  tipoBonus?: string;
}): string {
  const parts: string[] = [];
  if (d.coins > 0) parts.push(`+${d.coins} PR`);
  if (d.boostCoins && d.boostCoins > 0) parts.push(`boost +${d.boostCoins} PR`);
  if (d.gems && d.gems > 0) parts.push(`+${d.gems} TICKET`);
  if (d.tipoBonus === "bau") parts.push("Marco: baú especial");
  if (d.tipoBonus === "especial") parts.push("Marco: bônus especial");
  if (parts.length === 0) return "Entrada registrada!";
  return `Entrada registrada! ${parts.join(" · ")}`;
}

export async function processDailyLogin(): Promise<{
  ok: boolean;
  streak?: number;
  coins?: number;
  boostCoins?: number;
  gems?: number;
  alreadyCheckedIn?: boolean;
  grantedChest?: GrantedChestSummary | null;
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
        grantedChest: null,
        message: MSG_ALREADY_TODAY,
      };
    }
    return {
      ok: true,
      streak: d.streak,
      coins: d.coins,
        boostCoins: d.boostCoins,
      gems: d.gems,
      alreadyCheckedIn: false,
      grantedChest: d.grantedChest ?? null,
      message: formatDailyLoginSuccess({
        coins: d.coins ?? 0,
          boostCoins: d.boostCoins,
        gems: d.gems,
        tipoBonus: d.tipoBonus,
      }),
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: formatFirebaseError(e),
    };
  }
}
