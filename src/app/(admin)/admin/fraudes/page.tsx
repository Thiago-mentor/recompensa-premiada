"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { ROUTES } from "@/lib/constants/routes";
import { useAdminSaveFeedback } from "@/components/admin/AdminSaveFeedback";
import { Button } from "@/components/ui/Button";
import { callFunction } from "@/services/callables/client";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { cn } from "@/lib/utils/cn";
import type { ReferralRecord } from "@/types/referral";
import type { FraudRiskLevel, UserProfile } from "@/types/user";
import {
  Ban,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  Sparkles,
  TriangleAlert,
  UserRoundSearch,
  Users,
} from "lucide-react";

type ActiveTab = "visao" | "regras" | "fila" | "usuarios";

type AntiFraudRules = {
  blockSelfReferral: boolean;
  flagBurstSignups: boolean;
  burstSignupThreshold: number;
  requireManualReviewForSuspected: boolean;
};

type FraudStats = {
  totalLogs: number;
  highSeverityLogs: number;
  highRiskUsers: number;
  bannedUsers: number;
  manualReviewQueue: number;
};

type FraudLogRow = {
  id: string;
  uid: string;
  tipo: string;
  severidade: string;
  detalhes: Record<string, unknown>;
  origem: string;
  timestamp: unknown;
  userName: string | null;
  username: string | null;
};

const DEFAULT_RULES: AntiFraudRules = {
  blockSelfReferral: true,
  flagBurstSignups: true,
  burstSignupThreshold: 5,
  requireManualReviewForSuspected: false,
};

const EMPTY_STATS: FraudStats = {
  totalLogs: 0,
  highSeverityLogs: 0,
  highRiskUsers: 0,
  bannedUsers: 0,
  manualReviewQueue: 0,
};

