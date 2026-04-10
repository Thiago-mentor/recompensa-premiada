import { Timestamp } from "firebase/firestore";
import type { UserProfile } from "@/types/user";
import { getDailyPeriodKey } from "@/utils/date";

export type DailyRewardUiState =
  | { kind: "claimed_today"; streak: number }
  | {
      kind: "can_claim";
      /** Dia da sequência que será creditado ao resgatar agora (1 = primeiro dia). */
      streakAfterClaim: number;
      /** Dias da sequência já concluídos antes do resgate de hoje. */
      completedBefore: number;
    };

function lastLoginDate(
  ultima: UserProfile["ultimaEntradaEm"] | null | undefined,
): Date | null {
  if (ultima == null || typeof ultima !== "object") return null;
  if (ultima instanceof Timestamp) return ultima.toDate();
  const withToDate = ultima as { toDate?: () => Date; seconds?: number };
  if (typeof withToDate.toDate === "function") return withToDate.toDate();
  if (typeof withToDate.seconds === "number" && Number.isFinite(withToDate.seconds)) {
    return new Date(withToDate.seconds * 1000);
  }
  return null;
}

/**
 * Alinha com a lógica do servidor (`processDailyLogin`): hoje / ontem / buraco.
 */
export function getDailyRewardUiState(
  profile: Pick<UserProfile, "streakAtual" | "ultimaEntradaEm"> | null,
  now = new Date(),
): DailyRewardUiState {
  const streak = Math.max(0, Math.floor(Number(profile?.streakAtual ?? 0)));
  const todayKey = getDailyPeriodKey(now);
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yKey = getDailyPeriodKey(yesterday);
  const last = lastLoginDate(profile?.ultimaEntradaEm ?? null);
  if (!last) {
    return { kind: "can_claim", streakAfterClaim: 1, completedBefore: 0 };
  }
  const lastKey = getDailyPeriodKey(last);
  if (lastKey === todayKey) {
    return { kind: "claimed_today", streak };
  }
  if (lastKey === yKey) {
    return { kind: "can_claim", streakAfterClaim: streak + 1, completedBefore: streak };
  }
  return { kind: "can_claim", streakAfterClaim: 1, completedBefore: 0 };
}

/** Janela de N dias da sequência com o “dia atual” visível (ex.: 7 slots). */
export function buildStreakDayWindow(centerDay: number, width = 7): number[] {
  const c = Math.max(1, Math.floor(centerDay));
  const w = Math.max(1, Math.floor(width));
  const half = Math.floor((w - 1) / 2);
  let start = Math.max(1, c - half);
  let end = start + w - 1;
  if (c > end) {
    start = Math.max(1, c - w + 1);
    end = start + w - 1;
  }
  if (start === 1) end = w;
  return Array.from({ length: Math.max(1, end - start + 1) }, (_, i) => start + i);
}
