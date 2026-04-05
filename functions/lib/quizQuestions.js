"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUIZ_QUESTIONS = void 0;
exports.getQuizQuestionById = getQuizQuestionById;
exports.pickQuizQuestion = pickQuizQuestion;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const QUIZ_QUESTIONS_COLLECTION = "quiz_questions";
const QUIZ_CACHE_TTL_MS = 30000;
exports.QUIZ_QUESTIONS = [
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
let quizQuestionsCache = null;
function normalizeQuizQuestion(raw, fallbackId) {
    if (!raw)
        return null;
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
        difficulty: raw.difficulty === "facil" || raw.difficulty === "medio" || raw.difficulty === "dificil"
            ? raw.difficulty
            : null,
    };
}
async function loadQuizQuestionsFromFirestore() {
    const now = Date.now();
    if (quizQuestionsCache && now < quizQuestionsCache.expiresAt) {
        return quizQuestionsCache.questions;
    }
    try {
        const db = (0, firestore_1.getFirestore)((0, app_1.getApp)());
        const snap = await db.collection(QUIZ_QUESTIONS_COLLECTION).where("active", "==", true).get();
        const questions = snap.docs
            .map((doc) => normalizeQuizQuestion(doc.data(), doc.id))
            .filter((question) => Boolean(question));
        if (questions.length > 0) {
            quizQuestionsCache = { questions, expiresAt: now + QUIZ_CACHE_TTL_MS };
            return questions;
        }
    }
    catch {
        /* fallback local */
    }
    quizQuestionsCache = { questions: exports.QUIZ_QUESTIONS, expiresAt: now + QUIZ_CACHE_TTL_MS };
    return exports.QUIZ_QUESTIONS;
}
async function getQuizQuestionById(id) {
    const questions = await loadQuizQuestionsFromFirestore();
    return questions.find((q) => q.id === id);
}
function shuffleQuizPool(arr, rng) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}
async function pickQuizQuestion(rng = Math.random, excludeId) {
    const questions = await loadQuizQuestionsFromFirestore();
    const pool = questions.filter((q) => q.id !== excludeId);
    const raw = pool.length ? pool : questions;
    /** Evita ordem fixa do Firestore / lista estática; sorteio continua respeitando `weight`. */
    const source = shuffleQuizPool(raw, rng);
    const totalWeight = source.reduce((sum, question) => sum + Math.max(1, question.weight ?? 1), 0);
    let roll = rng() * totalWeight;
    for (const question of source) {
        roll -= Math.max(1, question.weight ?? 1);
        if (roll <= 0)
            return question;
    }
    return source[source.length - 1];
}
//# sourceMappingURL=quizQuestions.js.map