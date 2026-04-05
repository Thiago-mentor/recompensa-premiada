import type { Timestamp } from "./firestore";

export type QuizQuestionDifficulty = "facil" | "medio" | "dificil";

export interface QuizQuestionDoc {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  active: boolean;
  weight?: number | null;
  category?: string | null;
  difficulty?: QuizQuestionDifficulty | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