export default function AdminFraudesPage() {
  const { notify } = useAdminSaveFeedback();
  const [activeTab, setActiveTab] = useState<ActiveTab>("visao");
  const [rules, setRules] = useState<AntiFraudRules>(DEFAULT_RULES);
  const [stats, setStats] = useState<FraudStats>(EMPTY_STATS);
  const [logs, setLogs] = useState<FraudLogRow[]>([]);
  const [reviewRows, setReviewRows] = useState<ReferralRecord[]>([]);
  const [lookupMode, setLookupMode] = useState<"username" | "uid">("username");
  const [lookupValue, setLookupValue] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedUserRisk, setSelectedUserRisk] = useState<FraudRiskLevel>("baixo");
  const [selectedUserBanned, setSelectedUserBanned] = useState(false);
  const [moderationNote, setModerationNote] = useState("");
  const [, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [savingUserState, setSavingUserState] = useState(false);
  const [busyReferralAction, setBusyReferralAction] = useState<string | null>(null);

  const showMessage = useCallback((tone: "info" | "success" | "error", text: string) => {
    notify(tone, text);
  }, [notify]);

  const ensureFreshAdminSession = useCallback(async () => {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) {
      throw new Error("Sessão inválida. Entre novamente para continuar.");
    }
    await currentUser.getIdToken(true);
  }, []);

  const hydrateSelectedUser = useCallback((user: UserProfile | null) => {
    setSelectedUser(user);
    setSelectedUserRisk(user?.riscoFraude ?? "baixo");
    setSelectedUserBanned(user?.banido === true);
  }, []);

  const loadCenter = useCallback(
    async (options?: { suppressMessage?: boolean }) => {
      const suppressMessage = options?.suppressMessage === true;
      setRefreshing(true);
      try {
        await ensureFreshAdminSession();
        const db = getFirebaseFirestore();
        const [
          configSnap,
          totalLogsSnap,
          highSeverityLogsSnap,
          highRiskUsersSnap,
          bannedUsersSnap,
          manualReviewQueueSnap,
          logsSnap,
          reviewSnap,
        ] = await Promise.all([
          getDoc(doc(db, COLLECTIONS.systemConfigs, "referral_system")),
          getCountFromServer(collection(db, COLLECTIONS.fraudLogs)),
          getCountFromServer(
            query(collection(db, COLLECTIONS.fraudLogs), where("severidade", "==", "alta")),
          ),
          getCountFromServer(query(collection(db, COLLECTIONS.users), where("riscoFraude", "==", "alto"))),
          getCountFromServer(query(collection(db, COLLECTIONS.users), where("banido", "==", true))),
          getCountFromServer(
            query(collection(db, COLLECTIONS.referrals), where("fraudFlags.manualReviewRequired", "==", true)),
          ),
          getDocs(query(collection(db, COLLECTIONS.fraudLogs), orderBy("timestamp", "desc"), limit(12))),
          getDocs(
            query(
              collection(db, COLLECTIONS.referrals),
              where("fraudFlags.manualReviewRequired", "==", true),
              limit(8),
            ),
          ),
        ]);

        setRules(normalizeRules(configSnap.data()?.antiFraudRules));
        setStats({
          totalLogs: totalLogsSnap.data().count,
          highSeverityLogs: highSeverityLogsSnap.data().count,
          highRiskUsers: highRiskUsersSnap.data().count,
          bannedUsers: bannedUsersSnap.data().count,
          manualReviewQueue: manualReviewQueueSnap.data().count,
        });

        const baseLogs = logsSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          userName: null,
          username: null,
          ...(docSnap.data() as Omit<FraudLogRow, "id" | "userName" | "username">),
        }));

        const uniqueUids = Array.from(
          new Set(baseLogs.map((log) => String(log.uid || "")).filter(Boolean)),
        );
        const userEntries = await Promise.all(
          uniqueUids.map(async (uid) => {
            const userSnap = await getDoc(doc(db, COLLECTIONS.users, uid));
            if (!userSnap.exists()) return [uid, null] as const;
            const userData = userSnap.data() as Partial<UserProfile>;
            return [
              uid,
              {
                nome: userData.nome ?? null,
                username: userData.username ?? null,
              },
            ] as const;
          }),
        );
        const userMap = new Map(userEntries);

        setLogs(
          baseLogs.map((log) => {
            const user = userMap.get(log.uid);
            return {
              ...log,
              userName: user?.nome ?? null,
              username: user?.username ?? null,
            };
          }),
        );

        setReviewRows(
          reviewSnap.docs
            .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<ReferralRecord, "id">) }))
            .sort((a, b) => timestampToMs(b.updatedAt) - timestampToMs(a.updatedAt)),
        );
      } catch (error) {
        if (!suppressMessage) {
          showMessage("error", formatFirebaseError(error));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [ensureFreshAdminSession, showMessage],
  );

  useEffect(() => {
    void loadCenter();
  }, [loadCenter]);

  const suspiciousBreakdown = useMemo(() => {
    const client = logs.filter((log) => log.origem === "client").length;
    const admin = logs.filter((log) => log.origem === "admin").length;
    const server = logs.filter((log) => log.origem !== "client" && log.origem !== "admin").length;
    return { client, admin, server };
  }, [logs]);

  async function saveRules() {
    setSavingRules(true);
    try {
      await ensureFreshAdminSession();
      const db = getFirebaseFirestore();
      await setDoc(
        doc(db, COLLECTIONS.systemConfigs, "referral_system"),
        {
          id: "referral_system",
          antiFraudRules: {
            blockSelfReferral: rules.blockSelfReferral,
            flagBurstSignups: rules.flagBurstSignups,
            burstSignupThreshold: Math.max(1, Math.floor(Number(rules.burstSignupThreshold) || 1)),
            requireManualReviewForSuspected: rules.requireManualReviewForSuspected,
          },
          updatedAt: new Date(),
        },
        { merge: true },
      );
      showMessage("success", "Regras automáticas anti-fraude salvas.");
      await loadCenter({ suppressMessage: true });
    } catch (error) {
      showMessage("error", formatFirebaseError(error));
    } finally {
      setSavingRules(false);
    }
  }

  async function searchUser() {
    try {
      await ensureFreshAdminSession();
      const rawValue = lookupValue.trim();
      if (!rawValue) {
        throw new Error("Informe o username ou o UID.");
      }
      const db = getFirebaseFirestore();
      let userId = "";
      let userData: Omit<UserProfile, "uid"> | null = null;

      if (lookupMode === "uid") {
        const snap = await getDoc(doc(db, COLLECTIONS.users, rawValue));
        if (!snap.exists()) throw new Error("Usuário não encontrado.");
        userId = snap.id;
        userData = snap.data() as Omit<UserProfile, "uid">;
      } else {
        const normalized = rawValue.toLowerCase().replace(/^@/, "");
        const usersSnap = await getDocs(
          query(collection(db, COLLECTIONS.users), where("username", "==", normalized), limit(1)),
        );
        if (usersSnap.empty) throw new Error("Username não encontrado.");
        userId = usersSnap.docs[0].id;
        userData = usersSnap.docs[0].data() as Omit<UserProfile, "uid">;
      }

      const user = { uid: userId, ...(userData as Omit<UserProfile, "uid">) } as UserProfile;
      hydrateSelectedUser(user);
      setActiveTab("usuarios");
      showMessage("success", `Conta ${user.username ? `@${user.username}` : user.uid} carregada.`);
    } catch (error) {
      hydrateSelectedUser(null);
      showMessage("error", formatFirebaseError(error));
    }
  }

  async function applyUserModeration() {
    if (!lookupValue.trim()) {
      showMessage("error", "Busque um usuário antes de aplicar a moderação.");
      return;
    }
    setSavingUserState(true);
    try {
      await ensureFreshAdminSession();
      await callFunction<
        {
          lookup: "username" | "uid";
          value: string;
          risk: FraudRiskLevel;
          banned: boolean;
          note: string;
        },
        { ok: boolean; targetUid: string; risk: FraudRiskLevel; banned: boolean }
      >("adminUpdateFraudUserState", {
        lookup: lookupMode,
        value: lookupValue.trim(),
        risk: selectedUserRisk,
        banned: selectedUserBanned,
        note: moderationNote.trim(),
      });
      setModerationNote("");
      await Promise.all([searchUser(), loadCenter({ suppressMessage: true })]);
      showMessage("success", "Estado anti-fraude do usuário atualizado.");
    } catch (error) {
      showMessage("error", formatFirebaseError(error));
    } finally {
      setSavingUserState(false);
    }
  }

  async function reviewReferral(referralId: string, action: "block" | "mark_valid") {
    setBusyReferralAction(`${referralId}:${action}`);
    try {
      await ensureFreshAdminSession();
      await callFunction("adminReviewReferral", { referralId, action });
      await loadCenter({ suppressMessage: true });
      showMessage("success", "Fila anti-fraude atualizada.");
    } catch (error) {
      showMessage("error", formatFirebaseError(error));
    } finally {
      setBusyReferralAction(null);
    }
  }

  async function reprocessReferral(referralId: string) {
    setBusyReferralAction(`${referralId}:reprocess`);
    try {
      await ensureFreshAdminSession();
      await callFunction("adminReprocessReferral", { referralId });
      await loadCenter({ suppressMessage: true });
      showMessage("success", "Indicação reprocessada.");
    } catch (error) {
      showMessage("error", formatFirebaseError(error));
    } finally {
      setBusyReferralAction(null);
    }
  }

  return (
    <div className="space-y-6 pb-6">
      <section className="overflow-hidden rounded-[1.9rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(248,113,113,0.14),transparent_32%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-5 shadow-[0_0_64px_-28px_rgba(56,189,248,0.28)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-200/75">
              Central inteligente
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Anti-fraude</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              Configure as regras automáticas das indicações, monitore os eventos do{" "}
              <code>fraud_logs</code>, trate suspeitas em revisão manual e aplique risco ou suspensão
              de conta sem sair do admin.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => void loadCenter({ suppressMessage: true })}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              {refreshing ? "Atualizando..." : "Atualizar central"}
            </Button>
            <Link href={ROUTES.admin.indicacoes}>
              <Button variant="ghost">Abrir indicações</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          title="Logs anti-fraude"
          value={String(stats.totalLogs)}
          hint="Eventos registrados no fraud_logs"
          tone="cyan"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <MetricCard
          title="Alta severidade"
          value={String(stats.highSeverityLogs)}
          hint="Alertas que exigem atenção rápida"
          tone="rose"
          icon={<Siren className="h-4 w-4" />}
        />
        <MetricCard
          title="Risco alto"
          value={String(stats.highRiskUsers)}
          hint="Contas marcadas com risco elevado"
          tone="amber"
          icon={<TriangleAlert className="h-4 w-4" />}
        />
        <MetricCard
          title="Suspensos"
          value={String(stats.bannedUsers)}
          hint="Contas com bloqueio manual ativo"
          tone="violet"
          icon={<Ban className="h-4 w-4" />}
        />
        <MetricCard
          title="Fila manual"
          value={String(stats.manualReviewQueue)}
          hint="Indicações suspeitas aguardando revisão"
          tone="emerald"
          icon={<Users className="h-4 w-4" />}
        />
      </section>

      <div className="flex flex-wrap gap-2 rounded-[1.4rem] border border-white/10 bg-slate-900/80 p-2">
        <TabButton
          active={activeTab === "visao"}
          label="Visão geral"
          onClick={() => setActiveTab("visao")}
        />
        <TabButton
          active={activeTab === "regras"}
          label="Regras automáticas"
          onClick={() => setActiveTab("regras")}
        />
        <TabButton
          active={activeTab === "fila"}
          label="Fila manual"
          onClick={() => setActiveTab("fila")}
        />
        <TabButton
          active={activeTab === "usuarios"}
          label="Usuários"
          onClick={() => setActiveTab("usuarios")}
        />
      </div>

      {activeTab === "visao" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="space-y-4 rounded-[1.7rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.75)]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                Regras em vigor
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">
                Motor automático de proteção
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoPill
                label="Auto-indicação"
                value={rules.blockSelfReferral ? "Bloqueada" : "Permitida"}
                highlight={rules.blockSelfReferral}
              />
              <InfoPill
                label="Burst de cadastros"
                value={rules.flagBurstSignups ? "Monitorado" : "Ignorado"}
                highlight={rules.flagBurstSignups}
              />
              <InfoPill
                label="Threshold"
                value={`${rules.burstSignupThreshold} convites válidos/dia`}
                highlight
              />
              <InfoPill
                label="Revisão manual"
                value={rules.requireManualReviewForSuspected ? "Obrigatória" : "Opcional"}
                highlight={rules.requireManualReviewForSuspected}
              />
            </div>

            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
              <p className="text-sm font-semibold text-cyan-100">Origem dos eventos recentes</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <CompactStat label="Client" value={String(suspiciousBreakdown.client)} />
                <CompactStat label="Servidor" value={String(suspiciousBreakdown.server)} />
                <CompactStat label="Admin" value={String(suspiciousBreakdown.admin)} />
              </div>
            </div>

            <Link href={ROUTES.admin.indicacoes} className="inline-flex">
              <Button variant="ghost">
                <Eye className="h-4 w-4" />
                Abrir fluxo completo de indicações
              </Button>
            </Link>
          </section>

          <section className="space-y-4 rounded-[1.7rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.75)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                  Feed recente
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-white">
                  Últimos sinais capturados
                </h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                {logs.length} itens
              </span>
            </div>

            {logs.length === 0 ? (
              <EmptyState text="Nenhum log recente disponível no momento." />
            ) : (
              <div className="space-y-3">
                {logs.slice(0, 6).map((log) => (
                  <FraudLogCard key={log.id} log={log} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {activeTab === "regras" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className="space-y-4 rounded-[1.7rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.75)]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                Configuração
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">
                Regras automáticas de indicação
              </h2>
              <p className="mt-1 text-sm text-white/55">
                Essas regras alimentam o backend de referral e definem quando um convite vira alerta ou
                segue para fila manual.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ToggleCard
                title="Bloquear auto-indicação"
                description="Impede que o mesmo usuário use o próprio código de convite."
                checked={rules.blockSelfReferral}
                onChange={(checked) =>
                  setRules((current) => ({ ...current, blockSelfReferral: checked }))
                }
              />
              <ToggleCard
                title="Sinalizar burst de cadastros"
                description="Marca como suspeito quando o indicador dispara muitos convites válidos no mesmo dia."
                checked={rules.flagBurstSignups}
                onChange={(checked) =>
                  setRules((current) => ({ ...current, flagBurstSignups: checked }))
                }
              />
              <ToggleCard
                title="Exigir revisão manual"
                description="Envia indicações suspeitas para fila antes da recompensa."
                checked={rules.requireManualReviewForSuspected}
                onChange={(checked) =>
                  setRules((current) => ({
                    ...current,
                    requireManualReviewForSuspected: checked,
                  }))
                }
              />
              <ConfigField
                label="Limite de burst por dia"
                value={String(rules.burstSignupThreshold)}
                helper="A partir desse número de convites válidos no dia, o sistema acende o alerta."
                onChange={(value) =>
                  setRules((current) => ({
                    ...current,
                    burstSignupThreshold: Math.max(1, Math.floor(Number(value) || 1)),
                  }))
                }
              />
            </div>

            <div className="flex justify-end">
              <Button variant="arena" onClick={saveRules} disabled={savingRules}>
                <Sparkles className="h-4 w-4" />
                {savingRules ? "Salvando regras..." : "Salvar regras anti-fraude"}
              </Button>
            </div>
          </section>

          <section className="space-y-4 rounded-[1.7rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.75)]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                Política sugerida
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">
                Setup moderno recomendado
              </h2>
            </div>

            <RecommendationCard
              title="Proteção mínima"
              description="Manter auto-indicação bloqueada evita fraude básica sem gerar atrito."
              tone="cyan"
            />
            <RecommendationCard
              title="Burst ligado"
              description="O burst detecta crescimento anormal de convites válidos no mesmo dia."
              tone="amber"
            />
            <RecommendationCard
              title="Revisão manual ativa"
              description="Ideal quando a campanha estiver pagando valores relevantes ou tiver tráfego agressivo."
              tone="rose"
            />

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">Presets rápidos</p>
              <p className="mt-2 text-slate-400">
                Se quiser uma base conservadora, use:
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-300">
                <li>Auto-indicação: ligada</li>
                <li>Burst: ligado</li>
                <li>Threshold: 3 a 5 por dia</li>
                <li>Revisão manual: ligada para campanhas fortes</li>
              </ul>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "fila" ? (
        <section className="space-y-4 rounded-[1.7rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.75)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                Revisão manual
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">
                Indicações suspeitas na fila
              </h2>
              <p className="mt-1 text-sm text-white/55">
                Aqui ficam os convites marcados com <code>manualReviewRequired</code>.
              </p>
            </div>
            <Link href={ROUTES.admin.indicacoes}>
              <Button variant="ghost">Abrir módulo completo</Button>
            </Link>
          </div>

          {reviewRows.length === 0 ? (
            <EmptyState text="Nenhuma indicação suspeita aguardando ação manual." />
          ) : (
            <div className="space-y-3">
              {reviewRows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">
                        {row.invitedUserName || row.invitedUserId} <span className="text-white/40">←</span>{" "}
                        {row.inviterName || row.inviterUserId}
                      </p>
                      <p className="text-xs text-white/45">
                        Status: {row.status} · campanha: {row.campaignName || "padrão"} · criada em{" "}
                        {formatDateTime(row.createdAt)}
                      </p>
                      <p className="text-xs text-amber-100/80">
                        Revisão manual: {row.fraudFlags.manualReviewRequired ? "sim" : "não"} · suspeita:{" "}
                        {row.fraudFlags.suspectedFraud ? "sim" : "não"}
                      </p>
                      {row.notes ? (
                        <p className="text-xs text-slate-400">Notas: {row.notes}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => void reviewReferral(row.id, "mark_valid")}
                        disabled={busyReferralAction != null}
                      >
                        {busyReferralAction === `${row.id}:mark_valid` ? "Aplicando..." : "Marcar válida"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void reprocessReferral(row.id)}
                        disabled={busyReferralAction != null}
                      >
                        {busyReferralAction === `${row.id}:reprocess` ? "Reprocessando..." : "Reprocessar"}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => void reviewReferral(row.id, "block")}
                        disabled={busyReferralAction != null}
                      >
                        {busyReferralAction === `${row.id}:block` ? "Bloqueando..." : "Bloquear"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "usuarios" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="space-y-4 rounded-[1.7rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.75)]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                Moderação
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">
                Localizar conta e ajustar risco
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
              <div>
                <label className="text-xs text-slate-400">Buscar por</label>
                <select
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
                  value={lookupMode}
                  onChange={(event) => setLookupMode(event.target.value as "username" | "uid")}
                >
                  <option value="username">Username</option>
                  <option value="uid">UID</option>
                </select>
              </div>
              <ConfigField
                label="Valor"
                value={lookupValue}
                helper={lookupMode === "username" ? "Ex.: thiago ou @thiago" : "UID completo da conta"}
                onChange={setLookupValue}
              />
              <div className="flex items-end">
                <Button variant="secondary" onClick={searchUser} className="w-full sm:w-auto">
                  <Search className="h-4 w-4" />
                  Buscar
                </Button>
              </div>
            </div>

            {selectedUser ? (
              <div className="space-y-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {selectedUser.nome || selectedUser.username || selectedUser.uid}
                    </p>
                    <p className="mt-1 text-xs text-cyan-100/75">
                      @{selectedUser.username} · {selectedUser.email || "sem e-mail"} · UID{" "}
                      <code>{selectedUser.uid}</code>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={riskTone(selectedUserRisk)}>
                      Risco {selectedUserRisk}
                    </StatusBadge>
                    <StatusBadge tone={selectedUserBanned ? "rose" : "emerald"}>
                      {selectedUserBanned ? "Suspenso" : "Ativo"}
                    </StatusBadge>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <CompactStat label="Partidas" value={String(selectedUser.totalPartidas ?? 0)} />
                  <CompactStat label="Ads" value={String(selectedUser.totalAdsAssistidos ?? 0)} />
                  <CompactStat label="Referral" value={String(selectedUser.referralStatus ?? "—")} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-400">Nível de risco</label>
                    <select
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
                      value={selectedUserRisk}
                      onChange={(event) => setSelectedUserRisk(event.target.value as FraudRiskLevel)}
                    >
                      <option value="baixo">Baixo</option>
                      <option value="medio">Médio</option>
                      <option value="alto">Alto</option>
                    </select>
                  </div>
                  <ToggleCard
                    title="Suspender conta"
                    description="Bloqueia o acesso do usuário às actions críticas do app."
                    checked={selectedUserBanned}
                    onChange={setSelectedUserBanned}
                  />
                </div>

                <ConfigField
                  label="Nota da moderação"
                  value={moderationNote}
                  helper="Essa observação entra no fraud_logs junto com a ação do admin."
                  onChange={setModerationNote}
                />

                <div className="flex justify-end">
                  <Button variant="danger" onClick={applyUserModeration} disabled={savingUserState}>
                    <UserRoundSearch className="h-4 w-4" />
                    {savingUserState ? "Aplicando..." : "Salvar estado anti-fraude"}
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState text="Busque um usuário por username ou UID para editar risco e suspensão." />
            )}
          </section>

          <section className="space-y-4 rounded-[1.7rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.75)]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                Logs recentes
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">
                Ações e eventos ligados ao usuário
              </h2>
            </div>

            {logs.length === 0 ? (
              <EmptyState text="Sem eventos para exibir." />
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <FraudLogCard key={log.id} log={log} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function normalizeRules(raw: unknown): AntiFraudRules {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    blockSelfReferral: data.blockSelfReferral !== false,
    flagBurstSignups: data.flagBurstSignups !== false,
    burstSignupThreshold: Math.max(1, Math.floor(Number(data.burstSignupThreshold) || 5)),
    requireManualReviewForSuspected: data.requireManualReviewForSuspected === true,
  };
}

function timestampToMs(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  if (value instanceof Date) return value.getTime();
  return 0;
}

function formatDateTime(value: unknown): string {
  const ms = timestampToMs(value);
  if (!ms) return "agora";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(ms);
}

function riskTone(risk: FraudRiskLevel): "emerald" | "amber" | "rose" {
  return risk === "alto" ? "rose" : risk === "medio" ? "amber" : "emerald";
}

function severityTone(level: string): "emerald" | "amber" | "rose" | "cyan" {
  if (level === "alta") return "rose";
  if (level === "media") return "amber";
  if (level === "baixa") return "cyan";
  return "emerald";
}

function humanizeFraudType(raw: string): string {
  const known: Record<string, string> = {
    referral_abuso: "Abuso de indicação",
    claim_rapido: "Claim rápido",
    ads_irregular: "Ads irregulares",
    spam_partidas: "Spam de partidas",
    conta_suspeita: "Conta suspeita",
    loop_ganho: "Loop de ganho",
    progresso_invalido: "Progresso inválido",
    cooldown_violation: "Violação de cooldown",
    match_rate_limit: "Burst de partidas",
    admin_update_user_fraud_state: "Ajuste manual do admin",
  };
  return known[raw] ?? raw.replaceAll("_", " ");
}

function stringifyDetails(details: Record<string, unknown>) {
  try {
    return JSON.stringify(details);
  } catch {
    return "{}";
  }
}

function MetricCard({
  title,
  value,
  hint,
  icon,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone: "cyan" | "rose" | "amber" | "violet" | "emerald";
}) {
  const tones = {
    cyan: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
    rose: "border-rose-400/20 bg-rose-500/10 text-rose-100",
    amber: "border-amber-400/20 bg-amber-500/10 text-amber-100",
    violet: "border-violet-400/20 bg-violet-500/10 text-violet-100",
    emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
  };

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-4 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.7)]">
      <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]", tones[tone])}>
        {icon}
        {title}
      </span>
      <p className="mt-3 text-2xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-white/45">{hint}</p>
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[1rem] px-4 py-2.5 text-sm font-semibold transition",
        active
          ? "bg-cyan-500/12 text-white shadow-[0_0_24px_-14px_rgba(34,211,238,0.45)]"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-white",
      )}
    >
      {label}
    </button>
  );
}

function ToggleCard({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-cyan-400"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
      </div>
    </label>
  );
}

function ConfigField({
  label,
  value,
  helper,
  onChange,
}: {
  label: string;
  value: string;
  helper?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input
        className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {helper ? <p className="mt-1 text-[11px] text-slate-500">{helper}</p> : null}
    </div>
  );
}

function RecommendationCard({
  title,
  description,
  tone,
}: {
  title: string;
  description: string;
  tone: "cyan" | "amber" | "rose";
}) {
  const tones = {
    cyan: "border-cyan-400/20 bg-cyan-500/10",
    amber: "border-amber-400/20 bg-amber-500/10",
    rose: "border-rose-400/20 bg-rose-500/10",
  };

  return (
    <div className={cn("rounded-2xl border p-4", tones[tone])}>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-300/75">{description}</p>
    </div>
  );
}

function InfoPill({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        highlight ? "border-cyan-400/20 bg-cyan-500/10" : "border-white/10 bg-black/20",
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-white/45">
      {text}
    </div>
  );
}

function FraudLogCard({ log }: { log: FraudLogRow }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">{humanizeFraudType(log.tipo)}</p>
            <StatusBadge tone={severityTone(log.severidade)}>
              {log.severidade}
            </StatusBadge>
          </div>
          <p className="text-xs text-white/45">
            {log.userName || "Usuário"} {log.username ? `· @${log.username}` : ""} · UID{" "}
            <code>{log.uid}</code>
          </p>
          <p className="text-xs text-slate-400">
            Origem: {log.origem} · {formatDateTime(log.timestamp)}
          </p>
        </div>
        <pre className="max-w-full overflow-x-auto rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-300">
          {stringifyDetails(log.detalhes)}
        </pre>
      </div>
    </div>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: "emerald" | "amber" | "rose" | "cyan";
  children: ReactNode;
}) {
  const tones = {
    emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-400/20 bg-amber-500/10 text-amber-100",
    rose: "border-rose-400/20 bg-rose-500/10 text-rose-100",
    cyan: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
  };

  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
