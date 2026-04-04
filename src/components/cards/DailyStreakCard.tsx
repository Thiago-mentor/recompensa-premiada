import { Button } from "@/components/ui/Button";
import { Flame } from "lucide-react";

export function DailyStreakCard({
  streak,
  onCheckIn,
  loading,
}: {
  streak: number;
  onCheckIn: () => void;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-950/50 to-slate-900/90 p-4">
      <div className="flex items-center gap-2 text-orange-200">
        <Flame className="h-6 w-6" />
        <div>
          <p className="text-sm font-medium text-orange-100/90">Streak diária</p>
          <p className="text-2xl font-bold text-white">{streak} dias</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-white/55">
        Entre todo dia para manter a sequência e desbloquear baús especiais.
      </p>
      <Button variant="secondary" className="mt-3 w-full border-orange-500/30" onClick={onCheckIn} disabled={loading}>
        {loading ? "Registrando…" : "Registrar entrada de hoje"}
      </Button>
    </div>
  );
}
