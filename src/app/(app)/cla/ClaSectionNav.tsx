"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/constants/routes";
import { Crown, MessageCircle, Settings2, Users } from "lucide-react";

const items = [
  { href: ROUTES.cla, label: "Visão geral", short: "Clã", icon: Crown },
  { href: ROUTES.claMembros, label: "Membros", short: "Membros", icon: Users },
  { href: ROUTES.claChat, label: "Chat", short: "Chat", icon: MessageCircle },
  { href: ROUTES.claConfiguracoes, label: "Configurações", short: "Ajustes", icon: Settings2 },
] as const;

export function ClaSectionNav() {
  const pathname = usePathname();

  return (
    <nav
      className="game-panel sticky top-0 z-20 -mx-1 rounded-[1.5rem] px-1 py-1.5 shadow-[0_12px_40px_-16px_rgba(34,211,238,0.24)] sm:static"
      aria-label="Seções do clã"
    >
      <div
        role="tablist"
        className="flex snap-x snap-mandatory gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map(({ href, label, short, icon: Icon }) => {
          const selected =
            href === ROUTES.cla
              ? pathname === ROUTES.cla
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              role="tab"
              aria-selected={selected}
              className={cn(
                "flex min-w-[24%] shrink-0 snap-center items-center justify-center gap-2 rounded-[1rem] border px-3 py-3 text-left text-sm font-semibold transition sm:min-w-0 sm:flex-1",
                selected
                  ? "border-cyan-400/25 bg-cyan-500/12 text-white shadow-[0_0_24px_-14px_rgba(34,211,238,0.45)]"
                  : "border-transparent text-white/50 hover:border-white/10 hover:bg-white/[0.04] hover:text-white/85",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span className="min-w-0 sm:hidden">{short}</span>
              <span className="hidden min-w-0 sm:inline">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
