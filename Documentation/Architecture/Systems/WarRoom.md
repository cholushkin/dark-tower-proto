# System: War Room (World Map, Raids, Roster)

**Authoritative rules:** [`../../DarkTowerGameDesign.md`](../../DarkTowerGameDesign.md) §4.7, §5.

## Owning files

| File | Role |
|---|---|
| `src/systems/world.ts` | `previewRaid`, `canLaunchRaid`, `launchRaid`, `resolveRaid`, `squadPower`/`unitPower` (provisional combat formulas, design doc §11). |
| `src/systems/raidReport.ts` | Claim-time resolution — see [`../Features/RaidLifecycle.md`](../Features/RaidLifecycle.md), it's documented as a Feature because it spans this system plus Storehouse/Dungeon/Recovery. |
| `src/model/GameState.ts` | `missionState()` (`GameState.ts:267-274`), `unlockedTiers`, `everClaimedMissions`, `everVisitedMissions`, `missionClaimedWeek`, `missionRunningProcess`, `pendingReports`. |
| `src/data/config.ts` | World registry, starting world, derived mission catalog, and world tiers. |
| `src/data/worlds/world-1A.ts` | Starting world image and mission definitions, including editable percentage `mapPosition` coordinates. |
| `src/ui/screens/war-room/*` | UI entry point — the largest Adapter in the codebase (`WarRoomAdapter.ts`, ~265 lines) because it composes map, mission detail, and roster/squad-picker in one screen. |

## State owned

Mission progression is tracked by three independent sets/maps rather than one "mission record"
struct: `unlockedTiers` (tier gating), `everClaimedMissions` (permanent green-checkmark + tier
unlock trigger), `everVisitedMissions` (cosmetic "raided before" flag), `missionClaimedWeek`
(weekly cooldown). `missionState()` derives the five-value `MissionState` enum
(`model/types.ts:108-113`) from these plus `pendingReports`/`missionRunningProcess` on every call —
there's no stored `MissionState` field to go stale.

## Notes for agents

- `previewRaid()`/`canLaunchRaid()` are pure read-only functions the UI calls directly (not through
  `GameEngine`) to render success/duration estimates before the player commits — see the
  read/write split explained in
  [`../CurrentArchitecture.md`](../CurrentArchitecture.md)#5-ui-shell-screens-components. Only
  `launchRaid()` (called via `engine.launchRaid()`) mutates state.
- Each world config owns its map image and missions. The War Room displays `CONFIG.startingWorldId`;
  world travel/progression is not implemented. Register future worlds in `WORLDS` in `config.ts`
  and keep mission IDs globally unique. `CONFIG.missions` is derived for existing gameplay lookups.
- Mission `mapPosition.x` and `.y` are percentages from the map’s top-left (0–100).
  Reordering missions no longer changes pin positions. Initial coordinates preserve the previous
  ring layout as editable placeholders. Location art/weather/difficulty flavor remains in `shared.ts`.
- Combat formulas in `world.ts` (`unitPower`, `failureChance`, `injuryChanceFor`) match design doc
  §11 exactly but are explicitly **provisional**, not final balance.
