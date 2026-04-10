"use client";

import { useEffect } from "react";
import { ensureNativeAdMobStarted } from "@/services/anuncios/nativeAdMobService";

export function MobileAdProvider() {
  useEffect(() => {
    void ensureNativeAdMobStarted();
  }, []);

  return null;
}
