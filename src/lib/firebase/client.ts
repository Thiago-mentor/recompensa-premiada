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
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from "firebase/app-check";
import {
  firebaseConfig,
  firebaseFunctionsRegion,
  firestoreDatabaseId,
  useFirebaseEmulators,
  appCheckSiteKey,
  isFirebaseConfigured,
} from "./config";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let functions: Functions | null = null;
let appCheck: AppCheck | null = null;
let analytics: Analytics | null = null;

function getFirebaseApp(): FirebaseApp {
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
    connectStorageEmulator(s, "127.0.0.1", 9199);
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
        connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
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
        connectFirestoreEmulator(db, "127.0.0.1", 8080);
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
        connectFunctionsEmulator(functions, "127.0.0.1", 5001);
      } catch {
        /* já conectado (ex.: Fast Refresh) */
      }
    }
  }
  return functions;
}

/**
 * App Check (reCAPTCHA v3). Sem site key, não inicializa — configure no Console e em .env.local.
 */
export function initFirebaseAppCheck(): AppCheck | null {
  if (typeof window === "undefined" || !appCheckSiteKey) return null;
  if (!appCheck) {
    appCheck = initializeAppCheck(getFirebaseApp(), {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
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
