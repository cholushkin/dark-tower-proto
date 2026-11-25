import { CONFIG } from "../data/config";
import type { UpgradeEffect } from "../data/types";
import type {
    Minion,
    Prisoner,
    ItemStack,
    Process,
    MissionState,
    RaidReportDraft,
    VillageState,
} from "./types";

export class GameState {
    hours = 0;
    speed = 1;
    paused = false;
    rng: () => number = Math.random;

    gold = CONFIG.startingBalance.gold;
    crystals = CONFIG.startingBalance.crystals;

    minions: Minion[] = [];
    prisoners: Prisoner[] = [];
    stacks: ItemStack[] = [];
    processes: Process[] = [];
    private nextSeq = 1;

    purchasedUpgrades = new Set<string>();
    incrementalLevels = new Map<string, number>();
    acquiredUpgrades = new Set<string>([...CONFIG.upgrades, ...CONFIG.incrementalUpgrades]
        .filter(def => def.availableAtStart !== false).map(def => def.id));
    /** Named conditions for quests/events and future progression systems. */
    progressionFlags = new Set<string>();

    unlockedTiers = new Set<number>([1]);
    /** Missions ever successfully claimed (permanent) — drives World Tier unlocks only. */
    everClaimedMissions = new Set<string>();
    /** Missions ever raided (success or failure), for the World Map "raided before" flag. */
    everVisitedMissions = new Set<string>();
    /** Week of the last successful raid, independent of permanent completion. */
    missionClaimedWeek = new Map<string, number>();
    villages = new Map<string, VillageState>();
    missionRunningProcess = new Map<string, string>();
    pendingReports = new Map<string, RaidReportDraft>();

    towerXp = 0;

    raidsLaunched = 0;
    worldCompletedAtHour: number | null = null;

    paydayPending = false;
    paydayDueAtHour: number | null = null;
    /** Set when payday becomes due; cleared once the player dismisses the big payday popup. */
    paydayAnnouncement: { emoji: string; title: string; flavor: string } | null = null;

    gameOver: "bankruptcy" | null = null;

    logLines: string[] = [];
    departureNotices: string[] = [];

    constructor() {
        for (const rank of CONFIG.startingBalance.minionRanks) {
            this.minions.push({
                id: this.genId("minion"),
                rank,
                tired: false,
                injured: false,
                activity: { type: "idle" },
                waitingSince: null,
            });
        }
        for (const starting of CONFIG.startingItems) {
            this.addItems(starting.itemId, starting.count);
        }
        this.log("The tower stirs. Three minions await your command.");
    }

    genId(prefix: string): string {
        return `${prefix}_${this.nextSeq++}`;
    }

    get nextSequence(): number { return this.nextSeq; }

    restoreNextSequence(nextSeq: number): void {
        this.nextSeq = Math.max(this.nextSeq, Math.floor(nextSeq));
    }

    log(message: string): void {
        this.logLines.push(message);
        if (this.logLines.length > 250) this.logLines.shift();
        if (typeof window !== "undefined") console.log("🗼", message);
    }

    get day(): number {
        return Math.floor(this.hours / 24);
    }

    get week(): number {
        return Math.floor(this.day / CONFIG.constants.weekDays);
    }

    // ---- Derived room capacities / upgrade effects ----

    private sumEffect(pick: (e: UpgradeEffect) => number | null): number {
        let total = 0;
        for (const u of CONFIG.upgrades) {
            if (!this.purchasedUpgrades.has(u.id)) continue;
            const v = pick(u.effect);
            if (v !== null) total += v;
        }
        return total;
    }

    private productEffect(pick: (e: UpgradeEffect) => number | null): number {
        let total = 1;
        for (const u of CONFIG.upgrades) {
            if (!this.purchasedUpgrades.has(u.id)) continue;
            const v = pick(u.effect);
            if (v !== null) total *= v;
        }
        return total;
    }

    storageSlots(): number {
        return CONFIG.startingBalance.storageSlots + this.sumEffect(e => (e.type === "storageSlots" ? e.amount : null));
    }

    usedSlots(): number {
        // Pending sales reserve their slots so cancellation can always return the stacks.
        return this.stacks.length + this.processes.filter(process => process.type === "sale").length;
    }

    incrementalLevel(upgradeId: string): number {
        return this.incrementalLevels.get(upgradeId) ?? 0;
    }

    private sumIncrementalEffect(effectType: "bed" | "treatmentBed" | "trainingStation"): number {
        let total = 0;
        for (const u of CONFIG.incrementalUpgrades) {
            if (u.effect.type === effectType) total += this.incrementalLevel(u.id);
        }
        return total;
    }

    bedCount(): number {
        return CONFIG.startingBalance.beds
            + this.sumEffect(e => (e.type === "bed" ? 1 : null))
            + this.sumIncrementalEffect("bed");
    }

    treatmentBedCount(): number {
        return CONFIG.startingBalance.treatmentBeds
            + this.sumEffect(e => (e.type === "treatmentBed" ? 1 : null))
            + this.sumIncrementalEffect("treatmentBed");
    }

    trainingStationCount(): number {
        return CONFIG.startingBalance.trainingStations + this.sumIncrementalEffect("trainingStation");
    }

    dungeonCellCount(): number {
        return CONFIG.startingBalance.dungeonCells + this.sumEffect(e => (e.type === "dungeonCell" ? 1 : null));
    }

    saleEfficiencyMultiplier(): number {
        return this.productEffect(e => (e.type === "saleEfficiency" ? e.multiplier : null));
    }

