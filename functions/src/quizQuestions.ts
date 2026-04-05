import { getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export type QuizQuestion = {
  id: string;
  q: string;
  options: string[];
  correctIndex: number;
  active?: boolean;
  weight?: number;
  category?: string | null;
  difficulty?: "facil" | "medio" | "dificil" | null;
};

const QUIZ_QUESTIONS_COLLECTION = "quiz_questions";
const QUIZ_CACHE_TTL_MS = 30_000;

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { id: "1", q: "2 + 2?", options: ["3", "4", "5"], correctIndex: 1, active: true, weight: 1 },
  {
    id: "2",
    q: "Capital do Brasil?",
    options: ["Sao Paulo", "Brasilia", "Rio"],
    correctIndex: 1,
    active: true,
    weight: 1,
  },
  { id: "3", q: "10 - 4?", options: ["4", "5", "6"], correctIndex: 2, active: true, weight: 1 },
  {
    id: "4",
    q: "Quantos lados tem um triangulo?",
    options: ["2", "3", "4"],
    correctIndex: 1,
    active: true,
    weight: 1,
  },
  { id: "5", q: "Qual é 7 x 0?", options: ["7", "1", "0"], correctIndex: 2, active: true, weight: 1 },
];

let quizQuestionsCache: { expiresAt: number; questions: QuizQuestion[] } | null = null;

function normalizeQuizQuestion(
  raw: Record<string, unknown> | undefined,
  fallbackId: string,
): QuizQuestion | null {
  if (!raw) return null;
  const question = String(raw.question ?? raw.q ?? "").trim();
  const options = Array.isArray(raw.options)
    ? raw.options.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const correctIndex = Number(raw.correctIndex);
  if (!question || options.length < 2 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
    return null;
  }
  return {
    id: String(raw.id ?? fallbackId),
    q: question,
    options,
    correctIndex,
    active: raw.active !== false,
    weight: Math.max(1, Math.floor(Number(raw.weight) || 1)),
    category: typeof raw.category === "string" ? raw.category : null,
    difficulty:
      raw.difficulty === "facil" || raw.difficulty === "medio" || raw.difficulty === "dificil"
        ? raw.difficulty
        : null,
  };
}

async function loadQuizQuestionsFromFirestore(): Promise<QuizQuestion[]> {
  const now = Date.now();
  if (quizQuestionsCache && now < quizQuestionsCache.expiresAt) {
    return quizQuestionsCache.questions;
  }

  try {
    const db = getFirestore(getApp());
    const snap = await db.collection(QUIZ_QUESTIONS_COLLECTION).where("active", "==", true).get();
    const questions = snap.docs
      .map((doc) => normalizeQuizQuestion(doc.data() as Record<string, unknown>, doc.id))
      .filter((question): question is QuizQuestion => Boolean(question));

    if (questions.length > 0) {
      quizQuestionsCache = { questions, expiresAt: now + QUIZ_CACHE_TTL_MS };
      return questions;
    }
  } catch {
    /* fallback local */
  }

  quizQuestionsCache = { questions: QUIZ_QUESTIONS, expiresAt: now + QUIZ_CACHE_TTL_MS };
  return QUIZ_QUESTIONS;
}

export async function getQuizQuestionById(id: string): Promise<QuizQuestion | undefined> {
  const questions = await loadQuizQuestionsFromFirestore();
  return questions.find((q) => q.id === id);
}

export async function pickQuizQuestion(
  rng: () => number = Math.random,
  excludeId?: string,
): Promise<QuizQuestion> {
  const questions = await loadQuizQuestionsFromFirestore();
  const pool = questions.filter((q) => q.id !== excludeId);
  const source = pool.length ? pool : questions;
  const totalWeight = source.reduce((sum, question) => sum + Math.max(1, question.weight ?? 1), 0);
  let roll = rng() * totalWeight;
  for (const question of source) {
    roll -= Math.max(1, question.weight ?? 1);
    if (roll <= 0) return question;
  }
  return source[source.length - 1]!;
}
