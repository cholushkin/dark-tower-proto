# Current Architecture — Phase 1 Prototype (TypeScript / Vite)

**Status: implemented behavior only.** Nothing in this document is proposed or planned — for
proposed changes see [`ImprovementPlan.md`](ImprovementPlan.md), which is explicitly *not*
implemented. This document supersedes the old root-level `Architecture.md` (its "Running it" and
"Defaults chosen" content now lives here and in
[`../Decisions/prototype-defaults-log.md`](../Decisions/prototype-defaults-log.md) respectively).

This is a browser-only, single-player, client-side prototype: no backend, no persistence, no save
system. The entire game lives in one in-memory `GameState` object for the life of a browser tab.

## 1. Module map and dependency direction

```
src/data/        config.ts, types.ts, weeks.json      (static content — the "what")
      ↓
src/model/       GameState.ts, types.ts                (runtime state — the "current")
      ↓
src/systems/     dungeon.ts, world.ts, recovery.ts...  (pure rule functions — the "how it changes")
      ↓
src/engine/      GameEngine.ts, Clock.ts               (orchestration — "when it changes")
      ↓
src/ui/          shell/, screens/*/, components/        (presentation — "what the player sees/does")
```

Dependencies only point downward in this list. Concretely:

- `src/data/*` has no imports from any other `src/` folder.
- `src/model/GameState.ts` imports only from `src/data/*`.
- `src/systems/*.ts` import `GameState`/`model/types` and `data/config`, never `src/ui/*` or
  `src/engine/*`. Every system file is a set of plain exported functions taking `(state: GameState, ...)`
  and mutating `state` in place — there are no system classes and no system-to-system state hiding.
- `src/engine/GameEngine.ts` is the only file that imports from *every* `systems/*` module (see
  §3). It is the sole place that advances the clock and dispatches process completions.
- `src/ui/**` imports `GameEngine`/`GameState`/`data/config` for reading, and calls methods on a
  `GameEngine` instance to make changes — see §5. No system file imports anything from `src/ui/*`
  or `src/engine/*`; the dependency arrow does not reverse.

