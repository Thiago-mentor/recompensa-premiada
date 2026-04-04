"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<number | null>(null);
  const [fraudes, setFraudes] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const db = getFirebaseFirestore();
        const uc = await getCountFromServer(collection(db, COLLECTIONS.users));
        const fc = await getCountFromServer(collection(db, COLLECTIONS.fraudLogs));
        if (!c) {
          setUsers(uc.data().count);
          setFraudes(fc.data().count);
        }
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Sem permissão ou Firebase offline");
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>
      {err ? (
        <p className="text-sm text-amber-300">
          {err} — verifique custom claim <code className="text-white">admin: true</code> no usuário.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat title="Usuários" value={users} />
        <Stat title="Logs de fraude" value={fraudes} />
        <Stat title="Ads hoje" value="—" hint="Agregue via Function agendada" />
      </div>
      <RecentFraud />
    </div>
  );
}

function Stat({ title, value, hint }: { title: string; value: number | string | null; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/80 p-4">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value ?? "…"}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function RecentFraud() {
  const [rows, setRows] = useState<{ id: string; tipo: string; uid: string }[]>([]);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const db = getFirebaseFirestore();
        const q = query(
          collection(db, COLLECTIONS.fraudLogs),
          orderBy("timestamp", "desc"),
          limit(8),
        );
        const snap = await getDocs(q);
        if (!c)
          setRows(
            snap.docs.map((d) => {
              const x = d.data() as { tipo?: string; uid?: string };
              return { id: d.id, tipo: x.tipo ?? "", uid: x.uid ?? "" };
            }),
          );
      } catch {
        if (!c) setRows([]);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/80 p-4">
      <h2 className="font-semibold text-white">Alertas recentes</h2>
      <ul className="mt-2 space-y-2 text-sm text-slate-300">
        {rows.length === 0 ? <li>Nenhum log ou sem permissão.</li> : null}
        {rows.map((r) => (
          <li key={r.id}>
            <span className="text-slate-500">{r.tipo}</span> · {r.uid}
          </li>
        ))}
      </ul>
    </div>
  );
}
