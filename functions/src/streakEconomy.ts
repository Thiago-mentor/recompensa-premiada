export type StreakTier = {
  dia: number;
  coins: number;
  gems: number;
  tipoBonus: "nenhum" | "bau" | "especial";
};

const TIPOS = new Set(["nenhum", "bau", "especial"]);

export function normalizeStreakTable(raw: unknown): StreakTier[] {
  if (!Array.isArray(raw)) return [];
  const out: StreakTier[] = [];
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
    const tipoBonus = (TIPOS.has(tipoRaw) ? tipoRaw : "nenhum") as StreakTier["tipoBonus"];
    out.push({ dia, coins, gems, tipoBonus });
  }
  out.sort((a, b) => a.dia - b.dia);
  return out;
}

export function resolveStreakRewardForDay(
  streak: number,
  table: StreakTier[],
  dailyLoginBonus: number,
): StreakTier {
  const tier = table.find((t) => t.dia === streak);
  if (tier) {
    return { dia: tier.dia, coins: tier.coins, gems: tier.gems, tipoBonus: tier.tipoBonus };
  }
  const fb = Math.max(0, Math.floor(Number(dailyLoginBonus)) || 0);
  return { dia: streak, coins: fb, gems: 0, tipoBonus: "nenhum" };
}
