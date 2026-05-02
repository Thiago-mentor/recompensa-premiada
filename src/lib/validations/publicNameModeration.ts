const BLOCKED_NAME_PATTERNS: RegExp[] = [
  /porn/i,
  /porno/i,
  /porn[oô]graf/i,
  /sex[o0]?/i,
  /put[ao]/i,
  /puta/i,
  /putaria/i,
  /caralh/i,
  /cu(?![a-z])/i,
  /bucet/i,
  /bct/i,
  /pqp/i,
  /foder/i,
  /foda/i,
  /fodase/i,
  /merd/i,
  /porra/i,
  /cacete/i,
  /desgra[çc]/i,
  /arromb/i,
  /vagabund/i,
  /fdp/i,
  /filh[ao]d[ae]puta/i,
  /nazi/i,
  /hitler/i,
  /racist/i,
];

function normalizePublicNameValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[@$!|1]/g, "i")
    .replace(/[0º°]/g, "o")
    .replace(/[3]/g, "e")
    .replace(/[4]/g, "a")
    .replace(/[5]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[^a-z0-9]/g, "");
}

export function hasBlockedPublicNameTerm(value: string): boolean {
  const normalized = normalizePublicNameValue(value);
  if (!normalized) return false;
  return BLOCKED_NAME_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function validatePublicName(value: string): string | null {
  if (hasBlockedPublicNameTerm(value)) {
    return "Esse nome não é permitido. Evite palavrões, pornografia, ofensas ou termos inadequados.";
  }
  return null;
}
