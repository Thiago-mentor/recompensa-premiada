import { redirect } from "next/navigation";

export default function CardBattlePage() {
  redirect("/jogos/fila?gameId=card_battle&buscar=1");
}
