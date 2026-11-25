import { CONFIG } from "../data/config";
import type { MissionDef } from "../data/types";
import type { GameState } from "../model/GameState";
import type { RaidProcess, RaidReportDraft, VillageRewards, VillageState } from "../model/types";

export function missionDef(missionId: string): MissionDef {
    return CONFIG.missions.find(m => m.id === missionId)!;
}

function emptyRewards(): VillageRewards {
    return { gold: 0, crystals: 0, lootCopies: [], prisoners: [] };
}

function copyRewards(rewards: VillageRewards): VillageRewards {
    return { ...rewards, lootCopies: [...rewards.lootCopies], prisoners: [...rewards.prisoners] };
}

function randRange(state: GameState, [min, max]: [number, number]): number {
    return Math.floor(Math.min(1 - Number.EPSILON, Math.max(0, state.rng())) * (max - min + 1)) + min;
}

function generateRewards(state: GameState, mission: MissionDef): VillageRewards {
    const rewards: VillageRewards = {
        gold: randRange(state, mission.rewardGoldRange),
        crystals: randRange(state, mission.rewardCrystalsRange),
        lootCopies: [], prisoners: [],
    };
    for (const loot of mission.loot) {
        if (state.rng() >= loot.chance) continue;
        const count = randRange(state, [loot.min, loot.max]);
        for (let i = 0; i < count; i++) rewards.lootCopies.push(loot.itemId);
    }
    if (state.rng() < mission.prisonerChance) {
        const count = randRange(state, mission.prisonerCountRange);
        for (let i = 0; i < count; i++) rewards.prisoners.push(randRange(state, mission.prisonerRankRange));
    }
    return rewards;
}

function freshVillage(state: GameState, mission: MissionDef, week = state.week): VillageState {
    const fullDefenders = Math.max(0, Math.floor(mission.fullDefenders));
    return { week, fullDefenders, activeDefenders: fullDefenders, rewards: generateRewards(state, mission), raided: false };
}

/** Fills missing legacy state without replacing existing stock, raids, or reports. */
export function initializeVillages(state: GameState): void {
    for (const mission of CONFIG.missions) {
        if (state.villages.has(mission.id)) continue;
        const village = freshVillage(state, mission);
        if (state.missionClaimedWeek.get(mission.id) === state.week) {
            village.raided = true;
            village.activeDefenders = 0;
            village.rewards = emptyRewards();
        }
        state.villages.set(mission.id, village);
    }
}

export function recoverVillages(state: GameState): void {
    initializeVillages(state);
    for (const mission of CONFIG.missions) {
        if (state.villageState(mission.id).week >= state.week) continue;
        state.villages.set(mission.id, freshVillage(state, mission));
    }
}

export function raidWeekForReport(state: GameState, report: RaidReportDraft, now = state.hours): number {
    if (report.raidWeek !== undefined) return report.raidWeek;
    const walkback = state.processes.find(p => p.type === "walkback" && p.missionId === report.missionId);
    // Walkback duration equals raid duration, allowing older saves to recover the launch time.
    const launchHour = walkback ? Math.max(0, walkback.startHour - (walkback.endHour - walkback.startHour)) : now;
    return Math.floor(launchHour / (24 * CONFIG.constants.weekDays));
}

export function victoryChanceFor(attackers: number, activeDefenders: number): number {
    if (attackers <= 0) return 0;
    if (activeDefenders <= 0 || attackers >= CONFIG.constants.raid.overwhelmingForceRatio * activeDefenders) return 1;
    return attackers ** 2 / (attackers ** 2 + activeDefenders ** 2);
}

/** Absolute probability reduction, retaining existing rank/armor resistance. */
export function injuryResistanceFor(state: GameState, minionId: string): number {
    const minion = state.findMinion(minionId)!;
    const balance = CONFIG.constants.raid;
    return balance.rankInjuryResistance * (minion.rank - 1)
        + balance.defenseInjuryResistance * Math.max(0, state.effectiveDefense(minion.rank) - balance.injuryDefenseBaseline);
}

export function injuryChanceFor(state: GameState, minionId: string, victoryChance: number, success: boolean): number {
    const balance = CONFIG.constants.raid;
    const factor = success ? balance.injuryChanceOnVictory : balance.injuryChanceOnDefeat;
    return Math.min(1, Math.max(0, factor * (1 - victoryChance) - injuryResistanceFor(state, minionId)));
}

export interface RaidPreview {
    totalPower: number;
    powerRatio: number;
    victoryChance: number;
    guaranteedVictory: boolean;
    activeDefenders: number;
    fullDefenders: number;
    failureChance: number;
    durationHours: number;
    avgInjuryChance: number;
    injuryChanceOnVictory: number;
    injuryChanceOnDefeat: number;
}

export function previewRaid(state: GameState, missionId: string, squad: string[]): RaidPreview {
    const mission = missionDef(missionId);
    const village = state.villageState(missionId);
    const activeDefenders = village.week === state.week ? village.activeDefenders : mission.fullDefenders;
    const participants = [...new Set(squad)].filter(id => state.findMinion(id));
    const victoryChance = victoryChanceFor(participants.length, activeDefenders);
    const avgRank = participants.length ? participants.reduce((s, id) => s + state.findMinion(id)!.rank, 0) / participants.length : 1;
    const durationHours = mission.baseDurationHours *
        Math.max(0.8, 1 - 0.04 * Math.max(0, participants.length - 1) - 0.01 * (avgRank - 1));
    const averageInjury = (success: boolean) => participants.length
        ? participants.reduce((s, id) => s + injuryChanceFor(state, id, victoryChance, success), 0) / participants.length : 0;
    const injuryChanceOnVictory = averageInjury(true);
    const injuryChanceOnDefeat = averageInjury(false);
    return {
        totalPower: participants.length, powerRatio: activeDefenders > 0 ? participants.length / activeDefenders : Infinity,
        victoryChance, guaranteedVictory: victoryChance === 1, activeDefenders, fullDefenders: village.fullDefenders,
        failureChance: 1 - victoryChance, durationHours, injuryChanceOnVictory, injuryChanceOnDefeat,
        avgInjuryChance: victoryChance * injuryChanceOnVictory + (1 - victoryChance) * injuryChanceOnDefeat,
    };
}

