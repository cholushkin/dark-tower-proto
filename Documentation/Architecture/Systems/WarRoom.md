# System: War Room (World Map, Raids, Roster)

**Authoritative rules:** [`../../DarkTowerGameDesign.md`](../../DarkTowerGameDesign.md) §4.7, §5, §11.

## Owning files

| File | Role |
|---|---|
| `src/systems/world.ts` | Village initialization/recovery, probability and injury queries, raid validation, launch snapshots, and resolution. |
| `src/systems/raidReport.ts` | Claim rewards, conditions, and permanent progression; see [`../Features/RaidLifecycle.md`](../Features/RaidLifecycle.md). |
| `src/model/GameState.ts` | Village queries, mission availability, tier/visit/completion state, and unresolved raids. |
| `src/model/types.ts` | Village, raid-snapshot, and report records. |
| `src/data/config.ts` | World registry, derived mission catalog, and `constants.raid` tuning. |
| `src/data/worlds/world-1A.ts` | Map image, mission positions, full defender counts, and reward-generation data. |
| `src/ui/screens/war-room/*` | Map, planning panel, and roster adapters/views. |
| `src/ui/components/MissionPin/*` | Flags, status markers, and revealed defender counts. |
| `src/systems/save.ts` | Serialization and backward-compatible defaults. |

## State ownership

`villages` stores weekly state. `everClaimedMissions` records permanent completion;
`unlockedTiers` controls progression; `everVisitedMissions` controls visit-based visibility.
`missionClaimedWeek` records successful claims only. `missionRunningProcess` and `pendingReports`
reserve each village and squad independently of weekly recovery. `missionState()` derives
availability from these records rather than storing a redundant enum.

## Presentation and integration

- Mission planning includes location art, defenders, duration, probability, carrying capacity,
  rewards, minion assignment, and the raid action. Hover/focus explanations describe calculations
  and why unavailable villages cannot be attacked.
- The map reveals active defenders after a completed visit or Enemy Intelligence; permanent
  completion indicators remain independent of availability.
- Injury estimates explain rank/Defense resistance. Weather remains location information and
  does not alter victory probability.
- Loot Intelligence continues to reveal item identities and configured drop chances.
- `previewRaid()` and `canLaunchRaid()` remain read-only queries. Mutations go through engine
  actions or system functions, following the architecture's read/write split.
- The War Room displays `CONFIG.startingWorldId`. World travel is not implemented; mission IDs
  remain unique across the registry.
