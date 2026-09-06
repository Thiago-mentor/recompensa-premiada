/* Teste funcional de baus no Firestore Emulator; nunca usa producao. */
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "premios-14238";
process.env.FIRESTORE_EMULATOR_HOST = `${process.env.FIREBASE_EMULATOR_HOST || "127.0.0.1"}:${process.env.FIRESTORE_EMULATOR_PORT || 8080}`;
process.env.FUNCTIONS_EMULATOR = "true";

const { Timestamp } = await import("../functions/node_modules/firebase-admin/lib/firestore/index.js");
const functions = await import("../functions/lib/index.js");
const { getFirestore } = await import("../functions/node_modules/firebase-admin/lib/firestore/index.js");
const db = getFirestore();
const uid = "chest-load-test-user";
const auth = { uid, token: { sub: uid, user_id: uid, email: "chest-load-test@rivaliza.test", admin: true } };

function call(name, data) {
  const handler = functions[name];
  if (!handler || typeof handler.run !== "function") throw new Error(`Handler indisponivel: ${name}`);
  return handler.run({ data, auth });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await db.doc(`users/${uid}`).set({ uid, nome: "Teste Bau", username: "teste_bau", banido: false, coins: 0, gems: 0, xp: 0, fragments: 0, storedBoostMinutes: 0, superPrizeEntries: 0 });
  const items = db.collection(`user_chests/${uid}/items`);
  const chestId = "chest-claim-once";
  await items.doc(chestId).set({ id: chestId, userId: uid, rarity: "raro", source: "event", status: "locked", slotIndex: 0, queuePosition: null, unlockDurationSec: 3600, rewardsSnapshot: { coins: 10, gems: 2, xp: 5, fragments: 1, boostMinutes: 0, superPrizeEntries: 0, bonusCoins: 3 }, adsUsed: 0, sourceRefId: "load-test", grantedAt: Timestamp.now(), unlockStartedAt: null, readyAt: null, nextAdAvailableAt: null, updatedAt: Timestamp.now() });

  const started = await call("startChestUnlock", { chestId });
  assert(started.status === "unlocking", "Baú não iniciou a abertura.");
  await items.doc(chestId).update({ status: "unlocking", readyAt: Timestamp.fromMillis(Date.now() - 1_000), updatedAt: Timestamp.now() });
  const claims = await Promise.allSettled([call("claimChestReward", { chestId }), call("claimChestReward", { chestId })]);
  assert(claims.filter((result) => result.status === "fulfilled").length === 1, "Resgate concorrente não foi idempotente.");

  const user = (await db.doc(`users/${uid}`).get()).data() || {};
  assert(user.coins === 13 && user.gems === 2 && user.xp === 5 && user.fragments === 1, "Saldo do baú foi creditado incorretamente.");
  assert(!(await items.doc(chestId).get()).exists, "Baú resgatado permaneceu armazenado.");

  const speedChestId = "chest-speedup";
  await items.doc(speedChestId).set({ id: speedChestId, userId: uid, rarity: "comum", source: "event", status: "locked", slotIndex: 0, queuePosition: null, unlockDurationSec: 3600, rewardsSnapshot: { coins: 1, gems: 0, xp: 0, fragments: 0, boostMinutes: 0, superPrizeEntries: 0, bonusCoins: 0 }, adsUsed: 0, sourceRefId: "speed-test", grantedAt: Timestamp.now(), unlockStartedAt: null, readyAt: null, nextAdAvailableAt: null, updatedAt: Timestamp.now() });
  await call("startChestUnlock", { chestId: speedChestId });
  const speed = await call("speedUpChestUnlock", { chestId: speedChestId, mockCompletionToken: "mock_chest_test_123456" });
  assert(speed.adsUsed === 1 && speed.reducedMs > 0, "A aceleração do baú não foi aplicada.");
  console.log(JSON.stringify({ ok: true, claimOnce: true, speedup: { adsUsed: speed.adsUsed, reducedMs: speed.reducedMs }, balance: { coins: user.coins, gems: user.gems } }));
}

main().catch((error) => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
