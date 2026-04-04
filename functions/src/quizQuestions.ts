export type QuizQuestion = {
  id: string;
  q: string;
  options: string[];
  correctIndex: number;
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { id: "1", q: "2 + 2?", options: ["3", "4", "5"], correctIndex: 1 },
  { id: "2", q: "Capital do Brasil?", options: ["Sao Paulo", "Brasilia", "Rio"], correctIndex: 1 },
  { id: "3", q: "10 - 4?", options: ["4", "5", "6"], correctIndex: 2 },
  { id: "4", q: "Quantos lados tem um triangulo?", options: ["2", "3", "4"], correctIndex: 1 },
  { id: "5", q: "Qual é 7 x 0?", options: ["7", "1", "0"], correctIndex: 2 },
];

export function getQuizQuestionById(id: string): QuizQuestion | undefined {
  return QUIZ_QUESTIONS.find((q) => q.id === id);
}

export function pickQuizQuestion(
  rng: () => number = Math.random,
  excludeId?: string,
): QuizQuestion {
  const pool = QUIZ_QUESTIONS.filter((q) => q.id !== excludeId);
  const source = pool.length ? pool : QUIZ_QUESTIONS;
  return source[Math.floor(rng() * source.length)]!;
}
