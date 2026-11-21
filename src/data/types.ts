export type RoomId =
    | "storehouse"
    | "quarters"
    | "infirmary"
    | "trainingHall"
    | "laboratory"
    | "dungeon"
    | "warRoom";

export interface RankDef {
    rank: number;
    name: string;
    attack: number;
    defense: number;
    salaryGoldPerWeek: number;
    carryCapacity: number;
}

export interface ItemDef {
    id: string;
    name: string;
    tags: string[];
    /** Collecting this item unlocks an upgrade instead of occupying storage. */
    upgradeId?: string;
    maxStackSize: number;
    baseValueGold: number;
}

export interface TrainingTransitionDef {
    fromRank: number;
    toRank: number;
    costGold: number;
    durationHours: number;
}

export type UpgradeEffect =
    | { type: "storageSlots"; amount: number }
    | { type: "saleEfficiency"; multiplier: number }
    | { type: "bed" }
    | { type: "treatmentBed" }
    | { type: "treatmentEfficiency"; multiplier: number }
    | { type: "trainingUnlock"; fromRank: number }
    | { type: "laboratoryTier"; tier: number }
    | { type: "minionStat"; stat: "attack" | "defense"; mode: "add" | "mult"; value: number }
    | { type: "dungeonCell" }
    | { type: "tortureEfficiency"; multiplier: number }
    | { type: "recruitmentEfficiency"; bonus: number }
    | { type: "enemyIntel"; level: number }
    | { type: "lootIntel"; level: number };

/** Serializable requirements: extend the condition evaluator when adding a new game metric. */
export type UpgradeRequirement =
    | { type: "all" | "any"; requirements: UpgradeRequirement[] }
    | { type: "not"; requirement: UpgradeRequirement }
    | { type: "upgradeCompleted"; upgradeId: string }
    | { type: "upgradeAcquired"; upgradeId: string }
    | { type: "condition"; metric: "towerLevel" | "laboratoryTier" | "gold" | "crystals" | "minionCount"; operator: "gte" | "lte" | "eq"; value: number }
    | { type: "flag"; flag: string }
    | { type: "missionCompleted"; missionId: string }
    | { type: "itemCount"; itemId: string; count: number };

export interface UpgradeDef {
    id: string;
    room: RoomId;
    name: string;
    description: string;
    costGold: number;
    costCrystals?: number;
    durationHours: number;
    requirements: UpgradeRequirement;
    /** Defaults to true; false makes acquisition through a pickup/reward necessary. */
    availableAtStart?: boolean;
    effect: UpgradeEffect;
    towerXp: number;
}

export type IncrementalUpgradeEffect = { type: "bed" } | { type: "treatmentBed" } | { type: "trainingStation" };

/** An infinite, repeatable upgrade whose cost/duration climb by a fixed step each purchase. */
export interface IncrementalUpgradeDef {
    requirements?: UpgradeRequirement;
    availableAtStart?: boolean;
    id: string;
    room: RoomId;
    name: string;
    description: string;
    baseCostGold: number;
    costStepGold: number;
    baseDurationHours: number;
    durationStepHours: number;
    effect: IncrementalUpgradeEffect;
    towerXp: number;
}

export interface MissionLootDef {
    itemId: string;
    chance: number;
    min: number;
    max: number;
}

export interface WorldDef {
    id: string;
    name: string;
    /** Path relative to public/, without a leading slash. */
    mapImage: string;
    /** Mission IDs must be unique across all worlds. */
    missions: MissionDef[];
}

export interface MissionDef {
    description: string;
    weather: "clear" | "rain" | "fog" | "storm";
    /** Percentage coordinates on the world map, measured from the top-left. */
    mapPosition: { x: number; y: number };
    id: string;
    tier: number;
    name: string;
    requiredPower: number;
    baseDurationHours: number;
    baseInjuryChance: number;
    rewardGoldRange: [number, number];
    rewardCrystalsRange: [number, number];
    loot: MissionLootDef[];
    prisonerChance: number;
    prisonerCountRange: [number, number];
    prisonerRankRange: [number, number];
}

export interface WorldTierDef {
    tier: number;
    name: string;
}

export interface StartingBalance {
    gold: number;
    crystals: number;
    minionRanks: number[];
    storageSlots: number;
    beds: number;
    treatmentBeds: number;
    trainingStations: number;
    dungeonCells: number;
}

export interface StartingItemDef {
    itemId: string;
    count: number;
}

export interface Constants {
    dayLengthRealSeconds: number;
    weekDays: number;
    restDurationHours: number;
    treatmentDurationHours: number;
    bedEvictionHours: number;
    paydayWindowHours: number;
    instantSaleFraction: number;
    saleBaseHours: number;
    saleHoursPerCopy: number;
    dungeonBaseDurationHours: number;
    dungeonOutcomeBase: { recruit: number; interrogate: number; death: number };
    recruitedInjuredChance: number;
}

export interface GameConfig {
    worlds: WorldDef[];
    startingWorldId: string;
    ranks: RankDef[];
    items: ItemDef[];
    missions: MissionDef[];
    worldTiers: WorldTierDef[];
    upgrades: UpgradeDef[];
    incrementalUpgrades: IncrementalUpgradeDef[];
    trainingTransitions: TrainingTransitionDef[];
    towerXpThresholds: number[];
    startingBalance: StartingBalance;
    startingItems: StartingItemDef[];
    constants: Constants;
}
