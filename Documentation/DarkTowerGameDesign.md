# Dark Tower — Game Mechanics Design

**Version:** 0.7 — Working specification  
**Genre:** Fantasy time-management / strategy  
**Engine:** Unity  
**Companion:** `dark_tower_config_catalog.md`  
**Scope:** Gameplay rules, interfaces between systems, and designer-configurable mechanics. Art direction, detailed UI layouts, implementation details, and final numerical balance are outside this specification.

Rules stated as facts describe the intended game design. Unresolved questions are listed in **Open Design Decisions**. Explicitly identified **prototype defaults** are not automatically binding on the final design. Illustrative combat formulas are marked **provisional**.

## 1. Premise, Vocabulary, and Core Loop

The player controls the **Dark Lord**, who manages a tower, sends minions to raid individual missions, receives loot and prisoners, develops facilities, trains the army, and pays weekly salaries.

**Core loop:** Open the **War Room** → Choose a mission and assign a squad → Launch a raid → Open its **Raid Report** popup and **Claim** → Recover, train, and recruit minions → Manage items in the **Storehouse** and purchase upgrades → Unlock World Tiers → Pay weekly salaries.

### 1.1 Tower Rooms

A **Room** is a functional facility inside the tower. Each Room contains its own activities and individually purchased **Upgrades**.

| Room | Purpose |
| --- | --- |
| **Storehouse** | All stored physical items, item filtering, stack sales, storage and selling upgrades |
| **Quarters** | Sleeping beds and automatic recovery from `Tired` |
| **Infirmary** | Treatment beds and automatic recovery from `Injured` |
| **Training Hall** | Manual minion rank training at training stations |
| **Laboratory** | Global minion upgrades and Alchemy |
| **Dungeon** | Prisoner cells, processing, interrogation, and recruitment |
| **War Room** | World Map, full minion roster, raid planning, raid progress, and intelligence upgrades |

There is **no separate Inventory screen**: physical items are managed in the Storehouse, and the full minion roster is in the War Room. There is **no separate World Map screen**: the World Map is part of the War Room.

Rooms have no individual room levels. **Tower Level** is a tower-wide progression value based on hidden XP earned from configured completed upgrades.

### 1.2 Popups

A **Popup** is an overlay for a specific event, action, or report; it is not a standalone Room.

| Popup | Purpose |
| --- | --- |
| **New Week / Payday Announcement** | Interrupt the start of payday, explain the 24-hour payment deadline, and introduce the new week's flavor event |
| **Payroll** | Display current financial and salary statistics, remaining hours until Bankruptcy, and a large **Pay All** button |
| **Raid Report** | Show a War Room raid's outcome, item quantities, prisoners, and squad statuses; confirm everything with **Claim** |
| **Victory** | Announce conquest of every mission and the appearance of a portal to another world |
| **Game Over — Bankruptcy** | Show end-of-game statistics and the bankruptcy outcome; reopenable from the persistent HUD Game Over widget |
| **Minion Departure** | Notify the player when minions abandon the tower after prolonged bed deprivation |

The Dark Lord remains present at the tower base. Payday and Game Over have prominent player-facing interaction widgets; the Game Over widget appears on the **left side of the HUD** after defeat.

### 1.3 Starting State and End States

- The game begins with **three minions**; other starting values come from `StartingBalance`.
- **Victory** occurs when every mission on the current world's map has been successfully completed and **Claimed** at least once. Victory opens a portal at the base but does not end play or prevent further raids.
- **Game Over — Bankruptcy** occurs when weekly payroll remains unpaid after its 24 in-game-hour deadline. The simulation stops permanently, but the player can inspect Rooms.
- Minions can abandon the tower through prolonged bed deprivation. Raids themselves do not kill minions.

## 2. Game Clock, Timers, and Payday

- **One real minute equals one in-game day** at the normal simulation rate; one in-game week is seven days.
- The world has a day/night cycle, a day counter, and a week counter.
- Time advances while the game is running. The prototype saves locally in the browser; loading resumes the saved game time without offline progression.
- A shared game-time scheduler handles raids, resting, treatment, training, sales, Dungeon processing, Room upgrades, and payday.
- The player has no ordinary pause or game-speed controls. The **New Week / Payday Announcement**, **Payroll**, and **Raid Report** popups pause time while open. Ordinary Room views do not.
- After Bankruptcy, the game remains **permanently paused**; dismissing the Game Over popup does not resume time.
- A developer-only scheduler/debug panel may list ongoing processes, speed up time, and force completion.

