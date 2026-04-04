"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/lib/constants/routes";
import { isFirebaseConfigured } from "@/lib/firebase/config";

export default function RootPage() {
  const { user, loading, firebaseReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!firebaseReady) return;
    if (loading) return;
    if (user) router.replace(ROUTES.home);
    else router.replace(ROUTES.login);
  }, [user, loading, router, firebaseReady]);

  if (!isFirebaseConfigured()) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
        <h1 className="text-xl font-bold">Recompensa Premiada</h1>
        <p className="text-sm text-white/70 max-w-sm">
          Configure o Firebase em <code className="text-violet-300">.env.local</code> (veja{" "}
          <code className="text-violet-300">.env.example</code>).
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="h-12 w-12 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  );
}
