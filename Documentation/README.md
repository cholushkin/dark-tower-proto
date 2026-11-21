# Dark Tower — Documentation Map

This is the navigation hub for all project documentation. It follows the four-level structure
defined in [`../readme.md`](../readme.md) §3 (Project / Systems / Features / Knowledge).

Start at the root [`CLAUDE.md`](../CLAUDE.md) if you are an AI agent beginning a session; it links
back into this map at the points relevant to a typical task.

## 1. Project level — vision, design, architecture

| Document | Covers |
|---|---|
| [`../readme.md`](../readme.md) | Vision, six-phase roadmap, documentation philosophy. Authoritative for strategy/roadmap. |
| [`DarkTowerGameDesign.md`](DarkTowerGameDesign.md) | Authoritative gameplay rules, mechanics, formulas, and the canonical list of **Open Design Decisions** (§12). Written for the eventual Unity game; the Phase 1 prototype implements a subset of it plus some prototype-only defaults (tracked in [Decisions](Decisions/prototype-defaults-log.md)). |
| [`Architecture/CurrentArchitecture.md`](Architecture/CurrentArchitecture.md) | How the Phase 1 TypeScript/Vite prototype is actually built today: module map, dependency rules, state/clock model, build/test/deploy. Describes **implemented** behavior only. |
| [`Architecture/ImprovementPlan.md`](Architecture/ImprovementPlan.md) | Prioritized, **not-yet-executed** plan for restructuring the prototype codebase. Proposed/future architecture only — nothing in it is implemented. |
| [`Workflow/AIDevelopmentWorkflow.md`](Workflow/AIDevelopmentWorkflow.md) | How an AI agent session should discover context, plan, implement, verify, and hand off work in this repo. |

## 2. Systems level — one entry point per gameplay system

Each file below is a short pointer, not a rules restatement: it names the system's owning
source files, the `GameState` fields it reads/writes, and links to the authoritative design-doc
section. Gameplay rules live in `DarkTowerGameDesign.md` only, to avoid duplicate/conflicting
definitions.

| System | Rooms covered | Doc |
|---|---|---|
| Storehouse | Storehouse | [`Architecture/Systems/Storehouse.md`](Architecture/Systems/Storehouse.md) |
| Recovery | Quarters, Infirmary | [`Architecture/Systems/Recovery.md`](Architecture/Systems/Recovery.md) |
| Training Hall | Training Hall | [`Architecture/Systems/TrainingHall.md`](Architecture/Systems/TrainingHall.md) |
| Laboratory | Laboratory | [`Architecture/Systems/Laboratory.md`](Architecture/Systems/Laboratory.md) |
| Dungeon | Dungeon | [`Architecture/Systems/Dungeon.md`](Architecture/Systems/Dungeon.md) |
| War Room | War Room (World Map, raids, roster) | [`Architecture/Systems/WarRoom.md`](Architecture/Systems/WarRoom.md) |
| Payroll & Lifecycle | cross-cutting (clock, nightfall, payday, bankruptcy, economy) | [`Architecture/Systems/PayrollAndLifecycle.md`](Architecture/Systems/PayrollAndLifecycle.md) |

## 3. Feature level — created only where cross-system complexity justifies it

| Feature | Doc |
|---|---|
| The raid → report → claim lifecycle (spans War Room, Dungeon, Storehouse, Recovery) | [`Architecture/Features/RaidLifecycle.md`](Architecture/Features/RaidLifecycle.md) |
| Upgrade acquisition, flexible requirements, and concurrent construction | [`Architecture/Features/Upgrades.md`](Architecture/Features/Upgrades.md) |
| The game clock / scheduler (day-boundary stepping, nightfall, payday triggers) | [`Architecture/Features/GameClockAndScheduler.md`](Architecture/Features/GameClockAndScheduler.md) |

## 4. Knowledge level — decisions and playtest findings

| Document | Covers |
|---|---|
| [`Decisions/README.md`](Decisions/README.md) | Lightweight convention for recording decisions and (once they exist) playtest findings. |
| [`Decisions/prototype-defaults-log.md`](Decisions/prototype-defaults-log.md) | Every prototype-only default chosen to fill a gap left open by `DarkTowerGameDesign.md` §12, plus implementation choices the design doc doesn't address at all. |

There is no `Playtests/` folder yet — none have been run. When the first one happens, record it
under `Documentation/Playtests/` following the template in `Decisions/README.md`; don't create the
folder pre-emptively (see [`Decisions/README.md`](Decisions/README.md)).

## Other root documents

- [`../version-history.md`](../version-history.md) — user-facing version log (not architecture).
- [`../quick-run.cmd`](../quick-run.cmd), [`../quick-test.cmd`](../quick-test.cmd) — Windows convenience launchers for `npm run dev` / typecheck + selftest.
