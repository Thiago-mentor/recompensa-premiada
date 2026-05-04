"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { useAdminSaveFeedback } from "@/components/admin/AdminSaveFeedback";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { AdminSectionCard } from "@/components/admin/AdminSectionCard";
import type { MissionCategory, MissionTemplate, MissionType } from "@/types/mission";
import { Button } from "@/components/ui/Button";
import { CalendarDays, ClipboardList, Flame, Pencil, Target, Trash2 } from "lucide-react";

const TYPE_OPTIONS: Array<{ id: MissionType; label: string }> = [
  { id: "diaria", label: "Diária" },
  { id: "semanal", label: "Semanal" },
  { id: "evento", label: "Evento" },
];

const CATEGORY_OPTIONS: Array<{ id: MissionCategory; label: string }> = [
  { id: "login", label: "Login" },
  { id: "ads", label: "Anúncios" },
  { id: "jogos", label: "Jogos" },
  { id: "social", label: "Social" },
  { id: "streak", label: "Streak" },
  { id: "loja", label: "Loja" },
  { id: "especial", label: "Especial" },
];

const EVENT_KEY_OPTIONS = [
  "watch_ad",
  "play_match",
  "win_match",
  "daily_login",
  "claim_chest",
  "join_clan",
  "invite_friend",
  "buy_ticket",
  "craft_boost",
];

const emptyForm = () => ({
  id: "",
  titulo: "",
  descricao: "",
  tipo: "diaria" as MissionType,
  meta: "1",
  recompensaCoins: "25",
  recompensaGems: "0",
  recompensaXP: "10",
  ativa: true,
  ordem: "10",
  icone: "target",
  categoria: "jogos" as MissionCategory,
  eventKey: "play_match",
});

