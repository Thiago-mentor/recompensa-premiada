import { redirect } from "next/navigation";

export default function PptLegacyRedirect() {
  redirect("/jogos/fila?gameId=ppt&buscar=1");
}
