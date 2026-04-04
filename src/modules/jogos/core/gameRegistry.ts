import type { GameId } from "@/types/game";
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
};

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
  },
  {
    id: "quiz",
    slug: "quiz",
    title: "Quiz rápido 1×1",
    subtitle: "1v1 real · fila automática",
    href: routeJogosFilaBuscar("quiz"),
    cooldownSec: GAME_COOLDOWN_SEC.quiz,
    multiplayerReady: true,
  },
  {
    id: "reaction_tap",
    slug: "reaction",
    title: "Reaction tap",
    subtitle: "1v1 real · fila automática",
    href: routeJogosFilaBuscar("reaction_tap"),
    cooldownSec: GAME_COOLDOWN_SEC.reaction_tap,
    multiplayerReady: true,
  },
  {
    id: "roleta",
    slug: "roleta",
    title: "Roleta de coins",
    subtitle: "Prêmio definido no servidor · tabela ponderada",
    href: `${ROUTES.jogos}/roleta`,
    cooldownSec: GAME_COOLDOWN_SEC.roleta,
    multiplayerReady: false,
  },
  {
    id: "bau",
    slug: "bau",
    title: "Baú com cooldown",
    subtitle: "Loot aleatório · cooldown longo anti-farm",
    href: `${ROUTES.jogos}/bau`,
    cooldownSec: GAME_COOLDOWN_SEC.bau,
    multiplayerReady: false,
  },
];

export function getGameBySlug(slug: string): GameCatalogEntry | undefined {
  return GAME_CATALOG.find((g) => g.slug === slug);
}
