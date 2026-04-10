"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { MobileAdProvider } from "@/components/providers/MobileAdProvider";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <MobileAdProvider />
      {children}
    </AuthProvider>
  );
}
