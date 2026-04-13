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
        "rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-white/45",
        className,
      )}
    >
      {children}
    </div>
  );
}
