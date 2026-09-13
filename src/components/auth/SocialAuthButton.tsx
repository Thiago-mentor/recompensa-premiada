"use client";

import { Button } from "@/components/ui/Button";

type SocialProvider = "google" | "facebook";

export function SocialAuthButton({
  provider,
  label,
  disabled,
  onClick,
}: {
  provider: SocialProvider;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="primary"
      className="w-full"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <span
        aria-hidden="true"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/25 bg-white/15 text-lg font-black leading-none text-white shadow-inner"
      >
        {provider === "google" ? "G" : "f"}
      </span>
      {label}
    </Button>
  );
}
