import { CONFIG } from '../../../data/config';
import type { GameEngine } from '../../../engine/GameEngine';
import type { GameState } from '../../../model/GameState';
import { canLaunchRaid, missionDef, previewRaid } from '../../../systems/world';
import type { MinionComponentViewModel, MinionConditionDisplay } from '../../components/MinionComponent/MinionComponent.types';
import type { MissionPinViewModel, MissionVisualState } from '../../components/MissionPin/MissionPin.types';
import { asset } from '../assets';
import { buildUpgradeLineViewModel, fmtHours, groupUpgradeFamilies, itemIconFor, missionDifficultyIcons, missionLocationImage, missionWeather, nameFor, pct, portraitFor, roomUpgradeDefs, WORLD_TIER_ICON } from '../shared';
import type { MissionDetailViewModel, MissionParameterViewModel, RewardPreviewViewModel, WarRoomAction, WarRoomMinionViewModel, WarRoomViewModel } from './WarRoomViewModel';

export interface WarRoomUiState {
  showMapCoordinates: boolean;
  selectedMissionId: string | null;
  squadSelection: Set<string>;
}

export function createWarRoomUiState(): WarRoomUiState {
  return { selectedMissionId: null, squadSelection: new Set(), showMapCoordinates: false };
}

const roomImage = asset('war-room.webp');

const STATUS_BY_ACTIVITY: Record<string, { label: string; icon: string }> = {
  idle: { label: 'Idle', icon: '◌' },
  raid: { label: 'On Raid', icon: '⚔️' },
  training: { label: 'Training', icon: '🏋️' },
  resting: { label: 'Resting', icon: '🛏️' },
  treatment: { label: 'In Treatment', icon: '💗' },
};

function minionViewModel(state: GameState, id: string): MinionComponentViewModel {
  const minion = state.findMinion(id)!;
  const name = nameFor(id);
  const rankDef = CONFIG.ranks[minion.rank - 1];
  const status = STATUS_BY_ACTIVITY[minion.activity.type] ?? { label: minion.activity.type, icon: '•' };
  const conditions: MinionConditionDisplay[] = [];
  if (minion.injured) conditions.push({ id: 'injured', label: 'Injured', icon: '🩹', tone: 'injured' });
  if (minion.tired) conditions.push({ id: 'tired', label: 'Tired', icon: '🌙', tone: 'tired' });
  return {
    id,
    name,
    description: `${name} is a Rank ${minion.rank} ${rankDef.name} of the Dark Tower.`,
    rank: { label: `${rankDef.name} (R${minion.rank})`, icon: minion.rank === 5 ? '👑' : '⌃', tooltip: `Rank ${minion.rank}: ${rankDef.name}` },
    portrait: portraitFor(id),
    conditions,
    status: { id: status.label.toLowerCase().replace(/\s+/g, ''), label: status.label, icon: status.icon },
  };
}

function missionPinState(state: GameState, missionId: string): MissionVisualState {
  switch (state.missionState(missionId)) {
    case 'LOCKED': return 'locked';
    case 'RUNNING': return 'inProgress';
    case 'COMPLETED_UNCLAIMED': return 'completed';
    case 'COOLDOWN': return 'completed';
    default: return 'available';
  }
}

