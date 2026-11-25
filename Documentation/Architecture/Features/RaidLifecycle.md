# Feature: Raid → Report → Claim Lifecycle

This flow spans `world.ts`, `raidReport.ts`, `dungeon.ts`, `recovery.ts`, `economy.ts`,
`save.ts`, and `GameEngine`. Gameplay rules and balance formulas live in
[`../../DarkTowerGameDesign.md`](../../DarkTowerGameDesign.md) §5, §6, and §11.

## State and sequence

1. `GameEngine` initializes configured villages through `world.ts`. `GameState.villages` holds
   weekly defender counts, reward stock, and raid-success state independently of permanent progression.
2. `launchRaid()` validates mission availability, distinct squad members, and minion conditions.
   It creates a `RaidProcess`, reserves its squad, and snapshots village week, defenders,
   probability, and rewards. `previewRaid()` uses the same count-based probability helper.
3. `GameEngine.completeRaid()` calls `resolveRaid()`, which rolls the result and individual
   injuries, applies current-week village changes, and creates a `RaidReportDraft`. It moves the
   mission from `missionRunningProcess` to `pendingReports`; the squad remains reserved.
4. The engine creates the existing `walkback` process with the raid's duration. The player can
   Claim manually, or `completeWalkback()` calls the same `claimReport()` path automatically.
5. `claimReport()` applies selected rewards, prisoners, and minion conditions; records permanent
   completion and tier unlocks; and removes the report and walkback. The engine then reruns
   bed/cell assignment. Report removal makes repeated Claim harmless.

## Weekly recovery and snapshot ownership

`GameEngine` calls `recoverVillages()` at the weekly boundary. Recovery replaces village records
without mutating active raid snapshots or reports. Resolution and Claim compare week ownership
before applying weekly changes. See the authoritative old-week behavior in design §5.4.

Snapshots own copies of reward arrays rather than references into village stock. Reports own
loot selection and injury rolls; recovery cannot regenerate either. Permanent mission completion
is independent of weekly village records.

## Carry-capacity selection

`resolveRaid()` preselects loot with `preselectWithinBudget()`.
`raidReport.ts adjustSelection()` validates each selection against the stack-slot budget.
The report adapter exposes full and partial stack tiles; Claim passes selected copies through
`GameState.addItems()` and sorts prisoners for `admitPrisoner()`. See design §6.1–6.2 for the
selection and overflow rules.

## Persistence and verification

`systems/save.ts` serializes villages, raid snapshots, reports, minion activity, processes, and
progression together. Legacy records receive missing fields without rerolling generated report
rewards. The App autosaves and restores state without advancing offline time.

`selftest.ts` covers probability boundaries, failed retries, injuries/recovery, parallel squads,
weekly recovery, old-week raids/reports, once-only claims, and save migration. Browser verification
remains necessary for the rendered mission/map/report layouts.