### 2.1 Payday Start and Weekly Announcement

Every seven in-game days, payday becomes due and a **24 in-game-hour deadline** begins. The game automatically displays a **blocking New Week / Payday Announcement** popup explaining that all minion salaries must be paid before the deadline. This popup pauses the game clock until dismissed.

When the announcement is dismissed, the game declares a randomly selected **“Week of…”** flavor message from a configured collection (for example, a “Week of Spiders”). The normal clock then continues, including the payday countdown. The random weekly message is flavor; any gameplay effects it might have are not specified here.

A visible **Payday** interaction/widget lets the player reopen **Payroll** while payment is outstanding. The payday obligation persists across management activities until the player pays or Bankruptcy occurs.

### 2.2 Payroll Popup

**Payroll** is the place where the player actually pays weekly salaries. It presents the current figures, not a one-time informational notification:

- Current available **Gold**.
- Total **weekly salary/upkeep** owed, with current population and optionally a Rank breakdown.
- **Hours remaining until Bankruptcy** if the payment is not completed.
- One prominent **Pay All** button.

The coins in the HUD show total weekly upkeep and its Rank breakdown on hover.

Rules:

- Salary is paid in **Gold** and depends on each owned minion's **Rank**.
- Every owned minion counts regardless of condition or current activity. Unrecruited prisoners do not count.
- **Pay All** pays the whole amount in one operation; there are no partial payments.
- **Pay All** is enabled only when available Gold covers the entire amount.
- Opening Payroll pauses game time; closing it without payment resumes time so the player can, for example, sell Storehouse items and return.
- Payment occurs only when the player presses **Pay All**.
- Unclaimed raid rewards do not count as available Gold.
- If the deadline expires with the bill still unpaid, trigger **Game Over — Bankruptcy**.

`weekly_salary = sum(rank_data[minion.rank].salary_gold_per_week for each owned minion)`

Normal purchases require sufficient resources and cannot create negative currency balances.

## 3. Minions, Ranks, and Conditions

### 3.1 Ranks

Each minion has a Rank from **1 to 5**. Rank defines weekly salary and the base combat stats `Health`, `Attack`, and `Defense`. The game UI keeps all three combat stats hidden.

| Rank | Name |
| --- | --- |
| 1 | Rookie |
| 2 | Grunt |
| 3 | Raider |
| 4 | Veteran |
| 5 | Captain |

A completed Training Hall session increases Rank by exactly one, using the target Rank's configured base characteristics.

### 3.2 Conditions and Activity

- **`Tired`** prevents starting a raid or training. It may follow raids, training, Dungeon recruitment, and other configured events.
- **`Injured`** also prevents starting a raid or training. Both conditions may coexist.
- Every raid participant becomes `Tired` on Claim. Minions defeated in the battle also become `Injured` (see §5.3).
- Recruited prisoners become `Tired` and have a **50%** chance to become `Injured`.
- At **nightfall**, all owned minions receive `Tired`.
- A minion cannot occupy multiple activities simultaneously. A completed raid whose Raid Report has not been Claimed still reserves its squad.

Recovery and treatment assignment are automatic. Squad assignment occurs in the War Room; manual training assignment occurs in the Training Hall.

### 3.3 Population, Roster, and Upkeep

The **War Room** displays the entire owned minion roster: one entry/card per minion, showing Rank, conditions, current activity, and raid availability. It also displays total population and aggregate weekly salary. Occupied and unavailable minions remain visible.

The intended design currently has **no confirmed hard population cap**. Sustainable population is constrained indirectly by available recovery beds and the two-day bed-deprivation rule. A prototype-specific recruitment cap based on Quarters beds is documented as an **open design decision**, not an adopted rule (§12).

## 4. Rooms and Their Activities

### 4.1 Storehouse

The **Storehouse** is the complete management location for all physical items, stacks, available capacity, and selling. There is no separate Inventory UI.

**Storage:**

