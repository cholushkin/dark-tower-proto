import { CONFIG } from "../data/config";
import type { GameState } from "../model/GameState";
import type { RaidReportDraft } from "../model/types";
import { creditCrystals, creditGold } from "./economy";
import { markWaitingIfIdle } from "./recovery";
import { admitPrisoner } from "./dungeon";
import { addTowerXp } from "./tower";
import { initializeVillages, raidWeekForReport, updateMissionProgression } from "./world";

export function discoveredCounts(draft: RaidReportDraft): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const itemId of draft.lootCopies) counts[itemId] = (counts[itemId] ?? 0) + 1;
    return counts;
}

export function claimReport(state: GameState, missionId: string, now: number): boolean {
    const draft = state.pendingReports.get(missionId);
    if (!draft) return false;

    if (draft.success) {
        creditGold(state, draft.goldFound);
        creditCrystals(state, draft.crystalsFound);
        for (const [itemId, count] of Object.entries(discoveredCounts(draft))) state.addItems(itemId, count);
        const sortedPrisoners = [...draft.prisonersFound].sort((a, b) => b - a);
        for (const rank of sortedPrisoners) admitPrisoner(state, rank);
    }

    for (const minionId of draft.squad) {
        const minion = state.findMinion(minionId);
        if (!minion) continue;
        minion.tired = true;
        minion.injured = draft.injuredMinionIds.includes(minionId);
        minion.activity = { type: "idle" };
        markWaitingIfIdle(state, minion, now);
    }

    if (draft.success && !state.everClaimedMissions.has(missionId)) {
        state.everClaimedMissions.add(missionId);
        addTowerXp(state, 5);
        updateMissionProgression(state, now);
    }

    state.everVisitedMissions.add(missionId);
    const claimWeek = Math.floor(now / (24 * CONFIG.constants.weekDays));
    const raidWeek = raidWeekForReport(state, draft, now);
    if (!state.selectedMissionIds.has(missionId)) {
        state.villages.delete(missionId);
        state.missionClaimedWeek.delete(missionId);
    } else if (draft.success && raidWeek === claimWeek) {
        initializeVillages(state);
        const village = state.villageState(missionId);
        if (village.week === raidWeek) {
            state.missionClaimedWeek.set(missionId, raidWeek);
            village.raided = true;
            village.activeDefenderRanks = [];
            village.rewards = { gold: 0, crystals: 0, lootCopies: [], prisoners: [] };
        }
    }
    state.pendingReports.delete(missionId);
    state.processes = state.processes.filter(p => !(p.type === "walkback" && p.missionId === missionId));
    state.log(draft.success
        ? `Claimed raid report for ${missionId}: success.`
        : `Claimed raid report for ${missionId}: failed, no loot.`);
    return true;
}
