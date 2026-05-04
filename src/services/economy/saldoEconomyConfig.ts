"use client";

import { fetchEconomyConfigDocument } from "@/services/systemConfigs/economyDocumentCache";

/** Pontos de saldo (resgate) por cada R$ 1,00 (mín. 1 no servidor; padrão 100). */
export async function fetchSaldoPointsPerReal(): Promise<number> {
  const d = (await fetchEconomyConfigDocument()) ?? {};
  const n = Math.floor(
    Number(
      (d as { saldoPointsPerReal?: unknown; cashPointsPerReal?: unknown }).saldoPointsPerReal ??
        (d as { cashPointsPerReal?: unknown }).cashPointsPerReal,
    ),
  );
  return Number.isFinite(n) && n >= 1 ? n : 100;
}

export function saldoPointsToBrl(points: number, saldoPointsPerReal: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0;
  const rate = Number.isFinite(saldoPointsPerReal) && saldoPointsPerReal >= 1 ? saldoPointsPerReal : 100;
  return points / rate;
}

export function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
