import { useFirebaseEmulators } from "./config";

/** Plano Spark: operações sensíveis via Firestore no cliente + regras dedicadas (legado). */
export function isSparkFreeTier(): boolean {
  return process.env.NEXT_PUBLIC_SPARK_FREE_TIER === "true";
}

/**
 * Usa o fallback Spark só quando o projeto está explicitamente nesse modo e sem emuladores.
 */
export function shouldUseSparkFallback(): boolean {
  return isSparkFreeTier() && !useFirebaseEmulators;
}

/** Blaze na nuvem ou Functions emulator no dev local. */
export function isFunctionsBackendPreferred(): boolean {
  return !shouldUseSparkFallback();
}

/**
 * Fila 1v1 / callables de matchmaking: exige backend de Functions (nuvem ou emulator).
 */
export function autoQueueAllowed(): boolean {
  return isFunctionsBackendPreferred();
}
