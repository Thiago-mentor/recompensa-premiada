/*
 * Teste funcional concorrente, executado somente no Firestore Emulator.
 * Ignora Auth/App Check e chama os handlers internos reais com identidades ficticias.
 * Nenhum dado ou conta e criado no Firebase de producao.
 */

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "premios-14238";
const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || "127.0.0.1";
const firestorePort = Number(process.env.FIRESTORE_EMULATOR_PORT || 8080);
const accountCount = Math.max(1, Math.min(1_000, Number(process.env.LOAD_TEST_ACCOUNTS || 1_000)));

process.env.GCLOUD_PROJECT = projectId;
process.env.FIRESTORE_EMULATOR_HOST = `${emulatorHost}:${firestorePort}`;
process.env.FUNCTIONS_EMULATOR = "true";

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function summarize(name, attempted, startedAt, durations, errors) {
  const totalMs = performance.now() - startedAt;
  const result = {
    name,
    attempted,
    ok: durations.length,
    failed: errors.length,
    totalMs: Math.round(totalMs),
    requestsPerSecond: Number(((durations.length + errors.length) / (totalMs / 1_000)).toFixed(2)),
    p50Ms: Math.round(percentile(durations, 0.5)),
    p95Ms: Math.round(percentile(durations, 0.95)),
    maxMs: Math.round(Math.max(...durations, 0)),
    errorSamples: [...new Set(errors)].slice(0, 5),
  };
  console.log(JSON.stringify(result));
  return result;
}

async function runConcurrentStage(name, inputs, action) {
  const durations = [];
  const errors = [];
  const startedAt = performance.now();
  const outputs = await Promise.all(
    inputs.map(async (input, index) => {
      const requestStartedAt = performance.now();
      try {
        const value = await action(input, index);
        durations.push(performance.now() - requestStartedAt);
        return value;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(message);
        return null;
      }
    }),
  );
  const summary = summarize(name, inputs.length, startedAt, durations, errors);
  if (errors.length > 0) {
    throw new Error(`${name} falhou em ${errors.length} de ${inputs.length} operacoes.`);
  }
  return { outputs, summary };
}

function fakeRequest(account, data) {
  return {
    data,
    auth: {
      uid: account.uid,
      token: {
        sub: account.uid,
        user_id: account.uid,
        email: `load-${account.index}@rivaliza.test`,
        email_verified: true,
        firebase: { sign_in_provider: "load-test" },
      },
    },
    app: undefined,
    instanceIdToken: undefined,
    rawRequest: undefined,
  };
}

async function main() {
  console.log(
    `Rivaliza internal load test: ${accountCount} perfis em ${emulatorHost}:${firestorePort}`,
  );

  const functions = await import("../functions/lib/index.js");
  const callable = (name) => {
    const handler = functions[name];
    if (!handler || typeof handler.run !== "function") {
      throw new Error(`Handler interno indisponivel: ${name}`);
    }
    return handler.run.bind(handler);
  };
  const initializeUserProfile = callable("initializeUserProfile");
  const processDailyLogin = callable("processDailyLogin");
  const joinAutoMatch = callable("joinAutoMatch");
  const { getFirestore } = await import(
    "../functions/node_modules/firebase-admin/lib/firestore/index.js"
  );
  const adminDb = getFirestore();

  const accounts = Array.from({ length: accountCount }, (_, index) => ({
    index,
    uid: `load_${String(index).padStart(6, "0")}`,
  }));

  await runConcurrentStage("initialize_profile", accounts, (account) => {
    const suffix = String(account.index).padStart(6, "0");
    return initializeUserProfile(
      fakeRequest(account, {
        nome: `Jogador Teste ${suffix}`,
        username: `u${suffix}`,
        codigoConvite: null,
      }),
    );
  });

  await runConcurrentStage("daily_login", accounts, (account) =>
    processDailyLogin(fakeRequest(account, {})),
  );

  const originalInfo = console.info;
  const originalWarn = console.warn;
  console.info = () => undefined;
  console.warn = () => undefined;

  const queueStage = await runConcurrentStage("matchmaking_join", accounts, (account) =>
    joinAutoMatch(fakeRequest(account, { gameId: "ppt" })),
  );
  const queueResults = queueStage.outputs.reduce(
    (counts, result) => {
      const status = String(result?.status || "unknown");
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    },
    {},
  );

  const matchedAccountIds = async () => {
    const snapshot = await adminDb
      .collection("multiplayer_slots")
      .where("queueStatus", "==", "matched")
      .get();
    return new Set(snapshot.docs.map((slot) => slot.id));
  };

  for (let round = 1; round <= 12; round += 1) {
    const matchedIds = await matchedAccountIds();
    const waitingAccounts = accounts.filter((account) => !matchedIds.has(account.uid));
    if (waitingAccounts.length < 2) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
    await runConcurrentStage(`matchmaking_retry_${round}`, waitingAccounts, (account) =>
      joinAutoMatch(fakeRequest(account, { gameId: "ppt" })),
    );
  }

  console.info = originalInfo;
  console.warn = originalWarn;

  const slots = await adminDb.collection("multiplayer_slots").get();
  const rooms = await adminDb.collection("game_rooms").get();
  const matchedSlots = slots.docs.filter((slot) => slot.data().queueStatus === "matched").length;
  const expectedRooms = Math.floor(accountCount / 2);
  console.log(
    JSON.stringify({
      name: "matchmaking_results",
      responses: queueResults,
      matchedProfiles: matchedSlots,
      expectedMatchedProfiles: accountCount - (accountCount % 2),
      rooms: rooms.size,
      expectedRooms,
    }),
  );

  const expectedMatchedProfiles = accountCount - (accountCount % 2);
  if (matchedSlots !== expectedMatchedProfiles) {
    throw new Error(
      `Fila incompleta: ${matchedSlots}/${expectedMatchedProfiles} perfis foram pareados.`,
    );
  }
  if (rooms.size !== expectedRooms) {
    throw new Error(`Quantidade de salas incorreta: ${rooms.size}/${expectedRooms}.`);
  }

  console.log(JSON.stringify({ ok: true, accountCount }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
