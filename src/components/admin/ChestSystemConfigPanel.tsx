"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useAdminSaveFeedback } from "@/components/admin/AdminSaveFeedback";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { Button } from "@/components/ui/Button";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { cn } from "@/lib/utils/cn";
import type { ChestRarity, ChestSource } from "@/types/chest";
import type {
  ChestBonusRewardKind,
  ChestBonusRewardTable,
  ChestBonusRewardWeight,
  ChestDropWeight,
  ChestRewardTable,
  ChestSystemConfig,
} from "@/types/systemConfig";

const CHEST_SYSTEM_ID = "chest_system";
const CHEST_RARITIES: ChestRarity[] = ["comum", "raro", "epico", "lendario"];
const CHEST_SOURCES: ChestSource[] = [
  "multiplayer_win",
  "mission_claim",
  "daily_streak",
  "ranking_reward",
  "event",
];

const RARITY_LABEL: Record<ChestRarity, string> = {
  comum: "Comum",
  raro: "Raro",
  epico: "Épico",
  lendario: "Lendário",
};

const SOURCE_LABEL: Record<ChestSource, string> = {
  multiplayer_win: "Vitória multiplayer",
  mission_claim: "Missão resgatada",
  daily_streak: "Marco da streak",
  ranking_reward: "Fechamento de ranking",
  event: "Evento",
};

const CHEST_BONUS_REWARD_KINDS: ChestBonusRewardKind[] = [
  "bonusCoins",
  "fragments",
  "boostMinutes",
  "superPrizeEntries",
];

const BONUS_LABEL: Record<ChestBonusRewardKind, string> = {
  bonusCoins: "PR bônus",
  fragments: "Fragmentos",
  boostMinutes: "Boost (min)",
  superPrizeEntries: "Entradas especiais",
};

const DEFAULT_CHEST_SYSTEM_CONFIG: Omit<ChestSystemConfig, "id" | "updatedAt"> = {
  enabled: true,
  slotCount: 4,
  queueCapacity: 4,
  unlockDurationsByRarity: {
    comum: 60 * 60,
    raro: 3 * 60 * 60,
    epico: 8 * 60 * 60,
    lendario: 12 * 60 * 60,
  },
  dropTablesBySource: {
    multiplayer_win: [
      { rarity: "comum", weight: 70 },
      { rarity: "raro", weight: 22 },
      { rarity: "epico", weight: 7 },
      { rarity: "lendario", weight: 1 },
    ],
    mission_claim: [
      { rarity: "comum", weight: 20 },
      { rarity: "raro", weight: 55 },
      { rarity: "epico", weight: 22 },
      { rarity: "lendario", weight: 3 },
    ],
    daily_streak: [
      { rarity: "comum", weight: 0 },
      { rarity: "raro", weight: 55 },
      { rarity: "epico", weight: 35 },
      { rarity: "lendario", weight: 10 },
    ],
    ranking_reward: [
      { rarity: "comum", weight: 0 },
      { rarity: "raro", weight: 20 },
      { rarity: "epico", weight: 60 },
      { rarity: "lendario", weight: 20 },
    ],
    event: [
      { rarity: "comum", weight: 0 },
      { rarity: "raro", weight: 10 },
      { rarity: "epico", weight: 60 },
      { rarity: "lendario", weight: 30 },
    ],
  },
  rewardTablesByRarity: {
    comum: {
      coins: { min: 40, max: 90 },
      gems: { min: 0, max: 2 },
      xp: { min: 12, max: 22 },
    },
    raro: {
      coins: { min: 90, max: 180 },
      gems: { min: 1, max: 4 },
      xp: { min: 25, max: 45 },
    },
    epico: {
      coins: { min: 200, max: 380 },
      gems: { min: 4, max: 10 },
      xp: { min: 50, max: 80 },
    },
    lendario: {
      coins: { min: 450, max: 800 },
      gems: { min: 10, max: 25 },
      xp: { min: 90, max: 150 },
    },
  },
  bonusWeightsByRarity: {
    comum: [
      { kind: "bonusCoins", weight: 78 },
      { kind: "fragments", weight: 16 },
      { kind: "boostMinutes", weight: 5 },
      { kind: "superPrizeEntries", weight: 1 },
    ],
    raro: [
      { kind: "bonusCoins", weight: 55 },
      { kind: "fragments", weight: 25 },
      { kind: "boostMinutes", weight: 15 },
      { kind: "superPrizeEntries", weight: 5 },
    ],
    epico: [
      { kind: "bonusCoins", weight: 35 },
      { kind: "fragments", weight: 30 },
      { kind: "boostMinutes", weight: 25 },
      { kind: "superPrizeEntries", weight: 10 },
    ],
    lendario: [
      { kind: "bonusCoins", weight: 25 },
      { kind: "fragments", weight: 25 },
      { kind: "boostMinutes", weight: 30 },
      { kind: "superPrizeEntries", weight: 20 },
    ],
  },
  bonusRewardTablesByRarity: {
    comum: {
      bonusCoins: { min: 15, max: 40 },
      fragments: { min: 1, max: 2 },
      boostMinutes: { min: 5, max: 10 },
      superPrizeEntries: { min: 1, max: 1 },
    },
    raro: {
      bonusCoins: { min: 30, max: 90 },
      fragments: { min: 2, max: 4 },
      boostMinutes: { min: 10, max: 20 },
      superPrizeEntries: { min: 1, max: 2 },
    },
    epico: {
      bonusCoins: { min: 80, max: 180 },
      fragments: { min: 4, max: 8 },
      boostMinutes: { min: 20, max: 40 },
      superPrizeEntries: { min: 1, max: 3 },
    },
    lendario: {
      bonusCoins: { min: 160, max: 360 },
      fragments: { min: 8, max: 15 },
      boostMinutes: { min: 45, max: 90 },
      superPrizeEntries: { min: 2, max: 5 },
    },
  },
  adSpeedupPercent: 0.33,
  adSpeedupFixedMinutes: 0,
  maxAdsPerChest: 3,
  adCooldownSeconds: 3 * 60,
  dailyChestAdsLimit: 12,
  pityRules: {
    rareAt: 4,
    epicAt: 12,
    legendaryAt: 40,
  },
};

