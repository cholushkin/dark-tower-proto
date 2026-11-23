import { buildRaidReportViewModel, handleRaidReportAction } from './src/ui/screens/raid-report/RaidReportAdapter';
import { buildStorehouseViewModel, createStorehouseUiState } from './src/ui/screens/storehouse/StorehouseAdapter';
import { buildTrainingHallViewModel, createTrainingHallUiState, handleTrainingHallAction } from './src/ui/screens/training-hall/TrainingHallAdapter';
import { buildQuartersViewModel } from './src/ui/screens/quarters/QuartersAdapter';
import { buildInfirmaryViewModel } from './src/ui/screens/infirmary/InfirmaryAdapter';
/**
 * Headless end-to-end smoke test for the Dark Tower prototype engine (no DOM/browser needed).
 * Run with `npm run selftest`. Throws (non-zero exit) on the first failed assertion.
 */
import { CONFIG } from "./src/data/config";
import { GameEngine } from "./src/engine/GameEngine";
import { previewRaid, resolveRaid } from "./src/systems/world";
import { admitPrisoner, assignCells, freeCells } from "./src/systems/dungeon";
import { assignBeds } from "./src/systems/recovery";
import { nextCost } from "./src/systems/incrementalUpgrades";
import type { Process, RaidReportDraft } from "./src/model/types";

import { requirementFailure } from "./src/systems/upgradeRequirements";
import { upgradePurchaseFailure, completeUpgrade } from "./src/systems/upgrades";
import { buildLaboratoryViewModel } from "./src/ui/screens/laboratory/LaboratoryAdapter";
import { buildUpgradeLineViewModel } from "./src/ui/screens/shared";
import type { UpgradeRequirement, UpgradeDef } from "./src/data/types";

let passed = 0;
function check(condition: boolean, message: string): void {
    if (!condition) throw new Error(`FAILED: ${message}`);
    passed++;
    console.log(`  ok: ${message}`);
}

function findProcess(engine: GameEngine, type: Process["type"]): Process {
    const p = engine.state.processes.find(x => x.type === type);
    if (!p) throw new Error(`expected an active '${type}' process`);
    return p;
}

console.log("== Dark Tower prototype self-test ==\n");

// --- 1. Initial state ---
console.log("[1] Initial state");
{
    const engine = new GameEngine();
    check(engine.state.minions.length === 3, "starts with 3 minions");
    check(engine.state.gold === CONFIG.startingBalance.gold, "starts with configured gold");
    check(engine.state.missionState("t1_millbrook") === "AVAILABLE", "tier-1 mission is available at start");
    check(engine.state.missionState("t2_ravenswood") === "LOCKED", "tier-2 mission is locked at start");

    check(engine.state.usedSlots() === CONFIG.startingItems.length, "starting items occupy exactly one stack each");
    check(engine.state.usedSlots() <= engine.state.storageSlots(), "starting inventory respects Storehouse capacity");
    for (const starting of CONFIG.startingItems) {
        const stack = engine.state.stacks.find(s => s.itemId === starting.itemId);
        check(!!stack && stack.count === starting.count, `starting stock includes ${starting.count}x ${starting.itemId}`);
    }
    const treasureStack = engine.state.stacks.find(s => s.itemId === "golden_cup")!;
    const goldBeforeInstantSale = engine.state.gold;
    check(engine.instantSale(treasureStack.id), "a starting treasure stack can be sold immediately");
    check(engine.state.gold > goldBeforeInstantSale, "instant-selling starting stock pays out gold");
}

// --- 2. Room upgrade purchase + construction ---
console.log("\n[2] Storehouse upgrade");
{
    const engine = new GameEngine();
    const before = engine.state.storageSlots();
    check(engine.buyUpgrade("sh_storage_1"), "can start Storage Shelves I");
    check(!engine.buyUpgrade("sh_storage_1"), "cannot buy the same upgrade twice while building");
    const process = findProcess(engine, "upgrade");
    engine.forceCompleteProcess(process.id);
    check(engine.state.purchasedUpgrades.has("sh_storage_1"), "upgrade marked purchased after completion");
    check(engine.state.storageSlots() === before + 10, "storage capacity increased by configured amount");
    check(engine.state.towerXp === 5, "tower XP awarded on upgrade completion");
}

