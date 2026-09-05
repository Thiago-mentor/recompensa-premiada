export const PIX_KEY_MAX_LENGTH = 200;

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}

export type RewardClaimInput = {
  valor: number;
  tipo: "pix";
  chavePix: string;
};

/**
 * Validação de fronteira para a Callable. O pagamento continua manual; esta
 * função apenas impede payloads inesperados ou excessivamente grandes.
 */
export function parseRewardClaimInput(data: unknown): RewardClaimInput {
  const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const valor = Math.floor(Number(payload.valor));
  const tipo = String(payload.tipo || "pix").trim().toLowerCase();
  const chavePix = String(payload.chavePix || "").trim();

  if (!Number.isSafeInteger(valor) || valor <= 0) {
    throw new InputValidationError("Valor de resgate inválido.");
  }
  if (tipo !== "pix") {
    throw new InputValidationError("Somente pedidos de resgate via PIX são aceitos.");
  }
  if (!chavePix || chavePix.length > PIX_KEY_MAX_LENGTH) {
    throw new InputValidationError("Chave PIX inválida.");
  }

  return { valor, tipo: "pix", chavePix };
}

export type RateLimitState = {
  windowStartedAtMs: number;
  count: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  next: RateLimitState;
};

/** Função pura usada pela implementação distribuída e pelos testes. */
export function decideRateLimit(input: {
  current: RateLimitState | null;
  nowMs: number;
  windowMs: number;
  maxEvents: number;
}): RateLimitDecision {
  const { current, nowMs, windowMs, maxEvents } = input;
  if (
    !current ||
    !Number.isFinite(current.windowStartedAtMs) ||
    !Number.isFinite(current.count) ||
    current.windowStartedAtMs > nowMs ||
    nowMs - current.windowStartedAtMs >= windowMs
  ) {
    return {
      allowed: true,
      next: { windowStartedAtMs: nowMs, count: 1 },
    };
  }

  if (current.count >= maxEvents) {
    return { allowed: false, next: current };
  }

  return {
    allowed: true,
    next: { windowStartedAtMs: current.windowStartedAtMs, count: current.count + 1 },
  };
}
