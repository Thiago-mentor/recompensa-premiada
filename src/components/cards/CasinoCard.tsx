import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type CasinoCardProps = {
  children: ReactNode;
  className?: string;
  /** área de conteúdo (padding padrão se omitido) */
  contentClassName?: string;
  /** rodapé com CTA (ex.: botão dourado) */
  footer?: ReactNode;
  /** Desativa inclinação 3D (ex.: painel admin). */
  disableHud3d?: boolean;
};

/**
 * Card estilo cassino: fundo roxo neon, borda com glow e área opcional de rodapé.
 */
export function CasinoCard({  children,
  className,
  contentClassName,
  footer,
  disableHud3d = false,
}: CasinoCardProps) {
  return (
    <section
      className={cn(
        !disableHud3d && "game-stage-3d-surface",
        "casino-card-3d template-3d-lift relative overflow-hidden rounded-[1.375rem] border border-violet-500/50 bg-[linear-gradient(152deg,rgba(76,29,149,0.5)_0%,rgba(49,46,129,0.55)_20%,rgba(30,27,75,0.82)_48%,rgba(15,23,42,0.92)_78%,rgba(7,11,26,0.96)_100%)] text-white shadow-[0_0_0_1px_rgba(167,139,250,0.2),0_10px_0_-6px_rgba(10,7,28,0.95),0_18px_44px_-18px_rgba(0,0,0,0.72),0_0_52px_-12px_rgba(139,92,246,0.65),0_0_88px_-28px_rgba(59,130,246,0.4),0_0_100px_-36px_rgba(236,72,153,0.28),inset_0_2px_8px_rgba(255,255,255,0.12),inset_0_-14px_24px_rgba(0,0,0,0.28)]",
        className,
      )}
    >
      <div className={cn("p-4 sm:p-5", contentClassName)}>{children}</div>
      {footer ? (
        <div className="border-t border-violet-400/35 bg-[linear-gradient(180deg,rgba(15,10,40,0.75),rgba(7,8,22,0.85))] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-5">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