export default function AdminMissoesPage() {
  const { notify } = useAdminSaveFeedback();
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const db = getFirebaseFirestore();
    const missionsQuery = query(collection(db, COLLECTIONS.missions), orderBy("ordem", "asc"));
    return onSnapshot(
      missionsQuery,
      (snapshot) => {
        setTemplates(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MissionTemplate),
        );
      },
      (error) => notify("error", error.message),
    );
  }, []);

  const stats = useMemo(
    () => ({
      total: templates.length,
      active: templates.filter((item) => item.ativa).length,
      daily: templates.filter((item) => item.tipo === "diaria").length,
      weekly: templates.filter((item) => item.tipo === "semanal").length,
    }),
    [templates],
  );

  function editMission(mission: MissionTemplate) {
    setEditingId(mission.id);
    setForm({
      id: mission.id,
      titulo: mission.titulo,
      descricao: mission.descricao,
      tipo: mission.tipo,
      meta: String(mission.meta),
      recompensaCoins: String(mission.recompensaCoins),
      recompensaGems: String(mission.recompensaGems),
      recompensaXP: String(mission.recompensaXP),
      ativa: mission.ativa,
      ordem: String(mission.ordem),
      icone: mission.icone,
      categoria: mission.categoria,
      eventKey: mission.eventKey,
    });
    notify("info", `Editando missão: ${mission.titulo}`, { durationMs: 3200 });
  }

  async function saveMission() {
    const id = (editingId || form.id || slugify(form.titulo)).trim();
    if (!id || form.titulo.trim().length < 3) {
      notify("error", "Informe um título válido para a missão.");
      return;
    }
    setSaving(true);
    try {
      const payload: MissionTemplate = {
        id,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        tipo: form.tipo,
        meta: positiveInt(form.meta, 1),
        recompensaCoins: positiveInt(form.recompensaCoins, 0),
        recompensaGems: positiveInt(form.recompensaGems, 0),
        recompensaXP: positiveInt(form.recompensaXP, 0),
        ativa: form.ativa,
        ordem: positiveInt(form.ordem, 0),
        icone: form.icone.trim() || "target",
        categoria: form.categoria,
        eventKey: form.eventKey.trim() || "play_match",
      };
      await setDoc(doc(getFirebaseFirestore(), COLLECTIONS.missions, id), payload, { merge: true });
      setEditingId(null);
      setForm(emptyForm());
      notify("success", "Missão salva com sucesso.");
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Erro ao salvar missão.");
    } finally {
      setSaving(false);
    }
  }

  async function removeMission(id: string) {
    if (!window.confirm("Remover esta missão? O progresso já gerado dos usuários não será apagado.")) return;
    await deleteDoc(doc(getFirebaseFirestore(), COLLECTIONS.missions, id));
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm());
    }
    notify("success", "Missão removida do catálogo.");
  }

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

      <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.85fr)_minmax(0,1.15fr)]">
        <AdminSectionCard>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                {editingId ? "Editando template" : "Novo template"}
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">
                {editingId ? form.titulo || editingId : "Criar missão"}
              </h2>
            </div>
            {editingId ? (
              <Button variant="ghost" onClick={() => { setEditingId(null); setForm(emptyForm()); }}>
                Cancelar
              </Button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3">
            {!editingId ? (
              <Field label="ID da missão (opcional)" value={form.id} onChange={(value) => setForm((current) => ({ ...current, id: slugify(value) }))} />
            ) : null}
            <Field label="Título" value={form.titulo} onChange={(value) => setForm((current) => ({ ...current, titulo: value }))} />
            <TextArea label="Descrição" value={form.descricao} onChange={(value) => setForm((current) => ({ ...current, descricao: value }))} />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Tipo"
                value={form.tipo}
                options={TYPE_OPTIONS}
                onChange={(value) => setForm((current) => ({ ...current, tipo: value as MissionType }))}
              />
              <SelectField
                label="Categoria"
                value={form.categoria}
                options={CATEGORY_OPTIONS}
                onChange={(value) => setForm((current) => ({ ...current, categoria: value as MissionCategory }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Meta" value={form.meta} onChange={(value) => setForm((current) => ({ ...current, meta: value }))} />
              <Field label="Ordem" value={form.ordem} onChange={(value) => setForm((current) => ({ ...current, ordem: value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="PR" value={form.recompensaCoins} onChange={(value) => setForm((current) => ({ ...current, recompensaCoins: value }))} />
              <Field label="TICKET" value={form.recompensaGems} onChange={(value) => setForm((current) => ({ ...current, recompensaGems: value }))} />
              <Field label="XP" value={form.recompensaXP} onChange={(value) => setForm((current) => ({ ...current, recompensaXP: value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Chave de progresso"
                value={form.eventKey}
                options={EVENT_KEY_OPTIONS.map((id) => ({ id, label: id }))}
                onChange={(value) => setForm((current) => ({ ...current, eventKey: value }))}
              />
              <Field label="Ícone" value={form.icone} onChange={(value) => setForm((current) => ({ ...current, icone: value }))} />
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white">
              <input
                type="checkbox"
                checked={form.ativa}
                onChange={(event) => setForm((current) => ({ ...current, ativa: event.target.checked }))}
                className="h-4 w-4 accent-emerald-500"
              />
              Missão ativa
            </label>
            <Button onClick={saveMission} disabled={saving}>
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar missão"}
            </Button>
          </div>
        </AdminSectionCard>

        <div className="space-y-3">
          {templates.length === 0 ? (
            <AdminSectionCard>
              <p className="text-sm text-white/50">Nenhuma missão cadastrada ainda.</p>
            </AdminSectionCard>
          ) : (
            templates.map((mission) => (
              <AdminSectionCard key={mission.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-white">{mission.titulo}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${mission.ativa ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/5 text-white/45"}`}>
                        {mission.ativa ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white/55">{mission.descricao}</p>
                    <p className="mt-2 text-xs text-white/40">
                      {mission.tipo} · {mission.categoria} · {mission.eventKey} · meta {mission.meta}
                    </p>
                    <p className="mt-1 text-xs text-amber-100/80">
                      +{mission.recompensaCoins} PR · +{mission.recompensaGems} TICKET · +{mission.recompensaXP} XP
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => editMission(mission)}>
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button variant="ghost" className="text-red-300" onClick={() => void removeMission(mission.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </AdminSectionCard>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function positiveInt(value: unknown, fallback: number) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <textarea
        className="mt-1 min-h-[88px] w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <select
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id} className="bg-slate-950">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
