# System: Recovery (Quarters + Infirmary)

**Authoritative rules:** [`../../DarkTowerGameDesign.md`](../../DarkTowerGameDesign.md) §4.2, §4.3.

Quarters and Infirmary are one system in code (`recovery.ts`) because their bed-assignment logic
is a single priority queue (Infirmary first, per design doc §4.3), not two independent schedulers.

## Owning files

| File | Role |
|---|---|
| `src/systems/recovery.ts` | `assignBeds` (auto-assignment, both rooms), `completeRest`, `completeTreatmentRestUpTo`, `completeTreatment`, `markWaitingIfIdle`. |
| `src/systems/lifecycle.ts` | `nightfall` (sets every minion Tired), `checkDepartures` (bed-eviction after `bedEvictionHours` idle-and-conditioned). |
| `src/model/GameState.ts` | `bedCount()`, `treatmentBedCount()` (`GameState.ts:133-143`); `Minion.waitingSince` (`model/types.ts:16`) drives both the longest-waiting queue and the eviction clock. |
| `src/data/config.ts` | `constants.restDurationHours`, `treatmentDurationHours`, `bedEvictionHours`. |
| `src/ui/screens/quarters/*`, `src/ui/screens/infirmary/*` | Two separate UI screens over the same underlying system. |

## State owned

No dedicated "bed" entities exist — a bed is implicit capacity (`bedCount()` /
`treatmentBedCount()`) minus currently-occupied `rest`/`treatment` `Process` count
(`recovery.ts:11-17`). `Minion.waitingSince` is the one piece of persistent per-minion state this
system owns; it is set by `markWaitingIfIdle()` whenever a Tired/Injured minion goes idle with no
bed, and cleared the moment a bed is assigned or recovery completes.

Infirmary rest uses the treatment process's start hour or its `restStartHour` after new nightfall
fatigue. It requires no additional bed process.

## Notes for agents

- **Priority order is load-bearing and tested**: Infirmary beds are filled before Quarters beds
  every call to `assignBeds()` (`recovery.ts:20-36` runs treatment assignment first, then rest
  assignment) and an injured+tired minion takes a Quarters bed only when no treatment bed is free —
  covered explicitly by `selftest.ts` scenario 12 (`src/model` note at `model/types.ts:15` comment,
  and `selftest.ts:293-316`). Changing the order inside `assignBeds()` breaks that invariant.
- The two-day eviction clock only runs while a minion is **idle and conditioned**
  (`lifecycle.ts:14-16` compares `now - waitingSince`); time spent in an occupied activity doesn't
  count, because `waitingSince` is only ever set while idle.
- `assignBeds()` is called from two places: every simulated hour-boundary step inside
  `GameEngine.advance()` and once more after any action that could free a minion (e.g.
  `claimReport()`, `forceCompleteProcess()`) — see
  [`../Features/GameClockAndScheduler.md`](../Features/GameClockAndScheduler.md).
