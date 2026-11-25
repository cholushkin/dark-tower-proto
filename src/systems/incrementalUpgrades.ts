import { CONFIG } from "../data/config";
import type { IncrementalUpgradeDef } from "../data/types";
import type { GameState } from "../model/GameState";
import type { IncrementalUpgradeProcess } from "../model/types";
import { canAfford, spend } from "./economy";
import { addTowerXp } from "./tower";
import { requirementFailure } from "./upgradeRequirements";
import { logUpgrade } from "./upgradeLog";

function def(upgradeId: string): IncrementalUpgradeDef {
    return CONFIG.incrementalUpgrades.find(u => u.id === upgradeId)!;
}

export function nextCost(upgradeId: string, level: number): number {
    const d = def(upgradeId);
    return d.baseCostGold + level * d.costStepGold;
}

export function nextDuration(upgradeId: string, level: number): number {
    const d = def(upgradeId);
    return d.baseDurationHours + level * d.durationStepHours;
}

export function isIncrementalInProgress(state: GameState, upgradeId: string): boolean {
    return state.processes.some(p => p.type === "incrementalUpgrade" && p.upgradeId === upgradeId);
}

export function canPurchaseIncremental(state: GameState, upgradeId: string): boolean {
    return incrementalPurchaseFailure(state, upgradeId) === undefined;
}

export function incrementalPurchaseFailure(state: GameState, upgradeId: string): string | undefined {
    const definition = CONFIG.incrementalUpgrades.find(upgrade => upgrade.id === upgradeId);
    if (!definition) return 'Unknown upgrade';
    if (!state.acquiredUpgrades.has(upgradeId)) return 'Acquire this upgrade first';
    if (isIncrementalInProgress(state, upgradeId)) return 'Under construction';
    const failure = requirementFailure(state, definition.requirements);
    if (failure) return failure;
    const cost = nextCost(upgradeId, state.incrementalLevel(upgradeId));
    return canAfford(state, cost, 0) ? undefined : `Need ${cost}g`;
}

export function purchaseIncremental(state: GameState, upgradeId: string, now: number): boolean {
    if (!canPurchaseIncremental(state, upgradeId)) return false;
    const level = state.incrementalLevel(upgradeId);
    spend(state, nextCost(upgradeId, level), 0);
    const process: IncrementalUpgradeProcess = {
        id: state.genId("incupgrade"), type: "incrementalUpgrade",
        startHour: now, endHour: now + nextDuration(upgradeId, level), upgradeId,
    };
    state.processes.push(process);
    logUpgrade(state, "starts", def(upgradeId));
    return true;
}

export function completeIncrementalUpgrade(state: GameState, process: IncrementalUpgradeProcess): void {
    const d = def(process.upgradeId);
    const level = state.incrementalLevel(process.upgradeId);
    state.incrementalLevels.set(process.upgradeId, level + 1);
    addTowerXp(state, d.towerXp);
    logUpgrade(state, "ends", d);
}
