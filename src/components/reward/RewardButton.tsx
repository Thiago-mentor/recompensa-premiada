import { Button } from "@/components/ui/Button";
import { Play, Sparkles } from "lucide-react";

export function RewardButton({
  loading,
  onClick,
}: {
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      className="w-full rounded-2xl px-5 py-5 text-base shadow-[0_18px_40px_-18px_rgba(217,70,239,0.7)] sm:text-lg"
      onClick={onClick}
      disabled={loading}
    >
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
            <Play className="h-5 w-5" />
          </span>
          <span className="text-left">
            <span className="block font-black">{loading ? "Carregando anúncio..." : "Assistir anúncio e ganhar PR"}</span>
            <span className="block text-xs font-medium text-white/75 sm:text-sm">
              Ação mais rápida para subir seu saldo
            </span>
          </span>
        </div>
        <span className="hidden items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white/85 sm:inline-flex">
          <Sparkles className="h-3.5 w-3.5" />
          Mais PR
        </span>
      </div>
    </Button>
  );
}
