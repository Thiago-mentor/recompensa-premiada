import { createHash } from "node:crypto";
import {
  FieldValue,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import { decideRateLimit } from "./security";

function rateLimitDocumentId(scope: string, uid: string): string {
  return createHash("sha256").update(`${scope}|${uid}`).digest("hex").slice(0, 32);
}

/** Consome um evento em uma janela compartilhada por todas as instâncias. */
export async function consumeDistributedRateLimit(input: {
  db: Firestore;
  collection: string;
  uid: string;
  scope: string;
  windowMs: number;
  maxEvents: number;
  nowMs?: number;
}): Promise<boolean> {
  const nowMs = input.nowMs ?? Date.now();
  const ref = input.db.doc(
    `${input.collection}/${rateLimitDocumentId(input.scope, input.uid)}`,
  );

  return input.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const raw = (snap.data() || {}) as Record<string, unknown>;
    const decision = decideRateLimit({
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
        expiresAt: Timestamp.fromMillis(nowMs + input.windowMs * 2),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return decision.allowed;
  });
}
