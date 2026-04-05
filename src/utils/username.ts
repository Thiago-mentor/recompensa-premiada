/**
 * Username para sync após login (Google / e-mail), alinhado à Cloud Function:
 * 3–10 caracteres, apenas a-z, 0-9 e _.
 *
 * O e-mail não entra na string final: o local-part costuma passar de 10 caracteres e o backend
 * rejeitaria; por isso usamos um prefixo estável + trecho do uid (único por usuário).
 */
export function suggestUsername(_email: string | null | undefined, uid: string): string {
  const clean = uid.replace(/[^a-z0-9]/gi, "").toLowerCase();
  let s = `u${clean.slice(0, 9)}`;
  if (s.length < 3) {
    s = `${s}000`.slice(0, 10);
  }
  return s.slice(0, 10);
}
