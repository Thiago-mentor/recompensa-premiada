"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Crown,
  Eye,
  Gem,
  Gift,
  Info,
  Save,
  WandSparkles,
} from "lucide-react";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { useAdminSaveFeedback } from "@/components/admin/AdminSaveFeedback";
import { Button } from "@/components/ui/Button";
import { COLLECTIONS } from "@/lib/constants/collections";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { cn } from "@/lib/utils/cn";
import {
  DEFAULT_ECONOMY_STREAK_SLICE,
  MAX_STREAK_DISPLAY_DAYS,
  normalizeStreakDisplayDays,
} from "@/services/economy/economyStreakConfig";
import { invalidateEconomyConfigCache } from "@/services/systemConfigs/economyDocumentCache";
import type { StreakRewardTier, SystemEconomyConfig } from "@/types/systemConfig";
import { normalizeStreakTable, resolveStreakRewardForDay } from "@/utils/streakReward";

const ECONOMY_ID = "economy";

type PrizeKind = "coins" | "gems" | "chest" | "combo";

type PrizeOption = {
  kind: PrizeKind;
  title: string;
  shortTitle: string;
  description: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: string;
  activeTone: string;
};

const PRIZE_OPTIONS: PrizeOption[] = [
  {
    kind: "coins",
    title: "Moedas PR",
    shortTitle: "PR",
    description: "Entrega somente moedas PR.",
    icon: Coins,
    tone: "border-amber-300/15 bg-amber-400/[0.06] text-amber-200",
    activeTone: "border-amber-300/65 bg-amber-400/15 ring-2 ring-amber-300/20",
  },
  {
    kind: "gems",
    title: "TICKET",
    shortTitle: "Ticket",
    description: "Entrega somente tickets.",
    icon: Gem,
    tone: "border-fuchsia-300/15 bg-fuchsia-400/[0.06] text-fuchsia-200",
    activeTone: "border-fuchsia-300/65 bg-fuchsia-400/15 ring-2 ring-fuchsia-300/20",
  },
  {
    kind: "chest",
    title: "Baú",
    shortTitle: "Baú",
    description: "Tenta adicionar um baú à fila do jogador.",
    icon: Gift,
    tone: "border-cyan-300/15 bg-cyan-400/[0.06] text-cyan-200",
    activeTone: "border-cyan-300/65 bg-cyan-400/15 ring-2 ring-cyan-300/20",
  },
  {
    kind: "combo",
    title: "Combo especial",
    shortTitle: "Combo",
    description: "Entrega PR e TICKET juntos.",
    icon: Crown,
    tone: "border-violet-300/15 bg-violet-400/[0.06] text-violet-200",
    activeTone: "border-violet-300/65 bg-violet-400/15 ring-2 ring-violet-300/20",
  },
];

const DISPLAY_DAY_OPTIONS = [7, 14, 21, 30] as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, value));
}

function resolvePrizeKind(reward: StreakRewardTier): PrizeKind {
  if (reward.tipoBonus === "bau") return "chest";
  if (reward.tipoBonus === "especial" || (reward.coins > 0 && reward.gems > 0)) {
    return "combo";
  }
  if (reward.gems > 0) return "gems";
  return "coins";
}

function getPrizeOption(reward: StreakRewardTier) {
  const kind = resolvePrizeKind(reward);
  return PRIZE_OPTIONS.find((option) => option.kind === kind) ?? PRIZE_OPTIONS[0];
}

function rewardLabel(reward: StreakRewardTier) {
  const kind = resolvePrizeKind(reward);
  if (kind === "chest") return "1 baú";
  if (kind === "gems") return `${formatNumber(reward.gems)} TICKET`;
  if (kind === "combo") {
    return `${formatNumber(reward.coins)} PR + ${formatNumber(reward.gems)} TICKET`;
  }
  return `${formatNumber(reward.coins)} PR`;
}

function createRewardForKind(
  day: number,
  kind: PrizeKind,
  current: StreakRewardTier,
  dailyBonus: number,
): StreakRewardTier {
  const safeCoins = Math.max(1, current.coins || dailyBonus || 50);
  const safeGems = Math.max(1, current.gems || 1);
  if (kind === "gems") return { dia: day, coins: 0, gems: safeGems, tipoBonus: "nenhum" };
  if (kind === "chest") return { dia: day, coins: 0, gems: 0, tipoBonus: "bau" };
  if (kind === "combo") {
    return { dia: day, coins: safeCoins, gems: safeGems, tipoBonus: "especial" };
  }
  return { dia: day, coins: safeCoins, gems: 0, tipoBonus: "nenhum" };
}

