"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { Button } from "@/components/ui/Button";
import type { GameRewardOverrideConfig, SystemEconomyConfig } from "@/types/systemConfig";

const ECONOMY_ID = "economy";
const GAME_KEYS = [
  { id: "ppt", label: "PPT" },
  { id: "quiz", label: "Quiz" },
  { id: "reaction_tap", label: "Reaction Tap" },
] as const;

type RewardForm = Record<
  (typeof GAME_KEYS)[number]["id"],
  {
    winCoins: string;
    drawCoins: string;
    lossCoins: string;
    winRankingPoints: string;
    drawRankingPoints: string;
    lossRankingPoints: string;
  }
>;

const EMPTY_GAME_FORM = {
  winCoins: "",
  drawCoins: "",
  lossCoins: "",
  winRankingPoints: "",
  drawRankingPoints: "",
  lossRankingPoints: "",
};

const EMPTY_FORM: RewardForm = {
  ppt: { ...EMPTY_GAME_FORM },
  quiz: { ...EMPTY_GAME_FORM },
  reaction_tap: { ...EMPTY_GAME_FORM },
};

export default function AdminJogosPage() {
  const [form, setForm] = useState<RewardForm>(EMPTY_FORM);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getFirebaseFirestore();
        const snap = await getDoc(doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID));
        if (!snap.exists() || cancelled) return;
        const data = snap.data() as Partial<SystemEconomyConfig>;
        const overrides = data.matchRewardOverrides ?? {};
        setForm({
          ppt: fromConfig(overrides.ppt),
          quiz: fromConfig(overrides.quiz),
          reaction_tap: fromConfig(overrides.reaction_tap),
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = (
    gameId: keyof RewardForm,
    key: keyof RewardForm[keyof RewardForm],
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [gameId]: { ...current[gameId], [key]: value },
    }));
  };

  async function save() {
    setMsg(null);
    try {
      const payload = {
        ppt: toConfig(form.ppt),
        quiz: toConfig(form.quiz),
        reaction_tap: toConfig(form.reaction_tap),
      };
      const db = getFirebaseFirestore();
      await setDoc(
        doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID),
        {
          id: ECONOMY_ID,
          matchRewardOverrides: payload,
        },
        { merge: true },
      );
      setMsg("Recompensas por jogo salvas. Campos vazios usam a economia padrão.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar configurações dos jogos.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Recompensas por jogo</h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure overrides de moedas e ranking por resultado. Se deixar um campo vazio, o jogo
          continua usando o cálculo padrão atual.
        </p>
      </div>

      {msg ? <AlertBanner tone="info">{msg}</AlertBanner> : null}

      <div className="grid gap-4 xl:grid-cols-3">
        {GAME_KEYS.map((game) => (
          <section
            key={game.id}
            className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4"
          >
            <h2 className="text-lg font-semibold text-white">{game.label}</h2>
            <p className="text-xs text-slate-400">
              Campos em branco = regra padrão do backend. Preencha apenas se quiser sobrescrever.
            </p>

            <div className="grid gap-3">
              <SmallField
                label="Vitória · moedas"
                value={form[game.id].winCoins}
                onChange={(value) => updateField(game.id, "winCoins", value)}
              />
              <SmallField
                label="Vitória · ranking"
                value={form[game.id].winRankingPoints}
                onChange={(value) => updateField(game.id, "winRankingPoints", value)}
              />
              <SmallField
                label="Empate · moedas"
                value={form[game.id].drawCoins}
                onChange={(value) => updateField(game.id, "drawCoins", value)}
              />
              <SmallField
                label="Empate · ranking"
                value={form[game.id].drawRankingPoints}
                onChange={(value) => updateField(game.id, "drawRankingPoints", value)}
              />
              <SmallField
                label="Derrota · moedas"
                value={form[game.id].lossCoins}
                onChange={(value) => updateField(game.id, "lossCoins", value)}
              />
              <SmallField
                label="Derrota · ranking"
                value={form[game.id].lossRankingPoints}
                onChange={(value) => updateField(game.id, "lossRankingPoints", value)}
              />
            </div>
          </section>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={save}>Salvar recompensas dos jogos</Button>
      </div>
    </div>
  );
}

function fromConfig(config: GameRewardOverrideConfig | undefined) {
  return {
    winCoins: stringifyOptional(config?.winCoins),
    drawCoins: stringifyOptional(config?.drawCoins),
    lossCoins: stringifyOptional(config?.lossCoins),
    winRankingPoints: stringifyOptional(config?.winRankingPoints),
    drawRankingPoints: stringifyOptional(config?.drawRankingPoints),
    lossRankingPoints: stringifyOptional(config?.lossRankingPoints),
  };
}

function toConfig(form: RewardForm[keyof RewardForm]): GameRewardOverrideConfig {
  return {
    winCoins: parseOptionalNumber(form.winCoins),
    drawCoins: parseOptionalNumber(form.drawCoins),
    lossCoins: parseOptionalNumber(form.lossCoins),
    winRankingPoints: parseOptionalNumber(form.winRankingPoints),
    drawRankingPoints: parseOptionalNumber(form.drawRankingPoints),
    lossRankingPoints: parseOptionalNumber(form.lossRankingPoints),
  };
}

function stringifyOptional(value: number | undefined) {
  return typeof value === "number" ? String(value) : "";
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : undefined;
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
