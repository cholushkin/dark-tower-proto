# Feature: Raid → Report → Claim Lifecycle

**Why this is a Feature doc and not folded into [`../Systems/WarRoom.md`](../Systems/WarRoom.md):**
this flow touches five systems (`world.ts`, `raidReport.ts`, `dungeon.ts`, `recovery.ts`,
`economy.ts`) plus `GameEngine` itself, and has a subtlety — the walk-back auto-claim — that exists
only in code, not in the design doc. It's exactly the kind of cross-system interaction the project's
documentation philosophy calls out as worth a dedicated Feature page.

**Authoritative rules:** [`../../DarkTowerGameDesign.md`](../../DarkTowerGameDesign.md) §5.3, §6, §6.1, §6.2.

## Sequence as implemented

1. **Launch** — UI calls `engine.launchRaid(missionId, squad)` → `systems/world.ts launchRaid()`.
   Validates via `canLaunchRaid()`, computes a `RaidPreview` (duration/failure chance) via
   `previewRaid()`, creates a `raid` `Process`, reserves the squad (`activity = {type: "raid"}`),
   marks the mission `missionRunningProcess`. (`world.ts:58-83`)
2. **Resolution at process completion** — `GameEngine.completeRaid()` (`GameEngine.ts:94-106`)
   calls `world.ts resolveRaid()`, which rolls success, injuries, loot, and prisoners
   (`world.ts:85-130`) and stores the result as a `RaidReportDraft` in `state.pendingReports`. The
   mission becomes `COMPLETED_UNCLAIMED` (`GameState.missionState()` checks `pendingReports` first,
   `GameState.ts:270`).
3. **Walk-back timer (code-only, not in the design doc)** — the same `completeRaid()` call
   schedules a `walkback` `Process` whose duration equals the raid's own duration
   (`GameEngine.ts:98-104`). This is purely an implementation addition; see
   [`../CurrentArchitecture.md`](../CurrentArchitecture.md)#9-known-implementationdesign-doc-divergences.
4. **Either the player Claims manually...** — opens the Raid Report popup, optionally adjusts loot
   selection via `raidReport.ts adjustSelection()` (respecting `carryLimit`, §6.1), then
   `engine.claimReport(missionId)` → `raidReport.ts claimReport()` (`raidReport.ts:41-78`): credits
   gold/crystals, stores selected loot via `GameState.addItems()`, admits prisoners
   highest-rank-first via `dungeon.ts admitPrisoner()`, releases the squad with their
   injury/tired rolls applied, marks the mission claimed-this-week, and — on a mission's first-ever
   successful claim — unlocks the next World Tier if the whole current tier is now claimed
   (`onMissionFirstClaim()`, `raidReport.ts:80-92`). Any pending `walkback` process for that mission
   is cancelled (`raidReport.ts:73`).
5. **...or the walk-back timer fires first** — `GameEngine.completeWalkback()`
   (`GameEngine.ts:108-113`) calls the *exact same* `claimReport()` on the player's behalf if the
   report is still pending, then re-runs auto-assignment. The player experience and resulting state
   are identical either way; only the trigger differs.

## Carry-capacity selection (§6.1)

`world.ts resolveRaid()` preselects a valid subset of discovered loot within `carryLimit`
(`preselectWithinBudget()`, `world.ts:136-153`, greedy in discovery order). The player can then
toggle whole stacks (including the final partial stack), with quantity badges, via `raidReport.ts adjustSelection()`
(`raidReport.ts:25-39`), which re-validates the slot budget on every call — it never lets the
selection exceed `carryLimit`, so Claim (`claimReport`) never needs to re-check it.

## Things to not "fix"

- A failed raid still reserves the squad until Claim and still runs the walk-back timer — Claim on
  failure applies conditions and releases the squad but credits nothing (`raidReport.ts:45`
  guarded by `if (draft.success)`), matching design doc §6.2's explicit failure-path note.
- Overflow loot beyond Storehouse capacity is silently discarded at Claim, in selection order —
  this is `GameState.addItems()`'s existing slot-limit behavior (`GameState.ts:243-261`), not a bug
  in `raidReport.ts`.