// --- 3. Raid lifecycle: launch -> complete -> report -> claim ---
console.log("\n[3] Raid lifecycle");
{
    const engine = new GameEngine();
    const squad = engine.state.minions.map(m => m.id);
    const preview = previewRaid(engine.state, "t1_millbrook", squad);
    check(preview.durationHours > 0, "raid preview computes a positive duration");

    check(engine.launchRaid("t1_millbrook", squad), "raid launches with the full starting squad");
    check(engine.state.missionState("t1_millbrook") === "RUNNING", "mission is RUNNING once launched");
    check(!engine.launchRaid("t1_stonebridge", squad), "squad already on a raid cannot launch a second one");

    const raidProcess = findProcess(engine, "raid");
    engine.state.rng = () => 1; // force success, and force "no bonus loot/prisoners" for a clean base-case assertion
    engine.forceCompleteProcess(raidProcess.id);
    engine.state.rng = Math.random;

    check(engine.state.missionState("t1_millbrook") === "COMPLETED_UNCLAIMED", "mission awaits Claim after raid completes");
    const draft = engine.state.pendingReports.get("t1_millbrook")!;
    check(draft !== undefined, "a raid report draft exists");
    check(draft.success === true, "forced roll produced a successful raid");
    check(draft.carryLimit === Math.floor(squad.reduce((sum, id) => sum + CONFIG.ranks[engine.state.findMinion(id)!.rank - 1].carryCapacity, 0)), "report carry slots equal the combined squad capacity");
    check(squad.every(id => engine.state.findMinion(id)!.activity.type === "raid"), "squad stays reserved until Claim");

    const goldBefore = engine.state.gold;
    const crystalsBefore = engine.state.crystals;
    check(engine.claimReport("t1_millbrook"), "Claim succeeds");
    check(engine.state.gold === goldBefore + draft.goldFound, "Claim credits exactly the discovered gold");
    check(engine.state.crystals === crystalsBefore + draft.crystalsFound, "Claim credits exactly the discovered crystals");
    check(squad.every(id => engine.state.findMinion(id)!.activity.type !== "raid"), "squad released from raid reservation after Claim");
    check(squad.every(id => engine.state.findMinion(id)!.tired), "every participant becomes Tired after a raid");
    check(engine.state.everClaimedMissions.has("t1_millbrook"), "mission marked as ever-claimed");
    check(engine.state.missionState("t1_millbrook") === "COOLDOWN", "mission enters weekly cooldown after claim");
    check(!engine.state.pendingReports.has("t1_millbrook"), "pending report cleared after Claim");
}

// --- 4. Claim resolution: loot stacking, carry budget, prisoner intake (synthetic draft, RNG-independent) ---
console.log("\n[4] Claim resolution — loot stacking and prisoners");
{
    const engine = new GameEngine();
    engine.state.stacks = []; // isolate from starting inventory; this test asserts exact stack-splitting counts
    const squad = engine.state.minions.slice(0, 1).map(m => m.id);
    const minion = engine.state.findMinion(squad[0])!;
    minion.activity = { type: "raid", missionId: "t1_millbrook" };

    const draft: RaidReportDraft = {
        missionId: "t1_millbrook", success: true, squad,
        goldFound: 42, crystalsFound: 3,
        lootCopies: ["golden_cup", "golden_cup", "golden_cup", "golden_cup", "golden_cup", "golden_cup", "cobblestone"],
        prisonersFound: [1, 3],
        carryLimit: 10,
        selection: { golden_cup: 6, cobblestone: 1 },
        injuryRolls: { [squad[0]]: 0 },
    };
    engine.state.pendingReports.set("t1_millbrook", draft);

    const report = () => buildRaidReportViewModel(engine, draft.missionId)!;
    const selectStack = (lootStackId: string, selected: boolean) => handleRaidReportAction(
        engine, draft.missionId,
        { type: 'lootSelectionRequested', raidId: draft.missionId, lootStackId, selected },
        { close() {} },
    );
    check(report().loot.length === 3, "report groups six cups and one stone into three stack tiles");
    check(report().loot.map(x => x.quantity).join(',') === '5,1,1', "loot tiles show full and partial stack quantities");
    draft.carryLimit = 3;
    selectStack('golden_cup#0', false);
    check(draft.selection.golden_cup === 1, "deselecting a full stack removes five cups at once");
    check(report().loot.find(x => x.id === 'golden_cup#1')!.selected, "partial cup stack remains selected independently");
    draft.carryLimit = 2;
    check(!report().loot.find(x => x.id === 'golden_cup#0')!.canToggle, "full carry budget disables another stack");
    selectStack('golden_cup#0', true);
    check(draft.selection.golden_cup === 1, "attempt to exceed carry slots leaves selection unchanged");
    selectStack('cobblestone#0', false);
    selectStack('golden_cup#0', true);
    check(draft.selection.golden_cup === 6, "freeing a slot allows taking the full cup stack");
    selectStack('golden_cup#1', false);
    check(draft.selection.golden_cup === 5, "partial stack can be left behind without removing the full stack");
    selectStack('golden_cup#1', true);
    draft.carryLimit = 3;
    selectStack('cobblestone#0', true);

    const cellsBefore = freeCells(engine.state);
    check(engine.claimReport("t1_millbrook"), "Claim succeeds for the synthetic draft");

    const goldenStacks = engine.state.stacks.filter(s => s.itemId === "golden_cup");
    const totalGolden = goldenStacks.reduce((n, s) => n + s.count, 0);
    check(totalGolden === 6, "all 6 selected Golden Cups were stored");
    check(goldenStacks.length === 2, "6 Golden Cups (max stack 5) split into 2 stacks, costing 2 carry slots");
    check(engine.state.stacks.some(s => s.itemId === "cobblestone" && s.count === 1), "selected Cobblestone stored");

    check(engine.state.prisoners.length === 2, "both captured prisoners admitted (cells available)");
    const ranksAdmitted = engine.state.prisoners.map(p => p.rank).sort((a, b) => b - a);
    check(ranksAdmitted[0] === 3 && ranksAdmitted[1] === 1, "prisoners sorted high-to-low rank on admission");
    check(freeCells(engine.state) === cellsBefore - 2, "dungeon cell occupancy reflects admitted prisoners");
}