    treatmentEfficiencyMultiplier(): number {
        return this.productEffect(e => (e.type === "treatmentEfficiency" ? e.multiplier : null));
    }

    tortureEfficiencyMultiplier(): number {
        return this.productEffect(e => (e.type === "tortureEfficiency" ? e.multiplier : null));
    }

    recruitmentEfficiencyBonus(): number {
        return this.sumEffect(e => (e.type === "recruitmentEfficiency" ? e.bonus : null));
    }

    enemyIntelLevel(): number {
        return this.sumEffect(e => (e.type === "enemyIntel" ? 1 : null));
    }

    lootIntelLevel(): number {
        return this.sumEffect(e => (e.type === "lootIntel" ? 1 : null));
    }

    laboratoryTierUnlocked(): number {
        return CONFIG.upgrades.reduce((tier, upgrade) =>
            this.purchasedUpgrades.has(upgrade.id) && upgrade.effect.type === "laboratoryTier"
                ? Math.max(tier, upgrade.effect.tier) : tier, 1);
    }

    isTrainingTransitionUnlocked(fromRank: number): boolean {
        if (fromRank === 1) return true;
        for (const u of CONFIG.upgrades) {
            if (u.effect.type === "trainingUnlock" && u.effect.fromRank === fromRank) {
                return this.purchasedUpgrades.has(u.id);
            }
        }
        return false;
    }

    effectiveAttack(rank: number): number {
        return this.effectiveStat(rank, "attack");
    }

    effectiveDefense(rank: number): number {
        return this.effectiveStat(rank, "defense");
    }

    private effectiveStat(rank: number, stat: "attack" | "defense"): number {
        const base = CONFIG.ranks[rank - 1][stat];
        let value = base;
        for (const upgrade of CONFIG.upgrades) {
            if (!this.purchasedUpgrades.has(upgrade.id)) continue;
            const effect = upgrade.effect;
            if (effect.type === "minionStat" && effect.stat === stat && effect.mode === "add") value += effect.value;
        }
        for (const upgrade of CONFIG.upgrades) {
            if (!this.purchasedUpgrades.has(upgrade.id)) continue;
            const effect = upgrade.effect;
            if (effect.type === "minionStat" && effect.stat === stat && effect.mode === "mult") value *= effect.value;
        }
        return value;
    }

    towerLevel(): number {
        let level = 1;
        for (let i = 0; i < CONFIG.towerXpThresholds.length; i++) {
            if (this.towerXp >= CONFIG.towerXpThresholds[i]) level = i + 1;
        }
        return level;
    }

    // ---- Minion / inventory helpers ----

    findMinion(id: string): Minion | undefined {
        return this.minions.find(m => m.id === id);
    }

    idleUnconditionedMinions(): Minion[] {
        return this.minions.filter(m => m.activity.type === "idle" && !m.tired && !m.injured);
    }

    weeklySalary(): number {
        return this.minions.reduce((sum, m) => sum + CONFIG.ranks[m.rank - 1].salaryGoldPerWeek, 0);
    }

    /** Acquisition never spends resources, starts a timer, grants XP, or applies an effect. */
    acquireUpgrade(upgradeId: string): boolean {
        if (![...CONFIG.upgrades, ...CONFIG.incrementalUpgrades].some(def => def.id === upgradeId)) return false;
        if (this.acquiredUpgrades.has(upgradeId)) return false;
        this.acquiredUpgrades.add(upgradeId);
        return true;
    }

    addItems(itemId: string, count: number): number {
        const def = CONFIG.items.find(i => i.id === itemId);
        if (!def || count <= 0) return count;
        if (def.upgradeId) {
            if (![...CONFIG.upgrades, ...CONFIG.incrementalUpgrades].some(upgrade => upgrade.id === def.upgradeId)) return count;
            this.acquireUpgrade(def.upgradeId);
            return 0; // Upgrade pickups are learned immediately; duplicates are harmless.
        }
        let remaining = count;
        for (const stack of this.stacks) {
            if (stack.itemId !== itemId || stack.count >= def.maxStackSize) continue;
            const room = def.maxStackSize - stack.count;
            const add = Math.min(room, remaining);
            stack.count += add;
            remaining -= add;
            if (remaining <= 0) return 0;
        }
        while (remaining > 0 && this.usedSlots() < this.storageSlots()) {
            const add = Math.min(def.maxStackSize, remaining);
            this.stacks.push({ id: this.genId("stack"), itemId, count: add });
            remaining -= add;
        }
        return remaining;
    }

    removeStack(stackId: string): void {
        this.stacks = this.stacks.filter(s => s.id !== stackId);
    }

    villageState(missionId: string): VillageState {
        const existing = this.villages.get(missionId);
        if (existing) return existing;
        const fullDefenders = CONFIG.missions.find(m => m.id === missionId)?.fullDefenders ?? 0;
        return {
            week: this.week, fullDefenders, activeDefenders: fullDefenders, raided: false,
            rewards: { gold: 0, crystals: 0, lootCopies: [], prisoners: [] },
        };
    }

    missionState(missionId: string): MissionState {
        const mission = CONFIG.missions.find(m => m.id === missionId);
        if (!mission) return "LOCKED";
        if (!this.unlockedTiers.has(mission.tier)) return "LOCKED";
        if (this.pendingReports.has(missionId)) return "COMPLETED_UNCLAIMED";
        if (this.missionRunningProcess.has(missionId)) return "RUNNING";
        const village = this.villages.get(missionId);
        if (village?.week === this.week && village.raided) return "COOLDOWN";
        if (this.missionClaimedWeek.get(missionId) === this.week) return "COOLDOWN";
        return "AVAILABLE";
    }
}
