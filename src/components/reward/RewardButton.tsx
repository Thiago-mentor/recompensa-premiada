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
      variant="jackpot"
      size="lg"
      className="w-full rounded-[1.375rem] px-5 py-5 text-base shadow-[0_0_56px_-8px_rgba(236,72,153,0.65),0_0_80px_-20px_rgba(124,58,237,0.45)] sm:text-lg"
      onClick={onClick}
      disabled={loading}
    >
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/10 shadow-[0_0_20px_-6px_rgba(255,255,255,0.4)]">
            <Play className="h-5 w-5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" fill="currentColor" />
          </span>
          <span className="text-left text-white">
            <span className="block font-black tracking-tight drop-shadow-sm">
              {loading ? "Carregando anúncio..." : "Assistir anúncio e ganhar PR"}
            </span>
            <span className="block text-xs font-medium text-white/85 sm:text-sm">
              Atalho mais rápido para puxar PR
            </span>
          </span>
        </div>
        <span className="hidden items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-white/95 sm:inline-flex">
          <Sparkles className="h-3.5 w-3.5 text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
          Mais PR
        </span>
      </div>
    </Button>
  );
}