// --- 5. Training Hall: unlock transition, train, recover ---
console.log("\n[5] Training Hall");
{
    const engine = new GameEngine();
    const minionId = engine.state.minions[0].id;
    check(engine.state.isTrainingTransitionUnlocked(1), "rank 1→2 transition is unlocked from the start, no upgrade needed");
    check(!engine.state.isTrainingTransitionUnlocked(2), "rank 2→3 transition is still locked until its upgrade is purchased");
    check(engine.startTraining(minionId), "training starts once unlocked and affordable");
    engine.forceCompleteProcess(findProcess(engine, "training").id);
    const minion = engine.state.findMinion(minionId)!;
    check(minion.rank === 2, "minion promoted to Rank 2 after training completes");
    check(minion.tired, "a trained minion becomes Tired");
    check(minion.activity.type === "resting", "a Tired, idle minion is auto-assigned a Quarters bed");

    engine.forceCompleteProcess(findProcess(engine, "rest").id);
    check(!engine.state.findMinion(minionId)!.tired, "rest clears Tired");
    check(engine.state.findMinion(minionId)!.activity.type === "idle", "minion is idle again after resting");
}

// --- 6. Laboratory upgrades share construction, requirements and effects ---
console.log("\n[6] Laboratory upgrades");
{
    const engine = new GameEngine();
    engine.state.gold = 5000;
    const baseAttack = engine.state.effectiveAttack(1);
    const baseDefense = engine.state.effectiveDefense(1);
    check(engine.buyUpgrade("res_improved_weapons"), "weapons starts as a regular upgrade");
    check(engine.buyUpgrade("res_improved_armor"), "armor can build alongside weapons");
    check(engine.buyUpgrade("lab_tier_1"), "laboratory tier can build alongside stat upgrades");
    check(engine.buyUpgrade("sh_storage_1"), "another room can build concurrently");
    const gold = engine.state.gold;
    check(!engine.buyUpgrade("res_improved_weapons") && engine.state.gold === gold, "duplicate construction is rejected without charging");
    check(!engine.buyUpgrade("res_fury_spell"), "Fury requires completed tier and weapons upgrades");
    check(engine.state.effectiveAttack(1) === baseAttack, "unfinished upgrades grant no stats");
    const model = buildLaboratoryViewModel(engine);
    check(model.upgrades.length === 4 && model.upgrades.filter(card => card.progress !== undefined).length === 3, "laboratory uses shared cards with concurrent progress");
    check(model.room.stats.some(stat => stat.id === 'active' && stat.value === '3'), "laboratory displays active upgrade count");
    check(!CONFIG.upgrades.some(def => def.id.startsWith('lab_eff')), "laboratory efficiency upgrades are absent");
    const weapons = engine.state.processes.find(p => p.type === 'upgrade' && p.upgradeId === 'res_improved_weapons')!;
    engine.forceCompleteProcess(weapons.id);
    check(engine.state.purchasedUpgrades.has('res_improved_weapons'), "weapons completion uses purchasedUpgrades");
    check(engine.state.effectiveAttack(1) === baseAttack + 3, "completed weapons grants permanent attack");
    check(!engine.buyUpgrade('res_fury_spell'), "completed weapons alone does not bypass the tier requirement");
    const xp = engine.state.towerXp;
    if (weapons.type === 'upgrade') completeUpgrade(engine.state, weapons);
    check(engine.state.towerXp === xp, "repeated completion cannot award XP twice");
    engine.forceCompleteProcess(engine.state.processes.find(p => p.type === 'upgrade' && p.upgradeId === 'lab_tier_1')!.id);
    check(engine.buyUpgrade('res_fury_spell'), "Fury unlocks after both requirements complete");
    engine.forceCompleteProcess(engine.state.processes.find(p => p.type === 'upgrade' && p.upgradeId === 'res_fury_spell')!.id);
    check(Math.abs(engine.state.effectiveAttack(1) - (baseAttack + 3) * 1.15) < 1e-9, "additive upgrade bonuses apply before multipliers");
    engine.forceCompleteProcess(engine.state.processes.find(p => p.type === 'upgrade' && p.upgradeId === 'res_improved_armor')!.id);
    check(engine.state.effectiveDefense(1) === baseDefense + 3, "armor independently grants defense");
    check(!engine.buyUpgrade('res_fury_spell'), "completed one-time upgrades cannot restart");
}

