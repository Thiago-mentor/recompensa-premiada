"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { MobileAdProvider } from "@/components/providers/MobileAdProvider";
import { ServiceWorkerRegistrar } from "@/components/providers/ServiceWorkerRegistrar";
import { ConnectionStatusBanner } from "@/components/providers/ConnectionStatusBanner";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <MobileAdProvider />
      <ServiceWorkerRegistrar />
      <ConnectionStatusBanner />
      {children}
    </AuthProvider>
  );
}
