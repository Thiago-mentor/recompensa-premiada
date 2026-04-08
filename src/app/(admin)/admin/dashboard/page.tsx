"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  collectionGroup,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS, SUBCOLLECTIONS } from "@/lib/constants/collections";
import { ROUTES } from "@/lib/constants/routes";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { cn } from "@/lib/utils/cn";
import type { ChestRarity, ChestSource, ChestStatus } from "@/types/chest";
import type { ChestSystemConfig } from "@/types/systemConfig";
import {
  CHEST_RARITY_LABEL,
  CHEST_SOURCE_LABEL,
  CHEST_STATUS_LABEL,
  formatChestPlacement,
} from "@/utils/chest";
import {
  ArrowRight,
  Clock3,
  Gift,
  Inbox,
  Lock,
  PackageOpen,
  Settings,
  Shield,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

const STATUS_ORDER: ChestStatus[] = ["ready", "unlocking", "locked", "queued"];
const SOURCE_ORDER: ChestSource[] = [
  "multiplayer_win",
  "mission_claim",
  "daily_streak",
  "ranking_reward",
  "event",
];

type RecentChestRow = {
  id: string;
  userId: string;
  rarity: ChestRarity;
  source: ChestSource;
  status: ChestStatus;
  slotIndex: number | null;
  queuePosition: number | null;
  updatedAt: unknown;
};

type RecentFraudRow = {
  id: string;
  tipo: string;
  uid: string;
  timestamp: unknown;
};

type DashboardData = {
  users: number | null;
  frauds: number | null;
  chestProfiles: number | null;
  chestItems: number | null;
  pendingClaims: number | null;
  statusCounts: Record<ChestStatus, number | null>;
  sourceCounts: Record<ChestSource, number | null>;
  chestConfig: ChestSystemConfig | null;
  recentChests: RecentChestRow[];
  recentFrauds: RecentFraudRow[];
  userNames: Record<string, string>;
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const dashboardData = await fetchDashboardData();
        if (!cancelled) {
          setData(dashboardData);
          setErr(null);
        }
      } catch (error) {
        if (!cancelled) {
          setErr(error instanceof Error ? error.message : "Sem permissão ou Firebase offline");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sourceMax = useMemo(() => {
    const values = SOURCE_ORDER.map((source) => data?.sourceCounts[source] ?? 0);
    return Math.max(1, ...values);
  }, [data?.sourceCounts]);
  const chestConfig = data?.chestConfig ?? null;

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[1.9rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-5 shadow-[0_0_56px_-24px_rgba(34,211,238,0.22)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-200/75">
              Controle premium
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
              Cockpit operacional do app
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Um panorama rápido de usuários, risco, saques e da saúde do novo sistema de baús, com
              leitura de configuração e atividade recente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={ROUTES.admin.configuracoes}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-100 transition hover:bg-amber-500/15"
            >
              <Settings className="mr-2 h-4 w-4" />
              Configurar baús
            </Link>
            <Link
              href={ROUTES.admin.recompensas}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/10 px-4 py-2.5 text-sm font-bold text-violet-100 transition hover:bg-violet-500/15"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Revisar saques
            </Link>
          </div>
        </div>
      </header>

      {err ? (
        <AlertBanner tone="error">
          {err} — confira se o usuário está com custom claim <code>admin: true</code> e se o
          Firestore está acessível.
        </AlertBanner>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Usuários"
          value={data?.users}
          hint="Base total com acesso ao app"
          icon={Users}
          tone="cyan"
        />
        <MetricCard
          title="Logs de fraude"
          value={data?.frauds}
          hint="Sinais capturados para análise"
          icon={Shield}
          tone="rose"
        />
        <MetricCard
          title="Hubs com baús"
          value={data?.chestProfiles}
          hint="Usuários com meta criada em user_chests"
          icon={Gift}
          tone="amber"
        />
        <MetricCard
          title="Baús em circulação"
          value={data?.chestItems}
          hint="Slots + fila somados"
          icon={Sparkles}
          tone="violet"
        />
        <MetricCard
          title="Prontos para coleta"
          value={data?.statusCounts.ready}
          hint="Potencial de ganho imediato no app"
          icon={PackageOpen}
          tone="emerald"
        />
        <MetricCard
          title="Saques pendentes"
          value={data?.pendingClaims}
          hint="Pedidos aguardando análise manual"
          icon={Wallet}
          tone="slate"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-[1.7rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.75)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                Sistema de baús
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">
                Configuração atualmente lida pelo backend
              </h2>
              <p className="mt-1 text-sm text-white/55">
                O dashboard lê o documento <code>system_configs/chest_system</code> e resume o que
                está ativo agora.
              </p>
            </div>
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                chestConfig?.enabled !== false
                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                  : "border-rose-400/20 bg-rose-500/10 text-rose-100",
              )}
            >
              {chestConfig?.enabled !== false ? "ativo" : "desativado"}
            </span>
          </div>

          {chestConfig ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <InfoChip
                  label="Capacidade"
                  value={`${chestConfig.slotCount} slots + ${chestConfig.queueCapacity} fila`}
                />
                <InfoChip
                  label="Ads por baú"
                  value={`${chestConfig.maxAdsPerChest} máx.`}
                />
                <InfoChip
                  label="Speedup"
                  value={`${Math.round(chestConfig.adSpeedupPercent * 100)}% por anúncio`}
                />
                <InfoChip
                  label="Limite diário"
                  value={`${chestConfig.dailyChestAdsLimit} anúncios`}
                />
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                    Pity
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <MiniStat label="Raro" value={`até ${chestConfig.pityRules.rareAt}`} />
                    <MiniStat label="Épico" value={`até ${chestConfig.pityRules.epicAt}`} />
                    <MiniStat
                      label="Lendário"
                      value={`até ${chestConfig.pityRules.legendaryAt}`}
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                    Tempo por raridade
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(["comum", "raro", "epico", "lendario"] as ChestRarity[]).map((rarity) => (
                      <MiniStat
                        key={rarity}
                        label={CHEST_RARITY_LABEL[rarity]}
                        value={formatSeconds(chestConfig.unlockDurationsByRarity[rarity])}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
              Sem documento explícito de <code>chest_system</code>. O backend está caindo no preset
              interno.
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={ROUTES.admin.configuracoes}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/15"
            >
              Abrir painel de baús
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="rounded-[1.7rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.75)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
            Estado operacional
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-white">
            Slots, abertura e fila
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {STATUS_ORDER.map((status) => (
              <StatusCard
                key={status}
                status={status}
                value={data?.statusCounts[status] ?? null}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[1.7rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.75)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
            Origem dos baús
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-white">
            Distribuição por fonte
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Ajuda a enxergar se o ganho imediato está vindo mais de vitória PvP, missão, streak ou
            evento.
          </p>
          <div className="mt-4 space-y-3">
            {SOURCE_ORDER.map((source) => {
              const count = data?.sourceCounts[source] ?? null;
              const width =
                count == null ? 0 : `${Math.max(8, Math.round((count / sourceMax) * 100))}%`;
              return (
                <div key={source} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white">{CHEST_SOURCE_LABEL[source]}</span>
                    <span className="text-white/55">{count ?? "—"}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-violet-500 to-amber-400"
                      style={{ width }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.7rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.75)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                Atividade recente
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">
                Fluxo vivo do hub
              </h2>
            </div>
            <Gift className="h-5 w-5 text-amber-200/80" />
          </div>
          <div className="mt-4 space-y-3">
            {data?.recentChests.length ? (
              data.recentChests.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {data.userNames[item.userId] ?? "Jogador"} · {CHEST_RARITY_LABEL[item.rarity]}
                      </p>
                      <p className="mt-1 text-xs text-white/55">
                        {CHEST_SOURCE_LABEL[item.source]} ·{" "}
                        {formatChestPlacement({
                          status: item.status,
                          slotIndex: item.slotIndex,
                          queuePosition: item.queuePosition,
                        })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={statusPillClass(item.status)}>
                        {CHEST_STATUS_LABEL[item.status]}
                      </span>
                      <span className="text-[11px] text-white/45">
                        {formatRelativeTime(item.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
                Sem leituras recentes de baú ou sem índice disponível para ordenar a subcoleção.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[1.7rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.75)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
              Risco e moderação
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-white">
              Alertas recentes
            </h2>
          </div>
          <Shield className="h-5 w-5 text-rose-200/75" />
        </div>
        <div className="mt-4 space-y-3">
          {data?.recentFrauds.length ? (
            data.recentFrauds.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{row.tipo || "Evento"}</p>
                  <p className="mt-1 truncate text-xs text-white/50">{row.uid}</p>
                </div>
                <span className="text-[11px] text-white/45">{formatRelativeTime(row.timestamp)}</span>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
              Nenhum log recente ou leitura bloqueada.
            </div>
          )}
          <div className="flex justify-end">
            <Link
              href={ROUTES.admin.fraudes}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/80 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              Abrir central de fraudes
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

async function fetchDashboardData(): Promise<DashboardData> {
  const db = getFirebaseFirestore();
  const chestItemsRef = collectionGroup(db, SUBCOLLECTIONS.chestItems);

  const [
    users,
    frauds,
    chestProfiles,
    chestItems,
    pendingClaims,
    ready,
    unlocking,
    locked,
    queued,
  ] = await Promise.all([
    safeCount(collection(db, COLLECTIONS.users)),
    safeCount(collection(db, COLLECTIONS.fraudLogs)),
    safeCount(collection(db, COLLECTIONS.userChests)),
    safeCount(chestItemsRef),
    safeCount(query(collection(db, COLLECTIONS.rewardClaims), where("status", "==", "pendente"))),
    safeCount(query(chestItemsRef, where("status", "==", "ready"))),
    safeCount(query(chestItemsRef, where("status", "==", "unlocking"))),
    safeCount(query(chestItemsRef, where("status", "==", "locked"))),
    safeCount(query(chestItemsRef, where("status", "==", "queued"))),
  ]);

  const sourceCounts = Object.fromEntries(
    await Promise.all(
      SOURCE_ORDER.map(async (source) => [
        source,
        await safeCount(query(chestItemsRef, where("source", "==", source))),
      ]),
    ),
  ) as Record<ChestSource, number | null>;

  let chestConfig: ChestSystemConfig | null = null;
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.systemConfigs, "chest_system"));
    chestConfig = snap.exists() ? (snap.data() as ChestSystemConfig) : null;
  } catch {
    chestConfig = null;
  }

  let recentChests: RecentChestRow[] = [];
  try {
    const snap = await getDocs(query(chestItemsRef, orderBy("updatedAt", "desc"), limit(8)));
    recentChests = snap.docs.map((docSnap) => {
      const data = docSnap.data() as Partial<RecentChestRow>;
      return {
        id: docSnap.id,
        userId: String(data.userId ?? ""),
        rarity: (data.rarity ?? "comum") as ChestRarity,
        source: (data.source ?? "event") as ChestSource,
        status: (data.status ?? "locked") as ChestStatus,
        slotIndex: typeof data.slotIndex === "number" ? data.slotIndex : null,
        queuePosition: typeof data.queuePosition === "number" ? data.queuePosition : null,
        updatedAt: data.updatedAt ?? null,
      };
    });
  } catch {
    recentChests = [];
  }

  let recentFrauds: RecentFraudRow[] = [];
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.fraudLogs), orderBy("timestamp", "desc"), limit(8)),
    );
    recentFrauds = snap.docs.map((docSnap) => {
      const data = docSnap.data() as Partial<RecentFraudRow>;
      return {
        id: docSnap.id,
        tipo: String(data.tipo ?? ""),
        uid: String(data.uid ?? ""),
        timestamp: data.timestamp ?? null,
      };
    });
  } catch {
    recentFrauds = [];
  }

  const userIds = [...new Set(recentChests.map((row) => row.userId).filter(Boolean))];
  const userNames = Object.fromEntries(
    await Promise.all(
      userIds.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, COLLECTIONS.users, uid));
          const raw = snap.exists() ? (snap.data() as { nome?: string; username?: string }) : {};
          const label =
            raw.nome?.trim() || raw.username?.trim() || `${uid.slice(0, 6)}...${uid.slice(-4)}`;
          return [uid, label] as const;
        } catch {
          return [uid, `${uid.slice(0, 6)}...${uid.slice(-4)}`] as const;
        }
      }),
    ),
  );

  return {
    users,
    frauds,
    chestProfiles,
    chestItems,
    pendingClaims,
    statusCounts: {
      ready,
      unlocking,
      locked,
      queued,
    },
    sourceCounts,
    chestConfig,
    recentChests,
    recentFrauds,
    userNames,
  };
}

async function safeCount(input: Parameters<typeof getCountFromServer>[0]): Promise<number | null> {
  try {
    const result = await getCountFromServer(input);
    return result.data().count;
  } catch {
    return null;
  }
}

function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number | null | undefined;
  hint: string;
  icon: typeof Users;
  tone: "cyan" | "rose" | "amber" | "violet" | "emerald" | "slate";
}) {
  const toneClass =
    tone === "cyan"
      ? "border-cyan-400/20 bg-cyan-500/[0.08]"
      : tone === "rose"
        ? "border-rose-400/20 bg-rose-500/[0.08]"
        : tone === "amber"
          ? "border-amber-400/20 bg-amber-500/[0.08]"
          : tone === "violet"
            ? "border-violet-400/20 bg-violet-500/[0.08]"
            : tone === "emerald"
              ? "border-emerald-400/20 bg-emerald-500/[0.08]"
              : "border-white/10 bg-white/[0.03]";

  return (
    <div className={cn("rounded-[1.45rem] border p-4 shadow-[0_18px_42px_-24px_rgba(0,0,0,0.85)]", toneClass)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{title}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-white">{value ?? "—"}</p>
        </div>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-white/85">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/55">{hint}</p>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function StatusCard({
  status,
  value,
}: {
  status: ChestStatus;
  value: number | null;
}) {
  const icon =
    status === "ready"
      ? PackageOpen
      : status === "unlocking"
        ? Clock3
        : status === "locked"
          ? Lock
          : Inbox;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
            {CHEST_STATUS_LABEL[status]}
          </p>
          <p className="mt-2 text-2xl font-black tracking-tight text-white">{value ?? "—"}</p>
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/80">
          {icon === PackageOpen ? (
            <PackageOpen className="h-4.5 w-4.5" />
          ) : icon === Clock3 ? (
            <Clock3 className="h-4.5 w-4.5" />
          ) : icon === Lock ? (
            <Lock className="h-4.5 w-4.5" />
          ) : (
            <Inbox className="h-4.5 w-4.5" />
          )}
        </span>
      </div>
      <p className="mt-2 text-xs text-white/45">
        {status === "ready"
          ? "Recompensas já liberadas para coleta."
          : status === "unlocking"
            ? "Slots em contagem regressiva."
            : status === "locked"
              ? "Baús ocupando slot sem timer iniciado."
              : "Itens estacionados esperando vaga."}
      </p>
    </div>
  );
}

function formatSeconds(totalSeconds: number | undefined): string {
  if (!totalSeconds || totalSeconds <= 0) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${totalSeconds % 60}s`;
}

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

function formatRelativeTime(value: unknown): string {
  const ms = timestampToMs(value);
  if (ms == null) return "sem data";
  const diff = Math.max(0, Date.now() - ms);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min atrás`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h atrás`;
  const days = Math.floor(hours / 24);
  return `${days} d atrás`;
}

function statusPillClass(status: ChestStatus) {
  return cn(
    "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
    status === "ready"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
      : status === "unlocking"
        ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-100"
        : status === "locked"
          ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
          : "border-violet-400/20 bg-violet-500/10 text-violet-100",
  );
}
