import type { GameId } from "@/types/game";
import type { ExperienceCatalogConfigEntry, ExperienceCategory } from "@/types/systemConfig";
import { GAME_COOLDOWN_SEC } from "@/lib/games/gameEconomy";
import { ROUTES, routeJogosFilaBuscar } from "@/lib/constants/routes";

export type GameCatalogEntry = {
  id: GameId;
  slug: string;
  title: string;
  subtitle: string;
  href: string;
  cooldownSec: number;
  /** Preparado para futuro 1v1 real */
  multiplayerReady: boolean;
  experienceKind: "arena" | "utility";
  highlightLabel?: string;
  sortOrder: number;
};

export type GameCatalogConfig = Partial<Record<GameId | string, ExperienceCatalogConfigEntry>>;

/** Catálogo exibido no hub — ordem fixa de replay. */
export const GAME_CATALOG: GameCatalogEntry[] = [
  {
    id: "ppt",
    slug: "pedra-papel-tesoura",
    title: "Pedra, papel e tesoura",
    subtitle: "1v1 real · fila automática · melhor de N na sala",
    href: routeJogosFilaBuscar("ppt"),
    cooldownSec: GAME_COOLDOWN_SEC.ppt,
    multiplayerReady: true,
    experienceKind: "arena",
    highlightLabel: "Confronto",
    sortOrder: 10,
  },
  {
    id: "quiz",
    slug: "quiz",
    title: "Quiz rápido 1×1",
    subtitle: "1v1 real · fila automática",
    href: routeJogosFilaBuscar("quiz"),
    cooldownSec: GAME_COOLDOWN_SEC.quiz,
    multiplayerReady: true,
    experienceKind: "arena",
    highlightLabel: "Confronto",
    sortOrder: 20,
  },
  {
    id: "reaction_tap",
    slug: "reaction",
    title: "Reaction tap",
    subtitle: "1v1 real · fila automática",
    href: routeJogosFilaBuscar("reaction_tap"),
    cooldownSec: GAME_COOLDOWN_SEC.reaction_tap,
    multiplayerReady: true,
    experienceKind: "arena",
    highlightLabel: "Confronto",
    sortOrder: 30,
  },
  {
    id: "roleta",
    slug: "roleta",
    title: "Roleta de PR",
    subtitle: "Prêmio definido no servidor · tabela ponderada",
    href: `${ROUTES.recursos}/roleta`,
    cooldownSec: GAME_COOLDOWN_SEC.roleta,
    multiplayerReady: false,
    experienceKind: "utility",
    highlightLabel: "Recurso",
    sortOrder: 40,
  },
  {
    id: "bau",
    slug: "bau",
    title: "Baú com cooldown",
    subtitle: "Loot aleatório · cooldown longo anti-farm",
    href: `${ROUTES.recursos}/bau`,
    cooldownSec: GAME_COOLDOWN_SEC.bau,
    multiplayerReady: false,
    experienceKind: "utility",
    highlightLabel: "Recurso",
    sortOrder: 50,
  },
];

function normalizeExperienceCategory(
  value: unknown,
  fallback: ExperienceCategory,
): ExperienceCategory {
  return value === "arena" || value === "utility" ? value : fallback;
}

function defaultHighlightLabel(kind: ExperienceCategory) {
  return kind === "arena" ? "Confronto" : "Recurso";
}

export function normalizeGameCatalogConfig(raw: unknown): GameCatalogConfig {
  if (!raw || typeof raw !== "object") return {};
  const data = raw as Record<string, unknown>;
  const out: GameCatalogConfig = {};
  for (const [gameId, value] of Object.entries(data)) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const fallbackCategory =
      GAME_CATALOG.find((game) => game.id === gameId)?.experienceKind ?? "utility";
    const category = normalizeExperienceCategory(item.category, fallbackCategory);
    const title = typeof item.title === "string" && item.title.trim() ? item.title.trim() : undefined;
    const subtitle =
      typeof item.subtitle === "string" && item.subtitle.trim() ? item.subtitle.trim() : undefined;
    const badgeLabel =
      typeof item.badgeLabel === "string" && item.badgeLabel.trim()
        ? item.badgeLabel.trim()
        : undefined;
    const orderRaw = Math.floor(Number(item.order));
    const order = Number.isFinite(orderRaw) ? orderRaw : undefined;
    out[gameId] = { category, title, subtitle, badgeLabel, order };
  }
  return out;
}

export function resolveConfiguredGameCatalog(config?: GameCatalogConfig): GameCatalogEntry[] {
  return GAME_CATALOG
    .map((game) => {
      const cfg = config?.[game.id];
      const category = normalizeExperienceCategory(cfg?.category, game.experienceKind);
      return {
        ...game,
        title: cfg?.title?.trim() ? cfg.title.trim() : game.title,
        subtitle: cfg?.subtitle?.trim() ? cfg.subtitle.trim() : game.subtitle,
        experienceKind: category,
        highlightLabel: cfg?.badgeLabel?.trim() ? cfg.badgeLabel.trim() : defaultHighlightLabel(category),
        sortOrder:
          typeof cfg?.order === "number" && Number.isFinite(cfg.order) ? cfg.order : game.sortOrder,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

export function splitConfiguredGameCatalog(catalog: GameCatalogEntry[]) {
  return {
    arena: catalog.filter((game) => game.experienceKind === "arena"),
    utility: catalog.filter((game) => game.experienceKind === "utility"),
  };
}

export const ARENA_GAME_CATALOG = splitConfiguredGameCatalog(GAME_CATALOG).arena;
export const UTILITY_EXPERIENCE_CATALOG = splitConfiguredGameCatalog(GAME_CATALOG).utility;

export function getGameBySlug(slug: string): GameCatalogEntry | undefined {
  return GAME_CATALOG.find((g) => g.slug === slug);
}
