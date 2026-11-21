import { CONFIG } from '../data/config';
import type { UpgradeRequirement } from '../data/types';
import type { GameState } from '../model/GameState';

/** One evaluator for both purchase validation and UI explanations; never mutates state. */
export function requirementFailure(state: GameState, requirement?: UpgradeRequirement): string | undefined {
    if (!requirement) return undefined;
    switch (requirement.type) {
        case 'all':
            return requirement.requirements.map(req => requirementFailure(state, req)).find(Boolean);
        case 'any': {
            const failures = requirement.requirements.map(req => requirementFailure(state, req));
            return failures.some(reason => reason === undefined) ? undefined : `Requires one of: ${failures.join('; ') || 'no alternatives configured'}`;
        }
        case 'not':
            return requirementFailure(state, requirement.requirement) ? undefined : 'An exclusion condition is active';
        case 'upgradeCompleted':
            return state.purchasedUpgrades.has(requirement.upgradeId) || state.incrementalLevel(requirement.upgradeId) > 0
                ? undefined : `Requires ${upgradeName(requirement.upgradeId)} completed`;
        case 'upgradeAcquired':
            return state.acquiredUpgrades.has(requirement.upgradeId) ? undefined : `Requires ${upgradeName(requirement.upgradeId)} acquired`;
        case 'flag':
            return state.progressionFlags.has(requirement.flag) ? undefined : `Requires ${requirement.flag}`;
        case 'missionCompleted':
            return state.everClaimedMissions.has(requirement.missionId) ? undefined : `Requires victory at ${CONFIG.missions.find(m => m.id === requirement.missionId)?.name ?? requirement.missionId}`;
        case 'itemCount': {
            const count = state.stacks.filter(stack => stack.itemId === requirement.itemId).reduce((sum, stack) => sum + stack.count, 0);
            return count >= requirement.count ? undefined : `Requires ${requirement.count} ${CONFIG.items.find(item => item.id === requirement.itemId)?.name ?? requirement.itemId}`;
        }
        case 'condition': {
            const values = { towerLevel: state.towerLevel(), laboratoryTier: state.laboratoryTierUnlocked(), gold: state.gold, crystals: state.crystals, minionCount: state.minions.length };
            const labels = { towerLevel: 'Tower level', laboratoryTier: 'Laboratory tier', gold: 'Gold', crystals: 'Crystals', minionCount: 'Minions' };
            const value = values[requirement.metric];
            const met = requirement.operator === 'gte' ? value >= requirement.value : requirement.operator === 'lte' ? value <= requirement.value : value === requirement.value;
            const comparison = { gte: 'at least', lte: 'at most', eq: 'equal to' };
            return met ? undefined : `Requires ${labels[requirement.metric]} ${comparison[requirement.operator]} ${requirement.value}`;
        }
    }
}

function upgradeName(id: string): string {
    return [...CONFIG.upgrades, ...CONFIG.incrementalUpgrades].find(upgrade => upgrade.id === id)?.name ?? id;
}
