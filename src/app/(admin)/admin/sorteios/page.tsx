"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { formatFirebaseError } from "@/lib/firebase/errors";
import {
  adminCloseRaffleCallable,
  adminCreateOrUpdateRaffleCallable,
  adminDrawRaffleCallable,
  getActiveRaffleCallable,
} from "@/services/raffle/raffleService";
import { uploadRafflePrizeImage } from "@/services/raffle/prizeImageUpload";
import type { RaffleEntryMode, RaffleScheduleMode, RaffleView } from "@/types/raffle";
import type { RaffleSystemConfig } from "@/types/systemConfig";
import { mapRaffleSnapshotToView } from "@/utils/raffleFirestore";
import {
  RAFFLE_DEFAULT_DRAW_TIME_ZONE,
  RAFFLE_DEFAULT_MAX_PER_PURCHASE,
  RAFFLE_DEFAULT_RELEASED_COUNT,
  RAFFLE_RELEASE_PRESETS,
  RAFFLE_DEFAULT_TICKET_PRICE,
  clampRaffleMaxPerPurchase,
  clampRaffleReleasedCount,
  clampRaffleTicketPrice,
  formatRaffleScopedNumber,
  formatRaffleReleasedRangeLabel,
  getRaffleNumberDigits,
  getRaffleProgressPercent,
} from "@/utils/raffle";
import {
  BarChart3,
  CalendarClock,
  Loader2,
  PencilLine,
  PlusCircle,
  Save,
  Shuffle,
  Sparkles,
  StopCircle,
} from "lucide-react";

const RAFFLE_SYSTEM_ID = "raffle_system";

