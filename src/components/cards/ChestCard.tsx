import { Button } from "@/components/ui/Button";
import { Gift } from "lucide-react";

export function ChestCard({
  available,
  onOpen,
  loading,
}: {
  available: boolean;
  onOpen: () => void;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/40 to-slate-900/90 p-4">
      <div className="flex items-center gap-2">
        <Gift className="h-6 w-6 text-amber-300" />
        <div>
          <p className="font-semibold text-white">Baú diário</p>
          <p className="text-sm text-white/60">
            {available ? "Pronto para abrir!" : "Volte após o cooldown."}
          </p>
        </div>
      </div>
      <Button
        className="mt-3 w-full"
        variant={available ? "primary" : "secondary"}
        disabled={!available || loading}
        onClick={onOpen}
      >
        {loading ? "Abrindo…" : available ? "Abrir baú" : "Indisponível"}
      </Button>
    </div>
  );
}
