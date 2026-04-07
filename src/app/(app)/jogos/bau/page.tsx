import { ROUTES } from "@/lib/constants/routes";
import { redirect } from "next/navigation";

export default function BauPage() {
  redirect(`${ROUTES.recursos}/bau`);
}
