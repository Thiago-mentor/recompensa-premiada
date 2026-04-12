/** Nomes das coleções Firestore (modelo de domínio) */
export const COLLECTIONS = {
  users: "users",
  clans: "clans",
  clanRankingsWeekly: "clan_rankings_weekly",
  clanMemberships: "clan_memberships",
  clanJoinRequests: "clan_join_requests",
  referralCampaigns: "referral_campaigns",
  referralRankingsDaily: "referral_rankings_daily",
  referralRankingsWeekly: "referral_rankings_weekly",
  referralRankingsMonthly: "referral_rankings_monthly",
  referralRankingsAllTime: "referral_rankings_alltime",
  missions: "missions",
  userMissions: "userMissions",
  games: "games",
  matches: "matches",
  rankingsDaily: "rankings_daily",
  rankingsWeekly: "rankings_weekly",
  rankingsMonthly: "rankings_monthly",
  walletTransactions: "wallet_transactions",
  rewardClaims: "reward_claims",
  adEvents: "ad_events",
  referrals: "referrals",
  fraudLogs: "fraud_logs",
  systemConfigs: "system_configs",
  quizQuestions: "quiz_questions",
  announcements: "announcements",
  supportTickets: "support_tickets",
  userChests: "user_chests",
  raffles: "raffles",
  rafflePurchases: "raffle_purchases",
  /** Fila automática: `matchmaking_queue/{gameId}/waiting/{uid}` — só Functions */
  matchmakingQueue: "matchmaking_queue",
  /** Sala 1v1 após pareamento */
  gameRooms: "game_rooms",
  /** Estado da fila / roomId para o cliente ouvir (`docId` = uid) — só Functions */
  multiplayerSlots: "multiplayer_slots",
} as const;

/** Subcoleções */
export const SUBCOLLECTIONS = {
  clanMembers: "members",
  clanMessages: "messages",
  clanContributors: "contributors",
  userMissionsDaily: "daily",
  userMissionsWeekly: "weekly",
  chestItems: "items",
  rankingEntries: "entries",
  rankingGames: "games",
  rankingMeta: "meta",
} as const;
