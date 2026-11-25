# Feature: Upgrade acquisition, requirements, and construction

**Gameplay contract:** [Game design §8.2](../../DarkTowerGameDesign.md).

## Lifecycle and ownership

1. `GameState.acquiredUpgrades` records available upgrade definitions. Both fixed and repeatable definitions default `availableAtStart` to true, preserving current availability. Set it to false for future pickup-only content.
2. `GameEngine.acquireUpgrade(id)` is the direct reward entry point. Unknown IDs and duplicate acquisition return false without changing state. Acquisition grants no XP/effect and starts no process.
3. An `ItemDef` can specify `upgradeId`. `GameState.addItems()` learns discovered upgrade pickups on Claim without requiring Storehouse space. Duplicates are consumed harmlessly. An invalid target leaves the item count unaccepted. No shipping items or loot tables currently use this field.
4. `buyUpgrade` or `buyIncremental` checks acquisition, requirements, affordability, and whether that same upgrade is running. Different upgrades may build concurrently.
5. `upgrade` / `incrementalUpgrade` processes retain their start/end times. Completion records `purchasedUpgrades` or increments `incrementalLevels`, then awards configured XP. Fixed completion is idempotent.

Acquisition is permanent and distinct from completion. A single acquisition of a repeatable upgrade enables later levels too. The prototype is memory-only: there is no save/load format or migration layer.

## Requirement schema

`UpgradeRequirement` is a recursive, JSON-serializable discriminated union. Fixed upgrades supply `requirements`; repeatable upgrades can omit it for no additional prerequisite.

| Type | Parameters and meaning |
|---|---|
| `all` | `requirements`: every child must pass; an empty list passes. |
| `any` | `requirements`: at least one child must pass; an empty list fails. |
| `not` | `requirement`: the child must fail. |
| `upgradeCompleted` | `upgradeId`: fixed upgrade completed or repeatable level at least 1. |
| `upgradeAcquired` | `upgradeId`: upgrade definition acquired. |
| `condition` | `metric`, `operator`, `value`: numeric comparison. Metrics are `towerLevel`, `laboratoryTier`, `gold`, `crystals`, `minionCount`; operators are `gte`, `lte`, `eq`. |
| `flag` | `flag`: named key present in `GameState.progressionFlags`; future quest/event systems own setting their flags. |
| `missionCompleted` | `missionId`: successful first Claim recorded in `everClaimedMissions`. |
| `itemCount` | `itemId`, `count`: total copies currently in inventory, excluding pending sales. This checks possession without consumption. |

For example, a definition can require both a previous upgrade and either a Tower Level or a quest flag:

```json
{
  "type": "all",
  "requirements": [
    { "type": "upgradeCompleted", "upgradeId": "sh_storage_1" },
    { "type": "any", "requirements": [
      { "type": "condition", "metric": "towerLevel", "operator": "gte", "value": 3 },
      { "type": "flag", "flag": "architect_rescued" }
    ] }
  ]
}
```

`requirementFailure()` returns undefined when satisfied or an explanation otherwise. Purchase validation and UI card adapters share that evaluator through `upgradePurchaseFailure()` and `incrementalPurchaseFailure()`. Checks happen before spending; changing a flag or inventory during construction does not cancel it. Extend the typed union/evaluator for new kinds of conditions; no executable expressions or `eval` are involved.

## Effects and UI

`GameState.effectiveStat()` applies completed `UpgradeEffect.minionStat` bonuses. See design §8.3 for combat modifier rules. Laboratory tier uses the `laboratoryTier` effect.

`upgradeLog.ts` describes the effect of fixed and repeatable upgrades in the start and completion logs. Training Hall logs identify the minion and show the rank, stat, and salary changes.

All seven rooms use `RoomSummary` and `UpgradeCard`. Fixed numeric-suffix series are grouped into a current-to-next card; independent upgrades have separate cards. Unacquired upgrades remain visible but disabled with an acquisition explanation. Requirements can lock an acquired card. Each running card has its own progress indicator.

## Verification

`npm run selftest` covers parallel Laboratory and cross-room construction, prerequisite gating, additive/multiplicative effects, duplicate completion, nested conditions, UI/engine failure agreement, pickup Claim with full storage, duplicate/unknown acquisition, and repeatable acquisition/requirements. Pickup definitions are temporary test fixtures; production rewards and initial availability are unchanged.
