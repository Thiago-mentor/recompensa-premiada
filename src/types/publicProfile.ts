export interface PublicProfile {
  uid: string;
  nome: string;
  username: string | null;
  foto: string | null;
  level: number;
  xp: number;
  totalPartidas: number;
  totalVitorias: number;
  totalDerrotas: number;
  melhorStreak: number;
  rankingWins: number;
  rankingPodiums: number;
  bestRankingPosition: number | null;
}
