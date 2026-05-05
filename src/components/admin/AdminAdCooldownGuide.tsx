"use client";

import Link from "next/link";
import { Timer } from "lucide-react";
import { ROUTES } from "@/lib/constants/routes";

/** Resumo com links: onde ajustar limite diário e intervalo entre anúncios recompensados. */
export function AdminAdCooldownGuide() {
  return (
    <aside className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-sm text-slate-300">
      <div className="flex gap-3">
        <Timer className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
        <div className="min-w-0 space-y-2">
          <p className="font-semibold text-white">Limite e tempo entre anúncios — onde configurar</p>
          <ul className="list-disc space-y-1.5 pl-4 text-xs text-slate-400">
            <li>
              <span className="text-slate-200">Limite diário</span> (máximo de anúncios recompensados válidos por
              dia, global):{" "}
              <Link className="font-medium text-cyan-300 underline hover:text-cyan-200" href={ROUTES.admin.configuracoes}>
                Configurações
              </Link>
              , bloco &quot;Recompensas e limites&quot;, campo &quot;Limite diário de ads&quot;.
            </li>
            <li>
              <span className="text-slate-200">Intervalo no sorteio</span> (entre um número por anúncio e o próximo,
              no mesmo sorteio):{" "}
              <Link className="font-medium text-cyan-300 underline hover:text-cyan-200" href={ROUTES.admin.sorteios}>
                Sorteios
              </Link>
              , modo &quot;Anúncio recompensado&quot;, campo &quot;Intervalo mínimo entre anúncios (minutos)&quot;.
            </li>
            <li>
              <span className="text-slate-200">Intervalo entre anúncios de aceleração do baú</span> (speedup):{" "}
              <Link className="font-medium text-cyan-300 underline hover:text-cyan-200" href={ROUTES.admin.baus}>
                Baús
              </Link>
              , painel &quot;Sistema de baús&quot;, seção &quot;Capacidade e anúncios&quot;, &quot;Cooldown entre anúncios
              (min)&quot;.
            </li>
          </ul>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Em <strong className="text-slate-400">Baús</strong>, o campo &quot;Cooldown do mini-jogo Baú&quot;
            refere-se ao mini-jogo legado (espera entre coletas), não ao intervalo entre anúncios de speedup do
            sistema atual.
          </p>
        </div>
      </div>
    </aside>
  );
}
