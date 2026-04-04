/**
 * Valores usados no modo Spark (sem Cloud Functions).
 * DEVEM estar alinhados com `firestore.rules` (comentário SPARK_ECONOMY).
 * Ao migrar para Blaze, prefira `system_configs/economy` + Functions.
 */
export const SPARK_ECONOMY = {
  welcomeBonus: 100,
  dailyLoginBonus: 50,
  rewardAdCoinAmount: 25,
  limiteDiarioAds: 20,
  referralBonusIndicador: 200,
  referralBonusConvidado: 100,
} as const;
