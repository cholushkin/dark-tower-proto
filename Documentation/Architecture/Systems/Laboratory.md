# System: Laboratory

**Authoritative rules:** [Game design §4.5 and §8](../../DarkTowerGameDesign.md).

Laboratory upgrades use the common [upgrade lifecycle](../Features/Upgrades.md). There is no separate research definition, process type, active-project field, or completion set.

## Owning files

| File | Responsibility |
|---|---|
| `src/data/config.ts` | Laboratory tier upgrades and the Improved Weapons, Improved Armor, and Fury Spell upgrade definitions. |
| `src/systems/upgrades.ts` | Purchase validation, construction, and one-time completion. |
| `src/systems/upgradeRequirements.ts` | Shared requirement evaluation and failure explanations. |
| `src/model/GameState.ts` | Acquired/completed upgrade state, Laboratory tier, and derived Attack/Defense. |
| `src/ui/screens/laboratory/*` | Shared upgrade-card models, room parameters, and Alchemy placeholder. |
| `src/ui/components/RoomSummary/*` | Common room image, parameters, and whole-card upgrade pagination. |

## Effects and progression

`laboratoryTierUnlocked()` derives tier from completed Laboratory-tier upgrades. Fury Spell requires both tier 2 and completed Improved Weapons. Construction can overlap with other Laboratory and room upgrades. Each card displays its own timer.

`effectiveAttack()` and `effectiveDefense()` read completed `minionStat` upgrades. They add flat modifiers before applying multipliers. Existing upgrade IDs (`res_improved_weapons`, `res_improved_armor`, `res_fury_spell`) identify ordinary upgrade definitions; the prefix does not select a separate system.

Laboratory has no efficiency upgrade or duration multiplier. The header displays Laboratory tier and active upgrade count.

## Alchemy presentation

The area below the common header is titled **ALCHEMY** and contains **Element 1 + Element 2 = Result**. Slots are non-interactive, with a coming-soon label and an accessible description. There is no crafting state, recipe engine, item consumption, or output production yet.
