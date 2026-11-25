import { CONFIG } from '../data/config';
import { GameState, pickMissionIds } from '../model/GameState';
import type { BattleReplay, BattleReplayUnit, RaidProcess, RaidReportDraft, VillageRewards, VillageState } from '../model/types';
import { ensureRaidSnapshot, initializeVillages, missionDef, raidWeekForReport, recoverVillages, updateMissionProgression } from './world';

export const SAVE_KEY = 'dark-tower-save';
export const SAVE_VERSION = 3;

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): value is JsonRecord =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const nonnegative = (value: unknown): value is number => finite(value) && value >= 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(v => typeof v === 'string');
const itemIds = (value: unknown): value is string[] => strings(value)
    && value.every(id => CONFIG.items.some(item => item.id === id));
const count = (value: unknown): value is number => nonnegative(value) && Number.isInteger(value);
const optionalCount = (value: unknown): value is number | undefined => value === undefined || count(value);
const rank = (value: unknown): value is number => count(value) && value >= 1 && value <= CONFIG.ranks.length;
const ranks = (value: unknown): value is number[] => Array.isArray(value) && value.every(rank);

/** Uses the same readable map/set representation as the prototype's debug export. */
export function serializeGame(state: GameState): string {
    return JSON.stringify({ version: SAVE_VERSION, state }, (_key, value: unknown) => {
        if (value instanceof Set) return [...value];
        if (value instanceof Map) return Object.fromEntries(value);
        if (typeof value === 'function') return undefined;
        return value;
    });
}