function toDatetimeLocalValue(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "";
  try {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function formatFederalResultWhen(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  try {
    return new Date(ms).toLocaleString("pt-BR", {
      timeZone: RAFFLE_DEFAULT_DRAW_TIME_ZONE,
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatAdminDateTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  try {
    return new Date(ms).toLocaleString("pt-BR", {
      timeZone: RAFFLE_DEFAULT_DRAW_TIME_ZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fromDatetimeLocal(value: string): number | null {
  if (!value.trim()) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

function resolveScheduleMode(raffle: Pick<RaffleView, "scheduleMode" | "endsAtMs"> | null | undefined): RaffleScheduleMode {
  if (raffle?.scheduleMode === "until_sold_out") return "until_sold_out";
  if (raffle?.scheduleMode === "date_range") return "date_range";
  return raffle?.endsAtMs == null ? "until_sold_out" : "date_range";
}

function scheduleModeLabel(mode: RaffleScheduleMode): string {
  return mode === "until_sold_out" ? "Até esgotar os números" : "Início e fim por data";
}

function raffleWinnerLabel(raffle: Pick<RaffleView, "winnerName" | "winnerUsername"> | null | undefined): string {
  if (!raffle) return "—";
  if (raffle.winnerUsername) return `@${raffle.winnerUsername}`;
  if (raffle.winnerName) return raffle.winnerName;
  return "—";
}

function sanitizeWinningNumberInput(value: string, maxDigits = 6): string {
  return value.replace(/\D/g, "").slice(0, Math.max(1, maxDigits));
}

function resolveReleasedPresetValue(value: string): string {
  const normalized = Math.floor(Number(value) || 0);
  return RAFFLE_RELEASE_PRESETS.some((item) => item.value === normalized) ? String(normalized) : "custom";
}

type InstantPrizeTierForm = {
  quantity: string;
  amount: string;
};

export default function AdminSorteiosPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [raffleCatalog, setRaffleCatalog] = useState<RaffleView[]>([]);

  const [systemEnabled, setSystemEnabled] = useState(true);
  const [defaultTicketPrice, setDefaultTicketPrice] = useState(String(RAFFLE_DEFAULT_TICKET_PRICE));
  const [defaultReleasedCount, setDefaultReleasedCount] = useState(String(RAFFLE_DEFAULT_RELEASED_COUNT));
  const [defaultMaxPerPurchase, setDefaultMaxPerPurchase] = useState(String(RAFFLE_DEFAULT_MAX_PER_PURCHASE));
  const [defaultPrizeCurrency, setDefaultPrizeCurrency] = useState<"coins" | "gems" | "rewardBalance">("coins");
  const [defaultPrizeAmount, setDefaultPrizeAmount] = useState("1000");

  const [raffleId, setRaffleId] = useState("");
  const [title, setTitle] = useState("Sorteio oficial");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [releasedCount, setReleasedCount] = useState(String(RAFFLE_DEFAULT_RELEASED_COUNT));
  const [ticketPrice, setTicketPrice] = useState(String(RAFFLE_DEFAULT_TICKET_PRICE));
  const [entryMode, setEntryMode] = useState<RaffleEntryMode>("ticket");
  const [rewardedAdCooldownSeconds, setRewardedAdCooldownSeconds] = useState("120");
  const [maxPerPurchase, setMaxPerPurchase] = useState(String(RAFFLE_DEFAULT_MAX_PER_PURCHASE));
  const [prizeCurrency, setPrizeCurrency] = useState<"coins" | "gems" | "rewardBalance">("coins");
  const [prizeAmount, setPrizeAmount] = useState("1000");
  const [scheduleMode, setScheduleMode] = useState<RaffleScheduleMode>("date_range");
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [endsAtLocal, setEndsAtLocal] = useState("");
  const [instantPrizeTiers, setInstantPrizeTiers] = useState<InstantPrizeTierForm[]>([]);

  const [prizeImageUrl, setPrizeImageUrl] = useState<string | null>(null);
  const [pendingPrizeImage, setPendingPrizeImage] = useState<File | null>(null);
  const [prizeImagePreviewUrl, setPrizeImagePreviewUrl] = useState<string | null>(null);
  const [clearPrizeImage, setClearPrizeImage] = useState(false);

  const [liveRaffle, setLiveRaffle] = useState<RaffleView | null>(null);
  const [closing, setClosing] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [winningNumberInput, setWinningNumberInput] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setMsg(null);
      try {
        const db = getFirebaseFirestore();
        const sysSnap = await getDoc(doc(db, COLLECTIONS.systemConfigs, RAFFLE_SYSTEM_ID));
        if (sysSnap.exists() && !cancelled) {
          const s = sysSnap.data() as Partial<RaffleSystemConfig>;
          if (typeof s.enabled === "boolean") setSystemEnabled(s.enabled);
          if (typeof s.defaultTicketPrice === "number") setDefaultTicketPrice(String(s.defaultTicketPrice));
          if (typeof s.defaultReleasedCount === "number") setDefaultReleasedCount(String(s.defaultReleasedCount));
          if (typeof s.defaultMaxPerPurchase === "number") {
            setDefaultMaxPerPurchase(String(s.defaultMaxPerPurchase));
          }
          if (s.defaultPrizeCurrency === "coins" || s.defaultPrizeCurrency === "gems" || s.defaultPrizeCurrency === "rewardBalance") {
            setDefaultPrizeCurrency(s.defaultPrizeCurrency);
          }
          if (typeof s.defaultPrizeAmount === "number") setDefaultPrizeAmount(String(s.defaultPrizeAmount));
        }

        const active = await getActiveRaffleCallable();
        if (cancelled) return;
        setLiveRaffle(active.raffle);
        if (active.raffle) {
          const r = active.raffle;
          setWinningNumberInput(
            r.winningNumber != null ? formatRaffleScopedNumber(r.winningNumber, r.releasedCount) : "",
          );
          if (r.status === "draft" || r.status === "active") {
            setRaffleId(r.id);
            setTitle(r.title);
            setDescription(r.description ?? "");
            setStatus(r.status);
            setReleasedCount(String(r.releasedCount));
            setTicketPrice(String(r.ticketPrice));
            setEntryMode(r.entryMode === "rewarded_ad" ? "rewarded_ad" : "ticket");
            setRewardedAdCooldownSeconds(
              String(
                r.rewardedAdCooldownSeconds != null && r.rewardedAdCooldownSeconds >= 0
                  ? r.rewardedAdCooldownSeconds
                  : 120,
              ),
            );
            setMaxPerPurchase(String(r.maxPerPurchase));
            setPrizeCurrency(r.prizeCurrency);
            setPrizeAmount(String(r.prizeAmount));
            setScheduleMode(resolveScheduleMode(r));
            setStartsAtLocal(toDatetimeLocalValue(r.startsAtMs));
            setEndsAtLocal(toDatetimeLocalValue(r.endsAtMs));
            setInstantPrizeTiers(
              (r.instantPrizeTiers ?? []).map((tier) => ({
                quantity: String(tier.quantity),
                amount: String(tier.amount),
              })),
            );
            setPrizeImageUrl(r.prizeImageUrl ?? null);
            setPendingPrizeImage(null);
            setClearPrizeImage(false);
          } else {
            setRaffleId("");
            setTitle("Sorteio oficial");
            setDescription("");
            setStatus("draft");
            setScheduleMode("date_range");
            setStartsAtLocal("");
            setEndsAtLocal("");
            setInstantPrizeTiers([]);
            setPrizeImageUrl(null);
            setPendingPrizeImage(null);
            setClearPrizeImage(false);
          }
        } else {
          setRaffleId("");
          setTitle("Sorteio oficial");
          setDescription("");
          setStatus("draft");
          setScheduleMode("date_range");
          setStartsAtLocal("");
          setEndsAtLocal("");
          setInstantPrizeTiers([]);
          setPrizeImageUrl(null);
          setPendingPrizeImage(null);
          setClearPrizeImage(false);
        }
      } catch (e) {
        if (!cancelled) setMsg(formatFirebaseError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const db = getFirebaseFirestore();
    const raffleQuery = query(collection(db, COLLECTIONS.raffles), orderBy("updatedAt", "desc"), limit(24));
    const unsubscribe = onSnapshot(raffleQuery, (snapshot) => {
      const next = snapshot.docs
        .map((docSnap) => mapRaffleSnapshotToView(docSnap))
        .filter((item): item is RaffleView => item != null);
      setRaffleCatalog(next);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!pendingPrizeImage) {
      setPrizeImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingPrizeImage);
    setPrizeImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingPrizeImage]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function populateEditableFormFromRaffle(r: RaffleView) {
    setRaffleId(r.id);
    setTitle(r.title);
    setDescription(r.description ?? "");
    setStatus(r.status === "draft" || r.status === "active" ? r.status : "draft");
    setReleasedCount(String(r.releasedCount));
    setTicketPrice(String(r.ticketPrice));
    setEntryMode(r.entryMode === "rewarded_ad" ? "rewarded_ad" : "ticket");
    setRewardedAdCooldownSeconds(
      String(
        r.rewardedAdCooldownSeconds != null && r.rewardedAdCooldownSeconds >= 0
          ? r.rewardedAdCooldownSeconds
          : 120,
      ),
    );
    setMaxPerPurchase(String(r.maxPerPurchase));
    setPrizeCurrency(r.prizeCurrency);
    setPrizeAmount(String(r.prizeAmount));
    setScheduleMode(resolveScheduleMode(r));
    setStartsAtLocal(toDatetimeLocalValue(r.startsAtMs));
    setEndsAtLocal(toDatetimeLocalValue(r.endsAtMs));
    setInstantPrizeTiers(
      (r.instantPrizeTiers ?? []).map((tier) => ({
        quantity: String(tier.quantity),
        amount: String(tier.amount),
      })),
    );
    setPrizeImageUrl(r.prizeImageUrl ?? null);
    setPendingPrizeImage(null);
    setClearPrizeImage(false);
  }

  function resetFormForNewRaffle() {
    setRaffleId("");
    setTitle("Sorteio oficial");
    setDescription("");
    setStatus("draft");
    setReleasedCount(String(clampRaffleReleasedCount(defaultReleasedCount)));
    setTicketPrice(String(clampRaffleTicketPrice(defaultTicketPrice)));
    setEntryMode("ticket");
    setRewardedAdCooldownSeconds("120");
    setMaxPerPurchase(String(clampRaffleMaxPerPurchase(defaultMaxPerPurchase)));
    setPrizeCurrency(defaultPrizeCurrency);
    setPrizeAmount(defaultPrizeAmount);
    setScheduleMode("date_range");
    setStartsAtLocal("");
    setEndsAtLocal("");
    setInstantPrizeTiers([]);
    setPrizeImageUrl(null);
    setPendingPrizeImage(null);
    setClearPrizeImage(false);
    setWinningNumberInput("");
  }

  function editRaffle(raffle: RaffleView) {
    populateEditableFormFromRaffle(raffle);
    setWinningNumberInput(
      raffle.winningNumber != null ? formatRaffleScopedNumber(raffle.winningNumber, raffle.releasedCount) : "",
    );
    setMsg(null);
  }

  async function saveSystemConfig() {
    setMsg(null);
    setSaving(true);
    try {
      const db = getFirebaseFirestore();
      await setDoc(
        doc(db, COLLECTIONS.systemConfigs, RAFFLE_SYSTEM_ID),
        {
          id: RAFFLE_SYSTEM_ID,
          enabled: systemEnabled,
          defaultTicketPrice: clampRaffleTicketPrice(defaultTicketPrice),
          defaultReleasedCount: clampRaffleReleasedCount(defaultReleasedCount),
          defaultMaxPerPurchase: clampRaffleMaxPerPurchase(defaultMaxPerPurchase),
          defaultPrizeCurrency,
          defaultPrizeAmount: Math.max(0, Math.floor(Number(defaultPrizeAmount) || 0)),
          drawTimeZone: RAFFLE_DEFAULT_DRAW_TIME_ZONE,
        },
        { merge: true },
      );
      setMsg("Configuração global do sorteio salva.");
    } catch (e) {
      setMsg(formatFirebaseError(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveRaffle() {
    setMsg(null);
    setSaving(true);
    try {
      const startsAtMs = fromDatetimeLocal(startsAtLocal);
      const endsAtMs = scheduleMode === "until_sold_out" ? null : fromDatetimeLocal(endsAtLocal);

      const buildPayload = (extra: Record<string, unknown> = {}) => ({
        raffleId: raffleId.trim() || undefined,
        title: title.trim(),
        description: description.trim() || null,
        status,
        releasedCount: clampRaffleReleasedCount(releasedCount),
        ticketPrice: clampRaffleTicketPrice(ticketPrice),
        entryMode,
        rewardedAdCooldownSeconds: Math.max(
          0,
          Math.min(86_400, Math.floor(Number(rewardedAdCooldownSeconds) || 0)),
        ),
        maxPerPurchase: clampRaffleMaxPerPurchase(maxPerPurchase),
        prizeCurrency,
        prizeAmount: Math.max(0, Math.floor(Number(prizeAmount) || 0)),
        scheduleMode,
        instantPrizeTiers: instantPrizeTiers
          .map((tier) => ({
            quantity: Math.max(0, Math.floor(Number(tier.quantity) || 0)),
            amount: Math.max(0, Math.floor(Number(tier.amount) || 0)),
            currency: "rewardBalance",
          }))
          .filter((tier) => tier.quantity > 0 && tier.amount > 0),
        startsAtMs,
        endsAtMs,
        ...extra,
      });

      let id = raffleId.trim();
      const imageExtra: Record<string, unknown> = {};
      if (clearPrizeImage && !pendingPrizeImage) {
        imageExtra.prizeImageUrl = null;
      }

      if (pendingPrizeImage) {
        if (!id) {
          const res0 = await adminCreateOrUpdateRaffleCallable(buildPayload());
          id = res0.raffle?.id ?? "";
          if (res0.raffle) {
            setRaffleId(res0.raffle.id);
            setLiveRaffle(res0.raffle);
          }
          if (!id) {
            setMsg("Não foi possível obter o ID do sorteio para enviar a imagem.");
            return;
          }
        }
        const url = await uploadRafflePrizeImage(id, pendingPrizeImage);
        setPendingPrizeImage(null);
        setClearPrizeImage(false);
        imageExtra.prizeImageUrl = url;
      }

      const res = await adminCreateOrUpdateRaffleCallable(buildPayload({ ...imageExtra, raffleId: id || undefined }));
      if (res.raffle) {
        setWinningNumberInput(
          res.raffle.winningNumber != null
            ? formatRaffleScopedNumber(res.raffle.winningNumber, res.raffle.releasedCount)
            : "",
        );
        populateEditableFormFromRaffle(res.raffle);
        const active = await getActiveRaffleCallable();
        setLiveRaffle(active.raffle);
      }
      setClearPrizeImage(false);
      setMsg("Sorteio salvo.");
    } catch (e) {
      setMsg(formatFirebaseError(e));
    } finally {
      setSaving(false);
    }
  }

  async function closeRaffle() {
    const targetRaffleId = liveRaffle?.id?.trim() || raffleId.trim();
    if (!targetRaffleId) return;
    setMsg(null);
    setClosing(true);
    try {
      const res = await adminCloseRaffleCallable(targetRaffleId);
      if (res.raffle) setLiveRaffle(res.raffle);
      setMsg(
        res.raffle?.resultScheduledAtMs
          ? `Sorteio encerrado para compras. Resultado Federal programado para ${formatFederalResultWhen(
              res.raffle.resultScheduledAtMs,
            )}.`
          : "Sorteio encerrado para compras.",
      );
    } catch (e) {
      setMsg(formatFirebaseError(e));
    } finally {
      setClosing(false);
    }
  }

  async function drawRaffle() {
    const targetRaffleId = liveRaffle?.id?.trim() || raffleId.trim();
    if (!targetRaffleId) return;
    const sanitizedWinningNumber = sanitizeWinningNumberInput(winningNumberInput, liveNumberDigits);
    if (!sanitizedWinningNumber) {
      setMsg("Informe o número oficial para finalizar o sorteio.");
      return;
    }
    setMsg(null);
    setDrawing(true);
    try {
      const res = await adminDrawRaffleCallable({
        raffleId: targetRaffleId,
        winningNumber: Number(sanitizedWinningNumber),
      });
      if (res.raffle) {
        setLiveRaffle(res.raffle);
        if (res.raffle.status === "draft" || res.raffle.status === "active") {
          populateEditableFormFromRaffle(res.raffle);
        } else {
          resetFormForNewRaffle();
        }
      }
      setMsg("Número oficial lançado e sorteio finalizado.");
    } catch (e) {
      setMsg(formatFirebaseError(e));
    } finally {
      setDrawing(false);
    }
  }

  function applyDefaultsToForm() {
    setTicketPrice(String(clampRaffleTicketPrice(defaultTicketPrice)));
    setReleasedCount(String(clampRaffleReleasedCount(defaultReleasedCount)));
    setMaxPerPurchase(String(clampRaffleMaxPerPurchase(defaultMaxPerPurchase)));
    setPrizeCurrency(defaultPrizeCurrency);
    setPrizeAmount(defaultPrizeAmount);
  }

  function updateInstantPrizeTier(index: number, key: keyof InstantPrizeTierForm, value: string) {
    setInstantPrizeTiers((current) =>
      current.map((tier, currentIndex) => (currentIndex === index ? { ...tier, [key]: value } : tier)),
    );
  }

  function addInstantPrizeTier() {
    setInstantPrizeTiers((current) => [...current, { quantity: "1", amount: "1" }]);
  }

  function removeInstantPrizeTier(index: number) {
    setInstantPrizeTiers((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  const liveProgressPercent = liveRaffle
    ? getRaffleProgressPercent(liveRaffle.soldCount, liveRaffle.releasedCount)
    : 0;
  const liveScheduleMode = resolveScheduleMode(liveRaffle);
  const canCloseLiveRaffle = liveRaffle?.status === "active";
  const liveResultScheduledAtMs = liveRaffle?.resultScheduledAtMs ?? null;
  const canFinalizeLiveRaffle =
    liveRaffle?.status === "closed" &&
    liveResultScheduledAtMs != null &&
    liveResultScheduledAtMs <= nowMs;
  const selectedReleasedPreset = resolveReleasedPresetValue(releasedCount);
  const previewReleasedCount = clampRaffleReleasedCount(releasedCount);
  const liveReleasedCount = liveRaffle?.releasedCount ?? previewReleasedCount;
  const liveNumberDigits = getRaffleNumberDigits(liveReleasedCount);
  const configuredInstantPrizeQuantity = instantPrizeTiers.reduce(
    (sum, tier) => sum + Math.max(0, Math.floor(Number(tier.quantity) || 0)),
    0,
  );
  const liveInstantPrizeFoundCount = liveRaffle?.instantPrizeHits?.length ?? 0;
  const editableRaffles = raffleCatalog.filter((raffle) => raffle.status === "draft" || raffle.status === "active");
  const isCreatingNewRaffle = !raffleId.trim();

  return (
    <div className="space-y-6 pb-4">
      <div className="rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.18),transparent_35%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-5 shadow-[0_0_56px_-24px_rgba(139,92,246,0.35)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/70">Admin</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Sorteios</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300/70">
          Configure o sorteio com modo por datas ou até esgotar. Quando encerrar as compras, informe o número oficial
          para o sistema localizar automaticamente o ganhador.
        </p>
      </div>

      {msg ? (
        <AlertBanner
          tone={
            msg.includes("salva") ||
            msg.includes("processado") ||
            msg.includes("encerrado") ||
            msg.includes("lançado") ||
            msg.includes("finalizado")
              ? "success"
              : "error"
          }
        >
          {msg}
        </AlertBanner>
      ) : null}

      {!loading ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard
            title="Catálogo"
            value={String(raffleCatalog.length)}
            hint="Sorteios carregados na listagem"
            tone="violet"
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <AdminMetricCard
            title="Ao vivo"
            value={liveRaffle ? (liveRaffle.status === "active" ? "Ativo" : liveRaffle.status) : "Nenhum"}
            hint="Situação atual lida do servidor"
            tone={liveRaffle?.status === "active" ? "emerald" : "slate"}
            icon={<CalendarClock className="h-4 w-4" />}
          />
          <AdminMetricCard
            title="Progresso"
            value={liveRaffle ? `${liveProgressPercent}%` : "0%"}
            hint="Preenchimento do sorteio atual"
            tone="cyan"
            icon={<Shuffle className="h-4 w-4" />}
          />
          <AdminMetricCard
            title="Instantâneos"
            value={String(liveInstantPrizeFoundCount)}
            hint="Números premiados já localizados"
            tone="amber"
            icon={<Sparkles className="h-4 w-4" />}
          />
        </section>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-slate-950/80 p-5">
        <h2 className="text-lg font-black text-white">Sistema</h2>
        <p className="mt-1 text-sm text-white/55">Liga/desliga o sorteio no app e define defaults sugeridos no formulário.</p>
        <label className="mt-4 flex items-center gap-2 text-sm text-white/80">
          <input
            type="checkbox"
            checked={systemEnabled}
            onChange={(e) => setSystemEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-white/20"
          />
          Sorteios habilitados para usuários
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Default preço (TICKET / número)" value={defaultTicketPrice} onChange={setDefaultTicketPrice} />
          <Field label="Default faixa liberada" value={defaultReleasedCount} onChange={setDefaultReleasedCount} />
          <Field label="Default máx. por compra" value={defaultMaxPerPurchase} onChange={setDefaultMaxPerPurchase} />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-white/60">Default prêmio (moeda)</span>
            <select
              value={defaultPrizeCurrency}
              onChange={(e) => setDefaultPrizeCurrency(e.target.value as "coins" | "gems" | "rewardBalance")}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white"
            >
              <option value="coins">PR</option>
              <option value="gems">TICKET</option>
              <option value="rewardBalance">CASH</option>
            </select>
          </div>
          <Field label="Default valor do prêmio" value={defaultPrizeAmount} onChange={setDefaultPrizeAmount} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => applyDefaultsToForm()} disabled={saving}>
            Aplicar defaults no formulário
          </Button>
          <Button type="button" onClick={() => void saveSystemConfig()} disabled={saving}>
            <Save className="h-4 w-4" />
            Salvar sistema
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/80 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-white">Sorteio atual</h2>
            <p className="mt-1 text-sm text-white/55">
              ID: {liveRaffle?.id || raffleId || "(novo após salvar)"} · Status no servidor:{" "}
              <strong className="text-white">{liveRaffle ? liveRaffle.status : "—"}</strong>
            </p>
            {liveRaffle ? (
              <p className="mt-1 text-xs text-white/45">
                Modo: <strong className="text-white">{scheduleModeLabel(liveScheduleMode)}</strong>
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            {liveRaffle?.winningNumber != null ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
                Número sorteado:{" "}
                <strong>{formatRaffleScopedNumber(liveRaffle.winningNumber, liveRaffle.releasedCount)}</strong>
              </div>
            ) : null}
            {liveResultScheduledAtMs ? (
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
                Resultado Federal: <strong>{formatFederalResultWhen(liveResultScheduledAtMs)}</strong>
              </div>
            ) : null}
            {liveRaffle?.status === "paid" ? (
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
                Ganhador: <strong>{raffleWinnerLabel(liveRaffle)}</strong>
              </div>
            ) : null}
            {liveRaffle?.status === "no_winner" ? (
              <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/75">
                Sem ganhador para o número lançado.
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white/60">Editor do sorteio</p>
              <p className="mt-1 text-sm text-white/50">
                {isCreatingNewRaffle
                  ? "Criando um novo sorteio programado."
                  : `Editando: ${title || raffleId}`}
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => resetFormForNewRaffle()}>
              <PlusCircle className="h-4 w-4" />
              Novo sorteio
            </Button>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {editableRaffles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-4 text-sm text-white/50 xl:col-span-2">
                Nenhum sorteio em rascunho ou ativo para editar no momento.
              </div>
            ) : (
              editableRaffles.map((raffle) => (
                <div
                  key={`editor-${raffle.id}`}
                  className={`rounded-xl border px-4 py-4 transition ${
                    raffle.id === raffleId
                      ? "border-cyan-300/35 bg-cyan-500/10"
                      : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{raffle.title}</p>
                      <p className="mt-1 text-xs text-white/45">
                        {raffle.status === "active" ? "Ativo" : "Rascunho"} · Início {formatAdminDateTime(raffle.startsAtMs)}
                      </p>
                      <p className="mt-1 text-xs text-white/35">
                        {resolveScheduleMode(raffle) === "date_range"
                          ? `Fim ${formatAdminDateTime(raffle.endsAtMs)}`
                          : "Até esgotar os números"}
                      </p>
                    </div>
                    <Button type="button" variant="secondary" onClick={() => editRaffle(raffle)}>
                      <PencilLine className="h-4 w-4" />
                      Editar
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/55">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      {raffle.releasedCount.toLocaleString("pt-BR")} números
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      {raffle.soldCount.toLocaleString("pt-BR")} vendidos
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      {scheduleModeLabel(resolveScheduleMode(raffle))}
                    </span>
                    {raffle.resultScheduledAtMs ? (
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-cyan-100/80">
                        <CalendarClock className="mr-1 inline h-3.5 w-3.5" />
                        {formatFederalResultWhen(raffle.resultScheduledAtMs)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <Field label="Título" value={title} onChange={setTitle} />
          <Field label="Descrição (opcional)" value={description} onChange={setDescription} />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-white/60">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "draft" | "active")}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white"
            >
              <option value="draft">Rascunho</option>
              <option value="active">Ativo</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-white/60">Como o jogador obtém números</span>
            <select
              value={entryMode}
              onChange={(e) => {
                const m = e.target.value as RaffleEntryMode;
                setEntryMode(m);
                if (m === "rewarded_ad") setMaxPerPurchase("1");
              }}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white"
            >
              <option value="ticket">Paga com TICKET (preço por número)</option>
              <option value="rewarded_ad">Anúncio recompensado (1 anúncio = 1 número)</option>
            </select>
            <p className="text-[11px] text-white/45">
              {entryMode === "rewarded_ad"
                ? "Placement AdMob `raffle_number` + SSV. No app Android o bloco padrão é o rewarded de teste do Google até você definir NEXT_PUBLIC_ADMOB_ANDROID_REWARDED_RAFFLE_ID. Máx. por compra = 1."
                : "Modo clássico: desconto em TICKET (gems) por número."}
            </p>
          </div>
          {entryMode === "rewarded_ad" ? (
            <Field
              label="Intervalo mínimo entre anúncios (segundos)"
              value={rewardedAdCooldownSeconds}
              onChange={setRewardedAdCooldownSeconds}
              hint="0 = sem espera (só limite diário global). Máx. 86400 (24h)."
            />
          ) : null}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-white/60">Modo do sorteio</span>
            <select
              value={scheduleMode}
              onChange={(e) => setScheduleMode(e.target.value as RaffleScheduleMode)}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white"
            >
              <option value="date_range">Início e fim com datas</option>
              <option value="until_sold_out">Início e encerra ao acabar os números</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-white/60">Escala da numeração</span>
            <select
              value={selectedReleasedPreset}
              onChange={(e) => {
                const nextValue = e.target.value;
                if (nextValue === "custom") {
                  setReleasedCount(String(previewReleasedCount));
                  return;
                }
                setReleasedCount(nextValue);
              }}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white"
            >
              {RAFFLE_RELEASE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.value}>
                  {preset.label} ({preset.compactRangeLabel}) · {preset.value.toLocaleString("pt-BR")} números
                </option>
              ))}
              <option value="custom">Personalizado</option>
            </select>
          </div>
          {selectedReleasedPreset === "custom" ? (
            <Field label="Faixa liberada (1–1.000.000)" value={releasedCount} onChange={setReleasedCount} />
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
              Total liberado: <strong className="text-white">{previewReleasedCount.toLocaleString("pt-BR")}</strong>
            </div>
          )}
          <Field
            label="Preço em TICKET / número (só modo TICKET)"
            value={ticketPrice}
            onChange={setTicketPrice}
            disabled={entryMode === "rewarded_ad"}
          />
          <Field
            label="Máximo por compra (só modo TICKET; anúncio = 1)"
            value={maxPerPurchase}
            onChange={setMaxPerPurchase}
            disabled={entryMode === "rewarded_ad"}
          />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-white/60">Prêmio (moeda)</span>
            <select
              value={prizeCurrency}
              onChange={(e) => setPrizeCurrency(e.target.value as "coins" | "gems" | "rewardBalance")}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white"
            >
              <option value="coins">PR</option>
              <option value="gems">TICKET</option>
              <option value="rewardBalance">CASH</option>
            </select>
          </div>
          <Field label="Valor do prêmio" value={prizeAmount} onChange={setPrizeAmount} />
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4 sm:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-emerald-100/85">Números premiados automáticos</p>
                <p className="mt-1 text-sm text-white/60">
                  Configure faixas por <strong className="text-white">quantidade + valor em CASH</strong>. Os números
                  premiados saem aleatórios no momento da compra e o crédito entra automaticamente.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/75">
                Quantidade configurada: <strong className="text-white">{configuredInstantPrizeQuantity}</strong>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {instantPrizeTiers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-4 text-sm text-white/50">
                  Nenhuma faixa premiada configurada.
                </div>
              ) : (
                instantPrizeTiers.map((tier, index) => (
                  <div
                    key={`instant-tier-${index}`}
                    className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px]"
                  >
                    <Field
                      label={`Faixa ${index + 1} · Quantidade premiada`}
                      value={tier.quantity}
                      onChange={(value) => updateInstantPrizeTier(index, "quantity", value)}
                    />
                    <Field
                      label={`Faixa ${index + 1} · Valor em CASH`}
                      value={tier.amount}
                      onChange={(value) => updateInstantPrizeTier(index, "amount", value)}
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        onClick={() => removeInstantPrizeTier(index)}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => addInstantPrizeTier()}>
                Adicionar faixa premiada
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-xs font-semibold text-white/60">Foto do prêmio (opcional)</span>
            <div className="flex flex-wrap items-start gap-4">
              <div className="relative h-36 w-full max-w-xs overflow-hidden rounded-xl border border-white/15 bg-black/40">
                {prizeImagePreviewUrl ? (
                  <Image src={prizeImagePreviewUrl} alt="Prévia" fill className="object-cover" unoptimized />
                ) : clearPrizeImage && !pendingPrizeImage ? (
                  <div className="flex h-full items-center justify-center p-3 text-center text-xs text-white/45">
                    Imagem será removida ao salvar.
                  </div>
                ) : prizeImageUrl ? (
                  <Image src={prizeImageUrl} alt="Prêmio" fill className="object-cover" sizes="320px" />
                ) : (
                  <div className="flex h-full items-center justify-center p-3 text-center text-xs text-white/45">
                    Nenhuma imagem
                  </div>
                )}
              </div>
              <div className="flex min-w-[200px] flex-col gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="max-w-full text-xs text-white/80 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:text-white"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setPendingPrizeImage(f);
                      setClearPrizeImage(false);
                    }
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving || (!prizeImageUrl && !pendingPrizeImage && !clearPrizeImage)}
                  onClick={() => {
                    if (clearPrizeImage) {
                      setClearPrizeImage(false);
                      return;
                    }
                    if (pendingPrizeImage) {
                      setPendingPrizeImage(null);
                      return;
                    }
                    if (prizeImageUrl) setClearPrizeImage(true);
                  }}
                >
                  {clearPrizeImage ? "Desfazer remoção" : pendingPrizeImage ? "Descartar nova imagem" : "Remover imagem"}
                </Button>
                <p className="text-[11px] text-white/45">PNG, JPG ou WebP · máx. 5 MB · leitura pública no app</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-white/60">Início (local)</span>
            <input
              type="datetime-local"
              value={startsAtLocal}
              onChange={(e) => setStartsAtLocal(e.target.value)}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white"
            />
          </div>
          <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-100/80 lg:col-span-2">
            Faixa total do sorteio: <strong>{formatRaffleReleasedRangeLabel(previewReleasedCount)}</strong>
          </div>
          {scheduleMode === "date_range" ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-white/60">Encerramento (local)</span>
              <input
                type="datetime-local"
                value={endsAtLocal}
                onChange={(e) => setEndsAtLocal(e.target.value)}
                className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-white/55">
              A data final será registrada automaticamente quando todos os números forem vendidos ou se você encerrar o
              sorteio manualmente.
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void saveRaffle()} disabled={saving}>
            <Save className="h-4 w-4" />
            Salvar sorteio
          </Button>
        </div>

        {liveRaffle ? (
          <>
            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,280px)_1fr]">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-white/60">Número oficial / Federal</span>
                <input
                  value={winningNumberInput}
                  onChange={(e) =>
                    setWinningNumberInput(sanitizeWinningNumberInput(e.target.value, liveNumberDigits))
                  }
                  inputMode="numeric"
                  placeholder={`Ex.: ${"9".repeat(liveNumberDigits).padStart(liveNumberDigits, "0")}`}
                  className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white outline-none ring-amber-500/30 focus:ring-2"
                />
                <p className="text-[11px] text-white/45">
                  Informe o número exato para localizar o ganhador automaticamente dentro da faixa{" "}
                  {formatRaffleReleasedRangeLabel(liveRaffle.releasedCount)}.
                </p>
                {liveRaffle.status === "closed" && liveResultScheduledAtMs ? (
                  <p className="text-[11px] text-cyan-100/75">
                    Liberado para lançamento em {formatFederalResultWhen(liveResultScheduledAtMs)}.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void closeRaffle()}
                  disabled={saving || !canCloseLiveRaffle || closing}
                >
                  <StopCircle className="h-4 w-4" />
                  {closing ? "Encerrando..." : "Encerrar compras"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void drawRaffle()}
                  disabled={
                    saving ||
                    !canFinalizeLiveRaffle ||
                    drawing ||
                    !sanitizeWinningNumberInput(winningNumberInput, liveNumberDigits)
                  }
                >
                  <Shuffle className="h-4 w-4" />
                  {drawing ? "Finalizando..." : "Lançar número oficial"}
                </Button>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Progresso</p>
                  <p className="mt-1 text-lg font-black text-white">{liveProgressPercent}% concluído</p>
                </div>
                <div className="text-sm text-white/60">
                  <strong className="text-white">{liveRaffle.soldCount}</strong> / {liveRaffle.releasedCount} números
                </div>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 transition-[width]"
                  style={{ width: `${liveProgressPercent}%` }}
                />
              </div>
              <div className="mt-4 grid gap-2 text-sm text-white/65 sm:grid-cols-2">
                <p>
                  Vendidos: <strong className="text-white">{liveRaffle.soldCount}</strong>
                </p>
                <p>
                  Arrecadação (TICKET): <strong className="text-white">{liveRaffle.soldTicketsRevenue}</strong>
                </p>
                <p>
                  Próximo número:{" "}
                  <strong className="text-white">
                    {formatRaffleScopedNumber(liveRaffle.nextSequentialNumber, liveRaffle.releasedCount)}
                  </strong>
                </p>
                <p>
                  Liberados: <strong className="text-white">{liveRaffle.releasedCount}</strong>
                </p>
                <p>
                  Faixa:{" "}
                  <strong className="text-white">{formatRaffleReleasedRangeLabel(liveRaffle.releasedCount)}</strong>
                </p>
                <p>
                  Início:{" "}
                  <strong className="text-white">
                    {liveRaffle.startsAtMs ? toDatetimeLocalValue(liveRaffle.startsAtMs).replace("T", " ") : "—"}
                  </strong>
                </p>
                <p>
                  Fim:{" "}
                  <strong className="text-white">
                    {liveRaffle.endsAtMs ? toDatetimeLocalValue(liveRaffle.endsAtMs).replace("T", " ") : "Até esgotar"}
                  </strong>
                </p>
              </div>
            </div>

            {liveRaffle.instantPrizeTiers && liveRaffle.instantPrizeTiers.length > 0 ? (
              <div className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-500/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-emerald-100/85">Números premiados automáticos</p>
                    <p className="mt-1 text-sm text-white/60">
                      Encontrados até agora: <strong className="text-white">{liveInstantPrizeFoundCount}</strong>
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {liveRaffle.instantPrizeTiers.map((tier, index) => (
                    <div
                      key={`live-instant-tier-${index}`}
                      className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70"
                    >
                      <p className="font-semibold text-white">
                        Faixa {index + 1}: {tier.quantity} número(s) premiado(s) de {tier.amount} CASH
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        Encontrados: {tier.awardedCount ?? 0} / {tier.quantity}
                      </p>
                    </div>
                  ))}
                </div>

                {liveRaffle.instantPrizeHits && liveRaffle.instantPrizeHits.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {liveRaffle.instantPrizeHits
                      .slice()
                      .reverse()
                      .slice(0, 12)
                      .map((hit, index) => (
                        <div
                          key={`live-hit-${hit.purchaseId}-${hit.number}-${index}`}
                          className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75"
                        >
                          <strong className="text-emerald-200">
                            {formatRaffleScopedNumber(hit.number, liveRaffle.releasedCount)}
                          </strong>{" "}
                          premiado com {hit.amount} CASH · {hit.winnerUsername ? `@${hit.winnerUsername}` : hit.winnerName || "Jogador"}
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-white/60">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white outline-none ring-cyan-500/30 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {hint ? <p className="text-[11px] text-white/40">{hint}</p> : null}
    </div>
  );
}
