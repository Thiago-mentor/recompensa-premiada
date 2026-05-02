"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cadastroSchema } from "@/lib/validations/auth";
import { cadastroComEmail } from "@/services/auth/authService";
import { syncUserProfileAfterAuth, useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/lib/constants/routes";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { useFirebaseEmulators as firebaseEmulatorsActive } from "@/lib/firebase/config";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";

export function CadastroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firebaseReady } = useAuth();
  const [nome, setNome] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [codigoConvite, setCodigoConvite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const c = searchParams.get("convite");
    if (c) setCodigoConvite(c.toUpperCase());
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = cadastroSchema.safeParse({
      nome,
      username: username.toLowerCase(),
      email,
      password,
      confirmar,
      codigoConvite: codigoConvite || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      const u = await cadastroComEmail(parsed.data.email, parsed.data.password, parsed.data.nome);
      const r = await syncUserProfileAfterAuth({
        user: u,
        username: parsed.data.username,
        codigoConvite: parsed.data.codigoConvite,
      });
      if (!r.ok) {
        setError(r.error || "Conta criada, mas falhou ao criar perfil. Tente entrar novamente.");
        return;
      }
      router.push(ROUTES.home);
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
        <h1 className="text-2xl font-bold text-white">Criar conta</h1>
        <p className="text-sm text-white/60">Bônus de boas-vindas após completar o cadastro</p>
      </div>
      {firebaseEmulatorsActive ? (
        <AlertBanner tone="info" className="text-sm">
          Emuladores ativos: esta conta ficará só no Auth/Firestore locais. Rode{" "}
          <code className="text-white/80">npm run emulators</code> na pasta{" "}
          <code className="text-white/80">recompensa-premiada</code> e deixe o terminal aberto. Se aparecer{" "}
          <strong className="text-white">port taken</strong>, feche a outra instância dos emuladores. O cadastro
          chama a Function <code className="text-white/80">initializeUserProfile</code> na mesma região do{" "}
          <code className="text-white/80">.env.local</code> (<code className="text-white/80">NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION</code>
          ).
        </AlertBanner>
      ) : null}
      {error ? (
        <AlertBanner tone="error" className="text-sm">
          {error}
        </AlertBanner>
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-white/50" htmlFor="nome">
            Nome
          </label>
          <input
            id="nome"
            maxLength={28}
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none focus:border-violet-500"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-white/50" htmlFor="username">
            Username (único)
          </label>
          <input
            id="username"
            autoComplete="username"
            maxLength={10}
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none focus:border-violet-500"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="ex.: joao_silva"
          />
        </div>
        <div>
          <label className="text-xs text-white/50" htmlFor="email2">
            E-mail
          </label>
          <input
            id="email2"
            type="email"
            autoComplete="email"
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none focus:border-violet-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-white/50" htmlFor="pass1">
            Senha
          </label>
          <input
            id="pass1"
            type="password"
            autoComplete="new-password"
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none focus:border-violet-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-white/50" htmlFor="pass2">
            Confirmar senha
          </label>
          <input
            id="pass2"
            type="password"
            autoComplete="new-password"
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none focus:border-violet-500"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-white/50" htmlFor="convite">
            Código de convite (opcional)
          </label>
          <input
            id="convite"
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none focus:border-violet-500"
            value={codigoConvite}
            onChange={(e) => setCodigoConvite(e.target.value.toUpperCase().replace(/\s+/g, ""))}
            placeholder="Ex.: PREMIA45"
          />
        </div>
        <Button type="submit" variant="gold" className="w-full" disabled={loading}>
          {loading ? "Criando…" : "Cadastrar e entrar"}
        </Button>
      </form>
      <p className="text-center text-sm text-white/55">
        Já tem conta?{" "}
        <Link href={ROUTES.login} className="text-violet-300 font-medium hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
