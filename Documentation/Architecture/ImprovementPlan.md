# Architecture Improvement Plan — Phase 1 Prototype

**This is a plan for a future Claude Code session. Nothing in this document has been
implemented, and this task did not execute any of it or change any application code.** It is
based on the audit in [`CurrentArchitecture.md`](CurrentArchitecture.md) (read that first for the
file/line references each item below assumes).

## How to use this document

Each item is independently implementable — pick one, implement it, verify it, stop. Don't bundle
several into one change; don't mix any of this with bug fixes, balancing, or new gameplay features
(per the project's own convention). Preserve existing gameplay behavior throughout; none of these
are behavior changes.

## Priority classification

- **Essential now** — reduces friction or risk for development that is actively happening in
  Phase 1 right now (per `readme.md`'s roadmap: "implement and refine the complete core gameplay
  loop," "develop and iterate on functional UI/UX").
- **Useful later** — pays off once the prototype has materially more content/screens than today;
  not worth the churn yet.
- **Deferred** — appropriate for the Unity vertical slice (Phase 2) or later, per the roadmap's own
  phase boundaries; doing it now would be solving a production-scale problem the prototype doesn't
  have.

---

## Essential now

### E1. Gate the GitHub Pages deploy on `npm run selftest`, not just the typecheck

1. **Problem:** `.github/workflows/deploy.yml` runs `npm run build` (`tsc --noEmit` + `vite build`)
   and deploys on every push to `main`. `npm run build` does not run `selftest.ts`, so a change
   that typechecks but breaks engine behavior (e.g. breaks the raid lifecycle, payroll, or any of
   the 16 scenarios in `selftest.ts`) can reach the live GitHub Pages build undetected.
2. **Motivation:** this is the one place the project already has an automated regression check
   (`selftest.ts`) and currently doesn't use it as a gate. For a solo developer shipping from a
   fast-moving AI-assisted branch, this is the cheapest possible protection against shipping a
   regression, and it costs nothing to add.
3. **Solution:** add an `npm run selftest` step to `.github/workflows/deploy.yml` before the
   `Build` step (or as part of it), failing the workflow (and blocking the Pages deploy) if it
   exits non-zero.
4. **Scope:** `.github/workflows/deploy.yml` only. No `src/` changes.
5. **Implementation:**
   - Add a step `run: npm run selftest` after `npm ci` and before/alongside `npm run build`.
   - No changes to `package.json` are needed (`selftest` script already exists).
6. **Risks:** negligible — this only adds a check, it cannot change behavior. The only risk is a
   slightly longer deploy time (selftest runs in well under a second).
7. **Verification:** push a branch with a deliberately broken `systems/*.ts` function, confirm the
   workflow fails at the new step and does not deploy; then confirm a clean push deploys as before.
8. **Acceptance criteria:** the workflow fails (and does not deploy) when `selftest.ts` throws;
   succeeds and deploys when it passes, exactly as `npm run build` behaves today for typecheck
   failures.

### E2. Replace `App.ts`'s duplicated per-screen switch with a single screen registry

1. **Problem:** `App.navigate()` (`App.ts:167-218`) and `App.refresh()` (`App.ts:362-385`) each
   contain their own `if (screen === 'storehouse') ... else if (screen === 'quarters') ...` chain
   over the same seven `ScreenId` values, mounting/building the same Adapter+View pair in both
   places. Adding one new screen means touching `ROOM_ENTRIES`, `ENABLED_SCREENS`, the `navigate()`
   branch, and the `refresh()` branch — four edits for one conceptual addition, and the two
   switches can silently drift (e.g. a screen handled in one but forgotten in the other).
2. **Motivation:** Phase 1's roadmap explicitly includes "develop and iterate on functional UI/UX,"
   which means more screens/popups are expected before this phase ends. Every one of them currently
   pays this four-touch-point tax, and the duplication is exactly the kind of thing an AI agent can
   silently get half-right (update one switch, miss the other) without a type error catching it.
3. **Solution:** introduce one `Record<ScreenId, ScreenDefinition>` (or array) mapping each
   `ScreenId` to `{ mount, buildViewModel, handleAction }`, and have both `navigate()` and
   `refresh()` look up that one table instead of repeating the branch chain.
4. **Scope:** `src/ui/App.ts` only. No change to any individual screen's `View`/`ViewModel`/
   `Adapter` files or their public shape.
5. **Implementation:**
   - Define a screen-definition type capturing the three functions each screen already exposes
     (`mount<Room>View`, `build<Room>ViewModel`, `handle<Room>Action`), accounting for the two
     screens that carry extra per-screen UI state (`storehouseUi`, `warRoomUi`, `trainingHallUi`)
     and the one with an extra `nav` argument (`warRoom`'s `openRaidReport`).
   - Build the registry once in the constructor (it can close over `this`).
   - Replace the `navigate()` branch chain with one lookup + mount call.
   - Replace the `refresh()` branch chain with one lookup + `setModel` call.
   - Leave `ROOM_ENTRIES`/`ENABLED_SCREENS` as-is unless a follow-up wants to derive them from the
     same registry too (not required for this change).
6. **Risks:** low — this is a mechanical refactor of dispatch, not of any screen's logic. The main
   risk is subtly changing *order* of operations for one screen (e.g. a screen whose mount has a
   side effect order dependency) — review each branch's current behavior before collapsing it.
7. **Verification:** `npm run build` (typecheck); `npm run selftest` (unaffected by UI changes, but
   cheap to confirm nothing else broke); manually run `npm run dev` and visit every one of the
   seven rooms plus every popup to confirm each still renders and responds to actions identically.
8. **Acceptance criteria:** navigating to every room and triggering every popup behaves identically
   to before the change; adding a hypothetical new screen now requires editing the registry in one
   place instead of two branch chains.

---

## Useful later

### U1. Collapse the five popup open/close method pairs in `App.ts` into one generic overlay controller

1. **Problem:** `openPayroll`/`closePayroll`, `openRaidReport`/`closeRaidReport`,
   `openNewWeek`/`closeNewWeek`, `openGameOver`, `openVictory`/`closeVictory` (`App.ts:233-325`)
   each manually repeat the same shape: null-check a handle field, build a ViewModel, call
   `showOverlay`/`hideOverlay`, and toggle `engine.setPaused`. `hasOpenOverlay()` (`App.ts:229-231`)
   also manually lists all five handle fields.
2. **Motivation:** every new popup (and the roadmap implies more are coming as mechanics expand)
   currently means writing a new near-duplicate open/close pair and remembering to add it to
   `hasOpenOverlay()`'s list — an easy thing to forget, and forgetting it means `checkEndgamePopups()`
   could stack a second popup on top of one it shouldn't.
3. **Solution:** a small generic `PopupController<Model, Action>` helper (open/close/setModel,
   pause-on-open by default) that `App.ts` instantiates once per popup type and that tracks "is any
   popup open" itself, removing the need for `hasOpenOverlay()`'s manual field list.
4. **Scope:** `src/ui/App.ts` only.
5. **Implementation:** extract the common open/close shape into a small helper class or factory
   function local to `App.ts` (or a new `src/ui/shell/` file if it ends up substantial); migrate
   one popup at a time, verifying after each.
6. **Risks:** medium-low — Payroll and RaidReport have slightly different close semantics
   (Payroll always resumes time on close; RaidReport's model-rebuild-on-action pattern differs
   slightly from the others) and GameOver has no `close` at all (dismiss doesn't unpause, per
   design). The helper needs to accommodate those differences via options, not force them to be
   identical.
7. **Verification:** `npm run build`; manually trigger every popup (payday due, open/close Payroll,
   complete a raid and both Claim-manually and let-it-walk-back, trigger Bankruptcy, trigger
   Victory) and confirm pause/resume and single-overlay behavior is unchanged.
8. **Acceptance criteria:** all five popups behave identically; adding a hypothetical sixth popup
   requires no change to a manually-maintained "is any popup open" list.

### U2. Split `src/data/config.ts` into per-domain files

1. **Problem:** `config.ts` is 471 lines and growing (ranks, items, missions, world tiers,
   upgrades, incremental upgrades, training transitions, starting balance, constants —
   13 sections in one file). An agent balancing one mission currently loads all of it.
2. **Motivation:** context locality (the project's own stated priority) degrades as content grows.
   Splitting now, while the file is still readable, is far cheaper than splitting once it has
   doubled.
3. **Solution:** split into `src/data/config/{ranks,items,missions,worldTiers,upgrades,
   incrementalUpgrades,trainingTransitions,startingBalance,constants}.ts`, each exporting
   its typed slice, re-assembled into the same `CONFIG: GameConfig` object from `src/data/config.ts`
   (kept as the single import path so no consumer needs to change).
4. **Scope:** `src/data/config.ts` (becomes a thin re-export/assembly file) + new files under
   `src/data/config/`. No consumer (`systems/*`, `ui/*`) needs to change its imports.
5. **Implementation:** move one section at a time, re-running `npm run build` after each to confirm
   the re-assembled `CONFIG` object's shape is unchanged.
6. **Risks:** low — purely mechanical as long as `CONFIG`'s external shape (`GameConfig`) is
   preserved exactly.
7. **Verification:** `npm run build` + `npm run selftest` (selftest reads many `CONFIG` fields
   directly, e.g. `CONFIG.startingBalance`, `CONFIG.missions` — a good cross-check that nothing
   moved incorrectly).
8. **Acceptance criteria:** `CONFIG` has the exact same runtime shape and values as before; no
   import outside `src/data/` changes.

### U3. Extract global upgrade-stat calculation from `GameState`

`GameState.effectiveStat()` derives Attack/Defense from completed `minionStat` upgrades, adding flat bonuses before multiplying. If stat modifiers grow to include equipment or temporary buffs, extract this pure calculation into a dedicated stats module rather than a Laboratory-specific system. Preserve `effectiveAttack`/`effectiveDefense` results with the existing upgrade-effect tests. This is an optional architecture improvement, not an unimplemented research system.

---

## Deferred (Phase 2 Unity vertical slice or later)

### D1. Process-type handler registry to decouple `GameEngine` from every system module

1. **Problem:** `GameEngine.dispatchCompletion()` (`GameEngine.ts:79-92`) is a switch over all ten
   `Process` types, and `GameEngine.ts`'s imports (`GameEngine.ts:5-15`) already reach into every
   `systems/*` module. Adding an eleventh process type means touching `model/types.ts`'s `Process`
   union, the new system file, and this switch.
2. **Motivation:** at the prototype's current scale (10 process types, one developer, rapid
   iteration) this coupling is visible but not yet costly — the switch is 14 lines and easy to
   scan. It would become a real problem at Unity-production scale with many more systems and
   multiple contributors, which is exactly the "maintainable, extensible game architecture" goal
   the roadmap assigns to Phase 2, not Phase 1.
3. **Solution (for Phase 2):** a registration-based dispatch table (`Map<ProcessType, (state,
   process, now) => void>`) populated by each system module, so `GameEngine` depends on a
   registration mechanism rather than importing every system by name.
4. **Scope:** would span `GameEngine.ts` and every `systems/*.ts` file's module-level exports.
5. **Implementation:** not detailed here — revisit when Phase 2 architecture work begins; the
   registry pattern should be designed together with whatever DI/composition approach Phase 2
   adopts (the previous Unity-era `CLAUDE.md`, preserved in git history, describes a VContainer-
   based service-layer pattern that solved an analogous problem — worth reviewing then, not now).
6. **Risks:** reordering completion dispatch logic touches every timed system at once; needs full
   `selftest.ts` coverage plus manual play before trusting it.
7. **Verification:** N/A until scheduled.
8. **Acceptance criteria:** N/A until scheduled.

### D2. Enforce the one-way dependency direction with tooling (lint rule / dependency-cruiser)

1. **Problem:** the `data → model → systems → engine → ui` layering (`CurrentArchitecture.md` §1)
   is currently a convention verified by inspection, not a build-time check. Nothing stops a future
   change from importing `src/ui/*` into `src/systems/*`.
2. **Motivation:** for one developer (plus AI agents that are told the rule explicitly via
   `CLAUDE.md`/this documentation) the convention has held so far. It becomes worth automating once
   more contributors or longer-running agent sessions are involved without this context loaded —
   i.e. around the Phase 2 transition, not before.
3. **Solution (for later):** add `dependency-cruiser` or an ESLint import-boundary rule encoding the
   five-layer direction, run in CI.
4. **Scope:** adds dev tooling + a config file; no `src/` changes expected unless a violation is
   found.
5. **Implementation:** not detailed here — low priority, revisit if a boundary violation is ever
   actually introduced, or when onboarding another contributor.
6. **Risks:** a naive rule could false-positive on legitimate type-only imports; needs tuning.
7. **Verification:** N/A until scheduled.
8. **Acceptance criteria:** N/A until scheduled.

### D3. Add automated UI-layer (Adapter/ViewModel) tests

1. **Problem:** `selftest.ts` covers `GameEngine`/`systems/*` only; no Adapter or ViewModel builder
   has an automated assertion. A regression in, say, `buildWarRoomViewModel`'s squad-selectability
   logic would only surface by manually clicking through the War Room.
2. **Motivation:** the roadmap itself defers this: Phase 1's stated activities are "develop and
   iterate on functional UI/UX" and "conduct early playtests," while "establish automated testing
   and regular playable builds" is explicitly a **Phase 2** activity. Adding a UI test framework
   now would be solving a problem the project has deliberately chosen to defer, at the cost of
   iteration speed this phase is optimizing for.
3. **Solution (for Phase 2):** introduce a lightweight test runner (e.g. `vitest`, already
   `tsx`-adjacent) and cover the Adapter layer's pure `build<Room>ViewModel`/`handle<Room>Action`
   functions, which are deterministic given a `GameEngine` + UI state and therefore cheap to test
   without a DOM.
4. **Scope:** new dev dependency, new `*.test.ts` files alongside each Adapter; no `src/` production
   code changes required (Adapters are already pure functions of `(engine, uiState) => ViewModel`).
5. **Implementation:** not detailed here — revisit at the Phase 2 transition per the roadmap's own
   sequencing.
6. **Risks:** low technical risk; the main cost is time that competes directly with gameplay
   iteration speed during Phase 1.
7. **Verification:** N/A until scheduled.
8. **Acceptance criteria:** N/A until scheduled.