- Treasures and ordinary Items share **one pool of Storehouse storage slots**.
- Each item **stack** occupies one slot; its maximum number of copies is `max_stack_size`.
- Example maximum stack sizes: **Golden Cup: 5**, **Cow: 1**, **Cobblestone: 30**.
- The `treasure` tag supplies the **Treasures** filter; other physical items appear under **Items**. Both filters display the same storage pool.
- An item definition has an ID, tags, `max_stack_size`, and a configured per-copy `base_value_gold`.
- Identical copies may occupy multiple stacks. Items may be sold or consumed as costs for upgrades.
- Loot that cannot fit during Claim is **silently discarded** under the ordered acceptance rule (§6.2).
- **Gold and Crystals** are currencies shown in the HUD; they do not occupy Storehouse slots.

**Sales:**

- Any physical item can be sold for Gold, one **entire stack** at a time.
- **Normal Sale:** the selected stack is removed/reserved **immediately** when the sale starts. Multiple normal sales may run concurrently. The full Gold value is credited only on sale completion.
- A normal sale's duration in game hours is:

  `sale_duration_hours = (1 + 0.5 * copies) * saleEfficiencyMultiplier`

- **Instant Sale:** immediately credits `floor(0.5 * full_stack_value_gold)` Gold; there is no timer.
- **Sale Efficiency** upgrades reduce the multiplier for **newly started** sales. A sale already in progress does not change duration when an upgrade finishes.

**Upgrades:**

- **Storage Capacity:** each purchase adds a configured number of Storehouse slots after its configured construction duration.
- **Sale Efficiency:** sequential upgrades reduce normal selling duration.

### 4.2 Quarters

Quarters supplies beds for automatic recovery from `Tired`.

- An idle, eligible minion with `Tired` is automatically assigned to a free Quarters bed unless `Injured` requires Infirmary treatment first.
- Rest takes **6 in-game hours**, clears `Tired`, and releases the bed.
- Daytime rest accommodates minions who become Tired after raids, training, recruitment, or other events.
- At nightfall, every owned minion becomes `Tired`, and eligible idle minions are automatically assigned beds.
- **Bed queue:** free beds are assigned to the **longest-waiting idle, eligible** minion first.
- **Bed deprivation:** a minion who remains **idle and conditioned** without a suitable bed for **more than two in-game days** leaves the tower. The timer runs only while the minion is idle and waiting for the needed bed; time spent in an occupied activity (such as a raid or training) does **not** count. A departure popup reports affected minions.
- **Extra Bed:** each completed purchase adds exactly one Quarters bed.

### 4.3 Infirmary

Infirmary automatically treats injured minions.

- Any idle minion with `Injured` is assigned to an available **Treatment Bed**, with **strict priority over Quarters** when both `Injured` and `Tired` are present. Such a minion cannot be assigned to Quarters while still Injured.
- **Treatment bed queue:** assign available beds to the **longest-waiting idle, eligible** injured minion first.
- Treatment normally takes **3 in-game days**; its duration is configurable.
- Tired patients rest during treatment. Rest takes **6 in-game hours**, as in Quarters, and clears `Tired` while treatment continues.
- Treatment completion clears `Injured`, clears any remaining fatigue, and frees the bed.
- **Extra Treatment Bed:** each completed purchase adds one bed.
- **Treatment Efficiency:** sequential upgrades reduce treatment duration for newly started treatment.

The two-day deprivation clock follows the same **idle and conditioned** eligibility principle when an appropriate treatment bed is unavailable. Details of interactions with multiple simultaneous condition changes remain a scheduler implementation decision.

### 4.4 Training Hall

Training Hall increases Rank through **manual assignments**.

- The player assigns an eligible minion to an available **Training Station**.
- One completed session advances Rank by **exactly one**.
- Cost and duration are configured separately for each Rank transition: 1→2, 2→3, 3→4, 4→5.
- Training may start only when the target transition is unlocked.
- Minions with `Tired` or `Injured` cannot start training.
- A trained minion becomes `Tired` and can automatically recover in Quarters.

**Upgrades:**

- **Extra Training Station:** each completed upgrade adds one station.
- **Advanced Training:** sequentially unlocks Rank transitions: 1→2, then 2→3, then 3→4, then 4→5.
- There is **no Training Speed upgrade**.

### 4.5 Laboratory

Laboratory provides ordinary upgrades with **permanent, global** effects and an **Alchemy** area.

