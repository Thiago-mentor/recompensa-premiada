export default function AppLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-white/10" />
      <div className="h-24 animate-pulse rounded-[1.35rem] border border-white/10 bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 animate-pulse rounded-[1.25rem] border border-white/10 bg-white/[0.04]" />
        <div className="h-28 animate-pulse rounded-[1.25rem] border border-white/10 bg-white/[0.04]" />
      </div>
      <div className="h-44 animate-pulse rounded-[1.35rem] border border-white/10 bg-white/[0.04]" />
    </div>
  );
}
