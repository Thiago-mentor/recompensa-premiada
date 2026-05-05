"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Coins, Gift, Image, Megaphone, Sparkles, Wallet } from "lucide-react";
import { AdminAdCooldownGuide } from "@/components/admin/AdminAdCooldownGuide";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { useAdminSaveFeedback } from "@/components/admin/AdminSaveFeedback";
import type { SystemEconomyConfig, WeightedPrizeConfig, AvatarUploadReputationThresholds } from "@/types/systemConfig";
import type { ChestRarity } from "@/types/chest";
import { callFunction } from "@/services/callables/client";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { saldoPointsToBrl, formatBrl } from "@/services/economy/saldoEconomyConfig";
import { DEFAULT_ROULETTE_TABLE, normalizeRouletteTableFromFirestore } from "@/lib/games/gameEconomy";
import { invalidateEconomyConfigCache } from "@/services/systemConfigs/economyDocumentCache";
import {
  CHEST_SPEEDUP_PLACEMENT_ID,
  HOME_REWARDED_PLACEMENT_ID,
  REWARDED_AD_PLACEMENTS,
  REWARDED_AD_PLACEMENT_LABELS,
  ROULETTE_DAILY_SPIN_PLACEMENT_ID,
  type RewardedAdPlacementId,
} from "@/lib/constants/rewardedAds";

const ECONOMY_ID = "economy";

const GENERIC_REWARDED_AD_PLACEMENTS = new Set<RewardedAdPlacementId>([
  HOME_REWARDED_PLACEMENT_ID,
  ROULETTE_DAILY_SPIN_PLACEMENT_ID,
]);

const emptyPlacementRewardRows = (): Record<
  RewardedAdPlacementId,
  { coins: string; gems: string; saldo: string }
> =>
  Object.fromEntries(
    REWARDED_AD_PLACEMENTS.map((id) => [id, { coins: "", gems: "0", saldo: "0" }]),
  ) as Record<RewardedAdPlacementId, { coins: string; gems: string; saldo: string }>;

const ROULETTE_CHEST_OPTIONS: { value: ChestRarity; label: string }[] = [
  { value: "comum", label: "Baú comum" },
  { value: "raro", label: "Baú raro" },
  { value: "epico", label: "Baú épico" },
  { value: "lendario", label: "Baú lendário" },
];

function parseAvatarThresholdField(raw: string, fallback: number): number {
  const t = raw.trim();
  if (t === "") return fallback;
  const n = Math.floor(Number(t));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, n);
}

