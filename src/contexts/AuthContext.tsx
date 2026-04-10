"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { getFirebaseAuth, initFirebaseAnalytics, initFirebaseAppCheck } from "@/lib/firebase/client";
import {
  ensureUserProfileRemote,
  subscribeUserProfile,
  fetchUserProfile,
} from "@/services/users/userService";
import type { UserProfile } from "@/types/user";

type AuthState = {
  firebaseReady: boolean;
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  profileLoading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  setProfileLocal: (p: UserProfile | null) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseReady] = useState(() => isFirebaseConfigured());
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      const p = await fetchUserProfile(user.uid);
      setProfile(p);
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!firebaseReady) {
      setLoading(false);
      return;
    }
    let unsubProfile: (() => void) | undefined;
    try {
      initFirebaseAppCheck();
      void initFirebaseAnalytics();
      const auth = getFirebaseAuth();
      const unsub = onAuthStateChanged(auth, async (u) => {
        setUser(u);
        setError(null);
        if (!u) {
          setProfile(null);
          setIsAdmin(false);
          unsubProfile?.();
          setLoading(false);
          return;
        }
        try {
          const tr = await u.getIdTokenResult(true);
          setIsAdmin(tr.claims.admin === true);
        } catch {
          setIsAdmin(false);
        }
        unsubProfile?.();
        unsubProfile = subscribeUserProfile(u.uid, setProfile);
        setLoading(false);
      });
      return () => {
        unsub();
        unsubProfile?.();
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro Firebase");
      setLoading(false);
    }
  }, [firebaseReady]);

  const value = useMemo<AuthState>(
    () => ({
      firebaseReady,
      user,
      profile,
      isAdmin,
      loading,
      profileLoading,
      error,
      refreshProfile,
      setProfileLocal: setProfile,
    }),
    [
      firebaseReady,
      user,
      profile,
      isAdmin,
      loading,
      profileLoading,
      error,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext deve estar dentro de AuthProvider");
  return ctx;
}

/** Garante perfil Firestore após cadastro/login (chama Callable). */
export async function syncUserProfileAfterAuth(input: {
  user: User;
  username: string;
  codigoConvite?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const nome = input.user.displayName || input.username;
  return ensureUserProfileRemote({
    nome,
    username: input.username,
    foto: input.user.photoURL,
    email: input.user.email,
    codigoConviteOpcional: input.codigoConvite,
  });
}
