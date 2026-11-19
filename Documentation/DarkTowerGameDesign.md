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
| **Laboratory** | Permanent research and research-related upgrades |
| **Dungeon** | Prisoner cells, processing, interrogation, and recruitment |
| **War Room** | World Map, full minion roster, raid planning, raid progress, and intelligence upgrades |

There is **no separate Inventory screen**: physical items are managed in the Storehouse, and the full minion roster is in the War Room. There is **no separate World Map screen**: the World Map is part of the War Room.

Rooms have no individual room levels. **Tower Level** is a tower-wide progression value based on hidden XP earned from configured completed upgrades and research.

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
- Time advances while the game is running. The current design has no save system or offline progression.
- A shared game-time scheduler handles raids, resting, treatment, training, sales, research, Dungeon processing, Room upgrades, and payday.
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
- Gold balance that would remain after paying.
- **Hours remaining until Bankruptcy** if the payment is not completed.
- One prominent **Pay All** button.

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

Each minion has a Rank from **1 to 5**. Rank determines baseline Attack, Defense, Salary, and Carry Capacity. Completed Laboratory research can modify effective characteristics.

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
- A successful raid makes every participant `Tired`; each participant has an independent, configured chance of becoming `Injured`.
- A failed raid makes every participant `Tired`; each participant independently rolls for `Injured` using the same hidden injury-risk formula as a successful raid.
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
- Identical copies may occupy multiple stacks. Items may be sold or consumed as costs for research and upgrades.
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
- Completion clears **both** `Injured` and `Tired` and frees the bed.
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

Laboratory conducts research with **permanent, global** effects.

- Each research project defines costs, prerequisites, duration, and effects.
- Only **one Laboratory research/improvement process** may run at a time; there is **no research queue**.
- A research project is completed once; only at completion do its permanent effects apply.
- Bonuses may affect Attack, Defense, and other eligible global parameters.
- For combined research bonuses, apply **additive effects first**, then **multiplicative effects**.
- A raid captures its effective combat characteristics at launch. Later research does not retroactively alter an active raid.

**Upgrades:**

- **Research Tier Unlock:** sequential purchases unlock the next tier of research.
- **Research Efficiency:** sequential upgrades shorten research processes started after the improvement becomes active.
- Research projects and upgrades may have additional configured prerequisites.

Examples of research themes include **Improved Weapons**, **Improved Armor**, and **Fury Spell**. Their exact numerical effects come from configuration.

### 4.6 Dungeon

Dungeon holds prisoners captured during raids and processes them automatically.

- One prisoner occupies one **Cell**.
- Prisoners enter the Dungeon on Raid Report **Claim**, sorted by **descending Rank (highest first)** before assigning free cells. Excess prisoners are lost.
- Prisoners consume **no squad Carry Capacity**.
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

- **Enemy Intelligence:** upgrades reveal increasingly precise estimates of enemy strength. Before the first Enemy Intelligence upgrade, mission cards show raid duration as an **approximate rounded value** (`~Xh`); after purchasing the upgrade, the **precise duration** is displayed.
- **Loot Intelligence:** upgrades progressively reveal possible loot item types, resources, and estimated drop probability ranges. Early levels may conceal item types entirely.

Intelligence changes what the player **knows**, not the actual strength, loot probabilities, or inherent duration of the mission.

## 5. War Room World Map, Mission Progression, and Raids

### 5.1 World Tiers and Map Presentation

- The World Map appears **inside the War Room**.
- The current presentation lists **World Tiers as grouped sections**, with their individual missions. Literal concentric rings are **not required**; the grouped layout is a presentation simplification that changes no gameplay rules.
- The first World Tier is available from the start.
- A tier unlocks when **every individual mission in the preceding tier** has been successfully **Claimed** at least once.
- A mission's first successful Claim adds a permanent **green checkmark**.
- The player wins the current world after every mission on its map has been successfully Claimed at least once.
- Dungeon secrets may reveal or unlock particular map locations and influence configured events.

### 5.2 Mission Selection and Visibility

The War Room map marks each mission's progression and raid status:

| State | Meaning |
| --- | --- |
| `LOCKED` | Mission is not currently accessible |
| `AVAILABLE` | Eligible to start a raid |
| `RUNNING` | Raid active; the mission marker/card shows its progress bar |
| `COMPLETED_UNCLAIMED` | Raid finished; **Raid Report** awaits Claim |
| `COOLDOWN` | This mission's current-week raid opportunity has been consumed |
| `COMPLETED_ONCE` | Permanent first-success checkmark, shown alongside current raid/availability status |

Opening a mission on the War Room map displays its details, intelligence, duration, and squad/raid controls. The minion roster supplies squad candidates; only eligible minions can be assigned.

### 5.3 Raid Rules

- A squad is assigned to **one specific mission**.
- Participants must be available and have neither `Tired` nor `Injured`.
- Multiple raids may run concurrently on **different missions**.
- A minion can participate in only one occupied activity at a time.
- Raid success and duration derive from mission configuration, effective squad characteristics, and balancing formulas.
- Missions define difficulty/required power, baseline duration, injury chances, rewards, and prisoner distributions.

**Success:** generate configured rewards; every participant becomes `Tired` and independently rolls for `Injured`.

**Failure:** no rewards are generated; every participant becomes `Tired` and independently rolls for `Injured` using the same hidden injury-risk formula as on success. Failure does not guarantee injury.

Returning minions are reserved until the player **Claims** the Raid Report, including after a failed raid.

### 5.4 Weekly Mission Cooldown

Launching a raid consumes that mission's opportunity for the **current in-game week**, regardless of its outcome.

A mission can be launched when all conditions are met:

1. Its World Tier and mission-specific prerequisites permit access.
2. It has no raid currently `RUNNING` or `COMPLETED_UNCLAIMED`.
3. Its last launch occurred in an **earlier in-game week**.

A mission can be replayed in a later week, even if it was previously completed successfully. This remains true **after the Victory popup**.

## 6. War Room Raid Report Popup and Claim

**Raid Report** is a popup opened from the corresponding mission in the **War Room**, and uses the same interface for successful and failed raids.

- A finished raid appears as `COMPLETED_UNCLAIMED` until Claim.
- The popup displays mission/location information; discovered **items** and **prisoners**; and the participating **minions** with their resulting statuses. Loot and prisoners form adjacent collections, followed by squad information.
- Opening Raid Report **pauses game time**.
- Closing the popup without Claim does not credit rewards, free minions, or complete the mission.
- One **Claim** action confirms the entire outcome, even when the raid failed.

### 6.1 Carrying Capacity and Item Quantity Selection

Rewards are generated from mission configuration, not multiplied by squad size. A larger or stronger squad may perform better and carry more physical loot.

`carry_limit = floor(sum(rank_data[minion.rank].carry_capacity for each squad member))`

Carry Capacity is measured in **stack slots**. The Raid Report presents discovered physical items by **item type**, with **`+` / `−` controls** to select how many copies of each type to keep. This is equivalent to per-copy selection, but simpler to display.

For each item type:

`carry_slots_for_type = ceil(selected_copy_count / max_stack_size)`

`total_carry_slots = sum(carry_slots_for_type over selected item types)`

- The combined selected slot cost cannot exceed `carry_limit`.
- The game initially preselects a **valid subset** of discovered copies within the carry budget.
- The player may freely raise or lower the selected quantity of each type while respecting that budget.
- **Gold and Crystals** are always taken in full and use no Carry Capacity.
- **Prisoners** use no Carry Capacity.

**Example:** three minions carrying `1.5` each provide `floor(4.5) = 4` slots. Six Golden Cups with `max_stack_size = 5` consume two slots when all six are selected (`5 + 1`).

### 6.2 Claim Resolution

On pressing **Claim**:

1. Credit discovered **Gold and Crystals** if the raid succeeded.
2. Transfer selected physical item copies into the **Storehouse** in the player's **selection order**. Fill matching partial stacks and use free Storehouse slots as needed. If storage runs out, accept copies that can still fit and **silently discard any surplus**, preserving selection order.
3. Sort captured prisoners **highest-to-lowest Rank**, assign them automatically into available Dungeon cells, and discard any excess.
4. Apply the returning minions' `Tired` / `Injured` conditions and release the entire reserved squad.
5. On a first successful Claim, permanently mark the mission as completed, unlock the next World Tier when eligible, and trigger the **Victory popup** if every mission on the map has been successfully Claimed.
6. Preserve that mission's weekly launch cooldown until its next eligible week.

