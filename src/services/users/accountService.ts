"use client";

import { callFunction } from "@/services/callables/client";

export async function deleteMyAccount(): Promise<void> {
  await callFunction<{ confirmation: string }, { ok: boolean }>("deleteMyAccount", {
    confirmation: "EXCLUIR",
  });
}
