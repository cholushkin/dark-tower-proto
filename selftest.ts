import { buildRaidReportViewModel, handleRaidReportAction } from './src/ui/screens/raid-report/RaidReportAdapter';
import { playbackRounds } from './src/ui/screens/battle-visualization/BattlePlayback';
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
import { GameState } from "./src/model/GameState";
import { canLaunchRaid, initializeVillages, missionDef, recoverVillages, resolveRaid } from "./src/systems/world";
import { admitPrisoner, assignCells, freeCells } from "./src/systems/dungeon";
import { assignBeds } from "./src/systems/recovery";
import { nextCost } from "./src/systems/incrementalUpgrades";
import type { Process, RaidProcess, RaidReportDraft } from "./src/model/types";

import { requirementFailure } from "./src/systems/upgradeRequirements";
import { upgradePurchaseFailure, completeUpgrade } from "./src/systems/upgrades";
import { buildLaboratoryViewModel } from "./src/ui/screens/laboratory/LaboratoryAdapter";
import { buildUpgradeLineViewModel } from "./src/ui/screens/shared";
import type { UpgradeRequirement, UpgradeDef } from "./src/data/types";

import { deserializeGame, serializeGame, saveGame, loadGame } from "./src/systems/save";
import { buildWarRoomViewModel, createWarRoomUiState, handleWarRoomAction } from "./src/ui/screens/war-room/WarRoomAdapter";
import { hasWonGame } from "./src/ui/screens/victory/VictoryAdapter";

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
    check(engine.state.logLines.at(-1) === "Storehouse starts upgrade: Storage Shelves I (+2 storage slots).", "construction logs the room and capacity increase");
    check(!engine.buyUpgrade("sh_storage_1"), "cannot buy the same upgrade twice while building");
    const process = findProcess(engine, "upgrade");
    engine.forceCompleteProcess(process.id);
    check(engine.state.logLines.at(-1) === "Storehouse ends upgrade: Storage Shelves I (+2 storage slots).", "completion logs the applied effect");
    check(engine.state.purchasedUpgrades.has("sh_storage_1"), "upgrade marked purchased after completion");
    check(engine.state.storageSlots() === before + 2, "storage capacity increased by configured amount");
    check(engine.state.towerXp === 5, "tower XP awarded on upgrade completion");
}

// --- 3. Raid lifecycle: launch -> complete -> report -> claim ---
console.log("\n[3] Raid lifecycle");
{
    const engine = new GameEngine();
    const squad = engine.state.minions.map(m => m.id);
    const duration = missionDef("t1_millbrook").durationHours;

    check(engine.launchRaid("t1_millbrook", squad), "raid launches with the full starting squad");
    check(engine.state.missionState("t1_millbrook") === "RUNNING", "mission is RUNNING once launched");
    check(!engine.launchRaid("t1_stonebridge", squad), "squad already on a raid cannot launch a second one");

    const raidProcess = findProcess(engine, "raid");
    check(raidProcess.endHour - raidProcess.startHour === duration, "raid timer uses the configured duration");
    engine.state.rng = () => 0;
    const secondsPerHour = CONFIG.constants.dayLengthRealSeconds / 24;
    engine.tick((duration - 1) * secondsPerHour);
    check(engine.state.missionState("t1_millbrook") === "RUNNING", "battle waits for the configured raid time");
    engine.tick(secondsPerHour);

    check(engine.state.missionState("t1_millbrook") === "COMPLETED_UNCLAIMED", "mission awaits Claim after raid completes");
    const draft = engine.state.pendingReports.get("t1_millbrook")!;
    check(draft !== undefined, "a raid report draft exists");
    check(draft.success && draft.defendersRemaining === 0, "attackers win when every defender is defeated");
    check(squad.every(id => engine.state.findMinion(id)!.activity.type === "raid"), "squad stays reserved until Claim");

    const warRoom = createWarRoomUiState();
    const missionPin = () => buildWarRoomViewModel(engine, warRoom).missions.find(pin => pin.id === draft.missionId);
    engine.tick(duration / 2 * secondsPerHour);
    const returningPin = missionPin();
    check(returningPin?.state === 'reportReady' && Math.abs((returningPin.progress ?? 0) - 0.5) < 1e-6,
        'the map marker shows progress on the return trip');
    const openedReports: string[] = [];
    const nav = { openRaidReport(id: string) { openedReports.push(id); } };
    handleWarRoomAction(engine, warRoom, { type: 'missionSelected', missionId: draft.missionId }, nav);
    handleWarRoomAction(engine, warRoom, { type: 'raidRequested', missionId: draft.missionId }, nav);
    check(openedReports.join(',') === [draft.missionId, draft.missionId].join(',') && engine.state.pendingReports.has(draft.missionId),
        'the return marker and View Report open the same pending report');

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
    check(missionPin()?.state === 'completed' && missionPin()?.progress === undefined, 'claiming clears the return marker');
}

