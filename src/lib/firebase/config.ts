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

export const firebaseFunctionsRegion =
  process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || "southamerica-east1";

/**
 * ID do banco Firestore no projeto (Console → Firestore → “Adicionar banco de dados”).
 * Vazio ou não definido = banco padrão `(default)`.
 */
export const firestoreDatabaseId =
  process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim() || undefined;

export const useFirebaseEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

export const appCheckSiteKey = process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY || "";

export const rewardedAdMockEnabled = process.env.NEXT_PUBLIC_REWARDED_AD_MOCK !== "false";

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId &&
      firebaseConfig.authDomain,
  );
}