- **Improved Weapons**, **Improved Armor**, and **Fury Spell** use the same acquisition, requirement, cost, construction, completion, and XP rules as every other upgrade (§8.2).
- Different Laboratory upgrades can run concurrently, including alongside Laboratory Tier Unlock and upgrades in other rooms. The same upgrade cannot be started twice while running or after its one-time completion.
- **Laboratory Tier Unlock** sequentially unlocks eligibility for higher-tier upgrades. Tier is a configured requirement, not a separate research scheduler.
- Upgrade durations come directly from configuration. Laboratory has no efficiency upgrades or research-speed multiplier.
- Combat upgrades grant additive bonuses to all minions on completion (§8.3).
- All upgrades use the common header cards, with their own progress and remaining time. Room parameters show Laboratory tier and active upgrade count.

**Alchemy** shows two empty input slots and one output slot: **element + element = result**. This is a non-interactive placeholder for future element combination. Recipes, item selection, consumption, and crafting are not implemented.

### 4.6 Dungeon

Dungeon holds prisoners captured during raids and processes them automatically.

- One prisoner occupies one **Cell**.
- Prisoners enter the Dungeon on Raid Report **Claim**, sorted by **descending Rank (highest first)** before assigning free cells. Excess prisoners are lost.
- Processing/torture starts automatically when a prisoner enters a cell.
- Higher-Rank prisoners require longer processing; **Torture Efficiency** reduces processing duration.

**Base processing outcome probabilities** before Rank and upgrade adjustments:

| Outcome | Base chance | Result |
| --- | ---: | --- |
| **Recruitment** | 60% | Prisoner becomes an owned minion and retains their Rank |
| **Interrogation** | 15% | Reveals secrets that can unlock War Room map locations or influence configured events |
| **Death** | 25% | Prisoner dies without being recruited |

- Increasing prisoner **Rank** makes recruitment harder and **Death** more likely.
- **Recruitment Efficiency** upgrades increase the adjusted Recruitment chance.
- The exact adjustment functions and normalization among the three outcomes are not yet final balancing values.
- A recruited minion enters the roster `Tired` and has a **50%** chance of `Injured`, then follows automatic recovery/treatment assignment.

**Upgrades:**

- **Extra Cell:** each completed purchase adds exactly one cell.
- **Torture Efficiency:** sequential upgrades reduce processing duration.
- **Recruitment Efficiency:** sequential upgrades improve recruitment chances.

**Prototype-only population policy:** the current prototype checks a cap of `bedCount()` (total Quarters beds) at the moment a prisoner would become a minion. If recruitment would exceed that number, the prisoner is **released instead of recruited**. This cap is **not yet approved for the final design**; see §12.

### 4.7 War Room

The **War Room** is the home for **both** the full minion roster and the **World Map**. The player can inspect all minions, select a mission, assemble an eligible squad, see raid progress, and open the Raid Report popup. Neither the roster nor the World Map is a separate screen.

Two independent upgrade series improve mission information:

- **Enemy Intelligence** I reveals defender counts and the rank breakdown of the active garrison. A first completed visit also reveals defender counts, including beneath the map flag. Enemy Intelligence II reveals the village's current weekly Gold and Crystal stock.
- **Loot Intelligence:** upgrades progressively reveal possible loot item types, resources, and estimated drop probability ranges. Early levels may conceal item types entirely.

The War Room always displays the configured raid duration.

## 5. War Room World Map, Mission Progression, and Raids

### 5.1 World Tiers and Map Presentation

- The World Map appears **inside the War Room**.
- The current presentation lists **World Tiers as grouped sections**, with their individual missions. Literal concentric rings are **not required**; the grouped layout is a presentation simplification that changes no gameplay rules.
- Each game randomly picks one enabled mission per configured group in the current world. Groups with no enabled missions are skipped. The picks are saved with the game and persist through weekly recovery.
- The first populated World Tier is available from the start.
- A tier unlocks when **every selected mission in the preceding populated tier** has been successfully **Claimed** at least once.
- A mission's first successful Claim adds a permanent **green checkmark**.
- The player wins the current world after every selected mission has been successfully Claimed at least once.
- Dungeon secrets may reveal or unlock particular map locations and influence configured events.

### 5.2 Mission Selection and Visibility

The War Room map marks each mission's progression and raid status:

