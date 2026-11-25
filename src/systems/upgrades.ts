import { CONFIG } from "../data/config";
import type { GameState } from "../model/GameState";
import type { UpgradeProcess } from "../model/types";
import { spend } from "./economy";
import { addTowerXp } from "./tower";
import { requirementFailure } from "./upgradeRequirements";
import { logUpgrade } from "./upgradeLog";

export function isUpgradeInProgress(state: GameState, upgradeId: string): boolean {
    return state.processes.some(p => p.type === "upgrade" && p.upgradeId === upgradeId);
}

export function canPurchaseUpgrade(state: GameState, upgradeId: string): boolean {
    return upgradePurchaseFailure(state, upgradeId) === undefined;
}

export function upgradePurchaseFailure(state: GameState, upgradeId: string): string | undefined {
    const def = CONFIG.upgrades.find(u => u.id === upgradeId);
    if (!def) return 'Unknown upgrade';
    if (!state.acquiredUpgrades.has(upgradeId)) return 'Acquire this upgrade first';
    if (state.purchasedUpgrades.has(upgradeId)) return 'Already completed';
    if (isUpgradeInProgress(state, upgradeId)) return 'Under construction';
    const failure = requirementFailure(state, def.requirements);
    if (failure) return failure;
    if (state.gold < def.costGold) return `Need ${def.costGold}g`;
    if (state.crystals < (def.costCrystals ?? 0)) return `Need ${def.costCrystals} crystals`;
    return undefined;
}

export function purchaseUpgrade(state: GameState, upgradeId: string, now: number): boolean {
    if (!canPurchaseUpgrade(state, upgradeId)) return false;
    const def = CONFIG.upgrades.find(u => u.id === upgradeId)!;
    spend(state, def.costGold, def.costCrystals ?? 0);
    const process: UpgradeProcess = {
        id: state.genId("upgrade"), type: "upgrade",
        startHour: now, endHour: now + def.durationHours, upgradeId,
    };
    state.processes.push(process);
    logUpgrade(state, "starts", def);
    return true;
}

export function completeUpgrade(state: GameState, process: UpgradeProcess): void {
    const def = CONFIG.upgrades.find(u => u.id === process.upgradeId);
    if (!def || state.purchasedUpgrades.has(def.id)) return;
    state.purchasedUpgrades.add(def.id);
    addTowerXp(state, def.towerXp);
    logUpgrade(state, "ends", def);
}
