"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/constants/routes";
import {
  Home,
  ListChecks,
  Gamepad2,
  Trophy,
  Wallet,
  User,
} from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { href: ROUTES.home, label: "Início", icon: Home },
  { href: ROUTES.missoes, label: "Missões", icon: ListChecks },
  { href: ROUTES.jogos, label: "Jogos", icon: Gamepad2 },
  { href: ROUTES.ranking, label: "Ranking", icon: Trophy },
  { href: ROUTES.carteira, label: "Carteira", icon: Wallet },
  { href: ROUTES.perfil, label: "Perfil", icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-dvh flex-col bg-[#070712] text-white">
      <main className="flex-1 pb-24 px-4 pt-4 max-w-lg mx-auto w-full">{children}</main>
      <nav
        className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[#0b0b18]/95 backdrop-blur-md safe-area-pb"
        aria-label="Principal"
      >
        <ul className="mx-auto flex max-w-lg justify-between gap-1 px-2 py-2">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition",
                    active ? "text-violet-300" : "text-white/45 hover:text-white/80",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
