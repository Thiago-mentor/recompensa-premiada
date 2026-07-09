"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import Link from "next/link";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { ArenaShell, fadeUpItem, staggerContainer, staggerItem } from "@/components/arena/ArenaShell";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useChestHub } from "@/hooks/useChestHub";
import { ROUTES } from "@/lib/constants/routes";
import {
  CHEST_ALREADY_OPENING_MESSAGE,
  CHEST_OPEN_LOWER_SLOT_FIRST_MESSAGE,
} from "@/lib/firebase/errors";
import { cn } from "@/lib/utils/cn";
import type { ResolvedChestItem } from "@/utils/chest";
import {
  CHEST_SOURCE_LABEL,
  CHEST_STATUS_LABEL,
  formatChestDurationMs,
  formatChestRewardSummary,
} from "@/utils/chest";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Coins,
  Flame,
  Gift,
  Hourglass,
  Inbox,
  Info,
  PackageOpen,
  Sparkles,
  Ticket,
  Trophy,
  X,
  Zap,
} from "lucide-react";

const hubLink =
  "inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-bold transition [-webkit-tap-highlight-color:transparent]";

const CHEST_HUB_FIRST_HINT_LS_PREFIX = "recompensa-premiada:chestHubFirstUnlockHint:";

export function BauGameScreen() {
  const { user } = useAuth();
  /** Sem LS (ou falha), ainda some após o clique; troca de conta compara com o uid atual. */
  const [firstHubHintSuppressedForUid, setFirstHubHintSuppressedForUid] = useState<string | null>(
    null,
  );

  const {
    loading,
    summary,
    slotItems,
    queueItems,
    activeUnlockChest,
    feedback,
    clearFeedback,
    busyState,
    startUnlock,
    speedUpChest,
    claimChest,
    rarityLabel,
  } = useChestHub();

  const readyChest = slotItems.find((item) => item?.canClaim) ?? null;
  const lockedChest = slotItems.find((item) => item?.canStartUnlock) ?? null;
  const queuedChest = queueItems[0] ?? null;
  const spotlightChest = readyChest ?? activeUnlockChest ?? lockedChest ?? queuedChest ?? null;
  const totalSlots = slotItems.length;
  const showFirstHubUnlockHint =
    !loading &&
    summary.occupiedSlots === 1 &&
    lockedChest != null &&
    summary.queuedCount === 0;

  const firstHubHintStorageKey = user?.uid ? `${CHEST_HUB_FIRST_HINT_LS_PREFIX}${user.uid}` : null;
  const firstHubHintStoredDismissed =
    typeof window !== "undefined" && firstHubHintStorageKey
      ? (() => {
          try {
            return window.localStorage.getItem(firstHubHintStorageKey) === "1";
          } catch {
            return false;
          }
        })()
      : false;

  const dismissFirstHubHint = useCallback(() => {
    if (!user?.uid) return;
    try {
      window.localStorage.setItem(`${CHEST_HUB_FIRST_HINT_LS_PREFIX}${user.uid}`, "1");
    } catch {
      /* storage indisponível (modo privado etc.) */
    }
    setFirstHubHintSuppressedForUid(user.uid);
  }, [user]);

  const showFirstHubUnlockHintBanner =
    showFirstHubUnlockHint &&
    !!user?.uid &&
    !firstHubHintStoredDismissed &&
    firstHubHintSuppressedForUid !== user.uid;

  const spotlightTitle = loading
    ? "Sincronizando seus baús"
    : readyChest
      ? `${summary.readyCount} baú${summary.readyCount > 1 ? "s" : ""} pronto${summary.readyCount > 1 ? "s" : ""}`
      : activeUnlockChest
        ? `${rarityLabel[activeUnlockChest.rarity]} em abertura`
        : lockedChest
          ? `${rarityLabel[lockedChest.rarity]} aguardando`
          : queuedChest
            ? "Fila aguardando espaço"
            : "Seus próximos prêmios aparecem aqui";

  const spotlightDescription = loading
    ? "Buscando o estado mais recente."
    : readyChest
      ? "Colete agora para liberar o slot."
      : activeUnlockChest
        ? `Faltam ${formatChestDurationMs(activeUnlockChest.remainingMs)}.`
        : lockedChest
          ? "Inicie o timer para liberar a recompensa."
          : queuedChest
            ? "Libere um slot para receber o próximo baú."
            : "Ganhe partidas, complete missões e mantenha sua sequência.";

  return (
    <ArenaShell maxWidth="max-w-5xl">
      <motion.div
        className="space-y-4 pb-24 sm:space-y-5 sm:pb-16"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.header variants={fadeUpItem} className="space-y-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-amber-200/75">
            Hub de baús
          </p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="bg-gradient-to-r from-white via-amber-100 to-orange-200 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
                Seus baús e recompensas
              </h1>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-white/55 sm:text-sm">
                Abra, acelere e colete. Os próximos ganhos entram nos slots ou aguardam na fila.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MetricPill label="Prontos" value={String(summary.readyCount)} />
              <MetricPill label="Slots" value={`${summary.occupiedSlots}/${totalSlots}`} />
              <MetricPill
                label="Fila"
                value={String(summary.queuedCount)}
                warning={summary.backlogFull}
              />
            </div>
          </div>
        </motion.header>

        {summary.backlogFull ? (
          <motion.div variants={fadeUpItem}>
            <AlertBanner tone="error">
              Slots e fila estão no limite. Coletar e iniciar novas aberturas agora evita perder
              futuros envios.
            </AlertBanner>
          </motion.div>
        ) : null}

        {showFirstHubUnlockHintBanner ? (
          <motion.div variants={fadeUpItem}>
            <div
              role="note"
              className="flex items-start gap-3 rounded-[1.2rem] border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(8,47,73,0.3),rgba(2,6,23,0.9))] p-3"
            >
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 text-sm leading-relaxed">
                <p className="font-bold text-cyan-100">Primeiro baú neste hub</p>
                <p className="mt-1 text-xs text-white/60">
                  Inicie a abertura, aguarde o timer e colete. Um anúncio pode reduzir o tempo.
                </p>
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-9 border-cyan-400/20 px-3 py-1.5 text-[10px]"
                    onClick={dismissFirstHubHint}
                  >
                    Entendi
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}

        <motion.section
          variants={fadeUpItem}
          className={cn(
            "rounded-[1.4rem] border p-4 shadow-[0_0_42px_-20px_rgba(251,191,36,0.22)] sm:p-5",
            readyChest
              ? "border-emerald-400/25 bg-[linear-gradient(135deg,rgba(6,78,59,0.52),rgba(2,6,23,0.96)_60%,rgba(8,47,73,0.62))]"
              : activeUnlockChest
                ? "border-cyan-400/20 bg-[linear-gradient(135deg,rgba(8,47,73,0.5),rgba(2,6,23,0.96)_60%,rgba(76,29,149,0.48))]"
                : "border-amber-400/20 bg-[linear-gradient(135deg,rgba(120,53,15,0.42),rgba(2,6,23,0.96)_60%,rgba(76,29,149,0.42))]",
          )}
        >
          <div className="flex items-start gap-3 sm:gap-4">
            <span
              className={cn(
                "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border sm:h-16 sm:w-16",
                readyChest
                  ? "border-emerald-300/30 bg-emerald-400/12 text-emerald-200"
                  : activeUnlockChest
                    ? "border-cyan-300/30 bg-cyan-400/12 text-cyan-200"
                    : "border-amber-300/30 bg-amber-400/12 text-amber-200",
              )}
            >
              {readyChest ? (
                <PackageOpen className="h-7 w-7" aria-hidden />
              ) : activeUnlockChest ? (
                <Clock3 className="h-7 w-7" aria-hidden />
              ) : lockedChest ? (
                <Hourglass className="h-7 w-7" aria-hidden />
              ) : queuedChest ? (
                <Inbox className="h-7 w-7" aria-hidden />
              ) : (
                <Sparkles className="h-7 w-7" aria-hidden />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/45">
                Próxima ação
              </p>
              <h2 className="mt-0.5 text-lg font-black leading-tight text-white sm:text-xl">
                {spotlightTitle}
              </h2>
              <p className="mt-1 text-xs text-white/60">{spotlightDescription}</p>
              {spotlightChest ? (
                <div className="mt-2.5">
                  <RewardBadges rewards={spotlightChest.rewardsSnapshot} />
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/8 pt-3">
            {readyChest ? (
              <Button
                size="lg"
                variant="arena"
                className="min-w-[10rem] flex-1"
                disabled={busyState != null}
                onClick={() => void claimChest(readyChest.id)}
              >
                {busyState?.chestId === readyChest.id && busyState?.action === "claim"
                  ? "Coletando..."
                  : "Coletar agora"}
              </Button>
            ) : activeUnlockChest ? (
              <Button
                size="lg"
                variant="secondary"
                className="min-w-[10rem] flex-1 border-cyan-400/25"
                disabled={busyState != null || activeUnlockChest.speedupCooldownRemainingMs > 0}
                onClick={() => void speedUpChest(activeUnlockChest.id)}
              >
                {busyState?.chestId === activeUnlockChest.id &&
                busyState?.action === "speed"
                  ? "Validando anúncio…"
                  : activeUnlockChest.speedupCooldownRemainingMs > 0
                    ? `Aguarde ${formatChestDurationMs(activeUnlockChest.speedupCooldownRemainingMs)}`
                    : "Acelerar com anúncio"}
              </Button>
            ) : lockedChest ? (
              <Button
                size="lg"
                className="min-w-[10rem] flex-1"
                disabled={busyState != null}
                onClick={() => void startUnlock(lockedChest.id)}
              >
                {busyState?.chestId === lockedChest.id && busyState?.action === "start"
                  ? "Iniciando..."
                  : "Começar abertura"}
              </Button>
            ) : (
              <Link
                href={ROUTES.jogos}
                className={cn(
                  hubLink,
                  "min-w-[10rem] flex-1 border-amber-300/25 bg-amber-400/10 text-amber-100",
                )}
              >
                Jogar na Arena
              </Link>
            )}
            <Link
              href={ROUTES.home}
              className={cn(
                hubLink,
                "border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white",
              )}
            >
              Voltar
            </Link>
          </div>
        </motion.section>

        <motion.section variants={fadeUpItem} className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                Slots principais
              </p>
              <h2 className="text-lg font-semibold text-white">Área operacional</h2>
            </div>
            <p className="max-w-[8rem] text-right text-[10px] leading-snug text-white/45 sm:max-w-none sm:text-xs">
              Até {totalSlots} baús ativos
            </p>
          </div>
          <motion.div
            variants={staggerContainer}
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            {slotItems.map((item, index) => (
              <motion.div key={index} variants={staggerItem}>
                <SlotCard
                  slotNumber={index + 1}
                  item={item}
                  rarityLabel={rarityLabel}
                  busyState={busyState}
                  onStartUnlock={startUnlock}
                  onSpeedUp={speedUpChest}
                  onClaim={claimChest}
                />
              </motion.div>
            ))}
          </motion.div>
        </motion.section>

        <motion.section variants={fadeUpItem} className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Fila</p>
              <h2 className="text-lg font-semibold text-white">Próximos envios</h2>
            </div>
            <p className="max-w-[8rem] text-right text-[10px] leading-snug text-white/45 sm:max-w-none sm:text-xs">
              {summary.queuedCount > 0
                ? `${summary.queuedCount} aguardando slot`
                : "Sem espera no momento"}
            </p>
          </div>
          <div className="space-y-2">
            {queueItems.length === 0 ? (
              <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-white/[0.025] px-4 py-5 text-center text-xs text-white/40">
                Quando os slots lotarem, os próximos baús ficam estacionados aqui.
              </div>
            ) : (
              queueItems.map((item) => (
                <QueueRow key={item.id} item={item} rarityLabel={rarityLabel} />
              ))
            )}
          </div>
        </motion.section>

        <motion.section
          variants={fadeUpItem}
          className="rounded-[1.25rem] border border-white/10 bg-white/[0.025]"
        >
          <details className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">
                  Ajuda
                </span>
                <span className="block text-sm font-semibold text-white">Como ganhar novos baús</span>
              </span>
              <ChevronDown className="h-4 w-4 text-white/45 transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="grid gap-2 border-t border-white/8 p-3 sm:grid-cols-3">
              <SourceCard
                icon={Trophy}
                title="Vitórias 1v1"
                tone="cyan"
                text="Confrontos multiplayer podem enviar baús quando você fecha a série em vantagem."
              />
              <SourceCard
                icon={Flame}
                title="Streak diária"
                tone="amber"
                text="Alguns marcos de sequência liberam um baú extra."
              />
              <SourceCard
                icon={Gift}
                title="Missões"
                tone="violet"
                text="Resgates de missão também podem abastecer seus slots e a fila."
              />
            </div>
          </details>
        </motion.section>
      </motion.div>
      <ChestFeedbackToast feedback={feedback} onDismiss={clearFeedback} />
    </ArenaShell>
  );
}

function ChestFeedbackToast({
  feedback,
  onDismiss,
}: {
  feedback: { tone: "info" | "success" | "error"; text: string } | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!feedback) return;
    const id = window.setTimeout(onDismiss, feedback.tone === "error" ? 5600 : 4200);
    return () => window.clearTimeout(id);
  }, [feedback, onDismiss]);

  useEffect(() => {
    if (!feedback) return;
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    if (typeof window !== "undefined" && !window.matchMedia("(pointer: coarse)").matches) return;
    navigator.vibrate(feedback.tone === "error" ? [80, 70, 80] : [40]);
  }, [feedback]);

  if (!feedback) return null;

  const Icon =
    feedback.tone === "success" ? CheckCircle2 : feedback.tone === "error" ? CircleAlert : Info;
  const glowClass =
    feedback.tone === "success"
      ? "shadow-[0_22px_54px_-22px_rgba(16,185,129,0.75)]"
      : feedback.tone === "error"
        ? "shadow-[0_22px_54px_-20px_rgba(239,68,68,0.85)]"
        : "shadow-[0_22px_54px_-22px_rgba(14,165,233,0.75)]";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] z-[1200] flex justify-center px-4 sm:bottom-[calc(7rem+env(safe-area-inset-bottom))]">
      <motion.div
        key={`${feedback.tone}:${feedback.text}`}
        initial={{ opacity: 0, y: 26, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        className="pointer-events-auto w-full max-w-md"
      >
        <AlertBanner
          tone={feedback.tone}
          className={cn(
            "flex items-start gap-3 rounded-2xl px-4 py-3 backdrop-blur sm:px-4",
            "ring-1 ring-white/10",
            glowClass,
          )}
        >
          <Icon className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1 pr-2 leading-relaxed">{feedback.text}</div>
          <button
            type="button"
            onClick={onDismiss}
            className="touch-manipulation rounded-full border border-white/10 p-1 text-white/70 transition [-webkit-tap-highlight-color:transparent] hover:bg-white/10 hover:text-white"
            aria-label="Fechar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </AlertBanner>
      </motion.div>
    </div>,
    document.body,
  );
}

function MetricPill({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.2rem] border px-3 py-2.5 text-center",
        warning ? "border-rose-400/20 bg-rose-500/10" : "border-white/10 bg-white/5",
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-1 text-lg font-black tracking-tight text-white">{value}</p>
    </div>
  );
}

function SlotCard({
  slotNumber,
  item,
  rarityLabel,
  busyState,
  onStartUnlock,
  onSpeedUp,
  onClaim,
}: {
  slotNumber: number;
  item: ResolvedChestItem | null;
  rarityLabel: Record<ResolvedChestItem["rarity"], string>;
  busyState: { chestId: string; action: "start" | "speed" | "claim" } | null;
  onStartUnlock: (chestId: string) => Promise<unknown>;
  onSpeedUp: (chestId: string) => Promise<unknown>;
  onClaim: (chestId: string) => Promise<unknown>;
}) {
  if (!item) {
    return (
      <div className="flex min-h-[88px] items-center gap-3 rounded-[1.2rem] border border-dashed border-white/10 bg-white/[0.025] p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/12 bg-black/15">
          <Inbox className="h-4 w-4 text-white/30" aria-hidden />
        </span>
        <span>
          <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">
            Slot {slotNumber}
          </span>
          <span className="mt-0.5 block text-sm font-semibold text-white/55">Livre</span>
          <span className="mt-0.5 block text-[10px] text-white/32">Pronto para o próximo baú</span>
        </span>
      </div>
    );
  }

  const busy = busyState?.chestId === item.id ? busyState.action : null;
  const isAnyBusy = busyState != null;

  return (
    <div className="h-full rounded-[1.25rem] border border-white/10 bg-slate-950/70 p-3.5 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.8)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
            Slot {slotNumber}
          </p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-white">
            {rarityLabel[item.rarity]}
          </h3>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
            item.resolvedStatus === "ready"
              ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
              : item.resolvedStatus === "unlocking"
                ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-100"
                : "border-amber-400/20 bg-amber-500/10 text-amber-100",
          )}
        >
          {CHEST_STATUS_LABEL[item.resolvedStatus]}
        </span>
      </div>

      <p className="mt-2 text-sm text-white/60">{CHEST_SOURCE_LABEL[item.source]}</p>

      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
          Recompensa prevista
        </p>
        <div className="mt-2">
          <RewardBadges rewards={item.rewardsSnapshot} />
        </div>
      </div>

      {item.resolvedStatus === "unlocking" ? (
        <p className="mt-3 text-sm text-cyan-100/90">
          Liberação em {formatChestDurationMs(item.remainingMs)}.
        </p>
      ) : item.resolvedStatus === "locked" ? (
        item.canStartUnlock ? (
          <p className="mt-3 text-sm text-white/55">
            Parado no slot, aguardando início manual.
          </p>
        ) : null
      ) : item.resolvedStatus === "ready" ? (
        <p className="mt-3 text-sm text-emerald-100/85">Já pronto para abrir e liberar espaço.</p>
      ) : null}

      <div className="mt-4">
        {item.canClaim ? (
          <Button
            className="w-full"
            variant="arena"
            disabled={isAnyBusy}
            onClick={() => void onClaim(item.id)}
          >
            {busy === "claim" ? "Coletando..." : "Coletar"}
          </Button>
        ) : item.canSpeedUp ? (
          <Button
            className="flex min-h-[3rem] flex-col gap-1 py-2.5 leading-snug"
            variant="secondary"
            disabled={isAnyBusy || item.speedupCooldownRemainingMs > 0}
            onClick={() => void onSpeedUp(item.id)}
          >
            {busy === "speed" ? (
              "Validando…"
            ) : item.speedupCooldownRemainingMs > 0 ? (
              <>
                <span className="inline-flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide">
                  <Clock3 className="h-3.5 w-3.5 text-amber-200" aria-hidden />
                  Esperar anúncio
                </span>
                <span className="font-mono text-xs font-bold tabular-nums text-amber-100">
                  {formatChestDurationMs(item.speedupCooldownRemainingMs)}
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="h-4 w-4 shrink-0" aria-hidden /> Acelerar
                </span>
                <span className="text-[10px] font-medium normal-case opacity-85">com anúncio</span>
              </>
            )}
          </Button>
        ) : item.canStartUnlock ? (
          <Button className="w-full" disabled={isAnyBusy} onClick={() => void onStartUnlock(item.id)}>
            {busy === "start" ? "Iniciando..." : "Iniciar abertura"}
          </Button>
        ) : item.resolvedStatus === "locked" ? (
          <div
            className={cn(
              "flex items-start gap-2.5 rounded-xl border px-3 py-3 text-left text-sm leading-relaxed",
              "border-amber-500/25 bg-amber-500/[0.08] text-amber-100/90",
            )}
            role="status"
          >
            <Clock3
              className="mt-0.5 size-5 shrink-0 text-amber-200/85"
              aria-hidden
            />
            <span className="min-w-0">
              {item.unlockStartBlockedReason === "prioritize_lower_slot"
                ? CHEST_OPEN_LOWER_SLOT_FIRST_MESSAGE
                : CHEST_ALREADY_OPENING_MESSAGE}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function QueueRow({
  item,
  rarityLabel,
}: {
  item: ResolvedChestItem;
  rarityLabel: Record<ResolvedChestItem["rarity"], string>;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[1.35rem] border border-white/10 bg-slate-950/60 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
          Fila {Number(item.queuePosition ?? 0) + 1}
        </p>
        <p className="mt-1 text-sm font-semibold text-white">
          {rarityLabel[item.rarity]} · {CHEST_SOURCE_LABEL[item.source]}
        </p>
        <p className="mt-1 text-xs text-white/55">
          {formatChestRewardSummary(item.rewardsSnapshot)}
        </p>
      </div>
      <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-100/85">
        aguardando vaga
      </span>
    </div>
  );
}

function RewardBadges({
  rewards,
}: {
  rewards: ResolvedChestItem["rewardsSnapshot"];
}) {
  return (
    <div className="flex flex-wrap gap-2 text-[11px]">
      {rewards.coins > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-amber-100/85">
          <Coins className="h-3 w-3" />+{rewards.coins} PR
        </span>
      ) : null}
      {rewards.bonusCoins > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-100/85">
          <Gift className="h-3 w-3" />+{rewards.bonusCoins} PR bônus
        </span>
      ) : null}
      {rewards.gems > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-1 text-cyan-100/85">
          <Ticket className="h-3 w-3" />+{rewards.gems} TICKET
        </span>
      ) : null}
      {rewards.xp > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/20 bg-violet-500/10 px-2.5 py-1 text-violet-100/85">
          <Sparkles className="h-3 w-3" />+{rewards.xp} XP
        </span>
      ) : null}
      {rewards.fragments > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-300/20 bg-fuchsia-500/10 px-2.5 py-1 text-fuchsia-100/85">
          <Gift className="h-3 w-3" />+{rewards.fragments} fragmento{rewards.fragments === 1 ? "" : "s"}
        </span>
      ) : null}
      {rewards.boostMinutes > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-orange-300/20 bg-orange-500/10 px-2.5 py-1 text-orange-100/85">
          <Flame className="h-3 w-3" />Boost {rewards.boostMinutes} min
        </span>
      ) : null}
      {rewards.superPrizeEntries > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-300/20 bg-rose-500/10 px-2.5 py-1 text-rose-100/90">
          <Trophy className="h-3 w-3" />+{rewards.superPrizeEntries} entrada
          {rewards.superPrizeEntries === 1 ? " especial" : "s especiais"}
        </span>
      ) : null}
    </div>
  );
}

function SourceCard({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: typeof Trophy;
  title: string;
  text: string;
  tone: "cyan" | "amber" | "violet";
}) {
  const toneClasses =
    tone === "cyan"
      ? "text-cyan-100 border-cyan-400/15 bg-cyan-500/[0.06]"
      : tone === "amber"
        ? "text-amber-100 border-amber-400/15 bg-amber-500/[0.06]"
        : "text-violet-100 border-violet-400/15 bg-violet-500/[0.06]";

  return (
    <div className={cn("rounded-2xl border p-4", toneClasses)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-[10px] font-bold uppercase tracking-[0.22em]">{title}</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/70">{text}</p>
      {title === "Vitórias 1v1" ? (
        <Link
          href={ROUTES.jogos}
          className="mt-4 inline-flex touch-manipulation items-center text-sm font-semibold text-cyan-200 [-webkit-tap-highlight-color:transparent] hover:text-cyan-100"
        >
          Ir para a arena
          <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
