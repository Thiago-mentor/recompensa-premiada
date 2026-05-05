/** Admin UI: exibe/edita tempos em minutos; Firestore/backend continua em segundos quando aplicável. */

/** Resumo para chips/dashboard (valor guardado em segundos). */
export function formatCooldownMinutesDisplay(seconds: number | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const s = Math.floor(seconds);
  if (s <= 0) return "Sem espera";
  return `${secondsToMinutesInputValue(s)} min`;
}

/** Desbloqueio de baú / durações: prioriza horas, depois minutos, depois segundos. */
export function formatDurationMinutesFirst(totalSeconds: number | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return "—";
  const s = Math.floor(totalSeconds);
  if (s < 60) return `${s} s`;
  if (s % 3600 === 0) return `${s / 3600} h`;
  if (s % 60 === 0) return `${s / 60} min`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${m} min${sec ? ` ${sec} s` : ""}`.trim();
  return `${m} min ${sec} s`;
}

/** Texto na página pública de sorteio (intervalo entre anúncios). */
export function formatRaffleAdCooldownLabel(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s === 0) return "";
  if (s < 60) return `${s} segundos`;
  const m = s / 60;
  const rounded = Math.round(m * 1000) / 1000;
  const unit = rounded === 1 ? "minuto" : "minutos";
  return `${rounded} ${unit}`;
}

export function secondsToMinutesInputValue(seconds: number): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (s === 0) return "0";
  const m = s / 60;
  if (Number.isInteger(m)) return String(m);
  return String(Math.round(m * 1000) / 1000);
}

export function minutesInputToSeconds(value: string, maxSeconds = 86_400): number {
  const normalized = String(value).trim().replace(",", ".");
  const m = Number(normalized);
  if (!Number.isFinite(m) || m < 0) return 0;
  return Math.max(0, Math.min(maxSeconds, Math.round(m * 60)));
}

export function readMinutesToSecondsOrFallback(
  value: string,
  fallbackSeconds: number,
  maxSeconds = 86_400,
): number {
  const trimmed = String(value).trim();
  if (trimmed === "") return Math.max(0, Math.min(maxSeconds, Math.floor(fallbackSeconds)));
  const m = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(m) || m < 0) {
    return Math.max(0, Math.min(maxSeconds, Math.floor(fallbackSeconds)));
  }
  return Math.max(0, Math.min(maxSeconds, Math.round(m * 60)));
}
