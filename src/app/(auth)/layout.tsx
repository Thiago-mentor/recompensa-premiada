import type { ReactNode } from "react";
import { AuthCasinoFrame } from "@/components/layout/AuthCasinoFrame";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthCasinoFrame>{children}</AuthCasinoFrame>;
}
