"use client";

import { useEffect, useState, type ReactNode } from "react";
import { doc, setDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import type { RankingPeriod } from "@/types/ranking";
import type { RankingPrizeTier } from "@/types/systemConfig";
import { useExperienceCatalogBuckets } from "@/hooks/useExperienceCatalogBuckets";
import { callFunction } from "@/services/callables/client";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { cn } from "@/lib/utils/cn";
import {
  buildDefaultRankingPrizeConfig,
  createEmptyRankingPrizePeriodConfig,
  createEmptyRankingPrizeTier,
  formatRankingPrize,
  getRankingPrizeForPosition,
  type NormalizedRankingPrizeConfig,
} from "@/lib/ranking/prizes";
import { fetchRankingPrizeConfig } from "@/services/ranking/rankingConfigService";
import { Coins, Crown, Gamepad2, Save, Sparkles, Trophy } from "lucide-react";

const ECONOMY_ID = "economy";

export default function AdminRankingsPage() {
  const { arena: arenaCatalog } = useExperienceCatalogBuckets();
  const [prizes, setPrizes] = useState<NormalizedRankingPrizeConfig>(buildDefaultRankingPrizeConfig());
  const [activeGameId, setActiveGameId] = useState("ppt");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closingPeriod, setClosingPeriod] = useState<RankingPeriod | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await fetchRankingPrizeConfig();
        if (!cancelled) setPrizes(config);
      } catch (error) {
        if (!cancelled) {
          setMsg(formatFirebaseError(error));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const nextDefaultId = arenaCatalog[0]?.id ?? "ppt";
    if (!arenaCatalog.some((game) => game.id === activeGameId)) {
      setActiveGameId(nextDefaultId);
    }
  }, [activeGameId, arenaCatalog]);

  const resolveGameLabel = (gameId: string) =>
    arenaCatalog.find((game) => game.id === gameId)?.title ?? gameId;

  async function save() {
    setMsg(null);
    setSaving(true);
    try {
      const db = getFirebaseFirestore();
      await setDoc(
        doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID),
        {
          id: ECONOMY_ID,
          rankingPrizes: {
            diario: prizes.global.diario,
            semanal: prizes.global.semanal,
            mensal: prizes.global.mensal,
            global: prizes.global,
            byGame: prizes.byGame,
            clans: prizes.clans,
          },
        },
        { merge: true },
      );
      setMsg("Premiações globais, por jogo e de clãs salvas com sucesso.");
    } catch (error) {
      setMsg(formatFirebaseError(error));
    } finally {
      setSaving(false);
    }
  }

  function updateTier(
    area: "global" | "game" | "clans",
    period: RankingPeriod,
    index: number,
    key: keyof RankingPrizeTier,
    value: string,
    gameId?: string,
  ) {
    const nextValue =
      key === "posicaoMax"
        ? Math.max(1, Math.floor(Number(value) || 0))
        : Math.max(0, Math.floor(Number(value) || 0));
    setPrizes((current) => {
      if (area === "clans") {
        return {
          ...current,
          clans: {
            ...current.clans,
            [period]: current.clans[period].map((tier, tierIndex) =>
              tierIndex === index ? { ...tier, [key]: nextValue } : tier,
            ),
          },
        };
      }
      if (area === "game" && gameId) {
        const gameConfig = current.byGame[gameId] ?? createEmptyRankingPrizePeriodConfig();
        return {
          ...current,
          byGame: {
            ...current.byGame,
            [gameId]: {
              ...gameConfig,
              [period]: gameConfig[period].map((tier, tierIndex) =>
                tierIndex === index ? { ...tier, [key]: nextValue } : tier,
              ),
            },
          },
        };
      }
      return {
        ...current,
        global: {
          ...current.global,
          [period]: current.global[period].map((tier, tierIndex) =>
            tierIndex === index ? { ...tier, [key]: nextValue } : tier,
          ),
        },
      };
    });
  }

  function addTier(area: "global" | "game" | "clans", period: RankingPeriod, gameId?: string) {
    setPrizes((current) => {
      if (area === "clans") {
        return {
          ...current,
          clans: {
            ...current.clans,
            [period]: [...current.clans[period], createEmptyRankingPrizeTier()],
          },
        };
      }
      if (area === "game" && gameId) {
        const gameConfig = current.byGame[gameId] ?? createEmptyRankingPrizePeriodConfig();
        return {
          ...current,
          byGame: {
            ...current.byGame,
            [gameId]: {
              ...gameConfig,
              [period]: [...gameConfig[period], createEmptyRankingPrizeTier()],
            },
          },
        };
      }
      return {
        ...current,
        global: {
          ...current.global,
          [period]: [...current.global[period], createEmptyRankingPrizeTier()],
        },
      };
    });
  }

  function removeTier(
    area: "global" | "game" | "clans",
    period: RankingPeriod,
    index: number,
    gameId?: string,
  ) {
    setPrizes((current) => {
      if (area === "clans") {
        return {
          ...current,
          clans: {
            ...current.clans,
            [period]: current.clans[period].filter((_, tierIndex) => tierIndex !== index),
          },
        };
      }
      if (area === "game" && gameId) {
        const gameConfig = current.byGame[gameId] ?? createEmptyRankingPrizePeriodConfig();
        return {
          ...current,
          byGame: {
            ...current.byGame,
            [gameId]: {
              ...gameConfig,
              [period]: gameConfig[period].filter((_, tierIndex) => tierIndex !== index),
            },
          },
        };
      }
      return {
        ...current,
        global: {
          ...current.global,
          [period]: current.global[period].filter((_, tierIndex) => tierIndex !== index),
        },
      };
    });
  }

  function copyGlobalToGame(gameId: string) {
    setPrizes((current) => ({
      ...current,
      byGame: {
        ...current.byGame,
        [gameId]: {
          diario: current.global.diario.map(cloneTier),
          semanal: current.global.semanal.map(cloneTier),
          mensal: current.global.mensal.map(cloneTier),
        },
      },
    }));
    setMsg(`Premiação global copiada para ${resolveGameLabel(gameId)}.`);
  }

  function clearGame(gameId: string) {
    setPrizes((current) => ({
      ...current,
      byGame: {
        ...current.byGame,
        [gameId]: createEmptyRankingPrizePeriodConfig(),
      },
    }));
    setMsg(`Premiações de ${resolveGameLabel(gameId)} limpas.`);
  }

  async function closeRanking(period: RankingPeriod) {
    setMsg(null);
    setClosingPeriod(period);
    try {
      await callFunction<{ period: RankingPeriod }, { ok: boolean }>("adminCloseRanking", { period });
      setMsg(
        period === "semanal"
          ? "Fechamento do ranking semanal executado com sucesso, incluindo o rateio dos clãs por contribuição."
          : `Fechamento do ranking ${labelForPeriod(period)} executado com sucesso.`,
      );
    } catch (error) {
      setMsg(formatFirebaseError(error));
    } finally {
      setClosingPeriod(null);
    }
  }

  const activeGameConfig = prizes.byGame[activeGameId] ?? createEmptyRankingPrizePeriodConfig();
  const configuredGames = arenaCatalog.filter((game) => {
    const config = prizes.byGame[game.id];
    return Boolean(
      config &&
        (config.diario.length > 0 || config.semanal.length > 0 || config.mensal.length > 0),
    );
  }).length;

  return (
    <div className="space-y-6 pb-4">
      <div className="rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.18),transparent_35%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-5 shadow-[0_0_56px_-24px_rgba(139,92,246,0.35)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/70">
              Admin premium
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
              Rankings e premiações
            </h1>
            <p className="mt-2 text-sm text-slate-300/70">
              Controle o ranking geral, os rankings por confronto e a distribuição em PR, TICKET e CASH.
            </p>
          </div>

          <Button onClick={save} disabled={saving || loading} variant="arena" className="w-full sm:w-auto">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar estrutura"}
          </Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <SummaryCard
            icon={<Trophy className="h-4 w-4" />}
            label="Ranking geral"
            value={String(
              prizes.global.diario.length + prizes.global.semanal.length + prizes.global.mensal.length,
            )}
            note="faixas configuradas"
          />
          <SummaryCard
            icon={<Gamepad2 className="h-4 w-4" />}
            label="Confrontos"
            value={String(configuredGames)}
            note="confrontos com premiação ativa"
          />
          <SummaryCard
            icon={<Coins className="h-4 w-4" />}
            label="Top 1 atual"
            value={formatRankingPrize(getRankingPrizeForPosition(prizes.global.diario, 1))}
            note="configuração global de destaque"
          />
          <SummaryCard
            icon={<Crown className="h-4 w-4" />}
            label="Clã semanal"
            value={formatRankingPrize(getRankingPrizeForPosition(prizes.clans.semanal, 1))}
            note="faixa do top 1 antes do rateio"
          />
        </div>
      </div>

      {msg ? <AlertBanner tone="info">{msg}</AlertBanner> : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Premiação global</h2>
          <p className="mt-1 text-sm text-slate-400">
            Faixas usadas no ranking geral, com fallback legado compatível com a estrutura atual.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {(["diario", "semanal", "mensal"] as RankingPeriod[]).map((period) => (
            <PrizeCard
              key={period}
              title={labelForPeriod(period)}
              rows={prizes.global[period]}
              onChange={(index, key, value) => updateTier("global", period, index, key, value)}
              onAdd={() => addTier("global", period)}
              onRemove={(index) => removeTier("global", period, index)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Premiação semanal de clãs</h2>
          <p className="mt-1 text-sm text-slate-400">
            A faixa do clã é rateada proporcionalmente entre os membros que pontuaram na semana.
            Você pode ajustar as faixas abaixo a qualquer momento.
          </p>
        </div>

        <PrizeCard
          title="Semanal"
          rows={prizes.clans.semanal}
          onChange={(index, key, value) => updateTier("clans", "semanal", index, key, value)}
          onAdd={() => addTier("clans", "semanal")}
          onRemove={(index) => removeTier("clans", "semanal", index)}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Premiação por confronto</h2>
            <p className="mt-1 text-sm text-slate-400">
              Cada confronto competitivo pode ter suas próprias faixas por período. As experiências classificadas como recurso ficam fora desta categoria.
            </p>
          </div>
          {arenaCatalog.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => copyGlobalToGame(activeGameId)} disabled={loading}>
                <Sparkles className="h-4 w-4" />
                Copiar global
              </Button>
              <Button variant="ghost" onClick={() => clearGame(activeGameId)} disabled={loading}>
                Limpar jogo
              </Button>
            </div>
          ) : null}
        </div>

        {arenaCatalog.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
            Nenhuma experiência está classificada como arena no momento. Ajuste a taxonomia em{" "}
            <code className="rounded bg-white/10 px-1 text-xs text-white/70">
              Admin &gt; Arena competitiva
            </code>
            .
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {arenaCatalog.map((game) => {
                const active = game.id === activeGameId;
                const gameTop1 = getRankingPrizeForPosition(prizes.byGame[game.id]?.diario ?? [], 1);
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => setActiveGameId(game.id)}
                    className={cn(
                      "rounded-[1.5rem] border px-4 py-4 text-left transition",
                      active
                        ? "border-cyan-400/30 bg-cyan-500/10 shadow-[0_0_32px_-18px_rgba(34,211,238,0.5)]"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{game.title}</p>
                        <p className="mt-1 text-xs text-white/45">{game.subtitle}</p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                          active
                            ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100"
                            : "border-white/10 bg-white/5 text-white/55",
                        )}
                      >
                        {active ? "editando" : "abrir"}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                        top 1 do diário
                      </span>
                      <span className="text-xs font-semibold text-cyan-100/90">
                        {formatRankingPrize(gameTop1)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {(["diario", "semanal", "mensal"] as RankingPeriod[]).map((period) => (
                <PrizeCard
                  key={`${activeGameId}-${period}`}
                  title={`${labelForPeriod(period)} · ${resolveGameLabel(activeGameId)}`}
                  rows={activeGameConfig[period]}
                  onChange={(index, key, value) => updateTier("game", period, index, key, value, activeGameId)}
                  onAdd={() => addTier("game", period, activeGameId)}
                  onRemove={(index) => removeTier("game", period, index, activeGameId)}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="rounded-[1.6rem] border border-white/10 bg-slate-950/70 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Fechamento manual</h2>
            <p className="mt-1 text-sm text-slate-400">
              Executa o fechamento do período e distribui PR, TICKET e CASH para o ranking geral e por confronto.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["diario", "semanal", "mensal"] as RankingPeriod[]).map((period) => (
              <Button
                key={period}
                variant="secondary"
                onClick={() => void closeRanking(period)}
                disabled={closingPeriod != null}
              >
                {closingPeriod === period ? `Fechando ${labelForPeriod(period)}...` : `Fechar ${labelForPeriod(period)}`}
              </Button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
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
    <section className="space-y-3 rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-4 shadow-[0_0_36px_-24px_rgba(139,92,246,0.45)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-xs text-white/45">
            Top 1: {formatRankingPrize(getRankingPrizeForPosition(rows, 1))}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5"
        >
          Adicionar faixa
        </button>
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-sm text-slate-400">
            Nenhuma faixa configurada neste período.
          </div>
        ) : null}
        {rows.map((row, index) => (
          <div key={`${title}-${index}`} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <SmallField
                label="Posição máxima"
                value={String(row.posicaoMax)}
                onChange={(value) => onChange(index, "posicaoMax", value)}
              />
              <SmallField
                label="PR"
                value={String(row.coins)}
                onChange={(value) => onChange(index, "coins", value)}
              />
              <SmallField
                label="TICKET"
                value={String(row.gems)}
                onChange={(value) => onChange(index, "gems", value)}
              />
              <SmallField
                label="CASH"
                value={String(row.rewardBalance)}
                onChange={(value) => onChange(index, "rewardBalance", value)}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-white/45">Entrega: {formatRankingPrize(row)}</p>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="rounded-xl border border-red-400/20 px-3 py-2 text-sm text-red-200 transition hover:bg-red-500/10"
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
        className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400/30"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4">
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/70">
        {icon}
        {label}
      </span>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-white/45">{note}</p>
    </div>
  );
}

function labelForPeriod(period: RankingPeriod) {
  return period === "diario" ? "Diário" : period === "semanal" ? "Semanal" : "Mensal";
}

function cloneTier(tier: RankingPrizeTier): RankingPrizeTier {
  return {
    posicaoMax: Math.max(1, Math.floor(Number(tier.posicaoMax) || 0)),
    coins: Math.max(0, Math.floor(Number(tier.coins) || 0)),
    gems: Math.max(0, Math.floor(Number(tier.gems) || 0)),
    rewardBalance: Math.max(0, Math.floor(Number(tier.rewardBalance) || 0)),
  };
}