On **failure**, Claim still releases the squad and updates mission state, but credits no rewards.

The Storehouse's free-slot count does **not** restrict what the player may select within squad Carry Capacity. A selection can be valid for carrying yet lose overflow at Claim.

## 7. Physical Items and Economy

All physical items belong to **Storehouse storage** and are represented by item types and stacks, not by a standalone Inventory system or screen.

- **Treasures** are items bearing the `treasure` tag, not a separate resource class.
- **Items** and **Treasures** are Storehouse filters that share the same stack capacity.
- Each stack uses one Storehouse slot; `max_stack_size` controls the number of copies in it.
- Raid Carry Capacity also counts stacks/slots, but is calculated independently from free Storehouse capacity.
- Selling removes/reserves the full chosen stack at sale start. Concurrent timed sales are permitted, and instant sales receive the rounded-down half-value immediately.
- Item consumption for configured costs, full-value normal sales, upgrades, and other transactions obey resource-availability rules.
- Gold and Crystals are displayed globally in the HUD and never occupy storage slots.

## 8. Tower Level, Research Effects, and Upgrades

### 8.1 Tower Experience

The tower has one **Tower Level** derived from cumulative **Tower XP**.

- XP is a **hidden progression score**, not a spendable currency or a separate HUD balance.
- Configured upgrades and research projects can award specified XP values **on completion**, never on purchase/start.
- The `towerXpThresholds` entries are **cumulative total-XP thresholds**, not per-level increments.
- Reaching a new level **logs a message**. Tower Level itself currently gives **no gameplay unlocks or bonuses**.

### 8.2 Upgrade Timing and Concurrent Work

- Every Room has individually configured upgrades with costs, construction durations, prerequisites, and effects.
- Sequential upgrade series must satisfy configured prerequisites.
- **Multiple Room upgrade constructions may run concurrently.** This does not override the Laboratory's limit of one active research/improvement process at a time.
- Upgrades take effect when their construction finishes.
- An upgrade or research bonus completed while another timed activity is underway does **not retroactively modify** that running activity. New effects apply to subsequently started processes and future stat snapshots.
- Examples include extra beds, cells, stations, and Storehouse slots; faster sales, treatment, Dungeon processing, and research; training and research-tier unlocks; and War Room intelligence improvements.

### 8.3 Research Effect Combination

For compatible effects on a statistic, **additive modifiers are applied before multiplicative modifiers**. Exact modifier magnitudes and the statistics to which they apply come from configuration.

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

The Unity game uses designer-authored configuration for Ranks, items, starting balance, missions, World Tiers, upgrades, research, intelligence, Tower XP thresholds, weekly flavor messages, economy, Dungeon outcomes, and global formulas. The accompanying **Configuration Catalog** defines these contracts.

**Static configuration** defines rules, values, thresholds, and probabilities. **Runtime state** tracks Gold/Crystals, owned minions and their conditions, Quarters/Infirmary bed occupancy and idle-wait times, Storehouse stacks and concurrent sales, Dungeon prisoners, running timers, raids and discoveries, Claims, completed mission checks, upgrades and research, total Tower XP/Level, payday deadline/payment state, current world victory and portal state, and permanent Bankruptcy state.

The catalog may require a corresponding update to reflect the new decisions; this revision changes the **game design specification** only.

## 11. Provisional Balancing Formulas

The following combat formulas illustrate a configurable approach. Their coefficients are **not final balance values**.

```text
unit_power[i] = (0.65 * Attack[i] + 0.35 * Defense[i])
                * (1 + 0.10 * (Rank[i] - 1))
total_power = sum(unit_power[i])
power_ratio = total_power / mission.required_power
failure_chance = clamp(2.0 * (1 - power_ratio), 0, 1)

injury_chance[i] = clamp(
    mission.base_injury_chance
    + 0.20 * max(0, 1 - power_ratio)
    - 0.02 * (Rank[i] - 1)
    - 0.005 * max(0, Defense[i] - 5),
    0.01, 0.90)

raid_duration = mission.base_duration
                * max(0.80,
                    1 - 0.04 * (squad_size - 1)
                      - 0.01 * (average_rank - 1))
```

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
- **Balance and data:** Finalize numerical costs, starting capacity, XP awards/thresholds, research bonuses, raid/carry values, prisoner distributions, training prices, enemy formulas, and initial upgrade availability.
