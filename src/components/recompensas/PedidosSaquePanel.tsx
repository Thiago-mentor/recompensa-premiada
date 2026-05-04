"use client";

import { CheckCircle2, Circle, FileCheck2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { RewardClaim, RewardClaimStatus } from "@/types/reward";
import { saldoPointsToBrl, formatBrl } from "@/services/economy/saldoEconomyConfig";

function formatPedidoData(criadoEm: unknown): string {
  if (
    criadoEm &&
    typeof criadoEm === "object" &&
    "toDate" in criadoEm &&
    typeof (criadoEm as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      return (criadoEm as { toDate: () => Date }).toDate().toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return "—";
    }
  }
  return "—";
}

type Etapa = "registro" | "analise" | "processo" | "fim";

function etapasAtivas(status: RewardClaimStatus): { feitas: Etapa[]; atual: Etapa | null; falhou: boolean } {
  switch (status) {
    case "pendente":
      return { feitas: ["registro"], atual: "analise", falhou: false };
    case "aprovado":
      return { feitas: ["registro", "analise"], atual: "processo", falhou: false };
    case "confirmado":
      return { feitas: ["registro", "analise", "processo"], atual: null, falhou: false };
    case "recusado":
      return { feitas: ["registro"], atual: "analise", falhou: true };
    default:
      return { feitas: ["registro"], atual: "analise", falhou: false };
  }
}

function Traco({ concluido }: { concluido: boolean }) {
  return (
    <div
      className={cn(
        "mx-1 h-0.5 min-w-[1.25rem] flex-1 rounded-full sm:mx-2",
        concluido ? "bg-emerald-500/70" : "bg-white/10",
      )}
      aria-hidden
    />
  );
}

function PedidoStepper({ status }: { status: RewardClaimStatus }) {
  const { feitas, atual, falhou } = etapasAtivas(status);

  const dot = (key: Etapa, label: string, sub: string) => {
    const done = feitas.includes(key);
    const current = atual === key && !falhou;
    const isFail = falhou && key === "analise";

    return (
      <div className="flex min-w-0 flex-1 flex-col items-center text-center">
        <div className="flex w-full items-center justify-center">
          {isFail ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-rose-500/60 bg-rose-500/15 text-rose-300">
              <XCircle className="h-5 w-5" aria-hidden />
            </span>
          ) : done ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-emerald-500/50 bg-emerald-500/15 text-emerald-300">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            </span>
          ) : current ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-400/60 bg-amber-500/15 text-amber-200">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            </span>
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/25">
              <Circle className="h-5 w-5" aria-hidden />
            </span>
          )}
        </div>
        <p className={cn("mt-2 text-[11px] font-bold uppercase tracking-wide", isFail ? "text-rose-200" : "text-white/70")}>
          {label}
        </p>
        {sub ? <p className="mt-0.5 px-1 text-[10px] leading-snug text-white/40">{sub}</p> : null}
      </div>
    );
  };

  const tracoRegistroAnalise = true;
  const tracoAnaliseProcesso = status === "aprovado" || status === "confirmado";
  const labelAnalise = status === "recusado" ? "Recusado" : "Análise";
  const labelProcesso = status === "confirmado" ? "PIX enviado" : "Pagamento";
  const subProcesso =
    status === "aprovado"
      ? "Aguardando comprovante"
      : status === "confirmado"
        ? "Comprovante disponível"
        : "";

  return (
    <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/25 px-2 py-4 sm:px-4">
      <div className="flex items-start justify-between gap-0 sm:gap-1">
        {dot("registro", "Registro", "")}
        <Traco concluido={tracoRegistroAnalise} />
        {dot("analise", labelAnalise, "")}
        <Traco concluido={tracoAnaliseProcesso} />
        {dot("processo", labelProcesso, subProcesso)}
      </div>
      <p className="sr-only">Status do pedido: {status}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: RewardClaimStatus }) {
  const cfg =
    status === "pendente"
      ? {
          className: "border-amber-400/35 bg-amber-500/10 text-amber-100",
          label: "Em análise",
        }
      : status === "aprovado"
        ? {
            className: "border-emerald-400/35 bg-emerald-500/10 text-emerald-100",
            label: "Pagamento em andamento",
          }
        : status === "confirmado"
          ? {
              className: "border-cyan-400/35 bg-cyan-500/10 text-cyan-100",
              label: "PIX confirmado",
            }
          : {
              className: "border-rose-400/35 bg-rose-500/10 text-rose-100",
              label: "Recusado",
            };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-wide",
        cfg.className,
      )}
    >
      {status === "pendente" ? <Loader2 className="h-3.5 w-3.5 animate-spin opacity-80" aria-hidden /> : null}
      {status === "aprovado" ? <ShieldCheck className="h-3.5 w-3.5 opacity-90" aria-hidden /> : null}
      {status === "confirmado" ? <FileCheck2 className="h-3.5 w-3.5 opacity-90" aria-hidden /> : null}
      {status === "recusado" ? <XCircle className="h-3.5 w-3.5 opacity-90" aria-hidden /> : null}
      {cfg.label}
    </span>
  );
}

export function PedidosSaquePanel({
  pedidos,
  saldoPointsPerReal,
}: {
  pedidos: RewardClaim[];
  saldoPointsPerReal: number;
}) {
  if (pedidos.length === 0) {
    return (
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80">
        <div className="border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Histórico</h2>
        </div>
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-white/40">Nenhum pedido ainda.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80">
      <div className="border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Histórico</h2>
      </div>
      <ul className="divide-y divide-white/[0.06]">
        {pedidos.map((p) => {
          const brl = saldoPointsToBrl(p.valor, saldoPointsPerReal);
          return (
            <li key={p.id} className="px-4 py-4 sm:px-5 sm:py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-[10px] text-white/35">ID {p.id}</p>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-lg font-bold tabular-nums text-white">{p.valor}</span>
                    <span className="text-sm text-white/45">pts saldo</span>
                    <span className="text-sm font-semibold tabular-nums text-emerald-200/90">≈ {formatBrl(brl)}</span>
                  </div>
                  <p className="text-xs text-white/40">{formatPedidoData(p.criadoEm)}</p>
                </div>
                <div className="max-w-full shrink-0">
                  <StatusBadge status={p.status} />
                </div>
              </div>
              <PedidoStepper status={p.status} />
              {p.status === "aprovado" ? (
                <p className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-100/85">
                  Seu pedido foi aprovado e esta aguardando o envio do comprovante PIX.
                </p>
              ) : null}
              {p.status === "confirmado" && p.comprovanteUrl ? (
                <a
                  href={p.comprovanteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-950/25 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-950/40"
                >
                  <FileCheck2 className="h-4 w-4 shrink-0" aria-hidden />
                  Ver comprovante
                </a>
              ) : null}
              {p.status === "recusado" && p.motivoRecusa ? (
                <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-950/30 px-3 py-2 text-xs text-rose-100/90">
                  <span className="font-semibold text-rose-200/95">Motivo informado: </span>
                  {p.motivoRecusa}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