| State | Meaning |
| --- | --- |
| `LOCKED` | Mission is not currently accessible |
| `AVAILABLE` | Eligible to start a raid |
| `RUNNING` | Raid active; the mission marker/card shows its progress bar |
| `COMPLETED_UNCLAIMED` | Raid finished; **Raid Report** awaits Claim |
| `COOLDOWN` | This village was successfully raided this week; it recovers next week |
| `COMPLETED_ONCE` | Permanent first-success checkmark, shown alongside current raid/availability status |

Opening a mission on the War Room map displays its details, intelligence, duration, and squad/raid controls. The minion roster supplies squad candidates; only eligible minions can be assigned.

### 5.3 Raid Rules

- A squad is assigned to **one specific mission**.
- Participants must be available and have neither `Tired` nor `Injured`.
- Multiple raids may run concurrently on **different missions**.
- A minion can participate in only one occupied activity at a time.
- Each mission defines `defenderRanks`, with one rank per defender. For example, `[1, 1, 1]` is a garrison of three Rank 1 defenders. Runtime village state tracks the surviving ranks and the current week's rewards.
- Each mission's `durationHours` is fixed. The battle resolves when that timer ends, regardless of squad size, ranks, upgrades, or the number of turns. Weather is location flavor.

#### Battle simulation

Each unit starts at its rank's full `Health`. Both sides use their rank's configured `Attack` and `Defense`. The attackers also receive their completed Laboratory bonuses when the battle begins.

1. Every unit alive at the start of the turn independently picks a random living opponent. Multiple units can pick the same target.
2. Each hit deals `max(1, attacker.Attack - target.Defense)` damage.
3. Sum each unit's incoming damage and subtract it from that unit's `Health` simultaneously.
4. Eliminate units at `Health <= 0`. They still attack on the turn they are defeated and take no part in subsequent turns.

The attackers win as soon as every defender is defeated, including if both sides are wiped out on the same turn. The defenders win if every attacker is defeated and at least one defender survives. An undefended village gives a nonempty squad an immediate victory when the raid timer ends.

For example, Rank 1 units with `Health = 5`, `Attack = 5`, and `Defense = 5` deal 1 damage per hit. If three attackers pick the same defender and the three defenders each pick a different attacker, the targeted defender falls to 2 Health and each attacker falls to 4. All six units act in the second turn.

#### Raid outcome

Victory reserves the entire launch-week reward stock for Claim. Defeat awards no rewards and leaves the surviving defender ranks eligible for another battle. Surviving defenders begin each new battle at full Health. Defeated defenders rejoin the garrison at weekly recovery.

The squad is reserved while walking back to the tower. **Teleport to Tower** in the Raid Report brings the squad back immediately and collects any rewards. Walking home applies the same results after the return timer. All raiders return Tired, and defeated minions also need Infirmary treatment.

### 5.4 Repeat Attacks and Weekly Village Recovery

A mission can be launched when all conditions are met:

1. Its World Tier and mission-specific prerequisites permit access.
2. It has no raid currently `RUNNING` or `COMPLETED_UNCLAIMED`.
3. It has not been successfully raided in the **current in-game week**.

After a failed report is Claimed, the village can be attacked again that week with available minions. There is no retry limit or fee. Raid time, rest, and injury recovery are the costs of failed attacks and dividing the army.

At each new week, every village restores its configured defender ranks and rolls a fresh stock of Gold, Crystals, items, and prisoners. Successful villages become available again. Permanent completion checks and tier unlocks remain recorded, including after the Victory popup.

A raid snapshots the launch week's active defender ranks and rewards. An old-week raid resolves against this snapshot. Claim processes the reserved rewards and records permanent completion on victory. The new week's village keeps its own defenders, rewards, and cooldown. An unresolved raid or report reserves its squad and village through weekly recovery until Claim.

## 6. War Room Raid Report Popup and Claim

**Raid Report** is a popup opened from the corresponding mission in the **War Room**, and uses the same interface for successful and failed raids.

- A finished raid appears as `COMPLETED_UNCLAIMED` until Claim.
- The popup displays mission information, defender losses, weekly recovery timing, rewards found, and the participating minions' conditions. Old-week reports identify their week separately from the village's current state. Loot and prisoners form adjacent collections, followed by squad information.
- Opening Raid Report **pauses game time**.
- Closing the popup without Claim does not credit rewards, free minions, or complete the mission.
- One **Claim** action confirms the entire outcome, even when the raid failed.

