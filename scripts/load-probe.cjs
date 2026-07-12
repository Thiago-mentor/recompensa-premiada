/*
 * Probe somente leitura do App Hosting.
 * Nao chama Auth, Firestore ou Cloud Functions e nao cria dados de teste.
 * Uso: node scripts/load-probe.cjs
 */

const baseUrl = (process.env.LOAD_TEST_URL || "https://recompensa-premiada--premios-14238.us-east4.hosted.app").replace(/\/$/, "");
const pathName = process.env.LOAD_TEST_PATH || "/home";
const stages = (process.env.LOAD_TEST_STAGES || "100,500,1000")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0 && value <= 2000);

if (stages.length === 0) {
  console.error("LOAD_TEST_STAGES nao contem valores validos.");
  process.exit(1);
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

async function runStage(requests) {
  const durations = [];
  const statusCounts = {};
  const errorSamples = {};
  let networkErrors = 0;
  let ok = 0;
  let failed = 0;
  const startedAt = performance.now();

  await Promise.all(
    Array.from({ length: requests }, async () => {
      const requestStartedAt = performance.now();
      try {
        const response = await fetch(`${baseUrl}${pathName}`, {
          headers: { "user-agent": "Rivaliza-load-probe/1.0" },
          signal: AbortSignal.timeout(20_000),
        });
        await response.arrayBuffer();
        durations.push(performance.now() - requestStartedAt);
        statusCounts[response.status] = (statusCounts[response.status] || 0) + 1;
        if (response.ok) ok += 1;
        else failed += 1;
      } catch (error) {
        durations.push(performance.now() - requestStartedAt);
        networkErrors += 1;
        const message = error instanceof Error ? error.message : String(error);
        errorSamples[message] = (errorSamples[message] || 0) + 1;
        failed += 1;
      }
    }),
  );

  return {
    requests,
    ok,
    failed,
    statusCounts,
    networkErrors,
    errorSamples,
    totalMs: performance.now() - startedAt,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    maxMs: Math.max(...durations, 0),
  };
}

(async () => {
  console.log(`Rivaliza load probe: GET ${baseUrl}${pathName}`);
  console.log("Somente leitura; nenhuma partida ou gravacao sera criada.");

  for (const stage of stages) {
    const result = await runStage(stage);
    console.log(JSON.stringify(result));
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
