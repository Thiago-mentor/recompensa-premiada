"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { Button } from "@/components/ui/Button";
import { syncUserProfileAfterAuth, useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/lib/constants/routes";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { validatePublicName } from "@/lib/validations/publicNameModeration";

export function EscolherNomeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, profileResolvedUid, loading } = useAuth();
  const [nome, setNome] = useState("");
  const [codigoConvite, setCodigoConvite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCodigoConvite(searchParams.get("convite")?.trim().toUpperCase() ?? "");
  }, [searchParams]);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(ROUTES.login);
    else if (profileResolvedUid === user.uid && profile) router.replace(ROUTES.home);
  }, [loading, user, profile, profileResolvedUid, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!user) {
      setError("Sua sessão expirou. Entre novamente com Google.");
      return;
    }

    const gameName = nome.trim();
    if (!/^[a-zA-Z0-9_]{3,10}$/.test(gameName)) {
      setError("Escolha de 3 a 10 caracteres: letras, números ou _.");
      return;
    }
    if (validatePublicName(gameName)) {
      setError("Esse nome não é permitido. Escolha outro.");
      return;
    }

    const inviteCode = codigoConvite.trim().toUpperCase();
    if (inviteCode && !/^[A-Z0-9]{4,16}$/.test(inviteCode)) {
      setError("Confira o código de convite. Ele deve conter apenas letras e números.");
      return;
    }

    setSaving(true);
    try {
      const result = await syncUserProfileAfterAuth({
        user,
        nome: gameName,
        username: gameName.toLowerCase(),
        codigoConvite: inviteCode || undefined,
      });
      if (!result.ok) {
        setError(result.error || "Não foi possível criar seu perfil. Tente novamente.");
        return;
      }
      router.replace(ROUTES.home);
    } catch (cause) {
      setError(formatFirebaseError(cause));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user || profileResolvedUid !== user.uid || profile) {
    return <div className="py-12 text-center text-white/60">Preparando seu perfil…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div aria-hidden="true" className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-300/25 to-violet-500/25 text-3xl shadow-[0_0_35px_rgba(250,204,21,0.18)]">
          ★
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300">Seu primeiro passo</p>
        <h1 className="mt-2 text-2xl font-black text-white">Como vamos chamar você?</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          Escolha o nome que os outros jogadores verão nas partidas e no ranking.
        </p>
      </div>

      {error ? <AlertBanner tone="error">{error}</AlertBanner> : null}

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <div>
          <label htmlFor="game-name" className="text-sm font-semibold text-white">Nome no jogo</label>
          <input
            id="game-name"
            name="game-name"
            autoComplete="nickname"
            autoCapitalize="none"
            spellCheck={false}
            required
            minLength={3}
            maxLength={10}
            pattern="[A-Za-z0-9_]{3,10}"
            value={nome}
            onChange={(event) => setNome(event.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
            placeholder="Ex.: Gamer_01"
            className="mt-2 w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3.5 text-lg font-semibold text-white outline-none transition placeholder:text-white/30 focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/15"
          />
          <p className="mt-2 text-xs text-white/50">3 a 10 caracteres. Esse nome precisa ser único.</p>
        </div>

        <div className="rounded-2xl border border-violet-300/15 bg-violet-400/[0.06] p-4">
          <label htmlFor="invite-code" className="text-sm font-semibold text-white">Código de convite <span className="font-normal text-white/50">(opcional)</span></label>
          <p className="mt-1 text-xs leading-relaxed text-white/55">Se um amigo convidou você, informe o código antes de entrar no jogo.</p>
          <input
            id="invite-code"
            name="invite-code"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={16}
            value={codigoConvite}
            onChange={(event) => setCodigoConvite(event.target.value.toUpperCase().replace(/\s/g, ""))}
            placeholder="Ex.: RIVAL123"
            className="mt-3 w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-violet-300/70"
          />
        </div>

        <Button type="submit" variant="gold" size="lg" className="w-full" disabled={saving}>
          {saving ? "Criando seu perfil…" : "Começar a jogar"}
        </Button>
      </form>
    </div>
  );
}
