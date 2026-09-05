const test = require("node:test");
const assert = require("node:assert/strict");
const {
  InputValidationError,
  PIX_KEY_MAX_LENGTH,
  decideRateLimit,
  parseRewardClaimInput,
} = require("../lib/security.js");

test("parseRewardClaimInput normaliza um pedido PIX manual", () => {
  assert.deepEqual(
    parseRewardClaimInput({ valor: "250.9", tipo: " PIX ", chavePix: " cliente@example.com " }),
    { valor: 250, tipo: "pix", chavePix: "cliente@example.com" },
  );
});

test("parseRewardClaimInput rejeita tipos de resgate não suportados", () => {
  assert.throws(
    () => parseRewardClaimInput({ valor: 100, tipo: "voucher", chavePix: "x" }),
    InputValidationError,
  );
});

test("parseRewardClaimInput rejeita valor inseguro e chave excessiva", () => {
  assert.throws(
    () => parseRewardClaimInput({ valor: Number.MAX_SAFE_INTEGER + 1, tipo: "pix", chavePix: "x" }),
    InputValidationError,
  );
  assert.throws(
    () =>
      parseRewardClaimInput({
        valor: 100,
        tipo: "pix",
        chavePix: "x".repeat(PIX_KEY_MAX_LENGTH + 1),
      }),
    InputValidationError,
  );
});

test("decideRateLimit abre, incrementa e bloqueia uma janela", () => {
  const first = decideRateLimit({ current: null, nowMs: 1_000, windowMs: 60_000, maxEvents: 2 });
  assert.deepEqual(first, {
    allowed: true,
    next: { windowStartedAtMs: 1_000, count: 1 },
  });

  const second = decideRateLimit({
    current: first.next,
    nowMs: 2_000,
    windowMs: 60_000,
    maxEvents: 2,
  });
  assert.equal(second.allowed, true);
  assert.equal(second.next.count, 2);

  const blocked = decideRateLimit({
    current: second.next,
    nowMs: 3_000,
    windowMs: 60_000,
    maxEvents: 2,
  });
  assert.equal(blocked.allowed, false);
});

test("decideRateLimit reinicia janelas expiradas ou com relógio inválido", () => {
  assert.deepEqual(
    decideRateLimit({
      current: { windowStartedAtMs: 1_000, count: 99 },
      nowMs: 61_000,
      windowMs: 60_000,
      maxEvents: 2,
    }).next,
    { windowStartedAtMs: 61_000, count: 1 },
  );
  assert.equal(
    decideRateLimit({
      current: { windowStartedAtMs: 70_000, count: 2 },
      nowMs: 60_000,
      windowMs: 60_000,
      maxEvents: 2,
    }).allowed,
    true,
  );
});