{
    const engine = new GameEngine();
    engine.state.gold = 1000;
    engine.buyUpgrade('res_improved_weapons');
    engine.buyUpgrade('res_improved_armor');
    engine.tick(CONFIG.constants.dayLengthRealSeconds / 24 * 6);
    check(engine.state.purchasedUpgrades.has('res_improved_weapons') && engine.state.purchasedUpgrades.has('res_improved_armor'), 'scheduler completes simultaneous Laboratory upgrades without manual completion');
    check(engine.state.towerXp === 20, 'simultaneous completions each award their own XP');
}

// Requirement trees are serializable and shared by UI and both upgrade systems.
{
    const engine = new GameEngine();
    const state = engine.state;
    const requirement: UpgradeRequirement = { type: 'all', requirements: [
        { type: 'any', requirements: [{ type: 'flag', flag: 'quest_reward' }, { type: 'upgradeCompleted', upgradeId: 'sh_storage_1' }] },
        { type: 'condition', metric: 'towerLevel', operator: 'gte', value: 1 },
        { type: 'not', requirement: { type: 'flag', flag: 'blocked' } },
    ] };
    check(!!requirementFailure(state, requirement), "nested requirements reject unmet alternatives");
    state.progressionFlags.add('quest_reward');
    check(!requirementFailure(state, JSON.parse(JSON.stringify(requirement))), "serialized all/any/not requirements evaluate correctly");
    state.progressionFlags.add('blocked');
    check(!!requirementFailure(state, requirement), "not requirement blocks an excluded condition");
    check(!!requirementFailure(state, { type: 'any', requirements: [] }), "empty any fails closed");
    check(!requirementFailure(state, { type: 'all', requirements: [] }), "empty all has no prerequisites");
    check(!requirementFailure(state, { type: 'condition', metric: 'minionCount', operator: 'eq', value: 3 }), "numeric equality checks state");
    check(!requirementFailure(state, { type: 'condition', metric: 'crystals', operator: 'lte', value: state.crystals }), "numeric upper bound checks state");
    check(!!requirementFailure(state, { type: 'itemCount', itemId: 'iron_ore', count: 999 }), "item requirements check held quantities");
    check(!requirementFailure(state, { type: 'itemCount', itemId: 'iron_ore', count: 1 }), "held items satisfy item requirements");
    const missionId = CONFIG.missions[0].id;
    check(!!requirementFailure(state, { type: 'missionCompleted', missionId }), "mission requirements reject unclaimed missions");
    state.everClaimedMissions.add(missionId);
    check(!requirementFailure(state, { type: 'missionCompleted', missionId }), "mission victory satisfies requirements");
    const def = CONFIG.upgrades.find(def => def.id === 'sh_storage_2')!;
    state.gold = 5000;
    check(buildUpgradeLineViewModel(state, [def], '', def.name).disabledReason === upgradePurchaseFailure(state, def.id), "UI explains the same requirement enforced by purchase");
    check(!engine.buyUpgrade('unknown') && !engine.buyIncremental('unknown'), "unknown upgrade IDs safely fail");
}

