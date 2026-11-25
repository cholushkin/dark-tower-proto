# System: War Room (World Map, Raids, Roster)

**Authoritative rules** in [`../../DarkTowerGameDesign.md`](../../DarkTowerGameDesign.md) §4.7 and §5.

## Owning files

| File | Role |
|---|---|
| `src/systems/world.ts` | Village initialization and recovery, raid validation and launch snapshots, battle setup, and report creation. |
| `src/systems/battle.ts` | Target selection, simultaneous damage resolution, and turn logging. |
| `src/systems/raidReport.ts` | Claim rewards, conditions, and permanent progression; see [`../Features/RaidLifecycle.md`](../Features/RaidLifecycle.md). |
| `src/model/GameState.ts` | Mission selection, village queries, mission availability, and progression state. |
| `src/model/types.ts` | Village, raid-snapshot, and report records. |
| `src/data/config.ts` | World registry, derived mission catalog, rank definitions, and combat upgrades. |
| `src/data/worlds/world-1A.ts` | Map image, mission positions, eligibility flags, group IDs, and raid data. |
| `src/ui/screens/war-room/*` | Map, planning panel, and roster adapters/views. |
| `src/ui/components/MissionPin/*` | Flags, status markers, and revealed defender counts. |
| `src/systems/save.ts` | Serialization and backward-compatible defaults. |

## State ownership

`selectedMissionIds` stores the world's picks. `villages` stores their weekly state. `everClaimedMissions` records permanent completion;
`unlockedTiers` controls progression; `everVisitedMissions` controls visit-based visibility.
`missionClaimedWeek` records successful claims only. `missionRunningProcess` and `pendingReports`
reserve each village and squad independently of weekly recovery. `missionState()` derives
availability from these records rather than storing a redundant enum.

## Presentation and integration

- Mission planning presents defenders, fixed duration, reward information, minion assignment,
  and availability. Weather and art describe the location.
- Defender counts appear on map pins. Enemy Intelligence adds the active rank breakdown to the
  planning panel. Permanent completion indicators remain independent of availability.
- Pending raid reports replace the map flag with a return marker. It shows the walk-back timer
  and opens the same report as the planning panel's View Report button.
- `missionDef()` and `canLaunchRaid()` are read-only queries. Mutations go through engine actions
  or system functions.
- The War Room displays `CONFIG.startingWorldId`. Mission IDs are unique across the registry.