function mapEntries(value: unknown): [string, unknown][] | null {
    if (record(value)) return Object.entries(value);
    if (Array.isArray(value) && value.every(entry => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string')) {
        return value as [string, unknown][];
    }
    return null;
}

function validProcess(value: unknown): boolean {
    if (!record(value) || typeof value.id !== 'string' || !nonnegative(value.startHour)
        || !nonnegative(value.endHour) || value.endHour < value.startHour) return false;
    switch (value.type) {
        case 'raid': return typeof value.missionId === 'string' && strings(value.squad) && value.squad.length > 0
            && new Set(value.squad).size === value.squad.length && optionalCount(value.raidWeek)
            && (value.defenderRanks === undefined ? optionalCount(value.activeDefenders) : ranks(value.defenderRanks))
            && (value.rewards === undefined || validRewards(value.rewards));
        case 'walkback': return typeof value.missionId === 'string';
        case 'rest': case 'treatment': return typeof value.minionId === 'string';
        case 'training': return typeof value.minionId === 'string' && rank(value.fromRank) && rank(value.toRank);
        case 'sale': return typeof value.stackId === 'string' && typeof value.itemId === 'string'
            && nonnegative(value.count) && nonnegative(value.goldValue);
        case 'upgrade': case 'incrementalUpgrade': return typeof value.upgradeId === 'string';
        case 'dungeon': return typeof value.prisonerId === 'string' && nonnegative(value.rank);
        default: return false;
    }
}

function validRewards(value: unknown): value is VillageRewards {
    return record(value) && nonnegative(value.gold) && nonnegative(value.crystals) && itemIds(value.lootCopies)
        && ranks(value.prisoners);
}

function restoreRaidProcess(process: RaidProcess & { activeDefenders?: number }): RaidProcess {
    const { id, type, startHour, endHour, missionId, squad, raidWeek, defenderRanks, rewards, activeDefenders } = process;
    return {
        id, type, startHour, endHour, missionId, squad, raidWeek,
        defenderRanks: defenderRanks ?? (activeDefenders === undefined ? undefined : missionDef(missionId).defenderRanks.slice(0, activeDefenders)),
        rewards,
    };
}

function restoreVillage(missionId: string, value: unknown): VillageState | null {
    if (!record(value) || !count(value.week) || typeof value.raided !== 'boolean' || !validRewards(value.rewards)) return null;
    let activeDefenderRanks = value.activeDefenderRanks;
    if (activeDefenderRanks === undefined && count(value.activeDefenders)) {
        const configuredRanks = CONFIG.missions.find(mission => mission.id === missionId)?.defenderRanks ?? [];
        activeDefenderRanks = configuredRanks.slice(0, value.activeDefenders);
    }
    if (!ranks(activeDefenderRanks)) return null;
    return { week: value.week, activeDefenderRanks, rewards: value.rewards, raided: value.raided };
}

function validReplayUnits(value: unknown): value is BattleReplayUnit[] {
    return Array.isArray(value) && value.every(unit => record(unit) && typeof unit.id === 'string'
        && rank(unit.rank) && finite(unit.health) && unit.health > 0);
}

function validBattleReplay(value: unknown): value is BattleReplay {
    if (!record(value) || !validReplayUnits(value.attackers) || !validReplayUnits(value.defenders)
        || !Array.isArray(value.rounds)) return false;
    const ids = [...value.attackers, ...value.defenders].map(unit => unit.id);
    const living = new Set(ids);
    if (living.size !== ids.length) return false;
    const attackers = new Set(value.attackers.map(unit => unit.id));
    for (const round of value.rounds) {
        if (!record(round) || !Array.isArray(round.hits) || !Array.isArray(round.endHealth)
            || round.hits.length !== living.size || round.endHealth.length !== living.size) return false;
        const actors = new Set<string>();
        for (const hit of round.hits) {
            if (!record(hit) || typeof hit.attackerId !== 'string' || typeof hit.targetId !== 'string'
                || !living.has(hit.attackerId) || !living.has(hit.targetId) || actors.has(hit.attackerId)
                || attackers.has(hit.attackerId) === attackers.has(hit.targetId)
                || !finite(hit.damage) || hit.damage <= 0) return false;
            actors.add(hit.attackerId);
        }
        const updated = new Set<string>();
        for (const change of round.endHealth) {
            if (!record(change) || typeof change.unitId !== 'string' || !living.has(change.unitId)
                || updated.has(change.unitId) || !finite(change.health)) return false;
            updated.add(change.unitId);
            if (change.health <= 0) living.delete(change.unitId);
        }
    }
    return true;
}

function restoreReport(value: unknown): RaidReportDraft | null {
    if (!record(value) || typeof value.missionId !== 'string' || typeof value.success !== 'boolean'
        || !strings(value.squad) || new Set(value.squad).size !== value.squad.length
        || !nonnegative(value.goldFound) || !nonnegative(value.crystalsFound)
        || !itemIds(value.lootCopies) || !ranks(value.prisonersFound)
        || !optionalCount(value.raidWeek) || !optionalCount(value.defendersBefore)
        || !optionalCount(value.defenderLosses) || !optionalCount(value.defendersRemaining)
        || (value.durationHours !== undefined && !nonnegative(value.durationHours))) return null;

    let injuredMinionIds = value.injuredMinionIds;
    const { injuryRolls, squad } = value;
    if (injuredMinionIds === undefined && record(injuryRolls) && Object.values(injuryRolls).every(nonnegative)) {
        injuredMinionIds = squad.filter(id => Number(injuryRolls[id] ?? 0) > 0);
    }
    if (!strings(injuredMinionIds) || injuredMinionIds.some(id => !squad.includes(id))) return null;
    return {
        missionId: value.missionId, success: value.success, squad,
        goldFound: value.goldFound, crystalsFound: value.crystalsFound, lootCopies: value.lootCopies, prisonersFound: value.prisonersFound,
        injuredMinionIds, raidWeek: value.raidWeek,
        defendersBefore: value.defendersBefore, defenderLosses: value.defenderLosses, defendersRemaining: value.defendersRemaining,
        durationHours: value.durationHours,
        battleReplay: validBattleReplay(value.battleReplay) ? value.battleReplay : undefined,
    };
}

/** Reject malformed saves instead of partially loading rewards or releasing reserved squads. */
export function deserializeGame(json: string): GameState | null {
    try {
        const envelope: unknown = JSON.parse(json);
        if (!record(envelope)) return null;
        if ('version' in envelope && envelope.version !== SAVE_VERSION && envelope.version !== 2 && envelope.version !== 1) return null;
        const saved = 'version' in envelope ? envelope.state : envelope;
        if (!record(saved) || !nonnegative(saved.hours) || !Array.isArray(saved.minions)) return null;

        const state = new GameState();
        const defaults = Object.entries(state);
        for (const [key, defaultValue] of defaults) {
            if (!(key in saved) || key === 'rng' || key === 'nextSeq') continue;
            const value = saved[key];
            if (defaultValue instanceof Set) {
                if (!Array.isArray(value) || !value.every(entry => key === 'unlockedTiers'
                    ? Number.isInteger(entry) && entry > 0 : typeof entry === 'string')) return null;
                Object.assign(state, { [key]: new Set(value) });
            } else if (defaultValue instanceof Map) {
                const entries = mapEntries(value);
                if (!entries) return null;
                Object.assign(state, { [key]: new Map(entries) });
            } else if (Array.isArray(defaultValue)) {
                if (!Array.isArray(value)) return null;
                Object.assign(state, { [key]: value });
            } else if (typeof defaultValue === 'number') {
                if (!nonnegative(value)) return null;
                Object.assign(state, { [key]: value });
            } else if (typeof defaultValue === 'boolean') {
                if (typeof value !== 'boolean') return null;
                Object.assign(state, { [key]: value });
            } else if (defaultValue === null) {
                if (key === 'gameOver' && value !== null && value !== 'bankruptcy') return null;
                if ((key === 'paydayDueAtHour' || key === 'worldCompletedAtHour') && value !== null && !nonnegative(value)) return null;
                if (key === 'paydayAnnouncement' && value !== null && (!record(value)
                    || !['emoji', 'title', 'flavor'].every(field => typeof value[field] === 'string'))) return null;
                Object.assign(state, { [key]: value });
            }
        }

        if (state.speed <= 0 || !strings(state.logLines) || !strings(state.departureNotices)) return null;
        if (!state.minions.every(minion => record(minion) && typeof minion.id === 'string'
            && Number.isInteger(minion.rank) && minion.rank >= 1 && minion.rank <= CONFIG.ranks.length
            && typeof minion.tired === 'boolean' && typeof minion.injured === 'boolean'
            && record(minion.activity) && ['idle', 'raid', 'training', 'resting', 'treatment'].includes(minion.activity.type)
            && (minion.waitingSince === null || nonnegative(minion.waitingSince)))) return null;
        if (new Set(state.minions.map(minion => minion.id)).size !== state.minions.length) return null;
        if (!state.stacks.every(stack => record(stack) && typeof stack.id === 'string'
            && CONFIG.items.some(item => item.id === stack.itemId) && nonnegative(stack.count))) return null;
        if (!state.prisoners.every(prisoner => record(prisoner) && typeof prisoner.id === 'string'
            && Number.isInteger(prisoner.rank) && prisoner.rank >= 1 && prisoner.rank <= CONFIG.ranks.length
            && (prisoner.processId === null || typeof prisoner.processId === 'string'))) return null;
        if (!state.processes.every(validProcess) || new Set(state.processes.map(process => process.id)).size !== state.processes.length) return null;
        if (![...state.incrementalLevels.values()].every(nonnegative)
            || ![...state.missionClaimedWeek.values()].every(nonnegative)
            || ![...state.missionRunningProcess.values()].every(id => typeof id === 'string')) return null;
        for (const [missionId, value] of state.pendingReports) {
            const report = restoreReport(value);
            if (!report || report.missionId !== missionId) return null;
            state.pendingReports.set(missionId, report);
        }
        for (const [missionId, value] of state.villages) {
            const village = restoreVillage(missionId, value);
            if (!village) return null;
            state.villages.set(missionId, village);
        }

        const missionIds = new Set(CONFIG.missions.map(mission => mission.id));
        const unresolved = new Set<string>();
        const reserved = new Set<string>();
        const reserve = (missionId: string, squad: string[], processId?: string): boolean => {
            if (!missionIds.has(missionId) || unresolved.has(missionId)) return false;
            unresolved.add(missionId);
            for (const id of squad) {
                const minion = state.findMinion(id);
                if (!minion || reserved.has(id)) return false;
                reserved.add(id);
                minion.activity = { type: 'raid', missionId, processId };
                minion.waitingSince = null;
            }
            return true;
        };
        state.missionRunningProcess.clear();
        for (const process of state.processes) {
            if (process.type !== 'raid') continue;
            if (!reserve(process.missionId, process.squad, process.id)) return null;
            state.missionRunningProcess.set(process.missionId, process.id);
        }
        state.processes = state.processes.map(process => process.type === 'raid' ? restoreRaidProcess(process) : process);
        for (const [missionId, report] of state.pendingReports) {
            if (!reserve(missionId, report.squad)) return null;
            report.raidWeek ??= raidWeekForReport(state, report);
            report.defendersBefore ??= missionDef(missionId).defenderRanks.length;
            report.defenderLosses ??= report.success ? report.defendersBefore : 0;
            report.defendersRemaining ??= report.defendersBefore - report.defenderLosses;
        }
        if (state.minions.some(minion => minion.activity.type === 'raid' && !reserved.has(minion.id))) return null;
        const savedSelection = 'selectedMissionIds' in saved ? state.selectedMissionIds : [];
        state.selectedMissionIds = pickMissionIds(state.rng, [...savedSelection, ...unresolved, ...state.everClaimedMissions]);
        for (const missionId of state.villages.keys()) {
            if (!state.selectedMissionIds.has(missionId) && !unresolved.has(missionId)) state.villages.delete(missionId);
        }
        // Old weekly claims included failures. Only known completed missions retain that lock.
        if (!('villages' in saved)) {
            for (const missionId of state.missionClaimedWeek.keys()) {
                if (!state.everClaimedMissions.has(missionId)) state.missionClaimedWeek.delete(missionId);
            }
        }
        initializeVillages(state);
        for (const process of state.processes) if (process.type === 'raid') ensureRaidSnapshot(state, process);
        for (const [missionId, report] of state.pendingReports) {
            if (!report.success || report.raidWeek !== state.week) continue;
            const village = state.villages.get(missionId);
            if (!village) continue;
            village.raided = true;
            village.activeDefenderRanks = [];
            village.rewards = { gold: 0, crystals: 0, lootCopies: [], prisoners: [] };
        }
        recoverVillages(state);
        if (!state.hasCompletedWorld()) state.worldCompletedAtHour = null;
        updateMissionProgression(state, state.hours);

        const identifiers = [...state.minions, ...state.prisoners, ...state.stacks, ...state.processes].map(entry => entry.id);
        const nextFromIds = identifiers.reduce((next, id) => Math.max(next, Number(id.match(/_(\d+)$/)?.[1] ?? 0) + 1), 1);
        state.restoreNextSequence(Math.max(nextFromIds, nonnegative(saved.nextSeq) ? saved.nextSeq : 1));
        return state;
    } catch {
        return null;
    }
}

export function loadGame(storage?: Pick<Storage, 'getItem'>): GameState | null {
    try {
        const json = (storage ?? localStorage).getItem(SAVE_KEY);
        return json ? deserializeGame(json) : null;
    } catch {
        return null;
    }
}

export function saveGame(state: GameState, storage?: Pick<Storage, 'setItem'>): boolean {
    try {
        (storage ?? localStorage).setItem(SAVE_KEY, serializeGame(state));
        return true;
    } catch {
        return false;
    }
}

export function clearSavedGame(storage?: Pick<Storage, 'removeItem'>): boolean {
    try {
        (storage ?? localStorage).removeItem(SAVE_KEY);
        return true;
    } catch {
        return false;
    }
}
