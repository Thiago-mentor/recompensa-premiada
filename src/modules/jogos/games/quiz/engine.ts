import type { QuizQuestion } from "./questions";

/** Casa “responde” com delay simulado (futuro: outro jogador). */
export function simulateOpponentAnswer(
  q: QuizQuestion,
  rng: () => number = Math.random,
): { picked: number; delayMs: number } {
  const wrong = q.options
    .map((_, i) => i)
    .filter((i) => i !== q.correctIndex);
  const pickWrong = wrong[Math.floor(rng() * wrong.length)] ?? 0;
  const casaCorrect = rng() > 0.35;
  const picked = casaCorrect ? q.correctIndex : pickWrong;
  const delayMs = 400 + Math.floor(rng() * 1200);
  return { picked, delayMs };
}
