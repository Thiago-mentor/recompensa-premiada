"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/lib/constants/routes";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, firebaseReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!firebaseReady || loading) return;
    if (!user) router.replace(ROUTES.login);
  }, [user, loading, router, firebaseReady]);

  if (!firebaseReady) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-amber-200">Firebase não configurado</p>
        <p className="text-sm text-white/70 max-w-md">
          Copie `.env.example` para `.env.local` e preencha as variáveis do projeto Firebase.
        </p>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
