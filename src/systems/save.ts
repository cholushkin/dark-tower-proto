import { CONFIG } from '../data/config';
import { GameState } from '../model/GameState';
import { ensureRaidSnapshot, initializeVillages, raidWeekForReport, recoverVillages } from './world';

export const SAVE_KEY = 'dark-tower-save';
export const SAVE_VERSION = 1;

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): value is JsonRecord =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const nonnegative = (value: unknown): value is number => finite(value) && value >= 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(v => typeof v === 'string');
const itemIds = (value: unknown): value is string[] => strings(value)
    && value.every(id => CONFIG.items.some(item => item.id === id));
const optionalCount = (value: unknown): boolean => value === undefined || (nonnegative(value) && Number.isInteger(value));
const optionalChance = (value: unknown): boolean => value === undefined || (nonnegative(value) && value <= 1);

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
            && optionalCount(value.activeDefenders) && optionalCount(value.fullDefenders)
            && optionalChance(value.victoryChance) && (value.rewards === undefined || validRewards(value.rewards));
        case 'walkback': return typeof value.missionId === 'string';
        case 'rest': case 'treatment': return typeof value.minionId === 'string';
        case 'training': return typeof value.minionId === 'string' && nonnegative(value.fromRank) && nonnegative(value.toRank);
        case 'sale': return typeof value.stackId === 'string' && typeof value.itemId === 'string'
            && nonnegative(value.count) && nonnegative(value.goldValue);
        case 'upgrade': case 'incrementalUpgrade': return typeof value.upgradeId === 'string';
        case 'dungeon': return typeof value.prisonerId === 'string' && nonnegative(value.rank);
        default: return false;
    }
}

function validRewards(value: unknown): boolean {
    return record(value) && nonnegative(value.gold) && nonnegative(value.crystals) && itemIds(value.lootCopies)
        && Array.isArray(value.prisoners) && value.prisoners.every(rank => Number.isInteger(rank) && rank >= 1 && rank <= CONFIG.ranks.length);
}

function validReport(value: unknown): boolean {
    return record(value) && typeof value.missionId === 'string' && typeof value.success === 'boolean'
        && strings(value.squad) && new Set(value.squad).size === value.squad.length
        && nonnegative(value.goldFound) && nonnegative(value.crystalsFound)
        && itemIds(value.lootCopies) && Array.isArray(value.prisonersFound)
        && value.prisonersFound.every(rank => Number.isInteger(rank) && rank >= 1 && rank <= CONFIG.ranks.length)
        && nonnegative(value.carryLimit) && record(value.selection) && Object.values(value.selection).every(nonnegative)
        && Object.keys(value.selection).every(id => CONFIG.items.some(item => item.id === id))
        && record(value.injuryRolls) && Object.values(value.injuryRolls).every(nonnegative)
        && ['raidWeek', 'fullDefenders', 'defendersBefore', 'defenderLosses', 'defendersRemaining'].every(key => optionalCount(value[key]))
        && optionalChance(value.victoryChance);
}

/** Reject malformed saves instead of partially loading rewards or releasing reserved squads. */
export function deserializeGame(json: string): GameState | null {
    try {
        const envelope: unknown = JSON.parse(json);
        if (!record(envelope)) return null;
        if ('version' in envelope && envelope.version !== SAVE_VERSION) return null;
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
        if (![...state.pendingReports].every(([id, report]) => validReport(report) && report.missionId === id)) return null;
        for (const report of state.pendingReports.values()) {
            let selectedSlots = 0;
            for (const [itemId, count] of Object.entries(report.selection)) {
                if (!Number.isInteger(count) || count > report.lootCopies.filter(id => id === itemId).length) return null;
                selectedSlots += Math.ceil(count / CONFIG.items.find(item => item.id === itemId)!.maxStackSize);
            }
            if (selectedSlots > report.carryLimit) return null;
        }
        if (![...state.villages.values()].every(village => record(village) && nonnegative(village.week)
            && nonnegative(village.fullDefenders) && nonnegative(village.activeDefenders)
            && village.activeDefenders <= village.fullDefenders && typeof village.raided === 'boolean'
            && validRewards(village.rewards))) return null;

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
        for (const [missionId, report] of state.pendingReports) {
            if (!reserve(missionId, report.squad)) return null;
            report.raidWeek ??= raidWeekForReport(state, report);
            report.fullDefenders ??= CONFIG.missions.find(mission => mission.id === missionId)!.fullDefenders;
            report.defendersBefore ??= report.fullDefenders;
            report.defenderLosses ??= report.success ? report.defendersBefore : 0;
            report.defendersRemaining ??= report.defendersBefore - report.defenderLosses;
        }
        if (state.minions.some(minion => minion.activity.type === 'raid' && !reserved.has(minion.id))) return null;
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
            const village = state.villages.get(missionId)!;
            village.raided = true;
            village.activeDefenders = 0;
            village.rewards = { gold: 0, crystals: 0, lootCopies: [], prisoners: [] };
        }
        recoverVillages(state);
        if (state.worldCompletedAtHour === null && CONFIG.missions.every(mission => state.everClaimedMissions.has(mission.id))) {
            state.worldCompletedAtHour = state.hours;
        }

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
