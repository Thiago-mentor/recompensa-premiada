import { Suspense } from "react";
import { EscolherNomeForm } from "./EscolherNomeForm";

export default function EscolherNomePage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-white/60">Carregando seu perfil…</div>}>
      <EscolherNomeForm />
    </Suspense>
  );
}