// Pickup definitions are test fixtures only: shipping reward tables remain unchanged.
{
    const definition: UpgradeDef = { id: 'test_pickup_upgrade', room: 'laboratory', name: 'Pickup upgrade', description: 'Test', costGold: 20, durationHours: 1,
        availableAtStart: false, requirements: { type: 'flag', flag: 'ready' }, effect: { type: 'minionStat', stat: 'attack', mode: 'add', value: 2 }, towerXp: 4 };
    const incremental = { ...CONFIG.incrementalUpgrades[0], id: 'test_pickup_repeatable', availableAtStart: false, requirements: { type: 'flag' as const, flag: 'ready' } };
    CONFIG.upgrades.push(definition);
    CONFIG.incrementalUpgrades.push(incremental);
    CONFIG.items.push({ id: 'test_blueprint', name: 'Upgrade pickup', tags: ['upgrade'], upgradeId: definition.id, maxStackSize: 1, baseValueGold: 0 });
    try {
        const engine = new GameEngine();
        const state = engine.state;
        state.gold = 1000;
        const attack = state.effectiveAttack(1);
        check(!state.acquiredUpgrades.has(definition.id) && !engine.buyUpgrade(definition.id), "reward-only upgrades require acquisition");
        check(CONFIG.upgrades.filter(def => def.availableAtStart !== false).every(def => state.acquiredUpgrades.has(def.id)), "existing upgrades remain acquired at game start");
        check(!engine.acquireUpgrade('unknown'), "unknown pickups cannot unlock upgrades");
        while (state.stacks.length < state.storageSlots()) state.stacks.push({ id: state.genId('stack'), itemId: 'golden_cup', count: 10 });
        const slots = state.usedSlots();
        const missionId = CONFIG.missions[0].id;
        state.pendingReports.set(missionId, { missionId, success: true, squad: [], goldFound: 0, crystalsFound: 0, lootCopies: ['test_blueprint'], prisonersFound: [], carryLimit: 1, selection: { test_blueprint: 1 }, injuryRolls: {} });
        check(engine.claimReport(missionId) && state.acquiredUpgrades.has(definition.id), "claiming a selected upgrade pickup acquires it even with full storage");
        check(state.usedSlots() === slots && state.effectiveAttack(1) === attack && !state.purchasedUpgrades.has(definition.id), "pickup uses no storage and applies no completed effect");
        check(!engine.buyUpgrade(definition.id), "acquisition does not bypass requirements");
        state.progressionFlags.add('ready');
        check(!requirementFailure(state, { type: 'upgradeAcquired', upgradeId: definition.id }), "acquisition is usable as a generic requirement");
        const xp = state.towerXp;
        check(state.addItems('test_blueprint', 2) === 0 && state.towerXp === xp, "duplicate pickups are harmless and grant no XP");
        check(engine.buyUpgrade(definition.id) && state.gold === 980, "acquired upgrades still pay normal construction cost");
        check(state.effectiveAttack(1) === attack, "pickup upgrade takes effect only on completion");
        engine.forceCompleteProcess(findProcess(engine, 'upgrade').id);
        check(state.effectiveAttack(1) === attack + 2 && state.towerXp === xp + 4, "pickup upgrade completes through the normal pipeline");
        check(!engine.buyIncremental(incremental.id), "repeatable upgrades also require acquisition");
        check(engine.acquireUpgrade(incremental.id) && !engine.acquireUpgrade(incremental.id), "direct reward acquisition is idempotent");
        state.progressionFlags.delete('ready');
        check(!engine.buyIncremental(incremental.id), "repeatable upgrades use generic requirements");
        state.progressionFlags.add('ready');
        check(engine.buyIncremental(incremental.id), "acquired repeatable upgrade can be constructed");
        engine.forceCompleteProcess(findProcess(engine, 'incrementalUpgrade').id);
        check(engine.buyIncremental(incremental.id), "repeatable upgrade acquisition persists for later levels");
    } finally {
        CONFIG.upgrades.pop(); CONFIG.incrementalUpgrades.pop(); CONFIG.items.pop();
    }
}

// --- 7. Dungeon: admit, auto-process, recruit outcome ---
console.log("\n[7] Dungeon");
{
    const engine = new GameEngine();
    check(engine.buyIncremental("qt_bed"), "can build an extra bed to make room for a recruit");
    engine.forceCompleteProcess(findProcess(engine, "incrementalUpgrade").id);
    const popBefore = engine.state.minions.length;
    check(popBefore < engine.state.bedCount(), "population has room under the bed cap before recruiting");

    check(admitPrisoner(engine.state, 2), "prisoner admitted into a free cell");
    assignCells(engine.state, engine.state.hours);
    const process = findProcess(engine, "dungeon");

    engine.state.rng = () => 0; // forces the recruit branch (lowest-probability-ordered outcome)
    engine.forceCompleteProcess(process.id);
    engine.state.rng = Math.random;

    check(engine.state.minions.length === popBefore + 1, "a recruited prisoner joins the army when a bed is free");
    check(engine.state.prisoners.length === 0, "the cell is freed once processing completes");
}

// --- 7b. Dungeon: recruitment is capped by bed count, not just cell availability ---
console.log("\n[7b] Dungeon population capped by bed count");
{
    const engine = new GameEngine();
    check(engine.state.minions.length === engine.state.bedCount(), "starting population already fills every starting bed");

    check(admitPrisoner(engine.state, 1), "prisoner admitted into a free cell");
    assignCells(engine.state, engine.state.hours);
    const process = findProcess(engine, "dungeon");
    const popBefore = engine.state.minions.length;

    engine.state.rng = () => 0; // would force the recruit branch if there were room
    engine.forceCompleteProcess(process.id);
    engine.state.rng = Math.random;

    check(engine.state.minions.length === popBefore, "no new minion joins once population is at the bed cap");
    check(engine.state.prisoners.length === 0, "the prisoner is still released from the cell even though recruitment was blocked");
}

// --- 8. Storehouse sales ---
console.log("\n[8] Storehouse sales");
{
    const engine = new GameEngine();
    engine.state.stacks = []; // isolate from starting inventory; this test asserts exact stack counts/payouts
    engine.state.addItems("cobblestone", 10);
    const stack = engine.state.stacks.find(s => s.itemId === "cobblestone")!;
    const goldBefore = engine.state.gold;

    check(engine.startNormalSale(stack.id), "normal sale starts and reserves the stack");
    check(engine.state.stacks.length === 0, "stack removed from inventory while selling");
    const saleProcess = findProcess(engine, "sale");
    engine.forceCompleteProcess(saleProcess.id);
    check(engine.state.gold === goldBefore + 10 * 1, "normal sale pays full value (10 Cobblestone * 1g)");

    engine.state.addItems("iron_ore", 4);
    const stack2 = engine.state.stacks.find(s => s.itemId === "iron_ore")!;
    const goldBefore2 = engine.state.gold;
    check(engine.instantSale(stack2.id), "instant sale completes immediately");
    check(engine.state.gold === goldBefore2 + Math.floor(4 * 3 * 0.5), "instant sale pays half value");
}

