"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/lib/constants/routes";
import { RequireAuth } from "./RequireAuth";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    if (!isAdmin) router.replace(ROUTES.home);
  }, [isAdmin, loading, user, router]);

  return (
    <RequireAuth>
      {loading || !user ? null : !isAdmin ? (
        <div className="p-8 text-center text-white/80">Verificando permissões…</div>
      ) : (
        children
      )}
    </RequireAuth>
  );
}
