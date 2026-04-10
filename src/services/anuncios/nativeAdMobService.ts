"use client";

import { type PluginListenerHandle } from "@capacitor/core";
import {
  admobAndroidRewardedUnitIds,
  isNativeAndroidPlatform,
  usingAndroidTestAdMobIds,
} from "@/lib/anuncios/admobConfig";
import type { RewardedAdPlacementId } from "@/lib/constants/rewardedAds";

export type NativeRewardedAdResult =
  | {
      status: "granted";
      completionToken: string;
      rewardType?: string;
      rewardAmount?: number;
    }
  | { status: "skipped" }
  | { status: "failed"; reason: string };

let adMobStartPromise: Promise<void> | null = null;

function createNativeCompletionToken(platform: "android"): string {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  return `native_${platform}_${Date.now()}_${randomPart}`;
}

export async function ensureNativeAdMobStarted(): Promise<void> {
  if (!isNativeAndroidPlatform()) return;
  if (!adMobStartPromise) {
    adMobStartPromise = (async () => {
      const { AdMob } = await import("@capacitor-community/admob");
      await AdMob.initialize({
        initializeForTesting: false,
      });
      if (usingAndroidTestAdMobIds()) {
        console.info("[AdMob] Android inicializado com IDs de teste.");
      }
    })().catch((error) => {
      adMobStartPromise = null;
      throw error;
    });
  }
  await adMobStartPromise;
}

export async function showNativeRewardedAd(
  placementId: RewardedAdPlacementId,
  options?: {
    ssvUserId?: string;
    ssvCustomData?: string;
  },
): Promise<NativeRewardedAdResult> {
  if (!isNativeAndroidPlatform()) {
    return { status: "failed", reason: "Anúncio nativo disponível apenas no Android por enquanto." };
  }

  try {
    await ensureNativeAdMobStarted();
    const {
      AdMob,
      RewardAdPluginEvents,
    } = await import("@capacitor-community/admob");
    const adMob = AdMob as unknown as {
      addListener: (
        eventName: string,
        listenerFunc: (event: unknown) => void,
      ) => Promise<PluginListenerHandle>;
      prepareRewardVideoAd: (options: Record<string, unknown>) => Promise<unknown>;
      showRewardVideoAd: () => Promise<unknown>;
    };
    const adUnitId = admobAndroidRewardedUnitIds[placementId];
    const handles: PluginListenerHandle[] = [];

    return await new Promise<NativeRewardedAdResult>(async (resolve) => {
      let settled = false;

      const finish = async (result: NativeRewardedAdResult) => {
        if (settled) return;
        settled = true;
        await Promise.all(
          handles.map(async (handle) => {
            try {
              await handle.remove();
            } catch {
              /* ignore listener cleanup */
            }
          }),
        );
        resolve(result);
      };

      const addListener = async (
        eventName: string,
        listener: (event: unknown) => void,
      ) => {
        const handle = await adMob.addListener(eventName, listener);
        handles.push(handle);
      };

      try {
        await addListener(RewardAdPluginEvents.Rewarded, (event) => {
          const reward = event as { type?: string; amount?: number } | undefined;
          void finish({
            status: "granted",
            completionToken: createNativeCompletionToken("android"),
            rewardAmount: typeof reward?.amount === "number" ? reward.amount : undefined,
            rewardType: typeof reward?.type === "string" ? reward.type : undefined,
          });
        });
        await addListener(RewardAdPluginEvents.Dismissed, () => {
          void finish({ status: "skipped" });
        });
        await addListener(RewardAdPluginEvents.FailedToLoad, (event) => {
          const reason =
            event && typeof event === "object" && "message" in event
              ? String((event as { message?: unknown }).message || "Falha ao carregar anúncio.")
              : "Falha ao carregar anúncio.";
          void finish({ status: "failed", reason });
        });
        await addListener(RewardAdPluginEvents.FailedToShow, (event) => {
          const reason =
            event && typeof event === "object" && "message" in event
              ? String((event as { message?: unknown }).message || "Falha ao exibir anúncio.")
              : "Falha ao exibir anúncio.";
          void finish({ status: "failed", reason });
        });

        await adMob.prepareRewardVideoAd({
          adId: adUnitId,
          immersiveMode: true,
          ...(options?.ssvUserId || options?.ssvCustomData
            ? {
                ssv: {
                  ...(options?.ssvUserId ? { userId: options.ssvUserId } : {}),
                  ...(options?.ssvCustomData ? { customData: options.ssvCustomData } : {}),
                },
              }
            : {}),
        });
        const rewardItem = (await adMob.showRewardVideoAd()) as
          | {
              amount?: number;
              type?: string;
            }
          | undefined;
        await finish({
          status: "granted",
          completionToken: createNativeCompletionToken("android"),
          rewardAmount: typeof rewardItem?.amount === "number" ? rewardItem.amount : undefined,
          rewardType: typeof rewardItem?.type === "string" ? rewardItem.type : undefined,
        });
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "Não foi possível iniciar o anúncio no Android.";
        await finish({ status: "failed", reason });
      }
    });
  } catch (error) {
    return {
      status: "failed",
      reason:
        error instanceof Error ? error.message : "Erro ao inicializar o AdMob nativo no Android.",
    };
  }
}
