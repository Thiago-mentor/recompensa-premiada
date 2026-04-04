import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { RequireAdmin } from "@/lib/guards/RequireAdmin";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAdmin>
      <AdminShell>{children}</AdminShell>
    </RequireAdmin>
  );
}
