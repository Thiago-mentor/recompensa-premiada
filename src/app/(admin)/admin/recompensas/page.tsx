"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import type { RewardClaim } from "@/types/reward";
import { callFunction } from "@/services/callables/client";

export default function AdminRecompensasPage() {
  const [rows, setRows] = useState<RewardClaim[]>([]);

  async function refresh() {
    const db = getFirebaseFirestore();
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.rewardClaims), orderBy("criadoEm", "desc")),
    );
    setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RewardClaim));
  }

  useEffect(() => {
    refresh().catch(() => setRows([]));
  }, []);

  async function review(id: string, status: "aprovado" | "recusado") {
    try {
      await callFunction("reviewRewardClaim", { claimId: id, status });
      await refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Erro ao analisar.");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Resgates</h1>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-900/80 p-3 text-sm"
          >
            <span className="text-slate-200">
              {r.userId.slice(0, 8)} · R$ {r.valor} · <strong>{r.status}</strong>
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-emerald-700 px-3 py-1 text-white"
                onClick={() => review(r.id, "aprovado")}
              >
                Aprovar
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-800 px-3 py-1 text-white"
                onClick={() => review(r.id, "recusado")}
              >
                Recusar
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