type RewardRangeForm = {
  min: string;
  max: string;
};

type RewardTableForm = {
  coins: RewardRangeForm;
  gems: RewardRangeForm;
  xp: RewardRangeForm;
};

type ChestSystemForm = {
  enabled: boolean;
  slotCount: string;
  queueCapacity: string;
  unlockDurationsByRarity: Record<ChestRarity, string>;
  dropTablesBySource: Record<ChestSource, Record<ChestRarity, string>>;
  rewardTablesByRarity: Record<ChestRarity, RewardTableForm>;
  bonusWeightsByRarity: Record<ChestRarity, Record<ChestBonusRewardKind, string>>;
  bonusRewardTablesByRarity: Record<ChestRarity, Record<ChestBonusRewardKind, RewardRangeForm>>;
  adSpeedupPercent: string;
  adSpeedupFixedMinutes: string;
  maxAdsPerChest: string;
  adCooldownSeconds: string;
  dailyChestAdsLimit: string;
  pityRules: {
    rareAt: string;
    epicAt: string;
    legendaryAt: string;
  };
};

function buildWeightsRecord(weights: ChestDropWeight[]): Record<ChestRarity, string> {
  const out: Record<ChestRarity, string> = {
    comum: "0",
    raro: "0",
    epico: "0",
    lendario: "0",
  };
  for (const weight of weights) {
    out[weight.rarity] = String(weight.weight);
  }
  return out;
}

function buildBonusWeightsRecord(
  weights: ChestBonusRewardWeight[],
): Record<ChestBonusRewardKind, string> {
  const out: Record<ChestBonusRewardKind, string> = {
    bonusCoins: "0",
    fragments: "0",
    boostMinutes: "0",
    superPrizeEntries: "0",
  };
  for (const weight of weights) {
    out[weight.kind] = String(weight.weight);
  }
  return out;
}

function buildRewardRange(min: number, max: number): RewardRangeForm {
  return { min: String(min), max: String(max) };
}

function buildRewardTable(table: ChestRewardTable): RewardTableForm {
  return {
    coins: buildRewardRange(table.coins.min, table.coins.max),
    gems: buildRewardRange(table.gems.min, table.gems.max),
    xp: buildRewardRange(table.xp.min, table.xp.max),
  };
}

function buildBonusRewardTable(
  table: ChestBonusRewardTable,
): Record<ChestBonusRewardKind, RewardRangeForm> {
  return {
    bonusCoins: buildRewardRange(table.bonusCoins.min, table.bonusCoins.max),
    fragments: buildRewardRange(table.fragments.min, table.fragments.max),
    boostMinutes: buildRewardRange(table.boostMinutes.min, table.boostMinutes.max),
    superPrizeEntries: buildRewardRange(table.superPrizeEntries.min, table.superPrizeEntries.max),
  };
}