### 6.1 Rewards Found

Weekly rewards come from mission configuration. The report groups discovered items by type and shows the full quantity of each. On victory, all generated currencies, items, and prisoners go through Claim.

### 6.2 Claim Resolution

On pressing **Claim**:

1. Credit discovered **Gold and Crystals** if the raid succeeded.
2. Transfer all discovered physical items into the **Storehouse**, grouped by item type in discovery order. Fill matching partial stacks and use free Storehouse slots as needed. Silently discard any copies that cannot fit.
3. Sort captured prisoners **highest-to-lowest Rank**, assign them automatically into available Dungeon cells, and discard any excess.
4. Apply the returning minions' `Tired` / `Injured` conditions and release the entire reserved squad.
5. On a first successful Claim, permanently mark the mission as completed, unlock the next World Tier when eligible, and trigger the **Victory popup** if every mission on the map has been successfully Claimed.
6. Preserve a successful current-week village's cooldown. A failed Claim permits another raid.

On **failure**, Claim still releases the squad and updates mission state, but credits no rewards. Defender losses have already been applied when the raid resolved. Repeated Claim attempts cannot award anything twice.

## 7. Physical Items and Economy

All physical items belong to **Storehouse storage** and are represented by item types and stacks, not by a standalone Inventory system or screen.

- **Treasures** are items bearing the `treasure` tag, not a separate resource class.
- **Items** and **Treasures** are Storehouse filters that share the same stack capacity.
- Each stack uses one Storehouse slot; `max_stack_size` controls the number of copies in it.
- Selling removes/reserves the full chosen stack at sale start. Concurrent timed sales are permitted, and instant sales receive the rounded-down half-value immediately.
- Item consumption for configured costs, full-value normal sales, upgrades, and other transactions obey resource-availability rules.
- Gold and Crystals are displayed globally in the HUD and never occupy storage slots.

## 8. Tower Level, Upgrade Effects, and Acquisition

### 8.1 Tower Experience

The tower has one **Tower Level** derived from cumulative **Tower XP**.

- XP is a **hidden progression score**, not a spendable currency or a separate HUD balance.
- Configured upgrades can award specified XP values **on completion**, never on purchase/start.
- The `towerXpThresholds` entries are **cumulative total-XP thresholds**, not per-level increments.
- Reaching a new level **logs a message**. Tower Level itself currently gives **no gameplay unlocks or bonuses**.

### 8.2 Upgrade Acquisition, Requirements, and Concurrent Work

- An upgrade is acquired separately from construction. Upgrade pickups and rewards make its definition available; they do not grant its effect, spend its construction cost, or award XP.
- Current content starts with every configured upgrade acquired. No current reward table drops upgrades. Future definitions can require acquisition through an item or direct reward.
- A pickup item identifies the upgrade it unlocks. Claim learns discovered pickups directly without occupying Storehouse space. Duplicate pickups do not stack effects or grant XP. Repeatable upgrades stay available for subsequent purchases after one acquisition.
- Each upgrade defines cost, duration, requirements, and effect. Acquired upgrades still require affordability and all configured conditions before construction can start.
- Requirements form serializable condition trees: **all**, **any**, and **not** combine completed/acquired upgrades, numeric game-state conditions, named progression flags, successful mission Claims, and held item quantities. Item requirements check possession; they do not consume items. Requirements are checked at start; later changes do not cancel running construction.
- Supported numeric conditions compare Tower Level, Laboratory tier, Gold, Crystals, or minion count using equality, minimum, or maximum thresholds. New metrics can extend the evaluator without changing the tree structure.
- **Different upgrades may run concurrently in every room, including Laboratory.** Only duplicate construction of the same upgrade is blocked. Sequential series retain their prerequisites.
- Effects and configured Tower XP apply on completion. One-time upgrades cannot be rebuilt. Repeatable upgrades increase their level and use their configured next cost/duration.
- Existing timed processes keep their scheduled end times; newly completed speed upgrades affect future starts.
- Examples include storage, beds, cells, stations, treatment/sale/Dungeon efficiency, training and Laboratory-tier unlocks, War Room intelligence, and global Attack/Defense bonuses.

### 8.3 Upgrade Effect Combination

Each completed combat upgrade adds its configured modifier to the corresponding minion stat. Bonuses to the same stat add together.

