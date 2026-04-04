"use client";

import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/services/auth/authService";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants/routes";
import Link from "next/link";

export default function PerfilPage() {
  const { user, profile, isAdmin } = useAuth();
  const router = useRouter();

  async function sair() {
    await logout();
    router.replace(ROUTES.login);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Perfil</h1>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2 text-sm">
        <p className="text-white">
          <span className="text-white/50">Nome:</span> {profile?.nome || user?.displayName}
        </p>
        <p className="text-white">
          <span className="text-white/50">Username:</span> @{profile?.username || "—"}
        </p>
        <p className="text-white">
          <span className="text-white/50">E-mail:</span> {profile?.email || user?.email}
        </p>
        <p className="text-white">
          <span className="text-white/50">Nível / XP:</span> {profile?.level ?? "—"} · {profile?.xp ?? "—"} XP
        </p>
        <p className="text-white">
          <span className="text-white/50">Risco fraude:</span> {profile?.riscoFraude ?? "—"}
        </p>
      </div>
      {isAdmin ? (
        <Link
          href={ROUTES.admin.dashboard}
          className="block rounded-xl border border-violet-500/40 bg-violet-950/40 px-4 py-3 text-center text-violet-200"
        >
          Abrir painel admin
        </Link>
      ) : null}
      <Button variant="danger" className="w-full" onClick={sair}>
        Sair
      </Button>
    </div>
  );
}
