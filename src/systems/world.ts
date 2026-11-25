import { CONFIG } from "../data/config";
import type { MissionDef } from "../data/types";
import type { GameState } from "../model/GameState";
import type { RaidProcess, RaidReportDraft, VillageRewards, VillageState } from "../model/types";
import { simulateBattle } from "./battle";

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
    return { week, activeDefenderRanks: [...mission.defenderRanks], rewards: generateRewards(state, mission), raided: false };
}

/** Fills missing legacy state without replacing existing stock, raids, or reports. */
export function initializeVillages(state: GameState): void {
    for (const mission of state.activeMissions()) {
        if (state.villages.has(mission.id)) continue;
        const village = freshVillage(state, mission);
        if (state.missionClaimedWeek.get(mission.id) === state.week) {
            village.raided = true;
            village.activeDefenderRanks = [];
            village.rewards = emptyRewards();
        }
        state.villages.set(mission.id, village);
    }
}

export function recoverVillages(state: GameState): void {
    initializeVillages(state);
    for (const mission of state.activeMissions()) {
        if (state.villageState(mission.id).week >= state.week) continue;
        state.villages.set(mission.id, freshVillage(state, mission));
    }
}

export function updateMissionProgression(state: GameState, now: number): void {
    const missions = state.activeMissions();
    const tiers = [...new Set(missions.map(mission => mission.tier))].sort((a, b) => a - b);
    for (const tier of tiers) {
        if (!state.unlockedTiers.has(tier)) {
            state.unlockedTiers.add(tier);
            state.log(`World Tier ${tier} unlocked!`);
        }
        if (missions.some(mission => mission.tier === tier && !state.everClaimedMissions.has(mission.id))) break;
    }
    if (state.hasCompletedWorld()) state.worldCompletedAtHour ??= now;
}

export function raidWeekForReport(state: GameState, report: RaidReportDraft, now = state.hours): number {
    if (report.raidWeek !== undefined) return report.raidWeek;
    const walkback = state.processes.find(p => p.type === "walkback" && p.missionId === report.missionId);
    // Walkback duration equals raid duration, allowing older saves to recover the launch time.
    const launchHour = walkback ? Math.max(0, walkback.startHour - (walkback.endHour - walkback.startHour)) : now;
    return Math.floor(launchHour / (24 * CONFIG.constants.weekDays));
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
    const mission = missionDef(process.missionId);
    const village = state.villages.get(process.missionId);
    const launchVillage = village?.week === process.raidWeek ? village : undefined;
    process.defenderRanks ??= [...(launchVillage?.activeDefenderRanks ?? mission.defenderRanks)];
    process.rewards ??= launchVillage ? copyRewards(launchVillage.rewards) : generateRewards(state, mission);
}

export function launchRaid(state: GameState, missionId: string, squad: string[], now: number): boolean {
    recoverVillages(state);
    if (!canLaunchRaid(state, missionId, squad)) return false;
    const mission = missionDef(missionId);
    const village = state.villageState(missionId);
    const process: RaidProcess = {
        id: state.genId("raid"), type: "raid",
        startHour: now, endHour: now + mission.durationHours, missionId, squad: [...squad],
        raidWeek: village.week, defenderRanks: [...village.activeDefenderRanks], rewards: copyRewards(village.rewards),
    };
    state.processes.push(process);
    state.missionRunningProcess.set(missionId, process.id);
    state.raidsLaunched++;
    for (const id of squad) {
        const minion = state.findMinion(id)!;
        minion.activity = { type: "raid", missionId, processId: process.id };
        minion.waitingSince = null;
    }
    state.log(`Raid launched on ${mission.name} with ${squad.length} minion(s).`);
    return true;
}

export function resolveRaid(state: GameState, process: RaidProcess): RaidReportDraft {
    ensureRaidSnapshot(state, process);
    const attackers = process.squad.map(id => {
        const { rank } = state.findMinion(id)!;
        return { id, rank, health: CONFIG.ranks[rank - 1].health, attack: state.effectiveAttack(rank), defense: state.effectiveDefense(rank) };
    });
    const defenders = process.defenderRanks!.map((rank, index) => {
        const { health, attack, defense } = CONFIG.ranks[rank - 1];
        return { id: `defender_${index + 1}`, rank, health, attack, defense };
    });
    const battleLabel = `Battle at ${missionDef(process.missionId).name}`;
    const describeSquad = (units: typeof attackers) => units.map(unit => `${unit.id} (R${unit.rank})`).join(", ") || "none";
    state.log(`${battleLabel} | Attackers: ${describeSquad(attackers)} | Defenders: ${describeSquad(defenders)}`);
    const survivors = simulateBattle(attackers, defenders, state.rng, message => state.log(`${battleLabel} | ${message}`));
    const success = survivors.defenders.length === 0;
    const survivingMinionIds = new Set(survivors.attackers.map(unit => unit.id));
    const injuredMinionIds = process.squad.filter(id => !survivingMinionIds.has(id));
    const defendersRemaining = survivors.defenders.length;
    state.log(`${battleLabel} | ${success ? "Attackers" : "Defenders"} win | Attackers remaining: ${survivors.attackers.length} | Defenders remaining: ${defendersRemaining}`);

    const village = state.villageState(process.missionId);
    if (village.week === process.raidWeek) {
        village.activeDefenderRanks = survivors.defenders.map(unit => unit.rank);
        if (success) {
            village.raided = true;
            village.rewards = emptyRewards();
        }
    }
    state.everVisitedMissions.add(process.missionId);
    const rewards = success ? copyRewards(process.rewards!) : emptyRewards();
    return {
        missionId: process.missionId, success, squad: [...process.squad],
        goldFound: rewards.gold, crystalsFound: rewards.crystals, lootCopies: rewards.lootCopies, prisonersFound: rewards.prisoners,
        injuredMinionIds, raidWeek: process.raidWeek,
        defendersBefore: defenders.length, defenderLosses: defenders.length - defendersRemaining, defendersRemaining,
        durationHours: process.endHour - process.startHour,
        battleReplay: survivors.replay,
    };
}
