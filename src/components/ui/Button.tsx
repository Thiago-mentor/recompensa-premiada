import { cn } from "@/lib/utils/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "arena"
  | "gold"
  | "jackpot";

const variants: Record<Variant, string> = {
  primary:
    "border border-fuchsia-400/40 bg-[linear-gradient(135deg,#5b21b6_0%,#7c3aed_28%,#a855f7_58%,#ec4899_100%)] !text-white shadow-[0_0_36px_-8px_rgba(236,72,153,0.55),0_0_56px_-18px_rgba(139,92,246,0.45),inset_0_1px_0_rgba(255,255,255,0.22)] hover:brightness-110 hover:shadow-[0_0_48px_-6px_rgba(244,114,182,0.5),0_0_72px_-14px_rgba(167,139,250,0.4)] active:scale-[0.98]",
  jackpot:
    "border border-fuchsia-400/55 bg-[linear-gradient(135deg,#4c1d95_0%,#6d28d9_22%,#a21caf_52%,#db2777_78%,#f472b6_100%)] !text-white shadow-[0_0_44px_-6px_rgba(236,72,153,0.7),0_0_88px_-24px_rgba(139,92,246,0.55),inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.15)] hover:brightness-[1.08] hover:shadow-[0_0_56px_-4px_rgba(244,114,182,0.6),0_0_96px_-18px_rgba(124,58,237,0.5)] active:scale-[0.98]",
  gold:
    "border border-amber-300/55 bg-[linear-gradient(180deg,#fde047_0%,#facc15_32%,#eab308_62%,#ca8a04_100%)] !text-amber-950 shadow-[0_0_32px_-6px_rgba(250,204,21,0.62),inset_0_1px_0_rgba(255,255,255,0.5)] hover:brightness-110 active:scale-[0.98]",
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
        "template-3d-button inline-flex items-center justify-center gap-2 font-semibold transition duration-200 disabled:pointer-events-none disabled:opacity-50",
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

/** Classes do botão dourado para usar em <Link> (mesmo visual que variant="gold"). */
export function goldButtonLinkClassName(className?: string) {
  return cn(
    "template-3d-button inline-flex w-full items-center justify-center gap-2 font-semibold transition duration-200",
    sizes.lg,
    variants.gold,
    className,
  );
}

/** CTA principal roxo→rosa com glow máximo (uso em shell / destaques). */
export function premiumHeroLinkClassName(className?: string) {
  return cn(
    "template-3d-button inline-flex w-full items-center justify-center gap-2 font-bold tracking-wide transition duration-200",
    sizes.lg,
    variants.jackpot,
    className,
  );
}
