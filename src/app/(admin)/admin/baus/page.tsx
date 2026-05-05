"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Clock3, Gift, Sparkles, TimerReset } from "lucide-react";
import { AdminAdCooldownGuide } from "@/components/admin/AdminAdCooldownGuide";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { ChestSystemConfigPanel } from "@/components/admin/ChestSystemConfigPanel";
import { useAdminSaveFeedback } from "@/components/admin/AdminSaveFeedback";
import { Button } from "@/components/ui/Button";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import type { StreakRewardTier, SystemEconomyConfig } from "@/types/systemConfig";
import {
  DEFAULT_STREAK_DISPLAY_DAYS,
  MAX_STREAK_DISPLAY_DAYS,
  normalizeStreakDisplayDays,
} from "@/services/economy/economyStreakConfig";
import { normalizeStreakTable } from "@/utils/streakReward";
import { invalidateEconomyConfigCache } from "@/services/systemConfigs/economyDocumentCache";
import {
  formatCooldownMinutesDisplay,
  minutesInputToSeconds,
  secondsToMinutesInputValue,
} from "@/lib/admin/rewardedAdCooldownInput";

const ECONOMY_ID = "economy";

const emptyTier = (): StreakRewardTier => ({
  dia: 7,
  coins: 100,
  gems: 0,
  tipoBonus: "bau",
});