function buildMissionDetail(engine: GameEngine, ui: WarRoomUiState, missionId: string): MissionDetailViewModel {
  const state = engine.state;
  const mission = missionDef(missionId);
  const liveState = state.missionState(missionId);
  const visual = missionPinState(state, missionId);
  const squad = [...ui.squadSelection];
  const scouted = state.enemyIntelLevel() >= 1;
  const lootIntel = state.lootIntelLevel();

  const rewards: RewardPreviewViewModel[] = mission.loot.map(l => {
    const def = CONFIG.items.find(i => i.id === l.itemId)!;
    return { id: l.itemId, icon: lootIntel >= 1 ? itemIconFor(l.itemId) : { kind: 'emoji', value: '📦' }, chanceLabel: lootIntel >= 2 ? pct(l.chance) : '', label: lootIntel >= 2 ? `${def.name}: ${pct(l.chance)} chance on victory; ${l.min}–${l.max} found when dropped.` : lootIntel >= 1 ? `${def.name}. Upgrade Loot Intelligence to reveal its drop chance.` : 'Unknown loot type. Upgrade Loot Intelligence to identify it.' };
  });

  let statusLabel = 'Ready to raid';
  let activeProgress: number | undefined;
  let activeRemainingTime: string | undefined;
  if (liveState === 'RUNNING') {
    const processId = state.missionRunningProcess.get(missionId);
    const process = state.processes.find(p => p.id === processId);
    if (process) {
      activeProgress = Math.min(1, Math.max(0, (state.hours - process.startHour) / (process.endHour - process.startHour)));
      activeRemainingTime = fmtHours(Math.max(0, process.endHour - state.hours));
    }
    statusLabel = 'Raid in progress';
  } else if (liveState === 'COMPLETED_UNCLAIMED') statusLabel = 'Squad returned — claim rewards';
  else if (liveState === 'COOLDOWN') statusLabel = 'Already claimed this week';
  else if (liveState === 'LOCKED') statusLabel = 'Locked — unlock this World Tier first';

  const preview = liveState === 'AVAILABLE' ? previewRaid(state, missionId, squad) : null;
  const canRaid = liveState === 'AVAILABLE' ? canLaunchRaid(state, missionId, squad) : liveState === 'COMPLETED_UNCLAIMED';
  let raidDisabledReason: string | undefined;
  if (liveState === 'AVAILABLE' && !canRaid) raidDisabledReason = squad.length === 0 ? 'Select at least one minion' : 'Selected minions are unavailable';
  else if (liveState === 'RUNNING') raidDisabledReason = 'Raid already in progress';
  else if (liveState === 'COOLDOWN') raidDisabledReason = 'Already claimed this week';
  else if (liveState === 'LOCKED') raidDisabledReason = 'World Tier locked';

  const weather = missionWeather(mission);
  const duration = preview?.durationHours ?? mission.baseDurationHours;
  const parameters: MissionParameterViewModel[] = [
    { id: 'difficulty', icon: missionDifficultyIcons(mission), value: `Tier ${mission.tier}`,
      description: `Difficulty: Tier ${mission.tier}. Higher tiers contain tougher missions. Your chance of victory depends on the assigned squad.` },
    { id: 'duration', icon: '⌛', value: liveState === 'RUNNING' ? `${activeRemainingTime ?? '—'} remaining` : scouted ? `${duration.toFixed(1)}h` : `~${Math.round(duration)}h`,
      description: liveState === 'RUNNING' ? 'Time remaining until this raid resolves, in game hours.' : `${squad.length ? 'Estimated raid duration' : 'Base raid duration'} in game hours. Additional minions and higher average rank reduce the duration by up to 20%. Enemy Intelligence reveals a more precise estimate.` },
  ];
  if (preview) {
    parameters.push(
      { id: 'success', icon: '🎯', value: !scouted ? 'Success unknown' : squad.length ? `${pct(1 - preview.failureChance)} success` : 'Assign minions',
        description: !scouted ? 'Success chance is hidden. Upgrade Enemy Intelligence to estimate it for your assigned squad.' : 'Chance of winning and receiving rewards. Calculated from combined squad power versus mission strength. Attack, defense, rank, research and favorable weather improve squad power.' },
      { id: 'capacity', icon: '🎒', value: `${squad.reduce((sum, id) => sum + CONFIG.ranks[state.findMinion(id)!.rank - 1].carryCapacity, 0)} loot slots`,
        description: 'Carrying capacity: total item-stack slots your assigned minions can bring back. Higher-rank minions carry more. Items of the same type can share a stack.' },
    );
  }

  parameters.push({ id: 'weather', icon: weather.icon, value: weather.label, description: weather.description });

  return {
    id: missionId,
    name: mission.name,
    description: mission.description,
    locationImageSrc: missionLocationImage(mission),
    locationImageAlt: mission.name,
    rewards,
    rewardIntelLabel: lootIntel >= 2 ? 'Drop chances on victory' : lootIntel >= 1 ? 'Items revealed · chances unknown' : `${mission.loot.length} possible loot types · unidentified`,
    parameters,
    squadSelectionLabel: `${squad.length} selected`,
    state: visual,
    statusLabel,
    activeProgress,
    activeRemainingTime,
    canRaid,
    raidDisabledReason,
    canEditSquad: liveState === 'AVAILABLE',
    minionTrayLabel: 'Assign Minions',
  };
}

