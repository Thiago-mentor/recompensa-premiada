import type { SystemEconomyConfig } from "@/types/systemConfig";

export const BOOST_SYSTEM_DEFAULT_ENABLED = false;

export function isBoostSystemEnabled(
  config: Partial<Pick<SystemEconomyConfig, "boostEnabled">> | null | undefined,
): boolean {
  return config?.boostEnabled === true;
}
