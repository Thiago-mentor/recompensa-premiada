"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginEmailSchema } from "@/lib/validations/auth";
import { loginWithEmail, loginWithGoogle, recuperarSenha } from "@/services/auth/authService";
import { syncUserProfileAfterAuth, useAuth } from "@/hooks/useAuth";
import { suggestUsername } from "@/utils/username";
import { ROUTES } from "@/lib/constants/routes";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { useFirebaseEmulators as firebaseEmulatorsActive } from "@/lib/firebase/config";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";

export default function LoginPage() {
  const router = useRouter();
  const { firebaseReady } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      const u = await loginWithGoogle();
      const r = await syncUserProfileAfterAuth({
        user: u,
        username: suggestUsername(u.email, u.uid),
      });
      if (!r.ok) setError(r.error || "Não foi possível sincronizar o perfil.");
      else router.push(ROUTES.home);
    } catch (e) {
      setError(formatFirebaseError(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setResetMsg(null);
    if (!email.trim()) {
      setResetMsg("Informe o e-mail no campo acima.");
      return;
    }
    try {
      await recuperarSenha(email.trim());
      setResetMsg("Enviamos um link de recuperação para seu e-mail.");
    } catch (err) {
      setResetMsg(err instanceof Error ? err.message : "Não foi possível enviar o e-mail.");
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = loginEmailSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      const u = await loginWithEmail(parsed.data.email, parsed.data.password);
      const r = await syncUserProfileAfterAuth({
        user: u,
        username: suggestUsername(u.email, u.uid),
      });
      if (!r.ok) setError(r.error || "Não foi possível sincronizar o perfil.");
      else router.push(ROUTES.home);
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setLoading(false);
    }
  }

  if (!firebaseReady) {
    return (
      <AlertBanner tone="error">
        Firebase não configurado. Adicione as variáveis em <code>.env.local</code>.
      </AlertBanner>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
          Recompensa Premiada
        </h1>
        <p className="text-sm text-white/60">Entre para continuar sua jornada</p>
      </div>
      {firebaseEmulatorsActive ? (
        <AlertBanner tone="info" className="text-sm">
          <strong className="text-white">Modo emulador:</strong> o login usa só o{" "}
          <strong className="text-white">Auth emulator</strong> (porta 9099). Contas da nuvem não
          existem aqui — use <strong className="text-white">Criar conta</strong> com{" "}
          <code className="text-white/80">npm run emulators</code> rodando. O botão Google costuma
          falhar no emulator; prefira e-mail e senha.
        </AlertBanner>
      ) : null}
      {error ? (
        <AlertBanner tone="error" className="text-sm">
          {error}
        </AlertBanner>
      ) : null}
      {resetMsg ? (
        <AlertBanner tone={resetMsg.includes("link") ? "success" : "error"} className="text-sm">
          {resetMsg}
        </AlertBanner>
      ) : null}

      {/* E-mail/senha primeiro: evita extensão/navegador injetar “internal” no primeiro controle */}
      <form
        onSubmit={handleEmail}
        className="space-y-3"
        autoComplete="on"
        id="login-email-form"
      >
        <div>
          <label className="text-xs text-white/50" htmlFor="login-email">
            E-mail
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            spellCheck={false}
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none focus:border-violet-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-white/50" htmlFor="login-password">
            Senha
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none focus:border-violet-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </Button>
        <button
          type="button"
          className="w-full text-center text-sm text-violet-300 hover:underline"
          onClick={handleResetPassword}
        >
          Esqueci minha senha
        </button>
      </form>

      <div className="relative flex items-center gap-2 text-xs text-white/40">
        <span className="h-px flex-1 bg-white/10" />
        ou continue com
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <Button
        type="button"
        className="w-full"
        onClick={handleGoogle}
        disabled={loading}
        aria-label="Continuar com Google"
      >
        Continuar com Google
      </Button>

      <p className="text-center text-sm text-white/55">
        Novo por aqui?{" "}
        <Link href={ROUTES.cadastro} className="text-violet-300 font-medium hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
