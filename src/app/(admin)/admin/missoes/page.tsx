"use client";

export default function AdminMissoesPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-white">Missões</h1>
      <p className="text-slate-400 text-sm">
        Gerencie documentos em <code>missions</code> (ativa, ordem, metas). Progresso do usuário em{" "}
        <code>userMissions/&lt;uid&gt;/daily|weekly</code>.
      </p>
    </div>
  );
}
