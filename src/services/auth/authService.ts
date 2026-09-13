"use client";

import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { getFirebaseAuth } from "@/lib/firebase/client";

const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// Ative somente depois de configurar o app Meta e o provedor no Firebase Auth.
export const facebookLoginEnabled = process.env.NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED === "true";

export async function loginWithGoogle(): Promise<User> {
  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable("FirebaseAuthentication")) {
      throw new Error("Atualize o aplicativo RivalizaGame para entrar com Google.");
    }

    const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
    const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    const idToken = result.credential?.idToken;
    if (!idToken) {
      throw new Error("O Google não retornou a confirmação de entrada. Tente novamente.");
    }

    const credential = GoogleAuthProvider.credential(idToken);
    const signedIn = await signInWithCredential(getFirebaseAuth(), credential);
    return signedIn.user;
  }

  const cred = await signInWithPopup(getFirebaseAuth(), googleProvider);
  return cred.user;
}

export async function loginWithFacebook(): Promise<User> {
  if (!facebookLoginEnabled) {
    throw new Error("O acesso com Facebook ainda não está disponível.");
  }
  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable("FirebaseAuthentication")) {
      throw new Error("Atualize o aplicativo RivalizaGame para entrar com Facebook.");
    }

    const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
    const result = await FirebaseAuthentication.signInWithFacebook({ skipNativeAuth: true });
    const accessToken = result.credential?.accessToken;
    if (!accessToken) {
      throw new Error("O Facebook não retornou a confirmação de entrada. Tente novamente.");
    }

    const credential = FacebookAuthProvider.credential(accessToken);
    const signedIn = await signInWithCredential(getFirebaseAuth(), credential);
    return signedIn.user;
  }
  const cred = await signInWithPopup(getFirebaseAuth(), facebookProvider);
  return cred.user;
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  return cred.user;
}

export async function cadastroComEmail(
  email: string,
  password: string,
  nome: string,
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  await updateProfile(cred.user, { displayName: nome });
  return cred.user;
}

export async function recuperarSenha(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

export async function logout(): Promise<void> {
  await signOut(getFirebaseAuth());
}