This is a conventional one-way layering, not enforced by a build rule (no ESLint
boundaries/dependency-cruiser config exists) — see
[`ImprovementPlan.md`](ImprovementPlan.md#essential-now) for whether that matters yet.

## 2. State: ownership and mutation

All runtime state lives in one class, `GameState` (`src/model/GameState.ts`). It has:

- Plain mutable public fields: `minions`, `prisoners`, `stacks`, `processes`, `gold`, `crystals`,
  `hours`, `purchasedUpgrades`, `incrementalLevels`, `acquiredUpgrades`, `progressionFlags`, `unlockedTiers`,
  `pendingReports`, etc. (`GameState.ts:12-54`).
- Derived read-only getters/methods computed from those fields plus `CONFIG`, e.g. `bedCount()`,
  `storageSlots()`, `saleEfficiencyMultiplier()`, `effectiveAttack()`, `towerLevel()`
  (`GameState.ts:91-227`). Nothing caches these — they recompute from `purchasedUpgrades` /
  `incrementalLevels` every call, so there is no derived-state invalidation
  to get wrong.

There is no encapsulation boundary preventing code outside `src/systems/` from mutating these
public fields directly — it's a convention, not a type-level guarantee. In practice only
`src/systems/*.ts`, `src/engine/GameEngine.ts`, and `selftest.ts` (intentionally, for test setup)
mutate `GameState` fields; `src/ui/**` never does (verified by inspection — UI code only calls
`engine.*` action methods or pure `systems/*` query functions that take `state` as a read-only
argument, e.g. `canLaunchRaid`, `previewRaid` in `WarRoomAdapter.ts:4`).

`GameState`'s constructor seeds starting minions/items from `CONFIG.startingBalance` /
`CONFIG.startingItems` (`GameState.ts:56-71`) — the only place initial state is assembled.

## 3. The engine: clock, scheduling, and the action API

`GameEngine` (`src/engine/GameEngine.ts`) wraps one `GameState` and has two responsibilities:

**a. Advancing time.** `tick(realDeltaSeconds)` converts real seconds to in-game hours via
`realSecondsToGameHours` (`Clock.ts:4-7`, "1 real minute = 1 in-game day" scaled by `state.speed`)
and calls `advance(deltaHours)`. `advance()` (`GameEngine.ts:38-53`) steps forward **one day
boundary at a time**, not straight to the target: for each step it completes every process whose
`endHour` falls within the step, sets `state.hours`, runs auto-assignment (beds/cells), and — if
the step landed exactly on a day boundary — runs `onDayBoundary()` (nightfall → payday check →
departure check, in that fixed order, `GameEngine.ts:55-62`) and auto-assignment again. A
`guard++ < 100000` loop counter prevents a runaway loop if `deltaHours` is unexpectedly huge.

This day-stepping order is an implementation choice for something `DarkTowerGameDesign.md` §12
explicitly lists as unresolved ("Scheduler tie-breaking: specify order when payday deadlines, raid
completion/Claim, upgrade completion, nightfall, bed eligibility, and minion condition changes
coincide"). See [`../Features/GameClockAndScheduler.md`](Features/GameClockAndScheduler.md) for the
full walk-through and [`../Decisions/prototype-defaults-log.md`](../Decisions/prototype-defaults-log.md)
for why this isn't treated as a final answer to that open question.

**b. Dispatching process completions and exposing the action API.** Every timed activity (raid,
rest, treatment, training, sale, room upgrade, incremental upgrade, dungeon processing,
walkback) is a `Process` (`model/types.ts:33-106`) with a `startHour`/`endHour`. `GameEngine`'s
`dispatchCompletion()` (`GameEngine.ts:79-92`) is a switch over `Process.type` that calls into the
matching `systems/*` completion function. This switch is the one place that knows about every
system — see [`ImprovementPlan.md`](ImprovementPlan.md) for the cost of that.

`GameEngine` also exposes a thin **action API** — `buyUpgrade`, `buyIncremental`, `startTraining`,
`acquireUpgrade`, `startNormalSale`, `instantSale`, `launchRaid`, `claimReport`, `payPayroll`
(`GameEngine.ts:126-162`) — each a one-line pass-through to the matching `systems/*` function. This
is the *only* sanctioned way to mutate `GameState` from outside `src/systems/`/`src/engine/`; the
UI layer calls these and nothing else to change state (see §5).

## 4. Systems: one module per gameplay area

`src/systems/*.ts` are plain-function modules, each owning one gameplay area and the `Process`
subtype(s) it schedules:

| File | Owns | Process types |
|---|---|---|
| `storehouse.ts` | stacking, selling | `sale` |
| `recovery.ts` | Quarters + Infirmary bed assignment | `rest`, `treatment` |
| `trainingHall.ts` | rank training | `training` |
| `upgradeRequirements.ts` | Generic upgrade condition evaluation and explanations | none |
| `dungeon.ts` | prisoner cells, processing outcome | `dungeon` |
| `world.ts` | raid preview/launch/resolution, squad power | `raid` |
| `raidReport.ts` | Claim resolution (loot/prisoner intake) | — (acts on `pendingReports`, not a `Process`) |
| `upgrades.ts` | one-shot room upgrades | `upgrade` |
| `incrementalUpgrades.ts` | repeatable room upgrades (beds/cells/stations) | `incrementalUpgrade` |
| `payroll.ts` | `payAll()` | — |
| `lifecycle.ts` | nightfall, bed-deprivation departures, payday-due, bankruptcy check | — |
| `economy.ts` | shared gold/crystal spend/credit helpers | — |
| `tower.ts` | Tower XP/level bookkeeping | — |

Each system file is self-contained: to understand or change one gameplay area, an agent generally
needs only that file, `model/GameState.ts` (for the fields it touches), the relevant slice of
`data/config.ts`, and the matching `Documentation/Architecture/Systems/*.md` entry point. This is
the main source of **context locality** in this codebase (see
[`AIDevelopmentWorkflow.md`](../Workflow/AIDevelopmentWorkflow.md)).

Global minion-stat effects are derived in `GameState.effectiveStat()` from completed upgrades,
with additive modifiers before multipliers. Laboratory uses the same upgrade construction and
completion systems as other rooms. [Upgrade acquisition and requirements](Features/Upgrades.md)
describes collectible unlocks, serializable conditions, and UI/engine validation.

## 5. UI: shell, screens, components

```
src/ui/
├── shell/        AppShell, TimeWidget, RoomNav, PayrollButton, DebugPanel  — app chrome, mounted once
├── components/   AssignmentPicker, BedSlot, ItemComponent, MinionComponent,
│                 MissionPin, PopupFrame, PrisonCell, RoomOverviewCard,
│                 TagFilterBar, TrainingStation, UpgradeCard, ItemTile      — reusable "dumb" view widgets
├── screens/<room>/   <Room>View.ts + <Room>ViewModel.ts + <Room>Adapter.ts + .css   — one per Room/popup
├── screens/shared.ts   cross-screen formatting + flavor-generation helpers
└── App.ts        the single controller tying all of the above to one GameEngine
```

Each screen follows the same **View / ViewModel / Adapter** triad (e.g.
`src/ui/screens/dungeon/{DungeonView.ts, DungeonViewModel.ts, DungeonAdapter.ts}`):

- `*ViewModel.ts` — plain interfaces: the shape of data the view renders, and the action union the
  view can emit. No logic.
- `*View.ts` — DOM rendering only (string templates / direct DOM calls). Takes a model, renders it,
  emits actions via a callback. Never imports `GameEngine` or `systems/*`.
- `*Adapter.ts` — the only file that imports both the view model types and `GameEngine`/`systems/*`.
  `build<Room>ViewModel(engine, uiState?)` reads `engine.state` (and, for read-only previews, calls
  `systems/*` query functions directly — e.g. `DungeonAdapter.ts` reuses `groupUpgradeFamilies`/
  `buildUpgradeLineViewModel` from `screens/shared.ts`, and `WarRoomAdapter.ts:4` calls
  `canLaunchRaid`/`previewRaid`/`missionDef` from `systems/world.ts`) and maps it to a ViewModel.
  `handle<Room>Action(engine, uiState?, action)` is the only place that turns a UI action into a
  mutation — always via an `engine.*` action-API method (§3), never by touching `GameState` fields
  directly.

`App.ts` (391 lines) owns one `GameEngine`, mounts the shell once, and on navigation
(`navigate()`, `App.ts:167-218`) tears down the previous screen's view and mounts the new one by
calling its `mount<Room>View` + `build<Room>ViewModel` + `handle<Room>Action`. A `requestAnimationFrame`
loop (`App.ts:143-156`) calls `engine.tick()` every frame for smooth time integration, but UI
`refresh()` (rebuilding every visible ViewModel and pushing `setModel`) is throttled to a fixed
~150 ms interval (`REFRESH_INTERVAL_SECONDS`, `App.ts:66`) — documented in `App.ts`'s own class
comment as a deliberate fix for popups/buttons losing their click target mid-click if rebuilt every
frame. Popups (Payroll/RaidReport/NewWeek/GameOver/Victory) are not screens: they share one overlay
slot (`showOverlay`/`hideOverlay`, `App.ts:220-228`) and are opened by five near-identical
open/close method pairs — see [`ImprovementPlan.md`](ImprovementPlan.md) for the duplication this
causes.

UI "flavor" data — minion names/portraits, mission location art/weather/difficulty icons
(`src/ui/screens/shared.ts:155-195`) — is generated deterministically from id hashes or array
index, not stored in `GameState` or `CONFIG`. It is cosmetic only and has no gameplay effect.

## 6. Configuration and content

`src/data/config.ts` (471 lines) is the single `CONFIG: GameConfig` object and the only source of
tunable values: ranks, items, missions, world tiers, upgrades, incremental upgrades, requirement trees,
training transitions, starting balance/items, and global constants (`data/types.ts:154-167` defines
the `GameConfig` shape). Adding a mission, item, or upgrade is a pure data edit to this file; no
code changes are required unless the new content needs a new `UpgradeEffect`/`Process` type.
`src/data/weeks.json` holds the flavor "Week of…" messages (`lifecycle.ts:2,30`).

## 7. Testing

`selftest.ts` (root) is a headless, browser-free smoke test run via `npm run selftest` (`tsx
selftest.ts`). It drives `GameEngine` directly — no DOM, no UI layer — through 16 scenarios (initial
state, upgrades, the full raid→claim lifecycle, training, Laboratory upgrades, dungeon recruitment + its
bed-cap interaction, sales, weekly reset/tier unlock, payroll/bankruptcy, incremental upgrades, an
infirmary/quarters priority edge case, a minimum-prisoner guarantee, and the walk-back auto-claim
mechanic). It force-completes processes via `engine.forceCompleteProcess()` and substitutes
`state.rng` to make outcomes deterministic. There are no UI-layer tests (no Adapter/ViewModel
assertions) and no test framework/runner beyond this one script with hand-rolled `check()`
assertions — see [`ImprovementPlan.md`](ImprovementPlan.md).

## 8. Build and deployment

- `npm run dev` — Vite dev server.
- `npm run build` — `tsc --noEmit` (strict typecheck, no emit) then `vite build` → `dist/`.
- `npm run selftest` — the headless engine test above.
- `quick-test.cmd` — Windows convenience script: installs deps if missing, runs `tsc --noEmit`,
  then `selftest`.
- `quick-run.cmd` — Windows convenience script: runs `npm run dev`.
- `.github/workflows/deploy.yml` — on push to `main` (or manual dispatch), runs `npm ci`, `npm run
  build`, and publishes `dist/` to GitHub Pages. `vite.config.ts` sets `base: "/dark-tower-proto/"`
  to match the Pages path; the live build is linked from `readme.md`.
- `tsconfig.json` targets ES2022, `strict: true`, `noEmit: true` (Vite handles actual transpilation).

There is no CI step that runs `npm run selftest` before deploying — only the typecheck + build is
gated; see [`ImprovementPlan.md`](ImprovementPlan.md#useful-later).

## 9. Known implementation/design-doc divergences

These are implementation facts, not recommendations to change either side. Where
`DarkTowerGameDesign.md` already tracks a divergence as an Open Design Decision (§12), it's noted
as such rather than repeated as new information.

- **Dungeon population cap.** The prototype refuses recruitment once `minions.length >= bedCount()`
  (`dungeon.ts:60-61`). `DarkTowerGameDesign.md` §12 already lists this as an unresolved,
  not-yet-adopted rule — no new divergence here, just confirming the code matches what the design
  doc says the prototype does.
- **Dev-only pause/speed controls.** The design doc (§2) says the final game has "no ordinary pause
  or game-speed controls" outside specific blocking popups; the prototype's `TimeWidget` and
  `DebugPanel` add manual pause/speed/force-complete for development convenience
  (`src/ui/shell/TimeWidget.ts`, `src/ui/shell/DebugPanel.ts`). Already called out as dev-only in
  the prototype's own prior documentation; carried forward here, not a new finding.
- **Raid walk-back / auto-claim (not in the design doc at all).** `GameEngine.completeRaid()`
  (`GameEngine.ts:94-106`) schedules a `walkback` process equal in duration to the raid itself; if
  the player hasn't opened Raid Report and pressed Claim by the time it fires,
  `completeWalkback()` (`GameEngine.ts:108-113`) auto-calls `claimReport()` on the player's behalf
  (selftest scenarios 14–15 exercise this). `DarkTowerGameDesign.md` §6 describes Claim as a
  player-initiated action and says nothing about an automatic fallback. This is a genuine,
  previously-undocumented implementation decision with no design-doc counterpart — flagged here and
  in [`../Decisions/prototype-defaults-log.md`](../Decisions/prototype-defaults-log.md) rather than
  resolved in either direction.
- **World Map layout.** Already documented in `DarkTowerGameDesign.md` §5.1 as a deliberate
  "presentation simplification" (grouped sections instead of literal concentric rings); the
  prototype in fact renders mission pins on literal concentric rings per world tier
  (`WarRoomAdapter.ts:36-42`), which is the opposite simplification direction from what §5.1
  describes (code draws rings; the doc says rings aren't required and a grouped-list is the
  simplification). Worth a design-doc wording fix next time that section is touched, but not an
  application-code change made by this task.
