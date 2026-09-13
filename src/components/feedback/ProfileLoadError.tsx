"use client";

export function ProfileLoadError({ message }: { message: string }) {
  return (
    <div role="alert" className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center text-white">
      <div aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/30 bg-amber-300/10 text-2xl text-amber-200">!</div>
      <div>
        <h2 className="text-lg font-bold">Não conseguimos abrir seu perfil</h2>
        <p className="mt-2 text-sm text-white/65">{message}</p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-11 rounded-xl border border-amber-300/50 bg-amber-300 px-5 py-2.5 text-sm font-bold text-amber-950 transition hover:brightness-110"
      >
        Tentar novamente
      </button>
    </div>
  );
}