function defaultForm(): ChestSystemForm {
  return {
    enabled: DEFAULT_CHEST_SYSTEM_CONFIG.enabled,
    slotCount: String(DEFAULT_CHEST_SYSTEM_CONFIG.slotCount),
    queueCapacity: String(DEFAULT_CHEST_SYSTEM_CONFIG.queueCapacity),
    unlockDurationsByRarity: {
      comum: String(DEFAULT_CHEST_SYSTEM_CONFIG.unlockDurationsByRarity.comum),
      raro: String(DEFAULT_CHEST_SYSTEM_CONFIG.unlockDurationsByRarity.raro),
      epico: String(DEFAULT_CHEST_SYSTEM_CONFIG.unlockDurationsByRarity.epico),
      lendario: String(DEFAULT_CHEST_SYSTEM_CONFIG.unlockDurationsByRarity.lendario),
    },
    dropTablesBySource: {
      multiplayer_win: buildWeightsRecord(DEFAULT_CHEST_SYSTEM_CONFIG.dropTablesBySource.multiplayer_win),
      mission_claim: buildWeightsRecord(DEFAULT_CHEST_SYSTEM_CONFIG.dropTablesBySource.mission_claim),
      daily_streak: buildWeightsRecord(DEFAULT_CHEST_SYSTEM_CONFIG.dropTablesBySource.daily_streak),
      ranking_reward: buildWeightsRecord(DEFAULT_CHEST_SYSTEM_CONFIG.dropTablesBySource.ranking_reward),
      event: buildWeightsRecord(DEFAULT_CHEST_SYSTEM_CONFIG.dropTablesBySource.event),
    },
    rewardTablesByRarity: {
      comum: buildRewardTable(DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.comum),
      raro: buildRewardTable(DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.raro),
      epico: buildRewardTable(DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.epico),
      lendario: buildRewardTable(DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.lendario),
    },
    bonusWeightsByRarity: {
      comum: buildBonusWeightsRecord(DEFAULT_CHEST_SYSTEM_CONFIG.bonusWeightsByRarity.comum),
      raro: buildBonusWeightsRecord(DEFAULT_CHEST_SYSTEM_CONFIG.bonusWeightsByRarity.raro),
      epico: buildBonusWeightsRecord(DEFAULT_CHEST_SYSTEM_CONFIG.bonusWeightsByRarity.epico),
      lendario: buildBonusWeightsRecord(DEFAULT_CHEST_SYSTEM_CONFIG.bonusWeightsByRarity.lendario),
    },
    bonusRewardTablesByRarity: {
      comum: buildBonusRewardTable(DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.comum),
      raro: buildBonusRewardTable(DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.raro),
      epico: buildBonusRewardTable(DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.epico),
      lendario: buildBonusRewardTable(DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.lendario),
    },
    adSpeedupPercent: String(Math.round(DEFAULT_CHEST_SYSTEM_CONFIG.adSpeedupPercent * 100)),
    adSpeedupFixedMinutes: String(DEFAULT_CHEST_SYSTEM_CONFIG.adSpeedupFixedMinutes),
    maxAdsPerChest: String(DEFAULT_CHEST_SYSTEM_CONFIG.maxAdsPerChest),
    adCooldownSeconds: String(DEFAULT_CHEST_SYSTEM_CONFIG.adCooldownSeconds),
    dailyChestAdsLimit: String(DEFAULT_CHEST_SYSTEM_CONFIG.dailyChestAdsLimit),
    pityRules: {
      rareAt: String(DEFAULT_CHEST_SYSTEM_CONFIG.pityRules.rareAt),
      epicAt: String(DEFAULT_CHEST_SYSTEM_CONFIG.pityRules.epicAt),
      legendaryAt: String(DEFAULT_CHEST_SYSTEM_CONFIG.pityRules.legendaryAt),
    },
  };
}

