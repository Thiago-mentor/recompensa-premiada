"use client";

import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { AdminSectionCard } from "@/components/admin/AdminSectionCard";
import { CalendarDays, ClipboardList, Flame, Target } from "lucide-react";

type MissionStats = {
  total: number;
  active: number;
  daily: number;
  weekly: number;
};

export default function AdminMissoesPage() {
  const [stats, setStats] = useState<MissionStats>({
    total: 0,
    active: 0,
    daily: 0,
    weekly: 0,
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const db = getFirebaseFirestore();
        const [total, active, daily, weekly] = await Promise.all([
          getCountFromServer(collection(db, COLLECTIONS.missions)),
          getCountFromServer(query(collection(db, COLLECTIONS.missions), where("ativa", "==", true))),
          getCountFromServer(query(collection(db, COLLECTIONS.missions), where("tipo", "==", "diaria"))),
          getCountFromServer(query(collection(db, COLLECTIONS.missions), where("tipo", "==", "semanal"))),
        ]);
        if (cancelled) return;
        setStats({
          total: total.data().count,
          active: active.data().count,
          daily: daily.data().count,
          weekly: weekly.data().count,
        });
        setErr(null);
      } catch (error) {
        if (!cancelled) {
          setErr(error instanceof Error ? error.message : "Erro ao carregar a central de missões.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <AdminPageHero
        eyebrow="Operação premium"
        title="Missões"
        accent="emerald"
        description={
          <>
            Central de visão rápida das missões do app. O catálogo fica em <code>missions</code> e o
            progresso dos jogadores em <code>userMissions/&lt;uid&gt;/daily|weekly</code>.
          </>
        }
      />

      {err ? <AlertBanner tone="error">{err}</AlertBanner> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          title="Templates"
          value={String(stats.total)}
          hint="Missões cadastradas no catálogo"
          tone="cyan"
          icon={<ClipboardList className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Ativas"
          value={String(stats.active)}
          hint="Missões com distribuição ligada"
          tone="emerald"
          icon={<Target className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Diárias"
          value={String(stats.daily)}
          hint="Templates do ciclo diário"
          tone="amber"
          icon={<CalendarDays className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Semanais"
          value={String(stats.weekly)}
          hint="Templates do ciclo semanal"
          tone="violet"
          icon={<Flame className="h-4 w-4" />}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <AdminSectionCard>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
            Situação da área
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-white">
            Módulo administrativo em consolidação
          </h2>
          <p className="mt-2 text-sm text-white/55">
            A página agora já segue o padrão premium do admin. O próximo passo natural é evoluir daqui
            para um editor completo de templates, metas, recompensas e ordem das missões.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">Catálogo</p>
              <p className="mt-1 text-xs text-slate-400">
                Missões definem meta, tipo, recompensa, categoria, ordem e chave lógica de progresso.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">Progresso do jogador</p>
              <p className="mt-1 text-xs text-slate-400">
                O avanço fica separado por usuário e período, o que facilita auditoria e reset dos ciclos.
              </p>
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
            Próximo upgrade
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-white">
            O que vale entrar aqui
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <p>Editor visual de template com ativação, ordem e preview de recompensa.</p>
            <p>Filtros por tipo, categoria e status.</p>
            <p>Visão de progresso diário/semanal por missão.</p>
            <p>Atalhos para reprocessar ou inspecionar usuários com missões travadas.</p>
          </div>
          <div className="mt-4">
            <AdminEmptyState>
              O shell premium da área já está pronto para receber o editor completo de missões.
            </AdminEmptyState>
          </div>
        </AdminSectionCard>
      </div>
    </div>
  );
}
