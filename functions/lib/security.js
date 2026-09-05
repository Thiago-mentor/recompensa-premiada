"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputValidationError = exports.PIX_KEY_MAX_LENGTH = void 0;
exports.parseRewardClaimInput = parseRewardClaimInput;
exports.decideRateLimit = decideRateLimit;
exports.PIX_KEY_MAX_LENGTH = 200;
class InputValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "InputValidationError";
    }
}
exports.InputValidationError = InputValidationError;
/**
 * Validação de fronteira para a Callable. O pagamento continua manual; esta
 * função apenas impede payloads inesperados ou excessivamente grandes.
 */
function parseRewardClaimInput(data) {
    const payload = data && typeof data === "object" ? data : {};
    const valor = Math.floor(Number(payload.valor));
    const tipo = String(payload.tipo || "pix").trim().toLowerCase();
    const chavePix = String(payload.chavePix || "").trim();
    if (!Number.isSafeInteger(valor) || valor <= 0) {
        throw new InputValidationError("Valor de resgate inválido.");
    }
    if (tipo !== "pix") {
        throw new InputValidationError("Somente pedidos de resgate via PIX são aceitos.");
    }
    if (!chavePix || chavePix.length > exports.PIX_KEY_MAX_LENGTH) {
        throw new InputValidationError("Chave PIX inválida.");
    }
    return { valor, tipo: "pix", chavePix };
}
/** Função pura usada pela implementação distribuída e pelos testes. */
function decideRateLimit(input) {
    const { current, nowMs, windowMs, maxEvents } = input;
    if (!current ||
        !Number.isFinite(current.windowStartedAtMs) ||
        !Number.isFinite(current.count) ||
        current.windowStartedAtMs > nowMs ||
        nowMs - current.windowStartedAtMs >= windowMs) {
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
//# sourceMappingURL=security.js.map