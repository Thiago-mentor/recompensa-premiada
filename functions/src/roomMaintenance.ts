/** Terminal rooms must no longer participate in deadline/idle sweeps. */
export function isTerminalRoom(room: Record<string, unknown>): boolean {
  return room.phase === "completed" || room.status === "completed" ||
    room.status === "cancelled" || room.pptRewardsApplied === true ||
    room.quizRewardsApplied === true || room.reactionRewardsApplied === true ||
    room.cardBattleRewardsApplied === true;
}
