"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants/routes";
import { callFunction } from "@/services/callables/client";

const RETURN_HOME_AFTER_MS = 30 * 60 * 1000;
const ROOM_SYNC_TIMEOUT_MS = 5_000;
const HIDDEN_AT_STORAGE_KEY = "rivaliza:hidden-at";

function readHiddenAt(): number | null {
  try {
    const value = Number(window.sessionStorage.getItem(HIDDEN_AT_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeHiddenAt(value: number) {
  try {
    window.sessionStorage.setItem(HIDDEN_AT_STORAGE_KEY, String(value));
  } catch {
    // Navegadores em modo privado podem bloquear o armazenamento da sessão.
  }
}

function roomIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/jogos\/sala\/([^/]+)\/?$/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

async function syncRoomBeforeLeaving(roomId: string) {
  let timeoutId: number | undefined;
  try {
    await Promise.race([
      callFunction<{ roomId: string }, { ok?: boolean; kind?: string }>("resolvePvpRoomTimeout", {
        roomId,
      }).catch(() => undefined),
      new Promise<undefined>((resolve) => {
        timeoutId = window.setTimeout(() => resolve(undefined), ROOM_SYNC_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

export function SessionResumeGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const handlingResumeRef = useRef(false);

  const handleResume = useCallback(async () => {
    if (document.visibilityState === "hidden" || handlingResumeRef.current) return;

    const now = Date.now();
    const hiddenAt = readHiddenAt();
    writeHiddenAt(now);
    if (hiddenAt == null || now - hiddenAt < RETURN_HOME_AFTER_MS || pathname === ROUTES.home) {
      return;
    }

    handlingResumeRef.current = true;
    const roomId = roomIdFromPathname(pathname);
    if (roomId) await syncRoomBeforeLeaving(roomId);
    router.replace(ROUTES.home, { scroll: true });
  }, [pathname, router]);

  useEffect(() => {
    const markHidden = () => writeHiddenAt(Date.now());
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") markHidden();
      else void handleResume();
    };
    const handlePageShow = () => void handleResume();

    void handleResume();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", markHidden);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", markHidden);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [handleResume]);

  return null;
}