export default function AdminConfigPage() {
  const { notify: adminNotify } = useAdminSaveFeedback();
  const [rewardAd, setRewardAd] = useState("25");
  const [dailyBonus, setDailyBonus] = useState("50");
  const [limiteAds, setLimiteAds] = useState("20");
  const [limiteCoins, setLimiteCoins] = useState("5000");
  const [refIndicador, setRefIndicador] = useState("100");
  const [refConvidado, setRefConvidado] = useState("50");
  const [boostEnabled, setBoostEnabled] = useState(false);
  const [avatarUploadRequireReputation, setAvatarUploadRequireReputation] = useState(false);
  const [avatarRepAds, setAvatarRepAds] = useState("50");
  const [avatarRepPpt, setAvatarRepPpt] = useState("10");
  const [avatarRepQuiz, setAvatarRepQuiz] = useState("10");
  const [avatarRepReaction, setAvatarRepReaction] = useState("10");
  const [boostPercent, setBoostPercent] = useState("25");
  const [fragmentsPerBoostCraft, setFragmentsPerBoostCraft] = useState("10");
  const [boostMinutesPerCraft, setBoostMinutesPerCraft] = useState("15");
  const [boostActivationMinutes, setBoostActivationMinutes] = useState("15");
  const [convBuy, setConvBuy] = useState("500");
  const [convSell, setConvSell] = useState("0");
  const [saldoPointsPerReal, setSaldoPointsPerReal] = useState("100");
  const [rouletteRows, setRouletteRows] = useState<WeightedPrizeConfig[]>(DEFAULT_ROULETTE_TABLE);
  const [rouletteSpinCostAmount, setRouletteSpinCostAmount] = useState("1");
  const [rouletteSpinCostCurrency, setRouletteSpinCostCurrency] = useState<"coins" | "gems" | "rewardBalance">("gems");
  const [grantLookup, setGrantLookup] = useState<"username" | "uid">("username");
  const [grantValue, setGrantValue] = useState("");
  const [grantKind, setGrantKind] = useState<"coins" | "gems" | "rewardBalance">("coins");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantLoading, setGrantLoading] = useState(false);
  const [placementRewards, setPlacementRewards] = useState(emptyPlacementRewardRows);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const db = getFirebaseFirestore();
        const s = await getDoc(doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID));
        if (!s.exists() || c) return;
        const d = s.data() as Partial<SystemEconomyConfig>;
        if (typeof d.rewardAdCoinAmount === "number") setRewardAd(String(d.rewardAdCoinAmount));
        if (typeof d.dailyLoginBonus === "number") setDailyBonus(String(d.dailyLoginBonus));
        if (typeof d.limiteDiarioAds === "number") setLimiteAds(String(d.limiteDiarioAds));
        if (typeof d.limiteDiarioCoins === "number") setLimiteCoins(String(d.limiteDiarioCoins));
        if (typeof d.referralBonusIndicador === "number") setRefIndicador(String(d.referralBonusIndicador));
        if (typeof d.referralBonusConvidado === "number") setRefConvidado(String(d.referralBonusConvidado));
        if (typeof d.boostEnabled === "boolean") setBoostEnabled(d.boostEnabled);
        if (typeof d.avatarUploadRequireReputation === "boolean") {
          setAvatarUploadRequireReputation(d.avatarUploadRequireReputation);
        }
        const avatarTh = d.avatarUploadReputationThresholds;
        if (avatarTh && typeof avatarTh === "object") {
          const th = avatarTh as AvatarUploadReputationThresholds;
          if (typeof th.ads === "number" && Number.isFinite(th.ads)) {
            setAvatarRepAds(String(Math.max(0, Math.floor(th.ads))));
          }
          if (typeof th.pptMatches === "number" && Number.isFinite(th.pptMatches)) {
            setAvatarRepPpt(String(Math.max(0, Math.floor(th.pptMatches))));
          }
          if (typeof th.quizMatches === "number" && Number.isFinite(th.quizMatches)) {
            setAvatarRepQuiz(String(Math.max(0, Math.floor(th.quizMatches))));
          }
          if (typeof th.reactionMatches === "number" && Number.isFinite(th.reactionMatches)) {
            setAvatarRepReaction(String(Math.max(0, Math.floor(th.reactionMatches))));
          }
        }
        if (typeof d.boostRewardPercent === "number") setBoostPercent(String(d.boostRewardPercent));
        if (typeof d.fragmentsPerBoostCraft === "number") {
          setFragmentsPerBoostCraft(String(d.fragmentsPerBoostCraft));
        }
        if (typeof d.boostMinutesPerCraft === "number") {
          setBoostMinutesPerCraft(String(d.boostMinutesPerCraft));
        }
        if (typeof d.boostActivationMinutes === "number") {
          setBoostActivationMinutes(String(d.boostActivationMinutes));
        }
        if (typeof d.conversionCoinsPerGemBuy === "number") setConvBuy(String(d.conversionCoinsPerGemBuy));
        if (typeof d.conversionCoinsPerGemSell === "number") setConvSell(String(d.conversionCoinsPerGemSell));
        const saldoRate = d.saldoPointsPerReal ?? d.cashPointsPerReal;
        if (typeof saldoRate === "number" && saldoRate >= 1) {
          setSaldoPointsPerReal(String(Math.floor(saldoRate)));
        }
        if (Array.isArray(d.rouletteTable)) {
          setRouletteRows(normalizePrizeRows(d.rouletteTable));
        }
        if (typeof d.rouletteSpinCostAmount === "number") {
          setRouletteSpinCostAmount(String(d.rouletteSpinCostAmount));
        }
        if (
          d.rouletteSpinCostCurrency === "coins" ||
          d.rouletteSpinCostCurrency === "gems" ||
          d.rouletteSpinCostCurrency === "rewardBalance"
        ) {
          setRouletteSpinCostCurrency(d.rouletteSpinCostCurrency);
        }
        const byP = d.rewardedAdRewardsByPlacement;
        if (byP && typeof byP === "object") {
          setPlacementRewards(
            Object.fromEntries(
              REWARDED_AD_PLACEMENTS.map((id) => {
                const row = byP[id as keyof typeof byP] as
                  | { coins?: number; gems?: number; rewardBalance?: number }
                  | undefined;
                const coins =
                  row && typeof row.coins === "number" && Number.isFinite(row.coins)
                    ? String(Math.max(0, Math.floor(row.coins)))
                    : "";
                const gems =
                  row && typeof row.gems === "number" && Number.isFinite(row.gems)
                    ? String(Math.max(0, Math.floor(row.gems)))
                    : "0";
                const saldo =
                  row && typeof row.rewardBalance === "number" && Number.isFinite(row.rewardBalance)
                    ? String(Math.max(0, Math.floor(row.rewardBalance)))
                    : "0";
                return [id, { coins, gems, saldo }];
              }),
            ) as Record<RewardedAdPlacementId, { coins: string; gems: string; saldo: string }>,
          );
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  async function save() {
    try {
      const db = getFirebaseFirestore();
      await setDoc(
        doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID),
        {
          id: ECONOMY_ID,
          rewardAdCoinAmount: Number(rewardAd),
          dailyLoginBonus: Number(dailyBonus),
          limiteDiarioAds: Number(limiteAds),
          limiteDiarioCoins: Number(limiteCoins),
          referralBonusIndicador: Number(refIndicador),
          referralBonusConvidado: Number(refConvidado),
          boostEnabled,
          avatarUploadRequireReputation,
          avatarUploadReputationThresholds: {
            ads: parseAvatarThresholdField(avatarRepAds, 50),
            pptMatches: parseAvatarThresholdField(avatarRepPpt, 10),
            quizMatches: parseAvatarThresholdField(avatarRepQuiz, 10),
            reactionMatches: parseAvatarThresholdField(avatarRepReaction, 10),
          },
          boostRewardPercent: Math.max(0, Math.floor(Number(boostPercent)) || 0),
          fragmentsPerBoostCraft: Math.max(1, Math.floor(Number(fragmentsPerBoostCraft)) || 10),
          boostMinutesPerCraft: Math.max(1, Math.floor(Number(boostMinutesPerCraft)) || 15),
          boostActivationMinutes: Math.max(1, Math.floor(Number(boostActivationMinutes)) || 15),
          conversionCoinsPerGemBuy: Math.max(1, Math.floor(Number(convBuy)) || 500),
          conversionCoinsPerGemSell: Math.max(0, Math.floor(Number(convSell)) || 0),
          saldoPointsPerReal: Math.max(1, Math.floor(Number(saldoPointsPerReal)) || 100),
          rouletteTable: normalizePrizeRows(rouletteRows),
          rouletteSpinCostAmount: Math.max(0, Math.floor(Number(rouletteSpinCostAmount)) || 0),
          rouletteSpinCostCurrency,
          rewardedAdRewardsByPlacement: Object.fromEntries(
            REWARDED_AD_PLACEMENTS.map((id) => {
              const row = placementRewards[id];
              const gems = Math.max(0, Math.floor(Number(row.gems) || 0));
              const rewardBalance = Math.max(0, Math.floor(Number(row.saldo) || 0));
              const entry: { coins?: number; gems: number; rewardBalance: number } = {
                gems,
                rewardBalance,
              };
              const coinsTrim = row.coins.trim();
              if (coinsTrim !== "") {
                entry.coins = Math.max(0, Math.floor(Number(coinsTrim) || 0));
              } else if (!GENERIC_REWARDED_AD_PLACEMENTS.has(id)) {
                entry.coins = 0;
              }
              return [id, entry];
            }),
          ),
        },
        { merge: true },
      );
      invalidateEconomyConfigCache();
      adminNotify(
        "info",
        "Economia salva. Premiações de ranking ficam na aba Rankings. Em produção: se o tempo do quiz ou a lógica do servidor não mudarem, publique as Cloud Functions (firebase deploy --only functions) e as regras do Firestore (firebase deploy --only firestore:rules). Com emuladores, reinicie-os após npm run build em functions/.",
        { durationMs: 12_000 },
      );
    } catch (e) {
      adminNotify("error", e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function grantSubmit() {
    const amt = Math.floor(Number(grantAmount));
    if (!grantValue.trim()) {
      adminNotify("error", "Informe o username ou o UID.");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      adminNotify("error", "Quantidade inválida.");
      return;
    }
    setGrantLoading(true);
    try {
      const res = await callFunction<
        { lookup: string; value: string; kind: string; amount: number },
        { ok: boolean; targetUid: string; field: string; newBalance: number }
      >("adminGrantEconomy", {
        lookup: grantLookup,
        value: grantValue.trim(),
        kind: grantKind,
        amount: amt,
      });
      const d = res.data;
      const label =
        grantKind === "coins" ? "PR" : grantKind === "gems" ? "TICKET" : "Saldo";
      adminNotify(
        "success",
        `Crédito aplicado — ${label} novo saldo: ${d.newBalance} (uid: ${d.targetUid}).`,
      );
    } catch (e) {
      adminNotify("error", formatFirebaseError(e));
    } finally {
      setGrantLoading(false);
    }
  }

  const buyN = Math.max(1, Math.floor(Number(convBuy)) || 500);
  const sellN = Math.max(0, Math.floor(Number(convSell)) || 0);
  const saldoN = Math.max(1, Math.floor(Number(saldoPointsPerReal)) || 100);
  const ticketPerPrBuy = 1 / buyN;
  const ticketPerPrSell = sellN > 0 ? 1 / sellN : null;
  const brlPerSaldoPoint = saldoPointsToBrl(1, saldoN);

  const avatarRepResolvedAds = parseAvatarThresholdField(avatarRepAds, 50);
  const avatarRepResolvedPpt = parseAvatarThresholdField(avatarRepPpt, 10);
  const avatarRepResolvedQuiz = parseAvatarThresholdField(avatarRepQuiz, 10);
  const avatarRepResolvedReaction = parseAvatarThresholdField(avatarRepReaction, 10);
  const avatarRepMetricValue = `${avatarRepResolvedAds} / ${avatarRepResolvedPpt} / ${avatarRepResolvedQuiz} / ${avatarRepResolvedReaction}`;
  const avatarRepMetricHint = avatarUploadRequireReputation
    ? "Anúncios / PPT / QUIZ / Reaction · reputação exigida no upload"
    : "Anúncios / PPT / QUIZ / Reaction · limiares salvos; upload livre por ora";

  return (
    <div className="space-y-6">
      <AdminPageHero
        eyebrow="Economia premium"
        title="Configurações da economia"
        accent="violet"
        description="Ajuste recompensas básicas, limites diários, referral, boost, conversões e operações manuais da economia. As regras de confronto agora ficam na aba Arena e as de baú na aba Baús."
        actions={<Button onClick={save}>Salvar economia</Button>}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <AdminMetricCard
          title="PR por anúncio"
          value={rewardAd}
          hint="Padrão home/genérico se o PR do placement estiver vazio"
          tone="cyan"
          icon={<Coins className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Login diário"
          value={dailyBonus}
          hint="Bônus fixo de entrada"
          tone="amber"
          icon={<Gift className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Boost"
          value={boostEnabled ? "Ligado" : "Desligado"}
          hint="Loja e multiplicador de PR"
          tone={boostEnabled ? "emerald" : "slate"}
          icon={<Sparkles className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Foto de perfil"
          value={avatarRepMetricValue}
          hint={avatarRepMetricHint}
          tone={avatarUploadRequireReputation ? "amber" : "slate"}
          icon={<Image className="h-4 w-4" />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
          <h2 className="text-lg font-semibold text-white">Recompensas e limites</h2>
          <Field label="PR por anúncio (global)" value={rewardAd} onChange={setRewardAd} />
          <Field label="Bônus login diário" value={dailyBonus} onChange={setDailyBonus} />
          <Field label="Limite diário de ads" value={limiteAds} onChange={setLimiteAds} />
          <Field label="Limite diário de PR" value={limiteCoins} onChange={setLimiteCoins} />
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
          <h2 className="text-lg font-semibold text-white">Referral</h2>
          <Field label="Bônus do indicador" value={refIndicador} onChange={setRefIndicador} />
          <Field label="Bônus do convidado" value={refConvidado} onChange={setRefConvidado} />
        </div>
      </section>

      <AdminAdCooldownGuide />

      <section className="space-y-3 rounded-xl border border-cyan-400/25 bg-cyan-950/15 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-white">Anúncios recompensados por placement</h2>
            <p className="mt-1 text-xs text-slate-400">
              Créditos extras ao concluir cada anúncio (callable / validação SSV), no mesmo espírito do
              baú: cada contexto pode ter TICKET, Saldo e PR próprios. Em <strong className="text-white">Home</strong> e{" "}
              <strong className="text-white">Roleta (placement)</strong>, deixe <strong className="text-white">PR vazio</strong> para
              usar o valor global acima. Duelos e sorteio: PR vazio vale <strong className="text-white">0</strong> (só entram
              TICKET/Saldo/PR se preencher). Aceleração de baú continua só pela aba Baús — este bloco não
              altera o timer.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {REWARDED_AD_PLACEMENTS.map((placementId) => (
            <div
              key={placementId}
              className="rounded-lg border border-white/10 bg-black/25 p-3 sm:grid sm:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))] sm:gap-3 sm:items-end"
            >
              <div className="mb-2 sm:mb-0">
                <p className="text-sm font-medium text-white">{REWARDED_AD_PLACEMENT_LABELS[placementId]}</p>
                <p className="font-mono text-[10px] text-slate-500">{placementId}</p>
                {placementId === CHEST_SPEEDUP_PLACEMENT_ID ? (
                  <p className="mt-1 text-[11px] text-amber-200/90">
                    O app usa <code className="text-slate-300">speedUpChestUnlock</code>; PR abaixo não aplica a este
                    fluxo.
                  </p>
                ) : null}
              </div>
              <Field
                label={
                  GENERIC_REWARDED_AD_PLACEMENTS.has(placementId)
                    ? "PR (vazio = global)"
                    : "PR extra (vazio = 0)"
                }
                value={placementRewards[placementId].coins}
                onChange={(value) =>
                  setPlacementRewards((prev) => ({
                    ...prev,
                    [placementId]: { ...prev[placementId], coins: value },
                  }))
                }
              />
              <Field
                label="TICKET"
                value={placementRewards[placementId].gems}
                onChange={(value) =>
                  setPlacementRewards((prev) => ({
                    ...prev,
                    [placementId]: { ...prev[placementId], gems: value },
                  }))
                }
              />
              <Field
                label="Saldo"
                value={placementRewards[placementId].saldo}
                onChange={(value) =>
                  setPlacementRewards((prev) => ({
                    ...prev,
                    [placementId]: { ...prev[placementId], saldo: value },
                  }))
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-fuchsia-400/20 bg-fuchsia-950/15 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Boost, multiplicador e loja</h2>
            <p className="mt-1 text-xs text-slate-400">
              {boostEnabled
                ? "O sistema está ligado. Aqui você define o custo do craft, a ativação e o ganho extra de PR."
                : "O sistema está desligado. Home, loja e multiplicador de PR ficam ocultos até essa chave ser ativada novamente."}
            </p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white">
            <input
              type="checkbox"
              className="h-4 w-4 accent-fuchsia-500"
              checked={boostEnabled}
              onChange={(e) => setBoostEnabled(e.target.checked)}
            />
            {boostEnabled ? "Sistema ligado" : "Sistema desligado"}
          </label>
        </div>
        {boostEnabled ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Boost extra de PR (%)"
              value={boostPercent}
              onChange={setBoostPercent}
            />
            <Field
              label="Fragmentos por craft"
              value={fragmentsPerBoostCraft}
              onChange={setFragmentsPerBoostCraft}
            />
            <Field
              label="Minutos por craft"
              value={boostMinutesPerCraft}
              onChange={setBoostMinutesPerCraft}
            />
            <Field
              label="Minutos ativados por uso"
              value={boostActivationMinutes}
              onChange={setBoostActivationMinutes}
            />
          </div>
        ) : (
          <AlertBanner tone="info">
            Os detalhes técnicos de boost ficaram ocultos por enquanto. A configuração continua
            salva para reativação futura.
          </AlertBanner>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-amber-400/25 bg-amber-950/15 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-white">Foto de perfil</h2>
            <p className="mt-1 text-xs text-slate-400">
              {avatarUploadRequireReputation ? (
                <>
                  Com a opção ligada, o app exige o mínimo de anúncios e partidas PPT, QUIZ e Reaction antes de
                  enviar foto própria. A validação automática (
                  <strong className="text-white">Google Cloud Vision</strong>) continua em todo caso.
                </>
              ) : (
                <>
                  Com a opção desligada, qualquer usuário logado pode trocar a foto; o Vision ainda bloqueia
                  conteúdo impróprio quando aplicável.
                </>
              )}
            </p>
          </div>
          <label className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white">
            <input
              type="checkbox"
              className="h-4 w-4 accent-amber-500"
              checked={avatarUploadRequireReputation}
              onChange={(e) => setAvatarUploadRequireReputation(e.target.checked)}
            />
            {avatarUploadRequireReputation ? "Exigir reputação" : "Sem requisito"}
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Mín. anúncios assistidos" value={avatarRepAds} onChange={setAvatarRepAds} />
          <Field label="Mín. partidas PPT" value={avatarRepPpt} onChange={setAvatarRepPpt} />
          <Field label="Mín. partidas QUIZ" value={avatarRepQuiz} onChange={setAvatarRepQuiz} />
          <Field
            label="Mín. partidas Reaction"
            value={avatarRepReaction}
            onChange={setAvatarRepReaction}
          />
        </div>
        <p className="text-[11px] text-slate-500">
          Inteiros ≥ 0. Campo vazio ao salvar usa o padrão (50 / 10 / 10 / 10). Use 0 para não exigir um eixo.
          Clientes que já abriram o app podem precisar navegar de novo para refletir o cache da economia.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Roleta da sorte</h2>
            <p className="mt-1 text-xs text-slate-400">
              Por fatia: <strong className="text-white">PR</strong>,{" "}
              <strong className="text-white">TICKET</strong>, <strong className="text-white">Saldo</strong> ou{" "}
              <strong className="text-white">baú</strong>. Peso maior = mais chance na roleta (servidor).
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRouletteRows((current) => [...current, { coins: 50, weight: 10 }])}
          >
            + Fatia PR
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setRouletteRows((current) => [...current, { kind: "gems", coins: 1, weight: 8 }])
            }
          >
            + TICKET
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setRouletteRows((current) => [...current, { kind: "rewardBalance", coins: 10, weight: 6 }])
            }
          >
            + Saldo
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setRouletteRows((current) => [
                ...current,
                { kind: "chest", coins: 0, chestRarity: "comum", weight: 8 },
              ])
            }
          >
            + Fatia baú
          </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Custo do giro pago"
            value={rouletteSpinCostAmount}
            onChange={setRouletteSpinCostAmount}
          />
          <div>
            <label className="text-xs text-slate-400">Moeda do giro pago</label>
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              value={rouletteSpinCostCurrency}
              onChange={(e) =>
                setRouletteSpinCostCurrency(e.target.value as "coins" | "gems" | "rewardBalance")
              }
            >
              <option value="coins">PR</option>
              <option value="gems">TICKET</option>
              <option value="rewardBalance">Saldo</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {rouletteRows.map((row, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <div>
                <label className="text-xs text-slate-400">Tipo</label>
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                  value={
                    row.kind === "chest"
                      ? "chest"
                      : row.kind === "gems"
                        ? "gems"
                        : row.kind === "rewardBalance"
                          ? "rewardBalance"
                          : "coins"
                  }
                  onChange={(e) => {
                    const next = e.target.value;
                    setRouletteRows((current) =>
                      current.map((item, itemIndex) => {
                        if (itemIndex !== index) return item;
                        const amt =
                          item.kind !== "chest" ? Math.max(0, Math.floor(Number(item.coins) || 0)) : 0;
                        if (next === "chest") {
                          return {
                            kind: "chest",
                            coins: 0,
                            chestRarity: item.chestRarity ?? "comum",
                            weight: item.weight,
                          };
                        }
                        if (next === "gems") {
                          return { kind: "gems", coins: amt || 1, weight: item.weight };
                        }
                        if (next === "rewardBalance") {
                          return { kind: "rewardBalance", coins: amt || 10, weight: item.weight };
                        }
                        return { kind: "coins", coins: amt || 50, weight: item.weight };
                      }),
                    );
                  }}
                >
                  <option value="coins">Moedas (PR)</option>
                  <option value="gems">Tickets (gems)</option>
                  <option value="rewardBalance">Pontos Saldo</option>
                  <option value="chest">Baú</option>
                </select>
              </div>
              {row.kind === "chest" ? (
                <div>
                  <label className="text-xs text-slate-400">Raridade do baú</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                    value={row.chestRarity ?? "comum"}
                    onChange={(e) =>
                      setRouletteRows((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index && item.kind === "chest"
                            ? {
                                ...item,
                                chestRarity: e.target.value as ChestRarity,
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    {ROULETTE_CHEST_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <Field
                  label={
                    row.kind === "gems"
                      ? "Tickets na fatia"
                      : row.kind === "rewardBalance"
                        ? "Pontos Saldo na fatia"
                        : "PR na fatia"
                  }
                  value={String(row.coins)}
                  onChange={(value) =>
                    setRouletteRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index && item.kind !== "chest"
                          ? { ...item, coins: Math.max(0, Math.floor(Number(value)) || 0) }
                          : item,
                      ),
                    )
                  }
                />
              )}
              <Field
                label="Peso / chance"
                value={String(row.weight)}
                onChange={(value) =>
                  setRouletteRows((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, weight: Math.max(0, Math.floor(Number(value)) || 0) }
                        : item,
                    ),
                  )
                }
              />
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-300"
                  onClick={() =>
                    setRouletteRows((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </div>

        <AlertBanner tone="info">
          O prêmio real vem do servidor (PR, TICKET, Saldo e/ou baú). Baús dependem dos slots da fila; se não
          couber, avise para ajuste na aba Baús.
        </AlertBanner>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
        <h2 className="text-lg font-semibold text-white">Conversão PR ↔ TICKET (carteira)</h2>
        <p className="text-xs text-slate-400">
          <strong className="text-white">Comprar TICKET:</strong> quanto PR o jogador paga por cada ticket.{" "}
          <strong className="text-white">Vender TICKET:</strong> quanto PR ele recebe por ticket; use{" "}
          <strong className="text-white">0</strong> para desativar a troca TICKET → PR.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="PR cobrados por ticket (compra)"
            value={convBuy}
            onChange={setConvBuy}
          />
          <Field
            label="PR pagos por ticket (venda; 0 = off)"
            value={convSell}
            onChange={setConvSell}
          />
        </div>
        <div className="rounded-lg border border-sky-500/25 bg-sky-950/30 p-3 text-xs text-sky-100/90">
          <p className="font-semibold text-sky-200">Taxas na direção inversa (referência)</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sky-100/80">
            <li>
              <strong className="text-white">Compra:</strong> 1 TICKET = {buyN} PR · 1 PR ≈{" "}
              {ticketPerPrBuy.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} TICKET
            </li>
            <li>
              <strong className="text-white">Venda:</strong>{" "}
              {sellN > 0 ? (
                <>
                  1 TICKET vendido = {sellN} PR · para obter 1 PR vendendo tickets, ≈{" "}
                  {ticketPerPrSell!.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} TICKET
                </>
              ) : (
                <>troca TICKET → PR desativada (0)</>
              )}
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-emerald-400/20 bg-emerald-950/20 p-4">
        <h2 className="text-lg font-semibold text-white">Saldo ↔ real (saque / premiação)</h2>
        <p className="text-xs text-slate-400">
          Quantos <strong className="text-white">pontos de saldo</strong> equivalem a{" "}
          <strong className="text-white">R$ 1,00</strong> na tela de recompensas (cálculo automático do
          valor em reais).
        </p>
        <Field
          label="Pontos Saldo por R$ 1,00"
          value={saldoPointsPerReal}
          onChange={setSaldoPointsPerReal}
        />
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/40 p-3 text-xs text-emerald-100/90">
          <p className="font-semibold text-emerald-200">Inverso</p>
          <p className="mt-1">
            R$ 1,00 = {saldoN} pts Saldo · 1 ponto Saldo ≈{" "}
            <strong className="text-white">{formatBrl(brlPerSaldoPoint)}</strong>
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-violet-400/25 bg-violet-950/25 p-4">
        <h2 className="text-lg font-semibold text-white">Crédito manual em conta</h2>
        <p className="text-xs text-slate-400">
          Credita PR, TICKET ou Saldo na conta do jogador (via Cloud Function). Use username (sem @) ou UID.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-slate-400">Buscar por</label>
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              value={grantLookup}
              onChange={(e) => setGrantLookup(e.target.value as "username" | "uid")}
            >
              <option value="username">Username</option>
              <option value="uid">UID</option>
            </select>
          </div>
          <Field label="Username ou UID" value={grantValue} onChange={setGrantValue} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-slate-400">Moeda</label>
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              value={grantKind}
              onChange={(e) =>
                setGrantKind(e.target.value as "coins" | "gems" | "rewardBalance")
              }
            >
              <option value="coins">PR (coins)</option>
              <option value="gems">TICKET (gems)</option>
              <option value="rewardBalance">Saldo (rewardBalance)</option>
            </select>
          </div>
          <Field label="Quantidade" value={grantAmount} onChange={setGrantAmount} />
        </div>
        <Button type="button" onClick={grantSubmit} disabled={grantLoading}>
          {grantLoading ? "Aplicando…" : "Creditar na conta"}
        </Button>
      </section>

      <div className="flex justify-end">
        <Button onClick={save}>Salvar economia</Button>
      </div>
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
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function normalizePrizeRows(rows: unknown): WeightedPrizeConfig[] {
  return normalizeRouletteTableFromFirestore(rows);
}
