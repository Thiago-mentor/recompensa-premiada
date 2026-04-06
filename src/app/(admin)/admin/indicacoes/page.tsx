"use client";

import { useEffect, useMemo, useState } from "react";
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
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { Button } from "@/components/ui/Button";
import { callFunction } from "@/services/callables/client";
import { formatFirebaseError } from "@/lib/firebase/errors";
import type {
  ReferralCampaign,
  ReferralRecord,
  ReferralStatus,
  ReferralSystemConfig,
} from "@/types/referral";

const EMPTY_CONFIG: ReferralSystemConfig = {
  id: "referral_system",
  enabled: true,
  codeRequired: false,
  defaultInviterRewardCoins: 100,
  defaultInvitedRewardCoins: 50,
  invitedRewardEnabled: true,
  limitValidPerDay: 20,
  limitRewardedPerUser: 500,
  qualificationRules: {
    requireEmailVerified: false,
    requireProfileCompleted: true,
    minAdsWatched: 0,
    minMatchesPlayed: 1,
    minMissionRewardsClaimed: 0,
  },
  antiFraudRules: {
    blockSelfReferral: true,
    flagBurstSignups: true,
    burstSignupThreshold: 5,
    requireManualReviewForSuspected: false,
  },
  rankingRules: {
    daily: [],
    weekly: [],
    monthly: [],
    all: [],
  },
  activeCampaignId: null,
  campaignText: "",
};

const EMPTY_CAMPAIGN = {
  id: "",
  name: "",
  description: "",
  regulationText: "",
  startAt: "",
  endAt: "",
  isActive: true,
  inviterRewardCoins: "100",
  invitedRewardCoins: "50",
  invitedRewardEnabled: true,
  requireEmailVerified: false,
  requireProfileCompleted: true,
  minAdsWatched: "0",
  minMatchesPlayed: "1",
  minMissionRewardsClaimed: "0",
};

function prizeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? [], null, 2);
  } catch {
    return "[]";
  }
}

function toDateInput(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 16);
    } catch {
      return "";
    }
  }
  return "";
}

