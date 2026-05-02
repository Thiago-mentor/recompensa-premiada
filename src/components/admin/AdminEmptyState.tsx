import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function AdminEmptyState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "template-3d-lift rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-white/45 shadow-[0_16px_34px_-24px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