export function buildWarRoomViewModel(engine: GameEngine, ui: WarRoomUiState): WarRoomViewModel {
  const state = engine.state;
  const upgrades = groupUpgradeFamilies(roomUpgradeDefs('warRoom')).map(family => {
    const icon = family[0].effect.type === 'lootIntel' ? '🔍' : '🗺️';
    const title = family[0].effect.type === 'lootIntel' ? 'Loot Intelligence' : 'Enemy Intelligence';
    return buildUpgradeLineViewModel(state, family, icon, title);
  });

  const world = CONFIG.worlds.find(world => world.id === CONFIG.startingWorldId);
  if (!world) throw new Error(`Unknown starting world: ${CONFIG.startingWorldId}`);
  const missions: MissionPinViewModel[] = world.missions.map(mission => {
    const pos = mission.mapPosition;
    const visual = missionPinState(state, mission.id);
    const processId = state.missionRunningProcess.get(mission.id);
    const process = state.processes.find(p => p.id === processId);
    return {
      id: mission.id,
      name: mission.name,
      x: pos.x,
      y: pos.y,
      tier: mission.tier,
      icon: WORLD_TIER_ICON[Math.min(2, mission.tier - 1)],
      difficultyIcons: missionDifficultyIcons(mission),
      rewardIcons: mission.loot.slice(0, 2).map(() => '📦'),
      state: visual,
      raidProgress: process ? Math.min(1, Math.max(0, (state.hours - process.startHour) / (process.endHour - process.startHour))) : undefined,
      raidStatusLabel: visual === 'inProgress' ? 'Raid in progress' : undefined,
      selected: mission.id === ui.selectedMissionId,
    };
  });

  const selectedMission = ui.selectedMissionId ? buildMissionDetail(engine, ui, ui.selectedMissionId) : null;
  const canEditSquad = selectedMission?.canEditSquad ?? false;

  const minions: WarRoomMinionViewModel[] = state.minions.map(m => {
    const idle = m.activity.type === 'idle' && !m.tired && !m.injured;
    const selected = ui.squadSelection.has(m.id);
    return {
      minion: minionViewModel(state, m.id),
      selected,
      selectable: canEditSquad && (idle || selected),
      unavailableReason: idle || !canEditSquad ? undefined : `${nameFor(m.id)} is unavailable`,
    };
  });

  return {
    title: 'War Room',
    worldName: world.name,
    showMapCoordinates: ui.showMapCoordinates,
    mapImageSrc: `${import.meta.env.BASE_URL}${world.mapImage}`,
    mapImageAlt: `${world.name} map`,
    room: {
      id: 'warRoom',
      title: 'War Room',
      imageSrc: roomImage,
      imageAlt: 'The War Room',
      stats: [
        { id: 'enemy-intel', icon: '🔍', label: 'Enemy Intel', value: `Lv.${state.enemyIntelLevel()}` },
        { id: 'loot-intel', icon: '🗺️', label: 'Loot Intel', value: `Lv.${state.lootIntelLevel()}`, emphasized: true },
      ],
    },
    upgrades,
    missions,
    selectedMissionId: ui.selectedMissionId,
    selectedMission,
    minions,
  };
}

export interface WarRoomNav {
  openRaidReport(missionId: string): void;
}

export function handleWarRoomAction(engine: GameEngine, ui: WarRoomUiState, action: WarRoomAction, nav: WarRoomNav): void {
  const state = engine.state;
  switch (action.type) {
    case 'upgradeRequested': {
      const family = groupUpgradeFamilies(roomUpgradeDefs('warRoom')).find(f => f.some(d => d.id.replace(/_\d+$/, '') === action.upgradeId));
      const ownedCount = family?.filter(d => state.purchasedUpgrades.has(d.id)).length ?? 0;
      const next = family?.[ownedCount];
      if (next) engine.buyUpgrade(next.id);
      return;
    }
    case 'missionSelected':
      ui.selectedMissionId = action.missionId;
      ui.squadSelection = new Set();
      return;
    case 'missionInfoRequested':
    case 'minionInfoRequested':
      return; // Informational only; the components show their own tooltips.
    case 'minionSelectionRequested':
      if (ui.squadSelection.has(action.minionId)) ui.squadSelection.delete(action.minionId);
      else ui.squadSelection.add(action.minionId);
      return;
    case 'missionClosed':
      ui.selectedMissionId = null;
      ui.squadSelection.clear();
      return;
    case 'raidRequested': {
      const missionState = state.missionState(action.missionId);
      if (missionState === 'AVAILABLE') {
        if (engine.launchRaid(action.missionId, [...ui.squadSelection])) ui.squadSelection = new Set();
      } else if (missionState === 'COMPLETED_UNCLAIMED') {
        nav.openRaidReport(action.missionId);
      }
      return;
    }
  }
}
