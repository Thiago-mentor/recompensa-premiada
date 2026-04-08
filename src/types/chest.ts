import type { Timestamp } from "./firestore";

export type ChestRarity = "comum" | "raro" | "epico" | "lendario";

export type ChestSource =
  | "multiplayer_win"
  | "mission_claim"
  | "daily_streak"
  | "ranking_reward"
  | "event";

export type ChestStatus = "queued" | "locked" | "unlocking" | "ready";

export interface ChestRewardSnapshot {
  coins: number;
  bonusCoins: number;
  gems: number;
  xp: number;
  fragments: number;
  boostMinutes: number;
  superPrizeEntries: number;
}

export interface GrantedChestSummary {
  id: string;
  rarity: ChestRarity;
  status: ChestStatus;
  slotIndex: number | null;
  queuePosition: number | null;
  source: ChestSource;
}

export interface ChestActionSnapshot {
  chestId: string;
  rarity: ChestRarity;
  status: ChestStatus;
  slotIndex: number | null;
  queuePosition: number | null;
  readyAtMs: number | null;
  remainingMs: number;
  adsUsed: number;
}

/** Documento raiz opcional em `user_chests/{uid}` para contadores e pity. */
export interface UserChestMetaDoc {
  userId: string;
  totalGranted: number;
  totalClaimed: number;
  dailySpeedupDayKey?: string | null;
  dailySpeedupCount?: number;
  noRareCount?: number;
  noEpicCount?: number;
  noLegendaryCount?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** `user_chests/{uid}/items/{chestId}` */
export interface UserChestItem {
  id: string;
  userId: string;
  rarity: ChestRarity;
  source: ChestSource;
  status: ChestStatus;
  slotIndex: number | null;
  queuePosition: number | null;
  unlockDurationSec: number;
  rewardsSnapshot: ChestRewardSnapshot;
  adsUsed: number;
  sourceRefId?: string | null;
  grantedAt: Timestamp;
  unlockStartedAt?: Timestamp | null;
  readyAt?: Timestamp | null;
  nextAdAvailableAt?: Timestamp | null;
  updatedAt: Timestamp;
}

export interface UserChestSummary {
  slots: Array<UserChestItem | null>;
  queue: UserChestItem[];
  readyCount: number;
  occupiedSlots: number;
  queuedCount: number;
  activeUnlockChestId: string | null;
  nextReadyAt: Timestamp | null;
  backlogFull: boolean;
}
