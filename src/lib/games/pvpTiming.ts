/** Janela para escolher jogada/resposta em PvP (segundos). Sincroniza com `system_configs/economy.pvpChoiceSeconds`. */

export const DEFAULT_PVP_CHOICE_SECONDS = {
  ppt: 10,
  quiz: 10,
  reaction_tap: 10,
} as const;

export type PvpChoiceSecondsConfig = {
  ppt: number;
  quiz: number;
  reaction_tap: number;
};

export function clampPvpChoiceSeconds(n: unknown, fallback: number): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(120, Math.max(3, v));
}

/**
 * Aceita o mapa `pvpChoiceSeconds` ou o documento inteiro de economia (`system_configs/economy`),
 * para não depender de quem chama extrair o campo.
 */
export function parsePvpChoiceSeconds(raw: unknown): PvpChoiceSecondsConfig {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const nested = root.pvpChoiceSeconds;
  const o =
    nested && typeof nested === "object"
      ? (nested as Record<string, unknown>)
      : Object.keys(root).some((k) => k === "ppt" || k === "quiz" || k === "reaction_tap")
        ? root
        : {};
  return {
    ppt: clampPvpChoiceSeconds(o.ppt, DEFAULT_PVP_CHOICE_SECONDS.ppt),
    quiz: clampPvpChoiceSeconds(o.quiz, DEFAULT_PVP_CHOICE_SECONDS.quiz),
    reaction_tap: clampPvpChoiceSeconds(
      o.reaction_tap,
      DEFAULT_PVP_CHOICE_SECONDS.reaction_tap,
    ),
  };
}
