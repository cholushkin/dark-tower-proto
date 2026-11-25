import type { GameConfig, WorldDef } from "./types";
import { WORLD_1A } from "./worlds/world-1A";

const WORLDS: WorldDef[] = [WORLD_1A];

// Single source of truth for all tunable prototype data. Mirrors the "Configuration Catalog"
// role described in DarkTowerGameDesign.md §9 — static rules/values live here, runtime state
// lives in GameState. Values are placeholder balancing, not final numbers (per §10).

export const CONFIG: GameConfig = {
    ranks: [
        { rank: 1, name: "Rookie", health: 5, attack: 5, defense: 5, salaryGoldPerWeek: 50 },
        { rank: 2, name: "Grunt", health: 8, attack: 8, defense: 7, salaryGoldPerWeek: 80 },
        { rank: 3, name: "Raider", health: 12, attack: 12, defense: 10, salaryGoldPerWeek: 100 },
        { rank: 4, name: "Veteran", health: 17, attack: 17, defense: 14, salaryGoldPerWeek: 150 },
        { rank: 5, name: "Captain", health: 23, attack: 23, defense: 19, salaryGoldPerWeek: 250 },
    ],

    items: [
        { id: "golden_cup", name: "Golden Cup", tags: ["treasure"], maxStackSize: 5, baseValueGold: 40 },
        { id: "ancient_crown", name: "Ancient Crown", tags: ["treasure"], maxStackSize: 1, baseValueGold: 150 },
        { id: "silver_necklace", name: "Silver Necklace", tags: ["treasure"], maxStackSize: 5, baseValueGold: 25 },
        { id: "enchanted_gem", name: "Enchanted Gem", tags: ["treasure"], maxStackSize: 3, baseValueGold: 80 },
        { id: "cow", name: "Cow", tags: ["ingridients"], maxStackSize: 1, baseValueGold: 15 },
        { id: "cobblestone", name: "Cobblestone", tags: ["materials"], maxStackSize: 30, baseValueGold: 1 },
        { id: "iron_ore", name: "Iron Ore", tags: ["materials"], maxStackSize: 20, baseValueGold: 3 },
        { id: "wheat_sack", name: "Wheat Sack", tags: ["weapons"], maxStackSize: 15, baseValueGold: 2 },
        { id: "leather_hide", name: "Leather Hide", tags: ["ingridients"], maxStackSize: 10, baseValueGold: 4 },
        { id: "ruby_amulet", name: "Ruby Amulet", tags: ["treasure"], maxStackSize: 3, baseValueGold: 95 },
        { id: "jeweled_scepter", name: "Jeweled Scepter", tags: ["treasure"], maxStackSize: 1, baseValueGold: 200 },
        { id: "silver_chalice", name: "Silver Chalice", tags: ["treasure"], maxStackSize: 4, baseValueGold: 55 },
        { id: "obsidian_shard", name: "Obsidian Shard", tags: ["materials"], maxStackSize: 25, baseValueGold: 5 },
        { id: "mithril_ingot", name: "Mithril Ingot", tags: ["materials"], maxStackSize: 10, baseValueGold: 14 },
        { id: "goat", name: "Goat", tags: ["ingridients"], maxStackSize: 1, baseValueGold: 18 },
        { id: "honey_jar", name: "Honey Jar", tags: ["ingridients"], maxStackSize: 12, baseValueGold: 3 },
        { id: "steel_sword", name: "Steel Sword", tags: ["weapons"], maxStackSize: 5, baseValueGold: 9 },
        { id: "war_banner", name: "War Banner", tags: ["weapons"], maxStackSize: 3, baseValueGold: 14 },
    ],

    worldTiers: [
        { tier: 1, name: "Outer Villages" },
        { tier: 2, name: "Borderlands" },
        { tier: 3, name: "The Shattered Reaches" },
    ],

    worlds: WORLDS,
    startingWorldId: WORLD_1A.id,
    // Derived catalog for gameplay lookups; author missions in their world config.
    missions: WORLDS.flatMap(world => world.missions),

    upgrades: [
        // Storehouse
        { id: "sh_storage_1", room: "storehouse", name: "Storage Shelves I", description: "Add 2 storage slots.", costGold: 100, durationHours: 1, requirements: { type: "all", requirements: [] }, effect: { type: "storageSlots", amount: 2 }, towerXp: 5 },
        { id: "sh_storage_2", room: "storehouse", name: "Storage Shelves II", description: "Add 4 more storage slots.", costGold: 200, durationHours: 3, requirements: { type: "all", requirements: [{ type: "upgradeCompleted", upgradeId: "sh_storage_1" }] }, effect: { type: "storageSlots", amount: 4 }, towerXp: 8 },
        { id: "sh_storage_3", room: "storehouse", name: "Storage Shelves III", description: "Add 6 more storage slots.", costGold: 500, durationHours: 6, requirements: { type: "all", requirements: [{ type: "upgradeCompleted", upgradeId: "sh_storage_2" }] }, effect: { type: "storageSlots", amount: 6 }, towerXp: 12 },
        { id: "sh_sale_eff_1", room: "storehouse", name: "Sale Efficiency I", description: "Normal sales take 25% less time.", costGold: 200, durationHours: 2, requirements: { type: "all", requirements: [] }, effect: { type: "saleEfficiency", multiplier: 0.75 }, towerXp: 5 },
        { id: "sh_sale_eff_2", room: "storehouse", name: "Sale Efficiency II", description: "Normal sales take another 25% less time.", costGold: 500, durationHours: 4, requirements: { type: "all", requirements: [{ type: "upgradeCompleted", upgradeId: "sh_sale_eff_1" }] }, effect: { type: "saleEfficiency", multiplier: 0.75 }, towerXp: 8 },

        // Infirmary
        { id: "inf_eff_1", room: "infirmary", name: "Treatment Efficiency I", description: "Treatment takes 25% less time.", costGold: 100, durationHours: 3, requirements: { type: "all", requirements: [] }, effect: { type: "treatmentEfficiency", multiplier: 0.75 }, towerXp: 6 },
        { id: "inf_eff_2", room: "infirmary", name: "Treatment Efficiency II", description: "Treatment takes another 27% less time.", costGold: 220, durationHours: 5, requirements: { type: "all", requirements: [{ type: "upgradeCompleted", upgradeId: "inf_eff_1" }] }, effect: { type: "treatmentEfficiency", multiplier: 0.73 }, towerXp: 9 },

        // Training Hall
        { id: "th_unlock_2_3", room: "trainingHall", name: "Advanced Training: Grunt→Raider", description: "Unlocks training Rank 2 to Rank 3.", costGold: 200, durationHours: 4, requirements: { type: "all", requirements: [] }, effect: { type: "trainingUnlock", fromRank: 2 }, towerXp: 9 },
        { id: "th_unlock_3_4", room: "trainingHall", name: "Advanced Training: Raider→Veteran", description: "Unlocks training Rank 3 to Rank 4.", costGold: 450, durationHours: 7, requirements: { type: "all", requirements: [{ type: "upgradeCompleted", upgradeId: "th_unlock_2_3" }] }, effect: { type: "trainingUnlock", fromRank: 3 }, towerXp: 12 },
        { id: "th_unlock_4_5", room: "trainingHall", name: "Advanced Training: Veteran→Captain", description: "Unlocks training Rank 4 to Rank 5.", costGold: 900, durationHours: 12, requirements: { type: "all", requirements: [{ type: "upgradeCompleted", upgradeId: "th_unlock_3_4" }] }, effect: { type: "trainingUnlock", fromRank: 4 }, towerXp: 16 },

        // Laboratory
        { id: "lab_tier_1", room: "laboratory", name: "Laboratory Tier Unlock I", description: "Unlocks Tier 2 laboratory upgrades.", costGold: 200, durationHours: 5, requirements: { type: "all", requirements: [] }, effect: { type: "laboratoryTier", tier: 2 }, towerXp: 10 },
        { id: "lab_tier_2", room: "laboratory", name: "Laboratory Tier Unlock II", description: "Unlocks Tier 3 laboratory upgrades.", costGold: 500, durationHours: 9, requirements: { type: "all", requirements: [{ type: "upgradeCompleted", upgradeId: "lab_tier_1" }] }, effect: { type: "laboratoryTier", tier: 3 }, towerXp: 14 },

        { id: "res_improved_weapons", room: "laboratory", name: "Improved Weapons", description: "Equip all minions with sturdier weapons.", costGold: 150, durationHours: 6, requirements: { type: "all", requirements: [{ type: "condition", metric: "laboratoryTier", operator: "gte", value: 1 }] }, effect: { type: "minionStat", stat: "attack", value: 1 }, towerXp: 10 },
        { id: "res_improved_armor", room: "laboratory", name: "Improved Armor", description: "Protect all minions with reinforced armor.", costGold: 150, durationHours: 6, requirements: { type: "all", requirements: [{ type: "condition", metric: "laboratoryTier", operator: "gte", value: 1 }] }, effect: { type: "minionStat", stat: "defense", value: 1 }, towerXp: 10 },
        { id: "res_fury_spell", room: "laboratory", name: "Fury Spell", description: "Enchant all minions to strike harder in battle.", costGold: 400, durationHours: 10, requirements: { type: "all", requirements: [{ type: "condition", metric: "laboratoryTier", operator: "gte", value: 2 }, { type: "upgradeCompleted", upgradeId: "res_improved_weapons" }] }, effect: { type: "minionStat", stat: "attack", value: 2 }, towerXp: 16 },

        // Dungeon
        { id: "dg_cell_1", room: "dungeon", name: "Extra Cell I", description: "Add one prisoner cell.", costGold: 50, durationHours: 1, requirements: { type: "all", requirements: [] }, effect: { type: "dungeonCell" }, towerXp: 4 },
        { id: "dg_cell_2", room: "dungeon", name: "Extra Cell II", description: "Add one more prisoner cell.", costGold: 120, durationHours: 3, requirements: { type: "all", requirements: [{ type: "upgradeCompleted", upgradeId: "dg_cell_1" }] }, effect: { type: "dungeonCell" }, towerXp: 6 },
        { id: "dg_torture_eff_1", room: "dungeon", name: "Torture Efficiency I", description: "Processing takes 20% less time.", costGold: 100, durationHours: 3, requirements: { type: "all", requirements: [] }, effect: { type: "tortureEfficiency", multiplier: 0.8 }, towerXp: 6 },
        { id: "dg_torture_eff_2", room: "dungeon", name: "Torture Efficiency II", description: "Processing takes another 25% less time.", costGold: 250, durationHours: 6, requirements: { type: "all", requirements: [{ type: "upgradeCompleted", upgradeId: "dg_torture_eff_1" }] }, effect: { type: "tortureEfficiency", multiplier: 0.75 }, towerXp: 9 },
        { id: "dg_recruit_eff_1", room: "dungeon", name: "Recruitment Efficiency I", description: "Increases recruitment chance.", costGold: 120, durationHours: 3, requirements: { type: "all", requirements: [] }, effect: { type: "recruitmentEfficiency", bonus: 0.1 }, towerXp: 7 },
        { id: "dg_recruit_eff_2", room: "dungeon", name: "Recruitment Efficiency II", description: "Increases recruitment chance further.", costGold: 300, durationHours: 6, requirements: { type: "all", requirements: [{ type: "upgradeCompleted", upgradeId: "dg_recruit_eff_1" }] }, effect: { type: "recruitmentEfficiency", bonus: 0.15 }, towerXp: 10 },

        // War Room
        { id: "wr_enemy_intel_1", room: "warRoom", name: "Enemy Intelligence I", description: "Reveals the number and ranks of active defenders.", costGold: 100, durationHours: 3, requirements: { type: "all", requirements: [] }, effect: { type: "enemyIntel", level: 1 }, towerXp: 6 },
        { id: "wr_enemy_intel_2", room: "warRoom", name: "Enemy Intelligence II", description: "Reveals village rewards alongside enemy intelligence.", costGold: 250, durationHours: 6, requirements: { type: "all", requirements: [{ type: "upgradeCompleted", upgradeId: "wr_enemy_intel_1" }] }, effect: { type: "enemyIntel", level: 2 }, towerXp: 9 },
        { id: "wr_loot_intel_1", room: "warRoom", name: "Loot Intelligence I", description: "Reveals possible loot types.", costGold: 100, durationHours: 3, requirements: { type: "all", requirements: [] }, effect: { type: "lootIntel", level: 1 }, towerXp: 6 },
        { id: "wr_loot_intel_2", room: "warRoom", name: "Loot Intelligence II", description: "Reveals estimated drop chances.", costGold: 250, durationHours: 6, requirements: { type: "all", requirements: [{ type: "upgradeCompleted", upgradeId: "wr_loot_intel_1" }] }, effect: { type: "lootIntel", level: 2 }, towerXp: 9 },
    ],

    incrementalUpgrades: [
        { id: "qt_bed", room: "quarters", name: "Add Bed", description: "Add one Quarters bed. Cost and build time rise with each bed added.", baseCostGold: 100, costStepGold: 20, baseDurationHours: 1, durationStepHours: 0.5, effect: { type: "bed" }, towerXp: 3 },
        { id: "inf_bed", room: "infirmary", name: "Add Treatment Bed", description: "Add one treatment bed. Cost and build time rise with each bed added.", baseCostGold: 120, costStepGold: 25, baseDurationHours: 1, durationStepHours: 0.5, effect: { type: "treatmentBed" }, towerXp: 3 },
        { id: "th_station", room: "trainingHall", name: "Add Training Station", description: "Add one training station. Cost and build time rise with each station added.", baseCostGold: 50, costStepGold: 40, baseDurationHours: 1, durationStepHours: 0.5, effect: { type: "trainingStation" }, towerXp: 4 },
    ],

    trainingTransitions: [
        { fromRank: 1, toRank: 2, costGold: 50, durationHours: 4 },
        { fromRank: 2, toRank: 3, costGold: 120, durationHours: 8 },
        { fromRank: 3, toRank: 4, costGold: 260, durationHours: 14 },
        { fromRank: 4, toRank: 5, costGold: 500, durationHours: 22 },
    ],

    towerXpThresholds: [0, 30, 70, 120, 190, 280, 400, 550, 750, 1000, 1300],

    startingBalance: {
        gold: 100,
        crystals: 5,
        minionRanks: [1, 1, 1],
        storageSlots: 8,
        beds: 3,
        treatmentBeds: 2,
        trainingStations: 1,
        dungeonCells: 1,
    },

    // Small starting stock so the Storehouse/Inventory/sell flow is immediately exercisable
    // without waiting on a raid. Mixes treasures and ordinary items at different stack fills
    // (including one full max-size-1 stack) and leaves three of the eight starting storage slots free.
    startingItems: [
        { itemId: "golden_cup", count: 3 },
        { itemId: "silver_necklace", count: 2 },
        { itemId: "ancient_crown", count: 1 },
        { itemId: "iron_ore", count: 8 },
        { itemId: "cobblestone", count: 12 },
    ],

    constants: {
        dayLengthRealSeconds: 60,
        weekDays: 7,
        restDurationHours: 6,
        treatmentDurationHours: 72,
        bedEvictionHours: 48,
        paydayWindowHours: 24,
        instantSaleFraction: 0.5,
        saleBaseHours: 1,
        saleHoursPerCopy: 0.5,
        dungeonBaseDurationHours: 24,
        dungeonOutcomeBase: { recruit: 0.6, interrogate: 0.15, death: 0.25 },
        recruitedInjuredChance: 0.5,
    },
};
