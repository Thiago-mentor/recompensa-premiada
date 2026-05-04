import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function AdminSectionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "admin-panel-surface rounded-[1.7rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_10px_0_-6px_rgba(2,6,23,0.95),0_24px_54px_-24px_rgba(0,0,0,0.78),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-10px_22px_rgba(0,0,0,0.22)]",
        className,
      )}
    >
      {children}
    </section>
  );
}
