import type {
  ChestActionSnapshot,
  ChestRarity,
  ChestRewardSnapshot,
  ChestSource,
  ChestStatus,
  GrantedChestSummary,
  UserChestItem,
  UserChestSummary,
} from "@/types/chest";
import type { Timestamp } from "@/types/firestore";

export const DEFAULT_CHEST_SLOT_COUNT = 4;
export const DEFAULT_CHEST_QUEUE_CAPACITY = 4;

export const CHEST_RARITY_LABEL: Record<ChestRarity, string> = {
  comum: "Comum",
  raro: "Raro",
  epico: "Épico",
  lendario: "Lendário",
};

export const CHEST_SOURCE_LABEL: Record<ChestSource, string> = {
  multiplayer_win: "Vitória multiplayer",
  mission_claim: "Missão",
  daily_streak: "Streak diária",
  ranking_reward: "Ranking",
  event: "Evento",
};

export const CHEST_STATUS_LABEL: Record<ChestStatus, string> = {
  queued: "Na fila",
  locked: "Aguardando abertura",
  unlocking: "Liberando",
  ready: "Pronto",
};

export type ResolvedChestItem = UserChestItem & {
  resolvedStatus: ChestStatus;
  remainingMs: number;
  readyAtMs: number | null;
  unlockStartedAtMs: number | null;
  nextAdAvailableAtMs: number | null;
  /** Tempo restante até permitir novo anúncio de aceleração (0 = pode assistir já). */
  speedupCooldownRemainingMs: number;
  /** Só true se é o próximo baú **locked** a abrir na ordem dos slots + demais regras. */
  canStartUnlock: boolean;
  /** Mensagem/UI quando locked mas não pode tocar em Iniciar (ordem ou outro já liberando). */
  unlockStartBlockedReason: "concurrent_unlock" | "prioritize_lower_slot" | null;
  canSpeedUp: boolean;
  canClaim: boolean;
};

function rewardValue(raw: unknown): number {
  return Math.max(0, Math.floor(Number(raw) || 0));
}

export function normalizeChestRewardSnapshot(
  raw: Partial<ChestRewardSnapshot> | Record<string, unknown> | null | undefined,
): ChestRewardSnapshot {
  const value = raw && typeof raw === "object" ? raw : {};
  return {
    coins: rewardValue(value.coins),
    bonusCoins: rewardValue(value.bonusCoins),
    gems: rewardValue(value.gems),
    xp: rewardValue(value.xp),
    fragments: rewardValue(value.fragments),
    boostMinutes: rewardValue(value.boostMinutes),
    superPrizeEntries: rewardValue(value.superPrizeEntries),
  };
}

function timestampToMs(value: Timestamp | { toMillis?: () => number } | null | undefined): number | null {
  if (!value || typeof value !== "object") return null;
  if (typeof (value as { toMillis?: () => number }).toMillis === "function") {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return null;
    }
  }
  return null;
}

export function resolveChestStatus(item: UserChestItem, nowMs = Date.now()): ChestStatus {
  const readyAtMs = timestampToMs(item.readyAt);
  if (item.status === "unlocking" && readyAtMs != null && readyAtMs <= nowMs) {
    return "ready";
  }
  return item.status;
}

export function toResolvedChestItem(
  item: UserChestItem,
  nowMs = Date.now(),
): ResolvedChestItem {
  const readyAtMs = timestampToMs(item.readyAt);
  const unlockStartedAtMs = timestampToMs(item.unlockStartedAt);
  const nextAdAvailableAtMs = timestampToMs(item.nextAdAvailableAt);
  const resolvedStatus = resolveChestStatus(item, nowMs);
  const remainingMs =
    resolvedStatus === "unlocking" && readyAtMs != null ? Math.max(0, readyAtMs - nowMs) : 0;
  const speedupCooldownRemainingMs =
    nextAdAvailableAtMs != null && nextAdAvailableAtMs > nowMs ? nextAdAvailableAtMs - nowMs : 0;
  const rewardsSnapshot = normalizeChestRewardSnapshot(
    item.rewardsSnapshot as Partial<ChestRewardSnapshot> | Record<string, unknown>,
  );
  return {
    ...item,
    rewardsSnapshot,
    resolvedStatus,
    remainingMs,
    readyAtMs,
    unlockStartedAtMs,
    nextAdAvailableAtMs,
    speedupCooldownRemainingMs,
    canStartUnlock: resolvedStatus === "locked",
    unlockStartBlockedReason: null,
    canSpeedUp: resolvedStatus === "unlocking",
    canClaim: resolvedStatus === "ready",
  };
}

