"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import type { RankingPrizeTier, SystemEconomyConfig } from "@/types/systemConfig";

const ECONOMY_ID = "economy";

type RankingState = {
  diario: RankingPrizeTier[];
  semanal: RankingPrizeTier[];
  mensal: RankingPrizeTier[];
};

const DEFAULT_PRIZES: RankingState = {
  diario: [
    { posicaoMax: 1, coins: 500, gems: 25 },
    { posicaoMax: 3, coins: 250, gems: 10 },
    { posicaoMax: 10, coins: 100, gems: 5 },
  ],
  semanal: [
    { posicaoMax: 1, coins: 1500, gems: 60 },
    { posicaoMax: 3, coins: 800, gems: 30 },
    { posicaoMax: 10, coins: 300, gems: 10 },
  ],
  mensal: [
    { posicaoMax: 1, coins: 5000, gems: 150 },
    { posicaoMax: 3, coins: 2500, gems: 70 },
    { posicaoMax: 10, coins: 1000, gems: 25 },
  ],
};

export default function AdminRankingsPage() {
  const [prizes, setPrizes] = useState<RankingState>(DEFAULT_PRIZES);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getFirebaseFirestore();
        const snap = await getDoc(doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID));
        if (!snap.exists() || cancelled) return;
        const data = snap.data() as Partial<SystemEconomyConfig>;
        if (data.rankingPrizes) {
          setPrizes({
            diario: sanitizeTiers(data.rankingPrizes.diario, DEFAULT_PRIZES.diario),
            semanal: sanitizeTiers(data.rankingPrizes.semanal, DEFAULT_PRIZES.semanal),
            mensal: sanitizeTiers(data.rankingPrizes.mensal, DEFAULT_PRIZES.mensal),
          });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setMsg(null);
    try {
      const db = getFirebaseFirestore();
      await setDoc(
        doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID),
        { id: ECONOMY_ID, rankingPrizes: prizes },
        { merge: true },
      );
      setMsg("Premiações de ranking salvas.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar ranking.");
    }
  }

  const updateTier = (period: keyof RankingState, index: number, key: keyof RankingPrizeTier, value: string) => {
    setPrizes((current) => ({
      ...current,
      [period]: current[period].map((tier, i) =>
        i === index ? { ...tier, [key]: Number(value) || 0 } : tier,
      ),
    }));
  };

  const addTier = (period: keyof RankingState) => {
    setPrizes((current) => ({
      ...current,
      [period]: [...current[period], { posicaoMax: 0, coins: 0, gems: 0 }],
    }));
  };

  const removeTier = (period: keyof RankingState, index: number) => {
    setPrizes((current) => ({
      ...current,
      [period]: current[period].filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Premiação de rankings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure a premiação dos rankings diário, semanal e mensal.
        </p>
      </div>

      {msg ? <AlertBanner tone="info">{msg}</AlertBanner> : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <PrizeCard
          title="Diário"
          rows={prizes.diario}
          onChange={(index, key, value) => updateTier("diario", index, key, value)}
          onAdd={() => addTier("diario")}
          onRemove={(index) => removeTier("diario", index)}
        />
        <PrizeCard
          title="Semanal"
          rows={prizes.semanal}
          onChange={(index, key, value) => updateTier("semanal", index, key, value)}
          onAdd={() => addTier("semanal")}
          onRemove={(index) => removeTier("semanal", index)}
        />
        <PrizeCard
          title="Mensal"
          rows={prizes.mensal}
          onChange={(index, key, value) => updateTier("mensal", index, key, value)}
          onAdd={() => addTier("mensal")}
          onRemove={(index) => removeTier("mensal", index)}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={save}>Salvar premiações</Button>
      </div>
    </div>
  );
}

function sanitizeTiers(value: RankingPrizeTier[] | undefined, fallback: RankingPrizeTier[]) {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value.map((tier) => ({
    posicaoMax: Number(tier.posicaoMax) || 0,
    coins: Number(tier.coins) || 0,
    gems: Number(tier.gems) || 0,
  }));
}

function PrizeCard({
  title,
  rows,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  rows: RankingPrizeTier[];
  onChange: (index: number, key: keyof RankingPrizeTier, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
        >
          Adicionar faixa
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={`${title}-${index}`} className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <SmallField
                label="Posição máxima"
                value={String(row.posicaoMax)}
                onChange={(value) => onChange(index, "posicaoMax", value)}
              />
              <SmallField
                label="Coins"
                value={String(row.coins)}
                onChange={(value) => onChange(index, "coins", value)}
              />
              <SmallField
                label="Gems"
                value={String(row.gems)}
                onChange={(value) => onChange(index, "gems", value)}
              />
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="rounded-lg border border-red-400/20 px-3 py-1.5 text-sm text-red-200 hover:bg-red-500/10"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SmallField({
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
