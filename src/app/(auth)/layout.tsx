import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 bg-[#070712] text-white">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
