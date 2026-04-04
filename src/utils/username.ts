/** Sugere username estável a partir do e-mail + sufixo do uid (não garante unicidade — backend valida). */
export function suggestUsername(email: string | null | undefined, uid: string): string {
  const raw = (email?.split("@")[0] || "user").toLowerCase().replace(/[^a-z0-9_]/g, "");
  const base = (raw.length >= 3 ? raw : "user").slice(0, 14);
  return `${base}_${uid.replace(/[^a-z0-9]/gi, "").slice(0, 5)}`;
}
