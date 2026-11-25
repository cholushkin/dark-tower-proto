# Feature: Game Clock and Scheduler

**Why this is a Feature doc:** the day-stepping loop in `GameEngine.advance()` is the one piece of
code every timed system depends on indirectly, it has non-obvious edge-case handling (day-boundary
alignment, a runaway-loop guard), and it implements something `DarkTowerGameDesign.md` explicitly
leaves open (§12 "Scheduler tie-breaking"). It doesn't belong to any single Room/system.

**Authoritative rules:** [`../../DarkTowerGameDesign.md`](../../DarkTowerGameDesign.md) §2; tie-breaking order is explicitly **unresolved** per §12.

## How time advances

- `Clock.ts realSecondsToGameHours()`: 1 real minute = 1 in-game day at `speed = 1`
  (`CONFIG.constants.dayLengthRealSeconds`), scaled linearly by `state.speed`.
- `GameEngine.tick(realDeltaSeconds)` is called every animation frame from `App.ts` (`App.ts:148`)
  and does nothing if `state.gameOver` or `state.paused` (`GameEngine.ts:25`).
- `advance(deltaHours)` (`GameEngine.ts:38-53`) does **not** jump straight to `hours + deltaHours`.
  It loops, each iteration stepping only as far as the next whole-day boundary (or the final
  target, whichever is closer), and at each step:
  1. `completeProcessesUpTo(stepTo)` — completes every `Process` whose `endHour` falls within this
     step, **in `endHour` order** (`GameEngine.ts:69-77`), via `dispatchCompletion()`.
  2. Advances `state.hours` to `stepTo`.
  3. `runAutoAssignment(stepTo)` — `assignBeds()` + `assignCells()`.
  4. If `stepTo` landed exactly on a day boundary: `onDayBoundary(stepTo)`, then auto-assignment
     again.
  5. A `guard++ < 100000` counter aborts the loop if it somehow never reaches `target`.
- `onDayBoundary(now)` runs, **in this fixed order**: `nightfall()` →
  (if `day % weekDays === 0`) `recoverVillages()` then `triggerPaydayDue()` → `checkDepartures()`.
  Processes due exactly on the boundary resolve before village recovery; their reports retain
  the launch-week snapshot. See [`RaidLifecycle.md`](RaidLifecycle.md).
- After every `advance()` call, `checkBankruptcy()` runs once more (`GameEngine.ts:52`).

## Why this matters to future changes

`DarkTowerGameDesign.md` §12 lists scheduler tie-breaking (what happens when payday, raid
completion, upgrade completion, nightfall, and bed/condition changes coincide on the same instant)
as an **open design decision**. The order above is this prototype's implicit answer, chosen for
implementation convenience, not validated game design. If you change this order, you are making a
design decision by accident — don't do that silently; if a change is needed, record it in
[`../../Decisions/README.md`](../../Decisions/README.md)'s log, the same way the existing defaults
in [`../../Decisions/prototype-defaults-log.md`](../../Decisions/prototype-defaults-log.md) were
recorded.

## Force-completion (debug path)

`GameEngine.forceCompleteProcess(processId)` (`GameEngine.ts:115-122`) is the Debug Panel's escape
hatch and also how `selftest.ts` drives every scenario deterministically: it calls
`dispatchCompletion()` directly (bypassing the day-stepping loop entirely), then
`runAutoAssignment()` and `checkBankruptcy()`. Because it skips `onDayBoundary()`, force-completing
a process never triggers nightfall/payday/departures on its own — only real `advance()` stepping
does that.