export default function AdminBausPage() {
  const { notify } = useAdminSaveFeedback();
  const [dailyBonus, setDailyBonus] = useState("50");
  const [chestCooldownMinutes, setChestCooldownMinutes] = useState(() =>
    secondsToMinutesInputValue(3600),
  );
  const [boostEnabled, setBoostEnabled] = useState(false);
  const [streakRows, setStreakRows] = useState<StreakRewardTier[]>([]);
  const [streakDisplayDays, setStreakDisplayDays] = useState(
    String(DEFAULT_STREAK_DISPLAY_DAYS),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const db = getFirebaseFirestore();
        const snapshot = await getDoc(doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID));
        if (!snapshot.exists() || cancelled) return;
        const data = snapshot.data() as Partial<SystemEconomyConfig>;
        if (typeof data.dailyLoginBonus === "number") {
          setDailyBonus(String(data.dailyLoginBonus));
        }
        if (typeof data.chestCooldownSegundos === "number") {
          setChestCooldownMinutes(secondsToMinutesInputValue(data.chestCooldownSegundos));
        }
        if (typeof data.boostEnabled === "boolean") {
          setBoostEnabled(data.boostEnabled);
        }
        setStreakDisplayDays(String(normalizeStreakDisplayDays(data.streakDisplayDays)));
        setStreakRows(normalizeStreakTable(data.streakTable));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveBausEconomy() {
    setSaving(true);
    try {
      const db = getFirebaseFirestore();
      await setDoc(
        doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID),
        {
          id: ECONOMY_ID,
          chestCooldownSegundos: minutesInputToSeconds(chestCooldownMinutes, 86_400 * 30),
          streakDisplayDays: normalizeStreakDisplayDays(streakDisplayDays),
          streakTable: streakRows
            .map((row) => ({
              dia: Math.max(1, Math.floor(Number(row.dia)) || 1),
              coins: Math.max(0, Math.floor(Number(row.coins)) || 0),
              gems: Math.max(0, Math.floor(Number(row.gems)) || 0),
              tipoBonus: row.tipoBonus,
            }))
            .sort((a, b) => a.dia - b.dia),
        },
        { merge: true },
      );
      invalidateEconomyConfigCache();
      notify("success", "Configurações de baús ligadas à economia salvas.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Erro ao salvar configurações de baús.",
      );
    } finally {
      setSaving(false);
    }
  }

  const normalizedDisplayDays = normalizeStreakDisplayDays(streakDisplayDays);
  const cooldownSeconds = minutesInputToSeconds(chestCooldownMinutes, 86_400 * 30);

  return (
    <div className="space-y-6">
      <AdminPageHero
        eyebrow="Hub premium"
        title="Baús"
        accent="amber"
        description={
          <>
            Centralize aqui o mini-jogo Baú, os marcos da streak que podem entregar baús e o painel
            dedicado do documento <code>system_configs/chest_system</code>. O botão de economia salva
            os campos em <code>system_configs/economy</code>; o sistema de baús continua com salvamento
            próprio logo abaixo.
          </>
        }
        actions={
          <Button type="button" variant="secondary" onClick={saveBausEconomy} disabled={saving}>
            {saving ? "Salvando..." : "Salvar economia dos baús"}
          </Button>
        }
      />

      <AdminAdCooldownGuide />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          title="Cooldown"
          value={formatCooldownMinutesDisplay(cooldownSeconds)}
          hint="Mini-jogo legado de baú (valor em minutos no formulário)"
          tone="amber"
          icon={<Clock3 className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Marcos"
          value={String(streakRows.length)}
          hint="Faixas configuradas na streak"
          tone="violet"
          icon={<Gift className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Dias visíveis"
          value={String(normalizedDisplayDays)}
          hint="Modal diário de entrada"
          tone="cyan"
          icon={<TimerReset className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Boost"
          value={boostEnabled ? "Ligado" : "Desligado"}
          hint="Integração com extras de baú"
          tone={boostEnabled ? "emerald" : "slate"}
          icon={<Sparkles className="h-4 w-4" />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
          <h2 className="text-lg font-semibold text-white">Mini-jogo Baú</h2>
          <p className="text-xs text-slate-400">
            Controla o tempo de espera entre uma coleta e a próxima no mini-jogo legado de baú.
          </p>
          <Field
            label="Cooldown do mini-jogo Baú (minutos)"
            value={chestCooldownMinutes}
            onChange={setChestCooldownMinutes}
          />
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
          <h2 className="text-lg font-semibold text-white">Streak diária com baús</h2>
          <p className="text-xs text-slate-400">
            O bônus fixo do login diário continua na aba <strong className="text-white">Configurações</strong>,
            mas os marcos abaixo definem quando a sequência libera baú ou prêmio especial.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Bônus login diário atual (referência)"
              value={dailyBonus}
              onChange={() => undefined}
              disabled
            />
            <Field
              label={`Dias visíveis no modal de entrada (1-${MAX_STREAK_DISPLAY_DAYS})`}
              value={streakDisplayDays}
              onChange={setStreakDisplayDays}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-white">Marcos da streak diária</h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-400">
              A recompensa do dia usa o marco cujo <strong>dia</strong> coincide com a sequência
              atual. Nos demais dias, segue valendo o bônus fixo de login diário configurado na
              economia.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              className="text-xs"
              onClick={() => setStreakRows((prev) => [...prev, emptyTier()])}
            >
              + Marco
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-xs"
              onClick={() => {
                const base = Math.max(0, Math.floor(Number(dailyBonus)) || 50);
                setStreakRows([
                  { dia: 1, coins: base, gems: 0, tipoBonus: "nenhum" },
                  { dia: 7, coins: base * 4, gems: 5, tipoBonus: "bau" },
                  { dia: 30, coins: base * 12, gems: 25, tipoBonus: "especial" },
                ]);
              }}
            >
              Preencher 1 / 7 / 30
            </Button>
          </div>
        </div>

        {streakRows.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum marco configurado.</p>
        ) : (
          <div className="space-y-2">
            {streakRows.map((row, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
              >
                <Field
                  label="Dia da sequência"
                  value={String(row.dia)}
                  onChange={(value) => {
                    const nextDay = Math.max(1, Math.floor(Number(value)) || 1);
                    setStreakRows((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, dia: nextDay } : item,
                      ),
                    );
                  }}
                />
                <Field
                  label="PR"
                  value={String(row.coins)}
                  onChange={(value) => {
                    const nextCoins = Math.max(0, Math.floor(Number(value)) || 0);
                    setStreakRows((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, coins: nextCoins } : item,
                      ),
                    );
                  }}
                />
                <Field
                  label="TICKET (streak)"
                  value={String(row.gems)}
                  onChange={(value) => {
                    const nextGems = Math.max(0, Math.floor(Number(value)) || 0);
                    setStreakRows((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, gems: nextGems } : item,
                      ),
                    );
                  }}
                />
                <div>
                  <label className="text-xs text-slate-400">Tipo</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                    value={row.tipoBonus}
                    onChange={(event) => {
                      const tipoBonus = event.target.value as StreakRewardTier["tipoBonus"];
                      setStreakRows((prev) =>
                        prev.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, tipoBonus } : item,
                        ),
                      );
                    }}
                  >
                    <option value="nenhum">Nenhum</option>
                    <option value="bau">Baú</option>
                    <option value="especial">Especial</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs text-red-300"
                    onClick={() =>
                      setStreakRows((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                    }
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button type="button" onClick={saveBausEconomy} disabled={saving}>
          {saving ? "Salvando..." : "Salvar economia dos baús"}
        </Button>
      </div>

      <ChestSystemConfigPanel boostSystemEnabled={boostEnabled} />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
