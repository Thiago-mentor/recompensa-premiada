"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants/routes";
import { fetchEconomyConfigDocument } from "@/services/systemConfigs/economyDocumentCache";
import type { SystemEconomyConfig, WeightedPrizeConfig } from "@/types/systemConfig";
import {
  DEFAULT_ROULETTE_TABLE,
  normalizeRouletteTableFromFirestore,
  wheelSliceIndexForServerPrize,
} from "@/lib/games/gameEconomy";
import { runRouletteDailyAdSpin, runRoulettePaidSpin } from "@/services/jogos/rouletteService";
import { MatchResultModal } from "../../components/MatchResultModal";
import { RewardToast } from "../../components/RewardToast";
import { ChevronLeft, Clock3, Coins, History, Play } from "lucide-react";
import type { ChestRarity, GrantedChestSummary } from "@/types/chest";
import { useAuth } from "@/hooks/useAuth";
import {
  APP_SCHEDULE_TIMEZONE,
  appDailyKey,
  formatHmsCountdown,
  msUntilNextAppDayStart,
} from "@/lib/scheduling/appDay";

const SEGMENT_COLORS = ["#521b92", "#7c2ccb", "#4b167f", "#671fa7", "#3b126e", "#8229cf"];

const CHEST_RARITY_PT: Record<ChestRarity, string> = {
  comum: "Comum",
  raro: "Raro",
  epico: "Épico",
  lendario: "Lendário",
};

/** Labels curtas nas fatias (SVG). */
const CHEST_WHEEL_LABEL: Record<ChestRarity, string> = {
  comum: "COMUM",
  raro: "RARO",
  epico: "ÉPICO",
  lendario: "LEND.",
};

/** Traço simples tipo “bauzinho” no centro da fatia (sem asset externo). */
function RouletteChestGlyph({ cx, cy, tint }: { cx: number; cy: number; tint: string }) {
  const gx = cx - 10;
  const gy = cy - 18;
  return (
    <g opacity={0.95} aria-hidden>
      <rect x={gx + 2} y={gy + 7} width={16} height={11} rx={2} fill={tint} stroke="#fcd34d" strokeWidth={0.85} />
      <path
        d={`M ${gx + 6} ${gy + 10} Q ${gx + 10} ${gy + 2} ${gx + 14} ${gy + 10}`}
        fill="#b45309"
        stroke="#fbbf24"
        strokeWidth={0.55}
      />
      <circle cx={gx + 10} cy={gy + 12.5} r={2.2} fill="#451a03" opacity={0.55} />
    </g>
  );
}

