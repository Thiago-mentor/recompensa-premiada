const test = require("node:test");
const assert = require("node:assert/strict");
const { isTerminalRoom } = require("../lib/roomMaintenance.js");

test("historical finished rooms are terminal even with stale playing status", () => {
  for (const field of ["pptRewardsApplied", "quizRewardsApplied", "reactionRewardsApplied", "cardBattleRewardsApplied"]) {
    assert.equal(isTerminalRoom({ status: "playing", [field]: true }), true);
  }
  assert.equal(isTerminalRoom({ status: "playing", phase: "completed" }), true);
  assert.equal(isTerminalRoom({ status: "cancelled" }), true);
  assert.equal(isTerminalRoom({ status: "completed" }), true);
});

test("active and waiting rooms keep their deadline processing", () => {
  for (const status of ["waiting", "matched", "playing"]) {
    assert.equal(isTerminalRoom({ status, phase: "ppt_playing", pptRewardsApplied: false }), false);
  }
  assert.equal(isTerminalRoom({}), false);
});
