"use client";

import { PrizeCard } from "@/components/cards/PrizeCard";

export default function LojaPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Loja</h1>
      <PrizeCard
        title="Skins e boosts"
        subtitle="Itens gastam coins/gems — preços virão de `system_configs` e coleção `games`."
      />
      <p className="text-sm text-white/55">
        Estrutura pronta: transações tipo <code className="text-violet-300">compra</code> na carteira.
      </p>
    </div>
  );
}
