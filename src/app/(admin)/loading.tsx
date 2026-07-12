export default function AdminLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Carregando painel">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-white/10" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
        <div className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
        <div className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
      </div>
      <div className="h-56 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
    </div>
  );
}
