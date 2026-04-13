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
        "rounded-[1.7rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.75)]",
        className,
      )}
    >
      {children}
    </section>
  );
}
