import { cn } from "@/lib/utils/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "arena";

const variants: Record<Variant, string> = {
  primary:
    "border border-fuchsia-400/30 bg-[linear-gradient(135deg,rgba(124,58,237,0.98),rgba(217,70,239,0.94))] !text-white shadow-[0_0_30px_-10px_rgba(217,70,239,0.5)] hover:brightness-110 active:scale-[0.98]",
  secondary:
    "border border-cyan-400/18 bg-[linear-gradient(180deg,rgba(5,10,24,0.95),rgba(7,12,28,0.88))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-cyan-400/32 hover:bg-cyan-500/10 hover:shadow-[0_0_24px_-12px_rgba(34,211,238,0.45)] active:scale-[0.98]",
  ghost:
    "border border-white/10 bg-black/20 text-white/88 hover:border-white/15 hover:bg-white/[0.06] active:scale-[0.98]",
  danger:
    "border border-red-400/30 bg-[linear-gradient(135deg,rgba(220,38,38,0.96),rgba(153,27,27,0.94))] text-white shadow-[0_0_30px_-12px_rgba(248,113,113,0.42)] hover:brightness-110 active:scale-[0.98]",
  arena:
    "border border-cyan-300/30 bg-[linear-gradient(135deg,rgba(8,145,178,0.98),rgba(109,40,217,0.92),rgba(217,70,239,0.9))] !text-white shadow-[0_0_32px_-8px_rgba(34,211,238,0.5)] hover:brightness-110 active:scale-[0.98]",
};

const sizes = {
  md: "min-h-[46px] rounded-[1rem] px-4 py-3 text-sm",
  lg: "min-h-[54px] rounded-[1.2rem] px-6 py-3.5 text-base font-bold tracking-wide",
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
        "inline-flex items-center justify-center gap-2 font-semibold transition duration-200 disabled:pointer-events-none disabled:opacity-50",
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
