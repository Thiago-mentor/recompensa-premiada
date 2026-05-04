"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ROULETTE_TABLE = exports.MAX_MATCHES_PER_MINUTE = exports.GAME_COOLDOWN_SEC = void 0;
exports.pickWeightedCoins = pickWeightedCoins;
exports.rouletteTableEntries = rouletteTableEntries;
exports.pickWeightedRoulettePrize = pickWeightedRoulettePrize;
exports.wheelSliceIndexForServerPrize = wheelSliceIndexForServerPrize;
exports.pickRoulettePrize = pickRoulettePrize;
exports.pickBauLoot = pickBauLoot;
exports.clampScore = clampScore;
exports.rankingPointsFrom = rankingPointsFrom;
exports.resolveMatchEconomy = resolveMatchEconomy;
exports.GAME_COOLDOWN_SEC = {
    ppt: 2,
    quiz: 3,
    reaction_tap: 4,
    roleta: 12,
    bau: 4 * 3600,
    numero_secreto: 2,
};
exports.MAX_MATCHES_PER_MINUTE = 28;
exports.DEFAULT_ROULETTE_TABLE = [
    { coins: 10, weight: 22 },
    { coins: 25, weight: 20 },
    { coins: 50, weight: 18 },
    { coins: 75, weight: 15 },
    { coins: 100, weight: 12 },
    { coins: 150, weight: 8 },
    { coins: 200, weight: 5 },
];
function rowCurrencyKind(row) {
    if (row.kind === "chest")
        return "chest";
    if (row.kind === "gems")
        return "gems";
    if (row.kind === "rewardBalance")
        return "rewardBalance";
    return "coins";
}
const BAU_LOOT = [
    { coins: 15, weight: 25 },
    { coins: 40, weight: 25 },
    { coins: 80, weight: 20 },
    { coins: 120, weight: 15 },
    { coins: 200, weight: 10 },
    { coins: 350, weight: 5 },
];
function pickWeightedCoins(table, rng) {
    const total = table.reduce((s, x) => s + Math.max(0, x.weight), 0);
    let r = rng() * total;
    for (const row of table) {
        r -= Math.max(0, row.weight);
        if (r <= 0)
            return Math.max(0, Math.floor(row.coins));
    }
    const last = table[table.length - 1];
    return last ? Math.max(0, Math.floor(last.coins)) : 0;
}
const KNOWN_CHEST_ORDER = ["comum", "raro", "epico", "lendario"];
/** Fatias válidas para o sorteio (peso e meta bem definidos). */
function rouletteTableEntries(table) {
    const rows = table.length > 0 ? table : exports.DEFAULT_ROULETTE_TABLE;
    const out = [];
    for (const row of rows) {
        const w = Math.max(0, Math.floor(Number(row.weight) || 0));
        if (w <= 0)
            continue;
        const segmentKind = rowCurrencyKind(row);
        if (segmentKind === "chest") {
            const r = row.chestRarity;
            if (!r || !KNOWN_CHEST_ORDER.includes(r))
                continue;
            out.push({ weight: w, pick: { kind: "chest", chestRarity: r } });
            continue;
        }
        const amount = Math.max(0, Math.floor(Number(row.coins) || 0));
        if (amount <= 0)
            continue;
        out.push({ weight: w, pick: { kind: segmentKind, amount } });
    }
    return out;
}
function pickWeightedRoulettePrize(table, rng) {
    let entries = rouletteTableEntries(table);
    if (entries.length === 0)
        entries = rouletteTableEntries(exports.DEFAULT_ROULETTE_TABLE);
    const total = entries.reduce((s, e) => s + e.weight, 0);
    if (total <= 0)
        return { kind: "coins", amount: exports.DEFAULT_ROULETTE_TABLE[0].coins };
    let r = rng() * total;
    for (const e of entries) {
        r -= e.weight;
        if (r <= 0)
            return e.pick;
    }
    return entries[entries.length - 1].pick;
}
function rowEffectiveKind(row) {
    return row.kind ?? "coins";
}
/** Índice da fatia correspondente ao prêmio retornado pela Cloud Function. */
function wheelSliceIndexForServerPrize(table, resolved) {
    const n = table.length;
    if (n < 1)
        return 0;
    const kind = resolved.roulettePrizeKind;
    if (kind === "chest") {
        const r = resolved.chestRarity;
        if (r && typeof r === "string") {
            const i = table.findIndex((row) => rowEffectiveKind(row) === "chest" && row.chestRarity === r);
            if (i >= 0)
                return i;
        }
        const j = table.findIndex((row) => rowEffectiveKind(row) === "chest");
        return j >= 0 ? j : 0;
    }
    if (kind === "gems") {
        const amt = Math.max(0, Math.floor(Number(resolved.rewardGems ?? resolved.rouletteRewardAmount ?? 0) || 0));
        const i = table.findIndex((row) => rowEffectiveKind(row) === "gems" && row.coins === amt);
        if (i >= 0)
            return i;
        const j = table.findIndex((row) => rowEffectiveKind(row) === "gems");
        return j >= 0 ? j : 0;
    }
    if (kind === "rewardBalance") {
        const amt = Math.max(0, Math.floor(Number(resolved.rewardSaldo ?? resolved.rouletteRewardAmount ?? 0) || 0));
        const i = table.findIndex((row) => rowEffectiveKind(row) === "rewardBalance" && row.coins === amt);
        if (i >= 0)
            return i;
        const j = table.findIndex((row) => rowEffectiveKind(row) === "rewardBalance");
        return j >= 0 ? j : 0;
    }
    const amt = Math.max(0, Math.floor(Number(resolved.rewardCoins ?? resolved.rouletteRewardAmount ?? 0) || 0));
    const i = table.findIndex((row) => rowEffectiveKind(row) === "coins" && row.coins === amt);
    if (i >= 0)
        return i;
    const j = table.findIndex((row) => rowEffectiveKind(row) === "coins");
    return j >= 0 ? j : 0;
}
function rouletteScoreHintForChest(r) {
    if (r === "comum")
        return 460;
    if (r === "raro")
        return 580;
    if (r === "epico")
        return 740;
    return 860;
}
function pickRoulettePrize(rng = Math.random) {
    return pickWeightedCoins(exports.DEFAULT_ROULETTE_TABLE, rng);
}
function pickBauLoot(rng = Math.random) {
    return pickWeightedCoins(BAU_LOOT, rng);
}
function clampScore(n, min = 0, max = 1000) {
    if (!Number.isFinite(n))
        return min;
    return Math.max(min, Math.min(max, Math.floor(n)));
}
function rankingPointsFrom(normalizedScore, resultado) {
    if (resultado === "vitoria") {
        return Math.max(8, Math.min(120, Math.floor(normalizedScore / 8) + 10));
    }
    if (resultado === "empate")
        return 4;
    return 2;
}
function applyRewardOverrides(resultado, rewardCoins, rankingPoints, overrides) {
    if (!overrides)
        return { rewardCoins, rankingPoints };
    if (resultado === "vitoria") {
        return {
            rewardCoins: overrides.winCoins ?? rewardCoins,
            rankingPoints: overrides.winRankingPoints ?? rankingPoints,
        };
    }
    if (resultado === "empate") {
        return {
            rewardCoins: overrides.drawCoins ?? rewardCoins,
            rankingPoints: overrides.drawRankingPoints ?? rankingPoints,
        };
    }
    return {
        rewardCoins: overrides.lossCoins ?? rewardCoins,
        rankingPoints: overrides.lossRankingPoints ?? rankingPoints,
    };
}
function resolveMatchEconomy(gameId, resultado, clientScore, metadata, rewardOverrides, rng = Math.random, rouletteTable = exports.DEFAULT_ROULETTE_TABLE) {
    const baseMeta = { ...metadata };
    if (gameId === "roleta") {
        const table = rouletteTable.length > 0 ? rouletteTable : exports.DEFAULT_ROULETTE_TABLE;
        const picked = pickWeightedRoulettePrize(table, rng);
        if (picked.kind === "chest") {
            const normalizedScore = clampScore(rouletteScoreHintForChest(picked.chestRarity));
            return {
                normalizedScore,
                rewardCoins: 0,
                rankingPoints: rankingPointsFrom(normalizedScore, "vitoria"),
                resolvedMetadata: {
                    ...baseMeta,
                    roulettePrizeKind: "chest",
                    chestRarity: picked.chestRarity,
                    source: "roleta_table",
                },
            };
        }
        const currencyKind = picked.kind;
        const amount = picked.amount;
        const normalizedScore = clampScore(amount * 5);
        return {
            normalizedScore,
            rewardCoins: currencyKind === "coins" ? amount : 0,
            rankingPoints: rankingPointsFrom(normalizedScore, "vitoria"),
            resolvedMetadata: {
                ...baseMeta,
                roulettePrizeKind: currencyKind,
                rouletteRewardAmount: amount,
                ...(currencyKind === "coins" ? { serverPrize: amount } : {}),
                source: "roleta_table",
            },
        };
    }
    if (gameId === "bau") {
        const loot = pickBauLoot(rng);
        const normalizedScore = clampScore(loot / 2);
        return {
            normalizedScore,
            rewardCoins: loot,
            rankingPoints: rankingPointsFrom(normalizedScore, "vitoria"),
            resolvedMetadata: { ...baseMeta, serverLoot: loot, source: "bau_table" },
        };
    }
    if (gameId === "ppt") {
        const normalizedScore = resultado === "vitoria" ? 650 : resultado === "empate" ? 400 : 200;
        const resolved = applyRewardOverrides(resultado, resultado === "vitoria" ? 45 : resultado === "empate" ? 12 : 0, resultado === "vitoria" ? 1 : 0, rewardOverrides?.ppt);
        return {
            normalizedScore,
            rewardCoins: resolved.rewardCoins,
            rankingPoints: resolved.rankingPoints,
            resolvedMetadata: baseMeta,
        };
    }
    if (gameId === "quiz") {
        const timeMs = Number(metadata.responseTimeMs ?? 8000);
        const win = resultado === "vitoria";
        const base = win ? 500 : 120;
        const speedBonus = win ? clampScore(Math.max(0, 8000 - timeMs) / 15) : 0;
        const normalizedScore = clampScore(base + speedBonus);
        const resolved = applyRewardOverrides(resultado, win ? Math.min(95, Math.max(25, 25 + Math.floor(speedBonus / 2))) : 5, rankingPointsFrom(normalizedScore, resultado), rewardOverrides?.quiz);
        return {
            normalizedScore,
            rewardCoins: resolved.rewardCoins,
            rankingPoints: resolved.rankingPoints,
            resolvedMetadata: { ...baseMeta, responseTimeMs: timeMs },
        };
    }
    if (gameId === "reaction_tap") {
        const reactionMs = Number(metadata.reactionMs ?? clientScore);
        const win = resultado === "vitoria";
        const normalizedScore = win
            ? clampScore(950 - Math.min(750, reactionMs))
            : clampScore(Math.max(80, 280 - Math.min(200, reactionMs)));
        const resolved = applyRewardOverrides(resultado, win ? Math.min(110, Math.max(20, 40 + Math.floor((350 - reactionMs) / 10))) : 4, rankingPointsFrom(normalizedScore, resultado), rewardOverrides?.reaction_tap);
        return {
            normalizedScore,
            rewardCoins: resolved.rewardCoins,
            rankingPoints: resolved.rankingPoints,
            resolvedMetadata: { ...baseMeta, reactionMs },
        };
    }
    const normalizedScore = clampScore(clientScore);
    const win = resultado === "vitoria";
    const rewardCoins = win
        ? Math.min(120, Math.max(10, 15 + Math.floor(normalizedScore / 5)))
        : 0;
    return {
        normalizedScore,
        rewardCoins,
        rankingPoints: rankingPointsFrom(normalizedScore, resultado),
        resolvedMetadata: baseMeta,
    };
}
//# sourceMappingURL=gameEconomy.js.map