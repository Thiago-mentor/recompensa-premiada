export type Hand = "pedra" | "papel" | "tesoura";

const beats: Record<Hand, Hand> = {
  pedra: "tesoura",
  papel: "pedra",
  tesoura: "papel",
};

export function randomHouseHand(rng: () => number = Math.random): Hand {
  const choices: Hand[] = ["pedra", "papel", "tesoura"];
  return choices[Math.floor(rng() * 3)]!;
}

/** Resolve rodada contra a casa. */
export function resolvePptRound(
  user: Hand,
  house: Hand,
): { resultado: "vitoria" | "derrota" | "empate"; user: Hand; house: Hand } {
  if (user === house) return { resultado: "empate", user, house };
  if (beats[user] === house) return { resultado: "vitoria", user, house };
  return { resultado: "derrota", user, house };
}

/** Score bruto enviado ao servidor (normalização ocorre no backend). */
export function pptClientScore(resultado: "vitoria" | "derrota" | "empate"): number {
  if (resultado === "vitoria") return 100;
  if (resultado === "empate") return 40;
  return 0;
}
