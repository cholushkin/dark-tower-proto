# Feature: Raid → Report → Claim Lifecycle

This flow spans `world.ts`, `raidReport.ts`, `dungeon.ts`, `recovery.ts`, `economy.ts`,
`save.ts`, `battle.ts`, and `GameEngine`. Gameplay rules live in
[`../../DarkTowerGameDesign.md`](../../DarkTowerGameDesign.md) §5 and §6.

## State and sequence

1. `GameEngine` initializes configured villages through `world.ts`. `GameState.villages` holds
   weekly active defender ranks, reward stock, and raid-success state independently of permanent progression.
2. `launchRaid()` validates mission availability, distinct squad members, and minion conditions.
   It creates a `RaidProcess` with the mission's configured duration, reserves its squad, and
   snapshots village week, defender ranks, and reward stock.
3. `GameEngine.completeRaid()` calls `resolveRaid()`, which builds the units, calls `simulateBattle()`,
   applies current-week village changes, and creates a `RaidReportDraft`. The engine moves the
   mission from `missionRunningProcess` to `pendingReports` with its squad still reserved.
4. The engine creates the existing `walkback` process with the raid's duration. The player can
   Claim manually, or `completeWalkback()` calls the same `claimReport()` path automatically.
5. `claimReport()` applies the report's rewards and minion conditions, records permanent
   completion and tier unlocks, and removes the report and walkback. The engine then reruns
   bed/cell assignment. Report removal makes repeated Claim harmless.

## Weekly recovery and snapshot ownership

`GameEngine` calls `recoverVillages()` at the weekly boundary. Recovery replaces village records
without mutating active raid snapshots or reports. Resolution and Claim compare week ownership
before applying weekly changes. See the authoritative old-week behavior in design §5.4.

Snapshots own copies of defender and reward arrays. Reports store the rewards, injury results,
and defender losses from resolution. Permanent mission completion is independent of weekly
village records.

## Battle recordings and rewards

Each turn sends a log line to the browser console through `GameState.log()`. The line shows each
hit's source, target, and damage, followed by the Health change and defeat status of each unit.
Opening the browser developer console before a raid makes the full sequence easy to inspect.

`battle.ts` also captures the starting roster, hits, and end-of-round health for the pending
report. `ui/screens/battle-visualization/` plays that recording above the raid report while App
keeps the report's pause in effect. Older reports without a recording remain claimable.

The report groups rewards by item type. Claim passes all found items through `GameState.addItems()`
and sorts prisoners for `admitPrisoner()`. See design §6.1–6.2 for intake rules.

## Persistence and verification

`systems/save.ts` serializes villages, raid snapshots, reports, minion activity, processes, and
progression together. It migrates legacy defender counts and report injuries and preserves
generated rewards and in-flight timers. The App autosaves and restores state without advancing
offline time.

`selftest.ts` covers simultaneous damage and wipeouts, damage modifiers, failed retries, recovery,
parallel squads, weekly recovery, once-only claims, and save migration. Browser verification
exercises the mission and report layouts.
