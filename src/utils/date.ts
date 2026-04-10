export const APP_PERIOD_TIME_ZONE = "America/Sao_Paulo";

type AppDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function getAppDateTimeParts(d = new Date()): AppDateTimeParts {
  const values: Record<string, string> = {};
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_PERIOD_TIME_ZONE,
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

function appDateTimeToUtcMs(parts: Pick<AppDateTimeParts, "year" | "month" | "day">): number {
  const approxUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  const offsetParts = getAppDateTimeParts(new Date(approxUtc));
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

/** Chave diária do app (YYYY-MM-DD) no fuso fixo `America/Sao_Paulo`. */
export function getDailyPeriodKey(d = new Date()): string {
  const parts = getAppDateTimeParts(d);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** Semana ISO do app usando a data local do fuso `America/Sao_Paulo`. */
export function getWeeklyPeriodKey(d = new Date()): string {
  const parts = getAppDateTimeParts(d);
  const t = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+t - +yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad2(week)}`;
}

/** Mês do app (YYYY-MM) no fuso fixo `America/Sao_Paulo`. */
export function getMonthlyPeriodKey(d = new Date()): string {
  const parts = getAppDateTimeParts(d);
  return `${parts.year}-${pad2(parts.month)}`;
}

/** Instante UTC em que começa o próximo dia do app (00:00 America/Sao_Paulo). */
export function getNextDailyPeriodStartMs(d = new Date()): number {
  const parts = getAppDateTimeParts(d);
  const nextDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return appDateTimeToUtcMs({
    year: nextDay.getUTCFullYear(),
    month: nextDay.getUTCMonth() + 1,
    day: nextDay.getUTCDate(),
  });
}
