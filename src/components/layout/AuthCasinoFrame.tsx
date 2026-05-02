"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CasinoCard } from "@/components/cards/CasinoCard";
import { goldButtonLinkClassName } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants/routes";

export function AuthCasinoFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const footer =
    pathname === ROUTES.cadastro ? (
      <Link href={ROUTES.login} className={goldButtonLinkClassName()}>
        Entrar
      </Link>
    ) : (
      <Link href={ROUTES.cadastro} className={goldButtonLinkClassName()}>
        Criar conta
      </Link>
    );

  return (
    <div className="template-3d-scene min-h-dvh flex flex-col items-center justify-center px-4 py-10 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.3),transparent_48%),radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.12),transparent_34%),#070712] text-white">
      <div className="game-stage-3d w-full max-w-md">
        <CasinoCard footer={footer}>{children}</CasinoCard>
      </div>
    </div>
  );
}
