"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Grid3X3, Sparkles, Swords, TimerReset } from "lucide-react";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { Button } from "@/components/ui/Button";
import { clampPvpChoiceSeconds, parsePvpChoiceSeconds } from "@/lib/games/pvpTiming";
import { GAME_CATALOG, normalizeGameCatalogConfig } from "@/modules/jogos";
import type {
  ExperienceCatalogConfigEntry,
  ExperienceCategory,
  GameRewardOverrideConfig,
  SystemEconomyConfig,
} from "@/types/systemConfig";

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
  const [pptEntryCost, setPptEntryCost] = useState("0");
  const [quizEntryCost, setQuizEntryCost] = useState("0");
  const [reactionEntryCost, setReactionEntryCost] = useState("0");
  const [pvpSecPpt, setPvpSecPpt] = useState("10");
  const [pvpSecQuiz, setPvpSecQuiz] = useState("10");
  const [pvpSecReaction, setPvpSecReaction] = useState("10");
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
        if (typeof data.gameEntryCost?.ppt === "number") setPptEntryCost(String(data.gameEntryCost.ppt));
        if (typeof data.gameEntryCost?.quiz === "number") setQuizEntryCost(String(data.gameEntryCost.quiz));
        if (typeof data.gameEntryCost?.reaction_tap === "number") {
          setReactionEntryCost(String(data.gameEntryCost.reaction_tap));
        }
        const pvpChoiceSeconds = parsePvpChoiceSeconds(data);
        setPvpSecPpt(String(pvpChoiceSeconds.ppt));
        setPvpSecQuiz(String(pvpChoiceSeconds.quiz));
        setPvpSecReaction(String(pvpChoiceSeconds.reaction_tap));
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
      const matchRewardOverrides = Object.fromEntries(
        GAME_KEYS.map((game) => [game.id, toConfig(form[game.id])]),
      );
      const experienceCatalog = Object.fromEntries(
        EXPERIENCE_KEYS.map((experience) => [
          experience.id,
          buildExperienceCatalogEntry(
            experienceForm[experience.id],
            experience.defaultCategory,
          ),
        ]),
      );
      const db = getFirebaseFirestore();
      await setDoc(
        doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID),
        {
          id: ECONOMY_ID,
          gameEntryCost: {
            ppt: Number(pptEntryCost),
            quiz: Number(quizEntryCost),
            reaction_tap: Number(reactionEntryCost),
          },
          pvpChoiceSeconds: {
            ppt: clampPvpChoiceSeconds(pvpSecPpt, 10),
            quiz: clampPvpChoiceSeconds(pvpSecQuiz, 10),
            reaction_tap: clampPvpChoiceSeconds(pvpSecReaction, 10),
          },
          matchRewardOverrides,
          experienceCatalog,
        },
        { merge: true },
      );
      setMsg("Configuração da arena salva. Custos, tempos e overrides já foram atualizados.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar configurações da arena.");
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHero
        eyebrow="Arena premium"
        title="Arena competitiva"
        accent="cyan"
        description="Configure custo de entrada, janela de resposta em PvP e overrides de PR e ranking dos confrontos competitivos. As experiências classificadas como recurso ficam fora desta categoria."
        actions={
          <Button onClick={save} variant="secondary">
            Salvar configuração da arena
          </Button>
        }
      />

      {msg ? <AlertBanner tone="info">{msg}</AlertBanner> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          title="Confrontos"
          value={String(GAME_KEYS.length)}
          hint="Modos PvP configuráveis"
          tone="cyan"
          icon={<Swords className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Experiências"
          value={String(EXPERIENCE_KEYS.length)}
          hint="Catálogo visual da arena"
          tone="violet"
          icon={<Grid3X3 className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Escopo"
          value="Todos"
          hint="Overrides exibidos lado a lado"
          tone="emerald"
          icon={<Sparkles className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="PPT / Quiz / Reaction"
          value={`${pvpSecPpt}s · ${pvpSecQuiz}s · ${pvpSecReaction}s`}
          hint="Janela atual de resposta"
          tone="amber"
          icon={<TimerReset className="h-4 w-4" />}
        />
      </section>

      <section className="space-y-4 rounded-[1.5rem] border border-amber-400/15 bg-slate-900/80 p-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Regras dos confrontos</h2>
          <p className="mt-1 text-sm text-slate-400">
            Ajuste o custo para entrar na partida e o tempo que cada jogador tem para responder em cada
            modo PvP.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            <h3 className="text-base font-semibold text-white">Custo de entrada</h3>
            <p className="text-xs text-slate-400">
              Valor cobrado do jogador antes de iniciar o confronto.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <SmallField label="PPT" value={pptEntryCost} onChange={setPptEntryCost} />
              <SmallField label="Quiz" value={quizEntryCost} onChange={setQuizEntryCost} />
              <SmallField
                label="Reaction Tap"
                value={reactionEntryCost}
                onChange={setReactionEntryCost}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-amber-400/20 bg-amber-950/10 p-4">
            <h3 className="text-base font-semibold text-white">Tempo para responder</h3>
            <p className="text-xs text-slate-400">
              Janela em segundos para cada jogador enviar jogada ou resposta. O servidor aceita entre{" "}
              <strong className="text-white">3</strong> e <strong className="text-white">120</strong>{" "}
              segundos.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <SmallField
                label="PPT (pedra/papel/tesoura)"
                value={pvpSecPpt}
                onChange={setPvpSecPpt}
              />
              <SmallField label="Quiz 1v1" value={pvpSecQuiz} onChange={setPvpSecQuiz} />
              <SmallField
                label="Reaction Tap"
                value={pvpSecReaction}
                onChange={setPvpSecReaction}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-[1.5rem] border border-cyan-400/15 bg-slate-900/80 p-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Recompensas e ranking por resultado</h2>
          <p className="mt-1 text-sm text-slate-400">
            Sobrescreva PR e pontos de ranking por vitória, empate e derrota. Se um campo ficar em
            branco, o backend continua usando a regra padrão.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {GAME_KEYS.map((game) => (
            <section
              key={game.id}
              className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4"
            >
              <h3 className="text-lg font-semibold text-white">{game.label}</h3>
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
      </section>

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
  return compactDefined({
    winCoins: parseOptionalNumber(form.winCoins),
    drawCoins: parseOptionalNumber(form.drawCoins),
    lossCoins: parseOptionalNumber(form.lossCoins),
    winRankingPoints: parseOptionalNumber(form.winRankingPoints),
    drawRankingPoints: parseOptionalNumber(form.drawRankingPoints),
    lossRankingPoints: parseOptionalNumber(form.lossRankingPoints),
  });
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

function buildExperienceCatalogEntry(
  form:
    | {
        category: ExperienceCategory;
        title: string;
        subtitle: string;
        badgeLabel: string;
        order: string;
      }
    | undefined,
  defaultCategory: ExperienceCategory,
): ExperienceCatalogConfigEntry {
  return compactDefined({
    category: form?.category ?? defaultCategory,
    title: textOrUndefined(form?.title),
    subtitle: textOrUndefined(form?.subtitle),
    badgeLabel: textOrUndefined(form?.badgeLabel),
    order: numberOrUndefined(form?.order),
  }) as ExperienceCatalogConfigEntry;
}

function compactDefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as T;
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
