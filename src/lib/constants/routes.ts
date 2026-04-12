export const ROUTES = {
  login: "/login",
  cadastro: "/cadastro",
  home: "/home",
  missoes: "/missoes",
  jogos: "/jogos",
  recursos: "/recursos",
  jogosFila: "/jogos/fila",
  ranking: "/ranking",
  sorteios: "/sorteios",
  recompensas: "/recompensas",
  carteira: "/carteira",
  perfil: "/perfil",
  loja: "/loja",
  convidar: "/convidar",
  cla: "/cla",
  claMembros: "/cla/membros",
  claChat: "/cla/chat",
  claConfiguracoes: "/cla/configuracoes",
  admin: {
    dashboard: "/admin/dashboard",
    indicacoes: "/admin/indicacoes",
    jogos: "/admin/jogos",
    usuarios: "/admin/usuarios",
    rankings: "/admin/rankings",
    sorteios: "/admin/sorteios",
    quiz: "/admin/quiz",
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

export function routeClaPublico(clanId: string) {
  return `/cla/publico/${encodeURIComponent(clanId)}`;
}
