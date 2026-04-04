import { redirect } from "next/navigation";
import { QuizGameScreen } from "@/modules/jogos";

/** Solo só para teste: `?teste=1` ou `NEXT_PUBLIC_QUIZ_SOLO_TEST=true`. */
export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ teste?: string }>;
}) {
  const sp = await searchParams;
  const soloTest =
    sp.teste === "1" || process.env.NEXT_PUBLIC_QUIZ_SOLO_TEST === "true";
  if (!soloTest) {
    redirect("/jogos/fila?gameId=quiz&buscar=1");
  }
  return <QuizGameScreen />;
}
