export function getAvatarInitials(name: string | null | undefined): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function buildDefaultAvatarDataUrl(seed: string, displayName?: string | null): string {
  const palettes = [
    ["#06B6D4", "#7C3AED"],
    ["#8B5CF6", "#EC4899"],
    ["#F59E0B", "#EF4444"],
    ["#10B981", "#06B6D4"],
    ["#6366F1", "#A855F7"],
  ] as const;

  const normalizedSeed = seed.trim() || "user";
  const palette = palettes[hashString(normalizedSeed) % palettes.length];
  const initials = getAvatarInitials(displayName || normalizedSeed);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette[0]}" />
          <stop offset="100%" stop-color="${palette[1]}" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="32" fill="url(#g)" />
      <text
        x="50%"
        y="54%"
        dominant-baseline="middle"
        text-anchor="middle"
        fill="#ffffff"
        font-family="Arial, Helvetica, sans-serif"
        font-size="44"
        font-weight="700"
      >${initials}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function resolveAvatarUrl(input: {
  photoUrl?: string | null;
  name?: string | null;
  username?: string | null;
  uid?: string | null;
}): string {
  const raw = typeof input.photoUrl === "string" ? input.photoUrl.trim() : "";

  if (raw.length > 0) return raw;

  const seed = input.username || input.uid || input.name || "user";
  return buildDefaultAvatarDataUrl(seed, input.name ?? input.username ?? input.uid);
}

/** Para `backgroundImage`: URLs `data:...charset=UTF-8,...` contêm `;`; em `url(` sem aspas o CSS corta antes da vírgula. */
export function avatarBackgroundImageCssValue(resolvedUrl: string): string {
  const safe = resolvedUrl.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `url("${safe}")`;
}

export function resolveAvatarBackgroundCssValue(input: {
  photoUrl?: string | null;
  name?: string | null;
  username?: string | null;
  uid?: string | null;
}): string {
  return avatarBackgroundImageCssValue(resolveAvatarUrl(input));
}