export function canLaunchRaid(state: GameState, missionId: string, squad: string[]): boolean {
    if (squad.length === 0 || new Set(squad).size !== squad.length) return false;
    if (state.missionState(missionId) !== "AVAILABLE") return false;
    return squad.every(id => {
        const m = state.findMinion(id);
        return m && m.activity.type === "idle" && !m.tired && !m.injured;
    });
}

/** Only used for pre-snapshot saves and synthetic processes. New raids capture all fields at launch. */
export function ensureRaidSnapshot(state: GameState, process: RaidProcess): void {
    initializeVillages(state);
    process.raidWeek ??= Math.floor(process.startHour / (24 * CONFIG.constants.weekDays));
    const village = state.villageState(process.missionId);
    const sameWeek = village.week === process.raidWeek;
    process.fullDefenders ??= village.fullDefenders;
    process.activeDefenders ??= sameWeek ? village.activeDefenders : process.fullDefenders;
    process.victoryChance ??= victoryChanceFor(process.squad.length, process.activeDefenders);
    process.rewards ??= copyRewards(sameWeek ? village.rewards : generateRewards(state, missionDef(process.missionId)));
}

export function launchRaid(state: GameState, missionId: string, squad: string[], now: number): boolean {
    recoverVillages(state);
    if (!canLaunchRaid(state, missionId, squad)) return false;
    const preview = previewRaid(state, missionId, squad);
    const village = state.villageState(missionId);
    const process: RaidProcess = {
        id: state.genId("raid"), type: "raid",
        startHour: now, endHour: now + preview.durationHours, missionId, squad: [...squad],
        raidWeek: village.week, activeDefenders: village.activeDefenders, fullDefenders: village.fullDefenders,
        victoryChance: preview.victoryChance, rewards: copyRewards(village.rewards),
    };
    state.processes.push(process);
    state.missionRunningProcess.set(missionId, process.id);
    state.raidsLaunched++;
    for (const id of squad) {
        const minion = state.findMinion(id)!;
        minion.activity = { type: "raid", missionId, processId: process.id };
        minion.waitingSince = null;
    }
    state.log(`Raid launched on ${missionDef(missionId).name} with ${squad.length} minion(s).`);
    return true;
}

export function resolveRaid(state: GameState, process: RaidProcess): RaidReportDraft {
    ensureRaidSnapshot(state, process);
    const victoryChance = process.victoryChance!;
    const successRoll = state.rng();
    const success = victoryChance === 1 || (victoryChance > 0 && successRoll >= 1 - victoryChance);
    const injuryRolls: Record<string, number> = {};
    for (const id of process.squad) {
        injuryRolls[id] = state.rng() < injuryChanceFor(state, id, victoryChance, success) ? 1 : 0;
    }

    const defendersBefore = process.activeDefenders!;
    let defenderLosses = success ? defendersBefore : 0;
    if (!success) {
        // Each attacker gets at most one casualty attempt; defeat always leaves a survivor.
        const attempts = Math.min(process.squad.length, Math.max(0, defendersBefore - 1));
        const chance = CONFIG.constants.raid.defenderLossChance * process.squad.length / (process.squad.length + defendersBefore);
        for (let i = 0; i < attempts; i++) if (state.rng() < chance) defenderLosses++;
    }
    const defendersRemaining = defendersBefore - defenderLosses;
    const village = state.villageState(process.missionId);
    if (village.week === process.raidWeek) {
        village.activeDefenders = defendersRemaining;
        if (success) {
            village.raided = true;
            village.rewards = emptyRewards();
        }
    }
    state.everVisitedMissions.add(process.missionId);
    const rewards = success ? copyRewards(process.rewards!) : emptyRewards();
    const carryLimit = Math.floor(process.squad.reduce((sum, id) => {
        const minion = state.findMinion(id)!;
        return sum + CONFIG.ranks[minion.rank - 1].carryCapacity;
    }, 0));
    return {
        missionId: process.missionId, success, squad: [...process.squad],
        goldFound: rewards.gold, crystalsFound: rewards.crystals, lootCopies: rewards.lootCopies, prisonersFound: rewards.prisoners,
        carryLimit, selection: preselectWithinBudget(rewards.lootCopies, carryLimit), injuryRolls,
        raidWeek: process.raidWeek, fullDefenders: process.fullDefenders, victoryChance,
        durationHours: process.endHour - process.startHour,
        defendersBefore, defenderLosses, defendersRemaining,
    };
}

function preselectWithinBudget(lootCopies: string[], carryLimit: number): Record<string, number> {
    const selection: Record<string, number> = {};
    let slotsUsed = 0;
    for (const itemId of lootCopies) {
        const def = CONFIG.items.find(i => i.id === itemId)!;
        const before = selection[itemId] ?? 0;
        const slotsBefore = Math.ceil(before / def.maxStackSize);
        const slotsAfter = Math.ceil((before + 1) / def.maxStackSize);
        const extraSlots = slotsAfter - slotsBefore;
        if (slotsUsed + extraSlots > carryLimit) continue;
        selection[itemId] = before + 1;
        slotsUsed += extraSlots;
    }
    return selection;
}