// --- 4. Claim resolution: loot stacking and prisoner intake (synthetic draft, RNG-independent) ---
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
        injuredMinionIds: [],
    };
    engine.state.pendingReports.set("t1_millbrook", draft);

    const report = buildRaidReportViewModel(engine, draft.missionId)!;
    check(report.loot.length === 2, "report shows one tile per item type");
    check(report.loot.map(item => item.stack?.label).join(',') === '× 6,× 1', "report shows the full quantity found for each item");

    const legacySave = JSON.parse(serializeGame(engine.state));
    legacySave.version = 1;
    const legacyReport = legacySave.state.pendingReports[draft.missionId];
    delete legacyReport.injuredMinionIds;
    Object.assign(legacyReport, { carryLimit: 1, selection: { golden_cup: 1 }, injuryRolls: { [squad[0]]: 1 } });
    const migrated = new GameEngine(deserializeGame(JSON.stringify(legacySave))!);
    check(migrated.claimReport(draft.missionId) && migrated.state.stacks.filter(s => s.itemId === 'golden_cup').reduce((n, s) => n + s.count, 0) === 6,
        'a saved victory grants every found copy after migration');
    check(migrated.state.minions[0].injured, 'a saved report retains its existing injury results');

    const cellsBefore = freeCells(engine.state);
    let closed = false;
    handleRaidReportAction(
        engine, draft.missionId,
        { type: 'claimRequested', raidId: draft.missionId },
        { close() { closed = true; }, openBattleVisualization() { throw new Error('Claim should not open the battle'); } },
    );
    check(closed && !engine.state.pendingReports.has(draft.missionId), "claiming the full reward closes and clears the report");

    const goldenStacks = engine.state.stacks.filter(s => s.itemId === "golden_cup");
    const totalGolden = goldenStacks.reduce((n, s) => n + s.count, 0);
    check(totalGolden === 6, "all 6 discovered Golden Cups were stored");
    check(goldenStacks.length === 2, "6 Golden Cups (max stack 5) split into 2 Storehouse stacks");
    check(engine.state.stacks.some(s => s.itemId === "cobblestone" && s.count === 1), "discovered Cobblestone stored");

    check(engine.state.prisoners.length === 2, "captured prisoners admitted for processing");
    const ranksAdmitted = engine.state.prisoners.map(p => p.rank).sort((a, b) => b - a);
    check(ranksAdmitted[0] === 3 && ranksAdmitted[1] === 1, "prisoners sorted high-to-low rank on admission");
    check(freeCells(engine.state) === cellsBefore - 1, "the single starting dungeon cell is occupied");
}