// --- 9. Weekly mission reset and tier unlock (no permanent victory) ---
console.log("\n[9] Weekly mission reset and tier unlock");
{
    const engine = new GameEngine();
    const tier1Missions = CONFIG.missions.filter(m => m.tier === 1);
    const lastTier1 = tier1Missions[tier1Missions.length - 1];
    for (const mission of tier1Missions) {
        if (mission.id !== lastTier1.id) engine.state.everClaimedMissions.add(mission.id);
    }
    check(!engine.state.unlockedTiers.has(2), "tier 2 stays locked until every tier-1 mission has been claimed");

    const draft: RaidReportDraft = {
        missionId: lastTier1.id, success: true, squad: [],
        goldFound: 0, crystalsFound: 0, lootCopies: [], prisonersFound: [],
        carryLimit: 0, selection: {}, injuryRolls: {},
    };
    engine.state.pendingReports.set(lastTier1.id, draft);
    engine.claimReport(lastTier1.id);
    check(engine.state.unlockedTiers.has(2), "claiming the last tier-1 mission unlocks World Tier 2");
    check(engine.state.missionState(lastTier1.id) === "COOLDOWN", "claimed mission is unavailable for the rest of the week");

    engine.state.hours += CONFIG.constants.weekDays * 24;
    check(engine.state.missionState(lastTier1.id) === "AVAILABLE", "mission becomes available again once a new week starts");
}

// --- 10. Payroll and bankruptcy ---
console.log("\n[10] Payroll and bankruptcy");
{
    const engine = new GameEngine();
    engine.state.gold += 100; // starting gold is below the 3-minion weekly salary bill
    engine.setSpeed(420);
    engine.tick(1); // 0.4 * 420 * 1 = 168 game hours = exactly 7 days
    check(engine.state.paydayPending, "payday becomes due after 7 in-game days");
    check(engine.payPayroll(), "payroll is paid while affordable");
    check(!engine.state.paydayPending, "payday clears once paid");
    check(!engine.state.gameOver, "no bankruptcy when payroll is paid in time");

    const broke = new GameEngine();
    broke.state.gold = 0;
    broke.setSpeed(60);
    broke.tick(7); // 0.4 * 60 * 7 = 168h (7 days) -> payday due, deadline +24h
    check(broke.state.paydayPending, "bankrupt-bound game reaches payday due");
    check(broke.state.paused, "the big payday popup auto-pauses the clock until acknowledged");
    broke.state.paydayAnnouncement = null; // simulate the player dismissing the popup
    broke.setPaused(false);
    broke.tick(1); // +24h -> deadline passes unpaid
    check(broke.state.gameOver === "bankruptcy", "unpaid payroll at the deadline ends the game in bankruptcy");
}

// --- 11. Incremental upgrades: infinite bed purchases with a rising cost/duration formula ---
console.log("\n[11] Incremental upgrades");
{
    const engine = new GameEngine();
    const bedsBefore = engine.state.bedCount();
    const costBefore = nextCost("qt_bed", engine.state.incrementalLevel("qt_bed"));
    check(engine.buyIncremental("qt_bed"), "can start building a Quarters bed");
    const process = findProcess(engine, "incrementalUpgrade");
    engine.forceCompleteProcess(process.id);
    check(engine.state.bedCount() === bedsBefore + 1, "bed count increases by one after completion");
    check(engine.state.incrementalLevel("qt_bed") === 1, "incremental level advances to 1");
    const costAfter = nextCost("qt_bed", engine.state.incrementalLevel("qt_bed"));
    const step = CONFIG.incrementalUpgrades.find(u => u.id === "qt_bed")!.costStepGold;
    check(costAfter === costBefore + step, "the next purchase costs exactly one more cost-step");
}

// --- 12. Injured+tired minion still rests when the infirmary is full (eviction-dodge fix) ---
console.log("\n[12] Injured+tired minion rests when the infirmary is full");
{
    const engine = new GameEngine();
    const state = engine.state;
    for (let i = 0; i < state.treatmentBedCount(); i++) {
        state.minions.push({
            id: state.genId("minion"), rank: 1, tired: false, injured: true,
            activity: { type: "idle" }, waitingSince: state.hours,
        });
    }
    assignBeds(state, state.hours);
    check(state.processes.filter(p => p.type === "treatment").length === state.treatmentBedCount(),
        "every treatment bed is occupied by another injured minion");

    const subject = state.minions[0];
    subject.tired = true;
    subject.injured = true;
    subject.activity = { type: "idle" };
    subject.waitingSince = state.hours;
    assignBeds(state, state.hours);
    check(subject.activity.type === "resting",
        "an injured+tired minion takes a free Quarters bed to rest when no treatment bed is free");
}

