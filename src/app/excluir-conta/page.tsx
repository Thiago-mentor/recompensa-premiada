import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { DeleteAccountPanel } from "@/components/account/DeleteAccountPanel";

export const metadata = {
  title: "Excluir conta | Rivaliza",
  description: "Solicite a exclusão permanente da sua conta e dos dados pessoais do Rivaliza.",
};

export default function DeleteAccountPage() {
  return (
    <main className="min-h-dvh bg-[#070b18] px-4 py-10 text-slate-200 sm:px-6">
      <article className="mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950/85 p-6 shadow-2xl shadow-red-950/20 sm:p-10">
        <Link href="/" className="text-sm font-bold text-cyan-300">Rivaliza</Link>
        <div className="mt-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10"><ShieldCheck className="h-6 w-6 text-cyan-200" /></div>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-white">Exclusão de conta e dados</h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">Este é o canal oficial para excluir sua conta Rivaliza. Para proteger seus dados, faça login e confirme a solicitação abaixo.</p>
        <div className="mt-7"><DeleteAccountPanel /></div>
        <div className="mt-7 space-y-2 text-xs leading-6 text-slate-400"><p>São excluídos: autenticação, perfil, avatar, saldos, progresso e dados pessoais vinculados.</p><p>Comprovantes de premiações e sinais antifraude podem ser mantidos anonimizados pelo prazo necessário ao cumprimento legal e à segurança da plataforma.</p><Link href="/privacidade" className="font-semibold text-cyan-300">Consultar Política de Privacidade</Link></div>
      </article>
    </main>
  );
}
