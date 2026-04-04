"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUIZ_QUESTIONS = void 0;
exports.getQuizQuestionById = getQuizQuestionById;
exports.pickQuizQuestion = pickQuizQuestion;
exports.QUIZ_QUESTIONS = [
    { id: "1", q: "2 + 2?", options: ["3", "4", "5"], correctIndex: 1 },
    { id: "2", q: "Capital do Brasil?", options: ["Sao Paulo", "Brasilia", "Rio"], correctIndex: 1 },
    { id: "3", q: "10 - 4?", options: ["4", "5", "6"], correctIndex: 2 },
    { id: "4", q: "Quantos lados tem um triangulo?", options: ["2", "3", "4"], correctIndex: 1 },
    { id: "5", q: "Qual é 7 x 0?", options: ["7", "1", "0"], correctIndex: 2 },
];
function getQuizQuestionById(id) {
    return exports.QUIZ_QUESTIONS.find((q) => q.id === id);
}
function pickQuizQuestion(rng = Math.random, excludeId) {
    const pool = exports.QUIZ_QUESTIONS.filter((q) => q.id !== excludeId);
    const source = pool.length ? pool : exports.QUIZ_QUESTIONS;
    return source[Math.floor(rng() * source.length)];
}
//# sourceMappingURL=quizQuestions.js.map