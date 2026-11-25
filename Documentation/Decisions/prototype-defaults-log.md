# Prototype Defaults Log

Every entry here fills a gap `DarkTowerGameDesign.md` §12 ("Open Design Decisions") leaves
unresolved, or documents a prototype behavior the design doc doesn't address at all. None of these
are binding on the eventual Unity game unless marked `adopted`. If the design doc is ever updated to
resolve one of these explicitly, update `src/data/config.ts` / the relevant `src/systems/*.ts`
file to match, and mark the entry below `superseded`.

This log was migrated from the former root `Architecture.md`'s "Defaults chosen for Open Design
Decisions" section (same content, now in the Knowledge-level location it belongs in) and extended
with one implementation-only mechanic discovered during the architecture audit.

### Tower XP timing and thresholds

- **Context:** design doc §8.1 — XP is awarded on completion, thresholds are cumulative, no
  gameplay unlock is tied to level.
- **Decision:** implemented exactly as specified; reaching a new level only logs a message
  (`src/systems/tower.ts`).
- **Status:** prototype default (matches the design doc's own stated rule, not an open gap).

### Upgrade scheduling

- **Decision:** concurrent room-upgrade construction is allowed; a completed upgrade never
  retroactively changes an already-running process.
- **Status:** prototype default, matches design doc §8.2.

### Training Hall: no speed upgrade

- **Decision:** only station count and sequential rank-transition unlocks exist; no training-speed
  upgrade.
- **Status:** prototype default, matches design doc §4.4's explicit statement.

### Recovery priority and bed-eviction clock

- **Decision:** Infirmary strictly takes priority over Quarters for a minion that is both Tired and
  Injured. Both rooms assign free beds to the longest-waiting idle candidate first. The two-day
  bed-eviction clock only runs while a minion is idle and conditioned.
- **Status:** prototype default; design doc §4.3 leaves exact interaction details as a scheduler
  implementation decision. Covered by `selftest.ts` scenario 12.

### Sales: concurrency, duration, instant-sale payout

- **Decision:** multiple normal sales may run concurrently; a sale's stack is removed/reserved the
  instant it starts; `duration = (1h + 0.5h × copies) × saleEfficiencyMultiplier`; instant sale pays
  `floor(0.5 × full value)`.
- **Status:** prototype default, matches design doc §4.1 formulas directly.

### Claim resolution: overflow and prisoner sort order

- **Decision:** selected loot is accepted in the player's selection order if storage fills
  (surplus silently discarded, per §6.1); captured prisoners are sorted high-to-low Rank before
  filling free Dungeon cells.
- **Status:** prototype default, matches design doc §6.2.

### Dungeon outcome split and duration scaling

- **Decision:** base `{recruit 60%, interrogate 15%, death 25%}`, shifted by prisoner Rank (higher
  Rank → harder to recruit, more likely to die) and by Recruitment Efficiency. Processing duration
  scales up with Rank, down with Torture Efficiency.
- **Status:** prototype default — design doc §11/§12 explicitly says the exact adjustment
  functions and normalization are not final balancing values.

### Research stacking order

- **Decision:** additive effects apply first, then multiplicative effects.
- **Status:** prototype default, matches design doc §8.3's explicit rule (not actually an open
  question, just confirming the implementation — see `GameState.effectiveStat()`).

### Payday window

- **Decision:** once payday becomes due, the player has 24 in-game hours to open Payroll and Pay
  All before Bankruptcy.
- **Status:** prototype default, matches design doc §2.1/§9.2's explicit rule.

### Raid Report item selection UI model

- **Decision:** modeled as "how many copies of each discovered item type to keep," with slot cost
  `ceil(count / max_stack_size)` per type — equivalent to the doc's per-copy description but
  simpler to present as +/- controls. The game preselects a valid subset within the carry budget.
- **Status:** prototype default, a presentation simplification of design doc §6.1 that changes no
  gameplay rule.

### World Map layout

- **Decision:** the prototype currently renders missions on literal concentric rings per world
  tier (`WarRoomAdapter.ts` `missionPosition()`).
- **Status:** **divergence worth re-examining.** Design doc §5.1 describes the *current*
  presentation as "grouped sections," explicitly says concentric rings are *not required*, and
  frames a grouped layout as the simplification. The prototype actually did the opposite — it drew
  rings. Gameplay rules are unaffected either way; this is purely a wording/presentation mismatch
  to reconcile next time §5.1 or the War Room screen is touched. See
  [`../Architecture/CurrentArchitecture.md`](../Architecture/CurrentArchitecture.md)#9-known-implementationdesign-doc-divergences.

### Population cap via Quarters beds

- **Context:** design doc Minions section notes "no confirmed hard population cap"; §12 explicitly
  calls this out as a final-game decision that still needs to be made.
- **Decision:** the prototype caps total population at current Quarters bed count (`bedCount()`),
  checked when a prisoner would convert to a minion; a prisoner who would exceed that cap is
  released instead of recruited (`src/systems/dungeon.ts`).
- **Status:** prototype default, **explicitly not adopted** for the final design per §12. Revisit
  when the design doc resolves whether to keep a hard cap or rely solely on the two-day
  bed-deprivation/attrition mechanic.

### Raid duration precision gating

- **Decision:** mission cards show an approximate duration (`~Xh`, rounded) until the War Room's
  Enemy Intelligence upgrade is purchased, after which the precise figure is shown.
- **Status:** prototype default, matches design doc §4.7.

### Payday popup and weekly flavor

- **Decision:** a blocking popup explains the stakes and auto-pauses the clock until dismissed,
  then a random "Week of…" message is drawn from `src/data/weeks.json`.
- **Status:** prototype default. Design doc §12 explicitly leaves open whether "Week of…" messages
  have gameplay effects beyond flavor — the prototype gives them none.

### Persistent village casualties and week ownership

- **Context:** raid/recovery needs configurable defender losses and explicit behavior for raids
  and reports spanning weeks.
- **Decision:** use the bounded independent casualty trials in design §11. Snapshot launch-week
  defenders, probability, and reward stock, then compare week ownership before modifying a live
  village. Weekly recovery replaces village stock independently of those snapshots.
- **Status:** prototype default. Initial values live in `CONFIG.constants.raid`; tune through
  playtesting. The formula is documented in the authoritative design §11.

### Local save compatibility

- **Context:** persistent village damage requires a save path; the previous prototype had none.
- **Decision:** store versioned whole-game JSON in browser local storage. Restore Maps and Sets,
  default omitted village fields, and preserve generated report rewards during migration. Infer
  a missing report week from its walkback process where available; otherwise use the saved week
  because no older timestamp can be recovered. Do not advance offline time.
- **Status:** prototype default. Reject malformed and unsupported future saves; browser storage
  availability remains platform-dependent.

### Raid walk-back / auto-claim (newly identified, not a migrated item)

- **Context:** found during the architecture audit, not in the original "Defaults chosen" list and
  not addressed anywhere in `DarkTowerGameDesign.md`.
- **Decision:** `GameEngine` schedules a "walk-back" timer (equal in length to the raid itself)
  when a raid completes; if the player hasn't manually Claimed the Raid Report by the time it
  fires, the engine auto-claims it on their behalf so the squad and rewards aren't stuck
  indefinitely (`GameEngine.ts` `completeRaid`/`completeWalkback`).
- **Status:** prototype default, no design-doc counterpart at all. **Revisit when:** the design doc
  is extended to say anything about what happens if Claim is never pressed — right now that's a
  gap this prototype quietly filled, not a decision anyone signed off on for the final game.
