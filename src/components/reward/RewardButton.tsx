import { Button } from "@/components/ui/Button";
import { Play } from "lucide-react";

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
      className="w-full text-base py-4"
      onClick={onClick}
      disabled={loading}
    >
      <Play className="h-5 w-5" />
      {loading ? "Carregando anúncio…" : "Assistir anúncio e ganhar PR"}
    </Button>
  );
}
