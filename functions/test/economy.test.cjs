const test = require("node:test");
const assert = require("node:assert/strict");
const {
  clampScore,
  pickWeightedRoulettePrize,
  rankingPointsFrom,
  resolveMatchEconomy,
} = require("../lib/gameEconomy.js");
const { normalizeStreakTable, resolveStreakRewardForDay } = require("../lib/streakEconomy.js");

test("roleta usa somente fatias válidas e respeita os limites do RNG", () => {
  const table = [
    { kind: "coins", coins: 10, weight: 1 },
    { kind: "gems", coins: 2, weight: 1 },
    { kind: "coins", coins: 999, weight: 0 },
  ];
  assert.deepEqual(pickWeightedRoulettePrize(table, () => 0), { kind: "coins", amount: 10 });
  assert.deepEqual(pickWeightedRoulettePrize(table, () => 0.999), { kind: "gems", amount: 2 });
});

test("economia de partida ignora score arbitrário nos jogos com regra do servidor", () => {
  const win = resolveMatchEconomy("ppt", "vitoria", 999_999, {});
  const loss = resolveMatchEconomy("ppt", "derrota", 999_999, {});
  assert.equal(win.normalizedScore, 650);
  assert.equal(win.rewardCoins, 45);
  assert.equal(loss.normalizedScore, 200);
  assert.equal(loss.rewardCoins, 0);
});

test("scores e pontos de ranking permanecem dentro dos limites", () => {
  assert.equal(clampScore(Number.POSITIVE_INFINITY), 0);
  assert.equal(clampScore(2_000), 1_000);
  assert.equal(rankingPointsFrom(1_000, "vitoria"), 120);
  assert.equal(rankingPointsFrom(0, "derrota"), 2);
});

test("streak normaliza configuração e usa fallback quando não há marco", () => {
  const table = normalizeStreakTable([
    { dia: 7, coins: 200, gems: 1, tipoBonus: "bau" },
    { dia: 1, coins: 20, gems: 0, tipoBonus: "nenhum" },
    { dia: 0, coins: 999, gems: 0 },
    { dia: 3, coins: -1, gems: 0 },
  ]);
  assert.deepEqual(table.map((row) => row.dia), [1, 7]);
  assert.deepEqual(resolveStreakRewardForDay(7, table, 50), table[1]);
  assert.deepEqual(resolveStreakRewardForDay(2, table, 50), {
    dia: 2,
    coins: 50,
    gems: 0,
    tipoBonus: "nenhum",
  });
});
