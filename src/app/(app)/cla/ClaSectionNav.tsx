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
      className={cn(
        "relative sticky top-0 z-20 -mx-1 overflow-hidden rounded-[1.6rem] border border-cyan-400/18 px-1 py-1.5 sm:static",
        "bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(3,7,18,0.92))]",
        "shadow-[0_0_40px_-14px_rgba(139,92,246,0.38),0_14px_36px_-22px_rgba(34,211,238,0.22)]",
      )}
      aria-label="Seções do clã"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/55 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 bottom-0 h-16 w-16 rounded-full bg-fuchsia-500/12 blur-2xl"
      />
      <div
        role="tablist"
        className="relative flex snap-x snap-mandatory gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                "group flex min-w-[24%] shrink-0 snap-center items-center justify-center gap-2 rounded-[1rem] border px-2.5 py-3 text-left text-sm font-semibold transition sm:min-w-0 sm:flex-1 sm:px-3",
                selected
                  ? "border-cyan-400/35 bg-cyan-500/[0.14] text-white shadow-[0_0_28px_-12px_rgba(34,211,238,0.55),inset_0_1px_0_rgb(255_255_255/0.06)]"
                  : "border-transparent text-white/50 hover:border-white/12 hover:bg-white/[0.05] hover:text-white/88",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition",
                  selected
                    ? "border-cyan-400/40 bg-cyan-500/25 text-cyan-50 shadow-[0_0_16px_-4px_rgba(34,211,238,0.55)]"
                    : "border-white/[0.07] bg-black/25 text-white/55 group-hover:border-white/20 group-hover:text-white/80",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 sm:hidden">{short}</span>
              <span className="hidden min-w-0 sm:inline">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
