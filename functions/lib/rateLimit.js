"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.consumeDistributedRateLimit = consumeDistributedRateLimit;
const node_crypto_1 = require("node:crypto");
const firestore_1 = require("firebase-admin/firestore");
const security_1 = require("./security");
function rateLimitDocumentId(scope, uid) {
    return (0, node_crypto_1.createHash)("sha256").update(`${scope}|${uid}`).digest("hex").slice(0, 32);
}
/** Consome um evento em uma janela compartilhada por todas as instâncias. */
async function consumeDistributedRateLimit(input) {
    const nowMs = input.nowMs ?? Date.now();
    const ref = input.db.doc(`${input.collection}/${rateLimitDocumentId(input.scope, input.uid)}`);
    return input.db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const raw = (snap.data() || {});
        const decision = (0, security_1.decideRateLimit)({
            current: snap.exists
                ? {
                    windowStartedAtMs: Number(raw.windowStartedAtMs),
                    count: Number(raw.count),
                }
                : null,
            nowMs,
            windowMs: input.windowMs,
            maxEvents: input.maxEvents,
        });
        if (decision.allowed) {
            tx.set(ref, {
                uid: input.uid,
                scope: input.scope,
                ...decision.next,
                expiresAt: firestore_1.Timestamp.fromMillis(nowMs + input.windowMs * 2),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        return decision.allowed;
    });
}
//# sourceMappingURL=rateLimit.js.map