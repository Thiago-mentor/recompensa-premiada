"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { fetchEconomyConfigDocument } from "@/services/systemConfigs/economyDocumentCache";
import { ROUTES } from "@/lib/constants/routes";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { Button } from "@/components/ui/Button";
import { PrizeCard } from "@/components/cards/PrizeCard";
import { craftBoostFromFragmentsCallable, activateStoredBoostCallable } from "@/services/boost/boostService";
import { BOOST_SYSTEM_DEFAULT_ENABLED, isBoostSystemEnabled } from "@/lib/features/boost";
import type { SystemEconomyConfig } from "@/types/systemConfig";
import { Clock3, Flame, Sparkles } from "lucide-react";

const DEFAULT_STORE_CONFIG = {
  boostRewardPercent: 25,
  fragmentsPerBoostCraft: 10,
  boostMinutesPerCraft: 15,
  boostActivationMinutes: 15,
};

function timestampToMs(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  if ("toMillis" in value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return null;
    }
  }
  if ("toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return null;
    }
  }
  return null;
}

function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function LojaPage() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const [config, setConfig] = useState(DEFAULT_STORE_CONFIG);
  const [boostSystemEnabled, setBoostSystemEnabled] = useState(BOOST_SYSTEM_DEFAULT_ENABLED);
  const [boostSystemResolved, setBoostSystemResolved] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [craftLoading, setCraftLoading] = useState(false);
  const [activateLoading, setActivateLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const dataRaw = await fetchEconomyConfigDocument();
        if (cancelled) return;
        if (!dataRaw) {
          setBoostSystemEnabled(BOOST_SYSTEM_DEFAULT_ENABLED);
          setConfig(DEFAULT_STORE_CONFIG);
          setBoostSystemResolved(true);
          return;
        }
        const data = dataRaw as Partial<SystemEconomyConfig>;
        setBoostSystemEnabled(isBoostSystemEnabled(data));
        setConfig({
          boostRewardPercent:
            typeof data.boostRewardPercent === "number"
              ? Math.max(0, Math.floor(data.boostRewardPercent))
              : DEFAULT_STORE_CONFIG.boostRewardPercent,
          fragmentsPerBoostCraft:
            typeof data.fragmentsPerBoostCraft === "number"
              ? Math.max(1, Math.floor(data.fragmentsPerBoostCraft))
              : DEFAULT_STORE_CONFIG.fragmentsPerBoostCraft,
          boostMinutesPerCraft:
            typeof data.boostMinutesPerCraft === "number"
              ? Math.max(1, Math.floor(data.boostMinutesPerCraft))
              : DEFAULT_STORE_CONFIG.boostMinutesPerCraft,
          boostActivationMinutes:
            typeof data.boostActivationMinutes === "number"
              ? Math.max(1, Math.floor(data.boostActivationMinutes))
              : DEFAULT_STORE_CONFIG.boostActivationMinutes,
        });
        setBoostSystemResolved(true);
      } catch {
        if (!cancelled) {
          setBoostSystemEnabled(BOOST_SYSTEM_DEFAULT_ENABLED);
          setConfig(DEFAULT_STORE_CONFIG);
          setBoostSystemResolved(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!boostSystemResolved || boostSystemEnabled) return;
    router.replace(ROUTES.home);
  }, [boostSystemEnabled, boostSystemResolved, router]);

  const activeBoostUntilMs = timestampToMs(profile?.activeBoostUntil);
  const boostRemainingMs =
    activeBoostUntilMs != null ? Math.max(0, activeBoostUntilMs - nowMs) : 0;
  const boostActive = boostRemainingMs > 0;

  useEffect(() => {
    if (!boostActive) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [boostActive]);

  const fragments = profile?.fragments ?? 0;
  const storedBoostMinutes = profile?.storedBoostMinutes ?? 0;
  const craftDisabled = !user || craftLoading || fragments < config.fragmentsPerBoostCraft;
  const activateDisabled = !user || activateLoading || storedBoostMinutes <= 0;
  const nextActivationMinutes = Math.min(storedBoostMinutes, config.boostActivationMinutes || 0);

  const activeStateLine = useMemo(() => {
    if (boostActive) {
      return `Boost ativo agora: +${config.boostRewardPercent}% PR por mais ${formatDurationMs(boostRemainingMs)}.`;
    }
    if (storedBoostMinutes > 0) {
      return `Você tem ${storedBoostMinutes} min prontos para ativar.`;
    }
    return "Sem boost ativo no momento.";
  }, [boostActive, boostRemainingMs, config.boostRewardPercent, storedBoostMinutes]);

  async function onCraftBoost() {
    setMsg(null);
    setCraftLoading(true);
    const result = await craftBoostFromFragmentsCallable();
    setCraftLoading(false);
    if (!result.ok) {
      setMsg({ tone: "error", text: result.error });
      return;
    }
    await refreshProfile();
    setMsg({
      tone: "success",
      text: `-${result.fragmentsCost} fragmentos · +${result.boostMinutesAdded} min de boost armazenado.`,
    });
  }

  async function onActivateBoost() {
    setMsg(null);
    setActivateLoading(true);
    const result = await activateStoredBoostCallable();
    setActivateLoading(false);
    if (!result.ok) {
      setMsg({ tone: "error", text: result.error });
      return;
    }
    await refreshProfile();
    setNowMs(Date.now());
    setMsg({
      tone: "success",
      text: `Boost ativado por ${result.activatedMinutes} min · ganhos de PR com +${result.boostRewardPercent}%.`,
    });
  }

  if (!boostSystemResolved) {
    return (
      <div className="space-y-5 pb-4">
        <section className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_35%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-5 shadow-[0_0_56px_-24px_rgba(217,70,239,0.25)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-fuchsia-200/75">
            Loja premium
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Carregando loja</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            Verificando se o sistema de boost e a loja estao disponiveis para sua conta.
          </p>
        </section>
      </div>
    );
  }

  if (!boostSystemEnabled) {
    return (
      <div className="space-y-5 pb-4">
        <section className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_35%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-5 shadow-[0_0_56px_-24px_rgba(217,70,239,0.25)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-fuchsia-200/75">
            Loja premium
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Redirecionando</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            A loja esta desativada no momento, entao voce sera levado de volta para a home.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <section className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_35%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-5 shadow-[0_0_56px_-24px_rgba(217,70,239,0.25)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-fuchsia-200/75">
          Loja premium
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Boost Lab</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          Converta fragmentos em minutos armazenados e ative um boost de PR com efeito real nos
          ganhos do app.
        </p>
      </section>

      {msg ? <AlertBanner tone={msg.tone}>{msg.text}</AlertBanner> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <StoreStat
          label="Fragmentos"
          value={String(fragments)}
          hint="Matéria-prima dos baús"
          icon={<Sparkles className="h-4 w-4 text-fuchsia-200" />}
        />
        <StoreStat
          label="Boost armazenado"
          value={`${storedBoostMinutes} min`}
          hint="Pronto para ativar"
          icon={<Clock3 className="h-4 w-4 text-cyan-200" />}
        />
        <StoreStat
          label="Boost ativo"
          value={boostActive ? formatDurationMs(boostRemainingMs) : "offline"}
          hint={boostActive ? `+${config.boostRewardPercent}% PR` : "Sem efeito rodando"}
          icon={<Flame className="h-4 w-4 text-orange-200" />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.6rem] border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-950/20 via-slate-950/90 to-slate-950 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200/65">
                Craft
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">
                Fragmentos viram energia
              </h2>
              <p className="mt-2 text-sm text-white/55">
                Cada craft consome {config.fragmentsPerBoostCraft} fragmentos e adiciona{" "}
                {config.boostMinutesPerCraft} min ao seu estoque de boost.
              </p>
            </div>
            <Sparkles className="h-5 w-5 text-fuchsia-200/75" />
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-semibold text-white">Troca rápida</p>
            <p className="mt-1 text-sm text-white/55">
              {fragments} fragmentos disponíveis agora.
            </p>
            <Button className="mt-4 w-full" disabled={craftDisabled} onClick={() => void onCraftBoost()}>
              {craftLoading
                ? "Fabricando..."
                : `Gastar ${config.fragmentsPerBoostCraft} fragmentos por +${config.boostMinutesPerCraft} min`}
            </Button>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-amber-400/20 bg-gradient-to-br from-amber-950/20 via-slate-950/90 to-slate-950 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/65">
                Ativação
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">
                PR com multiplicador real
              </h2>
              <p className="mt-2 text-sm text-white/55">{activeStateLine}</p>
            </div>
            <Flame className="h-5 w-5 text-amber-200/75" />
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-semibold text-white">
              {boostActive ? "Estender boost" : "Ligar boost"}
            </p>
            <p className="mt-1 text-sm text-white/55">
              Cada uso ativa até {config.boostActivationMinutes} min e aplica +{config.boostRewardPercent}% de
              PR nos ganhos elegíveis.
            </p>
            <Button
              variant="secondary"
              className="mt-4 w-full border-amber-400/25"
              disabled={activateDisabled}
              onClick={() => void onActivateBoost()}
            >
              {activateLoading
                ? "Ativando..."
                : boostActive
                  ? `Somar ${nextActivationMinutes || config.boostActivationMinutes} min ao boost`
                  : `Ativar ${nextActivationMinutes || config.boostActivationMinutes} min`}
            </Button>
          </div>
        </div>
      </section>

      <PrizeCard
        title="Skins, jackpots e usos futuros"
        subtitle="A estrutura agora já sustenta boosts ativos, craft com fragmentos e futuras campanhas especiais."
      />

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
        O boost já passa a afetar ganhos de PR do app no backend. Se quiser, o próximo passo é
        deixar isso explícito na home e no resultado das partidas com um selo de multiplicador ativo.
      </div>
    </div>
  );
}

function StoreStat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-white/50">{hint}</p>
    </div>
  );
}