export function buildChestSummary(
  items: UserChestItem[],
  nowMs = Date.now(),
  slotCount = DEFAULT_CHEST_SLOT_COUNT,
  queueCapacity = DEFAULT_CHEST_QUEUE_CAPACITY,
): { items: ResolvedChestItem[]; summary: UserChestSummary } {
  let resolvedItems = items
    .map((item) => toResolvedChestItem(item, nowMs))
    .sort((a, b) => {
      const slotA = a.slotIndex ?? Number.MAX_SAFE_INTEGER;
      const slotB = b.slotIndex ?? Number.MAX_SAFE_INTEGER;
      if (slotA !== slotB) return slotA - slotB;
      const queueA = a.queuePosition ?? Number.MAX_SAFE_INTEGER;
      const queueB = b.queuePosition ?? Number.MAX_SAFE_INTEGER;
      if (queueA !== queueB) return queueA - queueB;
      return a.id.localeCompare(b.id);
    });

  const concurrentUnlockBlocking = resolvedItems.some(
    (item) => item.resolvedStatus === "unlocking",
  );

  const lockedOccupyingSlots = resolvedItems.filter(
    (item) =>
      item.resolvedStatus === "locked" &&
      item.slotIndex != null &&
      item.slotIndex >= 0 &&
      item.slotIndex < slotCount,
  );

  let prioritizedLockedChestId: string | null = null;
  if (!concurrentUnlockBlocking && lockedOccupyingSlots.length > 0) {
    prioritizedLockedChestId = lockedOccupyingSlots.reduce((best, cur) =>
      (cur.slotIndex ?? Number.MAX_SAFE_INTEGER) < (best.slotIndex ?? Number.MAX_SAFE_INTEGER)
        ? cur
        : best,
    ).id;
  }

  resolvedItems = resolvedItems.map((item) => {
    const inSlotUi =
      item.slotIndex != null && item.slotIndex >= 0 && item.slotIndex < slotCount;
    const canStart =
      item.resolvedStatus === "locked" &&
      !concurrentUnlockBlocking &&
      prioritizedLockedChestId !== null &&
      item.id === prioritizedLockedChestId;
    let unlockStartBlockedReason: ResolvedChestItem["unlockStartBlockedReason"] = null;
    if (
      item.resolvedStatus === "locked" &&
      !canStart &&
      inSlotUi &&
      lockedOccupyingSlots.length > 0
    ) {
      unlockStartBlockedReason = concurrentUnlockBlocking
        ? "concurrent_unlock"
        : "prioritize_lower_slot";
    }
    return {
      ...item,
      canStartUnlock: canStart,
      unlockStartBlockedReason,
    };
  });

  const slots: Array<ResolvedChestItem | null> = Array.from({ length: slotCount }, () => null);
  const queue = resolvedItems
    .filter((item) => item.queuePosition != null)
    .sort((a, b) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0))
    .slice(0, queueCapacity);

  for (const item of resolvedItems) {
    if (item.slotIndex != null && item.slotIndex >= 0 && item.slotIndex < slotCount) {
      slots[item.slotIndex] = item;
    }
  }

  const activeUnlock = resolvedItems.find((item) => item.resolvedStatus === "unlocking") ?? null;
  const nextReadyAt =
    activeUnlock?.readyAt && typeof activeUnlock.readyAt === "object" ? activeUnlock.readyAt : null;

  return {
    items: resolvedItems,
    summary: {
      slots,
      queue,
      readyCount: resolvedItems.filter((item) => item.resolvedStatus === "ready").length,
      occupiedSlots: slots.filter(Boolean).length,
      queuedCount: queue.length,
      activeUnlockChestId: activeUnlock?.id ?? null,
      nextReadyAt,
      backlogFull:
        slots.filter(Boolean).length >= slotCount && queue.length >= queueCapacity,
    },
  };
}

export function toChestActionSnapshot(
  input: ChestActionSnapshot,
): ChestActionSnapshot {
  return input;
}

export function formatChestDurationMs(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatChestRewardSummary(rewards: ChestRewardSnapshot): string {
  const parts = listChestRewardSummaryParts(rewards);

  return parts.length > 0 ? parts.join(" · ") : "Recompensa surpresa";
}

export function listChestRewardSummaryParts(rewards: ChestRewardSnapshot): string[] {
  return [
    rewards.coins > 0 ? `+${rewards.coins} PR` : null,
    rewards.bonusCoins > 0 ? `+${rewards.bonusCoins} PR bônus` : null,
    rewards.gems > 0 ? `+${rewards.gems} TICKET` : null,
    rewards.xp > 0 ? `+${rewards.xp} XP` : null,
    rewards.fragments > 0
      ? `+${rewards.fragments} fragmento${rewards.fragments === 1 ? "" : "s"}`
      : null,
    rewards.boostMinutes > 0 ? `Boost ${rewards.boostMinutes} min` : null,
    rewards.superPrizeEntries > 0
      ? `+${rewards.superPrizeEntries} entrada${rewards.superPrizeEntries === 1 ? " especial" : "s especiais"}`
      : null,
  ].filter((part): part is string => Boolean(part));
}

export function formatChestPlacement(input: {
  status?: ChestStatus;
  slotIndex?: number | null;
  queuePosition?: number | null;
}): string {
  if (input.status === "ready") {
    return input.slotIndex != null
      ? `Pronto para coletar no slot ${input.slotIndex + 1}`
      : "Pronto para coletar";
  }
  if (input.status === "unlocking") {
    return input.slotIndex != null
      ? `Liberando no slot ${input.slotIndex + 1}`
      : "Liberando agora";
  }
  if (input.queuePosition != null) {
    return `Entrou na fila ${input.queuePosition + 1}`;
  }
  if (input.slotIndex != null) {
    return `Ocupou o slot ${input.slotIndex + 1}`;
  }
  return "Adicionado ao hub";
}

export function describeGrantedChest(
  chest: GrantedChestSummary | null | undefined,
): string | null {
  if (!chest) return null;
  return `Baú ${CHEST_RARITY_LABEL[chest.rarity]} concedido. ${formatChestPlacement(chest)}.`;
}
