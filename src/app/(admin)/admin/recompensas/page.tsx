"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Clock3, Filter, Wallet } from "lucide-react";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import type { RewardClaim, RewardClaimStatus } from "@/types/reward";
import { callFunction } from "@/services/callables/client";
import { ConfirmarPixRewardClaim } from "@/components/admin/ConfirmarPixRewardClaim";
import {
  cashPointsToBrl,
  fetchCashPointsPerReal,
  formatBrl,
} from "@/services/economy/cashEconomyConfig";

function tsToIso(v: unknown): string {
  if (v && typeof v === "object" && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    try {
      return (v as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return "";
    }
  }
  return "";
}

function csvEscape(s: string): string {
  const needs = /[",\r\n]/.test(s);
  const doubled = s.replace(/"/g, '""');
  return needs ? `"${doubled}"` : doubled;
}

function claimsToCsv(
  rows: RewardClaim[],
  nomeByUid: Record<string, string>,
  cashPointsPerReal: number,
): string {
  const header = [
    "id",
    "nomeUsuario",
    "userId",
    "tipo",
    "valorPontosCash",
    "valorReaisEstimado",
    "chavePix",
    "status",
    "criadoEm",
    "atualizadoEm",
    "analisadoPor",
    "motivoRecusa",
    "comprovanteUrl",
    "confirmadoEm",
    "confirmadoPor",
  ];
  const lines = rows.map((r) => {
    const brl = cashPointsToBrl(r.valor, cashPointsPerReal);
    return [
      r.id,
      nomeByUid[r.userId] ?? "",
      r.userId,
      r.tipo,
      String(r.valor),
      brl.toFixed(2),
      r.chavePix ?? "",
      r.status,
      tsToIso(r.criadoEm),
      tsToIso(r.atualizadoEm),
      r.analisadoPor ?? "",
      r.motivoRecusa ?? "",
      r.comprovanteUrl ?? "",
      tsToIso(r.confirmadoEm),
      r.confirmadoPor ?? "",
    ]
      .map((c) => csvEscape(String(c)))
      .join(",");
  });
  return "\uFEFF" + [header.join(","), ...lines].join("\r\n");
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchRewardClaimsDashboardData(): Promise<{
  rows: RewardClaim[];
  cashPointsPerReal: number;
  nomeByUid: Record<string, string>;
}> {
  const db = getFirebaseFirestore();
  const [snap, rate] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.rewardClaims), orderBy("criadoEm", "desc"))),
    fetchCashPointsPerReal().catch(() => 100),
  ]);
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RewardClaim);
  const uids = [...new Set(rows.map((r) => r.userId))];
  const pairs = await Promise.all(
    uids.map(async (uid) => {
      const dref = await getDoc(doc(db, COLLECTIONS.users, uid));
      const nome = dref.exists() ? String(dref.data()?.nome ?? "").trim() : "";
      return [uid, nome || "—"] as const;
    }),
  );

  return {
    rows,
    cashPointsPerReal: rate,
    nomeByUid: Object.fromEntries(pairs),
  };
}

function claimCreatedMs(r: RewardClaim): number | null {
  const t = r.criadoEm;
  if (t && typeof t === "object" && "toDate" in t && typeof (t as { toDate: () => Date }).toDate === "function") {
    try {
      return (t as { toDate: () => Date }).toDate().getTime();
    } catch {
      return null;
    }
  }
  return null;
}

