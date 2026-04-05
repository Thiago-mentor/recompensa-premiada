const required = (name: string, value: string | undefined): string => {
  if (!value) {
    if (typeof window === "undefined") {
      return "";
    }
    console.warn(`[Firebase] Variável ausente: ${name}`);
    return "";
  }
  return value;
};

export const firebaseConfig = {
  apiKey: required("NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: required("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: required("NEXT_PUBLIC_FIREBASE_PROJECT_ID", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: required("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: required(
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  ),
  appId: required("NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const FUNCTIONS_REGION_DEFAULT = "southamerica-east1";

/**
 * Região das callables (`getFunctions`). Deve coincidir com o deploy em `functions/` (FUNCTIONS_REGION / padrão sa-east1).
 * No App Hosting, variáveis do Console podem definir `us-central1` por engano — isso gera 400/429 contra endpoints errados.
 */
function resolveFirebaseFunctionsRegion(): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const fromEnv = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION?.trim();
  const normalized = fromEnv?.toLowerCase();

  if (projectId === "premios-14238" && normalized === "us-central1") {
    if (typeof window !== "undefined") {
      console.warn(
        "[Firebase] NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION=us-central1 não se aplica a este projeto; usando southamerica-east1.",
      );
    }
    return FUNCTIONS_REGION_DEFAULT;
  }

  return fromEnv || FUNCTIONS_REGION_DEFAULT;
}

export const firebaseFunctionsRegion = resolveFirebaseFunctionsRegion();

/**
 * ID do banco Firestore no projeto (Console → Firestore → “Adicionar banco de dados”).
 * Vazio ou não definido = banco padrão `(default)`.
 */
export const firestoreDatabaseId =
  process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim() || undefined;

export const useFirebaseEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

export const firebaseEmulatorHost =
  process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST?.trim() || "127.0.0.1";

export const firebaseEmulatorPorts = {
  auth: Number(process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT || 9099),
  firestore: Number(process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT || 8080),
  functions: Number(process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT || 5001),
  storage: Number(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_PORT || 9199),
} as const;

export const appCheckSiteKey = process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY || "";

/**
 * `false` (padrão): `ReCaptchaEnterpriseProvider` — recomendado pelo Firebase para Web + AI Logic.
 * `true`: `ReCaptchaV3Provider` — só se o app ainda estiver registrado no Console com reCAPTCHA v3 clássico.
 */
export const appCheckUseLegacyReCaptchaV3 =
  process.env.NEXT_PUBLIC_APPCHECK_RECAPTCHA_LEGACY_V3 === "true";

/**
 * Tokens de uso limitado no `getAI` (prepara replay protection futura; pode adicionar latência).
 * @see https://firebase.google.com/docs/ai-logic/app-check
 */
export const firebaseAiAppCheckLimitedUseTokens =
  process.env.NEXT_PUBLIC_FIREBASE_AI_APP_CHECK_LIMITED_USE_TOKENS === "true";

/**
 * Provedor do Firebase AI Logic no cliente:
 * - `vertex` — Vertex AI Gemini (fluxo “Vertex AI Gemini API” no Console: exige `aiplatform.googleapis.com` + `firebasevertexai.googleapis.com`)
 * - `google` — Gemini Developer API (fluxo “Gemini Developer API” no Get started: exige `generativelanguage.googleapis.com` + `firebasevertexai.googleapis.com`)
 *
 * Padrão `vertex`: quem só concluiu o onboarding do Vertex no Console costuma não ter a API Developer ativa.
 */
export type FirebaseAiBackendKind = "google" | "vertex";

export function getFirebaseAiBackend(): FirebaseAiBackendKind {
  const raw = process.env.NEXT_PUBLIC_FIREBASE_AI_BACKEND?.trim().toLowerCase();
  if (raw === "google") return "google";
  if (raw === "vertex") return "vertex";
  return "vertex";
}

/** Região Vertex usada pelo SDK (modelos estáveis costumam funcionar em `us-central1`). */
export const firebaseVertexAiLocation =
  process.env.NEXT_PUBLIC_VERTEX_AI_LOCATION?.trim() || "us-central1";

export const rewardedAdMockEnabled = process.env.NEXT_PUBLIC_REWARDED_AD_MOCK !== "false";

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId &&
      firebaseConfig.authDomain,
  );
}
