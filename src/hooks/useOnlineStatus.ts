"use client";

import { useEffect, useState } from "react";

export function useOnlineStatus() {
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );

  useEffect(() => {
    const setOnlineState = () => setOnline(true);
    const setOfflineState = () => setOnline(false);
    window.addEventListener("online", setOnlineState);
    window.addEventListener("offline", setOfflineState);
    return () => {
      window.removeEventListener("online", setOnlineState);
      window.removeEventListener("offline", setOfflineState);
    };
  }, []);

  return online;
}
