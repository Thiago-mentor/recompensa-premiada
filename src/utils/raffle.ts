export const RAFFLE_NUMBER_LENGTH = 6;
export const RAFFLE_MAX_RELEASED_COUNT = 1_000_000;
export const RAFFLE_DEFAULT_TICKET_PRICE = 1;
export const RAFFLE_DEFAULT_RELEASED_COUNT = 10_000;
export const RAFFLE_DEFAULT_MAX_PER_PURCHASE = 20;
export const RAFFLE_DEFAULT_DRAW_TIME_ZONE = "America/Sao_Paulo";

export function clampRaffleReleasedCount(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return RAFFLE_DEFAULT_RELEASED_COUNT;
  return Math.min(RAFFLE_MAX_RELEASED_COUNT, Math.max(1, parsed));
}

export function clampRaffleTicketPrice(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return RAFFLE_DEFAULT_TICKET_PRICE;
  return Math.max(1, parsed);
}

export function clampRaffleMaxPerPurchase(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return RAFFLE_DEFAULT_MAX_PER_PURCHASE;
  return Math.min(500, Math.max(1, parsed));
}

export function formatRaffleNumber(value: number | string | null | undefined): string {
  const numeric = Math.max(0, Math.floor(Number(value) || 0));
  return String(numeric).padStart(RAFFLE_NUMBER_LENGTH, "0");
}

export function formatRaffleRange(start: number, end: number): string {
  return `${formatRaffleNumber(start)} - ${formatRaffleNumber(end)}`;
}
