"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import type { StreakRewardTier, SystemEconomyConfig } from "@/types/systemConfig";
import { normalizeStreakTable } from "@/utils/streakReward";
import { clampPvpChoiceSeconds, parsePvpChoiceSeconds } from "@/lib/games/pvpTiming";
import { callFunction } from "@/services/callables/client";
import { formatFirebaseError } from "@/lib/firebase/errors";
import { cashPointsToBrl, formatBrl } from "@/services/economy/cashEconomyConfig";

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
  const [pvpSecPpt, setPvpSecPpt] = useState("10");
  const [pvpSecQuiz, setPvpSecQuiz] = useState("10");
  const [pvpSecReaction, setPvpSecReaction] = useState("10");
  const [convBuy, setConvBuy] = useState("500");
  const [convSell, setConvSell] = useState("0");
  const [cashPointsPerReal, setCashPointsPerReal] = useState("100");
  const [grantLookup, setGrantLookup] = useState<"username" | "uid">("username");
  const [grantValue, setGrantValue] = useState("");
  const [grantKind, setGrantKind] = useState<"coins" | "gems" | "rewardBalance">("coins");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantMsg, setGrantMsg] = useState<string | null>(null);
  const [grantLoading, setGrantLoading] = useState(false);
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
        const pcs = parsePvpChoiceSeconds(d);
        setPvpSecPpt(String(pcs.ppt));
        setPvpSecQuiz(String(pcs.quiz));
        setPvpSecReaction(String(pcs.reaction_tap));
        if (typeof d.conversionCoinsPerGemBuy === "number") setConvBuy(String(d.conversionCoinsPerGemBuy));
        if (typeof d.conversionCoinsPerGemSell === "number") setConvSell(String(d.conversionCoinsPerGemSell));
        if (typeof d.cashPointsPerReal === "number" && d.cashPointsPerReal >= 1) {
          setCashPointsPerReal(String(Math.floor(d.cashPointsPerReal)));
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
          pvpChoiceSeconds: {
            ppt: clampPvpChoiceSeconds(pvpSecPpt, 10),
            quiz: clampPvpChoiceSeconds(pvpSecQuiz, 10),
            reaction_tap: clampPvpChoiceSeconds(pvpSecReaction, 10),
          },
          conversionCoinsPerGemBuy: Math.max(1, Math.floor(Number(convBuy)) || 500),
          conversionCoinsPerGemSell: Math.max(0, Math.floor(Number(convSell)) || 0),
          cashPointsPerReal: Math.max(1, Math.floor(Number(cashPointsPerReal)) || 100),
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
      setMsg(
        "Economia salva. Premiações de ranking ficam na aba Rankings. Em produção: se o tempo do quiz ou a lógica do servidor não mudarem, publique as Cloud Functions (firebase deploy --only functions) e as regras do Firestore (firebase deploy --only firestore:rules). Com emuladores, reinicie-os após npm run build em functions/.",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function grantSubmit() {
    setGrantMsg(null);
    const amt = Math.floor(Number(grantAmount));
    if (!grantValue.trim()) {
      setGrantMsg("Informe o username ou o UID.");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setGrantMsg("Quantidade inválida.");
      return;
    }
    setGrantLoading(true);
    try {
      const res = await callFunction<
        { lookup: string; value: string; kind: string; amount: number },
        { ok: boolean; targetUid: string; field: string; newBalance: number }
      >("adminGrantEconomy", {
        lookup: grantLookup,
        value: grantValue.trim(),
        kind: grantKind,
        amount: amt,
      });
      const d = res.data;
      const label =
        grantKind === "coins" ? "PR" : grantKind === "gems" ? "TICKET" : "CASH";
      setGrantMsg(`Crédito aplicado — ${label} novo saldo: ${d.newBalance} (uid: ${d.targetUid}).`);
    } catch (e) {
      setGrantMsg(formatFirebaseError(e));
    } finally {
      setGrantLoading(false);
    }
  }

  const buyN = Math.max(1, Math.floor(Number(convBuy)) || 500);
  const sellN = Math.max(0, Math.floor(Number(convSell)) || 0);
  const cashN = Math.max(1, Math.floor(Number(cashPointsPerReal)) || 100);
  const ticketPerPrBuy = 1 / buyN;
  const ticketPerPrSell = sellN > 0 ? 1 / sellN : null;
  const brlPerCashPoint = cashPointsToBrl(1, cashN);

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
          <Field label="PR por anúncio" value={rewardAd} onChange={setRewardAd} />
          <Field label="Bônus login diário" value={dailyBonus} onChange={setDailyBonus} />
          <Field label="Limite diário de ads" value={limiteAds} onChange={setLimiteAds} />
          <Field label="Limite diário de PR" value={limiteCoins} onChange={setLimiteCoins} />
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
              <strong>Bônus login diário</strong> (só PR).
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
                  label="PR"
                  value={String(row.coins)}
                  onChange={(v) => {
                    const n = Math.max(0, Math.floor(Number(v)) || 0);
                    setStreakRows((prev) => prev.map((r, j) => (j === i ? { ...r, coins: n } : r)));
                  }}
                />
                <Field
                  label="TICKET (streak)"
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
        <h2 className="text-lg font-semibold text-white">Conversão PR ↔ TICKET (carteira)</h2>
        <p className="text-xs text-slate-400">
          <strong className="text-white">Comprar TICKET:</strong> quanto PR o jogador paga por cada ticket.{" "}
          <strong className="text-white">Vender TICKET:</strong> quanto PR ele recebe por ticket; use{" "}
          <strong className="text-white">0</strong> para desativar a troca TICKET → PR.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="PR cobrados por ticket (compra)"
            value={convBuy}
            onChange={setConvBuy}
          />
          <Field
            label="PR pagos por ticket (venda; 0 = off)"
            value={convSell}
            onChange={setConvSell}
          />
        </div>
        <div className="rounded-lg border border-sky-500/25 bg-sky-950/30 p-3 text-xs text-sky-100/90">
          <p className="font-semibold text-sky-200">Taxas na direção inversa (referência)</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sky-100/80">
            <li>
              <strong className="text-white">Compra:</strong> 1 TICKET = {buyN} PR · 1 PR ≈{" "}
              {ticketPerPrBuy.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} TICKET
            </li>
            <li>
              <strong className="text-white">Venda:</strong>{" "}
              {sellN > 0 ? (
                <>
                  1 TICKET vendido = {sellN} PR · para obter 1 PR vendendo tickets, ≈{" "}
                  {ticketPerPrSell!.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} TICKET
                </>
              ) : (
                <>troca TICKET → PR desativada (0)</>
              )}
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-emerald-400/20 bg-emerald-950/20 p-4">
        <h2 className="text-lg font-semibold text-white">CASH ↔ real (saque / premiação)</h2>
        <p className="text-xs text-slate-400">
          Quantos <strong className="text-white">pontos CASH</strong> equivalem a{" "}
          <strong className="text-white">R$ 1,00</strong> na tela de recompensas (cálculo automático do
          valor em reais).
        </p>
        <Field
          label="Pontos CASH por R$ 1,00"
          value={cashPointsPerReal}
          onChange={setCashPointsPerReal}
        />
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/40 p-3 text-xs text-emerald-100/90">
          <p className="font-semibold text-emerald-200">Inverso</p>
          <p className="mt-1">
            R$ 1,00 = {cashN} pts CASH · 1 ponto CASH ≈{" "}
            <strong className="text-white">{formatBrl(brlPerCashPoint)}</strong>
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-violet-400/25 bg-violet-950/25 p-4">
        <h2 className="text-lg font-semibold text-white">Crédito manual em conta</h2>
        <p className="text-xs text-slate-400">
          Credita PR, TICKET ou CASH na conta do jogador (via Cloud Function). Use username (sem @) ou UID.
        </p>
        {grantMsg ? (
          <AlertBanner tone={grantMsg.startsWith("Crédito") ? "success" : "error"}>{grantMsg}</AlertBanner>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-slate-400">Buscar por</label>
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              value={grantLookup}
              onChange={(e) => setGrantLookup(e.target.value as "username" | "uid")}
            >
              <option value="username">Username</option>
              <option value="uid">UID</option>
            </select>
          </div>
          <Field label="Username ou UID" value={grantValue} onChange={setGrantValue} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-slate-400">Moeda</label>
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              value={grantKind}
              onChange={(e) =>
                setGrantKind(e.target.value as "coins" | "gems" | "rewardBalance")
              }
            >
              <option value="coins">PR (coins)</option>
              <option value="gems">TICKET (gems)</option>
              <option value="rewardBalance">CASH (rewardBalance)</option>
            </select>
          </div>
          <Field label="Quantidade" value={grantAmount} onChange={setGrantAmount} />
        </div>
        <Button type="button" onClick={grantSubmit} disabled={grantLoading}>
          {grantLoading ? "Aplicando…" : "Creditar na conta"}
        </Button>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-4">
        <h2 className="text-lg font-semibold text-white">Custo de entrada dos jogos</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="PPT" value={pptEntryCost} onChange={setPptEntryCost} />
          <Field label="Quiz" value={quizEntryCost} onChange={setQuizEntryCost} />
          <Field label="Reaction" value={reactionEntryCost} onChange={setReactionEntryCost} />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-amber-400/20 bg-amber-950/20 p-4">
        <h2 className="text-lg font-semibold text-white">Tempo para responder (PvP)</h2>
        <p className="text-xs text-slate-400">
          Janela em segundos para cada jogador enviar jogada ou resposta. O servidor usa o mesmo valor no
          prazo da rodada (entre <strong className="text-white">3</strong> e{" "}
          <strong className="text-white">120</strong> s). Salve após alterar.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="PPT (pedra/papel/tesoura)"
            value={pvpSecPpt}
            onChange={setPvpSecPpt}
          />
          <Field label="Quiz 1v1" value={pvpSecQuiz} onChange={setPvpSecQuiz} />
          <Field label="Reaction tap" value={pvpSecReaction} onChange={setPvpSecReaction} />
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
