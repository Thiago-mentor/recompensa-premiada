export type QuizQuestion = {
  id: string;
  q: string;
  options: string[];
  correctIndex: number;
};

/** Banco curto — expanda via Firestore `missions` ou CMS depois. */
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { id: "1", q: "2 + 2?", options: ["3", "4", "5"], correctIndex: 1 },
  { id: "2", q: "Capital do Brasil?", options: ["São Paulo", "Brasília", "Rio"], correctIndex: 1 },
  { id: "3", q: "10 − 4?", options: ["4", "5", "6"], correctIndex: 2 },
  { id: "4", q: "Quantos lados tem um triângulo?", options: ["2", "3", "4"], correctIndex: 1 },
  { id: "5", q: "Qual é 7 × 0?", options: ["7", "1", "0"], correctIndex: 2 },
];

export function pickQuizQuestion(rng: () => number = Math.random): QuizQuestion {
  return QUIZ_QUESTIONS[Math.floor(rng() * QUIZ_QUESTIONS.length)]!;
}
