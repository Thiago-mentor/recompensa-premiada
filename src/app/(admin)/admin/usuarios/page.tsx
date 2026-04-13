"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { ROUTES } from "@/lib/constants/routes";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { Button } from "@/components/ui/Button";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { AdminSectionCard } from "@/components/admin/AdminSectionCard";
import type { UserProfile } from "@/types/user";
import { Ban, Coins, ShieldAlert, Users } from "lucide-react";

export default function AdminUsuariosPage() {
  const [rows, setRows] = useState<UserProfile[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadUsers = useCallback(async () => {
    setRefreshing(true);
    try {
      const db = getFirebaseFirestore();
      const snap = await getDocs(query(collection(db, COLLECTIONS.users), limit(50)));
      setRows(
        snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, "uid">) })),
      );
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let c = false;
    void (async () => {
      try {
        const db = getFirebaseFirestore();
        const snap = await getDocs(query(collection(db, COLLECTIONS.users), limit(50)));
        if (c) return;
        setRows(
          snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, "uid">) })),
        );
        setErr(null);
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Erro");
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const bannedCount = useMemo(() => rows.filter((user) => user.banido).length, [rows]);
  const highRiskCount = useMemo(
    () => rows.filter((user) => user.riscoFraude === "alto").length,
    [rows],
  );
  const totalCoins = useMemo(
    () => rows.reduce((sum, user) => sum + Math.max(0, Number(user.coins || 0)), 0),
    [rows],
  );

  return (
    <div className="space-y-6">
      <AdminPageHero
        eyebrow="Base premium"
        title="Usuários"
        accent="violet"
        description="Amostra rápida da base com indicadores de saldo, risco e suspensão. Para ações sensíveis de moderação, use a central de Fraudes."
        actions={
          <>
            <Button variant="secondary" onClick={() => void loadUsers()} disabled={refreshing}>
              {refreshing ? "Atualizando..." : "Atualizar amostra"}
            </Button>
            <Link href={ROUTES.admin.fraudes}>
              <Button variant="ghost">Abrir fraudes</Button>
            </Link>
          </>
        }
      />

      {err ? <AlertBanner tone="error">{err}</AlertBanner> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          title="Carregados"
          value={String(rows.length)}
          hint="Amostra atual da coleção users"
          tone="cyan"
          icon={<Users className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Suspensos"
          value={String(bannedCount)}
          hint="Usuários com bloqueio ativo"
          tone="rose"
          icon={<Ban className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Risco alto"
          value={String(highRiskCount)}
          hint="Contas sinalizadas na amostra"
          tone="amber"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="PR somados"
          value={totalCoins.toLocaleString("pt-BR")}
          hint="Volume de moedas da amostra"
          tone="emerald"
          icon={<Coins className="h-4 w-4" />}
        />
      </section>

      <AdminSectionCard>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
              Tabela operacional
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-white">
              Últimos usuários carregados
            </h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
            50 registros
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="mt-4">
            <AdminEmptyState>Nenhum usuário carregado para exibição.</AdminEmptyState>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead className="bg-slate-950/90 text-slate-400">
                <tr>
                  <th className="p-3">UID</th>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Username</th>
                  <th className="p-3">PR</th>
                  <th className="p-3">Risco</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.uid} className="border-t border-white/5">
                    <td className="p-3 font-mono text-xs text-slate-400">{u.uid.slice(0, 8)}…</td>
                    <td className="p-3 font-medium text-white">{u.nome}</td>
                    <td className="p-3 text-slate-300">@{u.username}</td>
                    <td className="p-3">{Math.max(0, Number(u.coins || 0)).toLocaleString("pt-BR")}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                          u.riscoFraude === "alto"
                            ? "border-rose-400/20 bg-rose-500/10 text-rose-100"
                            : u.riscoFraude === "medio"
                              ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
                              : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                        }`}
                      >
                        {u.riscoFraude || "baixo"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                          u.banido
                            ? "border-rose-400/20 bg-rose-500/10 text-rose-100"
                            : "border-cyan-400/20 bg-cyan-500/10 text-cyan-100"
                        }`}
                      >
                        {u.banido ? "suspenso" : "ativo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}
