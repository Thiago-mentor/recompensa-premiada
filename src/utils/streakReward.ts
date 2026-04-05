import type { StreakRewardTier } from "@/types/systemConfig";

const TIPOS = new Set(["nenhum", "bau", "especial"]);

/** Lê `streakTable` do Firestore com valores seguros. */
export function normalizeStreakTable(raw: unknown): StreakRewardTier[] {
  if (!Array.isArray(raw)) return [];
  const out: StreakRewardTier[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const dia = Math.floor(Number(rec.dia));
    const coins = Math.floor(Number(rec.coins));
    const gems = Math.floor(Number(rec.gems));
    const tipoRaw = String(rec.tipoBonus ?? "nenhum");
    if (!Number.isFinite(dia) || dia < 1) continue;
    if (!Number.isFinite(coins) || coins < 0) continue;
    if (!Number.isFinite(gems) || gems < 0) continue;
    const tipoBonus = TIPOS.has(tipoRaw) ? (tipoRaw as StreakRewardTier["tipoBonus"]) : "nenhum";
    out.push({ dia, coins, gems, tipoBonus });
  }
  out.sort((a, b) => a.dia - b.dia);
  return out;
}

/**
 * Marco exato: se existir linha com `dia === streak`, usa coins/gems/tipoBonus dela;
 * senão usa `dailyLoginBonus` (só coins).
 */
export function resolveStreakRewardForDay(
  streak: number,
  table: StreakRewardTier[],
  dailyLoginBonus: number,
): { coins: number; gems: number; tipoBonus: StreakRewardTier["tipoBonus"] } {
  const tier = table.find((t) => t.dia === streak);
  if (tier) {
    return { coins: tier.coins, gems: tier.gems, tipoBonus: tier.tipoBonus };
  }
  const fb = Math.max(0, Math.floor(Number(dailyLoginBonus)) || 0);
  return { coins: fb, gems: 0, tipoBonus: "nenhum" };
}

/** Primeiro marco na tabela com `dia` estritamente maior que a sequência atual. */
export function getNextStreakMilestone(
  streak: number,
  table: StreakRewardTier[],
): { tier: StreakRewardTier; daysUntil: number } | null {
  const s = Math.max(0, Math.floor(Number(streak)) || 0);
  const sorted = [...table].sort((a, b) => a.dia - b.dia);
  const next = sorted.find((t) => t.dia > s);
  if (!next) return null;
  return { tier: next, daysUntil: next.dia - s };
}

export function formatStreakRewardShort(r: {
  coins: number;
  gems: number;
  tipoBonus: StreakRewardTier["tipoBonus"];
}): string {
  const bits: string[] = [];
  if (r.coins > 0) bits.push(`+${r.coins} PR`);
  if (r.gems > 0) bits.push(`+${r.gems} TICKET`);
  if (r.tipoBonus === "bau") bits.push("baú");
  if (r.tipoBonus === "especial") bits.push("especial");
  return bits.length > 0 ? bits.join(" · ") : "só sequência";
}
