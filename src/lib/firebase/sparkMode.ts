import { useFirebaseEmulators } from "./config";

/** Plano Spark: operações sensíveis via Firestore no cliente + regras dedicadas (dev). */
export function isSparkFreeTier(): boolean {
  return process.env.NEXT_PUBLIC_SPARK_FREE_TIER === "true";
}

/**
 * Fila 1v1 / callables de matchmaking: na nuvem exige Blaze; com emuladores locais pode usar Spark.
 */
export function autoQueueAllowed(): boolean {
  return !isSparkFreeTier() || useFirebaseEmulators;
}
