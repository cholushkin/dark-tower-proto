# CLAUDE.md

Guidance for Claude Code sessions working in this repository.

## Project identity and phase

**Dark Tower** is a fantasy time-management/strategy game built as an experiment in AI-agent-driven
game development (see [`readme.md`](readme.md) §1). This repository currently holds **Phase 1 —
Gameplay Prototype**: a browser-only TypeScript/Vite implementation with no backend and local
browser saves (no offline progression), whose purpose is to validate core mechanics, economy, and UX before a
Phase 2 Unity vertical slice. Don't bring Unity-era assumptions into this code — the previous
Unity-based `CLAUDE.md` was deleted (git history: `59e6750`) because it described a different
project structure (`Unity/Game/`, rMVVM, VContainer) that doesn't exist in this repo.

## Authoritative sources — read these, don't restate their content elsewhere

| Topic | Source |
|---|---|
| Vision, six-phase roadmap, documentation philosophy | [`readme.md`](readme.md) |
| Gameplay rules, mechanics, formulas, open design questions | [`Documentation/DarkTowerGameDesign.md`](Documentation/DarkTowerGameDesign.md) — rules stated as facts are intended design; §12 lists what's still unresolved |
| Prototype-only defaults filling those open questions | [`Documentation/Decisions/prototype-defaults-log.md`](Documentation/Decisions/prototype-defaults-log.md) |

If code and the design doc disagree, that's a discrepancy to flag, not something to silently
resolve in either direction — unless your task explicitly asks for a bug fix or rule change.

## Documentation navigation

Start at [`Documentation/README.md`](Documentation/README.md) — it indexes everything by the
four-level Project/Systems/Features/Knowledge structure described in `readme.md` §3. In short:

- **One system doc per gameplay area** under `Documentation/Architecture/Systems/` (Storehouse,
  Recovery, TrainingHall, Laboratory, Dungeon, WarRoom, PayrollAndLifecycle) — read the one
  relevant to your task, not the whole architecture doc.
- **Feature docs** under `Documentation/Architecture/Features/` for the two things that cross
  multiple systems: the raid→report→claim lifecycle, and the game clock/scheduler.
- **`Documentation/Architecture/CurrentArchitecture.md`** — the full implemented-architecture
  writeup; read in full only for architecture-level tasks.
- **`Documentation/Architecture/ImprovementPlan.md`** — proposed, **not implemented** restructuring
  ideas. Don't execute anything from it unless explicitly asked to.
- **`Documentation/Workflow/AIDevelopmentWorkflow.md`** — the full methodology this file
  summarizes (context discovery, planning, verification, decision-recording, handoffs).

## Repository structure and dependency rule

```
src/data/    → src/model/   → src/systems/  → src/engine/   → src/ui/
(config,       (GameState,    (one pure-fn      (GameEngine:    (shell/, screens/<room>/,
 content)       runtime state)  module per       clock + action    components/)
                                gameplay area)   API)
```

Dependencies point only downward in this chain. All state mutation outside `src/ui/` goes through
`src/systems/*.ts` functions or `GameEngine`'s action-API methods (`buyUpgrade`, `launchRaid`,
`claimReport`, etc.); UI code never assigns into `GameState` fields directly, though it *may* call
pure read-only `systems/*` query functions (e.g. `previewRaid`, `canLaunchRaid`) directly to build
a ViewModel. See `Documentation/Architecture/CurrentArchitecture.md` for the full map.

## Build, run, and test commands

```bash
npm install
npm run dev        # Vite dev server
npm run build      # tsc --noEmit (strict typecheck) + vite build -> dist/
npm run selftest   # headless engine smoke test (tsx selftest.ts), no browser needed
```

`quick-test.cmd` runs typecheck + selftest; `quick-run.cmd` runs the dev server (Windows
convenience wrappers). `npm run selftest` exercises `GameEngine`/`systems/*` only — it proves
nothing about `src/ui/*`; verify UI changes by actually running `npm run dev` in a browser.

## Coding conventions

- TypeScript `strict: true` (`tsconfig.json`); keep it passing.
- `src/systems/*.ts` files are plain exported functions over `(state: GameState, ...)` — no classes,
  no hidden module state beyond what's already there (e.g. `shared.ts`'s memoized name pool, which
  is UI flavor, not gameplay state).
- UI screens follow the View / ViewModel / Adapter triad per room (see any
  `src/ui/screens/<room>/` folder). `View` never imports `GameEngine`; `Adapter` is the only file
  that bridges engine state to a ViewModel and actions back to engine calls.
- `src/data/config.ts` is the single source of truth for tunable content. Adding a mission/item/
  upgrade is a data-only edit unless it needs a new `UpgradeEffect` or `Process` type.
- Comments: only where this repo's broader convention already applies — explain non-obvious *why*,
  never task/session history or design-doc section numbers as the comment's subject.

## Planning, implementing, and verifying changes

Follow `Documentation/Workflow/AIDevelopmentWorkflow.md` in full; in short:

1. Find the task's owning system via `Documentation/README.md` before reading source.
2. For anything spanning more than one file/system, write a short plan before editing.
3. Verify proportionately to scope (content tweak → `npm run build`; systems change → add
   `npm run selftest`; UI change → also run it in a browser; see the workflow doc's table).
4. State clearly what you verified and what you didn't — there is no CI gate running `selftest`
   today (tracked as improvement `E1` in `Documentation/Architecture/ImprovementPlan.md`), so don't
   imply a guarantee the project doesn't currently provide.

## Documentation maintenance

If a change resolves an open design question (even as a prototype default) or shifts a system's
file layout/responsibilities, update `Documentation/Decisions/prototype-defaults-log.md` or the
relevant `Documentation/Architecture/Systems|Features/*.md` entry **in the same change**, not as a
follow-up. Never duplicate a gameplay rule outside `DarkTowerGameDesign.md` — Systems/Features docs
link to it, they don't restate it.

## Handling unspecified decisions and discrepancies

- An unresolved question already in `DarkTowerGameDesign.md` §12: check
  `Documentation/Decisions/prototype-defaults-log.md` for an existing default before inventing a
  new one; if you must add one, use the template in `Documentation/Decisions/README.md`.
- A behavior that exists in code but isn't addressed by the design doc at all (e.g. the raid
  walk-back/auto-claim timer, documented in `Documentation/Architecture/Features/RaidLifecycle.md`):
  treat it the same way — record it as a prototype default, don't assume it's either correct or
  wrong without being asked to judge it.
- A place where code and design doc actively conflict (e.g. the World Map ring-vs-grouped-layout
  wording, see `Documentation/Architecture/CurrentArchitecture.md` §9): report it; don't silently
  change either side unless the task asks you to reconcile it.

## Out of scope by default

Do not perform the restructuring in `Documentation/Architecture/ImprovementPlan.md`, and do not
invent permanent rules for `DarkTowerGameDesign.md` §12's open questions, unless a task explicitly
asks for exactly that.