/** Início do dia local (00:00:00.000) a partir de "YYYY-MM-DD". */
function startOfLocalDay(ymd: string): number {
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

/** Fim do dia local (23:59:59.999) a partir de "YYYY-MM-DD". */
function endOfLocalDay(ymd: string): number {
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

function claimToExportRow(
  r: RewardClaim,
  nomeByUid: Record<string, string>,
  cashPointsPerReal: number,
) {
  const brl = cashPointsToBrl(r.valor, cashPointsPerReal);
  return {
    id: r.id,
    nomeUsuario: nomeByUid[r.userId] ?? null,
    userId: r.userId,
    tipo: r.tipo,
    valorPontosCash: r.valor,
    valorReaisEstimado: Number(brl.toFixed(2)),
    chavePix: r.chavePix ?? null,
    status: r.status,
    criadoEm: tsToIso(r.criadoEm) || null,
    atualizadoEm: tsToIso(r.atualizadoEm) || null,
    analisadoPor: r.analisadoPor ?? null,
    motivoRecusa: r.motivoRecusa ?? null,
    comprovanteUrl: r.comprovanteUrl ?? null,
    confirmadoEm: tsToIso(r.confirmadoEm) || null,
    confirmadoPor: r.confirmadoPor ?? null,
  };
}

function claimsToJson(
  rows: RewardClaim[],
  nomeByUid: Record<string, string>,
  cashPointsPerReal: number,
): string {
  return JSON.stringify(
    rows.map((r) => claimToExportRow(r, nomeByUid, cashPointsPerReal)),
    null,
    2,
  );
}

type FiltroStatus = "todos" | RewardClaimStatus;

function statusMeta(status: RewardClaimStatus): {
  label: string;
  className: string;
  hint: string | null;
} {
  switch (status) {
    case "pendente":
      return {
        label: "Em análise",
        className: "text-amber-300",
        hint: "Aguardando revisão do admin.",
      };
    case "aprovado":
      return {
        label: "Pagamento em andamento",
        className: "text-emerald-400",
        hint: "Pedido aprovado. Falta enviar o comprovante do PIX.",
      };
    case "confirmado":
      return {
        label: "PIX confirmado",
        className: "text-cyan-300",
        hint: "Pagamento concluído com comprovante disponível.",
      };
    case "recusado":
      return {
        label: "Recusado",
        className: "text-rose-300",
        hint: "Pedido encerrado sem pagamento.",
      };
    default:
      return {
        label: status,
        className: "text-slate-200",
        hint: null,
      };
  }
}

export default function AdminRecompensasPage() {
  const [rows, setRows] = useState<RewardClaim[]>([]);
  const [filtro, setFiltro] = useState<FiltroStatus>("todos");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [nomeByUid, setNomeByUid] = useState<Record<string, string>>({});
  const [cashPointsPerReal, setCashPointsPerReal] = useState(100);

  const applyRefreshData = useCallback(
    (data: Awaited<ReturnType<typeof fetchRewardClaimsDashboardData>>) => {
      setRows(data.rows);
      setCashPointsPerReal(data.cashPointsPerReal);
      setNomeByUid(data.nomeByUid);
    },
    [],
  );

  const refresh = useCallback(async () => {
    applyRefreshData(await fetchRewardClaimsDashboardData());
  }, [applyRefreshData]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchRewardClaimsDashboardData();
        if (!cancelled) applyRefreshData(data);
      } catch {
        if (cancelled) return;
        setRows([]);
        setNomeByUid({});
        setCashPointsPerReal(100);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyRefreshData]);

  const filtrados = useMemo(() => {
    let list = filtro === "todos" ? [...rows] : rows.filter((r) => r.status === filtro);

    if (dataDe) {
      const from = startOfLocalDay(dataDe);
      if (!Number.isNaN(from)) {
        list = list.filter((r) => {
          const ms = claimCreatedMs(r);
          return ms !== null && ms >= from;
        });
      }
    }
    if (dataAte) {
      const to = endOfLocalDay(dataAte);
      if (!Number.isNaN(to)) {
        list = list.filter((r) => {
          const ms = claimCreatedMs(r);
          return ms !== null && ms <= to;
        });
      }
    }

    return list;
  }, [rows, filtro, dataDe, dataAte]);

  const pendingCount = useMemo(
    () => rows.filter((claim) => claim.status === "pendente").length,
    [rows],
  );
  const confirmedCount = useMemo(
    () => rows.filter((claim) => claim.status === "confirmado").length,
    [rows],
  );
  const filteredCashPoints = useMemo(
    () => filtrados.reduce((sum, claim) => sum + Math.max(0, Number(claim.valor || 0)), 0),
    [filtrados],
  );

  async function review(id: string, status: "aprovado" | "recusado") {
    try {
      await callFunction("reviewRewardClaim", { claimId: id, status });
      await refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Erro ao analisar.");
    }
  }

  function exportarCsv() {
    setExportMsg(null);
    if (filtrados.length === 0) {
      setExportMsg("Nenhum pedido na seleção atual.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadBlob(
      `pedidos-recompensas-${stamp}.csv`,
      claimsToCsv(filtrados, nomeByUid, cashPointsPerReal),
      "text/csv;charset=utf-8",
    );
  }

  function exportarJson() {
    setExportMsg(null);
    if (filtrados.length === 0) {
      setExportMsg("Nenhum pedido na seleção atual.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadBlob(
      `pedidos-recompensas-${stamp}.json`,
      claimsToJson(filtrados, nomeByUid, cashPointsPerReal),
      "application/json;charset=utf-8",
    );
  }

  async function copiarPedido(r: RewardClaim) {
    const brl = cashPointsToBrl(r.valor, cashPointsPerReal);
    const nome = nomeByUid[r.userId] ?? "—";
    const texto = [
      `ID: ${r.id}`,
      `Nome: ${nome}`,
      `Usuário (UID): ${r.userId}`,
      `Tipo: ${r.tipo}`,
      `Pontos CASH: ${r.valor}`,
      `Estimativa em reais: ${formatBrl(brl)} (${cashPointsPerReal} pts ≈ R$ 1,00)`,
      `Chave PIX: ${r.chavePix ?? "(vazio)"}`,
      `Status: ${r.status}`,
      `Criado: ${tsToIso(r.criadoEm) || "—"}`,
      `Atualizado: ${tsToIso(r.atualizadoEm) || "—"}`,
      r.analisadoPor ? `Analisado por: ${r.analisadoPor}` : null,
      r.motivoRecusa ? `Motivo recusa: ${r.motivoRecusa}` : null,
      r.comprovanteUrl ? `Comprovante: ${r.comprovanteUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setExportMsg("Dados do pedido copiados.");
      setTimeout(() => setExportMsg(null), 2500);
    } catch {
      window.alert("Não foi possível copiar. Use Baixar CSV ou JSON.");
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHero
        eyebrow="Saques premium"
        title="Recompensas · Pedidos"
        accent="emerald"
        description={
          <>
            Dados completos dos pedidos de resgate para análise e pagamento manual. O valor em reais usa
            a taxa de <code>{cashPointsPerReal}</code> pts CASH por R$ 1,00 em{" "}
            <code>system_configs/economy</code>.
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          title="Pedidos"
          value={String(rows.length)}
          hint="Total carregado no painel"
          tone="cyan"
          icon={<Wallet className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Pendentes"
          value={String(pendingCount)}
          hint="Aguardando revisão do admin"
          tone="amber"
          icon={<Clock3 className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Confirmados"
          value={String(confirmedCount)}
          hint="PIX já finalizados"
          tone="emerald"
          icon={<BadgeCheck className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Seleção atual"
          value={formatBrl(cashPointsToBrl(filteredCashPoints, cashPointsPerReal))}
          hint="Estimativa total em reais dos filtros"
          tone="violet"
          icon={<Filter className="h-4 w-4" />}
        />
      </section>

      <div className="flex flex-col gap-3 rounded-[1.7rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.75)] sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <span className="text-slate-500">Filtrar</span>
            <select
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as FiltroStatus)}
            >
              <option value="todos">Todos</option>
              <option value="pendente">Pendentes</option>
              <option value="aprovado">Aprovados (aguardando PIX)</option>
              <option value="confirmado">PIX confirmados</option>
              <option value="recusado">Recusados</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-violet-400/40 bg-violet-600/30 px-3 py-2 text-sm font-medium text-violet-100 hover:bg-violet-600/45"
            onClick={exportarCsv}
          >
            Baixar CSV
          </button>
          <button
            type="button"
            className="rounded-lg border border-fuchsia-400/35 bg-fuchsia-950/40 px-3 py-2 text-sm font-medium text-fuchsia-100 hover:bg-fuchsia-950/60"
            onClick={exportarJson}
          >
            Baixar JSON
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
            onClick={() => refresh().catch(() => setRows([]))}
          >
            Atualizar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-white/10 bg-slate-900/50 px-4 py-3">
        <p className="w-full text-xs font-semibold uppercase tracking-wide text-slate-500 sm:w-auto sm:mr-2">
          Período (criação)
        </p>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          De
          <input
            type="date"
            value={dataDe}
            onChange={(e) => setDataDe(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Até
          <input
            type="date"
            value={dataAte}
            onChange={(e) => setDataAte(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </label>
        {(dataDe || dataAte) && (
          <button
            type="button"
            className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 hover:bg-white/10"
            onClick={() => {
              setDataDe("");
              setDataAte("");
            }}
          >
            Limpar datas
          </button>
        )}
      </div>

      {exportMsg ? <AlertBanner tone="info">{exportMsg}</AlertBanner> : null}

      <p className="text-xs text-slate-500">
        Mostrando {filtrados.length} de {rows.length} pedido(s)
        {dataDe || dataAte ? " (filtro por data aplicado)" : ""}.
      </p>

      <ul className="space-y-3">
        {filtrados.map((r) => (
          <li
            key={r.id}
            className="space-y-3 rounded-lg border border-white/10 bg-slate-900/80 p-4 text-sm"
          >
            {(() => {
              const meta = statusMeta(r.status);
              return (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1 text-slate-200">
                <p className="font-mono text-xs text-slate-500">ID {r.id}</p>
                <p>
                  <span className="text-slate-500">Nome</span>{" "}
                  <strong className="text-white">{nomeByUid[r.userId] ?? "—"}</strong>
                </p>
                <p>
                  <span className="text-slate-500">UID</span>{" "}
                  <span className="break-all font-mono text-xs text-slate-400">{r.userId}</span>
                </p>
                <p>
                  <span className="text-slate-500">Tipo</span> {r.tipo} ·{" "}
                  <span className="text-slate-500">Pontos CASH</span>{" "}
                  <strong className="text-white">{r.valor}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Estimativa em reais</span>{" "}
                  <strong className="text-emerald-300">{formatBrl(cashPointsToBrl(r.valor, cashPointsPerReal))}</strong>
                  <span className="text-slate-500"> ({cashPointsPerReal} pts ≈ R$ 1,00)</span>
                </p>
                {r.retencaoAplicada ? (
                  <p className="text-xs text-sky-200/80">
                    CASH retido neste pedido — aprovar não debita de novo; recusar estorna ao usuário.
                  </p>
                ) : (
                  <p className="text-xs text-amber-200/75">
                    Pedido legado (sem retenção no envio) — aprovar debita o saldo; recusar não estorna.
                  </p>
                )}
                <p className="break-all">
                  <span className="text-slate-500">Chave PIX</span>{" "}
                  <span className="text-emerald-200/95">{r.chavePix || "—"}</span>
                </p>
                <p>
                  <span className="text-slate-500">Status</span>{" "}
                  <strong className={meta.className}>{meta.label}</strong>
                </p>
                {meta.hint ? <p className="text-xs text-white/45">{meta.hint}</p> : null}
                {r.status === "confirmado" && r.comprovanteUrl ? (
                  <p className="break-all text-xs">
                    <span className="text-slate-500">Comprovante </span>
                    <a
                      href={r.comprovanteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300 hover:underline"
                    >
                      abrir link
                    </a>
                  </p>
                ) : null}
                <p className="text-xs text-slate-500">
                  Criado {tsToIso(r.criadoEm) || "—"} · Atualizado {tsToIso(r.atualizadoEm) || "—"}
                </p>
                {r.analisadoPor ? (
                  <p className="text-xs text-slate-500">Analisado por {r.analisadoPor}</p>
                ) : null}
                {r.motivoRecusa ? (
                  <p className="text-xs text-rose-200/80">Motivo: {r.motivoRecusa}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                <button
                  type="button"
                  className="rounded-lg border border-sky-500/35 bg-sky-950/40 px-3 py-1.5 text-xs text-sky-100 hover:bg-sky-950/60"
                  onClick={() => copiarPedido(r)}
                >
                  Copiar dados
                </button>
                {r.status === "pendente" ? (
                  <span className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-emerald-700 px-3 py-1.5 text-white hover:bg-emerald-600"
                      onClick={() => review(r.id, "aprovado")}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-red-800 px-3 py-1.5 text-white hover:bg-red-700"
                      onClick={() => review(r.id, "recusado")}
                    >
                      Recusar
                    </button>
                  </span>
                ) : null}
                {r.status === "aprovado" ? (
                  <div className="flex max-w-xs flex-col gap-2 rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3">
                    <p className="text-[11px] font-semibold text-emerald-100">Enviar comprovante e concluir PIX</p>
                    <p className="text-[11px] leading-relaxed text-emerald-100/70">
                      Depois do upload, o pedido muda para confirmado e o usuário poderá abrir o comprovante no histórico.
                    </p>
                    <ConfirmarPixRewardClaim claimId={r.id} onDone={() => refresh().catch(() => setRows([]))} />
                  </div>
                ) : null}
                {r.status === "confirmado" ? (
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3 py-2 text-[11px] text-cyan-100/80">
                    PIX finalizado.
                  </div>
                ) : null}
              </div>
            </div>
              );
            })()}
          </li>
        ))}
      </ul>

      {filtrados.length === 0 ? (
        <AdminEmptyState>Nenhum pedido encontrado neste filtro.</AdminEmptyState>
      ) : null}
    </div>
  );
}
