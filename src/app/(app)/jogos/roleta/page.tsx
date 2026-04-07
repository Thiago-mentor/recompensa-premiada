import { ROUTES } from "@/lib/constants/routes";
import { redirect } from "next/navigation";

export default function RoletaPage() {
  redirect(`${ROUTES.recursos}/roleta`);
}