// --- 5. Training Hall: unlock transition, train, recover ---
console.log("\n[5] Training Hall");
{
    const engine = new GameEngine();
    const minionId = engine.state.minions[0].id;
    check(engine.state.isTrainingTransitionUnlocked(1), "rank 1→2 transition is unlocked from the start, no upgrade needed");
    check(!engine.state.isTrainingTransitionUnlocked(2), "rank 2→3 transition is still locked until its upgrade is purchased");
    check(engine.startTraining(minionId), "training starts once unlocked and affordable");
    check(engine.state.logLines.at(-1)?.includes("Rank 1 Rookie → 2 Grunt (+3 health, +3 attack, +2 defense, +30 gold weekly salary)") === true, "training logs the promotion and stat changes");
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
    check(engine.state.logLines.at(-1) === "Laboratory starts upgrade: Improved Weapons (+1 attack for all).", "Laboratory logs the configured bonus");
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
    check(engine.state.logLines.at(-1) === "Laboratory ends upgrade: Improved Weapons (+1 attack for all).", "Laboratory logs the completed bonus");
    check(engine.state.purchasedUpgrades.has('res_improved_weapons'), "weapons completion uses purchasedUpgrades");
    check(engine.state.effectiveAttack(1) === baseAttack + 1, "completed weapons adds one to attack");
    check(!engine.buyUpgrade('res_fury_spell'), "completed weapons alone does not bypass the tier requirement");
    const xp = engine.state.towerXp;
    if (weapons.type === 'upgrade') completeUpgrade(engine.state, weapons);
    check(engine.state.towerXp === xp, "repeated completion cannot award XP twice");
    engine.forceCompleteProcess(engine.state.processes.find(p => p.type === 'upgrade' && p.upgradeId === 'lab_tier_1')!.id);
    check(engine.buyUpgrade('res_fury_spell'), "Fury unlocks after both requirements complete");
    engine.forceCompleteProcess(engine.state.processes.find(p => p.type === 'upgrade' && p.upgradeId === 'res_fury_spell')!.id);
    check(engine.state.effectiveAttack(1) === baseAttack + 1 + 2, "Fury adds its bonus to the weapon bonus");
    engine.forceCompleteProcess(engine.state.processes.find(p => p.type === 'upgrade' && p.upgradeId === 'res_improved_armor')!.id);
    check(engine.state.effectiveDefense(1) === baseDefense + 1, "armor adds one to defense");
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
        availableAtStart: false, requirements: { type: 'flag', flag: 'ready' }, effect: { type: 'minionStat', stat: 'attack', value: 2 }, towerXp: 4 };
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
        state.pendingReports.set(missionId, { missionId, success: true, squad: [], goldFound: 0, crystalsFound: 0, lootCopies: ['test_blueprint'], prisonersFound: [], injuredMinionIds: [] });
        check(engine.claimReport(missionId) && state.acquiredUpgrades.has(definition.id), "claiming an upgrade pickup acquires it even with full storage");
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
    const tier1Missions = engine.state.activeMissions().filter(m => m.tier === 1);
    const lastTier1 = tier1Missions[tier1Missions.length - 1];
    for (const mission of tier1Missions) {
        if (mission.id !== lastTier1.id) engine.state.everClaimedMissions.add(mission.id);
    }
    check(!engine.state.unlockedTiers.has(2), "tier 2 stays locked until every tier-1 mission has been claimed");

    const draft: RaidReportDraft = {
        missionId: lastTier1.id, success: true, squad: [],
        goldFound: 0, crystalsFound: 0, lootCopies: [], prisonersFound: [],
        injuredMinionIds: [],
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
    const squad = [engine.state.minions[0].id];
    engine.state.rng = () => 0; // forces captures and minimum configured quantities
    engine.state.villages.clear();
    initializeVillages(engine.state);
    for (const mission of CONFIG.missions) {
        const draft = resolveRaid(engine.state, {
            id: "test-raid", type: "raid", startHour: 0, endHour: mission.durationHours, missionId: mission.id, squad, defenderRanks: [],
        });
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
    engine.state.rng = () => 0;
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
    check(engine.state.logLines.at(-1) === "Training Hall starts upgrade: Add Training Station (+1 training station).", "repeatable upgrades log their effect");
    engine.forceCompleteProcess(findProcess(engine, "incrementalUpgrade").id);
    check(engine.state.trainingStationCount() === stationsBefore + 1, "training station count increases by one after completion");
}

console.log("\n[17] Simultaneous turns, focused damage, and mutual defeat");
{
    const engine = new GameEngine();
    const id = 't1_millbrook';
    const squad = engine.state.minions.map(m => m.id);
    const rolls = [0, 0, 0, 0, 0.4, 0.8, 0, 0, 0, 0, 0.4, 0.8];
    engine.state.rng = () => rolls.shift() ?? 0;
    engine.launchRaid(id, squad);
    engine.forceCompleteProcess(findProcess(engine, 'raid').id);
    const turns = engine.state.logLines.filter(line => line.includes(' | Turn '));
    check(turns[0].includes('defender_1 5 → 2 HP') && squad.every(minion => turns[0].includes(`${minion} 5 → 4 HP`)),
        'three Rookie hits sum to 3 damage while defenders hit one Rookie each');
    check(turns[1].includes(`defender_1 → ${squad[0]} for 1`) && turns[1].includes('defender_1 2 → -1 HP (defeated)'),
        'a defender still hits in the turn it is defeated');
    check(!turns[2].includes('defender_1'), 'a defeated unit cannot hit or be targeted next turn');
    const report = engine.state.pendingReports.get(id)!;
    check(report.success && report.injuredMinionIds.join(',') === squad.slice(0, 2).join(','), 'victory records only the defeated minions as injured');
    engine.claimReport(id);
    check(engine.state.minions.slice(0, 2).every(minion => minion.injured) && !engine.state.minions[2].injured,
        'Claim applies the battle injuries');
    check(engine.state.minions.every(minion => minion.tired), 'all participants become tired');

    const mirror = new GameEngine();
    mirror.state.villageState(id).activeDefenderRanks = [1];
    mirror.state.rng = () => 0;
    const minion = mirror.state.minions[0].id;
    mirror.launchRaid(id, [minion]);
    mirror.forceCompleteProcess(findProcess(mirror, 'raid').id);
    const wipeout = mirror.state.pendingReports.get(id)!;
    check(wipeout.success && wipeout.defendersRemaining === 0 && wipeout.injuredMinionIds.includes(minion),
        'attackers receive the victory on a simultaneous wipeout');
    check(wipeout.goldFound > 0, 'a simultaneous wipeout grants victory rewards');
    const recording = wipeout.battleReplay!;
    check(recording.attackers[0].health === 5 && recording.defenders[0].rank === 1 && recording.rounds.length === 5,
        'the recording snapshots the starting units and every combat round');
    const originalSave = serializeGame(mirror.state);
    const restored = new GameEngine(deserializeGame(originalSave)!);
    check(JSON.stringify(restored.state.pendingReports.get(id)?.battleReplay) === JSON.stringify(recording),
        'saving an unclaimed report preserves its battle recording');
    handleRaidReportAction(mirror, id, { type: 'battleVisualizationRequested' }, {
        close() { throw new Error('Opening a battle should keep the report open'); },
        openBattleVisualization(model) {
            const round = [...playbackRounds(model, () => 0.5)].at(-1)!;
            check(round.hits.length === 2 && round.hits[0].healthRatio === 0
                && round.hits[1].attackerId === round.hits[0].targetId && round.endHealth.every(unit => unit.defeated),
                'the replay retains the lethal counterattack and marks both units defeated at round end');
        },
    });
    check(serializeGame(mirror.state) === originalSave, 'opening and reading the replay leaves the saved game state untouched');
    const oldSave = JSON.parse(originalSave);
    delete oldSave.state.pendingReports[id].battleReplay;
    const oldReport = new GameEngine(deserializeGame(JSON.stringify(oldSave))!);
    check(buildRaidReportViewModel(oldReport, id)?.canViewBattle === false && oldReport.claimReport(id),
        'older reports without a recording remain claimable');
}

console.log("\n[18] Configured rank stats and minion upgrade modifiers");
{
    const id = 't1_millbrook';
    for (const upgraded of [false, true]) {
        const engine = new GameEngine();
        const state = engine.state;
        const minion = state.minions[0];
        minion.rank = 3;
        state.villageState(id).activeDefenderRanks = [3];
        state.rng = () => 0;
        engine.launchRaid(id, [minion.id]);
        const raid = findProcess(engine, 'raid');
        if (upgraded) {
            state.gold = 300;
            engine.buyUpgrade('res_improved_weapons');
            engine.buyUpgrade('res_improved_armor');
            for (const process of state.processes.filter(process => process.type === 'upgrade')) engine.forceCompleteProcess(process.id);
        }
        check(raid.endHour - raid.startHour === missionDef(id).durationHours, 'a lone higher-rank minion uses the same configured duration');
        engine.forceCompleteProcess(raid.id);
        const firstTurn = state.logLines.find(line => line.includes(' | Turn 1 |'))!;
        check(firstTurn.includes(`${minion.id} → defender_1 for ${upgraded ? 3 : 2}`)
            && firstTurn.includes(`defender_1 → ${minion.id} for ${upgraded ? 1 : 2}`)
            && firstTurn.includes(`${minion.id} 12 → ${upgraded ? 11 : 10} HP`),
            upgraded ? 'completed weapons and armor modify only minion combat stats' : 'both sides draw health and damage stats from their rank');
        const cards = buildLaboratoryViewModel(engine).upgrades;
        check(cards.every(card => !/\b(attack|defense|health)\b/i.test(`${card.description} ${card.currentEffect} ${card.nextEffect}`)),
            'Laboratory cards keep combat parameters hidden');
    }
    check(CONFIG.missions.every(m => m.description.trim().length > 0), 'every mission has a location description in data');
}

console.log("\n[19] Room slot presentation and roster training");
{
    const engine = new GameEngine();
    const ui = createStorehouseUiState();
    const inventory = buildStorehouseViewModel(engine, ui);
    check(inventory.items.length === 5 && inventory.vacantSlots === 3, 'initial storage shows five item cards and three vacancies');
    engine.startNormalSale(engine.state.stacks[0].id);
    check(buildStorehouseViewModel(engine, ui).vacantSlots === 3, 'selling items retain their occupied slots');
    ui.activeTags.clear();
    const filtered = buildStorehouseViewModel(engine, ui);
    check(filtered.items.length === 0 && filtered.vacantSlots === 3, 'filters do not turn hidden items into vacancies');
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


console.log("\n[20] Enemy intelligence and undefended villages");
{
    const engine = new GameEngine();
    const ui = createWarRoomUiState();
    ui.selectedMissionId = 't1_millbrook';
    engine.state.villageState(ui.selectedMissionId).activeDefenderRanks = [1, 1, 3];
    ui.squadSelection = new Set(engine.state.minions.map(m => m.id));
    let model = buildWarRoomViewModel(engine, ui);
    const duration = model.selectedMission!.parameters.find(p => p.id === 'duration')!.value;
    check(duration === '6.0h', 'mission displays its fixed duration before any intelligence upgrade');
    check(model.missions.find(m => m.id === ui.selectedMissionId)!.defendersLabel === undefined, 'unvisited village count starts hidden on map');
    engine.state.everVisitedMissions.add(ui.selectedMissionId);
    model = buildWarRoomViewModel(engine, ui);
    check(model.missions.find(m => m.id === ui.selectedMissionId)!.defendersLabel === '3', 'first visit reveals active count under flag');
    check(!model.selectedMission!.parameters.some(p => p.id === 'defender-ranks'), 'visiting reveals headcount while ranks require intelligence');
    engine.state.purchasedUpgrades.add('wr_enemy_intel_1');
    ui.squadSelection.clear();
    model = buildWarRoomViewModel(engine, ui);
    check(model.selectedMission!.parameters.find(p => p.id === 'defender-ranks')!.value === 'R1 × 2 · R3 × 1', 'intelligence shows the composition of the active garrison');
    check(model.selectedMission!.parameters.find(p => p.id === 'duration')!.value === duration, 'intel and squad selection leave the displayed duration constant');
    check(!engine.launchRaid(ui.selectedMissionId, []), 'empty squads cannot raid');
    check(!engine.launchRaid(ui.selectedMissionId, [engine.state.minions[0].id, engine.state.minions[0].id]), 'duplicate minion IDs cannot inflate attacker count');
    engine.state.villageState(ui.selectedMissionId).activeDefenderRanks = [];
    engine.state.rng = () => { throw new Error('An undefended battle needs no target rolls'); };
    check(engine.launchRaid(ui.selectedMissionId, [engine.state.minions[0].id]), 'nonempty squad can raid zero defenders');
    engine.forceCompleteProcess(findProcess(engine, 'raid').id);
    const draft = engine.state.pendingReports.get(ui.selectedMissionId)!;
    check(draft.success && draft.injuredMinionIds.length === 0, 'an undefended raid ends in victory with no injuries');
}

console.log("\n[21] Failed raids, persistent damage, and recovery");
{
    const engine = new GameEngine();
    const state = engine.state;
    const id = 't1_millbrook';
    const squad = state.minions.map(m => m.id);
    state.villageState(id).activeDefenderRanks = [1, 4];
    const stock = JSON.stringify(state.villageState(id).rewards);
    engine.launchRaid(id, squad);
    state.rng = () => 0;
    engine.forceCompleteProcess(findProcess(engine, 'raid').id);
    const report = state.pendingReports.get(id)!;
    check(!report.success && report.defenderLosses === 1 && report.defendersRemaining === 1, 'defenders win when attackers fall and a defender survives');
    check(buildRaidReportViewModel(engine, id)?.claim.label === 'Teleport Minions Back', 'a defeat report offers to teleport the minions back');
    check(state.villageState(id).activeDefenderRanks.join(',') === '4', 'only the surviving defender rank persists in village state');
    check(JSON.stringify(state.villageState(id).rewards) === stock, 'failed raids do not consume or reroll weekly stock');
    check(report.goldFound === 0 && report.crystalsFound === 0 && report.lootCopies.length === 0 && report.prisonersFound.length === 0, 'defeat reserves no village rewards');
    check(state.missionState(id) === 'COMPLETED_UNCLAIMED' && !canLaunchRaid(state, id, squad), 'unclaimed failure keeps the village and squad reserved');
    const gold = state.gold;
    check(engine.claimReport(id) && state.missionState(id) === 'AVAILABLE', 'Claim unlocks failed village in the same week');
    check(state.gold === gold && !state.everClaimedMissions.has(id), 'failed Claim grants neither money nor permanent completion');
    check(state.minions.every(minion => minion.injured) && state.minions[0].activity.type === 'treatment', 'defeated participants become injured and enter recovery');
    check(!canLaunchRaid(state, id, [squad[0]]), 'injured recovering minion cannot raid');
    engine.forceCompleteProcess(findProcess(engine, 'rest').id);
    for (let i = 0; i < squad.length; i++) engine.forceCompleteProcess(findProcess(engine, 'treatment').id);
    check(state.minions.every(minion => !minion.injured) && canLaunchRaid(state, id, squad), 'treatment restores raid eligibility');
    state.minions[0].rank = 5;
    check(engine.launchRaid(id, squad), 'recovered squad retries with no fee or retry limit');
    const retry = findProcess(engine, 'raid') as RaidProcess;
    check(retry.defenderRanks?.join(',') === '4', 'the retry snapshots only surviving ranks');
    engine.forceCompleteProcess(retry.id);
    check(state.pendingReports.get(id)!.success, 'retry can succeed against the smaller garrison');
    engine.claimReport(id);
    check(state.missionState(id) === 'COOLDOWN' && state.everClaimedMissions.has(id), 'successful Claim keeps village unavailable for this week');
    check(state.villageState(id).activeDefenderRanks.length === 0 && state.villageState(id).rewards.gold === 0, 'victory consumes the current garrison and stock');
    const afterGold = state.gold;
    check(!engine.claimReport(id) && state.gold === afterGold, 'duplicate Claim cannot duplicate rewards');
}

console.log("\n[22] Simultaneous raids reserve separate villages and squads");
{
    const engine = new GameEngine();
    const state = engine.state;
    const squad = state.minions.map(m => m.id);
    check(engine.launchRaid('t1_millbrook', [squad[0]]), 'first small squad starts a raid');
    check(engine.launchRaid('t1_stonebridge', [squad[1]]), 'disjoint squad raids another village simultaneously');
    check(!engine.launchRaid('t1_fallowcreek', [squad[0]]), 'simultaneous raids cannot share a minion');
    check(!engine.launchRaid('t1_millbrook', [squad[2]]), 'one village cannot have two unresolved raids');
    state.rng = () => 0;
    engine.forceCompleteProcess(state.processes.find(p => p.type === 'raid' && p.missionId === 't1_stonebridge')!.id);
    const report = state.pendingReports.get('t1_stonebridge')!;
    check(!report.success && report.defenderLosses === 0, 'a lone Rookie is defeated by the full Stonebridge garrison');
    check(state.missionState('t1_millbrook') === 'RUNNING', 'one battle can resolve while the other raid is running');
    check(!engine.launchRaid('t1_fallowcreek', [squad[1]]), 'returned but unclaimed minion remains reserved');
}

console.log("\n[23] Weekly recovery isolates running raids and frozen reports");
{
    const weekHours = CONFIG.constants.weekDays * 24;
    for (const success of [true, false]) {
        const engine = new GameEngine();
        const state = engine.state;
        state.hours = weekHours - 1;
        state.rng = () => 0;
        const id = 't1_millbrook';
        const squad = state.minions.map(m => m.id);
        state.villageState(id).activeDefenderRanks = success ? [1, 1] : [1, 4];
        state.everClaimedMissions.add('t1_stonebridge');
        state.unlockedTiers.add(2);
        state.villageState('t1_stonebridge').activeDefenderRanks = [];
        state.villageState('t1_stonebridge').raided = true;
        state.villageState('t1_stonebridge').rewards.gold = 999999;
        engine.launchRaid(id, squad);
        const raid = findProcess(engine, 'raid') as RaidProcess;
        const oldSnapshot = JSON.stringify(raid);
        engine.tick(CONFIG.constants.dayLengthRealSeconds / 24);
        check(state.week === 1 && state.villageState(id).week === 1, 'engine resets villages at the exact weekly boundary');
        check(JSON.stringify(raid) === oldSnapshot && squad.every(m => state.findMinion(m)!.activity.type === 'raid'), 'weekly reset preserves running raid and squad reservation');
        check(state.villageState('t1_stonebridge').activeDefenderRanks.join(',') === missionDef('t1_stonebridge').defenderRanks.join(','), 'weekly recovery restores the full ranked garrison');
        check(state.villageState('t1_stonebridge').rewards.gold < 999999, 'weekly rewards replace previous stock rather than accumulating');
        check(state.everClaimedMissions.has('t1_stonebridge') && state.unlockedTiers.has(2), 'weekly recovery retains permanent completion and tier unlocks');
        check(state.missionState('t1_stonebridge') === 'AVAILABLE' && state.missionState(id) === 'RUNNING', 'successful villages reopen while unresolved raids stay locked');
        const refreshedVillage = JSON.stringify(state.villageState(id));
        engine.forceCompleteProcess(raid.id);
        const report = state.pendingReports.get(id)!;
        check(report.success === success && report.raidWeek === 0, 'cross-week raid uses the launch-week garrison and week');
        check(report.defendersBefore === 2 && report.defendersRemaining === (success ? 0 : 1), 'cross-week result shows losses from the snapshotted garrison');
        check(JSON.stringify(state.villageState(id)) === refreshedVillage, 'cross-week resolution cannot damage or drain the new village');
        const legacyReportSave = JSON.parse(serializeGame(state)).state;
        delete legacyReportSave.villages;
        delete legacyReportSave.pendingReports[id].raidWeek;
        const migratedReport = deserializeGame(JSON.stringify(legacyReportSave))!;
        check(migratedReport.pendingReports.get(id)!.raidWeek === 0, 'legacy cross-week report recovers launch week from walkback duration');
        const migratedVillage = JSON.stringify(migratedReport.villageState(id));
        new GameEngine(migratedReport).claimReport(id);
        check(JSON.stringify(migratedReport.villageState(id)) === migratedVillage, 'legacy old report Claim cannot consume the new weekly village');
        const saved = deserializeGame(serializeGame(state));
        check(saved !== null && JSON.stringify(saved!.pendingReports.get(id)) === JSON.stringify(report), 'cross-week pending report survives save/load unchanged');
        const loaded = new GameEngine(saved!);
        const gold = saved!.gold;
        check(loaded.claimReport(id) && saved!.gold === gold + report.goldFound, 'old report awards its frozen rewards once');
        check(JSON.stringify(saved!.villageState(id)) === refreshedVillage && saved!.missionState(id) === 'AVAILABLE', 'claiming old report leaves this week village available and untouched');
        check(!loaded.claimReport(id) && saved!.gold === gold + report.goldFound, 'old report cannot be claimed twice');
    }
    const engine = new GameEngine();
    const state = engine.state;
    state.hours = weekHours - 1;
    state.rng = () => 0;
    engine.launchRaid('t1_millbrook', state.minions.map(m => m.id));
    engine.forceCompleteProcess(findProcess(engine, 'raid').id);
    const frozen = JSON.stringify(state.pendingReports.get('t1_millbrook'));
    engine.tick(CONFIG.constants.dayLengthRealSeconds / 24);
    check(JSON.stringify(state.pendingReports.get('t1_millbrook')) === frozen, 'weekly reset does not alter an already generated report');
    check(state.missionState('t1_millbrook') === 'COMPLETED_UNCLAIMED', 'old unclaimed report still prevents a duplicate village raid');
    const fresh = JSON.stringify(state.villageState('t1_millbrook'));
    engine.forceCompleteProcess(findProcess(engine, 'walkback').id);
    check(JSON.stringify(state.villageState('t1_millbrook')) === fresh, 'old report auto-claim also preserves new weekly village state');
}

console.log("\n[24] Save compatibility and permanent world completion");
{
    const engine = new GameEngine();
    const state = engine.state;
    state.villageState('t1_millbrook').activeDefenderRanks = [2, 1];
    state.purchasedUpgrades.add('wr_enemy_intel_1');
    engine.launchRaid('t1_millbrook', [state.minions[0].id]);
    engine.launchRaid('t1_stonebridge', [state.minions[1].id]);
    const json = serializeGame(state);
    const restored = deserializeGame(json)!;
    check(restored !== null && restored.villageState('t1_millbrook').activeDefenderRanks.join(',') === '2,1', 'save/load preserves the surviving defender ranks');
    check(restored.purchasedUpgrades.has('wr_enemy_intel_1') && restored.processes.filter(p => p.type === 'raid').length === 2, 'save/load preserves sets and simultaneous raids');
    check(JSON.stringify(restored.processes) === JSON.stringify(state.processes), 'raid snapshots persist exactly');
    check(!canLaunchRaid(restored, 't1_fallowcreek', [state.minions[0].id]), 'load restores minion reservation');
    check(restored.genId('test') === state.genId('test'), 'save/load preserves ID sequence');
    const countSave = JSON.parse(json);
    countSave.version = 1;
    for (const raid of countSave.state.processes) {
        raid.activeDefenders = raid.defenderRanks.length;
        delete raid.defenderRanks;
    }
    countSave.state.villages.t1_millbrook.activeDefenders = 2;
    delete countSave.state.villages.t1_millbrook.activeDefenderRanks;
    const countMigration = deserializeGame(JSON.stringify(countSave))!;
    check(countMigration.villageState('t1_millbrook').activeDefenderRanks.join(',') === '1,1', 'legacy village counts expand to configured ranks');
    const migratedRaid = countMigration.processes.find(p => p.type === 'raid' && p.missionId === 't1_millbrook') as RaidProcess;
    check(migratedRaid.defenderRanks?.join(',') === '1,1' && migratedRaid.endHour === state.processes[0].endHour,
        'legacy raid counts migrate while retaining their scheduled end time');
    const legacy = JSON.parse(json).state;
    delete legacy.villages;
    for (const raid of legacy.processes) for (const key of ['raidWeek', 'defenderRanks', 'rewards']) delete raid[key];
    legacy.missionClaimedWeek = { t1_fallowcreek: 0 };
    const migrated = deserializeGame(JSON.stringify(legacy))!;
    check(migrated !== null && migrated.villages.size === migrated.selectedMissionIds.size, 'legacy saves initialize only selected villages');
    check(migrated.missionState('t1_fallowcreek') === 'AVAILABLE', 'legacy unsuccessful weekly lock is removed');
    check(migrated.processes.filter(p => p.type === 'raid').every(p => p.raidWeek === 0 && p.rewards !== undefined), 'legacy active raids receive stable snapshots');
    check(deserializeGame('{broken') === null && deserializeGame('{"version":999,"state":{}}') === null, 'corrupt and future saves fail gracefully');
    const conflicting = JSON.parse(json);
    conflicting.state.processes[1].squad = conflicting.state.processes[0].squad;
    check(deserializeGame(JSON.stringify(conflicting)) === null, 'malformed save cannot assign one minion to two raids');
    let stored = '';
    check(saveGame(state, { setItem: (_key, value) => { stored = value; } }), 'storage adapter saves successfully');
    check(loadGame({ getItem: () => stored }) !== null, 'storage adapter loads successfully');
    check(!saveGame(state, { setItem: () => { throw new Error('unavailable'); } }), 'unavailable browser storage does not crash game');
    const completion = new GameEngine();
    for (const tier of CONFIG.worldTiers) completion.state.unlockedTiers.add(tier.tier);
    check(!hasWonGame(completion), 'unlocking the final tier does not win before clearing it');
    const selected = completion.state.activeMissions();
    for (const mission of selected.slice(0, -1)) completion.state.everClaimedMissions.add(mission.id);
    const last = selected.at(-1)!;
    completion.state.pendingReports.set(last.id, { missionId: last.id, success: true, squad: [], goldFound: 0, crystalsFound: 0, lootCopies: [], prisonersFound: [], injuredMinionIds: [] });
    completion.state.hours = 42;
    completion.claimReport(last.id);
    check(hasWonGame(completion) && completion.state.worldCompletedAtHour === 42, 'final successful Claim records complete-world elapsed time');
    completion.state.hours = CONFIG.constants.weekDays * 24;
    recoverVillages(completion.state);
    check(hasWonGame(completion) && completion.state.worldCompletedAtHour === 42, 'weekly recovery cannot erase victory or change the completion time');
}

console.log("\n[25] Enabled mission groups and saved world selection");
{
    const engine = new GameEngine(new GameState(() => 0));
    const state = engine.state;
    const missions = state.activeMissions();
    const opening = ["t1_millbrook", "t1_stonebridge", "t1_fallowcreek", "t1_oakhollow"];
    check(missions.filter(m => m.tier === 1).map(m => m.id).join(',') === opening.join(','), "only the first four missions appear in Tier 1");
    const map = buildWarRoomViewModel(engine, createWarRoomUiState());
    check(map.missions.map(m => m.id).join(',') === opening.join(','), "the opening map has exactly four mission pins");
    const groupCount = new Set(CONFIG.missions.filter(m => m.enabled).map(m => m.groupId)).size;
    check(missions.length === groupCount && new Set(missions.map(m => m.groupId)).size === groupCount
        && missions.every(m => m.enabled), "the world contains one enabled mission per populated group");
    const differentRoll = new GameState(() => 0.99);
    check(differentRoll.activeMissions().some(m => !state.selectedMissionIds.has(m.id)), "different rolls choose different later missions");
    const skipped = CONFIG.missions.find(m => m.enabled && !state.selectedMissionIds.has(m.id))!;
    state.unlockedTiers.add(skipped.tier);
    check(!engine.launchRaid(skipped.id, [state.minions[0].id]) && !state.villages.has(skipped.id), "unselected missions cannot launch or generate rewards");
    check(!engine.launchRaid("t1_duskhollow", [state.minions[0].id]), "disabled missions cannot launch");
    const restored = deserializeGame(serializeGame(state))!;
    restored.hours += CONFIG.constants.weekDays * 24;
    recoverVillages(restored);
    check([...restored.selectedMissionIds].join(',') === [...state.selectedMissionIds].join(',')
        && restored.villages.size === missions.length, "reloading and weekly recovery keep the chosen roster");

    engine.launchRaid(opening[0], [state.minions[0].id]);
    const legacy = JSON.parse(serializeGame(state));
    legacy.version = 2;
    delete legacy.state.selectedMissionIds;
    legacy.state.processes.find((p: Process) => p.type === 'raid').missionId = 't1_duskhollow';
    const migrated = new GameEngine(deserializeGame(JSON.stringify(legacy))!);
    check(!migrated.state.selectedMissionIds.has('t1_duskhollow')
        && migrated.state.missionState('t1_duskhollow') === 'RUNNING', "an old raid can finish when its mission leaves the roster");
    migrated.forceCompleteProcess(findProcess(migrated, 'raid').id);
    check(migrated.claimReport('t1_duskhollow') && migrated.state.missionState('t1_duskhollow') === 'LOCKED',
        "claiming an old raid releases the squad and retires the disabled mission");
}

console.log(`\n== All ${passed} checks passed ==`);