export default function AdminDailyRewardPage() {
  const { notify } = useAdminSaveFeedback();
  const [dailyBonus, setDailyBonus] = useState("50");
  const [displayDays, setDisplayDays] = useState(7);
  const [rows, setRows] = useState<StreakRewardTier[]>([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const db = getFirebaseFirestore();
        const snapshot = await getDoc(doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID));
        if (!snapshot.exists() || cancelled) return;
        const data = snapshot.data() as Partial<SystemEconomyConfig>;
        const bonus =
          typeof data.dailyLoginBonus === "number" && Number.isFinite(data.dailyLoginBonus)
            ? Math.max(0, Math.floor(data.dailyLoginBonus))
            : DEFAULT_ECONOMY_STREAK_SLICE.dailyLoginBonus;
        const normalizedRows = normalizeStreakTable(data.streakTable);
        const configuredLastDay = normalizedRows.reduce(
          (highest, reward) => Math.max(highest, reward.dia),
          0,
        );
        const configuredDays = normalizeStreakDisplayDays(data.streakDisplayDays);
        setDailyBonus(String(bonus));
        setDisplayDays(Math.min(MAX_STREAK_DISPLAY_DAYS, Math.max(configuredDays, configuredLastDay)));
        setRows(normalizedRows);
      } catch (error) {
        notify(
          "error",
          error instanceof Error ? error.message : "Não foi possível carregar a recompensa diária.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notify]);

  const safeDailyBonus = Math.max(0, Math.floor(Number(dailyBonus)) || 0);
  const rewards = useMemo(
    () =>
      Array.from({ length: displayDays }, (_, index) => {
        const day = index + 1;
        const reward = resolveStreakRewardForDay(day, rows, safeDailyBonus);
        return { dia: day, ...reward };
      }),
    [displayDays, rows, safeDailyBonus],
  );
  const activeDay = Math.min(selectedDay, displayDays);
  const activeReward = rewards[activeDay - 1] ?? {
    dia: activeDay,
    coins: safeDailyBonus,
    gems: 0,
    tipoBonus: "nenhum" as const,
  };
  const activeKind = resolvePrizeKind(activeReward);
  const chestDays = rewards.filter((reward) => resolvePrizeKind(reward) === "chest").length;
  const specialDays = rewards.filter((reward) => resolvePrizeKind(reward) === "combo").length;

  function changeDisplayDays(value: number) {
    const next = normalizeStreakDisplayDays(value);
    setDisplayDays(next);
    setSelectedDay((current) => Math.min(current, next));
  }

  function updateDay(day: number, updater: (reward: StreakRewardTier) => StreakRewardTier) {
    const current = rewards[day - 1] ?? {
      dia: day,
      coins: safeDailyBonus,
      gems: 0,
      tipoBonus: "nenhum" as const,
    };
    const next = updater(current);
    setRows((previous) => [...previous.filter((reward) => reward.dia !== day), next]);
  }

  function applyPremiumPreset() {
    const base = Math.max(1, safeDailyBonus || 50);
    setRows(
      Array.from({ length: displayDays }, (_, index): StreakRewardTier => {
        const day = index + 1;
        if (day % 7 === 0) {
          return { dia: day, coins: base * 5, gems: 5, tipoBonus: "especial" };
        }
        if (day % 5 === 0) return { dia: day, coins: 0, gems: 0, tipoBonus: "bau" };
        if (day % 3 === 0) return { dia: day, coins: 0, gems: 2, tipoBonus: "nenhum" };
        return { dia: day, coins: base + (day - 1) * Math.ceil(base / 2), gems: 0, tipoBonus: "nenhum" };
      }),
    );
    setSelectedDay(1);
  }

  async function save() {
    setSaving(true);
    try {
      const normalizedRewards = rewards.map((reward) => ({
        dia: reward.dia,
        coins: Math.max(0, Math.floor(Number(reward.coins)) || 0),
        gems: Math.max(0, Math.floor(Number(reward.gems)) || 0),
        tipoBonus: reward.tipoBonus,
      }));
      const invalidDay = normalizedRewards.find(
        (reward) => reward.coins === 0 && reward.gems === 0 && reward.tipoBonus !== "bau",
      );
      if (invalidDay) {
        notify("error", `O dia ${invalidDay.dia} precisa entregar pelo menos um prêmio.`);
        return;
      }
      const db = getFirebaseFirestore();
      await setDoc(
        doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID),
        {
          id: ECONOMY_ID,
          dailyLoginBonus: safeDailyBonus,
          streakDisplayDays: displayDays,
          streakTable: normalizedRewards,
        },
        { merge: true },
      );
      setRows(normalizedRewards);
      invalidateEconomyConfigCache();
      notify("success", "Calendário de recompensas diárias salvo e já disponível no app.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Erro ao salvar a recompensa diária.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHero
        eyebrow="Economia · fidelização"
        title="Recompensa diária"
        accent="violet"
        description="Monte a jornada dia por dia. Selecione um cartão no calendário, escolha o tipo do prêmio, informe os valores e salve. O jogador recebe exatamente o prêmio mostrado na prévia."
        actions={
          <Button type="button" variant="gold" onClick={save} disabled={loading || saving}>
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar calendário"}
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <AdminMetricCard
          title="Dias configurados"
          value={String(displayDays)}
          hint="Todos possuem premiação explícita"
          tone="violet"
          icon={<CalendarDays className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Dias com baú"
          value={String(chestDays)}
          hint="Dependem de espaço na fila de baús"
          tone="cyan"
          icon={<Gift className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Combos especiais"
          value={String(specialDays)}
          hint="PR e TICKET no mesmo check-in"
          tone="amber"
          icon={<Crown className="h-4 w-4" />}
        />
      </section>

      <fieldset disabled={loading || saving} className="contents">
      <section className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.98),rgba(30,20,70,0.9))] shadow-[0_24px_60px_-36px_rgba(139,92,246,0.8)]">
        <div className="border-b border-white/10 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-300/75">Etapa 1</p>
              <h2 className="mt-1 text-xl font-black text-white">Defina o tamanho do calendário</h2>
              <p className="mt-1 text-sm text-slate-400">Depois do último dia configurado, o sistema volta ao prêmio padrão em PR.</p>
            </div>
            <Button type="button" variant="secondary" onClick={applyPremiumPreset} disabled={loading}>
              <WandSparkles className="h-4 w-4" />
              Aplicar modelo premium
            </Button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.55fr)]">
            <div className="grid grid-cols-4 gap-2">
              {DISPLAY_DAY_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => changeDisplayDays(days)}
                  className={cn(
                    "rounded-xl border px-2 py-3 text-sm font-black transition",
                    displayDays === days
                      ? "border-violet-300/55 bg-violet-500/20 text-white shadow-[0_0_24px_-12px_rgba(167,139,250,0.8)]"
                      : "border-white/10 bg-black/20 text-slate-400 hover:border-violet-300/25 hover:text-white",
                  )}
                >
                  {days} dias
                </button>
              ))}
            </div>
            <label className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Prêmio padrão após o calendário</span>
              <span className="mt-1 flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-400" />
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={dailyBonus}
                  onChange={(event) => setDailyBonus(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-base font-black text-white outline-none"
                />
                <span className="text-xs font-bold text-amber-300">PR</span>
              </span>
            </label>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-300/75">Etapa 2</p>
              <h2 className="mt-1 text-xl font-black text-white">Escolha um dia para editar</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
              <Eye className="h-3 w-3" /> Prévia ao vivo
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {rewards.map((reward) => {
              const option = getPrizeOption(reward);
              const Icon = option.icon;
              const selected = reward.dia === activeDay;
              return (
                <button
                  key={reward.dia}
                  type="button"
                  onClick={() => setSelectedDay(reward.dia)}
                  className={cn(
                    "group relative min-h-28 overflow-hidden rounded-2xl border p-3 text-left transition duration-200",
                    option.tone,
                    selected
                      ? cn(option.activeTone, "-translate-y-1 shadow-[0_16px_30px_-18px_rgba(139,92,246,0.9)]")
                      : "hover:-translate-y-0.5 hover:border-white/25",
                  )}
                >
                  {selected ? (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-emerald-950">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  ) : null}
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-60">Dia {reward.dia}</span>
                  <span className="mt-3 flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-black/25 shadow-inner">
                    <Icon className="h-5 w-5" strokeWidth={2.3} />
                  </span>
                  <span className="mt-2 block text-[10px] font-black leading-tight text-white">{rewardLabel(reward)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-[1.6rem] border border-violet-300/20 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_38%),linear-gradient(145deg,rgba(2,6,23,0.98),rgba(30,20,70,0.92))] p-5 shadow-[0_20px_56px_-34px_rgba(168,85,247,0.75)]">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 to-amber-500 text-xl font-black text-amber-950 shadow-[0_8px_24px_-12px_rgba(251,191,36,0.9)]">
              {activeDay}
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-300/75">Etapa 3</p>
              <h2 className="text-xl font-black text-white">Premiação do dia {activeDay}</h2>
              <p className="text-xs text-slate-400">Selecione um tipo e configure apenas os valores necessários.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-11 px-0"
              disabled={activeDay <= 1}
              onClick={() => setSelectedDay(Math.max(1, activeDay - 1))}
              aria-label="Editar dia anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-11 px-0"
              disabled={activeDay >= displayDays}
              onClick={() => setSelectedDay(Math.min(displayDays, activeDay + 1))}
              aria-label="Editar próximo dia"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PRIZE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = activeKind === option.kind;
            return (
              <button
                key={option.kind}
                type="button"
                onClick={() =>
                  updateDay(activeDay, (reward) =>
                    createRewardForKind(activeDay, option.kind, reward, safeDailyBonus),
                  )
                }
                className={cn(
                  "rounded-2xl border p-4 text-left transition duration-200",
                  option.tone,
                  selected ? option.activeTone : "hover:-translate-y-0.5 hover:border-white/25",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/25">
                    <Icon className="h-5 w-5" strokeWidth={2.3} />
                  </span>
                  {selected ? <Check className="h-5 w-5 text-emerald-300" strokeWidth={3} /> : null}
                </span>
                <span className="mt-3 block text-sm font-black text-white">{option.title}</span>
                <span className="mt-1 block text-xs leading-relaxed opacity-65">{option.description}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {activeKind === "coins" || activeKind === "combo" ? (
            <RewardValueField
              label="Quantidade de PR"
              value={activeReward.coins}
              suffix="PR"
              icon={<Coins className="h-5 w-5 text-amber-400" />}
              onChange={(value) =>
                updateDay(activeDay, (reward) => ({ ...reward, coins: value }))
              }
            />
          ) : null}
          {activeKind === "gems" || activeKind === "combo" ? (
            <RewardValueField
              label="Quantidade de TICKET"
              value={activeReward.gems}
              suffix="TICKET"
              icon={<Gem className="h-5 w-5 text-fuchsia-400" />}
              onChange={(value) =>
                updateDay(activeDay, (reward) => ({ ...reward, gems: value }))
              }
            />
          ) : null}
          {activeKind === "chest" ? (
            <div className="sm:col-span-2 flex gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.07] p-4 text-sm text-cyan-100">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
              <p className="leading-relaxed">O sistema tentará colocar um baú na fila do jogador. A raridade segue as probabilidades configuradas na página <strong>Baús</strong>; se a fila estiver cheia, nenhum baú adicional será criado.</p>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl border", getPrizeOption(activeReward).tone)}>
              {(() => {
                const Icon = getPrizeOption(activeReward).icon;
                return <Icon className="h-5 w-5" strokeWidth={2.4} />;
              })()}
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resumo do dia {activeDay}</p>
              <p className="font-black text-white">{getPrizeOption(activeReward).title} · {rewardLabel(activeReward)}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={activeDay >= displayDays}
            onClick={() => setSelectedDay(Math.min(displayDays, activeDay + 1))}
          >
            Próximo dia <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </section>
      </fieldset>

      <div className="sticky bottom-3 z-20 flex justify-end rounded-2xl border border-white/10 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-xl">
        <Button type="button" variant="gold" size="lg" onClick={save} disabled={loading || saving}>
          <Save className="h-5 w-5" />
          {saving ? "Salvando calendário..." : "Salvar recompensa diária"}
        </Button>
      </div>
    </div>
  );
}

function RewardValueField({
  label,
  value,
  suffix,
  icon,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  icon: ReactNode;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <span className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5">
        {icon}
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(Math.max(0, Math.floor(Number(event.target.value)) || 0))}
          className="min-w-0 flex-1 bg-transparent text-xl font-black text-white outline-none"
        />
        <span className="text-xs font-black text-slate-400">{suffix}</span>
      </span>
    </label>
  );
}
