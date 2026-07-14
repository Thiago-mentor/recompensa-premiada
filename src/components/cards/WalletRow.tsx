import type { WalletCurrency, WalletTransaction } from "@/types/wallet";

const moedaDisplay: Record<WalletCurrency, string> = {
  coins: "PR",
  gems: "TICKET",
  rewardBalance: "Saldo (pontos)",
};
import { cn } from "@/lib/utils/cn";

const tipoLabel: Record<WalletTransaction["tipo"], string> = {
  missao: "Missão",
  streak: "Streak",
  anuncio: "Anúncio",
  bau: "Baú",
  sorteio_compra: "Sorteio (compra)",
  sorteio_estorno: "Sorteio (estorno)",
  sorteio_premio: "Sorteio (prêmio)",
  vitoria: "Vitória",
  derrota: "Derrota",
  jogo: "Jogo",
  jogo_pvp: "PvP",
  compra: "Compra",
  bonus_admin: "Bônus",
  ranking: "Ranking",
  referral: "Convite",
  ajuste: "Ajuste",
  resgate: "Resgate",
  resgate_pendente: "Saque (retenção)",
  conversao: "Conversão",
};

function formatTransactionDate(value: WalletTransaction["criadoEm"]): {
  label: string;
  iso: string | undefined;
} {
  if (!value || typeof (value as { toDate?: unknown }).toDate !== "function") {
    return { label: "Data pendente", iso: undefined };
  }

  try {
    const date = (value as { toDate: () => Date }).toDate();
    return {
      label: date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      iso: date.toISOString(),
    };
  } catch {
    return { label: "Data indisponivel", iso: undefined };
  }
}

export function WalletRow({ tx }: { tx: WalletTransaction }) {
  const positive = tx.valor >= 0;
  const date = formatTransactionDate(tx.criadoEm);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-3 text-sm last:border-0">
      <div className="min-w-0">
        <p className="font-medium text-white truncate">{tx.descricao}</p>
        <p className="text-xs text-white/50">
          {tipoLabel[tx.tipo]} · {moedaDisplay[tx.moeda] ?? tx.moeda}
        </p>
        <time className="mt-0.5 block text-[11px] text-white/35" dateTime={date.iso}>
          {date.label}
        </time>
      </div>
      <span
        className={cn(
          "shrink-0 font-semibold tabular-nums",
          positive ? "text-emerald-300" : "text-rose-300",
        )}
      >
        {positive ? "+" : ""}
        {tx.valor}
      </span>
    </div>
  );
}
