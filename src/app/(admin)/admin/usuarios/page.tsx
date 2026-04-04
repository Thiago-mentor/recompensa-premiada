"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import type { UserProfile } from "@/types/user";

export default function AdminUsuariosPage() {
  const [rows, setRows] = useState<UserProfile[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const db = getFirebaseFirestore();
        const snap = await getDocs(query(collection(db, COLLECTIONS.users), limit(50)));
        if (!c)
          setRows(
            snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, "uid">) })),
          );
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Erro");
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Usuários</h1>
      {err ? <p className="text-sm text-red-300">{err}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm text-slate-200">
          <thead className="bg-slate-900/90 text-slate-400">
            <tr>
              <th className="p-3">UID</th>
              <th className="p-3">Nome</th>
              <th className="p-3">Username</th>
              <th className="p-3">Coins</th>
              <th className="p-3">Banido</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.uid} className="border-t border-white/5">
                <td className="p-3 font-mono text-xs">{u.uid.slice(0, 8)}…</td>
                <td className="p-3">{u.nome}</td>
                <td className="p-3">@{u.username}</td>
                <td className="p-3">{u.coins}</td>
                <td className="p-3">{u.banido ? "sim" : "não"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
