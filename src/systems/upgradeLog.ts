import type { IncrementalUpgradeDef, RoomId, UpgradeDef, UpgradeEffect } from "../data/types";
import type { GameState } from "../model/GameState";

const ROOM_NAMES: Record<RoomId, string> = {
    storehouse: "Storehouse",
    quarters: "Quarters",
    infirmary: "Infirmary",
    trainingHall: "Training Hall",
    laboratory: "Laboratory",
    dungeon: "Dungeon",
    warRoom: "War Room",
};

function shorterBy(multiplier: number): string {
    return `${Math.round((1 - multiplier) * 10000) / 100}% shorter`;
}

function describeEffect(effect: UpgradeEffect | IncrementalUpgradeDef["effect"]): string {
    switch (effect.type) {
        case "storageSlots": return `+${effect.amount} storage slots`;
        case "saleEfficiency": return `${shorterBy(effect.multiplier)} sale time`;
        case "bed": return "+1 Quarters bed";
        case "treatmentBed": return "+1 treatment bed";
        case "treatmentEfficiency": return `${shorterBy(effect.multiplier)} treatment time`;
        case "trainingStation": return "+1 training station";
        case "trainingUnlock": return `unlocks Rank ${effect.fromRank} → ${effect.fromRank + 1} training`;
        case "laboratoryTier": return `unlocks Tier ${effect.tier} Laboratory upgrades`;
        case "minionStat": return `${effect.value >= 0 ? "+" : ""}${effect.value} ${effect.stat} for all`;
        case "dungeonCell": return "+1 Dungeon cell";
        case "tortureEfficiency": return `${shorterBy(effect.multiplier)} prisoner processing time`;
        case "recruitmentEfficiency": return `+${Math.round(effect.bonus * 10000) / 100} percentage points to base recruitment chance`;
        case "enemyIntel": return effect.level === 1 ? "reveals defender counts and ranks" : "reveals weekly village Gold and Crystals";
        case "lootIntel": return effect.level === 1 ? "identifies possible loot" : "reveals loot drop chances";
    }
}

export function logUpgrade(state: GameState, phase: "starts" | "ends", upgrade: UpgradeDef | IncrementalUpgradeDef): void {
    state.log(`${ROOM_NAMES[upgrade.room]} ${phase} upgrade: ${upgrade.name} (${describeEffect(upgrade.effect)}).`);
}
