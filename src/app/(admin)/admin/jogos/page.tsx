"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { Button } from "@/components/ui/Button";
import { GAME_CATALOG, normalizeGameCatalogConfig } from "@/modules/jogos";
import type { ExperienceCategory, GameRewardOverrideConfig, SystemEconomyConfig } from "@/types/systemConfig";

const ECONOMY_ID = "economy";
const GAME_KEYS = [
  { id: "ppt", label: "PPT" },
  { id: "quiz", label: "Quiz" },
  { id: "reaction_tap", label: "Reaction Tap" },
] as const;
const EXPERIENCE_KEYS = GAME_CATALOG.map((game) => ({
  id: game.id,
  label: game.title,
  subtitle: game.subtitle,
  defaultCategory: game.experienceKind,
  defaultBadgeLabel: game.highlightLabel ?? "",
  defaultOrder: game.sortOrder,
})) as Array<{
  id: string;
  label: string;
  subtitle: string;
  defaultCategory: ExperienceCategory;
  defaultBadgeLabel: string;
  defaultOrder: number;
}>;

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
const EMPTY_EXPERIENCE_FORM = Object.fromEntries(
  EXPERIENCE_KEYS.map((experience) => [
    experience.id,
    {
      category: experience.defaultCategory,
      title: "",
      subtitle: "",
      badgeLabel: "",
      order: "",
    },
  ]),
) as Record<
  string,
  {
    category: ExperienceCategory;
    title: string;
    subtitle: string;
    badgeLabel: string;
    order: string;
  }
>;

export default function AdminJogosPage() {
  const [form, setForm] = useState<RewardForm>(EMPTY_FORM);
  const [experienceForm, setExperienceForm] = useState(EMPTY_EXPERIENCE_FORM);
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
        const experienceCatalog = normalizeGameCatalogConfig(data.experienceCatalog);
        setForm({
          ppt: fromConfig(overrides.ppt),
          quiz: fromConfig(overrides.quiz),
          reaction_tap: fromConfig(overrides.reaction_tap),
        });
        setExperienceForm(
          Object.fromEntries(
            EXPERIENCE_KEYS.map((experience) => [
              experience.id,
              {
                category: experienceCatalog[experience.id]?.category ?? experience.defaultCategory,
                title: experienceCatalog[experience.id]?.title ?? "",
                subtitle: experienceCatalog[experience.id]?.subtitle ?? "",
                badgeLabel: experienceCatalog[experience.id]?.badgeLabel ?? "",
                order:
                  typeof experienceCatalog[experience.id]?.order === "number"
                    ? String(experienceCatalog[experience.id]?.order)
                    : "",
              },
            ]),
          ) as typeof EMPTY_EXPERIENCE_FORM,
        );
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
          experienceCatalog: Object.fromEntries(
            EXPERIENCE_KEYS.map((experience) => [
              experience.id,
              {
                category: experienceForm[experience.id]?.category ?? experience.defaultCategory,
                title: textOrUndefined(experienceForm[experience.id]?.title),
                subtitle: textOrUndefined(experienceForm[experience.id]?.subtitle),
                badgeLabel: textOrUndefined(experienceForm[experience.id]?.badgeLabel),
                order: numberOrUndefined(experienceForm[experience.id]?.order),
              },
            ]),
          ),
        },
        { merge: true },
      );
      setMsg("Configuração da arena salva. Campos vazios usam os padrões internos do app.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar configurações da arena.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Arena competitiva</h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure overrides de PR e ranking apenas para os confrontos competitivos. As experiências
          classificadas como recurso ficam fora desta categoria.
        </p>
      </div>

      {msg ? <AlertBanner tone="info">{msg}</AlertBanner> : null}

      <section className="space-y-4 rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Catálogo visual das experiências</h2>
          <p className="mt-1 text-sm text-slate-400">
            Essa classificação reorganiza o app entre <strong className="text-white">Arena</strong> e{" "}
            <strong className="text-white">Recursos</strong>. Você também pode definir nome, subtítulo,
            badge e ordem visual sem mexer no código.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {EXPERIENCE_KEYS.map((experience) => (
            <div
              key={experience.id}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <p className="text-sm font-semibold text-white">
                {experienceForm[experience.id]?.title?.trim() || experience.label}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {experienceForm[experience.id]?.subtitle?.trim() || experience.subtitle}
              </p>
              <div className="mt-3 grid gap-3">
                <div>
                  <label className="text-xs text-slate-400">Categoria visual</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none transition focus:border-cyan-400/30"
                    value={experienceForm[experience.id]?.category ?? experience.defaultCategory}
                    onChange={(e) =>
                      setExperienceForm((current) => ({
                        ...current,
                        [experience.id]: {
                          ...current[experience.id],
                          category: e.target.value as ExperienceCategory,
                        },
                      }))
                    }
                  >
                    <option value="arena">Arena</option>
                    <option value="utility">Recurso</option>
                  </select>
                </div>

                <SmallField
                  label="Nome exibido"
                  value={experienceForm[experience.id]?.title ?? ""}
                  placeholder={experience.label}
                  onChange={(value) =>
                    setExperienceForm((current) => ({
                      ...current,
                      [experience.id]: { ...current[experience.id], title: value },
                    }))
                  }
                />

                <SmallField
                  label="Subtítulo"
                  value={experienceForm[experience.id]?.subtitle ?? ""}
                  placeholder={experience.subtitle}
                  onChange={(value) =>
                    setExperienceForm((current) => ({
                      ...current,
                      [experience.id]: { ...current[experience.id], subtitle: value },
                    }))
                  }
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <SmallField
                    label="Badge"
                    value={experienceForm[experience.id]?.badgeLabel ?? ""}
                    placeholder={experience.defaultBadgeLabel}
                    onChange={(value) =>
                      setExperienceForm((current) => ({
                        ...current,
                        [experience.id]: { ...current[experience.id], badgeLabel: value },
                      }))
                    }
                  />
                  <SmallField
                    label="Ordem"
                    value={experienceForm[experience.id]?.order ?? ""}
                    placeholder={String(experience.defaultOrder)}
                    onChange={(value) =>
                      setExperienceForm((current) => ({
                        ...current,
                        [experience.id]: { ...current[experience.id], order: value },
                      }))
                    }
                  />
                </div>

                <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-slate-400">
                  Campos vazios usam o padrão interno do app.
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

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
                label="Vitória · PR"
                value={form[game.id].winCoins}
                onChange={(value) => updateField(game.id, "winCoins", value)}
              />
              <SmallField
                label="Vitória · ranking"
                value={form[game.id].winRankingPoints}
                onChange={(value) => updateField(game.id, "winRankingPoints", value)}
              />
              <SmallField
                label="Empate · PR"
                value={form[game.id].drawCoins}
                onChange={(value) => updateField(game.id, "drawCoins", value)}
              />
              <SmallField
                label="Empate · ranking"
                value={form[game.id].drawRankingPoints}
                onChange={(value) => updateField(game.id, "drawRankingPoints", value)}
              />
              <SmallField
                label="Derrota · PR"
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
        <Button onClick={save}>Salvar configuração da arena</Button>
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

function textOrUndefined(value: string | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : undefined;
}

function numberOrUndefined(value: string | undefined) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.floor(n) : undefined;
}

function SmallField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
