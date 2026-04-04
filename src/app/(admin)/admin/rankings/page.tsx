"use client";

export default function AdminRankingsPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-white">Rankings</h1>
      <p className="text-slate-400 text-sm">
        Feche períodos via funções agendadas <code>closeDailyRanking</code>,{" "}
        <code>closeWeeklyRanking</code>, <code>closeMonthlyRanking</code>. Distribua prêmios a partir
        de <code>system_configs</code>.
      </p>
    </div>
  );
}
