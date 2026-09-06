"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTerminalRoom = isTerminalRoom;
/** Terminal rooms must no longer participate in deadline/idle sweeps. */
function isTerminalRoom(room) {
    return room.phase === "completed" || room.status === "completed" ||
        room.status === "cancelled" || room.pptRewardsApplied === true ||
        room.quizRewardsApplied === true || room.reactionRewardsApplied === true ||
        room.cardBattleRewardsApplied === true;
}
//# sourceMappingURL=roomMaintenance.js.map