export default function AdminIndicacoesPage() {
  const [config, setConfig] = useState<ReferralSystemConfig>(EMPTY_CONFIG);
  const [dailyPrizeJson, setDailyPrizeJson] = useState(prizeJson(EMPTY_CONFIG.rankingRules.daily));
  const [weeklyPrizeJson, setWeeklyPrizeJson] = useState(prizeJson(EMPTY_CONFIG.rankingRules.weekly));
  const [monthlyPrizeJson, setMonthlyPrizeJson] = useState(prizeJson(EMPTY_CONFIG.rankingRules.monthly));
  const [campaigns, setCampaigns] = useState<ReferralCampaign[]>([]);
  const [campaignForm, setCampaignForm] = useState(EMPTY_CAMPAIGN);
  const [rows, setRows] = useState<ReferralRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | ReferralStatus>("all");
  const [msg, setMsg] = useState<string | null>(null);
  const [closingPeriod, setClosingPeriod] = useState<"" | "daily" | "weekly" | "monthly">("");
  const [stats, setStats] = useState<{
    total: number;
    pending: number;
    valid: number;
    rewarded: number;
    blocked: number;
  }>({
    total: 0,
    pending: 0,
    valid: 0,
    rewarded: 0,
    blocked: 0,
  });

  async function loadAll() {
    const db = getFirebaseFirestore();
    const [cfgSnap, campaignSnap, referralSnap, total, pending, valid, rewarded, blocked] = await Promise.all([
      getDoc(doc(db, COLLECTIONS.systemConfigs, "referral_system")),
      getDocs(query(collection(db, COLLECTIONS.referralCampaigns), orderBy("startAt", "desc"), limit(20))),
      getDocs(
        statusFilter === "all"
          ? query(collection(db, COLLECTIONS.referrals), orderBy("createdAt", "desc"), limit(100))
          : query(
              collection(db, COLLECTIONS.referrals),
              where("status", "==", statusFilter),
              orderBy("createdAt", "desc"),
              limit(100),
            ),
      ),
      getCountFromServer(collection(db, COLLECTIONS.referrals)),
      getCountFromServer(query(collection(db, COLLECTIONS.referrals), where("status", "==", "pending"))),
      getCountFromServer(query(collection(db, COLLECTIONS.referrals), where("status", "==", "valid"))),
      getCountFromServer(query(collection(db, COLLECTIONS.referrals), where("status", "==", "rewarded"))),
      getCountFromServer(query(collection(db, COLLECTIONS.referrals), where("status", "==", "blocked"))),
    ]);

    if (cfgSnap.exists()) {
      const nextConfig = { ...EMPTY_CONFIG, ...(cfgSnap.data() as ReferralSystemConfig) };
      setConfig(nextConfig);
      setDailyPrizeJson(prizeJson(nextConfig.rankingRules.daily));
      setWeeklyPrizeJson(prizeJson(nextConfig.rankingRules.weekly));
      setMonthlyPrizeJson(prizeJson(nextConfig.rankingRules.monthly));
    }
    setCampaigns(campaignSnap.docs.map((item) => ({ id: item.id, ...item.data() }) as ReferralCampaign));
    setRows(referralSnap.docs.map((item) => ({ id: item.id, ...item.data() }) as ReferralRecord));
    setStats({
      total: total.data().count,
      pending: pending.data().count,
      valid: valid.data().count,
      rewarded: rewarded.data().count,
      blocked: blocked.data().count,
    });
  }

  useEffect(() => {
    loadAll().catch(() => undefined);
  }, [statusFilter]);

  const activeCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === config.activeCampaignId) ?? null,
    [campaigns, config.activeCampaignId],
  );

  async function saveConfig() {
    setMsg(null);
    try {
      let parsedDaily: unknown;
      let parsedWeekly: unknown;
      let parsedMonthly: unknown;
      try {
        parsedDaily = JSON.parse(dailyPrizeJson);
        parsedWeekly = JSON.parse(weeklyPrizeJson);
        parsedMonthly = JSON.parse(monthlyPrizeJson);
      } catch {
        setMsg("JSON inválido nos prêmios do ranking. Revise os blocos diário/semanal/mensal.");
        return;
      }
      const nextConfig: ReferralSystemConfig = {
        ...config,
        rankingRules: {
          ...config.rankingRules,
          daily: parsedDaily as ReferralSystemConfig["rankingRules"]["daily"],
          weekly: parsedWeekly as ReferralSystemConfig["rankingRules"]["weekly"],
          monthly: parsedMonthly as ReferralSystemConfig["rankingRules"]["monthly"],
          all: config.rankingRules.all,
        },
      };
      const db = getFirebaseFirestore();
      await setDoc(
        doc(db, COLLECTIONS.systemConfigs, "referral_system"),
        {
          ...nextConfig,
          updatedAt: new Date(),
        },
        { merge: true },
      );
      setMsg("Configurações de indicação salvas.");
      await loadAll();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Erro ao salvar configurações.");
    }
  }

  async function saveCampaign() {
    setMsg(null);
    try {
      const db = getFirebaseFirestore();
      const targetId = campaignForm.id.trim() || `campaign_${Date.now()}`;
      await setDoc(
        doc(db, COLLECTIONS.referralCampaigns, targetId),
        {
          id: targetId,
          name: campaignForm.name.trim(),
          description: campaignForm.description.trim(),
          regulationText: campaignForm.regulationText.trim(),
          startAt: campaignForm.startAt ? new Date(campaignForm.startAt) : null,
          endAt: campaignForm.endAt ? new Date(campaignForm.endAt) : null,
          isActive: campaignForm.isActive,
          config: {
            inviterRewardCoins: Number(campaignForm.inviterRewardCoins),
            invitedRewardCoins: Number(campaignForm.invitedRewardCoins),
            invitedRewardEnabled: campaignForm.invitedRewardEnabled,
            qualificationRules: {
              requireEmailVerified: campaignForm.requireEmailVerified,
              requireProfileCompleted: campaignForm.requireProfileCompleted,
              minAdsWatched: Number(campaignForm.minAdsWatched),
              minMatchesPlayed: Number(campaignForm.minMatchesPlayed),
              minMissionRewardsClaimed: Number(campaignForm.minMissionRewardsClaimed),
            },
          },
          updatedAt: new Date(),
        },
        { merge: true },
      );
      setMsg("Campanha salva.");
      setCampaignForm(EMPTY_CAMPAIGN);
      await loadAll();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Erro ao salvar campanha.");
    }
  }

  async function review(referralId: string, action: "block" | "mark_valid" | "reward") {
    setMsg(null);
    try {
      await callFunction("adminReviewReferral", { referralId, action });
      setMsg("Ação aplicada na indicação.");
      await loadAll();
    } catch (error) {
      setMsg(formatFirebaseError(error));
    }
  }

  async function closeRanking(period: "daily" | "weekly" | "monthly") {
    setMsg(null);
    setClosingPeriod(period);
    try {
      await callFunction("adminCloseReferralRanking", { period });
      setMsg("Fechamento do ranking de indicações executado.");
      await loadAll();
    } catch (error) {
      setMsg(formatFirebaseError(error));
    } finally {
      setClosingPeriod("");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Indicações</h1>
        <p className="mt-1 text-sm text-slate-400">
          Controle campanhas, regras, recompensas e auditoria do sistema de convite.
        </p>
      </div>

      {msg ? <AlertBanner tone="info">{msg}</AlertBanner> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat title="Total" value={stats.total} />
        <Stat title="Pendentes" value={stats.pending} />
        <Stat title="Válidas" value={stats.valid} />
        <Stat title="Recompensadas" value={stats.rewarded} />
        <Stat title="Bloqueadas" value={stats.blocked} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
          <h2 className="text-lg font-semibold text-white">Configurações do sistema</h2>
          <ToggleRow
            label="Sistema ativo"
            checked={config.enabled}
            onChange={(checked) => setConfig((current) => ({ ...current, enabled: checked }))}
          />
          <ToggleRow
            label="Código obrigatório no cadastro"
            checked={config.codeRequired}
            onChange={(checked) => setConfig((current) => ({ ...current, codeRequired: checked }))}
          />
          <ToggleRow
            label="Recompensa para convidado"
            checked={config.invitedRewardEnabled}
            onChange={(checked) => setConfig((current) => ({ ...current, invitedRewardEnabled: checked }))}
          />
          <Field
            label="PR para indicador"
            value={String(config.defaultInviterRewardCoins)}
            onChange={(value) =>
              setConfig((current) => ({ ...current, defaultInviterRewardCoins: Math.max(0, Number(value) || 0) }))
            }
          />
          <Field
            label="PR para convidado"
            value={String(config.defaultInvitedRewardCoins)}
            onChange={(value) =>
              setConfig((current) => ({ ...current, defaultInvitedRewardCoins: Math.max(0, Number(value) || 0) }))
            }
          />
          <Field
            label="Limite válido por dia"
            value={String(config.limitValidPerDay)}
            onChange={(value) =>
              setConfig((current) => ({ ...current, limitValidPerDay: Math.max(0, Number(value) || 0) }))
            }
          />
          <Field
            label="Limite total por usuário"
            value={String(config.limitRewardedPerUser)}
            onChange={(value) =>
              setConfig((current) => ({ ...current, limitRewardedPerUser: Math.max(0, Number(value) || 0) }))
            }
          />
          <Field
            label="Min. anúncios"
            value={String(config.qualificationRules.minAdsWatched)}
            onChange={(value) =>
              setConfig((current) => ({
                ...current,
                qualificationRules: {
                  ...current.qualificationRules,
                  minAdsWatched: Math.max(0, Number(value) || 0),
                },
              }))
            }
          />
          <Field
            label="Min. partidas"
            value={String(config.qualificationRules.minMatchesPlayed)}
            onChange={(value) =>
              setConfig((current) => ({
                ...current,
                qualificationRules: {
                  ...current.qualificationRules,
                  minMatchesPlayed: Math.max(0, Number(value) || 0),
                },
              }))
            }
          />
          <Field
            label="Min. missões resgatadas"
            value={String(config.qualificationRules.minMissionRewardsClaimed)}
            onChange={(value) =>
              setConfig((current) => ({
                ...current,
                qualificationRules: {
                  ...current.qualificationRules,
                  minMissionRewardsClaimed: Math.max(0, Number(value) || 0),
                },
              }))
            }
          />
          <ToggleRow
            label="Exigir e-mail verificado"
            checked={config.qualificationRules.requireEmailVerified}
            onChange={(checked) =>
              setConfig((current) => ({
                ...current,
                qualificationRules: { ...current.qualificationRules, requireEmailVerified: checked },
              }))
            }
          />
          <ToggleRow
            label="Exigir perfil completo"
            checked={config.qualificationRules.requireProfileCompleted}
            onChange={(checked) =>
              setConfig((current) => ({
                ...current,
                qualificationRules: { ...current.qualificationRules, requireProfileCompleted: checked },
              }))
            }
          />
          <ToggleRow
            label="Revisão manual para suspeitas"
            checked={config.antiFraudRules.requireManualReviewForSuspected}
            onChange={(checked) =>
              setConfig((current) => ({
                ...current,
                antiFraudRules: {
                  ...current.antiFraudRules,
                  requireManualReviewForSuspected: checked,
                },
              }))
            }
          />
          <Field
            label="Campanha ativa (ID)"
            value={config.activeCampaignId ?? ""}
            onChange={(value) => setConfig((current) => ({ ...current, activeCampaignId: value || null }))}
          />
          <JsonField
            label="Prêmios do ranking diário"
            value={dailyPrizeJson}
            onChange={setDailyPrizeJson}
          />
          <JsonField
            label="Prêmios do ranking semanal"
            value={weeklyPrizeJson}
            onChange={setWeeklyPrizeJson}
          />
          <JsonField
            label="Prêmios do ranking mensal"
            value={monthlyPrizeJson}
            onChange={setMonthlyPrizeJson}
          />
          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">Texto da campanha</span>
            <textarea
              className="min-h-24 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white"
              value={config.campaignText ?? ""}
              onChange={(e) => setConfig((current) => ({ ...current, campaignText: e.target.value }))}
            />
          </label>
          <Button className="w-full" onClick={() => void saveConfig()}>
            Salvar configurações
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Campanhas</h2>
            <p className="mt-1 text-xs text-slate-400">
              Campanha ativa: {activeCampaign?.name ?? "nenhuma definida"}.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="secondary" disabled={closingPeriod !== ""} onClick={() => void closeRanking("daily")}>
              {closingPeriod === "daily" ? "Fechando..." : "Fechar diário"}
            </Button>
            <Button variant="secondary" disabled={closingPeriod !== ""} onClick={() => void closeRanking("weekly")}>
              {closingPeriod === "weekly" ? "Fechando..." : "Fechar semanal"}
            </Button>
            <Button variant="secondary" disabled={closingPeriod !== ""} onClick={() => void closeRanking("monthly")}>
              {closingPeriod === "monthly" ? "Fechando..." : "Fechar mensal"}
            </Button>
          </div>
          <Field label="ID (opcional)" value={campaignForm.id} onChange={(value) => setCampaignForm((current) => ({ ...current, id: value }))} />
          <Field label="Nome" value={campaignForm.name} onChange={(value) => setCampaignForm((current) => ({ ...current, name: value }))} />
          <Field label="Descrição" value={campaignForm.description} onChange={(value) => setCampaignForm((current) => ({ ...current, description: value }))} />
          <Field label="Início" value={campaignForm.startAt} onChange={(value) => setCampaignForm((current) => ({ ...current, startAt: value }))} type="datetime-local" />
          <Field label="Fim" value={campaignForm.endAt} onChange={(value) => setCampaignForm((current) => ({ ...current, endAt: value }))} type="datetime-local" />
          <Field label="PR indicador" value={campaignForm.inviterRewardCoins} onChange={(value) => setCampaignForm((current) => ({ ...current, inviterRewardCoins: value }))} />
          <Field label="PR convidado" value={campaignForm.invitedRewardCoins} onChange={(value) => setCampaignForm((current) => ({ ...current, invitedRewardCoins: value }))} />
          <ToggleRow label="Campanha ativa" checked={campaignForm.isActive} onChange={(checked) => setCampaignForm((current) => ({ ...current, isActive: checked }))} />
          <ToggleRow label="Recompensa convidado" checked={campaignForm.invitedRewardEnabled} onChange={(checked) => setCampaignForm((current) => ({ ...current, invitedRewardEnabled: checked }))} />
          <Button className="w-full" onClick={() => void saveCampaign()}>
            Salvar campanha
          </Button>
          <div className="space-y-2 border-t border-white/10 pt-3">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-left"
                onClick={() =>
                  setCampaignForm({
                    id: campaign.id,
                    name: campaign.name,
                    description: campaign.description,
                    regulationText: campaign.regulationText ?? "",
                    startAt: toDateInput(campaign.startAt),
                    endAt: toDateInput(campaign.endAt),
                    isActive: campaign.isActive,
                    inviterRewardCoins: String(campaign.config.inviterRewardCoins),
                    invitedRewardCoins: String(campaign.config.invitedRewardCoins),
                    invitedRewardEnabled: campaign.config.invitedRewardEnabled,
                    requireEmailVerified: campaign.config.qualificationRules.requireEmailVerified,
                    requireProfileCompleted: campaign.config.qualificationRules.requireProfileCompleted,
                    minAdsWatched: String(campaign.config.qualificationRules.minAdsWatched),
                    minMatchesPlayed: String(campaign.config.qualificationRules.minMatchesPlayed),
                    minMissionRewardsClaimed: String(campaign.config.qualificationRules.minMissionRewardsClaimed),
                  })
                }
              >
                <p className="font-semibold text-white">{campaign.name}</p>
                <p className="mt-1 text-xs text-slate-400">{campaign.description}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Fila de indicações</h2>
            <p className="text-xs text-slate-400">Acompanhe pendências, suspeitas e recompensas.</p>
          </div>
          <select
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | ReferralStatus)}
          >
            <option value="all">Todas</option>
            <option value="pending">Pendentes</option>
            <option value="valid">Válidas</option>
            <option value="rewarded">Recompensadas</option>
            <option value="blocked">Bloqueadas</option>
            <option value="invalid">Inválidas</option>
          </select>
        </div>
        <div className="space-y-2">
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">
                    {row.inviterName || row.inviterUserId} → {row.invitedUserName || row.invitedUserEmail || row.invitedUserId}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Status: {row.status} · Código: {row.invitedByCode} · Campanha: {row.campaignName || "padrão"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => void review(row.id, "mark_valid")}>
                    Validar
                  </Button>
                  <Button onClick={() => void review(row.id, "reward")}>
                    Recompensar
                  </Button>
                  <Button variant="danger" onClick={() => void review(row.id, "block")}>
                    Bloquear
                  </Button>
                </div>
              </div>
            </article>
          ))}
          {rows.length === 0 ? <p className="text-sm text-slate-500">Nenhuma indicação neste filtro.</p> : null}
        </div>
      </section>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/80 p-4">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "number",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-300">{label}</span>
      <input
        type={type}
        className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <span className="text-sm text-white">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function JsonField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-300">{label}</span>
      <textarea
        className="min-h-28 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
