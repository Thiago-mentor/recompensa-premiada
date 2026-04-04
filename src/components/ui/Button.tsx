import { cn } from "@/lib/utils/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "arena";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-violet-600 to-fuchsia-600 !text-white shadow-lg shadow-violet-900/40 hover:brightness-110 active:scale-[0.98]",
  secondary:
    "bg-white/10 text-white border border-white/15 hover:bg-white/15 hover:border-cyan-400/25 hover:shadow-[0_0_20px_-4px_rgba(34,211,238,0.35)] active:scale-[0.98]",
  ghost: "text-white/90 hover:bg-white/10 active:scale-[0.98]",
  danger: "bg-red-600/90 text-white hover:bg-red-600 active:scale-[0.98]",
  arena:
    "bg-gradient-to-r from-cyan-600/90 via-violet-600 to-fuchsia-600 !text-white shadow-[0_0_28px_-6px_rgba(34,211,238,0.45)] border border-cyan-400/30 hover:brightness-110 active:scale-[0.98]",
};

const sizes = {
  md: "min-h-[44px] px-4 py-3 text-sm rounded-xl",
  lg: "min-h-[52px] px-6 py-3.5 text-base rounded-2xl font-bold tracking-wide",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: keyof typeof sizes;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition duration-200 disabled:opacity-50 disabled:pointer-events-none",
        sizes[size],
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
