"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { doc, getDoc, setDoc } from "firebase/firestore";
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
import type { RaffleView } from "@/types/raffle";
import type { RaffleSystemConfig } from "@/types/systemConfig";
import {
  RAFFLE_DEFAULT_DRAW_TIME_ZONE,
  RAFFLE_DEFAULT_MAX_PER_PURCHASE,
  RAFFLE_DEFAULT_RELEASED_COUNT,
  RAFFLE_DEFAULT_TICKET_PRICE,
  clampRaffleMaxPerPurchase,
  clampRaffleReleasedCount,
  clampRaffleTicketPrice,
  formatRaffleNumber,
} from "@/utils/raffle";
import { Loader2, Save, Shuffle, StopCircle } from "lucide-react";

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

function fromDatetimeLocal(value: string): number | null {
  if (!value.trim()) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

export default function AdminSorteiosPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
  const [maxPerPurchase, setMaxPerPurchase] = useState(String(RAFFLE_DEFAULT_MAX_PER_PURCHASE));
  const [prizeCurrency, setPrizeCurrency] = useState<"coins" | "gems" | "rewardBalance">("coins");
  const [prizeAmount, setPrizeAmount] = useState("1000");
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [endsAtLocal, setEndsAtLocal] = useState("");

  const [prizeImageUrl, setPrizeImageUrl] = useState<string | null>(null);
  const [pendingPrizeImage, setPendingPrizeImage] = useState<File | null>(null);
  const [prizeImagePreviewUrl, setPrizeImagePreviewUrl] = useState<string | null>(null);
  const [clearPrizeImage, setClearPrizeImage] = useState(false);

  const [liveRaffle, setLiveRaffle] = useState<RaffleView | null>(null);
  const [closing, setClosing] = useState(false);
  const [drawing, setDrawing] = useState(false);

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
          setRaffleId(r.id);
          setTitle(r.title);
          setDescription(r.description ?? "");
          setStatus(r.status === "draft" || r.status === "active" ? r.status : "draft");
          setReleasedCount(String(r.releasedCount));
          setTicketPrice(String(r.ticketPrice));
          setMaxPerPurchase(String(r.maxPerPurchase));
          setPrizeCurrency(r.prizeCurrency);
          setPrizeAmount(String(r.prizeAmount));
          setStartsAtLocal(toDatetimeLocalValue(r.startsAtMs));
          setEndsAtLocal(toDatetimeLocalValue(r.endsAtMs));
          setPrizeImageUrl(r.prizeImageUrl ?? null);
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
    if (!pendingPrizeImage) {
      setPrizeImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingPrizeImage);
    setPrizeImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingPrizeImage]);

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
      const endsAtMs = fromDatetimeLocal(endsAtLocal);

      const buildPayload = (extra: Record<string, unknown> = {}) => ({
        raffleId: raffleId.trim() || undefined,
        title: title.trim(),
        description: description.trim() || null,
        status,
        releasedCount: clampRaffleReleasedCount(releasedCount),
        ticketPrice: clampRaffleTicketPrice(ticketPrice),
        maxPerPurchase: clampRaffleMaxPerPurchase(maxPerPurchase),
        prizeCurrency,
        prizeAmount: Math.max(0, Math.floor(Number(prizeAmount) || 0)),
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
        setRaffleId(res.raffle.id);
        setLiveRaffle(res.raffle);
        setPrizeImageUrl(res.raffle.prizeImageUrl ?? null);
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
    if (!raffleId.trim()) return;
    setMsg(null);
    setClosing(true);
    try {
      const res = await adminCloseRaffleCallable(raffleId.trim());
      if (res.raffle) setLiveRaffle(res.raffle);
      setMsg("Sorteio encerrado para compras.");
    } catch (e) {
      setMsg(formatFirebaseError(e));
    } finally {
      setClosing(false);
    }
  }

  async function drawRaffle() {
    if (!raffleId.trim()) return;
    setMsg(null);
    setDrawing(true);
    try {
      const res = await adminDrawRaffleCallable(raffleId.trim());
      if (res.raffle) setLiveRaffle(res.raffle);
      setMsg("Sorteio processado (fechamento + sorteio).");
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

  return (
    <div className="space-y-6 pb-4">
      <div className="rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.18),transparent_35%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-5 shadow-[0_0_56px_-24px_rgba(139,92,246,0.35)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/70">Admin</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Sorteios</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300/70">
          Configure a faixa liberada, preço em TICKET e prêmio. O fechamento automático roda a cada minuto; você também
          pode encerrar e sortear manualmente.
        </p>
      </div>

      {msg ? (
        <AlertBanner tone={msg.includes("salva") || msg.includes("processado") || msg.includes("encerrado") ? "success" : "error"}>
          {msg}
        </AlertBanner>
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
              ID: {raffleId || "(novo após salvar)"} · Status no servidor:{" "}
              <strong className="text-white">{liveRaffle ? liveRaffle.status : "—"}</strong>
            </p>
          </div>
          {liveRaffle?.winningNumber != null ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
              Número sorteado: <strong>{formatRaffleNumber(liveRaffle.winningNumber)}</strong>
            </div>
          ) : null}
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
          <Field label="Faixa liberada (1–1.000.000)" value={releasedCount} onChange={setReleasedCount} />
          <Field label="Preço em TICKET / número" value={ticketPrice} onChange={setTicketPrice} />
          <Field label="Máximo por compra" value={maxPerPurchase} onChange={setMaxPerPurchase} />
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
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-white/60">Encerramento (local)</span>
            <input
              type="datetime-local"
              value={endsAtLocal}
              onChange={(e) => setEndsAtLocal(e.target.value)}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void saveRaffle()} disabled={saving}>
            <Save className="h-4 w-4" />
            Salvar sorteio
          </Button>
          <Button type="button" variant="secondary" onClick={() => void closeRaffle()} disabled={saving || !raffleId || closing}>
            <StopCircle className="h-4 w-4" />
            {closing ? "Encerrando..." : "Encerrar compras"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void drawRaffle()} disabled={saving || !raffleId || drawing}>
            <Shuffle className="h-4 w-4" />
            {drawing ? "Sorteando..." : "Fechar + sortear agora"}
          </Button>
        </div>

        {liveRaffle ? (
          <div className="mt-5 grid gap-2 rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-white/65 sm:grid-cols-2">
            <p>
              Vendidos: <strong className="text-white">{liveRaffle.soldCount}</strong>
            </p>
            <p>
              Arrecadação (TICKET): <strong className="text-white">{liveRaffle.soldTicketsRevenue}</strong>
            </p>
            <p>
              Próximo número: <strong className="text-white">{formatRaffleNumber(liveRaffle.nextSequentialNumber)}</strong>
            </p>
            <p>
              Liberados: <strong className="text-white">{liveRaffle.releasedCount}</strong>
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-white/60">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white outline-none ring-cyan-500/30 focus:ring-2"
      />
    </div>
  );
}
