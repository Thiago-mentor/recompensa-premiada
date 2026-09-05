"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ArrowRight, CalendarDays, Clock3, Sparkles } from "lucide-react";
import { AdminAdCooldownGuide } from "@/components/admin/AdminAdCooldownGuide";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { ChestSystemConfigPanel } from "@/components/admin/ChestSystemConfigPanel";
import { useAdminSaveFeedback } from "@/components/admin/AdminSaveFeedback";
import { Button, goldButtonLinkClassName } from "@/components/ui/Button";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { ROUTES } from "@/lib/constants/routes";
import type { SystemEconomyConfig } from "@/types/systemConfig";
import { invalidateEconomyConfigCache } from "@/services/systemConfigs/economyDocumentCache";
import {
  formatCooldownMinutesDisplay,
  minutesInputToSeconds,
  secondsToMinutesInputValue,
} from "@/lib/admin/rewardedAdCooldownInput";

const ECONOMY_ID = "economy";

export default function AdminBausPage() {
  const { notify } = useAdminSaveFeedback();
  const [chestCooldownMinutes, setChestCooldownMinutes] = useState(() =>
    secondsToMinutesInputValue(3600),
  );
  const [boostEnabled, setBoostEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const db = getFirebaseFirestore();
        const snapshot = await getDoc(doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID));
        if (!snapshot.exists() || cancelled) return;
        const data = snapshot.data() as Partial<SystemEconomyConfig>;
        if (typeof data.chestCooldownSegundos === "number") {
          setChestCooldownMinutes(secondsToMinutesInputValue(data.chestCooldownSegundos));
        }
        if (typeof data.boostEnabled === "boolean") {
          setBoostEnabled(data.boostEnabled);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveBausEconomy() {
    setSaving(true);
    try {
      const db = getFirebaseFirestore();
      await setDoc(
        doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID),
        {
          id: ECONOMY_ID,
          chestCooldownSegundos: minutesInputToSeconds(chestCooldownMinutes, 86_400 * 30),
        },
        { merge: true },
      );
      invalidateEconomyConfigCache();
      notify("success", "Configuração do mini-jogo Baú salva.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Erro ao salvar configurações de baús.",
      );
    } finally {
      setSaving(false);
    }
  }

  const cooldownSeconds = minutesInputToSeconds(chestCooldownMinutes, 86_400 * 30);

  return (
    <div className="space-y-6">
      <AdminPageHero
        eyebrow="Hub premium"
        title="Baús"
        accent="amber"
        description={
          <>
            Centralize aqui o mini-jogo Baú e o painel dedicado do documento
            <code> system_configs/chest_system</code>. A jornada de check-in foi organizada em uma
            página própria de Recompensa diária.
          </>
        }
        actions={
          <Button type="button" variant="secondary" onClick={saveBausEconomy} disabled={saving}>
            {saving ? "Salvando..." : "Salvar mini-jogo Baú"}
          </Button>
        }
      />

      <AdminAdCooldownGuide />

      <section className="grid gap-4 sm:grid-cols-2">
        <AdminMetricCard
          title="Cooldown"
          value={formatCooldownMinutesDisplay(cooldownSeconds)}
          hint="Mini-jogo legado de baú (valor em minutos no formulário)"
          tone="amber"
          icon={<Clock3 className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Boost"
          value={boostEnabled ? "Ligado" : "Desligado"}
          hint="Integração com extras de baú"
          tone={boostEnabled ? "emerald" : "slate"}
          icon={<Sparkles className="h-4 w-4" />}
        />
      </section>

      <section className="grid gap-4">
        <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
          <h2 className="text-lg font-semibold text-white">Mini-jogo Baú</h2>
          <p className="text-xs text-slate-400">
            Controla o tempo de espera entre uma coleta e a próxima no mini-jogo legado de baú.
          </p>
          <Field
            label="Cooldown do mini-jogo Baú (minutos)"
            value={chestCooldownMinutes}
            onChange={setChestCooldownMinutes}
          />
        </div>

      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-violet-300/20 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.2),transparent_40%),linear-gradient(145deg,rgba(2,6,23,0.98),rgba(30,20,70,0.92))] p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-300/25 bg-violet-400/10 text-violet-200">
              <CalendarDays className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-300/75">Agora em uma página própria</p>
              <h2 className="mt-1 text-xl font-black text-white">Calendário de recompensa diária</h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-400">Escolha a premiação de cada dia usando PR, TICKET, Baú ou Combo especial, com uma prévia visual antes de salvar.</p>
            </div>
          </div>
          <Link href={ROUTES.admin.recompensaDiaria} className={goldButtonLinkClassName("shrink-0 sm:w-auto sm:px-5")}>
            Configurar dias <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="button" onClick={saveBausEconomy} disabled={saving}>
          {saving ? "Salvando..." : "Salvar mini-jogo Baú"}
        </Button>
      </div>

      <ChestSystemConfigPanel boostSystemEnabled={boostEnabled} />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
