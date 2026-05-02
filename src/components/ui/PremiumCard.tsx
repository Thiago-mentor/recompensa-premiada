import { cn } from "@/lib/utils/cn";
import type { ComponentProps } from "react";

/**
 * Card elevado estilo app de recompensas: gradiente roxo→azul escuro, borda neon e profundidade.
 * Usa a classe global `.casino-panel` (definida em globals.css).
 */
export function PremiumCard({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("casino-panel template-3d-lift", className)} {...props} />;
}

/**
 * Superfície interna / secundária com gradiente suave e glow contido.
 * Usa `.casino-panel-soft`.
 */
export function PremiumInsetCard({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("casino-panel-soft template-3d-lift", className)} {...props} />;
}
