"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import type { StreakRewardTier, SystemEconomyConfig } from "@/types/systemConfig";
import { normalizeStreakTable } from "@/utils/streakReward";

const ECONOMY_ID = "economy";

const emptyTier = (): StreakRewardTier => ({
  dia: 7,
  coins: 100,
  gems: 0,
  tipoBonus: "bau",
});

export default function AdminConfigPage() {
  const [rewardAd, setRewardAd] = useState("25");
  const [dailyBonus, setDailyBonus] = useState("50");
  const [limiteAds, setLimiteAds] = useState("20");
  const [limiteCoins, setLimiteCoins] = useState("5000");
  const [refIndicador, setRefIndicador] = useState("100");
  const [refConvidado, setRefConvidado] = useState("50");
  const [chestCooldown, setChestCooldown] = useState("3600");
  const [pptEntryCost, setPptEntryCost] = useState("0");
  const [quizEntryCost, setQuizEntryCost] = useState("0");
  const [reactionEntryCost, setReactionEntryCost] = useState("0");
  const [streakRows, setStreakRows] = useState<StreakRewardTier[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const db = getFirebaseFirestore();
        const s = await getDoc(doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID));
        if (!s.exists() || c) return;
        const d = s.data() as Partial<SystemEconomyConfig>;
        if (typeof d.rewardAdCoinAmount === "number") setRewardAd(String(d.rewardAdCoinAmount));
        if (typeof d.dailyLoginBonus === "number") setDailyBonus(String(d.dailyLoginBonus));
        if (typeof d.limiteDiarioAds === "number") setLimiteAds(String(d.limiteDiarioAds));
        if (typeof d.limiteDiarioCoins === "number") setLimiteCoins(String(d.limiteDiarioCoins));
        if (typeof d.referralBonusIndicador === "number") setRefIndicador(String(d.referralBonusIndicador));
        if (typeof d.referralBonusConvidado === "number") setRefConvidado(String(d.referralBonusConvidado));
        if (typeof d.chestCooldownSegundos === "number") setChestCooldown(String(d.chestCooldownSegundos));
        if (typeof d.gameEntryCost?.ppt === "number") setPptEntryCost(String(d.gameEntryCost.ppt));
        if (typeof d.gameEntryCost?.quiz === "number") setQuizEntryCost(String(d.gameEntryCost.quiz));
        if (typeof d.gameEntryCost?.reaction_tap === "number") {
          setReactionEntryCost(String(d.gameEntryCost.reaction_tap));
        }
        setStreakRows(normalizeStreakTable(d.streakTable));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  async function save() {
    setMsg(null);
    try {
      const db = getFirebaseFirestore();
      await setDoc(
        doc(db, COLLECTIONS.systemConfigs, ECONOMY_ID),
        {
          id: ECONOMY_ID,
          rewardAdCoinAmount: Number(rewardAd),
          dailyLoginBonus: Number(dailyBonus),
          limiteDiarioAds: Number(limiteAds),
          limiteDiarioCoins: Number(limiteCoins),
          referralBonusIndicador: Number(refIndicador),
          referralBonusConvidado: Number(refConvidado),
          chestCooldownSegundos: Number(chestCooldown),
          gameEntryCost: {
            ppt: Number(pptEntryCost),
            quiz: Number(quizEntryCost),
            reaction_tap: Number(reactionEntryCost),
          },
          streakTable: streakRows
            .map((r) => ({
              dia: Math.max(1, Math.floor(Number(r.dia)) || 1),
              coins: Math.max(0, Math.floor(Number(r.coins)) || 0),
              gems: Math.max(0, Math.floor(Number(r.gems)) || 0),
              tipoBonus: r.tipoBonus,
            }))
            .sort((a, b) => a.dia - b.dia),
        },
        { merge: true },
      );
      setMsg("Economia salva. Premiações de ranking ficam na aba Rankings.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações da economia</h1>
        <p className="mt-1 text-sm text-slate-400">
          Ajuste recompensas básicas, limites diários, referral e custo de entrada dos jogos.
        </p>
      </div>
      {msg ? <AlertBanner tone="info">{msg}</AlertBanner> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
          <h2 className="text-lg font-semibold text-white">Recompensas e limites</h2>
          <Field label="Moedas por anúncio" value={rewardAd} onChange={setRewardAd} />
          <Field label="Bônus login diário" value={dailyBonus} onChange={setDailyBonus} />
          <Field label="Limite diário de ads" value={limiteAds} onChange={setLimiteAds} />
          <Field label="Limite diário de coins" value={limiteCoins} onChange={setLimiteCoins} />
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
          <h2 className="text-lg font-semibold text-white">Referral e baú</h2>
          <Field label="Bônus do indicador" value={refIndicador} onChange={setRefIndicador} />
          <Field label="Bônus do convidado" value={refConvidado} onChange={setRefConvidado} />
          <Field
            label="Cooldown do baú (segundos)"
            value={chestCooldown}
            onChange={setChestCooldown}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-white">Marcos da streak diária</h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-400">
              A recompensa do dia usa o marco cujo <strong>dia</strong> coincide com a sequência atual
              (ex.: no 7º dia seguido aplica a linha &quot;7&quot;). Nos outros dias vale o campo{" "}
              <strong>Bônus login diário</strong> (só moedas).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              className="text-xs"
              onClick={() => setStreakRows((prev) => [...prev, emptyTier()])}
            >
              + Marco
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-xs"
              onClick={() => {
                const base = Math.max(0, Math.floor(Number(dailyBonus)) || 50);
                setStreakRows([
                  { dia: 1, coins: base, gems: 0, tipoBonus: "nenhum" },
                  { dia: 7, coins: base * 4, gems: 5, tipoBonus: "bau" },
                  { dia: 30, coins: base * 12, gems: 25, tipoBonus: "especial" },
                ]);
              }}
            >
              Preencher 1 / 7 / 30
            </Button>
          </div>
        </div>
        {streakRows.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum marco — só o bônus fixo de login diário.</p>
        ) : (
          <div className="space-y-2">
            {streakRows.map((row, i) => (
              <div
                key={i}
                className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
              >
                <Field
                  label="Dia da sequência"
                  value={String(row.dia)}
                  onChange={(v) => {
                    const n = Math.max(1, Math.floor(Number(v)) || 1);
                    setStreakRows((prev) => prev.map((r, j) => (j === i ? { ...r, dia: n } : r)));
                  }}
                />
                <Field
                  label="Coins"
                  value={String(row.coins)}
                  onChange={(v) => {
                    const n = Math.max(0, Math.floor(Number(v)) || 0);
                    setStreakRows((prev) => prev.map((r, j) => (j === i ? { ...r, coins: n } : r)));
                  }}
                />
                <Field
                  label="Gems"
                  value={String(row.gems)}
                  onChange={(v) => {
                    const n = Math.max(0, Math.floor(Number(v)) || 0);
                    setStreakRows((prev) => prev.map((r, j) => (j === i ? { ...r, gems: n } : r)));
                  }}
                />
                <div>
                  <label className="text-xs text-slate-400">Tipo</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                    value={row.tipoBonus}
                    onChange={(e) => {
                      const tipoBonus = e.target.value as StreakRewardTier["tipoBonus"];
                      setStreakRows((prev) =>
                        prev.map((r, j) => (j === i ? { ...r, tipoBonus } : r)),
                      );
                    }}
                  >
                    <option value="nenhum">Nenhum</option>
                    <option value="bau">Baú</option>
                    <option value="especial">Especial</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs text-red-300"
                    onClick={() => setStreakRows((prev) => prev.filter((_, j) => j !== i))}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
        <h2 className="text-lg font-semibold text-white">Custo de entrada dos jogos</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="PPT" value={pptEntryCost} onChange={setPptEntryCost} />
          <Field label="Quiz" value={quizEntryCost} onChange={setQuizEntryCost} />
          <Field label="Reaction" value={reactionEntryCost} onChange={setReactionEntryCost} />
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={save}>Salvar economia</Button>
      </div>
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
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
