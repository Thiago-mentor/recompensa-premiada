import { buildDefaultAvatarDataUrl, getAvatarInitials } from "@/lib/users/avatar";
import type { Clan } from "@/types/clan";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const palettes = [
  ["rgba(34,211,238,0.38)", "rgba(124,58,237,0.42)", "#22d3ee", "#c4b5fd"],
  ["rgba(217,70,239,0.34)", "rgba(14,165,233,0.36)", "#f0abfc", "#67e8f9"],
  ["rgba(251,191,36,0.3)", "rgba(239,68,68,0.34)", "#fde68a", "#fecaca"],
  ["rgba(16,185,129,0.3)", "rgba(59,130,246,0.34)", "#a7f3d0", "#bfdbfe"],
  ["rgba(99,102,241,0.34)", "rgba(168,85,247,0.36)", "#c7d2fe", "#e9d5ff"],
] as const;

function clanSeed(input: Pick<Clan, "id" | "tag" | "name">): string {
  return `${input.id}:${input.tag}:${input.name}`;
}

function clanPalette(input: Pick<Clan, "id" | "tag" | "name">) {
  return palettes[hashString(clanSeed(input)) % palettes.length]!;
}

export function resolveClanAvatarUrl(input: Pick<Clan, "avatarUrl" | "id" | "tag" | "name">): string {
  if (input.avatarUrl && input.avatarUrl.trim()) return input.avatarUrl;
  return buildDefaultAvatarDataUrl(input.tag || input.id, input.tag || input.name);
}

export function resolveClanCoverStyle(
  input: Pick<Clan, "coverUrl" | "id" | "tag" | "name"> &
    Partial<Pick<Clan, "coverPositionX" | "coverPositionY" | "coverScale">>,
) {
  const posX = typeof input.coverPositionX === "number" ? input.coverPositionX : 50;
  const posY = typeof input.coverPositionY === "number" ? input.coverPositionY : 50;
  const scale = typeof input.coverScale === "number" ? input.coverScale : 100;
  if (input.coverUrl && input.coverUrl.trim()) {
    return {
      backgroundImage: `url("${input.coverUrl}")`,
      backgroundPosition: `${posX}% ${posY}%`,
      backgroundSize: `${scale}%`,
      backgroundRepeat: "no-repeat",
    };
  }
  const [from, to, line, glow] = clanPalette(input);
  return {
    backgroundImage: `radial-gradient(circle at top left, ${from}, transparent 34%), radial-gradient(circle at bottom right, ${to}, transparent 40%), linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.95))`,
    borderColor: line,
    boxShadow: `0 0 42px -22px ${glow}`,
  };
}

export function resolveClanMonogram(input: Pick<Clan, "tag" | "name">): string {
  const raw = input.tag?.trim() || getAvatarInitials(input.name);
  return raw.slice(0, 3).toUpperCase();
}
