export const RAFFLE_NUMBER_LENGTH = 6;
export const RAFFLE_MAX_RELEASED_COUNT = 1_000_000;
export const RAFFLE_DEFAULT_TICKET_PRICE = 1;
export const RAFFLE_DEFAULT_RELEASED_COUNT = 10_000;
export const RAFFLE_DEFAULT_MAX_PER_PURCHASE = 20;
export const RAFFLE_DEFAULT_DRAW_TIME_ZONE = "America/Sao_Paulo";
export const RAFFLE_RELEASE_PRESETS = [
  { id: "dezena", label: "Dezena", value: 100, compactRangeLabel: "00 a 99" },
  { id: "centena", label: "Centena", value: 1_000, compactRangeLabel: "000 a 999" },
  { id: "milhar", label: "Milhar", value: 10_000, compactRangeLabel: "0000 a 9999" },
  {
    id: "dezena_milhar",
    label: "Dezena de Milhar",
    value: 100_000,
    compactRangeLabel: "00000 a 99999",
  },
  {
    id: "centena_milhar",
    label: "Milhao",
    value: 1_000_000,
    compactRangeLabel: "000000 a 999999",
  },
] as const;

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

type RaffleDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function raffleDateTimeParts(d: Date, timeZone = RAFFLE_DEFAULT_DRAW_TIME_ZONE): RaffleDateTimeParts {
  const values: Record<string, string> = {};
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  for (const part of formatter.formatToParts(d)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function raffleDateTimeToUtcMs(
  parts: Pick<RaffleDateTimeParts, "year" | "month" | "day"> &
    Partial<Pick<RaffleDateTimeParts, "hour" | "minute" | "second">>,
  timeZone = RAFFLE_DEFAULT_DRAW_TIME_ZONE,
): number {
  const hour = parts.hour ?? 0;
  const minute = parts.minute ?? 0;
  const second = parts.second ?? 0;
  const approxUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, second);
  const offsetParts = raffleDateTimeParts(new Date(approxUtc), timeZone);
  const offsetUtc = Date.UTC(
    offsetParts.year,
    offsetParts.month - 1,
    offsetParts.day,
    offsetParts.hour,
    offsetParts.minute,
    offsetParts.second,
  );
  return approxUtc - (offsetUtc - approxUtc);
}

function raffleWeekdayFromLocalDate(parts: Pick<RaffleDateTimeParts, "year" | "month" | "day">): number {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function raffleLocalDatePlusDays(
  parts: Pick<RaffleDateTimeParts, "year" | "month" | "day">,
  days: number,
): Pick<RaffleDateTimeParts, "year" | "month" | "day"> {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + days);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function canUseSameDayFederalResult(parts: Pick<RaffleDateTimeParts, "hour" | "minute" | "second">): boolean {
  if (parts.hour < 19) return true;
  if (parts.hour > 19) return false;
  if (parts.minute > 0) return false;
  return parts.second === 0;
}

export function getRaffleNumberDigits(releasedCount: number): number {
  const normalizedReleasedCount = Math.max(1, Math.floor(Number(releasedCount) || 0));
  return Math.max(1, String(Math.max(0, normalizedReleasedCount - 1)).length);
}

export function formatRaffleNumber(
  value: number | string | null | undefined,
  minDigits = RAFFLE_NUMBER_LENGTH,
): string {
  const numeric = Math.max(0, Math.floor(Number(value) || 0));
  return String(numeric).padStart(Math.max(1, Math.floor(minDigits) || 1), "0");
}

export function formatRaffleRange(start: number, end: number, minDigits = RAFFLE_NUMBER_LENGTH): string {
  return `${formatRaffleNumber(start, minDigits)} - ${formatRaffleNumber(end, minDigits)}`;
}

export function formatRaffleScopedNumber(value: number | string | null | undefined, releasedCount: number): string {
  return formatRaffleNumber(value, getRaffleNumberDigits(releasedCount));
}

export function formatRaffleScopedRange(start: number, end: number, releasedCount: number): string {
  return formatRaffleRange(start, end, getRaffleNumberDigits(releasedCount));
}

export function getRaffleProgressPercent(soldCount: number, releasedCount: number): number {
  const total = Math.max(1, Math.floor(Number(releasedCount) || 0));
  const sold = Math.max(0, Math.floor(Number(soldCount) || 0));
  return Math.max(0, Math.min(100, Math.round((sold / total) * 100)));
}

export function formatRaffleReleasedRangeLabel(releasedCount: number): string {
  const normalizedReleasedCount = Math.max(1, Math.floor(Number(releasedCount) || 0));
  const preset = RAFFLE_RELEASE_PRESETS.find((item) => item.value === normalizedReleasedCount);
  if (preset) return preset.compactRangeLabel;
  return `${formatRaffleScopedNumber(0, normalizedReleasedCount)} a ${formatRaffleScopedNumber(
    normalizedReleasedCount - 1,
    normalizedReleasedCount,
  )}`;
}

export function computeRaffleResultScheduleMs(
  closedAtMs: number | null | undefined,
  timeZone = RAFFLE_DEFAULT_DRAW_TIME_ZONE,
): number | null {
  if (closedAtMs == null || !Number.isFinite(closedAtMs)) return null;
  const closedParts = raffleDateTimeParts(new Date(closedAtMs), timeZone);
  for (let offset = 0; offset < 8; offset += 1) {
    const candidateDate = raffleLocalDatePlusDays(closedParts, offset);
    const weekDay = raffleWeekdayFromLocalDate(candidateDate);
    const isFederalDay = weekDay === 3 || weekDay === 6;
    if (!isFederalDay) continue;
    if (offset === 0 && !canUseSameDayFederalResult(closedParts)) continue;
    return raffleDateTimeToUtcMs(
      {
        ...candidateDate,
        hour: 20,
        minute: 0,
        second: 0,
      },
      timeZone,
    );
  }
  return null;
}
