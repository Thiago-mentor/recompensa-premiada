import { Suspense } from "react";
import { CadastroForm } from "./CadastroForm";

export default function CadastroPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <CadastroForm />
    </Suspense>
  );
}
