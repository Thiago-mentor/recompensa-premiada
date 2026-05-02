/**
 * “Dia aplicativo”: mesmo fuso das Cloud Functions (`America/Sao_Paulo`).
 * Mantém cliente alinhado a `dailyKey()` do backend (ex.: giro grátis da roleta).
 */
export const APP_SCHEDULE_TIMEZONE = "America/Sao_Paulo";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function appDatePartsInAppTz(d = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_SCHEDULE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const values: Record<string, string> = {};
  for (const part of formatter.formatToParts(d)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

/** Chave `YYYY-MM-DD` no fuso do app (igual `dailyKey` nas Functions). */
export function appDailyKey(d = new Date()): string {
  const p = appDatePartsInAppTz(d);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/**
 * Meia-noite do *próximo* dia civil em America/Sao_Paulo, em instante UTC (ms).
 * Brasil sem horário de verão: meia-noite local = 03:00 UTC do mesmo calendário.
 */
export function nextAppDayStartUtcMs(from = new Date()): number {
  const p = appDatePartsInAppTz(from);
  return Date.UTC(p.year, p.month - 1, p.day + 1, 3, 0, 0, 0);
}

export function msUntilNextAppDayStart(from = new Date()): number {
  return Math.max(0, nextAppDayStartUtcMs(from) - from.getTime());
}

export function formatHmsCountdown(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
}
