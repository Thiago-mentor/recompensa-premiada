import { redirect } from "next/navigation";

/** Quiz só existe em 1v1 (fila). Não há modo “contra a casa”. */
export default function QuizPage() {
  redirect("/jogos/fila?gameId=quiz&buscar=1");
}
