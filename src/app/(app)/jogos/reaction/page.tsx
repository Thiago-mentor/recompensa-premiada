import { redirect } from "next/navigation";
import { ReactionGameScreen } from "@/modules/jogos";

/** Solo só para teste: `?teste=1` ou `NEXT_PUBLIC_REACTION_SOLO_TEST=true`. */
export default async function ReactionPage({
  searchParams,
}: {
  searchParams: Promise<{ teste?: string }>;
}) {
  const sp = await searchParams;
  const soloTest =
    sp.teste === "1" || process.env.NEXT_PUBLIC_REACTION_SOLO_TEST === "true";
  if (!soloTest) {
    redirect("/jogos/fila?gameId=reaction_tap&buscar=1");
  }
  return <ReactionGameScreen />;
}
