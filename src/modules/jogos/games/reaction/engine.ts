/** Vitória se reação rápida o suficiente (alinhado ao backend). */
export function reactionResultFromMs(reactionMs: number): {
  resultado: "vitoria" | "derrota";
  scoreHint: number;
} {
  const scoreHint = Math.max(0, 500 - reactionMs);
  const resultado = reactionMs > 0 && reactionMs < 350 ? "vitoria" : "derrota";
  return { resultado, scoreHint };
}

/** Toque antes do sinal = falta grave → derrota técnica. */
export function falseStartOutcome(): { resultado: "derrota"; reactionMs: number } {
  return { resultado: "derrota", reactionMs: 9999 };
}
