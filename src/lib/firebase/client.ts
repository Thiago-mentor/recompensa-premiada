"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";
import { getStorage, connectStorageEmulator, type FirebaseStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
  type AppCheck,
} from "firebase/app-check";
import {
  firebaseConfig,
  firebaseEmulatorHost,
  firebaseEmulatorPorts,
  firebaseFunctionsRegion,
  firestoreDatabaseId,
  useFirebaseEmulators,
  appCheckSiteKey,
  appCheckUseLegacyReCaptchaV3,
  isFirebaseConfigured,
} from "./config";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let functions: Functions | null = null;
let appCheck: AppCheck | null = null;
let analytics: Analytics | null = null;
let appCheckLogged = false;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase não configurado. Copie .env.example para .env.local e preencha as chaves.",
    );
  }
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

/** Storage. Auth, Firestore e Functions ligam o emulator na própria getter (instância única). */
function wireEmulators(): void {
  if (!useFirebaseEmulators || typeof window === "undefined") return;
  const appInstance = getFirebaseApp();
  const s = getStorage(appInstance);
  try {
    connectStorageEmulator(s, firebaseEmulatorHost, firebaseEmulatorPorts.storage);
  } catch {
    /* já conectado */
  }
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    const appInstance = getFirebaseApp();
    auth = getAuth(appInstance);
    if (useFirebaseEmulators && typeof window !== "undefined") {
      try {
        connectAuthEmulator(
          auth,
          `http://${firebaseEmulatorHost}:${firebaseEmulatorPorts.auth}`,
          { disableWarnings: true },
        );
      } catch {
        /* já conectado (ex.: Fast Refresh) */
      }
    }
  }
  return auth;
}

export function getFirebaseFirestore(): Firestore {
  if (!db) {
    wireEmulators();
    const app = getFirebaseApp();
    db =
      firestoreDatabaseId && firestoreDatabaseId !== "(default)"
        ? getFirestore(app, firestoreDatabaseId)
        : getFirestore(app);
    if (useFirebaseEmulators && typeof window !== "undefined") {
      try {
        connectFirestoreEmulator(db, firebaseEmulatorHost, firebaseEmulatorPorts.firestore);
      } catch {
        /* já conectado */
      }
    }
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    wireEmulators();
    storage = getStorage(getFirebaseApp());
  }
  return storage;
}

export function getFirebaseFunctions(): Functions {
  if (!functions) {
    wireEmulators();
    const appInstance = getFirebaseApp();
    functions = getFunctions(appInstance, firebaseFunctionsRegion);
    if (useFirebaseEmulators && typeof window !== "undefined") {
      try {
        connectFunctionsEmulator(functions, firebaseEmulatorHost, firebaseEmulatorPorts.functions);
      } catch {
        /* já conectado (ex.: Fast Refresh) */
      }
    }
  }
  return functions;
}

/**
 * App Check para Web. Padrão: reCAPTCHA Enterprise (recomendado para Firebase AI Logic).
 * Defina NEXT_PUBLIC_APPCHECK_RECAPTCHA_LEGACY_V3=true se o app usar provider v3 no Console.
 */
export function initFirebaseAppCheck(): AppCheck | null {
  if (typeof window === "undefined") return null;
  if (useFirebaseEmulators) {
    if (!appCheckLogged) {
      console.info("[Firebase] App Check ignorado no ambiente local com emuladores.");
      appCheckLogged = true;
    }
    return null;
  }
  if (!appCheckSiteKey) {
    if (!appCheckLogged) {
      console.info("[Firebase] App Check desativado: NEXT_PUBLIC_APPCHECK_SITE_KEY não definido.");
      appCheckLogged = true;
    }
    return null;
  }
  if (!appCheck) {
    try {
      const provider = appCheckUseLegacyReCaptchaV3
        ? new ReCaptchaV3Provider(appCheckSiteKey)
        : new ReCaptchaEnterpriseProvider(appCheckSiteKey);
      appCheck = initializeAppCheck(getFirebaseApp(), {
        provider,
        isTokenAutoRefreshEnabled: true,
      });
      if (!appCheckLogged) {
        console.info(
          `[Firebase] App Check inicializado com ${
            appCheckUseLegacyReCaptchaV3 ? "reCAPTCHA v3" : "reCAPTCHA Enterprise"
          }${useFirebaseEmulators ? " (com emuladores ativos)" : ""}.`,
        );
        appCheckLogged = true;
      }
    } catch (error) {
      if (!appCheckLogged) {
        console.warn(
          "[Firebase] Falha ao inicializar App Check.",
          error instanceof Error ? error.message : error,
        );
        appCheckLogged = true;
      }
      return null;
    }
  }
  return appCheck;
}

/** Google Analytics (Web) — só no browser e se `measurementId` estiver no config. */
export async function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined" || !firebaseConfig.measurementId) return null;
  try {
    if (!(await isSupported())) return null;
    if (!analytics) {
      analytics = getAnalytics(getFirebaseApp());
    }
    return analytics;
  } catch {
    return null;
  }
}
