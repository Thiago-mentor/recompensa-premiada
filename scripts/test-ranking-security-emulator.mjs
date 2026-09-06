/* Teste funcional do bloqueio de ranking para resultados enviados pelo cliente. */
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "premios-14238";
process.env.FIRESTORE_EMULATOR_HOST = `${process.env.FIREBASE_EMULATOR_HOST || "127.0.0.1"}:${process.env.FIRESTORE_EMULATOR_PORT || 8080}`;
process.env.FUNCTIONS_EMULATOR = "true";

const functions = await import("../functions/lib/index.js");
const { getFirestore } = await import("../functions/node_modules/firebase-admin/lib/firestore/index.js");
const db = getFirestore();
const uid = "ranking-security-client-user";
const auth = {
  uid,
  token: { sub: uid, user_id: uid, email: "ranking-security@rivaliza.test" },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await db.doc(`users/${uid}`).set({
    uid,
    nome: "Teste Ranking",
    username: "rank_test",
    banido: false,
    riscoFraude: "baixo",
    coins: 0,
    xp: 0,
    totalPartidas: 0,
    totalVitorias: 0,
    totalDerrotas: 0,
  });

  const response = await functions.finalizeMatch.run({
    auth,
    data: {
      gameId: "ppt",
      resultado: "vitoria",
      score: 999999,
      metadata: { opponent: "casa", forged: true },
      idempotencyKey: "ranking_security_attempt_001",
    },
  });

  assert(response.rankingPoints === 0, "Resultado client-side recebeu pontos de ranking.");
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const rankingEntry = await db.doc(`rankings_daily/${day}/entries/${uid}`).get();
  assert(!rankingEntry.exists, "Resultado client-side criou uma entrada no ranking.");

  console.log(JSON.stringify({ ok: true, clientRankingPoints: response.rankingPoints, rankingEntryCreated: false }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