function toForm(raw?: Partial<ChestSystemConfig>): ChestSystemForm {
  const base = defaultForm();
  if (!raw) return base;

  const dropTables =
    raw.dropTablesBySource && typeof raw.dropTablesBySource === "object"
      ? raw.dropTablesBySource
      : undefined;
  const rewardTables =
    raw.rewardTablesByRarity && typeof raw.rewardTablesByRarity === "object"
      ? raw.rewardTablesByRarity
      : undefined;
  const bonusWeights =
    raw.bonusWeightsByRarity && typeof raw.bonusWeightsByRarity === "object"
      ? raw.bonusWeightsByRarity
      : undefined;
  const bonusRewardTables =
    raw.bonusRewardTablesByRarity && typeof raw.bonusRewardTablesByRarity === "object"
      ? raw.bonusRewardTablesByRarity
      : undefined;

  return {
    enabled: raw.enabled ?? base.enabled,
    slotCount: String(raw.slotCount ?? base.slotCount),
    queueCapacity: String(raw.queueCapacity ?? base.queueCapacity),
    unlockDurationsByRarity: {
      comum: String(raw.unlockDurationsByRarity?.comum ?? base.unlockDurationsByRarity.comum),
      raro: String(raw.unlockDurationsByRarity?.raro ?? base.unlockDurationsByRarity.raro),
      epico: String(raw.unlockDurationsByRarity?.epico ?? base.unlockDurationsByRarity.epico),
      lendario: String(raw.unlockDurationsByRarity?.lendario ?? base.unlockDurationsByRarity.lendario),
    },
    dropTablesBySource: {
      multiplayer_win: Array.isArray(dropTables?.multiplayer_win)
        ? buildWeightsRecord(dropTables.multiplayer_win)
        : base.dropTablesBySource.multiplayer_win,
      mission_claim: Array.isArray(dropTables?.mission_claim)
        ? buildWeightsRecord(dropTables.mission_claim)
        : base.dropTablesBySource.mission_claim,
      daily_streak: Array.isArray(dropTables?.daily_streak)
        ? buildWeightsRecord(dropTables.daily_streak)
        : base.dropTablesBySource.daily_streak,
      ranking_reward: Array.isArray(dropTables?.ranking_reward)
        ? buildWeightsRecord(dropTables.ranking_reward)
        : base.dropTablesBySource.ranking_reward,
      event: Array.isArray(dropTables?.event)
        ? buildWeightsRecord(dropTables.event)
        : base.dropTablesBySource.event,
    },
    rewardTablesByRarity: {
      comum: rewardTables?.comum ? buildRewardTable(rewardTables.comum) : base.rewardTablesByRarity.comum,
      raro: rewardTables?.raro ? buildRewardTable(rewardTables.raro) : base.rewardTablesByRarity.raro,
      epico: rewardTables?.epico ? buildRewardTable(rewardTables.epico) : base.rewardTablesByRarity.epico,
      lendario: rewardTables?.lendario
        ? buildRewardTable(rewardTables.lendario)
        : base.rewardTablesByRarity.lendario,
    },
    bonusWeightsByRarity: {
      comum: Array.isArray(bonusWeights?.comum)
        ? buildBonusWeightsRecord(bonusWeights.comum)
        : base.bonusWeightsByRarity.comum,
      raro: Array.isArray(bonusWeights?.raro)
        ? buildBonusWeightsRecord(bonusWeights.raro)
        : base.bonusWeightsByRarity.raro,
      epico: Array.isArray(bonusWeights?.epico)
        ? buildBonusWeightsRecord(bonusWeights.epico)
        : base.bonusWeightsByRarity.epico,
      lendario: Array.isArray(bonusWeights?.lendario)
        ? buildBonusWeightsRecord(bonusWeights.lendario)
        : base.bonusWeightsByRarity.lendario,
    },
    bonusRewardTablesByRarity: {
      comum: bonusRewardTables?.comum
        ? buildBonusRewardTable(bonusRewardTables.comum)
        : base.bonusRewardTablesByRarity.comum,
      raro: bonusRewardTables?.raro
        ? buildBonusRewardTable(bonusRewardTables.raro)
        : base.bonusRewardTablesByRarity.raro,
      epico: bonusRewardTables?.epico
        ? buildBonusRewardTable(bonusRewardTables.epico)
        : base.bonusRewardTablesByRarity.epico,
      lendario: bonusRewardTables?.lendario
        ? buildBonusRewardTable(bonusRewardTables.lendario)
        : base.bonusRewardTablesByRarity.lendario,
    },
    adSpeedupPercent: String(
      Math.round(
        ((typeof raw.adSpeedupPercent === "number"
          ? raw.adSpeedupPercent
          : DEFAULT_CHEST_SYSTEM_CONFIG.adSpeedupPercent) || 0) * 100,
      ),
    ),
    adSpeedupFixedMinutes: String(
      typeof raw.adSpeedupFixedMinutes === "number"
        ? raw.adSpeedupFixedMinutes
        : DEFAULT_CHEST_SYSTEM_CONFIG.adSpeedupFixedMinutes,
    ),
    maxAdsPerChest: String(raw.maxAdsPerChest ?? base.maxAdsPerChest),
    adCooldownSeconds: String(raw.adCooldownSeconds ?? base.adCooldownSeconds),
    dailyChestAdsLimit: String(raw.dailyChestAdsLimit ?? base.dailyChestAdsLimit),
    pityRules: {
      rareAt: String(raw.pityRules?.rareAt ?? base.pityRules.rareAt),
      epicAt: String(raw.pityRules?.epicAt ?? base.pityRules.epicAt),
      legendaryAt: String(raw.pityRules?.legendaryAt ?? base.pityRules.legendaryAt),
    },
  };
}

function readInt(value: string, fallback: number, min = 0): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
}

function readPercent(value: string, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(95, Math.max(5, parsed)) / 100;
}

function readRewardRange(form: RewardRangeForm, fallback: { min: number; max: number }) {
  const min = readInt(form.min, fallback.min, 0);
  const max = Math.max(min, readInt(form.max, fallback.max, min));
  return { min, max };
}