// --- 13. Prisoner guarantee: every mission's prisoner-count range has a minimum of at least 1 ---
console.log("\n[13] Prisoner guarantee");
{
    const engine = new GameEngine();
    const squad: string[] = [];
    for (let i = 0; i < 6; i++) {
        const minion = {
            id: engine.state.genId("minion"), rank: 5, tired: false, injured: false,
            activity: { type: "idle" as const }, waitingSince: null,
        };
        engine.state.minions.push(minion);
        squad.push(minion.id);
    }
    engine.state.rng = () => 0; // forces success (overwhelming squad) and the minimum of every roll
    for (const mission of CONFIG.missions) {
        const draft = resolveRaid(engine.state, {
            id: "test-raid", type: "raid", startHour: 0, endHour: 0, missionId: mission.id, squad,
        });
        check(draft.success, `an overwhelming squad succeeds against ${mission.id}`);
        check(draft.prisonersFound.length >= 1,
            `${mission.id} guarantees at least one prisoner once the capture roll passes`);
    }
    engine.state.rng = Math.random;
}

// --- 14. Raid walk-back: squad auto-returns (and the report auto-claims) if not teleported back ---
console.log("\n[14] Raid walk-back: auto-return without manual teleport");
{
    const engine = new GameEngine();
    const squad = engine.state.minions.map(m => m.id);
    check(engine.launchRaid("t1_millbrook", squad), "raid launches");
    const raidProcess = findProcess(engine, "raid");
    const raidDuration = raidProcess.endHour - raidProcess.startHour;
    engine.state.rng = () => 1; // force success for a clean assertion
    engine.forceCompleteProcess(raidProcess.id);
    engine.state.rng = Math.random;

    check(engine.state.missionState("t1_millbrook") === "COMPLETED_UNCLAIMED", "report is pending right after the raid returns");
    const walkback = findProcess(engine, "walkback");
    check(Math.abs((walkback.endHour - walkback.startHour) - raidDuration) < 1e-6,
        "the walk-back timer takes exactly as long as the raid itself");

    const goldBefore = engine.state.gold;
    engine.forceCompleteProcess(walkback.id);
    check(!engine.state.pendingReports.has("t1_millbrook"), "the report auto-claims once the walk-back timer elapses");
    check(engine.state.gold > goldBefore, "auto-claim still credits the discovered gold");
    check(squad.every(id => engine.state.findMinion(id)!.activity.type !== "raid"),
        "squad is released from raid reservation after walking home");
    check(engine.state.everVisitedMissions.has("t1_millbrook"), "mission is marked as visited once a raid resolves");
}

// --- 15. Raid walk-back: teleporting back cancels the pending walk-home timer ---
console.log("\n[15] Raid walk-back: teleporting back cancels the walk-home timer");
{
    const engine = new GameEngine();
    const squad = engine.state.minions.map(m => m.id);
    engine.launchRaid("t1_millbrook", squad);
    engine.forceCompleteProcess(findProcess(engine, "raid").id);

    check(engine.claimReport("t1_millbrook"), "teleport back (Claim) succeeds");
    check(!engine.state.processes.some(p => p.type === "walkback"), "the walk-back timer is cancelled once teleported back");
}

// --- 16. Training Hall: infinite training stations via incremental upgrade ---
console.log("\n[16] Training Hall: infinite training stations via incremental upgrade");
{
    const engine = new GameEngine();
    const stationsBefore = engine.state.trainingStationCount();
    check(engine.buyIncremental("th_station"), "can start building a Training Station");
    engine.forceCompleteProcess(findProcess(engine, "incrementalUpgrade").id);
    check(engine.state.trainingStationCount() === stationsBefore + 1, "training station count increases by one after completion");
}

// Hidden injury rolls must still permit both injured and uninjured survivors on defeat.
console.log("\n[17] Failed raids roll injuries individually");
{
    const engine = new GameEngine();
    const squad = engine.state.minions.slice(0, 2).map(m => m.id);
    const rolls = [0, 0, 0.99];
    engine.state.rng = () => {
        const roll = rolls.shift();
        if (roll === undefined) throw new Error("Unexpected random roll during failed raid");
        return roll;
    };
    const draft = resolveRaid(engine.state, {
        id: 'failed-injury-test', type: 'raid', missionId: 't3_the_shattered_throne',
        squad, startHour: 0, endHour: 1,
    });
    check(!draft.success, "underpowered squad fails the raid");
    check(draft.injuryRolls[squad[0]] === 1, "low individual roll causes an injury on defeat");
    check(draft.injuryRolls[squad[1]] === 0, "high individual roll avoids injury on defeat");
    check(draft.goldFound === 0 && draft.lootCopies.length === 0, "defeat still awards no loot");
    engine.state.pendingReports.set(draft.missionId, draft);
    engine.claimReport(draft.missionId);
    check(engine.state.findMinion(squad[0])!.injured && !engine.state.findMinion(squad[1])!.injured,
        "claiming a failed raid preserves each individual injury outcome");
    check(squad.every(id => engine.state.findMinion(id)!.tired), "all survivors still need rest after defeat");
    check(previewRaid(engine.state, 't1_stonebridge', []).durationHours === 8,
        "empty squad displays base duration without an artificial time penalty");
}

