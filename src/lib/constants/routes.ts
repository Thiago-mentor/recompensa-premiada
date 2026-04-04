export const ROUTES = {
  login: "/login",
  cadastro: "/cadastro",
  home: "/home",
  missoes: "/missoes",
  jogos: "/jogos",
  jogosFila: "/jogos/fila",
  ranking: "/ranking",
  recompensas: "/recompensas",
  carteira: "/carteira",
  perfil: "/perfil",
  loja: "/loja",
  convidar: "/convidar",
  admin: {
    dashboard: "/admin/dashboard",
    usuarios: "/admin/usuarios",
    rankings: "/admin/rankings",
    recompensas: "/admin/recompensas",
    missoes: "/admin/missoes",
    configuracoes: "/admin/configuracoes",
    fraudes: "/admin/fraudes",
  },
} as const;

/** Fila 1v1 já abre em “procurando oponente” (`buscar=1`). */
export function routeJogosFilaBuscar(gameId: string) {
  const q = new URLSearchParams({ gameId, buscar: "1" });
  return `${ROUTES.jogosFila}?${q.toString()}`;
}