export function RoletaGameScreen() {
  const { user, profile, profileLoading, refreshProfile } = useAuth();
  const [spinSyncMs, setSpinSyncMs] = useState(() => Date.now());
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const [costLabel, setCostLabel] = useState("giro pago");
  const [paidSpinCurrencyConfig, setPaidSpinCurrencyConfig] = useState<
    "coins" | "gems" | "rewardBalance" | null
  >(null);
  const [wheelSlices, setWheelSlices] = useState<WeightedPrizeConfig[]>(() => [...DEFAULT_ROULETTE_TABLE]);
  const [modal, setModal] = useState<
    | { open: false }
    | {
        open: true;
        result: "vitoria" | null;
        title: string;
        subtitle?: string;
        rewardCoins: number;
        grantedChest: GrantedChestSummary | null;
        error: string | null;
        /** Card “TICKET / Saldo / PR · +valor” quando não for só moeda legacy “Coins”. */
        rewardSummaryPrimary?: { label: string; amount: number };
        /** Sem card numérico (ex.: apenas baú). */
        hidePrimaryRewardCard?: boolean;
      }
  >({ open: false });

  const segmentCount = wheelSlices.length;
  const segmentAngle = useMemo(() => 360 / Math.max(segmentCount, 1), [segmentCount]);

  const todayDailyKey = appDailyKey();
  const dailySpinKey = String(profile?.rouletteDailyAdSpinDayKey ?? "").trim();
  const dailyFreeUsed = Boolean(user && dailySpinKey !== "" && dailySpinKey === todayDailyKey);
  const dailyBlockedUnknown = Boolean(user && (profileLoading || !profile));

  useEffect(() => {
    const id = window.setInterval(() => setSpinSyncMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const countdownLabel = dailyFreeUsed
    ? formatHmsCountdown(msUntilNextAppDayStart(new Date(spinSyncMs)))
    : "———";

  const rouletteCostBalanceView = useMemo(() => {
    if (!paidSpinCurrencyConfig || !profile) return null;
    const cur = paidSpinCurrencyConfig;
    const label = cur === "coins" ? "PR" : cur === "rewardBalance" ? "Saldo" : "TICKET";
    const value =
      cur === "coins" ? profile.coins : cur === "rewardBalance" ? profile.rewardBalance : profile.gems;
    const n = Math.max(0, Math.floor(Number(value) || 0));
    return { label, display: n.toLocaleString("pt-BR") };
  }, [paidSpinCurrencyConfig, profile]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const dataRaw = await fetchEconomyConfigDocument();
        if (!dataRaw || cancelled) return;
        const data = dataRaw as Partial<SystemEconomyConfig>;
        const amount = Math.max(0, Math.floor(Number(data.rouletteSpinCostAmount) || 0));
        const rawCur = data.rouletteSpinCostCurrency;
        const resolvedCur: "coins" | "gems" | "rewardBalance" =
          rawCur === "coins" || rawCur === "gems" || rawCur === "rewardBalance" ? rawCur : "gems";
        setPaidSpinCurrencyConfig(resolvedCur);
        const currency =
          resolvedCur === "coins"
            ? "PR"
            : resolvedCur === "rewardBalance"
              ? "Saldo"
              : "TICKET";
        setCostLabel(amount > 0 ? `${amount} ${currency}` : "grátis");
        setWheelSlices(normalizeRouletteTableFromFirestore(data.rouletteTable));
      } catch {
        if (!cancelled) setCostLabel("giro pago");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function spin(mode: "daily_ad" | "paid") {
    if (spinning || busy || segmentCount < 1) return;
    const n = segmentCount;
    setSpinning(false);
    setBusy(true);
    setToast(null);

    if (mode === "daily_ad" && (dailyFreeUsed || dailyBlockedUnknown)) {
      setBusy(false);
      setModal({
        open: true,
        result: null,
        title: "Giro não disponível",
        rewardCoins: 0,
        grantedChest: null,
        error: dailyBlockedUnknown
          ? "Carregando seu perfil. Tente novamente em instantes."
          : "O giro grátis por anúncio já foi usado hoje. Volte após meia-noite no horário de Brasília.",
      });
      return;
    }

    const result = mode === "daily_ad" ? await runRouletteDailyAdSpin() : await runRoulettePaidSpin();

    if (!result.ok) {
      setBusy(false);
      setModal({
        open: true,
        result: null,
        title: "Giro não registrado",
        rewardCoins: 0,
        grantedChest: null,
        error: result.error || "Não foi possível validar este giro.",
      });
      return;
    }

    const prizeKind = result.roulettePrizeKind ?? "coins";
    const nextIndex = wheelSliceIndexForServerPrize(wheelSlices, {
      roulettePrizeKind: prizeKind as "coins" | "gems" | "rewardBalance" | "chest",
      chestRarity: result.chestRarity,
      rewardCoins: result.rewardCoins,
      rewardGems: result.rewardGems,
      rewardSaldo: result.rewardSaldo,
      rouletteRewardAmount: result.rouletteRewardAmount,
    });
    const angle = 360 / n;
    const targetAngle = 360 - (nextIndex * angle + angle / 2);
    const nextRotation = rotation + 360 * 5 + targetAngle;

    setSpinning(true);
    setRotation(nextRotation);
    await new Promise((r) => setTimeout(r, 3300));
    setSpinning(false);
    setBusy(false);

    const rarityKey =
      result.chestRarity && Object.prototype.hasOwnProperty.call(CHEST_RARITY_PT, result.chestRarity)
        ? (result.chestRarity as ChestRarity)
        : null;
    const chestLine =
      result.roulettePrizeKind === "chest" && rarityKey
        ? `Prêmio: baú ${CHEST_RARITY_PT[rarityKey]}`
        : null;
    setModal({
      open: true,
      result: "vitoria",
      title: "Giro da sorte",
      subtitle:
        result.roulettePrizeKind === "chest"
          ? result.grantedChest
            ? `${chestLine ?? "Baú creditado"} — abra na área de recursos`
            : result.chestNotGranted
              ? "O sorteio deu baú, mas não foi possível entregar agora (fila/cheios ou sistema off). Você já pode tentar novo giro quando permitido."
              : (chestLine ?? "Baú pendente na conta")
          : result.roulettePrizeKind === "gems"
            ? `+${result.rewardGems ?? 0} TICKET · ${mode === "daily_ad" ? "giro por anúncio" : "giro pago"}`
            : result.roulettePrizeKind === "rewardBalance"
              ? `+${result.rewardSaldo ?? 0} pontos Saldo · ${mode === "daily_ad" ? "giro por anúncio" : "giro pago"}`
              : (result.rewardCoins ?? 0) > 0
                ? `+${result.rewardCoins} PR · ${mode === "daily_ad" ? "giro por anúncio" : "giro pago"}`
                : mode === "daily_ad"
                  ? "Giro diário por anúncio validado"
                  : "Giro pago registrado",
      rewardCoins: result.rewardCoins ?? 0,
      grantedChest: result.grantedChest ?? null,
      error: null,
      hidePrimaryRewardCard: result.roulettePrizeKind === "chest",
      rewardSummaryPrimary:
        result.roulettePrizeKind === "gems"
          ? { label: "TICKET", amount: result.rewardGems ?? 0 }
          : result.roulettePrizeKind === "rewardBalance"
            ? { label: "Saldo", amount: result.rewardSaldo ?? 0 }
            : result.roulettePrizeKind === "coins" && (result.rewardCoins ?? 0) > 0
              ? { label: "PR", amount: result.rewardCoins ?? 0 }
              : undefined,
    });
    const parts: string[] = [];
    if ((result.rewardCoins ?? 0) > 0) parts.push(`+${result.rewardCoins} PR`);
    if ((result.rewardGems ?? 0) > 0) parts.push(`+${result.rewardGems} TICKET`);
    if ((result.rewardSaldo ?? 0) > 0) parts.push(`+${result.rewardSaldo} Saldo`);
    if (result.grantedChest) parts.push(`Baú ${CHEST_RARITY_PT[result.grantedChest.rarity]}`);
    if (result.roulettePrizeKind === "chest" && result.chestNotGranted && !result.grantedChest) {
      parts.push("Baú não adicionado (espaço/sistema)");
    }
    if (parts.length > 0) setToast({ message: parts.join(" · ") });
    if (mode === "daily_ad" || mode === "paid") void refreshProfile();
  }

  return (
    <div className="relative -mx-1 min-h-[calc(100dvh-12rem)] overflow-hidden rounded-[1.75rem] border border-fuchsia-400/25 bg-[radial-gradient(circle_at_50%_36%,rgba(217,70,239,0.22),transparent_32%),radial-gradient(circle_at_50%_70%,rgba(251,191,36,0.12),transparent_34%),linear-gradient(180deg,#050315,#110522_52%,#050315)] px-3 pb-4 pt-3 text-white shadow-[0_0_60px_-22px_rgba(217,70,239,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(236,72,153,0.16),transparent_18%),radial-gradient(circle_at_82%_22%,rgba(139,92,246,0.15),transparent_20%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:28px_28px]" />

      <div className="relative flex items-center justify-between">
        <Link
          href={ROUTES.recursos}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/25 text-white/80"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-sm font-black uppercase tracking-[0.18em] text-white">Giro da sorte</h1>
        <Link
          href={ROUTES.carteira}
          className="rounded-lg border border-violet-300/25 bg-violet-500/18 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide text-violet-100"
        >
          Histórico
        </Link>
      </div>

      <div className="relative mx-auto mt-3 flex max-w-[360px] justify-center px-2">
        <div
          className="flex w-full max-w-sm flex-col gap-1 rounded-xl border border-fuchsia-500/25 bg-black/35 px-3.5 py-2 text-center backdrop-blur-sm"
          aria-live="polite"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
            Saldo moeda do giro pago
          </span>
          {profileLoading ? (
            <span className="text-sm tabular-nums text-white/50">Carregando…</span>
          ) : !user ? (
            <span className="text-sm text-white/50">Faça login para ver o saldo.</span>
          ) : rouletteCostBalanceView ? (
            <>
              <span className="text-xl font-black tabular-nums tracking-tight text-white">
                {rouletteCostBalanceView.display}
                <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-violet-200/90">
                  {rouletteCostBalanceView.label}
                </span>
              </span>
              <span className="text-[10px] text-white/40">Mesma moeda definida nas configurações da roleta.</span>
            </>
          ) : (
            <span className="text-sm text-white/50">Carregando configuração…</span>
          )}
        </div>
      </div>

      <div className="relative mt-5 text-center">
        <p className="text-sm font-medium text-white/80">
          {profileLoading
            ? "Sincronizando giro grátis…"
            : dailyFreeUsed
              ? "Giro grátis de hoje: já usado"
              : user
                ? "Giro grátis disponível · 1x por dia (Brasília)"
                : "Entre para girar"}
        </p>

        <div className="relative mx-auto mt-3 aspect-square w-full max-w-[360px]">
          <div className="pointer-events-none absolute -inset-5 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div
            className="absolute left-1/2 top-0 z-20 h-14 w-12 -translate-x-1/2 drop-shadow-[0_8px_16px_rgba(0,0,0,0.55)]"
            aria-hidden
          >
            <div className="mx-auto h-10 w-8 rounded-b-full rounded-t-md border border-amber-200/60 bg-[linear-gradient(180deg,#fde68a,#d97706)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]" />
            <div className="mx-auto -mt-2 h-5 w-5 rotate-45 border border-amber-200/60 bg-amber-500" />
          </div>

          <div
            className="absolute inset-0 rounded-full border-[10px] border-orange-500 bg-[#22052e] shadow-[0_16px_32px_-18px_rgba(0,0,0,0.9),0_0_0_4px_rgba(253,186,116,0.28),0_0_36px_rgba(217,70,239,0.35),inset_0_0_26px_rgba(0,0,0,0.55)] transition-transform duration-[3300ms] ease-out"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <svg className="h-full w-full" viewBox="0 0 320 320" aria-hidden>
              <defs>
                <radialGradient id="wheelCenterGlow" cx="50%" cy="50%" r="55%">
                  <stop offset="0%" stopColor="#fde68a" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="#581c87" stopOpacity="0" />
                </radialGradient>
              </defs>
              {wheelSlices.map((row, index) => (
                <WheelSlice
                  key={`${index}-${row.kind}-${row.weight}-${row.coins}-${row.chestRarity ?? ""}`}
                  index={index}
                  segmentAngle={segmentAngle}
                  segmentCount={segmentCount}
                  row={row}
                />
              ))}
              <circle cx="160" cy="160" r="145" fill="none" stroke="#f97316" strokeWidth="10" />
              <circle cx="160" cy="160" r="132" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="3 17" />
              <circle cx="160" cy="160" r="92" fill="url(#wheelCenterGlow)" opacity="0.8" />
            </svg>
          </div>

          <button
            type="button"
            onClick={() => void spin("daily_ad")}
            disabled={
              spinning || busy || segmentCount < 1 || dailyBlockedUnknown || dailyFreeUsed || !user
            }
            title={
              dailyFreeUsed
                ? "Giro grátis volta à meia-noite no horário de Brasília."
                : dailyBlockedUnknown
                  ? "Carregando…"
                  : undefined
            }
            className="absolute left-1/2 top-1/2 z-30 flex h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-[4px] border-orange-200/70 bg-[radial-gradient(circle_at_35%_28%,#f97316,#c2410c_58%,#7c2d12)] text-white shadow-[0_0_0_5px_rgba(251,146,60,0.16),0_8px_20px_-10px_rgba(0,0,0,0.9),inset_0_2px_0_rgba(255,255,255,0.2)] transition disabled:opacity-55"
          >
            <span className="text-lg font-black uppercase leading-none tracking-tight">
              {spinning ? "..." : busy ? "..." : "Girar"}
            </span>
            <span className="mt-1 text-[10px] font-black uppercase tracking-wide text-white/90">
              {dailyFreeUsed ? "Amanhã" : "Anúncio"}
            </span>
          </button>
        </div>
      </div>

      <div className="relative mt-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
          {dailyFreeUsed ? "Tempo até o próximo giro grátis" : "Após usar o diário aparece aqui"}
        </p>
        <p className="mt-1 inline-flex items-center gap-2 text-base font-black tabular-nums text-white sm:text-lg">
          <Clock3 className="h-4 w-4 shrink-0 text-amber-300/80" aria-hidden />
          {countdownLabel}
        </p>
        <p className="mx-auto mt-1 max-w-xs text-[10px] text-white/35">{APP_SCHEDULE_TIMEZONE.replace("_", " ")}</p>
      </div>

      <div className="relative mx-auto mt-4 flex max-w-[340px] flex-col gap-2">
        <Button
          className="h-auto min-h-0 w-full flex-row justify-start gap-3 rounded-xl border-fuchsia-400/45 py-2.5 pl-3.5 pr-3 shadow-[0_0_26px_-10px_rgba(217,70,239,0.65)] [&>svg]:shrink-0"
          disabled={spinning || busy || dailyBlockedUnknown || dailyFreeUsed || !user}
          onClick={() => void spin("daily_ad")}
          variant="jackpot"
          size="md"
        >
          <Play className="h-8 w-8 fill-white opacity-95" aria-hidden />
          <span className="flex min-w-0 flex-col items-start gap-0.5 text-left leading-tight">
            <span className="text-[13px] font-bold uppercase tracking-wide">Giro com anúncio</span>
            <span className="font-normal normal-case opacity-85 text-[11px] leading-snug text-white/75">
              1x por dia · assista até o final
            </span>
          </span>
        </Button>
        <Button
          className="h-auto min-h-0 w-full flex-row justify-start gap-3 rounded-xl border-amber-300/55 py-2.5 pl-3.5 pr-3 !text-amber-950 [&>svg]:shrink-0"
          disabled={spinning || busy || !user}
          onClick={() => void spin("paid")}
          variant="gold"
          size="md"
        >
          <Coins className="h-9 w-9 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
          <span className="flex min-w-0 flex-col items-start gap-0.5 text-left leading-tight">
            <span className="text-[13px] font-black uppercase tracking-wide">Giro pago</span>
            <span className="font-semibold normal-case opacity-95 text-[11px]">{costLabel}</span>
          </span>
        </Button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-white/45"
        >
          <History className="h-3.5 w-3.5" />
          Fatias conforme Painel • prêmio final validado pelo servidor.
        </button>
      </div>

      <MatchResultModal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        presentation="roleta"
        result={modal.open ? modal.result : null}
        title={modal.open ? modal.title : ""}
        subtitle={modal.open ? modal.subtitle : undefined}
        rewardCoins={modal.open ? modal.rewardCoins : 0}
        boostCoins={0}
        hideRankingSummary
        rewardSummaryPrimary={modal.open ? modal.rewardSummaryPrimary : undefined}
        hidePrimaryRewardCard={modal.open ? modal.hidePrimaryRewardCard : false}
        grantedChest={modal.open ? modal.grantedChest : null}
        error={modal.open ? modal.error : null}
      />
      <RewardToast
        presentation="roleta"
        message={toast?.message ?? null}
        visible={!!toast}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}

function WheelSlice({
  index,
  segmentAngle,
  segmentCount,
  row,
}: {
  index: number;
  segmentAngle: number;
  segmentCount: number;
  row: WeightedPrizeConfig;
}) {
  const start = index * segmentAngle - 90;
  const end = start + segmentAngle;
  const largeArc = segmentAngle > 180 ? 1 : 0;
  const outer = 145;
  const inner = 34;
  const cx = 160;
  const cy = 160;
  const startRad = (start * Math.PI) / 180;
  const endRad = (end * Math.PI) / 180;
  const x1 = cx + outer * Math.cos(startRad);
  const y1 = cy + outer * Math.sin(startRad);
  const x2 = cx + outer * Math.cos(endRad);
  const y2 = cy + outer * Math.sin(endRad);
  const x3 = cx + inner * Math.cos(endRad);
  const y3 = cy + inner * Math.sin(endRad);
  const x4 = cx + inner * Math.cos(startRad);
  const y4 = cy + inner * Math.sin(startRad);
  const textAngle = start + segmentAngle / 2;
  const textRad = (textAngle * Math.PI) / 180;
  const tx = cx + Math.min(108, Math.max(78, 98 - segmentCount)) * Math.cos(textRad);
  const ty = cy + Math.min(108, Math.max(78, 98 - segmentCount)) * Math.sin(textRad);
  const fill = SEGMENT_COLORS[index % SEGMENT_COLORS.length];

  const isChest = row.kind === "chest" && row.chestRarity != null && row.chestRarity in CHEST_RARITY_PT;
  const rarityLabel = isChest ? CHEST_WHEEL_LABEL[row.chestRarity as ChestRarity] : "";

  const mainFont = segmentCount > 14 ? 10 : segmentCount > 10 ? 12 : segmentCount >= 8 ? 14 : 16;
  const subFont = Math.max(8, mainFont - 3);
  const coinTint = index % 2 === 0 ? "#fde047" : "#fef9c3";
  const chestTint = index % 2 === 0 ? "#fbbf24" : "#fde68a";

  return (
    <g>
      <path
        d={`M ${x1} ${y1} A ${outer} ${outer} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${largeArc} 0 ${x4} ${y4} Z`}
        fill={fill}
        stroke="#f59e0b"
        strokeWidth="1.2"
      />
      <g transform={`rotate(${textAngle + 90} ${tx} ${ty})`}>
        {isChest ? (
          <>
            <RouletteChestGlyph cx={tx} cy={ty} tint="#92400e" />
            <text
              x={tx}
              y={ty + 4}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={chestTint}
              fontSize={Math.max(mainFont - 1, 9)}
              fontWeight="900"
            >
              BAÚ
            </text>
            <text
              x={tx}
              y={ty + (segmentCount > 12 ? 14 : 16)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fde68a"
              fontSize={subFont}
              fontWeight="800"
            >
              {rarityLabel}
            </text>
          </>
        ) : row.kind === "gems" ? (
          <>
            <text
              x={tx}
              y={ty - (segmentCount > 12 ? 3 : 4)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#bae6fd"
              fontSize={mainFont}
              fontWeight="900"
            >
              {row.coins}
            </text>
            <text
              x={tx}
              y={ty + (segmentCount > 12 ? 13 : 15)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#7dd3fc"
              fontSize={subFont}
              fontWeight="800"
              opacity={0.92}
            >
              TICKET
            </text>
          </>
        ) : row.kind === "rewardBalance" ? (
          <>
            <text
              x={tx}
              y={ty - (segmentCount > 12 ? 3 : 4)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fde68a"
              fontSize={mainFont}
              fontWeight="900"
            >
              {row.coins}
            </text>
            <text
              x={tx}
              y={ty + (segmentCount > 12 ? 13 : 15)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fdba74"
              fontSize={subFont}
              fontWeight="800"
              opacity={0.94}
            >
              Saldo
            </text>
          </>
        ) : (
          <>
            <text
              x={tx}
              y={ty - (segmentCount > 12 ? 3 : 4)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={coinTint}
              fontSize={mainFont}
              fontWeight="900"
            >
              {row.coins}
            </text>
            <text
              x={tx}
              y={ty + (segmentCount > 12 ? 13 : 15)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fcd34d"
              fontSize={subFont}
              fontWeight="800"
              opacity={0.92}
            >
              PR
            </text>
          </>
        )}
      </g>
    </g>
  );
}