console.log("\n[18] Weather improves raid outcomes");
{
    const engine = new GameEngine();
    const mission = CONFIG.missions.find(m => m.id === 't1_stonebridge')!;
    const originalWeather = mission.weather;
    const squad = engine.state.minions.map(m => m.id);
    try {
        mission.weather = 'clear';
        const clear = previewRaid(engine.state, mission.id, squad);
        for (const [weather, multiplier] of [['fog', 1.05], ['rain', 1.1], ['storm', 1.15]] as const) {
            mission.weather = weather;
            const preview = previewRaid(engine.state, mission.id, squad);
            check(Math.abs(preview.totalPower - clear.totalPower * multiplier) < 1e-9,
                `${weather} applies its configured squad-power bonus`);
            check(preview.failureChance < clear.failureChance, `${weather} improves victory odds for an underpowered squad`);
            check(preview.avgInjuryChance <= clear.avgInjuryChance, `${weather} does not increase hidden injury risk`);
        }
        mission.weather = 'rain';
        const rainy = previewRaid(engine.state, mission.id, squad);
        const roll = (clear.failureChance + rainy.failureChance) / 2;
        engine.state.rng = () => roll;
        const process = { id: 'weather-test', type: 'raid' as const, missionId: mission.id, squad, startHour: 0, endHour: 1 };
        check(resolveRaid(engine.state, process).success, 'rain bonus affects actual raid resolution');
        mission.weather = 'clear';
        check(!resolveRaid(engine.state, process).success, 'same roll fails without the rain bonus');
    } finally {
        mission.weather = originalWeather;
    }
    check(CONFIG.missions.every(m => m.description.trim().length > 0), 'every mission has a location description in data');
}

console.log("\n[19] Room slot presentation and roster training");
{
    const engine = new GameEngine();
    const ui = createStorehouseUiState();
    const inventory = buildStorehouseViewModel(engine, ui);
    check(inventory.items.length === 5 && inventory.vacantSlots === 15, 'initial storage shows five item cards and fifteen vacancies');
    engine.startNormalSale(engine.state.stacks[0].id);
    check(buildStorehouseViewModel(engine, ui).vacantSlots === 15, 'selling items retain their occupied slots');
    ui.activeTags.clear();
    const filtered = buildStorehouseViewModel(engine, ui);
    check(filtered.items.length === 0 && filtered.vacantSlots === 15, 'filters do not turn hidden items into vacancies');
    const trainingUi = createTrainingHallUiState();
    engine.state.gold = 100000;
    let training = buildTrainingHallViewModel(engine, trainingUi);
    check(training.roster.length === engine.state.minions.length, 'training roster includes every minion');
    const minionId = training.roster[0].card.id;
    handleTrainingHallAction(engine, trainingUi, {type:'trainRequested', minionId});
    training = buildTrainingHallViewModel(engine, trainingUi);
    check(training.stations.some(station => station.occupant?.minionId === minionId), 'roster Train action occupies a free station');
    check(!training.roster.find(entry => entry.card.id === minionId)!.canTrain, 'training minion cannot be assigned twice');
    for (const entry of training.roster) handleTrainingHallAction(engine, trainingUi, {type:'trainRequested', minionId:entry.card.id});
    training = buildTrainingHallViewModel(engine, trainingUi);
    check(training.stations.every(station => station.occupant !== undefined), 'roster training fills available stations');
    check(training.roster.every(entry => !entry.canTrain), 'no Train button remains enabled when capacity is full');
    engine.forceCompleteProcess(findProcess(engine, 'training').id);
    assignBeds(engine.state, engine.state.hours);
    const resting = buildQuartersViewModel(engine).beds.find(bed => bed.occupant)?.occupant;
    check(!!resting && resting.card.id === resting.minionId && !!resting.card.description, 'resting beds include the complete minion card');
    const patient = new GameEngine();
    patient.state.minions[0].injured = true;
    assignBeds(patient.state, patient.state.hours);
    const healing = buildInfirmaryViewModel(patient).beds.find(bed => bed.occupant)?.occupant;
    check(!!healing && healing.card.conditions.some(condition => condition.id === 'injured'), 'treatment beds retain minion condition information');
}

console.log(`\n== All ${passed} checks passed ==`);
