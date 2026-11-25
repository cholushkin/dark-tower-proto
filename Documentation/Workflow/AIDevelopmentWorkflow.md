# AI Development Workflow

A practical methodology for Claude Code sessions working on this repo, written for a solo developer
coordinating multiple AI agents over a long period. `CLAUDE.md` is the entry point; this document
is what it links to for the "how to work" detail.

## 1. Discover context efficiently — don't read the whole repo

For almost any task, you need a small slice:

1. **Identify which Room/system the task touches.** Use
   [`../README.md`](../README.md) §2 to find its Systems-level entry point
   (`Architecture/Systems/<System>.md`). That doc names the exact files to read — usually one
   `src/systems/*.ts` file, the relevant slice of `src/data/config.ts`, and one `src/ui/screens/<room>/`
   triad.
2. **If the task spans more than one system** (raid/claim, scheduling, anything touching
   `GameEngine`), check [`../README.md`](../README.md) §3 for an existing Feature doc first — don't
   re-derive the cross-system flow from scratch if `RaidLifecycle.md` or
   `GameClockAndScheduler.md` already explains it.
3. **Only read `Architecture/CurrentArchitecture.md` in full** when the task is itself architectural
   (adding a new Process type, a new system, changing the UI composition pattern) — not for a
   routine content/balance/UI change inside one system.

## 2. Identify the authoritative source before changing behavior

- Gameplay rules: `Documentation/DarkTowerGameDesign.md` is authoritative. If the code and the
  design doc disagree, that is a **discrepancy to report**, not something to silently resolve by
  editing either one — unless the task explicitly asks you to fix a bug or implement a specific
  rule change.
- Roadmap/phase/strategy questions: `readme.md` is authoritative.
- Gaps the design doc leaves open (its §12, "Open Design Decisions"): check
  `Documentation/Decisions/prototype-defaults-log.md` first — the gap likely already has a
  documented prototype default. If your task requires a new default, add an entry there using the
  template in `Documentation/Decisions/README.md` rather than inventing a silent, undocumented
  choice.

## 3. Before changing a module, understand its boundaries

- `src/data/` → `src/model/` → `src/systems/` → `src/engine/` → `src/ui/` is a one-way dependency
  chain (`Architecture/CurrentArchitecture.md` §1). Don't add an import that reverses it (e.g. a
  `systems/*.ts` file importing from `src/ui/*`).
- All state mutation outside the UI layer goes through `src/systems/*.ts` functions or
  `GameEngine`'s action-API methods (`buyUpgrade`, `launchRaid`, `claimReport`, etc.). UI code calls
  those; it never assigns into `GameState` fields directly.
- Pure, read-only queries (`canLaunchRaid`, `canPurchaseUpgrade`, …) may be called
  directly from a ViewModel Adapter without going through `GameEngine` — that's an intentional
  read/write split, not an inconsistency to "fix."

## 4. Plan before implementing anything non-trivial

For a change touching more than one file or more than one system: write a short plan (what
files change, in what order, how each step stays independently runnable) before editing. A single
config-only tweak (e.g. rebalancing a mission's reward range in `config.ts`) doesn't need this.

## 5. Decompose larger tasks into independently verifiable steps

Prefer an order where each step leaves `npm run build` and `npm run selftest` passing, e.g.: add a
new `data/config.ts` entry → add/extend the owning `systems/*.ts` function → wire the `GameEngine`
action/dispatch if a new `Process` type is involved → update the `Adapter`/`ViewModel`/`View` →
update the relevant `Documentation/Architecture/Systems/*.md` entry if responsibilities shifted.

## 6. Validate changes proportionately

| Change scope | Minimum verification |
|---|---|
| Content/balance only (`data/config.ts`, `weeks.json`) | `npm run build` (typecheck) is usually enough; run `npm run selftest` if the change could affect a scenario it covers (e.g. starting balance, mission rewards used by a specific test). |
| One `systems/*.ts` function | `npm run build` + `npm run selftest` (covers raid lifecycle, upgrades, training, research, dungeon, sales, payroll/bankruptcy, incremental upgrades, several edge cases — see `Architecture/CurrentArchitecture.md` §7 for exactly which scenarios exist). If your change isn't covered by any existing scenario, say so explicitly rather than claiming selftest proves it. |
| `GameEngine` scheduling/dispatch | Full `npm run build` + `npm run selftest`, and re-read `Architecture/Features/GameClockAndScheduler.md` first — this is the highest-blast-radius file in the codebase (`dispatchCompletion`'s switch touches every system). |
| UI-only (`ui/screens/**`, `ui/components/**`) | `npm run build` for types; then actually run the app (`npm run dev`) and exercise the changed screen in a browser. `selftest.ts` does not touch the UI layer at all and proves nothing about it. |
| Documentation only | Check that links resolve and no new rule duplicates/contradicts `DarkTowerGameDesign.md`. |

There is currently no automated UI test and no CI gate running `selftest` (see
`Architecture/ImprovementPlan.md`) — don't claim a UI change is "tested" on the strength of
`npm run build` alone.

## 7. Respect existing contracts

- Don't change the `Process` union (`src/model/types.ts`) casually — every variant is matched in
  `GameEngine.dispatchCompletion()`'s switch; an unhandled case fails silently (TypeScript won't
  catch a missing switch arm here since there's no exhaustiveness check).
- Don't duplicate a gameplay rule into a Systems/Features doc — those link to
  `DarkTowerGameDesign.md`, they don't restate it. If you find yourself writing a number or rule
  that isn't already in the design doc, it probably belongs in
  `Documentation/Decisions/prototype-defaults-log.md` instead.

## 8. Record decisions and update documentation as part of the change, not after

If a task resolves an open design question (even informally, as a prototype default), add the
entry to `Documentation/Decisions/prototype-defaults-log.md` in the same change. If a task changes
a system's file layout or responsibilities, update the matching
`Documentation/Architecture/Systems/*.md` (or `Features/*.md`) entry in the same change — don't
defer it to "later."

## 9. Report incomplete work and risks explicitly

If a change is partial, a verification step couldn't be run (e.g. no browser available to check a
UI change), or you noticed something out of scope, say so plainly in your final report rather than
implying full confidence. This repo has no CI gate that would otherwise catch it.

## 10. Leave a useful handoff

End a session's work with: what changed (files), what was verified and how, what wasn't verified
and why, and any new entries added to the Decisions log or Systems/Features docs. A future session
should be able to resume from that summary plus `CLAUDE.md` without re-reading this entire file.

## Context-window hygiene

- Load `Architecture/CurrentArchitecture.md` in full only for architecture-level tasks; for a
  routine content/system change, the one relevant Systems doc plus the one or two source files it
  names is enough.
- Treat `Architecture/ImprovementPlan.md` as reference material to consult when asked to work on
  architecture, not something to read for a routine gameplay/content task.
- `DarkTowerGameDesign.md` is long (12 sections); jump to the specific section a Systems doc
  points you to rather than reading it end to end, unless the task is itself about overall game
  design.
