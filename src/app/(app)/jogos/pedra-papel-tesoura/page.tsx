import { redirect } from "next/navigation";
import { PptGameScreen } from "@/modules/jogos";

/** Solo só para teste: `?teste=1` ou `NEXT_PUBLIC_PPT_SOLO_TEST=true`. */
export default async function PedraPapelTesouraPage({
  searchParams,
}: {
  searchParams: Promise<{ teste?: string }>;
}) {
  const sp = await searchParams;
  const soloTest =
    sp.teste === "1" || process.env.NEXT_PUBLIC_PPT_SOLO_TEST === "true";
  if (!soloTest) {
    redirect("/jogos/fila?gameId=ppt&buscar=1");
  }
  return <PptGameScreen />;
}
