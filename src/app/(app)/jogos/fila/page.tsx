import { Suspense } from "react";
import { FilaClient } from "./FilaClient";

export default function FilaPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-white/55">Carregando fila…</p>}
    >
      <FilaClient />
    </Suspense>
  );
}