## 9. Victory, Portal, and Bankruptcy

### 9.1 Victory Popup and Post-Victory Play

- On the **first successful Claim that completes every mission** on the War Room's current-world map, show the **Victory** popup.
- The message celebrates conquest of this world and reveals that **another world awaits**.
- A **portal appears at the tower base** as the entry point toward another world.
- **Victory does not stop or pause the ongoing game permanently.** The player can keep managing the tower and raiding previously completed missions when their weekly cooldown permits.
- The rules for entering and progressing through the new world are not yet specified.

### 9.2 Game Over — Bankruptcy Popup

- Bankruptcy occurs if the entire weekly payroll has **not** been paid within **24 in-game hours** of payday becoming due.
- The game enters a **permanent pause**: all ongoing game-time processes stop and normal gameplay progression cannot resume.
- The **Game Over — Bankruptcy** popup shows end-of-game statistics and clearly communicates the reason for defeat.
- The popup may be dismissed so the player can **inspect Rooms and existing game state**. This inspection does not unpause the simulation, and the player **cannot buy upgrades or make purchases** after Game Over.
- A large persistent **Game Over** widget appears on the **left side of the HUD**, styled/functioning as a counterpart to the Payday widget.
- Clicking that widget **reopens the Game Over popup** at any time while inspecting the frozen tower.

## 10. Configuration and Runtime Ownership

The Unity game uses designer-authored configuration for Ranks, items, starting balance, missions, World Tiers, upgrades, intelligence, Tower XP thresholds, weekly flavor messages, economy, Dungeon outcomes, and global formulas. The accompanying **Configuration Catalog** defines these contracts.

**Static configuration** defines rules, values, thresholds, and probabilities. **Runtime state** tracks Gold/Crystals, owned minions and their conditions, Quarters/Infirmary bed occupancy and idle-wait times, Storehouse stacks and concurrent sales, Dungeon prisoners, running timers, raids and discoveries, Claims, completed mission checks, acquired/completed upgrades and requirement flags, total Tower XP/Level, payday deadline/payment state, current world victory and portal state, and permanent Bankruptcy state.

The catalog may require a corresponding update to reflect the new decisions; this revision changes the **game design specification** only.

## 11. Provisional Balancing Formulas

Dungeon outcome probabilities start at **Recruitment 60% / Interrogation 15% / Death 25%**, then change with prisoner Rank and Recruitment Efficiency. Processing duration increases with Rank and decreases with Torture Efficiency. Precise formulas and resulting probability normalization are still balancing decisions.

## 12. Open Design Decisions

The following decisions remain unresolved. Decisions settled in v0.7 are incorporated into their gameplay sections above.

- **Population cap — final-game decision required:** The **prototype** limits total owned population to the number of Quarters beds, checked when Dungeon recruitment would finish. A prisoner who would exceed `bedCount()` is released. The **intended game design has not adopted this rule**. Decide whether to enforce this hard cap in the real game or rely solely on the existing two-day bed-deprivation/attrition mechanic.
- **Dungeon secrets and events:** Define exact secrets, event types, location unlock effects, and how these interact with tier prerequisites.
- **Dungeon probability balancing:** Specify numeric Rank modifiers, Recruitment Efficiency bonuses, outcome normalization, and the processing-duration formula by Rank and Torture Efficiency.
- **World Map intelligence and availability:** Define detailed reveal rules across upgrade levels, event/secret visibility, and mission-specific prerequisites beyond tier completion.
- **Another world:** Define what entering the base portal does, the structure of later worlds, and whether/how progression and minion/tower state carry across.
- **Scheduler tie-breaking:** Specify order when payday deadlines, raid completion/Claim, upgrade completion, nightfall, bed eligibility, and minion condition changes coincide. Define the exact nightfall trigger hour.
- **Recovery edge cases:** Clarify how wait time is preserved/reset across changes of condition, bed eligibility, or already-running recovery; the general idle-only deprivation rule and longest-waiting priorities are fixed.
- **Payday and week flavor:** Define whether “Week of…” messages have gameplay effects or remain flavor only. The announcement/pause and 24-hour deadline are fixed.
- **Balance and data:** Finalize numerical costs, starting capacities, XP awards and thresholds, rank stats, garrison composition, raid durations, upgrade bonuses, prisoner distributions, training prices, and initial upgrade availability.