export function ChestSystemConfigPanel({
  boostSystemEnabled = true,
}: {
  boostSystemEnabled?: boolean;
}) {
  const { notify } = useAdminSaveFeedback();
  const [form, setForm] = useState<ChestSystemForm>(() => defaultForm());
  const [saving, setSaving] = useState(false);
  const visibleBonusRewardKinds = useMemo(
    () =>
      boostSystemEnabled
        ? CHEST_BONUS_REWARD_KINDS
        : CHEST_BONUS_REWARD_KINDS.filter((kind) => kind !== "boostMinutes"),
    [boostSystemEnabled],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const db = getFirebaseFirestore();
        const snap = await getDoc(doc(db, COLLECTIONS.systemConfigs, CHEST_SYSTEM_ID));
        if (!snap.exists() || cancelled) return;
        setForm(toForm(snap.data() as Partial<ChestSystemConfig>));
      } catch {
        if (!cancelled) {
          notify(
            "info",
            "Usando o preset local do sistema de baús. Salve para publicar uma configuração explícita.",
            { durationMs: 8000 },
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sourceTotals = useMemo(
    () =>
      Object.fromEntries(
        CHEST_SOURCES.map((source) => [
          source,
          CHEST_RARITIES.reduce(
            (acc, rarity) => acc + Math.max(0, Math.floor(Number(form.dropTablesBySource[source][rarity]) || 0)),
            0,
          ),
        ]),
      ) as Record<ChestSource, number>,
    [form.dropTablesBySource],
  );
  const bonusTotalsByRarity = useMemo(
    () =>
      Object.fromEntries(
        CHEST_RARITIES.map((rarity) => [
          rarity,
          visibleBonusRewardKinds.reduce(
            (acc, kind) =>
              acc + Math.max(0, Math.floor(Number(form.bonusWeightsByRarity[rarity][kind]) || 0)),
            0,
          ),
        ]),
      ) as Record<ChestRarity, number>,
    [form.bonusWeightsByRarity, visibleBonusRewardKinds],
  );

  async function saveChestSystem() {
    const zeroSources = CHEST_SOURCES.filter((source) => sourceTotals[source] <= 0);
    if (zeroSources.length > 0) {
      notify(
        "error",
        `Cada origem precisa ter pelo menos um peso acima de zero. Revise: ${zeroSources
          .map((source) => SOURCE_LABEL[source])
          .join(", ")}.`,
      );
      return;
    }
    const zeroBonusRarities = CHEST_RARITIES.filter((rarity) => bonusTotalsByRarity[rarity] <= 0);
    if (zeroBonusRarities.length > 0) {
      notify(
        "error",
        `Cada raridade precisa ter pelo menos um bônus extra configurado. Revise: ${zeroBonusRarities
          .map((rarity) => RARITY_LABEL[rarity])
          .join(", ")}.`,
      );
      return;
    }

    const rareAt = readInt(form.pityRules.rareAt, DEFAULT_CHEST_SYSTEM_CONFIG.pityRules.rareAt, 1);
    const epicAt = readInt(form.pityRules.epicAt, DEFAULT_CHEST_SYSTEM_CONFIG.pityRules.epicAt, 1);
    const legendaryAt = readInt(
      form.pityRules.legendaryAt,
      DEFAULT_CHEST_SYSTEM_CONFIG.pityRules.legendaryAt,
      1,
    );

    if (!(rareAt < epicAt && epicAt < legendaryAt)) {
      notify("error", "As regras de pity precisam seguir a ordem: raro < épico < lendário.");
      return;
    }

    setSaving(true);
    try {
      const db = getFirebaseFirestore();
      await setDoc(
        doc(db, COLLECTIONS.systemConfigs, CHEST_SYSTEM_ID),
        {
          id: CHEST_SYSTEM_ID,
          enabled: form.enabled,
          slotCount: readInt(form.slotCount, DEFAULT_CHEST_SYSTEM_CONFIG.slotCount, 1),
          queueCapacity: readInt(form.queueCapacity, DEFAULT_CHEST_SYSTEM_CONFIG.queueCapacity, 0),
          unlockDurationsByRarity: {
            comum: readInt(
              form.unlockDurationsByRarity.comum,
              DEFAULT_CHEST_SYSTEM_CONFIG.unlockDurationsByRarity.comum,
              1,
            ),
            raro: readInt(
              form.unlockDurationsByRarity.raro,
              DEFAULT_CHEST_SYSTEM_CONFIG.unlockDurationsByRarity.raro,
              1,
            ),
            epico: readInt(
              form.unlockDurationsByRarity.epico,
              DEFAULT_CHEST_SYSTEM_CONFIG.unlockDurationsByRarity.epico,
              1,
            ),
            lendario: readInt(
              form.unlockDurationsByRarity.lendario,
              DEFAULT_CHEST_SYSTEM_CONFIG.unlockDurationsByRarity.lendario,
              1,
            ),
          },
          dropTablesBySource: Object.fromEntries(
            CHEST_SOURCES.map((source) => [
              source,
              CHEST_RARITIES.map((rarity) => ({
                rarity,
                weight: readInt(form.dropTablesBySource[source][rarity], 0, 0),
              })).filter((entry) => entry.weight > 0),
            ]),
          ),
          rewardTablesByRarity: {
            comum: {
              coins: readRewardRange(
                form.rewardTablesByRarity.comum.coins,
                DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.comum.coins,
              ),
              gems: readRewardRange(
                form.rewardTablesByRarity.comum.gems,
                DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.comum.gems,
              ),
              xp: readRewardRange(
                form.rewardTablesByRarity.comum.xp,
                DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.comum.xp,
              ),
            },
            raro: {
              coins: readRewardRange(
                form.rewardTablesByRarity.raro.coins,
                DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.raro.coins,
              ),
              gems: readRewardRange(
                form.rewardTablesByRarity.raro.gems,
                DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.raro.gems,
              ),
              xp: readRewardRange(
                form.rewardTablesByRarity.raro.xp,
                DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.raro.xp,
              ),
            },
            epico: {
              coins: readRewardRange(
                form.rewardTablesByRarity.epico.coins,
                DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.epico.coins,
              ),
              gems: readRewardRange(
                form.rewardTablesByRarity.epico.gems,
                DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.epico.gems,
              ),
              xp: readRewardRange(
                form.rewardTablesByRarity.epico.xp,
                DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.epico.xp,
              ),
            },
            lendario: {
              coins: readRewardRange(
                form.rewardTablesByRarity.lendario.coins,
                DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.lendario.coins,
              ),
              gems: readRewardRange(
                form.rewardTablesByRarity.lendario.gems,
                DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.lendario.gems,
              ),
              xp: readRewardRange(
                form.rewardTablesByRarity.lendario.xp,
                DEFAULT_CHEST_SYSTEM_CONFIG.rewardTablesByRarity.lendario.xp,
              ),
            },
          },
          bonusWeightsByRarity: Object.fromEntries(
            CHEST_RARITIES.map((rarity) => [
              rarity,
              CHEST_BONUS_REWARD_KINDS.map((kind) => ({
                kind,
                weight: readInt(form.bonusWeightsByRarity[rarity][kind], 0, 0),
              })).filter((entry) => entry.weight > 0),
            ]),
          ),
          bonusRewardTablesByRarity: {
            comum: {
              bonusCoins: readRewardRange(
                form.bonusRewardTablesByRarity.comum.bonusCoins,
                DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.comum.bonusCoins,
              ),
              fragments: readRewardRange(
                form.bonusRewardTablesByRarity.comum.fragments,
                DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.comum.fragments,
              ),
              boostMinutes: readRewardRange(
                form.bonusRewardTablesByRarity.comum.boostMinutes,
                DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.comum.boostMinutes,
              ),
              superPrizeEntries: readRewardRange(
                form.bonusRewardTablesByRarity.comum.superPrizeEntries,
                DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.comum.superPrizeEntries,
              ),
            },
            raro: {
              bonusCoins: readRewardRange(
                form.bonusRewardTablesByRarity.raro.bonusCoins,
                DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.raro.bonusCoins,
              ),
              fragments: readRewardRange(
                form.bonusRewardTablesByRarity.raro.fragments,
                DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.raro.fragments,
              ),
              boostMinutes: readRewardRange(
                form.bonusRewardTablesByRarity.raro.boostMinutes,
                DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.raro.boostMinutes,
              ),
              superPrizeEntries: readRewardRange(
                form.bonusRewardTablesByRarity.raro.superPrizeEntries,
                DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.raro.superPrizeEntries,
              ),
            },
            epico: {
              bonusCoins: readRewardRange(
                form.bonusRewardTablesByRarity.epico.bonusCoins,
                DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.epico.bonusCoins,
              ),
              fragments: readRewardRange(
                form.bonusRewardTablesByRarity.epico.fragments,
                DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.epico.fragments,
              ),
              boostMinutes: readRewardRange(
                form.bonusRewardTablesByRarity.epico.boostMinutes,
                DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.epico.boostMinutes,
              ),
              superPrizeEntries: readRewardRange(
                form.bonusRewardTablesByRarity.epico.superPrizeEntries,
                DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.epico.superPrizeEntries,
              ),
            },
            lendario: {
              bonusCoins: readRewardRange(
                form.bonusRewardTablesByRarity.lendario.bonusCoins,
                DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.lendario.bonusCoins,
              ),
              fragments: readRewardRange(
                form.bonusRewardTablesByRarity.lendario.fragments,
                DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.lendario.fragments,
              ),
              boostMinutes: readRewardRange(
                form.bonusRewardTablesByRarity.lendario.boostMinutes,
                DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.lendario.boostMinutes,
              ),
              superPrizeEntries: readRewardRange(
                form.bonusRewardTablesByRarity.lendario.superPrizeEntries,
                DEFAULT_CHEST_SYSTEM_CONFIG.bonusRewardTablesByRarity.lendario.superPrizeEntries,
              ),
            },
          },
          adSpeedupPercent: readPercent(
            form.adSpeedupPercent,
            DEFAULT_CHEST_SYSTEM_CONFIG.adSpeedupPercent * 100,
          ),
          adSpeedupFixedMinutes: Math.min(
            7 * 24 * 60,
            readInt(
              form.adSpeedupFixedMinutes,
              DEFAULT_CHEST_SYSTEM_CONFIG.adSpeedupFixedMinutes,
              0,
            ),
          ),
          maxAdsPerChest: readInt(form.maxAdsPerChest, DEFAULT_CHEST_SYSTEM_CONFIG.maxAdsPerChest, 0),
          adCooldownSeconds: readInt(
            form.adCooldownSeconds,
            DEFAULT_CHEST_SYSTEM_CONFIG.adCooldownSeconds,
            0,
          ),
          dailyChestAdsLimit: readInt(
            form.dailyChestAdsLimit,
            DEFAULT_CHEST_SYSTEM_CONFIG.dailyChestAdsLimit,
            0,
          ),
          pityRules: {
            rareAt,
            epicAt,
            legendaryAt,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      notify("success", "Sistema de baús salvo em system_configs/chest_system.");
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Erro ao salvar o sistema de baús.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-[1.5rem] border border-amber-400/20 bg-amber-950/15 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Sistema de baús</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Controle slots, fila, pity, aceleração por anúncio, pesos de drop e faixa de recompensas
            do documento <code className="text-slate-300">system_configs/chest_system</code>.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-white">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((current) => ({ ...current, enabled: e.target.checked }))}
          />
          Sistema ativo
        </label>
      </div>

      {!boostSystemEnabled ? (
        <AlertBanner tone="info">
          O boost está desligado na economia. As opções de boost dos baús foram ocultadas, mas os
          valores atuais continuam preservados para uso futuro.
        </AlertBanner>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
          <h3 className="text-base font-semibold text-white">Capacidade e anúncios</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <ConfigField
              label="Slots ativos"
              value={form.slotCount}
              onChange={(value) => setForm((current) => ({ ...current, slotCount: value }))}
            />
            <ConfigField
              label="Capacidade da fila"
              value={form.queueCapacity}
              onChange={(value) => setForm((current) => ({ ...current, queueCapacity: value }))}
            />
            <ConfigField
              label="Aceleração por anúncio (%)"
              value={form.adSpeedupPercent}
              onChange={(value) => setForm((current) => ({ ...current, adSpeedupPercent: value }))}
            />
            <ConfigField
              label="Min. fixos cortados por anúncio"
              value={form.adSpeedupFixedMinutes}
              onChange={(value) =>
                setForm((current) => ({ ...current, adSpeedupFixedMinutes: value }))
              }
            />
            <ConfigField
              label="Máx. anúncios por baú"
              value={form.maxAdsPerChest}
              onChange={(value) => setForm((current) => ({ ...current, maxAdsPerChest: value }))}
            />
            <ConfigField
              label="Cooldown entre anúncios (s)"
              value={form.adCooldownSeconds}
              onChange={(value) => setForm((current) => ({ ...current, adCooldownSeconds: value }))}
            />
            <ConfigField
              label="Limite diário de ads"
              value={form.dailyChestAdsLimit}
              onChange={(value) => setForm((current) => ({ ...current, dailyChestAdsLimit: value }))}
            />
          </div>
          <p className="text-xs text-slate-400">
            Use <strong className="text-white">minutos fixos &gt; 0</strong> para um corte prévisível
            por anúncio (limitado ao que ainda falta). Com <strong className="text-white">0 min.</strong>,
            só vale o percentual — o backend força esse percentual entre{" "}
            <strong className="text-white">5%</strong> e <strong className="text-white">95%</strong> por
            anúncio. Máx. configurável nos minutos fixos: uma semana.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
          <h3 className="text-base font-semibold text-white">Pity e desbloqueio por raridade</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <ConfigField
              label="Garantir raro em"
              value={form.pityRules.rareAt}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  pityRules: { ...current.pityRules, rareAt: value },
                }))
              }
            />
            <ConfigField
              label="Garantir épico em"
              value={form.pityRules.epicAt}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  pityRules: { ...current.pityRules, epicAt: value },
                }))
              }
            />
            <ConfigField
              label="Garantir lendário em"
              value={form.pityRules.legendaryAt}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  pityRules: { ...current.pityRules, legendaryAt: value },
                }))
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {CHEST_RARITIES.map((rarity) => (
              <ConfigField
                key={rarity}
                label={`${RARITY_LABEL[rarity]} (segundos)`}
                value={form.unlockDurationsByRarity[rarity]}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    unlockDurationsByRarity: {
                      ...current.unlockDurationsByRarity,
                      [rarity]: value,
                    },
                  }))
                }
              />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Pesos de drop por origem</h3>
            <p className="mt-1 text-xs text-slate-400">
              Os pesos não precisam somar exatamente 100, mas cada origem precisa ter pelo menos um
              valor acima de zero.
            </p>
          </div>
          <p className="text-xs text-slate-500">Ordem visual: comum, raro, épico, lendário</p>
        </div>

        <div className="space-y-3">
          {CHEST_SOURCES.map((source) => (
            <div key={source} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-white">{SOURCE_LABEL[source]}</p>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                    sourceTotals[source] > 0
                      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                      : "border-rose-400/20 bg-rose-500/10 text-rose-100",
                  )}
                >
                  total {sourceTotals[source]}
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {CHEST_RARITIES.map((rarity) => (
                  <ConfigField
                    key={`${source}-${rarity}`}
                    label={RARITY_LABEL[rarity]}
                    value={form.dropTablesBySource[source][rarity]}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        dropTablesBySource: {
                          ...current.dropTablesBySource,
                          [source]: {
                            ...current.dropTablesBySource[source],
                            [rarity]: value,
                          },
                        },
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <div>
          <h3 className="text-base font-semibold text-white">Recompensa base por raridade</h3>
          <p className="mt-1 text-xs text-slate-400">
            Essa camada continua alimentando a economia atual com PR, TICKET e XP. O loot bônus fica
            logo abaixo.
          </p>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {CHEST_RARITIES.map((rarity) => (
            <div key={rarity} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="font-medium text-white">{RARITY_LABEL[rarity]}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <RangeField
                  label="PR"
                  form={form.rewardTablesByRarity[rarity].coins}
                  onChange={(next) =>
                    setForm((current) => ({
                      ...current,
                      rewardTablesByRarity: {
                        ...current.rewardTablesByRarity,
                        [rarity]: {
                          ...current.rewardTablesByRarity[rarity],
                          coins: next,
                        },
                      },
                    }))
                  }
                />
                <RangeField
                  label="TICKET"
                  form={form.rewardTablesByRarity[rarity].gems}
                  onChange={(next) =>
                    setForm((current) => ({
                      ...current,
                      rewardTablesByRarity: {
                        ...current.rewardTablesByRarity,
                        [rarity]: {
                          ...current.rewardTablesByRarity[rarity],
                          gems: next,
                        },
                      },
                    }))
                  }
                />
                <RangeField
                  label="XP"
                  form={form.rewardTablesByRarity[rarity].xp}
                  onChange={(next) =>
                    setForm((current) => ({
                      ...current,
                      rewardTablesByRarity: {
                        ...current.rewardTablesByRarity,
                        [rarity]: {
                          ...current.rewardTablesByRarity[rarity],
                          xp: next,
                        },
                      },
                    }))
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <div>
          <h3 className="text-base font-semibold text-white">Pesos do loot bônus por raridade</h3>
          <p className="mt-1 text-xs text-slate-400">
            {boostSystemEnabled
              ? "Cada baú mantém a recompensa base e ainda sorteia um extra ponderado entre PR bônus, fragmentos, boost em minutos ou entradas especiais."
              : "Cada baú mantém a recompensa base e ainda sorteia um extra ponderado entre PR bônus, fragmentos ou entradas especiais."}
          </p>
        </div>
        <div className="space-y-3">
          {CHEST_RARITIES.map((rarity) => (
            <div key={`bonus-weights-${rarity}`} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-white">{RARITY_LABEL[rarity]}</p>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                    bonusTotalsByRarity[rarity] > 0
                      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                      : "border-rose-400/20 bg-rose-500/10 text-rose-100",
                  )}
                >
                  total {bonusTotalsByRarity[rarity]}
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {visibleBonusRewardKinds.map((kind) => (
                  <ConfigField
                    key={`${rarity}-${kind}`}
                    label={BONUS_LABEL[kind]}
                    value={form.bonusWeightsByRarity[rarity][kind]}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        bonusWeightsByRarity: {
                          ...current.bonusWeightsByRarity,
                          [rarity]: {
                            ...current.bonusWeightsByRarity[rarity],
                            [kind]: value,
                          },
                        },
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <div>
          <h3 className="text-base font-semibold text-white">Faixas do loot bônus</h3>
          <p className="mt-1 text-xs text-slate-400">
            Quando o tipo bônus é sorteado, o backend usa a faixa abaixo para definir a quantidade.
          </p>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {CHEST_RARITIES.map((rarity) => (
            <div key={`bonus-ranges-${rarity}`} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="font-medium text-white">{RARITY_LABEL[rarity]}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {visibleBonusRewardKinds.map((kind) => (
                  <RangeField
                    key={`${rarity}-range-${kind}`}
                    label={BONUS_LABEL[kind]}
                    form={form.bonusRewardTablesByRarity[rarity][kind]}
                    onChange={(next) =>
                      setForm((current) => ({
                        ...current,
                        bonusRewardTablesByRarity: {
                          ...current.bonusRewardTablesByRarity,
                          [rarity]: {
                            ...current.bonusRewardTablesByRarity[rarity],
                            [kind]: next,
                          },
                        },
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={saveChestSystem} disabled={saving}>
          {saving ? "Salvando sistema..." : "Salvar sistema de baús"}
        </Button>
      </div>
    </section>
  );
}

function ConfigField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function RangeField({
  label,
  form,
  onChange,
}: {
  label: string;
  form: RewardRangeForm;
  onChange: (next: RewardRangeForm) => void;
}) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <input
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
          value={form.min}
          onChange={(e) => onChange({ ...form, min: e.target.value })}
          placeholder="Min"
        />
        <input
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
          value={form.max}
          onChange={(e) => onChange({ ...form, max: e.target.value })}
          placeholder="Max"
        />
      </div>
    </div>
  );
}
