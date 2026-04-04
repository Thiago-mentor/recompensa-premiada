"use client";

export default function AdminFraudesPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-white">Anti-fraude</h1>
      <p className="text-slate-400 text-sm">
        Revise <code>fraud_logs</code>, ajuste <code>riscoFraude</code> no usuário e use banimento manual.
        Função <code>riskAnalysisOnUserEvent</code> incrementa severidade automaticamente.
      </p>
    </div>
  );
}
